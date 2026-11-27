import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { buildDailyRoster, renderDailyRosterEmail } from '../dailyRoster.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) {
  const url = new URL(connectionString)
  if (process.env.NODE_ENV === 'production' || !['postgres:', 'postgresql:'].includes(url.protocol)
      || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.search || url.hash
      || !/^vortex_new_admin_dev(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(url.pathname.slice(1)))) {
    throw new Error('Daily roster tests require an isolated local vortex_new_admin_dev database without connection overrides.')
  }
}

test('daily roster marks the first actual class day and includes only confirmed same-day drop-ins once', { skip: !connectionString }, async () => {
  const db = new pg.Client({ connectionString, ssl: false })
  await db.connect()
  let facilityId
  try {
    await db.query('BEGIN')
    const one = async (sql, values = []) => (await db.query(sql, values)).rows[0]
    const suffix = randomUUID()
    facilityId = Number((await one("INSERT INTO facility(name,timezone) VALUES('Daily roster regression','America/New_York') RETURNING id")).id)
    const programId = Number((await one('INSERT INTO programs(facility_id,name,display_name) VALUES($1,$2,$2) RETURNING id', [facilityId, `Roster ${suffix}`])).id)
    const addClass = async (name, days = [1]) => {
      const classId = Number((await one(`INSERT INTO program(facility_id,category,programs_id,name,display_name,is_active,archived)
        VALUES($1,(enum_range(NULL::program_category))[1],$2,$3,$3,TRUE,FALSE) RETURNING id`, [facilityId, programId, `${name} ${suffix}`])).id)
      const formId = Number((await one(`INSERT INTO scheduling_form(program_id,programs_id,title,is_active,start_date)
        VALUES($1,$2,$3,TRUE,'2029-12-01') RETURNING id`, [classId, programId, name])).id)
      const groupId = Number((await one(`INSERT INTO scheduling_slot_group
        (form_id,schedule_mode,max_participants,active_start,inherits_offering_dates,dates_tbd,is_active)
        VALUES($1,'day',100,'2029-12-01',FALSE,FALSE,TRUE) RETURNING id`, [formId])).id)
      const slotIds = []
      for (const day of days) {
        slotIds.push(Number((await one(`INSERT INTO scheduling_time_slot
          (form_id,slot_group_id,schedule_mode,day_of_week,start_time,end_time,max_participants,active_start,dates_tbd,is_active)
          VALUES($1,$2,'day',$3,'16:00','17:00',100,'2029-12-01',FALSE,TRUE) RETURNING id`, [formId, groupId, day])).id))
      }
      return { classId, formId, groupId, slotIds }
    }
    const main = await addClass('Monday class')
    const newClass = await addClass('Different Monday class')
    const multiDay = await addClass('Monday Wednesday class', [1, 3])
    const evaluation = await addClass('Private evaluation')
    await db.query('UPDATE program SET is_trial_assessment=TRUE WHERE id=$1', [evaluation.classId])
    await db.query('UPDATE scheduling_slot_group SET max_participants=1 WHERE id=$1', [evaluation.groupId])
    await db.query("UPDATE scheduling_time_slot SET start_time='19:30',end_time='20:00',max_participants=1 WHERE id=ANY($1::bigint[])", [evaluation.slotIds])
    const member = async name => Number((await one(`INSERT INTO member
      (facility_id,first_name,last_name,date_of_birth,is_active,created_at)
      VALUES($1,$2,'Roster','2019-01-01',TRUE,'2020-01-01') RETURNING id`, [facilityId, name])).id)
    const enroll = async (memberId, klass, { start = '2030-01-06', status = 'confirmed', slotId = klass.slotIds[0], archived = false, cancelDate = null } = {}) =>
      Number((await one(`INSERT INTO scheduling_signup
        (form_id,slot_group_id,time_slot_id,member_id,first_name,last_name,email,status,enrollment_start_date,archived_at,cancel_effective_date)
        VALUES($1,$2,$3,$4,'Submitted','Roster',$5,$6,$7,CASE WHEN $8::boolean THEN now() END,$9) RETURNING id`,
      [klass.formId, klass.groupId, slotId, memberId, `roster-${memberId}-${suffix}@example.test`, status, start, archived, cancelDate])).id)
    const dropIn = async (name, { status = 'confirmed', date = '2030-01-07', benefit = 'free_trial', memberId = null, klass = main } = {}) =>
      Number((await one(`INSERT INTO drop_in_registration
        (form_id,slot_group_id,member_id,class_date,first_name,last_name,email,status,benefit_type,amount_cents)
        VALUES($1,$2,$3,$4,$5,'Roster',$6,$7,$8,$9) RETURNING id`,
      [klass.formId, klass.groupId, memberId, date, name, `${name}-${suffix}@example.test`, status, benefit, benefit === 'paid' ? 2500 : 0])).id)

    const first = await member('Firstday')
    const established = await member('Established')
    const wholeGroup = await member('Wholegroup')
    const duplicate = await member('Duplicate')
    const payer = await member('Accountpayer')
    await db.query("UPDATE member SET email='payer@example.test',phone='2025550188',date_of_birth='1985-01-01' WHERE id=$1", [payer])
    const familyId = Number((await one("INSERT INTO family(facility_id,family_name) VALUES($1,'Roster payer family') RETURNING id", [facilityId])).id)
    await db.query('INSERT INTO family_member(family_id,member_id) SELECT $1,unnest($2::bigint[])', [familyId, [first, wholeGroup, duplicate, payer]])
    await db.query('UPDATE member SET family_id=$1 WHERE id=ANY($2::bigint[])', [familyId, [first, wholeGroup, duplicate, payer]])
    await db.query("UPDATE member SET email='student-' || id || '@example.test',phone='2025550111' WHERE id=ANY($1::bigint[])", [[first, wholeGroup, duplicate]])
    const billingAccountId = Number((await one(`INSERT INTO family_billing_account(family_id,payer_member_id,billing_email,billing_phone)
      VALUES($1,$2,'billing@example.test','2025550199') ON CONFLICT(family_id) DO UPDATE
      SET payer_member_id=EXCLUDED.payer_member_id,billing_email=EXCLUDED.billing_email,billing_phone=EXCLUDED.billing_phone RETURNING id`, [familyId, payer])).id)
    const unassignedFamilyId = Number((await one("INSERT INTO family(facility_id,family_name) VALUES($1,'Unassigned roster payer') RETURNING id", [facilityId])).id)
    await db.query('INSERT INTO family_member(family_id,member_id) VALUES($1,$2)', [unassignedFamilyId, established])
    await db.query('UPDATE member SET family_id=$1,email=$3,phone=$4 WHERE id=$2', [unassignedFamilyId, established, 'unassigned-student@example.test', '2025550177'])
    await db.query('INSERT INTO family_billing_account(family_id) VALUES($1) ON CONFLICT(family_id) DO NOTHING', [unassignedFamilyId])
    await enroll(first, main)
    await enroll(established, main, { start: '2029-12-01' })
    await enroll(established, newClass)
    await enroll(wholeGroup, multiDay, { slotId: null })
    await enroll(duplicate, main, { start: '2029-12-01' })
    for (const [name, options] of [
      ['Archived', { archived: true }], ['Cancelled', { status: 'cancelled' }],
      ['Effectivecancel', { cancelDate: '2030-01-07' }], ['Futurestart', { start: '2030-01-14' }],
    ]) await enroll(await member(name), main, options)
    const confirmedTrial = await dropIn('Confirmedtrial')
    const attendedTrial = await dropIn('Attendedtrial', { status: 'attended' })
    const paid = await dropIn('Paidvisit', { benefit: 'paid' })
    const credit = await dropIn('Creditvisit', { benefit: 'annual_credit' })
    const duplicateDropIn = await dropIn('Duplicate', { memberId: duplicate, benefit: 'admin_credit' })
    const evaluationBooking = await dropIn('Experienced', { klass: evaluation, memberId: wholeGroup })
    for (const [name, options] of [
      ['Pendingaccount', { status: 'account_required' }], ['Pendingpayment', { status: 'payment_pending' }],
      ['Cancelledtrial', { status: 'cancelled' }], ['Futuretrial', { date: '2030-01-14' }],
    ]) await dropIn(name, options)

    const rosterFor = date => buildDailyRoster(db, date, { includeNewRegistrations: false })
    const classFor = (roster, klass) => roster.classes.find(row => row.formId === klass.formId)
    const athlete = (roster, klass, memberId) => classFor(roster, klass)?.athletes.find(row => row.memberId === memberId)
    const monday = await rosterFor('2030-01-07')
    assert.equal(athlete(monday, main, first)?.isNew, true, 'Sunday enrollment begins at the Monday occurrence')
    assert.equal(athlete(monday, main, established)?.isNew, false, 'existing enrollment is not new')
    assert.equal(athlete(monday, newClass, established)?.isNew, true, 'an established member can be new to another class')
    assert.equal(athlete(monday, multiDay, wholeGroup)?.isNew, true, 'a group-wide enrollment starts at its first weekday')
    for (const [klass, memberId] of [[main, first], [multiDay, wholeGroup], [main, duplicate], [evaluation, wholeGroup]]) {
      assert.equal(athlete(monday, klass, memberId)?.email, 'billing@example.test', 'recurring, group, trial and drop-in rows use the payer account email')
      assert.equal(athlete(monday, klass, memberId)?.phone, '202-555-0199', 'the account payer phone replaces the student and signup phones')
    }
    assert.equal(athlete(monday, main, established)?.email, '', 'a known account with no payer contact does not display the student address as payer information')
    assert.equal(athlete(monday, main, established)?.phone, '')
    assert.equal(classFor(monday, main).athletes.find(row => row.source === 'drop_in' && row.signupId === confirmedTrial)?.email, `Confirmedtrial-${suffix}@example.test`, 'accountless trials retain their submitted booking contact')
    assert.deepEqual(classFor(monday, main).athletes.filter(row => row.source === 'scheduling').map(row => row.memberId).sort((a, b) => a - b), [first, established].sort((a, b) => a - b))
    assert.deepEqual(classFor(monday, main).athletes.filter(row => row.source === 'drop_in').map(row => row.signupId).sort((a, b) => a - b),
      [confirmedTrial, attendedTrial, paid, credit, duplicateDropIn].sort((a, b) => a - b))
    assert.equal(classFor(monday, main).athletes.filter(row => row.memberId === duplicate).length, 1)
    assert.equal(athlete(monday, main, duplicate)?.source, 'drop_in', 'the specific attendance booking wins over recurring enrollment')
    assert.equal(classFor(monday, main).athleteCount, 7)
    assert.equal(classFor(monday, evaluation).isTrialAssessment, true)
    assert.equal(classFor(monday, evaluation).timeLabel, '7:30 PM–8:00 PM')
    assert.equal(classFor(monday, evaluation).athletes[0].signupId, evaluationBooking)
    assert.equal(classFor(monday, evaluation).athletes[0].isTrialAssessment, true)
    const rendered = renderDailyRosterEmail(monday, { includeNewRegistrations: false })
    assert.match(rendered.text, /Firstday Roster \(New\)/)
    assert.match(rendered.text, /Confirmedtrial Roster \(Free Trial\)/)
    assert.match(rendered.text, /Attendedtrial Roster \(Free Trial\)/)
    assert.match(rendered.text, /Experienced Roster \(Free 1:1 Evaluation\)/)
    assert.doesNotMatch(rendered.text, /Experienced Roster \(Free Trial\)/)
    assert.doesNotMatch(rendered.text, /Pendingaccount|Pendingpayment|Cancelledtrial|Futuretrial|Archived Roster|Cancelled Roster|Effectivecancel Roster|Futurestart Roster/)

    await db.query('UPDATE family_billing_account SET billing_email=NULL,billing_phone=NULL WHERE id=$1', [billingAccountId])
    const payerFallback = await rosterFor('2030-01-07')
    assert.equal(athlete(payerFallback, main, first)?.email, 'payer@example.test', 'the assigned payer supplies missing account contact fields')
    assert.equal(athlete(payerFallback, main, first)?.phone, '202-555-0188')
    assert.equal(athlete(payerFallback, main, duplicate)?.email, 'payer@example.test', 'drop-ins resolve the same current payer as recurring enrollments')

    const wednesday = await rosterFor('2030-01-09')
    assert.equal(athlete(wednesday, multiDay, wholeGroup)?.isNew, false, 'the second group weekday is no longer new')
    const nextMonday = await rosterFor('2030-01-14')
    assert.equal(athlete(nextMonday, main, first)?.isNew, false)
    assert.equal(athlete(nextMonday, newClass, established)?.isNew, false)
    assert.equal(athlete(nextMonday, multiDay, wholeGroup)?.isNew, false)
    assert.equal(classFor(nextMonday, main).athletes.some(row => row.signupId === confirmedTrial && row.source === 'drop_in'), false, 'a trial is present only on its reserved date')

    const occurrence = [main.slotIds[0], '2030-01-07']
    await db.query('INSERT INTO scheduling_occurrence_cancellation (time_slot_id, occurrence_date) VALUES ($1,$2)', occurrence)
    const cancelledMonday = await rosterFor('2030-01-07')
    assert.equal(classFor(cancelledMonday, main), undefined)
    assert.ok(classFor(cancelledMonday, newClass))
    assert.equal(athlete(await rosterFor('2030-01-14'), main, first)?.isNew, true)

    const closure = [facilityId, '2030-01-07']
    await db.query('INSERT INTO scheduling_day_cancellation (facility_id, occurrence_date) VALUES ($1,$2)', closure)
    const closedMonday = await rosterFor('2030-01-07')
    for (const klass of [main, newClass, multiDay]) assert.equal(classFor(closedMonday, klass), undefined)
    assert.equal(athlete(await rosterFor('2030-01-09'), multiDay, wholeGroup)?.isNew, true)
    assert.equal(athlete(await rosterFor('2030-01-14'), newClass, established)?.isNew, true)
    await db.query('DELETE FROM scheduling_day_cancellation WHERE facility_id=$1 AND occurrence_date=$2', closure)
    const reopenedMonday = await rosterFor('2030-01-07')
    assert.equal(classFor(reopenedMonday, main), undefined, 'restoring the day preserves the individual cancellation')
    assert.ok(classFor(reopenedMonday, newClass))
    assert.ok(classFor(reopenedMonday, multiDay))

    await db.query('DELETE FROM scheduling_occurrence_cancellation WHERE time_slot_id=$1 AND occurrence_date=$2', occurrence)
    const restoredMonday = await rosterFor('2030-01-07')
    assert.equal(athlete(restoredMonday, main, first)?.isNew, true)
    assert.ok(classFor(restoredMonday, main).athletes.some(row => row.signupId === confirmedTrial && row.source === 'drop_in'))
  } finally {
    await db.query('ROLLBACK')
    try {
      if (facilityId) assert.equal(Number((await db.query('SELECT count(*) FROM facility WHERE id=$1', [facilityId])).rows[0].count), 0)
    } finally { await db.end() }
  }
})
