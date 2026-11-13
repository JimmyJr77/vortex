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
import { activeLedgerChargePredicate } from '../billing/billingLedgerSql.js'

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

function redemptionRenewsOn(row, satisfiedAt) {
  const periodKey = String(row?.period_key ?? '')
  const explicit = /^\d{4}-\d{2}-\d{2}$/.test(periodKey)
    ? parseDbDateOnly(periodKey)
    : null
  if (explicit) return explicit
  return membershipRenewsOnFromPurchase(satisfiedAt)
}

function activeRedemptionWindow(row, asOfDate) {
  const satisfiedAt = parseDbDateOnly(row.satisfied_at ?? row.legacy_charge_paid_at)
  if (!satisfiedAt || satisfiedAt > asOfDate) return null
  const cycleStart = parseDbDateOnly(row.service_period_start) ?? satisfiedAt
  const renewsOn = redemptionRenewsOn(row, satisfiedAt)
  if (cycleStart > asOfDate || !renewsOn || renewsOn <= asOfDate) return null
  const endedAt = parseDbDateOnly(row?.ended_at)
  return !endedAt || endedAt > asOfDate ? { cycleStart, renewsOn } : null
}

const legacyPaidCharge = `charge.collection_status = 'paid' AND ${activeLedgerChargePredicate('charge')}
  AND NOT EXISTS (
    SELECT 1 FROM billing_charge refund_offset WHERE refund_offset.related_charge_id = charge.id
      AND refund_offset.source_type = 'refund_offset' AND refund_offset.amount_cents < 0
  )`

const annualRedemptionJoins = `FROM additional_fee_redemption r
  JOIN additional_fee f ON f.id = r.fee_id
  LEFT JOIN billing_charge charge ON charge.member_id = r.member_id
    AND charge.source_type = 'additional_fee'
    AND (charge.id = r.billing_charge_id OR (r.billing_charge_id IS NULL
      AND charge.source_id = CONCAT(r.fee_id, ':', r.member_id, ':', r.period_key)))`

const annualRedemptionPredicate = `r.amount_cents >= 0
  AND (r.satisfied_at IS NOT NULL OR (${legacyPaidCharge}))
  AND (f.trigger_type = 'once_per_year' OR f.apply_basis = 'per_year'
    OR lower(f.name) LIKE '%annual%' OR lower(f.name) LIKE '%membership%')`

/** SQL predicate for directory queries that need the same annual membership window for many athletes. */
export const hasActiveAnnualMembershipSql = (memberId, asOfDate) => `EXISTS (
  SELECT 1 ${annualRedemptionJoins}
  CROSS JOIN LATERAL (
    SELECT (COALESCE(r.satisfied_at, charge.created_at) AT TIME ZONE 'UTC')::date AS satisfied_on
  ) entitlement
  WHERE r.member_id = ${memberId} AND ${annualRedemptionPredicate}
    AND (r.ended_at IS NULL OR (r.ended_at AT TIME ZONE 'UTC')::date > ${asOfDate})
    AND entitlement.satisfied_on <= ${asOfDate}
    AND COALESCE(charge.service_period_start, entitlement.satisfied_on) <= ${asOfDate}
    AND COALESCE(CASE WHEN r.period_key ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN account_source_date(r.period_key) END,
      (entitlement.satisfied_on + INTERVAL '1 year')::date) > ${asOfDate}
)`

async function loadMembershipRedemptions(db, { memberId, asOfKey, feeIds = null }) {
  const result = await db.query(
    `SELECT r.fee_id, r.satisfied_at, r.period_key, r.ended_at, charge.service_period_start,
            CASE WHEN r.satisfied_at IS NULL AND charge.collection_status = 'paid'
              THEN charge.created_at END AS legacy_charge_paid_at,
            subscription.id AS billing_subscription_id
     ${annualRedemptionJoins}
     LEFT JOIN billing_subscription subscription ON subscription.member_id = r.member_id
       AND subscription.source_type = $3
       AND subscription.source_id = CONCAT(r.fee_id, ':', r.member_id)
       AND subscription.status IN ('active', 'paused')
     WHERE r.member_id = $1 AND ${annualRedemptionPredicate}
       AND (r.ended_at IS NULL OR r.ended_at > $2::date)
       AND ($4::bigint[] IS NULL OR r.fee_id = ANY($4::bigint[]))
     ORDER BY r.created_at DESC`,
    [memberId, asOfKey, ANNUAL_MEMBERSHIP_SOURCE_TYPE, feeIds],
  )
  return result.rows
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
 * @param {{ asOf?: Date, feeId?: number|null, strict?: boolean }} [opts]
 * @returns {Promise<ActiveAnnualMembership|null>}
 */
export async function loadActiveAnnualMembership(
  pool,
  memberId,
  { asOf = new Date(), feeId = null, strict = false } = {},
) {
  if (!memberId) return null
  const asOfDate = asOf instanceof Date ? asOf : new Date(asOf)
  const asOfKey = toUtcDateString(asOfDate)
  if (!asOfKey) return null

  try {
    const rows = await loadMembershipRedemptions(pool, {
      memberId, asOfKey, feeIds: feeId == null ? null : [Number(feeId)],
    })
    for (const row of rows) {
      const window = activeRedemptionWindow(row, asOfDate)
      if (!window) continue
      return {
        active: true,
        memberId: Number(memberId),
        feeId: row.fee_id != null ? Number(row.fee_id) : null,
        ...window,
        source: 'redemption',
        billingSubscriptionId: row.billing_subscription_id == null
          ? null
          : Number(row.billing_subscription_id),
      }
    }
  } catch (error) {
    if (strict) throw error
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
    const rows = await loadMembershipRedemptions(pool, { memberId, asOfKey, feeIds: ids })
    for (const row of rows) {
      if (activeRedemptionWindow(row, asOfDate)) active.add(Number(row.fee_id))
    }
  } catch {
    // ignore
  }

  return active
}

export { ANNUAL_MEMBERSHIP_SOURCE_TYPE, ANNUAL_MEMBERSHIP_PRICING_KEY }
