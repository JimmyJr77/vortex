import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { loadLeadTrialBooking,bookLeadTrialForStaff } from '../leadTrialBooking.js'
import { CANONICAL_WAIVER_TEMPLATES } from '../../platform/canonicalWaiverBodies.js'
import { validateRehearsalDatabaseUrl } from '../migrationAudit.js'

const connectionString=process.env.NEW_ADMIN_TEST_DATABASE_URL
if(connectionString)validateRehearsalDatabaseUrl(connectionString,{nodeEnv:'development'})

test('staff booking uses a verified lead family, existing waivers and the canonical one-time trial credit', {skip:!connectionString},async t=>{
  const db=new pg.Client({connectionString});await db.connect()
  const one=async(sql,values=[])=>(await db.query(sql,values)).rows[0]
  let depth=0
  const client={release(){},query(sql,args){return db.query(sql==='BEGIN'?`SAVEPOINT staff_trial_${++depth}`:
    sql==='COMMIT'?`RELEASE SAVEPOINT staff_trial_${depth--}`:sql==='ROLLBACK'?`ROLLBACK TO SAVEPOINT staff_trial_${depth--}`:sql,args)}}
  const pool={connect:async()=>client}
  try{
    await db.query('BEGIN')
    for(const file of ['882_lead_trial_contact_identity.sql','883_lead_last_contacted_date.sql'])
      await db.query(await readFile(new URL(`../../migrations/${file}`,import.meta.url),'utf8'))
    const suffix=randomUUID()
    const facilityId=Number((await one("INSERT INTO facility(name,timezone) VALUES('Staff lead trial regression','America/New_York') RETURNING id")).id)
    const familyId=Number((await one("INSERT INTO family(facility_id,family_name) VALUES($1,'Staff trial family') RETURNING id",[facilityId])).id)
    const contact=Number((await one(`INSERT INTO member(facility_id,family_id,first_name,last_name,email,date_of_birth)
      VALUES($1,$2,'Parent','Stafftrial',$3,'1985-01-01') RETURNING id`,[facilityId,familyId,`${suffix}@example.test`])).id)
    const date=(await one("SELECT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date+7)::text AS date")).date
    const secondDate=(await one("SELECT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date+14)::text AS date")).date
    const children=[]
    for(const name of ['First','Unsigned'])children.push(Number((await one(`INSERT INTO member(facility_id,family_id,first_name,last_name,date_of_birth)
      VALUES($1,$2,$3,'Stafftrial',($4::date-INTERVAL '10 years')::date) RETURNING id`,[facilityId,familyId,name,date])).id))
    await db.query('INSERT INTO family_member(family_id,member_id) SELECT $1,unnest($2::bigint[])',[familyId,[contact,...children]])
    await db.query('INSERT INTO parent_guardian_authority(parent_member_id,child_member_id,has_legal_authority) SELECT $1,unnest($2::bigint[]),TRUE',[contact,children])
    const leadId=Number((await one(`INSERT INTO registrations(facility_id,first_name,last_name,email,trial_contact_member_id,inquiry_source,campers)
      VALUES($1,'Parent','Stafftrial',$2,$3,'admin_portal',$4::jsonb) RETURNING id`,[facilityId,`${suffix}@example.test`,contact,JSON.stringify(children.map(memberId=>({memberId})))])).id)
    const top=Number((await one("INSERT INTO programs(facility_id,name,display_name) VALUES($1,'Fit & Flip','Fit & Flip') RETURNING id",[facilityId])).id)
    const klass=Number((await one(`INSERT INTO program(facility_id,category,programs_id,name,display_name,age_min,age_max,is_active,archived)
      VALUES($1,'GYMNASTICS',$2,$3,'Cyclones (8-11)',8,11,TRUE,FALSE) RETURNING id`,[facilityId,top,`staff-trial-${suffix}`])).id)
    const form=Number((await one(`INSERT INTO scheduling_form(program_id,programs_id,title,is_active,start_date,class_monthly_price_cents)
      VALUES($1,$2,'Cyclones (8-11)',TRUE,CURRENT_DATE,18000) RETURNING id`,[klass,top])).id)
    const group=Number((await one(`INSERT INTO scheduling_slot_group(form_id,schedule_mode,max_participants,active_start,dates_tbd,is_active)
      VALUES($1,'date',8,CURRENT_DATE,FALSE,TRUE) RETURNING id`,[form])).id)
    for(const classDate of [date,secondDate])await db.query(`INSERT INTO scheduling_time_slot(form_id,slot_group_id,schedule_mode,specific_date,
      start_time,end_time,max_participants,active_start,dates_tbd,is_active,allow_free_trials)
      VALUES($1,$2,'date',$3,'12:00','13:00',8,CURRENT_DATE,FALSE,TRUE,TRUE)`,[form,group,classDate])
    const template=CANONICAL_WAIVER_TEMPLATES[0]
    const waiverId=Number((await one(`INSERT INTO waiver_template(facility_id,name,version,body,waiver_type,is_required,active_from)
      VALUES($1,$2,$3,$4,$5,TRUE,now()) RETURNING id`,[facilityId,template.name,template.version,template.body,template.waiverType])).id)
    await db.query(`INSERT INTO member_waiver_acceptance(member_id,waiver_template_id,accepted_by_member_id,signature_name,payment_policy_acknowledged)
      VALUES($1,$2,$3,'Parent Stafftrial',TRUE)`,[children[0],waiverId,contact])
    const body={memberId:children[0],freeTrial:{program:'fit-flip',slotGroupId:group,classDate:date}}
    await t.test('eligible children use only the trusted household and legal guardian authority',async()=>{
      const context=await loadLeadTrialBooking(db,facilityId,leadId)
      assert.equal(context.facilityId,facilityId)
      assert.deepEqual(context.children.map(child=>child.memberId),children)
      await assert.rejects(loadLeadTrialBooking(db,facilityId+1000000,leadId),{statusCode:404})
      await assert.rejects(bookLeadTrialForStaff(pool,{facilityId,leadId,body:{...body,memberId:contact}}),{statusCode:403})
      await db.query('SAVEPOINT no_verified_link')
      await db.query("UPDATE registrations SET trial_contact_member_id=NULL,campers='[]',email='no-match@example.test' WHERE id=$1",[leadId])
      await assert.rejects(loadLeadTrialBooking(db,facilityId,leadId),/verified parent/)
      await db.query('ROLLBACK TO SAVEPOINT no_verified_link')
      await db.query('SAVEPOINT adult_guardian')
      await assert.rejects(db.query('UPDATE member SET date_of_birth=NULL WHERE id=$1',[contact]),{code:'23514'})
      await db.query('ROLLBACK TO SAVEPOINT adult_guardian')
      await assert.rejects(db.query("UPDATE member SET date_of_birth=(CURRENT_DATE-INTERVAL '15 years')::date WHERE id=$1",[contact]),{code:'23514'})
      await db.query('ROLLBACK TO SAVEPOINT adult_guardian')
    })
    await t.test('email matches stay hints until staff explicitly confirms the current unique same-facility member',async()=>{
      await db.query('SAVEPOINT confirm_contact')
      await db.query("UPDATE registrations SET trial_contact_member_id=NULL,campers='[]' WHERE id=$1",[leadId])
      const hint=await loadLeadTrialBooking(db,facilityId,leadId)
      assert.equal(hint.matchedContact.memberId,contact)
      assert.deepEqual(hint.children,[])
      assert.equal((await one('SELECT trial_contact_member_id FROM registrations WHERE id=$1',[leadId])).trial_contact_member_id,null)
      await assert.rejects(bookLeadTrialForStaff(pool,{facilityId,leadId,body:{linkMemberId:contact}}),{statusCode:400})
      await assert.rejects(bookLeadTrialForStaff(pool,{facilityId,leadId,body:{linkMemberId:children[0],confirmContact:true}}),{statusCode:409})
      const foreignFacility=Number((await one("INSERT INTO facility(name) VALUES('Foreign staff trial contact') RETURNING id")).id)
      const foreign=Number((await one("INSERT INTO member(facility_id,first_name,last_name,email) VALUES($1,'Foreign','Contact',$2) RETURNING id",[foreignFacility,`${suffix}@example.test`])).id)
      await assert.rejects(bookLeadTrialForStaff(pool,{facilityId,leadId,body:{linkMemberId:foreign,confirmContact:true}}),{statusCode:409})
      const confirmed=await bookLeadTrialForStaff(pool,{facilityId,leadId,body:{linkMemberId:contact,confirmContact:true}})
      assert.deepEqual(confirmed.children.map(child=>child.memberId),children)
      const linked=await one('SELECT trial_contact_member_id,member_id,converted_member_id,inquiry_source FROM registrations WHERE id=$1',[leadId])
      assert.deepEqual([Number(linked.trial_contact_member_id),linked.member_id,linked.converted_member_id,linked.inquiry_source],[contact,null,null,'admin_portal'])
      const ambiguousLogin=Number((await one(`INSERT INTO app_user(facility_id,role,full_name,username,email)
        VALUES($1,'MEMBER_ATHLETE','Ambiguous Contact',$2,$3) RETURNING id`,[facilityId,`ambiguous-${suffix}`,`${suffix}@example.test`])).id)
      await db.query("INSERT INTO member(facility_id,first_name,last_name,app_user_id) VALUES($1,'Ambiguous','Contact',$2)",[facilityId,ambiguousLogin])
      await assert.rejects(bookLeadTrialForStaff(pool,{facilityId,leadId,body:{linkMemberId:contact,confirmContact:true}}),{statusCode:409})
      await db.query('ROLLBACK TO SAVEPOINT confirm_contact')
    })
    await t.test('unsigned children cannot book and the staff path never records a waiver signature',async()=>{
      await assert.rejects(bookLeadTrialForStaff(pool,{facilityId,leadId,body:{...body,memberId:children[1]}}),/waivers must be signed/)
      assert.equal(Number((await one('SELECT count(*) AS count FROM member_waiver_acceptance WHERE member_id=ANY($1::bigint[])',[children])).count),1)
      assert.equal(Number((await one('SELECT count(*) AS count FROM drop_in_registration WHERE member_id=ANY($1::bigint[])',[children])).count),0)
    })
    await t.test('booking is free and retry-safe, while another date cannot consume a second credit',async()=>{
      const booking=await bookLeadTrialForStaff(pool,{facilityId,leadId,body})
      assert.equal(booking.memberId,children[0]);assert.equal(booking.totalCents,0);assert.equal(booking.status,'confirmed')
      assert.equal(booking.classDate,date);assert.equal(booking.className,'Cyclones (8-11)')
      assert.equal((await bookLeadTrialForStaff(pool,{facilityId,leadId,body})).id,booking.id)
      assert.equal((await loadLeadTrialBooking(db,facilityId,leadId)).bookings[0].id,booking.id)
      await assert.rejects(bookLeadTrialForStaff(pool,{facilityId,leadId,body:{...body,freeTrial:{...body.freeTrial,classDate:secondDate}}}),/already used/)
      assert.equal(Number((await one('SELECT count(*) AS count FROM drop_in_registration WHERE member_id=$1',[children[0]])).count),1)
      assert.equal(Number((await one('SELECT count(*) AS count FROM registrations WHERE facility_id=$1',[facilityId])).count),1)
      assert.equal(Number((await one('SELECT count(*) AS count FROM member_waiver_acceptance WHERE member_id=ANY($1::bigint[])',[children])).count),1)
    })
    await t.test('archived and converted leads cannot use the staff trial action',async()=>{
      await db.query('SAVEPOINT closed_lead')
      await db.query('UPDATE registrations SET archived=TRUE WHERE id=$1',[leadId])
      await assert.rejects(bookLeadTrialForStaff(pool,{facilityId,leadId,body}),/no longer open/)
      await db.query('UPDATE registrations SET archived=FALSE,converted_member_id=$2 WHERE id=$1',[leadId,contact])
      await assert.rejects(bookLeadTrialForStaff(pool,{facilityId,leadId,body}),/member account/)
      await db.query('ROLLBACK TO SAVEPOINT closed_lead')
    })
  }finally{await db.query('ROLLBACK');await db.end()}
})
