import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BillingMigrationSafetyError,
  clearStripeSubscriptionCutover,
  inspectStripeCustomerBillingMonthCollectors,
  inspectStripeCustomerSubscriptionInventory,
  inspectStripeCustomerSubscriptionScheduleInventory,
  inspectStripeHouseholdInvoice,
  listTargetMonthLegacyInvoices,
  retrieveStripeCustomerReadiness,
  retireStripeSubscription,
  scheduleStripeSubscriptionForCutover,
  validateRemoteSubscriptionForMigration,
  validateTargetMonthLegacyInvoices,
} from '../canonicalBillingMigrationStripe.js'

function fakeStripe(initial = {}) {
  const subscription = {
    id: 'sub_1',
    status: 'active',
    customer: 'cus_1',
    cancel_at: null,
    cancel_at_period_end: false,
    current_period_start: 1_788_235_200,
    current_period_end: 1_790_827_200,
    items: {
      data: [{
        id: 'si_1',
        quantity: 1,
        price: { id: 'price_1', unit_amount: 12_000, currency: 'usd', recurring: { interval: 'month', interval_count: 1 }, product: 'prod_1' },
      }],
    },
    ...initial,
  }
  const calls = []
  return {
    calls,
    subscription,
    subscriptions: {
      async retrieve() {
        calls.push(['retrieve'])
        return structuredClone(subscription)
      },
      async update(id, values, options) {
        calls.push(['update', id, values, options])
        if (values.cancel_at === '') subscription.cancel_at = null
        else if (values.cancel_at != null) subscription.cancel_at = Number(values.cancel_at)
        if (values.cancel_at_period_end != null) subscription.cancel_at_period_end = values.cancel_at_period_end
        return structuredClone(subscription)
      },
      async cancel(id, values, options) {
        calls.push(['cancel', id, values, options])
        subscription.status = 'canceled'
        subscription.canceled_at = 1_788_235_200
        return structuredClone(subscription)
      },
    },
  }
}

test('customer readiness uses one target-month rule for card and Link methods', async () => {
  const readinessFor = (paymentMethod) => retrieveStripeCustomerReadiness({
    customers: {
      async retrieve() {
        return {
          id: 'cus_1',
          deleted: false,
          invoice_settings: { default_payment_method: paymentMethod },
        }
      },
    },
  }, 'cus_1', { billingMonth: '2026-10-01' })

  const link = await readinessFor({
    id: 'pm_link', type: 'link', customer: 'cus_1', link: { email: null },
  })
  assert.equal(link.ready, true)
  assert.equal(link.snapshot.paymentMethodType, 'link')

  const expiringCard = await readinessFor({
    id: 'pm_card',
    type: 'card',
    customer: 'cus_1',
    card: { last4: '4242', exp_month: 9, exp_year: 2026 },
  })
  assert.equal(expiringCard.ready, false)
  assert.equal(expiringCard.reason, 'payment_method_card_expired_for_billing_month')

  const foreignCard = await readinessFor({
    id: 'pm_foreign',
    type: 'card',
    customer: 'cus_other',
    card: { last4: '4242', exp_month: 12, exp_year: 2030 },
  })
  assert.equal(foreignCard.ready, false)
  assert.equal(foreignCard.reason, 'payment_method_customer_mismatch')
})

test('customer readiness rejects Stripe metadata owned by another billing account', async () => {
  const result = await retrieveStripeCustomerReadiness({
    customers: {
      async retrieve() {
        return {
          id: 'cus_shared',
          deleted: false,
          metadata: { familyBillingAccountId: '19' },
          invoice_settings: {
            default_payment_method: {
              id: 'pm_card',
              type: 'card',
              customer: 'cus_shared',
              card: { exp_month: 12, exp_year: 2030 },
            },
          },
        }
      },
    },
  }, 'cus_shared', {
    billingMonth: '2026-10-01',
    expectedAccountId: 8,
  })

  assert.equal(result.ready, false)
  assert.equal(result.reason, 'stripe_customer_metadata_owner_conflict')
  assert.equal(result.snapshot.metadataFamilyBillingAccountId, '19')
})

test('Stripe cutover scheduling is confirmed and replay-safe', async () => {
  const stripe = fakeStripe()
  const first = await scheduleStripeSubscriptionForCutover(stripe, {
    subscriptionId: 'sub_1',
    boundaryUnix: 1_788_249_600,
    idempotencyKey: 'cutover:schedule:sub_1',
  })
  const replay = await scheduleStripeSubscriptionForCutover(stripe, {
    subscriptionId: 'sub_1',
    boundaryUnix: 1_788_249_600,
    idempotencyKey: 'cutover:schedule:sub_1',
  })
  assert.equal(first.changed, true)
  assert.equal(replay.changed, false)
  assert.equal(stripe.calls.filter(([kind]) => kind === 'update').length, 1)
  assert.equal(stripe.calls.find(([kind]) => kind === 'update')[3].idempotencyKey, 'cutover:schedule:sub_1')
})

