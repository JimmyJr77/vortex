import test from 'node:test'
import assert from 'node:assert/strict'
import { expandCalendarRange } from '../calendarExpansion.js'

const baseRow = {
  id: 1,
  slot_group_id: 10,
  form_id: 100,
  program_id: 50,
  programs_id: 5,
  schedule_mode: 'day',
  day_of_week: 3,
  week_letter: 'A',
  specific_date: null,
  start_time: '19:00:00',
  end_time: '20:30:00',
  max_participants: 20,
  is_active: true,
  dates_tbd: false,
  active_start: null,
  active_end: null,
  sg_is_active: true,
  sg_active_start: null,
  sg_active_end: null,
  sg_dates_tbd: false,
  sg_offering_id: 200,
  sg_inherits_offering_dates: true,
  offering_id: 200,
  offering_start_date: '2026-09-01',
  offering_end_date: '2027-06-15',
  offering_label: 'Fall 2026',
  form_title: 'Cyclones (14-18)',
  form_is_active: true,
  form_start_date: null,
  form_end_date: '2027-06-15',
  enroll_sites: ['athletics'],
  class_name: 'Cyclones (14-18)',
  program_name: 'Fit & Flip',
  class_is_active: true,
  signup_count: 0,
  waitlist_count: 0,
}

test('expandCalendarRange excludes day occurrences before linked offering start', () => {
  const result = expandCalendarRange({
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    rows: [baseRow],
  })

  const dates = result.events.map((e) => e.date)
  assert.ok(!dates.includes('2026-07-08'), `July 8 should not appear; got ${dates.join(', ')}`)
  assert.equal(result.events.length, 0)
})

test('expandCalendarRange includes day occurrences within offering window', () => {
  const result = expandCalendarRange({
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    rows: [baseRow],
  })

  const dates = result.events.map((e) => e.date)
  assert.ok(dates.includes('2026-09-02'), 'First September Wednesday should appear')
})
