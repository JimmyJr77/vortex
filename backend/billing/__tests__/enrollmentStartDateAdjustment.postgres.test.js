import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import pg from 'pg'
import { previewEnrollmentStartDateAdjustment, applyEnrollmentStartDateAdjustment } from '../enrollmentStartDateAdjustment.js'

test('local PostgreSQL date correction updates tuition, preserves payment, replays once and rejects stale previews', {skip:process.env.RUN_START_DATE_LOCAL_TEST!=='true'},async()=>{
 const db=new pg.Client({connectionString:`postgresql://${os.userInfo().username}@127.0.0.1:5432/vortex_new_admin_dev`})
 await db.connect()
 try {
  await db.query('BEGIN')
  const admin=(await db.query("SELECT id FROM app_user WHERE username='admin2'")).rows[0]
  assert.ok(admin,'Run the fictional New Admin seed first')
  const context=(await db.query(`SELECT s.id,s.member_id,b.id AS subscription_id,b.family_billing_account_id,f.facility_id
    FROM scheduling_signup s JOIN billing_subscription b ON b.source_type='scheduling_signup' AND b.source_id=s.id::text
    JOIN family_billing_account a ON a.id=b.family_billing_account_id JOIN family f ON f.id=a.family_id
    WHERE s.id=1 AND s.status='confirmed' AND b.status='active'`)).rows[0]
  assert.ok(context)
  // The interactive demo may contain additional enrollments. Isolate this
  // single-enrollment fixture inside the transaction that is always rolled back.
  await db.query("UPDATE billing_subscription SET status='cancelled' WHERE family_billing_account_id=$1 AND id<>$2",[context.family_billing_account_id,context.subscription_id])
  await db.query("UPDATE discount_rule SET active=FALSE WHERE facility_id=$1 OR facility_id IS NULL",[context.facility_id])
  await db.query("INSERT INTO discount_rule(facility_id,name,type,amount_value,config) VALUES($1,'Local pricing fixture','promo_code',0,'{\"code\":\"UNUSED_LOCAL_FIXTURE\"}')",[context.facility_id])
  const charge=(await db.query(`INSERT INTO billing_charge(family_billing_account_id,member_id,subscription_id,source_type,source_id,description,
    amount_cents,gross_amount_cents,discount_amount_cents,charge_type,billing_interval,service_period_start,service_period_end)
    VALUES($1,$2,$3,'billing_subscription',$4,'Local start-date test',10000,10000,0,'recurring','month','2026-10-01','2026-10-31') RETURNING id`,
    [context.family_billing_account_id,context.member_id,context.subscription_id,`${context.subscription_id}:2026-10`])).rows[0]
  const payment=(await db.query(`INSERT INTO billing_payment(family_billing_account_id,amount_cents,method,external_status,note)
    VALUES($1,10000,'cash','settled','SIMULATED rollback-only start-date test') RETURNING id`,[context.family_billing_account_id])).rows[0]
  await db.query("INSERT INTO billing_payment_application(billing_payment_id,billing_charge_id,amount_cents,application_kind) VALUES($1,$2,10000,'application')",[payment.id,charge.id])
  const args={signupId:Number(context.id),facilityId:Number(context.facility_id),input:{firstBillingDate:'2026-10-15',reason:'Local late-start verification'}}
  const preview=await previewEnrollmentStartDateAdjustment(db,args)
  assert.equal(preview.totalDifferenceCents,-5000)
  const adapter={query:(sql,values)=>db.query(sql==='BEGIN'?'SAVEPOINT date_adjust':sql==='COMMIT'?'RELEASE SAVEPOINT date_adjust':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT date_adjust':sql,values),release(){}}
  const pool={connect:async()=>adapter}
  const request={...args,actorUserId:Number(admin.id),requestKey:'local-date-test',input:{...args.input,previewHash:preview.previewHash}}
  const result=await applyEnrollmentStartDateAdjustment(pool,request)
  assert.equal(result.totalDifferenceCents,-5000)
  const posted=await db.query('SELECT amount_cents FROM billing_charge WHERE related_charge_id=$1',[charge.id])
  assert.deepEqual(posted.rows.map(row=>Number(row.amount_cents)),[-5000])
  assert.equal(Number((await db.query('SELECT amount_cents FROM billing_payment WHERE id=$1',[payment.id])).rows[0].amount_cents),10000)
  const remaining=await db.query("SELECT SUM(CASE WHEN application_kind='reversal' THEN -amount_cents ELSE amount_cents END)::int AS cents FROM billing_payment_application WHERE billing_charge_id=$1",[charge.id])
  assert.equal(remaining.rows[0].cents,5000)
  assert.equal((await applyEnrollmentStartDateAdjustment(pool,request)).replayed,true)
  assert.equal((await db.query('SELECT count(*)::int AS count FROM billing_charge WHERE related_charge_id=$1',[charge.id])).rows[0].count,1)
  await assert.rejects(applyEnrollmentStartDateAdjustment(pool,{...request,requestKey:'different-request'}),/changed since/)
  await assert.rejects(previewEnrollmentStartDateAdjustment(db,{...args,facilityId:99999999}),/could not be found/)
 } finally {await db.query('ROLLBACK');await db.end()}
})
