import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import pg from 'pg'
import { createLead, saveLead, listLeads, convertLead } from '../leads.js'
import { createLeadInvitation, deliverLeadInvitation, openLeadRegistration, completeLeadRegistration, nextLeadUsername } from '../leadRegistration.js'
import { insertSignupForMember } from '../../scheduling/handlers.js'
import { sendLeadRegistrationEmail } from '../../email/leadRegistrationEmail.js'
import { registerFamilySignupRoutes } from '../../platform/familySignup.js'
import { confirmPaidDropIns } from '../../scheduling/dropInCheckout.js'

// Fictional local data only. SMTP is injected and all database writes roll back.
test('lead invitations reserve shared class places, require new credentials, and hand off without billing', {skip:process.env.RUN_LEAD_REGISTRATION_LOCAL_TEST !== 'true'}, async t=>{
  process.env.STRIPE_ENABLED='false'
  process.env.BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED='false'
  const db=new pg.Client({connectionString:`postgresql://${os.userInfo().username}@127.0.0.1:5432/vortex_new_admin_dev`})
  await db.connect()
  let depth=0
  const adapter={release(){},async query(sql,args){
    if(sql==='BEGIN')return db.query(`SAVEPOINT lead_${++depth}`)
    if(sql==='COMMIT')return db.query(`RELEASE SAVEPOINT lead_${depth--}`)
    if(sql==='ROLLBACK'){const name=`lead_${depth--}`;await db.query(`ROLLBACK TO SAVEPOINT ${name}`);return db.query(`RELEASE SAVEPOINT ${name}`)}
    return db.query(sql,args)
  }}
  const pool={query:(...args)=>adapter.query(...args),connect:async()=>adapter}
  const rejectSql=async(sql,args,pattern)=>{await db.query('SAVEPOINT reject_sql');await assert.rejects(()=>db.query(sql,args),pattern);await db.query('ROLLBACK TO SAVEPOINT reject_sql');await db.query('RELEASE SAVEPOINT reject_sql')}
  try {
    await db.query('BEGIN')
    for(const file of ['845_dated_enrollment_actions.sql','846_lead_registration_invitations.sql','847_program_archive_guard.sql','853_registration_hold_start_dates.sql']) await db.query(await fs.readFile(new URL(`../../migrations/${file}`,import.meta.url),'utf8'))
    const owner=(await db.query("SELECT id,facility_id FROM app_user WHERE username='admin2'")).rows[0]
    assert.ok(owner,'Requires fictional local New Admin database')
    const facilityId=Number(owner.facility_id),nonce=Date.now()
    const program=(await db.query('INSERT INTO programs(facility_id,name,display_name,is_active) VALUES($1,$2,$2,TRUE) RETURNING id',[facilityId,`Invitation test ${nonce}`])).rows[0]
    const klass=(await db.query("INSERT INTO program(facility_id,programs_id,category,name,display_name,is_active) VALUES($1,$2,(enum_range(NULL::program_category))[1],$3,$3,TRUE) RETURNING id",[facilityId,program.id,`Test class ${nonce}`])).rows[0]
    const form=(await db.query('INSERT INTO scheduling_form(program_id,programs_id,title,is_active) VALUES($1,$2,$3,TRUE) RETURNING *',[klass.id,program.id,'Invitation class'])).rows[0]
    const group=(await db.query('INSERT INTO scheduling_slot_group(form_id,max_participants,is_active) VALUES($1,2,TRUE) RETURNING id',[form.id])).rows[0]
    const slot=(await db.query("INSERT INTO scheduling_time_slot(form_id,slot_group_id,day_of_week,start_time,end_time,is_active) VALUES($1,$2,1,'16:00','17:00',TRUE) RETURNING id",[form.id,group.id])).rows[0]
    const children=[{firstName:'Casey',lastName:'Invite',dateOfBirth:'2016-06-15',gender:'female'},{firstName:'Alex',lastName:'Invite',dateOfBirth:'2018-01-20',gender:'male'}]
    const lead=await createLead(pool,facilityId,{firstName:'Testparent',lastName:'Invite',email:`lead-${nonce}@example.test`,phone:'2025550101',inquiry:{campers:children}})
    const enrollmentStartDate=new Date().toISOString().slice(0,10)
    const selections=children.map((_,childIndex)=>({kind:'reserved',childIndex,programsId:program.id,classEventId:klass.id,timeSlotId:slot.id,enrollmentStartDate}))
    const beforeBilling=(await db.query('SELECT (SELECT count(*) FROM billing_charge) AS charges,(SELECT count(*) FROM billing_payment) AS payments,(SELECT count(*) FROM billing_subscription) AS subscriptions')).rows[0]
    let captured,sendCount=0
    const sendInvitation=async args=>{captured=args;sendCount++;return {sent:true}}
    let invitation,session,result
    await t.test('conversion sends one invitation and reserves two seats without accounts or charges',async()=>{
      invitation=await createLeadInvitation(pool,{facilityId,leadId:lead.id,userId:owner.id,body:{children,selections,requestKey:'same-request'}},{sendInvitation})
      assert.equal(invitation.status,'sent');assert.match(invitation.username,/^testparenti\d*$/)
      const holds=(await db.query('SELECT id,status,member_id FROM scheduling_signup WHERE account_invite_id=$1',[invitation.id])).rows
      assert.equal(holds.length,2);assert.ok(holds.every(row=>row.status==='pending_setup'&&row.member_id===null))
      assert.equal((await db.query('SELECT pending_registration_holds($1) AS n',[group.id])).rows[0].n,2)
      assert.equal((await db.query('SELECT converted_member_id FROM registrations WHERE id=$1',[lead.id])).rows[0].converted_member_id,null)
      const duplicate=await createLeadInvitation(pool,{facilityId,leadId:lead.id,userId:owner.id,body:{children,selections,requestKey:'same-request'}},{sendInvitation})
      assert.equal(duplicate.id,invitation.id);assert.equal(sendCount,1)
      assert.notEqual(await nextLeadUsername(db,'Testparent','Invite'),invitation.username)
      const listed=await listLeads(pool,facilityId,{search:lead.email});assert.equal(listed.rows[0].invitation.status,'sent')
    })
    await t.test('pending seats cannot be taken by another admission path',async()=>{
      await rejectSql("INSERT INTO scheduling_signup(form_id,slot_group_id,time_slot_id,first_name,last_name,email,status) VALUES($1,$2,$3,'Other','Child','other@example.test','confirmed')",[form.id,group.id,slot.id],/reserved/)
      const invalidLead=await createLead(pool,facilityId,{firstName:'Other',lastName:'Family',email:`other-${nonce}@example.test`})
      await assert.rejects(()=>createLeadInvitation(pool,{facilityId,leadId:invalidLead.id,userId:owner.id,body:{children,selections}},{sendInvitation}),/reserved/)
    })
    await t.test('credentials and the invitation scope are required; emails contain ordered setup and class links',async()=>{
      await assert.rejects(()=>openLeadRegistration(pool,invitation.id,{token:captured.token,username:invitation.username,password:'wrong'}),/Incorrect/)
      await assert.rejects(()=>openLeadRegistration(pool,invitation.id,{token:'wrong',username:invitation.username,password:captured.password}),/Invalid/)
      session=await openLeadRegistration(pool,invitation.id,{token:captured.token,username:invitation.username,password:captured.password})
      assert.equal(session.children.length,2);assert.equal(session.waivers.length>0,true)
      let email
      await sendLeadRegistrationEmail({...captured,send:async args=>{email=args;return{sent:true}}})
      assert.equal(email.category,'parent_account_invitation')
      assert.match(email.text,/1\. Finish your family account/);assert.match(email.text,/2\. Choose or complete your classes/)
      assert.match(email.html,/selection=0/);assert.match(email.html,/selection=1/)
      assert.ok(!Object.hasOwn(session,'temporary_password_hash'))
    })
    const payload=()=>({token:captured.token,session:session.session,primaryAdult:{firstName:'Testparent',lastName:'Invite',dateOfBirth:'1988-01-01',email:lead.email,phone:'2025550101',addressStreet:'100 Test Street',addressCity:'Albany',addressState:'NY',addressZip:'12207',username:invitation.username,password:'ReplacementPassword32!',confirmPassword:'ReplacementPassword32!'},additionalMembers:children.map(child=>({...child,emailSource:'parent',portalAccessRequested:false})),waivers:{signatureName:'Testparent Invite',acceptedTemplateIds:session.waivers.map(item=>Number(item.id)),paymentPolicyAcknowledged:true}})
    await t.test('setup requires replacing the temporary password and is idempotent',async()=>{
      const same=payload();same.primaryAdult.password=captured.password;same.primaryAdult.confirmPassword=captured.password
      await assert.rejects(()=>completeLeadRegistration(pool,invitation.id,same),/new password/)
      const completion=payload()
      const chosenUsername=`testparent${nonce}`
      Object.assign(completion.primaryAdult, {username:` ${chosenUsername} `, email:` ${lead.email.toUpperCase()} `, phone:'+1 (202) 555-0101'})
      result=await completeLeadRegistration(pool,invitation.id,completion)
      assert.equal(result.memberIds.length,3);assert.equal(result.pendingEnrollments.length,2)
      assert.deepEqual(await completeLeadRegistration(pool,invitation.id,payload()),JSON.parse(JSON.stringify(result)))
      assert.deepEqual((await listLeads(pool,facilityId,{search:lead.email})).rows,[])
      const linkedLead=(await listLeads(pool,facilityId,{search:lead.email,converted:'true'})).rows[0]
      assert.equal(linkedLead.convertedMemberId,Number(result.payerMemberId))
      assert.equal(linkedLead.invitation.status,'completed')
      const login=(await db.query('SELECT u.id,u.email,u.username,u.phone FROM app_user u JOIN member m ON m.app_user_id=u.id WHERE m.id=$1',[result.payerMemberId])).rows[0]
      assert.equal(login.email,lead.email);assert.equal(login.username,chosenUsername);assert.equal(login.phone,'2025550101')
      for(const identifier of [chosenUsername,lead.email.toUpperCase(),'+1 (202) 555-0101']){
        const resumed=await openLeadRegistration(pool,invitation.id,{token:captured.token,username:identifier,password:completion.primaryAdult.password})
        assert.equal(resumed.completed,true)
      }
      await assert.rejects(()=>openLeadRegistration(pool,invitation.id,{token:captured.token,username:invitation.username,password:captured.password}),/Incorrect/)
      await db.query('SAVEPOINT duplicate_phone_login')
      try {
        await db.query("INSERT INTO app_user (facility_id, role, full_name, username, phone) VALUES ($1, 'MEMBER_ATHLETE', 'Other phone user', $2, '1-202-555-0101')",[facilityId,`otherphone${nonce}`])
        await assert.rejects(()=>openLeadRegistration(pool,invitation.id,{token:captured.token,username:'2025550101',password:completion.primaryAdult.password}),/Incorrect/)
      } finally {
        await db.query('ROLLBACK TO SAVEPOINT duplicate_phone_login')
        await db.query('RELEASE SAVEPOINT duplicate_phone_login')
      }
      const holds=(await db.query('SELECT id,status,member_id FROM scheduling_signup WHERE account_invite_id=$1 ORDER BY invite_child_index',[invitation.id])).rows
      assert.deepEqual(holds.map(row=>Number(row.member_id)),result.memberIds.slice(1))
      assert.ok(holds.every(row=>row.status==='pending_setup'))
      const after=(await db.query('SELECT (SELECT count(*) FROM billing_charge) AS charges,(SELECT count(*) FROM billing_payment) AS payments,(SELECT count(*) FROM billing_subscription) AS subscriptions')).rows[0]
      assert.deepEqual(after,beforeBilling)
    })
    await t.test('drop-in registration requires a settled allocation to its own tuition charge', async () => {
      await db.query('SAVEPOINT drop_in_checkout')
      try {
        const memberId = result.memberIds[1]
        const account = (await db.query('SELECT id FROM family_billing_account WHERE payer_member_id=$1', [result.payerMemberId])).rows[0]
        const booking = (await db.query(`INSERT INTO drop_in_registration
          (member_id,form_id,slot_group_id,class_date,first_name,last_name,email,amount_cents,base_price_cents,status)
          VALUES($1,$2,$3,$4,'Casey','Invite',$5,3500,3500,'payment_pending') RETURNING id`,
        [memberId, form.id, group.id, enrollmentStartDate, lead.email])).rows[0]
        const charge = (await db.query(`INSERT INTO billing_charge
          (family_billing_account_id,member_id,source_type,source_id,description,amount_cents,charge_type,billing_interval)
          VALUES($1,$2,'drop_in',$3,'Test drop-in',3500,'one_time','one_time') RETURNING id`,
        [account.id, memberId, String(booking.id)])).rows[0]
        const payment = (await db.query(`INSERT INTO billing_payment (family_billing_account_id,amount_cents,external_status)
          VALUES($1,3500,'processing') RETURNING id`, [account.id])).rows[0]
        await db.query(`INSERT INTO billing_payment_application (billing_payment_id,billing_charge_id,amount_cents,application_kind)
          VALUES($1,$2,3500,'application')`, [payment.id, charge.id])
        assert.deepEqual(await confirmPaidDropIns(db, account.id, booking.id), [])
        await db.query("UPDATE billing_payment SET external_status='succeeded' WHERE id=$1", [payment.id])
        assert.deepEqual(await confirmPaidDropIns(db, account.id, booking.id), [Number(booking.id)])
        assert.deepEqual(await confirmPaidDropIns(db, account.id, booking.id), [])
      } finally {
        await db.query('ROLLBACK TO SAVEPOINT drop_in_checkout')
        await db.query('RELEASE SAVEPOINT drop_in_checkout')
      }
    })
    await t.test('checkout adopts the held signup instead of creating another enrollment',async()=>{
      const hold=(await db.query('SELECT id FROM scheduling_signup WHERE account_invite_id=$1 AND invite_child_index=0',[invitation.id])).rows[0]
      const admission=await insertSignupForMember(db,{formId:form.id,formRow:form,slotGroupId:group.id,memberId:result.memberIds[1],responses:{first_name:'Casey',last_name:'Invite',email:lead.email},firstOccurrenceId:slot.id,formTitle:form.title,mandateWaiver:false,enrollmentStartDate})
      assert.equal(Number(admission.signupId),Number(hold.id));assert.equal(admission.signupStatus,'confirmed')
      assert.equal((await db.query('SELECT count(*)::int AS n FROM scheduling_signup WHERE account_invite_id=$1',[invitation.id])).rows[0].n,2)
      const again=await openLeadRegistration(pool,invitation.id,{token:captured.token,username:lead.email,password:'ReplacementPassword32!'})
      assert.equal(again.result.pendingEnrollments.length,1)
    })
    await t.test('failed delivery keeps one retryable invitation; expiration releases capacity',async()=>{
      const second=await createLead(pool,facilityId,{firstName:'Testparent',lastName:'Invite',email:`retry-${nonce}@example.test`})
      const failed=await createLeadInvitation(pool,{facilityId,leadId:second.id,userId:owner.id,body:{}},{sendInvitation:async()=>({sent:false})})
      assert.equal(failed.status,'failed');assert.notEqual(failed.username,`testparent${nonce}`)
      const retried=await deliverLeadInvitation(pool,{facilityId,inviteId:failed.id},{sendInvitation:async()=>({sent:true})})
      assert.equal(retried.id,failed.id);assert.equal(retried.status,'sent')
      await db.query("UPDATE scheduling_signup SET reserved_until=now()-interval '1 minute' WHERE account_invite_id=$1 AND status='pending_setup'",[invitation.id])
      assert.equal((await db.query('SELECT pending_registration_holds($1) AS n',[group.id])).rows[0].n,0)
    })
    await t.test('lead form edits preserve original notes and store birthdays',async()=>{
      await saveLead(pool,facilityId,lead.id,{inquiry:{campers:[{...children[0],dateOfBirth:'2015-06-15'}],athleteAge:8,childAges:[8,6]},message:'Updated inquiry'}, {canonicalAccess:{userId:owner.id}})
      const saved=(await listLeads(pool,facilityId,{search:lead.email,converted:'true'})).rows[0]
      assert.equal(saved.inquiry.campers[0].dateOfBirth,'2015-06-15')
      assert.equal(saved.inquiry.athleteAge,8);assert.deepEqual(saved.inquiry.childAges,[8,6])
      await assert.rejects(()=>saveLead(pool,facilityId,lead.id,{inquiry:{campers:[{dateOfBirth:'2025-02-30'}]}},{}),/valid birthday/)
    })
    await t.test('linking a lead to an existing member retires its invite and keeps its history', async () => {
      const prospect = await createLead(pool,facilityId,{firstName:'Existing',lastName:'Member',email:`existing-${nonce}@example.test`})
      const pending = await createLeadInvitation(pool,{facilityId,leadId:prospect.id,userId:owner.id,body:{}},{sendInvitation})
      const proof = { token: captured.token, username: pending.username, password: captured.password }
      const opened = await openLeadRegistration(pool,pending.id,proof)
      const linked = await convertLead(pool,{facilityId,leadId:prospect.id,userId:owner.id,body:{memberId:result.payerMemberId}})
      assert.equal(linked.memberId,Number(result.payerMemberId))
      assert.deepEqual((await listLeads(pool,facilityId,{search:prospect.email})).rows,[])
      assert.equal((await listLeads(pool,facilityId,{search:prospect.email,converted:'true'})).rows[0].convertedMemberId,Number(result.payerMemberId))
      await assert.rejects(() => completeLeadRegistration(pool,pending.id,{token:proof.token,session:opened.session}),/no longer open|already has an account/)
    })
    await t.test('invited parents see current class times instead of ended offerings', async () => {
      const expiredGroup = (await db.query('INSERT INTO scheduling_slot_group(form_id,max_participants,is_active,active_end) VALUES($1,2,TRUE,CURRENT_DATE-1) RETURNING id', [form.id])).rows[0]
      await db.query("INSERT INTO scheduling_time_slot(form_id,slot_group_id,day_of_week,start_time,end_time,is_active) VALUES($1,$2,1,'14:00','15:00',TRUE)", [form.id, expiredGroup.id])
      const routes = new Map()
      registerFamilySignupRoutes({ get: (path, handler) => routes.set(path, handler), post() {} }, pool)
      const loadCatalog = async (path, params, query) => {
        let payload
        const response = { status: () => response, json: value => { payload = value } }
        await routes.get(path)({ params, query }, response)
        assert.equal(payload.success, true, payload.message)
        return payload.data
      }
      const query = { leadRegistration: '1' }
      const classes = await loadCatalog('/api/signup/catalog/programs/:programsId/classes', { programsId: program.id }, query)
      assert.deepEqual(classes.map(item => item.id), [Number(klass.id)])
      const offerings = await loadCatalog('/api/signup/catalog/classes/:classEventId/offerings', { classEventId: klass.id }, query)
      assert.deepEqual(offerings.scheduleOptions.map(item => item.slotGroupId), [Number(group.id)])
    })
    await t.test('parent completes missing family, class, and date details in one invitation', async () => {
      const familyLead = await createLead(pool, facilityId, {
        firstName: 'Parent', lastName: 'Partial', email: `partial-${nonce}@example.test`,
      })
      const laterGroup = (await db.query('INSERT INTO scheduling_slot_group(form_id,max_participants,is_active) VALUES($1,4,TRUE) RETURNING id', [form.id])).rows[0]
      const laterSlot = (await db.query("INSERT INTO scheduling_time_slot(form_id,slot_group_id,day_of_week,start_time,end_time,is_active) VALUES($1,$2,2,'17:00','18:00',TRUE) RETURNING id", [form.id, laterGroup.id])).rows[0]
      const invitation = await createLeadInvitation(pool, {
        facilityId, leadId: familyLead.id, userId: owner.id,
        body: {
          children: [{ firstName: 'Casey' }],
          selections: [
            { kind: 'reserved', programsId: program.id, classEventId: klass.id, timeSlotId: laterSlot.id },
            { kind: 'class', childIndex: 0, programsId: program.id, classEventId: klass.id, enrollmentStartDate },
            { kind: 'program', programsId: program.id },
          ],
        },
      }, { sendInvitation })
      const holdBefore = (await db.query('SELECT member_id,invite_child_index,enrollment_start_date FROM scheduling_signup WHERE account_invite_id=$1', [invitation.id])).rows[0]
      assert.deepEqual(holdBefore, { member_id: null, invite_child_index: null, enrollment_start_date: null })
      assert.equal((await db.query('SELECT pending_registration_holds($1) AS n', [laterGroup.id])).rows[0].n, 1)
      await db.query('SAVEPOINT cancel_hold')
      await db.query("UPDATE scheduling_signup SET status='cancelled' WHERE account_invite_id=$1", [invitation.id])
      assert.equal((await db.query('SELECT pending_registration_holds($1) AS n', [laterGroup.id])).rows[0].n, 0)
      await db.query('ROLLBACK TO SAVEPOINT cancel_hold')
      await db.query('RELEASE SAVEPOINT cancel_hold')
      const credentials = { token: captured.token, username: invitation.username, password: captured.password }
      const opened = await openLeadRegistration(pool, invitation.id, credentials)
      assert.equal(opened.guardian.phone, '')
      assert.equal(opened.children[0].firstName, 'Casey')
      assert.equal(opened.children[0].dateOfBirth, '')
      assert.equal(opened.selections[0].childIndex, null)
      assert.equal(opened.selections[1].enrollmentStartDate, enrollmentStartDate)

      const enrollment = { classEventId: klass.id, schedulingFormId: form.id, slotGroupId: laterGroup.id, timeSlotId: laterSlot.id, enrollmentStartDate }
      const completion = {
        ...payload(), session: opened.session, primaryAdult: { ...payload().primaryAdult, firstName: 'Parent', lastName: 'Partial', email: familyLead.email, username: invitation.username },
        additionalMembers: payload().additionalMembers.map(child => ({ ...child, gender: 'prefer-not-to-say' })),
        enrollments: [0, 1, 2].map(memberIndex => ({ ...enrollment, memberIndex })),
      }
      await assert.rejects(() => completeLeadRegistration(pool, invitation.id, {
        ...completion, enrollments: [{ ...enrollment, memberIndex: 0, enrollmentStartDate: '' }, ...completion.enrollments.slice(1)],
      }), /Enter an enrollment start date/)
      await assert.rejects(() => completeLeadRegistration(pool, invitation.id, {
        ...completion, enrollments: [{ ...enrollment, memberIndex: 0, timeSlotId: slot.id }, ...completion.enrollments.slice(1)],
      }), /Use the class or time selected/)
      const saved = await completeLeadRegistration(pool, invitation.id, completion)
      assert.equal(saved.enrollmentsPrepared, true)
      assert.deepEqual(saved.pendingEnrollments.map(item => item.memberId), saved.memberIds)
      const holdAfter = (await db.query('SELECT member_id,enrollment_start_date::text FROM scheduling_signup WHERE account_invite_id=$1', [invitation.id])).rows[0]
      assert.equal(Number(holdAfter.member_id), Number(saved.payerMemberId))
      assert.equal(holdAfter.enrollment_start_date, enrollmentStartDate)

      await insertSignupForMember(db, { formId: form.id, formRow: form, slotGroupId: laterGroup.id, memberId: saved.memberIds[1],
        responses: { first_name: 'Casey', last_name: 'Invite', email: familyLead.email }, firstOccurrenceId: laterSlot.id,
        formTitle: form.title, mandateWaiver: false, enrollmentStartDate })
      const reopened = await openLeadRegistration(pool, invitation.id, { ...credentials, password: completion.primaryAdult.password })
      assert.deepEqual(reopened.result.pendingEnrollments.map(item => item.memberId), [saved.memberIds[0], saved.memberIds[2]])
    })
    await t.test('program archiving is blocked until all active classes are closed',async()=>{
      await rejectSql('UPDATE programs SET archived=TRUE WHERE id=$1',[program.id],/active classes/)
      await db.query('UPDATE program SET archived=TRUE,is_active=FALSE WHERE id=$1',[klass.id])
      await db.query('UPDATE programs SET archived=TRUE WHERE id=$1',[program.id])
      await rejectSql('UPDATE program SET archived=FALSE,is_active=TRUE WHERE id=$1',[klass.id],/Restore the program/)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM scheduling_signup WHERE account_invite_id=$1',[invitation.id])).rows[0].n,2)
    })
  } finally {await db.query('ROLLBACK');await db.end()}
})