test('pre-cancel rollback clears only the exact cancellation created by cutover', async () => {
  const stripe = fakeStripe({ cancel_at: 1_788_249_600 })
  const result = await clearStripeSubscriptionCutover(stripe, {
    subscriptionId: 'sub_1',
    boundaryUnix: 1_788_249_600,
    idempotencyKey: 'cutover:rollback:sub_1',
  })
  assert.equal(result.changed, true)
  assert.equal(result.after.cancelAt, null)

  const drifted = fakeStripe({ cancel_at: 1_790_928_000 })
  await assert.rejects(
    clearStripeSubscriptionCutover(drifted, {
      subscriptionId: 'sub_1',
      boundaryUnix: 1_788_249_600,
      idempotencyKey: 'cutover:rollback:sub_1',
    }),
    (error) => error instanceof BillingMigrationSafetyError && error.code === 'unexpected_stripe_cancellation',
  )
})

test('remote retirement is idempotent and never requests proration or an invoice', async () => {
  const stripe = fakeStripe()
  const first = await retireStripeSubscription(stripe, {
    subscriptionId: 'sub_1',
    idempotencyKey: 'cutover:retire:sub_1',
  })
  const replay = await retireStripeSubscription(stripe, {
    subscriptionId: 'sub_1',
    idempotencyKey: 'cutover:retire:sub_1',
  })
  assert.equal(first.changed, true)
  assert.equal(replay.changed, false)
  const cancel = stripe.calls.find(([kind]) => kind === 'cancel')
  assert.deepEqual(cancel[2], { invoice_now: false, prorate: false })
})

test('remote validation catches customer, item, and pre-existing cancellation drift', () => {
  const errors = validateRemoteSubscriptionForMigration({
    remoteSnapshot: {
      status: 'active',
      customerId: 'cus_other',
      cancelAt: 123,
      items: [{ id: 'si_other' }],
    },
    expectedCustomerId: 'cus_1',
    expectedItemId: 'si_1',
    boundaryUnix: 456,
  })
  assert.deepEqual(errors.map((error) => error.code), [
    'stripe_customer_mismatch',
    'stripe_item_mismatch',
    'unexpected_stripe_cancellation',
  ])
})

test('initial audit rejects even a matching pre-existing cancellation boundary', () => {
  const errors = validateRemoteSubscriptionForMigration({
    remoteSnapshot: {
      status: 'active', customerId: 'cus_1', cancelAt: 456, items: [{ id: 'si_1' }],
    },
    expectedCustomerId: 'cus_1',
    expectedItemId: 'si_1',
    boundaryUnix: 456,
    allowExpectedCancellation: false,
  })
  assert.deepEqual(errors.map((error) => error.code), ['preexisting_stripe_cancellation'])
})

test('remote validation checks month alignment in the facility timezone', () => {
  const boundaryUnix = Date.parse('2026-09-01T04:00:00.000Z') / 1000
  const errors = validateRemoteSubscriptionForMigration({
    remoteSnapshot: {
      status: 'active', customerId: 'cus_1', cancelAt: null,
      items: [{ id: 'si_1', interval: 'month', intervalCount: 1 }],
      currentPeriodStart: Date.parse('2026-08-02T04:00:00.000Z') / 1000,
      currentPeriodEnd: boundaryUnix,
    },
    expectedCustomerId: 'cus_1',
    expectedItemId: 'si_1',
    boundaryUnix,
    facilityTimezone: 'America/New_York',
  })
  assert.deepEqual(errors.map((error) => error.code), ['stripe_period_not_facility_month_aligned'])
})

test('remote validation requires an exact one-calendar-month Stripe cadence', () => {
  const boundaryUnix = Date.parse('2026-09-01T04:00:00.000Z') / 1000
  const errors = validateRemoteSubscriptionForMigration({
    remoteSnapshot: {
      status: 'active', customerId: 'cus_1', cancelAt: null,
      currentPeriodStart: Date.parse('2026-08-01T04:00:00.000Z') / 1000,
      currentPeriodEnd: boundaryUnix,
      items: [{ id: 'si_1', interval: 'month', intervalCount: 2 }],
    },
    expectedCustomerId: 'cus_1',
    expectedItemId: 'si_1',
    boundaryUnix,
    facilityTimezone: 'America/New_York',
  })
  assert.deepEqual(errors.map((error) => error.code), [
    'stripe_subscription_not_calendar_monthly',
  ])
})

test('cutover scheduling refuses every remote eligibility error before mutation', async () => {
  const boundaryUnix = Date.parse('2026-09-01T04:00:00.000Z') / 1000
  const stripe = fakeStripe({
    customer: 'cus_other',
    current_period_start: Date.parse('2026-08-01T04:00:00.000Z') / 1000,
    current_period_end: boundaryUnix,
  })
  await assert.rejects(
    scheduleStripeSubscriptionForCutover(stripe, {
      subscriptionId: 'sub_1',
      boundaryUnix,
      idempotencyKey: 'cutover:schedule:sub_1',
      expectedCustomerId: 'cus_1',
      expectedItemId: 'si_1',
      facilityTimezone: 'America/New_York',
    }),
    (error) => error instanceof BillingMigrationSafetyError && error.code === 'stripe_customer_mismatch',
  )
  assert.equal(stripe.calls.filter(([kind]) => kind === 'update').length, 0)
})

function customerSubscription(id, overrides = {}) {
  return {
    id,
    status: 'active',
    customer: 'cus_1',
    metadata: {},
    items: { data: [] },
    ...overrides,
  }
}

