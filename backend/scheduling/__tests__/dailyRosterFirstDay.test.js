import test from 'node:test'
import assert from 'node:assert/strict'
import { firstDayBySignup } from '../dailyRosterFirstDay.js'

const slot = overrides => ({
  id: 31, form_id: 21, slot_group_id: 11, program_id: 41,
  schedule_mode: 'day', day_of_week: 1, week_letter: 'A',
  start_time: '16:00:00', end_time: '17:00:00',
  is_active: true, sg_is_active: true, form_is_active: true, class_is_active: true,
  dates_tbd: false, active_start: null, active_end: null,
  form_start_date: null, form_end_date: null,
  sg_offering_id: null, offering_id: null, sg_inherits_offering_dates: false,
  offering_start_date: null, offering_end_date: null,
  ...overrides,
})
const signup = overrides => ({
  id: 51, member_id: 61, form_id: 21, slot_group_id: 11, time_slot_id: 31,
  enrollment_start_date: '2026-11-17',
  ...overrides,
})
const newOn = (rows, person, date) => firstDayBySignup(rows, [person], date).get(Number(person.id))

test('a non-class enrollment start marks the first scheduled day, not the following class', () => {
  const rows = [slot()], person = signup()
  assert.equal(newOn(rows, person, '2026-11-17'), false)
  assert.equal(newOn(rows, person, '2026-11-23'), true)
  assert.equal(newOn(rows, person, '2026-11-30'), false)
  assert.equal(newOn(rows, signup({ enrollment_start_date: '2026-11-23' }), '2026-11-23'), true)
})

test('selected slots and whole-group enrollments have distinct first days in a multiweekly class', () => {
  const rows = [slot(), slot({ id: 32, day_of_week: 3 })]
  const people = [signup({ id: '51' }), signup({ id: '52', time_slot_id: null }), signup({ id: 53, time_slot_id: 32 })]
  assert.deepEqual(firstDayBySignup(rows, people, '2026-11-18'), new Map([[51, false], [52, true], [53, true]]))
  assert.deepEqual(firstDayBySignup(rows, people, '2026-11-23'), new Map([[51, true], [52, false], [53, false]]))
})

test('selected slots retain the full A/B rotation context', () => {
  const rows = [
    slot({ active_start: '2026-11-16', week_letter: 'A' }),
    slot({ id: 32, active_start: '2026-11-16', week_letter: 'B' }),
  ]
  const weekA = signup(), weekB = signup({ id: 52, time_slot_id: 32, enrollment_start_date: '2026-11-16' })
  assert.equal(newOn(rows, weekA, '2026-11-23'), false)
  assert.equal(newOn(rows, weekA, '2026-11-30'), true)
  assert.equal(newOn(rows, weekB, '2026-11-23'), true)
  assert.equal(newOn(rows, weekB, '2026-12-07'), false)
  assert.equal(newOn(rows, signup({ time_slot_id: null, enrollment_start_date: '2026-11-16' }), '2026-11-23'), false)
})

test('offering dates override inherited form dates and enforce the offering window', () => {
  const rows = [slot({
    offering_id: 71, sg_offering_id: 71, sg_inherits_offering_dates: true,
    form_start_date: '2026-11-01', form_end_date: '2026-11-10',
    offering_start_date: '2026-11-20', offering_end_date: '2026-11-30',
  })]
  const person = signup({ enrollment_start_date: '2026-11-01' })
  assert.equal(newOn(rows, person, '2026-11-16'), false)
  assert.equal(newOn(rows, person, '2026-11-23'), true)
  assert.equal(newOn(rows, signup({ enrollment_start_date: '2026-12-01' }), '2026-12-07'), false)
})

test('first days beyond the billing helper’s look-ahead horizon are still recognized', () => {
  const person = signup({ enrollment_start_date: '2026-01-01' })
  const dated = [slot({ schedule_mode: 'date', specific_date: '2029-01-01' })]
  assert.equal(newOn(dated, person, '2029-01-01'), true)
  const offering = [slot({ offering_id: 71, sg_offering_id: 71, sg_inherits_offering_dates: true, offering_start_date: '2029-01-01' })]
  assert.equal(newOn(offering, person, '2029-01-01'), true)
})

test('specific dates, explicit slot bounds, and TBD schedules are honored', () => {
  const person = signup({ enrollment_start_date: '2026-11-01' })
  assert.equal(newOn([slot({ schedule_mode: 'date', specific_date: '2026-11-19' })], person, '2026-11-19'), true)
  assert.equal(newOn([slot({ schedule_mode: 'date', specific_date: '2026-11-19', active_end: '2026-11-18' })], person, '2026-11-19'), false)
  assert.equal(newOn([slot({ active_start: '2026-11-20', active_end: '2026-11-22' })], person, '2026-11-23'), false)
  assert.equal(newOn([slot({ dates_tbd: true })], person, '2026-11-23'), false)
})

test('inactive schedule components cannot create a first day', () => {
  for (const flag of ['form_is_active', 'class_is_active', 'sg_is_active', 'is_active']) {
    assert.equal(newOn([slot({ [flag]: false })], signup(), '2026-11-23'), false, flag)
  }
  const rows = [slot(), slot({ id: 32, day_of_week: 3, is_active: false })]
  assert.equal(newOn(rows, signup({ time_slot_id: null }), '2026-11-23'), true)
})

test('an established member can be New in another class independently of their account age', () => {
  const rows = [slot(), slot({ id: 32, form_id: 22, slot_group_id: 12, program_id: 42 })]
  const people = [
    signup({ enrollment_start_date: '2026-01-01', created_at: '2025-01-01' }),
    signup({ id: 52, form_id: 22, slot_group_id: 12, time_slot_id: 32, created_at: '2025-01-01' }),
  ]
  assert.deepEqual(firstDayBySignup(rows, people, '2026-11-23'), new Map([[51, false], [52, true]]))
})

test('missing member identities or schedules never get a New label', () => {
  assert.equal(newOn([slot()], signup({ member_id: null }), '2026-11-23'), false)
  assert.equal(newOn([], signup(), '2026-11-23'), false)
  assert.equal(newOn([slot()], signup({ form_id: 22 }), '2026-11-23'), false)
  assert.equal(newOn([slot()], signup({ slot_group_id: null }), '2026-11-23'), false)
  assert.equal(newOn([slot()], signup({ time_slot_id: 999 }), '2026-11-23'), false)
})

test('missing, malformed, impossible, and future enrollment dates do not guess from creation time', () => {
  for (const value of [null, undefined, '', '11/17/2026', '2026-02-30', '2026-13-01', '2026-11-17T00:00:00Z', '2026-11-24']) {
    assert.equal(newOn([slot()], signup({ enrollment_start_date: value, created_at: '2026-11-17' }), '2026-11-23'), false, String(value))
  }
  for (const reportDate of [null, '', '2026-02-30', '2026-13-01']) {
    assert.equal(newOn([slot()], signup(), reportDate), false)
  }
})

test('multiple members with the same enrollment schedule receive the same independent result', () => {
  const people = [signup(), signup({ id: 52, member_id: 62 }), signup({ id: 53, member_id: null })]
  assert.deepEqual(firstDayBySignup([slot()], people, '2026-11-23'), new Map([[51, true], [52, true], [53, false]]))
})
