import { normalizeProgramPricingOptions } from './programPricingOptions.js'

export const WEEKLY_TIER_KEYS = [
  'monthly_1x',
  'monthly_2x',
  'monthly_3x',
  'monthly_4x',
  'monthly_5x',
  'monthly_6x',
  'monthly_7x',
]

export function weeklyTierKeyForSlotCount(slotCount) {
  if (!Number.isInteger(slotCount) || slotCount < 1 || slotCount > 7) return null
  return `monthly_${slotCount}x`
}

function optionForKey(options, key) {
  return options.find((o) => o.key === key)
}

export function isWeeklyTierKey(key) {
  return WEEKLY_TIER_KEYS.includes(key)
}

export function isWeeklyTierEnabled(options, slotCount) {
  const key = weeklyTierKeyForSlotCount(slotCount)
  if (!key) return false
  const row = optionForKey(options, key)
  return Boolean(row?.enabled)
}

export function maxEnabledWeeklySlots(options) {
  for (let n = 7; n >= 1; n -= 1) {
    if (isWeeklyTierEnabled(options, n)) return n
  }
  return 0
}

export function programUsesWeeklyTierPricing(programRow) {
  if (!programRow) return false
  const options = normalizeProgramPricingOptions(programRow.pricing_cost_options)
  return options.some((o) => isWeeklyTierKey(o.key) && o.enabled && o.amountCents > 0)
}

function storedTierAmountCents(options, slotCount) {
  const key = weeklyTierKeyForSlotCount(slotCount)
  if (!key) return null
  const row = optionForKey(options, key)
  if (!row?.enabled || row.amountCents <= 0) return null
  return row.amountCents
}

function oneXCents(options) {
  return storedTierAmountCents(options, 1)
}

function twoXCents(options) {
  return storedTierAmountCents(options, 2)
}

/** Bundle monthly total for n active class slots (cents). */
export function weeklyTierTotalCents(slotCount, rawOptions) {
  if (slotCount <= 0) return 0
  const options = normalizeProgramPricingOptions(rawOptions)
  if (slotCount > maxEnabledWeeklySlots(options)) return null

  const stored = storedTierAmountCents(options, slotCount)
  if (stored != null) return stored

  const one = oneXCents(options)
  if (one == null) return null

  if (slotCount === 1) return one

  const two = twoXCents(options)
  if (slotCount === 2) {
    if (two != null) return two
    return 2 * one
  }

  if (two != null) {
    const delta = two - one
    return two + (slotCount - 2) * delta
  }

  return slotCount * one
}

export function weeklyTierTotalDollars(slotCount, rawOptions) {
  const cents = weeklyTierTotalCents(slotCount, rawOptions)
  if (cents == null) return null
  return cents / 100
}

/** Marginal monthly cost of the nth slot: tier(n) − tier(n−1). */
export function weeklyTierMarginalCents(slotCount, rawOptions) {
  if (slotCount < 1) return null
  const after = weeklyTierTotalCents(slotCount, rawOptions)
  const before = weeklyTierTotalCents(slotCount - 1, rawOptions)
  if (after == null || before == null) return null
  return Math.max(0, after - before)
}

export function weeklyTierForSlotCount(slotCount, rawOptions) {
  const key = weeklyTierKeyForSlotCount(slotCount)
  if (!key) return null
  const options = normalizeProgramPricingOptions(rawOptions)
  const stored = storedTierAmountCents(options, slotCount)
  const amountCents = weeklyTierTotalCents(slotCount, options)
  if (amountCents == null) return null
  return {
    key,
    slotCount,
    amountCents,
    extrapolated: stored == null,
  }
}

export function formatWeeklyTierLabel(slotCount, amountCents) {
  return `${slotCount}×/wk ($${(amountCents / 100).toFixed(2)}/mo)`
}

export function weeklyTierExceedsMaxMessage(maxSlots) {
  if (maxSlots <= 0) {
    return 'This program does not allow class enrollments with the current pricing setup.'
  }
  if (maxSlots === 1) {
    return 'This program allows only 1 class slot per member.'
  }
  return `This program allows up to ${maxSlots} class slots per member.`
}

/** Build per-slot marginal dollars for n slots (slot 1..n). */
export function weeklyTierMarginalCostsDollars(slotCount, rawOptions) {
  const costs = []
  for (let i = 1; i <= slotCount; i += 1) {
    const marginal = weeklyTierMarginalCents(i, rawOptions)
    if (marginal == null) return null
    costs.push(marginal / 100)
  }
  return costs
}
