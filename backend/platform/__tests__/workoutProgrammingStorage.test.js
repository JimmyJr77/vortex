import assert from 'node:assert/strict'
import test, { before } from 'node:test'
import { persistWorkoutProgrammingRun, loadWorkoutProgrammingRun, listWorkoutProgrammingRuns, revalidateWorkoutProgrammingRun } from '../workoutProgrammingRepository.js'
import { createProgrammingWorkoutEnvelope, readProgrammingWorkoutEnvelope, parseProgrammingWorkflowSnapshot } from '../workoutProgrammingStorageContract.js'
import { generateAndPersistWorkoutProgramming } from '../workoutProgrammingService.js'
import { applyCanonicalWorkoutSwap } from '../canonicalDeterministicEngine.js'
import { programmingValueHash } from '../workoutProgrammingRequest.js'
import { SCOPE } from './workoutProgrammingLibrarianFixtures.js'
import { storageFixtures, storageSourcePool, memoryStorageDatabase } from './workoutProgrammingStorageFixtures.js'
import { compositionRegistry } from './workoutProgrammingBuilderFixtures.js'

let fixtures
before(async () => { fixtures = await storageFixtures() })
const save = (database, patch = {}) => persistWorkoutProgrammingRun({ pool: storageSourcePool(database, fixtures), context: SCOPE, workflow: fixtures.workflow, ...patch })

test('saved envelope retains canonical references, decisions, source validation and bounded staff telemetry', () => {
  const envelope = createProgrammingWorkoutEnvelope(fixtures.workflow, fixtures.workflow.qa.finalValidation)
  assert.equal(envelope.sessionModel, 'vortex_components_v1')
  assert.equal(envelope.validatedWorkout, true)
  assert.equal(envelope.libraryApprovalGranted, false)
  assert.equal(envelope.creatorAuthorized, false)
  assert.equal(envelope.modelVersion, 'fixture-model, synthetic-storage-model')
  assert.equal(envelope.workflow.trace.calls.length, 5)
  assert.equal(envelope.explanation.activities.length, fixtures.workflow.draft.activities.length)
  assert.deepEqual(readProgrammingWorkoutEnvelope(JSON.parse(JSON.stringify(envelope))), envelope)
  assert.throws(() => applyCanonicalWorkoutSwap(envelope, [], {}), { code: 'session_workflow_required' })
  const changed = structuredClone(envelope)
  changed.validatedWorkout = false
  assert.throws(() => readProgrammingWorkoutEnvelope(changed), { code: 'invalid_programming_snapshot' })
  const { contentHash, ...content } = changed
  changed.contentHash = programmingValueHash(content)
  assert.throws(() => readProgrammingWorkoutEnvelope(changed), { code: 'invalid_programming_snapshot' })
})

test('mismatched intent, QA hash, running calls and unsupported authority fields cannot be stored', () => {
  for (const edit of [
    (run) => { run.draft.intentId = run.runId },
    (run) => { run.qa.reviewHash = '0'.repeat(64) },
    (run) => { run.qa.finalValidation = null },
    (run) => { run.trace.calls[0].status = 'running' },
    (run) => { run.libraryApprovalGranted = true },
    (run) => { run.publish = true },
  ]) {
    const value = structuredClone(fixtures.workflow); edit(value)
    assert.throws(() => parseProgrammingWorkflowSnapshot(value))
  }
})

test('atomic save uses existing workout storage and idempotent retries return historical evidence', async () => {
  const database = memoryStorageDatabase()
  const pool = storageSourcePool(database, fixtures)
  const result = await save(database, { pool })
  assert.equal(result.persistedWorkoutId, fixtures.workflow.runId)
  assert.equal(result.workout.validation.status, 'PASS')
  assert.equal(result.validationFreshness, 'at_save')
  assert.equal(result.requiresRevalidation, false)
  assert.equal(pool.calls.filter((entry) => entry.sql.startsWith('BEGIN')).length, 1, 'Fresh validation shares the write snapshot')
  assert.ok(pool.calls[0].sql.includes('REPEATABLE READ'))
  const again = await save(database, { pool })
  assert.equal(again.validationFreshness, 'historical_snapshot')
  assert.equal(again.requiresRevalidation, true)
  assert.equal(database.calls.filter((entry) => entry.sql.includes('INSERT INTO')).length, 1)
  const loaded = await loadWorkoutProgrammingRun(pool, SCOPE, result.persistedWorkoutId)
  assert.equal(loaded.workout.contentHash, result.workout.contentHash)
  assert.equal(loaded.requiresRevalidation, true)
  const changed = structuredClone(fixtures.workflow)
  changed.trace.elapsedMs++
  await assert.rejects(save(database, { workflow: changed }), { code: 'programming_snapshot_conflict' })
  assert.equal(database.rows.size, 1)
})

