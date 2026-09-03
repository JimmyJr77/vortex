import test from 'node:test'
import assert from 'node:assert/strict'

import {
  listBillingAnomalies,
  mapBillingAnomaly,
  summarizeBillingAnomalies,
} from '../billingAnomalies.js'

test('billing anomaly mapper normalizes ledger rows and preserves review details', () => {
  assert.deepEqual(mapBillingAnomaly({
    anomaly_id: 'unpaid:7',
    anomaly_type: 'unpaid_account',
    severity: 'high',
    family_id: '41',
    billing_account_id: '7',
    family_name: 'Rivera Family',
    payer_name: 'Sam Rivera',
    amount_cents: '24500',
    item_count: '2',
    occurred_at: '2026-09-02T17:00:00.000Z',
    summary: 'Unpaid account balance',
    detail: '2 charges still have an outstanding balance.',
  }), {
    id: 'unpaid:7',
    type: 'unpaid_account',
    severity: 'high',
    familyId: 41,
    billingAccountId: 7,
    familyName: 'Rivera Family',
    payerName: 'Sam Rivera',
    amountCents: 24500,
    itemCount: 2,
    occurredAt: '2026-09-02T17:00:00.000Z',
    summary: 'Unpaid account balance',
    detail: '2 charges still have an outstanding balance.',
  })
})

test('billing anomaly summary counts all supported views without inflating unknown types', () => {
  const summary = summarizeBillingAnomalies([
    { type: 'unpaid_account', severity: 'high', amountCents: 18000 },
    { type: 'duplicate_payment', severity: 'medium', amountCents: 9500 },
    { type: 'account_credit', severity: 'low', amountCents: 2500 },
    { type: 'unexpected', severity: 'unexpected', amountCents: 999 },
  ])

  assert.equal(summary.total, 4)
  assert.equal(summary.totalAmountCents, 30999)
  assert.equal(summary.byType.unpaid_account, 1)
  assert.equal(summary.byType.duplicate_payment, 1)
  assert.equal(summary.byType.excessive_discount, 0)
  assert.equal(summary.byType.failed_collection, 0)
  assert.equal(summary.byType.account_credit, 1)
  assert.deepEqual(summary.bySeverity, { high: 1, medium: 1, low: 1 })
})

test('anomaly scan is constrained to the passed facility and evaluates canonical ledger signals', async () => {
  let captured = null
  const pool = {
    async query(sql, params) {
      captured = { sql: String(sql), params }
      return {
        rows: [{
          anomaly_id: 'discount:12',
          anomaly_type: 'excessive_discount',
          severity: 'medium',
          family_id: 4,
          billing_account_id: 8,
          family_name: 'Lopez Family',
          payer_name: 'Jordan Lopez',
          amount_cents: 3000,
          item_count: 1,
          occurred_at: '2026-09-01T12:00:00.000Z',
          summary: 'Large discount applied',
          detail: 'Discount is 60% of the listed charge.',
        }],
      }
    },
  }

  const result = await listBillingAnomalies(pool, { facilityId: 17 })

  assert.deepEqual(captured.params, [17])
  assert.match(captured.sql, /family\.facility_id = \$1/)
  assert.match(captured.sql, /payment\.external_status IN \('settled', 'succeeded'\)/)
  assert.match(captured.sql, /source_type IN \('charge_adjustment', 'refund_offset'\)/)
  assert.match(captured.sql, /credit_source\.related_charge_id = target_line\.billing_charge_id/)
  assert.match(captured.sql, /credit_source\.source_type IN \('charge_adjustment', 'refund_offset'\)/)
  assert.match(captured.sql, /charge\.source_type NOT IN \('charge_adjustment', 'refund_offset'\)/)
  assert.match(captured.sql, /'unpaid_account'::text/)
  assert.match(captured.sql, /'duplicate_payment'::text/)
  assert.match(captured.sql, /adjacent_day_stripe_split_payment AS/)
  assert.match(captured.sql, /invoice_payment\.stripe_invoice_id IS NOT NULL/)
  assert.match(captured.sql, /invoice_payment\.stripe_payment_intent_id IS NULL/)
  assert.match(captured.sql, /intent_payment\.stripe_invoice_id IS NULL/)
  assert.match(captured.sql, /intent_payment\.stripe_payment_intent_id IS NOT NULL/)
  assert.match(captured.sql, /intent_payment\.stripe_customer_id = invoice_payment\.stripe_customer_id/)
  assert.match(captured.sql, /\) <= 1/)
  assert.match(captured.sql, /\) <= 172800/)
  assert.match(captured.sql, /Review Stripe Invoice Payment evidence before treating them as one payment/)
  assert.match(captured.sql, /'excessive_discount'::text/)
  assert.match(captured.sql, /'failed_collection'::text/)
  assert.match(captured.sql, /'account_credit'::text/)
  assert.deepEqual(result.summary.byType, {
    unpaid_account: 0,
    duplicate_payment: 0,
    excessive_discount: 1,
    failed_collection: 0,
    account_credit: 0,
  })
  assert.equal(result.anomalies[0].familyId, 4)
})
