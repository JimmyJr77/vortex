/**
 * Stripe Checkout for member enrollment — pay-then-commit flow.
 * See docs/STRIPE_CATALOG_INTEGRATION.md Phase 2.
 */

import crypto from 'crypto'
import { getStripeClient, stripeEnabled, ensureStripeBillingSchema } from './stripeBilling.js'
import {
  feeLookupKey,
  formOverrideLookupKey,
  passLookupKey,
  programOptionLookupKey,
  resolveStripePriceId,
  ensureStripeCatalogSchema,
  ensureBillingRecurringSchema,
} from './stripeCatalogSync.js'
import { buildSignupOrderPreview } from '../scheduling/orderPricing.js'
import { executeSignupBatch } from '../scheduling/handlers.js'
import { weeklyTierKeyForSlotCount, programUsesWeeklyTierPricing } from '../programs/weeklyTierPricing.js'
import {
  hydrateProgramPricingRow,
  normalizeProgramPricingOptions,
} from '../programs/programPricingOptions.js'
import { formHasCustomPricingOverride } from '../programs/pricingDefaults.js'
import { firstOfNextMonth, todayDateOnly } from '../scheduling/firstMonthProration.js'

let pendingSchemaEnsured = false

async function ensurePendingEnrollmentSchema(pool) {
  if (pendingSchemaEnsured) return
  const fs = await import('fs')
  const migrationPath = new URL('../migrations/057_stripe_pending_enrollment.sql', import.meta.url)
  await pool.query(fs.readFileSync(migrationPath, 'utf8'))
  pendingSchemaEnsured = true
}

export function computeEnrollmentDueNowCents(preview) {
  const fees = Math.round((preview.additionalFeesOneTime ?? 0) * 100)
  const firstMonth = preview.firstMonth?.totalCents ?? 0
  const passes = preview.passPurchaseTotalCents ?? 0
  const carriedForward = preview.carriedForward?.totalCents ?? 0
  return Math.max(0, fees + firstMonth + passes + (carriedForward > 0 ? carriedForward : 0))
}

export function enrollmentNeedsStripeCheckout(preview) {
  const dueNow = computeEnrollmentDueNowCents(preview)
  const hasRecurring = (preview.newSignups ?? []).some(
    (line) =>
      line.billingType === 'recurring' &&
      !line.multiClassPassApplied &&
      (line.monthlyPrice ?? line.incrementalMonthly ?? 0) > 0,
  )
  const hasPassPurchase = (preview.passPurchases?.length ?? 0) > 0
  return dueNow > 0 || hasRecurring || hasPassPurchase
}

function dateStringToUnixBillingAnchor(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d, 12, 0, 0) / 1000)
}

/** @deprecated use dateStringToUnixBillingAnchor */
function dateStringToUnixTrialEnd(dateStr) {
  return dateStringToUnixBillingAnchor(dateStr)
}

/**
 * One-time tuition line items matching preview.firstMonth (prorated now + prepaid now).
 * Does not include fees, passes, or recurring subscription amounts.
 */
export function computeFirstMonthTuitionLineItems(preview) {
  const lines = []
  if (!preview.firstMonth?.enabled) return lines
  for (const fm of preview.firstMonth.items ?? []) {
    const label = fm.displayLine ?? fm.formTitle ?? 'Class enrollment'
    const prorated = Math.round(Number(fm.proratedCents) || 0)
    const prepaid = Math.round(Number(fm.prepaidFirstMonthCents) || 0)
    if (prorated > 0) {
      lines.push({
        amountCents: prorated,
        name: `${label} — first month (prorated)`,
      })
    }
    if (prepaid > 0) {
      lines.push({
        amountCents: prepaid,
        name: `${label} — first month (prepaid)`,
      })
    }
  }
  return lines
}

/**
 * When recurring billing should start in Stripe for one first-month line item.
 * - In-session classes: next 1st after prorated/prepaid tuition collected at checkout.
 * - Future-start prepaid classes: 1st of the month after the prepaid service month.
 */
