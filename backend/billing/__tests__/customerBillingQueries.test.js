import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCustomerBillingAnnualMemberships,
  customerFacingPriceSyncError,
  effectiveEnrollmentNextBillDate,
  earliestActiveNextBillDate,
  firstRecurringPricingLineBySignup,
  listCustomerBillingActivity,
  listCustomerBillingTransactions,
  recurringPricingForPeriod,
} from '../customerBillingQueries.js'

test('annual membership rows use the paid date and active Stripe renewal', () => {
  const rows = buildCustomerBillingAnnualMemberships({
    members: [{ id: 73, name: 'Alexis Barnett' }],
    subscriptions: [{
      id: 21,
      member_id: 73,
      source_id: '1:73',
      status: 'active',
      start_date: '2026-08-27',
      next_bill_date: '2027-09-01',
      stripe_subscription_id: 'sub_membership',
      auto_renewal: true,
      latest_renewal_paid_at: '2027-09-01T13:00:00.000Z',
      created_at: '2026-08-27T03:46:58.000Z',
    }],
    redemptions: [{
      fee_id: 1,
      member_id: 73,
      created_at: '2026-08-27T03:46:58.000Z',
    }],
    charges: [{
      member_id: 73,
      source_type: 'additional_fee',
      source_id: '1:73:2027-08-27',
      created_at: '2026-08-27T03:46:58.000Z',
      paid_at: '2026-08-27T03:45:00.000Z',
    }],
    asOf: new Date('2026-08-30T12:00:00.000Z'),
  })

  assert.deepEqual(rows, [{
    memberId: 73,
    memberName: 'Alexis Barnett',
    billingSubscriptionId: 21,
    active: true,
    membershipDate: '2027-09-01T13:00:00.000Z',
    renewalDate: '2027-09-01',
    autoRenewal: true,
    canManageAutoRenewal: true,
    outstandingChargeId: null,
    outstandingAmountCents: 0,
  }])
})

test('scheduled cancellation keeps membership active but disables auto-renewal', () => {
  const rows = buildCustomerBillingAnnualMemberships({
    members: [{ id: 73, name: 'Alexis Barnett' }],
    subscriptions: [{
      id: 21,
      member_id: 73,
      source_id: '1:73',
      status: 'active',
      start_date: '2026-08-27',
      next_bill_date: '2027-09-01',
      stripe_subscription_id: 'sub_membership',
      auto_renewal: false,
      created_at: '2026-08-27T03:46:58.000Z',
    }],
    redemptions: [{
      fee_id: 1,
      member_id: 73,
      created_at: '2026-08-27T03:46:58.000Z',
      satisfied_at: '2026-08-27T03:46:58.000Z',
    }],
    asOf: new Date('2026-08-30T12:00:00.000Z'),
  })

  assert.equal(rows[0].active, true)
  assert.equal(rows[0].autoRenewal, false)
  assert.equal(rows[0].renewalDate, '2027-09-01')
})

test('cancelled renewal remains active through its paid-through date', () => {
  const rows = buildCustomerBillingAnnualMemberships({
    members: [{ id: 73, name: 'Alexis Barnett' }],
    subscriptions: [{
      id: 21,
      member_id: 73,
      source_id: '1:73',
      status: 'cancelled',
      start_date: '2026-08-27',
      next_bill_date: '2028-09-01',
      stripe_subscription_id: 'sub_membership',
      auto_renewal: false,
      latest_renewal_paid_at: '2027-09-01T13:00:00.000Z',
      created_at: '2026-08-27T03:46:58.000Z',
    }],
    redemptions: [{
      fee_id: 1,
      member_id: 73,
      created_at: '2027-09-01T13:00:00.000Z',
      satisfied_at: '2027-09-01T13:00:00.000Z',
    }],
    asOf: new Date('2027-09-10T12:00:00.000Z'),
  })

  assert.deepEqual(rows[0], {
    memberId: 73,
    memberName: 'Alexis Barnett',
    billingSubscriptionId: 21,
    active: true,
    membershipDate: '2027-09-01T13:00:00.000Z',
    renewalDate: '2028-09-01',
    autoRenewal: false,
    canManageAutoRenewal: false,
    outstandingChargeId: null,
    outstandingAmountCents: 0,
  })
})

