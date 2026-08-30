import { computeExistingEnrollmentDiscounts } from '../scheduling/orderPricing.js'
import {
  addBillingMonths,
  adjustmentCoversPeriod,
  applyEnrollmentPriceAdjustment,
  billingMonthInTimeZone,
  billingMonthKey,
  billingPeriodEvaluationTime,
  promoExpirationDate,
} from './customerBillingPricing.js'

function parseJson(value, fallback = {}) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function adjustmentValue(adjustment, snake, camel) {
  return adjustment?.[snake] ?? adjustment?.[camel]
}

function normalizedAdjustmentKind(adjustment) {
  return adjustment?.kind === 'legacy_discount' && adjustmentValue(adjustment, 'promo_code', 'promoCode')
    ? 'promo_code'
    : adjustment?.kind
}

export function runtimeDiscountRuleFromAdjustment(adjustment) {
  if (!adjustment || !['promo_code', 'legacy_discount'].includes(adjustment.kind)) return null
  const snapshot = parseJson(adjustmentValue(adjustment, 'discount_rule_snapshot', 'discountRuleSnapshot'))
  const id = Number(adjustmentValue(adjustment, 'discount_rule_id', 'discountRuleId') ?? snapshot.id)
  if (!Number.isFinite(id)) return null
  const promoCode = adjustmentValue(adjustment, 'promo_code', 'promoCode') ??
    snapshot.config?.code ?? snapshot.config?.promo_code ?? null
  const amountType = snapshot.amountType ?? snapshot.amount_type ??
    (snapshot.manualDiscountCents != null ? 'fixed' : 'percent')
  const amountValue = Number(
    snapshot.amountValue ?? snapshot.amount_value ?? snapshot.manualDiscountCents ??
      (snapshot.manualDiscountPct == null ? 0 : Number(snapshot.manualDiscountPct) * 100),
  )
  const startsAt = snapshot.startsAt ?? snapshot.starts_at
  const endsAt = snapshot.endsAt ?? snapshot.ends_at
  return {
    id,
    name: snapshot.name,
    description: snapshot.description,
    type: snapshot.type ?? (promoCode ? 'promo_code' : undefined),
    amountType,
    amountValue,
    applyTo: snapshot.applyTo ?? snapshot.apply_to,
    calcBase: snapshot.calcBase ?? snapshot.calc_base,
    priority: snapshot.priority == null ? undefined : Number(snapshot.priority),
    stackable: snapshot.stackable,
    exclusivityGroup: snapshot.exclusivityGroup ?? snapshot.exclusivity_group,
    maxDiscountCents:
      snapshot.maxDiscountCents ?? snapshot.max_discount_cents,
    scopeLevel: snapshot.scopeLevel ?? snapshot.scope_level,
    scopeRefId: snapshot.scopeRefId ?? snapshot.scope_ref_id,
    startsAt,
    endsAt,
    expiresOn: snapshot.expiresOn ?? (endsAt ? promoExpirationDate(endsAt) : undefined),
    active: true,
    config: {
      ...(snapshot.config ?? {}),
      ...(promoCode ? { code: promoCode } : {}),
    },
    tiers: snapshot.tiers,
  }
}

export function persistedDiscountFromAdjustment(adjustment) {
  const rule = runtimeDiscountRuleFromAdjustment(adjustment)
  if (!rule) return null
  const freeAccess = rule.config?.discountKind === 'free_access'
  return {
    manualDiscountCents:
      freeAccess ? Number.MAX_SAFE_INTEGER : rule.amountType === 'fixed' ? Number(rule.amountValue) : null,
    manualDiscountPct:
      freeAccess ? null : rule.amountType === 'percent' ? Number(rule.amountValue) / 100 : null,
    manualDiscountRuleId: Number(rule.id),
    manualDiscountReason: rule.name ?? adjustment.reason ?? 'Tuition discount',
    managedDiscountAssignment: true,
    managedPriceAdjustmentId: Number(adjustment.id),
    rule,
  }
}

async function loadAdjustmentHistory(db, signupIds) {
  if (signupIds.length === 0) return []
  try {
    const result = await db.query(
      `SELECT * FROM enrollment_price_adjustment
       WHERE signup_id = ANY($1::bigint[])
       ORDER BY signup_id, created_at DESC, id DESC`,
      [signupIds],
    )
    return result.rows
  } catch (error) {
    if (error?.code === '42P01' || error?.code === '42703') return []
    throw error
  }
}

