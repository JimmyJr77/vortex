/**
 * Monthly recurring-charge generator (Billing Overhaul Phase 2b).
 *
 * For every `active` billing_subscription whose next_bill_date has arrived, post one
 * recurring `billing_charge` per due period and advance next_bill_date. Idempotent:
 * each posted charge uses source_type='billing_subscription',
 * source_id='<subscriptionId>:<YYYY-MM>' against uq_billing_charge_source, so running
 * the job twice for the same period creates no duplicates. Missed months are caught up
 * (bounded by maxCatchUpPerSub) so a lapsed scheduler still bills every period once.
 *
 * Run via `npm run billing:recurring` (see runRecurringCharges.js) from cron/scheduler.
 */

import {
  addMonthsClamped,
  parseDbDate,
  periodKey,
  toDateString,
} from './billingSubscriptions.js'
import { applyPendingPauseCredits } from './pauseEnrollmentBilling.js'
import { priceRecurringPeriod } from '../billing/recurringPeriodPricing.js'
import { allocateHouseholdPayments } from '../billing/paymentAllocation.js'
import {
  activateEligibleHouseholdMonthlyBilling,
  createHouseholdMonthlyInvoice,
} from '../billing/householdMonthlyInvoice.js'

/**
 * @param {import('pg').Pool} pool
 * @param {{ asOf?: Date, maxCatchUpPerSub?: number }} [options]
 * @returns {Promise<{ subscriptionsProcessed:number, chargesPosted:number, periodsAdvanced:number }>}
 */
