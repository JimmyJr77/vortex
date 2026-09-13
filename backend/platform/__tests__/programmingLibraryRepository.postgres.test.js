import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import pg from 'pg'
import { loadProgrammingLibraryPage } from '../programmingLibraryRepository.js'
import { withCoachingLibrarySnapshot } from '../coachingLibraryContext.js'

const connectionString = process.env.WORKOUT_PROGRAMMING_TEST_DATABASE_URL

test('programming librarians isolate facilities, publication, visibility and snapshot reads in PostgreSQL', { skip: !connectionString }, async (t) => {
  const target = new URL(connectionString)
  assert.ok(['postgres:', 'postgresql:'].includes(target.protocol))
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'only a disposable loopback database is allowed')
  assert.match(target.pathname, /^\/vortex_programming_test_[a-z0-9_]+$/)
  assert.equal([...target.searchParams].length, 0, 'connection target overrides are forbidden')
  const pool = new pg.Pool({ connectionString })
  try {
    // No DROP/reset: this test requires an empty, dedicated disposable database.
    await pool.query(`
      CREATE SCHEMA coaching;
      CREATE TABLE public.facility (id BIGINT PRIMARY KEY);
      CREATE TABLE public.app_user (id BIGINT PRIMARY KEY);
      CREATE TYPE public.skill_level AS ENUM ('BEGINNER','INTERMEDIATE','ADVANCED');
      INSERT INTO public.facility VALUES (9),(10);
      INSERT INTO public.app_user VALUES (7),(8);
    `)
    await pool.query(await readFile(new URL('../../migrations/138_coaching_programming_library_infrastructure.sql', import.meta.url), 'utf8'))
    await pool.query(await readFile(new URL('../../migrations/752_coaching_programming_experience_and_aerobic_zones.sql', import.meta.url), 'utf8'))
    await pool.query(`
      INSERT INTO coaching.programming_method
        (id,facility_id,name,slug,category,best_session_phase,created_by,is_published,visibility,archived)
      VALUES
        (1,9,'A Facility','a','strength','capacity',8,true,'facility',false),
        (2,9,'B Own Private','b','strength','capacity',7,true,'private',false),
        (3,9,'C Other Private','c','strength','capacity',8,true,'private',false),
        (4,9,'D Own Draft','d','strength','capacity',7,false,'facility',false),
        (5,9,'E Other Draft','e','strength','capacity',8,false,'facility',false),
        (6,10,'F Other Facility','f','strength','capacity',7,true,'facility',false),
        (7,9,'G Archived','g','strength','capacity',7,true,'facility',true);
      INSERT INTO coaching.programming_method_phase_profile (programming_method_id,phase_key,role,fit_weight)
        VALUES (1,'capacity','primary',5),(2,'capacity','secondary',4);
    `)
    const scope = { facilityId: 9, userId: 7 }
    await t.test('published generation pool excludes foreign, private, draft and archived records', async () => {
      const page = await loadProgrammingLibraryPage(pool, scope)
      assert.deepEqual(page.methods.map((method) => String(method.id)), ['1', '2'])
      assert.equal(page.methods[0].phase_profiles[0].role, 'primary')
      assert.deepEqual((await loadProgrammingLibraryPage(pool, { facilityId: 10, userId: 7 })).methods.map((method) => String(method.id)), ['6'])
    })
    await t.test('coach editor retains only its own additional drafts and stable pagination', async () => {
      assert.deepEqual((await loadProgrammingLibraryPage(pool, scope, { includeOwnDrafts: true })).methods.map((method) => String(method.id)), ['1', '2', '4'])
      const first = await loadProgrammingLibraryPage(pool, scope, { limit: 1 })
      assert.equal(first.hasMore, true)
      assert.deepEqual((await loadProgrammingLibraryPage(pool, scope, { offset: first.nextOffset, limit: 1 })).methods.map((method) => String(method.id)), ['2'])
      assert.equal((await loadProgrammingLibraryPage(pool, scope, { q: "' OR TRUE --" })).methods.length, 0)
    })
    await t.test('librarian transactions forbid writes and preserve a consistent release-era view', async () => {
      await assert.rejects(withCoachingLibrarySnapshot(pool, scope, (client) => client.query('DELETE FROM coaching.programming_method')), (error) => error.code === '25006')
      await withCoachingLibrarySnapshot(pool, scope, async (client, context) => {
        const first = await loadProgrammingLibraryPage(client, context)
        await pool.query('UPDATE coaching.programming_method SET is_published=false WHERE id=1')
        const second = await loadProgrammingLibraryPage(client, context)
        assert.deepEqual(second, first)
      })
      assert.deepEqual((await loadProgrammingLibraryPage(pool, scope)).methods.map((method) => String(method.id)), ['2'])
    })
  } finally {
    await pool.end()
  }
})
