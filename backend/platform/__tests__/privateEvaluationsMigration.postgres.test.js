import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'

const connectionString = process.env.PRIVATE_EVALUATIONS_TEST_DATABASE_URL
if (connectionString) {
  const url = new URL(connectionString)
  if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname)
    || !/^vortex_new_admin_dev(?:_[a-z0-9_]+)?$/.test(url.pathname.slice(1))
    || process.env.NODE_ENV==='production' || url.search || url.hash) {
    throw new Error('Private evaluation migration tests require an isolated local test database.')
  }
}
const sql = await readFile(new URL('../../migrations/878_vortex_private_gymnastics_evaluations.sql', import.meta.url),'utf8')

async function fixture(run) {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    const schema = `evaluation_${randomUUID().replaceAll('-','')}`
    await db.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema}`)
    await db.query(`
      CREATE TABLE facility(id bigint PRIMARY KEY,name text,timezone text);
      CREATE TABLE program(id bigint PRIMARY KEY,facility_id bigint,programs_id bigint,name text,display_name text,
        is_trial_assessment boolean DEFAULT false,archived boolean DEFAULT false,age_min integer,age_max integer,
        description text,skill_requirements text,updated_at timestamptz DEFAULT now());
      CREATE TABLE scheduling_form(id bigint PRIMARY KEY,program_id bigint,deleted_at timestamptz,
        is_active boolean DEFAULT true,description text,updated_at timestamptz DEFAULT now());
      CREATE TABLE scheduling_offering(id bigserial PRIMARY KEY,form_id bigint,start_date date,end_date date,label text,
        is_selected boolean,category_id bigint,updated_at timestamptz DEFAULT now());
      CREATE UNIQUE INDEX idx_scheduling_offering_selected_no_cat ON scheduling_offering(form_id)
        WHERE is_selected=true AND category_id IS NULL;
      CREATE UNIQUE INDEX idx_scheduling_offering_selected ON scheduling_offering(form_id) WHERE is_selected=true;
      CREATE TABLE scheduling_slot_group(id bigserial PRIMARY KEY,form_id bigint,offering_id bigint,schedule_mode text,
        max_participants integer,active_start date,active_end date,inherits_offering_dates boolean,dates_tbd boolean,
        is_active boolean DEFAULT true,updated_at timestamptz DEFAULT now());
      CREATE TABLE scheduling_time_slot(id bigserial PRIMARY KEY,form_id bigint,slot_group_id bigint,schedule_mode text,
        day_of_week integer,start_time time,end_time time,max_participants integer,active_start date,active_end date,
        dates_tbd boolean,is_active boolean DEFAULT true,exclude_from_drop_ins boolean,allow_free_trials boolean,
        updated_at timestamptz DEFAULT now());
      CREATE TABLE scheduling_signup(id bigserial PRIMARY KEY,slot_group_id bigint,status text,
        archived_at timestamptz,orphaned_at timestamptz,cancel_effective_date date);
      CREATE TABLE drop_in_registration(id bigserial PRIMARY KEY,slot_group_id bigint,class_date date,status text,expires_at timestamptz);
      CREATE TABLE held_places(slot_group_id bigint);
      CREATE FUNCTION pending_registration_holds(bigint) RETURNS bigint LANGUAGE sql AS
        'SELECT count(*) FROM held_places WHERE slot_group_id=$1';
      INSERT INTO facility VALUES(1,'Vortex Athletics','America/New_York'),(2,'Another Gym','America/New_York');
      INSERT INTO program(id,facility_id,programs_id,name,display_name,is_trial_assessment) VALUES
        (79,1,2,'trial_assessment','Trial Assessment',true),
        (3,1,2,'tornadoes','Tornadoes',false),(33,1,2,'cyclones','Cyclones',false),
        (80,2,3,'trial_assessment','Trial Assessment',true),(81,2,3,'tornadoes','Tornadoes',false),
        (82,1,4,'cyclones_other_program','Cyclones',false);
      INSERT INTO scheduling_form(id,program_id) VALUES(68,79),(9,3),(22,33),(69,80),(70,81),(71,82);
      INSERT INTO scheduling_offering(id,form_id,label,is_selected) VALUES(52,68,NULL,true),(53,69,NULL,true);
      SELECT setval(pg_get_serial_sequence('scheduling_offering','id'),100);
      INSERT INTO scheduling_slot_group(id,form_id,schedule_mode,max_participants,is_active) VALUES
        (297,68,'day',8,true),(228,9,'day',10,true),(217,22,'day',12,true),
        (298,69,'day',8,true),(229,70,'day',10,true),(218,71,'day',12,true);
      SELECT setval(pg_get_serial_sequence('scheduling_slot_group','id'),400);
      UPDATE scheduling_slot_group SET offering_id=52 WHERE id=297;
      UPDATE scheduling_slot_group SET offering_id=53 WHERE id=298;
      INSERT INTO scheduling_time_slot(id,form_id,slot_group_id,schedule_mode,day_of_week,start_time,end_time,max_participants) VALUES
        (373,68,297,'day',6,'12:00','13:00',8),
        (304,9,228,'day',4,'16:00','17:30',10),(293,22,217,'day',4,'16:00','17:30',12),
        (374,69,298,'day',6,'12:00','13:00',8),(305,70,229,'day',4,'16:00','17:30',10),
        (294,71,218,'day',4,'16:00','17:30',12),
        (306,9,228,'day',2,'16:00','17:30',10);
      SELECT setval(pg_get_serial_sequence('scheduling_time_slot','id'),500);
    `)
    await run(db)
  } finally {
    await db.query('ROLLBACK')
    await db.end()
  }
}

test('Vortex schedule migration creates seven private appointments, preserves other schedules and staff edits on rerun', {skip:!connectionString}, async () => {
  await fixture(async db => {
    await db.query(sql)
    const appointments = (await db.query(`SELECT ts.day_of_week,ts.start_time::text,ts.end_time::text,
      ts.max_participants,ts.exclude_from_drop_ins,ts.allow_free_trials,g.max_participants AS group_capacity
      FROM scheduling_time_slot ts JOIN scheduling_slot_group g ON g.id=ts.slot_group_id
      WHERE ts.form_id=68 AND ts.is_active ORDER BY ts.day_of_week,ts.start_time`)).rows
    assert.deepEqual(appointments.map(row=>[row.day_of_week,row.start_time,row.end_time]),[
      [2,'19:30:00','20:00:00'],[3,'19:30:00','20:00:00'],
      [4,'16:00:00','16:30:00'],[4,'16:30:00','17:00:00'],[4,'17:00:00','17:30:00'],
      [4,'19:30:00','20:00:00'],[5,'19:30:00','20:00:00'],
    ])
    assert.ok(appointments.every(row=>row.max_participants===1 && row.group_capacity===1
      && row.exclude_from_drop_ins===true && row.allow_free_trials===true))
    assert.equal((await db.query('SELECT count(DISTINCT slot_group_id)::int AS count FROM scheduling_time_slot WHERE form_id=68 AND is_active')).rows[0].count,7)
    assert.deepEqual((await db.query('SELECT id,is_active FROM scheduling_time_slot WHERE id<500 ORDER BY id')).rows.map(row=>[Number(row.id),row.is_active]),[
      [293,false],[294,true],[304,false],[305,true],[306,true],[373,false],[374,true],
    ])
    assert.equal((await db.query('SELECT is_active FROM scheduling_slot_group WHERE id=228')).rows[0].is_active,true,'unrelated Tuesday in the same group stays active')
    assert.equal((await db.query('SELECT is_active FROM scheduling_slot_group WHERE id=217')).rows[0].is_active,false)
    assert.deepEqual((await db.query('SELECT age_min,age_max FROM program WHERE id=79')).rows[0],{age_min:2,age_max:17})
    assert.deepEqual((await db.query('SELECT id,is_selected FROM scheduling_offering ORDER BY id')).rows.map(row=>[Number(row.id),row.is_selected]),[
      [52,false],[53,true],[101,true],
    ],'old offering is preserved but deselected, while another facility keeps its selected offering')
    assert.equal((await db.query('SELECT offering_id FROM scheduling_slot_group WHERE id=297')).rows[0].offering_id,'52','old schedule keeps its offering history')
    await db.query("UPDATE scheduling_time_slot SET start_time='15:30',end_time='16:00',is_active=FALSE WHERE form_id=68 AND day_of_week=5")
    const before=(await db.query('SELECT to_jsonb(t) AS row FROM scheduling_time_slot t ORDER BY id')).rows
    await db.query(sql)
    assert.deepEqual((await db.query('SELECT to_jsonb(t) AS row FROM scheduling_time_slot t ORDER BY id')).rows,before,'reruns neither duplicate nor restore staff-edited appointments')
  })
})

test('Vortex migration refuses to displace enrollments, future bookings or holds without partial schedule changes', {skip:!connectionString}, async () => {
  for (const reservation of [
    "INSERT INTO scheduling_signup(slot_group_id,status) VALUES(228,'confirmed')",
    "INSERT INTO drop_in_registration(slot_group_id,class_date,status) VALUES(297,CURRENT_DATE+7,'confirmed')",
    'INSERT INTO held_places(slot_group_id) VALUES(217)',
  ]) await fixture(async db => {
    await db.query(reservation)
    await db.query('SAVEPOINT schedule_change')
    await assert.rejects(db.query(sql),/future enrollments, reservations or holds/)
    await db.query('ROLLBACK TO SAVEPOINT schedule_change')
    assert.equal((await db.query('SELECT count(*)::int AS count FROM scheduling_time_slot WHERE is_active')).rows[0].count,7)
    assert.deepEqual((await db.query('SELECT id,is_selected FROM scheduling_offering ORDER BY id')).rows.map(row=>[Number(row.id),row.is_selected]),[[52,true],[53,true]])
  })
})

test('Vortex migration never changes a differently named facility at the same ID', {skip:!connectionString}, async () => {
  await fixture(async db => {
    await db.query("UPDATE facility SET name='A different gym' WHERE id=1")
    const before=(await db.query('SELECT to_jsonb(t) AS row FROM scheduling_time_slot t ORDER BY id')).rows
    await db.query(sql)
    assert.deepEqual((await db.query('SELECT to_jsonb(t) AS row FROM scheduling_time_slot t ORDER BY id')).rows,before)
  })
})
