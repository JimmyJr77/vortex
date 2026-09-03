import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  paymentAmountsMismatch,
  reconcileCanonicalStripeCollectorInventory,
  reconcileDurableStripeOwners,
  reconcilePaidStripeCheckoutFulfillment,
  reconcileStripeRefunds,
  reconcileStripeSubscriptionPrices,
  resolveStripeReconciliationWindow,
  subscriptionScheduleHasDrift,
} from '../stripeReconciliation.js'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))

test('reconciliation treats numeric database strings and Stripe integers as equal',()=>{
  assert.equal(paymentAmountsMismatch('2500',2500),false)
  assert.equal(paymentAmountsMismatch(2499,2500),true)
})

test('reconciliation detects Stripe phase amount, boundary, and count drift', () => {
  const expected = [
    { periodKey: '2026-08', amountCents: 10000, endPeriodKey: '2026-10' },
    { periodKey: '2026-10', amountCents: 8000, endPeriodKey: null },
  ]
  assert.equal(subscriptionScheduleHasDrift(expected, expected), false)
  assert.equal(subscriptionScheduleHasDrift(expected, [
    expected[0],
    { ...expected[1], amountCents: 8100 },
  ]), true)
  assert.equal(subscriptionScheduleHasDrift(expected, [expected[0]]), true)
  assert.equal(subscriptionScheduleHasDrift(expected, [
    { ...expected[0], endPeriodKey: '2026-11' },
    expected[1],
  ]), true)
})

function reconciliationWindowPool(rows = []) {
  const calls = []
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ text: String(sql), params })
      return { rows }
    },
  }
}

test('normal reconciliation keeps the configured rolling lookback as its minimum window', async () => {
  const endedAt = new Date('2026-09-03T12:00:00.000Z')
  const pool = reconciliationWindowPool([{
    window_ended_at: new Date('2026-09-02T12:00:00.000Z'),
  }])

  const window = await resolveStripeReconciliationWindow(pool, {
    lookbackHours: 168,
    endedAt,
  })

  assert.equal(window.startedAt.toISOString(), '2026-08-27T12:00:00.000Z')
  assert.equal(window.endedAt.toISOString(), endedAt.toISOString())
  assert.equal(window.lastSuccessfulWindowEndedAt.toISOString(), '2026-09-02T12:00:00.000Z')
})

test('reconciliation closes an outage gap older than the configured lookback with safe overlap', async () => {
  const pool = reconciliationWindowPool([{
    window_ended_at: new Date('2026-08-20T12:00:00.000Z'),
  }])

  const window = await resolveStripeReconciliationWindow(pool, {
    lookbackHours: 168,
    endedAt: new Date('2026-09-03T12:00:00.000Z'),
  })

  assert.equal(window.startedAt.toISOString(), '2026-08-20T11:00:00.000Z')
})

test('failed and running reconciliation rows never advance the durable high-water mark', async () => {
  const endedAt = new Date('2026-09-03T12:00:00.000Z')
  const runs = [
    { id: 11, status: 'succeeded', window_ended_at: new Date('2026-08-20T12:00:00.000Z') },
    { id: 12, status: 'failed', window_ended_at: new Date('2026-09-02T12:00:00.000Z') },
    { id: 13, status: 'running', window_ended_at: new Date('2026-09-03T11:00:00.000Z') },
  ]
  const calls = []
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      const succeeded = runs
        .filter((run) => run.status === 'succeeded' && run.window_ended_at <= params[0])
        .sort((left, right) => right.window_ended_at - left.window_ended_at)
      return { rows: succeeded.slice(0, 1) }
    },
  }

  const window = await resolveStripeReconciliationWindow(pool, {
    lookbackHours: 168,
    endedAt,
  })

  assert.equal(window.lastSuccessfulWindowEndedAt.toISOString(), '2026-08-20T12:00:00.000Z')
  assert.equal(window.startedAt.toISOString(), '2026-08-20T11:00:00.000Z')
  assert.match(calls[0].text, /WHERE status = 'succeeded'/)
  assert.match(calls[0].text, /ORDER BY window_ended_at DESC, id DESC/)
})

test('reconciliation without a prior successful run falls back to configured lookback', async () => {
  const pool = reconciliationWindowPool([])

  const window = await resolveStripeReconciliationWindow(pool, {
    lookbackHours: 48,
    endedAt: new Date('2026-09-03T12:00:00.000Z'),
  })

  assert.equal(window.startedAt.toISOString(), '2026-09-01T12:00:00.000Z')
  assert.equal(window.lastSuccessfulWindowEndedAt, null)
})

function durableOwnerPool({
  checkoutRows = () => [],
  householdRows = () => [],
  annualRows = () => [],
  releaseEnrollmentRows = () => [],
  releaseAnnualRows = () => [],
} = {}) {
  const calls = []
  return {
    calls,
    async query(sql, params = []) {
      const text = String(sql)
      calls.push(text)
      if (text.includes('stripe-reconciliation:durable-checkout-owners')) {
        return { rows: checkoutRows() }
      }
      if (text.includes('stripe-reconciliation:durable-household-invoices')) {
        return { rows: householdRows() }
      }
      if (text.includes('stripe-reconciliation:durable-annual-invoice-payments')) {
        return { rows: annualRows() }
      }
      if (text.includes('stripe-reconciliation:release-expired-enrollment-checkout')) {
        return { rows: releaseEnrollmentRows(params) }
      }
      if (text.includes('stripe-reconciliation:release-expired-annual-checkout')) {
        return { rows: releaseAnnualRows(params) }
      }
      throw new Error(`Unexpected durable owner query: ${text}`)
    },
  }
}

