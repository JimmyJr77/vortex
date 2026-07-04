/**
 * Stripe Checkout for member enrollment — pay-then-commit flow.
 * See docs/STRIPE_CATALOG_INTEGRATION.md Phase 2.
 */

import crypto from 'crypto'
import { getStripeClient, stripeEnabled } from './stripeBilling.js'
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
import { normalizeProgramPricingOptions } from '../programs/programPricingOptions.js'

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

  if (formRow.pricing_overrides_program) return 'override'

  if (formRow.programs_id != null) {
    const { resolveProgramsSchema } = await import('../programs/schema.js')
    const schema = await resolveProgramsSchema(pool)
    const progRes = await pool.query(
      `SELECT pricing_cost_options FROM ${schema.programsTable} WHERE id = $1`,
      [formRow.programs_id],
    )
    const options = normalizeProgramPricingOptions(progRes.rows[0]?.pricing_cost_options)
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
    `SELECT id, programs_id, pricing_overrides_program FROM scheduling_form WHERE id = $1`,
    [line.formId],
  )
  const formRow = formRes.rows[0]
  const programsId = line.programsId ?? formRow?.programs_id

  if (formRow?.pricing_overrides_program) {
    return formOverrideLookupKey(formRow.id)
  }

  const optionKey = await resolveOptionKeyForPreviewLine(pool, preview, line)
  if (programsId == null) return null
  return programOptionLookupKey(Number(programsId), optionKey)
}

async function buildCheckoutLineItems(pool, preview) {
  const lineItems = []
  const seenRecurring = new Set()

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

  const prorationCents =
    (preview.firstMonth?.totalProratedCents ?? 0) + (preview.firstMonth?.totalPrepaidCents ?? 0)
  if (prorationCents > 0) {
    const alreadyListed = lineItems.reduce((sum, item) => sum + (item.price_data?.unit_amount ?? 0), 0)
    const passAndFeeCents =
      (preview.passPurchaseTotalCents ?? 0) +
      Math.round((preview.additionalFeesOneTime ?? 0) * 100)
    const prorationRemainder = Math.max(0, prorationCents - passAndFeeCents)
    if (prorationRemainder > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: prorationRemainder,
          product_data: { name: 'First month tuition (prorated)' },
        },
      })
    }
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
  const mode = hasRecurring ? 'subscription' : 'payment'
  const lineItems = await buildCheckoutLineItems(pool, preview)

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
    },
  }

  if (mode === 'subscription') {
    sessionParams.subscription_data = {
      metadata: {
        pendingEnrollmentId: String(pendingId),
        familyBillingAccountId: String(account.id),
      },
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

    const result = await executeSignupBatch(pool, payload)
    await client.query(
      `UPDATE stripe_pending_enrollment
       SET status = 'completed', updated_at = now()
       WHERE id = $1`,
      [pendingEnrollmentId],
    )

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
