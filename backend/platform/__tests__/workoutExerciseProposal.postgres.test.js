import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { proposeWorkoutExercise, loadWorkoutExerciseProposal } from '../workoutExerciseProposal.js'
import { exerciseGapResearchFixtures } from './workoutExerciseGapFixtures.js'
import { proposalRegistry } from './workoutExerciseProposalFixtures.js'
import { SCOPE } from './workoutProgrammingLibrarianFixtures.js'
const connectionString = process.env.WORKOUT_PROGRAMMING_TEST_DATABASE_URL

test('gap-backed proposals persist atomically in the existing AI draft audit DDL', { skip: !connectionString }, async (t) => {
  const target = new URL(connectionString)
  assert.ok(['postgres:', 'postgresql:'].includes(target.protocol))
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))
  assert.match(target.pathname, /^\/vortex_programming_test_[a-z0-9_]+$/)
  assert.equal([...target.searchParams].length, 0)
  const database = new pg.Pool({ connectionString })
  try {
    await database.query(`CREATE SCHEMA coaching;
      CREATE TABLE public.facility (id BIGINT PRIMARY KEY);
      CREATE TABLE public.app_user (id BIGINT PRIMARY KEY);
      INSERT INTO public.facility VALUES (9),(10);
      INSERT INTO public.app_user VALUES (7),(8);`)
    const migration = await readFile(new URL('../../migrations/243_coaching_canonical_card_governance_v1.sql', import.meta.url), 'utf8')
    const ddl = migration.match(/CREATE TABLE IF NOT EXISTS coaching\.exercise_card_ai_draft_audit_v1 \([\s\S]+?\n\);/)?.[0]
    assert.ok(ddl)
    await database.query(ddl)
    const sources = exerciseGapResearchFixtures()
    const hooks = { afterInsert: null }
    // Canonical/athlete/model data is synthetic; all audit SQL and transactions are real.
    const pool = { async connect() {
      const client = await database.connect()
      const sourceClient = await sources.pool.connect()
      return { async query(sql, params = []) {
        if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql) || sql.includes('coaching.exercise_card_ai_draft_audit_v1')) {
          const result = await client.query(sql, params)
          if (sql.startsWith('INSERT')) await hooks.afterInsert?.()
          return result
        }
        return sourceClient.query(sql, params)
      }, release(error) { client.release(error); sourceClient.release(error) } }
    } }
    const rawInput = { request: sources.request, componentKey: 'strength', need: sources.need }
    const propose = (registry = proposalRegistry().registry, runOptions = {}) => proposeWorkoutExercise({ pool, context: SCOPE, rawInput, registry, runOptions })
    let saved
    await t.test('quarantine, gap evidence, model trace and source hashes round-trip through JSONB without creating library records', async () => {
      saved = await propose()
      assert.equal(saved.state, 'AI_PROPOSED')
      assert.equal(saved.canonicalDraftId, null)
      assert.deepEqual(await loadWorkoutExerciseProposal(pool, SCOPE, saved.draftAuditId), saved)
      assert.deepEqual(await loadWorkoutExerciseProposal(pool, { ...SCOPE, userId: '8' }, saved.draftAuditId), saved)
      assert.equal(await loadWorkoutExerciseProposal(pool, { ...SCOPE, facilityId: '10' }, saved.draftAuditId), null)
      const row = (await database.query('SELECT status,model_version,input_tokens,output_tokens FROM coaching.exercise_card_ai_draft_audit_v1 WHERE id=$1', [saved.draftAuditId])).rows[0]
      assert.deepEqual(row, { status: 'validated', model_version: 'synthetic-creator', input_tokens: 250, output_tokens: 400 })
      const tables = (await database.query("SELECT table_name FROM information_schema.tables WHERE table_schema='coaching'")).rows.map((row) => row.table_name)
      assert.deepEqual(tables, ['exercise_card_ai_draft_audit_v1'])
    })
    await t.test('invalid Creator output is a durable failed attempt with no applicable proposal', async () => {
      const invalid = await propose(proposalRegistry({ creator(draft) { draft.approvedBy = 7 } }).registry)
      assert.equal(invalid.state, 'NEEDS_COACH_REVIEW')
      assert.equal(invalid.proposal, null)
      const row = (await database.query('SELECT status,draft_json,validation_errors_json FROM coaching.exercise_card_ai_draft_audit_v1 WHERE id=$1', [invalid.draftAuditId])).rows[0]
      assert.equal(row.status, 'invalid')
      assert.equal(row.draft_json.trace.calls.at(-1).status, 'failed')
      assert.equal(row.validation_errors_json[0].code, 'invalid_output')
    })
    await t.test('cancellation after INSERT rolls back the audit before commit', async () => {
      const count = (await database.query('SELECT count(*)::int AS total FROM coaching.exercise_card_ai_draft_audit_v1')).rows[0].total
      const controller = new AbortController()
      hooks.afterInsert = () => controller.abort()
      await assert.rejects(propose(proposalRegistry().registry, { signal: controller.signal }), { code: 'canceled' })
      hooks.afterInsert = null
      assert.equal((await database.query('SELECT count(*)::int AS total FROM coaching.exercise_card_ai_draft_audit_v1')).rows[0].total, count)
    })
  } finally { await database.end() }
})
