import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import pg from 'pg'
import { loadScheduleExport } from '../scheduleExport.js'

test('schedule export is complete, facility scoped and subtracts active holds per shared schedule', {
  skip: process.env.RUN_SCHEDULE_EXPORT_LOCAL_TEST !== 'true',
}, async () => {
  const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL || `postgresql://${os.userInfo().username}@127.0.0.1:5432/vortex_new_admin_dev`
  const url = new URL(connectionString)
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.search && !url.hash && /^\/vortex_new_admin_dev(?:_[a-z0-9_]+)?$/.test(url.pathname))
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    const facility = (await db.query("INSERT INTO facility(name,timezone) VALUES('Schedule export fixture','America/New_York') RETURNING id")).rows[0].id
    const parent = (await db.query("INSERT INTO programs(facility_id,name,display_name,is_active) VALUES($1,'Schedule fixture','Schedule fixture',TRUE) RETURNING id", [facility])).rows[0].id
    const create = async (name, active = true, archived = false) => {
      const klass = (await db.query(`INSERT INTO program(facility_id,programs_id,category,name,display_name,is_active,archived)
        VALUES($1,$2,(enum_range(NULL::program_category))[1],$3,$3,$4,$5) RETURNING id`, [facility, parent, name, active, archived])).rows[0].id
      const form = (await db.query('INSERT INTO scheduling_form(program_id,programs_id,title,is_active) VALUES($1,$2,$3,TRUE) RETURNING id', [klass, parent, name])).rows[0].id
      const group = (await db.query('INSERT INTO scheduling_slot_group(form_id,max_participants,is_active) VALUES($1,8,TRUE) RETURNING id', [form])).rows[0].id
      const slot = (await db.query("INSERT INTO scheduling_time_slot(form_id,slot_group_id,day_of_week,start_time,end_time,is_active) VALUES($1,$2,1,'16:00','17:00',TRUE) RETURNING id", [form, group])).rows[0].id
      return { klass, form, group, slot }
    }
    const records = []
    for (let i = 0; i < 26; i++) records.push(await create(`Export class ${i}`))
    await create('Hidden inactive', false)
    await create('Hidden archived', false, true)
    const ended = await create('Ended schedule')
    await db.query("UPDATE scheduling_slot_group SET active_end='2000-01-01' WHERE id=$1", [ended.group])
    const unselected = await create('Unselected offering')
    const offering = (await db.query("INSERT INTO scheduling_offering(form_id,start_date,end_date,is_selected) VALUES($1,CURRENT_DATE,CURRENT_DATE+90,FALSE) RETURNING id", [unselected.form])).rows[0].id
    await db.query('UPDATE scheduling_slot_group SET offering_id=$2 WHERE id=$1', [unselected.group, offering])
    const { form, group, slot } = records[0]
    await db.query("INSERT INTO scheduling_time_slot(form_id,slot_group_id,day_of_week,start_time,end_time,is_active) VALUES($1,$2,3,'16:00','17:00',TRUE)", [form, group])
    await db.query("INSERT INTO scheduling_time_slot(form_id,slot_group_id,specific_date,start_time,end_time,is_active) VALUES($1,$2,'2000-01-01','16:00','17:00',TRUE)", [form, group])
    for (const [status, expiry] of [['confirmed', null], ['confirmed', null], ['waitlisted', null], ['cancelled', null], ['pending_setup', '1 day'], ['pending_setup', '-1 day']]) {
      await db.query(`INSERT INTO scheduling_signup(form_id,slot_group_id,time_slot_id,first_name,last_name,email,status,enrollment_start_date,reserved_until)
        VALUES($1,$2,$3,'Test','Student','test@example.test',$4,CURRENT_DATE,CASE WHEN $5::text IS NULL THEN NULL ELSE now()+$5::interval END)`, [form, group, slot, status, expiry])
    }
    const data = await loadScheduleExport(db, facility)
    assert.equal(data.rows.length, 27)
    assert.equal(new Set(data.rows.map(row => row.classId)).size, 26)
    const shared = data.rows.filter(row => row.groupId === Number(group))
    assert.equal(shared.length, 2)
    assert.ok(shared.every(row => row.capacity === 8 && row.enrolled === 2 && row.reserved === 1 && row.available === 5))
    assert.ok(data.rows.every(row => !/Hidden|Ended|Unselected/.test(row.className)))
    const emptyFacility = (await db.query("INSERT INTO facility(name) VALUES('Empty export fixture') RETURNING id")).rows[0].id
    assert.deepEqual((await loadScheduleExport(db, emptyFacility)).rows, [])
  } finally { await db.query('ROLLBACK'); await db.end() }
})
