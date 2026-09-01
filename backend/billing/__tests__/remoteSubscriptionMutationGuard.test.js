import test from 'node:test'
import assert from 'node:assert/strict'
import {
  guardLegacyRemoteSubscriptionMutation,
  legacyRemoteSubscriptionMutationBlocked,
} from '../remoteSubscriptionMutationGuard.js'

test('remote subscription mutations are blocked by household ownership or a locked migration', () => {
  assert.equal(legacyRemoteSubscriptionMutationBlocked({
    householdMonthlyBillingEnabled: true,
    migrationState: null,
  }), true)
  assert.equal(legacyRemoteSubscriptionMutationBlocked({
    householdMonthlyBillingEnabled: false,
    migrationState: 'armed',
  }), true)
  assert.equal(legacyRemoteSubscriptionMutationBlocked({
    householdMonthlyBillingEnabled: false,
    migrationState: 'rolled_back',
  }), false)
})

test('blocked remote mutation creates durable quarantine evidence without clearing the stale ID', async () => {
  const queries = []
  const db = {
    async query(sql, params = []) {
      const text = String(sql)
      queries.push({ sql: text, params })
      if (/FROM family_billing_account account/.test(text)) {
        return {
          rows: [{
            id: 9,
            household_monthly_billing_enabled: true,
            migration_state: 'verified',
          }],
        }
      }
      if (/INSERT INTO stripe_billing_alert/.test(text)) return { rows: [{ id: 81 }] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }

  const result = await guardLegacyRemoteSubscriptionMutation(db, {
    accountId: 9,
    stripeSubscriptionId: 'sub_stale',
    operation: 'class-price-schedule-sync',
  })

  assert.equal(result.allowed, false)
  assert.equal(result.quarantined, true)
  assert.match(result.reason, /household ledger collection is enabled/i)
  const alert = queries.find(({ sql }) => /INSERT INTO stripe_billing_alert/.test(sql))
  assert.ok(alert)
  assert.equal(alert.params[1], 9)
  assert.equal(alert.params[4], 'sub_stale')
  assert.equal(
    queries.some(({ sql }) => /UPDATE billing_subscription/.test(sql)),
    false,
  )
})

test('rolled-back legacy accounts may still perform reviewed remote mutations', async () => {
  const db = {
    async query(sql) {
      if (/FROM family_billing_account account/.test(String(sql))) {
        return {
          rows: [{
            id: 9,
            household_monthly_billing_enabled: false,
            migration_state: 'rolled_back',
          }],
        }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const result = await guardLegacyRemoteSubscriptionMutation(db, {
    accountId: 9,
    stripeSubscriptionId: 'sub_legacy',
    operation: 'billing-access-active',
  })
  assert.equal(result.allowed, true)
  assert.equal(result.quarantined, false)
})
