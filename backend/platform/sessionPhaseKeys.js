/** Canonical session phase keys and legacy alias normalization. */

export const CANONICAL_PHASE_ORDER = [
  'prepare_and_access',
  'movement_intelligence',
  'output',
  'capacity',
  'resilience',
  'sustained_capacity',
  'restore',
]

export const PHASE_DISPLAY_NAMES = {
  prepare_and_access: 'Prepare & Access',
  movement_intelligence: 'Movement Intelligence',
  output: 'Output',
  capacity: 'Capacity',
  resilience: 'Resilience',
  sustained_capacity: 'Sustained Capacity',
  restore: 'Restore',
}

const LEGACY_ALIASES = new Map([
  ['prepare_access', 'prepare_and_access'],
  ['prepare / access', 'prepare_and_access'],
  ['skill_movement_intelligence', 'movement_intelligence'],
  ['skill / movement intelligence', 'movement_intelligence'],
  ['control_resilience', 'resilience'],
  ['control / resilience', 'resilience'],
  ['fitness_repeatability', 'sustained_capacity'],
  ['fitness / repeatability', 'sustained_capacity'],
])

/** @param {string | null | undefined} input */
export function normalizePhaseKey(input) {
  if (!input || typeof input !== 'string') return null
  const trimmed = input.trim()
  const lower = trimmed.toLowerCase().replace(/\s+/g, '_')
  if (CANONICAL_PHASE_ORDER.includes(lower)) return lower
  return LEGACY_ALIASES.get(lower) ?? LEGACY_ALIASES.get(trimmed.toLowerCase()) ?? null
}

/** @param {string | null | undefined} key */
export function phaseDisplayName(key) {
  const normalized = normalizePhaseKey(key)
  if (!normalized) return key ? String(key) : ''
  return PHASE_DISPLAY_NAMES[normalized] ?? normalized.replace(/_/g, ' ')
}

/** @param {string} canonicalKey */
export function phaseEducationLookupKeys(canonicalKey) {
  const keys = [canonicalKey]
  for (const [legacy, mapped] of LEGACY_ALIASES.entries()) {
    if (mapped === canonicalKey) keys.push(legacy)
  }
  return keys
}

/** @param {Array<{ id: number, key: string, name: string, [key: string]: unknown }>} rows */
export function dedupeSessionPhases(rows) {
  const byCanonical = new Map()
  for (const row of rows ?? []) {
    const canonical = normalizePhaseKey(row.key)
    if (!canonical) continue
    const existing = byCanonical.get(canonical)
    if (!existing || row.key === canonical) {
      byCanonical.set(canonical, {
        ...row,
        key: canonical,
        name: phaseDisplayName(canonical),
      })
    }
  }
  return CANONICAL_PHASE_ORDER.map((key) => byCanonical.get(key)).filter(Boolean)
}
