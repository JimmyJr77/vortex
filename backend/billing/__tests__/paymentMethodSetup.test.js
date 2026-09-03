import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildPaymentMethodSetupCheckoutParams,
  completePaymentMethodSetupSession,
} from '../stripeBilling.js'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))

function canonicalSetupSession() {
  return {
    id: 'cs_setup_44',
    mode: 'setup',
    status: 'complete',
    customer: 'cus_family',
    metadata: { checkoutType: 'payment_method_update', familyBillingAccountId: '44' },
    setup_intent: {
      id: 'seti_44',
      status: 'succeeded',
      customer: 'cus_family',
      payment_method: { id: 'pm_44' },
    },
  }
}

test('payment-method links use subscription-incapable Checkout setup mode', () => {
  const params = buildPaymentMethodSetupCheckoutParams({
    accountId: 44,
    customerId: 'cus_family',
    returnUrl: 'https://example.test/?billing=portal-return',
  })
  assert.equal(params.mode, 'setup')
  assert.equal(params.customer, 'cus_family')
  assert.deepEqual(params.payment_method_types, ['card'])
  assert.equal(params.metadata.checkoutType, 'payment_method_update')
  assert.equal(params.metadata.familyBillingAccountId, '44')
  assert.equal(Object.hasOwn(params, 'line_items'), false)
  assert.equal(Object.hasOwn(params, 'subscription_data'), false)

  const source = fs.readFileSync(path.join(testDirectory, '../stripeBilling.js'), 'utf8')
  assert.doesNotMatch(source, /billingPortal\.sessions\.create/)
})

test('completed setup session promotes only the canonical customer card', async () => {
  const calls = []
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('pg_advisory_lock')) return { rows: [{ pg_advisory_lock: null }] }
      if (text.includes('pg_advisory_unlock')) return { rows: [{ pg_advisory_unlock: true }] }
      if (text.includes('FROM family_billing_account')) {
        return {
          rows: [{
            id: 44,
            stripe_customer_id: 'cus_family',
            stripe_customer_owner_count: 1,
            is_active: true,
          }],
        }
      }
      throw new Error(`Unexpected setup query: ${text}`)
    },
  }
  const stripeCalls = []
  const stripe = {
    checkout: {
      sessions: {
        async retrieve(id, options) {
          stripeCalls.push({ operation: 'retrieve', id, options })
          return {
            id,
            mode: 'setup',
            status: 'complete',
            customer: 'cus_family',
            metadata: { checkoutType: 'payment_method_update', familyBillingAccountId: '44' },
            setup_intent: {
              id: 'seti_44',
              status: 'succeeded',
              customer: 'cus_family',
              payment_method: { id: 'pm_44' },
            },
          }
        },
      },
    },
    customers: {
      async retrieve(id) {
        stripeCalls.push({ operation: 'customer-retrieve', id })
        return { id, deleted: false, metadata: { familyBillingAccountId: '44' } }
      },
      async update(id, payload) {
        stripeCalls.push({ operation: 'update', id, payload })
        return { id }
      },
    },
    paymentMethods: {
      async retrieve(id) {
        stripeCalls.push({ operation: 'payment-method-retrieve', id })
        return { id, customer: 'cus_family', type: 'card' }
      },
    },
  }
  const session = {
    id: 'cs_setup_44',
    mode: 'setup',
    status: 'complete',
    customer: 'cus_family',
    metadata: { checkoutType: 'payment_method_update', familyBillingAccountId: '44' },
  }

  const result = await completePaymentMethodSetupSession(pool, { session, stripe })

  assert.deepEqual(result, {
    accountId: 44,
    customerId: 'cus_family',
    paymentMethodId: 'pm_44',
  })
  assert.deepEqual(stripeCalls.at(-1), {
    operation: 'update',
    id: 'cus_family',
    payload: { invoice_settings: { default_payment_method: 'pm_44' } },
  })
  assert.ok(calls.some(({ text }) => text.includes('pg_advisory_lock')))
  assert.equal(calls.some(({ text }) => /^(BEGIN|COMMIT|ROLLBACK)$/.test(text)), false)
})

