import test from 'node:test'
import assert from 'node:assert/strict'
import { bindEqualValueClassTransferCheckout } from '../classTransferCheckoutBinding.js'

test('equal-value transfer preserves exact Checkout ownership without changing amounts', async () => {
  const rows = [
    { id: 1, member_id: 8, amount_cents: 9000, stripe_checkout_session_id: 'cs_1',
      metadata: { classTransfer: { replacementChargeId: 2 } } },
    { id: 2, member_id: 8, source_id: '21', amount_cents: 4500,
      metadata: { classTransfer: { sourceChargeId: 1 } } },
    { id: 3, member_id: 8, amount_cents: -4500, related_charge_id: 1,
      metadata: { adjustmentKind: 'class_swap_proration', replacementSignupId: 21 } },
  ].map((r) => ({ ...r, service_period_end: '2026-09-30' }))
  let writes = 0
  const db = { async query(sql, params) {
    if (sql.startsWith('SELECT')) return { rows }
    assert.match(sql, /SET stripe_checkout_session_id = \$3/)
    assert.deepEqual(params, [7, [2, 3], 'cs_1'])
    writes++
    return { rows: [] }
  } }
  const options = { accountId: 7, sourceChargeId: 1, replacementChargeId: 2, adjustmentChargeId: 3 }
  assert.equal((await bindEqualValueClassTransferCheckout(db, options)).bound, true)
  rows[1].amount_cents = 5000
  assert.equal((await bindEqualValueClassTransferCheckout(db, options)).bound, false)
  rows[1].amount_cents = 4500
  rows[1].stripe_checkout_session_id = 'cs_other'
  await assert.rejects(bindEqualValueClassTransferCheckout(db, options), /inconsistent/)
  rows[1].stripe_checkout_session_id = null
  rows[2].member_id = 10
  await assert.rejects(bindEqualValueClassTransferCheckout(db, options), /inconsistent/)
  assert.equal(writes, 1)
})
