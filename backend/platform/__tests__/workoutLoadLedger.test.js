import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateProgrammingLoadSequence } from '../workoutLoadLedger.js'
import { resolveCanonicalProgrammingDose } from '../canonicalProgrammingDose.js'
import { executionActivity, executionRequest } from './workoutProgrammingExecutionFixtures.js'

test('ledger charges actual athlete dose and carries earlier work into later remaining budgets', () => {
  const request = executionRequest()
  const output = executionActivity('explosiveness', 1)
  const strength = executionActivity('strength', 4)
  const capacity = executionActivity('capacity_competition', 5)
  const result = evaluateProgrammingLoadSequence({ request, activities: [output, strength, capacity] })
  assert.equal(result.status, 'PASS')
  assert.equal(result.entries[0].activeSecondsPerAthlete, 30)
  assert.deepEqual(result.entries[1].before, result.entries[0].after)
  assert.deepEqual(result.entries[2].before, result.entries[1].after)
  assert.equal(result.totals.highImpactContacts, 18)
  assert.ok(result.entries[2].remaining.stress.systemicFatigue < result.entries[0].remaining.stress.systemicFatigue)
  assert.equal(result.validatedWorkout, false)
})

test('longer bookings or tumbling time cannot dilute an identical athlete dose', () => {
  const request = executionRequest()
  const activity = executionActivity()
  const base = evaluateProgrammingLoadSequence({ request, activities: [activity] })
  const extended = executionRequest({ logistics: { ...request.logistics, athleticMinutes: 90, tumblingMinutes: 30, totalBookedMinutes: 120 } })
  assert.deepEqual(evaluateProgrammingLoadSequence({ request: extended, activities: [activity] }).totals, base.totals)
  const single = { ...activity, dose: resolveCanonicalProgrammingDose({ ...activity, request, proposal: { sets: 1 } }) }
  const reduced = evaluateProgrammingLoadSequence({ request, activities: [single] })
  assert.ok(reduced.totals.fatigue.localMuscle < base.totals.fatigue.localMuscle)
  assert.equal(reduced.totals.highImpactContacts, 6)
})

test('prior explosive contacts can force later capacity volume reduction within reviewed limits', () => {
  const request = executionRequest()
  const explosive = executionActivity('explosiveness', 1)
  const capacity = executionActivity('capacity_competition', 2)
  capacity.card.stressProfile.impactStress = 55
  capacity.profile.dosage.contactsPerSet = 12
  capacity.dose = resolveCanonicalProgrammingDose({ ...capacity, request })
  const overloaded = evaluateProgrammingLoadSequence({ request, activities: [explosive, capacity] })
  assert.equal(overloaded.status, 'REVISE')
  assert.ok(overloaded.issues.some((issue) => issue.code === 'high_impact_contact_cap' && issue.activityId === capacity.activityId))
  capacity.dose = resolveCanonicalProgrammingDose({ ...capacity, request, proposal: { sets: 1 } })
  assert.equal(evaluateProgrammingLoadSequence({ request, activities: [explosive, capacity] }).status, 'PASS')
})

test('full cumulative stress cannot be hidden by splitting a dose across activities', () => {
  const request = executionRequest()
  const activity = executionActivity('strength', 4)
  activity.profile.dosage = { sets: 3, setsMin: 1, setsMax: 3, reps: 6, workSeconds: 3600, restSeconds: 0, contactsPerSet: 0 }
  activity.method.prescriptions[0].default_work_seconds = 3600
  activity.method.prescriptions[0].default_rest_seconds = 0
  activity.dose = resolveCanonicalProgrammingDose({ ...activity, request })
  const result = evaluateProgrammingLoadSequence({ request, activities: [activity] })
  assert.ok(result.issues.some((issue) => issue.code === 'fatigue_budget_exceeded'))
  assert.ok(result.issues.some((issue) => issue.code === 'stress_budget_exceeded'))
  const splitDose = resolveCanonicalProgrammingDose({ ...activity, request, proposal: { sets: 1 } })
  const split = evaluateProgrammingLoadSequence({ request, activities: [1, 2, 3].map((index) => ({ ...activity, activityId: `split-${index}`, dose: splitDose })) })
  assert.deepEqual(split.totals, result.totals)
  assert.equal(split.status, 'REVISE')
})

test('body-control composition constraints use execution order instead of legacy phase indexes', () => {
  const base = executionRequest()
  const request = executionRequest({ logistics: { ...base.logistics, tumblingMinutes: 30, totalBookedMinutes: 90 } })
  const strength = executionActivity('strength', 4, request)
  const body = executionActivity('body_control', 6, request)
  body.card.compositionProfile.constraints = [{ type: 'avoid_after', targetType: 'family', targetKey: strength.card.familyId }]
  const result = evaluateProgrammingLoadSequence({ request, activities: [strength, body] })
  assert.ok(result.issues.some((issue) => issue.code === 'composition_conflict'))
  const reordered = evaluateProgrammingLoadSequence({ request, activities: [body, strength] })
  assert.ok(reordered.issues.some((issue) => issue.code === 'component_sequence'))
})

test('missing load data and forged cost summaries never produce PASS', () => {
  const request = executionRequest()
  const activity = executionActivity()
  delete activity.card.fatigueProfile.gripFatigue
  delete activity.card.loadProfile.gripDemand
  assert.ok(evaluateProgrammingLoadSequence({ request, activities: [activity] }).issues.some((issue) => issue.code === 'unknown_load_metadata'))
  const forged = { ...executionActivity(), dose: { ...executionActivity().dose, contacts: 0, highImpactContacts: 0, activeSecondsPerAthlete: 0 } }
  const result = evaluateProgrammingLoadSequence({ request, activities: [forged] })
  assert.ok(result.issues.some((issue) => issue.code === 'stale_or_modified_dose'))
  assert.equal(result.totals.highImpactContacts, 18)
  assert.equal(result.entries[0].activeSecondsPerAthlete, 30)
})
