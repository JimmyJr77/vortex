import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { getBusinessAcquisitionReport } from '../acquisitionReport.js'
import { normalizeBusinessAcquisition, recordBusinessAcquisition } from '../businessAcquisition.js'
import { initAnalyticsTables } from '../initTables.js'
import { parseDateRange } from '../helpers.js'

const connectionString = process.env.ANALYTICS_TEST_DATABASE_URL

test('source capture strips private URLs, payment referrers, and contact data', () => {
  assert.deepEqual(normalizeBusinessAcquisition({
    source: '  google ', medium: 'cpc', campaign: 'Fit and Flip',
    referrer: 'https://www.yelp.com/biz/some-company?private=1',
    landingPath: '/signup/invite/private-token?email=user@example.com',
  }), { source: 'google', medium: 'cpc', campaign: 'Fit and Flip', referrerHost: 'yelp.com', landingPath: '/signup/invite' })
  assert.equal(normalizeBusinessAcquisition({
    source: 'user@example.com', campaign: '555-555-5555', referrer: 'https://checkout.stripe.com/sensitive', landingPath: '/member/family',
  }), null)
})

test('source reporting counts real facility records without inventing attribution or counting payments twice', {
  skip: !connectionString && 'Set ANALYTICS_TEST_DATABASE_URL to a disposable database',
}, async (t) => {
  const pool = new pg.Pool({ connectionString, max: 1 })
  const schema = 'acquisition_' + randomUUID().replaceAll('-', '')
  await pool.query(`CREATE SCHEMA ${schema}`)
  t.after(async () => {
    await pool.query(`DROP SCHEMA ${schema} CASCADE`)
    await pool.end()
  })
  await pool.query(`SET search_path TO ${schema}, public`)
  await pool.query(`
    CREATE TABLE registrations (id integer PRIMARY KEY, facility_id bigint, created_at timestamptz,
      inquiry_source text, archived boolean);
    CREATE TABLE program (id bigint PRIMARY KEY, facility_id bigint);
    CREATE TABLE scheduling_form (id bigint PRIMARY KEY, program_id bigint);
    CREATE TABLE drop_in_registration (id bigint PRIMARY KEY, form_id bigint, benefit_type text,
      amount_cents int, created_at timestamptz, status text);
    CREATE TABLE family (id bigint PRIMARY KEY, facility_id bigint);
    CREATE TABLE family_billing_account (id bigint PRIMARY KEY, family_id bigint);
    CREATE TABLE stripe_pending_enrollment (id bigint PRIMARY KEY, family_billing_account_id bigint,
      stripe_checkout_session_id text, status text);
    CREATE TABLE billing_payment (id bigint PRIMARY KEY, family_billing_account_id bigint,
      stripe_checkout_session_id text, external_status text, historical_only boolean, paid_at timestamptz);
    CREATE TABLE billing_charge (id bigint PRIMARY KEY, family_billing_account_id bigint,
      source_type text, source_id text, stripe_checkout_session_id text);
    CREATE TABLE billing_payment_application (billing_payment_id bigint, billing_charge_id bigint,
      amount_cents int, application_kind text, allocation_reason text);
    CREATE TABLE store_order (id bigint PRIMARY KEY, facility_id bigint, source text, status text,
      payment_status text, total_cents int, created_at timestamptz, billing_charge_id bigint, family_billing_account_id bigint);
    CREATE TABLE store_action_audit (facility_id bigint, entity_type text, entity_id bigint, action text, occurred_at timestamptz);
  `)
  await initAnalyticsTables(pool)
  const date = '2026-11-17 15:00:00+00'
  await pool.query(`
    INSERT INTO registrations (id, facility_id, created_at, inquiry_source, archived, utm_source, visitor_id) VALUES
      (1, 1, '${date}', '/contact', false, null, null),
      (2, 1, '${date}', 'admin_portal', false, null, null),
      (3, 1, '${date}', '/contact', false, null, null),
      (4, 1, '${date}', '/contact', false, 'newsletter', null),
      (5, 2, '${date}', '/contact', false, 'other facility', null),
      (6, 1, '${date}', '/contact', true, 'archived form', null),
      (7, 1, '${date}', '/contact', false, null, 'v_legacy_test');
    INSERT INTO visitor_sessions (visitor_id, session_id, started_at, referrer)
      VALUES ('v_legacy_test', 's_legacy_test', '2026-11-17 14:50:00+00', 'https://www.yelp.com');
    INSERT INTO analytics_events (event_id, visitor_id, session_id, occurred_at, event_name, consent_analytics)
      VALUES ('11111111-1111-4111-8111-111111111111', 'v_legacy_test', 's_legacy_test', '2026-11-17 14:50:00+00', 'page_view', true);
    INSERT INTO program VALUES (1,1), (2,2);
    INSERT INTO scheduling_form VALUES (1,1), (2,2);
    INSERT INTO drop_in_registration VALUES
      (1,1,'free_trial',0,'${date}','confirmed'), (2,1,'paid',2500,'${date}','attended'),
      (3,1,'annual_credit',0,'${date}','confirmed'), (4,2,'free_trial',0,'${date}','confirmed'),
      (5,1,'paid',3100,'${date}','payment_pending'), (6,1,'paid',2500,'${date}','confirmed');
    INSERT INTO family VALUES (1,1), (2,2);
    INSERT INTO family_billing_account VALUES (1,1), (2,2);
    INSERT INTO stripe_pending_enrollment VALUES
      (1,1,'cs_enrollment','completed'), (2,2,'cs_foreign','completed'), (3,1,'cs_pending','processing');
    INSERT INTO billing_payment VALUES
      (1,1,'cs_enrollment','settled',false,'${date}'), (2,1,'cs_drop_in','succeeded',false,'${date}'),
      (3,1,'cs_unpaid','reconciliation_required',false,'${date}'), (4,2,'cs_foreign','settled',false,'${date}'),
      (5,1,'cs_store_account','settled',false,'${date}');
    INSERT INTO billing_charge VALUES
      (1,1,'scheduling_signup','1','cs_enrollment'), (2,1,'drop_in','2',null),
      (3,1,'drop_in','6',null), (4,2,'scheduling_signup','3','cs_foreign'), (5,1,'store_order','3',null);
    INSERT INTO billing_payment_application VALUES
      (1,1,10000,'application','enrollment_checkout_exact'), (1,2,500,'application','auto_allocate'),
      (2,2,2000,'application','auto_allocate'), (3,3,2500,'application','auto_allocate'),
      (4,4,90000,'application','enrollment_checkout_exact'), (5,5,2900,'application','auto_allocate');
    INSERT INTO store_order VALUES
      (1,1,'member','placed','paid',1200,'2026-11-16 15:00:00+00',null,1),
      (2,1,'admin','fulfilled','external',700,'${date}',null,null),
      (3,1,'member','placed','billed_to_account',2900,'${date}',5,1),
      (4,2,'admin','fulfilled','external',90000,'${date}',null,null),
      (5,1,'member','awaiting_payment','pending',3000,'${date}',null,1);
    INSERT INTO store_action_audit VALUES (1,'sale',1,'sale_card_payment_completed','${date}');
  `)
  const campaign = { source: 'google', medium: 'cpc', campaign: 'Fit and Flip' }
  const save = (kind, id, touch) => recordBusinessAcquisition(pool, kind, id, touch)
  assert.equal(await save('inquiry', 1, campaign), true)
  assert.equal(await save('inquiry', 1, { source: 'facebook' }), false, 'retry preserves the original source')
  await save('inquiry', 3, { landingPath: '/contact' })
  await save('drop_in', 1, campaign)
  await save('drop_in', 2, { referrer: 'https://www.yelp.com/biz/demo' })
  await save('enrollment_checkout', 1, campaign)
  await save('store_order', 1, { source: 'newsletter', medium: 'email' })
  const range = parseDateRange({ from: '2026-11-17', to: '2026-11-17' })
  const report = await getBusinessAcquisitionReport(pool, range, 1, { canViewRevenue: true })
  assert.deepEqual(report.totals, { inquiries: 5, freeTrials: 1, paidDropIns: 1, paidClassCheckouts: 1, storePurchases: 3, revenueCents: 17300 })
  assert.deepEqual(report.attributed, { inquiries: 4, freeTrials: 1, paidDropIns: 1, paidClassCheckouts: 1, storePurchases: 1, revenueCents: 13700 })
  assert.equal(report.rows.find(row => row.source === 'google').revenueCents, 10000)
  assert.equal(report.rows.find(row => row.source === 'yelp.com').paidDropIns, 1)
  assert.equal(report.rows.find(row => row.source === 'yelp.com').inquiries, 1)
  assert.equal(report.rows.find(row => row.channel === 'Unknown').storePurchases, 1)
  const restricted = await getBusinessAcquisitionReport(pool, range, 1, { canViewRevenue: false })
  assert.equal(restricted.totals.paidClassCheckouts, 1)
  assert.equal(restricted.totals.revenueCents, null)
  assert.ok(restricted.rows.every(row => row.revenueCents === null))
})
