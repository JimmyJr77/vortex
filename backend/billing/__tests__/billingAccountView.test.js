import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLedgerFallback, buildBillingAccountView } from '../billingAccountView.js'

test('buildLedgerFallback combines charges, payments, and refunds with running balance', () => {
  const ledger = buildLedgerFallback({
    charges: [
      {
        id: 1,
        charge_type: 'recurring',
        member_id: 10,
        description: 'Gymnastics',
        amount_cents: 15000,
        created_at: '2026-01-05T12:00:00.000Z',
      },
    ],
    payments: [
      {
        id: 2,
        method: 'Card',
        amount_cents: 5000,
        paid_at: '2026-01-10T12:00:00.000Z',
      },
    ],
    refunds: [
      {
        id: 3,
        amountCents: 1000,
        reason: 'Overpayment',
        createdAt: '2026-01-15T12:00:00.000Z',
      },
    ],
  })

  assert.equal(ledger.length, 3)
  assert.equal(ledger[0].entryKind, 'refund')
  assert.equal(ledger[0].amountCents, 1000)
  assert.equal(ledger[0].runningBalanceCents, 11000)
  assert.equal(ledger[1].entryKind, 'payment')
  assert.equal(ledger[1].amountCents, -5000)
  assert.equal(ledger[1].runningBalanceCents, 10000)
  assert.equal(ledger[2].entryKind, 'charge')
  assert.equal(ledger[2].amountCents, 15000)
  assert.equal(ledger[2].runningBalanceCents, 15000)
})

test('buildBillingAccountView falls back when v_account_ledger is missing', async () => {
  const queries = []
  const pool = {
    query: async (text, params) => {
      queries.push(String(text))
      if (text.includes('FROM billing_charge')) {
        return {
          rows: [
            {
              id: 1,
              member_id: 5,
              charge_type: 'one_time',
              description: 'Registration fee',
              amount_cents: 5000,
              created_at: '2026-02-01T00:00:00.000Z',
            },
          ],
        }
      }
      if (text.includes('FROM billing_subscription') && text.includes("status <> 'cancelled'")) {
        return { rows: [] }
      }
      if (text.includes("status = 'cancelled'")) {
        return {
          rows: [
            {
              id: 9,
              member_id: 5,
              member_name: 'Alex Test',
              description: 'Past class',
              monthly_amount_cents: 10000,
              discount_amount_cents: 0,
              net_monthly_cents: 10000,
              status: 'cancelled',
              start_date: '2025-09-01',
              end_date: '2026-01-01',
              next_bill_date: null,
              pricing_option_key: null,
              source_type: 'scheduling_signup',
              source_id: '42',
            },
          ],
        }
      }
      if (text.includes('FROM billing_payment')) {
        return { rows: [] }
      }
      if (text.includes('FROM billing_refund')) {
        return { rows: [] }
      }
      if (text.includes('v_account_ledger')) {
        const err = new Error('relation "v_account_ledger" does not exist')
        err.code = '42P01'
        throw err
      }
      if (text.includes('member_multi_class_pass')) {
        return { rows: [] }
      }
      throw new Error(`Unexpected query: ${text}`)
    },
  }

  const view = await buildBillingAccountView(pool, { id: 1, family_id: 21 })

  assert.equal(view.charges.length, 1)
  assert.equal(view.subscriptionHistory.length, 1)
  assert.equal(view.subscriptionHistory[0].status, 'cancelled')
  assert.equal(view.ledger.length, 1)
  assert.equal(view.ledger[0].entryKind, 'charge')
  assert.equal(view.ledger[0].amountCents, 5000)
  assert.ok(queries.some((q) => q.includes('v_account_ledger')))
})

test('buildBillingAccountView tolerates missing billing_subscription table', async () => {
  const pool = {
    query: async (text) => {
      if (text.includes('FROM billing_charge')) {
        return { rows: [] }
      }
      if (text.includes('billing_subscription')) {
        const err = new Error('relation "billing_subscription" does not exist')
        err.code = '42P01'
        throw err
      }
      if (text.includes('FROM billing_payment')) {
        return { rows: [] }
      }
      if (text.includes('FROM billing_refund')) {
        return { rows: [] }
      }
      if (text.includes('v_account_ledger')) {
        return { rows: [] }
      }
      if (text.includes('member_multi_class_pass')) {
        return { rows: [] }
      }
      throw new Error(`Unexpected query: ${text}`)
    },
  }

  const view = await buildBillingAccountView(pool, { id: 2, family_id: 22 })
  assert.deepEqual(view.subscriptions, [])
  assert.deepEqual(view.subscriptionHistory, [])
  assert.equal(view.chargesCents, 0)
})
