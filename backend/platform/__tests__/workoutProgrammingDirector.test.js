import assert from 'node:assert/strict'
import test from 'node:test'
import { directWorkoutProgramming } from '../workoutProgrammingDirector.js'
import { createProgrammingStaffRegistry } from '../programmingStaffRuntime.js'
import { coachRequest, staffPool, validDirector, validAthlete, directorDecision } from './workoutProgrammingStaffFixtures.js'
import { libraryCard, SCOPE, uuid } from './workoutProgrammingLibrarianFixtures.js'
import { memoryStorageDatabase } from './workoutProgrammingStorageFixtures.js'

const registry = (definitions = [validDirector, validAthlete]) => createProgrammingStaffRegistry(definitions)
const direct = (patch = {}) => directWorkoutProgramming({ pool: staffPool(), context: SCOPE, rawRequest: coachRequest(), registry: registry(), ...patch })

test('Director creates a frozen canonical intent with cohort advice, ordered clocks and deferred preparation', async () => {
  const pool = staffPool()
  const request = coachRequest({ logistics: { ...coachRequest().logistics, athleticMinutes: 90, tumblingMinutes: 30, totalBookedMinutes: 120 } })
  const result = await direct({ pool, rawRequest: request })
  assert.equal(result.status, 'INTENT_READY')
  assert.equal(result.decisionSource, 'vortex_director')
  assert.equal(result.componentPlan.allocatedSeconds, 7200)
  assert.deepEqual(result.componentPlan.components.map((entry) => entry.budgetSeconds), [900, 1800, 1800, 900, 1800])
  assert.deepEqual(result.proposal.components[0].preferredExerciseProfileIds, [])
  assert.equal(result.preparationStatus, 'DEFERRED_UNTIL_DOWNSTREAM_PRESCRIPTION')
  assert.equal(result.athleteAdvice.observations[0].cohortKey, 'youth')
  assert.equal(result.request.athletes[0].readiness, null)
  assert.equal(result.validatedWorkout, false)
  assert.equal(result.creatorAuthorized, false)
  assert.deepEqual(result.trace.calls.map((entry) => entry.role), ['athlete_development', 'director'])
  assert.equal(pool.calls.filter((call) => call.sql.startsWith('BEGIN')).length, 1)
  assert.equal(pool.calls.filter((call) => call.sql.includes('workout_library_release_v1')).length, 1)
  assert.throws(() => { result.request.logistics.coachCount = 100 }, TypeError)
  assert.throws(() => { result.componentPlan.components[0].budgetSeconds = 1 }, TypeError)
})

test('consultant is pluggable, candidate-grounded and subordinate to the Director', async () => {
  const sourceReferences = [{ id: 'public', title: 'Public methodology discussion', url: 'https://example.org/methodology' }]
  const consultant = { id: 'consultant/public-method', role: 'methodology_consultant', version: 'test-1', sourceReferences,
    async invoke(input) { assert.equal(input.athleteAdvice.observations[0].cohortKey, 'youth'); return { output: {
      summary: 'Use existing foundations and protect explosive quality.', watchPoints: [],
      recommendations: [{ componentKey: 'strength', programmingMethodId: '4', rationale: 'Existing method fits the strength intent.', sourceReferenceIds: ['public'] }],
    } } } }
  const director = { ...validDirector, async invoke(input) {
    assert.equal(input.consultantAdvice[0].advice.recommendations[0].programmingMethodId, '4')
    return { output: directorDecision(input) }
  } }
  const result = await direct({ rawRequest: coachRequest({ consultants: [consultant.id] }), registry: registry([director, validAthlete, consultant]) })
  assert.equal(result.status, 'INTENT_READY')
  assert.deepEqual(result.trace.calls.map((entry) => entry.role), ['athlete_development', 'methodology_consultant', 'director'])
  assert.deepEqual(result.consultantAdvice[0].sourceReferences, sourceReferences)
})

test('ineligible or stale coach locks stop model calls without creating a gap', async () => {
  const card = libraryCard('capacity', 4)
  for (const cardVersion of [card.cardVersion + 1, card.cardVersion]) {
    const ref = { exerciseCardId: card.id, variantId: card.variantId, deliveryProfileId: card.deliveryProfiles[0].id, cardVersion }
    const result = await direct({ rawRequest: coachRequest({ components: [{ key: 'strength', lockedExercises: [ref],
      ...(cardVersion === card.cardVersion ? { equipment: { allowed: [] } } : {}) }] }),
      ...(cardVersion === card.cardVersion ? { pool: staffPool({ cards: [{ ...card, media: { approvedVideoUrl: null } }] }) } : {}) })
    assert.equal(result.status, 'NEEDS_COACH_REVIEW')
    assert.ok(result.issues.some((issue) => issue.code === 'coach_lock_unavailable'))
    assert.equal(result.trace.calls.length, 0)
    assert.deepEqual(result.request.components[2].lockedExercises, [ref])
    assert.equal(result.creatorAuthorized, false)
  }
})