function oldEnrollmentCheckoutSession({ paid = false } = {}) {
  return {
    id: 'cs_old_enrollment',
    object: 'checkout.session',
    mode: 'payment',
    status: paid ? 'complete' : 'open',
    payment_status: paid ? 'paid' : 'unpaid',
    amount_total: 5100,
    currency: 'usd',
    customer: 'cus_family',
    payment_intent: paid ? {
      id: 'pi_old_enrollment',
      object: 'payment_intent',
      status: 'succeeded',
      amount: 5100,
      amount_received: 5100,
      currency: 'usd',
      customer: 'cus_family',
      // Six months old: a PaymentIntent.created rolling window cannot see a
      // later state transition on this object.
      created: Math.floor(new Date('2026-03-01T12:00:00.000Z').getTime() / 1000),
    } : null,
    metadata: {
      checkoutType: 'enrollment',
      pendingEnrollmentId: '71',
      familyBillingAccountId: '44',
      memberId: '95',
      payerMemberId: '94',
    },
  }
}

test('durable owner sweep recovers an old Checkout payment that succeeds after the rolling lookback', async () => {
  let remotePaid = false
  let locallyFulfilled = false
  const owner = {
    owner_kind: 'enrollment',
    owner_id: 71,
    family_billing_account_id: 44,
    stripe_checkout_session_id: 'cs_old_enrollment',
    expected_amount_cents: 5100,
    local_status: 'failed',
    expected_checkout_mode: 'payment',
  }
  const pool = durableOwnerPool({
    checkoutRows: () => locallyFulfilled ? [] : [owner],
  })
  const stripe = {
    checkout: {
      sessions: {
        async retrieve(id) {
          assert.equal(id, 'cs_old_enrollment')
          return oldEnrollmentCheckoutSession({ paid: remotePaid })
        },
        async list(params) {
          assert.equal(params.payment_intent, 'pi_old_enrollment')
          return { data: [oldEnrollmentCheckoutSession({ paid: true })], has_more: false }
        },
      },
    },
    paymentIntents: {
      async retrieve() {
        throw new Error('expanded exact PaymentIntent should be sufficient')
      },
    },
    invoices: { retrieve: async () => { throw new Error('no invoice owner expected') } },
  }
  const alerts = []
  const dependencies = {
    fulfillCheckout: async (_pool, binding) => {
      assert.equal(binding.session.id, 'cs_old_enrollment')
      locallyFulfilled = true
      return { status: 'fulfilled', repaired: true, payment: { newly_inserted: true } }
    },
    recordAlert: async (...args) => alerts.push(args),
  }

  const beforeSuccess = await reconcileDurableStripeOwners(pool, stripe, dependencies)
  assert.equal(beforeSuccess.checkoutOwnersChecked, 1)
  assert.equal(beforeSuccess.checkoutOwnersRetained, 1)
  assert.equal(beforeSuccess.checkoutOwnersFulfilled, 0)

  remotePaid = true
  const afterLateSuccess = await reconcileDurableStripeOwners(pool, stripe, dependencies)
  assert.equal(afterLateSuccess.checkoutOwnersChecked, 1)
  assert.equal(afterLateSuccess.checkoutOwnersFulfilled, 1)
  assert.equal(afterLateSuccess.checkoutOwnersRepaired, 1)
  assert.equal(afterLateSuccess.paymentsInserted, 1)
  assert.equal(afterLateSuccess.failures, 0)
  assert.equal(alerts.length, 0)

  const selector = pool.calls.find((text) => text.includes('durable-checkout-owners'))
  assert.ok(selector)
  assert.doesNotMatch(selector, /created_at\s*[<>]|updated_at\s*[<>]|interval\s+'168 hours'/i)
  assert.match(selector, /FROM stripe_pending_enrollment/)
  assert.match(selector, /checkout_mode IN \('payment', 'subscription'\)/)
  assert.match(selector, /expected_checkout_mode/)
  assert.match(selector, /FROM annual_membership_checkout_request/)
  assert.match(selector, /FROM store_order/)
  assert.match(selector, /status = 'completed'[\s\S]*NOT EXISTS/)
  assert.match(selector, /paid-checkout-refund-required/)
  assert.match(selector, /ORDER BY owner_kind, owner_id/)
})

test('durable owner sweep proves a paid historical subscription Checkout and sends it to terminal quarantine', async () => {
  const owner = {
    owner_kind: 'enrollment',
    owner_id: 71,
    family_billing_account_id: 44,
    stripe_checkout_session_id: 'cs_legacy_subscription',
    expected_amount_cents: 5100,
    local_status: 'failed',
    expected_checkout_mode: 'subscription',
  }
  const session = {
    id: owner.stripe_checkout_session_id,
    object: 'checkout.session',
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 5100,
    currency: 'usd',
    customer: 'cus_family',
    invoice: 'in_legacy_subscription',
    subscription: 'sub_legacy_collector',
    metadata: {
      checkoutType: 'enrollment',
      pendingEnrollmentId: '71',
      familyBillingAccountId: '44',
      memberId: '95',
      payerMemberId: '94',
    },
  }
  const invoice = {
    id: 'in_legacy_subscription',
    object: 'invoice',
    status: 'paid',
    paid: true,
    amount_paid: 5100,
    currency: 'usd',
    customer: 'cus_family',
    subscription: 'sub_legacy_collector',
    payment_intent: 'pi_legacy_subscription',
  }
  const paymentIntent = {
    id: 'pi_legacy_subscription',
    object: 'payment_intent',
    status: 'succeeded',
    amount: 5100,
    amount_received: 5100,
    currency: 'usd',
    customer: 'cus_family',
    invoice: invoice.id,
    created: 1,
  }
  const invoicePayment = {
    id: 'inpay_legacy_subscription',
    object: 'invoice_payment',
    status: 'paid',
    amount_paid: 5100,
    currency: 'usd',
    invoice,
    payment: { type: 'payment_intent', payment_intent: paymentIntent.id },
  }
  const pool = durableOwnerPool({ checkoutRows: () => [owner] })
  const stripe = {
    checkout: {
      sessions: {
        async retrieve(id, params) {
          assert.equal(id, session.id)
          assert.ok(params.expand.includes('invoice.payment_intent'))
          assert.ok(params.expand.includes('subscription'))
          return session
        },
      },
    },
    invoices: {
      async retrieve(id, params) {
        assert.equal(id, invoice.id)
        assert.ok(params.expand.includes('payments.data.payment.payment_intent'))
        return invoice
      },
    },
    invoicePayments: {
      async list(params) {
        if (params.invoice) assert.equal(params.invoice, invoice.id)
        else assert.equal(params.payment?.payment_intent, paymentIntent.id)
        return { data: [invoicePayment], has_more: false }
      },
    },
    paymentIntents: {
      async retrieve(id) {
        assert.equal(id, paymentIntent.id)
        return paymentIntent
      },
    },
  }
  let observedBinding = null
  const result = await reconcileDurableStripeOwners(pool, stripe, {
    fulfillCheckout: async (_pool, binding) => {
      observedBinding = binding
      return {
        status: 'quarantined',
        reason: 'forbidden_subscription_checkout',
        payment: { id: 51, external_status: 'reconciliation_required' },
      }
    },
    recordAlert: async () => {
      throw new Error('the core quarantine is terminal and must not create a retry alert')
    },
  })

  assert.equal(observedBinding.state, 'paid')
  assert.equal(observedBinding.checkoutType, 'enrollment')
  assert.equal(observedBinding.session.invoice.id, invoice.id)
  assert.equal(observedBinding.session.payment_intent.id, paymentIntent.id)
  assert.equal(observedBinding.session.subscription, 'sub_legacy_collector')
  assert.equal(result.checkoutOwnersTerminal, 1)
  assert.equal(result.checkoutOwnersFulfilled, 0)
  assert.equal(result.checkoutOwnersRetained, 0)
  assert.equal(result.failures, 0)
})

