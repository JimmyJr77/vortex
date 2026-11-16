import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import pg from 'pg'
import { saveClassSetupDropIns } from '../classSetupDropIns.js'

const url = process.env.CLASS_SETUP_DROP_INS_TEST_DATABASE_URL
  || (process.env.RUN_CLASS_SETUP_DROP_INS_LOCAL_TEST === 'true' ? `postgresql://${os.userInfo().username}@127.0.0.1:5432/postgres` : null)
if (url && !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Local test database required')

test('drop-in edits respect schedule, matching-name, program and facility boundaries atomically', { skip: !url }, async () => {
  const db = new pg.Client({ connectionString: url })
  await db.connect()
  const pool = { connect: async () => ({
    query(sql, args) { return db.query(sql === 'BEGIN' ? 'SAVEPOINT drop_in_edit' : sql === 'COMMIT' ? 'RELEASE SAVEPOINT drop_in_edit' : sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT drop_in_edit' : sql, args) },
    release() {},
  }) }
  const edit = (classId, scope, allowDropIns, timeSlotId) => saveClassSetupDropIns(pool, 1, classId, { scope, allowDropIns, ...(timeSlotId == null ? {} : { timeSlotId }) })
  const snapshot = async () => ({
    programs: (await db.query('SELECT * FROM programs ORDER BY id')).rows,
    classes: (await db.query('SELECT * FROM program ORDER BY id')).rows,
    slots: (await db.query('SELECT * FROM scheduling_time_slot ORDER BY id')).rows,
  })
  const effective = async () => (await db.query(`SELECT slot.id, COALESCE(slot.exclude_from_drop_ins,c.exclude_from_drop_ins,p.exclude_from_drop_ins,FALSE) AS excluded
    FROM scheduling_time_slot slot JOIN scheduling_form f ON f.id=slot.form_id JOIN program c ON c.id=f.program_id
    LEFT JOIN programs p ON p.id=c.programs_id WHERE f.deleted_at IS NULL ORDER BY slot.id`)).rows
  try {
    await db.query(`BEGIN; CREATE SCHEMA class_drop_in_scope_test; SET LOCAL search_path TO class_drop_in_scope_test;
      CREATE TABLE programs(id bigint PRIMARY KEY,facility_id bigint,exclude_from_drop_ins boolean DEFAULT false,updated_at timestamptz);
      CREATE TABLE program(id bigint PRIMARY KEY,facility_id bigint,programs_id bigint,display_name text,updated_at timestamptz);
      CREATE TABLE scheduling_form(id bigint PRIMARY KEY,program_id bigint,deleted_at timestamptz);
      CREATE TABLE scheduling_slot_group(id bigint PRIMARY KEY,form_id bigint);
      CREATE TABLE scheduling_time_slot(id bigint PRIMARY KEY,form_id bigint,slot_group_id bigint,updated_at timestamptz);
      CREATE TABLE scheduling_signup(id bigint PRIMARY KEY,status text);
      CREATE TABLE billing_subscription(id bigint PRIMARY KEY,amount_cents integer);
      INSERT INTO programs(id,facility_id,exclude_from_drop_ins) VALUES(1,1,false),(2,1,true),(3,2,false);
      INSERT INTO program(id,facility_id,programs_id,display_name) VALUES
        (10,1,1,'Tumblers'),(11,1,1,' tumBLers '),(12,1,1,'Different'),(20,1,2,'Tumblers'),(30,2,3,'Tumblers'),(40,1,NULL,'Unassigned'),(41,1,NULL,'Unscheduled');
      INSERT INTO scheduling_form VALUES(10,10,NULL),(11,11,NULL),(12,12,NULL),(20,20,NULL),(30,30,NULL),(40,40,NULL),(99,10,now());
      INSERT INTO scheduling_slot_group VALUES(10,10),(11,11),(12,12),(20,20),(30,30),(40,40),(99,99);
      INSERT INTO scheduling_time_slot(id,form_id,slot_group_id) VALUES(101,10,10),(102,10,10),(111,11,11),(121,12,12),(201,20,20),(301,30,30),(401,40,40),(999,99,99);
      INSERT INTO scheduling_signup VALUES(1,'confirmed'); INSERT INTO billing_subscription VALUES(1,15000);`)
    const migration = await fs.readFile(new URL('../../migrations/863_class_schedule_drop_in_overrides.sql', import.meta.url), 'utf8')
    await db.query(migration)
    await db.query(migration)
    const original = await snapshot()
    assert.equal((await effective()).find(row => Number(row.id) === 201).excluded, true, 'existing schedules inherit the parent policy')

    assert.deepEqual(await edit(10, 'class', false, 101), { scope: 'class', allowDropIns: false, classIds: [10], timeSlotIds: [101] })
    let values = await effective()
    assert.deepEqual(values.filter(row => [101, 102, 111].includes(Number(row.id))).map(row => row.excluded), [true, false, false])
    assert.deepEqual((await snapshot()).programs, original.programs)
    assert.deepEqual((await snapshot()).classes, original.classes)

    // A schedule exception can explicitly allow a day under an excluded parent.
    await edit(20, 'class', true, 201)
    assert.equal((await effective()).find(row => Number(row.id) === 201).excluded, false)
    const matched = await edit(10, 'matching', false, 101)
    assert.deepEqual(matched.classIds, [10, 11])
    values = await effective()
    assert.deepEqual(values.filter(row => [101, 102, 111, 121, 201, 301].includes(Number(row.id))).map(row => row.excluded), [true, true, true, false, false, false])
    assert.ok((await snapshot()).slots.filter(row => [101, 102, 111].includes(Number(row.id))).every(row => row.exclude_from_drop_ins === null))

    await edit(12, 'class', false)
    assert.equal((await effective()).find(row => Number(row.id) === 121).excluded, true)
    await edit(10, 'program', true)
    assert.ok((await effective()).filter(row => [101, 102, 111, 121].includes(Number(row.id))).every(row => row.excluded === false))
    assert.ok((await snapshot()).classes.filter(row => [10, 11, 12].includes(Number(row.id))).every(row => row.exclude_from_drop_ins === null))
    assert.equal((await snapshot()).slots.find(row => Number(row.id) === 201).exclude_from_drop_ins, false)
    await edit(40, 'class', false)
    assert.equal((await effective()).find(row => Number(row.id) === 401).excluded, true)
    assert.deepEqual(await edit(41, 'class', false), { scope: 'class', allowDropIns: false, classIds: [41], timeSlotIds: [] })
    assert.equal((await snapshot()).classes.find(row => Number(row.id) === 41).exclude_from_drop_ins, true)
    await edit(20, 'class', true)
    assert.equal((await snapshot()).classes.find(row => Number(row.id) === 20).exclude_from_drop_ins, false)
    assert.equal((await snapshot()).slots.find(row => Number(row.id) === 201).exclude_from_drop_ins, null)
    assert.equal((await effective()).find(row => Number(row.id) === 201).excluded, false, 'class override can allow a schedule under an excluded program')

    const beforeRejected = await snapshot()
    for (const [classId, scope, slotId, statusCode] of [[10, 'class', 301, 404], [10, 'program', 111, 404], [10, 'class', 999, 404], [40, 'matching', undefined, 400], [40, 'program', undefined, 400]]) {
      await assert.rejects(edit(classId, scope, false, slotId), { statusCode })
    }
    await assert.rejects(saveClassSetupDropIns(pool, 2, 10, { scope: 'program', allowDropIns: false }), { statusCode: 404 })
    assert.deepEqual(await snapshot(), beforeRejected)

    // A failure after the parent/class mutations must restore every layer.
    await db.query(`CREATE FUNCTION reject_scope_slot_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test slot failure'; END $$;
      CREATE TRIGGER reject_scope_slot_update BEFORE UPDATE ON scheduling_time_slot FOR EACH ROW EXECUTE FUNCTION reject_scope_slot_update();`)
    await assert.rejects(edit(10, 'program', false), /test slot failure/)
    assert.deepEqual(await snapshot(), beforeRejected)
    assert.deepEqual((await db.query('SELECT * FROM scheduling_signup')).rows, [{ id: '1', status: 'confirmed' }])
    assert.deepEqual((await db.query('SELECT * FROM billing_subscription')).rows, [{ id: '1', amount_cents: 15000 }])
  } finally {
    await db.query('ROLLBACK')
    await db.end()
  }
})
