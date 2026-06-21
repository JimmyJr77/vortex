import type { DiscountRule, DiscountRuleTier } from './schedulingApi'

export const MULTI_CLASS_SYSTEM_KEY = 'multi_class'
/** @deprecated legacy key migrated on load */
export const LEGACY_MULTI_FAMILY_SYSTEM_KEY = 'multi_family'

export const MULTI_CLASS_DISCOUNT_TARGETS = ['lowest', 'highest', 'total'] as const
export type MultiClassDiscountTarget = (typeof MULTI_CLASS_DISCOUNT_TARGETS)[number]

export const MULTI_CLASS_TIER_MATCH_MODES = ['best_eligible', 'exact'] as const
export type MultiClassTierMatchMode = (typeof MULTI_CLASS_TIER_MATCH_MODES)[number]

export function isMultiClassSystemRule(
  rule: Pick<DiscountRule, 'type' | 'config'> | null | undefined,
): boolean {
  return (
    rule?.type === 'multi_class' &&
    (rule?.config?.system_key === MULTI_CLASS_SYSTEM_KEY ||
      rule?.config?.system_key === LEGACY_MULTI_FAMILY_SYSTEM_KEY)
  )
}

/** @deprecated use isMultiClassSystemRule */
export function isMultiFamilySystemRule(
  rule: Pick<DiscountRule, 'type' | 'config'> | null | undefined,
): boolean {
  return isMultiClassSystemRule(rule)
}

export function multiClassDiscountTarget(rule: Pick<DiscountRule, 'config'>): MultiClassDiscountTarget {
  const target = String(rule?.config?.discount_target ?? 'lowest').toLowerCase()
  return MULTI_CLASS_DISCOUNT_TARGETS.includes(target as MultiClassDiscountTarget)
    ? (target as MultiClassDiscountTarget)
    : 'lowest'
}

/** @deprecated */
export const multiFamilyDiscountTarget = multiClassDiscountTarget

export const MULTI_CLASS_TARGET_LABELS: Record<MultiClassDiscountTarget, string> = {
  lowest: 'Lowest class monthly fee',
  highest: 'Highest class monthly fee',
  total: 'Total monthly fees (all classes)',
}

/** @deprecated */
export const MULTI_FAMILY_TARGET_LABELS = MULTI_CLASS_TARGET_LABELS

export const MULTI_CLASS_TIER_MATCH_LABELS: Record<MultiClassTierMatchMode, string> = {
  best_eligible: 'Best eligible tier (downgrade allowed)',
  exact: 'Exact tier only (must match paid class count)',
}

export function defaultMultiClassTier(threshold: number): DiscountRuleTier {
  const defaults: Record<number, { minMonthlyCents: number; amountValue: number }> = {
    2: { minMonthlyCents: 19900, amountValue: 1000 },
    3: { minMonthlyCents: 29900, amountValue: 1500 },
    4: { minMonthlyCents: 49900, amountValue: 2000 },
    5: { minMonthlyCents: 59900, amountValue: 2500 },
  }
  const preset = defaults[threshold]
  return {
    threshold,
    amountType: 'percent',
    amountValue: preset?.amountValue ?? 1000,
    minMonthlyCents: preset?.minMonthlyCents ?? null,
    minPaidEnrollments: threshold,
    minPerClassCents: null,
    maxDiscountCents: null,
  }
}

/** @deprecated */
export const defaultMultiFamilyTier = defaultMultiClassTier

export function describeMultiClassTier(tier: DiscountRuleTier): string {
  const parts = [`${tier.threshold} classes → ${(tier.amountValue / 100).toFixed(0)}%`]
  if (tier.minMonthlyCents != null && tier.minMonthlyCents > 0) {
    parts.push(`≥ $${(tier.minMonthlyCents / 100).toFixed(0)}/mo`)
  }
  if (tier.minPaidEnrollments != null && tier.minPaidEnrollments > 0) {
    parts.push(`≥ ${tier.minPaidEnrollments} paid classes`)
  }
  return parts.join(', ')
}

/** @deprecated */
export const describeMultiFamilyTier = describeMultiClassTier

export const MONTHLY_SPEND_SYSTEM_KEY = 'monthly_spend'

export function isMonthlySpendSystemRule(
  rule: Pick<DiscountRule, 'type' | 'config'> & Partial<Pick<DiscountRule, 'exclusivityGroup'>> | null | undefined,
): boolean {
  if (rule?.type !== 'spend_volume') return false
  if (rule?.config?.system_key === MONTHLY_SPEND_SYSTEM_KEY) return true
  return rule?.exclusivityGroup === 'monthly_spend'
}

export function isAccountSystemRule(
  rule: Pick<DiscountRule, 'type' | 'config'> | null | undefined,
): boolean {
  return isMultiClassSystemRule(rule) || isMonthlySpendSystemRule(rule)
}

export function monthlySpendDiscountTarget(rule: Pick<DiscountRule, 'config'>): MultiClassDiscountTarget {
  const target = String(rule?.config?.discount_target ?? 'total').toLowerCase()
  return MULTI_CLASS_DISCOUNT_TARGETS.includes(target as MultiClassDiscountTarget)
    ? (target as MultiClassDiscountTarget)
    : 'total'
}

export function defaultMonthlySpendTier(thresholdCents: number): DiscountRuleTier {
  const preset: Record<number, number> = {
    19900: 500,
    29900: 1000,
    49900: 1500,
    59900: 2000,
    79900: 2500,
  }
  return {
    threshold: thresholdCents,
    amountType: 'percent',
    amountValue: preset[thresholdCents] ?? 500,
    minMonthlyCents: null,
    minPaidEnrollments: null,
    minPerClassCents: null,
    maxDiscountCents: null,
  }
}

export function nextMonthlySpendThreshold(existing: DiscountRuleTier[]): number {
  const ladder = [19900, 29900, 49900, 59900, 79900, 99900]
  const used = new Set(existing.map((t) => t.threshold))
  const next = ladder.find((t) => !used.has(t))
  if (next != null) return next
  const last = existing.at(-1)?.threshold ?? 9900
  return last + 10000
}

export function describeMonthlySpendTier(tier: DiscountRuleTier): string {
  const benefit =
    tier.amountType === 'percent'
      ? `${(tier.amountValue / 100).toFixed(tier.amountValue % 100 === 0 ? 0 : 1)}% off`
      : `$${(tier.amountValue / 100).toFixed(2)} off`
  const parts = [`≥ $${(tier.threshold / 100).toFixed(0)}/mo → ${benefit}`]
  if (tier.minPaidEnrollments != null && tier.minPaidEnrollments > 0) {
    parts.push(`≥ ${tier.minPaidEnrollments} paid classes`)
  }
  if (tier.minPerClassCents != null && tier.minPerClassCents > 0) {
    parts.push(`≥ $${(tier.minPerClassCents / 100).toFixed(0)}/class`)
  }
  return parts.join(', ')
}
