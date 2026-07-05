/**
 * Stripe Checkout for member enrollment — pay-then-commit flow.
 * See docs/STRIPE_CATALOG_INTEGRATION.md Phase 2.
 */

import crypto from 'crypto'
import { getStripeClient, stripeEnabled, ensureStripeBillingSchema, recordEnrollmentStripePayment } from './stripeBilling.js'
import {
  feeLookupKey,
  formOverrideLookupKey,
  passLookupKey,
  programOptionLookupKey,
  resolveStripePriceId,
  ensureStripeCatalogSchema,
  ensureBillingRecurringSchema,
  getCatalogSyncStatus,
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
import { issueSignupAuthToken } from '../scheduling/signupAuth.js'
import { findMemberById } from '../members/createMemberStub.js'

async function loadFormProgramsId(pool, formId) {
  const res = await pool.query(`SELECT programs_id FROM scheduling_form WHERE id = $1`, [formId])
  return res.rows[0]?.programs_id != null ? Number(res.rows[0].programs_id) : null
}

/** Fresh signup JWT for webhook/confirm commit (avoids expired tokens from checkout redirect delay). */
async function refreshSignupAuthForCommit(pool, payload, memberId) {
  const body = typeof payload === 'string' ? JSON.parse(payload) : { ...payload }
  const member = await findMemberById(pool, memberId)
  if (!member) throw new Error('Member account not found')
  const firstFormId = body.signups?.find((s) => s.formId != null)?.formId
  if (!firstFormId) throw new Error('Invalid enrollment payload')
  const programsId = await loadFormProgramsId(pool, firstFormId)
  body.signupAuthToken = issueSignupAuthToken({
    formId: firstFormId,
    memberId: Number(memberId),
    email: member.email,
    programsId,
  })
  return body
}

function parsePendingPayload(payload) {
  return typeof payload === 'string' ? JSON.parse(payload) : payload
}

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

export function enrollmentHasRecurringMembership(preview) {
  return (preview.newSignups ?? []).some(
    (line) =>
      line.billingType === 'recurring' &&
      !line.multiClassPassApplied &&
      (line.monthlyPrice ?? line.incrementalMonthly ?? 0) > 0,
  )
}

/** Stripe trial_end disclaimer — only for recurring membership checkout, not one-time purchases. */
export function shouldShowEnrollmentCheckoutSubmitMessage(preview) {
  return enrollmentHasRecurringMembership(preview)
}

export function enrollmentNeedsStripeCheckout(preview) {
  const dueNow = computeEnrollmentDueNowCents(preview)
  const hasRecurring = enrollmentHasRecurringMembership(preview)
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
 * Checkout line label for first-month tuition due at enrollment.
 * Full remaining months use neutral "tuition" wording; partial months say "prorated".
 */
export function formatFirstMonthTuitionLineName(fm) {
  const label = fm.displayLine ?? fm.formTitle ?? 'Class enrollment'
  const prepaid = Math.round(Number(fm.prepaidFirstMonthCents) || 0)
  const prorated = Math.round(Number(fm.proratedCents) || 0)
  if (prepaid > 0) {
    return `${label} — first month (prepaid)`
  }
  const classesPerMonth = fm.classesPerMonth ?? 4
  const remaining = fm.remainingClasses ?? classesPerMonth
  const ratio = Number(fm.ratio ?? 1)
  const isFullMonth = ratio >= 1 || remaining >= classesPerMonth
  if (prorated > 0 && !isFullMonth) {
    return `${label} — first month (prorated)`
  }
  return `${label} — first month tuition`
}

/**
 * One-time tuition line items matching preview.firstMonth (prorated now + prepaid now).
 * Does not include fees, passes, or recurring subscription amounts.
 */
export function computeFirstMonthTuitionLineItems(preview) {
  const lines = []
  if (!preview.firstMonth?.enabled) return lines
  for (const fm of preview.firstMonth.items ?? []) {
    const prorated = Math.round(Number(fm.proratedCents) || 0)
    const prepaid = Math.round(Number(fm.prepaidFirstMonthCents) || 0)
    if (prorated > 0) {
      lines.push({
        amountCents: prorated,
        name: formatFirstMonthTuitionLineName({ ...fm, prepaidFirstMonthCents: 0 }),
      })
    }
    if (prepaid > 0) {
      lines.push({
        amountCents: prepaid,
        name: formatFirstMonthTuitionLineName(fm),
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

/** Unix timestamp for deferred recurring billing in Checkout (required with one-time line items). */
export function computeSubscriptionTrialEndUnix(preview, asOfDate = null) {
  return dateStringToUnixBillingAnchor(computeSubscriptionBillingAnchorDate(preview, asOfDate))
}

/**
 * Checkout submit note — Stripe trial_end can show misleading "X days free" copy in the bill overview.
 */
export function formatEnrollmentCheckoutSubmitMessage() {
  return (
    'DISREGARD THE ## DAYS FREE MESSAGE IN THE BILL OVERVIEW. ' +
    "Today's payment covers first-month tuition and any additional fees. " +
    'Membership starts on assigned class start date. ' +
    'Membership renews at monthly rate.'
  ).slice(0, 500)
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
  const recurringLineItems = []
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
      recurringLineItems.push({ price: priceId, quantity: 1 })
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

  lineItems.push(...recurringLineItems)

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
  const hasRecurring = enrollmentHasRecurringMembership(preview)
  const mode = hasRecurring ? 'subscription' : 'payment'
  const lineItems = await buildCheckoutLineItems(pool, preview, {
    includeRecurringSubscriptionPrices: hasRecurring,
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
    metadata: {
      checkoutType: 'enrollment',
      pendingEnrollmentId: String(pendingId),
      familyBillingAccountId: String(account.id),
      memberId: String(memberId),
      previewHash: previewFingerprint(preview),
      hasRecurring: hasRecurring ? 'true' : 'false',
    },
  }

  if (mode === 'subscription') {
    const anchorDate = computeSubscriptionBillingAnchorDate(preview)
    // Stripe rejects proration_behavior=none when Checkout includes one-time line items
    // (fees + first-month tuition). trial_end defers recurring until the anchor date.
    sessionParams.subscription_data = {
      trial_end: dateStringToUnixBillingAnchor(anchorDate),
      metadata: {
        pendingEnrollmentId: String(pendingId),
        familyBillingAccountId: String(account.id),
      },
    }
    if (shouldShowEnrollmentCheckoutSubmitMessage(preview)) {
      sessionParams.custom_text = {
        submit: {
          message: formatEnrollmentCheckoutSubmitMessage(),
        },
      }
    }
  } else {
    sessionParams.payment_intent_data = {
      setup_future_usage: 'off_session',
    }
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

async function findLatestFamilyEnrollmentReturn(pool, familyId) {
  const res = await pool.query(
    `SELECT pe.id, pe.stripe_checkout_session_id, pe.status
     FROM stripe_pending_enrollment pe
     JOIN family_billing_account fba ON fba.id = pe.family_billing_account_id
     WHERE fba.family_id = $1
       AND pe.created_at > now() - interval '7 days'
     ORDER BY pe.updated_at DESC
     LIMIT 1`,
    [familyId],
  )
  return res.rows[0] ?? null
}

/**
 * Commit enrollment after Stripe Checkout when the member returns to the portal.
 * Backup for webhook delivery — verifies payment with Stripe before creating signups.
 */
export async function confirmEnrollmentCheckoutSession(
  pool,
  { checkoutSessionId, pendingEnrollmentId, memberId, familyId, roles },
) {
  const stripe = await getStripeClient()
  if (!stripe) throw new Error('Online payments are not available right now.')

  let sessionId = checkoutSessionId ? String(checkoutSessionId).trim() : null
  let pendingId = pendingEnrollmentId ? Number(pendingEnrollmentId) : null

  if (!sessionId && !pendingId && familyId) {
    const latest = await findLatestFamilyEnrollmentReturn(pool, familyId)
    if (!latest) return { status: 'none' }
    if (latest.status === 'completed') return { status: 'already_completed' }
    pendingId = Number(latest.id)
    sessionId = latest.stripe_checkout_session_id ?? null
  }

  if (!sessionId && pendingId) {
    const pendingRes = await pool.query(
      `SELECT stripe_checkout_session_id FROM stripe_pending_enrollment WHERE id = $1`,
      [pendingId],
    )
    sessionId = pendingRes.rows[0]?.stripe_checkout_session_id ?? null
  }

  if (!sessionId) {
    return { status: 'none' }
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    throw new Error('Payment is not complete yet. If you were charged, please wait a moment and refresh.')
  }
  if (session.metadata?.checkoutType !== 'enrollment') {
    throw new Error('This checkout session is not an enrollment payment.')
  }

  pendingId = pendingId || Number(session.metadata?.pendingEnrollmentId)
  if (!pendingId) throw new Error('Enrollment reference missing from checkout session.')

  const pendingRes = await pool.query(
    `SELECT pe.*, fba.family_id, fba.payer_member_id
     FROM stripe_pending_enrollment pe
     JOIN family_billing_account fba ON fba.id = pe.family_billing_account_id
     WHERE pe.id = $1`,
    [pendingId],
  )
  const pending = pendingRes.rows[0]
  if (!pending) throw new Error('Enrollment checkout not found.')
  if (Number(pending.family_id) !== Number(familyId)) {
    throw new Error('This enrollment belongs to a different family account.')
  }

  const canPay =
    Number(pending.payer_member_id) === Number(memberId)
  if (!canPay) {
    throw new Error('Only the family payer or a guardian can confirm enrollment checkout.')
  }

  if (pending.stripe_checkout_session_id && pending.stripe_checkout_session_id !== session.id) {
    throw new Error('Checkout session does not match this enrollment.')
  }

  const commitResult = await commitPendingEnrollment(pool, {
    pendingEnrollmentId: pendingId,
    stripeSession: session,
  })

  if (commitResult.status === 'not_found') {
    throw new Error('Enrollment checkout not found.')
  }

  if (commitResult.status === 'completed' || commitResult.status === 'already_completed') {
    await recordEnrollmentStripePayment(pool, stripe, {
      session,
      accountId: Number(pending.family_billing_account_id),
    })
  }

  return commitResult
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
    if (pending.status !== 'pending' && pending.status !== 'failed') {
      await client.query('ROLLBACK')
      return { status: 'invalid', reason: pending.status }
    }

    const payload = await refreshSignupAuthForCommit(pool, pending.payload, pending.member_id)
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
      await client.query(
        `UPDATE billing_subscription
         SET stripe_subscription_id = $2, updated_at = now()
         WHERE family_billing_account_id = $1
           AND status = 'active'
           AND stripe_subscription_id IS NULL
           AND created_at >= now() - interval '5 minutes'`,
        [pending.family_billing_account_id, stripeSession.subscription],
      )
    } else if (signupIds.length > 0 && previewSnapshot && pending.checkout_mode === 'payment') {
      // Payment-only checkout (legacy): create anchored subscriptions after enrollment.
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

    if (stripeSession?.id) {
      const stripe = await getStripeClient()
      if (stripe) {
        await recordEnrollmentStripePayment(pool, stripe, {
          session: stripeSession,
          accountId: Number(pending.family_billing_account_id),
        })
      }
    }

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

export { getCatalogSyncStatus } from './stripeCatalogSync.js'
