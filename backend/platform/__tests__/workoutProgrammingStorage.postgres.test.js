import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { persistWorkoutProgrammingRun, loadWorkoutProgrammingRun, listWorkoutProgrammingRuns, revalidateWorkoutProgrammingRun } from '../workoutProgrammingRepository.js'
import { storageFixtures, storageSourcePool } from './workoutProgrammingStorageFixtures.js'
import { SCOPE, uuid } from './workoutProgrammingLibrarianFixtures.js'
import { modificationFixtures, modificationRequest } from './workoutProgrammingModificationFixtures.js'
import { generateWorkoutProgramming } from '../workoutProgrammingWorkflow.js'
const connectionString = process.env.WORKOUT_PROGRAMMING_TEST_DATABASE_URL

test('programming sessions persist in the actual canonical workout schema with atomic scoped evidence', { skip: !connectionString }, async (t) => {
  const target = new URL(connectionString)
  assert.ok(['postgres:', 'postgresql:'].includes(target.protocol))
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))
  assert.match(target.pathname, /^\/vortex_programming_test_[a-z0-9_]+$/)
  assert.equal([...target.searchParams].length, 0)
  const database = new pg.Pool({ connectionString })
  try {
    // Empty disposable DB only. Apply the exact existing workout DDL without importing or altering production content.
    await database.query(`CREATE SCHEMA coaching;
      CREATE TABLE public.facility (id BIGINT PRIMARY KEY);
      CREATE TABLE public.app_user (id BIGINT PRIMARY KEY, facility_id BIGINT REFERENCES public.facility(id));
      CREATE TABLE coaching.workout_library_release_v1 (id UUID PRIMARY KEY, facility_id BIGINT REFERENCES public.facility(id));
      INSERT INTO public.facility VALUES (9),(10);
      INSERT INTO public.app_user VALUES (7,9),(8,10),(11,9);`)
    const migration = await readFile(new URL('../../migrations/241_coaching_canonical_workout_model_v1.sql', import.meta.url), 'utf8')
    const ddl = migration.match(/CREATE TABLE IF NOT EXISTS coaching\.generated_workout_v1 \([\s\S]+?\n\);/)?.[0]
    assert.ok(ddl)
    await database.query(ddl)
    const fixtures = await storageFixtures()
    const pool = storageSourcePool(database, fixtures)
    await database.query('INSERT INTO coaching.workout_library_release_v1 VALUES ($1,9),($2,10)', [fixtures.workflow.draft.libraryRelease.id, uuid(901)])
    const save = (workflow = fixtures.workflow, patch = {}) => persistWorkoutProgrammingRun({ pool, context: SCOPE, workflow, ...patch })
    let saved
    await t.test('typed snapshots round-trip through existing JSONB, version columns and canonical foreign keys', async () => {
      saved = await save()
      assert.equal(saved.workout.status, 'QA_PASSED')
      assert.equal(saved.workout.validatedWorkout, true)
      const row = (await database.query('SELECT * FROM coaching.generated_workout_v1 WHERE id=$1', [saved.persistedWorkoutId])).rows[0]
      assert.equal(row.generator_version, 'vortex-programming-staff/1.0.0')
      assert.equal(row.mode, 'ai_assisted')
      assert.equal(row.model_version, 'fixture-model, synthetic-storage-model')
      assert.deepEqual(row.validation_json, row.output_json.validation)
      assert.equal(row.output_json.workflow.trace.calls.length, 5)
      assert.ok(pool.calls.every((entry) => !entry.sql.includes('READ ONLY')), 'Fresh validation did not open a nested snapshot during save')
      const reopened = await loadWorkoutProgrammingRun(pool, SCOPE, saved.persistedWorkoutId)
      assert.equal(reopened.workout.contentHash, saved.workout.contentHash)
      assert.equal(reopened.requiresRevalidation, true)
    })
    await t.test('concurrent writes and retries preserve one immutable row per run', async () => {
      const workflow = { ...structuredClone(fixtures.workflow), runId: randomUUID() }
      const [first, second] = await Promise.all([save(workflow), save(workflow)])
      assert.equal(first.persistedWorkoutId, second.persistedWorkoutId)
      assert.equal(first.workout.contentHash, second.workout.contentHash)
      assert.equal((await database.query('SELECT count(*)::int AS count FROM coaching.generated_workout_v1 WHERE id=$1', [workflow.runId])).rows[0].count, 1)
      const changed = structuredClone(workflow); changed.trace.elapsedMs++
      await assert.rejects(save(changed), { code: 'programming_snapshot_conflict' })
    })
    await t.test('facility and actor boundaries apply to save, list and reload; legacy rows are not reinterpreted', async () => {
      assert.equal(await loadWorkoutProgrammingRun(pool, { facilityId: '10', userId: '8' }, saved.persistedWorkoutId), null)
      await assert.rejects(loadWorkoutProgrammingRun(pool, { facilityId: '9', userId: '8' }, saved.persistedWorkoutId), { code: 'programming_snapshot_forbidden' })
      assert.equal((await loadWorkoutProgrammingRun(pool, { facilityId: '9', userId: '11' }, saved.persistedWorkoutId)).createdBy, '7')
      await assert.rejects(save(fixtures.workflow, { context: { facilityId: '9', userId: '11' } }), { code: 'programming_snapshot_forbidden' })
      const legacyId = randomUUID()
      await database.query(`INSERT INTO coaching.generated_workout_v1
        (id,facility_id,schema_version,generator_version,rule_version,mode,random_seed,intent_json,output_json,validation_json,created_by)
        VALUES ($1,9,'1.0.0','legacy-test','test','deterministic','test','{}','{}','{}',7)`, [legacyId])
      assert.equal(await loadWorkoutProgrammingRun(pool, SCOPE, legacyId), null)
      const page = await listWorkoutProgrammingRuns(pool, SCOPE, { limit: 1 })
      assert.equal(page.items.length, 1)
      assert.ok(page.nextCursor)
      const next = await listWorkoutProgrammingRuns(pool, SCOPE, { limit: 1, before: page.nextCursor })
      assert.equal(next.items.length, 1)
      assert.notEqual(next.items[0].persistedWorkoutId, page.items[0].persistedWorkoutId)
      assert.equal((await listWorkoutProgrammingRuns(pool, { facilityId: '10', userId: '8' })).items.length, 0)
    })
    await t.test('cancellation after the SQL insert rolls back the real row', async () => {
      const controller = new AbortController()
      const workflow = { ...structuredClone(fixtures.workflow), runId: randomUUID() }
      const cancelPool = { async connect() {
        const client = await pool.connect()
        return { async query(sql, values) {
          const result = await client.query(sql, values)
          if (sql.includes('INSERT INTO coaching.generated_workout_v1')) controller.abort()
          return result
        }, release(error) { client.release(error) } }
      } }
      await assert.rejects(save(workflow, { pool: cancelPool, signal: controller.signal }), { code: 'canceled' })
      assert.equal((await database.query('SELECT id FROM coaching.generated_workout_v1 WHERE id=$1', [workflow.runId])).rows.length, 0)
    })
    await t.test('modified sessions verify their actual parent inside save and read transactions while preserving immutable lineage', async () => {
      const fixture = await modificationFixtures()
      const coach = { facilityId: '9', userId: '11' }
      const coachPool = storageSourcePool(database, { ...fixtures, pool: () => fixtures.pool({ userId: '11' }) })
      const rawRequest = modificationRequest(saved)
      const sourceBlock = saved.workout.workflow.draft.activities.find((activity) => activity.componentKey === 'strength')
      rawRequest.modification.blockEdits = [{ blockId: sourceBlock.activityId, dose: { sets: 2 } }]
      const workflow = await generateWorkoutProgramming({ pool: coachPool, context: coach, registry: fixture.registry, rawRequest })
      assert.equal(workflow.status, 'QA_PASSED', JSON.stringify(workflow.qa.findings.map((entry) => entry.code)))
      const start = coachPool.calls.length
      const revised = await persistWorkoutProgrammingRun({ pool: coachPool, context: coach, workflow })
      const writes = coachPool.calls.slice(start)
      assert.equal(revised.createdBy, '11')
      assert.equal(revised.workout.validatedWorkout, true)
      assert.equal(writes.filter((entry) => entry.sql.startsWith('BEGIN')).length, 1)
      assert.ok(writes.some((entry) => entry.sql.includes('programming_snapshot_read') && entry.values[0] === saved.persistedWorkoutId))
      assert.equal(revised.workout.workflow.sessionIntent.modification.sourceContentHash, saved.workout.contentHash)
      assert.deepEqual((await loadWorkoutProgrammingRun(pool, SCOPE, saved.persistedWorkoutId)).workout, saved.workout)
      const validationStart = coachPool.calls.length
      assert.equal((await revalidateWorkoutProgrammingRun(coachPool, coach, revised.persistedWorkoutId)).validatedWorkout, true)
      assert.equal(coachPool.calls.slice(validationStart).filter((entry) => entry.sql.startsWith('BEGIN')).length, 1)
      await assert.rejects(generateWorkoutProgramming({ pool: coachPool, context: { facilityId: '10', userId: '8' }, registry: fixture.registry, rawRequest }), { code: 'source_workout_unavailable' })
      await assert.rejects(generateWorkoutProgramming({ pool: coachPool, context: coach, registry: fixture.registry,
        rawRequest: { ...rawRequest, modification: { ...rawRequest.modification, expectedRevision: 'stale' } } }), { code: 'source_workout_revision_conflict' })
    })
    await t.test('fresh revalidation uses one read-only snapshot and preserves the saved audit when sources change', async () => {
      const start = pool.calls.length
      const checked = await revalidateWorkoutProgrammingRun(pool, SCOPE, saved.persistedWorkoutId)
      assert.equal(checked.status, 'QA_PASSED')
      assert.equal(pool.calls.slice(start).filter((entry) => entry.sql.startsWith('BEGIN')).length, 1)
      assert.equal(pool.calls[start].sql, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
      fixtures.options.cards[3].deliveryProfiles[0].coachInstructions = 'Updated source instructions after saving.'
      const changed = await revalidateWorkoutProgrammingRun(pool, SCOPE, saved.persistedWorkoutId)
      assert.equal(changed.status, 'NEEDS_COACH_REVIEW')
      const row = (await database.query('SELECT output_json FROM coaching.generated_workout_v1 WHERE id=$1', [saved.persistedWorkoutId])).rows[0]
      assert.equal(row.output_json.contentHash, saved.workout.contentHash)
      assert.ok(pool.calls.slice(start).every((entry) => !entry.sql.includes('INSERT INTO')))
    })
  } finally { await database.end() }
})
