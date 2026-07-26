/** Ordinal audience/skill-library levels. Exercise cards use difficulty profiles. */

export const SKILL_LEVEL_ORDER = ['EARLY_STAGE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ELITE']

export function skillLevelRank(level) {
  if (!level) return null
  const idx = SKILL_LEVEL_ORDER.indexOf(String(level).toUpperCase())
  return idx >= 0 ? idx : null
}
