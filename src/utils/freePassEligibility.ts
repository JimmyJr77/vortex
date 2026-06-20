type EligibilityRule = {
  field?: string
  operator?: string
  value?: unknown
}

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

export function mergeSchoolEligibility(
  eligibility: EligibilityRecord | undefined,
  schoolNames: string[],
): EligibilityRecord {
  const base = { ...(eligibility ?? {}) }
  const otherRules = eligibilityRules(base).filter((r) => r.field !== 'school')
  const names = [...new Set(schoolNames.map((n) => n.trim()).filter(Boolean))]
  const eligibility_rules =
    names.length > 0
      ? [...otherRules, { field: 'school', operator: 'in', value: names }]
      : otherRules
  return { ...base, eligibility_rules }
}
