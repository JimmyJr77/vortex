import test from 'node:test'
import assert from 'node:assert/strict'
import { dropInOccurrences } from '../dropInOccurrences.js'

const slot = (overrides = {}) => ({
  form_id: 1, calendar_slot_id: 10, calendar_group_id: 20,
  calendar_schedule_mode: 'day', calendar_week_letter: 'A', calendar_slot_active: true,
  calendar_group_start: '2026-11-16', day_of_week: 1,
  start_time: '12:00', end_time: '13:00', excluded_from_drop_ins: false,
  ...overrides,
})

test('mixed eligibility blocks every time sharing the actual group/date reservation', () => {
  const rows = [slot(), slot({ calendar_slot_id: 11, start_time: '14:00', end_time: '15:00', excluded_from_drop_ins: true })]
  const occurrences = dropInOccurrences(rows, '2026-11-16')
  assert.equal(occurrences.length, 2)
  assert.ok(occurrences.every(item => item.excludedFromDropIns))
})

test('an excluded sibling on a different date does not block the allowed date', () => {
  const rows = [slot(), slot({ calendar_slot_id: 11, day_of_week: 3, excluded_from_drop_ins: true })]
  assert.deepEqual(dropInOccurrences(rows, '2026-11-16', '2026-11-18').map(({ date, excludedFromDropIns }) => ({ date, excludedFromDropIns })), [
    { date: '2026-11-16', excludedFromDropIns: false }, { date: '2026-11-18', excludedFromDropIns: true },
  ])
})

test('excluded A/B siblings retain their rotation and cannot become weekly allowed bookings', () => {
  const rows = [slot(), slot({ calendar_slot_id: 11, calendar_week_letter: 'B', excluded_from_drop_ins: true })]
  assert.deepEqual(dropInOccurrences(rows, '2026-11-16', '2026-11-30').map(({ date, excludedFromDropIns }) => ({ date, excludedFromDropIns })), [
    { date: '2026-11-16', excludedFromDropIns: false }, { date: '2026-11-23', excludedFromDropIns: true }, { date: '2026-11-30', excludedFromDropIns: false },
  ])
})

test('inactive siblings retain rotation context without blocking or producing a session', () => {
  const rows = [slot({ excluded_from_drop_ins: true, calendar_slot_active: false }), slot({ calendar_slot_id: 11, calendar_week_letter: 'B' })]
  assert.deepEqual(dropInOccurrences(rows, '2026-11-16', '2026-11-30').map(({ date, excludedFromDropIns }) => ({ date, excludedFromDropIns })), [
    { date: '2026-11-23', excludedFromDropIns: false },
  ])
})

test('slot date bounds and TBD siblings do not incorrectly block an occurrence', () => {
  const excluded = { calendar_slot_id: 11, excluded_from_drop_ins: true }
  for (const override of [{ calendar_slot_start: '2026-12-01' }, { calendar_slot_end: '2026-11-15' }, { calendar_slot_tbd: true }]) {
    const occurrences = dropInOccurrences([slot(), slot({ ...excluded, ...override })], '2026-11-16')
    assert.equal(occurrences.length, 1)
    assert.equal(occurrences[0].excludedFromDropIns, false)
  }
})

test('offering inheritance supplies both calendar boundaries and rotation anchor', () => {
  const inherited = { calendar_offering_id: 30, calendar_inherits_offering: true,
    calendar_offering_start: '2026-11-23', calendar_offering_end: '2026-12-01' }
  const rows = [slot(inherited), slot({ ...inherited, calendar_slot_id: 11, calendar_week_letter: 'B', excluded_from_drop_ins: true })]
  assert.deepEqual(dropInOccurrences(rows, '2026-11-16', '2026-12-07').map(({ date, excludedFromDropIns }) => ({ date, excludedFromDropIns })), [
    { date: '2026-11-23', excludedFromDropIns: false }, { date: '2026-11-30', excludedFromDropIns: true },
  ])
})
