import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { refreshStripeCustomerProjection, loadStripeCustomerProjection, stripeCustomerProjectionSummary } from '../stripeCustomerProjection.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL

test('local PostgreSQL projection migration, retries, and redaction preserve financial references', { skip: !connectionString }, async () => {
  const url = new URL(connectionString)
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'rehearsal must use an explicit local database')
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol) && !url.search && !url.hash
    && /^\/vortex_new_admin_dev(?:_[a-z0-9_]+)?$/i.test(url.pathname), 'rehearsal must use the dedicated local database without URL overrides')
  const client = new pg.Client({ connectionString })
  await client.connect()
  const db = { query: client.query.bind(client) }
  const schema = `projection_test_${randomUUID().replaceAll('-', '')}`
  try {
    await client.query(`CREATE SCHEMA ${schema}`)
    await client.query(`SET search_path TO ${schema}`)
    await client.query(`CREATE TABLE family_billing_account (id BIGINT PRIMARY KEY, stripe_customer_id TEXT, is_active BOOLEAN DEFAULT TRUE)`)
    await client.query(`CREATE TABLE stripe_billing_alert (
      stripe_event_id TEXT UNIQUE, family_billing_account_id BIGINT, alert_type TEXT,
      severity TEXT, stripe_object_id TEXT, message TEXT, details JSONB,
      action_status TEXT DEFAULT 'open', resolved_at TIMESTAMPTZ, resolution_note TEXT, updated_at TIMESTAMPTZ DEFAULT now()
    )`)
    await client.query(`INSERT INTO family_billing_account(id,stripe_customer_id) VALUES (44,'cus_existing')`)
    const migration = await readFile(new URL('../../migrations/840_stripe_customer_projection.sql', import.meta.url), 'utf8')
    await client.query(migration)
    await client.query(migration)
    let unavailable = false
    const stripe = { customers: { async retrieve(id) {
      assert.equal(id, 'cus_existing')
      if (unavailable) throw Object.assign(new Error('simulated timeout'), { code: 'ETIMEDOUT' })
      return { id, invoice_settings: { default_payment_method: {
        id: 'pm_existing', type: 'card', customer: id,
        card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2035, number: 'never-store-this' },
      } } }
    } } }
    const account = { id: 44, stripe_customer_id: 'cus_existing', stripe_customer_owner_count: 1 }
    await refreshStripeCustomerProjection(db, stripe, { accountId: 44, customerId: 'cus_existing' })
    await refreshStripeCustomerProjection(db, stripe, { accountId: 44, customerId: 'cus_existing' })
    assert.equal((await client.query('SELECT count(*) FROM stripe_customer_projection')).rows[0].count, '1')
    assert.equal((await client.query('SELECT stripe_customer_id FROM family_billing_account')).rows[0].stripe_customer_id, 'cus_existing')
    unavailable = true
    await assert.rejects(refreshStripeCustomerProjection(db, stripe, { customerId: 'cus_existing' }), /simulated timeout/)
    const failed = await loadStripeCustomerProjection(db, account)
    assert.equal(failed.sync_status, 'failed')
    assert.equal(failed.stripe_payment_method_id, 'pm_existing')
    assert.doesNotMatch(JSON.stringify(failed), /never-store-this/)
    assert.equal(stripeCustomerProjectionSummary(account, failed, { billingMonth: '2026-11' }).paymentMethod.last4, '4242')
    assert.equal((await client.query('SELECT action_status FROM stripe_billing_alert')).rows[0].action_status, 'open')
    unavailable = false
    await refreshStripeCustomerProjection(db, stripe, { customerId: 'cus_existing' })
    assert.equal((await loadStripeCustomerProjection(db, account)).sync_status, 'synced')
    assert.equal((await client.query('SELECT action_status FROM stripe_billing_alert')).rows[0].action_status, 'resolved')
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await client.end()
  }
})
