import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { listClassSwapStudents,listClassSwapClasses,previewClassSwap,executeClassSwap } from '../classSwaps.js'
import { buildDailyRoster } from '../dailyRoster.js'
import { classSwapCapacityDelta } from '../classSwapsRoster.js'
import { moveCustomerBillingEnrollmentClass, previewCustomerBillingEnrollmentClassSwap } from '../../billing/customerBillingEnrollmentSwap.js'
import { dispatchClassSwapNotifications, previewClassSwapNotification } from '../classSwapNotifications.js'

const url=process.env.NEW_ADMIN_TEST_DATABASE_URL
if(url&&(!['localhost','127.0.0.1'].includes(new URL(url).hostname)||!/^\/vortex_new_admin_dev(?:_[a-z0-9_]+)?$/.test(new URL(url).pathname)))throw new Error('An isolated local test database is required')

test('dated class swaps preserve billing, roster source slots, typed confirmation, capacity and retry safety',{skip:!url},async()=>{
  const db=new pg.Client({connectionString:url,ssl:false});await db.connect()
  try{
    await db.query('BEGIN')
    await db.query(await readFile(new URL('../../migrations/879_scheduling_class_swaps.sql',import.meta.url),'utf8'))
    await db.query(await readFile(new URL('../../migrations/881_class_swap_notifications.sql',import.meta.url),'utf8'))
    const one=async(sql,values=[])=>(await db.query(sql,values)).rows[0]
    const suffix=randomUUID()
    const facilityId=Number((await one("INSERT INTO facility(name,timezone) VALUES('Swap regression','America/New_York') RETURNING id")).id)
    const actorUserId=Number((await one('SELECT id FROM app_user ORDER BY id LIMIT 1')).id)
    const top=Number((await one('INSERT INTO programs(facility_id,name,display_name) VALUES($1,$2,$2) RETURNING id',[facilityId,`Swaps ${suffix}`])).id)
    const addClass=async(name,days=[1],capacity=2)=>{
      const klass=Number((await one(`INSERT INTO program(facility_id,category,programs_id,name,display_name,is_active,archived)
        VALUES($1,(enum_range(NULL::program_category))[1],$2,$3,$3,TRUE,FALSE) RETURNING id`,[facilityId,top,`${name} ${suffix}`])).id)
      const formId=Number((await one(`INSERT INTO scheduling_form(program_id,programs_id,title,is_active,start_date,cost_unit,class_monthly_price_cents)
        VALUES($1,$2,$3,TRUE,'2029-01-01','per_month',10000) RETURNING id`,[klass,top,name])).id)
      const groupId=Number((await one(`INSERT INTO scheduling_slot_group(form_id,schedule_mode,max_participants,active_start,inherits_offering_dates,dates_tbd,is_active)
        VALUES($1,'day',$2,'2029-01-01',FALSE,FALSE,TRUE) RETURNING id`,[formId,capacity])).id)
      const slots=[]
      for(const day of days)slots.push(Number((await one(`INSERT INTO scheduling_time_slot(form_id,slot_group_id,schedule_mode,day_of_week,start_time,end_time,max_participants,active_start,dates_tbd,is_active)
        VALUES($1,$2,'day',$3,'16:00','17:00',$4,'2029-01-01',FALSE,TRUE) RETURNING id`,[formId,groupId,day,capacity])).id))
      return {formId,groupId,slots}
    }
    const source=await addClass('Monday and Wednesday',[1,3]),target=await addClass('Wednesday destination',[3],1)
    const memberId=Number((await one("INSERT INTO member(facility_id,first_name,last_name,is_active,date_of_birth) VALUES($1,'Swap','Student',TRUE,'2020-01-01') RETURNING id",[facilityId])).id)
    const signupId=Number((await one(`INSERT INTO scheduling_signup(form_id,slot_group_id,time_slot_id,member_id,first_name,last_name,email,status,enrollment_start_date)
      VALUES($1,$2,NULL,$3,'Swap','Student','student@example.test','confirmed','2029-12-01') RETURNING id`,[source.formId,source.groupId,memberId])).id)
    const notificationFamily=Number((await one("INSERT INTO family(facility_id,family_name) VALUES($1,'Swap notification family') RETURNING id",[facilityId])).id)
    const parents=[]
    for(const label of ['First','Second'])parents.push(Number((await one(`INSERT INTO member(facility_id,first_name,last_name,email,date_of_birth,is_active)
      VALUES($1,$2,'Parent',$3,'1980-01-01',TRUE) RETURNING id`,[facilityId,label,`${label.toLowerCase()}-${suffix}@example.test`])).id))
    await db.query('INSERT INTO family_member(family_id,member_id) SELECT $1,unnest($2::bigint[])',[notificationFamily,[memberId,...parents]])
    await db.query('INSERT INTO parent_guardian_authority(parent_member_id,child_member_id,has_legal_authority) SELECT unnest($1::bigint[]),$2,TRUE',[parents,memberId])
    await db.query("UPDATE program SET abridged_name='Short label' WHERE id=(SELECT program_id FROM scheduling_form WHERE id=$1)",[source.formId])
    const drop=async(name,status)=>Number((await one(`INSERT INTO drop_in_registration(form_id,slot_group_id,class_date,first_name,last_name,email,status,benefit_type)
      VALUES($1,$2,'2030-01-07',$3,'Trial',$4,$5,'free_trial') RETURNING id`,[source.formId,source.groupId,name,`${name}-${suffix}@example.test`,status])).id)
    const trialId=await drop('Confirmed','confirmed');await drop('Unpaid','payment_pending');await drop('NeedsAccount','account_required')
    const students=await listClassSwapStudents(db,{facilityId})
    assert.ok(students.students.some(student=>student.enrollments.some(row=>row.signupId===signupId&&row.source==='scheduling'&&row.kind==='multi_class')))
    assert.ok(students.students.some(student=>student.enrollments.some(row=>row.signupId===trialId&&row.source==='drop_in'&&row.canPermanent===false)))
    assert.ok(!students.students.some(student=>/Unpaid|NeedsAccount/.test(student.name)))
    assert.equal((await listClassSwapStudents(db,{facilityId:facilityId+1000000})).students.length,0)
    const input={mode:'temporary',source:'scheduling',signupId,sourceTimeSlotId:source.slots[0],sourceDate:'2030-01-07',effectiveDate:'2030-01-09',targetFormId:target.formId,targetSlotGroupId:target.groupId,targetTimeSlotId:target.slots[0],reason:'Cross-day make-up',confirmation:'TEMPORARY',requestKey:`swap-${suffix}`}
    const temporaryPreview=await previewClassSwap(db,{facilityId,input:{...input,sourceTimeSlotId:null}})
    assert.equal(temporaryPreview.billingImpact,null)
    assert.equal(temporaryPreview.notificationEmail.recipientCount,2)
    assert.equal('recipients' in temporaryPreview.notificationEmail,false)
    assert.match(temporaryPreview.notificationEmail.body,/Monday and Wednesday/)
    assert.doesNotMatch(temporaryPreview.notificationEmail.body,/Short label/)
    assert.match(temporaryPreview.notificationEmail.body,/Monday, January 7, 2030, 4:00 PM–5:00 PM/)
    assert.match(temporaryPreview.notificationEmail.body,/Wednesday, January 9, 2030, 4:00 PM–5:00 PM/)
    assert.match(temporaryPreview.notificationEmail.body,/regular enrollment and tuition remain unchanged/)
    input.emailBody=`${temporaryPreview.notificationEmail.body}\nPlease reply with questions & bring <water>.`
    await assert.rejects(executeClassSwap(db,{facilityId,actorUserId,input:{...input,confirmation:'wrong'}}),/Type TEMPORARY/)
    const client={release(){},query:(sql,values)=>db.query(sql==='BEGIN'?'SAVEPOINT class_swap_test':sql==='COMMIT'?'RELEASE SAVEPOINT class_swap_test':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT class_swap_test':sql,values)}
    const pool={query:(...args)=>db.query(...args),connect:async()=>client}
    const before=Number((await one('SELECT COUNT(*)::int AS count FROM billing_charge')).count)
    const failedNotificationClient={release(){},query:(sql,values)=>{
      if(sql.includes('INSERT INTO scheduling_class_swap_notice'))throw new Error('Simulated notification queue failure')
      return client.query(sql,values)
    }}
    await assert.rejects(executeClassSwap({query:(...args)=>db.query(...args),connect:async()=>failedNotificationClient},{facilityId,actorUserId,input}),/notification queue failure/)
    assert.equal(Number((await one('SELECT count(*)::int AS count FROM scheduling_class_swap WHERE request_key=$1',[input.requestKey])).count),0,'queue failure rolls the attendance swap back')
    const temporaryResult=await executeClassSwap(pool,{facilityId,actorUserId,input})
    assert.equal(temporaryResult.notifications.pending,2)
    assert.equal((await executeClassSwap(pool,{facilityId,actorUserId,input})).replayed,true)
    assert.equal(Number((await one('SELECT count(*)::int AS count FROM scheduling_class_swap_notice WHERE facility_id=$1',[facilityId])).count),1)
    assert.equal((await one('SELECT body FROM scheduling_class_swap_notice WHERE facility_id=$1',[facilityId])).body,input.emailBody)
    const delivered=[];let attempted=0
    await dispatchClassSwapNotifications(db,{send:async mail=>{attempted++;if(attempted===1)throw new Error('Simulated SMTP outage');delivered.push(mail);return {sent:true}},limit:2})
    assert.equal(Number((await one("SELECT count(*)::int AS count FROM scheduling_class_swap_delivery WHERE status='pending'")).count),1)
    await db.query("UPDATE scheduling_class_swap_delivery SET next_attempt_at=now() WHERE status='pending'")
    await dispatchClassSwapNotifications(db,{send:async mail=>{delivered.push(mail);return {sent:true}}})
    assert.equal(delivered.length,2)
    assert.ok(delivered.every(mail=>mail.text===input.emailBody&&mail.html.includes('&amp;')&&mail.html.includes('&lt;water&gt;')))
    assert.deepEqual(delivered.map(mail=>mail.to).sort(),parents.map((_,index)=>`${index?'second':'first'}-${suffix}@example.test`).sort())
    assert.equal((await executeClassSwap(pool,{facilityId,actorUserId,input})).notifications.sent,2)
    assert.equal(Number((await one('SELECT COUNT(*)::int AS count FROM billing_charge')).count),before,'temporary swap does not create charges')
    const monday=await buildDailyRoster(db,'2030-01-07',{facilityId,includeNewRegistrations:false})
    assert.ok(!monday.classes.find(row=>row.timeSlotId===source.slots[0]).athletes.some(row=>row.memberId===memberId))
    const wednesday=await buildDailyRoster(db,'2030-01-09',{facilityId,includeNewRegistrations:false})
    assert.ok(wednesday.classes.find(row=>row.timeSlotId===target.slots[0]).athletes.some(row=>row.memberId===memberId))
    assert.ok(wednesday.classes.find(row=>row.timeSlotId===source.slots[1]).athletes.some(row=>row.memberId===memberId),'the other enrolled weekday remains intact')
    assert.equal(await classSwapCapacityDelta(db,target.groupId,'2030-01-09'),1,'booking paths reserve the arriving student')
    const available=await listClassSwapClasses(db,{facilityId,mode:'temporary',effectiveDate:'2030-01-09'})
    assert.equal(available.classes.find(row=>row.timeSlotId===target.slots[0]).availableSpots,0)
    await assert.rejects(previewClassSwap(db,{facilityId,input:{...input,source:'drop_in',signupId:trialId,sourceTimeSlotId:source.slots[0]}}),/full/)
    await assert.rejects(executeClassSwap(pool,{facilityId,actorUserId,input:{...input,targetTimeSlotId:source.slots[1]}}),/different class swap/)
    const original=await one('SELECT status,slot_group_id FROM scheduling_signup WHERE id=$1',[signupId]);assert.equal(original.status,'confirmed');assert.equal(Number(original.slot_group_id),source.groupId)

    const overlappingEvaluation=await addClass('Overlapping private evaluation',[3],1)
    await db.query(`UPDATE program SET is_trial_assessment=TRUE
      WHERE id IN (SELECT program_id FROM scheduling_form WHERE id=ANY($1::bigint[]))`,[[target.formId,overlappingEvaluation.formId]])
    await assert.rejects(previewClassSwap(db,{facilityId,input:{...input,source:'drop_in',signupId:trialId,
      targetFormId:overlappingEvaluation.formId,targetSlotGroupId:overlappingEvaluation.groupId,targetTimeSlotId:overlappingEvaluation.slots[0]}}),
    /private evaluation time has already been booked/,'scoping the destination must still check overlapping private evaluation groups')

    // Permanent package replacements share one billing transaction and one
    // source credit, even when the replacement times are different class types.
    const permanentSource=await addClass('Two-time paid package',[1,3],20)
    await db.query('UPDATE scheduling_form SET class_monthly_price_cents=30000 WHERE id=$1',[permanentSource.formId])
    const replacementA=await addClass('Gymnastics replacement',[2],20),replacementB=await addClass('Strength replacement',[4],20)
    const paidMember=Number((await one("INSERT INTO member(facility_id,first_name,last_name,is_active,date_of_birth) VALUES($1,'Permanent','Student',TRUE,'2020-01-01') RETURNING id",[facilityId])).id)
    const familyId=Number((await one("INSERT INTO family(facility_id,family_name) VALUES($1,'Permanent test family') RETURNING id",[facilityId])).id)
    await db.query('UPDATE member SET family_id=$1 WHERE id=$2',[familyId,paidMember])
    await db.query('INSERT INTO family_member(family_id,member_id) VALUES($1,$2)',[familyId,paidMember])
    const accountId=Number((await one(`INSERT INTO family_billing_account(family_id,payer_member_id) VALUES($1,$2)
      ON CONFLICT(family_id) DO UPDATE SET payer_member_id=EXCLUDED.payer_member_id RETURNING id`,[familyId,paidMember])).id)
    const membershipFee=Number((await one(`INSERT INTO additional_fee(facility_id,name,amount_cents,apply_basis,trigger_type)
      VALUES($1,'Annual membership test',5000,'per_year','once_per_year') RETURNING id`,[facilityId])).id)
    await db.query(`INSERT INTO additional_fee_redemption(fee_id,member_id,period_key,amount_cents,satisfied_at)
      VALUES($1,$2,'2031-01-01',5000,now())`,[membershipFee,paidMember])
    await db.query("INSERT INTO discount_rule(facility_id,name,type,amount_value,config) VALUES($1,'Unused fixture promo','promo_code',0,'{\"code\":\"NOT_APPLIED\"}')",[facilityId])
    const paidSignup=Number((await one(`INSERT INTO scheduling_signup(form_id,slot_group_id,time_slot_id,member_id,first_name,last_name,email,status,enrollment_start_date,manual_discount_cents,manual_discount_reason)
      VALUES($1,$2,NULL,$3,'Permanent','Student','paid@example.test','confirmed','2029-12-01',2001,'Package discount') RETURNING id`,[permanentSource.formId,permanentSource.groupId,paidMember])).id)
    await db.query("UPDATE family_billing_account SET payer_member_id=NULL,billing_email='imported-payer@example.test' WHERE id=$1",[accountId])
    await db.query("UPDATE scheduling_signup SET email='' WHERE id=$1",[paidSignup])
    const paidSubscription=Number((await one(`INSERT INTO billing_subscription(family_billing_account_id,member_id,source_type,source_id,description,monthly_amount_cents,net_monthly_cents,start_date,next_bill_date)
      VALUES($1,$2,'scheduling_signup',$3,'Paid package',30000,27999,'2029-12-01','2030-01-01') RETURNING id`,[accountId,paidMember,String(paidSignup)])).id)
    const sourceCharge=Number((await one(`INSERT INTO billing_charge(family_billing_account_id,member_id,subscription_id,source_type,source_id,description,amount_cents,gross_amount_cents,discount_amount_cents,
      charge_type,billing_interval,service_period_start,service_period_end,collection_status)
      VALUES($1,$2,$3,'scheduling_signup',$4,'Paid original package',30000,30000,0,'recurring','month','2030-01-01','2030-01-31','paid') RETURNING id`,[accountId,paidMember,paidSubscription,String(paidSignup)])).id)
    const settledPayment=Number((await one(`INSERT INTO billing_payment(family_billing_account_id,amount_cents,method,external_status,note)
      VALUES($1,30000,'cash','settled','SIMULATED rollback-only class swap payment') RETURNING id`,[accountId])).id)
    await db.query("INSERT INTO billing_payment_application(billing_payment_id,billing_charge_id,amount_cents,application_kind) VALUES($1,$2,30000,'application')",[settledPayment,sourceCharge])
    const permanent={mode:'permanent',source:'scheduling',signupId:paidSignup,effectiveDate:'2030-01-07',confirmation:'PERMANENT',requestKey:`permanent-${suffix}`,reason:'Two replacement times',
      targetSelections:[{formId:replacementA.formId,slotGroupId:replacementA.groupId,timeSlotId:replacementA.slots[0]},{formId:replacementB.formId,slotGroupId:replacementB.groupId,timeSlotId:replacementB.slots[0]}]}
    await assert.rejects(previewClassSwap(db,{facilityId,input:{...permanent,targetSelections:permanent.targetSelections.slice(0,1)}}),/exactly 2/)
    const permanentPreview=await previewClassSwap(db,{facilityId,input:permanent})
    assert.equal(permanentPreview.billingImpact.replacements.length,2)
    assert.equal(permanentPreview.billingImpact.replacementMonthlyCents,17999,'fixed package discount is conserved across targets')
    assert.ok(permanentPreview.billingImpact.unusedSourceCreditCents>0)
    assert.equal(permanentPreview.notificationEmail.recipientCount,1,'a legacy account billing email is usable without a payer member or submitted email')
    assert.match(permanentPreview.notificationEmail.body,/Previous schedule:[\s\S]*Monday[\s\S]*Wednesday/)
    assert.match(permanentPreview.notificationEmail.body,/Updated schedule:[\s\S]*Gymnastics replacement[\s\S]*Tuesday[\s\S]*Strength replacement[\s\S]*Thursday/)
    assert.doesNotMatch(permanentPreview.notificationEmail.body,/tuition remain unchanged/)
    permanent.emailBody=`${permanentPreview.notificationEmail.body}\nWe look forward to seeing you in your new classes.`
    const failingClient={release(){},query:async(sql,values)=>{
      if(sql.includes('INSERT INTO scheduling_signup')&&Number(values?.[0])===replacementB.formId)throw new Error('Simulated second replacement failure')
      return client.query(sql,values)
    }}
    await assert.rejects(executeClassSwap({query:(...args)=>db.query(...args),connect:async()=>failingClient},{facilityId,actorUserId,input:permanent}),/Simulated/)
    assert.equal((await one('SELECT cancel_effective_date FROM scheduling_signup WHERE id=$1',[paidSignup])).cancel_effective_date,null,'failure rolls source cancellation back')
    assert.equal(Number((await one('SELECT COUNT(*)::int AS count FROM scheduling_signup WHERE member_id=$1 AND form_id=ANY($2::bigint[])',[paidMember,[replacementA.formId,replacementB.formId]])).count),0,'failure rolls first replacement back')
    const financialCountBeforeQueueFailure=Number((await one('SELECT COUNT(*)::int AS count FROM billing_charge')).count)
    await assert.rejects(executeClassSwap({query:(...args)=>db.query(...args),connect:async()=>failedNotificationClient},{facilityId,actorUserId,input:permanent}),/notification queue failure/)
    assert.equal((await one('SELECT cancel_effective_date FROM scheduling_signup WHERE id=$1',[paidSignup])).cancel_effective_date,null,'permanent notification failure rolls the source cancellation back')
    assert.equal(Number((await one('SELECT COUNT(*)::int AS count FROM billing_charge')).count),financialCountBeforeQueueFailure,'notification failure rolls financial writes back with the permanent move')
    assert.equal(Number((await one('SELECT COUNT(*)::int AS count FROM scheduling_signup WHERE member_id=$1 AND form_id=ANY($2::bigint[])',[paidMember,[replacementA.formId,replacementB.formId]])).count),0)
    const permanentResult=await executeClassSwap(pool,{facilityId,actorUserId,input:permanent})
    assert.equal(permanentResult.replacementSignupIds.length,2)
    assert.equal(permanentResult.notifications.pending,1)
    assert.equal((await one('SELECT body FROM scheduling_class_swap_notice WHERE event_key=$1',[`permanent:${permanent.requestKey}`])).body,permanent.emailBody)
    const adjustments=await db.query("SELECT amount_cents FROM billing_charge WHERE related_charge_id=$1 AND metadata->>'adjustmentKind'='class_swap_proration'",[sourceCharge])
    assert.deepEqual(adjustments.rows.map(row=>Number(row.amount_cents)),[-permanentPreview.billingImpact.unusedSourceCreditCents],'the source credit is created once for the whole replacement package')
    assert.equal(Number((await one('SELECT amount_cents FROM billing_payment WHERE id=$1',[settledPayment])).amount_cents),30000,'settled payment amount is preserved')
    assert.ok(permanentResult.reallocatedPaymentCents>0)
    const replacementPayments=await db.query(`SELECT billing_charge_id,SUM(CASE WHEN application_kind='reversal' THEN -amount_cents ELSE amount_cents END)::int AS applied
      FROM billing_payment_application WHERE billing_charge_id=ANY($1::bigint[]) GROUP BY billing_charge_id`,[permanentResult.replacementChargeIds])
    assert.equal(replacementPayments.rows.filter(row=>Number(row.applied)>0).length,2,'the original settled payment reaches both replacement class bills')
    const replacements=await db.query(`SELECT s.id,b.net_monthly_cents FROM scheduling_signup s JOIN billing_subscription b ON b.source_type='scheduling_signup' AND b.source_id=s.id::text WHERE s.id=ANY($1::bigint[])`,[permanentResult.replacementSignupIds])
    assert.equal(replacements.rows.length,2)
    assert.equal(replacements.rows.reduce((sum,row)=>sum+Number(row.net_monthly_cents),0),17999)
    const transferred=await db.query('SELECT discount_rule_snapshot FROM enrollment_price_adjustment WHERE signup_id=ANY($1::bigint[])',[permanentResult.replacementSignupIds])
    assert.equal(transferred.rows.reduce((sum,row)=>sum+Number(row.discount_rule_snapshot.amountValue),0),2001)
    assert.equal((await executeClassSwap(pool,{facilityId,actorUserId,input:permanent})).replayed,true)
    assert.equal(Number((await one('SELECT count(*)::int AS count FROM scheduling_class_swap_notice WHERE event_key=$1',[`permanent:${permanent.requestKey}`])).count),1,'Daily permanent delegates to Billing without duplicate notifications')
    await assert.rejects(executeClassSwap(pool,{facilityId,actorUserId,input:{...permanent,targetSelections:[permanent.targetSelections[0]]}}),/different class move/)
    await assert.rejects(moveCustomerBillingEnrollmentClass(pool,{signupId:paidSignup,facilityId,actorUserId,requestKey:permanent.requestKey,input:{...permanent,effectiveDate:'2030-01-08'}}),/different class move/)
    const legacyDestination=await addClass('Legacy Billing replacement',[4,2],20)
    const legacyInput={targetFormId:legacyDestination.formId,targetSlotGroupId:legacyDestination.groupId,
      effectiveDate:'2030-01-14',reason:'Direct Billing move'}
    await db.query('UPDATE scheduling_time_slot SET is_active=FALSE WHERE id=$1',[replacementA.slots[0]])
    await db.query('SAVEPOINT parent_letter_dates')
    await db.query("UPDATE scheduling_time_slot SET schedule_mode='date',specific_date='2030-01-17',day_of_week=NULL WHERE id=$1",[legacyDestination.slots[0]])
    const datedLetter=await previewClassSwapNotification(db,{facilityId,mode:'permanent',signupId:permanentResult.replacementSignupIds[0],
      effectiveDate:'2030-01-14',targetSelections:[{targetFormId:legacyDestination.formId,targetSlotGroupId:legacyDestination.groupId,targetTimeSlotId:legacyDestination.slots[0]}]})
    assert.match(datedLetter.body,/Updated schedule:[\s\S]*Thursday, January 17, 2030/,'PostgreSQL date values format correctly in permanent parent letters')
    await db.query('ROLLBACK TO SAVEPOINT parent_letter_dates')
    await db.query('SAVEPOINT parent_letter_rotation')
    await db.query("UPDATE scheduling_time_slot SET week_letter=CASE WHEN id=$1 THEN NULL ELSE 'B' END WHERE slot_group_id=$2",[legacyDestination.slots[0],legacyDestination.groupId])
    const rotatedLetter=await previewClassSwapNotification(db,{facilityId,mode:'permanent',signupId:permanentResult.replacementSignupIds[0],
      effectiveDate:'2030-01-14',targetSelections:[{targetFormId:legacyDestination.formId,targetSlotGroupId:legacyDestination.groupId,targetTimeSlotId:legacyDestination.slots[0]}]})
    assert.match(rotatedLetter.body,/Updated schedule:[\s\S]*Thursday \(A-week\)/,'a null A-week slot remains distinguishable from its B-week sibling')
    await db.query('ROLLBACK TO SAVEPOINT parent_letter_rotation')
    const legacyPreview=await previewCustomerBillingEnrollmentClassSwap(db,{signupId:permanentResult.replacementSignupIds[0],facilityId,input:legacyInput})
    assert.match(legacyPreview.notificationEmail.body,/Previous schedule:[\s\S]*Gymnastics replacement/,'Billing can still move from an inactive original class time')
    assert.match(legacyPreview.notificationEmail.body,/Updated schedule:[\s\S]*Thursday/)
    assert.doesNotMatch(legacyPreview.notificationEmail.body.split('Updated schedule:')[1],/Tuesday/,'omitted legacy target slot resolves only the first active slot, not the whole group')
    legacyInput.emailBody=`${legacyPreview.notificationEmail.body}\nPlease reply if this schedule needs adjustment.`
    const legacyRequestKey=`legacy-notice-${suffix}`
    const legacyResult=await moveCustomerBillingEnrollmentClass(pool,{signupId:permanentResult.replacementSignupIds[0],facilityId,actorUserId,requestKey:legacyRequestKey,input:legacyInput})
    assert.equal(legacyResult.notifications.pending,1,'older Billing path also queues the parent notice')
    assert.equal((await one('SELECT body FROM scheduling_class_swap_notice WHERE event_key=$1',[`permanent:${legacyRequestKey}`])).body,legacyInput.emailBody)
    await moveCustomerBillingEnrollmentClass(pool,{signupId:permanentResult.replacementSignupIds[0],facilityId,actorUserId,requestKey:legacyRequestKey,input:legacyInput})
    assert.equal(Number((await one('SELECT count(*)::int AS count FROM scheduling_class_swap_notice WHERE event_key=$1',[`permanent:${legacyRequestKey}`])).count),1)
  }finally{await db.query('ROLLBACK');await db.end()}
})
