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
      CREATE TEMP TABLE account_payment_current (id bigint, family_billing_account_id bigint, amount_cents int, paid_at timestamptz, external_status text);
      CREATE TEMP TABLE account_refund_current (family_billing_account_id bigint, payment_id bigint, amount_cents int, created_at timestamptz, external_status text, stripe_refund_id text, error_message text);
      INSERT INTO family VALUES (1,7),(2,8);
      INSERT INTO family_billing_account VALUES (10,1),(20,2);
      INSERT INTO account_payment_current VALUES
        (1,10,10000,'2026-09-15','settled'),
        (2,10,20000,'2026-10-01','succeeded'),
        (3,10,90000,'2026-10-02','pending'),
        (4,20,50000,'2026-10-01','settled'),
        (5,10,99999,'2026-11-01','settled');
      INSERT INTO account_refund_current VALUES
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
      -- Both sources have the same normalized payment/refund shape.
      INSERT INTO account_payment_current VALUES(-1,10,4000,'2026-09-03T04:00:00Z','settled'),(-2,20,99999,'2026-09-03T04:00:00Z','settled');
      INSERT INTO account_refund_current VALUES(10,NULL,500,'2026-09-04T04:00:00Z','succeeded',NULL,NULL);
      ALTER TABLE account_payment_current ADD COLUMN record_facility_id bigint;
      ALTER TABLE account_refund_current ADD COLUMN record_facility_id bigint;
      UPDATE account_payment_current SET record_facility_id=CASE WHEN family_billing_account_id=10 THEN 7 ELSE 8 END;
      UPDATE account_refund_current SET record_facility_id=CASE WHEN family_billing_account_id=10 THEN 7 ELSE 8 END;
      -- Historical receipts do not need a collectible billing account.
      UPDATE account_payment_current SET family_billing_account_id=NULL WHERE id<0;
    `)
    const now = new Date('2026-10-04T16:00:00Z')
    const result = await loadNetCollectedRevenue(db, 7, now)
    const months = buildRevenueMonths(result.rows, now)
    assert.equal(months.find(m => m.key === '2026-08').amountCents, -1000)
    assert.equal(months.find(m => m.key === '2026-09').amountCents, 13500)
    assert.equal(months.find(m => m.key === '2026-10').amountCents, 13000)
    assert.equal(months.some(m => m.key === '2026-11'), false)
  } finally {
    await db.end()
  }
})
