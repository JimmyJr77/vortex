import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import pg from 'pg'
import { classDetail, listClasses } from '../reads.js'

test('class catalog includes archived classes and children of archived programs only when requested', {
  skip: process.env.RUN_ARCHIVE_LOCAL_TEST !== 'true',
}, async () => {
  const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
    || `postgresql://${os.userInfo().username}@127.0.0.1:5432/vortex_new_admin_dev`
  const url = new URL(connectionString)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.search || url.hash || !/^\/vortex_new_admin_dev(?:_[a-z0-9_]+)?$/.test(url.pathname)) {
    throw new Error('Isolated local test database required')
  }
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    const facility = (await db.query("INSERT INTO facility(name,timezone) VALUES ('Archive visibility regression','America/New_York') RETURNING id")).rows[0].id
    const parent = async (name, archived) => (await db.query(
      'INSERT INTO programs(facility_id,name,display_name,archived) VALUES($1,$2,$2,$3) RETURNING id',
      [facility, name, archived],
    )).rows[0].id
    const archivedProgram = await parent('Vortex Ninja regression', true)
    const visibleProgram = await parent('Visible program regression', false)
    const klass = async (name, programsId, archived, active) => (await db.query(
      `INSERT INTO program(facility_id,programs_id,category,name,display_name,archived,is_active)
       VALUES($1,$2,(enum_range(NULL::program_category))[1],$3,$3,$4,$5) RETURNING id`,
      [facility, programsId, name, archived, active],
    )).rows[0].id
    // Historical parent-only archives can leave unarchived child rows behind.
    const hiddenChild = await klass('A hidden child', archivedProgram, false, false)
    const archivedClass = await klass('B archived class', visibleProgram, true, false)
    const visible = await klass('C visible class', visibleProgram, false, true)
    const unassigned = await klass('D unassigned class', null, false, false)
    const first = await listClasses(db, facility, { pageSize: 1 })
    assert.equal(first.total, 2)
    assert.deepEqual(first.rows.map(row => row.id), [Number(visible)])
    const second = await listClasses(db, facility, { pageSize: 1, page: 2 })
    assert.deepEqual(second.rows.map(row => row.id), [Number(unassigned)])
    const search = await listClasses(db, facility, { search: 'Vortex Ninja regression' })
    assert.equal(search.total, 0)
    assert.deepEqual(search.rows, [])
    const all = await listClasses(db, facility, {}, { includeArchived: true })
    assert.equal(all.total, 4)
    assert.deepEqual(all.rows.map(row => [row.id, row.archived]), [
      [Number(hiddenChild), true], [Number(archivedClass), true],
      [Number(visible), false], [Number(unassigned), false],
    ])
    const archivedSearch = await listClasses(db, facility, { search: 'Vortex Ninja regression', pageSize: 1 }, { includeArchived: true })
    assert.deepEqual(archivedSearch.rows.map(row => row.id), [Number(hiddenChild)])
    assert.equal((await classDetail(db, facility, hiddenChild)).class.archived, true)
    assert.equal((await classDetail(db, facility, archivedClass)).class.archived, true)
    assert.equal((await classDetail(db, facility, unassigned)).class.archived, false)
    assert.equal((await db.query('SELECT archived FROM program WHERE programs_id=$1', [archivedProgram])).rows[0].archived, false)
  } finally {
    await db.query('ROLLBACK')
    await db.end()
  }
})
