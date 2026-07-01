import {
  normalizeProgramPricingOptions,
  type ProgramPricingOption,
  type ProgramPricingOptionKey,
} from './programPricingOptions'

export const WEEKLY_TIER_KEYS = [
  'monthly_1x',
  'monthly_2x',
  'monthly_3x',
  'monthly_4x',
  'monthly_5x',
  'monthly_6x',
  'monthly_7x',
] as const satisfies readonly ProgramPricingOptionKey[]

export type WeeklyTierKey = (typeof WEEKLY_TIER_KEYS)[number]

export function weeklyTierKeyForSlotCount(slotCount: number): WeeklyTierKey | null {
  if (!Number.isInteger(slotCount) || slotCount < 1 || slotCount > 7) return null
  return `monthly_${slotCount}x` as WeeklyTierKey
}

function optionForKey(options: ProgramPricingOption[], key: string) {
  return options.find((o) => o.key === key)
}

export function isWeeklyTierKey(key: string): key is WeeklyTierKey {
  return (WEEKLY_TIER_KEYS as readonly string[]).includes(key)
}

export function isWeeklyTierEnabled(options: ProgramPricingOption[], slotCount: number): boolean {
  const key = weeklyTierKeyForSlotCount(slotCount)
  if (!key) return false
  const row = optionForKey(options, key)
  return Boolean(row?.enabled)
}

export function maxEnabledWeeklySlots(options: ProgramPricingOption[]): number {
  for (let n = 7; n >= 1; n -= 1) {
    if (isWeeklyTierEnabled(options, n)) return n
  }
  return 0
}

export function programUsesWeeklyTierPricing(program: {
  pricingCostOptions?: unknown
} | null | undefined): boolean {
  if (!program) return false
  const options = normalizeProgramPricingOptions(program.pricingCostOptions)
  return options.some((o) => isWeeklyTierKey(o.key) && o.enabled && o.amountCents > 0)
}

/** Stored enabled amount for tier n, or null. */
function storedTierAmountCents(options: ProgramPricingOption[], slotCount: number): number | null {
  const key = weeklyTierKeyForSlotCount(slotCount)
  if (!key) return null
  const row = optionForKey(options, key)
  if (!row?.enabled || row.amountCents <= 0) return null
  return row.amountCents
}

function oneXCents(options: ProgramPricingOption[]): number | null {
  return storedTierAmountCents(options, 1)
}

function twoXCents(options: ProgramPricingOption[]): number | null {
  return storedTierAmountCents(options, 2)
}

/**
 * Compute bundle monthly total for n active class slots (cents).
 * Uses saved tier amounts; extrapolates when a higher tier is enabled but amount not yet saved.
 */
export function weeklyTierTotalCents(
  slotCount: number,
  rawOptions: ProgramPricingOption[] | unknown,
): number | null {
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

export function weeklyTierTotalDollars(
  slotCount: number,
  rawOptions: ProgramPricingOption[] | unknown,
): number | null {
  const cents = weeklyTierTotalCents(slotCount, rawOptions)
  if (cents == null) return null
  return cents / 100
}

/** Marginal monthly cost of adding slot n (tier(n) − tier(n−1)). */
export function weeklyTierMarginalCents(
  slotCount: number,
  rawOptions: ProgramPricingOption[] | unknown,
): number | null {
  if (slotCount < 1) return null
  const after = weeklyTierTotalCents(slotCount, rawOptions)
  const before = weeklyTierTotalCents(slotCount - 1, rawOptions)
  if (after == null || before == null) return null
  return Math.max(0, after - before)
}

export interface WeeklyTierResolution {
  key: WeeklyTierKey
  slotCount: number
  amountCents: number
  extrapolated: boolean
}

export function weeklyTierForSlotCount(
  slotCount: number,
  rawOptions: ProgramPricingOption[] | unknown,
): WeeklyTierResolution | null {
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

export function formatWeeklyTierLabel(slotCount: number, amountCents: number): string {
  return `${slotCount}×/wk ($${(amountCents / 100).toFixed(2)}/mo)`
}

/**
 * Admin auto-fill for tier n.
 * manualKeys: tiers the admin edited directly — skip overwriting those amounts.
 */
export function extrapolateWeeklyTierCents(
  options: ProgramPricingOption[],
  slotCount: number,
  manualKeys: ReadonlySet<ProgramPricingOptionKey> = new Set(),
): number | null {
  if (slotCount < 1 || slotCount > 7) return null
  const key = weeklyTierKeyForSlotCount(slotCount)
  if (!key) return null

  if (manualKeys.has(key)) {
    return storedTierAmountCents(options, slotCount)
  }

  const one = oneXCents(options)
  if (one == null) return null

  if (slotCount === 1) return one

  const twoManual = manualKeys.has('monthly_2x')
  const two = twoManual ? twoXCents(options) : null

  if (slotCount === 2) {
    if (two != null) return two
    return 2 * one
  }

  const twoAmount = two ?? twoXCents(options)
  if (twoAmount != null && (twoManual || twoAmount !== 2 * one)) {
    const delta = twoAmount - one
    return twoAmount + (slotCount - 2) * delta
  }

  return slotCount * one
}

/** Apply auto-fill amounts to weekly tiers; preserve manualKeys. */
export function applyWeeklyTierAutoFill(
  options: ProgramPricingOption[],
  manualKeys: ReadonlySet<ProgramPricingOptionKey>,
): ProgramPricingOption[] {
  const one = optionForKey(options, 'monthly_1x')
  if (!one?.enabled || one.amountCents <= 0) return options

  return options.map((row) => {
    if (!isWeeklyTierKey(row.key) || row.key === 'monthly_1x') return row
    if (!row.enabled) return row
    const n = Number(row.key.replace('monthly_', '').replace('x', ''))
    const amount = extrapolateWeeklyTierCents(options, n, manualKeys)
    if (amount == null) return row
    return { ...row, amountCents: amount }
  })
}

/** Enable 2x–7x when 1x is enabled; disable all weekly when 1x off. */
export function syncWeeklyTierEnabledFlags(
  options: ProgramPricingOption[],
  oneXEnabled: boolean,
): ProgramPricingOption[] {
  return options.map((row) => {
    if (!isWeeklyTierKey(row.key)) return row
    if (row.key === 'monthly_1x') return row
    return { ...row, enabled: oneXEnabled }
  })
}

export function weeklyTierExceedsMaxMessage(maxSlots: number): string {
  if (maxSlots <= 0) {
    return 'This program does not allow class enrollments with the current pricing setup.'
  }
  if (maxSlots === 1) {
    return 'This program allows only 1 class slot per member.'
  }
  return `This program allows up to ${maxSlots} class slots per member.`
}
