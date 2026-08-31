import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessMemberCustomerBilling } from '../registerRoutes.js'

test('member billing audit is available only to the configured family payer', () => {
  const account = { payer_member_id: '74' }

  assert.equal(canAccessMemberCustomerBilling(account, 74), true)
  assert.equal(canAccessMemberCustomerBilling(account, 75), false)
  assert.equal(canAccessMemberCustomerBilling({ payer_member_id: null }, 74), false)
  assert.equal(canAccessMemberCustomerBilling(null, 74), false)
})
