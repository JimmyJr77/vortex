import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildGroupDisplayLabel,
  buildSlotDisplayLabel,
  slotLabelForSignupRow,
} from '../slotDisplayLabel.js'

test('buildSlotDisplayLabel formats day and time', () => {
  const label = buildSlotDisplayLabel({
    day_of_week: 1,
    start_time: '18:00:00',
    end_time: '19:30:00',
    schedule_mode: 'day',
  })
  assert.equal(label, 'Monday · 18:00–19:30')
})

test('buildGroupDisplayLabel joins occurrences', () => {
  const label = buildGroupDisplayLabel([
    { day_of_week: 1, start_time: '18:00', end_time: '19:00', schedule_mode: 'day' },
    { day_of_week: 3, start_time: '18:00', end_time: '19:00', schedule_mode: 'day' },
  ])
  assert.match(label, /Monday/)
  assert.match(label, /Wednesday/)
})

test('slotLabelForSignupRow prefers time slot over group label', () => {
  const label = slotLabelForSignupRow(
    {
      time_slot_id: 5,
      slot_group_id: 2,
      day_of_week: 2,
      start_time: '17:00',
      end_time: '18:00',
      schedule_mode: 'day',
    },
    new Map([[2, 'Group fallback']]),
  )
  assert.equal(label, 'Tuesday · 17:00–18:00')
})

test('resolveEnrollmentOfferingDisplay formats offering date range', async () => {
  const { resolveEnrollmentOfferingDisplay } = await import('../slotDisplayLabel.js')
  const result = resolveEnrollmentOfferingDisplay({
    offering_label: 'Summer Session',
    offering_start_date: '2025-06-02',
    offering_end_date: '2025-08-15',
  })
  assert.equal(result.offering_label, 'Summer Session')
  assert.equal(result.offering_start_date, '2025-06-02')
  assert.equal(result.offering_end_date, '2025-08-15')
  assert.match(result.offering_dates, /Jun 2, 2025/)
  assert.match(result.offering_dates, /Aug 15, 2025/)
})

test('resolveEnrollmentOfferingDisplay falls back to slot group active dates', async () => {
  const { resolveEnrollmentOfferingDisplay } = await import('../slotDisplayLabel.js')
  const result = resolveEnrollmentOfferingDisplay({
    group_active_start: '2025-07-01',
    group_active_end: '2025-07-31',
  })
  assert.match(result.offering_dates, /Jul 1, 2025/)
  assert.match(result.offering_dates, /Jul 31, 2025/)
})