test('durable owner sweep retains an open historical annual subscription Checkout with a critical retirement alert', async () => {
  const owner = {
    owner_kind: 'annual_membership',
    owner_id: 72,
    family_billing_account_id: 44,
    stripe_checkout_session_id: 'cs_open_legacy_annual',
    expected_amount_cents: 8500,
    local_status: 'pending',
    expected_checkout_mode: null,
  }
  const pool = durableOwnerPool({ checkoutRows: () => [owner] })
  const session = {
    id: owner.stripe_checkout_session_id,
    object: 'checkout.session',
    mode: 'subscription',
    status: 'open',
    payment_status: 'unpaid',
    amount_total: 8500,
    currency: 'usd',
    customer: 'cus_family',
    subscription: null,
    metadata: {
      checkoutType: 'annual_membership',
      annualMembershipCheckoutRequestId: '72',
      familyBillingAccountId: '44',
      payerMemberId: '94',
    },
  }
  const alerts = []
  const stripe = {
    checkout: { sessions: { retrieve: async () => session } },
    invoices: { retrieve: async () => { throw new Error('unpaid session has no invoice') } },
  }
  const result = await reconcileDurableStripeOwners(pool, stripe, {
    recordAlert: async (...args) => alerts.push(args),
  })

  assert.equal(result.checkoutOwnersRetained, 1)
  assert.equal(result.failures, 1)
  assert.equal(result.errors[0].stripeObjectId, session.id)
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0][2], 'durable_stripe_owner_reconciliation_failed')
  assert.equal(alerts[0][3], 'critical')
  assert.match(result.errors[0].message, /expire the open Session/i)
  assert.match(result.errors[0].message, /controlled retirement workflow/i)
})

test('durable owner sweep releases only an exact remotely expired unpaid enrollment owner', async () => {
  const owner = {
    owner_kind: 'enrollment',
    owner_id: 73,
    family_billing_account_id: 44,
    stripe_checkout_session_id: 'cs_expired_enrollment',
    expected_amount_cents: 12500,
    local_status: 'pending',
    expected_checkout_mode: 'payment',
  }
  let released = false
  const pool = durableOwnerPool({
    checkoutRows: () => released ? [] : [owner],
    releaseEnrollmentRows: (params) => {
      assert.deepEqual(params.slice(0, 3), [73, owner.stripe_checkout_session_id, 'payment'])
      assert.match(params[3], /conclusively expired and unpaid/)
      assert.equal(params[4], '[paid-checkout-refund-required]%')
      released = true
      return [{ id: owner.owner_id }]
    },
  })
  const session = {
    id: owner.stripe_checkout_session_id,
    object: 'checkout.session',
    mode: 'payment',
    status: 'expired',
    payment_status: 'unpaid',
    amount_total: owner.expected_amount_cents,
    currency: 'usd',
    customer: 'cus_family',
    payment_intent: null,
    metadata: {
      checkoutType: 'enrollment',
      pendingEnrollmentId: String(owner.owner_id),
      familyBillingAccountId: String(owner.family_billing_account_id),
      memberId: '95',
      payerMemberId: '94',
    },
  }
  const result = await reconcileDurableStripeOwners(pool, {
    checkout: { sessions: { retrieve: async () => session } },
  })

  assert.equal(released, true)
  assert.equal(result.checkoutOwnersReleased, 1)
  assert.equal(result.checkoutOwnersTerminal, 1)
  assert.equal(result.checkoutOwnersRetained, 0)
  assert.equal(result.failures, 0)
  const releaseSql = pool.calls.find((text) => text.includes('release-expired-enrollment-checkout'))
  assert.match(releaseSql, /stripe_checkout_session_id = \$2/)
  assert.match(releaseSql, /checkout_mode = \$3/)
  assert.match(releaseSql, /status IN \('pending', 'processing', 'failed'\)/)
  assert.doesNotMatch(releaseSql, /status IN \([^)]*completed/)
})

