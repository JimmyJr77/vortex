import { listCustomerBillingOverviews } from '../customerBillingOverviewList.js'
import { findFulfilledThenWaivedCheckout } from '../waivedCheckoutReallocation.js'
import { listPaymentRefundCharges, previewSelectedChargeRefund, createSelectedChargeRefund, correctRefundToPreserveClassCharge } from '../customerBillingRefundSelection.js'
import { findCompletedPaidCheckoutFulfillmentGap } from '../paidCheckoutCollectionGuard.js'
import { findFullyRefundedWaivedCheckout } from '../refundedCheckoutDischarge.js'
import { completeEnrollmentAutoBilling } from '../enrollmentAutoBilling.js'
import { finalizeRefundLedgerTreatment, collectLedgerChargeWithSavedCard, checkoutAmountForBillingCharge } from '../customerBillingPayments.js'
import { previewCustomerBillingEnrollmentCancellation } from '../customerBillingEnrollmentCancellation.js'
import { reassessBillingAllocations } from '../reassessBillingAllocations.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import pg from 'pg'
import { reconcileCanonicalRecurringChargesForMonth } from '../canonicalRecurringChargePosting.js'
import { recordBillingActivity } from '../billingActivity.js'
import { loadCanonicalFinancialSnapshot } from '../canonicalBillingAccount.js'
import { listCustomerBillingTransactions, listMemberCustomerBillingTransactions } from '../customerBillingQueries.js'
import { reserveBillingPaymentAttempt } from '../paymentAttemptReservations.js'
import { ensureRecurringEnrollmentMappings } from '../recurringEnrollmentMappings.js'
import { createLocalHouseholdInvoice } from '../householdMonthlyInvoice.js'
import { repairBillingAdministration } from '../billingAdministrativeRepair.js'
import { allocateHouseholdPaymentsLocked } from '../paymentAllocation.js'

const url = process.env.BILLING_TURNOVER_TEST_DATABASE_URL
const enabled = Boolean(url)
let db
const quote = (value) => '"' + value.replaceAll('"','""') + '"'
async function insert(table, values) {
  const columns = Object.keys(values)
  const result = await db.query(`INSERT INTO ${quote(table)} (${columns.map(quote).join(',')})
    VALUES (${columns.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`, Object.values(values))
  return result.rows[0]
}
async function seedAccount() {
  await insert('facility', {id:1,name:'Fixture gym',timezone:'America/New_York'})
  await insert('family', {id:1,facility_id:1,family_name:'Synthetic family'})
  await insert('member', {id:1,facility_id:1,family_id:1,first_name:'Synthetic',last_name:'Athlete',is_active:true})
  await insert('family_billing_account', {id:1,family_id:1,payer_member_id:1,is_active:true,household_monthly_billing_enabled:true})
}
async function charge(id, amount, extra = {}) {
  return insert('billing_charge', {id, family_billing_account_id:1, member_id:1, source_type:'fixture',
    description:'Synthetic charge',amount_cents:amount,gross_amount_cents:amount,discount_amount_cents:0,...extra})
}
async function payment(id, amount) {
  return insert('billing_payment',{id,family_billing_account_id:1,amount_cents:amount,external_status:'settled'})
}
async function allocation(paymentId, chargeId, amount) {
  return insert('billing_payment_application',{billing_payment_id:paymentId,billing_charge_id:chargeId,amount_cents:amount,application_kind:'application'})
}

