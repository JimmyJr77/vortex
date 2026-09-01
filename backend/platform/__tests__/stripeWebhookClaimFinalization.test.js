import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'

import {
  registerPlatformRoutes,
  requireTerminalStripeCheckoutCommit,
} from '../registerRoutes.js'
import { annualMembershipCheckoutSessionIsPaid } from '../../billing/annualMembershipCheckout.js'
import { getStripeClient } from '../../billing/stripeBilling.js'
import {
  confirmEnrollmentCheckoutSession,
  enrollmentCheckoutSessionCanFinalize,
} from '../../billing/stripeEnrollmentCheckout.js'

const JWT_SECRET = 'stripe-webhook-claim-finalization-test-secret'

async function withStripeTestEnvironment(callback) {
  const names = [
    'STRIPE_ENABLED',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_WEBHOOK_SECRETS',
  ]
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]))
  try {
    process.env.STRIPE_ENABLED = 'true'
    process.env.STRIPE_SECRET_KEY = 'sk_test_webhook_claim_finalization'
    delete process.env.STRIPE_WEBHOOK_SECRET
    delete process.env.STRIPE_WEBHOOK_SECRETS
    await callback()
  } finally {
    for (const name of names) {
      if (previous[name] == null) delete process.env[name]
      else process.env[name] = previous[name]
    }
  }
}

async function postWebhook(pool, event) {
  const app = express()
  registerPlatformRoutes(app, pool, { jwtSecret: JWT_SECRET })
  const route = app._router.stack.find((layer) => (
    layer.route?.path === '/api/stripe/webhook' && layer.route.methods.post === true
  ))
  assert.ok(route, 'Stripe webhook route must be registered')
  const handler = route.route.stack.at(-1)?.handle
  assert.equal(typeof handler, 'function')

  const request = {
    body: Buffer.from(JSON.stringify(event)),
    headers: {},
  }
  return new Promise((resolve, reject) => {
    let statusCode = 200
    const response = {
      status(code) { statusCode = Number(code); return this },
      json(body) { resolve({ status: statusCode, body }); return this },
    }
    Promise.resolve(handler(request, response)).catch(reject)
  })
}

async function invokeRegisteredPost(app, path, request) {
  const route = app._router.stack.find((layer) => (
    layer.route?.path === path && layer.route.methods.post === true
  ))
  assert.ok(route, `${path} must be registered`)
  const handler = route.route.stack.at(-1)?.handle
  assert.equal(typeof handler, 'function')
  return new Promise((resolve, reject) => {
    let statusCode = 200
    const response = {
      status(code) { statusCode = Number(code); return this },
      json(body) { resolve({ status: statusCode, body }); return this },
    }
    Promise.resolve(handler(request, response)).catch(reject)
  })
}

async function withRetrievedStripeSession(session, callback) {
  const stripe = await getStripeClient()
  assert.ok(stripe?.checkout?.sessions, 'Stripe test client must be available')
  const originalRetrieve = stripe.checkout.sessions.retrieve
  stripe.checkout.sessions.retrieve = async () => session
  try {
    return await callback()
  } finally {
    stripe.checkout.sessions.retrieve = originalRetrieve
  }
}

function webhookClaimPool({ onFulfillmentQuery }) {
  const calls = []
  let claimState = 'unclaimed'
  let claimToken = null
  return {
    calls,
    get claimState() { return claimState },
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('INSERT INTO stripe_webhook_event')) {
        claimState = 'processing'
        claimToken = params[2]
        return {
          rows: [{
            status: 'processing',
            attempts: 1,
            claim_token: claimToken,
            lease_expires_at: '2026-08-31T18:15:00.000Z',
          }],
        }
      }
      if (text.includes("SET status = 'failed'")) {
        assert.equal(params[1], claimToken)
        claimState = 'failed'
        return { rows: [{ event_id: params[0] }] }
      }
      if (text.includes("SET status = 'processed'")) {
        throw new Error('A nonterminal checkout commit must not complete its webhook claim.')
      }
      if (text.includes('INSERT INTO stripe_billing_alert')) return { rows: [] }
      return onFulfillmentQuery(text, params)
    },
  }
}

