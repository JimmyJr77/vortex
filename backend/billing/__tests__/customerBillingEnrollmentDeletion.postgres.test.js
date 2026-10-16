import { reconcileCurrentEnrollmentCharges } from '../currentEnrollmentChargePricing.js'
import { releaseBillingPaymentAttempt } from '../paymentAttemptReservations.js'
import { facilityDate } from '../canonicalBillingMigrationState.js'
import { deletionStripeFixture } from './fixtures/enrollmentDeletionStripe.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import pg from 'pg'
import { listCustomerBillingTransactions } from '../customerBillingQueries.js'
import { loadCanonicalFinancialSnapshot } from '../canonicalBillingAccount.js'
import { deleteCustomerBillingEnrollment, previewCustomerBillingEnrollmentDeletion, previewChargeEnrollmentDeletion } from '../customerBillingEnrollmentDeletion.js'

const url = process.env.BILLING_TURNOVER_TEST_DATABASE_URL

test('unpaid enrollment deletion PostgreSQL regression', { skip: !url }, async (t) => {
  const parsed = new URL(url)
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))
  assert.equal(parsed.pathname, '/vortex_billing_test')
  const db = new pg.Client({ connectionString: url })
  await db.connect()
  db.release = () => {}
  let index = 0
  const read = async (path) => fs.readFile(new URL(path, import.meta.url), 'utf8')
  t.beforeEach(async () => {
    await db.query(`CREATE SCHEMA deletion_${process.pid}_${++index}`)
    await db.query(`SET search_path TO deletion_${process.pid}_${index}`)
    await db.query((await read('./fixtures/turnover-schema.sql')).replaceAll('public.', ''))
    // Exercise real FK cascades and the immutable audit triggers, which the
    // lightweight shared turnover fixture intentionally omits.
    await db.query(`
      ALTER TABLE enrollment_price_adjustment ADD CONSTRAINT adjustment_signup_fk FOREIGN KEY (signup_id) REFERENCES scheduling_signup(id);
      ALTER TABLE enrollment_price_adjustment ADD CONSTRAINT adjustment_subscription_fk FOREIGN KEY (billing_subscription_id) REFERENCES billing_subscription(id);
      ALTER TABLE billing_account_activity ADD CONSTRAINT activity_signup_fk FOREIGN KEY (signup_id) REFERENCES scheduling_signup(id) ON DELETE SET NULL;
      ALTER TABLE billing_account_activity ADD CONSTRAINT activity_charge_fk FOREIGN KEY (related_charge_id) REFERENCES billing_charge(id) ON DELETE SET NULL;
      ALTER TABLE billing_monthly_invoice_line ADD CONSTRAINT invoice_charge_fk FOREIGN KEY (billing_charge_id) REFERENCES billing_charge(id);
      ALTER TABLE billing_payment_attempt_charge ADD CONSTRAINT reservation_charge_fk FOREIGN KEY (billing_charge_id) REFERENCES billing_charge(id);
      ALTER TABLE billing_payment_attempt ADD CONSTRAINT attempt_target_fk FOREIGN KEY (target_charge_id) REFERENCES billing_charge(id);
      CREATE TABLE enrollment_cancellation_request (signup_id bigint REFERENCES scheduling_signup(id));
      CREATE TABLE member_missed_class (scheduling_signup_id bigint REFERENCES scheduling_signup(id));
    `)
    await db.query(await read('../../migrations/837_unpaid_enrollment_deletion.sql'))
    await db.query(await read('../../migrations/838_enrollment_deletion_stripe_reconciliation.sql'))
    const reservationsMigration = await read('../../migrations/789_billing_payment_attempt_reservations.sql')
    await db.query(reservationsMigration.slice(reservationsMigration.indexOf('CREATE OR REPLACE FUNCTION validate_billing_payment_attempt_reservation_total()'), reservationsMigration.indexOf('-- Every payment allocation path')))

    await db.query(`
      CREATE TRIGGER invoice_immutable BEFORE UPDATE OR DELETE ON billing_monthly_invoice_line FOR EACH ROW EXECUTE FUNCTION reject_billing_monthly_invoice_line_mutation();
      CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON billing_account_activity FOR EACH ROW EXECUTE FUNCTION reject_billing_account_activity_mutation();
      CREATE TRIGGER adjustment_immutable BEFORE UPDATE OR DELETE ON enrollment_price_adjustment FOR EACH ROW EXECUTE FUNCTION guard_enrollment_price_adjustment_mutation();
      INSERT INTO facility (id,name,timezone) VALUES (1,'Test gym','America/New_York');
      INSERT INTO family (id,facility_id,family_name) VALUES (1,1,'Test family');
      INSERT INTO member (id,facility_id,family_id,first_name,last_name,is_active) VALUES (1,1,1,'Test','Member',true);
      INSERT INTO family_billing_account (id,family_id,payer_member_id,is_active,household_monthly_billing_enabled) VALUES (1,1,1,true,true);
      INSERT INTO scheduling_form (id,title) VALUES (1,'Test class');
      INSERT INTO scheduling_signup (id,form_id,member_id) VALUES (1,1,1),(2,1,1);
      INSERT INTO billing_subscription (id,family_billing_account_id,member_id,source_type,source_id,description,status,net_monthly_cents)
        VALUES (1,1,1,'scheduling_signup','1','Unpaid class','cancelled',10000), (2,1,1,'scheduling_signup','2','Paid class','cancelled',20000);
      INSERT INTO billing_charge (id,family_billing_account_id,member_id,source_type,source_id,subscription_id,description,amount_cents)
        VALUES (1,1,1,'scheduling_signup','1',1,'Unpaid enrollment',10000),(2,1,1,'scheduling_signup','2',2,'Paid enrollment',20000);
      INSERT INTO billing_payment (id,family_billing_account_id,amount_cents,external_status) VALUES (1,1,20000,'settled');
      INSERT INTO billing_payment_application (billing_payment_id,billing_charge_id,amount_cents,application_kind) VALUES (1,2,20000,'application');
    `)
  })
  t.afterEach(async () => {
    await db.query('ROLLBACK')
    await db.query(`DROP SCHEMA deletion_${process.pid}_${index} CASCADE`)
  })
  t.after(() => db.end())
  const params = { signupId: 1, facilityId: 1, actorUserId: 7, stripeClient: null }

  await t.test('deletes an unpaid class and corrections, recalculates ledger, and preserves paid sibling and audit evidence', async () => {
    await db.query(`INSERT INTO billing_charge (id,family_billing_account_id,member_id,source_type,related_charge_id,description,amount_cents)
      VALUES (3,1,1,'charge_adjustment',1,'Discount',-1000);
      INSERT INTO billing_account_activity (family_billing_account_id,signup_id,related_charge_id,event_type,summary) VALUES (1,1,1,'created','Original audit');
      INSERT INTO enrollment_price_adjustment (family_billing_account_id,signup_id,billing_subscription_id,kind,final_price_cents,effective_from_month,reason)
      VALUES (1,1,1,'fixed_final_price',9000,'2026-10-01','Correction');`)
    const preview = await previewCustomerBillingEnrollmentDeletion(db, params)
    assert.deepEqual(preview, { signupId: 1, canDelete: true, reason: null, removedAmountCents: 9000 })
    const result = await deleteCustomerBillingEnrollment(db, params)
    assert.equal(result.removedChargeCount, 2)
    assert.equal((await db.query('SELECT id FROM scheduling_signup ORDER BY id')).rows.length, 1)
    assert.deepEqual((await db.query('SELECT id,amount_cents FROM billing_charge')).rows, [{id:'2',amount_cents:20000}])
    assert.equal((await db.query('SELECT SUM(amount_cents) FROM billing_charge')).rows[0].sum, '20000')
    assert.equal((await db.query('SELECT SUM(amount_cents) FROM billing_payment')).rows[0].sum, '20000')
    const history = await listCustomerBillingTransactions(db, { accountId: 1 })
    assert.deepEqual(history.rows.filter((row) => row.entryKind === 'charge').map((row) => row.refId), [2])
    const snapshot = await loadCanonicalFinancialSnapshot(db, { accountId: 1 })
    assert.equal(snapshot.balanceCents, 0)
    assert.equal(snapshot.outstandingBalanceCents, 0)
    const audit = (await db.query("SELECT * FROM billing_account_activity WHERE event_type='created'")).rows[0]
    assert.equal(audit.signup_id, null)
    assert.equal(audit.related_charge_id, null)
    assert.equal(audit.summary, 'Original audit')
    const adjustment = (await db.query('SELECT * FROM enrollment_price_adjustment')).rows[0]
    assert.equal(adjustment.signup_id, null)
    assert.equal(adjustment.billing_subscription_id, null)
    await assert.rejects(db.query("UPDATE billing_account_activity SET summary='changed'"), /append-only/)
    await assert.rejects(db.query('UPDATE enrollment_price_adjustment SET final_price_cents=1'), /immutable/)
  })
  await t.test('unissued invoice lines disappear and invoice totals recalculate', async () => {
    await db.query(`INSERT INTO billing_monthly_invoice (id,family_billing_account_id,billing_month,status,subtotal_cents,total_cents)
      VALUES (1,1,'2026-10-01','draft',30000,30000);
      INSERT INTO billing_monthly_invoice_line (billing_monthly_invoice_id,billing_charge_id,member_id,line_type,description,amount_cents)
      VALUES (1,1,1,'charge','Unpaid class',10000),(1,2,1,'charge','Other class',20000);`)
    await assert.rejects(db.query('DELETE FROM billing_monthly_invoice_line WHERE billing_charge_id=1'), /cannot be deleted/)
    assert.equal((await previewChargeEnrollmentDeletion(db, {chargeId:1,facilityId:1})).canDelete, true)
    await deleteCustomerBillingEnrollment(db, params)
    assert.equal((await db.query('SELECT total_cents FROM billing_monthly_invoice')).rows[0].total_cents, 20000)
    assert.equal((await db.query('SELECT COUNT(*) FROM billing_monthly_invoice_line')).rows[0].count, '1')
  })
  await t.test('an issued invoice blocks deletion until its collection records are reconciled', async () => {
    await db.query(`INSERT INTO billing_monthly_invoice (id,family_billing_account_id,billing_month,status,stripe_invoice_id)
      VALUES (1,1,'2026-10-01','open','in_active');
      INSERT INTO billing_monthly_invoice_line (billing_monthly_invoice_id,billing_charge_id,member_id,line_type,description,amount_cents)
      VALUES (1,1,1,'charge','Unpaid class',10000);`)
    await assert.rejects(deleteCustomerBillingEnrollment(db, params), /Stripe is unavailable/)
    assert.equal((await db.query('SELECT COUNT(*) FROM billing_charge')).rows[0].count, '2')
  })
  await t.test('Stripe invoice retirement preserves snapshots, publishes remaining charges, and replays deletion', async () => {
    await db.query(`UPDATE family_billing_account SET stripe_customer_id='cus_1' WHERE id=1;
      INSERT INTO billing_monthly_invoice (id,family_billing_account_id,billing_month,status,stripe_invoice_id,total_cents,subtotal_cents)
      VALUES (1,1,'2026-10-01','open','in_1',30000,30000);
      INSERT INTO billing_monthly_invoice_line (billing_monthly_invoice_id,billing_charge_id,member_id,line_type,description,amount_cents)
      VALUES (1,1,1,'charge','Unpaid class',10000),(1,2,1,'charge','Paid class',20000);`)
    const stripe = deletionStripeFixture()
    stripe.invoiceItems.list = async () => ({data:[{id:'ii_1',amount:10000,metadata:{monthlyInvoiceId:'1',monthlyInvoiceLineId:'1'}},{id:'ii_2',amount:20000,metadata:{monthlyInvoiceId:'1',monthlyInvoiceLineId:'2'}}],has_more:false})
    let replacementCount = 0
    const options = { ...params, stripeClient: stripe, replaceInvoice: async (client, options) => {
      assert.equal(options.publishOnly, true)
      assert.deepEqual((await client.query('SELECT id FROM billing_charge')).rows, [{id:'2'}])
      replacementCount++
      return {invoice:{id:2,status:'open'}}
    } }
    const result = await deleteCustomerBillingEnrollment(db, options)
    assert.equal(result.reconciliationPending, undefined)
    assert.equal(replacementCount, 1)
    const oldLine = (await db.query('SELECT * FROM billing_monthly_invoice_line WHERE deleted_charge_id=1')).rows[0]
    assert.equal(oldLine.billing_charge_id, null)
    assert.equal(oldLine.amount_cents, 10000)
    await assert.rejects(db.query("UPDATE billing_monthly_invoice SET status='open' WHERE id=1"), /cannot resume/)
    assert.equal((await deleteCustomerBillingEnrollment(db, options)).replayed, true)
    assert.equal(replacementCount, 1)
  })
  await t.test('canceled payment reservations retain amounts and cannot be revived by delayed events', async () => {
    await db.query(`UPDATE family_billing_account SET stripe_customer_id='cus_1' WHERE id=1;
      INSERT INTO billing_payment_attempt (id,family_billing_account_id,attempt_type,request_key,status,amount_cents,target_charge_id,stripe_payment_intent_id,expires_at)
      VALUES (1,1,'charge_saved_card','test-delete','pending',10000,1,'pi_1',now());
      INSERT INTO billing_payment_attempt_charge (billing_payment_attempt_id,billing_charge_id,amount_cents) VALUES (1,1,10000);
      CREATE TRIGGER reservation_immutable BEFORE UPDATE OR DELETE ON billing_payment_attempt_charge FOR EACH ROW EXECUTE FUNCTION reject_billing_payment_attempt_charge_mutation();`)
    const stripe = deletionStripeFixture()
    await deleteCustomerBillingEnrollment(db, {...params,stripeClient:stripe})
    const reservation = (await db.query('SELECT * FROM billing_payment_attempt_charge')).rows[0]
    assert.equal(reservation.deleted_charge_id, '1')
    assert.equal(reservation.amount_cents,10000)
    assert.equal((await db.query('SELECT status FROM billing_payment_attempt')).rows[0].status,'canceled')
    await assert.rejects(db.query("UPDATE billing_payment_attempt SET status='processing' WHERE id=1"), /cannot resume/)
    const released = await releaseBillingPaymentAttempt(db, { attemptId: 1, status: 'failed',
      stripeObject: { id:'pi_1', object:'payment_intent', status:'canceled' } })
    assert.equal(released.status, 'canceled')
  })
  await t.test('remote success followed by a local failure leaves an enrollment that can safely retry', async () => {
    await db.query(`UPDATE family_billing_account SET stripe_customer_id='cus_1' WHERE id=1;
      UPDATE billing_charge SET stripe_payment_intent_id='pi_1' WHERE id=1;`)
    const stripe=deletionStripeFixture()
    const originalCancel=stripe.paymentIntents.cancel
    stripe.paymentIntents.cancel=async (...args)=>{await originalCancel(...args);throw new Error('timeout after cancellation')}
    await assert.rejects(deleteCustomerBillingEnrollment(db,{...params,stripeClient:stripe}),/timeout/)
    assert.equal((await db.query('SELECT COUNT(*) FROM scheduling_signup')).rows[0].count,'2')
    stripe.paymentIntents.cancel=originalCancel
    await deleteCustomerBillingEnrollment(db,{...params,stripeClient:stripe})
    assert.equal(stripe.calls.filter(call=>call==='cancel:pi_1').length,1)
    assert.equal((await db.query('SELECT COUNT(*) FROM scheduling_signup')).rows[0].count,'1')
  })
  await t.test('draft deleted remotely before a crash resumes from its durable plan', async () => {
    await db.query(`UPDATE family_billing_account SET stripe_customer_id='cus_1' WHERE id=1;
      INSERT INTO billing_monthly_invoice (id,family_billing_account_id,billing_month,status,stripe_invoice_id)
      VALUES (1,1,'2026-10-01','draft','in_1');
      INSERT INTO billing_monthly_invoice_line (billing_monthly_invoice_id,billing_charge_id,member_id,line_type,description,amount_cents)
      VALUES (1,1,1,'charge','Unpaid class',10000);`)
    const stripe=deletionStripeFixture()
    stripe.invoiceState.get('in_1').status='draft'
    const originalDelete=stripe.invoices.del
    stripe.invoices.del=async (...args)=>{await originalDelete(...args);throw new Error('timeout after deleting draft')}
    const options={...params,stripeClient:stripe,replaceInvoice:async()=>({skipped:'no_open_charges'})}
    await assert.rejects(deleteCustomerBillingEnrollment(db,options),/timeout/)
    stripe.invoices.del=originalDelete
    const result=await deleteCustomerBillingEnrollment(db,options)
    assert.equal(result.reconciliationPending,undefined)
    assert.equal(stripe.calls.filter(call=>call==='delete:in_1').length,1)
  })
  await t.test('replacement failure remains durable and retries without repeating deletion', async () => {
    await db.query(`UPDATE family_billing_account SET stripe_customer_id='cus_1' WHERE id=1;
      INSERT INTO billing_monthly_invoice (id,family_billing_account_id,billing_month,status,stripe_invoice_id)
      VALUES (1,1,'2026-10-01','open','in_1');
      INSERT INTO billing_monthly_invoice_line (billing_monthly_invoice_id,billing_charge_id,member_id,line_type,description,amount_cents)
      VALUES (1,1,1,'charge','Unpaid class',10000);`)
    const stripe=deletionStripeFixture()
    stripe.invoiceItems.list=async()=>({data:[{id:'ii_1',amount:10000,metadata:{monthlyInvoiceId:'1',monthlyInvoiceLineId:'1'}}],has_more:false})
    const result=await deleteCustomerBillingEnrollment(db,{...params,stripeClient:stripe,replaceInvoice:async()=>{throw new Error('Stripe timeout')}})
    assert.equal(result.reconciliationPending,true)
    assert.equal((await db.query('SELECT status FROM billing_enrollment_deletion')).rows[0].status,'deleted')
    await deleteCustomerBillingEnrollment(db,{...params,stripeClient:stripe,replaceInvoice:async()=>({skipped:'no_open_charges'})})
    assert.equal((await db.query('SELECT status FROM billing_enrollment_deletion')).rows[0].status,'complete')
    assert.equal(stripe.calls.filter(call=>call==='void:in_1').length,1)
  })
  await t.test('successful deletion recovers earlier account deletions and clears only the verified month alert', async () => {
    const today = facilityDate(new Date(), 'America/New_York')
    if (Number(today.slice(8, 10)) < 5) return
    const next = new Date(`${today.slice(0, 7)}-01T12:00:00Z`)
    next.setUTCMonth(next.getUTCMonth() + 1)
    const month = next.toISOString().slice(0, 10)
    await db.query(`INSERT INTO billing_enrollment_deletion
      (signup_id,family_billing_account_id,facility_id,actor_user_id,status,result,error_message)
      VALUES (99,1,1,7,'deleted','{"signupId":99,"replacementMonths":[]}', 'Old mismatch');
      INSERT INTO stripe_billing_alert (stripe_event_id,family_billing_account_id,alert_type,severity,message)
      VALUES ('enrollment-deletion:99',1,'reconciliation_mismatch','critical','Old mismatch'),
        ('unrelated',1,'webhook_failure','critical','Keep this')`)
    await db.query(`INSERT INTO stripe_billing_alert (stripe_event_id,family_billing_account_id,alert_type,severity,message)
      VALUES ($1,1,'billing_turnover_incomplete','critical','Old mismatch')`, [`billing-turnover:1:${month}`])
    await deleteCustomerBillingEnrollment(db, params)
    const operations = (await db.query('SELECT status FROM billing_enrollment_deletion')).rows
    assert.equal(operations.length, 2)
    assert.ok(operations.every(row => row.status === 'complete'))
    assert.deepEqual((await db.query('SELECT stripe_event_id FROM stripe_billing_alert WHERE resolved_at IS NULL')).rows,
      [{stripe_event_id:'unrelated'}])
  })
  await t.test('same-month household repricing updates existing tuition, itemizes proration, and protects paid bills', async () => {
    await db.query(`UPDATE scheduling_signup SET status='confirmed',slot_group_id=2,time_slot_id=3,enrollment_start_date='2026-10-16';
      UPDATE billing_subscription SET status='active',monthly_amount_cents=15000,net_monthly_cents=12750;
      UPDATE billing_charge SET charge_type='recurring',service_period_start='2026-10-16',service_period_end='2026-10-31';
      UPDATE billing_charge SET amount_cents=9000,gross_amount_cents=11250,discount_amount_cents=2250 WHERE id=1;`)
    const calendarLoader = async () => new Map([[2,[{id:3,slot_group_id:2,form_id:1,schedule_mode:'day',day_of_week:5,
      start_time:'16:00:00',end_time:'17:30:00',is_active:true,sg_is_active:true,form_is_active:true,
      sg_dates_tbd:false,sg_active_start:'2026-07-01',sg_active_end:'2026-12-31',
      form_start_date:'2026-07-01',form_end_date:'2026-12-31',enroll_sites:['athletics']}]]])
    let netCents = 12750
    const pricingResolver = async () => ({lines:[1,2].map(id => ({signupId:id,subscriptionId:id,memberId:1,
      grossCents:15000,netCents,discountCents:15000-netCents}))})
    const options = {familyId:1,now:new Date('2026-10-16T12:00:00Z'),pricingResolver,calendarLoader}
    const paidBefore = (await db.query('SELECT * FROM billing_charge WHERE id=2')).rows[0]
    assert.equal((await reconcileCurrentEnrollmentCharges(db,options)).changes.length,1)
    let current = (await db.query('SELECT * FROM billing_charge WHERE id=1')).rows[0]
    assert.equal(current.amount_cents,9563)
    assert.equal(current.discount_amount_cents,1687)
    assert.deepEqual(current.metadata.discountAnnotations,[
      {kind:'proration',label:'Proration (3 of 4 classes)',amountCents:-3750},
      {kind:'automatic',label:'Automatic discount',amountCents:-1687}])
    assert.equal((await reconcileCurrentEnrollmentCharges(db,options)).changes.length,0)
    await db.query("UPDATE billing_charge SET stripe_checkout_session_id='cs_open',metadata='{}' WHERE id=1")
    assert.equal((await reconcileCurrentEnrollmentCharges(db,options)).changes.length,1)
    assert.equal((await db.query('SELECT amount_cents FROM billing_charge WHERE id=1')).rows[0].amount_cents,9563)
    await db.query('UPDATE billing_charge SET stripe_checkout_session_id=NULL WHERE id=1')
    // Adding another class changes the household tier, including its existing bill.
    netCents=12000
    await reconcileCurrentEnrollmentCharges(db,options)
    current = (await db.query('SELECT * FROM billing_charge WHERE id=1')).rows[0]
    assert.equal(current.amount_cents,9000)
    assert.deepEqual((await db.query('SELECT * FROM billing_charge WHERE id=2')).rows[0],paidBefore)
    const history=await listCustomerBillingTransactions(db,{accountId:1})
    assert.ok(history.rows.find(row=>row.refId===1 && row.entryKind==='charge').discountAnnotations.some(a=>a.kind==='proration'))
    // A checkout link freezes the amount until collection is reconciled.
    await db.query("UPDATE billing_charge SET stripe_checkout_session_id='cs_open' WHERE id=1")
    netCents=15000
    assert.equal((await reconcileCurrentEnrollmentCharges(db,options)).changes.length,0)
    assert.equal((await db.query('SELECT amount_cents FROM billing_charge WHERE id=1')).rows[0].amount_cents,9000)
  })
  for (const amount of [1, 10000]) {
    await t.test(`rejects an enrollment with ${amount} cents paid and rolls back`, async () => {
      await db.query(`INSERT INTO billing_payment_application (billing_payment_id,billing_charge_id,amount_cents,application_kind) VALUES (1,1,$1,'application')`, [amount])
      assert.equal((await previewCustomerBillingEnrollmentDeletion(db, params)).canDelete, false)
      await assert.rejects(deleteCustomerBillingEnrollment(db, params), /payment history/)
      assert.equal((await db.query('SELECT COUNT(*) FROM scheduling_signup')).rows[0].count, '2')
    })
  }
  await t.test('refunding a prior payment never makes the enrollment deletable', async () => {
    await db.query(`INSERT INTO billing_payment_application (billing_payment_id,billing_charge_id,amount_cents,application_kind)
      VALUES (1,1,100,'application');
      INSERT INTO billing_payment_application (billing_payment_id,billing_charge_id,amount_cents,application_kind,reverses_application_id)
      SELECT 1,1,100,'reversal',id FROM billing_payment_application WHERE billing_charge_id=1`)
    await assert.rejects(deleteCustomerBillingEnrollment(db, params), /payment history/)
  })
  await t.test('facility boundary rejects preview and deletion', async () => {
    await assert.rejects(previewCustomerBillingEnrollmentDeletion(db, {...params,facilityId:2}), /not found/)
    await assert.rejects(deleteCustomerBillingEnrollment(db, {...params,facilityId:2}), /not found/)
  })
  await t.test('a checkout link blocks deletion even before payment is recorded', async () => {
    await db.query("UPDATE billing_charge SET stripe_checkout_session_id='cs_pending' WHERE id=1")
    await assert.rejects(deleteCustomerBillingEnrollment(db, params), /Stripe is unavailable/)
  })
})
