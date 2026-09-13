import assert from 'node:assert/strict'
import test from 'node:test'
import { selectProgrammingMethodPrescription, resolveProgrammingMethodClock } from '../programmingMethodClock.js'
import { resolveCanonicalProgrammingDose } from '../canonicalProgrammingDose.js'
import { scheduleCanonicalExercise, validateWorkoutResourceSchedule } from '../workoutResourceScheduler.js'
import { executionRequest } from './workoutProgrammingExecutionFixtures.js'
import { fixedClockFixture, seedMethod } from './programmingMethodExecutionFixtures.js'
import { compositionFixtures, compositionRegistry } from './workoutProgrammingBuilderFixtures.js'
import { generateWorkoutProgramming } from '../workoutProgrammingWorkflow.js'
import { SCOPE } from './workoutProgrammingLibrarianFixtures.js'

test('canonical named audience profiles select the least-experienced cohort without inventing skill levels', () => {
  const method = seedMethod('simple-work-rest-intervals')
  for (const experience of ['beginner', 'intermediate', 'advanced']) {
    const base = executionRequest()
    const request = executionRequest({ athletes: base.athletes.map((entry) => ({ ...entry, trainingExperience: experience })) })
    const selection = selectProgrammingMethodPrescription(method, request)
    assert.equal(selection.profile.profile_name, experience)
    assert.equal(selection.audience.source, 'profile_name')
    const clock = resolveProgrammingMethodClock(method, selection)
    assert.equal(clock.targetSets, { beginner: 8, intermediate: 12, advanced: 16 }[experience])
    assert.equal(clock.domainSeconds, clock.targetSets * 60)
  }
  const mixed = executionRequest({ athletes: [{ key: 'younger', athleteCount: 7, ageMin: 9, ageMax: 11, trainingExperience: 'beginner' },
    { key: 'older', athleteCount: 8, ageMin: 15, ageMax: 17, trainingExperience: 'advanced' }] })
  assert.equal(selectProgrammingMethodPrescription(method, mixed).profile.profile_name, 'beginner')
  method.prescriptions[0].training_experience = 'advanced'
  assert.throws(() => selectProgrammingMethodPrescription(method, mixed), { code: 'method_audience_conflict' })
})

test('fixed source duration determines cycles and cannot be shortened to fit an exercise card or window', () => {
  const { activity, request } = fixedClockFixture()
  assert.equal(activity.dose.sets, 8)
  assert.equal(activity.dose.activeSecondsPerAthlete, 160)
  assert.deepEqual(activity.dose.rpe, [5, 6])
  assert.throws(() => resolveCanonicalProgrammingDose({ ...activity, request, proposal: { sets: 3 } }), { code: 'method_clock_set_mismatch' })
  activity.profile.dosage.setsMax = 3
  assert.throws(() => resolveCanonicalProgrammingDose({ ...activity, request }), { code: 'invalid_prescription_metadata' })
})

test('conflicting audience clocks, fractional cycles and non-minute EMOM metadata require review', () => {
  for (const [expected, mutate] of [
    ['method_clock_source_conflict', (method) => { method.work_rest_structure.default_prescription.intermediate.work_target_seconds = 30 }],
    ['method_clock_domain_conflict', (method) => { method.prescriptions[0].default_rounds = 5 }],
    ['method_clock_domain_conflict', (method) => { method.prescriptions[0].default_rest_seconds = 30; method.work_rest_structure.default_prescription.intermediate.rest_target_seconds = 30 }],
    ['method_minute_clock_conflict', (method) => { method.programming_type = 'emom'; method.prescriptions[0].default_rest_seconds = 30; method.work_rest_structure.default_prescription.intermediate.rest_target_seconds = 30 }],
    ['method_clock_recovery_conflict', (method) => { method.prescriptions[0].default_rest_between_rounds_seconds = 60 }],
  ]) {
    const { activity, request } = fixedClockFixture(); mutate(activity.method)
    assert.throws(() => resolveCanonicalProgrammingDose({ ...activity, request }), { code: expected })
  }
})

test('15 athletes and three lanes preserve 20/40 intervals through staggered batches, including full final recovery', () => {
  const { activity, request, component } = fixedClockFixture()
  const schedule = scheduleCanonicalExercise({ ...activity, request, component })
  assert.deepEqual([schedule.waveCount, schedule.wavesPerBatch, schedule.batchCount], [5, 3, 2])
  assert.equal(schedule.elapsedSeconds, 980)
  assert.equal(schedule.workSecondsPerAthlete, 160)
  const assignments = request.athletes.flatMap((cohort) => Array.from({ length: cohort.athleteCount }, (_, i) => `${cohort.key}:${i + 1}`))
  for (const athlete of assignments) {
    const events = schedule.events.filter((event) => event.athleteKeys.includes(athlete))
    assert.equal(events.length, 8)
    for (let index = 1; index < events.length; index++) assert.equal(events[index].startSeconds - events[index - 1].endSeconds, 40)
    assert.ok(schedule.recoveryCompleteSeconds >= events.at(-1).endSeconds + 40)
  }
  assert.equal(validateWorkoutResourceSchedule([{ schedule, dose: activity.dose }], request).status, 'PASS')
  assert.throws(() => scheduleCanonicalExercise({ ...activity, request, component: { ...component, budgetSeconds: 900 } }), { code: 'component_time_exceeded' })
})

