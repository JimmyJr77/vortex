import assert from 'node:assert/strict'
import test from 'node:test'
import { searchWorkoutProgrammingResources, searchWorkoutProgrammingResourcesBatch } from '../workoutProgrammingLibrarians.js'
import { phaseCandidates } from '../canonicalExerciseSelection.js'
import { normalizeWorkoutIntent } from '../canonicalWorkoutContract.js'
import { withCoachingLibrarySnapshot } from '../coachingLibraryContext.js'
import { libraryCard, libraryPool, resourceRequest, SCOPE, uuid } from './workoutProgrammingLibrarianFixtures.js'

test('librarians share generation ranking, canonical references and deterministic request hashes', async () => {
  const cards = [libraryCard('capacity', 2), libraryCard('capacity', 1)]
  const raw = resourceRequest()
  const expected = phaseCandidates(cards, { phaseKey: 'capacity' }, normalizeWorkoutIntent(raw.intent), {}, { isAnchor: true })
  const first = await searchWorkoutProgrammingResources(libraryPool({ cards }), SCOPE, raw)
  const second = await searchWorkoutProgrammingResources(libraryPool({ cards: [...cards].reverse() }), SCOPE, raw)
  assert.deepEqual(first.exercises.candidates.map((c) => [c.ref.exerciseCardId, c.score, c.scoreComponents]), expected.map((c) => [c.card.id, c.score, c.components]))
  assert.deepEqual(first.exercises, second.exercises)
  assert.equal(first.requestHash, second.requestHash)
  assert.notEqual(first.searchAuditId, second.searchAuditId)
  assert.equal(first.libraryRelease.id, uuid(900))
  assert.equal(first.requestRevision, 'revision-1')
  assert.equal(first.creatorAuthorized, false)
  assert.equal(first.exerciseGap, null)
  assert.throws(() => { first.exercises.candidates[0].ref.cardVersion = 99 }, TypeError)
})

test('search considers a second usable delivery profile without changing legacy first-profile selection', async () => {
  const card = libraryCard()
  const original = structuredClone(card.deliveryProfiles[0])
  card.deliveryProfiles[0].equipmentRequired = ['barbell']
  card.deliveryProfiles.push({ ...original, id: uuid(999) })
  const legacy = phaseCandidates([card], { phaseKey: 'capacity' }, normalizeWorkoutIntent(resourceRequest().intent), {})
  assert.equal(legacy.length, 0)
  const result = await searchWorkoutProgrammingResources(libraryPool({ cards: [card] }), SCOPE, resourceRequest())
  assert.equal(result.exercises.candidates.length, 1)
  assert.equal(result.exercises.candidates[0].ref.deliveryProfileId, uuid(999))
  assert.equal(result.exercises.rejectionCounts['unavailable_equipment:barbell'], 1)
})

test('release membership is mandatory and absence of a release is not an ExerciseGap', async () => {
  const cards = [libraryCard('capacity', 1), libraryCard('capacity', 2)]
  const scoped = await searchWorkoutProgrammingResources(libraryPool({ cards, releaseIds: [cards[1].id] }), SCOPE, resourceRequest())
  assert.deepEqual(scoped.exercises.candidates.map((entry) => entry.ref.exerciseCardId), [cards[1].id])
  for (const options of [{ noRelease: true }, { releaseIds: [] }]) {
    const result = await searchWorkoutProgrammingResources(libraryPool(options), SCOPE, resourceRequest())
    assert.equal(result.exercises.status, 'LIBRARY_UNAVAILABLE')
    assert.equal(result.nextAction, 'review_library_release')
    assert.equal(result.creatorAuthorized, false)
    assert.equal(result.exerciseGap, null)
  }
})

test('publication and readiness filters remain hard gates and never become creation permission', async () => {
  const card = libraryCard()
  card.media.approvedVideoUrl = null
  const result = await searchWorkoutProgrammingResources(libraryPool({ cards: [card] }), SCOPE, resourceRequest())
  assert.equal(result.exercises.status, 'NO_ELIGIBLE_MATCH')
  assert.ok(Object.keys(result.exercises.rejectionCounts).some((key) => key.startsWith('publication_gate:')))
  assert.equal(result.creatorAuthorized, false)
  const young = await searchWorkoutProgrammingResources(libraryPool(), SCOPE, resourceRequest({ intent: { ...resourceRequest().intent, ageMin: 4, ageMax: 5 } })).catch((error) => error)
  assert.ok(young instanceof RangeError) // canonical request minimum age is 5
  const advanced = libraryCard()
  advanced.population.trainingAgeMonthsMin = 36
  const mismatch = await searchWorkoutProgrammingResources(libraryPool({ cards: [advanced] }), SCOPE, resourceRequest())
  assert.equal(mismatch.exercises.rejectionCounts.training_age, 1)
  assert.equal(mismatch.exerciseGap, null)
})

