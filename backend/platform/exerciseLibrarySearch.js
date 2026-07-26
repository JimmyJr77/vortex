const LIFT_FAMILY_ALIASES = new Map([
  ['olympic lift', ['snatch', 'clean', 'jerk']],
  ['olympic lifts', ['snatch', 'clean', 'jerk']],
  ['olympic lifting', ['snatch', 'clean', 'jerk']],
  ['olympic weightlifting', ['snatch', 'clean', 'jerk']],
  ['weightlifting', ['snatch', 'clean', 'jerk']],
  ['power lift', ['squat', 'bench press', 'deadlift']],
  ['power lifts', ['squat', 'bench press', 'deadlift']],
  ['power lifting', ['squat', 'bench press', 'deadlift']],
  ['powerlifting', ['squat', 'bench press', 'deadlift']],
])

function normalizeLiftFamilyQuery(query) {
  return String(query ?? '')
    .trim()
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function exerciseLiftFamilyTerms(query) {
  return LIFT_FAMILY_ALIASES.get(normalizeLiftFamilyQuery(query)) ?? []
}