test('checkout commit status guard accepts only locally terminal fulfillment', () => {
  const enrollment = { status: 'completed' }
  const enrollmentReplay = { status: 'already_completed' }
  const annual = { status: 'completed' }
  const annualReplay = { status: 'already_active' }

  assert.equal(requireTerminalStripeCheckoutCommit(enrollment, 'enrollment'), enrollment)
  assert.equal(requireTerminalStripeCheckoutCommit(enrollmentReplay, 'enrollment'), enrollmentReplay)
  assert.equal(requireTerminalStripeCheckoutCommit(annual, 'annual_membership'), annual)
  assert.equal(requireTerminalStripeCheckoutCommit(annualReplay, 'annual_membership'), annualReplay)

  for (const result of [
    { status: 'in_progress' },
    { status: 'not_found' },
    { status: 'invalid', reason: 'failed' },
  ]) {
    assert.throws(
      () => requireTerminalStripeCheckoutCommit(result, 'enrollment'),
      (error) => (
        error.code === 'STRIPE_CHECKOUT_FULFILLMENT_INCOMPLETE'
        && error.commitStatus === result.status
      ),
    )
  }
  for (const result of [
    { status: 'error', reason: 'payer_mismatch' },
    { status: 'unpaid' },
    { status: 'none' },
  ]) {
    assert.throws(
      () => requireTerminalStripeCheckoutCommit(result, 'annual_membership'),
      (error) => (
        error.code === 'STRIPE_CHECKOUT_FULFILLMENT_INCOMPLETE'
        && error.commitStatus === result.status
      ),
    )
  }
})

test('browser enrollment confirmation requires paid Checkout or a mode-matched completed setup', () => {
  assert.equal(
    enrollmentCheckoutSessionCanFinalize(
      { mode: 'payment', status: 'complete', payment_status: 'unpaid' },
      { checkout_mode: 'payment' },
    ),
    false,
  )
  assert.equal(
    enrollmentCheckoutSessionCanFinalize(
      { mode: 'payment', status: 'complete', payment_status: 'paid' },
      { checkout_mode: 'payment' },
    ),
    true,
  )
  assert.equal(
    enrollmentCheckoutSessionCanFinalize(
      { mode: 'setup', status: 'complete', payment_status: 'no_payment_required' },
      { checkout_mode: 'setup' },
    ),
    true,
  )
  assert.equal(
    enrollmentCheckoutSessionCanFinalize(
      { mode: 'setup', status: 'complete', payment_status: 'no_payment_required' },
      { checkout_mode: 'payment' },
    ),
    false,
  )
  assert.equal(
    enrollmentCheckoutSessionCanFinalize(
      { mode: 'setup', status: 'open', payment_status: 'no_payment_required' },
      { checkout_mode: 'setup' },
    ),
    false,
  )
  assert.equal(
    enrollmentCheckoutSessionCanFinalize(
      { mode: 'subscription', status: 'complete', payment_status: 'paid', subscription: 'sub_stale' },
      { checkout_mode: 'subscription' },
    ),
    false,
  )
  assert.equal(
    enrollmentCheckoutSessionCanFinalize(
      { mode: 'payment', status: 'complete', payment_status: 'paid', subscription: 'sub_stale' },
      { checkout_mode: 'payment' },
    ),
    false,
  )
})

test('annual membership confirmation requires settled payment, not Checkout completion alone', () => {
  assert.equal(
    annualMembershipCheckoutSessionIsPaid({ status: 'complete', payment_status: 'unpaid' }),
    false,
  )
  assert.equal(
    annualMembershipCheckoutSessionIsPaid({ status: 'complete', payment_status: 'paid' }),
    true,
  )
  assert.equal(
    annualMembershipCheckoutSessionIsPaid({
      mode: 'subscription',
      status: 'complete',
      payment_status: 'paid',
      subscription: 'sub_stale',
    }),
    false,
  )
})

