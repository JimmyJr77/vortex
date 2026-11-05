import test from 'node:test'
import assert from 'node:assert/strict'
import {pagination,searchValue} from '../common.js'
import {leadInput,listLeads} from '../leads.js'
import {assertSchedulingScope} from '../scope.js'
import {permissionMiddleware} from '../registerRoutes.js'
import {compareSnapshots,planLeadOwnership,validateRehearsalDatabaseUrl} from '../migrationAudit.js'
import {findMemberByEmail,findMemberById} from '../../members/createMemberStub.js'
import {resolveAdminSignupResponses} from '../../scheduling/adminSignupContact.js'

test('list bounds reject malformed pages and limit responses',()=>{
  assert.deepEqual(pagination(),{page:1,pageSize:25,offset:0})
  assert.deepEqual(pagination({page:2,pageSize:1000}),{page:2,pageSize:100,offset:100})
  for(const page of ['0','-1','1.2','garbage','100000000']) assert.throws(()=>pagination({page}),/Invalid|large/)
  assert.equal(searchValue('a%_b'),'%a\\%\\_b%')
})

test('lead validation cannot fabricate conversion or accept invalid email',()=>{
  assert.throws(()=>leadInput({firstName:'Alex',lastName:'Test',email:'invalid'}),/valid email/)
  assert.throws(()=>leadInput({status:'converted'},{partial:true}),/conversion/)
  assert.deepEqual(leadInput({notes:'Edited'},{partial:true}),{notes:'Edited'})
})

test('lead list carries tenant, escaped search, status, and pagination as bound values',async()=>{
  const calls=[]
  const db={query:async(text,values)=>{calls.push({text,values});return {rows:text.startsWith('SELECT COUNT')?[{total:0}]:[]}}}
  const result=await listLeads(db,7,{search:'x%',page:3,pageSize:5,status:'new'})
  assert.equal(result.rows.length,0)
  assert.equal(result.page,3)
  assert.equal(calls.length,2)
  assert.ok(calls.every(call=>call.values[0]===7&&call.values[1]==='%x\\%%'))
  assert.ok(calls.every(call=>call.text.includes('facility_id = $1')))
  assert.deepEqual(calls[0].values.slice(-2),[5,10])
})

test('scheduling mutation scope rejects absent identities and cross-facility objects',async()=>{
  const db={query:async()=>({rows:[]})}
  await assert.rejects(assertSchedulingScope(db,null,{kind:'signup',recordId:1}),/facility/)
  for(const kind of ['signup','group']) await assert.rejects(assertSchedulingScope(db,2,{kind,recordId:100}),error=>error.statusCode===404)
  await assert.rejects(assertSchedulingScope(db,2,{kind:'create',body:{memberId:99,formId:4,slotGroupId:8}}),error=>error.statusCode===404)
})

test('contact-based enrollment still requires a scoped class; member helper never chooses a default facility when supplied',async()=>{
  const calls=[]
  const db={query:async(text,values)=>{calls.push({text,values});return {rows:[{id:1}]}}}
  await assertSchedulingScope(db,8,{kind:'create',body:{formId:9,slotGroupId:10}})
  assert.deepEqual(calls[0].values,[9,10,8,null,null])
  await findMemberByEmail(db,' Member@Example.test ',{facilityId:8})
  assert.deepEqual(calls[1].values,['member@example.test',8])
  await findMemberById(db,22,{facilityId:8})
  assert.deepEqual(calls[2].values,[22,8])
  assert.equal(calls.length,3)
})

test('portal role alone never bypasses permission authorization',async()=>{
  let called=false,status
  const response={status(value){status=value;return this},json(){}}
  await permissionMiddleware({query:async()=>{throw new Error('must not query')}},'members.view')(
    {canonicalAccess:{portalAccess:{admin:false},facilityId:1,userId:1}},response,()=>{called=true})
  assert.equal(status,403);assert.equal(called,false)
})

test('migration refuses inferred global ownership with multiple facilities',async()=>{
  const db={query:async text=>({rows:text.includes('FROM facility')?[{id:1},{id:2}]:[{id:9}]})}
  await assert.rejects(planLeadOwnership(db,{facilityId:1}),/explicit reviewed lead IDs/)
  assert.deepEqual((await planLeadOwnership(db,{})).quarantined,[9])
  assert.deepEqual((await planLeadOwnership(db,{facilityId:1,leadIds:[9]})).assignable,[9])
})

test('migration comparison flags equal-count financial/reference changes',()=>{
  const before={tables:{billing_payment:{count:'1',fingerprint:'a',financialTotals:[{amount_cents:'500'}]}},anomalies:[]}
  assert.equal(compareSnapshots(before,structuredClone(before)).matches,true)
  const after=structuredClone(before);after.tables.billing_payment.fingerprint='b'
  assert.equal(compareSnapshots(before,after).matches,false)
})

test('rehearsal URL validation rejects production, hosted targets, and connection query overrides',()=>{
  assert.equal(validateRehearsalDatabaseUrl('postgres://user@127.0.0.1:5432/vortex_new_admin_dev',{nodeEnv:'development'}),'postgres://user@127.0.0.1:5432/vortex_new_admin_dev')
  for(const url of ['postgres://user@remote.test/vortex_new_admin_dev','postgres://user@localhost/production','postgres://user@localhost/vortex_new_admin_dev?host=remote.test','postgres://user@localhost/vortex_new_admin_dev#override']) assert.throws(()=>validateRehearsalDatabaseUrl(url),/loopback/)
  assert.throws(()=>validateRehearsalDatabaseUrl('postgres://user@localhost/vortex_new_admin_dev',{nodeEnv:'production'}),/production/)
})

test('youth signup contact comes from the canonical household without altering identity',async()=>{
  const member={id:10,first_name:'Young',last_name:'Athlete',email:null,phone:null}
  const calls=[]
  const db={query:async(text,values)=>{
    calls.push({text,values})
    return {rows:text.includes('FROM member subject')?[{id:9,first_name:'Parent',email:'parent@example.test'}]:[]}
  }}
  const result=await resolveAdminSignupResponses(db,member,{responses:{email:'untrusted@example.test',first_name:'Override',custom:'kept'}})
  assert.equal(result.email,'parent@example.test');assert.equal(result.first_name,'Young');assert.equal(result.custom,'kept');assert.equal(member.email,null)
  assert.ok(calls.every(call=>call.text.trim().startsWith('SELECT')))
  assert.match(calls.at(-1).text,/payer\.facility_id = subject\.facility_id/)
})

test('signup without any canonical contact gives an actionable validation error',async()=>{
  await assert.rejects(resolveAdminSignupResponses({query:async()=>({rows:[]})},{id:10,email:null}),error=>error.statusCode===400&&error.message.includes('contact email'))
})
