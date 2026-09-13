import { approvedTaxonomyAssignments } from './canonicalExerciseSelection.js'
import { TAXONOMY_V2_FACETS } from './taxonomyV2.js'
import { normalizePhaseKey } from './sessionPhaseKeys.js'
import { immutableProgrammingValue } from './workoutProgrammingRequest.js'

export const PROGRAMMING_METHOD_RULES_VERSION = '1.0.0'
const conditionKeys = new Set(['cap_minutes', 'quality_standards_count_lt', 'block_before_phase', 'contains_advanced_skill',
  'estimated_work_seconds_gt', 'athlete_age_max', 'fatigue_level', 'requires_clear_runout', 'runout_present', 'decel_prerequisite_met'])
const workFields = new Set(['default_prescription', 'work_rest_options', 'typical_total_duration_minutes', 'recommended_density', 'pacing_notes'])
const builderFields = new Set(['preferred_session_phase', 'allowed_session_phases', 'default_duration_minutes', 'default_rounds',
  'default_work_seconds', 'default_rest_seconds', 'default_cap_minutes', 'default_rpe_range', 'recommended_age_min', 'recommended_age_max',
  'coaching_complexity', 'group_friendly', 'equipment_flexibility', 'requires_timer', 'requires_stations', 'requires_lanes',
  'requires_clear_runout', 'requires_score_tracking', 'safety_notes'])
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const numeric = (value) => (typeof value === 'number' || typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)) && Number.isFinite(Number(value)) ? Number(value) : null
const boundedNumber = (value, minimum, maximum) => numeric(value) != null && numeric(value) >= minimum && numeric(value) <= maximum

function compatibility(activity) {
  const method = activity.method
  const assignments = approvedTaxonomyAssignments(activity.card, activity.profile)
  const sourceRows = method.exercise_compat_rows ?? []
  const rows = []
  const issues = []
  if (!Array.isArray(sourceRows) || sourceRows.length > 200) return { issues: [{ code: 'invalid_compatibility_metadata', message: 'Method compatibility rows require a bounded array.' }], hasType: () => null }
  for (const row of sourceRows) {
    let matches = null
    if (!['compatible', 'avoid', 'conditional'].includes(row.compatibility_type)) issues.push({ code: 'invalid_compatibility_metadata', message: 'Unknown method compatibility role.' })
    const terms = TAXONOMY_V2_FACETS[row.facet_type]
    if (Array.isArray(terms) && terms.some((term) => term.key === row.facet_key)) {
      const facet = assignments.filter((entry) => entry.facetType === row.facet_type)
      if (facet.length) matches = facet.some((entry) => entry.key === row.facet_key)
    }
    rows.push({ row, matches })
    if (matches == null) issues.push({ code: 'programming_compatibility_mapping_required', message: 'Compatibility requires a reviewed facet/key mapping and applicable canonical classification.', exerciseType: row.exercise_type })
    if (matches === true && row.compatibility_type === 'avoid') issues.push({ code: 'incompatible_exercise_type', message: 'The canonical exercise matches this method’s avoid classification.', exerciseType: row.exercise_type })
    if (matches === true && (row.compatibility_type === 'conditional' || (row.constraints ?? []).length)) issues.push({ code: 'conditional_compatibility_requires_review', message: 'Matched conditional compatibility or prose constraints require source-backed evaluation.', exerciseType: row.exercise_type })
  }
  const legacy = method.exercise_compatibility ?? {}
  if (!object(legacy)) issues.push({ code: 'invalid_compatibility_metadata', message: 'Method compatibility metadata must be an object.' })
  for (const [field, values] of Object.entries(legacy)) {
    const role = { compatible_exercise_types: 'compatible', avoid_exercise_types: 'avoid', conditional_exercise_types: 'conditional' }[field]
    if (!role || !Array.isArray(values) || values.some((value) => typeof value !== 'string')) {
      issues.push({ code: 'invalid_compatibility_metadata', message: 'Unrecognized method compatibility structure.' }); continue
    }
    for (const value of values) if (!rows.some(({ row }) => row.exercise_type === value && row.compatibility_type === role)) {
      issues.push({ code: 'programming_compatibility_mapping_required', message: 'A legacy compatibility label has no corresponding reviewed method facet mapping.', exerciseType: value })
    }
  }
  if (rows.some(({ row }) => row.compatibility_type === 'compatible') && !rows.some(({ row, matches }) => row.compatibility_type === 'compatible' && matches === true)) {
    issues.push({ code: 'no_compatible_exercise_classification', message: 'No reviewed compatible classification matches the selected exercise.' })
  }
  return { issues, hasType(type) {
    const matches = rows.filter(({ row }) => row.exercise_type === type).map((entry) => entry.matches)
    if (!matches.length || matches.some((value) => value == null)) return null
    return matches.some(Boolean)
  } }
}

