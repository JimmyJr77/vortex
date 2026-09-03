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
        return {
          rows: accountRow ? [{
            stripe_customer_owner_count: accountRow.stripe_customer_id ? 1 : 0,
            ...accountRow,
          }] : [],
        }
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
      if (sql.includes('stripe-customer-create:prior-local-owners')) {
        assert.deepEqual(params, ['cus_new'])
        return { rows: [] }
      }
      if (/UPDATE family_billing_account/.test(sql)) {
        assert.deepEqual(params, [461, 'cus_new'])
        return { rows: [{ stripe_customer_id: 'cus_new' }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  )
  const stripe = {
    customers: {
      retrieve: async (id) => ({
        id,
        deleted: false,
        metadata: { familyBillingAccountId: '461', familyId: '21' },
      }),
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

test('ensureStripeCustomer rejects an idempotent create replay owned by an inactive local account', async () => {
  let updateAttempted = false
  const pool = mockPool(
    {
      id: 461,
      family_id: 21,
      billing_email: 'payer@example.com',
      stripe_customer_id: null,
      is_active: true,
    },
    async (sql, params) => {
      if (sql.includes('stripe-customer-create:prior-local-owners')) {
        assert.deepEqual(params, ['cus_replayed'])
        return { rows: [{ id: 900, is_active: false }] }
      }
      if (/INSERT INTO stripe_billing_alert/.test(sql)) return { rows: [] }
      if (/UPDATE family_billing_account/.test(sql)) {
        updateAttempted = true
        return { rows: [] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  )
  const stripe = {
    customers: {
      create: async (_payload, options) => {
        assert.equal(options.idempotencyKey, 'family-billing-account:461:stripe-customer:v1')
        return { id: 'cus_replayed' }
      },
      retrieve: async (id) => ({
        id,
        deleted: false,
        metadata: { familyBillingAccountId: '461', familyId: '21' },
      }),
    },
  }
  const account = { id: 461, family_id: 21, billing_email: 'payer@example.com' }

  await assert.rejects(
    ensureStripeCustomer(pool, stripe, account),
    (error) => (
      error?.code === STRIPE_CUSTOMER_RECONCILIATION_REQUIRED_CODE
      && /already linked to local billing account\(s\) 900/.test(error.message)
    ),
  )
  assert.equal(updateAttempted, false)
  assert.equal(account.stripe_customer_id, undefined)
  const ownerQuery = pool.queries.find(({ sql }) => sql.includes('stripe-customer-create:prior-local-owners'))
  assert.ok(ownerQuery)
  assert.doesNotMatch(ownerQuery.sql, /is_active\s*=/)
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

test('ensureStripeCustomer rejects a customer shared by any local account even when Stripe metadata is blank', async () => {
  let retrieves = 0
  const pool = mockPool({
    id: 1,
    family_id: 2,
    stripe_customer_id: 'cus_shared',
    stripe_customer_owner_count: 2,
    is_active: true,
  })
  const stripe = {
    customers: {
      retrieve: async () => {
        retrieves += 1
        return { id: 'cus_shared', deleted: false, metadata: {} }
      },
    },
  }

  await assert.rejects(
    ensureStripeCustomer(pool, stripe, {
      id: 1,
      family_id: 2,
      stripe_customer_id: 'cus_shared',
    }),
    (error) => (
      error?.code === STRIPE_CUSTOMER_RECONCILIATION_REQUIRED_CODE
      && /linked to 2 local billing accounts/.test(error.message)
    ),
  )
  assert.equal(retrieves, 0)
  assert.ok(pool.queries.some(({ sql }) => /INSERT INTO stripe_billing_alert/.test(sql)))
  const ownershipQuery = pool.queries.find(({ sql }) => /stripe_customer_owner_count/.test(sql))
  assert.match(ownershipQuery.sql, /customer_owner\.stripe_customer_id = account\.stripe_customer_id/)
  assert.doesNotMatch(ownershipQuery.sql, /customer_owner\.is_active/)
})

test('ensureStripeCustomer rejects a nonempty malformed Stripe ownership claim', async () => {
  const pool = mockPool({
    id: 1,
    family_id: 2,
    stripe_customer_id: 'cus_malformed',
    is_active: true,
  })
  const stripe = {
    customers: {
      retrieve: async () => ({
        id: 'cus_malformed',
        deleted: false,
        metadata: { familyBillingAccountId: 'not-an-account' },
      }),
    },
  }

  await assert.rejects(
    ensureStripeCustomer(pool, stripe, {
      id: 1,
      family_id: 2,
      stripe_customer_id: 'cus_malformed',
    }),
    (error) => (
      error?.code === STRIPE_CUSTOMER_RECONCILIATION_REQUIRED_CODE
      && /metadata claims billing account not-an-account/.test(error.message)
    ),
  )
  assert.ok(pool.queries.some(({ sql }) => /INSERT INTO stripe_billing_alert/.test(sql)))
})

test('ensureStripeCustomer rejects a retrieved Stripe object with a different ID', async () => {
  const pool = mockPool({
    id: 1,
    family_id: 2,
    stripe_customer_id: 'cus_expected',
    is_active: true,
  })
  const stripe = {
    customers: {
      retrieve: async () => ({ id: 'cus_foreign', deleted: false, metadata: {} }),
    },
  }

  await assert.rejects(
    ensureStripeCustomer(pool, stripe, {
      id: 1,
      family_id: 2,
      stripe_customer_id: 'cus_expected',
    }),
    (error) => (
      error?.code === STRIPE_CUSTOMER_RECONCILIATION_REQUIRED_CODE
      && /retrieval returned a different Stripe object/.test(error.message)
    ),
  )
})
