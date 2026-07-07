/** Beginner appropriateness penalties and slug exclusions. */

export const BEGINNER_EXCLUDED_SLUG_PATTERNS = [
  /handstand/i,
  /muscle[- ]?up/i,
  /kipping/i,
  /ring[- ]?dip/i,
  /muscle[- ]?up/i,
  /planche/i,
  /front[- ]?lever/i,
  /back[- ]?lever/i,
]

export function isBeginnerExcludedSlug(slug, name = '') {
  const text = `${slug ?? ''} ${name ?? ''}`
  return BEGINNER_EXCLUDED_SLUG_PATTERNS.some((re) => re.test(text))
}

export function beginnerAppropriatenessPenalty(exercise, profile, requestedLevel, sportKey = null) {
  if (!requestedLevel || String(requestedLevel).toUpperCase() !== 'BEGINNER') return 0
  if (sportKey && /gymnastics/i.test(sportKey) && /handstand/i.test(`${exercise.slug ?? ''} ${exercise.name ?? ''}`)) {
    return 0
  }

  let penalty = 0
  if (isBeginnerExcludedSlug(exercise.slug, exercise.name)) penalty += 40

  const technical = Number(profile?.technicalComplexity ?? profile?.technical_complexity ?? 0)
  const attention = Number(profile?.attentionDemand ?? profile?.attention_demand ?? 0)
  if (technical >= 7) penalty += 12
  if (attention >= 7) penalty += 10

  return penalty
}
