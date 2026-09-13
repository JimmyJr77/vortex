import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import pg from 'pg'
import { loadPublishedProgrammingMethods } from '../programmingLibraryRepository.js'
import { withCoachingLibrarySnapshot } from '../coachingLibraryContext.js'
import { selectProgrammingMethodPrescription, resolveProgrammingMethodClock } from '../programmingMethodClock.js'
import { executionRequest } from './workoutProgrammingExecutionFixtures.js'

const connectionString = process.env.WORKOUT_PROGRAMMING_TEST_DATABASE_URL
test('seeded programming clocks hydrate actual PostgreSQL audience profiles, rules and compatibility', { skip: !connectionString }, async (t) => {
  const target = new URL(connectionString)
  assert.ok(['postgres:', 'postgresql:'].includes(target.protocol))
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))
  assert.match(target.pathname, /^\/vortex_programming_test_[a-z0-9_]+$/)
  assert.equal([...target.searchParams].length, 0)
  const pool = new pg.Pool({ connectionString })
  try {
    // No reset/drop; only a fresh, dedicated disposable database is accepted.
    await pool.query(`CREATE SCHEMA coaching;
      CREATE TABLE public.facility (id BIGINT PRIMARY KEY);
      CREATE TABLE public.app_user (id BIGINT PRIMARY KEY);
      CREATE TYPE public.skill_level AS ENUM ('BEGINNER','INTERMEDIATE','ADVANCED');
      INSERT INTO public.facility VALUES (9); INSERT INTO public.app_user VALUES (7);`)
    for (const filename of ['138_coaching_programming_library_infrastructure.sql', '141_coaching_programming_library_seed.sql', '752_coaching_programming_experience_and_aerobic_zones.sql']) {
      await pool.query(await readFile(new URL(`../../migrations/${filename}`, import.meta.url), 'utf8'))
    }
    const snapshot = await withCoachingLibrarySnapshot(pool, { facilityId: 9, userId: 7 }, (client, scope) => loadPublishedProgrammingMethods(client, scope))
    assert.equal(snapshot.methods.length, 50)
    assert.equal(snapshot.searchComplete, true)
    await t.test('audience names survive SQL hydration and choose the actual intermediate EMOM prescription', () => {
      const method = snapshot.methods.find((entry) => entry.slug === 'emom')
      const selection = selectProgrammingMethodPrescription(method, executionRequest())
      assert.equal(selection.profile.training_experience, null)
      assert.equal(selection.profile.profile_name, 'intermediate')
      assert.equal(selection.audience.source, 'profile_name')
      const clock = resolveProgrammingMethodClock(method, selection)
      assert.deepEqual([clock.targetSets, clock.workSeconds, clock.restSeconds, clock.domainSeconds], [12, 25, 35, 720])
      assert.ok(method.validator_rules.some((entry) => entry.conditionJson.estimated_work_seconds_gt === 45))
      assert.equal(method.quality_standards.length, 5)
    })
    await t.test('real seed conflicts and absent compatibility mappings remain explicit source findings', () => {
      const tabata = snapshot.methods.find((entry) => entry.slug === 'tabata-style-interval')
      assert.throws(() => resolveProgrammingMethodClock(tabata, selectProgrammingMethodPrescription(tabata, executionRequest())), { code: 'method_clock_domain_conflict' })
      const interval = snapshot.methods.find((entry) => entry.slug === 'simple-work-rest-intervals')
      assert.ok(interval.exercise_compat_rows.length > 0)
      assert.ok(interval.exercise_compat_rows.every((entry) => entry.facet_type === null && entry.facet_key === null))
    })
    const totals = { supported: 0, unsupported: 0, sourceConflict: 0 }
    for (const method of snapshot.methods) for (const experience of ['beginner', 'intermediate', 'advanced']) {
      const base = executionRequest()
      const request = executionRequest({ athletes: base.athletes.map((entry) => ({ ...entry, trainingExperience: experience })) })
      try {
        const clock = resolveProgrammingMethodClock(method, selectProgrammingMethodPrescription(method, request))
        totals[clock.kind === 'unsupported' ? 'unsupported' : 'supported'] += 1
      } catch (error) {
        assert.ok(['method_clock_domain_conflict', 'method_minute_clock_conflict', 'method_clock_source_conflict', 'method_intensity_source_conflict'].includes(error.code), error.message)
        totals.sourceConflict += 1
      }
    }
    t.diagnostic(`Actual seed audience-clock inventory: ${JSON.stringify(totals)}`)
  } finally { await pool.end() }
})