test('completed Checkout owners remain durable until their settled payment has exact Session-tagged applications', async () => {
  const owner = {
    owner_kind: 'enrollment',
    owner_id: 74,
    family_billing_account_id: 44,
    stripe_checkout_session_id: 'cs_completed_unapplied',
    expected_amount_cents: 25500,
    local_status: 'completed',
    expected_checkout_mode: 'payment',
  }
  const pool = durableOwnerPool({ checkoutRows: () => [owner] })
  let repaired = false
  const result = await reconcileDurableStripeOwners(pool, {}, {
    inspectCheckoutOwner: async () => ({
      state: 'paid',
      checkoutType: 'enrollment',
      session: { id: owner.stripe_checkout_session_id },
    }),
    fulfillCheckout: async () => {
      repaired = true
      return {
        status: 'fulfilled',
        repaired: true,
        payment: { id: 51, newly_inserted: false },
      }
    },
  })

  assert.equal(repaired, true)
  assert.equal(result.checkoutOwnersFulfilled, 1)
  assert.equal(result.checkoutOwnersRepaired, 1)
  const selector = pool.calls.find((text) => text.includes('durable-checkout-owners'))
  assert.match(selector, /enrollment\.status = 'completed'[\s\S]*billing_payment_application/)
  assert.match(selector, /charged\.stripe_checkout_session_id = enrollment\.stripe_checkout_session_id/)
  assert.match(selector, /enrollment\.purchase_target_cents/)
  assert.doesNotMatch(selector, /enrollment\.stripe_customer_id/)
  assert.match(selector, /annual_request\.status = 'completed'[\s\S]*billing_payment_application/)
  assert.match(selector, /charged\.stripe_checkout_session_id = annual_request\.stripe_checkout_session_id/)
})

test('durable invoice sweep retains a transient per-object failure and retries the same exact invoice', async () => {
  let locallySettled = false
  let recordAttempts = 0
  const owner = {
    owner_kind: 'household_invoice',
    owner_id: 88,
    family_billing_account_id: 44,
    stripe_invoice_id: 'in_old_household',
    expected_amount_cents: 25500,
    local_status: 'open',
  }
  const pool = durableOwnerPool({
    householdRows: () => locallySettled ? [] : [owner],
  })
  const stripe = {
    invoices: {
      async retrieve(id) {
        assert.equal(id, 'in_old_household')
        return { id, status: 'paid', paid: true, created: 1, amount_paid: 25500 }
      },
    },
  }
  const alerts = []
  const dependencies = {
    recordInvoice: async () => {
      recordAttempts += 1
      if (recordAttempts === 1) throw new Error('temporary database disconnect')
      locallySettled = true
      return {
        classification: { kind: 'household' },
        payment: { id: 91, external_status: 'settled', newly_inserted: false },
        householdSettlement: { conflicted: false },
      }
    },
    recordAlert: async (...args) => alerts.push(args),
  }

  const failedPass = await reconcileDurableStripeOwners(pool, stripe, dependencies)
  assert.equal(failedPass.householdInvoicesChecked, 1)
  assert.equal(failedPass.householdInvoicesRetained, 1)
  assert.equal(failedPass.householdInvoicesRepaired, 0)
  assert.equal(failedPass.failures, 1)
  assert.equal(alerts.length, 1)

  const replay = await reconcileDurableStripeOwners(pool, stripe, dependencies)
  assert.equal(replay.householdInvoicesChecked, 1)
  assert.equal(replay.householdInvoicesRetained, 0)
  assert.equal(replay.householdInvoicesRepaired, 1)
  assert.equal(replay.failures, 0)
  assert.equal(recordAttempts, 2)

  const householdSelector = pool.calls.find((text) => text.includes('durable-household-invoices'))
  const annualSelector = pool.calls.find((text) => text.includes('durable-annual-invoice-payments'))
  assert.doesNotMatch(householdSelector, /created_at\s*[<>]|updated_at\s*[<>]/i)
  assert.match(householdSelector, /billing_monthly_invoice/)
  assert.match(annualSelector, /annual-invoice-fulfillment-pending:/)
  assert.match(annualSelector, /annual-invoice-refund-required:/)
  assert.match(annualSelector, /ORDER BY payment\.id/)
})

test('durable Checkout sweep treats a core quarantine as terminal instead of retrying fulfillment', async () => {
  const pool = durableOwnerPool({
    checkoutRows: () => [{
      owner_kind: 'annual_membership',
      owner_id: 72,
      family_billing_account_id: 44,
      stripe_checkout_session_id: 'cs_quarantined_during_replay',
      expected_amount_cents: 8500,
      local_status: 'failed',
    }],
  })
  const result = await reconcileDurableStripeOwners(pool, {}, {
    inspectCheckoutOwner: async () => ({ state: 'paid', session: { id: 'cs_quarantined_during_replay' } }),
    fulfillCheckout: async () => ({ status: 'quarantined', reason: 'paid_checkout_refund_required' }),
    recordAlert: async () => { throw new Error('terminal quarantine must not create a reconciliation retry alert') },
  })
  assert.equal(result.checkoutOwnersTerminal, 1)
  assert.equal(result.checkoutOwnersRetained, 0)
  assert.equal(result.failures, 0)
})

test('durable Checkout sweep retains a concurrent in-progress commit without a false incident', async () => {
  const pool = durableOwnerPool({
    checkoutRows: () => [{
      owner_kind: 'enrollment',
      owner_id: 71,
      family_billing_account_id: 44,
      stripe_checkout_session_id: 'cs_in_progress',
      expected_amount_cents: 5100,
      local_status: 'processing',
    }],
  })
  let alerted = false
  const result = await reconcileDurableStripeOwners(pool, {}, {
    inspectCheckoutOwner: async () => ({ state: 'paid', session: { id: 'cs_in_progress' } }),
    fulfillCheckout: async () => ({
      status: 'unverified',
      reason: 'enrollment_checkout_in_progress',
    }),
    recordAlert: async () => { alerted = true },
  })
  assert.equal(result.checkoutOwnersRetained, 1)
  assert.equal(result.failures, 0)
  assert.equal(alerted, false)
})