/** Existing condition objects are conjunctions; unknown predicates are never treated as false. */
export function evaluateProgrammingMethodCondition(condition, facts) {
  if (!object(condition) || Object.keys(condition).some((key) => !conditionKeys.has(key))) return { status: 'UNKNOWN', predicates: [] }
  const predicates = Object.entries(condition).map(([key, expected]) => {
    let met = null
    switch (key) {
      case 'cap_minutes': met = expected === null ? facts.capMinutes === undefined ? null : facts.capMinutes === null : boundedNumber(expected, 0, 240) && facts.capMinutes != null ? facts.capMinutes === Number(expected) : null; break
      case 'quality_standards_count_lt': met = Number.isSafeInteger(expected) && expected >= 0 && facts.qualityStandardsCount != null ? facts.qualityStandardsCount < expected : null; break
      case 'block_before_phase': met = normalizePhaseKey(expected) && Array.isArray(facts.laterPhaseKeys) ? facts.laterPhaseKeys.includes(normalizePhaseKey(expected)) : null; break
      case 'contains_advanced_skill': met = typeof expected === 'boolean' && typeof facts.containsAdvancedSkill === 'boolean' ? facts.containsAdvancedSkill === expected : null; break
      case 'estimated_work_seconds_gt': met = boundedNumber(expected, 0, 3600) && facts.workSeconds != null ? facts.workSeconds > Number(expected) : null; break
      case 'athlete_age_max': met = boundedNumber(expected, 5, 99) && facts.youngestAge != null ? facts.youngestAge <= Number(expected) : null; break
      case 'fatigue_level': met = ['low', 'moderate', 'high'].includes(expected) && ['low', 'moderate', 'high'].includes(facts.fatigueLevel) ? facts.fatigueLevel === expected : null; break
      case 'requires_clear_runout': met = typeof expected === 'boolean' && typeof facts.requiresClearRunout === 'boolean' ? facts.requiresClearRunout === expected : null; break
      case 'runout_present': met = typeof expected === 'boolean' && typeof facts.runoutPresent === 'boolean' ? facts.runoutPresent === expected : null; break
      case 'decel_prerequisite_met': met = typeof expected === 'boolean' && typeof facts.decelerationReady === 'boolean' ? facts.decelerationReady === expected : null; break
    }
    return { key, expected, met }
  })
  return { status: predicates.some((entry) => entry.met === false) ? 'NOT_TRIGGERED' : predicates.some((entry) => entry.met == null) ? 'UNKNOWN' : 'TRIGGERED', predicates }
}

