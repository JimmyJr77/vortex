/**
 * Recurring billing subscription helpers (Billing Overhaul Phase 2).
 *
 * A `billing_subscription` is the recurring monthly-rate record for an enrollment.
 * It is the source of truth for a family's cumulative monthly total. The monthly
 * job (generateRecurringCharges) posts one `billing_charge` per subscription per
 * period, idempotent on source_type='billing_subscription', source_id='<id>:<YYYY-MM>'.
 *
 * Assumptions: billing anchor = 1st of the month for everyone; the first (partial)
 * month is charged prorated at signup (see firstMonthProration.js); next_bill_date
 * is always a 1st of month.
 */

import { runIsolated } from './transactionSavepoint.js'
import { cancelStripeSubscriptionNow } from '../billing/stripeSubscriptionSync.js'

/** Days in a given UTC year/month (month is 0-based). */
function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** Format a Date as a 'YYYY-MM-DD' string (UTC). */
export function toDateString(date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Parse a DB DATE value (JS Date from node-postgres, or 'YYYY-MM-DD' string)
 * into a UTC-midnight Date using its calendar y/m/d (tz-safe).
 * @param {Date|string|null} value
 * @returns {Date|null}
 */
export function parseDbDate(value) {
  if (value == null) return null
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
  }
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

/** Period key 'YYYY-MM' (UTC) for idempotent monthly charges. */
export function periodKey(date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/**
 * Add `months` to a date, clamping the day to the target month length using anchorDay.
 * @returns {Date} UTC date at midnight
 */
export function addMonthsClamped(date, months, anchorDay) {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth()
  const targetMonthIndex = m + months
  const targetYear = y + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const anchor = anchorDay || date.getUTCDate()
  const day = Math.min(anchor, daysInMonth(targetYear, targetMonth))
  return new Date(Date.UTC(targetYear, targetMonth, day))
}

/**
 * Compute the current billing cycle for a subscription starting on `fromDate`.
 * All subscriptions anchor to the 1st of the month: the first service period runs
 * signup date → end of the current month (prorated charge), then full months bill
 * on each 1st. A `firstBillDate` override (YYYY-MM-DD, always a 1st) is used for
 * classes with no sessions left this month, deferring billing to their start month.
 * @param {Date} [fromDate]
 * @param {{ firstBillDate?: string|null }} [opts]
 * @returns {{ anchorDay:number, startDate:string, endDate:string, nextBillDate:string }}
 */
export function computeBillingCycle(fromDate = new Date(), { firstBillDate = null } = {}) {
  const start = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()))
  const anchorDay = 1
  const firstOfNext = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
  let nextBill = firstBillDate ? parseDbDate(firstBillDate) : firstOfNext
  if (!nextBill || nextBill.getTime() < firstOfNext.getTime()) nextBill = firstOfNext
  const endExclusiveMinusOne = new Date(nextBill.getTime() - 24 * 60 * 60 * 1000)
  return {
    anchorDay,
    startDate: toDateString(start),
    endDate: toDateString(endExclusiveMinusOne),
    nextBillDate: toDateString(nextBill),
  }
}

/**
 * First bill date (YYYY-MM-DD, always a 1st) after a promo free window.
 *
 * - `freeMonths`: the enrollment stub (remainder of the signup / first service
 *   month) is free, PLUS N full months — billing resumes N months after the
 *   normal anchor.
 * - `freeWeeks`: free for N weeks from `weeksFrom` (defaults to `fromDate`);
 *   billing resumes on the first 1st-of-month on/after the window ends
 *   (months always bill whole, never partial).
 *
 * When both are present (stacked grants) the later date wins. Never earlier
 * than the normal billing anchor.
 * @param {{ firstBillDate?: string|null, fromDate?: Date, freeMonths?: number, freeWeeks?: number, weeksFrom?: Date|string|null }} args
 */
export function deferredFirstBillDate({
  firstBillDate = null,
  fromDate = new Date(),
  freeMonths = 0,
  freeWeeks = 0,
  weeksFrom = null,
}) {
  const months = Math.max(0, Math.round(Number(freeMonths) || 0))
  const weeks = Math.max(0, Math.round(Number(freeWeeks) || 0))
  const cycle = computeBillingCycle(fromDate, { firstBillDate })
  let next = parseDbDate(cycle.nextBillDate)
  if (months > 0) {
    const shifted = addMonthsClamped(next, months, 1)
    if (shifted.getTime() > next.getTime()) next = shifted
  }
  if (weeks > 0) {
    const base = parseDbDate(weeksFrom) ?? parseDbDate(toDateString(fromDate))
    const freeEnd = new Date(base.getTime() + weeks * 7 * 24 * 60 * 60 * 1000)
    // First 1st-of-month strictly after the last free day.
    const weeksNext =
      freeEnd.getUTCDate() === 1
        ? freeEnd
        : new Date(Date.UTC(freeEnd.getUTCFullYear(), freeEnd.getUTCMonth() + 1, 1))
    if (weeksNext.getTime() > next.getTime()) next = weeksNext
  }
  return toDateString(next)
}

/**
 * Upsert an active recurring subscription for a given source enrollment.
 * On re-run (same source) updates the rate; a cancelled row does not block a new one.
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @returns {Promise<{ id:number, created:boolean } | null>}
 */
