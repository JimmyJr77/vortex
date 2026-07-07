import type { SplitAlternate } from './types'

export function splitVariantsForItem(item: { per_split?: SplitAlternate[]; split_alternates_json?: SplitAlternate[] | null }) {
  return item.per_split ?? item.split_alternates_json ?? []
}

export function splitVariantLabel(variant: SplitAlternate) {
  if (variant.variant_type === 'progression') return 'Progression'
  if (variant.variant_type === 'substituted' || variant.substituted) return 'Substitute'
  if (variant.variant_type === 'scaled') return 'Scaled'
  if (variant.variant_type === 'missing') return 'Missing'
  return 'Same'
}

export function splitVariantTone(variant: SplitAlternate) {
  if (variant.variant_type === 'missing') return 'text-red-700 bg-red-50'
  if (variant.variant_type === 'progression') return 'text-emerald-700 bg-emerald-50'
  if (variant.variant_type === 'substituted' || variant.substituted) return 'text-purple-700 bg-purple-50'
  if (variant.variant_type === 'scaled') return 'text-indigo-700 bg-indigo-50'
  return 'text-gray-700 bg-gray-50'
}
