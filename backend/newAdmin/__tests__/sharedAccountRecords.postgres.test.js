import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import pg from 'pg'
import { installSharedAccountRecords } from './sharedAccountFixture.js'

const connectionString=process.env.NEW_ADMIN_TEST_DATABASE_URL || process.env.DASHBOARD_TEST_DATABASE_URL
if(connectionString){
  const url=new URL(connectionString)
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname) && !url.search && !url.hash)
  assert.match(url.pathname,/^\/vortex_(new_admin_dev|dashboard_test)$/)
}

test('shared physical tables preserve all source facts and never feed historical rows into billing',{skip:!connectionString},async t=>{
 const db=new pg.Client({connectionString});await db.connect()
 try {
  await db.query('BEGIN')
  const schema=`shared_records_${crypto.randomBytes(6).toString('hex')}`
  await db.query(`CREATE SCHEMA ${schema}`);await db.query(`SET LOCAL search_path=${schema}`)
  await db.query((await fs.readFile(new URL('../../billing/__tests__/fixtures/turnover-schema.sql',import.meta.url),'utf8')).replaceAll('public.',`${schema}.`))
  await db.query(`
   INSERT INTO facility(id,name) VALUES(1,'Synthetic gym'),(2,'Foreign gym');
   INSERT INTO family(id,facility_id) VALUES(1,1),(2,1),(3,2);
   INSERT INTO member(id,facility_id,family_id,first_name,last_name) VALUES(1,1,1,'Synthetic','Athlete'),(2,2,3,'Foreign','Athlete');
   INSERT INTO family_billing_account(id,family_id) VALUES(1,1);
   INSERT INTO scheduling_form(id,title) VALUES(1,'Synthetic class');
   INSERT INTO scheduling_signup(id,form_id,member_id,enrollment_start_date) VALUES(1,1,1,'2026-09-01');
   INSERT INTO billing_charge(id,family_billing_account_id,amount_cents,description) VALUES(1,1,2000,'New tuition');
   INSERT INTO billing_payment(id,family_billing_account_id,amount_cents,method) VALUES(1,1,1000,'cash');
   INSERT INTO billing_refund(id,family_billing_account_id,payment_id,amount_cents,external_status) VALUES(1,1,1,100,'succeeded');
   INSERT INTO jackrabbit_history_record(id,facility_id,organization_id,record_kind,source_id,family_id,member_id,occurred_on,amount_cents,source_data) VALUES
    (1,1,'fixture','enrollment','enrollment-1',1,1,'2026-01-01',NULL,'{"Type":"Enrolled","Enroll Date":"2026-01-01","Drop Date":"2026-08-01","Class":"Previous class"}'),
    (2,1,'fixture','transaction','payment-1',1,1,'2026-01-01',-1000,'{"Type":"Payment","Pmt Method":"Visa"}'),
    (3,1,'fixture','transaction','charge-1',1,1,'2026-01-01',2000,'{"Type":"Tuition Fee"}'),
    (4,1,'fixture','transaction','refund-1',1,1,'2026-01-02',100,'{"Type":"Refund - Tuition"}'),
    (5,1,'fixture','family','family-1',1,NULL,NULL,NULL,'{"Name":"Synthetic"}'),
    (6,1,'fixture','person','person-1',1,1,NULL,NULL,'{"Name":"Synthetic"}'),
    (7,1,'fixture','transaction','unlinked-account',2,NULL,'2026-03-01',-500,'{"Type":"Payment"}'),
    (8,1,'fixture','enrollment','invalid-date',1,1,NULL,NULL,'{"Enroll Date":"2026-02-30","Drop Date":"unknown"}'),
    (9,1,'fixture','enrollment','foreign-links',3,2,'2026-01-01',NULL,'{"Enroll Date":"2026-01-01"}');
  `)
  const fingerprint=async()=>{
   const values={}
   for(const table of ['family','member','family_billing_account','scheduling_signup','billing_charge','billing_payment','billing_refund','jackrabbit_history_record'])values[table]=(await db.query(`SELECT md5(string_agg(to_jsonb(t)::text,'|' ORDER BY id)) AS hash FROM ${table} t`)).rows[0].hash
   return values
  }
  const original=await fingerprint()
  await installSharedAccountRecords(db)
  await t.test('backfill and retry retain raw facts, amounts, source IDs and non-collectible history',async()=>{
   for(const kind of ['enrollment','charge','payment','refund']){
    assert.equal((await db.query(`SELECT relkind FROM pg_class WHERE oid='account_${kind}'::regclass`)).rows[0].relkind,'r')
    const sources=(await db.query(`SELECT DISTINCT record_source FROM account_${kind} ORDER BY 1`)).rows.map(r=>r.record_source)
    assert.deepEqual(sources,['jackrabbit','vortex'])
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM account_${kind} WHERE historical_only IS DISTINCT FROM (record_source='jackrabbit')`)).rows[0].n,0)
   }
   assert.equal((await db.query('SELECT count(*)::int AS n FROM account_record_source')).rows[0].n,9)
   assert.equal((await db.query(`SELECT count(*)::int AS n FROM jackrabbit_history_record h JOIN account_record_source s ON s.imported_record_id=h.id WHERE h.source_data=s.source_data AND h.amount_cents IS NOT DISTINCT FROM s.amount_cents`)).rows[0].n,9)
   const sums=async()=>(await db.query(`SELECT (SELECT count(*) FROM account_payment) AS n,(SELECT sum(record_ledger_amount_cents) FROM account_payment) AS cents`)).rows[0]
   const before=await sums();await installSharedAccountRecords(db);assert.deepEqual(await sums(),before)
   assert.deepEqual(await fingerprint(),original)
   assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_payment')).rows[0].n,1)
   assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_charge')).rows[0].n,1)
   assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_subscription')).rows[0].n,0)
  })
  await t.test('native writes and rollbacks are atomic; deletes retain a tombstone',async()=>{
   await db.query('SAVEPOINT write_test')
   await db.query('UPDATE billing_payment SET amount_cents=1200 WHERE id=1')
   assert.equal((await db.query('SELECT amount_cents FROM account_payment WHERE id=1')).rows[0].amount_cents,1200)
   await db.query('ROLLBACK TO SAVEPOINT write_test')
   assert.equal((await db.query('SELECT amount_cents FROM account_payment WHERE id=1')).rows[0].amount_cents,1000)
   await db.query("INSERT INTO billing_payment(id,family_billing_account_id,amount_cents,method) VALUES(2,1,750,'cash')")
   await db.query('DELETE FROM billing_payment WHERE id=2')
   assert.equal((await db.query('SELECT count(*)::int AS n FROM account_payment_current WHERE id=2')).rows[0].n,0)
   assert.equal((await db.query('SELECT record_deleted FROM account_payment WHERE id=2')).rows[0].record_deleted,true)
  })
  await t.test('account creation, ownership, class edits and corrected imports update existing shared rows',async()=>{
   assert.equal((await db.query('SELECT family_billing_account_id FROM account_payment WHERE id=-7')).rows[0].family_billing_account_id,null)
   await db.query('INSERT INTO family_billing_account(id,family_id) VALUES(2,2)')
   assert.equal(Number((await db.query('SELECT family_billing_account_id FROM account_payment WHERE id=-7')).rows[0].family_billing_account_id),2)
   await db.query('INSERT INTO family_member(family_id,member_id,is_active) VALUES(2,1,TRUE)')
   assert.equal(Number((await db.query('SELECT record_family_id FROM account_enrollment WHERE id=1')).rows[0].record_family_id),2)
   await db.query("UPDATE scheduling_form SET title='Renamed class' WHERE id=1")
   assert.equal((await db.query('SELECT record_class_name FROM account_enrollment WHERE id=1')).rows[0].record_class_name,'Renamed class')
   await db.query("UPDATE jackrabbit_history_record SET source_data='{"+'"Type":"Refund - Tuition"'+"}',amount_cents=1000 WHERE id=2")
   assert.equal((await db.query('SELECT count(*)::int AS n FROM account_payment_current WHERE id=-2')).rows[0].n,0)
   assert.equal((await db.query('SELECT amount_cents FROM account_refund_current WHERE id=-2')).rows[0].amount_cents,1000)
  })
  await t.test('bad dates remain flagged and cross-facility links never gain household ownership',async()=>{
   const bad=(await db.query('SELECT record_date_issue,enrollment_start_date,cancel_effective_date FROM account_enrollment WHERE id=-8')).rows[0]
   assert.deepEqual(bad,{record_date_issue:true,enrollment_start_date:null,cancel_effective_date:null})
   const foreign=(await db.query('SELECT record_family_id,record_member_id FROM account_enrollment WHERE id=-9')).rows[0]
   assert.deepEqual(foreign,{record_family_id:null,record_member_id:null})
  })
 } finally {await db.query('ROLLBACK');await db.end()}
})
