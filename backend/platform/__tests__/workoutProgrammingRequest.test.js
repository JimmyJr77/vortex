import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeCoachWorkoutRequest, allocateProgrammingComponentBudgets, canonicalIntentForProgrammingComponent, programmingValueHash } from '../workoutProgrammingRequest.js'
import { coachRequest } from './workoutProgrammingStaffFixtures.js'
import { uuid } from './workoutProgrammingLibrarianFixtures.js'
import { TAXONOMY_V2_FACETS } from '../taxonomyV2.js'

test('coach request preserves booked athletic and tumbling time with deterministic allocation', () => {
  for (const [athletic, tumbling, expected] of [[60, 0, [600, 1500, 1200, 300]], [90, 30, [900, 1800, 1800, 900, 1800]], [40, 20, [400, 1000, 800, 200, 1200]]]) {
    const input = coachRequest({ logistics: { ...coachRequest().logistics, athleticMinutes: athletic, tumblingMinutes: tumbling, totalBookedMinutes: athletic + tumbling } })
    const before = structuredClone(input)
    const request = normalizeCoachWorkoutRequest(input)
    assert.deepEqual(Object.values(allocateProgrammingComponentBudgets(request)), expected)
    assert.deepEqual(input, before)
    assert.throws(() => { request.athletes[0].ageMin = 18 }, TypeError)
    assert.equal(request.athletes[0].readiness, null)
    assert.equal(request.athletes[0].trainingAgeMonths, null)
    assert.equal(request.assumptions.length, 2)
  }
})

test('fixed budgets, omitted capacity and explicit reserve cannot be silently expanded', () => {
  const request = normalizeCoachWorkoutRequest(coachRequest({ components: [
    { key: 'prepare_and_access', budgetSeconds: 540 }, { key: 'explosiveness', budgetSeconds: 1200 },
    { key: 'strength', budgetSeconds: 1200 }, { key: 'capacity_competition', budgetSeconds: 0 },
  ] }))
  assert.deepEqual(allocateProgrammingComponentBudgets(request), { prepare_and_access: 540, explosiveness: 1200, strength: 1200, capacity_competition: 0 })
  const tiny = normalizeCoachWorkoutRequest(coachRequest({ components: [{ key: 'strength', budgetSeconds: 3597 }] }))
  assert.deepEqual(allocateProgrammingComponentBudgets(tiny), { strength: 3597, prepare_and_access: 1, explosiveness: 1, capacity_competition: 1 })
})

test('mixed cohorts use the youngest budget baseline and preserve unknown competency', () => {
  const request = normalizeCoachWorkoutRequest(coachRequest({ athletes: [
    { key: 'mixed', athleteCount: 10, ageMin: 9, ageMax: 18, trainingExperience: 'advanced', trainingAgeMonths: 36 },
    { key: 'new', athleteCount: 5, ageMin: 15, ageMax: 18, trainingExperience: 'beginner', limitations: ['low_impact'] },
  ] }))
  const intent = canonicalIntentForProgrammingComponent(request, 'explosiveness')
  assert.equal(intent.ageMin, 9)
  assert.equal(intent.ageMax, 18)
  assert.equal(intent.trainingExperience, 'beginner')
  assert.equal(intent.trainingAgeMonths, 0)
  assert.equal(intent.maxHighImpactContacts, 40)
  assert.equal(intent.fatigueBudgets.grip, 65)
  assert.deepEqual(intent.limitations, ['low_impact'])
})

