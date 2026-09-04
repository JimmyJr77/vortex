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

function monthStart(dateValue) {
  const value = dateOnly(dateValue)
  return value ? `${value.slice(0, 7)}-01` : null
}

function periodBounds(periodValue) {
  const periodKey = billingMonthKey(periodValue)
  const start = `${periodKey}-01`
  const nextStart = nextMonthStart(periodKey)
  const endDate = new Date(`${nextStart}T00:00:00.000Z`)
  endDate.setUTCDate(endDate.getUTCDate() - 1)
  return { periodKey, start, end: endDate.toISOString().slice(0, 10), next: nextStart }
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

function field(row, snake, camel) {
  return row?.[snake] ?? row?.[camel] ?? null
}

/**
 * Authoritative lifecycle classification shared by live pricing, migration
 * shadow parity, charge posting, and final cutover verification.
 */
export function classifyEnrollmentBillingPeriod(row, periodValue, {
  requireSubscriptionMapping = false,
} = {}) {
  const period = periodBounds(periodValue)
  const sourceType = field(row, 'source_type', 'sourceType')
  const sourceId = field(row, 'source_id', 'sourceId')
  const signupIdValue = field(row, 'signup_id', 'signupId')
  const signupId = signupIdValue == null ? null : Number(signupIdValue)
  const signupStatus = requireSubscriptionMapping
    ? field(row, 'signup_status', 'signupStatus')
    : field(row, 'signup_status', 'signupStatus') ?? row?.status
  const orphanedAt = field(row, 'signup_orphaned_at', 'signupOrphanedAt') ?? field(row, 'orphaned_at', 'orphanedAt')
  const pricingBreakdown = field(row, 'pricing_breakdown', 'pricingBreakdown')

  const result = (valid, billable, reason, extra = {}) => ({
    valid,
    billable,
    reason,
    periodKey: period.periodKey,
    periodStart: period.start,
    periodEnd: period.end,
    nextPeriodStart: period.next,
    allowsNoNextBill: false,
    ...extra,
  })

  if (requireSubscriptionMapping) {
    if (sourceType !== 'scheduling_signup' || !/^\d+$/.test(String(sourceId ?? ''))) {
      return result(false, false, 'subscription_source_mapping_invalid')
    }
    if (!Number.isSafeInteger(signupId) || signupId <= 0 || String(signupId) !== String(sourceId)) {
      return result(false, false, 'subscription_signup_mapping_missing')
    }
  }
  if (orphanedAt != null) return result(false, false, 'signup_orphaned')
  if (signupStatus !== 'confirmed') return result(false, false, 'signup_not_confirmed', { signupStatus })
  if (billingTypeFromBreakdown(pricingBreakdown) === 'one_time') {
    return result(false, false, 'one_time_enrollment_has_recurring_subscription')
  }

  const enrollmentStart = dateOnly(
    field(row, 'enrollment_start_date', 'enrollmentStartDate') ??
      field(row, 'signup_created_at', 'signupCreatedAt') ??
      row?.created_at ?? row?.createdAt ?? field(row, 'start_date', 'startDate'),
  )
  const activeStart = dateOnly(
    field(row, 'offering_start_date', 'offeringStartDate') ??
      field(row, 'group_active_start', 'groupActiveStart') ??
      field(row, 'form_start_date', 'formStartDate') ??
      field(row, 'class_active_start', 'classActiveStart'),
  )
  const activeEnd = dateOnly(
    field(row, 'offering_end_date', 'offeringEndDate') ??
      field(row, 'group_active_end', 'groupActiveEnd') ??
      field(row, 'form_end_date', 'formEndDate') ??
      field(row, 'class_active_end', 'classActiveEnd'),
  )
  const subscriptionEnd = dateOnly(field(row, 'end_date', 'endDate'))
  const cancellation = dateOnly(field(row, 'cancel_effective_date', 'cancelEffectiveDate'))
  const pause = dateOnly(field(row, 'pause_effective_date', 'pauseEffectiveDate'))

  // An active local subscription left behind after service already ended is
  // stale, not a valid target-month exclusion. Evaluate this before future or
  // boundary exclusions so contradictory lifecycle dates fail closed.
  if (activeEnd && activeEnd < period.start) {
    return result(false, false, 'active_subscription_class_already_ended')
  }
  if (subscriptionEnd && subscriptionEnd < period.start) {
    return result(false, false, 'active_subscription_already_ended')
  }
  if (enrollmentStart && enrollmentStart > period.end) {
    const futureServiceStart = [enrollmentStart, activeStart]
      .filter((value) => value && value > period.end)
      .sort()
      .at(-1)
    return result(true, false, 'enrollment_starts_after_target_month', {
      minimumNextBillDate: monthStart(futureServiceStart) ?? period.next,
    })
  }
  if (activeStart && activeStart > period.end) {
    return result(true, false, 'class_starts_after_target_month', {
      minimumNextBillDate: monthStart(activeStart) ?? period.next,
    })
  }
  if (cancellation && cancellation <= period.start) {
    return result(true, false, 'cancellation_effective_by_target_month')
  }
  if (pause && pause <= period.start) {
    return result(true, false, 'pause_effective_by_target_month')
  }

  const terminalCandidates = [
    [activeEnd, 'class_ends_in_target_month'],
    [subscriptionEnd, 'subscription_ends_in_target_month'],
    [cancellation, 'cancellation_effective_next_boundary'],
    [pause, 'pause_effective_next_boundary'],
  ]
  const terminal = terminalCandidates.find(([value]) => (
    value && value >= period.start && value <= period.next
  ))
  return result(true, true, 'billable', terminal
    ? { allowsNoNextBill: true, terminalReason: terminal[1], terminalDate: terminal[0] }
    : {})
}

/**
 * A lifecycle exclusion must not leave an earlier recurring schedule behind.
 * Otherwise the ordinary catch-up worker can later charge a month that the
 * canonical cutover deliberately excluded.
 */
export function validateEnrollmentBillingPeriodExclusionSchedule(
  row,
  periodValue,
  lifecycle = null,
) {
  const period = periodBounds(periodValue)
  const classification = lifecycle ?? classifyEnrollmentBillingPeriod(row, period.periodKey)
  const nextBillDate = dateOnly(field(row, 'next_bill_date', 'nextBillDate'))
  const base = {
    applicable: classification.valid === true && classification.billable === false,
    valid: true,
    reason: null,
    nextBillDate,
    minimumNextBillDate: classification.minimumNextBillDate ?? null,
  }
  if (!base.applicable) return base

  if (nextBillDate && !/^\d{4}-\d{2}-01$/.test(nextBillDate)) {
    return { ...base, valid: false, reason: 'excluded_subscription_schedule_not_month_aligned' }
  }

  if (['enrollment_starts_after_target_month', 'class_starts_after_target_month'].includes(classification.reason)) {
    const minimumNextBillDate = classification.minimumNextBillDate ?? period.next
    if (!nextBillDate) {
      return {
        ...base,
        valid: false,
        reason: 'future_enrollment_schedule_missing',
        minimumNextBillDate,
      }
    }
    if (nextBillDate < minimumNextBillDate) {
      return {
        ...base,
        valid: false,
        reason: 'future_enrollment_schedule_before_service_month',
        minimumNextBillDate,
      }
    }
    return { ...base, minimumNextBillDate }
  }

  if (['cancellation_effective_by_target_month', 'pause_effective_by_target_month'].includes(classification.reason)) {
    if (nextBillDate && nextBillDate < period.start) {
      return {
        ...base,
        valid: false,
        reason: 'excluded_subscription_prior_period_due',
        minimumNextBillDate: period.start,
      }
    }
    // The exact boundary remains legitimate while the scheduled lifecycle job
    // atomically clears or pauses the subscription. A later date inside the
    // excluded month would resurrect collection after that boundary.
    if (nextBillDate && nextBillDate > period.start && nextBillDate < period.next) {
      return {
        ...base,
        valid: false,
        reason: 'excluded_subscription_target_period_due',
        minimumNextBillDate: period.next,
      }
    }
    return { ...base, minimumNextBillDate: period.start }
  }

  return {
    ...base,
    valid: false,
    reason: 'unsupported_lifecycle_exclusion_schedule',
  }
}

export function buildEnrollmentBillingPeriodManifest(rows = [], periodValue, options = {}) {
  return rows.map((row) => {
    const sourceId = field(row, 'source_id', 'sourceId')
    const signupIdValue = field(row, 'signup_id', 'signupId')
    const signupId = signupIdValue == null && /^\d+$/.test(String(sourceId ?? ''))
      ? Number(sourceId)
      : signupIdValue == null ? null : Number(signupIdValue)
    const subscriptionIdValue = row?.subscription_id ?? row?.subscriptionId ?? row?.id
    const lifecycle = classifyEnrollmentBillingPeriod(row, periodValue, options)
    const exclusionSchedule = validateEnrollmentBillingPeriodExclusionSchedule(
      row,
      periodValue,
      lifecycle,
    )
    return {
      subscriptionId: subscriptionIdValue == null ? null : Number(subscriptionIdValue),
      signupId,
      subscriptionStatus: field(row, 'subscription_status', 'subscriptionStatus') ?? row?.status ?? null,
      ...lifecycle,
      exclusionScheduleValid: exclusionSchedule.applicable ? exclusionSchedule.valid : null,
      exclusionScheduleReason: exclusionSchedule.applicable ? exclusionSchedule.reason : null,
      exclusionNextBillDate: exclusionSchedule.applicable ? exclusionSchedule.nextBillDate : null,
      exclusionMinimumNextBillDate: exclusionSchedule.applicable
        ? exclusionSchedule.minimumNextBillDate
        : null,
    }
  })
}

/** Pure lifecycle gate used by live billing, audit, and tests. */
export function enrollmentBillsInPeriod(row, periodValue) {
  return classifyEnrollmentBillingPeriod(row, periodValue).billable
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
 * A billing subscription remains the financial owner when its associated
 * enrollment is reassigned to another family member as an administrative
 * correction. This keeps the correction from repricing the household.
 */
export function enrollmentBillingMemberId(line, localSubscription = null) {
  const subscriptionMemberId = Number(localSubscription?.member_id ?? localSubscription?.memberId)
  return Number.isSafeInteger(subscriptionMemberId) && subscriptionMemberId > 0
    ? subscriptionMemberId
    : Number(line.memberId)
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
  ensureSchema = false,
  strictPricing = false,
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
    ensureSchema,
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
      // The local subscription is the billing owner. It can intentionally
      // differ from the enrollment's athlete when an administrator corrects a
      // family-member assignment without changing any billing history.
      member_id: enrollmentBillingMemberId(line, local),
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
    strictPricing,
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
