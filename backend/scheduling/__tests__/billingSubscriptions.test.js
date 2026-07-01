import test from 'node:test'
import assert from 'node:assert/strict'
import {
  toDateString,
  parseDbDate,
  periodKey,
  addMonthsClamped,
  computeBillingCycle,
} from '../billingSubscriptions.js'

const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d))

test('toDateString formats a UTC date as YYYY-MM-DD', () => {
  assert.equal(toDateString(utc(2026, 1, 5)), '2026-01-05')
  assert.equal(toDateString(utc(2026, 12, 31)), '2026-12-31')
})

test('periodKey returns YYYY-MM (UTC)', () => {
  assert.equal(periodKey(utc(2026, 3, 15)), '2026-03')
  assert.equal(periodKey(utc(2026, 11, 1)), '2026-11')
})

test('parseDbDate accepts strings and Date objects', () => {
  assert.equal(toDateString(parseDbDate('2026-07-04')), '2026-07-04')
  // JS Date passed by node-postgres — parsed by calendar y/m/d (tz-safe)
  const localDate = new Date(2026, 6, 4) // July 4 2026 local
  assert.equal(toDateString(parseDbDate(localDate)), '2026-07-04')
  assert.equal(parseDbDate(null), null)
  assert.equal(parseDbDate('not-a-date'), null)
})

test('addMonthsClamped advances one month keeping the anchor day', () => {
  assert.equal(toDateString(addMonthsClamped(utc(2026, 1, 15), 1, 15)), '2026-02-15')
})

test('addMonthsClamped clamps to short months (Jan 31 -> Feb 28)', () => {
  assert.equal(toDateString(addMonthsClamped(utc(2026, 1, 31), 1, 31)), '2026-02-28')
})

test('addMonthsClamped restores the anchor day after a short month (Feb 28 -> Mar 31)', () => {
  // anchor 31 is preserved across a clamp
  assert.equal(toDateString(addMonthsClamped(utc(2026, 2, 28), 1, 31)), '2026-03-31')
})

test('addMonthsClamped rolls the year over in December', () => {
  assert.equal(toDateString(addMonthsClamped(utc(2026, 12, 10), 1, 10)), '2027-01-10')
})

test('computeBillingCycle derives anchor, period end, and next bill date', () => {
  const cycle = computeBillingCycle(utc(2026, 1, 15))
  assert.equal(cycle.anchorDay, 15)
  assert.equal(cycle.startDate, '2026-01-15')
  assert.equal(cycle.nextBillDate, '2026-02-15')
  assert.equal(cycle.endDate, '2026-02-14')
})

test('computeBillingCycle handles month-end anchors with clamping', () => {
  const cycle = computeBillingCycle(utc(2026, 1, 31))
  assert.equal(cycle.anchorDay, 31)
  assert.equal(cycle.startDate, '2026-01-31')
  assert.equal(cycle.nextBillDate, '2026-02-28')
  assert.equal(cycle.endDate, '2026-02-27')
})
