import test from 'node:test'
import assert from 'node:assert/strict'
import { beginStripeWebhookEvent, createBillingRefund } from '../stripeOperations.js'

test('webhook claim treats an already processed event as a replay', async () => {
  const pool = {
    query: async (sql) => {
      const text = String(sql)
      if (text.includes('INSERT INTO stripe_webhook_event')) return { rows: [] }
      if (text.includes('SELECT status, attempts')) return { rows: [{ status: 'processed', attempts: 2 }] }
      return { rows: [] }
    },
  }
  const result = await beginStripeWebhookEvent(pool, { id: 'evt_1', type: 'invoice.paid' })
  assert.deepEqual(result, { replayed: true, attempts: 2 })
})

test('manual refund rejects an amount above the remaining payment balance', async () => {
  const pool = {
    query: async (sql) => {
      const text = String(sql)
      if (text.includes('FROM billing_payment')) return { rows: [{ id: 8, amount_cents: 10000 }] }
      if (text.includes('SUM(amount_cents)')) return { rows: [{ cents: 4000 }] }
      return { rows: [] }
    },
  }
  await assert.rejects(
    createBillingRefund(pool, { accountId: 3, paymentId: 8, amountCents: 7000 }),
    /exceeds the remaining refundable/i,
  )
})
