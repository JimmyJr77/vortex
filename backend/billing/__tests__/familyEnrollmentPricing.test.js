import test from 'node:test'
import assert from 'node:assert/strict'
import { enrollmentBillsInPeriod } from '../familyEnrollmentPricing.js'
import { underDiscountCreditForCharge } from '../familyDiscountAudit.js'

function recurringEnrollment(overrides = {}) {
  return {
    status: 'confirmed',
    orphaned_at: null,
    enrollment_start_date: '2026-08-15',
    offering_start_date: '2026-07-01',
    offering_end_date: null,
    cancel_effective_date: null,
    pause_effective_date: null,
    pricing_breakdown: { billingType: 'recurring' },
    ...overrides,
  }
}

test('period lifecycle excludes waitlists, paused dates, one-time classes, and ended classes', () => {
  assert.equal(enrollmentBillsInPeriod(recurringEnrollment(), '2026-09'), true)
  assert.equal(
    enrollmentBillsInPeriod(recurringEnrollment({ status: 'waitlisted' }), '2026-09'),
    false,
  )
  assert.equal(
    enrollmentBillsInPeriod(
      recurringEnrollment({ pricing_breakdown: { billingType: 'one_time' } }),
      '2026-09',
    ),
    false,
  )
  assert.equal(
    enrollmentBillsInPeriod(recurringEnrollment({ pause_effective_date: '2026-09-01' }), '2026-09'),
    false,
  )
  assert.equal(
    enrollmentBillsInPeriod(recurringEnrollment({ offering_end_date: '2026-08-31' }), '2026-09'),
    false,
  )
  assert.equal(
    enrollmentBillsInPeriod(recurringEnrollment({ enrollment_start_date: '2026-10-01' }), '2026-09'),
    false,
  )
})

test('posted full-month under-discount creates only the exact immutable credit', () => {
  assert.equal(
    underDiscountCreditForCharge({
      chargedGrossCents: 15000,
      chargedNetCents: 15000,
      expectedGrossCents: 15000,
      expectedNetCents: 12750,
    }),
    2250,
  )
  assert.equal(
    underDiscountCreditForCharge({
      chargedGrossCents: 15000,
      chargedNetCents: 12750,
      expectedGrossCents: 15000,
      expectedNetCents: 12750,
    }),
    0,
  )
  assert.equal(
    underDiscountCreditForCharge({
      chargedGrossCents: 7500,
      chargedNetCents: 7500,
      expectedGrossCents: 15000,
      expectedNetCents: 12750,
    }),
    0,
    'prorated/non-full-month charges are not auto-repaired',
  )
})
