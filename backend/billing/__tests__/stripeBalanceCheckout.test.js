import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBalanceCheckoutParams, createCheckoutSession } from '../stripeBilling.js'
import { resumeMemberBalanceCheckout } from '../customerBalanceCheckoutResume.js'

test('balance checkout uses the authoritative balance and expires in 24 hours', () => {
  const params = buildBalanceCheckoutParams({
    account: { id: 17 },
    customerId: 'cus_test',
    balanceCents: 12345.4,
    successUrl: 'https://example.com/?billing=paid',
    cancelUrl: 'https://example.com/?billing=cancelled',
    analytics: { gaClientId: 'client-1' },
    nowMs: Date.parse('2026-07-25T12:00:00.000Z'),
  })
  assert.equal(params.mode, 'payment')
  assert.equal(params.line_items[0].price_data.unit_amount, 12345)
  assert.equal(params.client_reference_id, 'family-billing-account:17')
  assert.equal(params.metadata.familyBillingAccountId, '17')
  assert.equal(params.metadata.gaClientId, 'client-1')
  assert.equal(
    params.expires_at,
    Math.floor(Date.parse('2026-07-26T12:00:00.000Z') / 1000),
  )
})

test('balance checkout rejects non-positive collection amounts', () => {
  assert.throws(
    () =>
      buildBalanceCheckoutParams({
        account: { id: 17 },
        customerId: 'cus_test',
        balanceCents: 0,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }),
    /positive balance/,
  )
})

test('balance Checkout saves for off-session autopay only with an explicit opt-in', () => {
  const options = { account: { id: 17 }, customerId: 'cus_test', balanceCents: 10000,
    successUrl: 'https://example.test/success', cancelUrl: 'https://example.test/cancel' }
  for (const choice of [undefined, false, 'true']) {
    const params = buildBalanceCheckoutParams({ ...options, savePaymentMethodForAutopay: choice })
    assert.equal(params.payment_intent_data, undefined)
    assert.equal(params.metadata.balanceAutopayConsent, undefined)
  }
  const params = buildBalanceCheckoutParams({ ...options, savePaymentMethodForAutopay: true })
  assert.deepEqual(params.payment_method_types, ['card', 'link'])
  assert.equal(params.payment_intent_data.setup_future_usage, 'off_session')
  assert.equal(params.metadata.balanceAutopayConsent, 'v1')
  assert.match(params.custom_text.submit.message, /future automatic bill payments/)
  assert.equal(params.mode, 'payment')
  assert.equal(params.subscription_data, undefined)
})

test('legacy direct balance Checkout cannot create a payment without a durable attempt', async () => {
  await assert.rejects(
    createCheckoutSession({}, {
      account: { id: 44 },
      balanceCents: 25_500,
      successUrl: 'https://example.test/success',
      cancelUrl: 'https://example.test/cancel',
    }),
    (error) => (
      error?.code === 'DIRECT_BALANCE_CHECKOUT_DISABLED'
      && /reserved customer-balance Checkout flow/.test(error.message)
    ),
  )
})

const resumeAccount = { id: 17, family_facility_id: 42 }
const resumeAttempt = { id: 123, amount_cents: 62000, stripe_checkout_session_id: 'cs_balance', stripe_customer_id: 'cus_household' }
const resumeNow = new Date('2026-11-12T15:00:00Z')

