import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import pg from 'pg'
import { withCoachingLibrarySnapshot } from '../coachingLibraryContext.js'
import { loadWorkoutAthleteEvidence, loadWorkoutAthleteEvidenceChoices } from '../workoutAthleteEvidence.js'
import { rosterRequest } from './workoutAthleteEvidenceFixtures.js'
import { SCOPE } from './workoutProgrammingLibrarianFixtures.js'

const connectionString = process.env.WORKOUT_PROGRAMMING_TEST_DATABASE_URL
test('actual PostgreSQL athlete observations are scoped, read-only, versioned and bounded', { skip: !connectionString }, async (t) => {
  const target = new URL(connectionString)
  assert.ok(['postgres:', 'postgresql:'].includes(target.protocol))
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))
  assert.match(target.pathname, /^\/vortex_programming_test_[a-z0-9_]+$/)
  assert.equal([...target.searchParams].length, 0)
  const pool = new pg.Pool({ connectionString })
  try {
    // Only an empty disposable database is accepted. No reset/drop is performed.
    await pool.query(`CREATE SCHEMA coaching;
      CREATE TABLE public.facility (id BIGINT PRIMARY KEY);
      CREATE TABLE public.app_user (id BIGINT PRIMARY KEY, facility_id BIGINT NOT NULL);
      CREATE TABLE public.member (id BIGINT PRIMARY KEY, facility_id BIGINT NOT NULL, date_of_birth DATE, email TEXT, medical_notes TEXT);
      CREATE TABLE coaching.sport (id BIGINT PRIMARY KEY);
      CREATE TABLE coaching.tenet (id BIGINT PRIMARY KEY);
      CREATE TABLE coaching.exercise (id BIGINT PRIMARY KEY, facility_id BIGINT NOT NULL, name TEXT);
      CREATE TABLE coaching.workout (id BIGINT PRIMARY KEY, facility_id BIGINT NOT NULL);
      CREATE TABLE coaching.training_program (id BIGINT PRIMARY KEY);
      CREATE TABLE coaching.training_program_week (id BIGINT PRIMARY KEY);
      INSERT INTO public.facility VALUES (9), (10);
      INSERT INTO public.app_user VALUES (7, 9), (8, 10);
      INSERT INTO public.member VALUES (101, 9, CURRENT_DATE - INTERVAL '13 years', 'private@example.test', 'Excluded private field'),
        (102, 9, CURRENT_DATE - INTERVAL '13 years', NULL, NULL), (999, 10, CURRENT_DATE - INTERVAL '13 years', NULL, NULL);
      INSERT INTO coaching.exercise VALUES (1, 9, 'Reviewed landing'), (2, 10, 'Foreign exercise');
      INSERT INTO coaching.workout VALUES (501, 9), (502, 10);`)
    for (const filename of ['016_coaching_assessments_grading.sql', '017_coaching_assignments_sharing.sql',
      '021_coaching_sessions_attendance.sql', '022_coaching_periodization_load.sql', '427_coaching_gymnastics_evaluations.sql']) {
      await pool.query(await readFile(new URL(`../../migrations/${filename}`, import.meta.url), 'utf8'))
    }
    await pool.query(`INSERT INTO coaching.assessment (id, facility_id, name) VALUES (1, 9, 'Landing observation'), (2, 10, 'Foreign assessment');
      INSERT INTO coaching.assessment_result (id, assessment_id, member_id, value_numeric, coach_user_id, tested_at) VALUES
        (61, 1, 101, 4, 7, CURRENT_TIMESTAMP - INTERVAL '1 day'), (62, 2, 101, 5, 8, CURRENT_TIMESTAMP - INTERVAL '1 day'),
        (63, 1, 101, 5, 8, CURRENT_TIMESTAMP - INTERVAL '1 day');
      INSERT INTO coaching.athlete_skill_progress (id, member_id, exercise_id, score, max_score, coach_user_id, graded_at) VALUES
        (71, 101, 1, 4, 5, 7, CURRENT_TIMESTAMP - INTERVAL '1 day'), (72, 101, 2, 5, 5, 8, CURRENT_TIMESTAMP - INTERVAL '1 day');
      INSERT INTO coaching.wellness_checkin (id, facility_id, member_id, checkin_date, energy) VALUES (81, 9, 101, CURRENT_DATE, 7), (82, 10, 999, CURRENT_DATE, 9);
      INSERT INTO coaching.session (id, facility_id, coach_user_id, workout_id, session_date, status) VALUES
        (301, 9, 7, 501, CURRENT_DATE - 1, 'completed'), (302, 10, 8, 502, CURRENT_DATE - 1, 'completed'),
        (303, 9, 7, 501, CURRENT_DATE + 1, 'planned');
      INSERT INTO coaching.session_attendance (session_id, member_id, status) VALUES (301, 101, 'present'), (302, 101, 'present'), (303, 101, 'present');
      INSERT INTO coaching.completion_log (id, member_id, workout_id, exercise_id, session_id, status, reps, time_seconds, rpe, logged_at) VALUES
        (91, 101, 501, 1, 301, 'partial', 8, 120, 5, CURRENT_TIMESTAMP - INTERVAL '1 day'),
        (92, 101, 502, 2, 302, 'completed', 10, 150, 6, CURRENT_TIMESTAMP - INTERVAL '1 day');
      INSERT INTO coaching.gymnastics_evaluation (id, facility_id, member_id, coach_user_id, report) VALUES
        (401, 9, 101, 7, '{"recipientEmail":"never-load@example.test"}'), (402, 10, 101, 8, '{}'), (403, 9, 101, 8, '{}');
      INSERT INTO coaching.gymnastics_evaluation_movement (id, evaluation_id, movement_key, movement_label) VALUES (1, 401, 'landing', 'Landing');
      INSERT INTO coaching.gymnastics_evaluation_component (id, movement_evaluation_id, component_key, component_label, score) VALUES (1, 1, 'control', 'Control', 4);
      INSERT INTO coaching.gymnastics_evaluation_issue (component_evaluation_id, issue_label) VALUES (1, 'Hold the finish');`)
    const base = rosterRequest()
    const request = rosterRequest({ athletes: [{ ...base.athletes[0], evidenceReferences: [
      ['skill_progress', '71'], ['assessment_result', '61'], ['wellness_checkin', '81'],
      ['session', '301'], ['completion_log', '91'], ['gymnastics_evaluation', '401'],
    ].map(([kind, id]) => ({ kind, id, memberId: '101' })) }] })
    const load = (input = request) => withCoachingLibrarySnapshot(pool, SCOPE, (client, scope) => loadWorkoutAthleteEvidence(client, scope, input))
    await t.test('every actual source hydrates, preserving reported work and separating future plans from completion', async () => {
      const evidence = await load()
      assert.equal(evidence.status, 'HYDRATED', JSON.stringify(evidence.findings))
      assert.equal(evidence.observations.length, 7)
      assert.equal(evidence.prerequisiteStatus, 'NOT_ESTABLISHED')
      assert.equal(evidence.observations.find((entry) => entry.kind === 'gymnastics_evaluation').data.components[0].score, 4)
      assert.equal(evidence.observations.find((entry) => entry.kind === 'session' && entry.id === '303').data.status, 'planned')
      assert.equal(evidence.observations.find((entry) => entry.kind === 'completion_log').data.status, 'partial')
      const serialized = JSON.stringify(evidence)
      assert.ok(!serialized.includes('private@example'))
      assert.ok(!serialized.includes('Excluded private'))
      assert.ok(!serialized.includes('never-load@example'))
      assert.equal((await load()).contentHash, evidence.contentHash)
      const otherTimeZone = await withCoachingLibrarySnapshot(pool, SCOPE, async (client, scope) => {
        await client.query("SET LOCAL TimeZone = 'Pacific/Honolulu'")
        return loadWorkoutAthleteEvidence(client, scope, request)
      })
      assert.equal(otherTimeZone.contentHash, evidence.contentHash)
      await assert.rejects(withCoachingLibrarySnapshot(pool, SCOPE, (client) => client.query('UPDATE coaching.wellness_checkin SET energy = 1 WHERE id = 81')), { code: '25006' })
    })
    await t.test('foreign source definitions, mismatched members and foreign roster IDs cannot hydrate', async () => {
      const invalid = rosterRequest({ athletes: [{ ...base.athletes[0], evidenceReferences: [
        ['skill_progress', '72', '101'], ['assessment_result', '62', '101'], ['wellness_checkin', '82', '101'],
        ['session', '302', '101'], ['completion_log', '92', '101'], ['gymnastics_evaluation', '402', '101'],
        ['skill_progress', '71', '102'],
        ['assessment_result', '63', '101'], ['gymnastics_evaluation', '403', '101'],
      ].map(([kind, id, memberId]) => ({ kind, id, memberId })) }] })
      assert.equal((await load(invalid)).findings.filter((entry) => entry.code === 'unavailable_athlete_evidence').length, 9)
      const foreignRoster = rosterRequest({ athletes: [{ ...base.athletes[0], memberIds: ['101', '999'] }] })
      assert.ok((await load(foreignRoster)).findings.some((entry) => entry.code === 'unavailable_cohort_member'))
    })
    await t.test('coach evidence discovery uses the same facility, source-owner and publication boundaries', async () => {
      const evidence = await load()
      for (const [kind, expectedId] of [['skill_progress', '71'], ['assessment_result', '61'], ['gymnastics_evaluation', '401']]) {
        const choices = await withCoachingLibrarySnapshot(pool, SCOPE, (client, scope) => loadWorkoutAthleteEvidenceChoices(client, scope,
          { memberId: '101', kind, asOfDate: evidence.referenceDate }))
        assert.deepEqual(choices.map((entry) => entry.id), [expectedId])
        assert.equal(choices[0].sourceHash, evidence.observations.find((entry) => entry.kind === kind && entry.id === expectedId).sourceHash)
        const foreign = await withCoachingLibrarySnapshot(pool, SCOPE, (client, scope) => loadWorkoutAthleteEvidenceChoices(client, scope,
          { memberId: '999', kind, asOfDate: evidence.referenceDate }))
        assert.deepEqual(foreign, [])
      }
    })
    await t.test('changed and future observations plus truncated history remain reviewable evidence', async () => {
      const original = await load()
      await pool.query('UPDATE coaching.wellness_checkin SET energy = 2, updated_at = CURRENT_TIMESTAMP WHERE id = 81')
      assert.notEqual((await load()).contentHash, original.contentHash)
      await pool.query(`UPDATE coaching.assessment_result SET tested_at = CURRENT_TIMESTAMP + INTERVAL '1 hour' WHERE id = 61;
        INSERT INTO coaching.completion_log (member_id, workout_id, status, logged_at)
        SELECT 101, 501, 'completed', CURRENT_TIMESTAMP - INTERVAL '2 days' FROM generate_series(1, 26);`)
      const evidence = await load()
      assert.ok(evidence.findings.some((entry) => entry.code === 'future_athlete_observation'))
      assert.ok(evidence.findings.some((entry) => entry.code === 'athlete_history_truncated'))
      assert.equal(evidence.status, 'NEEDS_COACH_REVIEW')
    })
  } finally { await pool.end() }
})
