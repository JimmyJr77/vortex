import test from 'node:test'
import assert from 'node:assert/strict'
import { assertNoOutstandingAnnualMembershipCharge } from '../annualMembershipChargeGuard.js'

test('an annual bill posted on an earlier date blocks a second membership purchase', async () => {
  const db = { async query(sql, values) {
    assert.deepEqual(values, [10933, 167, '1'])
    assert.match(sql, /payment.external_status IN \('settled','succeeded'\)/)
    return { rows: [{ id: 327 }] }
  } }
  await assert.rejects(assertNoOutstandingAnnualMembershipCharge(db, {
    accountId: 10933, memberId: 167, feeId: 1,
  }), { code: 'ANNUAL_MEMBERSHIP_ALREADY_BILLED', status: 409 })
})

test('no outstanding bill allows membership purchase', async () => {
  await assertNoOutstandingAnnualMembershipCharge({ async query() { return { rows: [] } } }, {
    accountId: 10933, memberId: 167, feeId: 1,
  })
})
