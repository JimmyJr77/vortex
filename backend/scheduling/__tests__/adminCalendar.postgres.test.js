import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import pg from 'pg'
import { createSchedulingHandlers } from '../handlers.js'
import { lockSchedulingDay } from '../dayCancellation.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) {
  const url = new URL(connectionString)
  if (process.env.NODE_ENV === 'production' || !['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.search || url.hash
    || !/^vortex_new_admin_dev(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(url.pathname.slice(1)))) {
    throw new Error('Calendar tests require an isolated local vortex_new_admin_dev database without connection overrides.')
  }
}

test('calendar closes and restores a facility day while retaining separate occurrence cancellations', { skip: !connectionString }, async () => {
  const db = new pg.Client({ connectionString, ssl: false })
  await db.connect()
  try {
    await db.query('BEGIN')
    await db.query(await readFile(new URL('../../migrations/872_scheduling_occurrence_cancellations.sql', import.meta.url), 'utf8'))
    await db.query(await readFile(new URL('../../migrations/874_scheduling_day_cancellations.sql', import.meta.url), 'utf8'))

    const first = async (sql, values) => (await db.query(sql, values)).rows[0]
    const suffix = randomUUID()
    const facility = async label => Number((await first(
      `INSERT INTO facility (name, timezone) VALUES ($1, 'America/New_York') RETURNING id`,
      [`Calendar ${label} ${suffix}`],
    )).id)
    const facilityId = await facility('owner')
    const otherFacilityId = await facility('other')
    const addProgram = async (ownerId, label) => (await first(`
      INSERT INTO programs (facility_id, name, display_name) VALUES ($1, $2, $2) RETURNING id
    `, [ownerId, `Calendar ${label} ${suffix}`])).id
    const programId = await addProgram(facilityId, 'owner')
    const otherProgramId = await addProgram(otherFacilityId, 'other')
    const startDate = '2030-01-07' // Monday, first week A.
    const addGroup = async (label, isTrial, mode, ownerId = facilityId, parentId = programId) => {
      const classId = Number((await first(`
        INSERT INTO program (facility_id, category, programs_id, name, display_name, is_active, archived, is_trial_assessment)
        VALUES ($1, 'GYMNASTICS', $2, $3, $3, TRUE, FALSE, $4) RETURNING id
      `, [ownerId, parentId, `${label} ${suffix}`, isTrial])).id)
      const formId = (await first(`
        INSERT INTO scheduling_form (program_id, programs_id, title, is_active, start_date)
        VALUES ($1, $2, $3, TRUE, $4) RETURNING id
      `, [classId, parentId, label, startDate])).id
      const groupId = (await first(`
        INSERT INTO scheduling_slot_group (form_id, schedule_mode, active_start)
        VALUES ($1, $2, $3) RETURNING id
      `, [formId, mode, startDate])).id
      return { classId, formId, groupId, mode }
    }
    const addSlot = async (group, letter, hour, date = startDate) => Number((await first(`
      INSERT INTO scheduling_time_slot (form_id, slot_group_id, schedule_mode, week_letter,
        day_of_week, specific_date, start_time, end_time, active_start)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
    `, [group.formId, group.groupId, group.mode, letter, letter ? 1 : null, letter ? null : date,
      `${hour}:00`, `${hour}:30`, startDate])).id)
    const active = await addGroup('Active class', false, 'day')
    const assessment = await addGroup('Trial assessment', true, 'date')
    const activeSlotId = await addSlot(active, 'A', 12)
    const weekBSlotId = await addSlot(active, 'B', 13)
    const trialSlotId = await addSlot(assessment, null, 14)
    const other = await addGroup('Other facility class', false, 'date', otherFacilityId, otherProgramId)
    const otherSlotId = await addSlot(other, null, 15)

    const savepointCommands = {
      BEGIN: 'SAVEPOINT occurrence_update',
      COMMIT: 'RELEASE SAVEPOINT occurrence_update',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT occurrence_update',
    }
    const handlers = createSchedulingHandlers({
      query: (sql, params) => db.query(sql, params),
      connect: async () => ({ query: (sql, params) => db.query(savepointCommands[sql] || sql, params), release() {} }),
    })
    const request = async (method, { scope = facilityId, query = {}, body } = {}) => {
      const res = {
        code: 200,
        status(code) { this.code = code; return this },
        json(result) { this.result = result },
      }
      await handlers[method]({ canonicalAccess: { facilityId: scope }, query, body }, res)
      return res
    }
    const update = (slotId, date, cancelled, scope = facilityId) => request('updateCalendarOccurrence', {
      scope, body: { slotId, date, cancelled },
    })
    const updateDay = (date, cancelled, scope = facilityId) => request('updateCalendarDay', {
      scope, body: { date, cancelled, facilityId: otherFacilityId },
    })
    const adminCalendar = (scope = facilityId, query = {}) => request('getAdminCalendar', {
      scope, query: { startDate, endDate: '2030-01-21', ...query },
    })
    const publicCalendar = () => request('getPublicCalendar', { query: { startDate, endDate: '2030-01-21', programId: active.classId } })
    const activeSlots = result => result.result.data.events.filter(event => event.classEventId === active.classId)
      .map(event => [event.timeSlotId, event.date, event.isCancelled])

    assert.equal((await update(activeSlotId, '2030-02-31', true)).code, 400)
    assert.equal((await update(activeSlotId, startDate, 'true')).code, 400)
    assert.equal((await update(activeSlotId, startDate, true, null)).code, 403)
    assert.equal((await update(activeSlotId, startDate, true, otherFacilityId)).code, 404)
    assert.equal((await update(activeSlotId, '2030-01-14', true)).code, 404)
    assert.equal((await update(trialSlotId, '2030-01-08', true)).code, 404)

    for (let retry = 0; retry < 2; retry += 1) {
      assert.deepEqual((await update(activeSlotId, startDate, true)).result,
        { success: true, data: { date: startDate, slotId: activeSlotId, cancelled: true } })
    }
    assert.deepEqual(activeSlots(await adminCalendar()), [
      [activeSlotId, startDate, true], [weekBSlotId, '2030-01-14', false], [activeSlotId, '2030-01-21', false],
    ])
    assert.deepEqual(activeSlots(await publicCalendar()), [
      [weekBSlotId, '2030-01-14', false], [activeSlotId, '2030-01-21', false],
    ])

    assert.equal((await update(trialSlotId, startDate, true)).code, 200)
    const trial = (await adminCalendar()).result.data.events.find(event => event.timeSlotId === trialSlotId)
    assert.equal(trial.isTrialAssessment, true)
    assert.equal(trial.isCancelled, true)
    const classes = (await request('listAdminSchedulingClasses')).result.data
    assert.ok(classes.some(row => row.id === assessment.classId))
    assert.deepEqual((await request('listAdminSchedulingClasses', { scope: otherFacilityId })).result.data.map(row => row.id), [other.classId])

    assert.equal((await update(activeSlotId, startDate, false)).code, 200)
    assert.equal((await update(trialSlotId, startDate, false)).code, 200)
    assert.equal((await update(activeSlotId, startDate, false)).code, 200)
    assert.deepEqual(activeSlots(await publicCalendar())[0], [activeSlotId, startDate, false])
    assert.equal((await adminCalendar()).result.data.events.find(event => event.timeSlotId === trialSlotId).isCancelled, false)

    assert.equal((await updateDay('2030-02-31', true)).code, 400)
    assert.equal((await updateDay(startDate, 'true')).code, 400)
    assert.equal((await updateDay(startDate, true, null)).code, 403)
    assert.equal((await update(trialSlotId, startDate, true)).code, 200)
    for (let retry = 0; retry < 2; retry += 1) {
      assert.deepEqual((await updateDay(startDate, true)).result,
        { success: true, data: { date: startDate, cancelled: true } })
    }
    const cancelledDay = (await adminCalendar()).result.data
    assert.deepEqual(cancelledDay.cancelledDates, [startDate])
    assert.deepEqual(cancelledDay.events.filter(event => event.date === startDate).map(event => [
      event.timeSlotId, event.isCancelled, event.isCancelledByDay, event.isIndividuallyCancelled,
    ]), [[activeSlotId, true, true, false], [trialSlotId, true, true, true]])
    assert.deepEqual(activeSlots(await publicCalendar()), [
      [weekBSlotId, '2030-01-14', false], [activeSlotId, '2030-01-21', false],
    ])
    const otherCalendar = (await adminCalendar(otherFacilityId)).result.data
    assert.deepEqual(otherCalendar.cancelledDates, [])
    assert.equal(otherCalendar.events.find(event => event.timeSlotId === otherSlotId).isCancelled, false)
    const filtered = (await adminCalendar(facilityId, { programId: other.classId })).result.data
    assert.deepEqual(filtered.events, [])
    assert.deepEqual(filtered.cancelledDates, [startDate])
    assert.equal((await update(trialSlotId, startDate, false)).code, 409)

    const emptyDate = '2030-01-08'
    assert.equal((await updateDay(emptyDate, true)).code, 200)
    assert.deepEqual((await adminCalendar()).result.data.cancelledDates, [startDate, emptyDate])
    const lateTrial = await addSlot(assessment, null, 16, emptyDate)
    assert.equal((await adminCalendar()).result.data.events.find(event => event.timeSlotId === lateTrial).isCancelledByDay, true)
    assert.equal((await updateDay(emptyDate, false)).code, 200)

    for (let retry = 0; retry < 2; retry += 1) {
      assert.equal((await updateDay(startDate, false)).code, 200)
    }
    const restoredDay = (await adminCalendar()).result.data
    assert.deepEqual(restoredDay.cancelledDates, [])
    assert.equal(restoredDay.events.find(event => event.timeSlotId === lateTrial).isCancelled, false)
    assert.deepEqual(activeSlots(await publicCalendar())[0], [activeSlotId, startDate, false])
    const retainedCancellation = restoredDay.events.find(event => event.timeSlotId === trialSlotId)
    assert.equal(retainedCancellation.isCancelled, true)
    assert.equal(retainedCancellation.isCancelledByDay, false)
    assert.equal(retainedCancellation.isIndividuallyCancelled, true)
  } finally {
    await db.query('ROLLBACK')
    await db.end()
  }
})

test('a day closure serializes against concurrent booking and single-session transactions', { skip: !connectionString }, async () => {
  const clients = Array.from({ length: 3 }, () => new pg.Client({ connectionString, ssl: false }))
  const [booking, sessionEdit, closure] = clients
  const facilityId = 99140162
  const date = '2091-11-21'
  try {
    await Promise.all(clients.map(client => client.connect()))
    await Promise.all(clients.map(async client => {
      await client.query('BEGIN')
      await client.query("SET LOCAL lock_timeout = '200ms'")
    }))
    await lockSchedulingDay(booking, facilityId, date, { shared: true })
    await lockSchedulingDay(sessionEdit, facilityId, date, { shared: true })
    await lockSchedulingDay(closure, facilityId + 1, date)
    await lockSchedulingDay(closure, facilityId, '2091-11-22')
    await assert.rejects(lockSchedulingDay(closure, facilityId, date), { code: '55P03' })

    await Promise.all(clients.map(client => client.query('ROLLBACK')))
    await closure.query('BEGIN')
    await closure.query("SET LOCAL lock_timeout = '200ms'")
    await lockSchedulingDay(closure, facilityId, date)
  } finally {
    await Promise.allSettled(clients.map(client => client.end()))
  }
})
