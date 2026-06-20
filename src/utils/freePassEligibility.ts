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

const SCHOOL_LEVEL_SET = new Set<SchoolLevelFilter>(['high', 'middle', 'elementary'])

type EligibilityRecord = Record<string, unknown> & {
  eligibility_rules?: EligibilityRule[]
  rules?: EligibilityRule[]
}

function eligibilityRules(eligibility: EligibilityRecord | undefined): EligibilityRule[] {
  const rules = eligibility?.eligibility_rules ?? eligibility?.rules
  return Array.isArray(rules) ? rules : []
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
  if (unique.length > 0) base.school_levels = unique
  else delete base.school_levels
  return base
}

export function mergeAppliesToAllSchools(
  eligibility: EligibilityRecord | undefined,
  allSchools: boolean,
): EligibilityRecord {
  const base = { ...(eligibility ?? {}) }
  if (allSchools) {
    base.all_schools = true
    return mergeSchoolEligibility(base, [])
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
  delete base.all_schools
  const eligibility_rules =
    names.length > 0
      ? [...otherRules, { field: 'school', operator: 'in', value: names }]
      : otherRules
  return { ...base, eligibility_rules }
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
