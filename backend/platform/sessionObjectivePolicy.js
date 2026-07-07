/** Implicit phase focus hints from session objective when coach did not set explicit focus. */

export const OBJECTIVE_PHASE_HINTS = {
  explosiveness_power_priority: [
    { phaseKey: 'output', facetType: 'tenet', facetKey: 'explosiveness', weight: 4 },
    { phaseKey: 'capacity', facetType: 'tenet', facetKey: 'explosiveness', weight: 3 },
  ],
  speed_priority: [
    { phaseKey: 'output', facetType: 'tenet', facetKey: 'speed', weight: 4 },
  ],
  strength_priority: [
    { phaseKey: 'capacity', facetType: 'tenet', facetKey: 'strength', weight: 5 },
  ],
  agility_priority: [
    { phaseKey: 'movement_intelligence', facetType: 'tenet', facetKey: 'agility', weight: 4 },
    { phaseKey: 'output', facetType: 'tenet', facetKey: 'agility', weight: 3 },
  ],
  fitness_priority: [
    { phaseKey: 'sustained_capacity', facetType: 'methodology', facetKey: 'hiit', weight: 4 },
  ],
}

export function implicitPhaseFocusHints(sessionObjective, phaseKey, explicitFocusCount) {
  if (explicitFocusCount > 0) return []
  const hints = OBJECTIVE_PHASE_HINTS[sessionObjective] ?? []
  return hints.filter((h) => h.phaseKey === phaseKey)
}
