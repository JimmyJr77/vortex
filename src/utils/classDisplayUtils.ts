export function formatAgeRange(ageMin: number | null, ageMax: number | null): string {
  if (ageMin == null && ageMax == null) return 'Any age'
  return `${ageMin ?? 'Any'} – ${ageMax ?? 'Any'}`
}

export function formatSkillLevel(skillLevel: string | null): string {
  if (!skillLevel) return 'All levels'
  return skillLevel.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
