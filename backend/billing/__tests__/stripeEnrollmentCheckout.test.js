import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeEnrollmentDueNowCents,
  computeFirstMonthBillingAnchorDate,
  computeFirstMonthTuitionLineItems,
  computeSubscriptionBillingAnchorDate,
  enrollmentHasRecurringMembership,
  formatEnrollmentCheckoutSubmitMessage,
  formatFirstMonthTuitionLineName,
  resolveEnrollmentCheckoutMode,
  resolvePerClassMonthlyAmountCents,
  shouldShowEnrollmentCheckoutSubmitMessage,
} from '../stripeEnrollmentCheckout.js'
import { firstOfNextMonth } from '../../scheduling/firstMonthProration.js'

test('formatEnrollmentCheckoutSubmitMessage covers first-month pay and per-class renewals', () => {
  const message = formatEnrollmentCheckoutSubmitMessage()
  assert.match(message, /first-month tuition and any additional fees/i)
  assert.match(message, /assigned class start date/i)
  assert.match(message, /cancelled separately/i)
})

test('shouldShowEnrollmentCheckoutSubmitMessage is false for one-time class or event purchases', () => {
  const oneTimeOnly = {
    newSignups: [{ billingType: 'one_time', incrementalMonthly: 75 }],
  }
  assert.equal(enrollmentHasRecurringMembership(oneTimeOnly), false)
  assert.equal(shouldShowEnrollmentCheckoutSubmitMessage(oneTimeOnly), false)

  const passOnly = { newSignups: [], passPurchases: [{ programsId: 1, packageId: 2 }] }
  assert.equal(shouldShowEnrollmentCheckoutSubmitMessage(passOnly), false)
})

test('shouldShowEnrollmentCheckoutSubmitMessage is true for recurring membership enrollments', () => {
  const recurring = {
    newSignups: [{ billingType: 'recurring', incrementalMonthly: 150 }],
  }
  assert.equal(enrollmentHasRecurringMembership(recurring), true)
  assert.equal(shouldShowEnrollmentCheckoutSubmitMessage(recurring), true)
})

test('enrollmentHasRecurringMembership ignores zero-dollar recurring lines', () => {
  const preview = {
    newSignups: [{ billingType: 'recurring', incrementalMonthly: 0, monthlyPrice: 0 }],
  }
  assert.equal(enrollmentHasRecurringMembership(preview), false)
})

test('formatFirstMonthTuitionLineName uses tuition wording for a full remaining month', () => {
  const name = formatFirstMonthTuitionLineName({
    formTitle: 'Typhoons',
    proratedCents: 15000,
    remainingClasses: 4,
    classesPerMonth: 4,
    ratio: 1,
  })
  assert.match(name, /first month tuition/i)
  assert.doesNotMatch(name, /prorated/i)
})

test('formatFirstMonthTuitionLineName uses prorated wording for partial months', () => {
  const name = formatFirstMonthTuitionLineName({
    formTitle: 'Typhoons',
    proratedCents: 7500,
    remainingClasses: 2,
    classesPerMonth: 4,
    ratio: 0.5,
  })
  assert.match(name, /first month \(prorated\)/i)
})

test('computeFirstMonthTuitionLineItems separates prorated and prepaid per class', () => {
  const preview = {
    firstMonth: {
      enabled: true,
      items: [
        {
          slotKey: 'a',
          formTitle: 'Typhoons',
          proratedCents: 11250,
          prepaidFirstMonthCents: 0,
          remainingClasses: 3,
          classesPerMonth: 4,
          ratio: 0.75,
        },
        {
          slotKey: 'b',
          displayLine: 'Future Class',
          proratedCents: 0,
          prepaidFirstMonthCents: 15000,
        },
      ],
    },
  }
  const lines = computeFirstMonthTuitionLineItems(preview)
  assert.equal(lines.length, 2)
  assert.equal(lines[0].amountCents, 11250)
  assert.match(lines[0].name, /prorated/i)
  assert.equal(lines[1].amountCents, 15000)
  assert.match(lines[1].name, /prepaid/i)
})

test('computeFirstMonthBillingAnchorDate uses next 1st after in-session tuition paid now', () => {
  const anchor = computeFirstMonthBillingAnchorDate(
    {
      proratedCents: 15000,
      classStartsFutureMonth: false,
      firstBillDate: '2026-08-01',
    },
    '2026-07-04',
  )
  assert.equal(anchor, '2026-08-01')
})

test('computeFirstMonthBillingAnchorDate defers recurring until month after prepaid service month', () => {
  const anchor = computeFirstMonthBillingAnchorDate(
    {
      proratedCents: 0,
      prepaidFirstMonthCents: 15000,
      classStartsFutureMonth: true,
      firstBillDate: '2026-09-01',
    },
    '2026-07-04',
  )
  assert.equal(anchor, firstOfNextMonth('2026-09-01'))
})