test('model cannot add authority, choose foreign IDs, alter clocks or prescribe preparation early', async () => {
  const mutations = [
    (proposal) => { proposal.overrideSafety = true },
    (proposal) => { proposal.requestRevision = 'stale' },
    (proposal) => { proposal.components[2].budgetSeconds = 999 },
    (proposal) => { proposal.components[2].preferredExerciseProfileIds = [uuid(999)] },
    (proposal) => { proposal.components[2].preferredProgrammingMethodIds = ['1'] },
    (proposal) => { proposal.components.reverse() },
    (proposal, input) => { proposal.components[0].preferredExerciseProfileIds = [input.resources[0].exercises.candidates[0].ref.deliveryProfileId] },
  ]
  for (const mutate of mutations) {
    const badDirector = { ...validDirector, async invoke(input) { const output = directorDecision(input); mutate(output, input); return { output } } }
    const result = await direct({ registry: registry([validAthlete, badDirector]) })
    assert.equal(result.status, 'NEEDS_COACH_REVIEW')
    assert.equal(result.decisionSource, 'deterministic_draft')
    assert.ok(result.issues.some((issue) => issue.code === 'invalid_output'))
    assert.deepEqual(result.componentPlan.components.map((entry) => entry.budgetSeconds), [600, 1500, 1200, 300])
  }
})

test('coach locks survive failed advice and coach-directed work is never silently filled', async () => {
  const ref = { exerciseCardId: uuid(4), variantId: uuid(104), deliveryProfileId: uuid(204), cardVersion: 1 }
  const request = coachRequest({ components: [{ key: 'strength', lockedExercises: [ref], lockedProgrammingMethodIds: ['4'], budgetSeconds: 900 }] })
  const badDirector = { ...validDirector, async invoke(input) { const output = directorDecision(input); output.components[2].preferredExerciseProfileIds = []; return { output } } }
  const result = await direct({ rawRequest: request, registry: registry([validAthlete, badDirector]) })
  assert.ok(result.issues.some((issue) => issue.code === 'invalid_output'))
  assert.deepEqual(result.proposal.components[2].preferredExerciseProfileIds, [ref.deliveryProfileId])
  assert.equal(result.componentPlan.components[2].budgetSeconds, 900)
  const directed = await direct({ rawRequest: coachRequest({ mode: 'coach_directed' }) })
  assert.equal(directed.status, 'NEEDS_COACH_REVIEW')
  assert.ok(directed.issues.some((issue) => issue.code === 'coach_direction_incomplete'))
  assert.deepEqual(directed.proposal.components[2].preferredExerciseProfileIds, [])
})

test('consultant role spoofing and invented source references cannot gain authority', async () => {
  const spoofed = await direct({ rawRequest: coachRequest({ consultants: ['vortex/director'] }) })
  assert.ok(spoofed.issues.some((issue) => issue.code === 'authority_violation'))
  assert.equal(spoofed.consultantAdvice.length, 0)
  const consultant = { id: 'consultant/invented-source', role: 'methodology_consultant', version: 'test', async invoke() { return { output: {
    summary: 'Advice', watchPoints: [], recommendations: [{ componentKey: 'strength', programmingMethodId: '4', rationale: 'Advice', sourceReferenceIds: ['invented'] }],
  } } } }
  const invalid = await direct({ rawRequest: coachRequest({ consultants: [consultant.id] }), registry: registry([validAthlete, validDirector, consultant]) })
  assert.equal(invalid.status, 'NEEDS_COACH_REVIEW')
  assert.equal(invalid.consultantAdvice.length, 0)
  assert.ok(invalid.issues.some((issue) => issue.capabilityId === consultant.id && issue.code === 'invalid_output'))
})

test('absent providers or releases remain reviewable drafts, with cancellation and modification explicit', async () => {
  const unavailable = await direct({ registry: registry([]) })
  assert.equal(unavailable.status, 'NEEDS_COACH_REVIEW')
  assert.equal(unavailable.decisionSource, 'deterministic_draft')
  assert.ok(unavailable.issues.some((issue) => issue.code === 'capability_unavailable'))
  const noRelease = await direct({ pool: staffPool({ noRelease: true }) })
  assert.equal(noRelease.trace.calls.length, 0)
  assert.ok(noRelease.resources.every((resource) => resource.exerciseGap === null))
  const controller = new AbortController()
  controller.abort()
  const pool = { async connect() { assert.fail('canceled request opened database') } }
  await assert.rejects(direct({ pool, runOptions: { signal: controller.signal } }), { code: 'canceled' })
  await assert.rejects(direct({ pool: memoryStorageDatabase(), rawRequest: coachRequest({ mode: 'modify_existing', instruction: 'Reduce contacts.', modification: { workoutId: uuid(90), expectedRevision: 'v1' } }) }),
    { code: 'source_workout_unavailable' })
})

test('omitted capacity and explicit reserve preserve booked time without adding work', async () => {
  const result = await direct({ rawRequest: coachRequest({ components: [
    { key: 'prepare_and_access', budgetSeconds: 600 }, { key: 'explosiveness', budgetSeconds: 1200 },
    { key: 'strength', budgetSeconds: 1200 }, { key: 'capacity_competition', budgetSeconds: 0 },
  ] }) })
  assert.equal(result.status, 'INTENT_READY')
  assert.equal(result.componentPlan.reserveSeconds, 600)
  assert.deepEqual(result.omittedComponentKeys, ['capacity_competition'])
  assert.equal(result.resources.length, 3)
})