test('component equipment narrows the whole-session pool and exposes unresolved physical quantities', async () => {
  const card = libraryCard()
  card.deliveryProfiles[0].equipmentRequired = ['dumbbell']
  const intent = { ...resourceRequest().intent, equipmentAvailable: ['dumbbell'], equipmentRequired: ['dumbbell'] }
  const unknown = await searchWorkoutProgrammingResources(libraryPool({ cards: [card] }), SCOPE, resourceRequest({ intent }))
  assert.deepEqual(unknown.exercises.candidates[0].unknownQuantityKeys, ['dumbbell'])
  const excluded = await searchWorkoutProgrammingResources(libraryPool({ cards: [card] }), SCOPE, resourceRequest({ intent, equipment: { allowed: [] } }))
  assert.equal(excluded.exercises.status, 'NO_ELIGIBLE_MATCH')
  assert.equal(excluded.exercises.rejectionCounts['unavailable_equipment:dumbbell'], 1)
  assert.equal(excluded.nextAction, 'review_constraints_and_library_coverage')
  const noneInStock = await searchWorkoutProgrammingResources(libraryPool({ cards: [card] }), SCOPE, resourceRequest({ intent: { ...intent, equipmentQuantities: { dumbbell: 0 } } }))
  assert.equal(noneInStock.exercises.eligibleCount, 0)
})

test('downstream demand is hydrated using exact release-scoped UUIDs and current card versions', async () => {
  const downstream = libraryCard('output', 2)
  const prepare = libraryCard('prepare_and_access', 1)
  const ref = { exerciseCardId: downstream.id, variantId: downstream.variantId, deliveryProfileId: downstream.deliveryProfiles[0].id, cardVersion: 1 }
  const raw = resourceRequest({ componentKey: 'prepare_and_access', phaseKeys: ['prepare_and_access'], downstreamExercises: [ref] })
  const result = await searchWorkoutProgrammingResources(libraryPool({ cards: [prepare, downstream] }), SCOPE, raw)
  assert.ok(result.exercises.candidates[0].scoreComponents.anchorDemandAlignment > 50)
  for (const change of [{ cardVersion: 2 }, { variantId: uuid(987) }, { deliveryProfileId: uuid(987) }]) {
    await assert.rejects(searchWorkoutProgrammingResources(libraryPool({ cards: [prepare, downstream] }), SCOPE, { ...raw, downstreamExercises: [{ ...ref, ...change }] }), /unavailable.*stale version/)
  }
  await assert.rejects(searchWorkoutProgrammingResources(libraryPool(), SCOPE, { ...raw, downstreamExercises: [{ ...ref, exerciseCardId: '1' }] }), /canonical UUID/)
})

test('programming librarian filters avoided phases and exclusions, honors IDs, and ranks all pages', async () => {
  const methods = Array.from({ length: 501 }, (_, index) => ({
    id: String(index + 1), name: `Method ${index + 1}`, best_session_phase: 'capacity',
    fatigue_profile: {}, workout_builder_rules: {},
  }))
  methods[1].incompatible_phases = ['capacity']
  const profiles = [
    { programming_method_id: '501', phase_key: 'capacity', role: 'primary', fit_weight: 5 },
    { programming_method_id: '3', phase_key: 'capacity', role: 'avoid', fit_weight: 5 },
  ]
  const result = await searchWorkoutProgrammingResources(libraryPool({ methods, profiles }), SCOPE, resourceRequest({
    preferredProgrammingMethodIds: ['501', '9999'], excludedProgrammingMethodIds: ['4'],
  }))
  assert.equal(result.programming.searchedMethodCount, 501)
  assert.equal(result.programming.searchComplete, true)
  assert.equal(result.programming.candidates[0].programmingMethodId, '501')
  assert.deepEqual(result.programming.candidates[0].scoreComponents, { existingBlockScore: 20, coachPreference: 20 })
  assert.ok(result.programming.rejections.some((entry) => entry.programmingMethodId === '2'))
  assert.ok(result.programming.rejections.some((entry) => entry.programmingMethodId === '3'))
  assert.ok(result.programming.rejections.some((entry) => entry.programmingMethodId === '4'))
  assert.deepEqual(result.programming.missingPreferredMethodIds, ['9999'])
})

