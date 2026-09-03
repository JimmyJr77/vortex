import assert from 'node:assert/strict'
import test from 'node:test'

import {
  inspectStripePaymentIntentCheckoutSession,
  STRIPE_PAYMENT_OWNER_GRACE_MS,
  StripeCheckoutPaymentBindingConflict,
  stripePaymentIntentOwnershipIsFresh,
} from '../stripeCheckoutPaymentBinding.js'

function paymentIntent(overrides = {}) {
  return {
    id: 'pi_exact',
    object: 'payment_intent',
    status: 'succeeded',
    amount_received: 5100,
    currency: 'usd',
    customer: 'cus_family',
    created: 1_000,
    ...overrides,
  }
}

function checkoutSession(overrides = {}) {
  return {
    id: 'cs_exact',
    object: 'checkout.session',
    payment_intent: 'pi_exact',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 5100,
    currency: 'usd',
    customer: 'cus_family',
    metadata: {
      checkoutType: 'store',
      storeOrderId: '71',
      pendingEnrollmentId: '72',
      annualMembershipCheckoutRequestId: '73',
      familyBillingAccountId: '44',
      memberId: '91',
      payerMemberId: '92',
      pricingSnapshotHash: 'sha256:exact',
      billingPaymentAttemptId: '74',
      billingChargeId: '75',
    },
    ...overrides,
  }
}

function asyncIterableStripe(rows) {
  return {
    checkout: {
      sessions: {
        list(params) {
          assert.deepEqual(params, { payment_intent: 'pi_exact', limit: 100 })
          return {
            async *[Symbol.asyncIterator]() {
              yield * rows
            },
          }
        },
      },
    },
  }
}

test('an exact paid Vortex Checkout Session safely owns its PaymentIntent', async () => {
  for (const checkoutType of [
    'store',
    'enrollment',
    'annual_membership',
    'outstanding_balance',
    'custom_charge',
    'billing_charge_payment_request',
  ]) {
    const session = checkoutSession({
      metadata: { ...checkoutSession().metadata, checkoutType },
    })
    const binding = await inspectStripePaymentIntentCheckoutSession(
      asyncIterableStripe([session]),
      paymentIntent(),
    )
    assert.equal(binding.state, 'paid')
    assert.equal(binding.session, session)
    assert.equal(binding.checkoutType, checkoutType)
  }
})

test('Checkout ownership is not accepted from a partial first page', async () => {
  const calls = []
  const first = checkoutSession()
  const second = checkoutSession({ id: 'cs_second' })
  const stripe = {
    checkout: {
      sessions: {
        async list(params) {
          calls.push(params)
          if (!params.starting_after) return { data: [first], has_more: true }
          assert.equal(params.starting_after, first.id)
          return { data: [second], has_more: false }
        },
      },
    },
  }

  await assert.rejects(
    inspectStripePaymentIntentCheckoutSession(stripe, paymentIntent()),
    (error) => (
      error instanceof StripeCheckoutPaymentBindingConflict
      && /multiple Checkout Sessions/.test(error.message)
      && error.details.stripeCheckoutSessionIds.length === 2
    ),
  )
  assert.equal(calls.length, 2)
})

test('Checkout ownership fails closed when Stripe does not prove pagination complete', async () => {
  const stripe = {
    checkout: {
      sessions: {
        async list() {
          return { data: [checkoutSession()] }
        },
      },
    },
  }
  await assert.rejects(
    inspectStripePaymentIntentCheckoutSession(stripe, paymentIntent()),
    (error) => (
      error instanceof StripeCheckoutPaymentBindingConflict
      && /pagination is incomplete/.test(error.message)
    ),
  )
})

