import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activateHouseholdMonthlyBillingForAccount,
  billingMonthStart,
} from '../householdMonthlyInvoice.js'

test('household invoices always use the first day of the UTC billing month', () => {
  assert.equal(billingMonthStart(new Date('2026-09-30T23:59:59.000Z')), '2026-09-01')
  assert.equal(billingMonthStart(new Date('2026-10-01T00:00:00.000Z')), '2026-10-01')
})

test('a saved-card account with local recurring schedules safely enables household monthly billing', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      const text = String(sql)
      calls.push({ sql: text, params })
      if (text.includes('SELECT * FROM family_billing_account')) {
        return { rows: [{ id: 8, family_id: 6, stripe_customer_id: 'cus_8', household_monthly_billing_enabled: false }] }
      }
      if (text.includes('COUNT(*)::int AS count')) return { rows: [{ count: 1 }] }
      if (text.includes('AND stripe_subscription_id IS NOT NULL')) return { rows: [] }
      if (text.includes('UPDATE family_billing_account')) {
        return { rows: [{ id: 8, household_monthly_billing_enabled: true }] }
      }
      if (text.includes('INSERT INTO billing_account_activity')) return { rows: [{ id: 1 }] }
      return { rows: [] }
    },
  }
  const stripe = {
    customers: {
      retrieve: async () => ({
        deleted: false,
        invoice_settings: { default_payment_method: { id: 'pm_8' } },
      }),
    },
  }

  const result = await activateHouseholdMonthlyBillingForAccount(pool, {
    accountId: 8,
    stripe,
  })

  assert.equal(result.status, 'enabled')
  assert.equal(result.enabled, true)
  assert.ok(calls.some((call) => call.sql.includes('SET household_monthly_billing_enabled = TRUE')))
})
