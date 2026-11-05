import test from 'node:test'
import assert from 'node:assert/strict'
import { loadDefaultPaymentMethodSummary } from '../customerBillingQueries.js'
import { resolveDefaultPaymentMethod } from '../customerBillingPayments.js'
import {
  stripeCustomerProjectionSummary, refreshStripeCustomerProjection,
  refreshStripeCustomerProjectionForEvent, reconcileStripeCustomerProjections,
} from '../stripeCustomerProjection.js'

const account = { id: 44, stripe_customer_id: 'cus_family', stripe_customer_owner_count: 1 }
const method = { id: 'pm_default', customer: 'cus_family', type: 'card', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2035 } }
const snapshot = {
  family_billing_account_id: 44, stripe_customer_id: 'cus_family', stripe_payment_method_id: 'pm_default',
  payment_method_type: 'card', payment_method_brand: 'visa', payment_method_last4: '4242',
  payment_method_exp_month: 12, payment_method_exp_year: 2035,
  sync_status: 'synced', synced_at: '2026-11-01T12:00:00Z',
}

function fixture({ owners = [{ id: 44 }], row = null, customer = null } = {}) {
  let stored = row
  let locked = false
  const calls = []
  const stripe = { customers: { retrieve: async (id) => {
    assert.equal(locked, true, 'retrieve must run while holding the account lock')
    calls.push({ remote: id })
    return customer ?? { id, invoice_settings: { default_payment_method: method } }
  } } }
  const db = { async query(sql, params = []) {
    const text = String(sql)
    calls.push({ text, params })
    if (text.includes('pg_advisory_unlock')) { locked = false; return { rows: [{ pg_advisory_unlock: true }] } }
    if (text.includes('pg_advisory_lock')) { locked = true; return { rows: [] } }
    if (text.includes('stripe-projection:owners')) return { rows: owners }
    if (text.includes('SELECT DISTINCT stripe_customer_id')) return { rows: stored ? [{ stripe_customer_id: stored.stripe_customer_id }] : [] }
    if (text.includes('stripe_billing_alert')) return { rows: [] }
    if (text.includes('SELECT * FROM stripe_customer_projection')) return { rows: stored ? [stored] : [] }
    if (text.includes('INSERT INTO stripe_customer_projection') && text.includes("'failed'")) {
      stored = { ...stored, sync_status: 'failed', last_error: params[2] }
      return { rows: [] }
    }
    if (text.includes('INSERT INTO stripe_customer_projection')) {
      stored = { ...snapshot, stripe_payment_method_id: params[3], payment_method_last4: params[6] }
      return { rows: [stored] }
    }
    throw new Error(`Unexpected query ${text}`)
  } }
  return { db, stripe, calls, row: () => stored }
}

test('routine payment-method summaries query local data even with Stripe enabled', async () => {
  const previous = { enabled: process.env.STRIPE_ENABLED, key: process.env.STRIPE_SECRET_KEY }
  process.env.STRIPE_ENABLED = 'true'
  process.env.STRIPE_SECRET_KEY = 'sk_test_projection_display_only'
  try {
    const { db, calls } = fixture({ row: snapshot })
    const result = await loadDefaultPaymentMethodSummary(account, { pool: db, billingMonth: '2026-11' })
    assert.equal(result.paymentMethod.id, 'pm_default')
    assert.equal(result.available, true)
    assert.equal(calls.length, 1)
    assert.match(calls[0].text, /SELECT \* FROM stripe_customer_projection/)
  } finally {
    if (previous.enabled == null) delete process.env.STRIPE_ENABLED
    else process.env.STRIPE_ENABLED = previous.enabled
    if (previous.key == null) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = previous.key
  }
})

test('unknown, failed, and stale sync states remain distinct from a verified absent card', () => {
  const options = { billingMonth: '2026-11', now: new Date('2026-11-02T00:00:00Z') }
  assert.equal(stripeCustomerProjectionSummary(account, null, options).syncStatus, 'pending')
  const failed = stripeCustomerProjectionSummary(account, { ...snapshot, sync_status: 'failed', last_error: 'timeout' }, options)
  assert.equal(failed.syncStatus, 'failed')
  assert.equal(failed.paymentMethod.last4, '4242')
  assert.equal(failed.available, true)
  const stale = stripeCustomerProjectionSummary(account, snapshot, { ...options, now: new Date('2026-11-04') })
  assert.equal(stale.syncStatus, 'stale')
  assert.equal(stale.paymentMethod.last4, '4242')
  const absent = stripeCustomerProjectionSummary(account, { ...snapshot, stripe_payment_method_id: null }, options)
  assert.equal(absent.syncStatus, 'current')
  assert.equal(absent.paymentMethod, null)
})

test('a stale known card never substitutes for current collection readiness', async () => {
  const stale = stripeCustomerProjectionSummary(account, snapshot, {
    billingMonth: '2026-11', now: new Date('2026-11-04'),
  })
  assert.equal(stale.syncStatus, 'stale')
  assert.equal(stale.available, true)
  let currentReads = 0
  const stripe = {
    customers: { async retrieve(id) {
      assert.equal(id, account.stripe_customer_id)
      currentReads += 1
      return { id, invoice_settings: { default_payment_method: null } }
    } },
    paymentMethods: { async list() { assert.fail('must not use an arbitrary attached card') } },
  }
  await assert.rejects(
    resolveDefaultPaymentMethod(stripe, account.stripe_customer_id, { billingMonth: '2026-11' }),
    error => error.code === 'STRIPE_PAYMENT_METHOD_NOT_READY'
      && error.paymentMethodReadinessReason === 'payment_method_required',
  )
  assert.equal(currentReads, 1)
})

