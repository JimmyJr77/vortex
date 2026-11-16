import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { validateRehearsalDatabaseUrl } from '../../newAdmin/migrationAudit.js'
import { loadDailyReportTrials } from '../dailyReportTrials.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL || process.env.TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('PostgreSQL trial report uses registration bounds and explicit booking type without changing records', { skip: !connectionString }, async () => {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    const row = async (sql, values = []) => (await db.query(sql, values)).rows[0]
    const facility = await row("INSERT INTO facility(name) VALUES('Daily trial report fixture') RETURNING id")
    const program = await row("INSERT INTO programs(facility_id,name,display_name) VALUES($1,'Trial report program','Gymnastics') RETURNING id", [facility.id])
    const cls = await row(`INSERT INTO program(facility_id,category,programs_id,name,display_name,is_active,archived)
      VALUES($1,'GYMNASTICS',$2,'Trial report class','Twisters',TRUE,FALSE) RETURNING id`, [facility.id, program.id])
    const form = await row(`INSERT INTO scheduling_form(program_id,programs_id,title,is_active)
      VALUES($1,$2,'Trial report form',TRUE) RETURNING id`, [cls.id, program.id])
    const group = await row(`INSERT INTO scheduling_slot_group(form_id,schedule_mode,max_participants,is_active,dates_tbd)
      VALUES($1,'date',20,TRUE,FALSE) RETURNING id`, [form.id])
    const classDate = '2030-11-18'
    await db.query(`INSERT INTO scheduling_time_slot(form_id,slot_group_id,schedule_mode,specific_date,start_time,end_time,max_participants,is_active)
      VALUES($1,$2,'date',$3,'16:00','17:00',20,TRUE)`, [form.id, group.id, classDate])
    const member = await row(`INSERT INTO member(facility_id,first_name,last_name,is_active)
      VALUES($1,'Current','Athlete',TRUE) RETURNING id`, [facility.id])
    // The caller can supply a calendar day crossing DST; the loader must honor
    // its exact instants rather than imposing a UTC date or 24-hour duration.
    const since = new Date('2026-11-01T04:00:00Z')
    const through = new Date('2026-11-02T05:00:00Z')
    let bookingIndex = 0
    const add = async ({ createdAt = since, status = 'confirmed', benefit = 'free_trial', memberId = null, amount = 0 } = {}) => row(
      `INSERT INTO drop_in_registration(member_id,form_id,slot_group_id,class_date,first_name,last_name,email,phone,
         benefit_type,amount_cents,status,created_at)
       VALUES($1,$2,$3,$4,$9,'Athlete','guardian@example.test','2025550123',$5,$6,$7,$8) RETURNING id`,
      [memberId, form.id, group.id, classDate, benefit, amount, status, createdAt, `Stored${++bookingIndex}`],
    )
    const first = await add({ memberId: member.id })
    const last = await add({ createdAt: new Date(through.getTime() - 1), status: 'attended' })
    await add({ createdAt: through })
    await add({ createdAt: new Date(since.getTime() - 1) })
    for (const status of ['account_required', 'payment_pending', 'cancelled']) await add({ status })
    for (const benefit of ['paid', 'annual_credit']) await add({ benefit })
    const snapshot = async () => (await db.query('SELECT to_jsonb(d) AS row FROM drop_in_registration d WHERE form_id=$1 ORDER BY id', [form.id])).rows
    const before = await snapshot()
    const fixtureIds = new Set(before.map(({ row }) => Number(row.id)))
    const trials = (await loadDailyReportTrials(db, { since, through })).filter(trial => fixtureIds.has(trial.id))
    assert.deepEqual(trials.map(trial => trial.id), [Number(last.id), Number(first.id)])
    assert.equal(trials.length, 2)
    assert.equal(trials[0].name, 'Stored2 Athlete')
    assert.equal(trials[0].memberId, null)
    assert.equal(trials[0].status, 'attended')
    assert.equal(trials[1].name, 'Current Athlete')
    assert.equal(trials[1].memberId, Number(member.id))
    assert.equal(trials[1].registeredAt.toISOString(), since.toISOString())
    for (const trial of trials) {
      assert.equal(trial.benefitType, 'free_trial')
      assert.equal(trial.email, 'guardian@example.test')
      assert.equal(trial.phone, '202-555-0123')
      assert.equal(trial.classDate, classDate)
      assert.equal(trial.programName, 'Gymnastics')
      assert.equal(trial.scheduleLabel, `${classDate} · 16:00–17:00`)
    }
    assert.deepEqual(await snapshot(), before)

    // Keep inactive A in the recurrence context so active B cannot incorrectly
    // appear every week when the SQL query loads the timetable.
    await db.query(`UPDATE scheduling_time_slot SET schedule_mode='day',specific_date=NULL,day_of_week=1,
      week_letter='A',active_start=$2,is_active=FALSE WHERE slot_group_id=$1`, [group.id, classDate])
    await db.query(`INSERT INTO scheduling_time_slot(form_id,slot_group_id,schedule_mode,day_of_week,week_letter,
      start_time,end_time,max_participants,active_start,is_active)
      VALUES($1,$2,'day',1,'B','18:00','19:00',20,$3,TRUE)`, [form.id, group.id, classDate])
    const inactiveWeek = (await loadDailyReportTrials(db, { since, through })).filter(trial => fixtureIds.has(trial.id))
    assert.ok(inactiveWeek.every(trial => trial.scheduleLabel === ''))
    await db.query("UPDATE drop_in_registration SET class_date='2030-11-25' WHERE id=$1", [first.id])
    const activeWeek = (await loadDailyReportTrials(db, { since, through })).find(trial => trial.id === Number(first.id))
    assert.equal(activeWeek.scheduleLabel, '2030-11-25 · 18:00–19:00')
  } finally {
    await db.query('ROLLBACK').catch(() => {})
    await db.end()
  }
})