function monthKey(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}` : null
}

function activationMonth(subscription, charges) {
  const posted = charges
    .filter((charge) => Number(charge.subscription_id ?? charge.subscriptionId) === Number(subscription.id))
    .map((charge) => monthKey(
      charge.service_period_start ?? charge.servicePeriodStart ?? charge.created_at ?? charge.createdAt,
    ))
    .filter(Boolean)
    .sort()[0]
  return posted ?? monthKey(
    subscription.next_bill_date ?? subscription.nextBillDate ?? subscription.start_date ?? subscription.startDate,
  )
}

function fallbackLine(subscription) {
  const grossCents = Number(subscription.monthly_amount_cents ?? subscription.monthlyAmountCents ?? 0)
  const discountCents = Number(subscription.discount_amount_cents ?? subscription.discountAmountCents ?? 0)
  return {
    subscriptionId: Number(subscription.id),
    signupId: Number(subscription.source_id ?? subscription.sourceId),
    grossCents,
    automaticNetCents: Number(subscription.net_monthly_cents ?? subscription.netMonthlyCents ?? grossCents - discountCents),
    automaticDiscountCents: discountCents,
    manualAdjustmentCents: 0,
    discountCents,
    netCents: Number(subscription.net_monthly_cents ?? subscription.netMonthlyCents ?? grossCents - discountCents),
    discountComponents: discountCents > 0
      ? [{ name: 'Subscription discount', amountCents: discountCents, source: 'subscription' }]
      : [],
  }
}

function isAnnualMembership(subscription) {
  return (
    (subscription.source_type ?? subscription.sourceType) === 'annual_membership' ||
    (subscription.pricing_option_key ?? subscription.pricingOptionKey) === 'annual_membership'
  )
}

export function collectRecurringPricingBoundaries({
  subscriptions = [],
  charges = [],
  adjustments = [],
  currentMonth = billingMonthKey(new Date()),
}) {
  const currentKey = billingMonthKey(currentMonth)
  const keys = new Set([currentKey])
  for (const subscription of subscriptions) {
    if (isAnnualMembership(subscription)) continue
    const key = activationMonth(subscription, charges)
    if (key && key >= currentKey) keys.add(key)
  }
  for (const adjustment of adjustments) {
    const starts = billingMonthKey(adjustment.effective_from_month ?? adjustment.effectiveFromMonth)
    if (starts >= currentKey) keys.add(starts)
    let through = adjustment.effective_through_month ?? adjustment.effectiveThroughMonth
    if (!through && ['promo_code', 'legacy_discount'].includes(adjustment.kind)) {
      const snapshot = parseJson(
        adjustmentValue(adjustment, 'discount_rule_snapshot', 'discountRuleSnapshot'),
      )
      const endsAt = snapshot.endsAt ?? snapshot.ends_at
      through = endsAt ? billingMonthInTimeZone(endsAt) : null
    }
    if (through) {
      const reverts = billingMonthKey(addBillingMonths(through, 1))
      if (reverts >= currentKey) keys.add(reverts)
    }
  }
  return [...keys].sort()
}

/** Price the enrollment subscriptions effective in a calendar month. */
export async function priceRecurringPeriod(pool, {
  familyId,
  subscriptions,
  charges = [],
  periodKey,
  proposedAdjustments = [],
  excludedAdjustmentIds = [],
}) {
  const normalizedPeriodKey = billingMonthKey(periodKey)
  const active = subscriptions.filter((subscription) => {
    const status = subscription.status ?? 'active'
    const starts = activationMonth(subscription, charges)
    return status === 'active' && !isAnnualMembership(subscription) && (starts == null || starts <= normalizedPeriodKey)
  })
  if (active.length === 0) {
    return { periodKey: normalizedPeriodKey, grossCents: 0, discountCents: 0, netCents: 0, lines: [] }
  }

  const eligible = active.filter(
    (subscription) => (subscription.source_type ?? subscription.sourceType) === 'scheduling_signup',
  )
  const passthrough = active
    .filter((subscription) => (subscription.source_type ?? subscription.sourceType) !== 'scheduling_signup')
    .map(fallbackLine)

  const persistedDiscountBySignup = new Map()
  const eligibleSignupIds = eligible
    .map((subscription) => Number(subscription.source_id ?? subscription.sourceId))
    .filter(Number.isFinite)
  if (eligibleSignupIds.length > 0) {
    try {
      const result = await pool.query(
        `SELECT id, manual_discount_cents, manual_discount_pct,
                manual_discount_rule_id, manual_discount_reason
         FROM scheduling_signup
         WHERE id = ANY($1::bigint[])`,
        [eligibleSignupIds],
      )
      for (const row of result.rows) {
        persistedDiscountBySignup.set(Number(row.id), {
          manualDiscountCents:
            row.manual_discount_cents == null ? null : Number(row.manual_discount_cents),
          manualDiscountPct:
            row.manual_discount_pct == null ? null : Number(row.manual_discount_pct),
          manualDiscountRuleId:
            row.manual_discount_rule_id == null ? null : Number(row.manual_discount_rule_id),
          manualDiscountReason: row.manual_discount_reason ?? null,
        })
      }
    } catch (error) {
      // Deployment remains compatible while scheduling discount columns migrate.
      if (error?.code !== '42P01' && error?.code !== '42703') throw error
    }
  }

  const adjustmentHistory = await loadAdjustmentHistory(pool, eligibleSignupIds)
  const excludedIds = new Set(excludedAdjustmentIds.map(Number).filter(Number.isFinite))
  const historyBySignup = new Map()
  for (const adjustment of adjustmentHistory) {
    const signupId = Number(adjustmentValue(adjustment, 'signup_id', 'signupId'))
    const list = historyBySignup.get(signupId) ?? []
    list.push(adjustment)
    historyBySignup.set(signupId, list)
  }
  const proposedBySignup = new Map()
  for (const adjustment of proposedAdjustments ?? []) {
    const signupId = Number(adjustmentValue(adjustment, 'signup_id', 'signupId'))
    if (!Number.isFinite(signupId) || excludedIds.has(Number(adjustment.id))) continue
    const list = proposedBySignup.get(signupId) ?? []
    list.push(adjustment)
    proposedBySignup.set(signupId, list)
  }
  const effectiveAdjustmentBySignup = new Map()
  for (const signupId of eligibleSignupIds) {
    const proposed = (proposedBySignup.get(signupId) ?? []).find(
      (adjustment) => adjustmentCoversPeriod(adjustment, normalizedPeriodKey),
    )
    const persisted = (historyBySignup.get(signupId) ?? []).find(
      (adjustment) =>
        adjustment.status === 'active' &&
        !excludedIds.has(Number(adjustment.id)) &&
        adjustmentCoversPeriod(adjustment, normalizedPeriodKey),
    )
    const effective = proposed ?? persisted
    if (effective) effectiveAdjustmentBySignup.set(signupId, effective)
  }

  const ruleSnapshots = []
  const seenRuleIds = new Set()
  for (const adjustment of effectiveAdjustmentBySignup.values()) {
    if (!['promo_code', 'legacy_discount'].includes(adjustment.kind)) continue
    const rule = runtimeDiscountRuleFromAdjustment(adjustment)
    if (rule && !seenRuleIds.has(rule.id)) {
      seenRuleIds.add(rule.id)
      ruleSnapshots.push(rule)
    }
  }

  const previewExistingLines = eligible.map((subscription) => {
    const fallback = fallbackLine(subscription)
    const history = historyBySignup.get(fallback.signupId) ?? []
    const proposed = proposedBySignup.get(fallback.signupId) ?? []
    const hasManagedDiscount = [...history, ...proposed].some((adjustment) =>
      ['promo_code', 'legacy_discount'].includes(adjustment.kind),
    )
    const effectiveAdjustment = effectiveAdjustmentBySignup.get(fallback.signupId) ?? null
    const effectiveDiscount = ['promo_code', 'legacy_discount'].includes(effectiveAdjustment?.kind)
      ? persistedDiscountFromAdjustment(effectiveAdjustment)
      : null
    const discountInput = hasManagedDiscount
      ? effectiveDiscount ?? {
          manualDiscountCents: null,
          manualDiscountPct: null,
          manualDiscountRuleId: null,
          manualDiscountReason: null,
          managedDiscountAssignment: true,
        }
      : persistedDiscountBySignup.get(fallback.signupId) ?? {}
    return {
      key: `billing-period-${subscription.id}`,
      signupId: fallback.signupId,
      memberId: Number(subscription.member_id ?? subscription.memberId),
      familyId: Number(familyId),
      baseCents: fallback.grossCents,
      listCents: fallback.grossCents,
      finalCents: fallback.grossCents,
      includeInSubtotal: false,
      shadowOnly: true,
      ...discountInput,
    }
  }).filter((line) => Number.isFinite(line.signupId) && Number.isFinite(line.memberId))

  let priced = []
  if (previewExistingLines.length > 0) {
    try {
      const result = await computeExistingEnrollmentDiscounts(pool, {
        memberId: previewExistingLines[0].memberId,
        promoCodes: [],
        memberContext: { familyId: Number(familyId) },
        previewExistingLines,
        replaceDbLines: true,
        formRows: new Map(),
        scopeMeta: new Map(),
        pricingDate: billingPeriodEvaluationTime(normalizedPeriodKey),
        ruleSnapshots,
      })
      const bySignup = new Map((result.accountLines ?? []).map((line) => [Number(line.signupId), line]))
      priced = eligible.map((subscription) => {
        const fallback = fallbackLine(subscription)
        const line = bySignup.get(fallback.signupId)
        if (!line) return fallback
        const grossCents = Number(line.baseCents ?? fallback.grossCents)
        const netCents = Number(line.finalCents ?? grossCents)
        return {
          ...fallback,
          grossCents,
          automaticNetCents: netCents,
          automaticDiscountCents: Math.max(0, grossCents - netCents),
          discountCents: Math.max(0, grossCents - netCents),
          netCents,
          discountComponents: (line.applied ?? [])
            .map((entry) => ({
              ruleId: entry.ruleId == null ? null : Number(entry.ruleId),
              name: entry.name || (entry.source === 'manual' ? 'Legacy manual discount' : 'Automatic discount'),
              type: entry.type ?? null,
              amountCents: Math.max(0, Number(entry.amountCents) || 0),
              source: entry.source ?? null,
              amountType: entry.amountType ?? null,
              amountValue: entry.amountValue == null ? null : Number(entry.amountValue),
              promoCode: entry.promoCode ?? null,
              startsAt: entry.startsAt ?? null,
              endsAt: entry.endsAt ?? null,
              expiresOn: entry.expiresOn ?? promoExpirationDate(entry.endsAt),
              qualifiedLabel: entry.qualifiedLabel ?? null,
              qualifiedClassCount:
                entry.qualifiedClassCount == null ? null : Number(entry.qualifiedClassCount),
              qualifyingSubtotalCents:
                entry.qualifyingSubtotalCents == null
                  ? null
                  : Number(entry.qualifyingSubtotalCents),
            }))
            .filter((entry) => entry.amountCents > 0),
        }
      })
    } catch (error) {
      console.warn('[billing] period discount preview:', error?.message ?? error)
    }
  }
  if (priced.length === 0) priced = eligible.map(fallbackLine)

  priced = priced.map((line) => {
    const adjustment = effectiveAdjustmentBySignup.get(Number(line.signupId)) ?? null
    if (!adjustment) return applyEnrollmentPriceAdjustment(line, null)
    if (normalizedAdjustmentKind(adjustment) === 'fixed_final_price') {
      return applyEnrollmentPriceAdjustment(line, adjustment)
    }
    if (line.discountComponents?.some(
      (component) =>
        (component.ruleId != null && Number(component.ruleId) === Number(adjustmentValue(adjustment, 'discount_rule_id', 'discountRuleId'))) ||
        (component.promoCode && component.promoCode === adjustmentValue(adjustment, 'promo_code', 'promoCode')),
    )) {
      return {
        ...line,
        automaticNetCents: Number(line.netCents),
        automaticDiscountCents: Number(line.grossCents) - Number(line.netCents),
        manualAdjustmentCents: 0,
        priceAdjustmentId: Number(adjustment.id),
        priceAdjustment: adjustment,
      }
    }
    // Compatibility fallback for an incomplete legacy snapshot. New and migrated
    // promo assignments always resolve in the discount engine above.
    return applyEnrollmentPriceAdjustment(
      line,
      normalizedAdjustmentKind(adjustment) === 'promo_code'
        ? { ...adjustment, kind: 'promo_code' }
        : adjustment,
    )
  })
  priced.push(...passthrough)

  return priced.reduce((summary, line) => {
    summary.lines.push(line)
    summary.grossCents += line.grossCents
    summary.discountCents += line.discountCents
    summary.netCents += line.netCents
    return summary
  }, { periodKey: normalizedPeriodKey, grossCents: 0, discountCents: 0, netCents: 0, lines: [] })
}

/** Current total plus each future month in which another enrollment begins. */
export async function buildRecurringBreakpoints(pool, { familyId, subscriptions, charges = [], asOf = new Date() }) {
  const currentKey = `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, '0')}`
  let adjustments = []
  const signupIds = subscriptions
    .filter((subscription) => (subscription.source_type ?? subscription.sourceType) === 'scheduling_signup')
    .map((subscription) => Number(subscription.source_id ?? subscription.sourceId))
    .filter(Number.isFinite)
  if (signupIds.length > 0) {
    try {
      const adjustmentResult = await pool.query(
        `SELECT kind, effective_from_month, effective_through_month, discount_rule_snapshot
         FROM enrollment_price_adjustment
         WHERE signup_id = ANY($1::bigint[]) AND status = 'active'`,
        [signupIds],
      )
      adjustments = adjustmentResult.rows
    } catch (error) {
      if (error?.code !== '42P01' && error?.code !== '42703') throw error
    }
  }
  const keys = collectRecurringPricingBoundaries({
    subscriptions,
    charges,
    adjustments,
    currentMonth: currentKey,
  })
  const results = []
  for (const periodKey of keys) {
    const priced = await priceRecurringPeriod(pool, { familyId, subscriptions, charges, periodKey })
    if (results.at(-1)?.netCents !== priced.netCents) results.push(priced)
  }
  return results
}
