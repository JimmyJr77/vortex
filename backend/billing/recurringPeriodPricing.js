import { computeExistingEnrollmentDiscounts } from '../scheduling/orderPricing.js'
import {
  addBillingMonths,
  applyPriceAdjustmentsForPeriod,
  billingMonthKey,
} from './customerBillingPricing.js'

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
    const through = adjustment.effective_through_month ?? adjustment.effectiveThroughMonth
    if (through) {
      const reverts = billingMonthKey(addBillingMonths(through, 1))
      if (reverts >= currentKey) keys.add(reverts)
    }
  }
  return [...keys].sort()
}

/** Price the enrollment subscriptions effective in a calendar month. */
export async function priceRecurringPeriod(pool, { familyId, subscriptions, charges = [], periodKey }) {
  const active = subscriptions.filter((subscription) => {
    const status = subscription.status ?? 'active'
    const starts = activationMonth(subscription, charges)
    return status === 'active' && !isAnnualMembership(subscription) && (starts == null || starts <= periodKey)
  })
  if (active.length === 0) return { periodKey, grossCents: 0, discountCents: 0, netCents: 0, lines: [] }

  const eligible = active.filter(
    (subscription) => (subscription.source_type ?? subscription.sourceType) === 'scheduling_signup',
  )
  const passthrough = active
    .filter((subscription) => (subscription.source_type ?? subscription.sourceType) !== 'scheduling_signup')
    .map(fallbackLine)

  const previewExistingLines = eligible.map((subscription) => {
    const fallback = fallbackLine(subscription)
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
          discountCents: Math.max(0, grossCents - netCents),
          netCents,
          discountComponents: (line.applied ?? [])
            .map((entry) => ({
              name: entry.name || (entry.source === 'manual' ? 'Legacy manual discount' : 'Automatic discount'),
              amountCents: Math.max(0, Number(entry.amountCents) || 0),
              source: entry.source ?? null,
            }))
            .filter((entry) => entry.amountCents > 0),
        }
      })
    } catch (error) {
      console.warn('[billing] period discount preview:', error?.message ?? error)
    }
  }
  if (priced.length === 0) priced = eligible.map(fallbackLine)

  priced = await applyPriceAdjustmentsForPeriod(pool, { lines: priced, periodKey })
  priced.push(...passthrough)

  return priced.reduce((summary, line) => {
    summary.lines.push(line)
    summary.grossCents += line.grossCents
    summary.discountCents += line.discountCents
    summary.netCents += line.netCents
    return summary
  }, { periodKey, grossCents: 0, discountCents: 0, netCents: 0, lines: [] })
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
        `SELECT effective_from_month, effective_through_month
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
