import test from 'node:test'
import assert from 'node:assert/strict'

import { reconcileEnrollmentLedger } from '../enrollmentLedgerReconcile.js'

function pendingEnrollment() {
  return {
    id: 71,
    family_billing_account_id: 44,
    member_id: 95,
    payer_member_id: 96,
    status: 'completed',
    due_now_cents: 5100,
    checkout_mode: 'payment',
    stripe_customer_id: 'cus_family',
    stripe_checkout_session_id: 'cs_exact',
    created_at: new Date('2026-09-01T12:00:00.000Z'),
    updated_at: new Date('2026-09-01T12:05:00.000Z'),
  }
}

function reconciliationPool(pending) {
  const statements = []
  return {
    statements,
    async query(sql) {
      const text = String(sql)
      statements.push(text)
      if (text.includes('FROM billing_subscription bs') && text.includes('JOIN scheduling_signup')) {
        return { rows: [] }
      }
      if (text.includes('FROM stripe_pending_enrollment pe') && text.includes('NOT EXISTS')) {
        return { rows: [pending] }
      }
      if (text.includes('SELECT *') && text.includes('FROM stripe_pending_enrollment')) {
        return { rows: [] }
      }
      throw new Error(`Unexpected enrollment reconciliation query: ${text}`)
    },
  }
}

function exactSession(overrides = {}) {
  return {
    id: 'cs_exact',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 5100,
    currency: 'usd',
    customer: 'cus_family',
    payment_intent: 'pi_exact',
    metadata: {
      checkoutType: 'enrollment',
      pendingEnrollmentId: '71',
      familyBillingAccountId: '44',
      memberId: '95',
      payerMemberId: '96',
    },
    ...overrides,
  }
}

test('ledger repair never records a stored enrollment Session with foreign settlement identity', async () => {
  const originalWarn = console.warn
  console.warn = () => {}
  try {
    for (const mismatch of [
      { customer: 'cus_other' },
      { amount_total: 5000 },
      { currency: 'cad' },
      { id: 'cs_other' },
    ]) {
      const pending = pendingEnrollment()
      const pool = reconciliationPool(pending)
      const result = await reconcileEnrollmentLedger(pool, { id: 44 }, {
        stripeClient: {
          checkout: {
            sessions: {
              async retrieve() {
                return exactSession(mismatch)
              },
            },
          },
        },
      })

      assert.deepEqual(result, { repaired: false })
      assert.equal(
        pool.statements.some((statement) => statement.includes('INSERT INTO billing_payment')),
        false,
      )
    }
  } finally {
    console.warn = originalWarn
  }
})
