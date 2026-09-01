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
        return { rows: [{ id: 44, stripe_customer_id: 'cus_family', is_active: true }] }
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
      async update(id, payload) {
        stripeCalls.push({ operation: 'update', id, payload })
        return { id }
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
})

test('setup completion fails closed when the session customer is not the account customer', async () => {
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock')) return { rows: [{ pg_advisory_lock: null }] }
      if (text.includes('pg_advisory_unlock')) return { rows: [{ pg_advisory_unlock: true }] }
      if (text.includes('FROM family_billing_account')) {
        return { rows: [{ id: 44, stripe_customer_id: 'cus_expected', is_active: true }] }
      }
      throw new Error(`Unexpected setup mismatch query: ${text}`)
    },
  }
  let updated = false
  const stripe = {
    checkout: { sessions: { async retrieve() { throw new Error('must not retrieve') } } },
    customers: { async update() { updated = true } },
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
