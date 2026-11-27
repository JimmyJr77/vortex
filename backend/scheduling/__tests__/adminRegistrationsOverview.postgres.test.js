import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { buildAdminClassRegistrationSummaries } from '../adminRegistrationsOverview.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) {
  const url = new URL(connectionString)
  if (process.env.NODE_ENV === 'production' || !['postgres:', 'postgresql:'].includes(url.protocol)
      || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.search || url.hash
      || !/^vortex_new_admin_dev(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(url.pathname.slice(1)))) {
    throw new Error('Monthly enrollment tests require an isolated local vortex_new_admin_dev database.')
  }
}

test('monthly enrollment schedules exclude inactive catalog entries and preserve active classes with legacy unpublished forms', {
  skip: !connectionString,
}, async () => {
  const db = new pg.Client({ connectionString, ssl: false })
  await db.connect()
  try {
    await db.query('BEGIN')
    const one = async (sql, values = []) => (await db.query(sql, values)).rows[0]
    const suffix = randomUUID()
    const facilityId = Number((await one("INSERT INTO facility(name,timezone) VALUES('Monthly enrollment visibility','America/New_York') RETURNING id")).id)
    const addProgram = async (name, { active = true, archived = false } = {}) => Number((await one(
      'INSERT INTO programs(facility_id,name,display_name,is_active,archived) VALUES($1,$2,$2,$3,$4) RETURNING id',
      [facilityId, `${name} ${suffix}`, active, archived],
    )).id)
    const activeProgram = await addProgram('Active program')
    const inactiveProgram = await addProgram('Inactive program', { active: false })
    const archivedProgram = await addProgram('Archived program', { archived: true })
    const fixtureFormIds = []
    const addClass = async (name, {
      parent = activeProgram, active = true, archived = false, formActive = true,
      groupActive = true, slotActive = true, withSlot = true,
    } = {}) => {
      const classId = Number((await one(`INSERT INTO program
        (facility_id,category,programs_id,name,display_name,is_active,archived)
        VALUES($1,(enum_range(NULL::program_category))[1],$2,$3,$3,$4,$5) RETURNING id`,
      [facilityId, parent, `${name} ${suffix}`, active, archived])).id)
      const formId = Number((await one(`INSERT INTO scheduling_form(program_id,programs_id,title,is_active)
        VALUES($1,$2,$3,$4) RETURNING id`, [classId, parent, name, formActive])).id)
      fixtureFormIds.push(formId)
      const groupId = Number((await one(`INSERT INTO scheduling_slot_group(form_id,schedule_mode,max_participants,is_active)
        VALUES($1,'day',10,$2) RETURNING id`, [formId, groupActive])).id)
      const slotId = withSlot ? Number((await one(`INSERT INTO scheduling_time_slot
        (form_id,slot_group_id,schedule_mode,day_of_week,start_time,end_time,max_participants,is_active)
        VALUES($1,$2,'day',1,'16:00','17:00',10,$3) RETURNING id`, [formId, groupId, slotActive])).id) : null
      return { classId, formId, groupId, slotId }
    }

    const active = await addClass('Active class with legacy form', { formActive: false })
    const groupOnly = await addClass('Active group with dates to be set', { withSlot: false })
    const excluded = [
      await addClass('Tramp & Tumble', { active: false }),
      await addClass('Archived class', { archived: true }),
      await addClass('Class under inactive program', { parent: inactiveProgram }),
      await addClass('Class under archived program', { parent: archivedProgram, archived: true }),
      await addClass('Inactive group', { groupActive: false }),
      await addClass('Inactive time', { slotActive: false }),
    ]
    const inactiveSibling = Number((await one(`INSERT INTO scheduling_time_slot
      (form_id,slot_group_id,schedule_mode,day_of_week,start_time,end_time,max_participants,is_active)
      VALUES($1,$2,'day',3,'16:00','17:00',10,FALSE) RETURNING id`, [active.formId, active.groupId])).id)
    const enroll = async (status, archived = false) => db.query(`INSERT INTO scheduling_signup
      (form_id,slot_group_id,time_slot_id,first_name,last_name,email,status,enrollment_start_date,archived_at)
      VALUES($1,$2,$3,'Visibility','Fixture',$4,$5,'2026-01-01',CASE WHEN $6::boolean THEN now() END)`,
    [active.formId, active.groupId, active.slotId, `${status}-${archived}-${suffix}@example.test`, status, archived])
    await enroll('confirmed')
    await enroll('waitlisted')
    await enroll('paused')
    await enroll('confirmed', true)

    const result = await buildAdminClassRegistrationSummaries(db)
    const fixtureRows = result.rows.filter(row => fixtureFormIds.includes(row.formId))
    assert.deepEqual(fixtureRows.map(row => row.formId).sort((a, b) => a - b), [active.formId, groupOnly.formId].sort((a, b) => a - b))
    assert.ok(excluded.every(klass => !fixtureRows.some(row => row.formId === klass.formId)))
    assert.ok(!fixtureRows.some(row => row.timeSlotId === inactiveSibling), 'inactive sibling times must not leak alongside active times')
    const visible = fixtureRows.find(row => row.formId === active.formId)
    assert.equal(visible.formActive, false, 'Class Setup activity takes precedence over the legacy published-form flag')
    assert.equal(visible.enrollmentCount, 1)
    assert.equal(visible.maxParticipants, 10)
    assert.deepEqual(visible.counts, { confirmed: 1, waitlisted: 1, paused: 1, pendingCancel: 0, total: 3 })
    assert.equal(fixtureRows.find(row => row.formId === groupOnly.formId).timeSlotId, null)
  } finally {
    await db.query('ROLLBACK').catch(() => {})
    await db.end()
  }
})
