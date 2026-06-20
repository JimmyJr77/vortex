type EligibilityRule = {
  field?: string
  operator?: string
  value?: unknown
}

export type SchoolLevelFilter = 'high' | 'middle' | 'elementary'

export const SCHOOL_LEVEL_OPTIONS: Array<{ value: SchoolLevelFilter; label: string }> = [
  { value: 'high', label: 'High school' },
  { value: 'middle', label: 'Middle school' },
  { value: 'elementary', label: 'Elementary school' },
]

export const ALL_SCHOOL_LEVELS: SchoolLevelFilter[] = ['high', 'middle', 'elementary']

const SCHOOL_LEVEL_SET = new Set<SchoolLevelFilter>(ALL_SCHOOL_LEVELS)

type EligibilityRecord = Record<string, unknown> & {
  eligibility_rules?: EligibilityRule[]
  rules?: EligibilityRule[]
}

function eligibilityRules(eligibility: EligibilityRecord | undefined): EligibilityRule[] {
  const rules = eligibility?.eligibility_rules ?? eligibility?.rules
  return Array.isArray(rules) ? rules : []
}

function withoutNamedSchoolRules(eligibility: EligibilityRecord): EligibilityRecord {
  const otherRules = eligibilityRules(eligibility).filter((r) => r.field !== 'school')
  const next: EligibilityRecord = { ...eligibility, eligibility_rules: otherRules }
  if (next.rules) {
    const legacyOther = eligibilityRules({ rules: next.rules }).filter((r) => r.field !== 'school')
    if (legacyOther.length > 0) next.rules = legacyOther
    else delete next.rules
  }
  return next
}

export function schoolNamesFromEligibility(eligibility: EligibilityRecord | undefined): string[] {
  const schoolRule = eligibilityRules(eligibility).find((r) => r.field === 'school')
  if (!schoolRule) return []
  const v = schoolRule.value
  if (Array.isArray(v)) return v.map(String).filter(Boolean)
  if (v != null && v !== '') return [String(v)]
  return []
}

export function appliesToAllSchools(eligibility: EligibilityRecord | undefined): boolean {
  return eligibility?.all_schools === true
}

export function schoolFilterEngaged(eligibility: EligibilityRecord | undefined): boolean {
  if (appliesToAllSchools(eligibility)) return true
  if (schoolLevelsFromEligibility(eligibility).length > 0) return true
  return schoolNamesFromEligibility(eligibility).length > 0
}

export function schoolLevelsFromEligibility(
  eligibility: EligibilityRecord | undefined,
): SchoolLevelFilter[] {
  const raw = eligibility?.school_levels
  if (!Array.isArray(raw)) return []
  return raw
    .map((v) => String(v).toLowerCase() as SchoolLevelFilter)
    .filter((v): v is SchoolLevelFilter => SCHOOL_LEVEL_SET.has(v))
}

export function mergeSchoolLevels(
  eligibility: EligibilityRecord | undefined,
  levels: SchoolLevelFilter[],
): EligibilityRecord {
  const base = { ...(eligibility ?? {}) }
  const unique = [...new Set(levels.filter((l) => SCHOOL_LEVEL_SET.has(l)))]
  const next = { ...base }
  if (unique.length > 0) next.school_levels = unique
  else delete next.school_levels

  if (next.all_schools === true) {
    const hasAllLevels = ALL_SCHOOL_LEVELS.every((level) => unique.includes(level))
    if (!hasAllLevels) delete next.all_schools
  }

  return next
}

export function mergeAppliesToAllSchools(
  eligibility: EligibilityRecord | undefined,
  allSchools: boolean,
): EligibilityRecord {
  const base = { ...(eligibility ?? {}) }
  if (allSchools) {
    return {
      ...withoutNamedSchoolRules(base),
      all_schools: true,
      school_levels: [...ALL_SCHOOL_LEVELS],
    }
  }
  const next = { ...base }
  delete next.all_schools
  return next
}

export function mergeSchoolEligibility(
  eligibility: EligibilityRecord | undefined,
  schoolNames: string[],
): EligibilityRecord {
  const base = { ...(eligibility ?? {}) }
  const otherRules = eligibilityRules(base).filter((r) => r.field !== 'school')
  const names = [...new Set(schoolNames.map((n) => n.trim()).filter(Boolean))]
  const next: EligibilityRecord = {
    ...base,
    eligibility_rules:
      names.length > 0
        ? [...otherRules, { field: 'school', operator: 'in', value: names }]
        : otherRules,
  }
  if (next.rules) {
    const legacyOther = (Array.isArray(next.rules) ? next.rules : []).filter((r) => r.field !== 'school')
    if (legacyOther.length > 0) next.rules = legacyOther
    else delete next.rules
  }
  if (names.length > 0) delete next.all_schools
  return next
}

function normalizeSchoolKey(name: string): string {
  return name.trim().toLowerCase()
}

export function maxRedemptionsPerSchoolFromConfig(
  config: Record<string, unknown> | undefined,
): Record<string, number> {
  const raw = config?.max_redemptions_per_school
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(value)
    if (name.trim() && Number.isFinite(n) && n > 0) {
      out[normalizeSchoolKey(name)] = Math.floor(n)
    }
  }
  return out
}

export function mergeMaxRedemptionForSchool(
  config: Record<string, unknown> | undefined,
  schoolName: string,
  max: number | null,
): Record<string, unknown> {
  const next = { ...(config ?? {}) }
  const limits = { ...maxRedemptionsPerSchoolFromConfig(next) }
  const key = normalizeSchoolKey(schoolName)
  if (max != null && max > 0) limits[key] = Math.floor(max)
  else delete limits[key]

  if (Object.keys(limits).length > 0) {
    next.max_redemptions_per_school = limits
  } else {
    delete next.max_redemptions_per_school
  }
  return next
}

export function schoolDisplayNameForLimitKey(
  key: string,
  schoolNames: string[],
): string {
  const found = schoolNames.find((n) => normalizeSchoolKey(n) === key)
  return found ?? key
}
