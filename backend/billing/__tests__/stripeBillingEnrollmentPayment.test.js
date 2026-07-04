import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveEnrollmentCheckoutPayment,
  recordEnrollmentStripePayment,
} from '../stripeBilling.js'

test('resolveEnrollmentCheckoutPayment reads payment_intent from expanded invoice', async () => {
  const stripe = {
    checkout: {
      sessions: {
        retrieve: async () => ({
          id: 'cs_test_abc',
          payment_intent: null,
          invoice: {
            id: 'in_test_1',
            payment_intent: 'pi_test_from_invoice',
          },
        }),
      },
    },
  }

  const resolved = await resolveEnrollmentCheckoutPayment(stripe, { id: 'cs_test_abc' })
  assert.equal(resolved.paymentIntentId, 'pi_test_from_invoice')
  assert.equal(resolved.invoiceId, 'in_test_1')
})

test('recordEnrollmentStripePayment inserts by checkout session when PI is absent', async () => {
  const queries = []
  const pool = {
    query: async (sql, params) => {
      queries.push(String(sql))
      if (/058_billing_stripe_links/.test(sql) || /047_stripe_billing/.test(sql)) {
        return { rows: [] }
      }
      if (/INSERT INTO billing_payment/.test(sql)) {
        return { rows: [{ id: 99, amount_cents: params[1] }] }
      }
      if (/UPDATE billing_charge/.test(sql)) {
        return { rows: [] }
      }
      return { rows: [] }
    },
  }

  const payment = await recordEnrollmentStripePayment(pool, null, {
    session: { id: 'cs_test_xyz', amount_total: 23500, customer: 'cus_1' },
    accountId: 461,
  })

  assert.ok(payment)
  assert.ok(queries.some((q) => q.includes('stripe_checkout_session_id')))
})