test('customer subscription inventory paginates and exactly maps class and annual collectors', async () => {
  const calls = []
  const stripe = {
    subscriptions: {
      async list(params) {
        calls.push(params)
        if (!params.starting_after) {
          return {
            data: [customerSubscription('sub_class', {
              metadata: {
                billingSubscriptionId: '10',
                familyBillingAccountId: '9',
                perClassSubscription: 'true',
              },
            })],
            has_more: true,
          }
        }
        return {
          data: [customerSubscription('sub_annual', {
            metadata: {
              billingSubscriptionId: '20',
              familyBillingAccountId: '9',
              annualMembership: 'true',
            },
          })],
          has_more: false,
        }
      },
    },
  }
  const result = await inspectStripeCustomerSubscriptionInventory(stripe, {
    stripeCustomerId: 'cus_1',
    accountId: 9,
    localSubscriptions: [
      {
        id: 10, status: 'active', sourceType: 'scheduling_signup',
        stripeSubscriptionId: 'sub_class',
      },
      {
        id: 20, status: 'active', isAnnualMembership: true,
        stripeSubscriptionId: 'sub_annual',
      },
    ],
  })
  assert.equal(result.verified, true)
  assert.equal(result.snapshot.liveSubscriptionCount, 2)
  assert.equal(result.snapshot.mappedNonannualCount, 1)
  assert.equal(result.snapshot.annualMembershipCount, 1)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].starting_after, 'sub_class')
  assert.equal(calls[0].status, 'all')
  assert.equal(calls[0].expand, undefined)
})

test('forward adoption inventories active and future Stripe subscription schedules', async () => {
  const calls = []
  const result = await inspectStripeCustomerSubscriptionScheduleInventory({
    subscriptionSchedules: {
      async list(params) {
        calls.push(params)
        return {
          data: [
            {
              id: 'sub_sched_future',
              status: 'not_started',
              customer: 'cus_1',
              subscription: null,
              start_date: 1_788_235_200,
              end_behavior: 'release',
            },
            {
              id: 'sub_sched_done',
              status: 'completed',
              customer: 'cus_1',
              subscription: 'sub_old',
            },
          ],
          has_more: false,
        }
      },
    },
  }, {
    stripeCustomerId: 'cus_1',
    accountId: 9,
  })
  assert.equal(result.verified, false)
  assert.equal(result.snapshot.liveScheduleCount, 1)
  assert.equal(result.snapshot.schedules[0].id, 'sub_sched_future')
  assert.deepEqual(result.issues.map((issue) => issue.code), [
    'stripe_customer_subscription_schedule_active',
  ])
  assert.equal(calls[0].customer, 'cus_1')

  const noCustomer = await inspectStripeCustomerSubscriptionScheduleInventory({}, {
    stripeCustomerId: null,
    accountId: 9,
  })
  assert.equal(noCustomer.verified, true)
  assert.equal(noCustomer.snapshot.liveScheduleCount, 0)
})

test('customer collector inventories fail closed for unknown Stripe statuses', async () => {
  const subscriptions = await inspectStripeCustomerSubscriptionInventory({
    subscriptions: {
      async list() {
        return {
          data: [customerSubscription('sub_future_status', { status: 'future_collectible_status' })],
          has_more: false,
        }
      },
    },
  }, {
    stripeCustomerId: 'cus_1',
    accountId: 9,
    localSubscriptions: [],
  })
  assert.equal(subscriptions.verified, false)
  assert.equal(subscriptions.snapshot.liveSubscriptionCount, 1)
  assert.deepEqual(subscriptions.issues.map((issue) => issue.code), [
    'stripe_customer_subscription_status_unrecognized',
  ])

  const schedules = await inspectStripeCustomerSubscriptionScheduleInventory({
    subscriptionSchedules: {
      async list() {
        return {
          data: [{ id: 'sub_sched_future_status', status: 'future_schedule_status', customer: 'cus_1' }],
          has_more: false,
        }
      },
    },
  }, {
    stripeCustomerId: 'cus_1',
    accountId: 9,
  })
  assert.equal(schedules.verified, false)
  assert.equal(schedules.snapshot.liveScheduleCount, 1)
  assert.deepEqual(schedules.issues.map((issue) => issue.code), [
    'stripe_customer_subscription_schedule_status_unrecognized',
  ])
})

test('annual exclusion requires an authoritative local or metadata mapping, never a label', async () => {
  const inspect = (remote, localSubscriptions = []) => inspectStripeCustomerSubscriptionInventory({
    subscriptions: { async list() { return { data: [remote], has_more: false } } },
  }, {
    stripeCustomerId: 'cus_1',
    accountId: 9,
    localSubscriptions,
  })

  const looseLabel = await inspect(customerSubscription('sub_label_only', {
    description: 'Annual Membership',
    items: { data: [{ price: { product: { name: 'Annual Membership' } } }] },
  }))
  assert.equal(looseLabel.verified, false)
  assert.deepEqual(looseLabel.issues.map((issue) => issue.code), [
    'stripe_customer_subscription_unmapped',
  ])

  const metadataMapped = await inspect(customerSubscription('sub_annual_metadata', {
    metadata: {
      billingSubscriptionId: '20',
      familyBillingAccountId: '9',
      annualMembership: 'true',
    },
  }), [{ id: 20, status: 'active', isAnnualMembership: true, stripeSubscriptionId: null }])
  assert.equal(metadataMapped.verified, true)
  assert.equal(metadataMapped.snapshot.subscriptions[0].classification, 'annual_membership')
  assert.equal(metadataMapped.snapshot.subscriptions[0].mappingSource, 'metadata')
})

