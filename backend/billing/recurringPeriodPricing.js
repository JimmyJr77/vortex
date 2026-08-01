import { computeExistingEnrollmentDiscounts } from '../scheduling/orderPricing.js'

function monthKey(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}` : null
}

function activationMonth(subscription, charges) {
  const posted = charges
    .filter((charge) => Number(charge.subscription_id) === Number(subscription.id))
    .map((charge) => monthKey(charge.service_period_start ?? charge.created_at))
    .filter(Boolean)
    .sort()[0]
  return posted ?? monthKey(subscription.next_bill_date ?? subscription.nextBillDate)
}

function fallbackLine(subscription) {
  const grossCents = Number(subscription.monthly_amount_cents ?? subscription.monthlyAmountCents ?? 0)
  const discountCents = Number(subscription.discount_amount_cents ?? subscription.discountAmountCents ?? 0)
  return {
    subscriptionId: Number(subscription.id),
    signupId: Number(subscription.source_id ?? subscription.sourceId),
    grossCents,
    discountCents,
    netCents: Number(subscription.net_monthly_cents ?? subscription.netMonthlyCents ?? grossCents - discountCents),
  }
}

/** Price the enrollment subscriptions effective in a calendar month. */
export async function priceRecurringPeriod(pool, { familyId, subscriptions, charges = [], periodKey }) {
  const eligible = subscriptions.filter((subscription) => {
    const status = subscription.status ?? 'active'
    const sourceType = subscription.source_type ?? subscription.sourceType
    const starts = activationMonth(subscription, charges)
    return status === 'active' && sourceType === 'scheduling_signup' && starts != null && starts <= periodKey
  })
  if (eligible.length === 0) return { periodKey, grossCents: 0, discountCents: 0, netCents: 0, lines: [] }

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
        return { ...fallback, grossCents, discountCents: Math.max(0, grossCents - netCents), netCents }
      })
    } catch (error) {
      console.warn('[billing] period discount preview:', error?.message ?? error)
    }
  }
  if (priced.length === 0) priced = eligible.map(fallbackLine)

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
  const keys = new Set([currentKey])
  for (const subscription of subscriptions) {
    const key = activationMonth(subscription, charges)
    if (key && key >= currentKey) keys.add(key)
  }
  const results = []
  for (const periodKey of [...keys].sort()) {
    const priced = await priceRecurringPeriod(pool, { familyId, subscriptions, charges, periodKey })
    if (results.at(-1)?.netCents !== priced.netCents) results.push(priced)
  }
  return results
}