function resumeFixture({ attempts = [resumeAttempt], sessionOverrides = {} } = {}) {
  const calls = []
  const pool = {
    async query(sql, params) {
      if (sql.includes('pg_advisory_lock(')) {
        calls.push('lock')
        return { rows: [] }
      }
      if (sql.includes('pg_advisory_unlock(')) {
        calls.push('unlock')
        return { rows: [{ pg_advisory_unlock: true }] }
      }
      assert.match(sql, /^SELECT /)
      assert.match(sql, /family\.facility_id = \$2/)
      assert.match(sql, /other\.stripe_customer_id = account\.stripe_customer_id/)
      assert.match(sql, /attempt\.attempt_type = 'member_balance_checkout'/)
      assert.match(sql, /attempt\.status = 'pending'/)
      assert.match(sql, /attempt\.expires_at > now\(\)/)
      assert.deepEqual(params, [17, 42])
      calls.push('read attempt')
      return { rows: attempts }
    },
  }
  const stripeClient = { checkout: { sessions: {
    async retrieve(id, options) {
      calls.push('retrieve session')
      assert.equal(id, 'cs_balance')
      assert.deepEqual(options, { expand: ['payment_intent'] })
      return {
        id: 'cs_balance',
        mode: 'payment',
        status: 'open',
        payment_status: 'unpaid',
        client_reference_id: 'family-billing-account:17',
        customer: 'cus_household',
        currency: 'usd',
        amount_total: 62000,
        expires_at: Math.floor(resumeNow.getTime() / 1000) + 3600,
        metadata: { checkoutType: 'outstanding_balance', familyBillingAccountId: '17', billingPaymentAttemptId: '123' },
        url: 'https://checkout.stripe.com/c/pay/cs_balance',
        payment_intent: null,
        ...sessionOverrides,
      }
    },
  } } }
  return {
    calls,
    resume: () => resumeMemberBalanceCheckout(pool, { account: resumeAccount, stripeClient, now: resumeNow }),
  }
}

test('resume reads the existing member balance Checkout under the account lock', async () => {
  const { calls, resume } = resumeFixture()
  assert.deepEqual(await resume(), { url: 'https://checkout.stripe.com/c/pay/cs_balance', amountCents: 62000 })
  assert.deepEqual(calls, ['lock', 'read attempt', 'retrieve session', 'unlock'])
})

test('resume rejects missing and ambiguous local candidates without a Stripe call', async () => {
  for (const attempts of [[], [resumeAttempt, { ...resumeAttempt, id: 124 }]]) {
    const { calls, resume } = resumeFixture({ attempts })
    await assert.rejects(resume(), { statusCode: 409 })
    assert.deepEqual(calls, ['lock', 'read attempt', 'unlock'])
  }
})

test('resume accepts a matching intent awaiting a payment method and rejects a different intent', async () => {
  const attempts = [{ ...resumeAttempt, stripe_payment_intent_id: 'pi_balance' }]
  const intent = {
    id: 'pi_balance',
    status: 'requires_payment_method',
    amount: 62000,
    amount_received: 0,
    amount_capturable: 0,
    currency: 'usd',
    customer: 'cus_household',
    metadata: { checkoutType: 'outstanding_balance', familyBillingAccountId: '17', billingPaymentAttemptId: '123' },
  }
  const matching = resumeFixture({ attempts, sessionOverrides: { payment_intent: intent } })
  assert.equal((await matching.resume()).amountCents, 62000)
  const mismatch = resumeFixture({ attempts, sessionOverrides: { payment_intent: { ...intent, id: 'pi_other' } } })
  await assert.rejects(mismatch.resume(), { statusCode: 409 })
})

test('resume rejects a stale or mismatched Checkout without changing the attempt', async () => {
  for (const sessionOverrides of [
    { id: 'cs_other' },
    { status: 'expired' },
    { payment_status: 'paid' },
    { expires_at: Math.floor(resumeNow.getTime() / 1000) },
    { amount_total: 62001 },
    { customer: 'cus_other' },
    { metadata: { checkoutType: 'outstanding_balance', familyBillingAccountId: '18', billingPaymentAttemptId: '123' } },
    { payment_intent: { status: 'processing' } },
    { payment_intent: 'pi_unexpanded' },
    { url: 'javascript:alert(1)' },
  ]) {
    const { calls, resume } = resumeFixture({ sessionOverrides })
    await assert.rejects(resume(), { statusCode: 409 })
    assert.deepEqual(calls, ['lock', 'read attempt', 'retrieve session', 'unlock'])
  }
})
