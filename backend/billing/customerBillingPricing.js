import { discountAmountCents } from '../scheduling/discountEngine.js'

const MONTH_PATTERN = /^(\d{4})-(\d{2})(?:-(\d{2})(?:[T\s].*)?)?$/

export function normalizeBillingMonth(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-01`
  }
  const match = String(value ?? '').trim().match(MONTH_PATTERN)
  if (!match) throw new Error('Billing month must use YYYY-MM format.')
  const year = Number(match[1])
  const month = Number(match[2])
  if (year < 2000 || year > 2200 || month < 1 || month > 12) {
    throw new Error('Billing month is outside the supported range.')
  }
  return `${match[1]}-${match[2]}-01`
}

export function billingMonthKey(value) {
  return normalizeBillingMonth(value).slice(0, 7)
}

export function addBillingMonths(value, amount) {
  const normalized = normalizeBillingMonth(value)
  const [year, month] = normalized.slice(0, 7).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + Number(amount || 0), 1))
  return normalizeBillingMonth(date)
}

export function billingMonthInTimeZone(value, timeZone = 'America/New_York') {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return year && month ? `${year}-${month}-01` : null
}

export function billingPeriodEvaluationTime(value) {
  const [year, month] = billingMonthKey(value).split('-').map(Number)
  // Noon UTC on the first avoids treating Eastern-local midnight rule boundaries
  // as belonging to the adjacent UTC billing month.
  return Date.UTC(year, month - 1, 1, 12, 0, 0)
}

export function promoExpirationDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10) || null
  return date.toISOString().slice(0, 10)
}

export function enumerateBillingMonths(fromValue, throughValue, { maxMonths = 120 } = {}) {
  const from = normalizeBillingMonth(fromValue)
  const through = normalizeBillingMonth(throughValue)
  if (through < from) throw new Error('Ending billing month cannot be before the starting month.')
  const months = []
  let cursor = from
  while (cursor <= through) {
    months.push(cursor.slice(0, 7))
    if (months.length >= maxMonths && cursor < through) {
      throw new Error(`Billing range cannot exceed ${maxMonths} months.`)
    }
    cursor = addBillingMonths(cursor, 1)
  }
  return months
}

export function adjustmentCoversPeriod(adjustment, periodValue) {
  const period = normalizeBillingMonth(periodValue)
  const from = normalizeBillingMonth(adjustment.effective_from_month ?? adjustment.effectiveFromMonth)
  const rawThrough = adjustment.effective_through_month ?? adjustment.effectiveThroughMonth
  const through = rawThrough ? normalizeBillingMonth(rawThrough) : null
  return period >= from && (through == null || period <= through)
}

function parseSnapshot(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

export function applyEnrollmentPriceAdjustment(line, adjustment) {
  const grossCents = Math.max(0, Math.round(Number(line.grossCents) || 0))
  const automaticNetCents = Math.max(0, Math.round(Number(line.netCents) || 0))
  const automaticDiscountCents = Math.max(0, grossCents - automaticNetCents)
  if (!adjustment || adjustment.kind === 'legacy_discount') {
    return {
      ...line,
      grossCents,
      automaticNetCents,
      automaticDiscountCents,
      manualAdjustmentCents: 0,
      discountCents: grossCents - automaticNetCents,
      netCents: automaticNetCents,
      priceAdjustmentId: adjustment?.id != null ? Number(adjustment.id) : null,
      priceAdjustment: adjustment ?? null,
    }
  }

  let finalCents = automaticNetCents
  if (adjustment.kind === 'fixed_final_price') {
    finalCents = Math.max(
      0,
      Math.round(Number(adjustment.final_price_cents ?? adjustment.finalPriceCents) || 0),
    )
  } else if (adjustment.kind === 'promo_code') {
    const snapshot = parseSnapshot(
      adjustment.discount_rule_snapshot ?? adjustment.discountRuleSnapshot,
    )
    const config = parseSnapshot(snapshot.config)
    if (config.discountKind === 'free_access') {
      finalCents = 0
    } else {
      const calcBase = snapshot.calcBase ?? snapshot.calc_base ?? 'pre'
      const amountType = snapshot.amountType ?? snapshot.amount_type ?? 'percent'
      const amountValue = snapshot.amountValue ?? snapshot.amount_value ?? 0
      const base = calcBase === 'post' ? automaticNetCents : grossCents
      let amount = discountAmountCents(base, amountType, amountValue)
      const max = snapshot.maxDiscountCents ?? snapshot.max_discount_cents
      if (max != null) amount = Math.min(amount, Math.max(0, Number(max) || 0))
      finalCents = Math.max(0, automaticNetCents - Math.min(automaticNetCents, amount))
    }
  }

  return {
    ...line,
    grossCents,
    automaticNetCents,
    automaticDiscountCents,
    manualAdjustmentCents: automaticNetCents - finalCents,
    discountCents: grossCents - finalCents,
    netCents: finalCents,
    priceAdjustmentId: Number(adjustment.id),
    priceAdjustment: adjustment,
  }
}

export async function loadPriceAdjustmentsForPeriod(db, signupIds, periodValue) {
  const ids = [...new Set((signupIds ?? []).map(Number).filter(Number.isFinite))]
  if (ids.length === 0) return new Map()
  const period = normalizeBillingMonth(periodValue)
  try {
    const result = await db.query(
      `SELECT *
       FROM enrollment_price_adjustment
       WHERE signup_id = ANY($1::bigint[])
         AND status = 'active'
         AND effective_from_month <= $2::date
         AND (effective_through_month IS NULL OR effective_through_month >= $2::date)
       ORDER BY signup_id, created_at DESC, id DESC`,
      [ids, period],
    )
    const bySignup = new Map()
    for (const row of result.rows) {
      const signupId = Number(row.signup_id)
      if (!bySignup.has(signupId)) bySignup.set(signupId, row)
    }
    return bySignup
  } catch (error) {
    // Backend and migration are intentionally deployable in either order.
    if (error?.code === '42P01' || error?.code === '42703') return new Map()
    throw error
  }
}

export async function applyPriceAdjustmentsForPeriod(db, { lines = [], periodKey }) {
  const bySignup = await loadPriceAdjustmentsForPeriod(
    db,
    lines.map((line) => line.signupId),
    periodKey,
  )
  return lines.map((line) =>
    applyEnrollmentPriceAdjustment(line, bySignup.get(Number(line.signupId)) ?? null),
  )
}

export function mapPriceAdjustment(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    familyBillingAccountId: Number(row.family_billing_account_id),
    memberId: row.member_id == null ? null : Number(row.member_id),
    signupId: Number(row.signup_id),
    billingSubscriptionId:
      row.billing_subscription_id == null ? null : Number(row.billing_subscription_id),
    kind: row.kind,
    finalPriceCents: row.final_price_cents == null ? null : Number(row.final_price_cents),
    promoCode: row.promo_code ?? null,
    discountRuleId: row.discount_rule_id == null ? null : Number(row.discount_rule_id),
    discountRuleSnapshot: parseSnapshot(row.discount_rule_snapshot),
    effectiveFromMonth: row.effective_from_month,
    effectiveThroughMonth: row.effective_through_month ?? null,
    standardPriceCents:
      row.standard_price_cents == null ? null : Number(row.standard_price_cents),
    previewSnapshot: parseSnapshot(row.preview_snapshot),
    reason: row.reason,
    status: row.status,
    stripeSyncError: row.stripe_sync_error ?? null,
    stripeSyncedAt: row.stripe_synced_at ?? null,
    createdByUserId: row.created_by_user_id == null ? null : Number(row.created_by_user_id),
    createdAt: row.created_at,
    revokedByUserId: row.revoked_by_user_id == null ? null : Number(row.revoked_by_user_id),
    revokedAt: row.revoked_at ?? null,
    revokeReason: row.revoke_reason ?? null,
  }
}
