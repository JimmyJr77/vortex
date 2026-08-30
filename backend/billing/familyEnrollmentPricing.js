import { buildFamilyExistingEnrollmentPreviewLines } from '../scheduling/orderPricing.js'
import {
  billingMonthKey,
  billingPeriodEvaluationTime,
} from './customerBillingPricing.js'
import { priceRecurringPeriod } from './recurringPeriodPricing.js'

function dateOnly(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

function nextMonthStart(periodKey) {
  const [year, month] = periodKey.split('-').map(Number)
  const next = new Date(Date.UTC(year, month, 1))
  return next.toISOString().slice(0, 10)
}

function periodBounds(periodValue) {
  const periodKey = billingMonthKey(periodValue)
  const start = `${periodKey}-01`
  const nextStart = nextMonthStart(periodKey)
  const endDate = new Date(`${nextStart}T00:00:00.000Z`)
  endDate.setUTCDate(endDate.getUTCDate() - 1)
  return { periodKey, start, end: endDate.toISOString().slice(0, 10) }
}

function billingTypeFromBreakdown(value) {
  const breakdown = typeof value === 'string'
    ? (() => {
        try {
          return JSON.parse(value)
        } catch {
          return {}
        }
      })()
    : value ?? {}
  return (
    breakdown.billingType ??
    breakdown.billing_type ??
    breakdown.line?.billingType ??
    breakdown.line?.billing_type ??
    'recurring'
  )
}

/** Pure lifecycle gate used by live billing, audit, and tests. */
export function enrollmentBillsInPeriod(row, periodValue) {
  const { start, end } = periodBounds(periodValue)
  if (row.status !== 'confirmed' || row.orphaned_at != null) return false
  if (billingTypeFromBreakdown(row.pricing_breakdown) === 'one_time') return false

  const enrollmentStart = dateOnly(row.enrollment_start_date ?? row.created_at)
  const activeStart = dateOnly(
    row.offering_start_date ?? row.group_active_start ?? row.form_start_date,
  )
  const activeEnd = dateOnly(
    row.offering_end_date ?? row.group_active_end ?? row.form_end_date,
  )
  const cancellation = dateOnly(row.cancel_effective_date)
  const pause = dateOnly(row.pause_effective_date)

  if (enrollmentStart && enrollmentStart > end) return false
  if (activeStart && activeStart > end) return false
  if (activeEnd && activeEnd < start) return false
  if (cancellation && cancellation <= start) return false
  if (pause && pause <= start) return false
  return true
}

async function loadEnrollmentLifecycle(pool, signupIds) {
  if (signupIds.length === 0) return []
  const result = await pool.query(
    `SELECT signup.id, signup.member_id, signup.form_id, signup.status,
            signup.orphaned_at, signup.created_at, signup.enrollment_start_date,
            signup.cancel_effective_date, signup.pause_effective_date,
            signup.pricing_breakdown,
            form.start_date AS form_start_date, form.end_date AS form_end_date,
            slot_group.active_start AS group_active_start,
            slot_group.active_end AS group_active_end,
            offering.start_date AS offering_start_date,
            offering.end_date AS offering_end_date
     FROM scheduling_signup signup
     JOIN scheduling_form form ON form.id = signup.form_id
     JOIN scheduling_slot_group slot_group ON slot_group.id = signup.slot_group_id
     LEFT JOIN scheduling_offering offering ON offering.id = slot_group.offering_id
     WHERE signup.id = ANY($1::bigint[])`,
    [signupIds],
  )
  return result.rows
}

async function loadLocalSubscriptions(pool, signupIds) {
  if (signupIds.length === 0) return []
  const result = await pool.query(
    `SELECT *
     FROM billing_subscription
     WHERE source_type = 'scheduling_signup'
       AND source_id = ANY($1::text[])
     ORDER BY source_id,
              CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
              id DESC`,
    [signupIds.map(String)],
  )
  return result.rows
}

function preferredSubscriptions(rows) {
  const bySignup = new Map()
  for (const row of rows) {
    const signupId = Number(row.source_id ?? row.sourceId)
    if (!Number.isFinite(signupId) || bySignup.has(signupId)) continue
    bySignup.set(signupId, row)
  }
  return bySignup
}

/**
 * Canonical family tuition resolver.
 *
 * It starts from every live recurring class in the household, not from billing
 * subscription snapshots. Annual memberships cannot enter this source set and are
 * therefore neither qualifying spend nor discount recipients.
 */
export async function resolveFamilyEnrollmentPricing(pool, {
  familyId,
  periodKey = billingMonthKey(new Date()),
  subscriptions = null,
  charges = [],
} = {}) {
  const normalizedFamilyId = Number(familyId)
  const normalizedPeriodKey = billingMonthKey(periodKey)
  if (!Number.isFinite(normalizedFamilyId)) {
    return {
      familyId: null,
      periodKey: normalizedPeriodKey,
      grossCents: 0,
      discountCents: 0,
      netCents: 0,
      lines: [],
    }
  }

  const allLines = await buildFamilyExistingEnrollmentPreviewLines(pool, {
    familyId: normalizedFamilyId,
    pricingDate: billingPeriodEvaluationTime(normalizedPeriodKey),
  })
  const signupIds = allLines.map((line) => Number(line.signupId)).filter(Number.isFinite)
  const lifecycleRows = await loadEnrollmentLifecycle(pool, signupIds)
  const lifecycleBySignup = new Map(
    lifecycleRows.map((row) => [Number(row.id), row]),
  )
  const eligibleLines = allLines.filter((line) => {
    const lifecycle = lifecycleBySignup.get(Number(line.signupId))
    return lifecycle && enrollmentBillsInPeriod(lifecycle, normalizedPeriodKey)
  })

  if (eligibleLines.length === 0) {
    return {
      familyId: normalizedFamilyId,
      periodKey: normalizedPeriodKey,
      grossCents: 0,
      discountCents: 0,
      netCents: 0,
      lines: [],
    }
  }

  const localRows = subscriptions ?? await loadLocalSubscriptions(
    pool,
    eligibleLines.map((line) => Number(line.signupId)),
  )
  const localBySignup = preferredSubscriptions(
    localRows.filter(
      (row) =>
        (row.source_type ?? row.sourceType) === 'scheduling_signup' &&
        (row.status ?? 'active') !== 'cancelled',
    ),
  )
  const metadataBySignup = new Map()
  const pricingSubscriptions = eligibleLines.map((line) => {
    const signupId = Number(line.signupId)
    const lifecycle = lifecycleBySignup.get(signupId)
    const local = localBySignup.get(signupId) ?? null
    metadataBySignup.set(signupId, { ...line })
    return {
      ...(local ?? {}),
      id: local?.id == null ? -signupId : Number(local.id),
      member_id: Number(line.memberId),
      source_type: 'scheduling_signup',
      source_id: String(signupId),
      status: 'active',
      monthly_amount_cents: Math.max(0, Math.round(Number(line.baseCents) || 0)),
      discount_amount_cents: 0,
      net_monthly_cents: Math.max(0, Math.round(Number(line.baseCents) || 0)),
      start_date: dateOnly(lifecycle?.enrollment_start_date ?? lifecycle?.created_at) ?? `${normalizedPeriodKey}-01`,
      next_bill_date: null,
    }
  })

  const priced = await priceRecurringPeriod(pool, {
    familyId: normalizedFamilyId,
    subscriptions: pricingSubscriptions,
    charges,
    periodKey: normalizedPeriodKey,
    lineMetadataBySignup: metadataBySignup,
  })
  const metadata = metadataBySignup
  const lines = priced.lines.map((line) => {
    const signupId = Number(line.signupId)
    const local = localBySignup.get(signupId) ?? null
    return {
      ...metadata.get(signupId),
      ...line,
      subscriptionId: local?.id == null ? null : Number(local.id),
      hasLocalSubscription: Boolean(local),
      localSubscriptionStatus: local?.status ?? null,
      localGrossCents:
        local?.monthly_amount_cents == null ? null : Number(local.monthly_amount_cents),
      localDiscountCents:
        local?.discount_amount_cents == null ? null : Number(local.discount_amount_cents),
      localNetCents:
        local?.net_monthly_cents == null ? null : Number(local.net_monthly_cents),
      stripeSubscriptionId: local?.stripe_subscription_id ?? null,
    }
  })

  return {
    ...priced,
    familyId: normalizedFamilyId,
    lines,
    missingSubscriptionSignupIds: lines
      .filter((line) => !line.hasLocalSubscription)
      .map((line) => Number(line.signupId)),
  }
}
