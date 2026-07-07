/** Client-side age-band caps (mirrors backend/platform/ageDifficultyPolicy.js). */

export const AGE_BAND_POLICIES = [
  { ageMin: 4, ageMax: 5, maxOverall: 3, impliedSkillLevel: 'EARLY_STAGE' },
  { ageMin: 6, ageMax: 8, maxOverall: 5, impliedSkillLevel: 'BEGINNER' },
  { ageMin: 9, ageMax: 12, maxOverall: 6, impliedSkillLevel: 'BEGINNER' },
  { ageMin: 13, ageMax: 17, maxOverall: 7, impliedSkillLevel: 'INTERMEDIATE' },
  { ageMin: 18, ageMax: 120, maxOverall: 10, impliedSkillLevel: null },
] as const

export function resolveAgeBand(ageMin: number | null, ageMax: number | null) {
  const min = ageMin
  const max = ageMax
  if (min == null && max == null) return AGE_BAND_POLICIES[AGE_BAND_POLICIES.length - 1]
  const mid = min != null && max != null ? (min + max) / 2 : (min ?? max)!
  for (const band of AGE_BAND_POLICIES) {
    if (mid >= band.ageMin && mid <= band.ageMax) return band
  }
  if (mid < 4) return AGE_BAND_POLICIES[0]
  return AGE_BAND_POLICIES[AGE_BAND_POLICIES.length - 1]
}

export function standardDifficultyCap(ageMin: number | null, ageMax: number | null, override?: number | null) {
  if (override != null && Number.isFinite(override)) return override
  return resolveAgeBand(ageMin, ageMax).maxOverall
}