test('annual metadata cannot hide a duplicate collector or override a different stored link', async () => {
  const remotes = [
    customerSubscription('sub_annual_primary', {
      metadata: {
        billingSubscriptionId: '20',
        familyBillingAccountId: '9',
        annualMembership: 'true',
      },
    }),
    customerSubscription('sub_annual_duplicate', {
      metadata: {
        billingSubscriptionId: '20',
        familyBillingAccountId: '9',
        annualMembership: 'true',
      },
    }),
  ]
  const duplicate = await inspectStripeCustomerSubscriptionInventory({
    subscriptions: { async list() { return { data: remotes, has_more: false } } },
  }, {
    stripeCustomerId: 'cus_1',
    accountId: 9,
    localSubscriptions: [{ id: 20, status: 'active', isAnnualMembership: true }],
  })
  assert.equal(duplicate.verified, false)
  assert.equal(duplicate.issues.at(-1).code, 'stripe_customer_annual_subscription_mapping_invalid')
  assert.equal(duplicate.issues.at(-1).annualMappingDuplicate, true)

  const conflictingStoredLink = await inspectStripeCustomerSubscriptionInventory({
    subscriptions: {
      async list() {
        return { data: [remotes[0]], has_more: false }
      },
    },
  }, {
    stripeCustomerId: 'cus_1',
    accountId: 9,
    localSubscriptions: [{
      id: 20,
      status: 'active',
      isAnnualMembership: true,
      stripeSubscriptionId: 'sub_annual_elsewhere',
    }],
  })
  assert.equal(conflictingStoredLink.verified, false)
  assert.equal(conflictingStoredLink.issues[0].annualStoredLinkConflict, true)
})

test('customer inventory blocks a class collector whose Stripe create was not durably linked', async () => {
  const remote = customerSubscription('sub_orphan', {
    status: 'trialing',
    metadata: {
      billingSubscriptionId: '10',
      familyBillingAccountId: '9',
      perClassSubscription: 'true',
    },
  })
  const result = await inspectStripeCustomerSubscriptionInventory({
    subscriptions: { async list() { return { data: [remote], has_more: false } } },
  }, {
    stripeCustomerId: 'cus_1',
    accountId: 9,
    localSubscriptions: [{
      id: 10,
      status: 'active',
      sourceType: 'scheduling_signup',
      stripeSubscriptionId: null,
    }],
  })
  assert.equal(result.verified, false)
  assert.deepEqual(result.issues.map((issue) => issue.code), [
    'stripe_customer_subscription_local_link_missing',
  ])
})

test('paid target-month legacy invoices are never auto-voided', () => {
  const issues = validateTargetMonthLegacyInvoices([
    { id: 'in_paid', status: 'paid', amountPaid: 12_000, amountRemaining: 0 },
    { id: 'in_processing', status: 'open', amountPaid: 0, paymentIntentStatus: 'processing' },
    { id: 'in_partial', status: 'open', amountPaid: 6_000, amountRemaining: 6_000 },
    { id: 'in_open', status: 'open', amountPaid: 0 },
  ])
  assert.deepEqual(issues.map((issue) => issue.code), [
    'target_month_legacy_invoice_paid',
    'target_month_legacy_invoice_processing',
    'target_month_legacy_invoice_partially_paid',
    'target_month_legacy_invoice_open',
    'target_month_legacy_invoice_mixed_collection',
  ])
  assert.deepEqual(issues.map((issue) => issue.disposition), [
    'defer_next_month',
    'defer_next_month',
    'manual_review_required',
    'review_and_void',
    'manual_review_required',
  ])
})

test('mixed paid and unpaid target-month invoices require review before any void', () => {
  const issues = validateTargetMonthLegacyInvoices([
    { id: 'in_paid', status: 'paid', amountPaid: 12_000, amountRemaining: 0 },
    { id: 'in_open', status: 'open', amountPaid: 0, amountRemaining: 12_000 },
  ])
  assert.equal(issues.at(-1).code, 'target_month_legacy_invoice_mixed_collection')
  assert.equal(issues.at(-1).disposition, 'manual_review_required')
})

