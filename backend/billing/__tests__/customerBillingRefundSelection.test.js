import test from 'node:test'
import assert from 'node:assert/strict'
import { previewCustomerBillingRefund, createCustomerBillingRefund } from '../customerBillingPayments.js'
import { previewSelectedChargeRefund, createSelectedChargeRefund } from '../customerBillingRefundSelection.js'

for (const [name, submit] of [
  ['single-charge preview', previewCustomerBillingRefund],
  ['single-charge submission', createCustomerBillingRefund],
  ['selected-charge preview', previewSelectedChargeRefund],
  ['selected-charge submission', createSelectedChargeRefund],
]) {
  test(`${name} rejects retired waiver requests before database or processor access`, async () => {
    const db = {
      query() { assert.fail('An outdated refund must not access the database') },
      connect() { assert.fail('An outdated refund must not acquire a connection') },
    }
    await assert.rejects(submit(db, {
      account: { id: 1 }, paymentId: 409, amountCents: 12750,
      ledgerTreatment: 'reverse_charge', relatedChargeId: 393, relatedChargeIds: [393],
      actorUserId: 1, reason: 'Early billing', exceptionCategory: 'owner_discretion',
      evidenceNote: 'Approved', idempotencyKey: 'stale-client',
    }, { createRefundFunction() { assert.fail('Must not call the processor') } }), error => {
      assert.equal(error.statusCode, 409)
      assert.equal(error.code, 'REFUND_TREATMENT_RETIRED')
      assert.match(error.message, /Refresh the page/)
      return true
    })
  })
}
