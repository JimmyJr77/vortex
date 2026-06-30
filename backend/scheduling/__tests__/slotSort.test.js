import test from 'node:test'
import assert from 'node:assert/strict'
import {
  compareOccurrenceRows,
  compareScheduleCatalogOptions,
  compareSlotGroups,
  groupSlotGroupsByWeek,
  sortOccurrenceRows,
  weekBucketLabel,
} from '../slotSort.js'

test('sortOccurrenceRows orders Monday before Sunday', () => {
  const sorted = sortOccurrenceRows([
    { id: 1, day_of_week: 0, start_time: '09:00', schedule_mode: 'day' },
    { id: 2, day_of_week: 1, start_time: '09:00', schedule_mode: 'day' },
    { id: 3, day_of_week: 3, start_time: '09:00', schedule_mode: 'day' },
  ])
  assert.deepEqual(
    sorted.map((row) => row.day_of_week),
    [1, 3, 0],
  )
})

test('sortOccurrenceRows orders specific dates chronologically', () => {
  const sorted = sortOccurrenceRows([
    { id: 1, specific_date: '2026-07-04', start_time: '10:00', schedule_mode: 'date' },
    { id: 2, specific_date: '2026-06-01', start_time: '10:00', schedule_mode: 'date' },
  ])
  assert.deepEqual(
    sorted.map((row) => row.specific_date),
    ['2026-06-01', '2026-07-04'],
  )
})

test('compareSlotGroups sorts by active start then day of week', () => {
  const groups = [
    {
      id: 1,
      activeStart: '2026-06-01',
      datesTbd: false,
      occurrences: [{ id: 10, dayOfWeek: 3, startTime: '18:00', scheduleMode: 'day' }],
    },
    {
      id: 2,
      activeStart: '2026-06-01',
      datesTbd: false,
      occurrences: [{ id: 11, dayOfWeek: 1, startTime: '18:00', scheduleMode: 'day' }],
    },
    {
      id: 3,
      activeStart: '2026-05-01',
      datesTbd: false,
      occurrences: [{ id: 12, dayOfWeek: 5, startTime: '18:00', scheduleMode: 'day' }],
    },
  ]
  const sorted = [...groups].sort(compareSlotGroups)
  assert.deepEqual(
    sorted.map((g) => g.id),
    [3, 2, 1],
  )
})

test('groupSlotGroupsByWeek keeps sorted groups within week buckets', () => {
  const grouped = groupSlotGroupsByWeek([
    {
      id: 2,
      scheduleMode: 'day',
      activeStart: '2026-06-01',
      datesTbd: false,
      occurrences: [{ id: 11, dayOfWeek: 3, startTime: '18:00', scheduleMode: 'day', weekLetter: 'A' }],
    },
    {
      id: 1,
      scheduleMode: 'day',
      activeStart: '2026-06-01',
      datesTbd: false,
      occurrences: [{ id: 10, dayOfWeek: 1, startTime: '18:00', scheduleMode: 'day', weekLetter: 'A' }],
    },
  ])
  assert.equal(weekBucketLabel(grouped[0][0]), 'A-Week')
  assert.deepEqual(
    grouped[0][1].map((g) => g.id),
    [1, 2],
  )
})

test('compareScheduleCatalogOptions orders date-mode slots chronologically', () => {
  assert.ok(
    compareScheduleCatalogOptions(
      {
        slotGroupId: 1,
        scheduleMode: 'date',
        specificDate: '2026-07-04',
        startTime: '10:00',
      },
      {
        slotGroupId: 2,
        scheduleMode: 'date',
        specificDate: '2026-06-01',
        startTime: '10:00',
      },
    ) > 0,
  )
})

test('compareOccurrenceRows sorts by start time within same day', () => {
  assert.ok(
    compareOccurrenceRows(
      { id: 1, day_of_week: 1, start_time: '17:00', schedule_mode: 'day' },
      { id: 2, day_of_week: 1, start_time: '09:00', schedule_mode: 'day' },
    ) > 0,
  )
})
