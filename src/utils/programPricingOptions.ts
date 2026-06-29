export type ProgramPricingOptionKey =
  | 'per_class'
  | 'per_hour'
  | 'monthly_1x'
  | 'monthly_2x'
  | 'monthly_3x'
  | 'monthly_4x'
  | 'monthly_5x'
  | 'monthly_6x'
  | 'monthly_7x'
  | 'discount_off_2x'
  | 'discount_off_3x'
  | 'discount_off_4x'
  | 'discount_off_5x'
  | 'discount_off_6x'
  | 'discount_off_7x'
  | 'unlimited_unlimited_daily'
  | 'unlimited_1_daily'
  | 'unlimited_2_daily'
  | 'unlimited_3_daily'
  | 'per_offering'

export type OfferingPriceLabel = 'offering' | 'event'

export interface ProgramPricingOption {
  key: ProgramPricingOptionKey
  enabled: boolean
  amountCents: number
  offeringLabel?: OfferingPriceLabel
}

export type ProgramPricingOptionSection = 'single' | 'weekly' | 'weekly_discount' | 'unlimited' | 'other'

export interface ProgramPricingOptionDef {
  key: ProgramPricingOptionKey
  section: ProgramPricingOptionSection
  label: string
  /** When true, enabling this option creates class-scoped discount rules on save. */
  createsClassDiscounts?: boolean
  timesPerWeek?: number
}

export const PROGRAM_PRICING_SECTION_LABELS: Record<ProgramPricingOptionSection, string> = {
  single: 'Single classes',
  weekly: 'Classes per week',
  weekly_discount: 'Classes per week',
  unlimited: 'Unlimited classes',
  other: 'Other',
}

export const PROGRAM_PRICING_OPTION_DEFS: ProgramPricingOptionDef[] = [
  { key: 'per_class', section: 'single', label: '$ per class' },
  { key: 'per_hour', section: 'single', label: '$ per hour' },
  { key: 'monthly_1x', section: 'weekly', label: '$ for mo @ 1× per week', timesPerWeek: 1 },
  { key: 'monthly_2x', section: 'weekly', label: '$ for mo @ 2× per week', timesPerWeek: 2 },
  { key: 'monthly_3x', section: 'weekly', label: '$ for mo @ 3× per week', timesPerWeek: 3 },
  { key: 'monthly_4x', section: 'weekly', label: '$ for mo @ 4× per week', timesPerWeek: 4 },
  { key: 'monthly_5x', section: 'weekly', label: '$ for mo @ 5× per week', timesPerWeek: 5 },
  { key: 'monthly_6x', section: 'weekly', label: '$ for mo @ 6× per week', timesPerWeek: 6 },
  { key: 'monthly_7x', section: 'weekly', label: '$ for mo @ 7× per week', timesPerWeek: 7 },
  {
    key: 'discount_off_2x',
    section: 'weekly_discount',
    label: '$ off for 2× per week',
    createsClassDiscounts: true,
    timesPerWeek: 2,
  },
  {
    key: 'discount_off_3x',
    section: 'weekly_discount',
    label: '$ off for 3× per week',
    createsClassDiscounts: true,
    timesPerWeek: 3,
  },
  {
    key: 'discount_off_4x',
    section: 'weekly_discount',
    label: '$ off for 4× per week',
    createsClassDiscounts: true,
    timesPerWeek: 4,
  },
  {
    key: 'discount_off_5x',
    section: 'weekly_discount',
    label: '$ off for 5× per week',
    createsClassDiscounts: true,
    timesPerWeek: 5,
  },
  {
    key: 'discount_off_6x',
    section: 'weekly_discount',
    label: '$ off for 6× per week',
    createsClassDiscounts: true,
    timesPerWeek: 6,
  },
  {
    key: 'discount_off_7x',
    section: 'weekly_discount',
    label: '$ off for 7× per week',
    createsClassDiscounts: true,
    timesPerWeek: 7,
  },
  {
    key: 'unlimited_unlimited_daily',
    section: 'unlimited',
    label: '$ for unlimited days per week, unlimited times per day',
  },
  {
    key: 'unlimited_1_daily',
    section: 'unlimited',
    label: '$ for unlimited days per week, up to 1 class per day',
  },
  {
    key: 'unlimited_2_daily',
    section: 'unlimited',
    label: '$ for unlimited days per week, up to 2 classes per day',
  },
  {
    key: 'unlimited_3_daily',
    section: 'unlimited',
    label: '$ for unlimited days per week, up to 3 classes per day',
  },
  { key: 'per_offering', section: 'other', label: '$ per' },
]

