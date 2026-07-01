import { monthlySlotCostCents } from './slotHours.js'

/** Apply free-slot grants to an ordered list of per-slot monthly costs (dollars). */
export function computeMonthlyPricingFromCosts(monthlyCostsDollars, freeSlotsGranted, meta = {}) {
  const costs = (monthlyCostsDollars || []).map((c) => Math.max(0, Number(c) || 0))
  const total = costs.length
  const freePerUser = Number(meta.freeSlotsPerUser ?? 0)
  const maxFreeTotal =
    meta.maxFreeSlotsTotal != null && meta.maxFreeSlotsTotal !== ''
      ? Number(meta.maxFreeSlotsTotal)
      : null
  const perUserFree = Math.min(total, freePerUser)
  const granted =
    freeSlotsGranted != null
      ? Math.min(Math.max(0, Number(freeSlotsGranted) || 0), total)
      : perUserFree

  let nonDiscountedMonthly = 0
  let discountMonthly = 0
  let discountedMonthly = 0
  for (let i = 0; i < costs.length; i += 1) {
    nonDiscountedMonthly += costs[i]
    if (i < granted) discountMonthly += costs[i]
    else discountedMonthly += costs[i]
  }

  const costPerSlotMonthly = total > 0 ? nonDiscountedMonthly / total : 0

  return {
    totalSlots: total,
    freeSlotsGranted: granted,
    freeSlotsRemaining: Math.max(0, freePerUser - total),
    globalFreeSlotsCap: maxFreeTotal,
    costPerSlotMonthly,
    nonDiscountedMonthly,
    discountMonthly,
    discountedMonthly,
    hasFreeSlots: freePerUser > 0 || (maxFreeTotal != null && maxFreeTotal > 0),
    hasPricing: nonDiscountedMonthly > 0,
    hoursPerSlotMonthly: meta.hoursPerSlotMonthly ?? null,
    costUnit: meta.costUnit ?? null,
  }
}

export function computeMonthlyPricing(
  effectiveDbRow,
  totalActiveSlots,
  freeSlotsGranted = null,
  options = {},
) {
  const freePerUser = Number(effectiveDbRow?.free_slots_per_user ?? 0)
  const maxFreeTotal =
    effectiveDbRow?.max_free_slots_total != null
      ? Number(effectiveDbRow.max_free_slots_total)
      : null
  const total = Math.max(0, Number(totalActiveSlots) || 0)
  const unit = effectiveDbRow?.cost_unit ?? 'per_month'
  const { slotHoursPerMonth = null, defaultHoursPerMonth = 0 } = options

  let monthlyCostsDollars
  let hoursPerSlotMonthly = null

  if (Array.isArray(slotHoursPerMonth) && slotHoursPerMonth.length === total) {
    hoursPerSlotMonthly = total > 0 ? slotHoursPerMonth[0] : null
    monthlyCostsDollars = slotHoursPerMonth.map((hours) =>
      monthlySlotCostCents(effectiveDbRow, hours) / 100,
    )
  } else {
    const hours =
      unit === 'per_hour' ? Math.max(0, Number(defaultHoursPerMonth) || 0) : 1
    if (unit === 'per_hour') hoursPerSlotMonthly = hours
    const costPerSlot = monthlySlotCostCents(effectiveDbRow, hours) / 100
    monthlyCostsDollars = Array(total).fill(costPerSlot)
  }

  return computeMonthlyPricingFromCosts(monthlyCostsDollars, freeSlotsGranted, {
    freeSlotsPerUser: freePerUser,
    maxFreeSlotsTotal: maxFreeTotal,
    hoursPerSlotMonthly,
    costUnit: unit,
  })
}

function formatMoney(amount) {
  return `$${amount.toFixed(2)}`
}

/**
 * Classify a pricing cost unit as recurring (monthly) or one-time.
 * @param {string | null | undefined} costUnit
 * @returns {'recurring' | 'one_time'}
 */
export function billingTypeForCostUnit(costUnit) {
  const unit = String(costUnit || 'per_month')
  if (unit === 'per_class' || unit === 'per_offering') return 'one_time'
  return 'recurring'
}

/**
 * Build a serializable pricing summary for enrollment receipts (payload + email + page).
 * Amounts in the incoming `pricing` object are dollars (from computeMonthlyPricing).
 * @param {object | null | undefined} pricing
 * @returns {null | {
 *   billingType: 'recurring' | 'one_time'
 *   billingLabel: string
 *   costUnit: string | null
 *   totalSlots: number
 *   nonDiscountedCents: number
 *   discountCents: number
 *   netCents: number
 *   hoursPerSlotMonthly: number | null
 * }}
 */
export function buildReceiptPricingSummary(pricing) {
  if (!pricing?.hasPricing) return null
  const billingType = billingTypeForCostUnit(pricing.costUnit)
  const toCents = (dollars) => Math.round((Number(dollars) || 0) * 100)
  return {
    billingType,
    billingLabel: billingType === 'recurring' ? 'Monthly (recurring)' : 'One-time',
    costUnit: pricing.costUnit ?? null,
    totalSlots: Number(pricing.totalSlots) || 0,
    nonDiscountedCents: toCents(pricing.nonDiscountedMonthly),
    discountCents: toCents(pricing.discountMonthly),
    netCents: toCents(pricing.discountedMonthly),
    hoursPerSlotMonthly:
      pricing.hoursPerSlotMonthly != null ? Number(pricing.hoursPerSlotMonthly) : null,
  }
}

