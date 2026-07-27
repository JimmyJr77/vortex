/**
 * Canonical annual membership status for a member (athlete).
 *
 * Primary source of truth: billing_subscription source_type=annual_membership
 * with next_bill_date still in the future (Stripe yearly renewal window).
 * Fallback: additional_fee_redemption still within purchase+1 year.
 */

import {
  ANNUAL_MEMBERSHIP_SOURCE_TYPE,
  ANNUAL_MEMBERSHIP_PRICING_KEY,
  isMembershipValidThrough,
  membershipRenewsOnFromPurchase,
  toUtcDateString,
} from './membershipAnniversary.js'

function parseDbDateOnly(value) {
  if (value == null) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
  }
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function feeIdFromAnnualSourceId(sourceId) {
  const feePart = String(sourceId || '').split(':')[0]
  const feeId = Number(feePart)
  return Number.isFinite(feeId) ? feeId : null
}

/**
 * @typedef {{
 *   active: true,
 *   memberId: number,
 *   feeId: number|null,
 *   cycleStart: Date,
 *   renewsOn: Date,
 *   source: 'billing_subscription'|'redemption',
 *   billingSubscriptionId?: number|null,
 * }} ActiveAnnualMembership
 */

/**
 * Active annual membership window for a member, if any.
 * @param {import('pg').Pool|import('pg').PoolClient} pool
 * @param {number} memberId
 * @param {{ asOf?: Date, feeId?: number|null }} [opts]
 * @returns {Promise<ActiveAnnualMembership|null>}
 */
export async function loadActiveAnnualMembership(pool, memberId, { asOf = new Date(), feeId = null } = {}) {
  if (!memberId) return null
  const asOfDate = asOf instanceof Date ? asOf : new Date(asOf)
  const asOfKey = toUtcDateString(asOfDate)
  if (!asOfKey) return null

  try {
    const subParams = [memberId, asOfKey, ANNUAL_MEMBERSHIP_SOURCE_TYPE]
    let feeFilter = ''
    if (feeId != null) {
      subParams.push(`${Number(feeId)}:${Number(memberId)}`)
      feeFilter = ` AND source_id = $${subParams.length}`
    }
    const subRes = await pool.query(
      `
        SELECT id, member_id, source_id, start_date, next_bill_date, status
        FROM billing_subscription
        WHERE member_id = $1
          AND source_type = $3
          AND status IN ('active', 'paused')
          AND next_bill_date IS NOT NULL
          AND next_bill_date > $2::date
          ${feeFilter}
        ORDER BY next_bill_date ASC, id ASC
        LIMIT 1
      `,
      subParams,
    )
    const sub = subRes.rows[0]
    if (sub) {
      const renewsOn = parseDbDateOnly(sub.next_bill_date)
      const cycleStart = parseDbDateOnly(sub.start_date) || asOfDate
      if (renewsOn) {
        return {
          active: true,
          memberId: Number(sub.member_id),
          feeId: feeIdFromAnnualSourceId(sub.source_id),
          cycleStart,
          renewsOn,
          source: 'billing_subscription',
          billingSubscriptionId: Number(sub.id),
        }
      }
    }
  } catch {
    // billing_subscription may be absent on older DBs — fall through to redemption.
  }

  try {
    const redemptionParams = [memberId]
    let redemptionFeeFilter = ''
    if (feeId != null) {
      redemptionParams.push(Number(feeId))
      redemptionFeeFilter = ` AND r.fee_id = $${redemptionParams.length}`
    }
    const redRes = await pool.query(
      `
        SELECT r.fee_id, r.created_at, r.period_key
        FROM additional_fee_redemption r
        JOIN additional_fee f ON f.id = r.fee_id
        WHERE r.member_id = $1
          AND r.amount_cents > 0
          AND (
            f.trigger_type = 'once_per_year'
            OR f.apply_basis = 'per_year'
            OR lower(f.name) LIKE '%annual%'
            OR lower(f.name) LIKE '%membership%'
          )
          ${redemptionFeeFilter}
        ORDER BY r.created_at DESC
        LIMIT 20
      `,
      redemptionParams,
    )
    for (const row of redRes.rows) {
      if (!isMembershipValidThrough(row.created_at, asOfDate)) continue
      const renewsOn = membershipRenewsOnFromPurchase(row.created_at)
      const cycleStart = parseDbDateOnly(row.created_at)
      if (!renewsOn || !cycleStart) continue
      return {
        active: true,
        memberId: Number(memberId),
        feeId: row.fee_id != null ? Number(row.fee_id) : null,
        cycleStart,
        renewsOn,
        source: 'redemption',
        billingSubscriptionId: null,
      }
    }
  } catch {
    return null
  }

  return null
}

/** @returns {Promise<boolean>} */
export async function memberHasActiveAnnualMembership(pool, memberId, opts = {}) {
  const window = await loadActiveAnnualMembership(pool, memberId, opts)
  return Boolean(window?.active)
}

/**
 * Fee ids with an active annual membership window (subscription or redemption).
 * Used to suppress once_per_year fees during the membership year.
 * @returns {Promise<Set<number>>}
 */
export async function loadActiveAnnualMembershipFeeIds(pool, memberId, feeIds = [], asOf = new Date()) {
  const active = new Set()
  if (!memberId || feeIds.length === 0) return active
  const asOfDate = asOf instanceof Date ? asOf : new Date(asOf)
  const asOfKey = toUtcDateString(asOfDate)
  const ids = [...new Set(feeIds.map(Number).filter(Number.isFinite))]
  if (!asOfKey || ids.length === 0) return active

  try {
    const sourceIds = ids.map((feeId) => `${feeId}:${Number(memberId)}`)
    const subRes = await pool.query(
      `
        SELECT source_id
        FROM billing_subscription
        WHERE member_id = $1
          AND source_type = $4
          AND status IN ('active', 'paused')
          AND next_bill_date IS NOT NULL
          AND next_bill_date > $2::date
          AND source_id = ANY($3::text[])
      `,
      [memberId, asOfKey, sourceIds, ANNUAL_MEMBERSHIP_SOURCE_TYPE],
    )
    for (const row of subRes.rows) {
      const feeId = feeIdFromAnnualSourceId(row.source_id)
      if (feeId != null) active.add(feeId)
    }
  } catch {
    // fall through
  }

  const remaining = ids.filter((id) => !active.has(id))
  if (remaining.length === 0) return active

  try {
    const redRes = await pool.query(
      `
        SELECT r.fee_id, r.created_at
        FROM additional_fee_redemption r
        JOIN additional_fee f ON f.id = r.fee_id
        WHERE r.member_id = $1
          AND r.fee_id = ANY($2::bigint[])
          AND r.amount_cents > 0
          AND (
            f.trigger_type = 'once_per_year'
            OR f.apply_basis = 'per_year'
            OR lower(f.name) LIKE '%annual%'
            OR lower(f.name) LIKE '%membership%'
          )
      `,
      [memberId, remaining],
    )
    for (const row of redRes.rows) {
      if (!isMembershipValidThrough(row.created_at, asOfDate)) continue
      active.add(Number(row.fee_id))
    }
  } catch {
    // ignore
  }

  return active
}

export { ANNUAL_MEMBERSHIP_SOURCE_TYPE, ANNUAL_MEMBERSHIP_PRICING_KEY }
