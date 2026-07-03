import test from 'node:test'
import assert from 'node:assert/strict'
import {
  nextEnrollmentBillingChangeDate,
} from '../memberEnrollmentCancel.js'
import { firstOfNextMonth } from '../firstMonthProration.js'

test('nextEnrollmentBillingChangeDate is the 1st of the next month', () => {
  assert.equal(nextEnrollmentBillingChangeDate('2026-07-08'), '2026-08-01')
  assert.equal(nextEnrollmentBillingChangeDate('2026-07-01'), '2026-08-01')
  assert.equal(nextEnrollmentBillingChangeDate('2026-12-15'), '2027-01-01')
  assert.equal(nextEnrollmentBillingChangeDate('2026-07-08'), firstOfNextMonth('2026-07-08'))
})