test('forbidden subscription-mode Checkout is durably quarantined and acknowledged', { concurrency: false }, async () => {
  await withStripeTestEnvironment(async () => {
    const calls = []
    let claimToken = null
    const pool = {
      async query(sql, params = []) {
        const text = String(sql)
        calls.push({ text, params })
        if (text.includes('INSERT INTO stripe_webhook_event')) {
          claimToken = params[2]
          return {
            rows: [{
              status: 'processing',
              attempts: 1,
              claim_token: claimToken,
              lease_expires_at: '2026-09-01T12:15:00.000Z',
            }],
          }
        }
        if (text.includes('INSERT INTO stripe_billing_alert')) return { rows: [] }
        if (text.includes("SET status = 'processed'")) {
          assert.equal(params[1], claimToken)
          return { rows: [{ event_id: params[0] }] }
        }
        throw new Error(`Unexpected forbidden Checkout webhook query: ${text}`)
      },
    }

    const response = await postWebhook(pool, {
      id: 'evt_stale_subscription_checkout',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_stale_subscription_checkout',
          mode: 'subscription',
          status: 'complete',
          payment_status: 'no_payment_required',
          subscription: 'sub_stale_checkout',
          metadata: {
            checkoutType: 'annual_membership',
            familyBillingAccountId: '44',
            payerMemberId: '75',
            memberId: '74',
            feeId: '22',
          },
        },
      },
    })

    assert.equal(response.status, 200)
    assert.deepEqual(response.body, { received: true, quarantined: true })
    assert.equal(calls.filter(({ text }) => text.includes('INSERT INTO stripe_billing_alert')).length, 1)
    assert.equal(calls.filter(({ text }) => text.includes("SET status = 'processed'")).length, 1)
    assert.equal(calls.some(({ text }) => text.includes('INSERT INTO billing_charge')), false)
  })
})

test('browser enrollment confirm rejects a complete but unpaid payment-mode Checkout', { concurrency: false }, async () => {
  await withStripeTestEnvironment(async () => {
    const session = {
      id: 'cs_unpaid_enrollment',
      mode: 'payment',
      status: 'complete',
      payment_status: 'unpaid',
      metadata: { checkoutType: 'enrollment', pendingEnrollmentId: '91' },
    }
    const queries = []
    const pool = {
      async query(sql) {
        const text = String(sql)
        queries.push(text)
        if (text.includes('FROM stripe_pending_enrollment pe')) {
          return {
            rows: [{
              id: 91,
              family_billing_account_id: 44,
              member_id: 74,
              family_id: 42,
              payer_member_id: 75,
              checkout_mode: 'payment',
              stripe_checkout_session_id: session.id,
              status: 'pending',
            }],
          }
        }
        throw new Error(`Unexpected unpaid enrollment confirmation query: ${text}`)
      },
    }

    await withRetrievedStripeSession(session, async () => {
      await assert.rejects(
        confirmEnrollmentCheckoutSession(pool, {
          checkoutSessionId: session.id,
          pendingEnrollmentId: 91,
          memberId: 75,
          familyId: 42,
          roles: [],
        }),
        /Payment is not complete yet/i,
      )
    })
    assert.equal(queries.some((text) => text.includes('UPDATE stripe_pending_enrollment')), false)
  })
})