test('bounded search reports incomplete programming coverage instead of claiming a content gap', async () => {
  const methods = Array.from({ length: 5001 }, (_, index) => ({ id: String(index + 1), name: `Method ${index}`, best_session_phase: 'capacity' }))
  const result = await searchWorkoutProgrammingResources(libraryPool({ methods }), SCOPE, resourceRequest())
  assert.equal(result.programming.searchedMethodCount, 5000)
  assert.equal(result.programming.searchComplete, false)
  assert.equal(result.nextAction, 'complete_programming_search')
  assert.equal(result.creatorAuthorized, false)
})

test('an empty programming pool requests coverage review instead of inventing a method', async () => {
  const result = await searchWorkoutProgrammingResources(libraryPool(), SCOPE, resourceRequest())
  assert.equal(result.programming.status, 'NO_ELIGIBLE_MATCH')
  assert.equal(result.nextAction, 'review_programming_coverage')
  assert.equal(result.creatorAuthorized, false)
})

test('malformed searches and caller-supplied authority are rejected before opening a connection', async () => {
  for (const patch of [
    { componentKey: 'capacity' }, { phaseKeys: ['strength'] }, { phaseKeys: ['capacity', 'capacity'] },
    { requestRevision: '' }, { facilityId: '10' }, { creatorAuthorized: true }, { limit: 101 },
    { equipment: { allowed: ['barbell'] } }, { downstreamExercises: null },
    { intent: { ...resourceRequest().intent, coachCount: null } },
    { preferredProgrammingMethodIds: ['1'], excludedProgrammingMethodIds: ['1'] },
  ]) {
    const pool = { async connect() { assert.fail('invalid request reached database') } }
    await assert.rejects(searchWorkoutProgrammingResources(pool, SCOPE, resourceRequest(patch)))
  }
})

