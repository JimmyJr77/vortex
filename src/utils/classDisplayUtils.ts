export function formatAgeRange(ageMin: number | null, ageMax: number | null): string {
  if (ageMin == null && ageMax == null) return 'Any age'
  return `${ageMin ?? 'Any'} – ${ageMax ?? 'Any'}`
}

/** Skill level enum values — order matches admin ClassEventModal skill level dropdown. */
export const CLASS_SKILL_LEVEL_CHOICES = [
  { value: 'EARLY_STAGE' as const, label: 'Early stage' },
  { value: 'BEGINNER' as const, label: 'Beginner' },
  { value: 'INTERMEDIATE' as const, label: 'Intermediate' },
  { value: 'ADVANCED' as const, label: 'Advanced' },
]

export type ClassSkillLevel = (typeof CLASS_SKILL_LEVEL_CHOICES)[number]['value']

/** Filter dropdown: first option clears filter; rest match admin edit-class labels. */
export const CLASS_SKILL_LEVEL_FILTER_OPTIONS = [
  { value: 'all' as const, label: 'None (all levels)' },
  ...CLASS_SKILL_LEVEL_CHOICES,
]

export type ClassSkillLevelFilter = (typeof CLASS_SKILL_LEVEL_FILTER_OPTIONS)[number]['value']

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