test('annual browser-confirm route returns non-success for a complete but unpaid Checkout', { concurrency: false }, async () => {
  await withStripeTestEnvironment(async () => {
    const session = {
      id: 'cs_unpaid_annual',
      mode: 'payment',
      status: 'complete',
      payment_status: 'unpaid',
      metadata: {
        checkoutType: 'annual_membership',
        familyBillingAccountId: '44',
        payerMemberId: '75',
        memberId: '74',
        feeId: '22',
      },
    }
    const account = {
      id: 44,
      family_id: 42,
      payer_member_id: 75,
      is_active: true,
      family_facility_id: 9,
      facility_id: 9,
    }
    const pool = {
      async query(sql) {
        const text = String(sql)
        if (text.includes('WITH viewer AS')) return { rows: [{ family_id: 42 }] }
        if (text.includes('family.family_name')) return { rows: [account] }
        if (text.includes('SELECT account.*, family.facility_id')) return { rows: [account] }
        if (text.includes('SELECT member.id, member.family_id')) {
          return { rows: [{ id: 75, family_id: 42, facility_id: 9 }] }
        }
        throw new Error(`Unexpected unpaid annual confirmation query: ${text}`)
      },
    }
    const app = express()
    registerPlatformRoutes(app, pool, { jwtSecret: JWT_SECRET })

    await withRetrievedStripeSession(session, async () => {
      const response = await invokeRegisteredPost(
        app,
        '/api/members/billing/confirm-annual-membership-checkout',
        {
          body: { checkoutSessionId: session.id },
          platformAuth: { user: { member_id: 75, facility_id: 9 } },
        },
      )
      assert.equal(response.status, 409)
      assert.equal(response.body.success, false)
      assert.match(response.body.message, /fulfillment is not complete \(unpaid\)/i)
    })
  })
})

test('a completed setup enrollment commits locally and fails its durable claim on exception', { concurrency: false }, async () => {
  await withStripeTestEnvironment(async () => {
    const pool = webhookClaimPool({
      onFulfillmentQuery(text) {
        if (text.includes('FROM stripe_pending_enrollment pending')) {
          throw new Error('simulated enrollment commit failure')
        }
        throw new Error(`Unexpected enrollment webhook query: ${text}`)
      },
    })
    const response = await postWebhook(pool, {
      id: 'evt_enrollment_commit_failure',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_enrollment_commit_failure',
          mode: 'setup',
          status: 'complete',
          payment_status: 'no_payment_required',
          metadata: {
            checkoutType: 'enrollment',
            pendingEnrollmentId: '91',
            familyBillingAccountId: '44',
            memberId: '74',
            payerMemberId: '75',
          },
        },
      },
    })

    assert.equal(response.status, 500)
    assert.match(response.body.message, /simulated enrollment commit failure/i)
    assert.equal(pool.claimState, 'failed')
    assert.equal(pool.calls.filter(({ text }) => text.includes("SET status = 'failed'")).length, 1)
    assert.equal(pool.calls.some(({ text }) => text.includes("SET status = 'processed'")), false)
  })
})

test('an async annual membership success fails rather than acknowledges a nonterminal local commit', { concurrency: false }, async () => {
  await withStripeTestEnvironment(async () => {
    const pool = webhookClaimPool({
      onFulfillmentQuery(text) {
        if (text.includes('FROM family_billing_account account')) return { rows: [] }
        throw new Error(`Unexpected annual membership webhook query: ${text}`)
      },
    })
    const response = await postWebhook(pool, {
      id: 'evt_annual_commit_incomplete',
      type: 'checkout.session.async_payment_succeeded',
      data: {
        object: {
          id: 'cs_annual_commit_incomplete',
          status: 'complete',
          payment_status: 'paid',
          metadata: {
            checkoutType: 'annual_membership',
            familyBillingAccountId: '44',
            payerMemberId: '75',
            memberId: '74',
            feeId: '22',
          },
        },
      },
    })

    assert.equal(response.status, 500)
    assert.match(response.body.message, /annual membership checkout fulfillment is not complete \(error: account_inactive\)/i)
    assert.equal(pool.claimState, 'failed')
    assert.equal(pool.calls.filter(({ text }) => text.includes("SET status = 'failed'")).length, 1)
    assert.equal(pool.calls.some(({ text }) => text.includes("SET status = 'processed'")), false)
  })
})
