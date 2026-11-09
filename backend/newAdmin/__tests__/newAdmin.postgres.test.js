import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import express from 'express'
import pg from 'pg'
import jwt from 'jsonwebtoken'
import {createCanonicalAdminAuth} from '../../platform/canonicalAdminAuth.js'
import {registerNewAdminRoutes,registerLegacySchedulingScopeGuards} from '../registerRoutes.js'
import {registerSchedulingRoutes} from '../../scheduling/registerRoutes.js'
import {createScopedMember} from '../leads.js'
import {migrationSnapshot,compareSnapshots,planLeadOwnership,applyLeadOwnership,rollbackLeadOwnership} from '../migrationAudit.js'

const connectionString=process.env.NEW_ADMIN_TEST_DATABASE_URL
const allowed=()=>{
  if(!connectionString)return false
  const url=new URL(connectionString)
  if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.search||!/^\/vortex_new_admin_dev(?:_[a-z0-9_]+)?$/.test(url.pathname)) throw new Error('Tests require an isolated local vortex_new_admin_dev database.')
  return true
}

test('New Admin PostgreSQL and HTTP isolation, conversion, and migration rehearsal',{skip:!allowed()},async t=>{
  const pool=new pg.Pool({connectionString,max:6})
  const suffix=crypto.randomUUID().slice(0,8),secret='new-admin-isolation-test-only',facilityIds=[],leadIds=[],userIds=[]
  let server
  const createFacility=async()=>{
    const facility=Number((await pool.query("INSERT INTO facility(name,timezone) VALUES($1,'America/New_York') RETURNING id",[`HTTP fixture ${suffix}`])).rows[0].id)
    facilityIds.push(facility)
    const user=Number((await pool.query("INSERT INTO app_user(facility_id,role,email,full_name,username,is_active) VALUES($1,'ADMIN',$2,'Test Owner',$3,TRUE) RETURNING id",[facility,`owner-${facility}-${suffix}@example.test`,`owner_${facility}_${suffix}`])).rows[0].id)
    userIds.push(user)
    await pool.query('UPDATE facility SET owner_user_id=$2 WHERE id=$1',[facility,user])
    return {facility,user,token:jwt.sign({userId:user},secret,{expiresIn:'10m'})}
  }
  try {
    // Applying the additive migration twice is itself part of the rehearsal.
    const migration=await fs.readFile(new URL('../../migrations/841_new_admin.sql',import.meta.url),'utf8')
    await pool.query(migration);await pool.query(migration)
    await pool.query(await fs.readFile(new URL('../../migrations/842_jackrabbit_history.sql',import.meta.url),'utf8'))
    const first=await createFacility(),second=await createFacility()
    const client=await pool.connect()
    let member
    try {await client.query('BEGIN');member=await createScopedMember(client,first.facility,{firstName:'Avery',lastName:'Fixture',email:`avery-${suffix}@example.test`,dateOfBirth:'1990-01-02'});await client.query('COMMIT')}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
    const program=Number((await pool.query('INSERT INTO programs(facility_id,name,display_name) VALUES($1,$2,$2) RETURNING id',[first.facility,`Program ${suffix}`])).rows[0].id)
    const foreignProgram=Number((await pool.query('INSERT INTO programs(facility_id,name,display_name) VALUES($1,$2,$2) RETURNING id',[second.facility,`Foreign program ${suffix}`])).rows[0].id)
    const klass=Number((await pool.query("INSERT INTO program(facility_id,category,name,display_name,programs_id) VALUES($1,(enum_range(NULL::program_category))[1],$2,$2,$3) RETURNING id",[first.facility,`Class ${suffix}`,program])).rows[0].id)
    const noFormClass=Number((await pool.query("INSERT INTO program(facility_id,category,name,display_name,programs_id) VALUES($1,(enum_range(NULL::program_category))[1],$2,$2,$3) RETURNING id",[first.facility,`Unscheduled ${suffix}`,program])).rows[0].id)
    const form=Number((await pool.query('INSERT INTO scheduling_form(title,program_id,programs_id) VALUES($1,$2,$3) RETURNING id',[`Form ${suffix}`,klass,program])).rows[0].id)
    const group=Number((await pool.query('INSERT INTO scheduling_slot_group(form_id,max_participants) VALUES($1,12) RETURNING id',[form])).rows[0].id)
    await pool.query("INSERT INTO scheduling_slot_group(form_id,max_participants,is_active,active_end) VALUES($1,99,FALSE,NULL),($1,88,TRUE,'2020-01-01')",[form])
    const historicalOffering=Number((await pool.query("INSERT INTO scheduling_offering(form_id,start_date,is_selected) VALUES($1,'2026-01-01',FALSE) RETURNING id",[form])).rows[0].id)
    await pool.query('INSERT INTO scheduling_slot_group(form_id,max_participants,offering_id) VALUES($1,77,$2)',[form,historicalOffering])
    const slot=Number((await pool.query("INSERT INTO scheduling_time_slot(form_id,slot_group_id,day_of_week,start_time,end_time) VALUES($1,$2,1,'16:00','17:00') RETURNING id",[form,group])).rows[0].id)
    const signup=Number((await pool.query("INSERT INTO scheduling_signup(form_id,slot_group_id,time_slot_id,member_id,first_name,last_name,email,status,enrollment_start_date) VALUES($1,$2,$3,$4,'Avery','Fixture',$5,'confirmed',CURRENT_DATE) RETURNING id",[form,group,slot,member.memberId,`avery-${suffix}@example.test`])).rows[0].id)
    const app=express();app.use(express.json());app.use('/api/admin',createCanonicalAdminAuth(pool,secret))
    registerLegacySchedulingScopeGuards(app,pool);registerNewAdminRoutes(app,pool,{jwtSecret:secret})
    app.get('/api/admin/programs-top',async(_req,res)=>{const rows=(await pool.query('SELECT id FROM programs')).rows;res.json({success:true,data:rows,programs:rows})})
    app.get('/api/admin/categories',async(_req,res)=>{const rows=(await pool.query('SELECT id FROM programs')).rows;res.json({success:true,data:rows,categories:rows})})
    app.get('/api/admin/scheduling/members/:memberId/enrollments',(_req,res)=>res.json({success:true,data:{guardPassed:true}}))
    app.get('/api/admin/class-events/:id/scheduling-form',(_req,res)=>res.json({success:true,data:{guardPassed:true}}))
    app.get('/api/admin/scheduling/daily-roster',(_req,res)=>res.json({success:true,data:{classes:[{formId:form,athleteCount:1},{formId:99999999,athleteCount:2}],newRegistrations:[{signupId:signup},{signupId:99999999}]}}))
    registerSchedulingRoutes(app,pool)
    app.put('/api/admin/programs/:id',(_req,res)=>res.json({success:true,data:{guardPassed:true}}))
    server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance))})
    const url=`http://127.0.0.1:${server.address().port}`
    const request=async(path,{token=first.token,method='GET',body}={})=>{
      const response=await fetch(url+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ 'X-Test':'no-token'}),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})
      return {status:response.status,json:await response.json()}
    }
    await t.test('authentication uses canonical database access and never JWT role claims',async()=>{
      assert.equal((await request('/api/admin/new-admin/leads',{token:null})).status,401)
      const forged=jwt.sign({userId:99999999,role:'MASTER_ADMIN'},secret)
      assert.equal((await request('/api/admin/new-admin/leads',{token:forged})).status,401)
      const ordinary=Number((await pool.query("INSERT INTO app_user(facility_id,role,email,full_name,username,is_active) VALUES($1,'MEMBER_ATHLETE',$2,'Ordinary',$3,TRUE) RETURNING id",[first.facility,`ordinary-${suffix}@example.test`,`ordinary_${suffix}`])).rows[0].id)
      userIds.push(ordinary)
      assert.equal((await request('/api/admin/new-admin/leads',{token:jwt.sign({userId:ordinary,role:'ADMIN'},secret)})).status,403)
      const restricted=Number((await pool.query("INSERT INTO app_user(facility_id,role,email,full_name,username,is_active) VALUES($1,'ADMIN',$2,'Restricted Admin',$3,TRUE) RETURNING id",[first.facility,`restricted-${suffix}@example.test`,`restricted_${suffix}`])).rows[0].id)
      userIds.push(restricted)
      await pool.query("INSERT INTO app_user_permission_override(user_id,permission_id,effect) SELECT $1,id,'deny' FROM permission WHERE key='members.view'",[restricted])
      assert.equal((await request('/api/admin/new-admin/leads',{token:jwt.sign({userId:restricted,role:'MASTER_ADMIN'},secret)})).status,403)
      const restrictedToken=jwt.sign({userId:restricted},secret)
      for (const path of ['/api/admin/new-admin/enrollment-trend', '/api/admin/new-admin/families', `/api/admin/new-admin/families/${member.familyId}/workspace`, `/api/admin/new-admin/families/${member.familyId}/history`, `/api/admin/new-admin/members/${member.memberId}/workspace`]) {
        assert.equal((await request(path,{token:restrictedToken})).status,403)
      }
      assert.equal((await request(`/api/admin/scheduling/members/${member.memberId}/enrollments`,{token:restrictedToken})).status,200)
      await pool.query("INSERT INTO app_user_permission_override(user_id,permission_id,effect) SELECT $1,id,'deny' FROM permission WHERE key='scheduling.view'",[restricted])
      assert.equal((await request(`/api/admin/scheduling/members/${member.memberId}/enrollments`,{token:restrictedToken})).status,403)
      await pool.query("INSERT INTO app_user_permission_override(user_id,permission_id,effect) SELECT $1,id,'deny' FROM permission WHERE key='scheduling.manage'",[restricted])
      assert.equal((await request(`/api/admin/class-events/${klass}/scheduling-form`,{token:restrictedToken})).status,200)
      assert.equal((await request(`/api/admin/class-events/${noFormClass}/scheduling-form`,{token:restrictedToken})).status,403)
    })
    await t.test('family trend requires canonical access and reads only the authenticated facility', async () => {
      assert.equal((await request('/api/admin/new-admin/enrollment-trend', { token: null })).status, 401)
      const trend = await request('/api/admin/new-admin/enrollment-trend')
      assert.equal(trend.status, 200)
      assert.ok(trend.json.data.months.some(row => row.newFamilies === 1))
      const other = await request('/api/admin/new-admin/enrollment-trend', { token: second.token })
      assert.equal(other.status, 200)
      assert.ok(other.json.data.months.every(row => row.newFamilies === null))
    })
    await t.test('bounded class/member detail only exposes the authenticated facility',async()=>{
      const list=await request('/api/admin/new-admin/classes?pageSize=1');assert.equal(list.status,200);assert.equal(list.json.data.rows.length,1)
      const detail=await request(`/api/admin/new-admin/classes/${klass}`);assert.equal(detail.status,200);assert.equal(detail.json.data.class.capacity,12);assert.equal(detail.json.data.groups[0].slots[0].id,slot);assert.equal(detail.json.data.roster.rows[0].memberId,member.memberId)
      assert.equal((await request(`/api/admin/new-admin/classes/${klass}`,{token:second.token})).status,404)
      const profile=await request(`/api/admin/new-admin/members/${member.memberId}`);assert.equal(profile.status,200);assert.equal(profile.json.data.household.payerMemberId,member.memberId);assert.equal(profile.json.data.enrollments[0].id,signup)
      assert.equal((await request(`/api/admin/new-admin/members/${member.memberId}`,{token:second.token})).status,404)
      const family = await request(`/api/admin/new-admin/members/${member.memberId}/workspace`)
      assert.equal(family.status,200); assert.equal(family.json.data.family.id,member.familyId)
      const billingRestricted=Number((await pool.query("INSERT INTO app_user(facility_id,role,email,full_name,username,is_active) VALUES($1,'ADMIN',$2,'Member Staff',$3,TRUE) RETURNING id",[first.facility,`members-only-${suffix}@example.test`,`members_only_${suffix}`])).rows[0].id)
      userIds.push(billingRestricted)
      await pool.query("INSERT INTO app_user_permission_override(user_id,permission_id,effect) SELECT $1,id,'deny' FROM permission WHERE key='billing.view'",[billingRestricted])
      const restrictedFamily=await request(`/api/admin/new-admin/families/${member.familyId}/workspace`,{token:jwt.sign({userId:billingRestricted},secret)})
      assert.equal(restrictedFamily.status,200);assert.equal(restrictedFamily.json.data.financial,null);assert.equal(restrictedFamily.json.data.permissions.canViewBilling,false)
      for (const path of [`/api/admin/new-admin/families/${member.familyId}/workspace`, `/api/admin/new-admin/families/${member.familyId}/history`, `/api/admin/new-admin/members/${member.memberId}/workspace`]) {
        assert.equal((await request(path,{token:second.token})).status,404)
      }
      assert.equal((await request('/api/admin/new-admin/leads?page=0')).status,400)
      const catalog=await request('/api/admin/programs-top')
      assert.deepEqual(catalog.json.data.map(r=>Number(r.id)),[program]);assert.deepEqual(catalog.json.programs.map(r=>Number(r.id)),[program])
      const categories=await request('/api/admin/categories')
      assert.deepEqual(categories.json.data.map(r=>Number(r.id)),[program]);assert.deepEqual(categories.json.categories.map(r=>Number(r.id)),[program])
      const roster=await request('/api/admin/scheduling/daily-roster')
      assert.equal(roster.json.data.classCount,1);assert.equal(roster.json.data.athleteCount,1)
      assert.equal(roster.json.data.newRegistrationCount,1);assert.deepEqual(roster.json.data.newRegistrations,[{signupId:signup}])
    })
    await t.test('old and new enrollment/capacity mutations reject cross-facility IDs',async()=>{
      for(const path of [`/api/admin/new-admin/enrollments/${signup}`,`/api/admin/scheduling/signups/${signup}`]) assert.equal((await request(path,{token:second.token,method:'PATCH',body:{status:'cancelled'}})).status,404)
      for(const path of [`/api/admin/new-admin/groups/${group}`,`/api/admin/scheduling/slot-groups/${group}`]) assert.equal((await request(path,{token:second.token,method:'PATCH',body:{maxParticipants:10}})).status,404)
      assert.equal((await request('/api/admin/new-admin/enrollments',{token:second.token,method:'POST',body:{memberId:member.memberId,formId:form,slotGroupId:group}})).status,404)
      for(const [method,path] of [['PUT',`/api/admin/scheduling/forms/${form}`],['DELETE',`/api/admin/scheduling/slot-groups/${group}`],['PATCH',`/api/admin/scheduling/time-slots/${slot}`],['PUT',`/api/admin/scheduling/offerings/${historicalOffering}`],['GET',`/api/admin/scheduling/members/${member.memberId}/enrollments`],['GET',`/api/admin/scheduling/forms/${form}`]]) {
        assert.equal((await request(path,{token:second.token,method,body:method==='GET'?undefined:{}})).status,404)
      }
      assert.equal((await request(`/api/admin/programs/${klass}`,{method:'PUT',body:{programsId:foreignProgram}})).status,404)
      assert.equal((await request(`/api/admin/programs/${klass}`,{method:'PUT',body:{programsId:program}})).status,200)
      assert.equal((await request(`/api/admin/scheduling/orphaned-signups/${signup}/re-enroll`,{token:second.token,method:'POST',body:{targetFormId:form,slotGroupId:group}})).status,404)
      const unchanged=await pool.query('SELECT status FROM scheduling_signup WHERE id=$1',[signup]);assert.equal(unchanged.rows[0].status,'confirmed')
    })
    let convertedLead
    await t.test('lead create/edit/archive and concurrent conversion are scoped and idempotent',async()=>{
      const create=await request('/api/admin/new-admin/leads',{method:'POST',body:{firstName:'Lead',lastName:'Fixture',email:`lead-${suffix}@example.test`}})
      assert.equal(create.status,200);convertedLead=create.json.data.id;leadIds.push(convertedLead)
      assert.equal((await request(`/api/admin/new-admin/leads/${convertedLead}`,{method:'PATCH',token:second.token,body:{notes:'forbidden'}})).status,404)
      assert.equal((await request(`/api/admin/new-admin/leads/${convertedLead}`,{method:'PATCH',body:{status:'qualified',notes:'Ready'}})).status,200)
      const before=Number((await pool.query('SELECT COUNT(*) AS n FROM member WHERE facility_id=$1',[first.facility])).rows[0].n)
      const converted=await Promise.all([1,2].map(()=>request(`/api/admin/new-admin/leads/${convertedLead}/convert`,{method:'POST',body:{dateOfBirth:'1988-02-20'}})))
      assert.deepEqual(converted.map(r=>r.status),[200,200]);assert.equal(converted[0].json.data.memberId,converted[1].json.data.memberId)
      assert.equal(converted.filter(r=>r.json.data.alreadyConverted).length,1)
      assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM member WHERE facility_id=$1',[first.facility])).rows[0].n),before+1)
      assert.equal((await request('/api/admin/new-admin/leads',{token:second.token})).json.data.total,0)
      // The existing production registrations handler stays in server.js.
      assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM registrations WHERE id=$1',[convertedLead])).rows[0].n),1)
      // Legacy links must resolve to the same account without creating another household.
      await pool.query('UPDATE registrations SET member_id=converted_member_id,converted_member_id=NULL WHERE id=$1',[convertedLead])
      const legacyConverted=await request(`/api/admin/new-admin/leads/${convertedLead}/convert`,{method:'POST',body:{dateOfBirth:'1988-02-20'}})
      assert.equal(legacyConverted.status,200);assert.equal(legacyConverted.json.data.alreadyConverted,true)
      assert.equal(legacyConverted.json.data.memberId,converted[0].json.data.memberId)
      assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM member WHERE facility_id=$1',[first.facility])).rows[0].n),before+1)
      assert.equal((await request(`/api/admin/new-admin/leads/${convertedLead}`,{method:'DELETE'})).status,200)
    })
    await t.test('dry-run/apply/reapply/rollback preserves ledger totals and reference fingerprints',async()=>{
      const lead=Number((await pool.query('INSERT INTO registrations(first_name,last_name,email) VALUES($1,$2,$3) RETURNING id',['Unowned','Fixture',`unowned-${suffix}@example.test`])).rows[0].id)
      leadIds.push(lead)
      // Explicitly quarantine this fixture, even when the local seed maps public ingress.
      await pool.query('UPDATE registrations SET facility_id=NULL WHERE id=$1',[lead])
      const before=await migrationSnapshot(pool)
      assert.deepEqual(before.missingTables,[])
      for(const table of ['billing_monthly_invoice','billing_monthly_invoice_line','billing_payment_application','billing_charge_credit_application','stripe_webhook_event','scheduling_offering']) assert.ok(before.tables[table],table)
      const plan=await planLeadOwnership(pool,{facilityId:first.facility,leadIds:[lead]});assert.deepEqual(plan.assignable,[lead])
      assert.equal((await pool.query('SELECT facility_id FROM registrations WHERE id=$1',[lead])).rows[0].facility_id,null)
      const applied=await applyLeadOwnership(pool,{facilityId:first.facility,leadIds:[lead]});assert.deepEqual(applied.appliedIds,[lead])
      const after=await migrationSnapshot(pool);assert.equal(compareSnapshots(before,after).matches,true)
      assert.deepEqual((await applyLeadOwnership(pool,{facilityId:first.facility,leadIds:[lead]})).appliedIds,[])
      const rolled=await rollbackLeadOwnership(pool,applied.batchId);assert.deepEqual(rolled.restoredIds,[lead])
      const appliedAgain=await applyLeadOwnership(pool,{facilityId:first.facility,leadIds:[lead]})
      await pool.query("UPDATE registrations SET admin_notes='concurrent edit',updated_at=now() WHERE id=$1",[lead])
      assert.deepEqual((await rollbackLeadOwnership(pool,appliedAgain.batchId)).concurrentOrConvertedIds,[lead])
    })
  } catch(error) {
    console.error('New Admin fixture/test failed:',error)
    throw error
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve))
    // Delete only this test's explicitly tracked fixtures; never reset shared data.
    await pool.query('DELETE FROM new_admin_lead_ownership_audit WHERE registration_id=ANY($1::int[])',[leadIds])
    await pool.query('DELETE FROM registrations WHERE id=ANY($1::int[])',[leadIds])
    await pool.query('DELETE FROM scheduling_signup WHERE form_id IN (SELECT f.id FROM scheduling_form f JOIN program p ON p.id=f.program_id WHERE p.facility_id=ANY($1::bigint[]))',[facilityIds])
    await pool.query('DELETE FROM program WHERE facility_id=ANY($1::bigint[])',[facilityIds])
    await pool.query('DELETE FROM family_billing_account WHERE family_id IN (SELECT id FROM family WHERE facility_id=ANY($1::bigint[]))',[facilityIds])
    await pool.query('DELETE FROM family_member WHERE family_id IN (SELECT id FROM family WHERE facility_id=ANY($1::bigint[]))',[facilityIds])
    await pool.query('DELETE FROM member WHERE facility_id=ANY($1::bigint[])',[facilityIds])
    await pool.query('DELETE FROM family WHERE facility_id=ANY($1::bigint[])',[facilityIds])
    await pool.query('DELETE FROM facility WHERE id=ANY($1::bigint[])',[facilityIds])
    await pool.end()
  }
})
