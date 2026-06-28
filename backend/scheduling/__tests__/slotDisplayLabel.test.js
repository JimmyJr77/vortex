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
