import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCustomerBillingCancellationInput } from '../customerBillingEnrollmentCancellation.js'

test('customer billing cancellation defaults immediate and end-of-month effective dates safely', () => {
  const now = new Date('2026-08-30T16:00:00.000Z')
  assert.deepEqual(
    normalizeCustomerBillingCancellationInput({ mode: 'immediate', reason: 'Moving away' }, now),
    { mode: 'immediate', reason: 'Moving away', effectiveDate: '2026-08-30', today: '2026-08-30' },
  )
  assert.equal(
    normalizeCustomerBillingCancellationInput({ mode: 'end_of_month', reason: 'Term complete' }, now).effectiveDate,
    '2026-09-01',
  )
})

test('customer billing cancellation requires a reason and a non-past specific date', () => {
  const now = new Date('2026-08-30T16:00:00.000Z')
  assert.throws(
    () => normalizeCustomerBillingCancellationInput({ mode: 'specific_date', effectiveDate: '2026-08-30' }, now),
    /reason/i,
  )
  assert.throws(
    () => normalizeCustomerBillingCancellationInput({ mode: 'specific_date', effectiveDate: '2026-08-29', reason: 'Requested' }, now),
    /past/i,
  )
})
