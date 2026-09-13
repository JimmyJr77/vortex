import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateProgrammingMethodCondition, evaluateProgrammingMethodRules } from '../programmingMethodRules.js'
import { scheduleCanonicalExercise } from '../workoutResourceScheduler.js'
import { fixedClockFixture, seedMethod } from './programmingMethodExecutionFixtures.js'
import { executionActivity } from './workoutProgrammingExecutionFixtures.js'
const codes = (result) => result.findings.map((entry) => entry.code)

test('existing method predicates use conjunctions and preserve unknown evidence', () => {
  const evaluate = evaluateProgrammingMethodCondition
  assert.equal(evaluate({ athlete_age_max: 12, fatigue_level: 'high' }, { youngestAge: 10, fatigueLevel: 'moderate' }).status, 'NOT_TRIGGERED')
  assert.equal(evaluate({ athlete_age_max: 12, fatigue_level: 'high' }, { youngestAge: 10, fatigueLevel: 'high' }).status, 'TRIGGERED')
  assert.equal(evaluate({ block_before_phase: 'output' }, { laterPhaseKeys: ['resilience'] }).status, 'NOT_TRIGGERED')
  assert.equal(evaluate({ block_before_phase: 'output' }, { laterPhaseKeys: ['output'] }).status, 'TRIGGERED')
  assert.equal(evaluate({ decel_prerequisite_met: false }, { decelerationReady: null }).status, 'UNKNOWN')
  assert.equal(evaluate({ cap_minutes: null }, {}).status, 'UNKNOWN')
  assert.equal(evaluate({ cap_minutes: null }, { capMinutes: null }).status, 'TRIGGERED')
  assert.equal(evaluate({ cap_minutes: null }, { capMinutes: 8 }).status, 'NOT_TRIGGERED')
  assert.equal(evaluate({ unknown_rule: true, fatigue_level: 'high' }, { fatigueLevel: 'low' }).status, 'UNKNOWN')
  assert.equal(evaluate({}, {}).status, 'TRIGGERED')
})

test('published conditions emit findings only when triggered or unresolved, retaining actual execution order', () => {
  const { activity, request, component } = fixedClockFixture()
  activity.method.validator_rules = [
    { ruleKey: 'before_output', conditionJson: { block_before_phase: 'output' }, severity: 'warning', message: 'Conditioning cannot precede quality output.' },
    { ruleKey: 'youth_fatigue', conditionJson: { athlete_age_max: 12, fatigue_level: 'high' }, severity: 'warning', message: 'Adjust youth fatigue.' },
  ]
  const schedule = scheduleCanonicalExercise({ ...activity, request, component })
  const later = executionActivity('explosiveness', 99, request)
  const pass = evaluateProgrammingMethodRules({ activity, request, activities: [later, activity], schedule })
  assert.equal(pass.status, 'PASS', JSON.stringify(pass.findings))
  assert.ok(pass.evaluations.every((entry) => entry.status === 'NOT_TRIGGERED'))
  const fail = evaluateProgrammingMethodRules({ activity, request, activities: [activity, later], schedule })
  assert.ok(codes(fail).includes('before_output'))
  activity.method.validator_rules.push({ ruleKey: 'decel', conditionJson: { decel_prerequisite_met: false }, severity: 'error', message: 'Need evidence.' })
  assert.ok(codes(evaluateProgrammingMethodRules({ activity, request, activities: [activity], schedule })).includes('unresolved_programming_rule'))
})

test('operational timer, score and runout requirements depend on explicit coach availability', () => {
  const { activity, request, component } = fixedClockFixture()
  const schedule = scheduleCanonicalExercise({ ...activity, request, component })
  activity.method.workout_builder_rules.requires_score_tracking = true
  const unknown = evaluateProgrammingMethodRules({ activity, request, activities: [activity], schedule })
  assert.ok(unknown.findings.some((entry) => entry.field === 'scoreTrackingAvailable'))
  const confirmed = { ...request, logistics: { ...request.logistics, scoreTrackingAvailable: true } }
  assert.equal(evaluateProgrammingMethodRules({ activity, request: confirmed, activities: [activity], schedule }).status, 'PASS')
})

test('compatibility uses reviewed canonical facet mappings and never guesses legacy label synonyms', () => {
  const { activity, request, component } = fixedClockFixture()
  const schedule = scheduleCanonicalExercise({ ...activity, request, component })
  activity.card.taxonomyV2 = { assignments: [{ facetType: 'training_family', key: 'running_locomotion', scope: 'variant', role: 'primary', reviewStatus: 'approved' }] }
  activity.method.exercise_compatibility = { compatible_exercise_types: ['locomotion'] }
  activity.method.exercise_compat_rows = [{ exercise_type: 'locomotion', compatibility_type: 'compatible', facet_type: null, facet_key: null, constraints: [] }]
  let result = evaluateProgrammingMethodRules({ activity, request, activities: [activity], schedule })
  assert.ok(codes(result).includes('programming_compatibility_mapping_required'))
  activity.method.exercise_compat_rows[0].facet_type = 'training_family'
  activity.method.exercise_compat_rows[0].facet_key = 'running_locomotion'
  result = evaluateProgrammingMethodRules({ activity, request, activities: [activity], schedule })
  assert.equal(result.status, 'PASS', JSON.stringify(result.findings))
  activity.method.exercise_compat_rows.push({ exercise_type: 'locomotion', compatibility_type: 'avoid', facet_type: 'training_family', facet_key: 'running_locomotion', constraints: [] })
  assert.ok(codes(evaluateProgrammingMethodRules({ activity, request, activities: [activity], schedule })).includes('incompatible_exercise_type'))
})

test('method intensity, allowed phases and unknown rule structures cannot silently pass', () => {
  const { activity, request, component } = fixedClockFixture()
  const schedule = scheduleCanonicalExercise({ ...activity, request, component })
  activity.method.workout_builder_rules.allowed_session_phases = ['output']
  activity.method.workout_builder_rules.unreviewed_extension = true
  activity.method.work_rest_structure.unreviewed_clock = 'invent a schedule'
  activity.dose = { ...activity.dose, rpe: [8, 9] }
  const findings = codes(evaluateProgrammingMethodRules({ activity, request, activities: [activity], schedule }))
  for (const code of ['method_builder_phase_mismatch', 'programming_builder_rule_adapter_required', 'unsupported_work_rest_field', 'method_intensity_conflict']) assert.ok(findings.includes(code))
})

test('seeded method labels without canonical compatibility mappings remain actionable source gaps', () => {
  const { activity, request } = fixedClockFixture()
  activity.method = seedMethod('simple-work-rest-intervals')
  const result = evaluateProgrammingMethodRules({ activity, request, activities: [activity] })
  assert.ok(codes(result).includes('programming_compatibility_mapping_required'))
  assert.equal(result.evaluations.find((entry) => entry.ruleKey.endsWith('before_output')).status, 'NOT_TRIGGERED')
  assert.equal(result.evaluations.find((entry) => entry.ruleKey.endsWith('youth_fatigue')).status, 'NOT_TRIGGERED')
})
