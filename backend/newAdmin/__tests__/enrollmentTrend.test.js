import assert from 'node:assert/strict'
import test from 'node:test'
import { buildEnrollmentTrend, loadEnrollmentTrend } from '../enrollmentTrend.js'
const at = date => new Date(`${date}T17:00:00Z`)
const historical = (family_id, start_date, end_date = null) => ({ family_id, start_date, end_date })
const live = (id, family_id, start_date, cancel_date = null) => ({ id, family_id, start_date, cancel_date, status: cancel_date ? 'cancelled' : 'confirmed' })
const build = (data, date = '2026-04-15') => buildEnrollmentTrend(data, at(date))

test('siblings, duplicate source rows and touching class transfers count once', () => {
  const data = build({ historical: [historical(1, '2025-12-01', '2026-02-02'), historical(1, '2026-02-02', '2026-06-01'), historical(1, '2026-02-02', '2026-06-01')], live: [live(1, 1, '2026-02-02'), live(2, 2, '2026-02-10')] })
  assert.equal(data.months[1].openingFamilies, 1)
  assert.equal(data.months[1].newFamilies, 1)
  assert.equal(data.months[1].canceledFamilies, 0)
  assert.equal(data.months[1].lossRate, 0)
})
test('only the final enrollment ending cancels a family', () => {
  const data = build({ live: [live(1, 1, '2025-12-01', '2026-02-01'), live(2, 1, '2025-12-01', '2026-03-02')] })
  assert.equal(data.months[1].canceledFamilies, 0)
  assert.equal(data.months[2].canceledFamilies, 1)
  assert.equal(data.months[2].lossRate, 100)
})
test('new-and-canceled families are included in cancellations but outside opening-cohort loss rate', () => {
  const data = build({ live: [live(1, 1, '2025-12-01', '2026-02-01'), live(2, 2, '2026-02-10', '2026-02-12'), live(3, 3, '2025-12-01')] })
  assert.deepEqual([data.months[1].openingFamilies, data.months[1].newFamilies, data.months[1].canceledFamilies, data.months[1].lostFamilies, data.months[1].lossRate], [2, 1, 2, 1, 50])
})
test('same-month return is retained; a later return is not new', () => {
  const data = build({ live: [live(1, 1, '2025-12-01', '2026-02-05'), live(2, 1, '2026-03-10'), live(3, 2, '2025-12-01', '2026-02-01'), live(4, 2, '2026-02-20')] })
  assert.equal(data.months[1].canceledFamilies, 1)
  assert.equal(data.months[1].lossRate, 50)
  assert.equal(data.months[2].newFamilies, 0)
})
test('January opening cohort includes prior-year enrollment; missing/zero denominators are unavailable', () => {
  assert.equal(build({ live: [live(1, 1, '2025-12-01', '2026-01-01')] }).months[0].lossRate, 100)
  const data = build({ live: [live(1, 1, '2026-01-19', '2026-01-22')] })
  assert.equal(data.months[0].openingFamilies, null)
  assert.equal(data.months[0].newFamilies, 1)
  assert.equal(data.months[0].canceledFamilies, 1)
  assert.equal(data.months[1].openingFamilies, 0)
  assert.equal(data.months[1].lossRate, null)
})
test('Jackrabbit handoff does not create a new family or mask subsequent cancellation', () => {
  const data = build({ historical: [historical(1, '2026-01-19')], live: [live(10, 1, '2026-09-01', '2026-10-04')] }, '2026-11-08')
  assert.equal(data.months[8].newFamilies, 0)
  assert.equal(data.months[8].canceledFamilies, 0)
  assert.equal(data.months[9].lossRate, 100)
  assert.equal(data.months[9].provisional, true)
})
test('unmatched open Jackrabbit snapshots are neither perpetual active families nor invented cancellations', () => {
  const data = build({ historical: [historical(1, '2026-01-19'), historical(2, '2026-02-02', '2026-03-15')] })
  assert.equal(data.months[2].openingFamilies, 2)
  assert.equal(data.months[2].canceledFamilies, 1)
  assert.equal(data.months[3].openingFamilies, 0)
  assert.equal(data.months[3].canceledFamilies, 0)
  assert.equal(data.months[3].provisional, true)
})
test('test/error enrollments, waitlists, pending and future starts do not inflate new families', () => {
  const data = build({ live: [live(1, 1, '2026-01-01'), live(2, 2, '2026-01-01'), live(3, 3, '2026-12-01'), { ...live(4, 4, '2026-01-01'), status: 'waitlisted' }, { ...live(5, 5, '2026-01-01'), status: 'requested' }], events: [{ signup_id: 1, details: { reason: 'test' } }, { signup_id: 2, event_type: 'canceled_enrollment_error_suppressed' }] })
  assert.equal(data.excludedRecords, 2)
  assert.equal(data.months[0].newFamilies, null)
})
test('undated cancellations retain the first start without inventing the end or a later new family', () => {
  const data = build({ live: [{ ...live(1, 1, '2026-01-01'), status: 'cancelled' }, live(2, 1, '2026-03-01')] })
  assert.equal(data.months[0].newFamilies, 1)
  assert.equal(data.months[0].canceledFamilies, 0)
  assert.equal(data.months[2].newFamilies, 0)
  assert.equal(data.undatedCancellations, 1)
  assert.equal(data.months[1].provisional, true)
})
test('effective cancellation date wins over action date; canceled swap is resolved from its audit event', () => {
  const data = build({ live: [{ ...live(1, 1, '2025-12-01'), status: 'cancelled' }, { ...live(2, 2, '2025-12-01'), status: 'cancelled' }, live(3, 2, '2026-02-01')], events: [
    { signup_id: 1, event_type: 'enrollment_cancelled_immediately', after_value: { cancelEffectiveDate: '2026-02-01' }, occurred_on: '2026-01-31' },
    { signup_id: 2, event_type: 'enrollment_class_swapped', details: { effectiveDate: '2026-02-01' } },
  ] })
  assert.equal(data.months[0].canceledFamilies, 0)
  assert.equal(data.months[1].canceledFamilies, 1)
  assert.equal(data.undatedCancellations, 0)
})
test('rescinded scheduled cancellations cannot terminate confirmed enrollments', () => {
  const data = build({ live: [live(1, 1, '2025-12-01')], events: [{ signup_id: 1, event_type: 'enrollment_cancellation_scheduled', after_value: { cancelEffectiveDate: '2026-02-01' } }] })
  assert.equal(data.months[1].lossRate, 0)
})
test('current month excludes future cancellations; pauses remain enrolled and completion ends service', () => {
  const data = build({ live: [live(1, 1, '2025-12-01', '2026-04-20'), { ...live(2, 2, '2025-12-01'), status: 'paused', pause_date: '2026-02-01' }, { ...live(3, 3, '2025-12-01'), status: 'completed', program_end: '2026-03-31' }] })
  assert.equal(data.months[3].canceledFamilies, 1)
  assert.equal(data.months[3].lossRate, 33.33)
  assert.equal(data.months[3].partial, true)
})
test('invalid dates and unresolved owners are reported; calendar uses local date and resets in January', () => {
  const data = build({ historical: [historical(null, '2026-01-01'), historical(1, '2026-02-30')] })
  assert.equal(data.unresolvedRecords, 2)
  assert.ok(data.months.every(row => row.provisional && row.lossRate === null))
  assert.equal(buildEnrollmentTrend({}, new Date('2026-11-01T02:00:00Z')).months.length, 10)
  assert.equal(buildEnrollmentTrend({}, new Date('2027-01-01T05:00:00Z')).months.length, 1)
})
test('single bulk read is facility scoped and read-only; database failures propagate with rollback', async () => {
  const calls = [], client = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] } }, release: () => calls.push({ sql: 'release' }) }
  await loadEnrollmentTrend({ connect: async () => client }, 7, at('2026-04-15'))
  assert.match(calls[0].sql, /REPEATABLE READ READ ONLY/)
  assert.equal(calls.filter(c => c.sql.includes('new-admin:enrollment-trend')).length, 1)
  assert.equal(calls.find(c => c.params)?.params[0], 7)
  const failure = { ...client, query: async sql => { calls.push({ sql }); if (sql.includes('new-admin:enrollment-trend')) throw new Error('offline'); return { rows: [] } } }
  await assert.rejects(loadEnrollmentTrend({ connect: async () => failure }, 7), /offline/)
  assert.equal(calls.at(-2).sql, 'ROLLBACK')
  assert.equal(calls.at(-1).sql, 'release')
})

test('an uncertain final imported spell cannot turn an earlier cancellation into a confirmed monthly loss', () => {
  const data = build({ historical: [historical(1, '2025-12-01', '2026-02-01'), historical(1, '2026-02-03')] })
  assert.equal(data.months[1].canceledFamilies, 0)
  assert.equal(data.months[1].provisional, true)
})
test('historical trials do not create families or extend enrollment coverage', () => {
  const data = build({ historical: [{ ...historical(1, '2026-01-01'), enrollment_type: 'Trial' }] })
  assert.equal(data.historyThrough, null)
  assert.equal(data.months[0].newFamilies, null)
})