test('cancelled auto-renewal preserves paid-through membership access', () => {
  const rows = buildCustomerBillingAnnualMemberships({
    members: [
      { id: 73, name: 'Alexis Barnett' },
      { id: 74, name: 'Zechariah Sherrill' },
    ],
    subscriptions: [{
      id: 21,
      member_id: 73,
      source_id: '1:73',
      status: 'cancelled',
      start_date: '2026-08-27',
      next_bill_date: null,
      stripe_subscription_id: 'sub_cancelled',
      created_at: '2026-08-27T03:46:58.000Z',
    }],
    redemptions: [{
      fee_id: 1,
      member_id: 73,
      created_at: '2026-08-27T03:46:58.000Z',
    }],
    charges: [{
      member_id: 73,
      source_type: 'additional_fee',
      source_id: '1:73:2027-08-27',
      created_at: '2026-08-27T03:46:58.000Z',
      paid_at: null,
    }],
    asOf: new Date('2026-08-30T12:00:00.000Z'),
  })

  assert.deepEqual(rows, [
    {
      memberId: 73,
      memberName: 'Alexis Barnett',
      billingSubscriptionId: 21,
      active: true,
      membershipDate: '2026-08-27T03:46:58.000Z',
      renewalDate: '2027-08-27',
      autoRenewal: false,
      canManageAutoRenewal: false,
      outstandingChargeId: null,
      outstandingAmountCents: 0,
    },
    {
      memberId: 74,
      memberName: 'Zechariah Sherrill',
      billingSubscriptionId: null,
      active: false,
      membershipDate: null,
      renewalDate: null,
      autoRenewal: false,
      canManageAutoRenewal: false,
      outstandingChargeId: null,
      outstandingAmountCents: 0,
    },
  ])
})

test('a paid annual membership charge restores an athlete membership when a legacy redemption is missing', () => {
  const rows = buildCustomerBillingAnnualMemberships({
    members: [{ id: 74, name: 'Zechariah Sherrill' }],
    charges: [{
      member_id: null,
      source_type: 'additional_fee',
      source_id: '1:74:2027-08-27',
      created_at: '2026-08-27T03:46:58.000Z',
      paid_at: '2026-08-27T03:47:12.000Z',
      collection_status: 'none',
    }],
    asOf: new Date('2026-08-30T12:00:00.000Z'),
  })

  assert.deepEqual(rows, [{
    memberId: 74,
    memberName: 'Zechariah Sherrill',
    billingSubscriptionId: null,
    active: true,
    membershipDate: '2026-08-27T03:47:12.000Z',
    renewalDate: '2027-08-27',
    autoRenewal: false,
    canManageAutoRenewal: false,
    outstandingChargeId: null,
    outstandingAmountCents: 0,
  }])
})

test('annual membership rows expose an outstanding athlete-specific fee for Bill now safety', () => {
  const [row] = buildCustomerBillingAnnualMemberships({
    members: [{ id: 74, name: 'Zechariah Sherrill' }],
    charges: [{
      id: 123,
      member_id: 74,
      source_type: 'additional_fee',
      source_id: '1:74:2027-08-30',
      created_at: '2026-08-30T12:00:00.000Z',
      collection_status: 'unpaid',
      remaining_amount_cents: 8500,
    }],
    asOf: new Date('2026-08-30T12:00:00.000Z'),
  })

  assert.equal(row.active, false)
  assert.equal(row.outstandingChargeId, 123)
  assert.equal(row.outstandingAmountCents, 8500)
})

test('internal migration instructions are not exposed as Stripe errors', () => {
  assert.equal(
    customerFacingPriceSyncError('Restored promo assignment requires Stripe expiration-schedule synchronization.'),
    null,
  )
  assert.equal(customerFacingPriceSyncError('Stripe rejected the schedule phases.'), 'Stripe rejected the schedule phases.')
})

test('next billing date accepts PostgreSQL DATE values returned as Date objects', () => {
  const nextBillDate = earliestActiveNextBillDate([
    { status: 'cancelled', next_bill_date: new Date('2026-08-01T04:00:00.000Z') },
    { status: 'active', next_bill_date: new Date('2026-10-01T04:00:00.000Z') },
    { status: 'active', next_bill_date: new Date('2026-09-01T04:00:00.000Z') },
  ])

  assert.equal(nextBillDate, '2026-09-01')
})

test('paid enrollment service months advance independently while unpaid classes stay due', () => {
  const paid = effectiveEnrollmentNextBillDate({
    status: 'active',
    next_bill_date: '2026-09-01',
    paid_through_date: '2026-09-30',
  })
  const unpaid = effectiveEnrollmentNextBillDate({
    status: 'active',
    next_bill_date: '2026-10-01',
    oldest_unpaid_service_period_start: '2026-09-01',
  })

  assert.equal(paid, '2026-10-01')
  assert.equal(unpaid, '2026-09-01')
  assert.equal(earliestActiveNextBillDate([
    { status: 'active', next_bill_date: '2026-09-01', paid_through_date: '2026-09-30' },
    { status: 'active', next_bill_date: '2026-10-01', oldest_unpaid_service_period_start: '2026-09-01' },
  ]), '2026-09-01')
})

