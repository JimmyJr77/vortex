/**
 * Canonical annual membership status for a member (athlete).
 *
 * Source of truth: a satisfied additional_fee_redemption whose paid-through
 * date is still in the future. billing_subscription is only the local renewal
 * schedule; advancing it when a renewal charge is posted must never grant an
 * unpaid year of access.
 */

import {
  ANNUAL_MEMBERSHIP_SOURCE_TYPE,
  ANNUAL_MEMBERSHIP_PRICING_KEY,
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

function redemptionRenewsOn(row) {
  const periodKey = String(row?.period_key ?? '')
  const explicit = /^\d{4}-\d{2}-\d{2}$/.test(periodKey)
    ? parseDbDateOnly(periodKey)
    : null
  if (explicit) return explicit
  return membershipRenewsOnFromPurchase(row?.satisfied_at ?? row?.created_at)
}

function redemptionIsActive(row, asOfDate) {
  const renewsOn = redemptionRenewsOn(row)
  if (!renewsOn || renewsOn.getTime() <= asOfDate.getTime()) return false
  const endedAt = parseDbDateOnly(row?.ended_at)
  return !endedAt || endedAt.getTime() > asOfDate.getTime()
}

/**
 * @typedef {{
 *   active: true,
 *   memberId: number,
 *   feeId: number|null,
 *   cycleStart: Date,
 *   renewsOn: Date,
 *   source: 'redemption',
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
    const redemptionParams = [memberId, asOfKey, ANNUAL_MEMBERSHIP_SOURCE_TYPE]
    let redemptionFeeFilter = ''
    if (feeId != null) {
      redemptionParams.push(Number(feeId))
      redemptionFeeFilter = ` AND r.fee_id = $${redemptionParams.length}`
    }
    const redRes = await pool.query(
      `
        SELECT r.fee_id, r.created_at, r.satisfied_at, r.period_key, r.ended_at,
               charge.service_period_start,
               subscription.id AS billing_subscription_id
        FROM additional_fee_redemption r
        JOIN additional_fee f ON f.id = r.fee_id
        LEFT JOIN billing_charge charge ON charge.id = r.billing_charge_id
        LEFT JOIN billing_subscription subscription
          ON subscription.member_id = r.member_id
         AND subscription.source_type = $3
         AND subscription.source_id = CONCAT(r.fee_id, ':', r.member_id)
         AND subscription.status IN ('active', 'paused')
        WHERE r.member_id = $1
          AND r.amount_cents >= 0
          AND (r.ended_at IS NULL OR r.ended_at > $2::date)
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
      if (!redemptionIsActive(row, asOfDate)) continue
      const renewsOn = redemptionRenewsOn(row)
      const cycleStart = parseDbDateOnly(row.service_period_start)
        || parseDbDateOnly(row.satisfied_at)
        || parseDbDateOnly(row.created_at)
      if (!renewsOn || !cycleStart) continue
      return {
        active: true,
        memberId: Number(memberId),
        feeId: row.fee_id != null ? Number(row.fee_id) : null,
        cycleStart,
        renewsOn,
        source: 'redemption',
        billingSubscriptionId: row.billing_subscription_id == null
          ? null
          : Number(row.billing_subscription_id),
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
 * Fee ids with an active paid annual membership window.
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
    const redRes = await pool.query(
      `
        SELECT r.fee_id, r.created_at, r.satisfied_at, r.period_key, r.ended_at
        FROM additional_fee_redemption r
        JOIN additional_fee f ON f.id = r.fee_id
        WHERE r.member_id = $1
          AND r.fee_id = ANY($2::bigint[])
          AND r.amount_cents >= 0
          AND (r.ended_at IS NULL OR r.ended_at > $3::date)
          AND (
            f.trigger_type = 'once_per_year'
            OR f.apply_basis = 'per_year'
            OR lower(f.name) LIKE '%annual%'
            OR lower(f.name) LIKE '%membership%'
          )
      `,
      [memberId, ids, asOfKey],
    )
    for (const row of redRes.rows) {
      if (!redemptionIsActive(row, asOfDate)) continue
      active.add(Number(row.fee_id))
    }
  } catch {
    // ignore
  }

  return active
}

export { ANNUAL_MEMBERSHIP_SOURCE_TYPE, ANNUAL_MEMBERSHIP_PRICING_KEY }