test('refund reconciliation fully paginates the all-age inventory and finalizes approved ledger treatment', async () => {
  const pages = []
  const refunds = {
    re_newer: {
      id: 're_newer',
      object: 'refund',
      created: 200,
      payment_intent: 'pi_newer',
      amount: 2000,
      currency: 'usd',
      status: 'succeeded',
    },
    re_older: {
      id: 're_older',
      object: 'refund',
      created: 100,
      payment_intent: 'pi_older',
      amount: 1000,
      currency: 'usd',
      status: 'succeeded',
    },
  }
  const stripe = {
    refunds: {
      async list(params) {
        pages.push(params)
        if (!params.starting_after) {
          return { data: [refunds.re_newer], has_more: true }
        }
        assert.equal(params.starting_after, 're_newer')
        return { data: [refunds.re_older], has_more: false }
      },
    },
  }
  const syncOrder = []
  const finalizeOrder = []
  const startedAt = new Date('2026-08-27T12:00:00.000Z')
  const endedAt = new Date('2026-09-03T12:00:00.000Z')
  const result = await reconcileStripeRefunds({}, stripe, {
    startedAt,
    endedAt,
    loadDurableIds: async () => [],
    loadFailedWebhookEvents: async () => [],
    syncRefund: async (_pool, refund, options) => {
      syncOrder.push(refund.id)
      assert.equal(options.stripeClient, stripe)
      assert.equal(options.event.id, `reconciliation:refund:${refund.id}`)
      return {
        id: refund.id === 're_older' ? 1 : 2,
        stripe_refund_id: refund.id,
        external_status: 'succeeded',
        ledger_treatment: 'reverse_charge',
      }
    },
    finalizeRefund: async (_pool, refund, options) => {
      finalizeOrder.push(refund.stripe_refund_id)
      assert.equal(options.actorType, 'reconciliation')
      return refund
    },
    resolveRetryAlert: async () => {},
  })

  assert.equal(pages.length, 2)
  assert.equal(pages[0].created, undefined)
  assert.equal(pages[0].limit, 100)
  assert.deepEqual(syncOrder, ['re_older', 're_newer'])
  assert.deepEqual(finalizeOrder, syncOrder)
  assert.equal(result.checked, 2)
  assert.equal(result.synced, 2)
  assert.equal(result.finalized, 2)
  assert.equal(result.failed, 0)
})

test('an out-of-order refund keeps its exact ID and replays after the payment owner is recorded', async () => {
  const refund = {
    id: 're_out_of_order',
    object: 'refund',
    created: 1,
    payment_intent: 'pi_late_payment',
    amount: 25500,
    currency: 'usd',
    status: 'succeeded',
  }
  let durableAnchor = false
  let paymentRecorded = false
  let finalized = 0
  const alertKeys = []
  const stripe = {
    refunds: {
      async retrieve(id) {
        assert.equal(id, refund.id)
        return refund
      },
    },
  }
  const dependencies = {
    loadDurableIds: async () => durableAnchor ? [refund.id] : [],
    loadFailedWebhookEvents: async () => [],
    syncRefund: async () => {
      if (!paymentRecorded) {
        throw new Error('belongs to unrecorded PaymentIntent pi_late_payment')
      }
      return {
        id: 71,
        stripe_refund_id: refund.id,
        external_status: 'succeeded',
        ledger_treatment: 'return_overpayment',
      }
    },
    finalizeRefund: async (_pool, local) => {
      finalized += 1
      return local
    },
    recordAlert: async (_pool, key, type, severity, _message, objectId) => {
      alertKeys.push(key)
      assert.equal(key, `refund:${refund.id}:retry`)
      assert.equal(type, 'stripe_refund_reconciliation_failed')
      assert.equal(severity, 'critical')
      assert.equal(objectId, refund.id)
      durableAnchor = true
    },
    resolveRetryAlert: async (_pool, id) => {
      assert.equal(id, refund.id)
      durableAnchor = false
    },
  }

  const first = await reconcileStripeRefunds({}, stripe, {
    ...dependencies,
    startedAt: new Date(0),
    endedAt: new Date(),
    listRefunds: async () => [refund],
  })
  assert.equal(first.failed, 1)
  assert.equal(first.synced, 0)
  assert.equal(durableAnchor, true)

  paymentRecorded = true
  const replay = await reconcileStripeRefunds({}, stripe, {
    ...dependencies,
    startedAt: new Date(),
    endedAt: new Date(),
    listRefunds: async () => [],
  })
  assert.equal(replay.durableIdsChecked, 1)
  assert.equal(replay.synced, 1)
  assert.equal(replay.finalized, 1)
  assert.equal(replay.failed, 0)
  assert.equal(finalized, 1)
  assert.equal(durableAnchor, false)
  assert.deepEqual(alertKeys, [`refund:${refund.id}:retry`])
})