test('target-month invoice discovery paginates invoices and service-period lines', async () => {
  const boundaryUnix = 1_788_249_600
  const nextBoundaryUnix = 1_790_928_000
  const invoiceCalls = []
  const lineCalls = []
  const stripe = {
    invoices: {
      async list(params) {
        invoiceCalls.push(params)
        if (!params.starting_after) {
          return {
            data: [{
              id: 'in_old', status: 'paid', created: boundaryUnix - 10_000_000,
              period_start: boundaryUnix - 10_000_000, period_end: boundaryUnix - 9_000_000,
              subscription: 'sub_1', amount_due: 100, amount_paid: 100, amount_remaining: 0,
            }],
            has_more: true,
          }
        }
        return {
          data: [{
            id: 'in_target', status: 'open', created: boundaryUnix - 604_800,
            period_start: boundaryUnix - 2_000_000, period_end: boundaryUnix - 1_000_000,
            subscription: 'sub_1', customer: 'cus_1', currency: 'usd',
            amount_due: 12_000, amount_paid: 0, amount_remaining: 12_000,
          }],
          has_more: false,
        }
      },
      async listLineItems(invoiceId, params) {
        lineCalls.push([invoiceId, params])
        if (invoiceId === 'in_old') return { data: [], has_more: false }
        if (!params.starting_after) {
          return {
            data: [{
              id: 'il_old', period: { start: boundaryUnix - 2_000_000, end: boundaryUnix - 1_000_000 },
              parent: { subscription_item_details: { subscription: 'sub_1' } },
            }],
            has_more: true,
          }
        }
        return {
          data: [{
            id: 'il_target', period: { start: boundaryUnix, end: nextBoundaryUnix },
            amount: 12_000, currency: 'usd', quantity: 1,
            pricing: { price_details: { price: 'price_1' } },
            parent: { subscription_item_details: { subscription: 'sub_1', subscription_item: 'si_1' } },
          }],
          has_more: false,
        }
      },
    },
  }
  const invoices = await listTargetMonthLegacyInvoices(stripe, {
    subscriptionId: 'sub_1', boundaryUnix, nextBoundaryUnix,
  })
  assert.deepEqual(invoices.map((invoice) => invoice.id), ['in_target'])
  assert.equal(invoices[0].lineCount, 2)
  assert.equal(invoices[0].nonZeroLineCount, 1)
  assert.deepEqual(invoices[0].nonZeroLineIds, ['il_target'])
  assert.deepEqual(invoices[0].matchingLineIds, ['il_target'])
  assert.deepEqual(invoices[0].matchingLinePeriods[0], {
    id: 'il_target',
    subscriptionId: 'sub_1',
    subscriptionItemId: 'si_1',
    periodStart: boundaryUnix,
    periodEnd: nextBoundaryUnix,
    amountCents: 12_000,
    currency: 'usd',
    priceId: 'price_1',
    quantity: 1,
    proration: false,
  })
  assert.equal(invoices[0].customerId, 'cus_1')
  assert.equal(invoices[0].currency, 'usd')
  assert.equal(invoices[0].created, boundaryUnix - 604_800)
  assert.equal(Object.hasOwn(invoiceCalls[0], 'created'), false)
  assert.equal(invoiceCalls[1].starting_after, 'in_old')
  assert.equal(lineCalls.at(-1)[1].starting_after, 'il_old')
})

test('paid target-month discovery proves its PaymentIntent through Invoice Payments when invoice.payment_intent is omitted', async () => {
  const boundaryUnix = Date.parse('2026-09-01T00:00:00.000Z') / 1000
  const nextBoundaryUnix = Date.parse('2026-10-01T00:00:00.000Z') / 1000
  const invoice = {
    id: 'in_paid_without_legacy_pi',
    status: 'paid',
    paid: true,
    created: boundaryUnix,
    period_start: boundaryUnix,
    period_end: nextBoundaryUnix,
    subscription: 'sub_1',
    customer: 'cus_1',
    currency: 'usd',
    amount_due: 12_000,
    amount_paid: 12_000,
    amount_remaining: 0,
    collection_method: 'charge_automatically',
  }
  const invoicePaymentCalls = []
  const invoicePayment = (boundInvoice) => ({
    id: 'inpay_1',
    status: 'paid',
    invoice: boundInvoice,
    amount_paid: 12_000,
    currency: 'usd',
    payment: { type: 'payment_intent', payment_intent: 'pi_paid_1' },
  })
  const stripe = {
    invoices: {
      async list() { return { data: [invoice], has_more: false } },
      async listLineItems() {
        return {
          data: [{
            id: 'il_paid_1',
            amount: 12_000,
            currency: 'usd',
            quantity: 1,
            period: { start: boundaryUnix, end: nextBoundaryUnix },
            pricing: { price_details: { price: 'price_1' } },
            parent: {
              subscription_item_details: {
                subscription: 'sub_1',
                subscription_item: 'si_1',
              },
            },
          }],
          has_more: false,
        }
      },
    },
    invoicePayments: {
      async list(params) {
        invoicePaymentCalls.push(params)
        return {
          data: [invoicePayment(params.invoice ? invoice.id : invoice)],
          has_more: false,
        }
      },
    },
    paymentIntents: {
      async retrieve(id) {
        assert.equal(id, 'pi_paid_1')
        return {
          id,
          status: 'succeeded',
          amount_received: 12_000,
          currency: 'usd',
          customer: 'cus_1',
        }
      },
    },
  }

  const found = await listTargetMonthLegacyInvoices(stripe, {
    subscriptionId: 'sub_1',
    boundaryUnix,
    nextBoundaryUnix,
  })

  assert.equal(Object.hasOwn(invoice, 'payment_intent'), false)
  assert.equal(found.length, 1)
  assert.equal(found[0].paymentIntentId, 'pi_paid_1')
  assert.equal(found[0].paymentIntentStatus, 'succeeded')
  assert.equal(found[0].paymentIntentAmountReceived, 12_000)
  assert.equal(invoicePaymentCalls.length, 2)
  assert.equal(invoicePaymentCalls[0].invoice, invoice.id)
  assert.deepEqual(invoicePaymentCalls[1].payment, {
    type: 'payment_intent',
    payment_intent: 'pi_paid_1',
  })
  assert.deepEqual(invoicePaymentCalls[1].expand, ['data.invoice'])
})

