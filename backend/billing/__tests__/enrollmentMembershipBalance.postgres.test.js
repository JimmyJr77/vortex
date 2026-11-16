import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { loadEnrollmentMembershipBills } from '../enrollmentMembershipBalance.js'
import { validateRehearsalDatabaseUrl } from '../../newAdmin/migrationAudit.js'

test('retained membership balance query subtracts settled payments and independent credits once', {
  skip: !process.env.NEW_ADMIN_TEST_DATABASE_URL,
}, async () => {
  const db = new pg.Client({ connectionString: validateRehearsalDatabaseUrl(process.env.NEW_ADMIN_TEST_DATABASE_URL) })
  await db.connect()
  const schema = `membership_balance_${randomUUID().replaceAll('-', '')}`
  try {
    await db.query('BEGIN')
    await db.query(`CREATE SCHEMA ${schema}`)
    await db.query(`SET LOCAL search_path TO ${schema}`)
    await db.query(`CREATE TABLE family_billing_account(id bigint PRIMARY KEY, family_id bigint, is_active boolean);
      CREATE TABLE member(id bigint PRIMARY KEY, family_id bigint);
      CREATE TABLE billing_charge(id bigint PRIMARY KEY, family_billing_account_id bigint, member_id bigint,
        description text, amount_cents integer, related_charge_id bigint, source_type text, source_id text, metadata jsonb);
      CREATE TABLE billing_payment(id bigint PRIMARY KEY, external_status text);
      CREATE TABLE billing_payment_application(billing_charge_id bigint, billing_payment_id bigint, amount_cents integer, application_kind text);
      CREATE TABLE billing_monthly_invoice_line(id bigint PRIMARY KEY, billing_charge_id bigint);
      CREATE TABLE billing_charge_credit_application(target_invoice_line_id bigint, credit_invoice_line_id bigint, amount_cents integer);
      INSERT INTO family_billing_account VALUES(10,20,TRUE),(11,21,TRUE);
      INSERT INTO member VALUES(30,20);
      INSERT INTO billing_charge VALUES
        (1,10,30,'Annual fee',8500,NULL,'additional_fee','7:30:2027-11-16','{}'),
        (2,10,30,'Adjustment',-500,1,'charge_adjustment','adjustment','{}'),
        (3,10,30,'Other credit',-1000,NULL,'credit','credit','{}'),
        (4,10,30,'Retired credit',-9000,NULL,'credit','retired','{"allocationRetired":true}'),
        (5,11,30,'Foreign bill',8500,NULL,'additional_fee','7:foreign','{}');
      INSERT INTO billing_payment VALUES(1,'settled'),(2,'failed');
      INSERT INTO billing_payment_application VALUES(1,1,2000,'application'),(1,2,7000,'application');
      INSERT INTO billing_monthly_invoice_line VALUES(1,1),(2,2),(3,3),(4,4);
      INSERT INTO billing_charge_credit_application VALUES(1,2,500),(1,3,1000),(1,4,9000);`)
    const bills = await loadEnrollmentMembershipBills(db, { memberId: 30, feeId: 7, accountId: 10 })
    assert.deepEqual(bills, [{ chargeId: 1, accountId: 10, memberId: 30, feeId: 7, amountCents: 5000, name: 'Annual fee' }])
    assert.deepEqual(await loadEnrollmentMembershipBills(db, { memberId: 30, feeId: 7, accountId: 11 }), [])
    await db.query("UPDATE family_billing_account SET is_active=FALSE WHERE id=10")
    assert.deepEqual(await loadEnrollmentMembershipBills(db, { memberId: 30, feeId: 7 }), [])
  } finally {
    await db.query('ROLLBACK')
    await db.end()
  }
})
