import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { transferCustomerBillingMembership } from '../customerBillingMembershipTransfer.js'
import { loadCustomerBillingAnnualMemberships } from '../customerBillingQueries.js'
import { loadActiveAnnualMembership } from '../../scheduling/annualMembership.js'

// Uses a disposable schema, never existing account records. Opt in explicitly.
const url = process.env.MEMBERSHIP_TRANSFER_TEST_DATABASE_URL
const enabled = Boolean(url)
const people = [{ id: 11, name: 'Jordan Rivera' }, { id: 12, name: 'Alex Rivera' }, { id: 13, name: 'Casey Rivera' }]
const paidAt = new Date(Date.now() - 30 * 86400000).toISOString()
const renewal = new Date(Date.now() + 335 * 86400000).toISOString().slice(0, 10)

async function fixture(t) {
  const schema = `membership_transfer_${process.pid}_${Math.random().toString(36).slice(2)}`
  const admin = new pg.Pool({ connectionString: url })
  await admin.query(`CREATE SCHEMA ${schema}`)
  const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema},public` })
  t.after(async () => {
    await pool.end()
    await admin.query(`DROP SCHEMA ${schema} CASCADE`)
    await admin.end()
  })
  await pool.query(`
    CREATE TABLE facility (id bigint PRIMARY KEY, timezone text);
    CREATE TABLE family (id bigint PRIMARY KEY, facility_id bigint, family_name text);
    CREATE TABLE family_billing_account (id bigint PRIMARY KEY, family_id bigint, is_active boolean DEFAULT true, stripe_customer_id text, household_monthly_billing_enabled boolean DEFAULT false);
    CREATE TABLE billing_account_migration (id bigint, family_billing_account_id bigint, state text);
    CREATE TABLE member (id bigint PRIMARY KEY, facility_id bigint, family_id bigint, first_name text, last_name text, is_active boolean DEFAULT true);
    CREATE TABLE family_member (family_id bigint, member_id bigint, is_active boolean);
    CREATE TABLE discount_rule (facility_id bigint, active boolean, config jsonb);
    CREATE TABLE additional_fee (id bigint PRIMARY KEY, name text, trigger_type text, apply_basis text);
    CREATE TABLE billing_subscription (id bigserial PRIMARY KEY, family_billing_account_id bigint, member_id bigint, source_type text, source_id text, pricing_option_key text, status text, start_date date, next_bill_date date, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), stripe_subscription_id text, auto_renewal boolean DEFAULT true);
    CREATE UNIQUE INDEX subscription_source ON billing_subscription(source_type, source_id) WHERE source_id IS NOT NULL AND status <> 'cancelled';
    CREATE TABLE billing_charge (id bigserial PRIMARY KEY, family_billing_account_id bigint, member_id bigint, source_type text, source_id text, amount_cents int, gross_amount_cents int, discount_amount_cents int, created_at timestamptz, service_period_start date, collection_status text, related_charge_id bigint, metadata jsonb);
    CREATE UNIQUE INDEX charge_source ON billing_charge(source_type, source_id) WHERE source_id IS NOT NULL;
    CREATE TABLE billing_payment (id bigint PRIMARY KEY, stripe_subscription_id text, external_status text, paid_at timestamptz);
    CREATE TABLE billing_payment_application (billing_charge_id bigint, billing_payment_id bigint, application_kind text, amount_cents int);
    CREATE TABLE additional_fee_redemption (id bigserial PRIMARY KEY, fee_id bigint, member_id bigint, signup_id bigint, period_key text, amount_cents int, created_at timestamptz, satisfied_at timestamptz, ended_at timestamptz, end_reason text, billing_charge_id bigint, UNIQUE(fee_id, member_id, period_key));
    CREATE TABLE annual_membership_renewal_pricing (id bigserial PRIMARY KEY, family_billing_account_id bigint, member_id bigint, additional_fee_id bigint, final_amount_cents int, updated_at timestamptz DEFAULT now(), UNIQUE(family_billing_account_id, member_id, additional_fee_id));
    CREATE TABLE billing_account_activity (id bigserial PRIMARY KEY, event_key text, family_billing_account_id bigint, member_id bigint, signup_id bigint, related_charge_id bigint, related_payment_id bigint, related_refund_id bigint, event_type text, summary text, before_value jsonb, after_value jsonb, details jsonb, stripe_object_id text, actor_user_id bigint, actor_type text, occurred_at timestamptz);
    CREATE UNIQUE INDEX activity_event ON billing_account_activity(event_key) WHERE event_key IS NOT NULL;
    INSERT INTO facility VALUES (9, 'America/New_York');
    INSERT INTO family VALUES (42, 9, 'Rivera');
    INSERT INTO family_billing_account(id, family_id, stripe_customer_id) VALUES (7, 42, 'cus_family');
    INSERT INTO member VALUES (11,9,42,'Jordan','Rivera',true),(12,9,42,'Alex','Rivera',true),(13,9,42,'Casey','Rivera',true),(14,9,99,'Other','Family',true);
    INSERT INTO additional_fee VALUES (1,'Annual membership','once_per_year','per_year');
  `)
  await pool.query(`INSERT INTO billing_subscription (id, family_billing_account_id, member_id, source_type, source_id, pricing_option_key, status, start_date, next_bill_date) VALUES (21,7,11,'annual_membership','1:11','annual_membership','active',$1,$2)`, [paidAt.slice(0,10), renewal])
  await pool.query(`INSERT INTO billing_charge (id, family_billing_account_id, member_id, source_type, source_id, amount_cents, created_at, service_period_start, collection_status) VALUES (31,7,11,'additional_fee',$1,6000,$2,$3,'paid')`, [`1:11:${renewal}`, paidAt, paidAt.slice(0,10)])
  await pool.query(`INSERT INTO billing_payment VALUES (41,NULL,'settled',$1)`, [paidAt])
  await pool.query(`INSERT INTO billing_payment_application VALUES (31,41,'application',6000)`)
  await pool.query(`INSERT INTO additional_fee_redemption (fee_id,member_id,period_key,amount_cents,created_at,satisfied_at,billing_charge_id) VALUES (1,11,$1,6000,$2,$2,31)`, [renewal, paidAt])
  await pool.query(`INSERT INTO annual_membership_renewal_pricing (family_billing_account_id,member_id,additional_fee_id,final_amount_cents) VALUES (7,11,1,4500)`)
  const overview = () => loadCustomerBillingAnnualMemberships(pool, { accountId: 7, members: people })
  const transfer = (overrides = {}) => transferCustomerBillingMembership(pool, {
    familyId: 42, facilityId: 9, memberId: 11, actorUserId: 1, requestKey: 'test-transfer',
    input: { targetMemberId: 12, membershipDate: paidAt, renewalDate: renewal, chargeId: 31 }, ...overrides,
  })
  return { pool, overview, transfer }
}

test('membership transfer preserves access dates, renewal pricing, payment allocations and can transfer back', { skip: !enabled }, async (t) => {
  const { pool, overview, transfer } = await fixture(t)
  const before = await overview()
  const result = await transfer()
  assert.equal(result.replayed, false)
  const after = await overview()
  assert.equal(after[0].active, false)
  assert.equal(after[0].autoRenewal, false)
  assert.equal(after[1].active, true)
  assert.equal(after[1].membershipDate, before[0].membershipDate)
  assert.equal(after[1].renewalDate, before[0].renewalDate)
  assert.equal(after[1].autoRenewal, true)
  assert.equal(await loadActiveAnnualMembership(pool, 11, { strict: true }), null)
  const access = await loadActiveAnnualMembership(pool, 12, { strict: true })
  assert.equal(access.renewsOn.toISOString().slice(0,10), renewal)
  assert.equal(access.cycleStart.toISOString().slice(0,10), paidAt.slice(0,10))
  const charge = (await pool.query('SELECT * FROM billing_charge WHERE id = 31')).rows[0]
  assert.equal(charge.member_id, '12')
  assert.equal(charge.amount_cents, 6000)
  assert.equal(charge.metadata.membershipTransfer.previousMemberName, 'Jordan Rivera')
  assert.equal(charge.created_at.toISOString(), paidAt)
  assert.equal((await pool.query('SELECT * FROM billing_payment_application')).rows[0].billing_charge_id, '31')
  assert.equal((await pool.query('SELECT member_id, final_amount_cents FROM annual_membership_renewal_pricing')).rows[0].member_id, '12')
  assert.equal((await transfer()).replayed, true)
  assert.equal((await pool.query('SELECT count(*) FROM billing_account_activity')).rows[0].count, '1')
  // Only the new owner is bound to the charge used by future reconciliation.
  assert.equal((await pool.query('SELECT count(*) FROM additional_fee_redemption WHERE billing_charge_id=31')).rows[0].count, '1')
  await transfer({ memberId: 12, requestKey: 'transfer-back', input: { targetMemberId: 11, membershipDate: paidAt, renewalDate: renewal } })
  const restored = await overview()
  assert.equal(restored[0].active, true)
  assert.equal(restored[1].active, false)
  assert.equal(restored[0].membershipDate, paidAt)
  assert.equal((await pool.query('SELECT metadata FROM billing_charge WHERE id=31')).rows[0].metadata.membershipTransfers.length, 2)
})

test('invalid target, scope, stale term and reused request key cannot mutate membership', { skip: !enabled }, async (t) => {
  const { pool, transfer, overview } = await fixture(t)
  await assert.rejects(transfer({ facilityId: 99 }), /not found/)
  await assert.rejects(transfer({ input: { targetMemberId: 14 } }), /family/)
  await assert.rejects(transfer({ input: { targetMemberId: 11 } }), /different/)
  await assert.rejects(transfer({ input: { targetMemberId: 12, membershipDate: paidAt, renewalDate: '2099-01-01' } }), /changed/)
  await pool.query(`INSERT INTO additional_fee_redemption (fee_id,member_id,period_key,amount_cents,created_at,satisfied_at) VALUES (1,12,$1,0,$2,$2)`, [renewal, paidAt])
  await assert.rejects(transfer(), /already has/)
  assert.equal((await overview())[0].active, true)
  assert.equal((await pool.query('SELECT count(*) FROM billing_account_activity')).rows[0].count, '0')
  await pool.query('DELETE FROM additional_fee_redemption WHERE member_id=12')
  await transfer()
  await assert.rejects(transfer({ input: { targetMemberId: 13 } }), /request key/)
})

test('two simultaneous transfers have exactly one winner', { skip: !enabled }, async (t) => {
  const { transfer, overview, pool } = await fixture(t)
  const results = await Promise.allSettled([
    transfer(),
    transfer({ requestKey: 'concurrent-transfer', input: { targetMemberId: 13, membershipDate: paidAt, renewalDate: renewal } }),
  ])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal((await overview()).filter((row) => row.active).length, 1)
  assert.equal((await pool.query('SELECT count(*) FROM billing_account_activity')).rows[0].count, '1')
})

test('legacy paid charge without redemption grants the recipient canonical access', { skip: !enabled }, async (t) => {
  const { pool, transfer } = await fixture(t)
  await pool.query('DELETE FROM additional_fee_redemption')
  await transfer()
  assert.equal(await loadActiveAnnualMembership(pool, 11, { strict: true }), null)
  assert.equal((await loadActiveAnnualMembership(pool, 12, { strict: true })).renewsOn.toISOString().slice(0,10), renewal)
})

test('Stripe renewal transfer only changes ownership metadata and rolls back on failure', { skip: !enabled }, async (t) => {
  const { pool, transfer, overview } = await fixture(t)
  await pool.query("UPDATE billing_subscription SET stripe_subscription_id='sub_annual' WHERE id=21")
  const updates = []
  const stripe = { subscriptions: {
    retrieve: async () => ({ id: 'sub_annual', customer: 'cus_family', metadata: { memberId: '11', familyBillingAccountId: '7' } }),
    update: async (id, input) => { updates.push({ id, input }); if (updates.length === 1) throw new Error('Stripe test failure') },
  } }
  await assert.rejects(transfer({ stripeClient: stripe }), /Stripe test failure/)
  assert.equal((await overview())[0].active, true)
  assert.equal((await overview())[1].active, false)
  assert.deepEqual(updates.map((row) => row.input), [{ metadata: { memberId: '12' } }, { metadata: { memberId: '11' } }])
  await transfer({ stripeClient: stripe })
  assert.equal((await overview())[1].active, true)
  assert.deepEqual(updates.at(-1).input, { metadata: { memberId: '12' } })
})
