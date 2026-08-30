import test from 'node:test'
import assert from 'node:assert/strict'
import { retrySyncHttpStatus } from '../customerBillingRoutes.js'

test('a retry that leaves an active adjustment unsynchronized returns accepted, not success', () => {
  assert.equal(
    retrySyncHttpStatus({
      adjustment: { status: 'active' },
      syncStatus: 'failed',
    }),
    202,
  )
})

test('a completed Stripe retry returns success', () => {
  assert.equal(
    retrySyncHttpStatus({
      adjustment: { status: 'active' },
      syncStatus: 'synced',
    }),
    200,
  )
})
