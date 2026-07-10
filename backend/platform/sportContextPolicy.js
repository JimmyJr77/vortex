export const SPORT_SPECIFIC_PATTERNS = [
  /football/i,
  /receiver/i,
  /route/i,
  /thrower/i,
  /throw/i,
  /kick(?:ing|er)?/i,
  /baseball/i,
  /soccer/i,
  /quarterback/i,
  /scramble/i,
  /catch/i,
  /defender/i,
  /gridiron/i,
]

/** Narrow slug guard for C23-MOP-21 (subset of sport-specific patterns). */
export const FOOTBALL_BASEBALL_SLUG_RE = /football|baseball|quarterback|receiver/i

export function isSportSpecificExercise(exercise) {
  const slug = String(exercise?.slug ?? '')
  const name = String(exercise?.name ?? '')
  return SPORT_SPECIFIC_PATTERNS.some((re) => re.test(slug) || re.test(name))
}

export function matchesFootballBaseballSlug(exercise) {
  const slug = String(exercise?.slug ?? '')
  const name = String(exercise?.name ?? '')
  return FOOTBALL_BASEBALL_SLUG_RE.test(slug) || FOOTBALL_BASEBALL_SLUG_RE.test(name)
}

export function sportContextMultiplier(exercise, sportKey, sportIdByKey) {
  if (!sportKey) return 1

  const slug = String(exercise.slug ?? '')
  const name = String(exercise.name ?? '')
  const sportSpecific = SPORT_SPECIFIC_PATTERNS.some((re) => re.test(slug) || re.test(name))

  if (sportKey === 'fitness') {
    if (exercise.sport_id == null) return 1.08
    if (sportSpecific) return 0.35
    return 1
  }

  if (sportSpecific && sportIdByKey.has(sportKey)) {
    const sportRowId = sportIdByKey.get(sportKey)
    if (Number(exercise.sport_id) === Number(sportRowId)) return 1.15
    if (exercise.sport_id == null) return 1.02
    return 0.7
  }

  return 1
}
