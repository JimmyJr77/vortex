import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyBillingAccessAction,
  isPaymentRecoveryExhausted,
} from '../billingAccessRecovery.js'

test('payment recovery is exhausted only when Stripe has no next retry', () => {
  assert.equal(isPaymentRecoveryExhausted({ attempt_count: 8, next_payment_attempt: null }), true)
  assert.equal(isPaymentRecoveryExhausted({ attempt_count: 4, next_payment_attempt: 1780000000 }), false)
  assert.equal(isPaymentRecoveryExhausted({ attempt_count: 0, next_payment_attempt: null }), false)
})

test('staff suspension pauses only active subscriptions and their confirmed signups', async () => {
  const queries = []
  const actionRow = {
    id: 91,
    stripe_billing_alert_id: 44,
    family_billing_account_id: 12,
    action: 'suspend',
    status: 'succeeded',
    notification_status: 'skipped',
  }
  const client = {
    async query(sql, params = []) {
      queries.push({ sql: String(sql), params, client: true })
      if (String(sql).includes('INSERT INTO billing_access_action')) return { rows: [actionRow] }
      return { rows: [] }
    },
    release() {},
  }
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      queries.push({ sql: text, params, client: false })
      if (text.includes('FROM pg_constraint')) return { rows: [] }
      if (text.includes('SELECT * FROM stripe_billing_alert WHERE id')) {
        return { rows: [{ id: 44, alert_type: 'payment_recovery_exhausted', family_billing_account_id: 12, action_status: 'open' }] }
      }
      if (text.includes("UPDATE stripe_billing_alert SET action_status = 'processing'")) return { rows: [{ id: 44 }] }
      if (text.includes("FROM billing_subscription") && text.includes("status = 'active'")) {
        return { rows: [
          { id: 7, source_type: 'scheduling_signup', source_id: '101', stripe_subscription_id: null },
          { id: 8, source_type: 'manual', source_id: 'x', stripe_subscription_id: null },
        ] }
      }
      if (text.includes('SELECT COALESCE(fba.billing_email')) return { rows: [{ email: null }] }
      if (text.includes('SELECT * FROM billing_access_action WHERE id')) return { rows: [actionRow] }
      return { rows: [] }
    },
    async connect() { return client },
  }

  const result = await applyBillingAccessAction(pool, {
    alertId: 44,
    action: 'suspend',
    reason: 'Stripe Smart Retries exhausted',
    actedByUserId: 5,
  })

  assert.equal(result.id, 91)
  assert.ok(queries.some((entry) => !entry.client && entry.sql.includes("action_status = 'processing'")))
  const subscriptionUpdate = queries.find((entry) => entry.client && entry.sql.includes('UPDATE billing_subscription'))
  assert.deepEqual(subscriptionUpdate.params[0], [7, 8])
  assert.equal(subscriptionUpdate.params[1], 'paused')
  const signupUpdate = queries.find((entry) => entry.client && entry.sql.includes('UPDATE scheduling_signup'))
  assert.deepEqual(signupUpdate.params[0], [101])
  assert.equal(signupUpdate.params[1], 'paused')
  const alertUpdate = queries.find((entry) => entry.client && entry.sql.includes('UPDATE stripe_billing_alert'))
  assert.equal(alertUpdate.params[1], 'suspended')
})
