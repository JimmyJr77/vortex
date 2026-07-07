function methodologyKey(target) {
  return String(target.facetKey ?? target.key ?? '').toLowerCase()
}

export function hasHiitFocus(resolvedPhaseTargets) {
  return resolvedPhaseTargets.some((t) => {
    const key = methodologyKey(t)
    return t.facetType === 'methodology' && (key.includes('hiit') || key.includes('conditioning'))
  })
}

export function minItemsForPhase(phaseKey, resolvedPhaseTargets) {
  if (phaseKey !== 'sustained_capacity') {
    if (phaseKey === 'prepare_and_access' || phaseKey === 'movement_intelligence') return 2
    return 1
  }
  return hasHiitFocus(resolvedPhaseTargets) ? 2 : 1
}

export function maxItemsForPhase(phaseKey, blockMinutes = 20, resolvedPhaseTargets = []) {
  const minutes = Number(blockMinutes) || 20
  if (phaseKey === 'restore') return 3
  if (phaseKey === 'prepare_and_access' || phaseKey === 'movement_intelligence') {
    return Math.min(6, Math.max(2, Math.ceil(minutes / 1.5)))
  }
  if (phaseKey === 'sustained_capacity') {
    if (hasHiitFocus(resolvedPhaseTargets)) {
      return Math.max(2, Math.ceil(minutes / 3))
    }
    if (minutes <= 8) return 2
  }
  return Math.max(1, Math.floor(minutes / 4))
}

export function phaseFillTarget(phaseKey, resolvedPhaseTargets, blockMinutes = 20) {
  if (phaseKey === 'restore') return 1
  if (phaseKey === 'sustained_capacity') return blockMinutes <= 8 ? 0.8 : 0.85
  if (phaseKey === 'prepare_and_access' || phaseKey === 'movement_intelligence') return 0.85
  if (phaseKey === 'output' || phaseKey === 'capacity' || phaseKey === 'resilience') return 0.9
  return 0.85
}

export function shouldRelaxSplitGate(phaseKey, blockMinutes, resolvedPhaseTargets) {
  return phaseKey === 'sustained_capacity'
    && blockMinutes <= 8
    && hasHiitFocus(resolvedPhaseTargets)
}

export function sustainedCapacityCandidateEligible(exercise, tags, methodologyKeyById, intentKeyById, { strictHiit = true } = {}) {
  if (exercise.primary_phase_key === 'sustained_capacity') return true
  if (exercise.phase_subrole === 'conditioning_intervals') return true

  if (!strictHiit) {
    for (const t of tags) {
      if (t.facetType === 'intent' && intentKeyById.get(Number(t.facetId)) === 'conditioning') return true
    }
    return false
  }

  for (const t of tags) {
    if (t.facetType === 'methodology') {
      const key = methodologyKeyById.get(Number(t.facetId))
      if (key === 'hiit') return true
    }
    if (t.facetType === 'intent' && intentKeyById.get(Number(t.facetId)) === 'conditioning') return true
  }
  return false
}

export function sustainedCapacityExcluded(phaseKey, exercise, tags, methodologyKeyById, intentKeyById, resolvedPhaseTargets) {
  if (phaseKey !== 'sustained_capacity') return false
  if (!hasHiitFocus(resolvedPhaseTargets)) return false
  return !sustainedCapacityCandidateEligible(exercise, tags, methodologyKeyById, intentKeyById, { strictHiit: true })
}
