import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCustomerBillingAnnualMemberships,
  customerFacingPriceSyncError,
  effectiveEnrollmentNextBillDate,
  earliestActiveNextBillDate,
  firstRecurringPricingLineBySignup,
  upcomingRecurringPricingMonth,
  listCustomerBillingActivity,
  loadCustomerBillingAnnualMemberships,
  listCustomerBillingTransactions,
  listMemberCustomerBillingTransactions,
  loadCustomerBillingAccount,
  resolveAddressedBillingAlerts,
  recurringPricingForPeriod,
  searchCustomerBilling,
} from '../customerBillingQueries.js'

test('refund offsets reduce effective due amounts in annual and transaction displays', async () => {
  const annualQueries = []
  await loadCustomerBillingAnnualMemberships({
    async query(sql) {
      annualQueries.push(String(sql))
      return { rows: [] }
    },
  }, {
    accountId: 19,
    members: [{ id: 73, name: 'Alexis Barnett' }],
  })

  const annualChargeQuery = annualQueries.find((sql) => sql.includes('remaining_amount_cents'))
  assert.match(annualChargeQuery, /linked\.source_type IN \('charge_adjustment', 'refund_offset'\)/)
  assert.match(annualChargeQuery, /BOOL_OR\(linked\.source_type = 'refund_offset' AND linked\.amount_cents < 0\)/)
  assert.match(annualChargeQuery, /THEN 'refunded'/)

  let householdTransactionQuery = ''
  await listCustomerBillingTransactions({
    async query(sql) {
      householdTransactionQuery = String(sql)
      return { rows: [] }
    },
  }, { accountId: 19 })
  assert.match(householdTransactionQuery, /adjustment\.source_type IN \('charge_adjustment', 'refund_offset'\)/)
  assert.match(householdTransactionQuery, /LEFT JOIN enrollment_price_adjustment direct_price_adjustment/)
  assert.match(householdTransactionQuery, /direct_price_adjustment\.promo_code/)
  assert.match(householdTransactionQuery, /direct_price_adjustment\.kind = 'fixed_final_price'/)
  assert.match(householdTransactionQuery, /adjustment_price_adjustment\.promo_code/)
  assert.match(
    householdTransactionQuery,
    /c\.amount_cents = 0\s+AND COALESCE\(c\.gross_amount_cents, 0\) > 0\s+AND COALESCE\(c\.discount_amount_cents, 0\) = COALESCE\(c\.gross_amount_cents, 0\) THEN 'paid'/,
  )

  const memberQueries = []
  await listMemberCustomerBillingTransactions({
    async query(sql) {
      memberQueries.push(String(sql))
      return memberQueries.length === 1 ? { rows: [{ balance_cents: 0 }] } : { rows: [] }
    },
  }, { accountId: 19 })
  assert.match(memberQueries[1], /adjustment\.source_type IN \('charge_adjustment', 'refund_offset'\)/)
  assert.match(
    memberQueries[1],
    /c\.amount_cents = 0\s+AND COALESCE\(c\.gross_amount_cents, 0\) > 0\s+AND COALESCE\(c\.discount_amount_cents, 0\) = COALESCE\(c\.gross_amount_cents, 0\) THEN 'paid'/,
  )
})

test('customer account lookup excludes inactive accounts and returns its facility scope', async () => {
  let captured
  const pool = {
    async query(sql, params) {
      captured = { sql: String(sql), params }
      return { rows: [] }
    },
  }

  assert.equal(await loadCustomerBillingAccount(pool, 42, 9), null)
  assert.deepEqual(captured.params, [42, 9])
  assert.match(captured.sql, /account\.is_active = TRUE/)
  assert.match(captured.sql, /family\.facility_id AS family_facility_id/)
})

test('a usable household payment method resolves stale enrollment autopay alerts', async () => {
  let captured = null
  await resolveAddressedBillingAlerts({
    async query(sql, params) {
      captured = { sql: String(sql), params }
      return { rows: [] }
    },
  }, {
    accountId: 19,
    paymentMethodAvailable: true,
    householdCardRequired: true,
  })

  assert.deepEqual(captured.params, [19, true])
  assert.match(captured.sql, /'enrollment_autopay_setup_required'/)
  assert.match(captured.sql, /'monthly_invoice_payment_method_required'/)
})

