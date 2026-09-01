import test from 'node:test'
import assert from 'node:assert/strict'
import {
  beginBillingAdminAction,
  finishBillingAdminAction,
  listBillingAdminActions,
} from '../billingAdminActions.js'

test('billing admin actions preserve actor, related records, and completion outcome', async () => {
  const calls = []
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql, params })
      if (sql.includes('INSERT INTO billing_admin_action')) return { rows: [{ id: 41, status: 'processing' }] }
      if (sql.includes('UPDATE billing_admin_action')) return { rows: [{ id: 41, status: params[1] }] }
      return { rows: [{ id: 41, action_type: 'payment_receipt_resent' }] }
    },
  }

  const action = await beginBillingAdminAction(pool, {
    accountId: 7,
    actionType: 'payment_receipt_resent',
    amountCents: 2500,
    paymentId: 19,
    initiatedByUserId: 3,
  })
  assert.equal(action.id, 41)
  const insert = calls.find((call) => call.sql.includes('INSERT INTO billing_admin_action'))
  assert.equal(insert.params[0], 7)
  assert.equal(insert.params[5], 19)
  assert.equal(insert.params[7], 3)

  const finished = await finishBillingAdminAction(pool, 41, { status: 'succeeded' })
  assert.equal(finished.status, 'succeeded')
  const listed = await listBillingAdminActions(pool, 7)
  assert.equal(listed[0].action_type, 'payment_receipt_resent')
  assert.equal(calls.some(({ sql }) => /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|INDEX)/i.test(sql)), false)
})