test('all autonomy modes preserve controls; Modify Existing requires revision and instruction', () => {
  for (const mode of ['generate_for_me', 'guided', 'coach_directed']) assert.equal(normalizeCoachWorkoutRequest(coachRequest({ mode })).mode, mode)
  const modification = { workoutId: uuid(40), expectedRevision: 'saved-revision' }
  const request = normalizeCoachWorkoutRequest(coachRequest({ mode: 'modify_existing', modification, instruction: 'Reduce impact and preserve strength dose.',
    components: [{ key: 'strength', lockedBlocks: [{ blockId: 'strength-a', fields: ['dose'] }] }] }))
  assert.deepEqual(request.modification, { ...modification, regenerateComponentKeys: null, blockEdits: [] })
  for (const patch of [{ mode: 'modify_existing' }, { mode: 'modify_existing', modification }, { modification }]) {
    assert.throws(() => normalizeCoachWorkoutRequest(coachRequest(patch)))
  }
})

test('equipment preferences canonicalize, narrow and retain unknown physical counts', () => {
  const request = normalizeCoachWorkoutRequest(coachRequest({ equipment: { available: ['bodyweight', 'dumbbells'], preferred: ['dumbbells'] },
    components: [{ key: 'explosiveness', equipment: { allowed: [] } }] }))
  assert.deepEqual(request.equipment.available, ['none', 'dumbbell'])
  assert.deepEqual(request.equipment.preferred, ['dumbbell'])
  assert.equal(request.equipment.quantities.dumbbell, null)
  assert.deepEqual(request.components[1].equipment.allowed, [])
})

test('priorities retain required coverage while retrieval ranks without demanding every drill match', () => {
  const facet = 'tenet'
  const value = TAXONOMY_V2_FACETS[facet][0].key
  const request = normalizeCoachWorkoutRequest(coachRequest({ priorities: [{ facet, value, strength: 'required' }] }))
  assert.equal(request.priorities[0].strength, 'required')
  assert.equal(canonicalIntentForProgrammingComponent(request, 'strength').focuses[0].strength, 'strong_preference')
  assert.throws(() => normalizeCoachWorkoutRequest(coachRequest({ priorities: [{ facet, value: 'invented', strength: 'required' }] })), /unknown taxonomy/)
  assert.throws(() => normalizeCoachWorkoutRequest(coachRequest({ priorities: [{ facet, value, strength: 'exclude' }],
    components: [{ key: 'strength', priorities: [{ facet, value, strength: 'required' }] }] })), /contradicts/)
})

test('unknown fields and contradictory clocks, equipment or locks are rejected', () => {
  const ref = { exerciseCardId: uuid(1), variantId: uuid(101), deliveryProfileId: uuid(201), cardVersion: 1 }
  for (const patch of [
    { facilityId: '9' }, { ignoreSafety: true }, { athletes: [{ ...coachRequest().athletes[0], ageMin: 15 }] },
    { logistics: { ...coachRequest().logistics, tumblingMinutes: 30 } },
    { logistics: { ...coachRequest().logistics, athleticMinutes: '60' } },
    { components: [{ key: 'body_control' }] }, { components: [{ key: 'explosiveness', budgetSeconds: 0 }] },
    { components: [{ key: 'strength', budgetSeconds: 4000 }] },
    { components: [{ key: 'strength', equipment: { allowed: ['barbell'] } }] },
    { components: [{ key: 'capacity_competition', budgetSeconds: 0, lockedExercises: [ref] }] },
    { excludedExerciseCardIds: [uuid(1)], components: [{ key: 'strength', lockedExercises: [ref] }] },
    { preferredProgrammingMethodIds: ['2'], excludedProgrammingMethodIds: ['2'] },
    { components: [{ key: 'strength', lockedProgrammingMethodIds: ['9223372036854775808'] }] },
  ]) assert.throws(() => normalizeCoachWorkoutRequest(coachRequest(patch)))
})

test('request hash is independent of object key ordering and changes with coach truth', () => {
  const request = normalizeCoachWorkoutRequest(coachRequest())
  assert.equal(programmingValueHash(request), programmingValueHash(Object.fromEntries(Object.entries(request).reverse())))
  assert.notEqual(programmingValueHash(request), programmingValueHash(normalizeCoachWorkoutRequest(coachRequest({ instruction: 'Prioritize landings.' }))))
})
