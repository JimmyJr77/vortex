import test from 'node:test'
import assert from 'node:assert/strict'
import {
  beginStripeWebhookEvent,
  createBillingRefund,
  resolveStripeBillingAlert,
} from '../stripeOperations.js'

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
    createBillingRefund(pool, {
      accountId: 3, paymentId: 8, amountCents: 7000,
      exceptionCategory: 'duplicate_charge', evidenceNote: 'Payment processor shows the same charge twice.', createdByUserId: 2,
    }),
    /exceeds the remaining refundable/i,
  )
})

test('manual refund requires an approved exception, evidence, and Owner/Admin identity', async () => {
  const pool = { query: async () => ({ rows: [] }) }
  await assert.rejects(
    createBillingRefund(pool, { accountId: 3, amountCents: 1000, createdByUserId: 2 }),
    /exception category is required/i,
  )
  await assert.rejects(
    createBillingRefund(pool, { accountId: 3, amountCents: 1000, exceptionCategory: 'medical', createdByUserId: 2 }),
    /supporting evidence/i,
  )
  await assert.rejects(
    createBillingRefund(pool, { accountId: 3, amountCents: 1000, exceptionCategory: 'medical', evidenceNote: 'Doctor note on file.' }),
    /Owner\/Admin/i,
  )
})

test('billing alert resolution requires a note and authenticated actor', async () => {
  const pool = { query: async () => ({ rows: [] }) }
  await assert.rejects(
    resolveStripeBillingAlert(pool, { alertId: 3, resolutionNote: '', resolvedByUserId: 9 }),
    /resolution note is required/i,
  )
  await assert.rejects(
    resolveStripeBillingAlert(pool, { alertId: 3, resolutionNote: 'Reconciled to Stripe.', resolvedByUserId: null }),
    /resolver identity is required/i,
  )
})

test('billing alert resolution stores the actor and note', async () => {
  const calls = []
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql: String(sql), params })
      if (String(sql).includes('UPDATE stripe_billing_alert')) {
        return { rows: [{ id: 3, resolved_by_user_id: params[1], resolution_note: params[2] }] }
      }
      return { rows: [] }
    },
  }
  const resolved = await resolveStripeBillingAlert(pool, {
    alertId: 3,
    resolutionNote: '  Reconciled to Stripe and verified the ledger.  ',
    resolvedByUserId: 9,
  })
  assert.equal(resolved.resolved_by_user_id, 9)
  assert.equal(resolved.resolution_note, 'Reconciled to Stripe and verified the ledger.')
})