test('customer search treats active family-member links as authoritative', async () => {
  let sqlText = ''
  const pool = {
    async query(sql) {
      sqlText = String(sql)
      return { rows: [] }
    },
  }

  await searchCustomerBilling(pool, { facilityId: 9, query: 'Rivera' })
  assert.match(sqlText, /m\.is_active = TRUE/)
  assert.match(sqlText, /search_membership\.is_active = TRUE/)
  assert.match(sqlText, /FROM family_member search_membership_history/)
  assert.match(sqlText, /NOT EXISTS/)
})

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

test('ledger-only annual memberships expose their local auto-renewal schedule', () => {
  const rows = buildCustomerBillingAnnualMemberships({
    members: [{ id: 73, name: 'Alexis Barnett' }],
    subscriptions: [{
      id: 21,
      member_id: 73,
      source_id: '1:73',
      status: 'active',
      start_date: '2026-08-27',
      next_bill_date: '2027-09-01',
      stripe_subscription_id: null,
      auto_renewal: true,
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
  assert.equal(rows[0].autoRenewal, true)
  assert.equal(rows[0].canManageAutoRenewal, true)
  assert.equal(rows[0].renewalDate, '2027-09-01')
})

test('annual membership projection honors the canonical paid-through period', () => {
  const [row] = buildCustomerBillingAnnualMemberships({
    members: [{ id: 73, name: 'Alexis Barnett' }],
    subscriptions: [{
      id: 21,
      member_id: 73,
      source_id: '1:73',
      status: 'active',
      start_date: '2026-09-27',
      next_bill_date: '2027-09-27',
      auto_renewal: true,
    }],
    redemptions: [{
      fee_id: 1,
      member_id: 73,
      created_at: '2026-09-01T05:00:00.000Z',
      satisfied_at: '2026-09-01T05:00:00.000Z',
      period_key: '2027-09-27',
    }],
    asOf: new Date('2027-09-15T12:00:00.000Z'),
  })

  assert.equal(row.active, true)
  assert.equal(row.renewalDate, '2027-09-27')
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

test('a refund offset cannot present a reversed annual fee as an active membership', () => {
  const [row] = buildCustomerBillingAnnualMemberships({
    members: [{ id: 74, name: 'Zechariah Sherrill' }],
    charges: [{
      id: 123,
      member_id: 74,
      source_type: 'additional_fee',
      source_id: '1:74:2027-08-30',
      created_at: '2026-08-30T12:00:00.000Z',
      collection_status: 'refunded',
      paid_at: null,
      has_refund_offset: true,
      remaining_amount_cents: 0,
    }],
    redemptions: [{
      fee_id: 1,
      member_id: 74,
      created_at: '2026-08-30T12:00:00.000Z',
      satisfied_at: '2026-08-30T12:00:00.000Z',
      period_key: '2027-08-30',
      ended_at: '2026-09-03T12:00:00.000Z',
    }],
    asOf: new Date('2026-09-03T13:00:00.000Z'),
  })

  assert.equal(row.active, false)
  assert.equal(row.outstandingChargeId, null)
  assert.equal(row.outstandingAmountCents, 0)
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

test('monthly recurring fee stays on the current month through the fourth, then advances on the fifth', () => {
  assert.equal(
    upcomingRecurringPricingMonth(new Date('2026-09-04T23:30:00.000Z'), 'America/New_York'),
    '2026-09',
  )
  assert.equal(
    upcomingRecurringPricingMonth(new Date('2026-09-05T04:30:00.000Z'), 'America/New_York'),
    '2026-10',
  )
  // The same instant is still September 4 in Pacific time. Facility-local
  // cutoffs must not advance this account until its own fifth day begins.
  assert.equal(
    upcomingRecurringPricingMonth(new Date('2026-09-05T04:30:00.000Z'), 'America/Los_Angeles'),
    '2026-09',
  )
  assert.equal(
    upcomingRecurringPricingMonth(new Date('2026-08-31T23:30:00.000Z')),
    '2026-09',
  )
  assert.equal(
    upcomingRecurringPricingMonth(new Date('2026-12-15T12:00:00.000Z')),
    '2027-01',
  )
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
  assert.match(queryText, /charged_drop_in\.source_type = 'drop_in'/)
  assert.match(queryText, /Free trial/)
  assert.match(queryText, /Household payment/)
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

test('member transaction pages retain running balances through an opaque cursor', async () => {
  const calls = []
  const queryTexts = []
  const pool = {
    async query(text, params) {
      queryTexts.push(String(text))
      calls.push(params)
      if (calls.length === 1) return { rows: [{ balance_cents: 1000 }] }
      if (calls.length === 2) {
        return {
          rows: [
            {
              entry_kind: 'charge', entry_type: 'recurring', ref_id: '3', member_id: '74', member_name: 'Alexis Barnett',
              description: 'September tuition', amount_cents: 100, balance_amount_cents: 100,
              occurred_at: '2026-09-03T12:00:00.000Z', billing_month: '2026-09-01', status: 'unpaid', sort_order: 3,
              running_balance_cents: 1000,
            },
            {
              entry_kind: 'charge', entry_type: 'recurring', ref_id: '2', member_id: '74', member_name: 'Alexis Barnett',
              description: 'August tuition', amount_cents: 200, balance_amount_cents: 200,
              occurred_at: '2026-08-03T12:00:00.000Z', billing_month: '2026-08-01', status: 'unpaid', sort_order: 3,
              running_balance_cents: 900,
            },
            {
              entry_kind: 'charge', entry_type: 'recurring', ref_id: '1', member_id: '74', member_name: 'Alexis Barnett',
              description: 'July tuition', amount_cents: 300, balance_amount_cents: 300,
              occurred_at: '2026-07-03T12:00:00.000Z', billing_month: '2026-07-01', status: 'unpaid', sort_order: 3,
              running_balance_cents: 700,
            },
          ],
        }
      }
      return {
        rows: [{
          entry_kind: 'charge', entry_type: 'recurring', ref_id: '1', member_id: '74', member_name: 'Alexis Barnett',
          description: 'July tuition', amount_cents: 300, balance_amount_cents: 300,
          occurred_at: '2026-07-03T12:00:00.000Z', billing_month: '2026-07-01', status: 'unpaid', sort_order: 3,
          running_balance_cents: 700,
        }],
      }
    },
  }

  const first = await listMemberCustomerBillingTransactions(pool, { accountId: 10895, limit: 2 })
  assert.equal(first.rows.length, 2)
  assert.equal(first.rows[0].runningBalanceCents, 1000)
  assert.equal(first.rows[1].runningBalanceCents, 900)
  assert.ok(first.nextCursor)

  const cursor = JSON.parse(Buffer.from(first.nextCursor, 'base64url').toString('utf8'))
  assert.deepEqual(cursor, {
    occurredAt: '2026-08-03T12:00:00.000Z',
    sortOrder: 3,
    refId: 2,
    runningBalanceCents: 700,
  })

  const second = await listMemberCustomerBillingTransactions(pool, {
    accountId: 10895,
    cursor: first.nextCursor,
    limit: 2,
  })
  assert.equal(second.rows[0].runningBalanceCents, 700)
  assert.deepEqual(calls[2], [10895, cursor.occurredAt, cursor.sortOrder, cursor.refId, 3, 700])
  assert.match(queryTexts[1], /WITH account_members AS/)
  assert.match(queryTexts[1], /FROM family_member member_audit_membership/)
  assert.match(queryTexts[1], /FROM family_member member_audit_membership_history/)
  assert.match(queryTexts[1], /member\.is_active = TRUE/)
  assert.match(queryTexts[1], /JOIN account_members drop_in_member/)
  assert.match(queryTexts[0], /p\.external_status IN \('settled', 'succeeded'\)/)
  assert.match(queryTexts[1], /CASE WHEN p\.external_status IN \('settled', 'succeeded'\) THEN -p\.amount_cents ELSE 0 END/)
  assert.match(queryTexts[1], /settled_payment\.external_status IN \('settled', 'succeeded'\)/)
})

test('member transaction pages never request or return more than 50 rows', async () => {
  let pageQueryParams = []
  const rows = Array.from({ length: 51 }, (_, index) => ({
    entry_kind: 'charge', entry_type: 'recurring', ref_id: String(100 - index), member_id: '74', member_name: 'Alexis Barnett',
    description: 'Tuition', amount_cents: 100, balance_amount_cents: 100,
    occurred_at: `2026-08-${String(31 - index).padStart(2, '0')}T12:00:00.000Z`, billing_month: '2026-08-01',
    status: 'unpaid', sort_order: 3, running_balance_cents: 10000 - index * 100,
  }))
  const pool = {
    async query(_text, params) {
      if (params.length === 1) return { rows: [{ balance_cents: 10000 }] }
      pageQueryParams = params
      return { rows }
    },
  }

  const page = await listMemberCustomerBillingTransactions(pool, { accountId: 10895, limit: 1000 })
  assert.equal(pageQueryParams[4], 51)
  assert.equal(page.rows.length, 50)
  assert.ok(page.nextCursor)
})