test('a failed refund webhook recovers an old refund outside the rolling lookback', async () => {
  const refund = {
    id: 're_predeploy_old',
    object: 'refund',
    created: 1,
    payment_intent: 'pi_predeploy_old',
    amount: 25500,
    currency: 'usd',
    status: 'succeeded',
  }
  const event = {
    id: 'evt_predeploy_refund',
    type: 'refund.updated',
    data: { object: refund },
  }
  const completed = []
  const finalized = []
  const stripe = {
    events: {
      async retrieve(id) {
        assert.equal(id, event.id)
        return event
      },
    },
    refunds: {
      async list() {
        throw new Error('the rolling list is replaced in this regression')
      },
    },
  }
  const result = await reconcileStripeRefunds({}, stripe, {
    startedAt: new Date('2026-08-27T12:00:00.000Z'),
    endedAt: new Date('2026-09-03T12:00:00.000Z'),
    listRefunds: async () => [],
    loadDurableIds: async () => [],
    loadFailedWebhookEvents: async () => [{
      event_id: event.id,
      event_type: event.type,
      status: 'failed',
    }],
    beginWebhook: async (_pool, observed) => {
      assert.equal(observed, event)
      return { claimed: true, claimToken: 'claim_refund' }
    },
    completeWebhook: async (_pool, observed, options) => {
      completed.push([observed.id, options.claimToken])
    },
    resolveWebhookRetryAlert: async (_pool, id) => {
      assert.equal(id, event.id)
    },
    failWebhook: async () => {
      throw new Error('successful recovery must complete, not fail, its webhook claim')
    },
    syncRefund: async (_pool, observed) => {
      assert.equal(observed, refund)
      return {
        id: 91,
        stripe_refund_id: refund.id,
        external_status: 'succeeded',
        ledger_treatment: 'return_overpayment',
      }
    },
    finalizeRefund: async (_pool, local) => {
      finalized.push(local.stripe_refund_id)
      return local
    },
    resolveRetryAlert: async () => {},
  })

  assert.equal(result.failedWebhookEventsChecked, 1)
  assert.equal(result.checked, 1)
  assert.equal(result.synced, 1)
  assert.equal(result.finalized, 1)
  assert.equal(result.failed, 0)
  assert.deepEqual(finalized, [refund.id])
  assert.deepEqual(completed, [[event.id, 'claim_refund']])
})

test('a treated reconciliation-required refund is revalidated and finalized by exact refund ID', async () => {
  const refund = {
    id: 're_treatment_approved',
    object: 'refund',
    created: 1,
    payment_intent: 'pi_treatment_approved',
    amount: 1000,
    currency: 'usd',
    status: 'succeeded',
  }
  let finalized = false
  const result = await reconcileStripeRefunds({}, {
    refunds: { retrieve: async () => refund },
  }, {
    startedAt: new Date(),
    endedAt: new Date(),
    listRefunds: async () => [],
    loadDurableIds: async () => [refund.id],
    loadFailedWebhookEvents: async () => [],
    syncRefund: async () => ({
      id: 92,
      stripe_refund_id: refund.id,
      external_status: 'succeeded',
      ledger_treatment: 'reverse_charge',
    }),
    finalizeRefund: async (_pool, local) => {
      finalized = true
      return local
    },
    resolveRetryAlert: async () => {},
  })

  assert.equal(result.durableIdsChecked, 1)
  assert.equal(result.finalized, 1)
  assert.equal(finalized, true)
})

test('durable refund selector has no age cutoff and retains pending or unfinalized exact refunds', async () => {
  let selector = ''
  let webhookSelector = ''
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('stripe-reconciliation:durable-refund-ids')) {
        selector = text
        return { rows: [] }
      }
      if (text.includes('stripe-reconciliation:durable-refund-webhook-events')) {
        webhookSelector = text
        return { rows: [] }
      }
      throw new Error(`Unexpected durable refund query: ${text}`)
    },
  }
  const result = await reconcileStripeRefunds(pool, { refunds: {} }, {
    startedAt: new Date(0),
    endedAt: new Date(),
    listRefunds: async () => [],
  })
  assert.equal(result.checked, 0)
  assert.match(selector, /refund\.external_status = 'pending'/)
  assert.match(selector, /refund\.external_status = 'reconciliation_required'[\s\S]*refund\.ledger_treatment IS NOT NULL/)
  assert.match(selector, /refund\.external_status = 'succeeded'/)
  assert.match(selector, /billing_account_activity/)
  assert.match(selector, /stripe_refund_reconciliation_failed/)
  assert.doesNotMatch(selector, /created_at\s*[<>]|updated_at\s*[<>]|interval/i)
  assert.match(webhookSelector, /event_type = ANY/)
  assert.match(webhookSelector, /status = 'failed'/)
  assert.doesNotMatch(webhookSelector, /received_at\s*[<>]/i)
})