export function computeFirstMonthBillingAnchorDate(fmItem, fromDate) {
  if (fmItem?.classStartsFutureMonth) {
    const serviceMonthStart = fmItem.firstBillDate ?? fmItem.firstServicePeriodStart ?? fromDate
    return firstOfNextMonth(serviceMonthStart)
  }
  if ((fmItem?.proratedCents ?? 0) > 0 || (fmItem?.prepaidFirstMonthCents ?? 0) > 0) {
    return fmItem.firstBillDate ?? firstOfNextMonth(fromDate)
  }
  return firstOfNextMonth(fromDate)
}

/** Latest billing anchor when multiple classes enroll in one checkout. */
export function computeSubscriptionBillingAnchorDate(preview, asOfDate = null) {
  const fromDate = asOfDate ?? todayDateOnly()
  const fmItems = preview.firstMonth?.enabled ? preview.firstMonth.items ?? [] : []
  let maxAnchorDate = null
  for (const fm of fmItems) {
    const anchorDate = computeFirstMonthBillingAnchorDate(fm, fromDate)
    if (!maxAnchorDate || anchorDate > maxAnchorDate) maxAnchorDate = anchorDate
  }
  return maxAnchorDate ?? firstOfNextMonth(fromDate)
}

/** @deprecated Stripe trial_end showed misleading "X days free" — use billing_cycle_anchor after payment instead. */
export function computeSubscriptionTrialEndUnix(preview, asOfDate = null) {
  return dateStringToUnixBillingAnchor(computeSubscriptionBillingAnchorDate(preview, asOfDate))
}

async function resolveOptionKeyForPreviewLine(pool, preview, line) {
  if (line.selectedPricingOptionKey) return line.selectedPricingOptionKey

  const summary = (preview.formSummaries ?? []).find((s) => s.formId === line.formId)
  if (summary?.usesWeeklyTierPricing && summary.totalSlotCount > 0) {
    return weeklyTierKeyForSlotCount(summary.totalSlotCount)
  }

  const formRes = await pool.query(
    `SELECT id, programs_id, pricing_overrides_program FROM scheduling_form WHERE id = $1`,
    [line.formId],
  )
  const formRow = formRes.rows[0]
  if (!formRow) return 'monthly_1x'

  if (formRow.programs_id != null) {
    const { resolveProgramsSchema } = await import('../programs/schema.js')
    const schema = await resolveProgramsSchema(pool)
    const progRes = await pool.query(
      `SELECT id, pricing_cost_options, pricing_cost_amount_cents, pricing_slot_cost_monthly_cents, pricing_cost_unit
       FROM ${schema.programsTable} WHERE id = $1`,
      [formRow.programs_id],
    )
    const programRow = hydrateProgramPricingRow(progRes.rows[0])
    const options = normalizeProgramPricingOptions(programRow?.pricing_cost_options)
    if (programUsesWeeklyTierPricing({ pricing_cost_options: options })) {
      const count = summary?.totalSlotCount ?? 1
      return weeklyTierKeyForSlotCount(count) ?? 'monthly_1x'
    }
    const enabled = options.filter((o) => o.enabled && o.amountCents > 0)
    return enabled[0]?.key ?? 'monthly_1x'
  }
  return 'monthly_1x'
}

async function catalogLookupForLine(pool, preview, line) {
  const formRes = await pool.query(
    `SELECT id, programs_id, pricing_overrides_program, cost_amount_cents, cost_unit, slot_cost_monthly_cents
     FROM scheduling_form WHERE id = $1`,
    [line.formId],
  )
  const formRow = formRes.rows[0]
  const programsId = line.programsId ?? formRow?.programs_id

  if (formHasCustomPricingOverride(formRow)) {
    return formOverrideLookupKey(formRow.id)
  }

  const optionKey = await resolveOptionKeyForPreviewLine(pool, preview, line)
  if (programsId == null) return null
  return programOptionLookupKey(Number(programsId), optionKey)
}

