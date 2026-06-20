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
