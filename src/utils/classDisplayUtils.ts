export function formatAgeRange(ageMin: number | null, ageMax: number | null): string {
  if (ageMin == null && ageMax == null) return 'Any age'
  return `${ageMin ?? 'Any'} – ${ageMax ?? 'Any'}`
}

export function formatSkillLevel(skillLevel: string | null): string {
  if (!skillLevel) return 'All levels'
  const words = skillLevel.replace(/_/g, ' ').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
