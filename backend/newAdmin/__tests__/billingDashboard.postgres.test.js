import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import pg from 'pg'
import { installSharedAccountRecords } from './sharedAccountFixture.js'
import { loadBillingDashboard } from '../billingDashboard.js'
const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL || process.env.DASHBOARD_TEST_DATABASE_URL
if (connectionString) {
  const url = new URL(connectionString)
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname) && !url.search && !url.hash)
  assert.match(url.pathname,/^\/vortex_(dashboard_test|new_admin_dev)$/)
}

test('billing dashboard unifies imported cash, scopes facilities, respects ledger adjustments and never writes', {skip:!connectionString}, async () => {
  const schema = `billing_dashboard_${crypto.randomBytes(6).toString('hex')}`
  const admin = new pg.Pool({connectionString})
  await admin.query(`CREATE SCHEMA ${schema}`)
  const pool = new pg.Pool({connectionString,options:`-c search_path=${schema}`})
  try {
    await pool.query((await fs.readFile(new URL('../../billing/__tests__/fixtures/turnover-schema.sql',import.meta.url),'utf8')).replaceAll('public.',`${schema}.`))
    await installSharedAccountRecords(pool)
    await pool.query(`
      INSERT INTO facility(id,name,timezone) VALUES (1,'Local','America/New_York'),(2,'Foreign','America/Los_Angeles');
      INSERT INTO family(id,facility_id,family_name) VALUES (1,1,'Owing'),(2,1,'Credit'),(3,2,'Foreign'),(4,1,'Imported');
      INSERT INTO family_billing_account(id,family_id) VALUES (1,1),(2,2),(3,3),(4,4);
      INSERT INTO member(id,facility_id,family_id,first_name,last_name,gender,date_of_birth) VALUES
        (1,1,1,'First','Fixture','female','2016-10-03'),(2,1,1,'Second','Fixture','male','2018-01-01'),(3,2,3,'Foreign','Fixture','male','2016-01-01');
      INSERT INTO program(id,facility_id,category,name,display_name) VALUES(1,1,'GYMNASTICS','Team','Team'),(2,1,'GYMNASTICS','Tumbling','Tumbling');
      INSERT INTO scheduling_form(id,program_id,title) VALUES(1,1,'Team'),(2,2,'Tumbling');
      INSERT INTO scheduling_signup(id,form_id,member_id,status,enrollment_start_date) VALUES(1,1,1,'confirmed','2026-01-01'),(2,2,2,'confirmed','2026-01-01');
      INSERT INTO billing_charge(id,family_billing_account_id,member_id,description,charge_type,source_type,source_id,amount_cents,service_period_start,created_at) VALUES
        (1,1,1,'September tuition','recurring','scheduling_signup','1:sep',10000,'2026-09-01','2026-09-01T12:00:00Z'),
        (2,1,2,'November tuition','recurring','scheduling_signup','2:nov',5000,'2026-11-01','2026-11-01T12:00:00Z'),
        (3,3,3,'Foreign bill','recurring','scheduling_signup','3:nov',999999,'2026-11-01','2026-11-01T12:00:00Z'),
        (4,1,1,'Credit','credit','manual_account_credit','credit:4',-1000,'2026-11-01','2026-11-01T12:00:00Z');
      INSERT INTO billing_payment(id,family_billing_account_id,amount_cents,method,external_status,paid_at) VALUES
        (1,1,6000,'cash','settled','2026-10-01T03:59:59Z'),
        (2,2,2000,'cash','settled','2026-10-01T04:00:00Z'),
        (3,3,999999,'cash','settled','2026-10-01T12:00:00Z'),
        (4,1,888888,'card','failed','2026-10-01T12:00:00Z');
      INSERT INTO billing_payment_application(id,billing_payment_id,billing_charge_id,amount_cents,application_kind) VALUES (1,1,1,6000,'application');
      INSERT INTO billing_refund(id,family_billing_account_id,payment_id,related_charge_id,amount_cents,external_status,created_at) VALUES
        (1,1,1,1,1000,'succeeded','2026-10-02T12:00:00Z'),
        (2,1,1,1,999999,'failed','2026-10-03T12:00:00Z');
      INSERT INTO billing_payment_application(id,billing_payment_id,billing_charge_id,amount_cents,application_kind,reverses_application_id,idempotency_key) VALUES (2,1,1,1000,'reversal',1,'refund:1:application:1');
      INSERT INTO jackrabbit_history_record(facility_id,organization_id,record_kind,source_id,family_id,member_id,occurred_on,amount_cents,source_data) VALUES
        (1,'fixture','transaction','payment',4,1,'2026-02-01',-3000,'{"Type":"Payment","Class":"Historical Team"}'),
        (1,'fixture','transaction','refund',4,1,'2026-03-01',500,'{"Type":"Refund - Payment","Class":"Historical Team"}'),
        (1,'fixture','transaction','old-charge',4,1,'2026-02-01',999999,'{"Type":"Tuition"}'),
        (2,'fixture','transaction','foreign',3,3,'2026-02-01',-999999,'{"Type":"Payment"}');
    `)
    const fingerprint = async () => (await pool.query(`SELECT md5(string_agg(value::text,'|' ORDER BY value::text)) AS hash FROM (
      SELECT to_jsonb(t) AS value FROM billing_charge t UNION ALL SELECT to_jsonb(t) FROM billing_payment t
      UNION ALL SELECT to_jsonb(t) FROM billing_refund t UNION ALL SELECT to_jsonb(t) FROM billing_payment_application t
      UNION ALL SELECT to_jsonb(t) FROM family_billing_account t UNION ALL SELECT to_jsonb(t) FROM jackrabbit_history_record t
      UNION ALL SELECT to_jsonb(t) FROM account_charge t UNION ALL SELECT to_jsonb(t) FROM account_payment t) facts`)).rows[0].hash
    const before = await fingerprint(), queries=[]
    const tracked={connect:async()=>{const db=await pool.connect();return {release:()=>db.release(),query:async(sql,args)=>{
      queries.push(sql)
      if(sql.includes('new-admin:billing-dashboard')) assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on')
      return db.query(sql,args)
    }}}}
    const data = await loadBillingDashboard(tracked,1,new Date('2026-11-10T12:00:00Z'))
    assert.equal(data.summary.twelveMonthIncomeCents,9500)
    assert.equal(data.summary.lastMonthIncomeCents,1000)
    assert.equal(data.months.find(row=>row.key==='2026-09').receiptsCents,6000)
    assert.equal(data.months.find(row=>row.key==='2026-09').breakdowns.class.Team,6000)
    assert.equal(data.months.find(row=>row.key==='2026-02').breakdowns.class['Historical Team'],3000)
    assert.equal(data.months.find(row=>row.key==='2026-10').breakdowns.class.Team,-1000)
    assert.equal(data.unpaid.length,1)
    assert.equal(data.unpaid[0].overdueCents,4000)
    assert.equal(data.unpaid[0].currentCents,5000)
    assert.equal(data.credits.length,1)
    assert.equal(data.credits[0].creditCents,2000)
    assert.equal(queries.filter(sql=>sql.includes('new-admin:billing-dashboard')).length,1)
    for(const month of data.months) for(const group of Object.values(month.breakdowns)) assert.equal(Object.values(group).reduce((sum,value)=>sum+value,0),month.netCents)
    assert.equal(await fingerprint(),before)
    const foreign=await loadBillingDashboard(pool,2,new Date('2026-11-10T12:00:00Z'))
    assert.equal(foreign.summary.twelveMonthIncomeCents,1999998)
    await assert.rejects(loadBillingDashboard(pool,999999),/Facility not found/)
  } finally {
    await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end()
  }
})
