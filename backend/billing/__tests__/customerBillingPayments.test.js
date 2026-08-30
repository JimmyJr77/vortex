import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createCustomerBillingCustomCharge,
  linkCustomerBillingPayment,
  previewCustomerBillingRefund,
} from '../customerBillingPayments.js'

function refundPreviewPool({ balanceCents = 2500, refundedCents = 2000, chargeAmountCents = 7000 } = {}) {
  return {
    async query(sql) {
      if (sql.includes('FROM billing_payment WHERE id')) {
        return { rows: [{ id: 9, amount_cents: 10000, stripe_payment_intent_id: 'pi_123' }] }
      }
      if (sql.includes('FROM billing_refund WHERE payment_id')) {
        return { rows: [{ cents: refundedCents }] }
      }
      if (sql.includes('AS balance_cents')) {
        return { rows: [{ balance_cents: balanceCents }] }
      }
      if (sql.includes('FROM billing_charge WHERE id')) {
        return { rows: [{ id: 4, amount_cents: chargeAmountCents, description: 'Monthly tuition' }] }
      }
      if (sql.includes("ledger_treatment = 'reverse_charge'")) {
        return { rows: [{ cents: 1000 }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
}

test('refund preview preserves account balance when a related charge is reversed', async () => {
  const preview = await previewCustomerBillingRefund(refundPreviewPool(), {
    account: { id: 1 },
    paymentId: 9,
    amountCents: 3000,
    ledgerTreatment: 'reverse_charge',
    relatedChargeId: 4,
  })
  assert.equal(preview.remainingRefundableCents, 8000)
  assert.equal(preview.currentBalanceCents, 2500)
  assert.equal(preview.resultingBalanceCents, 2500)
  assert.equal(preview.relatedCharge.id, 4)
})

test('overpayment refund cannot exceed the household credit balance', async () => {
  await assert.rejects(
    previewCustomerBillingRefund(refundPreviewPool({ balanceCents: -1500 }), {
      account: { id: 1 },
      paymentId: 9,
      amountCents: 2000,
      ledgerTreatment: 'return_overpayment',
    }),
    /unapplied overpayment/i,
  )
})

test('custom charge request keys reuse one immutable ledger charge', async () => {
  let storedCharge = null
  let activityWrites = 0
  const pool = {
    async query(sql, values) {
      if (sql.includes('SELECT * FROM family\n')) return { rows: [{ id: 44, family_name: 'Rivera' }] }
      if (sql.includes('SELECT * FROM family_billing_account')) {
        return { rows: [{ id: 7, family_id: 44 }] }
      }
      if (sql.includes('SELECT m.id FROM member')) return { rows: [{ id: 8 }] }
      if (sql.includes('INSERT INTO billing_charge')) {
        if (storedCharge) return { rows: [] }
        storedCharge = {
          id: 99,
          family_billing_account_id: 7,
          member_id: 8,
          source_type: 'manual',
          source_id: values[2],
          description: values[3],
          amount_cents: values[4],
          service_period_start: values[5],
          service_period_end: values[6],
        }
        return { rows: [storedCharge] }
      }
      if (sql.includes("WHERE family_billing_account_id = $1 AND source_type = 'manual'")) {
        return { rows: [storedCharge] }
      }
      if (sql.includes('INSERT INTO billing_account_activity')) {
        activityWrites += 1
        return { rows: [{ id: activityWrites }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const input = {
    familyId: 44,
    actorUserId: 3,
    memberId: 8,
    description: 'Private lesson',
    amountCents: 7500,
    collectionMethod: 'checkout',
    idempotencyKey: 'custom-charge:test-request-123',
  }
  const first = await createCustomerBillingCustomCharge(pool, input)
  const replay = await createCustomerBillingCustomCharge(pool, input)
  assert.equal(first.created, true)
  assert.equal(replay.created, false)
  assert.equal(replay.charge.id, first.charge.id)
  assert.equal(activityWrites, 1)
})

test('custom charges reject impossible service-period calendar dates', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('SELECT * FROM family\n')) return { rows: [{ id: 44, family_name: 'Rivera' }] }
      if (sql.includes('SELECT * FROM family_billing_account')) {
        return { rows: [{ id: 7, family_id: 44 }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  await assert.rejects(
    createCustomerBillingCustomCharge(pool, {
      familyId: 44,
      actorUserId: 3,
      description: 'Private lesson',
      amountCents: 7500,
      servicePeriodStart: '2026-02-30',
      collectionMethod: 'ledger_only',
    }),
    /valid calendar date/i,
  )
})

test('payment application rejects anything other than the exact account charge amount', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('FROM billing_charge WHERE id')) {
        return { rows: [{ id: 4, family_billing_account_id: 1, amount_cents: 7000 }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  await assert.rejects(
    linkCustomerBillingPayment(pool, {
      payment: { id: 9, family_billing_account_id: 1, amount_cents: 6500 },
      chargeId: 4,
      accountId: 1,
    }),
    /exactly match/i,
  )
})