test('monthly recurring display uses the breakpoint effective for the next bill', () => {
  const breakpoint = recurringPricingForPeriod([
    { periodKey: '2026-08', netCents: 0 },
    { periodKey: '2026-09', netCents: 21375 },
    { periodKey: '2027-01', netCents: 36000 },
  ], '2026-09-01')
  assert.equal(breakpoint.periodKey, '2026-09')
  assert.equal(breakpoint.netCents, 21375)
})

test('scheduled enrollments use the first future period that contains their pricing line', () => {
  const bySignup = firstRecurringPricingLineBySignup([
    {
      periodKey: '2026-08',
      lines: [{ signupId: 11, netCents: 10000 }],
    },
    {
      periodKey: '2026-09',
      lines: [
        { signupId: 11, netCents: 10000 },
        {
          signupId: 96,
          netCents: 7125,
          discountComponents: [
            { ruleId: 9, name: 'half-time athlete', amountCents: 7500 },
            { ruleId: 7, name: 'Family multi-class spend discount', amountCents: 375 },
          ],
        },
      ],
    },
  ])

  assert.equal(bySignup.get(11).netCents, 10000)
  assert.equal(bySignup.get(96).netCents, 7125)
  assert.deepEqual(
    bySignup.get(96).discountComponents.map((component) => component.amountCents),
    [7500, 375],
  )
})

test('member-filtered transactions retain household payments and member-owned charges', async () => {
  let queryText = ''
  let queryParams = []
  const pool = {
    async query(text, params) {
      queryText = String(text)
      queryParams = params
      return {
        rows: [
          {
            entry_kind: 'payment',
            entry_type: 'payment',
            ref_id: '85',
            member_id: null,
            member_name: null,
            description: 'Link',
            amount_cents: -8500,
            occurred_at: '2026-08-26T12:00:00.000Z',
            status: 'succeeded',
            running_balance_cents: 0,
            details: {
              stripePaymentIntentId: 'pi_85',
              applications: [{ chargeId: 84, billingMonth: '2026-09-01', amountCents: 8500 }],
            },
          },
          {
            entry_kind: 'charge',
            entry_type: 'one_time',
            ref_id: '84',
            member_id: '74',
            member_name: 'Alexis Barnett',
            description: 'One-time charge',
            amount_cents: 8500,
            occurred_at: '2026-08-26T11:59:00.000Z',
            status: 'paid',
            running_balance_cents: 8500,
            details: {
              grossAmountCents: 10000,
              discountAmountCents: 1500,
              discountCode: 'MMBR01X26',
            },
          },
        ],
      }
    },
  }

  const page = await listCustomerBillingTransactions(pool, {
    accountId: 10895,
    memberId: 74,
    limit: 100,
  })

  assert.match(queryText, /wb\.member_id = \$2 OR wb\.member_id IS NULL/)
  assert.doesNotMatch(queryText, /family_visible/)
  assert.equal(queryParams.length, 11)
  assert.equal(queryParams[1], 74)
  assert.equal(page.rows.length, 2)
  assert.equal(page.rows[0].entryKind, 'payment')
  assert.equal(page.rows[0].memberId, null)
  assert.equal(page.rows[0].amountCents, -8500)
  assert.deepEqual(page.rows[0].billingMonths, ['2026-09'])
  assert.equal(page.rows[0].details.referenceNumber, 85)
  assert.equal(page.rows[1].details.discountCode, 'MMBR01X26')
  assert.match(queryText, /one_time_discount/)
  assert.match(queryText, /drop_in_registration/)
  assert.match(queryText, /Free trial/)
  assert.equal(page.rows[1].entryType, 'one_time')
})

test('activity pagination binds one cursor tuple and the requested page limit', async () => {
  const occurredAt = '2026-08-26T12:00:00.000Z'
  const cursor = Buffer.from(JSON.stringify({
    occurredAt,
    sortOrder: 0,
    refId: 44,
  })).toString('base64url')
  let queryParams = []
  const pool = {
    async query(_text, params) {
      queryParams = params
      return {
        rows: [{
          id: '43',
          event_key: 'payment:85',
          family_billing_account_id: '10895',
          member_id: null,
          signup_id: null,
          related_charge_id: null,
          related_payment_id: '85',
          related_refund_id: null,
          event_type: 'payment_succeeded',
          summary: '$85.00 payment succeeded.',
          before_value: null,
          after_value: { amountCents: 8500 },
          details: {},
          stripe_object_id: 'pi_85',
          actor_user_id: null,
          actor_name: null,
          actor_type: 'stripe',
          occurred_at: '2026-08-26T11:00:00.000Z',
        }],
      }
    },
  }

  const page = await listCustomerBillingActivity(pool, {
    accountId: 10895,
    memberId: 74,
    cursor,
    limit: 100,
  })

  assert.deepEqual(queryParams, [10895, 74, occurredAt, 44, 101])
  assert.equal(page.rows.length, 1)
  assert.equal(page.rows[0].relatedPaymentId, 85)
})
