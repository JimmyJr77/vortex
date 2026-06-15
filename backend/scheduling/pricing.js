export function computeMonthlyPricing(effectiveDbRow, totalActiveSlots, freeSlotsGranted = null) {
  const costCents = Number(effectiveDbRow?.slot_cost_monthly_cents ?? 0)
  const freePerUser = Number(effectiveDbRow?.free_slots_per_user ?? 0)
  const maxFreeTotal =
    effectiveDbRow?.max_free_slots_total != null
      ? Number(effectiveDbRow.max_free_slots_total)
      : null
  const total = Math.max(0, Number(totalActiveSlots) || 0)
  const costPerSlot = costCents / 100

  const perUserFree = Math.min(total, freePerUser)
  const granted =
    freeSlotsGranted != null ? Math.min(Math.max(0, freeSlotsGranted), total) : perUserFree
  const paidSlots = Math.max(0, total - granted)
  const perUserRemaining = Math.max(0, freePerUser - total)

  return {
    totalSlots: total,
    freeSlotsGranted: granted,
    freeSlotsRemaining: perUserRemaining,
    globalFreeSlotsCap: maxFreeTotal,
    costPerSlotMonthly: costPerSlot,
    nonDiscountedMonthly: total * costPerSlot,
    discountMonthly: granted * costPerSlot,
    discountedMonthly: paidSlots * costPerSlot,
    hasFreeSlots: freePerUser > 0 || (maxFreeTotal != null && maxFreeTotal > 0),
    hasPricing: costCents > 0,
  }
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