export async function generateRecurringCharges(pool, { asOf = new Date(), maxCatchUpPerSub = 12 } = {}) {
  try {
    await activateEligibleHouseholdMonthlyBilling(pool)
  } catch (error) {
    console.warn('[billing] household monthly billing activation:', error?.message ?? error)
  }

  // Annual promo codes are only carried into the next athlete-owned renewal
  // while they are still active and within redemption limits. Run this daily
  // instead of waiting for a renewal invoice to exist.
  try {
    const { revalidateAnnualMembershipRenewalDiscounts } = await import('../billing/customerBillingPayments.js')
    await revalidateAnnualMembershipRenewalDiscounts(pool, { now: asOf })
  } catch (error) {
    console.warn('[billing] annual membership renewal promo validation:', error?.message ?? error)
  }

  try {
    const { processDueEnrollmentCancellations } = await import('./memberEnrollmentCancel.js')
    await processDueEnrollmentCancellations(pool, { force: true })
  } catch (err) {
    console.warn('[billing] process due enrollment cancellations:', err?.message ?? err)
  }

  const asOfMidnight = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()))
  const asOfStr = toDateString(asOfMidnight)

  let pauseCreditsPosted = 0
  try {
    pauseCreditsPosted = await applyPendingPauseCredits(pool, { periodStart: asOfStr })
  } catch (err) {
    console.warn('[billing] applyPendingPauseCredits:', err?.message ?? err)
  }

  const due = await pool.query(
    `
      SELECT id, family_billing_account_id, member_id, description,
             monthly_amount_cents, discount_amount_cents, net_monthly_cents,
             anchor_day, next_bill_date
      FROM billing_subscription
      WHERE status = 'active'
        AND next_bill_date IS NOT NULL
        AND next_bill_date <= $1
        -- Annual memberships renew via Stripe yearly subscriptions, not this monthly job.
        AND source_type <> 'annual_membership'
        AND COALESCE(pricing_option_key, '') <> 'annual_membership'
      ORDER BY id
    `,
    [asOfStr],
  )

  let chargesPosted = 0
  let periodsAdvanced = 0
  const periodPricing = new Map()

  for (const sub of due.rows) {
    let nextBill = parseDbDate(sub.next_bill_date)
    if (!nextBill) continue
    const anchorDay = Number(sub.anchor_day) || nextBill.getUTCDate()
    let guard = 0

    while (nextBill.getTime() <= asOfMidnight.getTime() && guard < maxCatchUpPerSub) {
      const period = periodKey(nextBill)
      const followingBill = addMonthsClamped(nextBill, 1, anchorDay)
      const periodStart = toDateString(nextBill)
      const periodEnd = toDateString(new Date(followingBill.getTime() - 24 * 60 * 60 * 1000))

      const pricingKey = `${sub.family_billing_account_id}:${period}`
      let familyPricing = periodPricing.get(pricingKey)
      if (!familyPricing) {
        const [subscriptionsRes, chargesRes, accountRes] = await Promise.all([
          pool.query(`SELECT * FROM billing_subscription WHERE family_billing_account_id = $1 AND status = 'active'`, [sub.family_billing_account_id]),
          pool.query(`SELECT * FROM billing_charge WHERE family_billing_account_id = $1 AND source_type = 'billing_subscription'`, [sub.family_billing_account_id]),
          pool.query(`SELECT family_id FROM family_billing_account WHERE id = $1`, [sub.family_billing_account_id]),
        ])
        familyPricing = await priceRecurringPeriod(pool, {
          familyId: accountRes.rows[0]?.family_id,
          subscriptions: subscriptionsRes.rows,
          charges: chargesRes.rows,
          periodKey: period,
        })
        periodPricing.set(pricingKey, familyPricing)
      }
      const periodLine = familyPricing.lines.find((line) => Number(line.subscriptionId) === Number(sub.id))
      const grossCents = periodLine?.grossCents ?? Number(sub.monthly_amount_cents)
      const discountCents = periodLine?.discountCents ?? Number(sub.discount_amount_cents)
      const netCents = periodLine?.netCents ?? Number(sub.net_monthly_cents)

      const ins = await pool.query(
        `
          INSERT INTO billing_charge
            (family_billing_account_id, member_id, source_type, source_id, description,
             amount_cents, gross_amount_cents, discount_amount_cents,
             charge_type, billing_interval, subscription_id,
             service_period_start, service_period_end, price_adjustment_id)
          SELECT $1, $2, 'billing_subscription', $3, $4, $5, $6, $7,
                 'recurring', 'month', $8, $9, $10, $11
          WHERE NOT EXISTS (
            SELECT 1
            FROM billing_charge existing
            WHERE existing.subscription_id = $8
              AND existing.charge_type = 'recurring'
              AND existing.service_period_start <= $9::date
              AND existing.service_period_end >= $10::date
          )
          ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
          DO NOTHING
          RETURNING id
        `,
        [
          sub.family_billing_account_id,
          sub.member_id,
          `${sub.id}:${period}`,
          sub.description,
          netCents,
          grossCents,
          discountCents,
          sub.id,
          periodStart,
          periodEnd,
          periodLine?.priceAdjustmentId ?? null,
        ],
      )
      if (ins.rows.length > 0) chargesPosted += 1

      nextBill = followingBill
      guard += 1
      periodsAdvanced += 1
    }

    await pool.query(
      `UPDATE billing_subscription SET next_bill_date = $2, updated_at = now() WHERE id = $1`,
      [sub.id, toDateString(nextBill)],
    )
  }

  for (const accountId of new Set(due.rows.map((row) => Number(row.family_billing_account_id)))) {
    try {
      await allocateHouseholdPayments(pool, { accountId, actorType: 'system' })
    } catch (error) {
      console.warn('[billing] recurring payment allocation:', accountId, error?.message ?? error)
    }
  }

  // The recurring ledger remains the source for tuition charges. On the first
  // day, enabled households turn those charges plus all other open ledger items
  // into one Stripe invoice. This is intentionally separate from charge posting
  // so a daily job remains safe and catch-up charges stay immutable.
  let householdInvoicesCreated = 0
  if (asOfMidnight.getUTCDate() === 1) {
    const accounts = await pool.query(
      `SELECT * FROM family_billing_account
        WHERE household_monthly_billing_enabled = TRUE
        ORDER BY id`,
    )
    for (const account of accounts.rows) {
      try {
        const result = await createHouseholdMonthlyInvoice(pool, {
          account,
          billingMonth: asOfMidnight,
        })
        if (result.created) householdInvoicesCreated += 1
      } catch (error) {
        console.error('[billing] household monthly invoice:', account.id, error?.message ?? error)
      }
    }
  }

  return {
    subscriptionsProcessed: due.rows.length,
    chargesPosted,
    periodsAdvanced,
    pauseCreditsPosted,
    householdInvoicesCreated,
  }
}
