import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import pg from 'pg'
import { updateScheduleSlots } from '../updateScheduleSlots.js'

test('schedule edits retain enrollment identities, statuses and billing links', {
  skip: process.env.RUN_SCHEDULE_EDIT_LOCAL_TEST !== 'true',
}, async () => {
  const db = new pg.Client({ connectionString: `postgresql://${os.userInfo().username}@127.0.0.1:5432/postgres` })
  await db.connect()
  try {
    await db.query(`BEGIN; CREATE SCHEMA schedule_edit_test; SET LOCAL search_path TO schedule_edit_test;
      CREATE TABLE scheduling_time_slot(id bigserial PRIMARY KEY,form_id bigint,slot_group_id bigint,
        schedule_mode text,week_letter text,day_of_week int,specific_date date,start_time time,end_time time,
        max_participants int,active_start date,active_end date,dates_tbd boolean,is_active boolean DEFAULT true,updated_at timestamptz);
      CREATE TABLE scheduling_signup(id bigint PRIMARY KEY,slot_group_id bigint,time_slot_id bigint REFERENCES scheduling_time_slot,
        status text,orphaned_at timestamptz,billing_subscription_id bigint);`)
    const group = { id: 1, form_id: 2, max_participants: 10 }
    const row = (day, start='16:00') => ({scheduleMode:'day',weekLetter:'A',dayOfWeek:day,specificDate:null,
      startTime:start,endTime:'18:00',activeStart:null,activeEnd:null,datesTbd:false})
    const original = await updateScheduleSlots(db, group, [row(1),row(3)])
    for (const [i,status] of ['confirmed','paused','waitlisted','cancelled','pending_setup'].entries()) {
      await db.query('INSERT INTO scheduling_signup VALUES($1,$2,$3,$4,NULL,$5)',[i+1,group.id,original[i%2].id,status,100+i])
    }
    // Group-wide enrollments remain group-wide.
    await db.query("INSERT INTO scheduling_signup VALUES(6,1,NULL,'confirmed',NULL,106)")
    const before = (await db.query('SELECT * FROM scheduling_signup ORDER BY id')).rows
    const edited = await updateScheduleSlots(db, {...group,max_participants:20}, [row(1,'17:00'),row(3)])
    assert.deepEqual(edited.map(s=>s.id), original.map(s=>s.id))
    assert.equal(edited[0].start_time,'17:00:00')
    assert.ok(edited.every(s=>s.max_participants===20))
    assert.deepEqual((await db.query('SELECT * FROM scheduling_signup ORDER BY id')).rows,before)
    const added = await updateScheduleSlots(db,group,[row(0),row(1,'17:00'),row(3)])
    assert.equal(added[1].id,original[0].id)
    assert.equal(added[2].id,original[1].id)
    const reduced = await updateScheduleSlots(db,group,[row(3)])
    assert.equal(reduced[0].id,original[1].id)
    const after = (await db.query('SELECT * FROM scheduling_signup ORDER BY id')).rows
    assert.deepEqual(after.map(s=>({...s,time_slot_id:null})),before.map(s=>({...s,time_slot_id:null})))
    assert.ok(after.slice(0,5).every(s=>s.time_slot_id===reduced[0].id))
    assert.equal(after[5].time_slot_id,null)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM scheduling_time_slot WHERE is_active')).rows[0].n,1)
    await db.query('SAVEPOINT failed_edit')
    await updateScheduleSlots(db,group,[row(4,'19:00')])
    await db.query('ROLLBACK TO SAVEPOINT failed_edit')
    assert.equal((await db.query('SELECT day_of_week FROM scheduling_time_slot WHERE is_active')).rows[0].day_of_week,3)
  } finally { await db.query('ROLLBACK'); await db.end() }
})

test('schedule group PATCH saves changed times and capacity on the existing group', {
  skip: process.env.RUN_SCHEDULE_EDIT_LOCAL_TEST !== 'true',
}, async () => {
  const { createSchedulingHandlers } = await import('../handlers.js')
  const db = new pg.Client({ connectionString: `postgresql://${os.userInfo().username}@127.0.0.1:5432/vortex_new_admin_dev` })
  await db.connect()
  const adapter = { release() {}, query(sql,args) {
    return db.query(sql==='BEGIN'?'SAVEPOINT edit_schedule':sql==='COMMIT'?'RELEASE SAVEPOINT edit_schedule':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT edit_schedule':sql,args)
  } }
  const pool = { query:(...args)=>db.query(...args), connect:async()=>adapter }
  try {
    await db.query('BEGIN')
    const form = (await db.query("INSERT INTO scheduling_form(title,is_active) VALUES ('Schedule regression',TRUE) RETURNING id")).rows[0]
    const handlers = createSchedulingHandlers(pool)
    const response = () => ({ statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this} })
    const payload = {scheduleMode:'day',activeDatesMode:'tbd',maxParticipants:10,
      daySchedule:{weeks:[{weekLetter:'A',days:[{dayOfWeek:1,times:[{startTime:'16:00',endTime:'17:00'}]}]}]}}
    const created = response()
    await handlers.createSlotBatch({params:{formId:form.id},body:payload},created)
    assert.equal(created.statusCode,200,JSON.stringify(created.body))
    const group = (await db.query('SELECT id FROM scheduling_slot_group WHERE form_id=$1',[form.id])).rows[0]
    const slot = (await db.query('SELECT id FROM scheduling_time_slot WHERE slot_group_id=$1',[group.id])).rows[0]
    payload.maxParticipants=20
    payload.daySchedule.weeks[0].days[0].times[0].startTime='16:30'
    const edited = response()
    await handlers.updateSlotGroupMax({params:{id:group.id},body:payload},edited)
    assert.equal(edited.statusCode,200,JSON.stringify(edited.body))
    const saved = (await db.query('SELECT * FROM scheduling_time_slot WHERE slot_group_id=$1',[group.id])).rows
    assert.equal(saved.length,1)
    assert.equal(saved[0].id,slot.id)
    assert.equal(saved[0].start_time,'16:30:00')
    assert.equal(saved[0].max_participants,20)
  } finally { await db.query('ROLLBACK'); await db.end() }
})
