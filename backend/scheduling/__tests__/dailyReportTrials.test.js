import test from 'node:test'
import assert from 'node:assert/strict'
import { loadDailyReportTrials } from '../dailyReportTrials.js'

const since = new Date('2026-11-11T11:00:00Z')
const through = new Date('2026-11-12T11:00:00Z')
const booking = {
  id: '1', member_id: '11', form_id: '21', slot_group_id: '31', class_date: '2026-11-16',
  registered_at: since, status: 'confirmed', first_name: ' Sam ', last_name: ' Lee ',
  email: 'parent@example.test', phone: '2025550123', class_name: 'Twisters', program_name: 'Gymnastics',
}
const slot = {
  id: 41, form_id: 21, slot_group_id: 31, schedule_mode: 'day', day_of_week: 1,
  start_time: '16:00:00', end_time: '17:00:00', is_active: true, sg_is_active: true,
  form_is_active: true, week_letter: 'A', form_start_date: '2026-11-02',
}

function database(bookings, slots) {
  let scheduleReads = 0
  return {
    get scheduleReads() { return scheduleReads },
    async query(sql, values) {
      if (sql.includes('information_schema.tables')) return { rows: [{ table_name: 'programs' }] }
      if (sql.includes('information_schema.columns')) return { rows: [{ column_name: 'programs_id' }, { column_name: 'program_id' }] }
      if (sql.includes('FROM drop_in_registration d')) {
        assert.deepEqual(values, [since, through])
        return { rows: bookings }
      }
      if (sql.includes('FROM scheduling_time_slot ts')) {
        scheduleReads++
        assert.deepEqual(values, [[31]])
        return { rows: slots }
      }
      assert.fail(`Unexpected query: ${sql}`)
    },
  }
}

test('trial summary keeps siblings and future reservations, with only the booked occurrence label', async () => {
  const db = database([booking, { ...booking, id: '2', member_id: '12', first_name: 'Jo', status: 'attended' }], [
    slot,
    { ...slot, id: 42, day_of_week: 3, start_time: '18:00:00', end_time: '19:00:00' },
  ])
  const trials = await loadDailyReportTrials(db, { since, through })
  assert.equal(trials.length, 2)
  assert.deepEqual(trials[0], {
    id: 1, memberId: 11, name: 'Sam Lee', email: 'parent@example.test', phone: '202-555-0123',
    className: 'Twisters', programName: 'Gymnastics', classDate: '2026-11-16',
    scheduleLabel: '2026-11-16 · 16:00–17:00', registeredAt: since, status: 'confirmed', benefitType: 'free_trial',
  })
  assert.equal(trials[1].name, 'Jo Lee')
  assert.equal(trials[1].status, 'attended')
  assert.equal(db.scheduleReads, 1)
})

test('trial schedule respects alternating weeks and inherited offering dates', async () => {
  const db = database([
    { ...booking, class_date: '2026-11-09' },
    { ...booking, id: '2', class_date: '2026-10-26' },
  ], [
    { ...slot, sg_offering_id: 5, sg_inherits_offering_dates: true, offering_start_date: '2026-11-02', offering_end_date: '2026-12-01' },
    { ...slot, id: 42, week_letter: 'B', start_time: '18:00:00', end_time: '19:00:00',
      sg_offering_id: 5, sg_inherits_offering_dates: true, offering_start_date: '2026-11-02', offering_end_date: '2026-12-01' },
  ])
  const trials = await loadDailyReportTrials(db, { since, through })
  assert.equal(trials[0].scheduleLabel, '2026-11-09 · 18:00–19:00')
  assert.equal(trials[1].scheduleLabel, '')
})

test('an inactive A-week slot does not turn the active B-week slot into a weekly class', async () => {
  const db = database([
    { ...booking, class_date: '2026-11-02' },
    { ...booking, id: '2', class_date: '2026-11-09' },
  ], [
    { ...slot, is_active: false },
    { ...slot, id: 42, week_letter: 'B', start_time: '18:00:00', end_time: '19:00:00' },
  ])
  const trials = await loadDailyReportTrials(db, { since, through })
  assert.equal(trials[0].scheduleLabel, '')
  assert.equal(trials[1].scheduleLabel, '2026-11-09 · 18:00–19:00')
})

test('trial labels exclude inactive forms, classes and groups', async () => {
  for (const flag of ['form_is_active', 'class_is_active', 'sg_is_active']) {
    const trials = await loadDailyReportTrials(database([booking], [{ ...slot, [flag]: false }]), { since, through })
    assert.equal(trials[0].scheduleLabel, '', flag)
  }
})

test('trial summaries tolerate missing member and timetable details without guessing a date', async () => {
  const trials = await loadDailyReportTrials(database([
    { ...booking, member_id: null, first_name: '', last_name: '', program_name: null, phone: 'extension 6' },
  ], []), { since, through })
  assert.equal(trials[0].memberId, null)
  assert.equal(trials[0].name, 'Unnamed athlete')
  assert.equal(trials[0].programName, null)
  assert.equal(trials[0].phone, 'extension 6')
  assert.equal(trials[0].scheduleLabel, '')
})

test('empty trial window does not load timetable rows', async () => {
  const db = database([], [])
  assert.deepEqual(await loadDailyReportTrials(db, { since, through }), [])
  assert.equal(db.scheduleReads, 0)
})
