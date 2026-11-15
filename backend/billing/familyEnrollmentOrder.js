import { buildSignupOrderPreview } from '../scheduling/orderPricing.js'
import { computeOrderDiscounts } from '../scheduling/discountEngine.js'

const amount = value => Math.round(Number(value) || 0)
const sum = (rows, key) => rows.reduce((total, row) => total + Number(row?.[key] || 0), 0)
const prefix = memberId => `member:${memberId}:`

// Compute discounts once for the whole cart, including siblings in the same class.
// Per-athlete snapshots retain original slot keys for fulfillment and fee ledgers.
export function combineFamilyDiscountContexts(contexts, promoCodes = [], now = Date.now()) {
  const lines = new Map(), rules = new Map()
  const caps = { ...(contexts[0]?.context.caps || {}), ruleMemberRedeemedByMember: {} }
  for (const { memberId, context } of contexts) {
    caps.ruleMemberRedeemedByMember[memberId] = context.caps?.ruleMemberRedeemed || {}
    for (const rule of context.rules || []) rules.set(rule.id, rule)
    for (const original of context.lines || []) {
      const key = original.shadowOnly ? `existing:${original.signupId ?? original.key}` : prefix(memberId) + original.key
      const line = { ...original, key }
      for (const field of ['accountPaidClassCount','accountMonthlyCents','accountAllLines','familyPaidClassCount','familyMonthlyCents','familyAllLines','familyPayingCount']) delete line[field]
      lines.set(key, line)
    }
  }
  const result = computeOrderDiscounts({ lines: [...lines.values()], rules: [...rules.values()], caps, promoCodes, now })
  return { enabled: true, ...result }
}

export function familyMemberDiscounts(combined, memberId) {
  const ownPrefix = prefix(memberId)
  const own = combined.lines.filter(line => line.key.startsWith(ownPrefix))
  // Allocate account-wide order discounts in integer cents across all current
  // and new classes once, rather than charging each sibling the whole discount.
  const all = [...combined.lines, ...combined.accountLines]
  const bases = sum(all, 'baseCents')
  const allocations = new Map(all.map(line => [line.key, []]))
  for (const discount of combined.orderDiscounts) {
    let remaining = amount(discount.amountCents)
    for (const [index, line] of all.entries()) {
      const share = index === all.length - 1 ? remaining : Math.min(remaining, bases > 0 ? Math.round(discount.amountCents * line.baseCents / bases) : 0)
      remaining -= share
      allocations.get(line.key).push({ ...discount, amountCents: share, countedAsOrderDiscount: false })
    }
  }
  const lines = own.map(line => {
    const applied = allocations.get(line.key)
    const finalCents = Math.max(0, line.finalCents - sum(applied, 'amountCents'))
    return { ...line, key: line.key.slice(ownPrefix.length), finalCents, discountCents: line.baseCents - finalCents, applied: [...line.applied, ...applied.filter(item => item.amountCents)] }
  })
  const ownEntry = entry => entry.lineKey?.startsWith(ownPrefix) || (entry.lineKey == null && Number(entry.memberId) === Number(memberId))
  const strip = entry => ({ ...entry, ...(entry.lineKey ? { lineKey: entry.lineKey.slice(ownPrefix.length) } : {}) })
  return { enabled: true, lines, accountLines: [], orderDiscounts: [],
    redemptions: combined.redemptions.filter(ownEntry).map(strip),
    freeGrants: combined.freeGrants.filter(ownEntry).map(strip),
    subtotalCents: sum(lines, 'baseCents'), totalDiscountCents: sum(lines, 'discountCents'), totalCents: sum(lines, 'finalCents') }
}