test('snapshot rolls back and releases on query failure without turning it into an empty search', async () => {
  const pool = libraryPool({ failQuery: 'workout_library_release_v1' })
  await assert.rejects(searchWorkoutProgrammingResources(pool, SCOPE, resourceRequest()), /database unavailable/)
  assert.deepEqual(pool.calls.map((call) => call.sql).slice(-2), ['ROLLBACK', 'RELEASE'])
  assert.equal(pool.calls[0].sql, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  const rollbackFailure = new Error('broken connection')
  const broken = libraryPool({ failQuery: 'workout_library_release_v1', rollbackFailure })
  await assert.rejects(searchWorkoutProgrammingResources(broken, SCOPE, resourceRequest()), /database unavailable/)
  assert.equal(broken.calls.at(-1).error, rollbackFailure)
  const success = libraryPool()
  await withCoachingLibrarySnapshot(success, SCOPE, async () => 'done')
  assert.deepEqual(success.calls.map((call) => call.sql), ['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY', 'COMMIT', 'RELEASE'])
})

test('eligible coach pins survive ranking limits while stale and excluded pins remain unavailable', async () => {
  const cards = [libraryCard('capacity', 1), libraryCard('capacity', 2)]
  const ref = { exerciseCardId: cards[1].id, variantId: cards[1].variantId, deliveryProfileId: cards[1].deliveryProfiles[0].id, cardVersion: 1 }
  const methods = [{ id: '1', name: 'Preferred', best_session_phase: 'capacity' }, { id: '2', name: 'Pinned', best_session_phase: 'capacity' }]
  const raw = resourceRequest({ limit: 1, preferredProgrammingMethodIds: ['1'], pinnedProgrammingMethodIds: ['2'], pinnedExercises: [ref] })
  const result = await searchWorkoutProgrammingResources(libraryPool({ cards, methods }), SCOPE, raw)
  assert.ok(result.exercises.candidates.some((entry) => entry.ref.deliveryProfileId === ref.deliveryProfileId))
  assert.deepEqual(result.exercises.unavailablePinnedExercises, [])
  assert.equal(result.programming.candidates.length, 2)
  assert.deepEqual(result.programming.unavailablePinnedProgrammingMethodIds, [])
  const unavailable = await searchWorkoutProgrammingResources(libraryPool({ cards, methods }), SCOPE,
    { ...raw, pinnedExercises: [{ ...ref, cardVersion: 2 }], excludedProgrammingMethodIds: ['2'] })
  assert.equal(unavailable.exercises.unavailablePinnedExercises[0].cardVersion, 2)
  assert.deepEqual(unavailable.programming.unavailablePinnedProgrammingMethodIds, ['2'])
})

test('exact profile and component equipment preferences affect ranking without changing eligibility', async () => {
  const card = libraryCard('capacity', 1)
  card.deliveryProfiles.push({ ...card.deliveryProfiles[0], id: uuid(998) })
  const ref = { exerciseCardId: card.id, variantId: card.variantId, deliveryProfileId: uuid(998), cardVersion: 1 }
  const preferred = await searchWorkoutProgrammingResources(libraryPool({ cards: [card] }), SCOPE, resourceRequest({ preferredExercises: [ref] }))
  assert.equal(preferred.exercises.candidates[0].ref.deliveryProfileId, uuid(998))
  assert.equal(preferred.exercises.candidates[0].scoreComponents.coachExactReference, 20)
  const equipped = libraryCard('capacity', 2)
  equipped.equipmentRoles = [{ key: 'dumbbell', role: 'required', quantityPerStation: 1 }]
  equipped.equipment.required = ['dumbbell']
  const pool = () => libraryPool({ cards: [equipped] })
  const raw = resourceRequest({ intent: { ...resourceRequest().intent, equipmentAvailable: ['dumbbell'] } })
  const baseline = await searchWorkoutProgrammingResources(pool(), SCOPE, raw)
  const ranked = await searchWorkoutProgrammingResources(pool(), SCOPE, { ...raw, equipment: { preferred: ['dumbbell'] } })
  assert.equal(ranked.exercises.eligibleCount, baseline.exercises.eligibleCount)
  assert.ok(ranked.exercises.candidates[0].score > baseline.exercises.candidates[0].score)
})

test('batched component retrieval shares one release snapshot and rejects malformed batches before SQL', async () => {
  const pool = libraryPool({ cards: [libraryCard('capacity', 1), libraryCard('output', 2)] })
  const result = await searchWorkoutProgrammingResourcesBatch(pool, SCOPE, [resourceRequest(), resourceRequest({ componentKey: 'explosiveness', phaseKeys: ['output'] })])
  assert.equal(result.length, 2)
  assert.deepEqual(result[0].libraryRelease, result[1].libraryRelease)
  assert.equal(pool.calls.filter((call) => call.sql.startsWith('BEGIN')).length, 1)
  assert.equal(pool.calls.filter((call) => call.sql.includes('workout_library_release_v1')).length, 1)
  const noSql = { async connect() { assert.fail('Invalid batch opened a database connection') } }
  for (const requests of [[], [resourceRequest(), resourceRequest()], [resourceRequest({ pinnedExercises: null })]]) {
    await assert.rejects(searchWorkoutProgrammingResourcesBatch(noSql, SCOPE, requests))
  }
})

test('wave retrieval admits one usable station without relaxing legacy simultaneous allocation', async () => {
  const card = libraryCard('capacity', 1)
  card.equipmentRoles = [{ key: 'dumbbell', role: 'required', quantityPerStation: 2 }]
  const raw = resourceRequest({ intent: { ...resourceRequest().intent, athleteCount: 15, coachCount: 2,
    equipmentAvailable: ['dumbbell'], equipmentQuantities: { dumbbell: 2 } } })
  const simultaneous = await searchWorkoutProgrammingResources(libraryPool({ cards: [card] }), SCOPE, raw)
  assert.equal(simultaneous.exercises.eligibleCount, 0)
  const waves = await searchWorkoutProgrammingResources(libraryPool({ cards: [card] }), SCOPE, { ...raw, equipmentScheduling: 'waves' })
  assert.equal(waves.exercises.eligibleCount, 1)
  assert.equal(waves.creatorAuthorized, false)
  const insufficient = await searchWorkoutProgrammingResources(libraryPool({ cards: [card] }), SCOPE, {
    ...raw, equipmentScheduling: 'waves', intent: { ...raw.intent, equipmentQuantities: { dumbbell: 1 } },
  })
  assert.equal(insufficient.exercises.eligibleCount, 0)
})
