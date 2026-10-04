import test from 'node:test'
import assert from 'node:assert/strict'

import { recordBillingTurnoverReview } from '../billingTurnoverReview.js'

test('unchanged turnover findings stay resolved until their facts change', async () => {
  const queries = []
  await recordBillingTurnoverReview({
    async query(sql, params) {
      queries.push({ sql: String(sql), params })
      return { rows: [] }
    },
  }, {
    accounts: [{
      accountId: 10921,
      billingMonth: '2026-10-01',
      verified: false,
      issues: [{ code: 'target_month_recurring_charge_extra', chargeId: 319 }],
    }],
  })

  assert.equal(queries.length, 1)
  assert.deepEqual(queries[0].params.slice(0, 3), [
    'billing-turnover:10921:2026-10-01',
    10921,
    'Billing turnover for 2026-10 requires attention.',
  ])
  assert.match(queries[0].sql, /stripe_billing_alert\.details IS DISTINCT FROM EXCLUDED\.details/)
  assert.match(queries[0].sql, /ELSE stripe_billing_alert\.action_status/)
  assert.match(queries[0].sql, /WHEN stripe_billing_alert\.action_status = 'suspended' THEN 'suspended'/)
})
