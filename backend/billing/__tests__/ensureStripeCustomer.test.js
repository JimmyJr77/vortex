import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ensureStripeCustomer,
  STRIPE_CUSTOMER_RECONCILIATION_REQUIRED_CODE,
} from '../stripeBilling.js'

function mockPool(accountRow, handler = async () => ({ rows: [] })) {
  const queries = []
  return {
    queries,
    async query(sql, params = []) {
      const text = String(sql)
      queries.push({ sql: text, params })
      if (/pg_advisory_lock/.test(text)) return { rows: [{}] }
      if (/pg_advisory_unlock/.test(text)) return { rows: [{ pg_advisory_unlock: true }] }
      if (/^BEGIN$|^COMMIT$|^ROLLBACK$/.test(text)) return { rows: [] }
      if (/FROM family_billing_account/.test(text) && /FOR UPDATE/.test(text)) {
        return { rows: accountRow ? [{ ...accountRow }] : [] }
      }
      return handler(text, params)
    },
  }
}

test('ensureStripeCustomer quarantines a missing stored customer instead of replacing it', async () => {
  let creates = 0
  const pool = mockPool({
    id: 461,
    family_id: 21,
    billing_email: 'payer@example.com',
    stripe_customer_id: 'cus_stale',
    is_active: true,
  })
  const stripe = {
    customers: {
      retrieve: async () => {
        const error = new Error("No such customer: 'cus_stale'")
        error.code = 'resource_missing'
        throw error
      },
      create: async () => {
        creates += 1
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

  await assert.rejects(
    ensureStripeCustomer(pool, stripe, account),
    (error) => error?.code === STRIPE_CUSTOMER_RECONCILIATION_REQUIRED_CODE,
  )
  assert.equal(creates, 0)
  assert.equal(account.stripe_customer_id, 'cus_stale')
  assert.ok(pool.queries.some(({ sql }) => /INSERT INTO stripe_billing_alert/.test(sql)))
  assert.equal(
    pool.queries.some(({ sql }) => /UPDATE family_billing_account/.test(sql)),
    false,
  )
})
test('ensureStripeCustomer serializes first creation and uses a deterministic Stripe key', async () => {
  let createPayload = null
  let createOptions = null
  const pool = mockPool(
    {
      id: 461,
      family_id: 21,
      billing_email: 'payer@example.com',
      stripe_customer_id: null,
      is_active: true,
    },
    async (sql, params) => {
      if (/UPDATE family_billing_account/.test(sql)) {
        assert.deepEqual(params, [461, 'cus_new'])
        return { rows: [{ stripe_customer_id: 'cus_new' }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  )
  const stripe = {
    customers: {
      retrieve: async () => {
        throw new Error('should not retrieve')
      },
      create: async (payload, options) => {
        createPayload = payload
        createOptions = options
        return { id: 'cus_new' }
      },
    },
  }
  const account = { id: 461, family_id: 21, billing_email: 'payer@example.com' }

  assert.equal(await ensureStripeCustomer(pool, stripe, account), 'cus_new')
  assert.equal(account.stripe_customer_id, 'cus_new')
  assert.equal(createPayload.email, 'payer@example.com')
  assert.equal(createPayload.metadata.familyBillingAccountId, '461')
  assert.equal(
    createOptions.idempotencyKey,
    'family-billing-account:461:stripe-customer:v1',
  )
  const sql = pool.queries.map(({ sql: text }) => text)
  assert.ok(sql.findIndex((text) => /pg_advisory_lock/.test(text)) < sql.findIndex((text) => /^BEGIN$/.test(text)))
  assert.ok(sql.some((text) => /FOR UPDATE/.test(text)))
})

test('ensureStripeCustomer reuses an existing live customer under the account lock', async () => {
  const pool = mockPool({
    id: 1,
    family_id: 2,
    stripe_customer_id: 'cus_ok',
    is_active: true,
  })
  const stripe = {
    customers: {
      retrieve: async (id) => ({
        id,
        deleted: false,
        metadata: { familyBillingAccountId: '1' },
      }),
      create: async () => {
        throw new Error('should not create')
      },
    },
  }
  const account = { id: 1, family_id: 2, stripe_customer_id: 'cus_ok' }
  assert.equal(await ensureStripeCustomer(pool, stripe, account), 'cus_ok')
  assert.ok(pool.queries.some(({ sql }) => /FOR UPDATE/.test(sql)))
})
