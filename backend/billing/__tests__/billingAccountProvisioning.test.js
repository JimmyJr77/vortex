import assert from 'node:assert/strict'
import test from 'node:test'

import { loadOrCreateUnassignedBillingAccount } from '../billingAccountProvisioning.js'

test('billing account provisioning never guesses a payer or household contact', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params })
      if (calls.length === 1) return { rows: [] }
      return { rows: [{ id: 8, family_id: 7, payer_member_id: null, is_active: true }] }
    },
  }

  const account = await loadOrCreateUnassignedBillingAccount(pool, 7)
  const captured = calls[1]
  assert.equal(account.payer_member_id, null)
  assert.deepEqual(captured.params, [7])
  assert.match(captured.sql, /payer_member_id, is_active/)
  assert.match(captured.sql, /household_monthly_billing_enabled/)
  assert.match(captured.sql, /SELECT family\.id, NULL, TRUE, FALSE/)
  assert.doesNotMatch(captured.sql, /JOIN member|FROM member|billing_email|billing_phone/)
})

test('billing account provisioning rejects an invalid family before querying', async () => {
  let queried = false
  const pool = { async query() { queried = true; return { rows: [] } } }
  assert.equal(await loadOrCreateUnassignedBillingAccount(pool, null), null)
  assert.equal(queried, false)
})
