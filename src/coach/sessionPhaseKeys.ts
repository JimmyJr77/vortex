/** Canonical session phase keys and legacy alias normalization. */

export const CANONICAL_PHASE_ORDER = [
  'prepare_and_access',
  'movement_intelligence',
  'output',
  'capacity',
  'resilience',
  'sustained_capacity',
  'restore',
] as const

export type CanonicalPhaseKey = (typeof CANONICAL_PHASE_ORDER)[number]

export const PHASE_DISPLAY_NAMES: Record<CanonicalPhaseKey, string> = {
  prepare_and_access: 'Prepare & Access',
  movement_intelligence: 'Movement Intelligence',
  output: 'Output',
  capacity: 'Capacity',
  resilience: 'Resilience',
  sustained_capacity: 'Sustained Capacity',
  restore: 'Restore',
}

const LEGACY_ALIASES: Record<string, CanonicalPhaseKey> = {
  prepare_access: 'prepare_and_access',
  skill_movement_intelligence: 'movement_intelligence',
  control_resilience: 'resilience',
  fitness_repeatability: 'sustained_capacity',
}

export function normalizePhaseKey(input?: string | null): CanonicalPhaseKey | null {
  if (!input?.trim()) return null
  const lower = input.trim().toLowerCase().replace(/\s+/g, '_') as CanonicalPhaseKey
  if ((CANONICAL_PHASE_ORDER as readonly string[]).includes(lower)) return lower
  return LEGACY_ALIASES[lower] ?? null
}

export function phaseDisplayName(key?: string | null): string {
  const normalized = normalizePhaseKey(key)
  if (!normalized) return key?.trim() ?? ''
  return PHASE_DISPLAY_NAMES[normalized]
}

/** Lookup keys for education rows (canonical + legacy aliases). */
export function phaseEducationLookupKeys(canonicalKey: CanonicalPhaseKey): string[] {
  const keys: string[] = [canonicalKey]
  for (const [legacy, mapped] of Object.entries(LEGACY_ALIASES)) {
    if (mapped === canonicalKey) keys.push(legacy)
  }
  return keys
}