test('computeSubscriptionBillingAnchorDate picks latest anchor across lines', () => {
  const preview = {
    firstMonth: {
      enabled: true,
      items: [
        {
          proratedCents: 15000,
          classStartsFutureMonth: false,
          firstBillDate: '2026-08-01',
        },
        {
          prepaidFirstMonthCents: 15000,
          classStartsFutureMonth: true,
          firstBillDate: '2026-09-01',
        },
      ],
    },
  }
  assert.equal(computeSubscriptionBillingAnchorDate(preview, '2026-07-04'), '2026-10-01')
})

test('computeEnrollmentDueNowCents matches fees plus first-month tuition', () => {
  const preview = {
    additionalFeesOneTime: 85,
    firstMonth: { totalCents: 15000 },
    passPurchaseTotalCents: 0,
    carriedForward: { totalCents: 0 },
  }
  assert.equal(computeEnrollmentDueNowCents(preview), 23500)
})

test('resolveEnrollmentCheckoutMode uses payment for due-now and setup when only recurring', () => {
  const withDueNow = {
    additionalFeesOneTime: 85,
    firstMonth: { totalCents: 15000 },
    newSignups: [{ billingType: 'recurring', incrementalMonthly: 150 }],
  }
  assert.equal(resolveEnrollmentCheckoutMode(withDueNow), 'payment')

  const recurringOnly = {
    additionalFeesOneTime: 0,
    firstMonth: { totalCents: 0 },
    newSignups: [{ billingType: 'recurring', incrementalMonthly: 150 }],
  }
  assert.equal(resolveEnrollmentCheckoutMode(recurringOnly), 'setup')
})

test('resolvePerClassMonthlyAmountCents prefers ledger net then first-month net', () => {
  const preview = {
    firstMonth: {
      items: [{ slotKey: 'a:1:2', monthlyNetCents: 12000 }],
    },
    discounts: {
      enabled: true,
      lines: [{ key: 'a:1:2', finalCents: 14000 }],
    },
    newSignups: [{ slotKey: 'a:1:2', incrementalMonthly: 150 }],
  }
  assert.equal(resolvePerClassMonthlyAmountCents(preview, 'a:1:2', { netMonthlyCents: 11000 }), 11000)
  assert.equal(resolvePerClassMonthlyAmountCents(preview, 'a:1:2'), 12000)
  assert.equal(
    resolvePerClassMonthlyAmountCents(
      { ...preview, firstMonth: { items: [] } },
      'a:1:2',
    ),
    14000,
  )
})

test('stripSignupBatchPayload drops analytics before signup Joi validation', async () => {
  const { stripSignupBatchPayload } = await import('../stripeEnrollmentCheckout.js')
  const stripped = stripSignupBatchPayload({
    signups: [{ formId: 1, slotGroupId: 2 }],
    signupAuthToken: 'tok',
    analytics: { gaClientId: 'x', gaSessionId: 'y' },
  })
  assert.equal('analytics' in stripped, false)
  assert.equal(stripped.signupAuthToken, 'tok')
  assert.equal(stripped.signups.length, 1)
})

test('resolveEnrolledMemberIdFromPayload prefers athlete JWT over payer id', async () => {
  const { resolveEnrolledMemberIdFromPayload } = await import('../stripeEnrollmentCheckout.js')
  const payload = Buffer.from(JSON.stringify({ memberId: 61, formId: 12 })).toString('base64url')
  const token = `hdr.${payload}.sig`
  assert.equal(
    resolveEnrolledMemberIdFromPayload({ signupAuthToken: token, signups: [] }, 13),
    61,
  )
  assert.equal(resolveEnrolledMemberIdFromPayload({ signups: [] }, 13), 13)
})

test('resolveSubscriptionTrialEndUnix clamps past anchors into the future', async () => {
  const { resolveSubscriptionTrialEndUnix } = await import('../stripeEnrollmentCheckout.js')
  const nowSec = Math.floor(Date.UTC(2026, 6, 27, 12, 0, 0) / 1000)
  const past = resolveSubscriptionTrialEndUnix('2020-01-01', nowSec)
  assert.equal(past, nowSec + 60)
  const future = resolveSubscriptionTrialEndUnix('2026-09-01', nowSec)
  assert.ok(future > nowSec + 60)
})

test('resolveEnrolledMemberIdFromPayload keeps athlete id for fee-scoped checkout preview', async () => {
  const { resolveEnrolledMemberIdFromPayload } = await import('../stripeEnrollmentCheckout.js')
  // Payer Jimmy (13) checking out for Cannon (62) must not inherit Jimmy's annual-fee redemption.
  const payload = Buffer.from(JSON.stringify({ memberId: 62, formId: 31 })).toString('base64url')
  const token = `hdr.${payload}.sig`
  assert.equal(
    resolveEnrolledMemberIdFromPayload({ signupAuthToken: token, signups: [{ formId: 31 }] }, 13),
    62,
  )
})
