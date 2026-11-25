import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { assessmentTimeFromAdminBatch, createAssessmentStaffAuth, saveAssessmentTime, validateAssessmentTime, registerAssessmentAdminScheduleGuards } from '../trialAssessmentSchedule.js'
import { createSchedulingHandlers } from '../handlers.js'

const secret = 'local-unit-test-secret-do-not-use-in-production'
const body = { scheduleMode: 'day', dayOfWeek: 6, startTime: '12:00', endTime: '12:30', maxParticipants: 1, activeStart: '2026-11-16', activeEnd: null }
function response() { return { code: 200, body: null, status(code) { this.code=code;return this }, json(body) { this.body=body;return this } } }
const user = { user_id: 7, facility_id: 1, is_active: true, staff_access_active: true, can_access_coach_portal: true, can_access_admin_portal: false }

test('coach schedule access uses current canonical staff access, denying members and invalid tokens', async () => {
  for (const [row, expected] of [[user,200], [{...user,can_access_coach_portal:false},403], [{...user,is_active:false},403], [{...user,staff_access_active:false},403]]) {
    const db = { query: async () => ({rows:[row]}) }
    let continued = false
    const res=response()
    await createAssessmentStaffAuth(db,{jwtSecret:secret})({headers:{authorization:`Bearer ${jwt.sign({userId:7,role:'MASTER_ADMIN',facilityId:99},secret)}`}},res,()=>{continued=true})
    assert.equal(res.code,expected)
    assert.equal(continued,expected===200)
  }
  const res=response()
  await createAssessmentStaffAuth({},{jwtSecret:secret})({headers:{authorization:'Bearer invalid'}},res,()=>assert.fail())
  assert.equal(res.code,401)
})

test('assessment input rejects invalid times, capacities, calendar dates, and days', () => {
  assert.equal(validateAssessmentTime(body).dayOfWeek,6)
  for (const patch of [{startTime:'24:00'},{endTime:'11:59'},{endTime:'13:00'},{endTime:'12:15'},{maxParticipants:0},{maxParticipants:2},{maxParticipants:1.5},{dayOfWeek:8},{activeStart:'2027-02-30'},{scheduleMode:'date',specificDate:null},{scheduleMode:'date',specificDate:'2026-11-15'}]) assert.throws(()=>validateAssessmentTime({...body,...patch}))
})

test('admin assessment builder rejects multi-time groups and date ranges', () => {
  const batch={scheduleMode:'day',activeDatesMode:'custom',activeStart:body.activeStart,maxParticipants:1,daySchedule:{weeks:[{weekLetter:'A',days:[{dayOfWeek:6,times:[{startTime:'12:00',endTime:'12:30'}]}]}]}}
  assert.deepEqual(validateAssessmentTime(assessmentTimeFromAdminBatch(batch)),{...body,specificDate:null})
  batch.daySchedule.weeks[0].days[0].times.push({startTime:'14:00',endTime:'15:00'})
  assert.throws(()=>assessmentTimeFromAdminBatch(batch),/separate schedule/)
  assert.throws(()=>assessmentTimeFromAdminBatch({scheduleMode:'date',dateSchedule:{entries:[{type:'range',startDate:'2027-01-01',endDate:'2027-01-08',times:[{startTime:'12:00',endTime:'13:00'}]}]}}),/separate schedule/)
})

function fixture({assessment=true,bookings=[],slots=1}={}) {
  const writes=[]
  return {writes,async query(sql,params) {
    if(sql.includes('SELECT sf.id, sf.title')) return {rows:[{id:153,is_trial_assessment:assessment,today:'2026-11-16'}]}
    if(sql.includes('SELECT sg.*')) return {rows:[{id:295,form_id:153,max_participants:1,effective_start:'2026-11-16',effective_end:null,offering_id:139}]}
    if(sql.includes('SELECT * FROM scheduling_time_slot')) return {rows:Array.from({length:slots},()=>({id:500,schedule_mode:'day',day_of_week:6,specific_date:null,start_time:'12:00:00',end_time:'12:30:00'}))}
    if(sql.includes('SELECT class_date')) return {rows:bookings}
    if(sql.includes('pending_registration_holds')) return {rows:[{count:0}]}
    if(sql.startsWith('UPDATE')||sql.startsWith('INSERT')) writes.push({sql,params})
    return {rows:[]}
  }}
}

