import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBillingHistory,
  buildCurrentPeriod,
  chargeDisplayCategory,
  chargeOccurredAt,
  periodKeyFromDate,
} from '../billingPeriodView.js'

test('chargeDisplayCategory maps additional_fee to membership_fee', () => {
  assert.equal(chargeDisplayCategory({ source_type: 'additional_fee', amount_cents: 8500 }), 'membership_fee')
  assert.equal(
    chargeDisplayCategory({ source_type: 'scheduling_signup', charge_type: 'recurring', amount_cents: 15000 }),
    'enrollment_first_month',
  )
})

test('chargeOccurredAt uses created_at for enrollment first month charges', () => {
  const charge = {
    source_type: 'scheduling_signup',
    charge_type: 'recurring',
    created_at: '2026-07-04T18:00:00.000Z',
    service_period_start: '2026-08-01',
    amount_cents: 15000,
  }
  assert.equal(periodKeyFromDate(chargeOccurredAt(charge)), '2026-07')
})

test('buildCurrentPeriod scopes totals to calendar month', () => {
  const period = buildCurrentPeriod({
    asOf: new Date('2026-07-15T12:00:00.000Z'),
    subscriptions: [
      {
        id: 1,
        status: 'active',
        description: 'Typhoons',
        net_monthly_cents: 15000,
        monthly_amount_cents: 15000,
        discount_amount_cents: 0,
      },
    ],
    charges: [
      {
        id: 1,
        description: 'Annual Fee',
        source_type: 'additional_fee',
        amount_cents: 8500,
        created_at: '2026-07-04T18:00:00.000Z',
      },
      {
        id: 2,
        description: 'Typhoons — first month',
        source_type: 'scheduling_signup',
        charge_type: 'recurring',
        amount_cents: 15000,
        gross_amount_cents: 15000,
        discount_amount_cents: 0,
        created_at: '2026-07-04T18:00:00.000Z',
      },
      {
        id: 3,
        description: 'Old charge',
        source_type: 'manual',
        charge_type: 'one_time',
        amount_cents: 5000,
        created_at: '2026-06-01T00:00:00.000Z',
      },
    ],
    payments: [
      {
        id: 10,
        amount_cents: 23500,
        paid_at: '2026-07-04T18:05:00.000Z',
        method: 'card',
      },
    ],
  })

  assert.equal(period.key, periodKeyFromDate(new Date('2026-07-15')))
  assert.equal(period.label, 'July 2026')
  assert.equal(period.totals.chargesCents, 23500)
  assert.equal(period.totals.paymentsCents, 23500)
  assert.equal(period.totals.balanceDueCents, 0)
  assert.equal(period.membershipFees.length, 1)
  assert.equal(period.recurringCharges.length, 1)
})

test('buildCurrentPeriod includes enrollment charges paid in the signup month', () => {
  const period = buildCurrentPeriod({
    asOf: new Date('2026-07-15T12:00:00.000Z'),
    subscriptions: [],
    charges: [
      {
        id: 2,
        description: 'Typhoons — first month tuition',
        source_type: 'scheduling_signup',
        charge_type: 'recurring',
        amount_cents: 15000,
        created_at: '2026-07-04T18:00:00.000Z',
        service_period_start: '2026-08-01',
      },
    ],
    payments: [
      {
        id: 10,
        amount_cents: 15000,
        paid_at: '2026-07-04T18:05:00.000Z',
        method: 'card',
      },
    ],
  })

  assert.equal(period.totals.chargesCents, 15000)
  assert.equal(period.totals.paymentsCents, 15000)
  assert.equal(period.totals.balanceDueCents, 0)
  assert.equal(period.recurringCharges.length, 1)
  assert.equal(period.payments.length, 1)
})

test('buildBillingHistory returns recent months with lines', () => {
  const history = buildBillingHistory({
    asOf: new Date('2026-07-15T12:00:00.000Z'),
    months: 2,
    charges: [
      {
        id: 1,
        description: 'Fee',
        source_type: 'additional_fee',
        amount_cents: 8500,
        created_at: '2026-07-04T18:00:00.000Z',
      },
    ],
    payments: [
      {
        id: 10,
        amount_cents: 8500,
        paid_at: '2026-07-04T18:05:00.000Z',
        method: 'card',
      },
    ],
  })

  assert.equal(history.length, 2)
  assert.equal(history[0].periodKey, '2026-07')
  assert.equal(history[0].lines.length, 2)
  assert.equal(history[1].periodKey, '2026-06')
})
