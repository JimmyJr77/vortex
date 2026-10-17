import test from 'node:test'
import assert from 'node:assert/strict'
import { correctionPairs } from '../reassessBillingAllocations.js'
const original = {id:1,amount_cents:-562,metadata:{customerAuditVisibility:'suppressed'}}
const reversal = {id:2,amount_cents:562,related_charge_id:1,source_type:'proration_reversal',metadata:{customerAuditVisibility:'suppressed',reversesChargeId:1}}
test('automatic reassessment requires exact and unique reversal evidence, not hidden visibility', () => {
  assert.equal(correctionPairs([original,reversal]).length,1)
  assert.equal(correctionPairs([original,{...reversal,amount_cents:563}]).length,0)
  assert.equal(correctionPairs([original,{...reversal,metadata:{customerAuditVisibility:'suppressed'}}]).length,0)
  assert.equal(correctionPairs([original,reversal,{...reversal,id:3}]).length,0)
  assert.equal(correctionPairs([original,{...reversal,related_charge_id:9}]).length,0)
  assert.equal(correctionPairs([{...original,metadata:{}},reversal]).length,0)
})

import { reconcileAccountMonthlyInvoicePayments, reassessBillingAllocations } from '../reassessBillingAllocations.js'

test('refresh settles paid invoices through exact webhook mapping before allocation reassessment', async () => {
  const settled = []
  const pool = { async query(sql, args) {
    assert.deepEqual(args, [10903])
    assert.match(sql, /family_billing_account_id=\$1/)
    return { rows: [{ stripe_invoice_id: 'in_paid' }, { stripe_invoice_id: 'in_open' }] }
  } }
  const stripe = { invoices: { async retrieve(id) { return { id, status: id === 'in_paid' ? 'paid' : 'open' } } } }
  await reconcileAccountMonthlyInvoicePayments(pool, {
    accountId: 10903, stripeClient: stripe,
    async settleInvoice(db, { invoice, stripe: client }) {
      assert.equal(db, pool)
      assert.equal(client, stripe)
      settled.push(invoice.id)
      return { invoice: { status: 'paid' } }
    },
  })
  assert.deepEqual(settled, ['in_paid'])
})

test('refresh reports paid-but-conflicted mapping without collecting another payment', async () => {
  const pool = { async query() { return { rows: [{ stripe_invoice_id: 'in_paid' }] } } }
  await assert.rejects(reconcileAccountMonthlyInvoicePayments(pool, {
    accountId: 10903,
    stripeClient: { invoices: { async retrieve() { return { id: 'in_paid', status: 'paid' } } } },
    async settleInvoice() { return { conflicted: true } },
  }), /Do not submit another payment/)
})

for (const kind of ['monthly_invoice', 'payment_attempt', 'refund']) {
  test(`refresh distinguishes ${kind} from a confirmed payment`, async () => {
    const queries = []
    const pool = { async query(sql) {
      queries.push(sql)
      if (sql.includes("AS kind")) return { rows: [{ kind }] }
      return { rows: [] }
    } }
    const result = await reassessBillingAllocations(pool, { accountId: 10903 })
    assert.equal(result.corrected, false)
    assert.match(result.message, kind === 'monthly_invoice' ? /payment has not been confirmed/ : /active collection/)
    assert.equal(queries.some(sql => sql.includes('FROM billing_charge')), false)
  })
}