test('a non-assessment class is rejected before schedule writes',async()=>{
  const db=fixture({assessment:false})
  await assert.rejects(saveAssessmentTime(db,{facilityId:1,formId:153,slotGroupId:295,body}),/not found/)
  assert.equal(db.writes.length,0)
})

test('booked private evaluations cannot move or accept a second athlete; unchanged settings remain editable',async()=>{
  for(const patch of [{startTime:'13:00',endTime:'13:30'},{dayOfWeek:5},{activeEnd:'2027-01-01'},{maxParticipants:2}]) {
    const db=fixture({bookings:[{date:'2026-11-21',count:1}]})
    await assert.rejects(saveAssessmentTime(db,{facilityId:1,formId:153,slotGroupId:295,body:{...body,...patch}}),/already booked|exactly one athlete/)
    assert.equal(db.writes.length,0)
  }
  const db=fixture({bookings:[{date:'2026-11-21',count:1}]})
  const result=await saveAssessmentTime(db,{facilityId:1,formId:153,slotGroupId:295,body})
  assert.equal(result.maxParticipants,1)
  assert.equal(db.writes.filter(({sql})=>sql.startsWith('UPDATE')).length,3)
})

test('legacy group assessments retain all reservations until their excess bookings are resolved',async()=>{
  const db=fixture({bookings:[{date:'2026-11-21',count:3}]})
  await assert.rejects(saveAssessmentTime(db,{facilityId:1,formId:153,slotGroupId:295,body}),/Capacity cannot be lower than 3/)
  assert.equal(db.writes.length,0)
})

test('the class detail capacity endpoint cannot increase private evaluation capacity or replace its schedule with a batch',async()=>{
  const client=fixture()
  const originalQuery=client.query.bind(client)
  client.query=async(sql,params)=>sql.includes('SELECT ts.*') ? {rows:[{schedule_mode:'day',day_of_week:6,
    specific_date:null,start_time:'12:00:00',end_time:'12:30:00',effective_start:body.activeStart,effective_end:null}]} : originalQuery(sql,params)
  client.release=()=>{}
  const pool={query:async()=>({rows:[{form_id:153,facility_id:1,is_trial_assessment:true}]}),connect:async()=>client}
  const handler=createSchedulingHandlers(pool).updateSlotGroupMax
  for(const payload of [{maxParticipants:2},{scheduleMode:'day',maxParticipants:1}]) {
    const res=response()
    await handler({params:{id:295},body:payload},res)
    assert.equal(res.code,400)
    assert.equal(client.writes.length,0)
  }
})

test('ordinary class capacity still updates its group and times after the assessment policy lookup',async()=>{
  const group={id:295,form_id:153,max_participants:8,is_active:true,signup_count:0,reserved_count:0,waitlist_count:0}
  const slot={id:500,slot_group_id:295,form_id:153,schedule_mode:'day',day_of_week:4,start_time:'16:00:00',end_time:'17:30:00',max_participants:8,is_active:true}
  const writes=[]
  let checkedAssessment=false,released=false
  const query=async(sql,params)=>{
    if(sql.includes('p.is_trial_assessment')) {
      checkedAssessment=true
      return {rows:[{form_id:153,facility_id:1,is_trial_assessment:false}]}
    }
    if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)) return {rows:[]}
    if(sql.startsWith('SELECT * FROM scheduling_slot_group')) return {rows:[{...group}]}
    if(sql.startsWith('UPDATE scheduling_slot_group')) {
      writes.push({sql,params});group.max_participants=params[0];return {rows:[]}
    }
    if(sql.startsWith('UPDATE scheduling_time_slot')) {
      writes.push({sql,params});slot.max_participants=params[0];return {rows:[]}
    }
    if(sql.includes('AS c')) return {rows:[{c:0}]}
    if(sql.includes('AS available')) return {rows:[{available:group.max_participants}]}
    if(sql.includes('SELECT id FROM scheduling_signup') && sql.includes("status = 'waitlisted'")) return {rows:[]}
    if(sql.startsWith('SELECT * FROM scheduling_form')) return {rows:[{id:153}]}
    if(sql.startsWith('SELECT * FROM scheduling_time_slot')) return {rows:[slot]}
    if(sql.startsWith('SELECT sg.*')) return {rows:[group]}
    assert.fail(`Unexpected capacity query: ${sql}`)
  }
  const pool={query,connect:async()=>({query,release(){released=true}})}
  const res=response()
  await createSchedulingHandlers(pool).updateSlotGroupMax({params:{id:295},body:{maxParticipants:12}},res)
  assert.equal(res.code,200)
  assert.equal(checkedAssessment,true)
  assert.equal(released,true)
  assert.equal(writes.length,2)
  assert.ok(writes.every(write=>write.params[0]===12))
  assert.equal(res.body.data.maxParticipants,12)
  assert.equal(res.body.data.occurrences[0].maxParticipants,12)
  assert.equal(res.body.data.spotsRemaining,12)
})