/**
 * Format a receipt pricing summary (from buildReceiptPricingSummary) into email text/html.
 * @param {ReturnType<typeof buildReceiptPricingSummary>} summary
 */
export function formatReceiptPricingSummaryEmail(summary) {
  if (!summary) return { text: '', html: '' }
  const money = (cents) => formatMoney((Number(cents) || 0) / 100)
  const suffix = summary.billingType === 'recurring' ? '/mo' : ''
  const lines = ['Cost summary:']
  lines.push(`• Billing type: ${summary.billingLabel}`)
  if (summary.totalSlots > 0) lines.push(`• Classes: ${summary.totalSlots}`)
  lines.push(`• Base cost: ${money(summary.nonDiscountedCents)}${suffix}`)
  if (summary.discountCents > 0) {
    lines.push(`• Discount: -${money(summary.discountCents)}${suffix}`)
  }
  lines.push(`• Total: ${money(summary.netCents)}${suffix}`)

  const row = (label, value) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#666;">${label}</td><td><strong>${value}</strong></td></tr>`
  const htmlRows = [row('Billing type', summary.billingLabel)]
  if (summary.totalSlots > 0) htmlRows.push(row('Classes', String(summary.totalSlots)))
  htmlRows.push(row('Base cost', `${money(summary.nonDiscountedCents)}${suffix}`))
  if (summary.discountCents > 0) {
    htmlRows.push(row('Discount', `-${money(summary.discountCents)}${suffix}`))
  }
  htmlRows.push(row('Total', `${money(summary.netCents)}${suffix}`))

  return {
    text: lines.join('\n'),
    html: `<p style="margin-top:20px;"><strong>Cost summary</strong></p><table style="margin:8px 0;border-collapse:collapse;">${htmlRows.join(
      '',
    )}</table>`,
  }
}

export function formatPricingEmailBlock(pricing) {
  if (!pricing?.hasPricing) {
    return { text: '', html: '' }
  }

  const lines = ['Monthly cost summary:']
  lines.push(`• Slots held: ${pricing.totalSlots}`)
  if (pricing.costUnit === 'per_hour' && pricing.hoursPerSlotMonthly != null) {
    lines.push(`• Billable hours (est.): ${Number(pricing.hoursPerSlotMonthly).toFixed(2)} hr/mo per slot`)
  }
  if (pricing.hasFreeSlots) {
    lines.push(`• Free slots remaining (per user): ${pricing.freeSlotsRemaining}`)
  }
  lines.push(`• Non-discounted total: ${formatMoney(pricing.nonDiscountedMonthly)}/mo`)
  if (pricing.discountMonthly > 0) {
    lines.push(`• Discount: -${formatMoney(pricing.discountMonthly)}/mo`)
  }
  lines.push(`• Your total: ${formatMoney(pricing.discountedMonthly)}/mo`)

  const htmlRows = [
    `<tr><td style="padding:6px 12px 6px 0;color:#666;">Slots held</td><td><strong>${pricing.totalSlots}</strong></td></tr>`,
  ]
  if (pricing.costUnit === 'per_hour' && pricing.hoursPerSlotMonthly != null) {
    htmlRows.push(
      `<tr><td style="padding:6px 12px 6px 0;color:#666;">Billable hours (est.)</td><td><strong>${Number(pricing.hoursPerSlotMonthly).toFixed(2)} hr/mo per slot</strong></td></tr>`,
    )
  }
  if (pricing.hasFreeSlots) {
    htmlRows.push(
      `<tr><td style="padding:6px 12px 6px 0;color:#666;">Free slots remaining (per user)</td><td><strong>${pricing.freeSlotsRemaining}</strong></td></tr>`,
    )
  }
  htmlRows.push(
    `<tr><td style="padding:6px 12px 6px 0;color:#666;">Non-discounted total</td><td><strong>${formatMoney(pricing.nonDiscountedMonthly)}/mo</strong></td></tr>`,
  )
  if (pricing.discountMonthly > 0) {
    htmlRows.push(
      `<tr><td style="padding:6px 12px 6px 0;color:#666;">Discount</td><td><strong>-${formatMoney(pricing.discountMonthly)}/mo</strong></td></tr>`,
    )
  }
  htmlRows.push(
    `<tr><td style="padding:6px 12px 6px 0;color:#666;">Your total</td><td><strong>${formatMoney(pricing.discountedMonthly)}/mo</strong></td></tr>`,
  )

  return {
    text: lines.join('\n'),
    html: `<p style="margin-top:20px;"><strong>Monthly cost summary</strong></p><table style="margin:8px 0;border-collapse:collapse;">${htmlRows.join('')}</table>`,
  }
}
