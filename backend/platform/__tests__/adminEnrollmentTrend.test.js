import assert from 'node:assert/strict'
import test from 'node:test'
import { buildEnrollmentTrend, loadEnrollmentTrend } from '../adminEnrollmentTrend.js'

const at = date => new Date(`${date}T17:00:00Z`)
const historical = (family_id, start_date, end_date = null) => ({ family_id, start_date, end_date })
const live = (id, family_id, start_date, cancel_date = null) => ({ id, family_id, start_date, cancel_date, status: cancel_date ? 'cancelled' : 'confirmed' })

test('siblings and touching class transfers count as one retained family', () => {
  const data = buildEnrollmentTrend({ historical: [
    historical(1, '2026-01-19', '2026-02-02'), historical(1, '2026-02-02'),
    historical(1, '2026-02-02'), historical(2, '2026-02-10'),
  ] }, at('2026-03-15'))
  assert.equal(data.months[0].lossRate, null)
  assert.equal(data.months[1].openingFamilies, 1)
  assert.equal(data.months[1].newFamilies, 1)
  assert.equal(data.months[1].lostFamilies, 0)
  assert.equal(data.months[2].newFamilies, 0)
  assert.equal(data.months[2].partial, true)
})

test('loss rate measures opening families; returning and new families are distinct', () => {
  const data = buildEnrollmentTrend({ historical: [
    historical(1, '2026-01-19', '2026-02-05'), historical(1, '2026-03-10'),
    historical(2, '2026-01-20', '2026-02-01'), historical(2, '2026-02-20'),
    historical(3, '2026-02-10', '2026-02-12'),
  ] }, at('2026-03-15'))
  assert.equal(data.months[1].openingFamilies, 2)
  assert.equal(data.months[1].lostFamilies, 1)
  assert.equal(data.months[1].lossRate, 50)
  assert.equal(data.months[1].newFamilies, 1)
  assert.equal(data.months[2].newFamilies, 0)
})

test('Jackrabbit migration does not create a new family or conceal live cancellation', () => {
  const data = buildEnrollmentTrend({ historical: [historical(1, '2026-01-19')],
    live: [live(10, 1, '2026-09-01', '2026-10-04')],
  }, at('2026-11-08'))
  assert.equal(data.months[8].newFamilies, 0)
  assert.equal(data.months[8].lostFamilies, 0)
  assert.equal(data.months[9].lostFamilies, 1)
  assert.equal(data.months[9].lossRate, 100)
  assert.equal(data.months[8].provisional, true)
  assert.match(data.notes.join(' '), /bridged/)
})

test('exclude tests, erroneous enrollments and future starts; flag undated cancellations', () => {
  const data = buildEnrollmentTrend({ live: [live(1, 1, '2026-09-01'), live(2, 2, '2026-09-02'),
    live(3, 3, '2026-12-02'), { ...live(4, 4, '2026-09-01'), status: 'cancelled' }],
    events: [{ signup_id: 2, details: { reason: 'test' } }],
  }, at('2026-11-08'))
  assert.equal(data.months[8].newFamilies, 2)
  assert.equal(data.months[9].newFamilies, 0)
  assert.equal(data.months[10].newFamilies, 0)
  assert.equal(data.months[9].provisional, true)
  assert.match(data.notes.join(' '), /no end date/)
})

test('effective cancellation date takes precedence over previous-day action timestamp', () => {
  const data = buildEnrollmentTrend({ live: [live(1, 1, '2026-07-01', '2026-09-01')],
    events: [{ signup_id: 1, event_type: 'enrollment_cancelled_immediately', occurred_on: '2026-08-31' }],
  }, at('2026-10-08'))
  assert.equal(data.months[7].lostFamilies, 0)
  assert.equal(data.months[8].lostFamilies, 1)
})

test('undated class swaps use activity effective dates; same-day replacements retain family', () => {
  const data = buildEnrollmentTrend({ live: [{ ...live(1, 1, '2026-07-01'), status: 'cancelled' }, live(2, 1, '2026-09-10')],
    events: [{ signup_id: 1, event_type: 'enrollment_class_swapped', details: { effectiveDate: '2026-09-10' } }],
  }, at('2026-10-08'))
  assert.equal(data.months[8].lostFamilies, 0)
  assert.equal(data.months[8].newFamilies, 0)
  assert.equal(data.months[8].provisional, false)
})

test('empty data is unavailable and calendar month uses New York time', () => {
  const data = buildEnrollmentTrend({}, new Date('2026-11-01T02:00:00Z'))
  assert.equal(data.months.length, 10)
  assert.ok(data.months.every(row => row.lossRate === null && row.newFamilies === null))
})

test('old admin uses the shared New Admin enrollment loader and metrics', async () => {
  const shared = await import('../../newAdmin/enrollmentTrend.js')
  assert.equal(loadEnrollmentTrend, shared.loadEnrollmentTrend)
  assert.equal(buildEnrollmentTrend, shared.buildEnrollmentTrend)
})