test('cycle collector inventory finds unlinked legacy invoices and excludes annual memberships', async () => {
  const boundaryUnix = Date.parse('2026-10-01T04:00:00.000Z') / 1000
  const nextBoundaryUnix = Date.parse('2026-11-01T04:00:00.000Z') / 1000
  const invoices = [
    {
      id: 'in_household', status: 'open', subscription: null,
      metadata: { householdMonthlyInvoice: 'true', billingMonth: '2026-10' },
    },
    {
      id: 'in_legacy', status: 'open', subscription: 'sub_legacy', metadata: {},
      period_start: boundaryUnix, period_end: nextBoundaryUnix,
    },
    {
      id: 'in_annual', status: 'paid', subscription: 'sub_annual', metadata: {},
      period_start: boundaryUnix, period_end: nextBoundaryUnix,
    },
  ]
  const stripe = {
    invoices: {
      async list() { return { data: invoices, has_more: false } },
      async listLineItems(invoiceId) {
        const subscription = invoiceId === 'in_legacy'
          ? 'sub_legacy'
          : invoiceId === 'in_annual' ? 'sub_annual' : null
        return {
          data: subscription ? [{
            id: `il_${invoiceId}`,
            period: { start: boundaryUnix, end: nextBoundaryUnix },
            parent: { subscription_item_details: { subscription } },
          }] : [],
          has_more: false,
        }
      },
    },
  }
  const result = await inspectStripeCustomerBillingMonthCollectors(stripe, {
    stripeCustomerId: 'cus_1',
    billingMonth: '2026-10-01',
    facilityTimezone: 'America/New_York',
    expectedStripeInvoiceIds: ['in_household'],
    excludedSubscriptionIds: ['sub_annual'],
  })
  assert.equal(result.verified, false)
  assert.equal(result.snapshot.collectorCount, 2)
  assert.equal(result.snapshot.householdInvoiceCount, 1)
  assert.equal(result.snapshot.legacyCollectorCount, 1)
  assert.equal(result.snapshot.unexpectedStripeInvoiceCount, 1)
  assert.deepEqual(result.issues.map((issue) => issue.code), [
    'legacy_target_month_collector_present',
    'duplicate_target_month_collectors',
    'unexpected_target_month_stripe_invoice',
  ])
  assert.equal(result.snapshot.invoices.some((invoice) => invoice.id === 'in_annual'), false)
})

test('cycle collector inventory quarantines collectable unscoped target-month invoices', async () => {
  const boundaryUnix = Date.parse('2026-10-01T04:00:00.000Z') / 1000
  const nextBoundaryUnix = Date.parse('2026-11-01T04:00:00.000Z') / 1000
  const stripe = {
    invoices: {
      async list() {
        return {
          data: [{
            id: 'in_manual',
            status: 'open',
            subscription: null,
            metadata: {},
            period_start: boundaryUnix,
            period_end: nextBoundaryUnix,
          }],
          has_more: false,
        }
      },
      async listLineItems() {
        return {
          data: [{
            id: 'il_manual',
            period: { start: boundaryUnix, end: nextBoundaryUnix },
          }],
          has_more: false,
        }
      },
    },
  }

  const result = await inspectStripeCustomerBillingMonthCollectors(stripe, {
    stripeCustomerId: 'cus_1',
    billingMonth: '2026-10-01',
    facilityTimezone: 'America/New_York',
  })

  assert.equal(result.verified, false)
  assert.equal(result.snapshot.collectorCount, 1)
  assert.equal(result.snapshot.legacyCollectorCount, 0)
  assert.equal(result.snapshot.ambiguousCollectorCount, 1)
  assert.equal(result.snapshot.invoices[0].ambiguousCollector, true)
  assert.deepEqual(result.snapshot.invoices[0].unscopedLineIds, ['il_manual'])
  assert.deepEqual(result.issues.map((issue) => issue.code), [
    'ambiguous_target_month_stripe_invoice',
    'unexpected_target_month_stripe_invoice',
  ])
})

test('top-level-null invoice with only an authoritative annual line remains excluded', async () => {
  const boundaryUnix = Date.parse('2026-10-01T04:00:00.000Z') / 1000
  const nextBoundaryUnix = Date.parse('2026-11-01T04:00:00.000Z') / 1000
  const stripe = {
    invoices: {
      async list() {
        return {
          data: [{
            id: 'in_annual_line_parent',
            status: 'open',
            subscription: null,
            metadata: {},
            period_start: boundaryUnix,
            period_end: nextBoundaryUnix,
          }],
          has_more: false,
        }
      },
      async listLineItems() {
        return {
          data: [{
            id: 'il_annual',
            period: { start: boundaryUnix, end: nextBoundaryUnix },
            parent: { subscription_item_details: { subscription: 'sub_annual' } },
          }],
          has_more: false,
        }
      },
    },
  }

  const result = await inspectStripeCustomerBillingMonthCollectors(stripe, {
    stripeCustomerId: 'cus_1',
    billingMonth: '2026-10-01',
    facilityTimezone: 'America/New_York',
    excludedSubscriptionIds: ['sub_annual'],
  })

  assert.equal(result.verified, true)
  assert.equal(result.snapshot.collectorCount, 0)
  assert.equal(result.snapshot.ambiguousCollectorCount, 0)
  assert.deepEqual(result.snapshot.invoices, [])
  assert.deepEqual(result.issues, [])
})

