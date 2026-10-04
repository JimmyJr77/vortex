import assert from 'node:assert/strict'
import test from 'node:test'
import pg from 'pg'
import { buildRevenueMonths, loadNetCollectedRevenue } from '../adminDashboard.js'

const url = process.env.DASHBOARD_TEST_DATABASE_URL

test('net dashboard collections include completed refunds without multiplying payments or crossing facility boundaries', { skip: !url }, async () => {
  const parsed = new URL(url)
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))
  assert.equal(parsed.pathname, '/vortex_dashboard_test')
  const db = new pg.Client({ connectionString: url })
  await db.connect()
  try {
    await db.query(`
      CREATE TEMP TABLE family (id bigint, facility_id bigint);
      CREATE TEMP TABLE family_billing_account (id bigint, family_id bigint);
      CREATE TEMP TABLE billing_payment (id bigint, family_billing_account_id bigint, amount_cents int, paid_at timestamptz, external_status text);
      CREATE TEMP TABLE billing_refund (family_billing_account_id bigint, payment_id bigint, amount_cents int, created_at timestamptz, external_status text, stripe_refund_id text, error_message text);
      INSERT INTO family VALUES (1,7),(2,8);
      INSERT INTO family_billing_account VALUES (10,1),(20,2);
      INSERT INTO billing_payment VALUES
        (1,10,10000,'2026-09-15','settled'),
        (2,10,20000,'2026-10-01','succeeded'),
        (3,10,90000,'2026-10-02','pending'),
        (4,20,50000,'2026-10-01','settled'),
        (5,10,99999,'2026-11-01','settled');
      INSERT INTO billing_refund VALUES
        (10,2,2000,'2026-10-02','succeeded',NULL,NULL),
        (10,2,1000,'2026-10-03','succeeded',NULL,NULL),
        (10,1,3000,'2026-10-04','succeeded',NULL,NULL),
        (10,2,4000,'2026-10-04','pending',NULL,NULL),
        (10,2,4000,'2026-10-04','failed',NULL,NULL),
        (10,2,4000,'2026-10-04','canceled',NULL,NULL),
        (10,2,4000,'2026-10-04','reconciliation_required',NULL,NULL),
        (10,2,500,'2026-10-04','reconciliation_required','re_done','[stripe-refund-ledger-finalization-pending:fixture]'),
        (10,1,500,'2026-10-04',NULL,NULL,NULL),
        (20,4,8000,'2026-10-04','succeeded',NULL,NULL),
        (10,1,1000,'2026-08-31T23:59:59Z','succeeded',NULL,NULL),
        (10,2,9999,'2026-11-01','succeeded',NULL,NULL);
    `)
    const now = new Date('2026-10-04T16:00:00Z')
    const result = await loadNetCollectedRevenue(db, 7, now)
    const months = buildRevenueMonths(result.rows, now)
    assert.equal(months.find(m => m.key === '2026-08').amountCents, -1000)
    assert.equal(months.find(m => m.key === '2026-09').amountCents, 10000)
    assert.equal(months.find(m => m.key === '2026-10').amountCents, 13000)
    assert.equal(months.some(m => m.key === '2026-11'), false)
  } finally {
    await db.end()
  }
})
