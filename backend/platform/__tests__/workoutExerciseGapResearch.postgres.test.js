import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { loadCanonicalExerciseResearchCatalog } from '../canonicalExerciseResearchRepository.js'
import { withCoachingLibrarySnapshot } from '../coachingLibraryContext.js'
import { programmingValueHash } from '../workoutProgrammingRequest.js'
import { SCOPE, uuid } from './workoutProgrammingLibrarianFixtures.js'
const connectionString = process.env.WORKOUT_PROGRAMMING_TEST_DATABASE_URL

test('gap research reads real canonical lifecycle DDL with facility isolation and complete snapshot pagination', { skip: !connectionString }, async (t) => {
  const target = new URL(connectionString)
  assert.ok(['postgres:', 'postgresql:'].includes(target.protocol))
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))
  assert.match(target.pathname, /^\/vortex_programming_test_[a-z0-9_]+$/)
  assert.equal([...target.searchParams].length, 0)
  const pool = new pg.Pool({ connectionString })
  try {
    // Exact canonical DDL in an empty disposable database; no production rows or approvals.
    await pool.query(`CREATE SCHEMA coaching;
      CREATE TABLE public.facility (id BIGINT PRIMARY KEY);
      CREATE TABLE public.app_user (id BIGINT PRIMARY KEY);
      CREATE TABLE coaching.exercise (id BIGINT PRIMARY KEY);
      INSERT INTO public.facility VALUES (9),(10);`)
    const migration = await readFile(new URL('../../migrations/241_coaching_canonical_workout_model_v1.sql', import.meta.url), 'utf8')
    for (const table of ['exercise_definition_v1', 'exercise_variant_v1', 'exercise_delivery_profile_v1']) {
      const ddl = migration.match(new RegExp(`CREATE TABLE IF NOT EXISTS coaching\\.${table} \\([\\s\\S]+?\\n\\);`))?.[0]
      assert.ok(ddl)
      await pool.query(ddl)
    }
    const states = ['draft', 'review', 'published', 'deprecated', 'archived']
    const records = Array.from({ length: 505 }, (_, index) => ({ id: uuid(index + 1), facility: 9,
      name: `Synthetic research drill ${index + 1}`, status: states[index % states.length] }))
    records.push({ id: uuid(9999), facility: 10, name: 'Foreign private draft', status: 'draft' })
    const insert = async (entries) => pool.query(`INSERT INTO coaching.exercise_definition_v1
      (id,facility_id,slug,canonical_name,display_name,family_key,status,aliases,movement_patterns,body_regions)
      SELECT id::uuid,facility,id,name,name,'synthetic',status,ARRAY['alias ' || name],ARRAY['hinge'],ARRAY['lower_body']
      FROM jsonb_to_recordset($1::jsonb) AS entry(id TEXT,facility BIGINT,name TEXT,status TEXT)`, [JSON.stringify(entries)])
    await insert(records)
    await pool.query(`INSERT INTO coaching.exercise_variant_v1 (id,definition_id,variant_key,display_name,status)
      VALUES ($1,$2,'synthetic-variant','Synthetic variant','review')`, [uuid(11001), uuid(1)])
    await pool.query(`INSERT INTO coaching.exercise_delivery_profile_v1
      (id,variant_id,profile_key,phase_key,role,purpose,phase_suitability,quality_gate,status,equipment_required)
      VALUES ($1,$3,'strength','capacity','primary','Synthetic strength delivery',80,'Stop at quality loss','draft',ARRAY['barbell']),
             ($2,$3,'avoid-strength','capacity','avoid','Synthetic excluded delivery',20,'Stop at quality loss','archived',ARRAY[]::TEXT[])`,
    [uuid(12001), uuid(12002), uuid(11001)])
    const load = () => withCoachingLibrarySnapshot(pool, SCOPE, (client, scope) => loadCanonicalExerciseResearchCatalog(client, scope.facilityId))
    await t.test('all lifecycle states, aliases, empty definitions and nonpublished profiles survive pagination', async () => {
      const result = await load()
      assert.equal(result.searchComplete, true)
      assert.equal(result.rows.length, 506)
      assert.equal(new Set(result.rows.map((row) => row.definition_id)).size, 505)
      assert.deepEqual(new Set(result.rows.map((row) => row.definition_status)), new Set(states))
      const first = result.rows.filter((row) => row.definition_id === uuid(1))
      assert.equal(first.length, 2)
      assert.deepEqual(new Set(first.map((row) => row.profile_status)), new Set(['draft', 'archived']))
      assert.deepEqual(first[0].aliases, ['alias Synthetic research drill 1'])
      assert.equal(first[0].phase_key, 'capacity') // Existing phase vocabulary; this remains Strength.
      assert.equal(typeof first[0].definition_updated_at, 'string')
      assert.equal(typeof first[0].variant_updated_at, 'string')
      assert.equal(typeof first[0].profile_updated_at, 'string')
      assert.ok(result.rows.some((row) => row.variant_id === null && row.profile_id === null))
      assert.ok(result.rows.every((row) => row.definition_id !== uuid(9999)))
      const foreign = await withCoachingLibrarySnapshot(pool, { ...SCOPE, facilityId: '10' }, (client, scope) => loadCanonicalExerciseResearchCatalog(client, scope.facilityId))
      assert.deepEqual(foreign.rows.map((row) => row.definition_id), [uuid(9999)])
    })
    await t.test('a concurrent new draft cannot alter a running research snapshot but appears in the next read', async () => {
      let previousHash
      await withCoachingLibrarySnapshot(pool, SCOPE, async (client, scope) => {
        assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on')
        const first = await loadCanonicalExerciseResearchCatalog(client, scope.facilityId)
        previousHash = programmingValueHash(first.rows)
        await insert([{ id: uuid(8000), facility: 9, name: 'New concurrent draft', status: 'draft' }])
        assert.equal(programmingValueHash((await loadCanonicalExerciseResearchCatalog(client, scope.facilityId)).rows), previousHash)
      })
      const current = await load()
      assert.equal(current.rows.length, 507)
      assert.notEqual(programmingValueHash(current.rows), previousHash)
      assert.equal((await pool.query('SELECT count(*)::int AS total FROM coaching.exercise_definition_v1 WHERE approved_by IS NOT NULL')).rows[0].total, 0)
    })
    await t.test('metadata-only update timestamps invalidate the source hash without inventing a new card version', async () => {
      const before = await load()
      await pool.query("UPDATE coaching.exercise_variant_v1 SET updated_at=updated_at + interval '1 second' WHERE id=$1", [uuid(11001)])
      const after = await load()
      assert.notEqual(programmingValueHash(before.rows), programmingValueHash(after.rows))
      assert.equal(before.rows[0].card_version, after.rows[0].card_version)
    })
  } finally { await pool.end() }
})