export async function upsertSubscriptionForSource(db, {
  familyBillingAccountId,
  memberId,
  sourceType = 'scheduling_signup',
  sourceId,
  description,
  monthlyAmountCents,
  discountAmountCents = 0,
  pricingOptionKey = null,
  fromDate = new Date(),
  firstBillDate = null,
  subscriptionStartDate = null,
}) {
  if (!familyBillingAccountId || sourceId == null) return null
  const netMonthly = Math.max(0, Math.round(Number(monthlyAmountCents) || 0) - Math.round(Number(discountAmountCents) || 0))
  const cycle = computeBillingCycle(fromDate, { firstBillDate })

  const res = await db.query(
    `
      INSERT INTO billing_subscription
        (family_billing_account_id, member_id, source_type, source_id, description,
         monthly_amount_cents, discount_amount_cents, net_monthly_cents, status,
         start_date, anchor_day, next_bill_date, pricing_option_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $11, $12)
      ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL AND status <> 'cancelled'
      DO UPDATE SET
        monthly_amount_cents = EXCLUDED.monthly_amount_cents,
        discount_amount_cents = EXCLUDED.discount_amount_cents,
        net_monthly_cents = EXCLUDED.net_monthly_cents,
        description = EXCLUDED.description,
        member_id = EXCLUDED.member_id,
        pricing_option_key = EXCLUDED.pricing_option_key,
        updated_at = now()
      RETURNING id, (xmax = 0) AS created
    `,
    [
      familyBillingAccountId,
      memberId ?? null,
      sourceType,
      String(sourceId),
      description,
      Math.round(Number(monthlyAmountCents) || 0),
      Math.round(Number(discountAmountCents) || 0),
      netMonthly,
      subscriptionStartDate ?? cycle.startDate,
      cycle.anchorDay,
      cycle.nextBillDate,
      pricingOptionKey,
    ],
  )
  const row = res.rows[0]
  if (!row) return null
  return { id: Number(row.id), created: row.created === true, cycle }
}

/**
 * Cancel active/paused subscriptions for a source enrollment (stops future billing).
 * @returns {Promise<number[]>} ids of cancelled subscriptions
 */
export async function cancelSubscriptionsForSource(db, { sourceType = 'scheduling_signup', sourceId, endDate = null }) {
  if (sourceId == null) return []
  const existing = await db.query(
    `
      SELECT id, stripe_subscription_id
      FROM billing_subscription
      WHERE source_type = $1 AND source_id = $2 AND status <> 'cancelled'
    `,
    [sourceType, String(sourceId)],
  )
  const res = await db.query(
    `
      UPDATE billing_subscription
      SET status = 'cancelled',
          end_date = COALESCE($3, CURRENT_DATE),
          next_bill_date = NULL,
          updated_at = now()
      WHERE source_type = $1 AND source_id = $2 AND status <> 'cancelled'
      RETURNING id
    `,
    [sourceType, String(sourceId), endDate],
  )
  for (const row of existing.rows) {
    if (row.stripe_subscription_id) {
      void cancelStripeSubscriptionNow(row.stripe_subscription_id)
    }
  }
  return res.rows.map((r) => Number(r.id))
}

/**
 * Reactivate the most recently cancelled subscription for a source enrollment
 * (used when an admin re-confirms a previously cancelled signup). No-op if an
 * active/paused subscription already exists for the source.
 * @returns {Promise<number[]>} ids reactivated
 */
export async function reactivateSubscriptionForSource(db, { sourceType = 'scheduling_signup', sourceId, fromDate = new Date() }) {
  if (sourceId == null) return []
  const cycle = computeBillingCycle(fromDate)
  const res = await db.query(
    `
      UPDATE billing_subscription
      SET status = 'active', end_date = NULL, next_bill_date = $3, updated_at = now()
      WHERE id = (
        SELECT id FROM billing_subscription
        WHERE source_type = $1 AND source_id = $2 AND status = 'cancelled'
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      )
      AND NOT EXISTS (
        SELECT 1 FROM billing_subscription b2
        WHERE b2.source_type = $1 AND b2.source_id = $2 AND b2.status <> 'cancelled'
      )
      RETURNING id
    `,
    [sourceType, String(sourceId), cycle.nextBillDate],
  )
  return res.rows.map((r) => Number(r.id))
}

/**
 * Set subscription pause state for a source enrollment.
 * Paused subscriptions are skipped by the monthly generator but retain their rate.
 */
export async function setSubscriptionPausedForSource(db, { sourceType = 'scheduling_signup', sourceId, paused }) {
  if (sourceId == null) return []
  const res = await db.query(
    `
      UPDATE billing_subscription
      SET status = $3,
          updated_at = now()
      WHERE source_type = $1 AND source_id = $2 AND status <> 'cancelled'
      RETURNING id
    `,
    [sourceType, String(sourceId), paused ? 'paused' : 'active'],
  )
  return res.rows.map((r) => Number(r.id))
}

/** Best-effort wrappers — enrollment actions must succeed even when billing tables are absent. */
export async function safeCancelSubscriptionsForSource(db, opts) {
  try {
    return await runIsolated(db, () => cancelSubscriptionsForSource(db, opts))
  } catch (err) {
    console.warn('[billing] cancelSubscriptionsForSource skipped:', err?.message ?? err)
    return []
  }
}

export async function safeReactivateSubscriptionForSource(db, opts) {
  try {
    return await runIsolated(db, () => reactivateSubscriptionForSource(db, opts))
  } catch (err) {
    console.warn('[billing] reactivateSubscriptionForSource skipped:', err?.message ?? err)
    return []
  }
}

export async function safeSetSubscriptionPausedForSource(db, opts) {
  try {
    return await runIsolated(db, () => setSubscriptionPausedForSource(db, opts))
  } catch (err) {
    console.warn('[billing] setSubscriptionPausedForSource skipped:', err?.message ?? err)
    return []
  }
}
