import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import fs from 'node:fs/promises'
import pg from 'pg'
import { createEnrollmentPriceAdjustment } from '../customerBillingAdjustments.js'
import { billingMonthInTimeZone, addBillingMonths } from '../customerBillingPricing.js'
import { resolveFamilyEnrollmentPricing } from '../familyEnrollmentPricing.js'
import { applyImmediatePause, persistEnrollmentPauseBilling, applyPendingPauseCredits } from '../../scheduling/pauseEnrollmentBilling.js'
import { createSchedulingHandlers } from '../../scheduling/handlers.js'
import { processDueEnrollmentActions } from '../../scheduling/datedEnrollmentActions.js'
import { createLead, saveLead, leadNotes } from '../../newAdmin/leads.js'
import { moveCustomerBillingEnrollmentClass } from '../customerBillingEnrollmentSwap.js'
import { promoteFromWaitlist } from '../../scheduling/waitlist.js'
import { reconcileUpcomingProvisionalChargesForAccount, reconcileCanonicalRecurringChargesForMonth } from '../canonicalRecurringChargePosting.js'

// Uses the fictional local demo only. Every write, including audit and bill entries, rolls back.
test('local enrollment actions preserve history, expire discounts, and credit a pause exactly once', { skip: process.env.RUN_ENROLLMENT_ACTIONS_LOCAL_TEST !== 'true' }, async t => {
  process.env.STRIPE_ENABLED = 'false'
  process.env.BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED = 'false'
  delete process.env.STRIPE_SECRET_KEY
  const rejectRemoteBilling = async () => { throw new Error('External billing is prohibited in local regression tests') }
  const db = new pg.Client({ connectionString: `postgresql://${os.userInfo().username}@127.0.0.1:5432/vortex_new_admin_dev` })
  await db.connect()
  let depth = 0
  const adapter = {
    async query(sql, values) {
      if (sql === 'BEGIN') return db.query(`SAVEPOINT actions_${++depth}`)
      if (sql === 'COMMIT') return db.query(`RELEASE SAVEPOINT actions_${depth--}`)
      if (sql === 'ROLLBACK') { const name = `actions_${depth--}`; await db.query(`ROLLBACK TO SAVEPOINT ${name}`); return db.query(`RELEASE SAVEPOINT ${name}`) }
      return db.query(sql, values)
    },
    release() {},
  }
  const pool = { query: (...args) => adapter.query(...args), connect: async () => adapter }
  try {
    await db.query('BEGIN')
    await db.query(await fs.readFile(new URL('../../migrations/845_dated_enrollment_actions.sql', import.meta.url), 'utf8'))
    await db.query(await fs.readFile(new URL('../../migrations/846_lead_registration_invitations.sql', import.meta.url), 'utf8'))
    const admin = (await db.query("SELECT id FROM app_user WHERE username='admin2'")).rows[0]
    assert.ok(admin, 'Run the fictional local New Admin seed first')
    const context = (await db.query(`SELECT s.id, s.member_id, b.id AS subscription_id, b.family_billing_account_id, b.stripe_subscription_id, f.facility_id, f.id AS family_id
      FROM scheduling_signup s JOIN billing_subscription b ON b.source_type='scheduling_signup' AND b.source_id=s.id::text
      JOIN family_billing_account a ON a.id=b.family_billing_account_id JOIN family f ON f.id=a.family_id
      WHERE s.id=1 AND s.status='confirmed' AND b.status='active'`)).rows[0]
    assert.ok(context)
    assert.equal(context.stripe_subscription_id, null, 'The local fixture must have no Stripe subscription')
    const originalSubscriptions=(await db.query('SELECT id,status FROM billing_subscription WHERE family_billing_account_id=$1 AND id<>$2',[context.family_billing_account_id,context.subscription_id])).rows
    const originalEnrollments=(await db.query('SELECT id,status FROM scheduling_signup WHERE member_id IN(SELECT id FROM member WHERE family_id=$1) AND id<>$2',[context.family_id,context.id])).rows
    await db.query("UPDATE billing_subscription SET status='cancelled' WHERE family_billing_account_id=$1 AND id<>$2", [context.family_billing_account_id, context.subscription_id])
    await db.query("UPDATE scheduling_signup SET status='cancelled' WHERE member_id IN (SELECT id FROM member WHERE family_id=$1) AND id<>$2", [context.family_id, context.id])
    await db.query('UPDATE discount_rule SET active=FALSE WHERE facility_id=$1 OR facility_id IS NULL', [context.facility_id])
    const month = billingMonthInTimeZone(new Date())
    await db.query(`INSERT INTO billing_charge(family_billing_account_id,member_id,subscription_id,source_type,source_id,description,
      amount_cents,gross_amount_cents,discount_amount_cents,charge_type,billing_interval,service_period_start,service_period_end)
      VALUES($1,$2,$3,'fixture_enrollment_actions',$4,'SIMULATED enrollment test',10000,10000,0,'recurring','month',$5::date,($5::date+interval '1 month - 1 day')::date)`,
    [context.family_billing_account_id, context.member_id, context.subscription_id, `test:${context.id}`, month])
    const payment = (await db.query(`INSERT INTO billing_payment(family_billing_account_id,amount_cents,method,external_status,note)
      VALUES($1,10000,'cash','settled','SIMULATED rollback-only enrollment test') RETURNING id`, [context.family_billing_account_id])).rows[0]
    const before = await resolveFamilyEnrollmentPricing(db, { familyId: Number(context.family_id), periodKey: month, ensureSchema: false, strictPricing: true })
    const original = before.lines.find(line => Number(line.signupId) === Number(context.id))
    assert.ok(original?.grossCents > 0)
    const args = { signupId: Number(context.id), facilityId: Number(context.facility_id), actorUserId: Number(admin.id),
      input: { kind: 'enrollment_discount', mode: 'manual', percent: 50, duration: 'once', effectiveFromMonth: month, reason: 'Local duration test', requestKey: 'local-discount-once' } }
    const created = await createEnrollmentPriceAdjustment(pool, args)
    assert.equal(created.adjustment.status, 'active')
    const replay = await createEnrollmentPriceAdjustment(pool, args)
    assert.equal(replay.replayed, true)
    assert.equal(replay.adjustment.id, created.adjustment.id)
    await assert.rejects(createEnrollmentPriceAdjustment(pool, { ...args, input: { ...args.input, percent: 25 } }), /different discount/)
    const discounted = await resolveFamilyEnrollmentPricing(db, { familyId: Number(context.family_id), periodKey: month, ensureSchema: false, strictPricing: true })
    assert.equal(discounted.lines.find(line => Number(line.signupId) === Number(context.id)).netCents, Math.round(original.grossCents / 2))
    const expired = await resolveFamilyEnrollmentPricing(db, { familyId: Number(context.family_id), periodKey: addBillingMonths(month, 1), ensureSchema: false, strictPricing: true })
    assert.equal(expired.lines.find(line => Number(line.signupId) === Number(context.id)).netCents, original.grossCents)
    await db.query('UPDATE billing_subscription SET net_monthly_cents=$2,discount_amount_cents=monthly_amount_cents-$2 WHERE id=$1', [context.subscription_id, Math.round(original.grossCents / 2)])
    await applyImmediatePause(db, context.id, `${month.slice(0, 7)}-15`)
    await persistEnrollmentPauseBilling(db, { signupId: context.id, enteringPaused: true, leavingPaused: false, stripeStatusUpdater: rejectRemoteBilling, asOfDate: `${month.slice(0, 7)}-15` })
    const credits = await db.query('SELECT * FROM billing_pause_credit WHERE scheduling_signup_id=$1 AND service_month=$2', [context.id, month.slice(0, 7)])
    assert.equal(credits.rows.length, 1)
    assert.ok(Number(credits.rows[0].credit_cents) > 0)
    assert.equal(credits.rows[0].apply_on_month, addBillingMonths(month, 1).slice(0, 7))
    assert.equal(credits.rows[0].applied_at, null)
    await persistEnrollmentPauseBilling(db, { signupId: context.id, enteringPaused: true, leavingPaused: false, stripeStatusUpdater: rejectRemoteBilling, asOfDate: `${month.slice(0, 7)}-15` })
    const next = { periodStart: addBillingMonths(month, 1), facilityId: Number(context.facility_id), accountId: Number(context.family_billing_account_id), strict: true }
    await applyPendingPauseCredits(db, next)
    await applyPendingPauseCredits(db, next)
    const posted = await db.query("SELECT amount_cents FROM billing_charge WHERE source_type='pause_credit' AND source_id=$1", [`pause:${context.id}:${month.slice(0, 7)}-15`])
    assert.deepEqual(posted.rows.map(row => Number(row.amount_cents)), [-Number(credits.rows[0].credit_cents)])
    assert.equal(Number((await db.query('SELECT amount_cents FROM billing_payment WHERE id=$1', [payment.id])).rows[0].amount_cents), 10000)
    const req = { adminId: admin.id, canonicalAccess: { userId: admin.id, facilityId: context.facility_id }, skipNotifications: true }
    const action = async (body, usedPool = pool) => {
      let status = 200, result
      await createSchedulingHandlers(usedPool).updateSignupStatus({ ...req, params: { id: context.id }, body }, {
        status(code) { status = code; return this }, json(value) { result = value; return this },
      })
      return { status, result }
    }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
    const scenario = async (name, fn) => t.test(name, async () => {
      await db.query('SAVEPOINT scenario')
      try { await fn() } finally { await db.query('ROLLBACK TO SAVEPOINT scenario'); await db.query('RELEASE SAVEPOINT scenario') }
    })
    await scenario('scheduled actions wait until due, execute once, and keep original dates', async () => {
      await db.query("UPDATE scheduling_signup SET status='confirmed',pause_effective_date=NULL WHERE id=$1", [context.id])
      await db.query("UPDATE billing_subscription SET status='active' WHERE id=$1", [context.subscription_id])
      const future = addBillingMonths(month,1)
      const scheduled = await action({ status:'paused',effectiveDate:future,requestKey:'local-future-pause' })
      assert.equal(scheduled.status,200,JSON.stringify(scheduled.result))
      assert.equal(scheduled.result.data.scheduled,true)
      assert.equal((await db.query('SELECT status FROM scheduling_signup WHERE id=$1',[context.id])).rows[0].status,'confirmed')
      assert.equal(await processDueEnrollmentActions(pool,{accountId:context.family_billing_account_id}),0)
      assert.equal((await action({ status:'paused',effectiveDate:future,requestKey:'local-future-pause' })).status,200)
      assert.equal((await action({ status:'confirmed',cancelScheduledAction:true })).status,200)
      // Insert a genuinely due pending record, as the clock would encounter it on its scheduled day.
      await db.query(`INSERT INTO enrollment_action(signup_id,facility_id,requested_status,previous_status,effective_date,request_key)
        VALUES($1,$2,'paused','confirmed',$3,'local-due-pause')`,[context.id,context.facility_id,today])
      assert.equal(await processDueEnrollmentActions(pool,{accountId:context.family_billing_account_id}),1)
      assert.equal(await processDueEnrollmentActions(pool,{accountId:context.family_billing_account_id}),0)
      const applied = (await db.query("SELECT status,effective_date::text FROM enrollment_action WHERE request_key='local-due-pause'")).rows[0]
      assert.deepEqual(applied,{status:'applied',effective_date:today})
      assert.equal((await db.query('SELECT status FROM billing_subscription WHERE id=$1',[context.subscription_id])).rows[0].status,'paused')
    })
    await scenario('backdated waitlist and activation stop billing and retain the original enrollment', async () => {
      await db.query("UPDATE scheduling_signup SET status='confirmed',pause_effective_date=NULL WHERE id=$1", [context.id])
      await db.query("UPDATE billing_subscription SET status='active' WHERE id=$1", [context.subscription_id])
      const result = await action({status:'waitlisted',effectiveDate:month,requestKey:'local-backdated-waitlist'})
      assert.equal(result.status,200,JSON.stringify(result.result))
      assert.ok(result.result.data.waitlistPosition > 0)
      assert.equal((await db.query('SELECT status FROM billing_subscription WHERE id=$1',[context.subscription_id])).rows[0].status,'paused')
      const active = await action({status:'confirmed',effectiveDate:today,requestKey:'local-activate-waitlist'})
      assert.equal(active.status,200,JSON.stringify(active.result))
      assert.equal((await db.query('SELECT status FROM billing_subscription WHERE id=$1',[context.subscription_id])).rows[0].status,'active')
      assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM enrollment_action WHERE signup_id=$1',[context.id])).rows[0].n,2)
      const creditsAfter = (await db.query('SELECT credit_cents,revoked_cents FROM billing_pause_credit WHERE scheduling_signup_id=$1',[context.id])).rows
      assert.ok(creditsAfter.some(row => Number(row.revoked_cents)>0),'Reactivation reduces unused-session credits')
      assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM billing_subscription WHERE source_type=\'scheduling_signup\' AND source_id=$1',[String(context.id)])).rows[0].n,1)
      await reconcileUpcomingProvisionalChargesForAccount(pool,{accountId:Number(context.family_billing_account_id)})
    })
    await scenario('billing failure rolls back the enrollment, action history, and promised credit', async () => {
      await db.query("UPDATE scheduling_signup SET status='confirmed',pause_effective_date=NULL WHERE id=$1", [context.id])
      await db.query("UPDATE billing_subscription SET status='active' WHERE id=$1", [context.subscription_id])
      const failClient = { ...adapter, query(sql, values) {
        if (/INSERT INTO billing_pause_credit/.test(sql)) throw new Error('SIMULATED credit persistence failure')
        return adapter.query(sql,values)
      } }
      const failing = { query: (...args) => adapter.query(...args), connect: async () => failClient }
      const result = await action({status:'paused',effectiveDate:month,requestKey:'local-atomic-pause'},failing)
      assert.equal(result.status,400)
      assert.match(result.result.message,/credit persistence/)
      assert.equal((await db.query('SELECT status FROM scheduling_signup WHERE id=$1',[context.id])).rows[0].status,'confirmed')
      assert.equal((await db.query('SELECT status FROM billing_subscription WHERE id=$1',[context.subscription_id])).rows[0].status,'active')
      assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM enrollment_action WHERE signup_id=$1',[context.id])).rows[0].n,0)
    })
    await scenario('automatic waitlist promotion records its actual date and resumes the existing subscription', async () => {
      await db.query("UPDATE scheduling_signup SET status='confirmed',pause_effective_date=NULL WHERE id=$1",[context.id])
      await db.query("UPDATE billing_subscription SET status='active' WHERE id=$1",[context.subscription_id])
      assert.equal((await action({status:'waitlisted',effectiveDate:month,requestKey:'local-auto-waitlist'})).status,200)
      const group=(await db.query('SELECT slot_group_id FROM scheduling_signup WHERE id=$1',[context.id])).rows[0].slot_group_id
      await db.query("UPDATE scheduling_signup SET status='cancelled' WHERE slot_group_id=$1 AND id<>$2 AND status='waitlisted'",[group,context.id])
      const promoted=await promoteFromWaitlist(db,group,1)
      assert.equal(Number(promoted[0].id),Number(context.id))
      assert.equal((await db.query('SELECT status FROM billing_subscription WHERE id=$1',[context.subscription_id])).rows[0].status,'active')
      assert.equal((await db.query("SELECT effective_date::text FROM enrollment_action WHERE signup_id=$1 AND requested_status='confirmed'",[context.id])).rows[0].effective_date,today)
    })
    await scenario('class transfer preserves the remaining discount window and retries do not duplicate bills', async () => {
      await db.query("UPDATE scheduling_signup SET status='confirmed',pause_effective_date=NULL,cancel_effective_date=NULL WHERE id=$1", [context.id])
      await db.query("UPDATE billing_subscription SET status='active' WHERE id=$1", [context.subscription_id])
      const transfer = {signupId:Number(context.id),facilityId:Number(context.facility_id),actorUserId:Number(admin.id),requestKey:'local-discount-transfer',
        input:{targetFormId:15,targetSlotGroupId:2,targetTimeSlotId:2,effectiveDate:today,reason:'SIMULATED class transfer'}}
      const moved = await moveCustomerBillingEnrollmentClass(pool,transfer)
      const copied = (await db.query('SELECT effective_through_month::text,discount_rule_snapshot FROM enrollment_price_adjustment WHERE signup_id=$1',[moved.replacementSignupId])).rows
      assert.equal(copied.length,1)
      assert.equal(copied[0].effective_through_month,month)
      assert.equal(copied[0].discount_rule_snapshot.amountValue,5000)
      assert.equal(copied[0].discount_rule_snapshot.duration,'once')
      const count = (await db.query('SELECT COUNT(*)::int AS n FROM billing_charge WHERE family_billing_account_id=$1',[context.family_billing_account_id])).rows[0].n
      const replayed = await moveCustomerBillingEnrollmentClass(pool,transfer)
      assert.equal(replayed.replayed,true)
      assert.equal(replayed.replacementSignupId,moved.replacementSignupId)
      assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM billing_charge WHERE family_billing_account_id=$1',[context.family_billing_account_id])).rows[0].n,count)
      assert.equal((await db.query('SELECT status FROM scheduling_signup WHERE id=$1',[context.id])).rows[0].status,'cancelled')
    })
    await scenario('future class transfer retains old recurring tuition until the move date', async () => {
      await db.query("UPDATE scheduling_signup SET status='confirmed',pause_effective_date=NULL,cancel_effective_date=NULL WHERE id=$1",[context.id])
      await db.query("UPDATE billing_subscription SET status='active',next_bill_date=$2 WHERE id=$1",[context.subscription_id,addBillingMonths(month,1)])
      await moveCustomerBillingEnrollmentClass(pool,{signupId:Number(context.id),facilityId:Number(context.facility_id),actorUserId:Number(admin.id),requestKey:'local-future-transfer',
        input:{targetFormId:15,targetSlotGroupId:2,targetTimeSlotId:2,effectiveDate:addBillingMonths(month,2),reason:'SIMULATED future transfer'}})
      const old = (await db.query('SELECT status,next_bill_date::text,end_date::text FROM billing_subscription WHERE id=$1',[context.subscription_id])).rows[0]
      assert.equal(old.status,'active')
      const upcoming = (await db.query('SELECT COUNT(*)::int AS n FROM billing_charge WHERE subscription_id=$1 AND service_period_start=$2',[context.subscription_id,addBillingMonths(month,1)])).rows[0].n
      assert.ok(old.next_bill_date === addBillingMonths(month,1) || upcoming > 0,'The old class must keep its intervening bill or scheduled bill date')
      assert.ok(old.end_date < addBillingMonths(month,2))
    })
    await scenario('a backdated class transfer reverses later source bills instead of billing both classes', async () => {
      const priorMonth=addBillingMonths(month,-1)
      for (const row of originalSubscriptions) await db.query('UPDATE billing_subscription SET status=$2 WHERE id=$1',[row.id,row.status])
      for (const row of originalEnrollments) await db.query('UPDATE scheduling_signup SET status=$2 WHERE id=$1',[row.id,row.status])
      const invoicesBefore=(await db.query('SELECT id,status,stripe_invoice_id FROM billing_monthly_invoice WHERE family_billing_account_id=$1 ORDER BY id',[context.family_billing_account_id])).rows
      const paymentsBefore=(await db.query('SELECT id,amount_cents,external_status FROM billing_payment WHERE family_billing_account_id=$1 ORDER BY id',[context.family_billing_account_id])).rows
      await db.query("UPDATE scheduling_signup SET status='confirmed',pause_effective_date=NULL,cancel_effective_date=NULL,enrollment_start_date=$2 WHERE id=$1",[context.id,priorMonth])
      await db.query("UPDATE billing_subscription SET status='active',start_date=$2 WHERE id=$1",[context.subscription_id,priorMonth])
      const before=(await db.query('SELECT SUM(amount_cents)::int AS cents FROM billing_charge WHERE subscription_id=$1 AND service_period_start=$2',[context.subscription_id,month])).rows[0].cents
      assert.ok(before>0)
      const moved=await moveCustomerBillingEnrollmentClass(pool,{signupId:Number(context.id),facilityId:Number(context.facility_id),actorUserId:Number(admin.id),requestKey:'local-past-transfer',
        input:{targetFormId:15,targetSlotGroupId:2,targetTimeSlotId:2,effectiveDate:`${priorMonth.slice(0,7)}-20`,reason:'SIMULATED past transfer'}})
      assert.equal(moved.preview.laterSourceCreditCents,before)
      assert.equal((await db.query('SELECT SUM(amount_cents)::int AS cents FROM billing_charge WHERE subscription_id=$1 AND service_period_start=$2',[context.subscription_id,month])).rows[0].cents,0)
      assert.ok(moved.preview.replacementCatchupCents>0)
      await reconcileCanonicalRecurringChargesForMonth(pool,{accountId:Number(context.family_billing_account_id),billingMonth:month,facilityTimeZone:'America/New_York',apply:true,recurringRun:true})
      await reconcileCanonicalRecurringChargesForMonth(pool,{accountId:Number(context.family_billing_account_id),billingMonth:month,facilityTimeZone:'America/New_York',apply:true,recurringRun:true})
      await reconcileUpcomingProvisionalChargesForAccount(pool,{accountId:Number(context.family_billing_account_id)})
      assert.deepEqual((await db.query('SELECT id,status,stripe_invoice_id FROM billing_monthly_invoice WHERE family_billing_account_id=$1 ORDER BY id',[context.family_billing_account_id])).rows,invoicesBefore)
      assert.deepEqual((await db.query('SELECT id,amount_cents,external_status FROM billing_payment WHERE family_billing_account_id=$1 ORDER BY id',[context.family_billing_account_id])).rows,paymentsBefore)
      assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM billing_charge WHERE source_type='billing_subscription' AND source_id=$1",[`${(await db.query("SELECT id FROM billing_subscription WHERE source_type='scheduling_signup' AND source_id=$1",[String(moved.replacementSignupId)])).rows[0].id}:${month.slice(0,7)}`])).rows[0].n,1)
    })
    await scenario('lead flags and notes share account history without overwriting original notes', async () => {
      const lead = await createLead(db,context.facility_id,{firstName:'SIMULATED',lastName:'Inquiry',email:'inquiry@example.test',notes:'Original staff note',message:'Interested in classes'})
      await db.query('UPDATE registrations SET converted_member_id=$2 WHERE id=$1',[lead.id,context.member_id])
      await db.query("INSERT INTO note(subject_type,subject_id,note_type,body) VALUES('member',$1,'staff_note','Linked account note')",[context.member_id])
      const changed = await saveLead(pool,context.facility_id,lead.id,{contacted:true,followUp:true,notes:'Follow up next week'},req)
      assert.equal(changed.contacted,true); assert.equal(changed.followUp,true); assert.ok(changed.firstContactedAt)
      const notes = await leadNotes(db,context.facility_id,lead.id)
      for (const expected of ['Original staff note','Follow up next week','Linked account note']) assert.ok(notes.some(note => note.body===expected),expected)
      await assert.rejects(leadNotes(db,Number(context.facility_id)+99999,lead.id),/not found/)
      await saveLead(pool,context.facility_id,lead.id,{contacted:false,followUp:false},req)
      assert.equal((await leadNotes(db,context.facility_id,lead.id)).length,notes.length)
    })
    await scenario('reenrollment creates one linked record and retains the original history on retry', async () => {
      await db.query("UPDATE scheduling_signup SET status='cancelled',pause_effective_date=NULL,cancel_effective_date=$2,re_enrolled_signup_id=NULL WHERE id=$1",[context.id,month])
      await db.query("UPDATE billing_subscription SET status='cancelled' WHERE id=$1",[context.subscription_id])
      const body = {memberId:Number(context.member_id),formId:15,slotGroupId:2,timeSlotId:2,enrollmentStartDate:today,reenrollFromSignupId:Number(context.id),sendEmails:false}
      const enroll = async () => {
        let status=200,result
        await createSchedulingHandlers(pool).adminCreateSignup({...req,body},{status(code){status=code;return this},json(value){result=value;return this}})
        assert.equal(status,200,JSON.stringify(result))
        return result.data
      }
      const fresh=await enroll()
      const count=(await db.query('SELECT COUNT(*)::int AS n FROM billing_charge WHERE family_billing_account_id=$1',[context.family_billing_account_id])).rows[0].n
      assert.equal((await enroll()).id,fresh.id)
      const original=(await db.query('SELECT status,re_enrolled_signup_id FROM scheduling_signup WHERE id=$1',[context.id])).rows[0]
      assert.equal(original.status,'cancelled')
      assert.equal(Number(original.re_enrolled_signup_id),Number(fresh.id))
      assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM billing_charge WHERE family_billing_account_id=$1',[context.family_billing_account_id])).rows[0].n,count)
    })
  } finally { await db.query('ROLLBACK'); await db.end() }
})
