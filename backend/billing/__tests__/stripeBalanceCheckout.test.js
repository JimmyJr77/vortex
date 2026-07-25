import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBalanceCheckoutParams } from '../stripeBilling.js'

test('balance checkout uses the authoritative balance and expires in 24 hours', () => {
  const params = buildBalanceCheckoutParams({
    account: { id: 17 },
    customerId: 'cus_test',
    balanceCents: 12345.4,
    successUrl: 'https://example.com/?billing=paid',
    cancelUrl: 'https://example.com/?billing=cancelled',
    analytics: { gaClientId: 'client-1' },
    nowMs: Date.parse('2026-07-25T12:00:00.000Z'),
  })
  assert.equal(params.mode, 'payment')
  assert.equal(params.line_items[0].price_data.unit_amount, 12345)
  assert.equal(params.client_reference_id, 'family-billing-account:17')
  assert.equal(params.metadata.familyBillingAccountId, '17')
  assert.equal(params.metadata.gaClientId, 'client-1')
  assert.equal(
    params.expires_at,
    Math.floor(Date.parse('2026-07-26T12:00:00.000Z') / 1000),
  )
})

test('balance checkout rejects non-positive collection amounts', () => {
  assert.throws(
    () =>
      buildBalanceCheckoutParams({
        account: { id: 17 },
        customerId: 'cus_test',
        balanceCents: 0,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }),
    /positive balance/,
  )
})