test('Checkout ownership requires exact PI, amount, currency, customer, mode, and type', async () => {
  const cases = [
    [{}, 'payment_intent_not_succeeded', { status: 'processing' }],
    [{ payment_intent: 'pi_other' }, 'payment_intent_mismatch'],
    [{ amount_total: 5099 }, 'checkout_amount_mismatch'],
    [{ currency: 'cad' }, 'checkout_currency_mismatch'],
    [{ customer: 'cus_other' }, 'checkout_customer_mismatch'],
    [{ mode: 'subscription' }, 'checkout_mode_not_payment'],
    [{ metadata: { ...checkoutSession().metadata, checkoutType: 'payment_method_update' } }, 'checkout_type_unrecognized'],
  ]

  for (const [mutation, expectedProblem, paymentIntentMutation = {}] of cases) {
    await assert.rejects(
      inspectStripePaymentIntentCheckoutSession(
        asyncIterableStripe([checkoutSession(mutation)]),
        paymentIntent(paymentIntentMutation),
      ),
      (error) => (
        error instanceof StripeCheckoutPaymentBindingConflict
        && error.details.problems.includes(expectedProblem)
      ),
    )
  }
})

test('each Checkout type requires its durable local owner identifiers', async () => {
  const cases = [
    ['store', 'storeOrderId', 'store_order_id_missing'],
    ['enrollment', 'pendingEnrollmentId', 'pendingEnrollmentId_missing'],
    ['annual_membership', 'annualMembershipCheckoutRequestId', 'annualMembershipCheckoutRequestId_missing'],
    ['outstanding_balance', 'billingPaymentAttemptId', 'billingPaymentAttemptId_missing'],
    ['custom_charge', 'billingChargeId', 'billingChargeId_missing'],
    ['billing_charge_payment_request', 'billingChargeId', 'billingChargeId_missing'],
  ]

  for (const [checkoutType, missingKey, expectedProblem] of cases) {
    const metadata = { ...checkoutSession().metadata, checkoutType }
    delete metadata[missingKey]
    await assert.rejects(
      inspectStripePaymentIntentCheckoutSession(
        asyncIterableStripe([checkoutSession({ metadata })]),
        paymentIntent(),
      ),
      (error) => (
        error instanceof StripeCheckoutPaymentBindingConflict
        && error.details.problems.includes(expectedProblem)
      ),
    )
  }
})

test('null Stripe customers are accepted only for guest store Checkout', async () => {
  const guestIntent = paymentIntent({ customer: null })
  const guestStore = checkoutSession({ customer: null })
  const storeBinding = await inspectStripePaymentIntentCheckoutSession(
    asyncIterableStripe([guestStore]),
    guestIntent,
  )
  assert.equal(storeBinding.state, 'paid')

  const enrollment = checkoutSession({
    customer: null,
    metadata: { ...checkoutSession().metadata, checkoutType: 'enrollment' },
  })
  await assert.rejects(
    inspectStripePaymentIntentCheckoutSession(asyncIterableStripe([enrollment]), guestIntent),
    (error) => (
      error instanceof StripeCheckoutPaymentBindingConflict
      && error.details.problems.includes('checkout_customer_missing')
    ),
  )
})

test('a matching Checkout Session can remain pending during event reordering', async () => {
  const session = checkoutSession({ status: 'open', payment_status: 'unpaid' })
  const binding = await inspectStripePaymentIntentCheckoutSession(
    asyncIterableStripe([session]),
    paymentIntent(),
  )
  assert.equal(binding.state, 'pending')
})

test('payment ownership deferral is bounded by the event or PaymentIntent creation time', () => {
  const nowMs = 2_000_000
  const recentCreated = (nowMs - STRIPE_PAYMENT_OWNER_GRACE_MS + 1) / 1000
  const boundaryCreated = (nowMs - STRIPE_PAYMENT_OWNER_GRACE_MS) / 1000

  assert.equal(stripePaymentIntentOwnershipIsFresh(
    paymentIntent({ created: recentCreated }),
    { nowMs },
  ), true)
  assert.equal(stripePaymentIntentOwnershipIsFresh(
    paymentIntent({ created: boundaryCreated }),
    { nowMs },
  ), false)
  assert.equal(stripePaymentIntentOwnershipIsFresh(
    paymentIntent({ created: 1 }),
    { event: { created: recentCreated }, nowMs },
  ), true)
  assert.equal(stripePaymentIntentOwnershipIsFresh(paymentIntent({ created: null }), { nowMs }), false)
})