test('setup completion fails closed when the session customer is not the account customer', async () => {
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock')) return { rows: [{ pg_advisory_lock: null }] }
      if (text.includes('pg_advisory_unlock')) return { rows: [{ pg_advisory_unlock: true }] }
      if (text.includes('FROM family_billing_account')) {
        return {
          rows: [{
            id: 44,
            stripe_customer_id: 'cus_expected',
            stripe_customer_owner_count: 1,
            is_active: true,
          }],
        }
      }
      throw new Error(`Unexpected setup mismatch query: ${text}`)
    },
  }
  let updated = false
  const stripe = {
    checkout: { sessions: { async retrieve() { throw new Error('must not retrieve') } } },
    customers: {
      async retrieve() { throw new Error('must not retrieve') },
      async update() { updated = true },
    },
    paymentMethods: { async retrieve() { throw new Error('must not retrieve') } },
  }

  await assert.rejects(
    completePaymentMethodSetupSession(pool, {
      stripe,
      session: {
        id: 'cs_wrong',
        mode: 'setup',
        status: 'complete',
        customer: 'cus_wrong',
        metadata: { checkoutType: 'payment_method_update', familyBillingAccountId: '44' },
      },
    }),
    (error) => error?.code === 'STRIPE_CUSTOMER_RECONCILIATION_REQUIRED',
  )
  assert.equal(updated, false)
})

test('setup completion rejects a Stripe customer shared by multiple local billing accounts', async () => {
  let stripeReads = 0
  let updated = false
  const queries = []
  const pool = {
    async query(sql) {
      const text = String(sql)
      queries.push(text)
      if (text.includes('pg_advisory_lock')) return { rows: [{}] }
      if (text.includes('pg_advisory_unlock')) return { rows: [{ pg_advisory_unlock: true }] }
      if (text.includes('FROM family_billing_account')) {
        return {
          rows: [{
            id: 44,
            stripe_customer_id: 'cus_family',
            stripe_customer_owner_count: 2,
            is_active: true,
          }],
        }
      }
      throw new Error(`Unexpected duplicate-owner query: ${text}`)
    },
  }
  const stripe = {
    checkout: { sessions: { async retrieve() { stripeReads += 1 } } },
    customers: {
      async retrieve() { stripeReads += 1 },
      async update() { updated = true },
    },
    paymentMethods: { async retrieve() { stripeReads += 1 } },
  }

  await assert.rejects(
    completePaymentMethodSetupSession(pool, {
      stripe,
      session: canonicalSetupSession(),
    }),
    (error) => (
      error?.code === 'STRIPE_CUSTOMER_RECONCILIATION_REQUIRED'
      && /linked to 2 local billing accounts/.test(error.message)
    ),
  )
  assert.equal(stripeReads, 0)
  assert.equal(updated, false)
  const ownershipQuery = queries.find((sql) => /stripe_customer_owner_count/.test(sql))
  assert.doesNotMatch(ownershipQuery, /customer_owner\.is_active/)
})

test('setup completion rejects a canonical Stripe customer with foreign ownership metadata', async () => {
  let updated = false
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock')) return { rows: [{}] }
      if (text.includes('pg_advisory_unlock')) return { rows: [{ pg_advisory_unlock: true }] }
      if (text.includes('FROM family_billing_account')) {
        return {
          rows: [{
            id: 44,
            stripe_customer_id: 'cus_family',
            stripe_customer_owner_count: 1,
            is_active: true,
          }],
        }
      }
      throw new Error(`Unexpected foreign-owner query: ${text}`)
    },
  }
  const stripe = {
    checkout: { sessions: { async retrieve() { return canonicalSetupSession() } } },
    customers: {
      async retrieve() {
        return {
          id: 'cus_family',
          deleted: false,
          metadata: { familyBillingAccountId: '99' },
        }
      },
      async update() { updated = true },
    },
    paymentMethods: {
      async retrieve() { throw new Error('must not retrieve a method for a foreign customer') },
    },
  }

  await assert.rejects(
    completePaymentMethodSetupSession(pool, {
      stripe,
      session: canonicalSetupSession(),
    }),
    (error) => (
      error?.code === 'STRIPE_CUSTOMER_RECONCILIATION_REQUIRED'
      && /remote customer identity or account metadata/.test(error.message)
    ),
  )
  assert.equal(updated, false)
})
