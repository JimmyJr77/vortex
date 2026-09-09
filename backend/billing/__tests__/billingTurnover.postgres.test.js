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
    await seedAccount()
  })
  t.afterEach(async () => {
    await db.query('ROLLBACK')
    await db.query(`DROP SCHEMA ${quote(`turnover_${process.pid}_${index}`)} CASCADE`)
  })
  t.after(async () => { await db.end() })

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

})
