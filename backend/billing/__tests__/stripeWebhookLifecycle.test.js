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
    parent: { subscription_details: { subscription: 'sub_renewal' } },
    status_transitions: { paid_at: 1_800_000_000 },
  })
  assert.equal(payment.newly_inserted, true)
  const insert = calls.find((call) => call.sql.includes('INSERT INTO billing_payment'))
  assert.deepEqual(insert.params.slice(0, 4), [44, 15000, insert.params[2], 'Card'])
  assert.equal(insert.params[7], 'sub_renewal')
  assert.match(insert.sql, /stripe_subscription_id/)
  assert.match(insert.sql, /ON CONFLICT DO NOTHING/)
})

test('replayed invoice webhook returns its existing payment for idempotent line allocation', async () => {
  const pool = {
    query: async (sql) => {
      if (String(sql).includes('SELECT id FROM family_billing_account')) return { rows: [{ id: 44 }] }
      if (String(sql).includes('INSERT INTO billing_payment')) return { rows: [], rowCount: 0 }
      if (String(sql).includes('SELECT * FROM billing_payment WHERE stripe_invoice_id')) {
        return { rows: [{ id: 9, family_billing_account_id: 44, stripe_invoice_id: 'in_renewal' }] }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const payment = await recordPaidStripeInvoice(pool, {
    id: 'in_renewal', paid: true, status: 'paid', amount_paid: 15000,
    customer: 'cus_family', payment_intent: 'pi_renewal',
  })
  assert.equal(payment.id, 9)
  assert.equal(payment.newly_inserted, false)
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
  const update = calls.find((call) => call.sql.includes('auto_renewal = $4'))
  assert.ok(update)
  assert.equal(update.params[3], false)
})

test('scheduled cancellation disables renewal without ending paid-through access', async () => {
  const calls = []
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql: String(sql), params })
      return { rows: [], rowCount: String(sql).includes('UPDATE billing_subscription') ? 1 : 0 }
    },
  }
  const result = await syncStripeSubscriptionStatus(
    pool,
    {
      id: 'sub_ending_later',
      status: 'active',
      cancel_at_period_end: true,
      cancel_at: 1_830_297_600,
      current_period_end: 1_830_297_600,
    },
    'customer.subscription.updated',
  )

  assert.deepEqual(result, { updated: 1, status: 'active' })
  const update = calls.find((call) => call.sql.includes('UPDATE billing_subscription'))
  assert.match(update.sql, /auto_renewal = \$4/)
  assert.deepEqual(update.params, [
    'sub_ending_later',
    'active',
    1_830_297_600,
    false,
    1_830_297_600,
  ])
})
