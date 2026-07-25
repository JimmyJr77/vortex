export type PhaseFocusFacetType = 'tenet' | 'methodology' | 'physiology'

export const PHASE_FOCUS_KEYS: Readonly<Record<
  string,
  Readonly<Record<PhaseFocusFacetType, readonly string[]>>
>>

export function focusKeysForPhase(
  phaseKey: string,
  facetType: PhaseFocusFacetType,
): readonly string[]

export function isFocusKeyApplicable(
  phaseKey: string,
  facetType: PhaseFocusFacetType,
  focusKey: string,
): boolean