test('subscription reconciliation excludes household and cutover-owned accounts in SQL', async () => {
  let selector = ''
  const pool = {
    async query(sql) {
      selector = String(sql)
      return { rows: [] }
    },
  }

  const result = await reconcileStripeSubscriptionPrices(pool, {})

  assert.equal(result.subscriptionsChecked, 0)
  assert.match(selector, /fba\.household_monthly_billing_enabled = FALSE/)
  assert.match(selector, /NOT EXISTS\s*\([\s\S]*FROM billing_account_migration/)
  for (const state of [
    'armed',
    'cancellation_scheduled',
    'detached',
    'remote_retired',
    'household_active',
    'verified',
    'failed_forward_only',
    'rollback_pending',
  ]) {
    assert.match(selector, new RegExp(`'${state}'`))
  }
})

test('succeeded-payment reconciliation refuses metadata-only generic ownership', () => {
  const source = fs.readFileSync(path.join(testDirectory, '../stripeReconciliation.js'), 'utf8')
  const intentLoop = source.slice(source.indexOf('for await (const intent'))
  const invoiceResolution = intentLoop.indexOf('resolveStripePaymentIntentInvoice(stripe, intent)')
  const checkoutResolution = intentLoop.indexOf('inspectStripePaymentIntentCheckoutSession(stripe, intent)')
  const attemptResolution = intentLoop.indexOf('findBillingPaymentAttemptForStripeObject(pool, intent)')
  const recordedPaymentResolution = intentLoop.indexOf('FROM billing_payment')
  assert.ok(invoiceResolution >= 0)
  assert.ok(checkoutResolution > invoiceResolution)
  assert.ok(attemptResolution > checkoutResolution)
  assert.ok(recordedPaymentResolution > attemptResolution)
  assert.match(source, /if \(reservedAttempt\)[\s\S]*?continue/)
  assert.match(source, /resolveStripePaymentIntentInvoice\(stripe, intent\)[\s\S]*?if \(stripeInvoiceId\)[\s\S]*?recordAuthoritativeStripeInvoicePayment\(pool[\s\S]*?continue/)
  assert.match(source, /checkoutBinding\?\.state === 'paid'[\s\S]*?checkoutPaymentsDelegated \+= 1[\s\S]*?continue/)
  assert.match(source, /checkoutBinding\?\.state === 'pending'[\s\S]*?stripePaymentIntentOwnershipIsFresh[\s\S]*?paymentsDeferred \+= 1[\s\S]*?continue/)
  assert.match(source, /classification\.kind !== 'subscription'[\s\S]*?continue/)
  assert.doesNotMatch(source, /recordStripePayment\(pool/)
  assert.match(source, /stripe_payment_owner_unverified/)
  assert.match(source, /assertStripeUsdCurrency\(intent[\s\S]*?resolveStripePaymentIntentInvoice\(stripe, intent\)[\s\S]*?inspectStripePaymentIntentCheckoutSession\(stripe, intent\)[\s\S]*?findBillingPaymentAttemptForStripeObject\(pool, intent\)/)
})

test('webhook and reconciliation use the same fail-closed invoice classifier', () => {
  const reconciliationSource = fs.readFileSync(path.join(testDirectory, '../stripeReconciliation.js'), 'utf8')
  const routeSource = fs.readFileSync(path.join(testDirectory, '../../platform/registerRoutes.js'), 'utf8')
  assert.match(reconciliationSource, /recordAuthoritativeStripeInvoicePayment\(pool/)
  assert.match(routeSource, /event\.type === 'payment_intent\.succeeded'[\s\S]*?resolveStripePaymentIntentInvoice\(paymentIntentStripe, obj\)/)
  assert.equal((routeSource.match(/recordAuthoritativeStripeInvoicePayment\(pool/g) ?? []).length, 2)
  assert.match(routeSource, /classification\.kind !== 'subscription'/)
})

function paidCheckoutBinding(checkoutType, metadata = {}) {
  return {
    state: 'paid',
    checkoutType,
    session: {
      id: 'cs_exact',
      object: 'checkout.session',
      payment_intent: 'pi_exact',
      amount_total: 5100,
      currency: 'usd',
      payment_status: 'paid',
      customer: 'cus_family',
      metadata: {
        pendingEnrollmentId: '71',
        annualMembershipCheckoutRequestId: '72',
        familyBillingAccountId: '44',
        billingPaymentAttemptId: '73',
        ...metadata,
      },
    },
  }
}

function exactCheckoutPayment(overrides = {}) {
  return {
    id: 91,
    family_billing_account_id: 44,
    amount_cents: 5100,
    external_processor: 'stripe',
    external_status: 'settled',
    stripe_customer_id: 'cus_family',
    stripe_payment_intent_id: 'pi_exact',
    stripe_checkout_session_id: 'cs_exact',
    stripe_invoice_id: null,
    newly_inserted: false,
    ...overrides,
  }
}

test('paid Checkout fulfillment recovery dispatches idempotent store, enrollment, annual, and attempt owners', async () => {
  const calls = []
  const store = await reconcilePaidStripeCheckoutFulfillment({}, paidCheckoutBinding('store'), {
    completeStore: async (_pool, session) => {
      calls.push(['store', session.id])
      return { handled: true, paymentCompleted: true }
    },
  })
  assert.deepEqual(store, { status: 'fulfilled', repaired: true, owner: 'store_order' })

  const enrollment = await reconcilePaidStripeCheckoutFulfillment({}, paidCheckoutBinding('enrollment'), {
    stripe: { id: 'stripe' },
    commitEnrollment: async (_pool, options) => {
      calls.push(['enrollment', options.pendingEnrollmentId])
      return { status: 'already_completed', payment: exactCheckoutPayment() }
    },
  })
  assert.equal(enrollment.status, 'fulfilled')
  assert.equal(enrollment.repaired, false)

  const annual = await reconcilePaidStripeCheckoutFulfillment({}, paidCheckoutBinding('annual_membership'), {
    commitAnnualMembership: async (_pool, options) => {
      calls.push(['annual', options.accountId])
      return { status: 'already_active', payment: exactCheckoutPayment() }
    },
  })
  assert.deepEqual(annual, {
    status: 'fulfilled',
    repaired: false,
    owner: 'annual_membership_checkout_request',
  })

  const attempt = await reconcilePaidStripeCheckoutFulfillment({}, paidCheckoutBinding('outstanding_balance'), {
    findPaymentAttempt: async (_pool, session) => {
      calls.push(['attempt', session.id])
      return { id: 73 }
    },
    settlePaymentAttempt: async (_pool, options) => {
      calls.push(['settle', options.paymentIntentId])
      return { payment: { id: 92, newly_inserted: false }, conflicted: false }
    },
  })
  assert.equal(attempt.status, 'fulfilled')
  assert.equal(attempt.repaired, false)
  assert.deepEqual(calls, [
    ['store', 'cs_exact'],
    ['enrollment', 71],
    ['annual', 44],
    ['attempt', 'cs_exact'],
    ['settle', 'pi_exact'],
  ])
})

test('paid enrollment recovery requires the exact core settlement and never uses a second generic settlement path', async () => {
  let legacySettlementCalls = 0
  const recovered = await reconcilePaidStripeCheckoutFulfillment(
    {},
    paidCheckoutBinding('enrollment'),
    {
      commitEnrollment: async () => ({
        status: 'completed',
        payment: exactCheckoutPayment({ newly_inserted: true }),
      }),
      // These legacy injection names are intentionally ignored. If a future
      // refactor restores the old default-settled/generic-allocation bypass,
      // this test fails immediately.
      recordEnrollmentPayment: async () => { legacySettlementCalls += 1 },
      allocatePayments: async () => { legacySettlementCalls += 1 },
    },
  )
  assert.equal(recovered.status, 'fulfilled')
  assert.equal(recovered.repaired, true)
  assert.equal(legacySettlementCalls, 0)

  await assert.rejects(
    reconcilePaidStripeCheckoutFulfillment({}, paidCheckoutBinding('enrollment'), {
      commitEnrollment: async () => ({ status: 'already_completed' }),
    }),
    (error) => (
      error?.code === 'stripe_checkout_payment_binding_conflict'
      && error.details.reason === 'enrollment_checkout_payment_missing'
    ),
  )
})

test('paid Checkout recovery rejects replay payments with wrong immutable ownership', async () => {
  const cases = [
    ['account_mismatch', { family_billing_account_id: 45 }],
    ['amount_mismatch', { amount_cents: 5000 }],
    ['customer_mismatch', { stripe_customer_id: 'cus_other' }],
    ['checkout_session_mismatch', { stripe_checkout_session_id: 'cs_other' }],
  ]

  for (const [field, overrides] of cases) {
    await assert.rejects(
      reconcilePaidStripeCheckoutFulfillment({}, paidCheckoutBinding('enrollment'), {
        commitEnrollment: async () => ({
          status: 'already_completed',
          payment: exactCheckoutPayment(overrides),
        }),
      }),
      (error) => (
        error?.code === 'stripe_enrollment_payment_binding_conflict'
        && error.details.problems.includes(field)
      ),
    )
  }

  for (const [field, overrides] of cases) {
    await assert.rejects(
      reconcilePaidStripeCheckoutFulfillment({}, paidCheckoutBinding('annual_membership'), {
        commitAnnualMembership: async () => ({
          status: 'already_active',
          payment: exactCheckoutPayment(overrides),
        }),
      }),
      (error) => (
        error?.code === 'stripe_enrollment_payment_binding_conflict'
        && error.details.problems.includes(field)
      ),
    )
  }
})

test('paid Checkout fulfillment recovery reports missing or nonterminal local owners without generic insertion', async () => {
  const missingAttempt = await reconcilePaidStripeCheckoutFulfillment(
    {},
    paidCheckoutBinding('custom_charge'),
    { findPaymentAttempt: async () => null },
  )
  assert.deepEqual(missingAttempt, {
    status: 'unverified',
    reason: 'billing_payment_attempt_not_found',
  })

  const pendingEnrollment = await reconcilePaidStripeCheckoutFulfillment(
    {},
    paidCheckoutBinding('enrollment'),
    { commitEnrollment: async () => ({ status: 'in_progress' }) },
  )
  assert.deepEqual(pendingEnrollment, {
    status: 'unverified',
    reason: 'enrollment_checkout_in_progress',
  })

  await assert.rejects(
    reconcilePaidStripeCheckoutFulfillment({}, { state: 'pending', session: { id: 'cs_pending' } }),
    /Only one exact, paid Stripe Checkout Session/,
  )
})

test('canonical customer inventory flags every live subscription and schedule, including annual labels', async () => {
  const calls = []
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('canonical-collector:account-inventory')) {
        return {
          rows: [{
            id: 44,
            stripe_customer_id: 'cus_44',
            stripe_customer_owner_count: 1,
            migration_state: 'verified',
          }],
        }
      }
      if (text.includes('FROM billing_subscription') && text.includes('family_billing_account_id')) {
        return { rows: [{
          id: 91,
          source_type: 'annual_membership',
          pricing_option_key: 'annual_membership',
          status: 'active',
          stripe_subscription_id: 'sub_annual_rogue',
        }] }
      }
      if (text.includes('INSERT INTO stripe_billing_alert')) return { rows: [{ id: 1 }] }
      // recordStripeBillingAlert's optional payment-owner resolution is not
      // authoritative for this account-scoped inventory alert.
      if (text.includes('FROM billing_payment')) return { rows: [] }
      throw new Error(`Unexpected canonical inventory query: ${text}`)
    },
  }
  const stripe = {
    subscriptions: {
      async list() {
        return {
          data: [{
            id: 'sub_annual_rogue',
            status: 'active',
            customer: 'cus_44',
            metadata: {
              annualMembership: 'true',
              billingSubscriptionId: '91',
              familyBillingAccountId: '44',
            },
            items: { data: [] },
          }],
          has_more: false,
        }
      },
    },
    subscriptionSchedules: {
      async list() {
        return {
          data: [{
            id: 'sub_sched_rogue',
            status: 'active',
            customer: 'cus_44',
            subscription: 'sub_annual_rogue',
          }],
          has_more: false,
        }
      },
    },
  }

  const result = await reconcileCanonicalStripeCollectorInventory(pool, stripe)

  assert.equal(result.accountsChecked, 1)
  assert.equal(result.collectorDriftsFound, 2)
  const alert = calls.find(({ text }) => text.includes('INSERT INTO stripe_billing_alert'))
  assert.ok(alert)
  assert.equal(alert.params[1], 44)
  assert.equal(alert.params[2], 'canonical_remote_collector_drift')
})

test('canonical customer inventory quarantines a customer shared with an inactive account', async () => {
  const calls = []
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('canonical-collector:account-inventory')) {
        return {
          rows: [{
            id: 44,
            stripe_customer_id: 'cus_shared',
            stripe_customer_owner_count: 2,
            migration_state: 'verified',
          }],
        }
      }
      if (text.includes('INSERT INTO stripe_billing_alert')) return { rows: [{ id: 1 }] }
      if (text.includes('FROM billing_payment')) return { rows: [] }
      throw new Error(`Unexpected shared-customer inventory query: ${text}`)
    },
  }
  const stripe = {
    subscriptions: { list: async () => { throw new Error('must not inspect ambiguous customer') } },
    subscriptionSchedules: { list: async () => { throw new Error('must not inspect ambiguous customer') } },
  }

  const result = await reconcileCanonicalStripeCollectorInventory(pool, stripe)

  assert.equal(result.accountsChecked, 1)
  assert.equal(result.collectorDriftsFound, 1)
  const alert = calls.find(({ text }) => text.includes('INSERT INTO stripe_billing_alert'))
  assert.ok(alert)
  assert.equal(alert.params[2], 'canonical_collector_inventory_failed')
  assert.match(String(alert.params.at(-1)), /including inactive accounts/)
})
