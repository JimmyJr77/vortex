import test from 'node:test'
import assert from 'node:assert/strict'
import {
  billingPaymentIsSettled,
  buildCanonicalFinancialSnapshot,
  canonicalRecurringBillingMonth,
  householdInvoiceReservesCollection,
  HOUSEHOLD_INVOICE_RESERVING_STATUSES,
  loadCanonicalCollectibleBalanceCents,
  loadCanonicalFinancialSnapshot,
} from '../canonicalBillingAccount.js'

test('canonical payment settlement accepts only completed lifecycle states', () => {
  assert.equal(billingPaymentIsSettled('settled'), true)
  assert.equal(billingPaymentIsSettled('SUCCEEDED'), true)
  for (const status of [null, '', 'recorded', 'pending', 'processing', 'failed', 'reconciliation_required']) {
    assert.equal(billingPaymentIsSettled(status), false, String(status))
  }
})

test('canonical billing month follows the next active collection period', () => {
  assert.equal(
    canonicalRecurringBillingMonth([
      { status: 'cancelled', next_bill_date: '2026-09-01' },
      { status: 'active', next_bill_date: '2026-10-01' },
    ], new Date('2026-08-31T12:00:00.000Z')),
    '2026-10',
  )
})

test('canonical snapshot includes a hidden corrective credit reflected by the net balance', () => {
  const snapshot = buildCanonicalFinancialSnapshot({
    totals: {
      charges_cents: 25500,
      payments_cents: 31876,
      refunds_cents: 0,
    },
    charges: [
      { id: 69, amount_cents: 8500, charge_type: 'one_time', remaining_amount_cents: 0 },
      {
        id: 70,
        amount_cents: -8500,
        charge_type: 'credit',
        related_charge_id: 69,
        credit_allocated_amount_cents: 8500,
      },
      {
        id: 139,
        amount_cents: -6376,
        charge_type: 'credit',
        metadata: { customerAuditVisibility: 'suppressed' },
      },
    ],
  })

  assert.equal(snapshot.balanceCents, -6376)
  assert.equal(snapshot.futureCreditsCents, 6376)
})

test('a posted prior-month tuition charge stays outstanding while the recurring card previews next month', () => {
  const snapshot = buildCanonicalFinancialSnapshot({
    totals: { charges_cents: 34000, payments_cents: 0, refunds_cents: 0 },
    charges: [
      {
        id: 91,
        amount_cents: 12750,
        remaining_amount_cents: 12750,
        charge_type: 'recurring',
        service_period_start: '2026-09-01',
      },
      {
        id: 92,
        amount_cents: 12750,
        remaining_amount_cents: 12750,
        charge_type: 'recurring',
        service_period_start: '2026-09-01',
      },
      { id: 93, amount_cents: 8500, remaining_amount_cents: 8500, charge_type: 'one_time' },
    ],
    recurringBillingMonth: '2026-10',
  })

  assert.equal(snapshot.outstandingBalanceCents, 34000)
  assert.equal(snapshot.futureCreditsCents, 0)
  assert.equal(snapshot.recurringBillingMonth, '2026-10')
})

test('canonical overview snapshot reads only lightweight ledger state and performs no DDL', async () => {
  const calls = []
  const pool = {
    async query(sql) {
      calls.push(sql)
      if (sql.includes('canonical-billing:financial-totals')) {
        return { rows: [{
          charges_cents: '30000',
          payments_cents: '10000',
          refunds_cents: '1000',
          paid_this_month_cents: '2500',
          revision: 'revision-1',
          latest_payment: { id: 91, amount_cents: 2500, paid_at: '2026-08-30T12:00:00Z', method: 'card' },
        }] }
      }
      if (sql.includes('canonical-billing:relevant-charges')) {
        return { rows: [
          { id: 1, amount_cents: 15000, remaining_amount_cents: 5000, charge_type: 'one_time' },
          { id: 2, amount_cents: -2000, remaining_amount_cents: 0, charge_type: 'credit' },
        ] }
      }
      if (sql.includes('canonical-billing:unapplied-payments')) {
        return { rows: [{ id: 91, amount_cents: 2500, remaining_amount_cents: 1000 }] }
      }
      if (sql.includes('canonical-billing:collectible-balance')) {
        return { rows: [{ collectible_balance_cents: '7000' }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const snapshot = await loadCanonicalFinancialSnapshot(pool, {
    accountId: 8,
    subscriptions: [{ status: 'active', next_bill_date: '2026-09-01', net_monthly_cents: 12000 }],
    asOf: new Date('2026-08-31T12:00:00.000Z'),
    recurringBillingMonth: '2026-10',
  })

  assert.deepEqual(snapshot, {
    chargesCents: 30000,
    paymentsCents: 10000,
    refundsCents: 1000,
    balanceCents: 21000,
    outstandingBalanceCents: 6000,
    currentRecurringSatisfiedCents: 0,
    futureCreditsCents: 3000,
    paidThisMonthCents: 2500,
    latestPayment: {
      id: 91,
      amountCents: 2500,
      paidAt: '2026-08-30T12:00:00Z',
      method: 'card',
    },
    revision: 'revision-1',
    recurringBillingMonth: '2026-10',
    collectibleBalanceCents: 7000,
  })
  assert.equal(calls.length, 4)
  assert.equal(calls.some((sql) => /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\b/i.test(sql)), false)
  const totalsSql = calls.find((sql) => sql.includes('canonical-billing:financial-totals'))
  const chargesSql = calls.find((sql) => sql.includes('canonical-billing:relevant-charges'))
  const paymentsSql = calls.find((sql) => sql.includes('canonical-billing:unapplied-payments'))
  assert.match(totalsSql, /payment\.external_status IN \('settled', 'succeeded'\)/)
  assert.match(chargesSql, /settled_payment\.external_status IN \('settled', 'succeeded'\)/)
  assert.match(chargesSql, /credit_source_application_totals/)
  assert.match(paymentsSql, /payment\.external_status IN \('settled', 'succeeded'\)/)
})

test('collectible balance reserves only invoices that can still collect', async () => {
  let capturedSql = ''
  let capturedParams = null
  const pool = {
    async query(sql, params) {
      capturedSql = sql
      capturedParams = params
      return { rows: [{ collectible_balance_cents: '4321' }] }
    },
  }
  assert.equal(await loadCanonicalCollectibleBalanceCents(pool, 12), 4321)
  assert.match(capturedSql, /application_kind = 'reversal'/)
  assert.match(capturedSql, /external_status IN \('settled', 'succeeded'\)/)
  assert.match(capturedSql, /invoice\.status = ANY\(\$2::text\[\]\)/)
  assert.deepEqual(capturedParams, [12, HOUSEHOLD_INVOICE_RESERVING_STATUSES])
  assert.equal(householdInvoiceReservesCollection('paid'), false)
  assert.equal(householdInvoiceReservesCollection('open'), true)
  assert.equal(householdInvoiceReservesCollection('failed'), true)
})