test('projection reads hide foreign mappings and recompute expiry for the requested billing month', () => {
  for (const row of [{ ...snapshot, stripe_customer_id: 'cus_foreign' }, { ...snapshot, family_billing_account_id: 99 }]) {
    assert.equal(stripeCustomerProjectionSummary(account, row).paymentMethod, null)
  }
  assert.equal(stripeCustomerProjectionSummary({ ...account, stripe_customer_owner_count: 2 }, snapshot).reconciliationRequired, true)
  assert.equal(stripeCustomerProjectionSummary(account, snapshot, { billingMonth: '2036-01' }).available, false)
})

test('refresh stores only redacted allowlisted data from the current default under its lock', async () => {
  const sensitive = { ...method, billing_details: { email: 'private@example.test', address: 'private address' },
    card: { ...method.card, number: '4242424242424242', cvc: '999' } }
  const { db, stripe, calls } = fixture({ customer: { id: 'cus_family', invoice_settings: { default_payment_method: sensitive } } })
  await refreshStripeCustomerProjection(db, stripe, { customerId: 'cus_family', accountId: 44 })
  const insert = calls.find((call) => call.text?.includes('INSERT INTO stripe_customer_projection'))
  assert.deepEqual(insert.params.slice(0, 10), [44, 'cus_family', false, 'pm_default', 'card', 'visa', '4242', 12, 2035, null])
  assert.doesNotMatch(JSON.stringify(insert.params), /4242424242424242|999|private@example|private address/)
})

test('ambiguous customer ownership never requests Stripe or writes a projection', async () => {
  const { db, stripe, calls } = fixture({ owners: [{ id: 44 }, { id: 77 }] })
  await assert.rejects(refreshStripeCustomerProjection(db, stripe, { customerId: 'cus_family' }), /one exact local account owner/)
  assert.equal(calls.some((call) => call.remote || call.text?.includes('INSERT')), false)
})

test('foreign current customer or payment method cannot replace a successful snapshot', async () => {
  for (const customer of [
    { id: 'cus_other' },
    { id: 'cus_family', metadata: { familyBillingAccountId: '77' } },
    { id: 'cus_family', invoice_settings: { default_payment_method: { ...method, customer: 'cus_other' } } },
  ]) {
    const context = fixture({ row: snapshot, customer })
    await assert.rejects(refreshStripeCustomerProjection(context.db, context.stripe, { customerId: 'cus_family' }))
    assert.equal(context.row().sync_status, 'failed')
    assert.equal(context.row().stripe_payment_method_id, 'pm_default')
    assert.equal(context.calls.some((call) => call.text?.includes("sync_status='synced'")), false)
  }
})

test('transient failure retains the old display and retries the same customer successfully', async () => {
  const context = fixture({ row: snapshot })
  const retrieve = context.stripe.customers.retrieve
  context.stripe.customers.retrieve = async () => { throw Object.assign(new Error('temporary failure'), { code: 'ETIMEDOUT' }) }
  await assert.rejects(refreshStripeCustomerProjection(context.db, context.stripe, { customerId: 'cus_family' }), /temporary failure/)
  assert.equal(context.row().sync_status, 'failed')
  assert.equal(context.row().stripe_payment_method_id, 'pm_default')
  context.stripe.customers.retrieve = retrieve
  await refreshStripeCustomerProjection(context.db, context.stripe, { customerId: 'cus_family' })
  assert.equal(context.row().sync_status, 'synced')
})

test('a retrieved method must match the configured default even within the same customer', async () => {
  const context = fixture({ row: snapshot, customer: {
    id: 'cus_family', invoice_settings: { default_payment_method: 'pm_configured' },
  } })
  context.stripe.paymentMethods = { retrieve: async () => method }
  await assert.rejects(refreshStripeCustomerProjection(context.db, context.stripe, { customerId: 'cus_family' }), /exact configured default/)
  assert.equal(context.row().stripe_payment_method_id, 'pm_default')
  assert.equal(context.row().sync_status, 'failed')
})

test('delayed detached-method event resolves its owner and fetches the current default', async () => {
  const context = fixture({ row: snapshot })
  await refreshStripeCustomerProjectionForEvent(context.db, context.stripe, {
    id: 'evt_detached', type: 'payment_method.detached', data: { object: { id: 'pm_previous', customer: null } },
  })
  assert.equal(context.row().stripe_payment_method_id, 'pm_default')
  assert.equal(context.calls.filter((call) => call.remote === 'cus_family').length, 1)
})

test('projection reconciliation pages accounts and retains per-account failures for the next run', async () => {
  const checked = []
  const db = { async query(sql, params) {
    assert.match(sql, /LIMIT 100/)
    return { rows: params[0] === 0 ? [{ id: 44, stripe_customer_id: 'cus_family' }, { id: 77, stripe_customer_id: 'cus_retry' }] : [] }
  } }
  const result = await reconcileStripeCustomerProjections(db, {}, { refresh: async (_, __, { accountId }) => {
    checked.push(accountId)
    if (accountId === 77) throw new Error('retry later')
  } })
  assert.deepEqual(checked, [44, 77])
  assert.deepEqual(result, { checked: 2, synced: 1, failed: 1 })
})
