import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildEnrollmentBillingPeriodManifest,
  enrollmentBillingMemberId,
  enrollmentBillsInPeriod,
} from '../familyEnrollmentPricing.js'
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

test('nonbillable lifecycle exclusions require a safe recurring schedule', () => {
  const manifest = (overrides) => buildEnrollmentBillingPeriodManifest([
    recurringEnrollment({
      id: 41,
      subscription_status: 'active',
      source_type: 'scheduling_signup',
      source_id: '101',
      signup_id: 101,
      signup_status: 'confirmed',
      ...overrides,
    }),
  ], '2026-09-01', { requireSubscriptionMapping: true })[0]

  const future = manifest({
    enrollment_start_date: '2026-10-03',
    next_bill_date: '2026-10-01',
  })
  assert.equal(future.reason, 'enrollment_starts_after_target_month')
  assert.equal(future.exclusionScheduleValid, true)
  assert.equal(future.exclusionMinimumNextBillDate, '2026-10-01')

  for (const [nextBillDate, expectedReason] of [
    [null, 'future_enrollment_schedule_missing'],
    ['2026-08-01', 'future_enrollment_schedule_before_service_month'],
    ['2026-10-03', 'excluded_subscription_schedule_not_month_aligned'],
  ]) {
    const invalidFuture = manifest({
      enrollment_start_date: '2026-10-03',
      next_bill_date: nextBillDate,
    })
    assert.equal(invalidFuture.exclusionScheduleValid, false)
    assert.equal(invalidFuture.exclusionScheduleReason, expectedReason)
  }

  const cancellation = manifest({
    cancel_effective_date: '2026-09-01',
    next_bill_date: null,
  })
  assert.equal(cancellation.reason, 'cancellation_effective_by_target_month')
  assert.equal(cancellation.exclusionScheduleValid, true)

  const pause = manifest({
    pause_effective_date: '2026-09-01',
    next_bill_date: '2026-09-01',
  })
  assert.equal(pause.reason, 'pause_effective_by_target_month')
  assert.equal(pause.exclusionScheduleValid, true)

  const overdueCancellation = manifest({
    cancel_effective_date: '2026-09-01',
    next_bill_date: '2026-08-01',
  })
  assert.equal(overdueCancellation.exclusionScheduleValid, false)
  assert.equal(overdueCancellation.exclusionScheduleReason, 'excluded_subscription_prior_period_due')
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

test('an enrollment correction keeps its existing subscription owner for pricing', () => {
  assert.equal(
    enrollmentBillingMemberId({ memberId: 22 }, { member_id: 11 }),
    11,
  )
  assert.equal(
    enrollmentBillingMemberId({ memberId: 22 }, null),
    22,
  )
})
