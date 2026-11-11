import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import pg from 'pg'
import {installSharedAccountRecords} from '../../newAdmin/__tests__/sharedAccountFixture.js'
import {listAccountingLines,accountingLineDetail,exportAccountingCsv} from '../accountingReport.js'
const connectionString=process.env.NEW_ADMIN_TEST_DATABASE_URL || process.env.DASHBOARD_TEST_DATABASE_URL
if(connectionString){const url=new URL(connectionString);assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&!url.search&&!url.hash);assert.match(url.pathname,/^\/vortex_(dashboard_test|new_admin_dev|billing_test)$/)}

test('accounting separates service months and credits without modifying history or reusing funds under filters',{skip:!connectionString},async()=>{
 const schema=`account_balances_${crypto.randomBytes(5).toString('hex')}`,admin=new pg.Pool({connectionString})
 await admin.query(`CREATE SCHEMA ${schema}`)
 const pool=new pg.Pool({connectionString,options:`-c search_path=${schema}`})
 try{
  await pool.query((await fs.readFile(new URL('./fixtures/turnover-schema.sql',import.meta.url),'utf8')).replaceAll('public.',`${schema}.`))
  await installSharedAccountRecords(pool)
  await pool.query(`
   INSERT INTO facility(id,name,timezone) VALUES(1,'Accounting fixture','America/New_York'),(2,'Foreign','America/Los_Angeles');
   INSERT INTO family(id,facility_id,family_name) VALUES(1,1,'Owing'),(2,1,'Credit'),(3,2,'Foreign');
   INSERT INTO family_billing_account(id,family_id) VALUES(1,1),(2,2),(3,3);
   INSERT INTO member(id,facility_id,family_id,first_name,last_name) VALUES(1,1,1,'First','Fixture'),(2,1,1,'Second','Fixture'),(3,1,2,'Credit','Fixture'),(4,2,3,'Foreign','Fixture');
   INSERT INTO billing_charge(id,family_billing_account_id,member_id,description,amount_cents,source_type,source_id,service_period_start,created_at)
    SELECT id,account,member,description,amount,'manual',id::text,(date_trunc('month',now() AT TIME ZONE 'America/New_York')+months*interval '1 month')::date,now()
    FROM (VALUES(1,1,1,'Past bill',10000,-1),(2,1,2,'Current bill',5000,0),(3,1,2,'Upcoming bill',15000,1),(4,1,1,'Account credit',-1000,0),(5,2,3,'Covered bill',500,0),(6,3,4,'Foreign bill',999999,0)) v(id,account,member,description,amount,months);
   INSERT INTO billing_payment(id,family_billing_account_id,amount_cents,method,external_status) VALUES(1,1,8000,'cash','settled'),(2,2,2500,'cash','settled'),(3,1,999999,'cash','failed');
   INSERT INTO billing_payment_application(id,billing_payment_id,billing_charge_id,amount_cents,application_kind) VALUES(1,1,1,6000,'application');
   INSERT INTO billing_refund(id,family_billing_account_id,payment_id,related_charge_id,amount_cents,external_status) VALUES(1,1,1,1,1000,'succeeded'),(2,1,1,1,999999,'failed');
   INSERT INTO billing_payment_application(id,billing_payment_id,billing_charge_id,amount_cents,application_kind,reverses_application_id) VALUES(2,1,1,1000,'reversal',1);
   INSERT INTO jackrabbit_history_record(facility_id,organization_id,record_kind,source_id,family_id,member_id,occurred_on,amount_cents,source_data) VALUES
    (1,'fixture','transaction','old-bill',1,1,'2025-01-01',50000,'{"Type":"Tuition"}'),(1,'fixture','transaction','old-payment',1,1,'2025-01-01',-50000,'{"Type":"Payment"}');
  `)
  const fingerprint=async()=>(await pool.query(`SELECT md5(string_agg(value::text,'|' ORDER BY value::text)) AS hash FROM (
   SELECT to_jsonb(t) AS value FROM billing_charge t UNION ALL SELECT to_jsonb(t) FROM billing_payment t UNION ALL SELECT to_jsonb(t) FROM billing_refund t
   UNION ALL SELECT to_jsonb(t) FROM billing_payment_application t UNION ALL SELECT to_jsonb(t) FROM family_billing_account t UNION ALL SELECT to_jsonb(t) FROM jackrabbit_history_record t
   UNION ALL SELECT to_jsonb(t) FROM account_charge t UNION ALL SELECT to_jsonb(t) FROM account_payment t) facts`)).rows[0].hash
  const before=await fingerprint()
  const db=await pool.connect()
  try{
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
   const data=await listAccountingLines(db,{facilityId:1,query:{pageSize:100}})
   assert.deepEqual(data.balances,{currentCents:7000,currentFamilies:1,upcomingCents:15000,upcomingFamilies:1,creditCents:2000,creditFamilies:1,reviewCents:0})
   assert.equal(data.summary.comparableBilledCents,30500)
   assert.equal(data.summary.comparablePaidCents,5000)
   assert.equal(data.summary.accountFundsCents,3500)
   assert.equal(data.summary.remainingCents,22000)
   assert.equal(data.summary.historicalCount,1);assert.equal(data.summary.historicalBilledCents,50000)
   assert.equal(data.summary.comparableBilledCents,data.summary.comparablePaidCents+data.summary.comparableCreditAppliedCents+data.summary.accountFundsCents+data.summary.remainingCents)
   assert.equal(data.rows.find(row=>row.id===1).remainingCents,2000)
   assert.equal(data.rows.find(row=>row.id===5).remainingCents,0)
   const covered=await listAccountingLines(db,{facilityId:1,query:{status:'paid'}})
   assert.deepEqual(covered.rows.map(row=>row.id),[5])
   const partial=await listAccountingLines(db,{facilityId:1,query:{status:'partial'}})
   assert.deepEqual(partial.rows.map(row=>row.id),[1])
   const past=await accountingLineDetail(db,{facilityId:1,id:1})
   assert.equal(past.line.remainingCents,2000);assert.equal(past.line.openCents,5000);assert.equal(past.allocations.length,2)
   const future=await listAccountingLines(db,{facilityId:1,query:{balancePeriod:'upcoming'}})
   assert.deepEqual(future.rows.map(row=>row.id),[3]);assert.equal(future.summary.accountFundsCents,0)
   const current=await listAccountingLines(db,{facilityId:1,query:{balancePeriod:'current'}})
   assert.deepEqual(current.rows.map(row=>row.id).sort(),[1,2]);assert.equal(current.summary.remainingCents,7000)
   const sibling=await listAccountingLines(db,{facilityId:1,query:{memberId:2}})
   assert.equal(sibling.summary.accountFundsCents,0);assert.equal(sibling.summary.remainingCents,20000)
   assert.deepEqual(sibling.balances,data.balances)
   const paidDate=await listAccountingLines(db,{facilityId:1,query:{dateField:'paid',from:data.asOf,through:data.asOf}})
   assert.equal(paidDate.rows[0].id,1);assert.equal(paidDate.rows[0].accountFundsCents,3000)
   const page=await listAccountingLines(db,{facilityId:1,query:{pageSize:1,page:2}})
   assert.deepEqual(page.summary,data.summary);assert.deepEqual(page.balances,data.balances)
   const none=await listAccountingLines(db,{facilityId:1,query:{search:'no matches'}})
   assert.equal(none.total,0);assert.equal(none.summary.comparableBilledCents,0);assert.deepEqual(none.balances,data.balances)
   const foreign=await listAccountingLines(db,{facilityId:2})
   assert.equal(foreign.balances.currentCents,999999);assert.equal(foreign.balances.creditCents,0)
   const csv=await exportAccountingCsv(db,{facilityId:1,query:{balancePeriod:'upcoming'}})
   assert.equal(csv.total,1);assert.match(csv.csv,/Upcoming bill/);assert.doesNotMatch(csv.csv,/Past bill/)
   assert.match(csv.csv,/Paid or credited \(USD\)/);assert.doesNotMatch(csv.csv,/Account funds|Open before account funds|Credit applied/)
   const history=await listAccountingLines(db,{facilityId:1,query:{status:'historical'}})
   assert.equal(history.total,1);assert.equal(history.summary.comparableCount,0)
   await db.query('COMMIT')
  }finally{db.release()}
  assert.equal(await fingerprint(),before)
 }finally{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end()}
})
