import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyStripeStatus,
  applyBillingAccessAction,
  isPaymentRecoveryExhausted,
} from '../billingAccessRecovery.js'

test('payment recovery is exhausted only when Stripe has no next retry', () => {
  assert.equal(isPaymentRecoveryExhausted({ attempt_count: 8, next_payment_attempt: null }), true)
  assert.equal(isPaymentRecoveryExhausted({ attempt_count: 4, next_payment_attempt: 1780000000 }), false)
  assert.equal(isPaymentRecoveryExhausted({ attempt_count: 0, next_payment_attempt: null }), false)
})

test('billing access restore quarantines a stale collector when the household ledger owns collection', async () => {
  let remoteUpdates = 0
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (/pg_advisory_lock/.test(text)) return { rows: [{}] }
      if (/pg_advisory_unlock/.test(text)) return { rows: [{ pg_advisory_unlock: true }] }
      if (/FROM family_billing_account account/.test(text)) {
        return {
          rows: [{
            id: 12,
            household_monthly_billing_enabled: true,
            migration_state: 'verified',
          }],
        }
      }
      if (/INSERT INTO stripe_billing_alert/.test(text)) return { rows: [{ id: 101 }] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }

  const outcomes = await applyStripeStatus(
    [{ id: 7, stripe_subscription_id: 'sub_stale' }],
    'active',
    'paused',
    {
      pool,
      accountId: 12,
      statusSetter: async () => {
        remoteUpdates += 1
        return { status: 'active' }
      },
    },
  )

  assert.equal(remoteUpdates, 0)
  assert.equal(outcomes[0].status, 'quarantined')
  assert.equal(outcomes[0].remoteMutated, false)
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
      if (text.includes('FROM stripe_billing_alert alert')) {
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
    facilityId: 6,
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

test('staff cannot mutate a billing alert outside the authenticated facility', async () => {
  const calls = []
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql: String(sql), params })
      return { rows: [] }
    },
    async connect() {
      throw new Error('an unauthorized action must not open a mutation transaction')
    },
  }

  await assert.rejects(
    applyBillingAccessAction(pool, {
      alertId: 44,
      action: 'suspend',
      reason: 'Attempted cross-facility action',
      actedByUserId: 5,
      facilityId: 6,
    }),
    /billing alert not found/i,
  )

  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].params, [44, 6])
  assert.match(calls[0].sql, /scoped_family\.facility_id = \$2/)
})

test('billing access actions fail closed without authenticated facility scope', async () => {
  const pool = { query: async () => ({ rows: [] }) }
  await assert.rejects(
    applyBillingAccessAction(pool, {
      alertId: 44,
      action: 'suspend',
      reason: 'Missing scope',
      actedByUserId: 5,
    }),
    /authenticated facility scope is required/i,
  )
})