const DEF_BY_KEY = new Map(PROGRAM_PRICING_OPTION_DEFS.map((d) => [d.key, d]))

export function defaultProgramPricingOptions(): ProgramPricingOption[] {
  return PROGRAM_PRICING_OPTION_DEFS.map((def) => ({
    key: def.key,
    enabled: false,
    amountCents: 0,
    ...(def.key === 'per_offering' ? { offeringLabel: 'offering' as OfferingPriceLabel } : {}),
  }))
}

export function normalizeProgramPricingOptions(raw: unknown): ProgramPricingOption[] {
  const defaults = defaultProgramPricingOptions()
  if (!Array.isArray(raw)) return defaults

  const byKey = new Map<string, ProgramPricingOption>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const key = String((item as ProgramPricingOption).key ?? '')
    if (!DEF_BY_KEY.has(key as ProgramPricingOptionKey)) continue
    byKey.set(key, {
      key: key as ProgramPricingOptionKey,
      enabled: Boolean((item as ProgramPricingOption).enabled),
      amountCents: Math.max(0, Math.round(Number((item as ProgramPricingOption).amountCents) || 0)),
      offeringLabel:
        key === 'per_offering'
          ? (item as ProgramPricingOption).offeringLabel === 'event'
            ? 'event'
            : 'offering'
          : undefined,
    })
  }

  return defaults.map((def) => byKey.get(def.key) ?? def)
}

export function formatProgramPricingOptionsSummary(options: ProgramPricingOption[]): string {
  const enabled = options.filter((o) => o.enabled && o.amountCents > 0)
  if (enabled.length === 0) return '—'

  const labels = enabled.slice(0, 3).map((opt) => {
    const def = DEF_BY_KEY.get(opt.key)!
    const amount = `$${(opt.amountCents / 100).toFixed(2)}`
    if (opt.key === 'per_offering') {
      return `${amount} per ${opt.offeringLabel ?? 'offering'}`
    }
    if (def.label.startsWith('$ ')) {
      return `${amount}${def.label.slice(1)}`
    }
    if (def.label.startsWith('$ off')) {
      return `${amount} off @ ${def.timesPerWeek}×/wk`
    }
    if (def.label.startsWith('$ for mo')) {
      return `${amount}/mo @ ${def.timesPerWeek}×/wk`
    }
    if (def.label.startsWith('$ for unlimited')) {
      return `${amount} — ${def.label.replace(/^\$\s*/, '')}`
    }
    return `${amount} ${def.label.replace(/^\$\s*/, '')}`
  })

  const suffix = enabled.length > 3 ? ` +${enabled.length - 3} more` : ''
  return `${labels.join(' · ')}${suffix}`
}

export function programPricingOptionsFromProgram(program: {
  pricingCostOptions?: unknown
  pricingSlotCostMonthlyCents?: number
  pricingCostUnit?: string
}): ProgramPricingOption[] {
  const normalized = normalizeProgramPricingOptions(program.pricingCostOptions)
  const hasEnabled = normalized.some((o) => o.enabled)
  if (hasEnabled) return normalized

  // Legacy single-cost programs: pre-check the closest matching option.
  const cents = program.pricingSlotCostMonthlyCents ?? 0
  const unit = program.pricingCostUnit ?? 'per_month'
  if (cents <= 0) return normalized

  const legacyKey: ProgramPricingOptionKey | null =
    unit === 'per_class'
      ? 'per_class'
      : unit === 'per_hour'
        ? 'per_hour'
        : unit === 'per_offering'
          ? 'per_offering'
          : unit === 'per_month'
            ? 'monthly_1x'
            : null

  if (!legacyKey) return normalized
  return normalized.map((o) =>
    o.key === legacyKey ? { ...o, enabled: true, amountCents: cents } : o,
  )
}
