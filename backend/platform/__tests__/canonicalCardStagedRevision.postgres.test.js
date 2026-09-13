import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { stageWorkoutExerciseProposal, proposeWorkoutExercise, loadWorkoutExerciseProposal, loadWorkoutExerciseProposalRevision } from '../workoutExerciseProposal.js'
import { changeStagedCanonicalRevision, loadStagedCanonicalRevision } from '../canonicalCardStagedRevision.js'
import { saveCanonicalCardDraftInTransaction, withCanonicalCardTransaction, loadCanonicalCard } from '../canonicalCardRepository.js'
import { exerciseGapResearchFixtures } from './workoutExerciseGapFixtures.js'
import { stagedProposalRegistry, stagedSourceFixture } from './canonicalCardStagedRevisionFixtures.js'
import { SCOPE } from './workoutProgrammingLibrarianFixtures.js'
const connectionString = process.env.WORKOUT_PROGRAMMING_TEST_DATABASE_URL
const migration = (name) => readFile(new URL(`../../migrations/${name}.sql`, import.meta.url), 'utf8')

test('staged profile revisions use existing canonical audit storage without changing live source records', { skip: !connectionString }, async (t) => {
  const address = new URL(connectionString)
  assert.ok(['postgres:', 'postgresql:'].includes(address.protocol))
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(address.hostname))
  assert.match(address.pathname, /^\/vortex_programming_test_[a-z0-9_]+$/)
  assert.equal([...address.searchParams].length, 0)
  const database = new pg.Pool({ connectionString })
  try {
    await database.query(`CREATE SCHEMA coaching;
      CREATE TABLE public.facility (id BIGINT PRIMARY KEY);
      CREATE TABLE public.app_user (id BIGINT PRIMARY KEY);
      CREATE TABLE coaching.exercise (id BIGINT PRIMARY KEY);
      INSERT INTO public.facility VALUES (9),(10);
      INSERT INTO public.app_user VALUES (7),(8),(9);`)
    for (const [file, tables] of [
      ['241_coaching_canonical_workout_model_v1', ['exercise_definition_v1', 'exercise_variant_v1', 'exercise_delivery_profile_v1', 'exercise_relationship_v1']],
      ['243_coaching_canonical_card_governance_v1', ['exercise_card_revision_v1', 'exercise_card_ai_draft_audit_v1', 'exercise_media_review_v1', 'exercise_card_review_v1']],
      ['252_coaching_canonical_identity_resolution_v1', ['exercise_identity_resolution_v1']],
      ['750_coaching_taxonomy_v2_foundation', ['taxonomy_term_v2', 'exercise_taxonomy_assignment_v2', 'exercise_taxonomy_decision_v2']],
    ]) {
      const sql = await migration(file)
      for (const table of tables) {
        const ddl = sql.match(new RegExp(`CREATE TABLE IF NOT EXISTS coaching\\.${table} \\([\\s\\S]+?\\n\\);`))?.[0]
        assert.ok(ddl, table); await database.query(ddl)
      }
    }
    for (const file of ['243_coaching_canonical_card_governance_v1', '244_coaching_canonical_anatomy_load_v1', '248_coaching_canonical_operational_support_v1',
      '753_coaching_canonical_structured_variant_profiles_v2', '756_coaching_media_review_verification_basis']) {
      for (const [statement] of (await migration(file)).matchAll(/ALTER TABLE coaching\.exercise_[a-z_0-9]+\s[\s\S]+?;/g)) await database.query(statement)
    }
    const stagingMigration = await migration('814_coaching_staged_card_revisions_v1')
    await database.query(stagingMigration)
    await database.query(stagingMigration)

    const setup = async () => {
      await database.query('TRUNCATE coaching.exercise_definition_v1, coaching.exercise_card_ai_draft_audit_v1 CASCADE')
      const sources = exerciseGapResearchFixtures()
      const source = stagedSourceFixture(sources)
      const hooks = { afterStagedInsert: null, beforeAdvisoryLock: null, failStagedInsert: false }
      // Released workout materials/model judgments are synthetic. All canonical
      // authoring reads, source writes, revision SQL and transactions are real.
      const pool = { async connect() {
        const client = await database.connect()
        const synthetic = await sources.pool.connect()
        return { async query(sql, params = []) {
          if (sql.includes('pg_advisory_xact_lock')) await hooks.beforeAdvisoryLock?.()
          const stagedInsert = sql.startsWith('INSERT INTO coaching.exercise_card_revision_v1 (\n    id,definition_id')
          if (stagedInsert && hooks.failStagedInsert) throw new Error('Synthetic staged history write failure')
          if (/^(BEGIN|COMMIT|ROLLBACK|SELECT pg_advisory_|INSERT INTO coaching\.|UPDATE coaching\.|DELETE FROM coaching\.)/.test(sql)
            || sql.includes('FROM coaching.exercise_card_ai_draft_audit_v1') || sql.includes('FROM coaching.exercise_card_revision_v1')
            || sql.startsWith('SELECT * FROM coaching.exercise_definition_v1') || sql.startsWith('SELECT v.* FROM coaching.exercise_variant_v1')
            || sql.startsWith('SELECT p.* FROM coaching.exercise_delivery_profile_v1') || sql.startsWith('SELECT url, exact_variant_match, demonstration_quality_score')
            || sql.startsWith('SELECT * FROM coaching.exercise_card_review_v1 WHERE definition_id')
            || sql.startsWith('SELECT r.*, fv.display_name') || sql.startsWith('SELECT assignment.*, term.facet_type')
            || sql.startsWith('SELECT decision.*') || sql.includes('FROM coaching.exercise_definition_v1 definition')) {
            const result = await client.query(sql, params)
            if (stagedInsert) await hooks.afterStagedInsert?.()
            return result
          }
          return synthetic.query(sql, params)
        }, release(error) { client.release(error); synthetic.release(error) } }
      } }
      const variant = source.variants[0], profile = variant.profiles[0]
      const seeded = await database.query(`INSERT INTO coaching.exercise_definition_v1
        (id,facility_id,slug,canonical_name,display_name,family_key,status,created_by)
        VALUES ($1,9,$2,$3,$3,$4,'draft',7) RETURNING updated_at`, [source.id, source.slug, source.canonicalName, source.familyKey])
      await database.query(`INSERT INTO coaching.exercise_variant_v1 (id,definition_id,variant_key,display_name,status)
        VALUES ($1,$2,$3,$4,'draft')`, [variant.id, source.id, variant.variantKey, variant.displayName])
      await database.query(`INSERT INTO coaching.exercise_delivery_profile_v1
        (id,variant_id,profile_key,phase_key,role,purpose,phase_suitability,quality_gate,status)
        VALUES ($1,$2,$3,$4,'primary',$5,80,$6,'draft')`, [profile.id, variant.id, profile.profileKey, profile.phaseKey, profile.purpose, profile.qualityGate])
      await withCanonicalCardTransaction(pool, SCOPE.facilityId, (client) => saveCanonicalCardDraftInTransaction(client, SCOPE.facilityId, SCOPE.userId, source,
        { definitionId: source.id, expectedUpdatedAt: seeded.rows[0].updated_at }))
      // Synthetic lifecycle fixture only; this does not claim production release eligibility.
      await database.query("UPDATE coaching.exercise_definition_v1 SET card_version=1,status='published',approved_by=8,reviewed_by=8 WHERE id=$1", [source.id])
      await database.query("UPDATE coaching.exercise_variant_v1 SET status='published' WHERE definition_id=$1", [source.id])
      await database.query("UPDATE coaching.exercise_delivery_profile_v1 SET status='published' WHERE variant_id=$1", [variant.id])
      const input = { request: sources.request, componentKey: 'strength', need: sources.need }
      const proposal = await proposeWorkoutExercise({ pool, context: SCOPE, rawInput: input, registry: stagedProposalRegistry(sources) })
      assert.equal(proposal.proposal.kind, 'delivery_profile')
      const stage = (context = SCOPE) => stageWorkoutExerciseProposal(pool, context, proposal.draftAuditId, { expectedProposalHash: proposal.contentHash })
      return { pool, sources, source, proposal, hooks, stage }
    }
    const sourceRows = async () => {
      const snapshot = {}
      for (const table of ['exercise_definition_v1', 'exercise_variant_v1', 'exercise_delivery_profile_v1', 'exercise_media_review_v1', 'exercise_card_review_v1',
        'exercise_taxonomy_assignment_v2', 'exercise_taxonomy_decision_v2', 'exercise_relationship_v1']) {
        snapshot[table] = (await database.query(`SELECT * FROM coaching.${table} ORDER BY id`)).rows
      }
      return snapshot
    }
    const profileOf = (event) => event.card.variants.find((variant) => variant.id === event.target.variantId).profiles.find((profile) => profile.profileKey === event.target.profileKey)
    const change = (state, event, action, patch = {}, userId = '7') => changeStagedCanonicalRevision(state.pool, { ...SCOPE, userId }, event.stagedRevisionId,
      { expectedEventHash: event.contentHash, action, changeSummary: 'Synthetic human review change for the exact staged profile.', ...patch })

    await t.test('staging preserves all live source rows and existing approvals while recording an exact versioned candidate', async () => {
      const state = await setup()
      const before = await sourceRows()
      const saved = await state.stage()
      assert.equal(saved.alreadyStaged, false)
      const event = saved.event
      assert.equal(event.definitionId, state.source.id)
      assert.equal(event.card.cardVersion, 2)
      assert.equal(event.source.cardVersion, 1)
      assert.equal(event.state, 'draft')
      assert.equal(event.card.status, 'draft')
      assert.equal(event.card.mediaReview, null)
      assert.equal(event.card.approvedBy, null)
      assert.equal(event.readiness.ready, false)
      assert.equal(event.libraryApprovalGranted, false)
      assert.deepEqual(event.contributorUserIds, ['7'])
      assert.equal(profileOf(event).id, null)
      assert.equal(profileOf(event).phaseKey, 'capacity')
      assert.deepEqual(await sourceRows(), before)
      assert.deepEqual(await loadWorkoutExerciseProposal(state.pool, SCOPE, state.proposal.draftAuditId), state.proposal)
      const reopened = await loadStagedCanonicalRevision(state.pool, SCOPE, event.stagedRevisionId)
      assert.equal(reopened.sourceMatches, true)
      assert.equal(reopened.liveSourceStatus, 'published')
      assert.deepEqual(reopened.event, event)
      assert.deepEqual(await loadWorkoutExerciseProposalRevision(state.pool, SCOPE, state.proposal.draftAuditId), event)
      assert.equal(await loadWorkoutExerciseProposalRevision(state.pool, { ...SCOPE, facilityId: '10' }, state.proposal.draftAuditId), null)
      assert.equal(await loadStagedCanonicalRevision(state.pool, { ...SCOPE, facilityId: '10' }, event.stagedRevisionId), null)
    })

    await t.test('concurrent staging recovers one aggregate and original accepting actor', async () => {
      const state = await setup()
      let unblock
      const entered = new Promise((resolve) => { unblock = resolve })
      let locks = 0
      state.hooks.beforeAdvisoryLock = () => { if (++locks === 2) unblock() }
      state.hooks.afterStagedInsert = () => entered
      const results = await Promise.all([state.stage(), state.stage({ ...SCOPE, userId: '8' })])
      assert.equal(results[0].event.stagedRevisionId, results[1].event.stagedRevisionId)
      assert.deepEqual(results[0].event, results[1].event)
      assert.deepEqual(new Set(results.map((result) => result.alreadyStaged)), new Set([true, false]))
      assert.ok(locks >= 3)
      assert.equal((await database.query('SELECT count(*)::int AS count FROM coaching.exercise_card_revision_v1 WHERE staged_revision_id IS NOT NULL')).rows[0].count, 1)
    })

    await t.test('human edits and review transitions append history, preserve base content and retain every contributor', async () => {
      const state = await setup(), initial = (await state.stage()).event
      const before = await sourceRows()
      const edited = await change(state, initial, 'edit', { profile: { ...profileOf(initial), coachInstructions: 'Coach edited instructions with observed movement-specific feedback.' } }, '8')
      assert.equal(edited.parentEventId, initial.eventId)
      assert.deepEqual(edited.contributorUserIds, ['7', '8'])
      assert.equal(edited.source.contentHash, initial.source.contentHash)
      assert.deepEqual(edited.sourceCard, initial.sourceCard)
      assert.equal(edited.card.variants[0].profiles.length, initial.card.variants[0].profiles.length)
      await assert.rejects(change(state, initial, 'submit'), { code: 'canonical_revision_conflict' })
      const submitted = await change(state, edited, 'submit')
      assert.equal(submitted.state, 'review')
      assert.equal(submitted.readiness.ready, false)
      const returned = await change(state, submitted, 'return')
      assert.equal(returned.state, 'draft')
      const archived = await change(state, returned, 'archive')
      assert.equal(archived.state, 'archived')
      await assert.rejects(change(state, archived, 'submit'), { code: 'canonical_revision_transition' })
      assert.deepEqual(await sourceRows(), before)
      assert.equal((await state.stage()).event.eventId, archived.eventId)
      const history = (await database.query('SELECT id,snapshot_json FROM coaching.exercise_card_revision_v1 WHERE staged_revision_id=$1 ORDER BY revision_number', [initial.stagedRevisionId])).rows
      assert.equal(history.length, 5)
      assert.equal(history[0].snapshot_json.contentHash, initial.contentHash)
      assert.equal(history.at(-1).snapshot_json.contentHash, archived.contentHash)
    })

    await t.test('source changes are visible on reopen and block edits or submission while still allowing archival', async () => {
      const state = await setup(), event = (await state.stage()).event
      await database.query("UPDATE coaching.exercise_definition_v1 SET description='Synthetic source changed without a version bump.' WHERE id=$1", [event.definitionId])
      const reopened = await loadStagedCanonicalRevision(state.pool, SCOPE, event.stagedRevisionId)
      assert.equal(reopened.sourceMatches, false)
      await assert.rejects(change(state, event, 'submit'), { code: 'canonical_revision_source_changed' })
      assert.equal((await change(state, event, 'archive')).state, 'archived')
    })

    await t.test('invalid profile identity, dosage and equipment edits do not append a staged event', async () => {
      const state = await setup(), event = (await state.stage()).event
      for (const patch of [{ phaseKey: 'restore' }, { profileKey: 'different-profile' }, { role: 'avoid' }, { equipmentRequired: ['invented-equipment'] },
        { dosage: { sets: [3, 1], reps: [3, 5], workSeconds: null, restSeconds: 60 } },
        { dosage: { sets: [1, 11], reps: [3, 5], workSeconds: null, restSeconds: 60 } }]) {
        await assert.rejects(change(state, event, 'edit', { profile: { ...profileOf(event), ...patch } }), TypeError)
      }
      assert.equal((await loadStagedCanonicalRevision(state.pool, SCOPE, event.stagedRevisionId)).event.contentHash, event.contentHash)
    })

    await t.test('client-supplied taxonomy approval claims become suggested classifications with server-owned provenance', async () => {
      const state = await setup(), event = (await state.stage()).event
      const profile = { ...profileOf(event), taxonomyV2: { assignments: [], decisions: [{ facetType: 'tenet', scope: 'delivery_profile',
        decision: 'not_applicable', rationale: 'Synthetic classification explanation requiring independent review.', confidence: 90,
        reviewStatus: 'approved', createdBy: 9, reviewedBy: 9, reviewedAt: '2026-09-13T00:00:00Z',
        provenance: { approvalCreated: true, humanReviewRequired: false } }] } }
      const edited = await change(state, event, 'edit', { profile }, '8')
      const decision = profileOf(edited).taxonomyV2.decisions[0]
      assert.equal(decision.reviewStatus, 'suggested')
      assert.equal(decision.createdBy, undefined)
      assert.equal(decision.provenance.proposedBy, '8')
      assert.equal(decision.reviewedBy, undefined)
      assert.equal(decision.reviewedAt, undefined)
      assert.equal(decision.provenance.approvalCreated, false)
      assert.equal(decision.provenance.humanReviewRequired, true)
      assert.equal(edited.readiness.ready, false)
      assert.equal((await database.query('SELECT count(*)::int AS count FROM coaching.exercise_taxonomy_decision_v2')).rows[0].count, 0)
    })

    await t.test('concurrent profile edits with the same expected event cannot overwrite each other', async () => {
      const state = await setup(), event = (await state.stage()).event
      let unblock
      const entered = new Promise((resolve) => { unblock = resolve })
      let locks = 0
      state.hooks.beforeAdvisoryLock = () => { if (++locks === 2) unblock() }
      state.hooks.afterStagedInsert = () => entered
      const edits = await Promise.allSettled(['7', '8'].map((userId) => change(state, event, 'edit', {
        profile: { ...profileOf(event), coachInstructions: `Synthetic distinct coaching edit by authenticated user ${userId}.` },
      }, userId)))
      assert.equal(edits.filter((entry) => entry.status === 'fulfilled').length, 1)
      assert.equal(edits.find((entry) => entry.status === 'rejected').reason.code, 'canonical_revision_conflict')
      const current = (await loadStagedCanonicalRevision(state.pool, SCOPE, event.stagedRevisionId)).event
      assert.equal(current.eventId, edits.find((entry) => entry.status === 'fulfilled').value.eventId)
      assert.equal((await database.query('SELECT count(*)::int AS count FROM coaching.exercise_card_revision_v1 WHERE staged_revision_id=$1', [event.stagedRevisionId])).rows[0].count, 2)
    })

    await t.test('staged history write failure rolls back and remains retryable; audit tampering is detected', async () => {
      const state = await setup()
      const before = await sourceRows()
      state.hooks.failStagedInsert = true
      await assert.rejects(state.stage(), /Synthetic staged history write failure/)
      assert.deepEqual(await sourceRows(), before)
      assert.equal((await database.query('SELECT count(*)::int AS count FROM coaching.exercise_card_revision_v1 WHERE staged_revision_id IS NOT NULL')).rows[0].count, 0)
      state.hooks.failStagedInsert = false
      const event = (await state.stage()).event
      await database.query("UPDATE coaching.exercise_card_revision_v1 SET snapshot_json=jsonb_set(snapshot_json,'{card,description}','\"tampered\"'::jsonb) WHERE id=$1", [event.eventId])
      await assert.rejects(loadStagedCanonicalRevision(state.pool, SCOPE, event.stagedRevisionId), { code: 'canonical_revision_audit_conflict' })
      const source = await withCanonicalCardTransaction(state.pool, SCOPE.facilityId, (client) => loadCanonicalCard(client, SCOPE.facilityId, state.source.id, client))
      assert.equal(source.status, 'published')
    })
  } finally { await database.end() }
})