/** Pure evaluation over freshly hydrated source records and the reconstructed execution order. */
export function evaluateProgrammingMethodRules({ activity, request, activities, schedule = null, readinessFacts = {} }) {
  const { method, profile, dose } = activity
  const findings = []
  const add = (code, message, evidence = {}, severity = 'error') => findings.push({ code, message, severity, ...evidence })
  const clock = dose.clock
  if (!clock || clock.kind === 'unsupported') add('unsupported_programming_clock', 'This method still requires its own clock/layout adapter.')
  const work = method.work_rest_structure ?? {}
  if (!object(work)) add('invalid_work_rest_metadata', 'Method work/rest metadata must be an object.')
  for (const key of Object.keys(work)) if (!workFields.has(key)) add('unsupported_work_rest_field', 'This work/rest field has no deterministic interpretation.', { field: key })
  for (const key of ['recommended_density', 'pacing_notes']) if (work[key] != null && typeof work[key] !== 'string') add('invalid_work_rest_metadata', 'Method coaching guidance must be text.', { field: key })
  if (work.work_rest_options != null && (!Array.isArray(work.work_rest_options) || work.work_rest_options.some((entry) => typeof entry !== 'string'))) add('invalid_work_rest_metadata', 'Method work/rest options require text entries.')
  if (work.typical_total_duration_minutes != null && (!Array.isArray(work.typical_total_duration_minutes)
    || work.typical_total_duration_minutes.some((entry) => !boundedNumber(entry, 1, 240)))) add('invalid_work_rest_metadata', 'Typical method durations must be positive minutes.')
  if (work.default_prescription != null && (!object(work.default_prescription) || Object.entries(work.default_prescription).some(([key, value]) =>
    !['beginner', 'intermediate', 'advanced', 'elite'].includes(key) || !object(value)
    || Object.keys(value).some((field) => !['minutes', 'rounds', 'work_target_seconds', 'rest_target_seconds', 'rpe'].includes(field))))) {
    add('unsupported_work_rest_field', 'Method audience defaults contain an unrecognized structure.')
  }
  const rules = method.workout_builder_rules ?? {}
  if (!object(rules)) add('invalid_builder_rule_metadata', 'Method builder rules must be an object.')
  for (const key of Object.keys(rules)) if (!builderFields.has(key)) add('programming_builder_rule_adapter_required', 'This builder rule has no deterministic interpretation.', { field: key })
  for (const key of ['group_friendly', 'requires_timer', 'requires_stations', 'requires_lanes', 'requires_clear_runout', 'requires_score_tracking']) {
    if (rules[key] != null && typeof rules[key] !== 'boolean') add('invalid_builder_rule_metadata', 'Operational requirements must be booleans.', { field: key })
  }
  for (const key of ['default_duration_minutes', 'default_rounds', 'default_work_seconds', 'default_rest_seconds', 'default_cap_minutes', 'recommended_age_min', 'recommended_age_max']) {
    if (rules[key] != null && !boundedNumber(rules[key], 0, 14400)) add('invalid_builder_rule_metadata', 'Method numeric guidance must be finite and nonnegative.', { field: key })
  }
  for (const key of ['coaching_complexity', 'equipment_flexibility']) if (rules[key] != null && typeof rules[key] !== 'string') add('invalid_builder_rule_metadata', 'Method coaching guidance must be text.', { field: key })
  if (rules.safety_notes != null && (!Array.isArray(rules.safety_notes) || rules.safety_notes.some((entry) => typeof entry !== 'string'))) add('invalid_builder_rule_metadata', 'Method safety notes require text entries.')
  if (rules.default_rpe_range != null && (!Array.isArray(rules.default_rpe_range) || rules.default_rpe_range.length !== 2
    || rules.default_rpe_range.some((entry) => !boundedNumber(entry, 1, 10)) || Number(rules.default_rpe_range[0]) > Number(rules.default_rpe_range[1]))) add('invalid_builder_rule_metadata', 'Default RPE guidance requires two ordered bounds.')
  if (rules.preferred_session_phase != null && !normalizePhaseKey(rules.preferred_session_phase)) add('invalid_builder_rule_metadata', 'The preferred method phase is unknown.')
  if (rules.allowed_session_phases != null && (!Array.isArray(rules.allowed_session_phases) || rules.allowed_session_phases.some((key) => !normalizePhaseKey(key)))) {
    add('invalid_builder_rule_metadata', 'Allowed method phases must identify existing delivery phases.')
  } else if (rules.allowed_session_phases?.length && !rules.allowed_session_phases.some((key) => normalizePhaseKey(key) === profile.phaseKey)) add('method_builder_phase_mismatch', 'The delivery phase is outside this method’s allowed phases.')
  if (rules.recommended_age_min != null && request.athletes.some((cohort) => cohort.ageMin < Number(rules.recommended_age_min))
    || rules.recommended_age_max != null && request.athletes.some((cohort) => cohort.ageMax > Number(rules.recommended_age_max))) add('method_age_guidance', 'The cohort falls outside the method’s published age guidance.')
  for (const [requirement, field] of [['requires_timer', 'timerAvailable'], ['requires_score_tracking', 'scoreTrackingAvailable'], ['requires_clear_runout', 'clearRunoutConfirmed']]) {
    if (rules[requirement] === true && request.logistics[field] !== true) add('method_operational_requirement', 'Confirm the operational resource required by this method.', { field, actual: request.logistics[field] })
  }
  if (rules.requires_lanes && (!request.logistics.laneCount || !schedule?.requiresLanes)) add('missing_runout_space', 'The method’s lanes must be present in the reconstructed schedule.')
  if (rules.requires_stations && (!request.logistics.stationCount || !schedule?.stationCount)) add('missing_method_stations', 'The method requires scheduled stations.')
  const compatibilityResult = compatibility(activity)
  compatibilityResult.issues.forEach((entry) => add(entry.code, entry.message, entry))
  const standards = method.quality_standards ?? []
  if (!Array.isArray(standards) || standards.some((entry) => typeof entry.standard !== 'string' || !entry.standard.trim())) add('invalid_method_quality_metadata', 'Method quality standards require source text.')
  const applicableStandards = Array.isArray(standards) ? standards.filter((entry) => !entry.appliesToExerciseType || compatibilityResult.hasType(entry.appliesToExerciseType) === true) : []
  if (Array.isArray(standards) && standards.some((entry) => entry.appliesToExerciseType && compatibilityResult.hasType(entry.appliesToExerciseType) == null)) add('unresolved_quality_scope', 'A scoped quality standard needs a reviewed exercise-type mapping.')
  const prescription = method.prescriptions.find((entry) => String(entry.id) === dose.methodPrescriptionId)
  const expectedRpe = clock?.rpeRange ?? null
  if (expectedRpe) {
    const selected = typeof dose.rpe === 'number' ? [dose.rpe, dose.rpe] : dose.rpe
    if (!Array.isArray(selected) || selected.length !== 2 || selected.some((value) => !boundedNumber(value, 1, 10))) add('unknown_method_intensity', 'The method requires a reviewed RPE target.')
    else if (Number(selected[0]) < expectedRpe[0] || Number(selected[1]) > expectedRpe[1] || Number(selected[0]) > Number(selected[1])) add('method_intensity_conflict', 'The exercise intensity is outside the selected method’s prescription.')
  }
  const index = activities.findIndex((entry) => entry.activityId === activity.activityId)
  const advancedTypes = ['advanced_skill', 'advanced_tumbling', 'tumbling', 'high_impact_plyometrics'].map(compatibilityResult.hasType)
  const cap = prescription?.default_cap_minutes ?? rules.default_cap_minutes ?? (clock?.domainSeconds == null ? null : clock.domainSeconds / 60)
  if (cap != null && !boundedNumber(cap, 0, 240)) add('invalid_method_time_cap', 'Method time caps require finite nonnegative minutes.')
  else if (cap != null && clock?.domainSeconds != null && clock.domainSeconds > Number(cap) * 60) add('method_clock_cap_exceeded', 'The prescribed clock exceeds the method’s time cap.')
  const facts = { capMinutes: cap == null ? null : numeric(cap), qualityStandardsCount: applicableStandards.length,
    laterPhaseKeys: index < 0 ? null : activities.slice(index + 1).map((entry) => entry.profile.phaseKey),
    containsAdvancedSkill: advancedTypes.some((value) => value === true) ? true : advancedTypes.some((value) => value == null) ? null : false,
    workSeconds: dose.workSeconds, youngestAge: Math.min(...request.athletes.map((cohort) => cohort.ageMin)), fatigueLevel: method.fatigue_profile?.fatigue_level ?? null,
    requiresClearRunout: rules.requires_clear_runout ?? false,
    runoutPresent: request.logistics.clearRunoutConfirmed == null ? null : request.logistics.clearRunoutConfirmed && request.logistics.laneCount > 0 && request.logistics.space.laneLengthFeet > 0,
    decelerationReady: typeof readinessFacts.decelerationReady === 'boolean' ? readinessFacts.decelerationReady : null,
  }
  const evaluations = []
  const validatorRules = method.validator_rules ?? []
  if (!Array.isArray(validatorRules) || validatorRules.length > 200) add('invalid_programming_rule_metadata', 'Method validator rules require a bounded array.')
  for (const rule of Array.isArray(validatorRules) ? validatorRules.slice(0, 200) : []) {
    const result = evaluateProgrammingMethodCondition(rule.conditionJson, facts)
    evaluations.push({ ruleKey: rule.ruleKey, severity: rule.severity, ...result })
    if (result.status === 'UNKNOWN') add('unresolved_programming_rule', 'A published method condition requires additional source evidence or a supported predicate.', { ruleKey: rule.ruleKey })
    else if (result.status === 'TRIGGERED') add(rule.ruleKey, rule.message, { recommendedAction: rule.recommendedAction ?? null, ruleKey: rule.ruleKey }, rule.severity ?? 'error')
  }
  return immutableProgrammingValue({ schemaVersion: PROGRAMMING_METHOD_RULES_VERSION, activityId: activity.activityId,
    status: findings.some((entry) => entry.severity !== 'info') ? 'REVISE' : 'PASS', findings, evaluations, facts,
    qualityStandards: applicableStandards, coachingGuidance: { groupFriendly: rules.group_friendly ?? null, complexity: rules.coaching_complexity ?? null,
      safetyNotes: rules.safety_notes ?? [], workRestOptions: work.work_rest_options ?? [], pacingNotes: work.pacing_notes ?? null } })
}
