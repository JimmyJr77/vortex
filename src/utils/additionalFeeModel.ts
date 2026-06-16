import type { AdditionalFee, AdditionalFeeApplyBasis, AdditionalFeeTriggerType, DiscountScopeLevel } from './schedulingApi'

export const FEE_APPLY_BASIS_LABELS: Record<AdditionalFeeApplyBasis, string> = {
  per_order: 'Per order',
  per_slot: 'Per class slot',
  per_class: 'Per class',
  per_offering: 'Per class offering',
  per_month: 'Per month',
  per_year: 'Per year',
}

export const FEE_TRIGGER_LABELS: Record<AdditionalFeeTriggerType, string> = {
  each_enrollment: 'Each enrollment',
  new_member: 'New members only',
  once_per_year: 'Once per member per year',
}

export const FEE_TEMPLATES: Array<{
  id: string
  label: string
  defaults: Partial<{
    name: string
    applyBasis: AdditionalFeeApplyBasis
    applyInterval: number
    triggerType: AdditionalFeeTriggerType
  }>
}> = [
  {
    id: 'new_user',
    label: 'New user / registration',
    defaults: { name: 'New User Fee', applyBasis: 'per_order', triggerType: 'new_member' },
  },
  {
    id: 'annual',
    label: 'Annual fee',
    defaults: { name: 'Annual Fee', applyBasis: 'per_year', triggerType: 'once_per_year' },
  },
  {
    id: 'technology',
    label: 'Technology fee',
    defaults: { name: 'Technology Fee', applyBasis: 'per_month', applyInterval: 1, triggerType: 'each_enrollment' },
  },
  {
    id: 'administrative',
    label: 'Administrative fee',
    defaults: { name: 'Administrative Fee', applyBasis: 'per_slot', triggerType: 'each_enrollment' },
  },
]

export function describeFeeApplication(fee: Pick<AdditionalFee, 'amountCents' | 'applyBasis' | 'applyInterval'>): string {
  const amount = `$${(fee.amountCents / 100).toFixed(2)}`
  switch (fee.applyBasis) {
    case 'per_month':
      return fee.applyInterval > 1
        ? `${amount} every ${fee.applyInterval} months`
        : `${amount} per month`
    case 'per_year':
      return `${amount} per year`
    case 'per_order':
      return `${amount} per order`
    case 'per_slot':
      return `${amount} per slot enrolled`
    case 'per_class':
      return `${amount} per class`
    case 'per_offering':
      return `${amount} per offering`
    default:
      return amount
  }
}

export function describeFeeScope(
  fee: Pick<AdditionalFee, 'scopeLevel' | 'scopeRefId'>,
  labels: { sports: Map<number, string>; programs: Map<number, string>; classes: Map<number, string> },
): string {
  if (fee.scopeLevel === 'global') return 'All programs & classes'
  const ref = fee.scopeRefId
  if (ref == null) return '—'
  switch (fee.scopeLevel as DiscountScopeLevel) {
    case 'sport':
      return labels.sports.get(ref) ? `Sport: ${labels.sports.get(ref)}` : `Sport #${ref}`
    case 'program':
      return labels.programs.get(ref) ? `Program: ${labels.programs.get(ref)}` : `Program #${ref}`
    case 'class':
      return labels.classes.get(ref) ? `Class: ${labels.classes.get(ref)}` : `Class #${ref}`
    case 'offering':
      return `Offering #${ref}`
    default:
      return '—'
  }
}

export function describeFeeSummary(fee: AdditionalFee): string {
  const parts = [
    describeFeeApplication(fee),
    FEE_TRIGGER_LABELS[fee.triggerType].toLowerCase(),
  ]
  return parts.join(' · ')
}
