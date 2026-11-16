import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import pg from 'pg'
import { validateRehearsalDatabaseUrl } from '../../newAdmin/migrationAudit.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('assessment migrations preserve staff schedules and enforce free-trial-only booking', { skip: !connectionString }, async () => {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    const facility = (await db.query("INSERT INTO facility(name) VALUES('Trial assessment migration fixture') RETURNING id")).rows[0].id
    const addProgram = async (name) => (await db.query('INSERT INTO programs(facility_id,name,display_name) VALUES($1,$2,$2) RETURNING id', [facility, name])).rows[0].id
    await addProgram('Gymnastics')
    const development = await addProgram('Development Gymnastics')
    const seed = await readFile(new URL('../../migrations/859_trial_assessment_class.sql', import.meta.url), 'utf8')
    const policy = await readFile(new URL('../../migrations/860_trial_assessment_booking_policy.sql', import.meta.url), 'utf8')
    await db.query(seed)
    const inspect = `SELECT c.id AS class_id,c.programs_id,c.age_min,c.age_max,f.id AS form_id,
      g.id AS group_id,t.id AS slot_id,t.day_of_week,t.start_time::text,t.end_time::text,t.max_participants
      FROM program c JOIN scheduling_form f ON f.program_id=c.id
      JOIN scheduling_slot_group g ON g.form_id=f.id JOIN scheduling_time_slot t ON t.slot_group_id=g.id
      WHERE c.facility_id=$1 AND c.name='trial_assessment' ORDER BY c.id,t.id`
    const first = (await db.query(inspect, [facility])).rows
    assert.equal(first.length, 1)
    const row = first[0]
    assert.equal(row.programs_id, development)
    assert.deepEqual([row.age_min,row.age_max,row.day_of_week,row.start_time,row.end_time,row.max_participants], [6,17,6,'12:00:00','13:00:00',8])
    await db.query(seed)
    assert.deepEqual((await db.query(inspect, [facility])).rows, first)
    await db.query("UPDATE scheduling_time_slot SET day_of_week=2,start_time='16:00',end_time='17:00' WHERE id=$1", [row.slot_id])
    await db.query(seed)
    assert.equal((await db.query(inspect, [facility])).rows[0].start_time, '16:00:00')
    await db.query(policy)
    await db.query(policy)
    assert.equal((await db.query('SELECT is_trial_assessment FROM program WHERE id=$1', [row.class_id])).rows[0].is_trial_assessment, true)

    const rejectsBooking = async (sql, args) => {
      await db.query('SAVEPOINT rejected_booking')
      await assert.rejects(db.query(sql, args), error => error.code === '23514' && /Trial Assessments/.test(error.message))
      await db.query('ROLLBACK TO SAVEPOINT rejected_booking')
      await db.query('RELEASE SAVEPOINT rejected_booking')
    }
    await rejectsBooking(`INSERT INTO scheduling_signup(form_id,slot_group_id,first_name,last_name,email)
      VALUES($1,$2,'Test','Athlete','assessment-monthly@example.test')`, [row.form_id,row.group_id])
    const addDropIn = `INSERT INTO drop_in_registration(form_id,slot_group_id,class_date,first_name,last_name,email,benefit_type,amount_cents)
      VALUES($1,$2,CURRENT_DATE+7,'Test','Athlete',$3,$4,$5) RETURNING id`
    await rejectsBooking(addDropIn, [row.form_id,row.group_id,'assessment-paid@example.test','paid',0])
    await rejectsBooking(addDropIn, [row.form_id,row.group_id,'assessment-charged@example.test','free_trial',100])
    const booking = (await db.query(addDropIn, [row.form_id,row.group_id,'assessment-free@example.test','free_trial',0])).rows[0].id
    await rejectsBooking('UPDATE drop_in_registration SET benefit_type=$2 WHERE id=$1', [booking,'paid'])
    await rejectsBooking('UPDATE drop_in_registration SET amount_cents=100 WHERE id=$1', [booking])
    await rejectsBooking("UPDATE drop_in_registration SET status='payment_pending' WHERE id=$1", [booking])
    await db.query("UPDATE drop_in_registration SET status='cancelled' WHERE id=$1", [booking])
    assert.equal((await db.query('SELECT status FROM drop_in_registration WHERE id=$1', [booking])).rows[0].status, 'cancelled')
  } finally {
    await db.query('ROLLBACK').catch(() => {})
    await db.end()
  }
})
