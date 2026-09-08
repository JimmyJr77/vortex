import test from 'node:test'
import assert from 'node:assert/strict'
import { cancelUnpaidMembershipBills } from '../membershipTransferPendingBills.js'

function harness({ charge = {}, payment = false, credit = false, invoice = false, attempts = [], intent = {} } = {}) {
  const writes = []
  const db = { async query(sql, args) {
    if (/SELECT 1 FROM billing_payment_application/.test(sql)) return { rows: payment ? [{}] : [] }
    if (/SELECT 1 FROM billing_charge_credit_application/.test(sql)) return { rows: credit ? [{}] : [] }
    if (/SELECT 1 FROM billing_monthly_invoice_line/.test(sql)) return { rows: invoice ? [{}] : [] }
    if (/SELECT attempt/.test(sql)) return { rows: attempts }
    writes.push({ sql, args })
    return { rows: [] }
  } }
  const canceled = []
  const stripeClient = { paymentIntents: {
    async retrieve() { return { id: 'pi_failed', customer: 'cus_family', amount: 8500, amount_received: 0,
      status: 'requires_payment_method', metadata: { billingPaymentAttemptId: '10', familyBillingAccountId: '10915' }, ...intent } },
    async cancel(id) { canceled.push(id); return { status: 'canceled' } },
  } }
  const run = () => cancelUnpaidMembershipBills(db, {
    account: { id: 10915, stripe_customer_id: 'cus_family' }, candidates: [{ id: 174, amount_cents: 8500,
      adjustment_cents: 0, collection_status: 'unpaid', description: 'Annual Fee', ...charge }],
    targetMemberId: 123, actorUserId: 1, eventKey: 'recall-test', stripeClient, recall: true,
  })
  return { run, writes, canceled }
}

test('recall offsets the effective unpaid bill and retires its fee identity for rebilling', async () => {
  const h = harness({ charge: { adjustment_cents: -500 } })
  const [result] = await h.run()
  assert.equal(result.creditedAmountCents, 8000)
  const credit = h.writes.find(({ sql }) => sql.includes('INSERT INTO billing_charge'))
  assert.equal(credit.args[5], -8000)
  const original = h.writes.find(({ sql }) => sql.includes('UPDATE billing_charge'))
  assert.equal(original.args[2], 'membership_bill_recalled')
  assert.match(original.sql, /collection_status = 'none'/)
  assert.doesNotMatch(original.sql, /SET amount_cents/)
})

for (const [name, options] of Object.entries({
  paid: { payment: true }, processing: { charge: { collection_status: 'processing' } },
  credited: { credit: true }, invoiced: { invoice: true },
  'already offset': { charge: { adjustment_cents: -8500 } },
  'linked checkout': { charge: { stripe_checkout_session_id: 'cs_active' } },
})) test(`recall rejects ${name} bills before posting a credit`, async () => {
  const h = harness(options)
  await assert.rejects(h.run)
  assert.equal(h.writes.length, 0)
})

const attempt = { id: 10, amount_cents: 8500, stripe_payment_intent_id: 'pi_failed' }
test('recall cancels a verified failed Stripe attempt before posting the credit', async () => {
  const h = harness({ attempts: [attempt] })
  await h.run()
  assert.deepEqual(h.canceled, ['pi_failed'])
  assert.match(h.writes[0].sql, /UPDATE billing_payment_attempt/)
})
for (const [name, intent] of Object.entries({ succeeded: { status: 'succeeded', amount_received: 8500 },
  processing: { status: 'processing' }, 'wrong customer': { customer: 'cus_other' },
  'wrong amount': { amount: 1000 }, 'wrong owner': { metadata: {} },
})) test(`recall refuses Stripe ${name}`, async () => {
  const h = harness({ attempts: [attempt], intent })
  await assert.rejects(h.run)
  assert.equal(h.writes.length, 0)
  assert.equal(h.canceled.length, 0)
})
