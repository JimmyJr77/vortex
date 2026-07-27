import test from 'node:test'
import assert from 'node:assert/strict'
import { ensureStripeCustomer } from '../stripeBilling.js'

test('ensureStripeCustomer recreates when stored customer is missing in Stripe', async () => {
  const updates = []
  const pool = {
    query: async (sql, params) => {
      if (/047_stripe_billing/.test(sql)) return { rows: [] }
      if (/UPDATE family_billing_account SET stripe_customer_id/.test(sql)) {
        updates.push(params)
        return { rows: [] }
      }
      return { rows: [] }
    },
  }
  const stripe = {
    customers: {
      retrieve: async () => {
        const err = new Error("No such customer: 'cus_stale'")
        err.code = 'resource_missing'
        throw err
      },
      create: async (payload) => {
        assert.equal(payload.email, 'payer@example.com')
        assert.equal(payload.metadata.replaced_stripe_customer_id, 'cus_stale')
        return { id: 'cus_new' }
      },
    },
  }
  const account = {
    id: 461,
    family_id: 21,
    billing_email: 'payer@example.com',
    stripe_customer_id: 'cus_stale',
  }

  const customerId = await ensureStripeCustomer(pool, stripe, account)
  assert.equal(customerId, 'cus_new')
  assert.equal(account.stripe_customer_id, 'cus_new')
  assert.deepEqual(updates, [[461, 'cus_new']])
})

test('ensureStripeCustomer reuses an existing live customer', async () => {
  const pool = {
    query: async (sql) => {
      if (/047_stripe_billing/.test(sql)) return { rows: [] }
      throw new Error(`unexpected query: ${sql}`)
    },
  }
  const stripe = {
    customers: {
      retrieve: async (id) => ({ id, deleted: false }),
      create: async () => {
        throw new Error('should not create')
      },
    },
  }
  const account = { id: 1, family_id: 2, stripe_customer_id: 'cus_ok' }
  assert.equal(await ensureStripeCustomer(pool, stripe, account), 'cus_ok')
})
