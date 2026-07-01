import assert from 'node:assert/strict'
import test from 'node:test'
import pg from 'pg'
import { generateRecurringCharges } from '../../scheduling/generateRecurringCharges.js'
import { upsertSubscriptionForSource } from '../../scheduling/billingSubscriptions.js'

// DB-backed billing tests. Gated: require an explicit opt-in + connection string so
// they skip cleanly in environments without Postgres.
const dbUrl = process.env.DATABASE_URL || process.env.BILLING_TEST_DATABASE_URL
const runDb = process.env.RUN_DB_TESTS === 'true' && Boolean(dbUrl)

let pool = null
if (runDb) {
  pool = new pg.Pool({ connectionString: dbUrl })
}

test('db billing suite gate', () => {
  if (!runDb) {
    assert.ok(true, 'DB billing tests gated. Set RUN_DB_TESTS=true and DATABASE_URL to run.')
  }
})

async function makeAccount(client) {
  // Minimal family + billing account for the subscription FK. family.facility_id is
  // NOT NULL, so borrow any existing facility.
  const fac = await client.query(`SELECT id FROM facility ORDER BY id LIMIT 1`)
  const facilityId = fac.rows[0]?.id
  assert.ok(facilityId, 'a facility must exist to create a test family')
  const fam = await client.query(
    `INSERT INTO family (facility_id, family_name) VALUES ($1, '__billing_test_fam__') RETURNING id`,
    [facilityId],
  )
  const familyId = fam.rows[0].id
  const acct = await client.query(
    `INSERT INTO family_billing_account (family_id, is_active) VALUES ($1, true) RETURNING id`,
    [familyId],
  )
  return { familyId, accountId: acct.rows[0].id }
}

async function cleanup(client, accountId, familyId) {
  await client.query(`DELETE FROM billing_charge WHERE family_billing_account_id = $1`, [accountId])
  await client.query(`DELETE FROM billing_subscription WHERE family_billing_account_id = $1`, [accountId])
  await client.query(`DELETE FROM family_billing_account WHERE id = $1`, [accountId])
  await client.query(`DELETE FROM family WHERE id = $1`, [familyId])
}

test('recurring generator is idempotent and catches up missed months', { skip: !runDb }, async () => {
  const client = await pool.connect()
  let ids = null
  try {
    await client.query('BEGIN')
    const { familyId, accountId } = await makeAccount(client)
    ids = { familyId, accountId }

    // Subscription anchored at Jan 15, 2026, $150/mo net.
    const sub = await upsertSubscriptionForSource(client, {
      familyBillingAccountId: accountId,
      memberId: null,
      sourceType: 'scheduling_signup',
      sourceId: `test-${accountId}`,
      description: 'Test recurring enrollment',
      monthlyAmountCents: 15000,
      discountAmountCents: 0,
      fromDate: new Date(Date.UTC(2026, 0, 15)),
    })
    assert.ok(sub?.id)

    // As of Jan 20: the first period (next_bill_date = Feb 15) is NOT yet due.
    const r0 = await generateRecurringCharges(client, { asOf: new Date(Date.UTC(2026, 0, 20)) })
    assert.equal(r0.chargesPosted, 0, 'nothing due before the first anchor')

    // As of Mar 20: Feb 15 and Mar 15 periods are both due -> 2 charges.
    const r1 = await generateRecurringCharges(client, { asOf: new Date(Date.UTC(2026, 2, 20)) })
    assert.equal(r1.chargesPosted, 2, 'two periods caught up')

    // Re-run for the same asOf: no duplicates.
    const r2 = await generateRecurringCharges(client, { asOf: new Date(Date.UTC(2026, 2, 20)) })
    assert.equal(r2.chargesPosted, 0, 'idempotent re-run posts nothing')

    const count = await client.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(amount_cents),0)::int AS total
       FROM billing_charge WHERE family_billing_account_id = $1 AND charge_type = 'recurring'`,
      [accountId],
    )
    assert.equal(count.rows[0].n, 2)
    assert.equal(count.rows[0].total, 30000)
  } finally {
    // Roll back everything (transaction sandbox) regardless of assertions.
    await client.query('ROLLBACK').catch(() => {})
    client.release()
  }
})

test.after(async () => {
  if (pool) await pool.end()
})
