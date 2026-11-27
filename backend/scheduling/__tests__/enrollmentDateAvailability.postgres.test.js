import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { assertEnrollmentDateAvailable } from '../enrollmentDateAvailability.js'
import { validateRehearsalDatabaseUrl } from '../../newAdmin/migrationAudit.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('enrollment admission respects an exact canceled session and full day without closing other times or dates', { skip: !connectionString }, async t => {
  const db = new pg.Client({ connectionString, ssl: false })
  await db.connect()
  try {
    await db.query('BEGIN')
    const one = async (sql, values) => (await db.query(sql, values)).rows[0]
    const name = `Enrollment cancellation ${randomUUID()}`
    const facilityId = Number((await one("INSERT INTO facility(name,timezone) VALUES($1,'America/New_York') RETURNING id", [name])).id)
    const top = await one('INSERT INTO programs(facility_id,name,display_name) VALUES($1,$2,$2) RETURNING id',[facilityId,name])
    const klass = await one("INSERT INTO program(facility_id,programs_id,category,name,display_name,is_active) VALUES($1,$2,(enum_range(NULL::program_category))[1],$3,$3,TRUE) RETURNING id", [facilityId,top.id,name])
    const form = await one("INSERT INTO scheduling_form(program_id,programs_id,title,is_active,start_date) VALUES($1,$2,$3,TRUE,'2030-01-01') RETURNING id",[klass.id,top.id,name])
    const group = await one("INSERT INTO scheduling_slot_group(form_id,is_active,active_start) VALUES($1,TRUE,'2030-01-01') RETURNING id",[form.id])
    const slots = (await db.query("INSERT INTO scheduling_time_slot(form_id,slot_group_id,day_of_week,start_time,end_time,is_active) VALUES($1,$2,1,'16:00','17:00',TRUE),($1,$2,1,'18:00','19:00',TRUE) RETURNING id",[form.id,group.id])).rows
    const selection = { formId: form.id, slotGroupId: group.id, timeSlotId: slots[0].id,
      facilityId, enrollmentStartDate: '2030-01-07', lock: true }
    await assertEnrollmentDateAvailable(db, selection)
    await db.query("INSERT INTO scheduling_occurrence_cancellation(time_slot_id,occurrence_date) VALUES($1,'2030-01-07')", [slots[0].id])
    await t.test('a directly requested canceled time fails while its same-day sibling and next week stay available', async () => {
      await assert.rejects(assertEnrollmentDateAvailable(db, selection), { code: 'CLASS_OCCURRENCE_CANCELLED', statusCode: 409 })
      await assertEnrollmentDateAvailable(db, { ...selection, timeSlotId: slots[1].id })
      await assertEnrollmentDateAvailable(db, { ...selection, enrollmentStartDate: '2030-01-14' })
      await assert.rejects(assertEnrollmentDateAvailable(db, { ...selection, timeSlotId: null }), { code: 'CLASS_OCCURRENCE_CANCELLED' })
    })
    await db.query("INSERT INTO scheduling_day_cancellation(facility_id,occurrence_date) VALUES($1,'2030-01-14'),($1,'2030-01-09')",[facilityId])
    await t.test('a facility closure blocks both class times on that day and preserves other weeks', async () => {
      for (const slot of slots) await assert.rejects(assertEnrollmentDateAvailable(db, {
        ...selection, timeSlotId: slot.id, enrollmentStartDate: '2030-01-14',
      }), { code: 'CLASS_OCCURRENCE_CANCELLED' })
      await assertEnrollmentDateAvailable(db, { ...selection, enrollmentStartDate: '2030-01-21' })
      // Monthly enrollment may start administratively on a day without this
      // class. A closure on that unrelated weekday must not ban enrollment.
      await assertEnrollmentDateAvailable(db, { ...selection, enrollmentStartDate: '2030-01-09' })
    })
    await t.test('the guard does not accept a class from a different facility', async () => {
      await assert.rejects(assertEnrollmentDateAvailable(db, { ...selection, facilityId: facilityId+100000 }), { statusCode: 409 })
    })
  } finally { await db.query('ROLLBACK'); await db.end() }
})