async function buildCheckoutLineItems(pool, preview, { includeRecurringSubscriptionPrices = false } = {}) {
  const lineItems = []
  const seenRecurring = new Set()

  if (includeRecurringSubscriptionPrices) {
    for (const line of preview.newSignups ?? []) {
      if (line.multiClassPassApplied) continue
      if (line.billingType !== 'recurring') continue
      if ((line.monthlyPrice ?? line.incrementalMonthly ?? 0) <= 0) continue

      const lookupKey = await catalogLookupForLine(pool, preview, line)
      if (!lookupKey || seenRecurring.has(lookupKey)) continue
      seenRecurring.add(lookupKey)

      const priceId = await resolveStripePriceId(pool, lookupKey)
      if (!priceId) {
        throw new Error(`Stripe price not synced for ${lookupKey}. Run catalog sync or re-save program pricing.`)
      }
      lineItems.push({ price: priceId, quantity: 1 })
    }
  }

  for (const pass of preview.passPurchases ?? []) {
    const lookupKey = passLookupKey(Number(pass.programsId), pass.packageId)
    const priceId = await resolveStripePriceId(pool, lookupKey)
    if (!priceId) {
      throw new Error(`Stripe price not synced for pass ${lookupKey}.`)
    }
    lineItems.push({ price: priceId, quantity: 1 })
  }

  for (const fee of preview.additionalFees?.items ?? []) {
    if ((fee.amountCents ?? 0) <= 0) continue
    const lookupKey = feeLookupKey(Number(fee.feeId ?? fee.id))
    const priceId = await resolveStripePriceId(pool, lookupKey)
    if (priceId) {
      lineItems.push({ price: priceId, quantity: 1 })
    } else {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(fee.amountCents),
          product_data: { name: fee.name || 'Additional fee' },
        },
      })
    }
  }

  for (const tuition of computeFirstMonthTuitionLineItems(preview)) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: tuition.amountCents,
        product_data: { name: tuition.name.slice(0, 200) },
      },
    })
  }

  if (lineItems.length === 0) {
    const dueNow = computeEnrollmentDueNowCents(preview)
    if (dueNow > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: dueNow,
          product_data: { name: 'Vortex Athletics enrollment' },
        },
      })
    }
  }

  return lineItems
}

/**
 * After enrollment payment, create Stripe Subscriptions anchored to the 1st when recurring
 * billing begins — avoids Checkout "X days free" trial wording while first-month tuition
 * is collected as one-time line items.
 */
export async function createEnrollmentStripeSubscriptions(
  pool,
  stripe,
  { preview, stripeSession, signupIds, familyBillingAccountId },
) {
  if (!stripe || !signupIds?.length) return

  const sessionId = typeof stripeSession === 'string' ? stripeSession : stripeSession?.id
  if (!sessionId) return

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.payment_method'],
  })
  const customerId = session.customer
  if (!customerId) return

  let defaultPaymentMethod = session.payment_intent?.payment_method ?? null
  if (defaultPaymentMethod && typeof defaultPaymentMethod === 'object') {
    defaultPaymentMethod = defaultPaymentMethod.id
  }

  const previewObj = preview
  const fromDate = previewObj.firstMonth?.periodStart ?? todayDateOnly()

  const subsRes = await pool.query(
    `SELECT bs.id, bs.source_id
     FROM billing_subscription bs
     WHERE bs.source_type = 'scheduling_signup'
       AND bs.source_id = ANY($1::text[])
       AND bs.status = 'active'
       AND bs.stripe_subscription_id IS NULL`,
    [signupIds.map(String)],
  )

  for (const subRow of subsRes.rows) {
    const signupId = Number(subRow.source_id)
    const signupRes = await pool.query(
      `SELECT form_id, slot_group_id, time_slot_id FROM scheduling_signup WHERE id = $1`,
      [signupId],
    )
    const signup = signupRes.rows[0]
    if (!signup) continue

    const slotKey = `${signup.form_id}:${signup.slot_group_id}:${signup.time_slot_id ?? 'none'}`
    const previewLine = (previewObj.newSignups ?? []).find((line) => line.slotKey === slotKey)
    if (!previewLine || previewLine.billingType !== 'recurring' || previewLine.multiClassPassApplied) {
      continue
    }
    if ((previewLine.monthlyPrice ?? previewLine.incrementalMonthly ?? 0) <= 0) continue

    const fmItem = (previewObj.firstMonth?.items ?? []).find((item) => item.slotKey === slotKey)
    const anchorDate = fmItem
      ? computeFirstMonthBillingAnchorDate(fmItem, fromDate)
      : firstOfNextMonth(fromDate)

    const lookupKey = await catalogLookupForLine(pool, previewObj, previewLine)
    if (!lookupKey) continue
    const priceId = await resolveStripePriceId(pool, lookupKey)
    if (!priceId) continue

    const stripeSub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      billing_cycle_anchor: dateStringToUnixBillingAnchor(anchorDate),
      proration_behavior: 'none',
      ...(defaultPaymentMethod ? { default_payment_method: defaultPaymentMethod } : {}),
      metadata: {
        billingSubscriptionId: String(subRow.id),
        familyBillingAccountId: String(familyBillingAccountId),
        checkoutType: 'enrollment',
      },
    })

    await pool.query(
      `UPDATE billing_subscription SET stripe_subscription_id = $2, updated_at = now() WHERE id = $1`,
      [subRow.id, stripeSub.id],
    )
  }
}

