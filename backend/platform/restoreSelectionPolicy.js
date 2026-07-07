const EXCLUDED_METHODOLOGY_KEYS = new Set([
  'plyometrics',
  'hiit',
  'speed_agility',
  'neural_output',
])

const EXCLUDED_PRIMARY_PHASES = new Set(['output', 'sustained_capacity'])

const RESTORE_BOOST_SLOTS = new Set([
  'cooldown_breathing',
  'post_workout_flexibility',
  'breathing_downshift',
  '9090_breathing_hip_reset_kickers',
])

function tagKeys(tags, facetType, keyById) {
  return tags
    .filter((t) => t.facetType === facetType)
    .map((t) => keyById.get(Number(t.facetId)))
    .filter(Boolean)
}

export function restoreProfileEligible(exercise, restoreProfile) {
  if (!restoreProfile) return false
  if (restoreProfile.role === 'avoid') return false

  const primaryPhase = exercise.primary_phase_key
  if (primaryPhase === 'restore') return true
  if (restoreProfile.role === 'primary' || restoreProfile.role === 'secondary') return true
  return false
}

export function restoreCandidateExcluded(exercise, restoreProfile, tags, methodologyKeyById) {
  if (!restoreProfileEligible(exercise, restoreProfile)) return true

  const primaryPhase = exercise.primary_phase_key
  if (primaryPhase && EXCLUDED_PRIMARY_PHASES.has(primaryPhase)) return true

  for (const key of tagKeys(tags, 'methodology', methodologyKeyById)) {
    if (key === 'neural') {
      const impact = Number(restoreProfile.impactLevel ?? restoreProfile.impact_level ?? 99)
      const ceiling = String(restoreProfile.intensityCeiling ?? restoreProfile.intensity_ceiling ?? 'low').toLowerCase()
      const lowImpactRestore = impact < 2 && ceiling === 'low'
      const restorePrimary = exercise.primary_phase_key === 'restore'
        || restoreProfile.role === 'primary'
        || restoreProfile.role === 'secondary'
      if (lowImpactRestore && restorePrimary) continue
      return true
    }
    if (EXCLUDED_METHODOLOGY_KEYS.has(key)) return true
  }

  const slug = String(exercise.slug ?? '').toLowerCase()
  const name = String(exercise.name ?? '').toLowerCase()
  if (/(throw|toss|slam|jump|bound|hop|sprint|plyo|explosive)/.test(slug) || /(throw|toss|slam)/.test(name)) {
    if (primaryPhase !== 'restore') return true
  }

  const impact = Number(restoreProfile.impactLevel ?? restoreProfile.impact_level ?? 0)
  if (impact >= 2) return true

  const ceiling = String(restoreProfile.intensityCeiling ?? restoreProfile.intensity_ceiling ?? 'low').toLowerCase()
  if (ceiling && ceiling !== 'low') return true

  return false
}

export function restoreScoreBoost(exercise, restoreProfile, tags, methodologyKeyById) {
  let boost = 0
  const slot = restoreProfile.orderSlot ?? restoreProfile.order_slot ?? exercise.primary_order_slot
  if (slot && RESTORE_BOOST_SLOTS.has(slot)) boost += 10

  const fatigue = Number(restoreProfile.fatigueCost ?? restoreProfile.fatigue_cost ?? 99)
  if (fatigue <= 1) boost += 6
  else if (fatigue <= 2) boost += 3

  if (exercise.primary_phase_key === 'restore') boost += 8

  const methodologyKeys = tagKeys(tags, 'methodology', methodologyKeyById)
  if (exercise.primary_phase_key === 'restore' && methodologyKeys.includes('mobility_flexibility')) {
    boost += 4
  }

  return boost
}
