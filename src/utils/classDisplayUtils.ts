export function formatAgeRange(ageMin: number | null, ageMax: number | null): string {
  if (ageMin == null && ageMax == null) return 'Any age'
  return `${ageMin ?? 'Any'} – ${ageMax ?? 'Any'}`
}

export function formatSkillLevel(skillLevel: string | null): string {
  if (!skillLevel) return 'All levels'
  const words = skillLevel.replace(/_/g, ' ').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const SKILL_LEVEL_SORT_ORDER: Record<string, number> = {
  EARLY_STAGE: 0,
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
}

export function skillLevelSortOrder(skillLevel: string | null): number {
  if (skillLevel == null) return 4
  return SKILL_LEVEL_SORT_ORDER[skillLevel] ?? 4
}

export function compareSkillLevels(a: string | null, b: string | null): number {
  return skillLevelSortOrder(a) - skillLevelSortOrder(b)
}