test('unbooked time edits update existing canonical group and time slot; ambiguous legacy groups are rejected',async()=>{
  const db=fixture()
  await saveAssessmentTime(db,{facilityId:1,formId:153,slotGroupId:295,body:{...body,dayOfWeek:2,startTime:'16:00',endTime:'16:30'}})
  const update=db.writes.find(({sql})=>sql.startsWith('UPDATE scheduling_time_slot'))
  assert.deepEqual(update.params.slice(0,6),[500,'day',2,null,'16:00','16:30'])
  const ambiguous=fixture({slots:2})
  await assert.rejects(saveAssessmentTime(ambiguous,{facilityId:1,formId:153,slotGroupId:295,body}),/one time/)
  assert.equal(ambiguous.writes.length,0)
})

function registeredGuards(db) {
  const routes=new Map()
  const app=Object.fromEntries(['post','patch','delete','put'].map(method=>[method,(path,handler)=>routes.set(`${method} ${path}`,handler)]))
  registerAssessmentAdminScheduleGuards(app,db)
  return routes
}

test('admin guards cover broad form/offering changes, but permit unchanged dates for metadata edits',async()=>{
  const db={query:async()=>({rows:[{id:153,is_trial_assessment:true,start_date:'2026-11-16',end_date:null}]})}
  const guards=registeredGuards(db)
  for(const key of ['delete /api/admin/scheduling/forms/:id','delete /api/admin/scheduling/offerings/:id','put /api/admin/scheduling/forms/:id/active-dates','put /api/admin/scheduling/offerings/:id']) {
    const res=response()
    await guards.get(key)({params:{id:153},method:key.split(' ')[0].toUpperCase(),body:{startDate:'2027-01-01'}},res,()=>assert.fail('unsafe broad mutation passed'))
    assert.equal(res.code,409)
  }
  let continued=false
  await guards.get('put /api/admin/scheduling/forms/:id')({params:{id:153},method:'PUT',body:{startDate:'2026-11-16',endDate:null,description:'Edited notes'}},response(),()=>{continued=true})
  assert.equal(continued,true)
  assert.ok(guards.has('delete /api/admin/scheduling/slot-groups/:id'))
  assert.ok(guards.has('delete /api/admin/scheduling/time-slots/:id'))
})

test('admin assessment mutation cannot fall through across facilities',async()=>{
  const db={query:async sql=>({rows:[sql.includes('SELECT form_id')?{form_id:153}:{is_trial_assessment:true,facility_id:2}]})}
  const res=response()
  await registeredGuards(db).get('patch /api/admin/scheduling/slot-groups/:id')({params:{id:295},canonicalAccess:{facilityId:1},method:'PATCH',body:{maxParticipants:10}},res,()=>assert.fail('cross-facility mutation passed'))
  assert.equal(res.code,403)
})

test('Class Master archive cannot hide a booked assessment, and unbooked archive preserves records',async()=>{
  for(const booked of [true,false]) {
    const writes=[]
    const client={async query(sql){
      if(sql.includes('SELECT class_date')) return {rows:booked?[{date:'2026-11-21',count:1}]:[]}
      if(sql.startsWith('UPDATE')) writes.push(sql)
      return {rows:[]}
    },release(){}}
    const db={query:async()=>({rows:[{is_trial_assessment:true,facility_id:1,group_id:295,today:'2026-11-16'}]}),connect:async()=>client}
    const res=response()
    await registeredGuards(db).get('patch /api/admin/programs/:classId/time-slots/:slotId/archive')({params:{classId:168,slotId:500},canonicalAccess:{facilityId:1},body:{archived:true}},res,()=>assert.fail('assessment archive bypassed guard'))
    assert.equal(res.code,booked?409:200)
    assert.equal(writes.length,booked?0:2)
    assert.equal(writes.some(sql=>sql.includes('DELETE')),false)
  }
})
