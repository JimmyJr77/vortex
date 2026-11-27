import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { validateRehearsalDatabaseUrl } from '../migrationAudit.js'
import { listLeads, leadNotes, saveLead } from '../leads.js'
import { recordFreeTrialLead } from '../trialLeads.js'
import { loadCanonicalLeadGroup } from '../leadDeduplication.js'
import { changeLeadLifecycle } from '../leadLifecycle.js'

const connectionString=process.env.NEW_ADMIN_TEST_DATABASE_URL
if(connectionString)validateRehearsalDatabaseUrl(connectionString,{nodeEnv:'development'})

test('generated trial history combines with its verified original inquiry without erasing repeated submissions or evidence', {skip:!connectionString},async t=>{
  const db=new pg.Client({connectionString});await db.connect()
  const one=async(sql,values=[])=>(await db.query(sql,values)).rows[0]
  try{
    await db.query('BEGIN')
    await db.query(await readFile(new URL('../../migrations/882_lead_trial_contact_identity.sql',import.meta.url),'utf8'))
    await db.query(await readFile(new URL('../../migrations/883_lead_last_contacted_date.sql',import.meta.url),'utf8'))
    const suffix=randomUUID()
    const facilityId=Number((await one("INSERT INTO facility(name,timezone) VALUES('Lead dedup regression','America/New_York') RETURNING id")).id)
    const familyId=Number((await one("INSERT INTO family(facility_id,family_name) VALUES($1,'Dedup household') RETURNING id",[facilityId])).id)
    const contact=Number((await one(`INSERT INTO member(facility_id,family_id,first_name,last_name,email,date_of_birth)
      VALUES($1,$2,'Jordan','Contact',$3,'1985-01-01') RETURNING id`,[facilityId,familyId,`${suffix}@example.test`])).id)
    const child=Number((await one(`INSERT INTO member(facility_id,family_id,first_name,last_name,date_of_birth,gender)
      VALUES($1,$2,'Avery','Contact','2016-01-01','female') RETURNING id`,[facilityId,familyId])).id)
    const otherGuardian=Number((await one(`INSERT INTO member(facility_id,family_id,first_name,last_name,email,date_of_birth)
      VALUES($1,$2,'Other','Guardian',$3,'1980-01-01') RETURNING id`,[facilityId,familyId,`other-${suffix}@example.test`])).id)
    await db.query('INSERT INTO family_member(family_id,member_id) SELECT $1,unnest($2::bigint[])',[familyId,[contact,child,otherGuardian]])
    await db.query('INSERT INTO parent_guardian_authority(parent_member_id,child_member_id,has_legal_authority) VALUES($1,$2,TRUE)',[contact,child])
    const top=Number((await one('INSERT INTO programs(facility_id,name,display_name) VALUES($1,$2,$2) RETURNING id',[facilityId,`Dedup ${suffix}`])).id)
    const klass=Number((await one(`INSERT INTO program(facility_id,category,programs_id,name,display_name)
      VALUES($1,(enum_range(NULL::program_category))[1],$2,$3,$3) RETURNING id`,[facilityId,top,`Dedup class ${suffix}`])).id)
    const form=Number((await one("INSERT INTO scheduling_form(program_id,programs_id,title) VALUES($1,$2,'Dedup class') RETURNING id",[klass,top])).id)
    const group=Number((await one('INSERT INTO scheduling_slot_group(form_id) VALUES($1) RETURNING id',[form])).id)
    await db.query(`INSERT INTO drop_in_registration(member_id,form_id,slot_group_id,class_date,first_name,last_name,email,benefit_type,status)
      VALUES($1,$2,$3,'2027-01-15','Avery','Contact',$4,'free_trial','attended')`,[child,form,group,`${suffix}@example.test`])
    const addLead=async({source='/',memberId=null,trialContact=null,created='2026-01-01',message='',notes='',followUp=false,convertedAt=null}={})=>Number((await one(`
      INSERT INTO registrations(facility_id,first_name,last_name,email,inquiry_source,member_id,trial_contact_member_id,
        campers,created_at,message,admin_notes,follow_up,converted_member_id,converted_at)
      VALUES($1,'Jordan','Contact',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [facilityId,`${suffix}@example.test`,source,memberId,trialContact,JSON.stringify(source==='free_trial'
      ?[{memberId:child,firstName:'Avery',lastName:'Contact',dateOfBirth:'2016-01-01'}]
      :[{firstName:'Avery',dateOfBirth:'2016-01-01'}]),created,message,notes,followUp,convertedAt?contact:null,convertedAt])).id)
    const original=await addLead({message:'Original public question',created:'2026-01-01'})
    await db.query("UPDATE registrations SET first_name='  Jordan  ',last_name=' Contact  ' WHERE id=$1",[original])
    const repeated=await addLead({message:'Legitimate repeated inquiry',created:'2026-01-02'})
    const auto=await addLead({source:'free_trial',memberId:contact,created:'2026-03-01',notes:'Preserve trial notes',followUp:true})
    const secondAuto=await addLead({source:'free_trial',memberId:contact,created:'2026-04-01'})
    await db.query("INSERT INTO note(subject_type,subject_id,note_type,body,source) VALUES('member',$1,'staff_note','Verified household member note','dedup_regression')",[contact])
    const filter={search:suffix,includeMembers:'true'}
    await t.test('grouping precedes filters/pagination and retains child identity, original date, trial rows and all notes',async()=>{
      const result=await listLeads(db,facilityId,filter)
      assert.equal(result.total,2)
      assert.deepEqual(result.rows.map(row=>row.id),[repeated,original])
      const canonical=result.rows.find(row=>row.id===original)
      assert.deepEqual(canonical.relatedRegistrationIds,[original,auto,secondAuto])
      assert.equal(new Date(canonical.createdAt).toISOString(),(await one('SELECT created_at FROM registrations WHERE id=$1',[original])).created_at.toISOString())
      assert.equal(canonical.inquiry.source,'/')
      assert.equal(canonical.convertedMemberId,null)
      assert.equal(canonical.displayStatus,'lead')
      assert.deepEqual(canonical.participationTags,['inquiry','free_trial'])
      assert.equal(canonical.inquiry.campers.length,1)
      assert.equal(canonical.inquiry.campers[0].memberId,child)
      assert.equal(canonical.freeTrials.length,1)
      assert.equal(canonical.followUp,true)
      assert.equal((await listLeads(db,facilityId,{...filter,followUp:'true',pageSize:1,page:2})).total,1)
      assert.deepEqual((await listLeads(db,facilityId,{...filter,followUp:'true',pageSize:1,page:2})).rows,[])
      const keywords=await listLeads(db,facilityId,{...filter,keywords:'Preserve trial notes'})
      assert.deepEqual(keywords.rows.map(row=>row.id),[original])
      assert.deepEqual((await leadNotes(db,facilityId,auto)).map(note=>note.body).sort(),['Original public question','Preserve trial notes','Verified household member note'])
      assert.deepEqual(await loadCanonicalLeadGroup(db,facilityId,secondAuto),{canonicalId:original,registrationIds:[original,auto,secondAuto],memberId:contact})
      assert.equal((await one('SELECT count(*)::int AS count FROM registrations WHERE facility_id=$1',[facilityId])).count,4)
    })
    await t.test('explicit linked original wins over older contact guesses and conversion data remains dated',async()=>{
      await db.query('SAVEPOINT stronger_identity')
      const linked=await addLead({trialContact:contact,created:'2026-02-01',message:'Verified original'})
      await db.query("UPDATE registrations SET converted_member_id=$2,converted_at='2026-10-01T15:00:00Z' WHERE id=$1",[auto,contact])
      const canonical=(await listLeads(db,facilityId,filter)).rows.find(row=>row.id===linked)
      assert.deepEqual(canonical.relatedRegistrationIds,[linked,auto,secondAuto])
      assert.equal(canonical.displayStatus,'converted')
      assert.equal(canonical.convertedAt,'2026-10-01T15:00:00.000Z')
      assert.equal(canonical.convertedMemberId,contact)
      assert.deepEqual((await listLeads(db,facilityId,{...filter,converted:'true'})).rows.map(row=>row.id),[linked])
      await db.query('ROLLBACK TO SAVEPOINT stronger_identity')
    })
    await t.test('group edits clear merged flags and preserve identity, trusted children and correspondence after a contact correction',async()=>{
      const client={query:(sql,values)=>db.query(sql==='BEGIN'?'SAVEPOINT grouped_edit':sql==='COMMIT'?'RELEASE SAVEPOINT grouped_edit':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT grouped_edit':sql,values),release(){}}
      await saveLead({connect:async()=>client},facilityId,original,{firstName:'Jordan Corrected',email:`corrected-${suffix}@example.test`,
        contacted:false,followUp:false,inquiry:{campers:[{memberId:child,firstName:'Avery',lastName:'Contact',dateOfBirth:'2016-01-01',gender:'female'}]}},{})
      const edited=(await listLeads(db,facilityId,filter)).rows.find(row=>row.id===original)
      assert.deepEqual(edited.relatedRegistrationIds,[original,auto,secondAuto])
      assert.equal(edited.followUp,false)
      assert.equal(edited.contacted,false)
      assert.equal(edited.inquiry.campers[0].memberId,child)
      assert.deepEqual((await db.query('SELECT follow_up FROM registrations WHERE id=ANY($1::bigint[])',[[original,auto,secondAuto]])).rows,
        [{follow_up:false},{follow_up:false},{follow_up:false}])
      assert.ok((await leadNotes(db,facilityId,original)).some(note=>note.body==='Verified household member note'))
      assert.ok((await listLeads(db,facilityId,{...filter,keywords:'Verified household member note'})).rows.some(row=>row.id===original))
    })
    await t.test('future trial writes reuse the original and conversion hook recognizes its preserved inquiry source',async()=>{
      assert.equal(await recordFreeTrialLead(db,{facilityId,payerMemberId:contact,memberId:child}),original)
      assert.equal(await recordFreeTrialLead(db,{facilityId,payerMemberId:contact,memberId:child}),original)
      const saved=await one('SELECT member_id,trial_contact_member_id,inquiry_source,created_at,campers FROM registrations WHERE id=$1',[original])
      assert.equal(saved.member_id,null)
      assert.equal(Number(saved.trial_contact_member_id),contact)
      assert.equal(saved.inquiry_source,'/')
      assert.equal(saved.campers.length,1)
      assert.equal((await one('SELECT count(*)::int AS count FROM registrations WHERE facility_id=$1',[facilityId])).count,4)
      await db.query(`INSERT INTO scheduling_signup(form_id,slot_group_id,member_id,first_name,last_name,email,status,enrollment_start_date)
        VALUES($1,$2,$3,'Avery','Contact',$4,'confirmed','2027-01-01')`,[form,group,child,`${suffix}@example.test`])
      const converted=(await listLeads(db,facilityId,filter)).rows.find(row=>row.id===original)
      assert.equal(converted.displayStatus,'converted')
      assert.ok(converted.convertedAt)
      assert.equal(converted.convertedMemberId,contact)
    })
    await t.test('grouped archive and restore change every source once without resurfacing a duplicate',async()=>{
      const client={query:(sql,values)=>db.query(sql==='BEGIN'?'SAVEPOINT grouped_lifecycle':sql==='COMMIT'?'RELEASE SAVEPOINT grouped_lifecycle':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT grouped_lifecycle':sql,values),release(){}}
      const pool={connect:async()=>client}
      await changeLeadLifecycle(pool,facilityId,original,'archive')
      assert.deepEqual((await listLeads(db,facilityId,filter)).rows.map(row=>row.id),[repeated])
      const archived=await listLeads(db,facilityId,{...filter,archived:'true'})
      assert.equal(archived.total,1)
      assert.deepEqual(archived.rows[0].relatedRegistrationIds,[original,auto,secondAuto])
      await changeLeadLifecycle(pool,facilityId,original,'restore')
      assert.equal((await listLeads(db,facilityId,filter)).total,2)
      assert.equal((await listLeads(db,facilityId,{...filter,archived:'true'})).total,0)
    })
    await t.test('another guardian and a foreign facility never merge by household or shared email alone',async()=>{
      await db.query('SAVEPOINT unrelated_contacts')
      const unrelated=Number((await one(`INSERT INTO registrations(facility_id,first_name,last_name,email,member_id,inquiry_source,campers)
        VALUES($1,'Other','Guardian',$2,$3,'free_trial','[]') RETURNING id`,[facilityId,`other-${suffix}@example.test`,otherGuardian])).id)
      assert.deepEqual((await loadCanonicalLeadGroup(db,facilityId,unrelated)).registrationIds,[unrelated])
      await assert.rejects(loadCanonicalLeadGroup(db,facilityId+1000000,auto),{statusCode:404})
      await db.query('ROLLBACK TO SAVEPOINT unrelated_contacts')
    })
  }finally{await db.query('ROLLBACK');await db.end()}
})
