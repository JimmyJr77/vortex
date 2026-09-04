import assert from 'node:assert/strict'
import test from 'node:test'

import { recordBillingActivity } from '../billingActivity.js'

test('billing activity types nullable reference parameters for PostgreSQL', async () => {
  const calls = []
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params })
      return { rows: [{ id: 1 }] }
    },
  }

  const activity = await recordBillingActivity(db, {
    eventKey: 'duplicate-stripe-invoice-payment-repaired:15:16',
    accountId: 7,
    paymentId: 16,
    eventType: 'duplicate_payment_reconciled',
    summary: 'Duplicate local payment was neutralized.',
    details: { repair: true },
  })

  assert.deepEqual(activity, { id: 1 })
  assert.match(calls[0].sql, /\$1::text, \$2::bigint, \$3::bigint, \$4::bigint/)
  assert.match(calls[0].sql, /\$5::bigint, \$6::bigint, \$7::bigint, \$8::text, \$9::text/)
  assert.match(calls[0].sql, /\$13::text, \$14::bigint, \$15::text/)
  assert.equal(calls[0].params[2], null)
  assert.equal(calls[0].params[3], null)
})
