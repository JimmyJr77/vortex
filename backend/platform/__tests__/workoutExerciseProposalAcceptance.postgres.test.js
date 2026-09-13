import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { acceptWorkoutExerciseProposal, proposeWorkoutExercise, loadWorkoutExerciseProposal, listWorkoutExerciseProposals, reviewWorkoutExerciseProposal } from '../workoutExerciseProposal.js'
import { saveCanonicalCardDraftInTransaction, withCanonicalCardTransaction } from '../canonicalCardRepository.js'
import { proposalRegistry } from './workoutExerciseProposalFixtures.js'
import { exerciseGapResearchFixtures } from './workoutExerciseGapFixtures.js'
import { SCOPE } from './workoutProgrammingLibrarianFixtures.js'
const connectionString = process.env.WORKOUT_PROGRAMMING_TEST_DATABASE_URL
const migration = (name) => readFile(new URL(`../../migrations/${name}.sql`, import.meta.url), 'utf8')

test('human acceptance uses the existing canonical authoring DDL and immutable AI audit', { skip: !connectionString }, async (t) => {
  const target = new URL(connectionString)
  assert.ok(['postgres:', 'postgresql:'].includes(target.protocol))
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))
  assert.match(target.pathname, /^\/vortex_programming_test_[a-z0-9_]+$/)
  assert.equal([...target.searchParams].length, 0)
  const database = new pg.Pool({ connectionString })
  try {
    // Empty disposable database only. Authoring tables, constraints and all
    // writes are real; released workout materials and model judgments are synthetic.
    await database.query(`CREATE SCHEMA coaching;
      CREATE TABLE public.facility (id BIGINT PRIMARY KEY);
      CREATE TABLE public.app_user (id BIGINT PRIMARY KEY);
      CREATE TABLE coaching.exercise (id BIGINT PRIMARY KEY);
      INSERT INTO public.facility VALUES (9),(10);
      INSERT INTO public.app_user VALUES (7),(8);`)
    for (const [file, tables] of [
      ['241_coaching_canonical_workout_model_v1', ['exercise_definition_v1', 'exercise_variant_v1', 'exercise_delivery_profile_v1']],
      ['243_coaching_canonical_card_governance_v1', ['exercise_card_revision_v1', 'exercise_card_ai_draft_audit_v1', 'exercise_media_review_v1', 'exercise_card_review_v1']],
      ['252_coaching_canonical_identity_resolution_v1', ['exercise_identity_resolution_v1']],
      ['750_coaching_taxonomy_v2_foundation', ['taxonomy_term_v2', 'exercise_taxonomy_assignment_v2', 'exercise_taxonomy_decision_v2']],
    ]) {
      const sql = await migration(file)
      for (const table of tables) {
        const ddl = sql.match(new RegExp(`CREATE TABLE IF NOT EXISTS coaching\\.${table} \\([\\s\\S]+?\\n\\);`))?.[0]
        assert.ok(ddl, table)
        await database.query(ddl)
      }
    }
    for (const file of ['244_coaching_canonical_anatomy_load_v1', '248_coaching_canonical_operational_support_v1', '753_coaching_canonical_structured_variant_profiles_v2']) {
      const sql = await migration(file)
      const statements = [...sql.matchAll(/ALTER TABLE coaching\.exercise_(?:definition|variant|delivery_profile)_v1\s[\s\S]+?;/g)]
      assert.ok(statements.length)
      for (const [statement] of statements) await database.query(statement)
    }

    const setup = async () => {
      await database.query('TRUNCATE coaching.exercise_definition_v1, coaching.exercise_card_ai_draft_audit_v1 CASCADE')
      const source = exerciseGapResearchFixtures()
      const hooks = { afterDefinitionInsert: null, beforeAdvisoryLock: null, failRevision: false }
      const pool = { async connect() {
        const client = await database.connect()
        const synthetic = await source.pool.connect()
        return { async query(sql, params = []) {
          if (sql.includes('pg_advisory_xact_lock')) await hooks.beforeAdvisoryLock?.()
          if (sql.includes('INSERT INTO coaching.exercise_card_revision_v1') && hooks.failRevision) throw new Error('Synthetic revision audit failure')
          if (/^(BEGIN|COMMIT|ROLLBACK|SELECT pg_advisory_|INSERT INTO coaching\.|UPDATE coaching\.|DELETE FROM coaching\.)/.test(sql)
            || sql.includes('FROM coaching.exercise_card_ai_draft_audit_v1')
            || sql.startsWith('SELECT id,card_version,status,provenance_json FROM coaching.exercise_definition_v1')
            || sql.startsWith('SELECT * FROM coaching.exercise_definition_v1')
            || sql.includes('FROM coaching.exercise_definition_v1 definition')) {
            const result = await client.query(sql, params)
            if (sql.startsWith('INSERT INTO coaching.exercise_definition_v1')) await hooks.afterDefinitionInsert?.()
            return result
          }
          return synthetic.query(sql, params)
        }, release(error) { client.release(error); synthetic.release(error) } }
      } }
      const input = { request: source.request, componentKey: 'strength', need: source.need }
      const saved = await proposeWorkoutExercise({ pool, context: SCOPE, rawInput: input, registry: proposalRegistry().registry })
      const accept = (context = SCOPE) => acceptWorkoutExerciseProposal(pool, context, saved.draftAuditId, { expectedProposalHash: saved.contentHash })
      return { source, hooks, pool, saved, accept }
    }

    await t.test('explicit acceptance records human authorship and AI origin, preserving quarantine and immutable audit', async () => {
      const { pool, saved, accept } = await setup()
      const accepted = await accept({ ...SCOPE, userId: '8' })
      assert.equal(accepted.status, 'draft')
      assert.equal(accepted.alreadyAccepted, false)
      assert.equal(accepted.libraryApprovalGranted, false)
      assert.equal(accepted.acceptedBy, '8')
      const card = (await database.query('SELECT * FROM coaching.exercise_definition_v1 WHERE id=$1', [accepted.canonicalCardId])).rows[0]
      assert.equal(card.created_by, '8')
      assert.equal(card.reviewed_by, null)
      assert.equal(card.approved_by, null)
      assert.equal(card.approved_video_url, null)
      assert.ok(card.content_confidence <= 60 && card.scoring_confidence <= 60)
      assert.equal(card.provenance_json.source, 'ai_assisted_draft')
      assert.equal(card.provenance_json.humanReviewRequired, true)
      assert.deepEqual(card.provenance_json.exerciseProposal, { auditId: saved.draftAuditId, contentHash: saved.contentHash,
        acceptedBy: '8', acceptedAt: accepted.acceptedAt })
      const revision = (await database.query('SELECT * FROM coaching.exercise_card_revision_v1 WHERE definition_id=$1', [card.id])).rows[0]
      assert.equal(revision.action, 'created')
      assert.equal(revision.actor_user_id, '8')
      assert.deepEqual(revision.snapshot_json.provenance, card.provenance_json)
      assert.deepEqual(await loadWorkoutExerciseProposal(pool, SCOPE, saved.draftAuditId), saved)
      const variant = (await database.query('SELECT * FROM coaching.exercise_variant_v1 WHERE definition_id=$1', [card.id])).rows[0]
      assert.equal(variant.status, 'draft')
      assert.equal(variant.structured_profile_review_status, 'suggested')
      assert.equal(variant.structured_profile_reviewed_by, null)
      assert.equal((await database.query('SELECT status FROM coaching.exercise_delivery_profile_v1 WHERE variant_id=$1', [variant.id])).rows[0].status, 'draft')
      assert.equal((await database.query('SELECT count(*)::int AS count FROM coaching.exercise_card_review_v1')).rows[0].count, 0)
    })

    await t.test('concurrent acceptance and later retries recover the same draft and original accepting coach', async () => {
      const { hooks, accept } = await setup()
      let releaseFirst
      const secondLockStarted = new Promise((resolve) => { releaseFirst = resolve })
      let lockCount = 0
      hooks.beforeAdvisoryLock = () => { if (++lockCount === 2) releaseFirst() }
      hooks.afterDefinitionInsert = () => secondLockStarted
      const [first, second] = await Promise.all([accept(), accept({ ...SCOPE, userId: '8' })])
      assert.equal(first.canonicalCardId, second.canonicalCardId)
      assert.deepEqual(new Set([first.alreadyAccepted, second.alreadyAccepted]), new Set([false, true]))
      assert.equal(first.acceptedBy, second.acceptedBy)
      assert.equal(first.acceptedAt, second.acceptedAt)
      assert.ok(lockCount >= 3, 'The waiting transaction must retry with a fresh snapshot after the concurrent commit')
      assert.equal((await database.query('SELECT count(*)::int AS count FROM coaching.exercise_definition_v1')).rows[0].count, 1)
      assert.equal((await database.query('SELECT count(*)::int AS count FROM coaching.exercise_card_revision_v1')).rows[0].count, 1)
      assert.equal((await accept()).alreadyAccepted, true)
    })

    await t.test('later draft edits preserve trusted origin in the card and revision snapshots; retry does not overwrite edits', async () => {
      const { pool, saved, accept } = await setup()
      const accepted = await accept()
      const original = (await database.query('SELECT * FROM coaching.exercise_definition_v1 WHERE id=$1', [accepted.canonicalCardId])).rows[0]
      await withCanonicalCardTransaction(pool, SCOPE.facilityId, (client) => saveCanonicalCardDraftInTransaction(client, SCOPE.facilityId, '8',
        { ...saved.proposal.draft, description: 'Human reviewed and edited this draft description.', provenance: { source: 'forged-client-origin' } },
        { definitionId: original.id, expectedUpdatedAt: original.updated_at, sourceProvenance: { source: 'forged-update-option' } }))
      const edited = (await database.query('SELECT * FROM coaching.exercise_definition_v1 WHERE id=$1', [original.id])).rows[0]
      assert.equal(edited.card_version, 2)
      assert.equal(edited.description, 'Human reviewed and edited this draft description.')
      assert.deepEqual(edited.provenance_json, original.provenance_json)
      const revisions = (await database.query('SELECT snapshot_json FROM coaching.exercise_card_revision_v1 WHERE definition_id=$1', [original.id])).rows
      assert.equal(revisions.length, 2)
      for (const revision of revisions) assert.deepEqual(revision.snapshot_json.provenance, original.provenance_json)
      const retry = await accept()
      assert.equal(retry.cardVersion, 2)
      assert.equal(retry.alreadyAccepted, true)
    })

    await t.test('changed research and controlled taxonomy reject acceptance before canonical writes', async () => {
      const state = await setup()
      state.source.rows[0].definition_updated_at = '2026-09-14T00:00:00Z'
      await assert.rejects(state.accept(), { code: 'exercise_gap_sources_changed' })
      assert.equal((await database.query('SELECT count(*)::int AS count FROM coaching.exercise_definition_v1')).rows[0].count, 0)
      const fresh = await setup()
      fresh.source.taxonomy.movement_pattern.delete(fresh.saved.proposal.draft.movementPatterns[0])
      await assert.rejects(fresh.accept(), /taxonomy|sources changed/i)
      assert.equal((await database.query('SELECT count(*)::int AS count FROM coaching.exercise_definition_v1')).rows[0].count, 0)
    })

    await t.test('revision write failure rolls back definitions, variants, profiles and keeps the original proposal retryable', async () => {
      const { hooks, pool, saved, accept } = await setup()
      hooks.failRevision = true
      await assert.rejects(accept(), /Synthetic revision audit failure/)
      for (const table of ['exercise_definition_v1', 'exercise_variant_v1', 'exercise_delivery_profile_v1', 'exercise_card_revision_v1']) {
        assert.equal((await database.query(`SELECT count(*)::int AS count FROM coaching.${table}`)).rows[0].count, 0)
      }
      assert.deepEqual(await loadWorkoutExerciseProposal(pool, SCOPE, saved.draftAuditId), saved)
      hooks.failRevision = false
      assert.equal((await accept()).alreadyAccepted, false)
    })

    await t.test('a normal canonical draft ignores client provenance and retains the existing authoring origin', async () => {
      const { pool, saved } = await setup()
      const card = await withCanonicalCardTransaction(pool, SCOPE.facilityId, (client) => saveCanonicalCardDraftInTransaction(client,
        SCOPE.facilityId, SCOPE.userId, { ...saved.proposal.draft, provenance: { source: 'forged', exerciseProposal: { auditId: saved.draftAuditId } } }))
      assert.deepEqual((await database.query('SELECT provenance_json FROM coaching.exercise_definition_v1 WHERE id=$1', [card.id])).rows[0].provenance_json,
        { source: 'canonical_authoring' })
    })

    await t.test('canonical identity or slug collisions stop acceptance without linking an unrelated card', async () => {
      for (const collision of ['name', 'slug']) {
        const { pool, saved, accept } = await setup()
        await database.query(`INSERT INTO coaching.exercise_definition_v1
          (facility_id,slug,canonical_name,display_name,family_key,status)
          VALUES (9,$1,$2,$2,'synthetic','draft')`, [collision === 'slug' ? saved.proposal.draft.slug : 'different-slug',
          collision === 'name' ? saved.proposal.draft.canonicalName : 'Unrelated terrestrial pivot'])
        await assert.rejects(accept(), { code: 'exercise_proposal_duplicate' })
        assert.equal((await database.query('SELECT count(*)::int AS count FROM coaching.exercise_definition_v1')).rows[0].count, 1)
        assert.equal((await database.query('SELECT count(*)::int AS count FROM coaching.exercise_card_revision_v1')).rows[0].count, 0)
        assert.deepEqual(await loadWorkoutExerciseProposal(pool, SCOPE, saved.draftAuditId), saved)
      }
    })

    await t.test('review recovers current acceptance from canonical origin while preserving the historical audit and facility scope', async () => {
      const { pool, saved, accept } = await setup()
      assert.deepEqual(await reviewWorkoutExerciseProposal(pool, SCOPE, saved.draftAuditId), { record: saved, acceptance: null })
      const accepted = await accept()
      const reopened = await reviewWorkoutExerciseProposal(pool, { ...SCOPE, userId: '8' }, saved.draftAuditId)
      assert.deepEqual(reopened.record, saved)
      assert.deepEqual(reopened.acceptance, { ...accepted, alreadyAccepted: true })
      assert.equal(await reviewWorkoutExerciseProposal(pool, { ...SCOPE, facilityId: '10' }, saved.draftAuditId), null)
      await database.query("UPDATE coaching.exercise_definition_v1 SET provenance_json=jsonb_set(provenance_json,'{exerciseProposal,contentHash}', '\"conflicting-origin\"'::jsonb) WHERE id=$1", [accepted.canonicalCardId])
      await assert.rejects(reviewWorkoutExerciseProposal(pool, SCOPE, saved.draftAuditId), { code: 'exercise_proposal_audit_conflict' })
    })

    await t.test('proposal history preserves microsecond cursor order, projects summaries and excludes other workflows and facilities', async () => {
      const { pool, saved } = await setup()
      await database.query("UPDATE coaching.exercise_card_ai_draft_audit_v1 SET created_at='2026-09-13T12:00:00.000001Z' WHERE id=$1", [saved.draftAuditId])
      await database.query(`INSERT INTO coaching.exercise_card_ai_draft_audit_v1 (facility_id,user_id,request_hash,status,draft_json,created_at)
        SELECT facility_id,user_id,request_hash,status,draft_json,'2026-09-13T12:00:00.000002Z'::timestamptz
        FROM coaching.exercise_card_ai_draft_audit_v1 WHERE id=$1`, [saved.draftAuditId])
      await database.query(`INSERT INTO coaching.exercise_card_ai_draft_audit_v1 (facility_id,user_id,request_hash,status,draft_json)
        VALUES (9,7,'synthetic','validated','{"workflow":"legacy-ai-draft"}'), (10,8,'synthetic','validated','{"workflow":"legacy-ai-draft"}')`)
      const first = await listWorkoutExerciseProposals(pool, SCOPE, { limit: 1 })
      assert.equal(first.items.length, 1)
      assert.equal(first.items[0].createdAt, '2026-09-13T12:00:00.000002Z')
      assert.equal(first.items[0].name, saved.request.need.canonicalName)
      assert.deepEqual(Object.keys(first.items[0]).sort(), ['componentKey', 'createdAt', 'draftAuditId', 'kind', 'name', 'state'])
      const second = await listWorkoutExerciseProposals(pool, SCOPE, { limit: 1, before: first.nextCursor })
      assert.equal(second.items[0].draftAuditId, saved.draftAuditId)
      assert.equal(second.items[0].createdAt, '2026-09-13T12:00:00.000001Z')
      assert.equal(second.nextCursor, null)
      assert.deepEqual((await listWorkoutExerciseProposals(pool, { ...SCOPE, facilityId: '10' })).items, [])
    })
  } finally { await database.end() }
})