test('a source change before save downgrades the saved result without another model call', async () => {
  const source = await storageFixtures()
  source.options.cards[3].deliveryProfiles[0].coachInstructions = 'Source changed after Critic reviewed it.'
  const result = await persistWorkoutProgrammingRun({ pool: storageSourcePool(memoryStorageDatabase(), source), context: SCOPE, workflow: source.workflow })
  assert.equal(result.workout.status, 'NEEDS_COACH_REVIEW')
  assert.equal(result.workout.validatedWorkout, false)
  assert.ok(result.requiresRevalidation)
  assert.ok(result.workout.validation.findings.some((entry) => entry.code === 'review_target_changed_before_save'))
  assert.equal(result.workout.workflow.qa.status, 'QA_PASSED', 'Original review remains historical evidence')
  assert.equal(result.workout.workflow.trace.calls.length, 5)
})

test('reopened sessions can revalidate unchanged evidence; changed sources require review without rewriting history', async () => {
  const source = await storageFixtures()
  const database = memoryStorageDatabase()
  const pool = storageSourcePool(database, source)
  const saved = await persistWorkoutProgrammingRun({ pool, context: SCOPE, workflow: source.workflow })
  const checked = await revalidateWorkoutProgrammingRun(pool, SCOPE, saved.persistedWorkoutId)
  assert.equal(checked.status, 'QA_PASSED')
  assert.equal(checked.requiresRevalidation, false)
  assert.equal(checked.savedContentHash, saved.workout.contentHash)
  source.options.cards[3].deliveryProfiles[0].coachInstructions = 'Changed source after session was saved.'
  const changed = await revalidateWorkoutProgrammingRun(pool, SCOPE, saved.persistedWorkoutId)
  assert.equal(changed.status, 'NEEDS_COACH_REVIEW')
  assert.equal(changed.validatedWorkout, false)
  assert.equal(database.rows.get(saved.persistedWorkoutId).output_json.contentHash, saved.workout.contentHash)
  assert.equal(database.calls.filter((entry) => entry.sql.includes('INSERT INTO')).length, 1)
})

test('scope, release ownership, cancellation and write failures never commit a snapshot', async () => {
  for (const options of [{ actorAllowed: false }, { releaseAllowed: false }, { failInsert: true }]) {
    const database = memoryStorageDatabase(options)
    await assert.rejects(save(database))
    assert.equal(database.rows.size, 0)
    assert.ok(database.calls.some((entry) => entry.sql === 'ROLLBACK'))
  }
  const database = memoryStorageDatabase()
  await assert.rejects(save(database, { context: { facilityId: '10', userId: '7' } }), { code: 'programming_snapshot_forbidden' })
  await assert.rejects(save(database, { context: { facilityId: '9', userId: '8' } }), { code: 'programming_snapshot_forbidden' })
  await assert.rejects(save(database, { signal: AbortSignal.abort() }), { code: 'canceled' })
  assert.equal(database.calls.length, 0)
  await assert.rejects(listWorkoutProgrammingRuns(database, SCOPE, { limit: 101 }), RangeError)
  await assert.rejects(loadWorkoutProgrammingRun(database, SCOPE, 'bad-id'), TypeError)
})

test('application entry point generates, independently reviews, saves and reopens one complete run', async () => {
  const database = memoryStorageDatabase()
  const pool = storageSourcePool(database, fixtures)
  const result = await generateAndPersistWorkoutProgramming({ pool, context: SCOPE, registry: fixtures.registry, rawRequest: fixtures.rawRequest })
  assert.equal(result.workout.status, 'QA_PASSED')
  assert.equal(result.workout.validatedWorkout, true)
  assert.equal(database.rows.size, 1)
  const reopened = await loadWorkoutProgrammingRun(pool, SCOPE, result.persistedWorkoutId)
  assert.equal(reopened.workout.workflow.draft.schedule.bookedSeconds, fixtures.request.logistics.totalBookedMinutes * 60)
  assert.equal(reopened.workout.workflow.history.length, 1)
})

test('a missing Critic is persisted as a review stop even when fresh deterministic validation passes', async () => {
  const database = memoryStorageDatabase()
  const result = await generateAndPersistWorkoutProgramming({ pool: storageSourcePool(database, fixtures), context: SCOPE,
    registry: compositionRegistry(), rawRequest: fixtures.rawRequest })
  assert.equal(result.workout.workflow.qa.validation.status, 'PASS')
  assert.equal(result.workout.validation.freshValidation.status, 'PASS')
  assert.equal(result.workout.workflow.qa.critic, null)
  assert.equal(result.workout.status, 'NEEDS_COACH_REVIEW')
  assert.equal(result.workout.validatedWorkout, false)
  assert.equal(result.requiresRevalidation, true)
  assert.equal(database.rows.size, 1)
})
