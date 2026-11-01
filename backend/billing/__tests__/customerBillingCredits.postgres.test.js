import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import pg from 'pg'
import express from 'express'
import { registerCustomerBillingRoutes } from '../customerBillingRoutes.js'
import { createCustomerBillingCustomCharge } from '../customerBillingPayments.js'
import { recordAdminExternalPayment } from '../customerBillingAdminOperations.js'
import { createCustomerBillingCredit } from '../customerBillingCredits.js'
import { loadCanonicalFinancialSnapshot } from '../canonicalBillingAccount.js'
import { listCustomerBillingTransactions } from '../customerBillingQueries.js'
import { allocateHouseholdPaymentsLocked } from '../paymentAllocation.js'
import { createLocalHouseholdInvoice } from '../householdMonthlyInvoice.js'

const url = process.env.BILLING_TURNOVER_TEST_DATABASE_URL
const input = {familyId:1,facilityId:1,actorUserId:7,amountCents:2500,reason:'Missed class adjustment',requestKey:'credit-test-123'}
test('manual credits require a positive amount, reason, staff and replay key', async () => {
  for (const change of [{amountCents:0},{amountCents:-1},{amountCents:1.5},{reason:' '},{actorUserId:null},{requestKey:''}]) {
    await assert.rejects(createCustomerBillingCredit({}, {...input,...change}))
  }
})
test('manual credit ledger, history, audit and next invoice', {skip:!url}, async t => {
  const parsed=new URL(url)
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(parsed.hostname))
  assert.equal(parsed.pathname,'/vortex_billing_test')
  const db=new pg.Client({connectionString:url})
  await db.connect()
  db.release=()=>{}
  const schema=`credit_${process.pid}_${Date.now()}`
  t.after(async()=>{await db.query('ROLLBACK');await db.query(`DROP SCHEMA "${schema}" CASCADE`);await db.end()})
  await db.query(`CREATE SCHEMA "${schema}"`)
  await db.query(`SET search_path TO "${schema}"`)
  await db.query((await fs.readFile(new URL('./fixtures/turnover-schema.sql',import.meta.url),'utf8')).replaceAll('public.',''))
  await db.query(await fs.readFile(new URL('../../migrations/836_monthly_invoice_revisions.sql',import.meta.url),'utf8'))
  await db.query(`CREATE TABLE IF NOT EXISTS app_user (id bigint PRIMARY KEY, full_name text);
    INSERT INTO app_user VALUES (7,'Fixture Staff');
    INSERT INTO facility(id,name,timezone) VALUES(1,'Fixture','America/New_York');
    INSERT INTO family(id,facility_id,family_name) VALUES(1,1,'Fixture');
    INSERT INTO member(id,facility_id,family_id,first_name,last_name,is_active) VALUES(1,1,1,'Fixture','Athlete',true);
    INSERT INTO family_billing_account(id,family_id,payer_member_id,is_active,household_monthly_billing_enabled) VALUES(1,1,1,true,true);
    INSERT INTO billing_charge(family_billing_account_id,member_id,source_type,description,amount_cents,gross_amount_cents,discount_amount_cents,charge_type,service_period_start)
      VALUES(1,1,'fixture','November tuition',10000,10000,0,'recurring','2026-11-01')`)
  await assert.rejects(createCustomerBillingCredit(db,{...input,facilityId:2}),/not found/)
  const app=express()
  registerCustomerBillingRoutes(app,db,{jwtSecret:'fixture',requirePermission:(_pool,_secret,permission)=>{
    const middleware=(_req,_res,next)=>next()
    middleware.permission=permission
    return [middleware]
  }})
  const route=app._router.stack.find(layer=>layer.route?.path==='/api/admin/customer-billing/families/:familyId/credits').route
  assert.equal(route.stack[0].handle.permission,'billing.manage')
  const first=await new Promise((resolve,reject)=>{
    const res={status(code){assert.equal(code,201);return this},json(body){assert.equal(body.success,true);resolve(body.data)}}
    Promise.resolve(route.stack.at(-1).handle({params:{familyId:1},
      platformAuth:{user:{id:7,facility_id:1}},
      body:{...input,actorUserId:999,facilityId:999},get:()=>input.requestKey},res)).catch(reject)
  })
  // The route prefixes the caller key; use that same identity for direct replays.
  input.requestKey=`account-credit:${input.requestKey}`
  assert.equal(first.created,true)
  assert.equal(first.credit.amount_cents,-2500)
  assert.equal(Number(first.credit.created_by_user_id),7)
  assert.equal((await createCustomerBillingCredit(db,input)).created,false)
  await assert.rejects(createCustomerBillingCredit(db,{...input,amountCents:3000}),/different credit/)
  const activity=(await db.query('SELECT * FROM billing_account_activity')).rows
  assert.equal(activity.length,1)
  assert.equal(Number(activity[0].actor_user_id),7)
  assert.equal((await db.query('SELECT count(*)::int n FROM billing_payment')).rows[0].n,0)
  const snapshot=await loadCanonicalFinancialSnapshot(db,{accountId:1,recurringBillingMonth:'2026-11'})
  assert.equal(snapshot.balanceCents,7500)
  assert.equal(snapshot.futureCreditsCents,2500)
  const history=await listCustomerBillingTransactions(db,{accountId:1})
  const credit=history.rows.find(r=>r.refId===Number(first.credit.id)&&r.entryKind==='charge')
  assert.equal(credit.description,'Account credit: Missed class adjustment')
  assert.equal(credit.details.creditCreatedByName,'Fixture Staff')
  assert.equal(credit.status,'posted')
  const invoice=await createLocalHouseholdInvoice(db,{accountId:1,billingMonth:'2026-11-01'})
  assert.equal(invoice.invoice.total_cents,7500)
  assert.equal(invoice.invoice.credit_cents,2500)
  assert.equal((await createLocalHouseholdInvoice(db,{accountId:1,billingMonth:'2026-11-01'})).invoice.id,invoice.invoice.id)
  await assert.rejects(createCustomerBillingCredit(db,{...input,requestKey:'another-credit-123'}),{statusCode:409})
  // Retry remains safe even after an invoice has reserved the original credit.
  assert.equal((await createCustomerBillingCredit(db,input)).created,false)
  await db.query("UPDATE billing_monthly_invoice SET status='void'")
  // A regular balance payment also uses the net amount. Its credit must not
  // show as spendable a second time or reduce next month's invoice again.
  await db.query(`INSERT INTO billing_payment(id,family_billing_account_id,amount_cents,external_status)
    VALUES(1,1,7500,'settled')`)
  await allocateHouseholdPaymentsLocked(db,{accountId:1,restoreMembershipCredits:false,updateEntitlements:false})
  const settled=await loadCanonicalFinancialSnapshot(db,{accountId:1,recurringBillingMonth:'2026-11'})
  assert.equal(settled.balanceCents,0)
  assert.equal(settled.futureCreditsCents,0)
  await db.query(`INSERT INTO billing_charge(family_billing_account_id,member_id,source_type,description,amount_cents,gross_amount_cents,discount_amount_cents,charge_type,service_period_start)
    VALUES(1,1,'fixture','December tuition',10000,10000,0,'recurring','2026-12-01')`)
  const december=await createLocalHouseholdInvoice(db,{accountId:1,billingMonth:'2026-12-01'})
  assert.equal(december.invoice.total_cents,10000)
  await db.query("UPDATE billing_monthly_invoice SET status='void'")
  // An audit write failure must roll the financial entry back too.
  await db.query("ALTER TABLE billing_account_activity ADD CONSTRAINT fail_audit CHECK(event_type <> 'account_credit_created') NOT VALID")
  await assert.rejects(createCustomerBillingCredit(db,{...input,requestKey:'rollback-credit-123'}))
  assert.equal((await db.query("SELECT count(*)::int n FROM billing_charge WHERE source_type='manual_account_credit'")).rows[0].n,1)
  await db.query("INSERT INTO app_user VALUES (8,'Second Staff')")
  const custom=await createCustomerBillingCustomCharge(db,{familyId:1,facilityId:1,actorUserId:7,
    description:'Custom adjustment',amountCents:1000,collectionMethod:'checkout',idempotencyKey:'staff-test'})
  // Replaying from a different logged-in account must preserve the original creator.
  await createCustomerBillingCustomCharge(db,{familyId:1,facilityId:1,actorUserId:8,
    description:'Custom adjustment',amountCents:1000,collectionMethod:'checkout',idempotencyKey:'staff-test'})
  await db.query("SELECT setval(pg_get_serial_sequence('billing_payment','id'),1)")
  const external=await recordAdminExternalPayment(db,{familyId:1,facilityId:1,actorUserId:8,
    requestKey:'external-staff-test',input:{method:'cash',amountCents:100,actorUserId:999}})
  await db.query(`INSERT INTO billing_payment(id,family_billing_account_id,amount_cents,external_status,stripe_payment_intent_id)
    VALUES(50,1,100,'settled','pi_staff_test'),(51,1,100,'settled','pi_automatic')`)
  await db.query(`INSERT INTO billing_payment_attempt(family_billing_account_id,attempt_type,request_key,status,amount_cents,expires_at,stripe_payment_intent_id,metadata)
    VALUES(1,'admin_balance_saved_card','staff-test','succeeded',100,now(),'pi_staff_test','{"actorUserId":7}'),
    (2,'admin_balance_saved_card','other-family','succeeded',100,now(),'pi_automatic','{"actorUserId":8}')`)
  const attributed=(await listCustomerBillingTransactions(db,{accountId:1})).rows
  const chargeRow=attributed.find(r=>r.entryKind==='charge'&&r.refId===Number(custom.charge.id))
  assert.equal(chargeRow.details.actorName,'Fixture Staff')
  assert.equal(chargeRow.details.actorAction,'Created by')
  const cashRow=attributed.find(r=>r.entryKind==='payment'&&r.refId===external.payment.id)
  assert.equal(cashRow.details.actorName,'Second Staff')
  assert.equal(cashRow.details.actorAction,'Recorded by')
  const cardRow=attributed.find(r=>r.entryKind==='payment'&&r.refId===50)
  assert.equal(cardRow.details.actorName,'Fixture Staff')
  assert.equal(cardRow.details.actorAction,'Initiated by')
  assert.equal(attributed.find(r=>r.entryKind==='payment'&&r.refId===51).details.actorName,null)

})