function previewFingerprint(preview) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        dueNow: computeEnrollmentDueNowCents(preview),
        monthly: preview.estimatedMonthlyTotal,
        newCount: preview.newSignups?.length ?? 0,
        passTotal: preview.passPurchaseTotalCents ?? 0,
      }),
    )
    .digest('hex')
    .slice(0, 16)
}

export async function createEnrollmentCheckoutSession(
  pool,
  { account, memberId, batchPayload, successUrl, cancelUrl },
) {
  if (!stripeEnabled()) return null
  await ensureStripeBillingSchema(pool)
  await ensureStripeCatalogSchema(pool)
  await ensurePendingEnrollmentSchema(pool)

  const stripe = await getStripeClient()
  if (!stripe) return null

  const slotSignups = (batchPayload.signups ?? []).filter((s) => s.lineType !== 'multi_class_pass')
  const passSignups = (batchPayload.signups ?? []).filter((s) => s.lineType === 'multi_class_pass')

  const preview = await buildSignupOrderPreview(pool, {
    memberId,
    newSignups: [
      ...slotSignups.map((s) => ({
        formId: s.formId,
        slotGroupId: s.slotGroupId,
        timeSlotId: s.timeSlotId,
        formTitle: s.formTitle,
        selectedPricingOptionKey: s.selectedPricingOptionKey,
        useMultiClassPass: s.useMultiClassPass,
        lineType: 'slot',
      })),
      ...passSignups.map((p) => ({
        lineType: 'multi_class_pass',
        programsId: p.programsId,
        packageId: p.packageId,
      })),
    ],
    promoCodes: batchPayload.promoCodes ?? [],
  })

  if (!enrollmentNeedsStripeCheckout(preview)) {
    return { skipCheckout: true, preview }
  }

  const dueNowCents = computeEnrollmentDueNowCents(preview)
  const hasRecurring = (preview.newSignups ?? []).some(
    (line) => line.billingType === 'recurring' && !line.multiClassPassApplied,
  )
  // Payment mode: collect due-now tuition/fees only. Recurring Stripe subscriptions are
  // created after payment with a billing-cycle anchor (no misleading "free trial" copy).
  const mode = 'payment'
  const lineItems = await buildCheckoutLineItems(pool, preview, {
    includeRecurringSubscriptionPrices: false,
  })

  if (lineItems.length === 0) {
    return { skipCheckout: true, preview }
  }

  const pending = await pool.query(
    `INSERT INTO stripe_pending_enrollment (
       family_billing_account_id, member_id, payload, preview_snapshot,
       due_now_cents, checkout_mode, status
     ) VALUES ($1,$2,$3,$4,$5,$6,'pending')
     RETURNING id`,
    [
      account.id,
      memberId,
      JSON.stringify(batchPayload),
      JSON.stringify(preview),
      dueNowCents,
      mode,
    ],
  )
  const pendingId = pending.rows[0].id

  const customerId = account.stripe_customer_id
    ? account.stripe_customer_id
    : (
        await stripe.customers.create({
          email: account.billing_email || undefined,
          metadata: {
            familyBillingAccountId: String(account.id),
            familyId: String(account.family_id),
          },
        })
      ).id

  if (!account.stripe_customer_id) {
    await pool.query(
      `UPDATE family_billing_account SET stripe_customer_id = $2, updated_at = now() WHERE id = $1`,
      [account.id, customerId],
    )
  }

  const sessionParams = {
    mode,
    customer: customerId,
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    payment_intent_data: {
      setup_future_usage: 'off_session',
    },
    metadata: {
      checkoutType: 'enrollment',
      pendingEnrollmentId: String(pendingId),
      familyBillingAccountId: String(account.id),
      memberId: String(memberId),
      previewHash: previewFingerprint(preview),
      hasRecurring: hasRecurring ? 'true' : 'false',
    },
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  await pool.query(
    `UPDATE stripe_pending_enrollment
     SET stripe_checkout_session_id = $2, updated_at = now()
     WHERE id = $1`,
    [pendingId, session.id],
  )

  return { url: session.url, pendingEnrollmentId: pendingId, preview }
}

export async function commitPendingEnrollment(pool, { pendingEnrollmentId, stripeSession = null }) {
  await ensureBillingRecurringSchema(pool)
  await ensurePendingEnrollmentSchema(pool)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const pendingRes = await client.query(
      `SELECT * FROM stripe_pending_enrollment WHERE id = $1 FOR UPDATE`,
      [pendingEnrollmentId],
    )
    const pending = pendingRes.rows[0]
    if (!pending) {
      await client.query('ROLLBACK')
      return { status: 'not_found' }
    }
    if (pending.status === 'completed') {
      await client.query('COMMIT')
      return { status: 'already_completed' }
    }
    if (pending.status !== 'pending') {
      await client.query('ROLLBACK')
      return { status: 'invalid', reason: pending.status }
    }

    const payload = pending.payload
    const previewSnapshot =
      typeof pending.preview_snapshot === 'string'
        ? JSON.parse(pending.preview_snapshot)
        : pending.preview_snapshot

    const result = await executeSignupBatch(pool, payload)
    await client.query(
      `UPDATE stripe_pending_enrollment
       SET status = 'completed', updated_at = now()
       WHERE id = $1`,
      [pendingEnrollmentId],
    )

    const signupIds = (result?.data?.signups ?? []).map((row) => Number(row.id)).filter(Boolean)

    if (stripeSession?.subscription) {
      // Legacy Checkout sessions created in subscription mode (pre–payment-only enrollment).
      await client.query(
        `UPDATE billing_subscription
         SET stripe_subscription_id = $2, updated_at = now()
         WHERE family_billing_account_id = $1
           AND status = 'active'
           AND stripe_subscription_id IS NULL
           AND created_at >= now() - interval '5 minutes'`,
        [pending.family_billing_account_id, stripeSession.subscription],
      )
    } else if (signupIds.length > 0 && previewSnapshot) {
      const stripe = await getStripeClient()
      if (stripe) {
        await createEnrollmentStripeSubscriptions(pool, stripe, {
          preview: previewSnapshot,
          stripeSession,
          signupIds,
          familyBillingAccountId: pending.family_billing_account_id,
        })
      }
    }

    await client.query('COMMIT')
    return { status: 'completed', result }
  } catch (err) {
    await client.query('ROLLBACK')
    await pool.query(
      `UPDATE stripe_pending_enrollment
       SET status = 'failed', error_message = $2, updated_at = now()
       WHERE id = $1 AND status = 'pending'`,
      [pendingEnrollmentId, String(err.message ?? err).slice(0, 500)],
    )
    throw err
  } finally {
    client.release()
  }
}

export async function getCatalogSyncStatus(pool) {
  await ensureStripeCatalogSchema(pool)
  const totals = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE active) AS active_count,
      COUNT(*) FILTER (WHERE NOT active) AS inactive_count,
      COUNT(*) AS total_count
    FROM stripe_catalog_item
  `)
  return {
    stripeEnabled: stripeEnabled(),
    catalogItems: totals.rows[0],
    lastSynced: await pool.query(
      `SELECT MAX(last_synced_at) AS last_synced_at FROM stripe_catalog_item`,
    ).then((r) => r.rows[0]?.last_synced_at ?? null),
  }
}
