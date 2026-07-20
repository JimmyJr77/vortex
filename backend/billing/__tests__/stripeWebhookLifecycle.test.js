import test from 'node:test'
import assert from 'node:assert/strict'
import {
  invoicePaymentIntentId,
  invoiceSubscriptionId,
  recordPaidStripeInvoice,
  syncStripeSubscriptionStatus,
} from '../stripeWebhookLifecycle.js'

test('extracts subscription and payment intent from current invoice shapes', () => {
  const invoice = {
    parent: { subscription_details: { subscription: 'sub_123' } },
    payments: { data: [{ payment: { type: 'payment_intent', payment_intent: 'pi_123' } }] },
  }
  assert.equal(invoiceSubscriptionId(invoice), 'sub_123')
  assert.equal(invoicePaymentIntentId(invoice), 'pi_123')
})

test('records a renewal invoice once with Stripe identifiers', async () => {
  const calls = []
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql: String(sql), params })
      if (String(sql).includes('SELECT id FROM family_billing_account')) return { rows: [{ id: 44 }] }
      if (String(sql).includes('INSERT INTO billing_payment')) {
        return { rows: [{ id: 9, family_billing_account_id: 44 }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const payment = await recordPaidStripeInvoice(pool, {
    id: 'in_renewal',
    paid: true,
    status: 'paid',
    amount_paid: 15000,
    customer: 'cus_family',
    payment_intent: 'pi_renewal',
    status_transitions: { paid_at: 1_800_000_000 },
  })
  assert.equal(payment.newly_inserted, true)
  const insert = calls.find((call) => call.sql.includes('INSERT INTO billing_payment'))
  assert.deepEqual(insert.params.slice(0, 2), [44, 15000])
  assert.match(insert.sql, /ON CONFLICT DO NOTHING/)
})

test('subscription deletion cancels matching local subscriptions', async () => {
  const calls = []
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql: String(sql), params })
      return { rows: [], rowCount: String(sql).includes('UPDATE billing_subscription') ? 2 : 0 }
    },
  }
  const result = await syncStripeSubscriptionStatus(
    pool,
    { id: 'sub_ended', status: 'canceled', ended_at: 1_800_000_000 },
    'customer.subscription.deleted',
  )
  assert.deepEqual(result, { updated: 2, status: 'cancelled' })
  assert.ok(calls.some((call) => call.sql.includes('UPDATE billing_subscription')))
})