test('EMOM uses minute-aligned cohort batches instead of staggered off-minute starts', () => {
  const { activity, request, component } = fixedClockFixture('emom')
  const schedule = scheduleCanonicalExercise({ ...activity, request, component: { ...component, budgetSeconds: 2500 } })
  assert.equal(schedule.wavesPerBatch, 1)
  assert.equal(schedule.batchCount, 5)
  assert.equal(schedule.elapsedSeconds, 2400)
  assert.ok(schedule.events.every((entry) => entry.startSeconds % 60 === 0))
  assert.equal(validateWorkoutResourceSchedule([{ schedule, dose: activity.dose }], request).status, 'PASS')
  assert.throws(() => scheduleCanonicalExercise({ ...activity, request, component }), { code: 'component_time_exceeded' })
})

test('fixed cadence cannot consume unbudgeted station reset time or silently stretch athlete recovery', () => {
  const { activity, request, component } = fixedClockFixture()
  activity.profile.timeModel.resetSeconds = 41
  assert.throws(() => scheduleCanonicalExercise({ ...activity, request, component }), { code: 'method_clock_resource_conflict' })
  activity.profile.timeModel.resetSeconds = 0
  const schedule = structuredClone(scheduleCanonicalExercise({ ...activity, request, component }))
  const event = schedule.events.find((entry) => entry.set === 2 && entry.wave === 1)
  event.startSeconds += 1; event.endSeconds += 1; event.resourceReleaseSeconds += 1
  assert.ok(validateWorkoutResourceSchedule([{ schedule, dose: activity.dose }], request).issues.some((entry) => entry.code === 'fixed_clock_cadence_mismatch'))
})

test('seeded style and named-clock inconsistencies remain visible rather than being rewritten', () => {
  const request = executionRequest()
  const emom = seedMethod('emom')
  assert.equal(resolveProgrammingMethodClock(emom, selectProgrammingMethodPrescription(emom, request)).intervalSeconds, 60)
  const tabata = seedMethod('tabata-style-interval')
  // Published intermediate preset: 12 minutes at 30/20. No integer cycle count can satisfy both.
  assert.throws(() => resolveProgrammingMethodClock(tabata, selectProgrammingMethodPrescription(tabata, request)), { code: 'method_clock_domain_conflict' })
  assert.equal(resolveProgrammingMethodClock(seedMethod('station-rotation-format'), selectProgrammingMethodPrescription(seedMethod('station-rotation-format'), request)).kind, 'unsupported')
})

test('the full workflow prescribes a published fixed clock and delivers evaluated source rules to the Critic', async () => {
  const fixtures = compositionFixtures()
  const capacity = fixtures.activities.find((entry) => entry.componentKey === 'capacity_competition')
  capacity.profile.dosage = { sets: 3, setsMin: 1, setsMax: 4, reps: null, workSeconds: 20, restSeconds: 40, contactsPerSet: 0 }
  capacity.profile.logistics.stationCapacity = 5
  capacity.profile.timeModel = { setupSeconds: 5, demonstrationSeconds: 10, transitionSeconds: 5, resetSeconds: 5, cleanupSeconds: 5 }
  capacity.method.programming_type = 'work_rest_interval'
  capacity.method.workout_builder_rules = { requires_timer: true, requires_stations: true, group_friendly: true, coaching_complexity: 'moderate' }
  capacity.method.work_rest_structure = { default_prescription: { intermediate: { minutes: 4, work_target_seconds: 20, rest_target_seconds: 40, rpe: '5-6' } } }
  const values = { profile_name: 'intermediate', training_experience: 'intermediate', default_total_minutes: 4,
    default_rounds: null, default_work_seconds: 20, default_rest_seconds: 40, default_rpe_min: 5, default_rpe_max: 6 }
  Object.assign(capacity.method.prescriptions[0], values)
  Object.assign(fixtures.options.prescriptions.find((entry) => entry.programming_method_id === capacity.method.id), values)
  fixtures.options.methodValidatorRules = [{ programming_method_id: capacity.method.id, rule_key: 'conditioning_before_output',
    condition_json: { block_before_phase: 'output' }, severity: 'strong_warning', message: 'Conditioning must follow quality output.' }]
  fixtures.options.methodQualityStandards = [{ programming_method_id: capacity.method.id, standard: 'Maintain posture and prescribed pace.', severity: 'required' }]
  const reviewer = { id: 'vortex/programming-critic', role: 'programming_critic', version: 'test-1', async invoke(input) {
    const rules = input.methodRules.find((entry) => entry.activityId.startsWith('capacity_competition'))
    assert.equal(rules.evaluations[0].status, 'NOT_TRIGGERED')
    assert.equal(rules.qualityStandards[0].standard, 'Maintain posture and prescribed pace.')
    return { output: { draftId: input.draftId, reviewHash: input.reviewHash, status: 'PASS', summary: 'The fixed-clock dose fits the complete session.', findings: [],
      assessments: input.reviewAreas.map((area) => ({ area, status: 'PASS', summary: 'Reviewed actual prescribed work and remaining load.' })) } }
  } }
  const { assumptions, ...rawRequest } = fixtures.request
  const result = await generateWorkoutProgramming({ pool: fixtures.pool(), context: SCOPE, registry: compositionRegistry([reviewer]),
    rawRequest: { ...rawRequest, logistics: { ...rawRequest.logistics, timerAvailable: true } } })
  assert.equal(result.status, 'QA_PASSED', JSON.stringify(result.qa.findings))
  const selected = result.draft.activities.find((entry) => entry.componentKey === 'capacity_competition')
  assert.equal(selected.dose.sets, 4)
  assert.equal(selected.dose.clock.domainSeconds, 240)
  assert.equal(result.draft.schedule.components.at(-1).activities[0].elapsedSeconds, 265)
  assert.equal(result.validatedWorkout, false)
})
