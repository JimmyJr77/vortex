/** Ordinal skill level filtering for prescription. */

export const SKILL_LEVEL_ORDER = ['EARLY_STAGE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ELITE']

export function skillLevelRank(level) {
  if (!level) return null
  const idx = SKILL_LEVEL_ORDER.indexOf(String(level).toUpperCase())
  return idx >= 0 ? idx : null
}

export function allowedSkillLevelsFor(requestedLevel) {
  const rank = skillLevelRank(requestedLevel)
  if (rank == null) return null
  return new Set(SKILL_LEVEL_ORDER.slice(0, rank + 1))
}

export function exerciseSkillAllowed(exerciseSkillLevel, requestedLevel) {
  if (!requestedLevel || requestedLevel === 'N/A') return true
  const allowed = allowedSkillLevelsFor(requestedLevel)
  if (!allowed) return true
  if (exerciseSkillLevel == null) return true
  return allowed.has(String(exerciseSkillLevel).toUpperCase())
}

export function buildSkillLevelSql(level, paramIndex) {
  if (!level || level === 'N/A') return { clause: null, params: [] }
  const allowed = [...(allowedSkillLevelsFor(level) ?? [])]
  if (allowed.length === 0) return { clause: null, params: [] }
  return {
    clause: `(e.skill_level IS NULL OR e.skill_level = ANY($${paramIndex}::public.skill_level[]))`,
    params: [allowed],
  }
}