export function combineFamilyEnrollmentPreviews(orders, discounts) {
  if (!orders.length) throw new Error('No family enrollment items provided.')
  const previews = orders.map(order => order.preview)
  const first = previews[0]
  const decorate = (order, item) => ({ ...item, memberId: order.memberId, memberName: order.memberName,
    ...(item.slotKey ? { slotKey: prefix(order.memberId) + item.slotKey } : {}),
    ...(item.displayLine ? { displayLine: `${order.memberName} · ${item.displayLine}` } : {}),
    ...(item.formTitle ? { formTitle: `${order.memberName} · ${item.formTitle}` } : {}),
  })
  const items = key => orders.flatMap(order => (order.preview[key]?.items || []).map(item => decorate(order, item)))
  const group = (key, totals) => ({ ...first[key], enabled: previews.some(preview => preview[key]?.enabled), items: items(key),
    ...Object.fromEntries(totals.map(field => [field, sum(previews.map(preview => preview[key]), field)])) })
  const existingClasses = [...new Map(previews.flatMap(preview => preview.existingClasses).map(row => [row.id, row])).values()]
  const existingMonthlyTotal = sum(existingClasses, 'monthlyPrice')
  const newSignupMonthlyTotal = sum(previews, 'newSignupMonthlyTotal')
  const freeCredit = sum(previews.map(preview => preview.freePasses), 'totalCreditCents')
  const additionalFeesMonthly = sum(previews, 'additionalFeesMonthly')
  return { ...first, memberId: null, familyOrders: orders, existingClasses, existingMonthlyTotal,
    newSignups: orders.flatMap(order => order.preview.newSignups.map(item => decorate(order, item))),
    formSummaries: previews.flatMap(preview => preview.formSummaries),
    newSignupMonthlyTotal, totalDiscountMonthly: discounts.totalDiscountCents / 100,
    estimatedMonthlyTotal: Math.max(0, existingMonthlyTotal + newSignupMonthlyTotal + additionalFeesMonthly - freeCredit / 100 - discounts.totalDiscountCents / 100),
    discounts, firstMonth: group('firstMonth', ['totalCents','totalProratedCents','totalPrepaidCents']),
    oneTimeTuition: group('oneTimeTuition', ['totalCents']),
    additionalFees: { ...group('additionalFees', ['totalCents','totalOneTimeCents','totalMonthlyCents']),
      items: orders.flatMap(order => (order.preview.additionalFees?.items || []).map(item => ({ ...item, memberId: order.memberId, name: `${order.memberName} · ${item.name}` }))) },
    additionalFeesMonthly, additionalFeesOneTime: sum(previews, 'additionalFeesOneTime'),
    freePasses: { ...group('freePasses', ['totalCreditCents']), redemptions: previews.flatMap(preview => preview.freePasses?.redemptions || []) },
    passPurchases: orders.flatMap(order => (order.preview.passPurchases || []).map(item => decorate(order,item))),
    passPurchaseTotalCents: sum(previews, 'passPurchaseTotalCents'),
    // Carried balance belongs to the household and must appear exactly once.
    carriedForward: first.carriedForward, hasPricing: previews.every(preview => preview.hasPricing) }
}

export async function buildFamilyEnrollmentOrderPreview(db, batches, promoCodes = []) {
  const contexts = []
  for (const batch of batches) {
    let context = { lines: [], rules: [], caps: {} }
    const initial = await buildSignupOrderPreview(db, { memberId: batch.memberId, newSignups: batch.payload.signups, promoCodes,
      discountContextSink: value => { context = value } })
    if (!initial.hasPricing) throw new Error('Enrollment pricing is unavailable. Please review the selected classes.')
    contexts.push({ memberId: batch.memberId, context })
  }
  const combined = combineFamilyDiscountContexts(contexts, promoCodes)
  const pendingMembershipRedemptions = {}
  const orders = []
  for (const batch of batches) {
    const preview = await buildSignupOrderPreview(db, { memberId: batch.memberId, newSignups: batch.payload.signups, promoCodes,
      discountOverride: familyMemberDiscounts(combined, batch.memberId), pendingMembershipRedemptions })
    for (const fee of preview.additionalFees?.items || []) {
      if (fee.promoRuleId && fee.discountCents > 0) pendingMembershipRedemptions[fee.promoRuleId] = (pendingMembershipRedemptions[fee.promoRuleId] || 0) + 1
    }
    const member = (await db.query('SELECT first_name,last_name FROM member WHERE id=$1', [batch.memberId])).rows[0]
    orders.push({ memberId: batch.memberId, memberName: `${member.first_name} ${member.last_name}`, preview })
  }
  return combineFamilyEnrollmentPreviews(orders, combined)
}
