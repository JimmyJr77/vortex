import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { listClassSwapStudents, listClassSwapClasses } from '../classSwaps.js'
import { buildDailyRoster } from '../dailyRoster.js'
import { classSwapCapacityDelta, classSwapCapacityDeltas } from '../classSwapsRoster.js'

const connectionString=process.env.NEW_ADMIN_TEST_DATABASE_URL
if(connectionString){
  const url=new URL(connectionString)
  if(process.env.NODE_ENV==='production'||!['postgres:','postgresql:'].includes(url.protocol)
    ||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.search||url.hash
    ||!/^\/vortex_new_admin_dev(?:_[a-z0-9_]+)?$/.test(url.pathname))throw new Error('An isolated local test database is required.')
}

test('selection lists retain package cardinality, project per-slot enrollment actions and show moved upcoming trials',{skip:!connectionString},async(t)=>{
  const db=new pg.Client({connectionString,ssl:false});await db.connect()
  try{
    await db.query('BEGIN')
    const one=async(sql,values=[])=>(await db.query(sql,values)).rows[0]
    const suffix=randomUUID()
    const facilityId=Number((await one("INSERT INTO facility(name,timezone) VALUES('Swap selection regression','America/New_York') RETURNING id")).id)
    const actorUserId=Number((await one('SELECT id FROM app_user ORDER BY id LIMIT 1')).id)
    const top=Number((await one('INSERT INTO programs(facility_id,name,display_name) VALUES($1,$2,$2) RETURNING id',[facilityId,`Selection ${suffix}`])).id)
    const addClass=async(name,days,capacity)=>{
      const klass=Number((await one(`INSERT INTO program(facility_id,category,programs_id,name,display_name,is_active,archived)
        VALUES($1,(enum_range(NULL::program_category))[1],$2,$3,$3,TRUE,FALSE) RETURNING id`,[facilityId,top,`${name} ${suffix}`])).id)
      const formId=Number((await one(`INSERT INTO scheduling_form(program_id,programs_id,title,is_active,start_date,cost_unit,class_monthly_price_cents)
        VALUES($1,$2,$3,TRUE,'2026-01-01','per_month',10000) RETURNING id`,[klass,top,name])).id)
      const groupId=Number((await one(`INSERT INTO scheduling_slot_group(form_id,schedule_mode,max_participants,active_start,inherits_offering_dates,dates_tbd,is_active)
        VALUES($1,'day',$2,'2026-01-01',FALSE,FALSE,TRUE) RETURNING id`,[formId,capacity])).id)
      const slots=[]
      for(const day of days)slots.push(Number((await one(`INSERT INTO scheduling_time_slot(form_id,slot_group_id,schedule_mode,day_of_week,start_time,end_time,max_participants,active_start,dates_tbd,is_active)
        VALUES($1,$2,'day',$3,'16:00','17:00',$4,'2026-01-01',FALSE,TRUE) RETURNING id`,[formId,groupId,day,capacity])).id))
      return {formId,groupId,slots}
    }
    const source=await addClass('Original package',[1,3],4),destination=await addClass('Destination schedule',[1,4],2)
    const member=async name=>Number((await one("INSERT INTO member(facility_id,first_name,last_name,is_active,date_of_birth) VALUES($1,$2,'Selection',TRUE,'2020-01-01') RETURNING id",[facilityId,name])).id)
    const enroll=async(klass,memberId,slotId,status='confirmed',start='2026-01-01')=>Number((await one(`INSERT INTO scheduling_signup(form_id,slot_group_id,time_slot_id,member_id,first_name,last_name,email,phone,status,enrollment_start_date)
      VALUES($1,$2,$3,$4,'Submitted','Selection',$5,'2025550101',$6,$7) RETURNING id`,[klass.formId,klass.groupId,slotId,memberId,`selection-${memberId}@example.test`,status,start])).id)
    const packageMember=await member('Package'),packageId=await enroll(source,packageMember,null)
    await enroll(destination,await member('Monday'),destination.slots[0])
    const resumed=await enroll(destination,await member('Thursday'),destination.slots[1],'paused')
    const paused=await enroll(destination,await member('Wholegroup'),null)
    await enroll(destination,await member('Later'),destination.slots[0],'confirmed','2030-02-01')
    await db.query(`INSERT INTO enrollment_action(signup_id,facility_id,requested_status,previous_status,effective_date,request_key)
      VALUES($1,$3,'confirmed','paused','2030-01-03',$4),($2,$3,'paused','confirmed','2030-01-06',$5)`,[resumed,paused,facilityId,`resume-${suffix}`,`pause-${suffix}`])
    const choices=await listClassSwapStudents(db,{facilityId})
    const packageRows=choices.students.find(row=>row.memberId===packageMember).enrollments.filter(row=>row.signupId===packageId)
    assert.equal(packageRows.length,2)
    assert.ok(packageRows.every(row=>row.requiredReplacementCount===2&&row.sourceSchedules.length===2))
    const classes=await listClassSwapClasses(db,{facilityId,mode:'permanent',effectiveDate:'2030-01-07'})
    for(const slot of destination.slots){
      const row=classes.classes.find(item=>item.timeSlotId===slot)
      assert.equal(row.enrolledCount,1,'future pauses and resumes count on their action date, per selected slot')
      assert.equal(row.availableSpots,1,'an enrollment in a sibling slot does not consume this slot’s remaining seat')
    }
    for(const [slot,date] of [[destination.slots[0],'2030-01-07'],[destination.slots[1],'2030-01-10']]){
      const temporary=await listClassSwapClasses(db,{facilityId,mode:'temporary',effectiveDate:date})
      const row=temporary.classes.find(item=>item.timeSlotId===slot)
      assert.equal(row.enrolledCount,1,'one-time counts project the pending pause/resume on the actual class date')
      assert.equal(row.availableSpots,1)
    }
    // The validation path needs only its selected destinations. Populate an
    // unrelated history to ensure dated-action projections stay bounded.
    const unrelated=await addClass('Unrelated enrollment history',[2],2000)
    await db.query(`WITH inserted AS (
      INSERT INTO scheduling_signup(form_id,slot_group_id,time_slot_id,first_name,last_name,email,status,enrollment_start_date)
      SELECT $1,$2,$3,'Unrelated','History','unrelated-'||n||'-'||$5||'@example.test','confirmed','2026-01-01'
      FROM generate_series(1,400) n RETURNING id
    ) INSERT INTO enrollment_action(signup_id,facility_id,requested_status,previous_status,effective_date,request_key)
      SELECT id,$4,'confirmed','paused','2026-01-01','history-'||id FROM inserted`,
    [unrelated.formId,unrelated.groupId,unrelated.slots[0],facilityId,suffix])
    const countQueries=[]
    const boundedDb={query:async(sql,args)=>{
      if(sql.includes('COUNT(*)::int AS count FROM scheduling_signup s'))countQueries.push({sql,args})
      return db.query(sql,args)
    }}
    const boundedClasses=await listClassSwapClasses(boundedDb,{facilityId,mode:'permanent',effectiveDate:'2030-01-07',slotGroupIds:[destination.groupId]})
    assert.deepEqual(boundedClasses.classes,classes.classes.filter(row=>row.slotGroupId===destination.groupId))
    const countQuery=countQueries[0]
    assert.ok(countQuery,'the selected destination still receives dated enrollment counts')
    const explained=(await db.query(`EXPLAIN (ANALYZE,FORMAT JSON) ${countQuery.sql}`,countQuery.args)).rows[0]['QUERY PLAN'][0].Plan
    const planNodes=[]
    const visit=node=>{planNodes.push(node);for(const child of node.Plans??[])visit(child)}
    visit(explained)
    const actionScans=planNodes.filter(node=>node['Relation Name']==='enrollment_action')
    assert.ok(actionScans.some(node=>node['Actual Loops']>0),'the plan exercises scheduled status projection')
    assert.ok(actionScans.every(node=>node['Actual Loops']<=4),'unrelated signup histories must not execute dated-action subplans')
    t.diagnostic(`Scoped status projection scanned at most ${Math.max(...actionScans.map(node=>node['Actual Loops']))} destination signups with 400 unrelated histories present.`)
    const trialMember=await member('Movedtrial')
    const originalDate=(await one("SELECT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date-14-EXTRACT(DOW FROM (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date)::int+1)::text AS date")).date
    const trialId=Number((await one(`INSERT INTO drop_in_registration(form_id,slot_group_id,member_id,class_date,first_name,last_name,email,phone,status,benefit_type)
      VALUES($1,$2,$3,$4,'Movedtrial','Selection','old-contact@example.test','2025550111','confirmed','free_trial') RETURNING id`,[source.formId,source.groupId,trialMember,originalDate])).id)
    await db.query(`INSERT INTO scheduling_class_swap(facility_id,source_type,source_id,source_form_id,source_slot_group_id,source_time_slot_id,source_date,
      target_form_id,target_slot_group_id,target_time_slot_id,target_date,athlete,reason,actor_user_id,request_key)
      VALUES($1,'drop_in',$2,$3,$4,$5,$6,$7,$8,$9,'2030-01-07',$10::jsonb,'Moved upcoming trial',$11,$12)`,
    [facilityId,trialId,source.formId,source.groupId,source.slots[0],originalDate,destination.formId,destination.groupId,destination.slots[0],JSON.stringify({source:'drop_in',signupId:trialId,memberId:trialMember,name:'Old snapshot',email:'snapshot@example.test',phone:'old',benefitType:'free_trial'}),actorUserId,`moved-${suffix}`])
    const movedStudent=(await listClassSwapStudents(db,{facilityId})).students.find(row=>row.memberId===trialMember)
    assert.equal(movedStudent.enrollments.length,1,'the past original trial is replaced by its future destination card')
    assert.equal(movedStudent.enrollments[0].formId,destination.formId)
    assert.equal(movedStudent.enrollments[0].classDate,'2030-01-07')
    assert.equal(movedStudent.enrollments[0].canSwap,false)
    assert.equal(movedStudent.enrollments[0].isClassSwap,true)
    await db.query("UPDATE drop_in_registration SET email='fresh-contact@example.test',phone='2025550199' WHERE id=$1",[trialId])
    const roster=await buildDailyRoster(db,'2030-01-07',{facilityId,includeNewRegistrations:false})
    const movedAthlete=roster.classes.find(row=>row.timeSlotId===destination.slots[0]).athletes.find(row=>row.memberId===trialMember)
    assert.equal(movedAthlete.email,'fresh-contact@example.test','one-time arrivals use the live booking contact instead of their stored snapshot')
    assert.equal(movedAthlete.phone,'202-555-0199')
    assert.equal(await classSwapCapacityDelta(db,destination.groupId,'2030-01-07'),1)
    const allDeltas=await classSwapCapacityDeltas(db,{startDate:'2030-01-07',endDate:'2030-01-10',facilityId})
    const scopedDeltas=await classSwapCapacityDeltas(db,{startDate:'2030-01-07',endDate:'2030-01-10',facilityId,groupIds:[destination.groupId]})
    assert.deepEqual([...scopedDeltas],[...allDeltas].filter(([key])=>Number(key.split(':')[0])===destination.groupId),
      'a scoped arrival retains a swap whose original group and date are outside the selected window')
    const scopedRoster=await buildDailyRoster(db,'2030-01-07',{facilityId,includeNewRegistrations:false,slotGroupIds:[destination.groupId]})
    assert.ok(scopedRoster.classes.every(row=>row.slotGroupId===destination.groupId))
    assert.deepEqual(scopedRoster.classes,roster.classes.filter(row=>row.slotGroupId===destination.groupId))
    await db.query("UPDATE drop_in_registration SET status='cancelled' WHERE id=$1",[trialId])
    assert.equal(await classSwapCapacityDelta(db,destination.groupId,'2030-01-07'),0,'canceled sources stop reserving destination capacity')
    assert.ok(!(await buildDailyRoster(db,'2030-01-07',{facilityId,includeNewRegistrations:false})).classes.find(row=>row.timeSlotId===destination.slots[0]).athletes.some(row=>row.memberId===trialMember))
  }finally{await db.query('ROLLBACK');await db.end()}
})