test('top-level-null annual invoice fails closed when it carries an extra unscoped target-month line', async () => {
  const boundaryUnix = Date.parse('2026-10-01T04:00:00.000Z') / 1000
  const nextBoundaryUnix = Date.parse('2026-11-01T04:00:00.000Z') / 1000
  const stripe = {
    invoices: {
      async list() {
        return {
          data: [{
            id: 'in_annual_mixed',
            status: 'open',
            subscription: null,
            metadata: {},
            period_start: boundaryUnix,
            period_end: nextBoundaryUnix,
          }],
          has_more: false,
        }
      },
      async listLineItems() {
        return {
          data: [
            {
              id: 'il_annual',
              period: { start: boundaryUnix, end: nextBoundaryUnix },
              parent: { subscription_item_details: { subscription: 'sub_annual' } },
            },
            {
              id: 'il_extra',
              period: { start: boundaryUnix, end: nextBoundaryUnix },
            },
          ],
          has_more: false,
        }
      },
    },
  }

  const result = await inspectStripeCustomerBillingMonthCollectors(stripe, {
    stripeCustomerId: 'cus_1',
    billingMonth: '2026-10-01',
    facilityTimezone: 'America/New_York',
    excludedSubscriptionIds: ['sub_annual'],
  })

  assert.equal(result.verified, false)
  assert.equal(result.snapshot.collectorCount, 1)
  assert.equal(result.snapshot.legacyCollectorCount, 0)
  assert.equal(result.snapshot.ambiguousCollectorCount, 1)
  assert.equal(result.snapshot.invoices[0].id, 'in_annual_mixed')
  assert.deepEqual(result.snapshot.invoices[0].unscopedLineIds, ['il_extra'])
  assert.deepEqual(result.issues.map((issue) => issue.code), [
    'ambiguous_target_month_stripe_invoice',
    'unexpected_target_month_stripe_invoice',
  ])
})

test('household invoice verification compares every paged Stripe item and ignores nonpayment state', async () => {
  const calls = []
  const stripe = {
    invoices: {
      async retrieve() {
        return {
          id: 'in_household', customer: 'cus_1', status: 'open', paid: false,
          subtotal: 12_000, total: 12_000, amount_due: 12_000,
          amount_paid: 0, amount_remaining: 12_000,
          metadata: {
            householdMonthlyInvoice: 'true', monthlyInvoiceId: '5',
            familyBillingAccountId: '9', billingMonth: '2026-09',
          },
        }
      },
    },
    invoiceItems: {
      async list(params) {
        calls.push(params)
        if (!params.starting_after) {
          return {
            data: [{
              id: 'ii_1', amount: 7_000,
              metadata: { monthlyInvoiceId: '5', monthlyInvoiceLineId: '11', billingChargeId: '21' },
            }],
            has_more: true,
          }
        }
        return {
          data: [{
            id: 'ii_2', amount: 5_000,
            metadata: { monthlyInvoiceId: '5', monthlyInvoiceLineId: '12', billingChargeId: '22' },
          }],
          has_more: false,
        }
      },
    },
  }
  const result = await inspectStripeHouseholdInvoice(stripe, {
    accountId: 9,
    stripeCustomerId: 'cus_1',
    billingMonth: '2026-09-01',
    invoice: {
      id: 5, status: 'failed', stripeInvoiceId: 'in_household',
      subtotalCents: 12_000, totalCents: 12_000,
    },
    lines: [
      { id: 11, billingChargeId: 21, amountCents: 7_000, stripeInvoiceItemId: 'ii_1' },
      { id: 12, billingChargeId: 22, amountCents: 5_000, stripeInvoiceItemId: 'ii_2' },
    ],
  })
  assert.equal(result.verified, true)
  assert.deepEqual(result.issues, [])
  assert.equal(calls[1].starting_after, 'ii_1')
})

test('positive local household invoice without a remote ID fails verification', async () => {
  const result = await inspectStripeHouseholdInvoice({}, {
    accountId: 9,
    invoice: { id: 5, status: 'draft', stripeInvoiceId: null, subtotalCents: 100, totalCents: 100 },
    lines: [{ id: 11, billingChargeId: 21, amountCents: 100 }],
  })
  assert.equal(result.verified, false)
  assert.deepEqual(result.issues.map((issue) => issue.code), ['remote_household_invoice_missing'])
})

