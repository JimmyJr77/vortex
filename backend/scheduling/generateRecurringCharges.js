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

/**
 * @param {import('pg').Pool} pool
 * @param {{ asOf?: Date, maxCatchUpPerSub?: number }} [options]
 * @returns {Promise<{ subscriptionsProcessed:number, chargesPosted:number, periodsAdvanced:number }>}
 */
export async function generateRecurringCharges(pool, { asOf = new Date(), maxCatchUpPerSub = 12 } = {}) {
  try {
    const { processDueEnrollmentCancellations } = await import('./memberEnrollmentCancel.js')
    await processDueEnrollmentCancellations(pool)
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
      ORDER BY id
    `,
    [asOfStr],
  )

  let chargesPosted = 0
  let periodsAdvanced = 0

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

      const ins = await pool.query(
        `
          INSERT INTO billing_charge
            (family_billing_account_id, member_id, source_type, source_id, description,
             amount_cents, gross_amount_cents, discount_amount_cents,
             charge_type, billing_interval, subscription_id,
             service_period_start, service_period_end)
          VALUES ($1, $2, 'billing_subscription', $3, $4, $5, $6, $7, 'recurring', 'month', $8, $9, $10)
          ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
          DO NOTHING
          RETURNING id
        `,
        [
          sub.family_billing_account_id,
          sub.member_id,
          `${sub.id}:${period}`,
          sub.description,
          sub.net_monthly_cents,
          sub.monthly_amount_cents,
          sub.discount_amount_cents,
          sub.id,
          periodStart,
          periodEnd,
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

  return {
    subscriptionsProcessed: due.rows.length,
    chargesPosted,
    periodsAdvanced,
    pauseCreditsPosted,
  }
}
