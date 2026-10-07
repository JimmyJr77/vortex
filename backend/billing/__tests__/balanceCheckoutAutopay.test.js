import test from 'node:test'
import assert from 'node:assert/strict'
import { completeBalanceCheckoutAutopay } from '../balanceCheckoutAutopay.js'

function fixture() {
  const intent = { id: 'pi_balance', status: 'succeeded', setup_future_usage: 'off_session',
    customer: 'cus_family', payment_method: { id: 'pm_saved' }, amount_received: 10000, currency: 'usd' }
  const session = { id: 'cs_balance', mode: 'payment', status: 'complete', payment_status: 'paid',
    customer: 'cus_family', payment_intent: intent, amount_total: 10000, currency: 'usd',
    metadata: { checkoutType: 'outstanding_balance', balanceAutopayConsent: 'v1',
      familyBillingAccountId: '44', billingPaymentAttemptId: '73' } }
  const attempt = { id: 73, family_billing_account_id: 44, billing_payment_id: 91,
    status: 'succeeded', amount_cents: 10000, stripe_checkout_session_id: 'cs_balance',
    paid_customer_id: 'cus_family', paid_intent_id: 'pi_balance', paid_session_id: 'cs_balance', paid_amount_cents: 10000,
    metadata: { savePaymentMethodForAutopay: true, autopayConsentVersion: 'v1', autopayConsentAt: '2026-10-06T12:00:00Z' } }
  const account = { id: 44, is_active: true, stripe_customer_id: 'cus_family', stripe_customer_owner_count: 1 }
  const method = { id: 'pm_saved', customer: 'cus_family', type: 'card' }
  const updates = []; const activities = []; const queries = []
  const db = { query: async (sql, args = []) => {
    queries.push(sql)
    if (sql.includes('balance-checkout-autopay:settled-attempt')) return { rows: [attempt] }
    if (sql.includes('stripe-enrollment-payment-method:canonical-account')) return { rows: [account] }
    if (sql.includes('INSERT INTO billing_account_activity')) { activities.push(args); return { rows: [{ id: 1 }] } }
    if (sql.includes('UPDATE billing_payment_attempt')) attempt.metadata.balanceAutopayCompleted = true
    if (sql.includes('pg_advisory_') || ['BEGIN','COMMIT','ROLLBACK'].includes(sql) || sql.includes('UPDATE billing_payment_attempt')) return { rows: [{}] }
    assert.fail(`Unexpected database operation: ${sql}`)
  } }
  const stripe = { checkout: { sessions: { retrieve: async () => session } },
    customers: { retrieve: async () => ({ id: 'cus_family', metadata: { familyBillingAccountId: '44' } }),
      update: async (...args) => { updates.push(args); return { id: 'cus_family' } } },
    paymentMethods: { retrieve: async () => method } }
  return { db, stripe, session, intent, attempt, account, method, updates, activities, queries }
}

test('unchecked and older balance Checkouts do not change autopay or touch Stripe', async () => {
  const db = { query: () => assert.fail('No database mutation for absent consent') }
  for (const metadata of [{}, { checkoutType: 'outstanding_balance' }, { checkoutType: 'custom_charge', balanceAutopayConsent: 'v1' }]) {
    assert.deepEqual(await completeBalanceCheckoutAutopay(db, { session: { metadata }, stripe: {} }), { saved: false })
  }
})

for (const type of ['card', 'link']) test(`paid balance saves the consented ${type} once without collecting more money`, async () => {
  const f = fixture(); f.method.type = type
  assert.deepEqual(await completeBalanceCheckoutAutopay(f.db, f), { saved: true, paymentMethodId: 'pm_saved' })
  assert.deepEqual(f.updates, [['cus_family', { invoice_settings: { default_payment_method: 'pm_saved' } },
    { idempotencyKey: 'balance-checkout-autopay:73:v1' }]])
  assert.equal(f.activities.length, 1)
  assert.deepEqual(await completeBalanceCheckoutAutopay(f.db, f), { saved: true, replayed: true })
  assert.equal(f.updates.length, 1)
  assert.equal(f.activities.length, 1)
})

for (const [name, change] of [
  ['unsettled local attempt', f => { f.attempt.status = 'pending' }],
  ['missing recorded consent', f => { f.attempt.metadata.savePaymentMethodForAutopay = false }],
  ['wrong local Checkout', f => { f.attempt.paid_session_id = 'cs_other' }],
  ['unpaid Checkout', f => { f.session.payment_status = 'unpaid' }],
  ['incomplete Checkout', f => { f.session.status = 'open' }],
  ['wrong account', f => { f.session.metadata.familyBillingAccountId = '45' }],
  ['wrong payment intent', f => { f.intent.id = 'pi_other' }],
  ['processing payment', f => { f.intent.status = 'processing' }],
  ['no future payment setup', f => { f.intent.setup_future_usage = null }],
  ['incorrect received amount', f => { f.intent.amount_received = 9999 }],
  ['wrong saved-method owner', f => { f.method.customer = 'cus_other' }],
  ['ambiguous local customer', f => { f.account.stripe_customer_owner_count = 2 }],
]) test(`autopay rejects ${name} before updating the default`, async () => {
  const f = fixture(); const eventSession = structuredClone(f.session); change(f)
  await assert.rejects(completeBalanceCheckoutAutopay(f.db, { session: eventSession, stripe: f.stripe }))
  assert.equal(f.updates.length, 0)
  assert.equal(f.activities.length, 0)
})

test('failed default-method update leaves completion retryable', async () => {
  const f = fixture(); f.stripe.customers.update = async () => { throw new Error('Stripe unavailable') }
  await assert.rejects(completeBalanceCheckoutAutopay(f.db, f), /Stripe unavailable/)
  assert.equal(f.attempt.metadata.balanceAutopayCompleted, undefined)
  assert.equal(f.activities.length, 0)
})