test('paid Stripe status verifies when the deprecated paid boolean is absent', async () => {
  const remoteInvoice = {
    id: 'in_paid',
    customer: 'cus_1',
    status: 'paid',
    currency: 'usd',
    subtotal: 5000,
    total: 5000,
    amount_due: 5000,
    amount_paid: 5000,
    amount_remaining: 0,
    metadata: {
      householdMonthlyInvoice: 'true',
      monthlyInvoiceId: '5',
      familyBillingAccountId: '9',
      billingMonth: '2026-09',
    },
  }
  const invoicePayment = (boundInvoice) => ({
    id: 'inpay_paid',
    status: 'paid',
    invoice: boundInvoice,
    amount_paid: 5000,
    currency: 'usd',
    payment: { type: 'payment_intent', payment_intent: 'pi_paid' },
  })
  const stripe = {
    invoices: {
      async retrieve() {
        return remoteInvoice
      },
    },
    invoicePayments: {
      async list(params) {
        return {
          data: [invoicePayment(params.invoice ? remoteInvoice.id : remoteInvoice)],
          has_more: false,
        }
      },
    },
    paymentIntents: {
      async retrieve() {
        return {
          id: 'pi_paid',
          status: 'succeeded',
          amount_received: 5000,
          currency: 'usd',
          customer: 'cus_1',
        }
      },
    },
    invoiceItems: {
      async list() {
        return {
          data: [{
            id: 'ii_paid',
            amount: 5000,
            metadata: {
              monthlyInvoiceId: '5',
              monthlyInvoiceLineId: '11',
              billingChargeId: '21',
            },
          }],
          has_more: false,
        }
      },
    },
  }
  const result = await inspectStripeHouseholdInvoice(stripe, {
    accountId: 9,
    stripeCustomerId: 'cus_1',
    billingMonth: '2026-09-01',
    invoice: {
      id: 5,
      status: 'paid',
      stripeInvoiceId: 'in_paid',
      subtotalCents: 5000,
      totalCents: 5000,
    },
    lines: [{ id: 11, billingChargeId: 21, amountCents: 5000, stripeInvoiceItemId: 'ii_paid' }],
  })
  assert.equal(Object.hasOwn(remoteInvoice, 'payment_intent'), false)
  assert.equal(result.verified, true)
  assert.deepEqual(result.issues, [])
  assert.equal(result.snapshot.paymentIntentId, 'pi_paid')
  assert.equal(result.snapshot.paymentIntentStatus, 'succeeded')
  assert.equal(result.snapshot.paymentIntentAmountReceivedCents, 5000)
})

test('paid household verification rejects extra open and duplicate paid Invoice Payment bindings', async () => {
  const remoteInvoice = {
    id: 'in_paid',
    customer: 'cus_1',
    status: 'paid',
    paid: true,
    currency: 'usd',
    subtotal: 5000,
    total: 5000,
    amount_due: 5000,
    amount_paid: 5000,
    amount_remaining: 0,
    payment_intent: {
      id: 'pi_paid',
      status: 'succeeded',
      amount_received: 5000,
    },
    metadata: {
      householdMonthlyInvoice: 'true',
      monthlyInvoiceId: '5',
      familyBillingAccountId: '9',
      billingMonth: '2026-09',
    },
  }
  const paidBinding = {
    id: 'inpay_paid',
    status: 'paid',
    invoice: remoteInvoice.id,
    amount_paid: 5000,
    currency: 'usd',
    payment: { type: 'payment_intent', payment_intent: 'pi_paid' },
  }
  const extraBindings = [
    {
      id: 'inpay_open',
      status: 'open',
      invoice: remoteInvoice.id,
      currency: 'usd',
      payment: { type: 'payment_intent', payment_intent: 'pi_open' },
    },
    {
      id: 'inpay_second_paid',
      status: 'paid',
      invoice: remoteInvoice.id,
      amount_paid: 5000,
      currency: 'usd',
      payment: { type: 'payment_intent', payment_intent: 'pi_second_paid' },
    },
  ]

  for (const extraBinding of extraBindings) {
    const stripe = {
      invoices: {
        async retrieve() { return remoteInvoice },
      },
      invoicePayments: {
        async list() {
          return { data: [paidBinding, extraBinding], has_more: false }
        },
      },
      paymentIntents: {
        async retrieve() {
          throw new Error('Ambiguous invoice bindings must fail before PaymentIntent retrieval.')
        },
      },
      invoiceItems: {
        async list() {
          return {
            data: [{
              id: 'ii_paid',
              amount: 5000,
              metadata: {
                monthlyInvoiceId: '5',
                monthlyInvoiceLineId: '11',
                billingChargeId: '21',
              },
            }],
            has_more: false,
          }
        },
      },
    }

    const result = await inspectStripeHouseholdInvoice(stripe, {
      accountId: 9,
      stripeCustomerId: 'cus_1',
      billingMonth: '2026-09-01',
      invoice: {
        id: 5,
        status: 'paid',
        stripeInvoiceId: remoteInvoice.id,
        subtotalCents: 5000,
        totalCents: 5000,
      },
      lines: [{ id: 11, billingChargeId: 21, amountCents: 5000, stripeInvoiceItemId: 'ii_paid' }],
    })

    assert.equal(result.verified, false, extraBinding.id)
    assert.deepEqual(result.issues.map((issue) => issue.code), [
      'remote_household_invoice_payment_binding_invalid',
    ])
    assert.equal(result.snapshot.paymentIntentId, null)
  }
})