// Dedicated loopback database only. These tests never read credentials or
// production rows, and each test uses its own schema.
test('billing turnover PostgreSQL regressions', {skip:!enabled}, async (t) => {
  const parsed = new URL(url)
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(parsed.hostname))
  assert.equal(parsed.pathname, '/vortex_billing_test')
  assert.equal(parsed.search, '')
  db = new pg.Client({connectionString:url})
  await db.connect()
  db.release = () => {} // already connected, caller-owned session
  let index = 0
  t.beforeEach(async () => {
    const schema = `turnover_${process.pid}_${++index}`
    await db.query(`CREATE SCHEMA ${quote(schema)}`)
    await db.query(`SET search_path TO ${quote(schema)}`)
    const sql = (await fs.readFile(new URL('./fixtures/turnover-schema.sql',import.meta.url),'utf8')).replaceAll('public.', '')
    await db.query(sql)
    await db.query(await fs.readFile(new URL('../../migrations/835_refund_preserve_charge_balance.sql',import.meta.url),'utf8'))
    await seedAccount()
  })
  t.afterEach(async () => {
    await db.query('ROLLBACK')
    await db.query(`DROP SCHEMA ${quote(`turnover_${process.pid}_${index}`)} CASCADE`)
  })
  t.after(async () => { await db.end() })

  await t.test('overview nets a waived membership into its original month and retains applied payments', async () => {
    await charge(1,38000,{service_period_start:'2026-10-01'})
    await charge(2,8500,{service_period_start:'2026-10-01'})
    await charge(3,-8500,{source_type:'charge_adjustment',related_charge_id:2,service_period_start:'2026-11-01'})
    await payment(1,38000)
    await allocation(1,1,38000)
    // Execute the actual overview aggregate queries against PostgreSQL.
    const aggregates=[]
    const scoped={query:async(sql,params)=>{
      if(sql.includes('fba.payer_member_id,')) return {rows:[{family_id:1,billing_account_id:1,facility_timezone:'America/New_York'}]}
      if(sql.includes('AS billed_cents') || sql.includes('WITH payment_application_totals AS')) {
        aggregates.push(sql)
        return db.query(sql,params)
      }
      return {rows:[]}
    }}
    const overview=await listCustomerBillingOverviews(scoped,{facilityId:1,asOf:new Date('2026-10-06T16:00:00Z')})
    assert.equal(aggregates.length,2)
    assert.deepEqual(overview.families[0].months['2026-10'],{billedCents:38000,paidCents:38000,source:'ledger'})
    assert.equal(overview.families[0].upcomingPaidCents,0)
  })

  await t.test('initial enrollment saved-card collection is exact and replay cannot collect twice', async () => {
    await db.query("UPDATE family_billing_account SET stripe_customer_id='cus_fixture' WHERE id=1")
    const bill = await charge(1,10000,{source_type:'scheduling_signup',source_id:'1',service_period_start:'2026-10-01',service_period_end:'2026-10-31'})
    const account = (await db.query('SELECT * FROM family_billing_account WHERE id=1')).rows[0]
    assert.equal(await checkoutAmountForBillingCharge(db,{account,charge:bill,requireManualCharge:false}),10000)
    await assert.rejects(checkoutAmountForBillingCharge(db,{account:{id:2},charge:bill,requireManualCharge:false}),/already paid/)
    let creates=0
    const method={id:'pm_fixture',type:'card',customer:'cus_fixture',card:{exp_month:12,exp_year:2035,last4:'4242',brand:'visa'}}
    const stripe={customers:{retrieve:async()=>({id:'cus_fixture',invoice_settings:{default_payment_method:method}})},
      paymentMethods:{retrieve:async()=>method},paymentIntents:{create:async(params)=>{
        creates++;assert.equal(params.amount,10000);assert.equal(params.off_session,true)
        return {id:'pi_fixture',object:'payment_intent',created:1790856000,status:'succeeded',amount:10000,amount_received:10000,
          currency:'usd',customer:'cus_fixture',payment_method:method,latest_charge:{id:'ch_fixture',created:1790856000,paid:true,status:'succeeded'},metadata:params.metadata}
      }}}
    const options={account,charge:bill,stripeClient:stripe,attemptKey:'initial-fixture',
      authorization:{source:'enrollment_automatic_billing',date:'2026-10-01',note:'Fixture enrollment',confirmed:true,confirmedAmountCents:10000}}
    const first=await collectLedgerChargeWithSavedCard(db,options)
    assert.ok(first.payment.id)
    const replay=await collectLedgerChargeWithSavedCard(db,options)
    assert.equal(Number(replay.payment.id),Number(first.payment.id))
    assert.equal(creates,1)
    assert.equal((await db.query('SELECT count(*)::int n FROM billing_payment')).rows[0].n,1)
    assert.equal((await db.query('SELECT SUM(amount_cents)::int n FROM billing_payment_application')).rows[0].n,10000)
  })

  await t.test('automatic enrollment collects only its own unpaid initial and annual bills', async () => {
    await db.query("UPDATE family_billing_account SET stripe_customer_id='cus_fixture' WHERE id=1")
    const run=await insert('billing_migration_run',{migration_key:'fixture',mode:'shadow'})
    await insert('billing_account_migration',{billing_migration_run_id:run.id,family_billing_account_id:1,state:'verified',verified_at:new Date(),cutover_month:'2026-01-01'})
    await insert('scheduling_form',{id:1,title:'Fixture'})
    await insert('scheduling_signup',{id:1,form_id:1,member_id:1,status:'confirmed'})
    await charge(1,10000,{source_type:'scheduling_signup',source_id:'1'})
    await charge(2,8500,{source_type:'additional_fee',source_id:'1:1:2027-10-01'})
    await charge(3,5000,{source_type:'scheduling_signup',source_id:'2',stripe_checkout_session_id:'cs_existing'})
    await charge(4,15000,{source_type:'billing_subscription',source_id:'1:2026-11',metadata:{provisionalBilling:true}})
    // Equal-price moves are replacements, even when their original payment
    // was misallocated and the replacement charge therefore looks unpaid.
    await insert('scheduling_signup',{id:3,form_id:1,member_id:1,status:'confirmed'})
    await insert('scheduling_signup',{id:4,form_id:1,member_id:1,status:'confirmed'})
    await charge(5,12000,{source_type:'scheduling_signup',source_id:'3',metadata:{classMoveFromSignupId:109}})
    await charge(6,12000,{source_type:'scheduling_signup',source_id:'4',metadata:{classTransfer:{direction:'in'}}})
    let creates=0
    const method={id:'pm_fixture',type:'card',customer:'cus_fixture',card:{exp_month:12,exp_year:2035,last4:'4242',brand:'visa'}}
    const stripe={customers:{retrieve:async()=>({id:'cus_fixture',invoice_settings:{default_payment_method:method}})},
      paymentMethods:{retrieve:async()=>method},paymentIntents:{create:async(params)=>{
        creates++;return {id:`pi_fixture_${creates}`,object:'payment_intent',status:'succeeded',amount:params.amount,
          amount_received:params.amount,currency:'usd',customer:'cus_fixture',payment_method:method,
          latest_charge:{id:`ch_fixture_${creates}`,created:1790856000,paid:true,status:'succeeded'},metadata:params.metadata}
      }}}
    const options={accountId:1,signupIds:null,stripe,environment:{BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED:'true'}}
    assert.equal((await completeEnrollmentAutoBilling(db,options)).paymentCount,2)
    assert.equal((await completeEnrollmentAutoBilling(db,options)).paymentCount,0)
    assert.equal(creates,2)
    assert.equal((await db.query('SELECT SUM(amount_cents)::int n FROM billing_payment')).rows[0].n,18500)
    assert.deepEqual((await db.query('SELECT DISTINCT billing_charge_id::int id FROM billing_payment_application ORDER BY id')).rows.map(r=>r.id),[1,2])
  })

  await t.test('October catch-up invoices leave pre-posted November tuition for November', async () => {
    await charge(1,10000,{charge_type:'recurring',service_period_start:'2026-09-01'})
    await charge(2,20000,{charge_type:'recurring',service_period_start:'2026-10-01'})
    await charge(3,30000,{charge_type:'recurring',service_period_start:'2026-11-01',metadata:{provisionalBilling:true}})
    await charge(4,-5000,{charge_type:'credit'})
    const october=await createLocalHouseholdInvoice(db,{accountId:1,billingMonth:'2026-10-01'})
    assert.equal(october.invoice.total_cents,25000)
    assert.deepEqual(october.lines.map(line=>Number(line.billing_charge_id)),[1,2,4])
    const replay=await createLocalHouseholdInvoice(db,{accountId:1,billingMonth:'2026-10-01'})
    assert.equal(Number(replay.invoice.id),Number(october.invoice.id))
    await payment(1,25000)
    await allocation(1,1,5000)
    await allocation(1,2,20000)
    await insert('billing_charge_credit_application',{
      billing_monthly_invoice_id:october.invoice.id,idempotency_key:'october-credit',
      credit_invoice_line_id:october.lines[2].id,target_invoice_line_id:october.lines[0].id,amount_cents:5000,
    })
    await db.query("UPDATE billing_monthly_invoice SET status='paid' WHERE id=$1",[october.invoice.id])
    const november=await createLocalHouseholdInvoice(db,{accountId:1,billingMonth:'2026-11-01'})
    assert.equal(november.invoice.total_cents,30000)
    assert.deepEqual(november.lines.map(line=>Number(line.billing_charge_id)),[3])
  })

  await t.test('paid October enrollment cannot cause November tuition to be collected by October catch-up', async () => {
    await charge(1,25500,{charge_type:'recurring',service_period_start:'2026-10-01'})
    await payment(1,25500)
    await allocation(1,1,25500)
    await charge(2,25500,{charge_type:'recurring',service_period_start:'2026-11-01',metadata:{provisionalBilling:true}})
    const october=await createLocalHouseholdInvoice(db,{accountId:1,billingMonth:'2026-10-01'})
    assert.equal(october.invoice,null)
    assert.equal((await db.query('SELECT count(*)::int n FROM billing_monthly_invoice')).rows[0].n,0)
    const november=await createLocalHouseholdInvoice(db,{accountId:1,billingMonth:'2026-11-01'})
    assert.equal(november.invoice.total_cents,25500)
    assert.deepEqual(november.lines.map(line=>Number(line.billing_charge_id)),[2])
  })

  for (const status of ['draft', 'open', 'failed', 'payment_method_required']) {
    await t.test(`balance payment cannot substitute November tuition for an unresolved ${status} October invoice`, async () => {
      await charge(1,40000,{charge_type:'recurring',service_period_start:'2026-10-01'})
      await charge(2,40000,{charge_type:'recurring',service_period_start:'2026-11-01',metadata:{provisionalBilling:true}})
      const invoice=await insert('billing_monthly_invoice',{family_billing_account_id:1,billing_month:'2026-10-01',status,total_cents:40000})
      await insert('billing_monthly_invoice_line',{billing_monthly_invoice_id:invoice.id,billing_charge_id:1,line_type:'charge',description:'October tuition',amount_cents:40000})
      for (const attemptType of ['member_balance_checkout','admin_balance_checkout','admin_balance_saved_card']) {
        await assert.rejects(reserveBillingPaymentAttempt(db,{
          accountId:1,attemptType,amountCents:40000,requestKey:`october-${attemptType}`,
        }), {code:'BILLING_MONTHLY_INVOICE_REQUIRES_RESOLUTION'})
      }
      assert.equal((await db.query('SELECT count(*)::int n FROM billing_payment_attempt')).rows[0].n,0)
      assert.equal((await db.query('SELECT count(*)::int n FROM billing_payment_attempt_charge')).rows[0].n,0)
      // Once the invoice is settled, an explicit balance payment is allowed.
      await payment(1,40000)
      await allocation(1,1,40000)
      await db.query("UPDATE billing_monthly_invoice SET status='paid' WHERE id=$1",[invoice.id])
      const reservation=await reserveBillingPaymentAttempt(db,{accountId:1,attemptType:'member_balance_checkout',amountCents:40000,requestKey:'after-invoice-paid'})
      const rows=(await db.query('SELECT billing_charge_id FROM billing_payment_attempt_charge WHERE billing_payment_attempt_id=$1',[reservation.id])).rows
      assert.deepEqual(rows.map(row=>Number(row.billing_charge_id)),[2])
    })
  }

  await t.test('paid then waived membership releases cash to other bills without a second payment', async () => {
    await charge(1,8500,{stripe_checkout_session_id:'cs_waived'})
    await charge(2,-8500,{source_type:'charge_adjustment',related_charge_id:1})
    await charge(3,28500)
    await payment(1,8500)
    await db.query("UPDATE billing_payment SET external_processor='stripe',stripe_payment_intent_id='pi_paid',stripe_checkout_session_id='cs_waived' WHERE id=1")
    const options={accountId:1,sessionId:'cs_waived',paymentId:1,amountCents:8500}
    assert.equal(await findFulfilledThenWaivedCheckout(db,options),null,'an unfulfilled purchase cannot be released')
    const app=await insert('billing_payment_application',{billing_payment_id:1,billing_charge_id:1,amount_cents:8500,application_kind:'application',allocation_reason:'annual_membership_checkout_exact'})
    assert.equal(await findFulfilledThenWaivedCheckout(db,options),null,'original cash must be released first')
    await insert('billing_payment_application',{billing_payment_id:1,billing_charge_id:1,amount_cents:8500,application_kind:'reversal',reverses_application_id:app.id,allocation_reason:'effective_charge_reallocation'})
    assert.equal(Number((await findFulfilledThenWaivedCheckout(db,options)).id),1)
    await insert('annual_membership_checkout_request',{family_billing_account_id:1,payer_member_id:1,request_key:'waiver',request_fingerprint:'a'.repeat(64),pricing_snapshot:{},pricing_snapshot_hash:'b'.repeat(64),currency:'usd',expected_amount_cents:8500,stripe_checkout_session_id:'cs_waived',status:'completed'})
    assert.equal(await findCompletedPaidCheckoutFulfillmentGap(db,1),null)
    const allocated=await allocateHouseholdPaymentsLocked(db,{accountId:1,restoreMembershipCredits:false,updateEntitlements:false})
    assert.equal(allocated.blocked,undefined)
    assert.equal(Number(allocated.applications[0].billing_charge_id),3)
    assert.equal(Number(allocated.applications[0].amount_cents),8500)
    assert.equal(await findCompletedPaidCheckoutFulfillmentGap(db,1),null)
    assert.equal((await db.query('SELECT SUM(amount_cents)::int cents FROM billing_charge')).rows[0].cents-8500,20000)
    await db.query('UPDATE billing_charge SET amount_cents=-8000 WHERE id=2')
    assert.ok(await findCompletedPaidCheckoutFulfillmentGap(db,1),'partial waiver remains protected')
    await db.query('UPDATE billing_charge SET amount_cents=-8500 WHERE id=2')
    await insert('billing_refund',{family_billing_account_id:1,payment_id:1,amount_cents:8500,external_status:'succeeded'})
    assert.equal(await findFulfilledThenWaivedCheckout(db,options),null,'refunded cash cannot be reused')
  })

  await t.test('fully refunded waived Checkout requires full refund, zero applications and no remaining bill', async () => {
    await charge(1,11500,{stripe_checkout_session_id:'cs_refunded'})
    await payment(1,11500)
    await db.query("UPDATE billing_payment SET external_processor='stripe',stripe_payment_intent_id='pi_returned',stripe_checkout_session_id='cs_refunded' WHERE id=1")
    const options={accountId:1,sessionId:'cs_refunded',paymentId:1,amountCents:11500}
    assert.equal(await findFullyRefundedWaivedCheckout(db,options),null)
    await charge(2,-11500,{source_type:'charge_adjustment',related_charge_id:1})
    assert.equal(await findFullyRefundedWaivedCheckout(db,options),null)
    await insert('billing_refund',{family_billing_account_id:1,payment_id:1,amount_cents:11500,
      stripe_refund_id:'re_returned',external_status:'succeeded',ledger_treatment:'return_overpayment'})
    assert.equal(Number((await findFullyRefundedWaivedCheckout(db,options)).id),1)
    await allocation(1,1,1)
    assert.equal(await findFullyRefundedWaivedCheckout(db,options),null)
    await db.query('DELETE FROM billing_payment_application')
    await db.query('UPDATE billing_charge SET amount_cents=-11000 WHERE id=2')
    assert.equal(await findFullyRefundedWaivedCheckout(db,options),null)
  })

  await t.test('real charge schema supports provisional recalculation and September replay after October posting', async () => {
    await insert('scheduling_form',{id:1,title:'Synthetic class'})
    await insert('scheduling_signup',{id:1,form_id:1,member_id:1,status:'confirmed',enrollment_start_date:'2026-08-01'})
    await insert('billing_subscription',{id:1,family_billing_account_id:1,member_id:1,source_type:'scheduling_signup',source_id:'1',
      description:'Synthetic class',monthly_amount_cents:15000,discount_amount_cents:0,net_monthly_cents:15000,
      status:'active',start_date:'2026-08-01',next_bill_date:'2026-10-01',anchor_day:1})
    await charge(1,15000,{source_type:'billing_subscription',source_id:'1:2026-09',subscription_id:1,
      charge_type:'recurring',billing_interval:'month',service_period_start:'2026-09-01',service_period_end:'2026-09-30'})
    await charge(2,14000,{source_type:'billing_subscription',source_id:'1:2026-10',subscription_id:1,
      charge_type:'recurring',billing_interval:'month',service_period_start:'2026-10-01',service_period_end:'2026-10-31',metadata:{provisionalBilling:true}})
    // A preexisting target charge with an unadvanced schedule is repaired too.
    const pricingResolver = async () => ({lines:[{signupId:1,subscriptionId:1,memberId:1,grossCents:15000,discountCents:0,netCents:15000}]})
    const options={accountId:1,facilityTimeZone:'America/New_York',now:new Date('2026-09-08T12:00:00Z'),pricingResolver,recurringRun:true}
    const october=await reconcileCanonicalRecurringChargesForMonth(db,{...options,billingMonth:'2026-10-01',apply:true,allowEarlyPosting:true})
    assert.equal(october.verified,true)
    assert.equal((await db.query('SELECT amount_cents FROM billing_charge WHERE id=2')).rows[0].amount_cents,15000)
    const replay=await reconcileCanonicalRecurringChargesForMonth(db,{...options,billingMonth:'2026-09-01',apply:false})
    assert.equal(replay.verified,true)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_charge')).rows[0].n,2)
  })

  await t.test('month-boundary catch-up repairs uncollected provisional bills and retires obsolete lines', async () => {
    await insert('scheduling_form',{id:1,title:'Synthetic enrollment'})
    await insert('scheduling_signup',{id:1,form_id:1,member_id:1,status:'confirmed',enrollment_start_date:'2026-09-01'})
    await insert('billing_subscription',{id:1,family_billing_account_id:1,member_id:1,
      source_type:'scheduling_signup',source_id:'1',description:'Synthetic enrollment',status:'active',
      monthly_amount_cents:15000,net_monthly_cents:15000,discount_amount_cents:0,
      start_date:'2026-09-01',next_bill_date:'2026-11-01',anchor_day:1})
    await charge(1,14000,{source_type:'billing_subscription',source_id:'1:2026-10',subscription_id:1,
      charge_type:'recurring',billing_interval:'month',service_period_start:'2026-10-01',service_period_end:'2026-10-31',metadata:{provisionalBilling:true}})
    await charge(2,9000,{source_type:'billing_subscription',source_id:'retired:2026-10',
      charge_type:'recurring',billing_interval:'month',service_period_start:'2026-10-01',service_period_end:'2026-10-31',metadata:{provisionalBilling:true}})
    const options={accountId:1,billingMonth:'2026-10-01',facilityTimeZone:'America/New_York',
      now:new Date('2026-10-02T12:00:00Z'),apply:true,recurringRun:true,
      pricingResolver:async()=>({lines:[{signupId:1,subscriptionId:1,memberId:1,description:'Synthetic enrollment',grossCents:15000,discountCents:0,netCents:15000}]})}
    assert.equal((await reconcileCanonicalRecurringChargesForMonth(db,options)).verified,true)
    assert.equal((await reconcileCanonicalRecurringChargesForMonth(db,options)).verified,true)
    const rows=(await db.query('SELECT * FROM billing_charge ORDER BY id')).rows
    assert.equal(rows.length,2)
    assert.equal(rows[0].amount_cents,15000)
    assert.equal(rows[1].amount_cents,0)
    assert.equal(rows[1].collection_status,'none')
    assert.equal(rows[1].metadata.provisionalBillingVoided,true)
  })

  await t.test('month-boundary catch-up preserves a paid provisional bill', async () => {
    await charge(1,14000,{source_type:'billing_subscription',source_id:'retired:2026-10',
      charge_type:'recurring',billing_interval:'month',service_period_start:'2026-10-01',service_period_end:'2026-10-31',metadata:{provisionalBilling:true}})
    await payment(1,14000)
    await allocation(1,1,14000)
    await assert.rejects(reconcileCanonicalRecurringChargesForMonth(db,{
      accountId:1,billingMonth:'2026-10-01',facilityTimeZone:'America/New_York',
      now:new Date('2026-10-02T12:00:00Z'),apply:true,pricingResolver:async()=>({lines:[]}),
    }))
    assert.equal((await db.query('SELECT amount_cents FROM billing_charge WHERE id=1')).rows[0].amount_cents,14000)
  })

  await t.test('reconciliation actor obeys the real activity CHECK constraint', async () => {
    const activity=await recordBillingActivity(db,{accountId:1,eventType:'fixture_reconciled',summary:'Synthetic refund reconciliation',actorType:'reconciliation'})
    assert.equal(activity.actor_type,'system')
    assert.equal(activity.details.operationSource,'reconciliation')
  })

  await t.test('hidden transfer credit affects cards and both history opening balances exactly once', async () => {
    await charge(1,12750,{charge_type:'recurring',service_period_start:'2026-09-01'})
    await charge(2,-12750,{source_type:'charge_adjustment',charge_type:'credit',related_charge_id:1,metadata:{customerAuditVisibility:'suppressed'}})
    const snapshot=await loadCanonicalFinancialSnapshot(db,{accountId:1,recurringBillingMonth:'2026-10'})
    const admin=await listCustomerBillingTransactions(db,{accountId:1})
    const member=await listMemberCustomerBillingTransactions(db,{accountId:1})
    assert.equal(snapshot.balanceCents,0)
    assert.equal(snapshot.outstandingBalanceCents,0)
    assert.equal(admin.rows[0].runningBalanceCents,0)
    assert.equal(member.rows[0].runningBalanceCents,0)
  })

  await t.test('a payment on a waived membership moves to valid debt without new charges or money movement', async () => {
    await charge(1,8500)
    await charge(2,-8500,{source_type:'charge_adjustment',related_charge_id:1,charge_type:'credit'})
    await charge(3,8500)
    await payment(1,8500)
    await allocation(1,1,8500)
    const before=(await db.query('SELECT count(*)::int AS n FROM billing_charge')).rows[0].n
    await allocateHouseholdPaymentsLocked(db,{accountId:1,restoreMembershipCredits:false})
    await allocateHouseholdPaymentsLocked(db,{accountId:1,restoreMembershipCredits:false})
    assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_charge')).rows[0].n,before)
    const remaining=(await db.query(`SELECT SUM(CASE WHEN application_kind='reversal' THEN -amount_cents ELSE amount_cents END)::int AS cents FROM billing_payment_application WHERE billing_charge_id=3`)).rows[0].cents
    assert.equal(remaining,8500)
    const snapshot=await loadCanonicalFinancialSnapshot(db,{accountId:1,recurringBillingMonth:'2026-10'})
    assert.equal(snapshot.outstandingBalanceCents,0)
    assert.equal(snapshot.futureCreditsCents,0)
    assert.equal(snapshot.balanceCents,0)
  })
  await t.test('administrative recovery creates only enrollment mappings and is repeatable', async () => {
    await insert('scheduling_form',{id:1,title:'Synthetic enrollment'})
    await insert('scheduling_signup',{id:1,form_id:1,member_id:1,status:'confirmed',enrollment_start_date:'2026-09-06'})
    const pricingResolver=async()=>({lines:[{signupId:1,memberId:1,grossCents:15000,discountCents:2250,netCents:12750}]})
    const options={accountId:1,billingMonth:'2026-10-01',pricingResolver,apply:true}
    const first=await repairBillingAdministration(db,options)
    assert.equal(first.changes[0].kind,'restore_subscription')
    const second=await repairBillingAdministration(db,options)
    assert.equal(second.changes.length,0)
    assert.equal((await db.query('SELECT count(*)::int n FROM billing_subscription')).rows[0].n,1)
    for(const table of ['billing_charge','billing_payment','billing_refund','billing_monthly_invoice'])
      assert.equal((await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,0)
  })

  await t.test('unlinked invoice credit counts toward visible charge status', async () => {
    await charge(1,10000)
    await charge(2,-10000,{charge_type:'credit'})
    const invoice=await insert('billing_monthly_invoice',{family_billing_account_id:1,billing_month:'2026-09-01',status:'paid',total_cents:0})
    const target=await insert('billing_monthly_invoice_line',{billing_monthly_invoice_id:invoice.id,billing_charge_id:1,line_type:'charge',description:'Synthetic charge',amount_cents:10000})
    const credit=await insert('billing_monthly_invoice_line',{billing_monthly_invoice_id:invoice.id,billing_charge_id:2,line_type:'credit',description:'Synthetic credit',amount_cents:-10000})
    await insert('billing_charge_credit_application',{billing_monthly_invoice_id:invoice.id,idempotency_key:'synthetic-credit',credit_invoice_line_id:credit.id,target_invoice_line_id:target.id,amount_cents:10000})
    const history=await listCustomerBillingTransactions(db,{accountId:1})
    const row=history.rows.find(row=>row.entryKind==='charge' && row.refId===1)
    assert.ok(row)
    assert.equal(row.remainingAmountCents,0)
  })

  await t.test('reviewed zero-net corrections release retained money without another refund', async () => {
    await charge(1,25500)
    await charge(2,-19124,{source_type:'initial_enrollment_proration_correction',related_charge_id:1,metadata:{customerAuditVisibility:'suppressed'}})
    await charge(3,19124,{source_type:'initial_enrollment_proration_credit_reversal',related_charge_id:1,metadata:{customerAuditVisibility:'suppressed'}})
    await charge(4,6376,{source_type:'initial_enrollment_proration',related_charge_id:1,metadata:{customerAuditVisibility:'suppressed'}})
    await charge(5,-6376,{source_type:'charge_adjustment',related_charge_id:4,metadata:{customerAuditVisibility:'suppressed'}})
    await payment(1,31876)
    await db.query("UPDATE billing_payment SET stripe_payment_intent_id='pi_synthetic' WHERE id=1")
    await allocation(1,3,19124)
    await allocation(1,4,6376)
    await insert('billing_refund',{family_billing_account_id:1,payment_id:1,amount_cents:6376,
      stripe_refund_id:'re_synthetic',external_status:'reconciliation_required',ledger_treatment:'return_overpayment',
      error_message:'[stripe-refund-ledger-finalization-pending:re_synthetic] Stripe returned the money;'})
    await insert('stripe_billing_alert',{stripe_event_id:'synthetic-refund-failure',family_billing_account_id:1,
      stripe_object_id:'re_synthetic',alert_type:'stripe_refund_reconciliation_failed',severity:'critical',message:'Synthetic failure'})
    const options={accountId:1,billingMonth:'2026-10-01',apply:true,pricingResolver:async()=>({lines:[]}),
      reviewedCorrectionChargeIds:[2,3,4,5],confirmedRemoteRefunds:[{id:'re_synthetic',status:'succeeded',amount:6376,payment_intent:'pi_synthetic'}]}
    await repairBillingAdministration(db,options)
    await repairBillingAdministration(db,options)
    const snapshot=await loadCanonicalFinancialSnapshot(db,{accountId:1,recurringBillingMonth:'2026-10'})
    assert.equal(snapshot.balanceCents,0)
    assert.equal(snapshot.outstandingBalanceCents,0)
    assert.equal(snapshot.futureCreditsCents,0)
    assert.equal((await db.query('SELECT count(*)::int n FROM billing_refund')).rows[0].n,1)
    assert.equal((await db.query('SELECT action_status FROM stripe_billing_alert')).rows[0].action_status,'resolved')
    assert.equal((await db.query('SELECT count(*)::int n FROM billing_charge')).rows[0].n,5)
    const empty=await createLocalHouseholdInvoice(db,{accountId:1,billingMonth:'2026-09-01'})
    assert.equal(empty.created,false)
    await charge(6,25500,{charge_type:'recurring',service_period_start:'2026-10-01',service_period_end:'2026-10-31'})
    const october=await createLocalHouseholdInvoice(db,{accountId:1,billingMonth:'2026-10-01'})
    assert.equal(october.created,true)
    assert.equal(october.invoice.total_cents,25500)
    assert.equal(october.lines.filter(line=>line.line_type==='charge').length,1)
  })

  await t.test('confirmed enrollment without a card or autopay receives recurrence exactly once without a bill', async()=>{
    await db.query('UPDATE family_billing_account SET household_monthly_billing_enabled=false,stripe_customer_id=NULL WHERE id=1')
    await insert('scheduling_form',{id:1,title:'Synthetic monthly class'})
    await insert('scheduling_signup',{id:1,form_id:1,member_id:1,status:'confirmed',enrollment_start_date:'2026-09-06'})
    const options={accountId:1,billingMonth:'2026-10-01',pricingResolver:async()=>({lines:[{signupId:1,subscriptionId:null,grossCents:15000,discountCents:2250,netCents:12750}]})}
    assert.equal((await ensureRecurringEnrollmentMappings(db,options)).createdSubscriptionIds.length,1)
    assert.equal((await ensureRecurringEnrollmentMappings(db,options)).createdSubscriptionIds.length,0)
    const sub=(await db.query('SELECT * FROM billing_subscription')).rows[0]
    assert.equal(sub.status,'active')
    assert.equal(sub.net_monthly_cents,12750)
    assert.equal(sub.stripe_subscription_id,null)
    assert.equal((await db.query('SELECT count(*)::int n FROM billing_charge')).rows[0].n,0)
    assert.equal((await db.query('SELECT count(*)::int n FROM billing_payment')).rows[0].n,0)
  })

  for(const [mode,amount,currentApplied] of [['outstanding',13000,0],['custom',15000,2000],['current',33000,20000]]){
    await t.test(`${mode} payment reserves outstanding service and fees before the current bill`,async()=>{
      const month=(await db.query(`SELECT (date_trunc('month',now() AT TIME ZONE 'America/New_York')
        + CASE WHEN extract(day FROM now() AT TIME ZONE 'America/New_York')>=5 THEN interval '1 month' ELSE interval '0 months' END)::date::text AS month`)).rows[0].month
      await charge(1,20000,{charge_type:'recurring',service_period_start:month,created_at:'2020-01-01'})
      await charge(2,10000,{charge_type:'recurring',service_period_start:'2019-09-01',created_at:'2021-01-01'})
      await charge(3,3000,{charge_type:'one_time',created_at:'2022-01-01'})
      const reservation=await reserveBillingPaymentAttempt(db,{accountId:1,attemptType:'admin_balance_saved_card',amountCents:amount,requestKey:`synthetic-${mode}`,outstandingOnly:mode==='outstanding'})
      const rows=(await db.query('SELECT billing_charge_id,amount_cents FROM billing_payment_attempt_charge WHERE billing_payment_attempt_id=$1',[reservation.id])).rows
      const amounts=new Map(rows.map(row=>[Number(row.billing_charge_id),row.amount_cents]))
      assert.equal(amounts.get(2),10000)
      assert.equal(amounts.get(3),3000)
      assert.equal(amounts.get(1)??0,currentApplied)
      assert.equal((await db.query('SELECT count(*)::int n FROM billing_payment')).rows[0].n,0)
    })
  }

  await t.test('outstanding-only payment cannot fall through to the current recurring bill',async()=>{
    const month=(await db.query(`SELECT (date_trunc('month',now() AT TIME ZONE 'America/New_York')
      + CASE WHEN extract(day FROM now() AT TIME ZONE 'America/New_York')>=5 THEN interval '1 month' ELSE interval '0 months' END)::date::text AS month`)).rows[0].month
    await charge(1,20000,{charge_type:'recurring',service_period_start:month})
    await assert.rejects(reserveBillingPaymentAttempt(db,{accountId:1,attemptType:'admin_balance_saved_card',amountCents:5000,requestKey:'outstanding-only',outstandingOnly:true}),/unreserved account balance/)
    assert.equal((await db.query('SELECT count(*)::int n FROM billing_payment_attempt')).rows[0].n,0)
  })

  await t.test('refresh repairs the Harris-style reversed correction without changing money and is idempotent', async () => {
    await charge(1,5000,{charge_type:'one_time'})
    await charge(2,-562,{charge_type:'credit',metadata:{customerAuditVisibility:'suppressed'}})
    await charge(3,562,{charge_type:'adjustment',related_charge_id:2,source_type:'fixture_reversal',
      metadata:{customerAuditVisibility:'suppressed',reversesChargeId:2}})
    await payment(1,5000)
    await allocation(1,1,4438)
    await allocation(1,3,562)
    const invoice=await insert('billing_monthly_invoice',{family_billing_account_id:1,billing_month:'2026-09-01',status:'paid',total_cents:5000})
    const target=await insert('billing_monthly_invoice_line',{billing_monthly_invoice_id:invoice.id,billing_charge_id:1,line_type:'charge',description:'Drop-in',amount_cents:5000})
    const credit=await insert('billing_monthly_invoice_line',{billing_monthly_invoice_id:invoice.id,billing_charge_id:2,line_type:'credit',description:'Reversed credit',amount_cents:-562})
    await insert('billing_charge_credit_application',{billing_monthly_invoice_id:invoice.id,idempotency_key:'harris-credit',credit_invoice_line_id:credit.id,target_invoice_line_id:target.id,amount_cents:562})
    // Reproduce the live deferred constraint failure, including the legacy
    // invoice credit mapping, before testing its forward migration.
    const legacy=(await fs.readFile(new URL('../../migrations/795_billing_household_invoice_credit_applications.sql',import.meta.url),'utf8'))
    await db.query(legacy.slice(legacy.indexOf('CREATE OR REPLACE FUNCTION validate_billing_payment_application_capacity()')))
    await db.query(`CREATE CONSTRAINT TRIGGER trg_capacity AFTER INSERT OR UPDATE OR DELETE ON billing_payment_application
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_billing_payment_application_capacity()`)
    await assert.rejects(reassessBillingAllocations(db,{accountId:1}),/over-funded/)
    assert.equal((await db.query("SELECT metadata->>'allocationRetired' AS retired FROM billing_charge WHERE id=2")).rows[0].retired,null)
    await db.query(await fs.readFile(new URL('../../migrations/813_billing_retired_credit_payment_capacity.sql',import.meta.url),'utf8'))
    const first=await reassessBillingAllocations(db,{accountId:1})
    assert.equal(first.corrected,true)
    const applied=(await db.query(`SELECT billing_charge_id, SUM(CASE WHEN application_kind='reversal' THEN -amount_cents ELSE amount_cents END)::int AS cents
      FROM billing_payment_application GROUP BY billing_charge_id ORDER BY billing_charge_id`)).rows
    assert.deepEqual(applied.map(row=>[Number(row.billing_charge_id),row.cents]),[[1,5000],[3,0]])
    const count=(await db.query('SELECT count(*)::int AS n FROM billing_payment_application')).rows[0].n
    assert.equal((await reassessBillingAllocations(db,{accountId:1})).corrected,false)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_payment_application')).rows[0].n,count)
    assert.equal((await db.query('SELECT sum(amount_cents)::int AS cents,count(*)::int AS n FROM billing_charge')).rows[0].cents,5000)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_payment')).rows[0].n,1)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_refund')).rows[0].n,0)
    // The migration must still reject a real overpayment on a funded charge.
    await payment(2,100)
    await assert.rejects(allocation(2,1,100),/over-funded/)
  })

  await t.test('refresh defers allocation changes while collection is reserved', async () => {
    await charge(1,5000,{charge_type:'one_time'})
    await reserveBillingPaymentAttempt(db,{accountId:1,attemptType:'admin_balance_saved_card',requestKey:'refresh-busy-fixture',amountCents:5000})
    const result=await reassessBillingAllocations(db,{accountId:1})
    assert.equal(result.corrected,false)
    assert.match(result.message,/active collection/)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_payment_application')).rows[0].n,0)
  })

  await t.test('beginning-of-month cancellation credits net billed tuition even without a class calendar', async () => {
    await insert('scheduling_form',{id:1,title:'Synthetic enrollment'})
    await insert('scheduling_signup',{id:1,form_id:1,member_id:1,status:'confirmed',enrollment_start_date:'2026-09-06'})
    await insert('billing_subscription',{id:1,family_billing_account_id:1,member_id:1,source_type:'scheduling_signup',source_id:'1',
      description:'Synthetic class',monthly_amount_cents:12750,net_monthly_cents:12750,status:'active',start_date:'2026-09-06',next_bill_date:'2026-11-01',anchor_day:1})
    await charge(1,12750,{subscription_id:1,charge_type:'recurring',service_period_start:'2026-09-06'})
    await charge(2,-2500,{charge_type:'credit',source_type:'charge_adjustment',related_charge_id:1,service_period_start:'2026-09-06'})
    await charge(3,12750,{subscription_id:1,charge_type:'recurring',service_period_start:'2026-10-01'})
    await charge(4,8500,{charge_type:'one_time',service_period_start:'2026-09-01'})
    const options={signupId:1,facilityId:1,input:{mode:'beginning_of_month',reason:'Administrative correction'},
      now:new Date('2026-09-09T16:00:00Z'),pricingResolver:async()=>({lines:[]})}
    const preview=await previewCustomerBillingEnrollmentCancellation(db,options)
    assert.equal(preview.effectiveDate,'2026-09-01')
    assert.equal(preview.creditCents,10250)
    assert.equal(preview.creditRatio,1)
    await charge(5,-10250,{subscription_id:1,charge_type:'credit',service_period_start:'2026-09-01'})
    assert.equal((await previewCustomerBillingEnrollmentCancellation(db,options)).creditCents,0)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_charge')).rows[0].n,5)
  })

  await t.test('refund selection excludes unrelated bills and pending refunds, rejects stale totals, and resumes a partial batch', async () => {
    await charge(1,12750)
    await charge(2,12750)
    await charge(3,8500)
    await db.query("SELECT setval(pg_get_serial_sequence('billing_charge','id'), 3)")
    await payment(1,25500)
    await db.query("UPDATE billing_payment SET stripe_payment_intent_id='pi_selection' WHERE id=1")
    await allocation(1,1,12750)
    await allocation(1,2,12750)
    const options={account:{id:1},paymentId:1,relatedChargeIds:[2,1],amountCents:25500,
      ledgerTreatment:'return_payment',actorUserId:1,reason:'Early billing',exceptionCategory:'owner_discretion',
      evidenceNote:'Approved test',idempotencyKey:'selection-test'}
    assert.deepEqual((await listPaymentRefundCharges(db,options)).charges.map(c=>c.id),[1,2])
    const preview=await previewSelectedChargeRefund(db,options)
    assert.equal(preview.amountCents,25500)
    await assert.rejects(previewSelectedChargeRefund(db,{...options,relatedChargeIds:[3]}),/no longer refundable/)
    await assert.rejects(previewSelectedChargeRefund(db,{...options,relatedChargeIds:[1,1]}),/distinct charges/)
    await assert.rejects(previewSelectedChargeRefund(db,{...options,amountCents:100}),/amounts changed/)
    const reserved=await insert('billing_refund',{family_billing_account_id:1,payment_id:1,related_charge_id:2,
      ledger_treatment:'reverse_charge',amount_cents:12750,external_status:'pending'})
    assert.deepEqual((await listPaymentRefundCharges(db,options)).charges.map(c=>c.id),[1])
    await db.query('DELETE FROM billing_refund WHERE id=$1',[reserved.id])
    let interrupt=true
    let processorCalls=0
    const createRefundFunction=async (client, input)=>{
      let refund=(await client.query('SELECT * FROM billing_refund WHERE request_key=$1',[input.idempotencyKey])).rows[0]
      const replayed=Boolean(refund)
      if (!refund) {
        if(input.relatedChargeId===2 && interrupt) throw new Error('Simulated connection interruption')
        processorCalls++
        refund=await insert('billing_refund',{family_billing_account_id:1,payment_id:1,related_charge_id:input.relatedChargeId,
          ledger_treatment:input.ledgerTreatment,amount_cents:input.amountCents,external_status:'succeeded',
          stripe_refund_id:`re_selection_${input.relatedChargeId}`,request_key:input.idempotencyKey})
      }
      refund=await finalizeRefundLedgerTreatment(client,refund,{collectionLockHeld:true,actorType:'system',stripeClient:null})
      return {refund,replayed}
    }
    await assert.rejects(createSelectedChargeRefund(db,options,{createRefundFunction}),/Simulated connection/)
    assert.equal(processorCalls,1)
    await assert.rejects(createSelectedChargeRefund(db,{...options,relatedChargeIds:[2]}, {createRefundFunction}),/different refund details/)
    interrupt=false
    const completed=await createSelectedChargeRefund(db,options,{createRefundFunction})
    assert.equal(completed.refunds.length,2)
    assert.equal(processorCalls,2)
    const replay=await createSelectedChargeRefund(db,options,{createRefundFunction})
    assert.equal(replay.replayed,true)
    assert.equal(processorCalls,2)
    assert.equal((await listPaymentRefundCharges(db,options)).charges.length,0)
    assert.equal((await db.query("SELECT count(*)::int n FROM billing_charge WHERE source_type='refund_offset'")).rows[0].n,0)
    assert.equal((await loadCanonicalFinancialSnapshot(db,{accountId:1,recurringBillingMonth:'2026-11'})).balanceCents,34000)
  })

  await t.test('payment refund keeps tuition and discounts unchanged, restores unpaid balance, and never creates a credit', async () => {
    for (const id of [1,2]) await charge(id,12750,{charge_type:'recurring',billing_interval:'month',gross_amount_cents:15000,discount_amount_cents:2250,service_period_start:'2026-11-01',service_period_end:'2026-11-30'})
    await payment(1,25500)
    await db.query("UPDATE billing_payment SET stripe_payment_intent_id='pi_preserve' WHERE id=1")
    await allocation(1,1,12750)
    await allocation(1,2,12750)
    const preview=await previewSelectedChargeRefund(db,{account:{id:1},paymentId:1,relatedChargeIds:[1,2],amountCents:25500,ledgerTreatment:'return_payment'})
    assert.equal(preview.resultingBalanceCents,25500)
    for (const id of [1,2]) {
      const refund=await insert('billing_refund',{family_billing_account_id:1,payment_id:1,related_charge_id:id,
        amount_cents:12750,external_status:'succeeded',ledger_treatment:'return_payment',stripe_refund_id:`re_preserve_${id}`})
      await finalizeRefundLedgerTreatment(db,refund,{actorType:'system',stripeClient:null})
      await finalizeRefundLedgerTreatment(db,refund.id,{actorType:'system',stripeClient:null})
    }
    const charges=(await db.query('SELECT amount_cents,gross_amount_cents,discount_amount_cents,collection_status FROM billing_charge ORDER BY id')).rows
    assert.deepEqual(charges,[1,2].map(()=>({amount_cents:12750,gross_amount_cents:15000,discount_amount_cents:2250,collection_status:'unpaid'})))
    assert.equal((await loadCanonicalFinancialSnapshot(db,{accountId:1,recurringBillingMonth:'2026-11'})).balanceCents,25500)
  })

  await t.test('correcting a mistaken refund waiver restores the original class bill without another cash refund', async () => {
    await charge(1,12750,{charge_type:'recurring',billing_interval:'month',gross_amount_cents:15000,discount_amount_cents:2250,service_period_start:'2026-11-01',service_period_end:'2026-11-30'})
    await db.query("SELECT setval(pg_get_serial_sequence('billing_charge','id'),1)")
    await payment(1,12750)
    await allocation(1,1,12750)
    const refund=await insert('billing_refund',{family_billing_account_id:1,payment_id:1,related_charge_id:1,amount_cents:12750,
      stripe_refund_id:'re_corrected',external_status:'succeeded',ledger_treatment:'reverse_charge'})
    await finalizeRefundLedgerTreatment(db,refund,{actorType:'system',stripeClient:null})
    const result=await correctRefundToPreserveClassCharge(db,{accountId:1,refundId:refund.id})
    assert.equal(result.restoredCents,12750)
    assert.equal((await correctRefundToPreserveClassCharge(db,{accountId:1,refundId:refund.id})).replayed,true)
    const original=(await db.query('SELECT * FROM billing_charge WHERE id=1')).rows[0]
    assert.equal(original.amount_cents,12750)
    assert.equal(original.discount_amount_cents,2250)
    assert.equal(original.collection_status,'unpaid')
    const history=await listCustomerBillingTransactions(db,{accountId:1})
    const bill=history.rows.find(row=>row.entryKind==='charge' && row.refId===1)
    assert.equal(bill.amountCents,12750)
    assert.equal(bill.status,'unpaid')
    assert.equal(bill.remainingAmountCents,12750)
    assert.ok(!JSON.stringify(bill.details).includes('Refund adjustment'))
    assert.equal((await db.query('SELECT count(*)::int n FROM billing_refund')).rows[0].n,1)
    assert.equal((await loadCanonicalFinancialSnapshot(db,{accountId:1,recurringBillingMonth:'2026-11'})).balanceCents,12750)
  })

  await t.test('charge refund creates its typed offset and reverses only its allocation exactly once', async () => {
    await charge(1,12750)
    await charge(2,12750)
    await db.query("SELECT setval(pg_get_serial_sequence('billing_charge','id'), 2)")
    await payment(1,25500)
    await allocation(1,1,12750)
    await allocation(1,2,12750)
    const refund=await insert('billing_refund',{family_billing_account_id:1,payment_id:1,amount_cents:12750,
      related_charge_id:2,stripe_refund_id:'re_offset_fixture',external_status:'reconciliation_required',ledger_treatment:'reverse_charge',
      error_message:'[stripe-refund-ledger-finalization-pending:re_offset_fixture] Stripe returned the money;'})
    const first=await finalizeRefundLedgerTreatment(db,refund,{actorType:'reconciliation',stripeClient:null})
    assert.equal(first.external_status,'succeeded')
    await finalizeRefundLedgerTreatment(db,refund.id,{actorType:'reconciliation',stripeClient:null})
    const offsets=(await db.query("SELECT amount_cents,related_charge_id FROM billing_charge WHERE source_type='refund_offset'")).rows
    assert.deepEqual(offsets.map(r=>[r.amount_cents,Number(r.related_charge_id)]),[[-12750,2]])
    const reversals=(await db.query("SELECT amount_cents,billing_charge_id FROM billing_payment_application WHERE application_kind='reversal'")).rows
    assert.deepEqual(reversals.map(r=>[r.amount_cents,Number(r.billing_charge_id)]),[[12750,2]])
    const snapshot=await loadCanonicalFinancialSnapshot(db,{accountId:1,recurringBillingMonth:'2026-11'})
    assert.equal(snapshot.balanceCents,0)
  })

  await t.test('completed overpayment refund finalizes with a valid audit actor and replays without duplicate reversals', async () => {
    await charge(1,25500)
    await payment(1,31876)
    await allocation(1,1,25500)
    const refund=await insert('billing_refund',{family_billing_account_id:1,payment_id:1,amount_cents:6376,
      stripe_refund_id:'re_completed_fixture',external_status:'reconciliation_required',ledger_treatment:'return_overpayment',
      error_message:'[stripe-refund-ledger-finalization-pending:re_completed_fixture] Stripe returned the money;'})
    const first=await finalizeRefundLedgerTreatment(db,refund,{actorType:'reconciliation',stripeClient:null})
    assert.equal(first.external_status,'succeeded')
    const second=await finalizeRefundLedgerTreatment(db,refund.id,{actorType:'reconciliation',stripeClient:null})
    assert.equal(second.external_status,'succeeded')
    const activities=(await db.query("SELECT actor_type FROM billing_account_activity WHERE event_type='refund_succeeded'")).rows
    assert.deepEqual(activities,[{actor_type:'system'}])
    assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_payment_application')).rows[0].n,1)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_refund')).rows[0].n,1)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_charge')).rows[0].n,1)
    const snapshot=await loadCanonicalFinancialSnapshot(db,{accountId:1,recurringBillingMonth:'2026-10'})
    assert.equal(snapshot.balanceCents,0)
  })

})
