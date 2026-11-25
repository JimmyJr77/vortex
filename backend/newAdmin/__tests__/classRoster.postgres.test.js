import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import pg from 'pg'
import { classRoster } from '../classRoster.js'
import { createScopedMember } from '../leads.js'
import { classDetail, listClasses } from '../reads.js'

const url=process.env.NEW_ADMIN_TEST_DATABASE_URL
if(url && (!['localhost','127.0.0.1'].includes(new URL(url).hostname) || !new URL(url).pathname.startsWith('/vortex_new_admin_dev'))) throw new Error('Isolated local test database required')
test('class catalog counts enrollments once per schedule while the roster supports time filters',{skip:!url},async()=>{
  const pool=new pg.Pool({connectionString:url}),db=await pool.connect(),suffix=crypto.randomUUID()
  try {
    await db.query('BEGIN')
    const facility=(await db.query("INSERT INTO facility(name,timezone) VALUES('Roster test','America/New_York') RETURNING id")).rows[0].id
    const program=(await db.query('INSERT INTO programs(facility_id,name,display_name) VALUES($1,$2,$2) RETURNING id',[facility,suffix])).rows[0].id
    const klass=(await db.query("INSERT INTO program(facility_id,category,name,display_name,programs_id) VALUES($1,(enum_range(NULL::program_category))[1],$2,$2,$3) RETURNING id",[facility,suffix,program])).rows[0].id
    const form=(await db.query("INSERT INTO scheduling_form(program_id,programs_id,title) VALUES($1,$2,'Roster test') RETURNING id",[klass,program])).rows[0].id
    const offering=(await db.query('INSERT INTO scheduling_offering(form_id,start_date,is_selected) VALUES($1,CURRENT_DATE,TRUE) RETURNING id',[form])).rows[0].id
    const group=(await db.query('INSERT INTO scheduling_slot_group(form_id,offering_id,max_participants) VALUES($1,$2,100) RETURNING id',[form,offering])).rows[0].id
    const otherGroup=(await db.query('INSERT INTO scheduling_slot_group(form_id,offering_id,max_participants) VALUES($1,$2,8) RETURNING id',[form,offering])).rows[0].id
    const slot=(await db.query("INSERT INTO scheduling_time_slot(form_id,slot_group_id,day_of_week,start_time,end_time) VALUES($1,$2,1,'16:00','17:00') RETURNING id",[form,group])).rows[0].id
    const otherSlot=(await db.query("INSERT INTO scheduling_time_slot(form_id,slot_group_id,day_of_week,start_time,end_time) VALUES($1,$2,3,'16:00','17:00') RETURNING id",[form,group])).rows[0].id
    const separateSlot=(await db.query("INSERT INTO scheduling_time_slot(form_id,slot_group_id,day_of_week,start_time,end_time) VALUES($1,$2,5,'17:00','18:00') RETURNING id",[form,otherGroup])).rows[0].id
    async function enroll(name,status,groupId=group,slotId=slot) {
      const email=`${name}-${suffix}@example.test`
      const member=await createScopedMember(db,facility,{firstName:name,lastName:'Athlete',email,dateOfBirth:'1990-01-01'})
      const signup=(await db.query("INSERT INTO scheduling_signup(form_id,slot_group_id,time_slot_id,member_id,first_name,last_name,email,status,enrollment_start_date) VALUES($1,$2,$3,$4,$5,'Athlete',$6,$7,CURRENT_DATE) RETURNING id",[form,groupId,slotId,member.memberId,name,email,status])).rows[0]
      return Number(signup.id)
    }
    await enroll('Active','confirmed')
    await enroll('Paused','paused')
    await enroll('Cancelled','cancelled')
    await enroll('Completed','completed')
    await enroll('WaitOne','waitlisted')
    const waitTwo=await enroll('WaitTwo','waitlisted')
    await enroll('WholeGroup','confirmed',group,null)
    await enroll('OtherTime','confirmed',group,otherSlot)
    await enroll('AlsoOtherTime','confirmed',group,otherSlot)
    await enroll('WholeGroupWait','waitlisted',group,null)
    await enroll('OtherGroup','confirmed',otherGroup,null)
    const archived=await enroll('Archived','confirmed')
    const orphaned=await enroll('Orphaned','waitlisted')
    await db.query('UPDATE scheduling_signup SET archived_at=now() WHERE id=$1',[archived])
    await db.query('UPDATE scheduling_signup SET orphaned_at=now() WHERE id=$1',[orphaned])

    const {rows:[catalog]}=await listClasses(db,facility)
    assert.deepEqual(catalog.scheduleGroups.map(({id,enrolledCount,capacity,waitlistCount,slots})=>({
      id,enrolledCount,capacity,waitlistCount,slotIds:slots.map(time=>time.id),
    })),[
      {id:Number(group),enrolledCount:4,capacity:100,waitlistCount:3,slotIds:[Number(slot),Number(otherSlot)]},
      {id:Number(otherGroup),enrolledCount:1,capacity:8,waitlistCount:0,slotIds:[Number(separateSlot)]},
    ])

    const filters={slotGroupId:group,timeSlotId:slot}
    const all=await classRoster(db,facility,klass,filters)
    assert.equal(all.total,8)
    assert.ok(!all.rows.some(row=>row.firstName.startsWith('Other')))
    assert.ok(all.rows.some(row=>row.firstName==='WholeGroup'))
    for(const [status,total] of [['active',2],['paused',1],['disenrolled',2],['waitlisted',3]]) {
      const filtered=await classRoster(db,facility,klass,{...filters,status,pageSize:1,page:1})
      assert.equal(filtered.total,total)
      assert.equal(filtered.rows[0].enrollmentStatus,status)
      assert.equal(filtered.rows.length,1)
    }
    const searched=await classRoster(db,facility,klass,{...filters,status:'waitlisted',search:'waittwo athlete'})
    assert.equal(searched.total,1)
    assert.equal(searched.rows[0].id,waitTwo)
    assert.equal(searched.rows[0].waitlistPosition,2)
    assert.equal((await classRoster(db,facility,klass,{...filters,search:'%'})).total,0,'search treats wildcards literally')
    assert.equal((await classRoster(db,facility,klass,{})).total,11)
    await assert.rejects(classRoster(db,facility+999999,klass,{}),/not found/)
    await assert.rejects(classRoster(db,facility,klass,{slotGroupId:otherGroup,timeSlotId:slot}),/not found/)
    await assert.rejects(classRoster(db,facility,klass,{status:'invalid'}),/Invalid enrollment status/)
    await db.query('UPDATE scheduling_form SET is_active=FALSE WHERE id=$1',[form])
    await db.query('UPDATE scheduling_time_slot SET exclude_from_drop_ins=TRUE,allow_free_trials=TRUE WHERE id=$1',[slot])
    const {rows:[hidden]}=await listClasses(db,facility)
    assert.deepEqual(hidden.scheduleGroups,[])
    const hiddenSlot=hidden.otherScheduleGroups.flatMap(group => group.slots).find(time => time.id === Number(slot))
    assert.equal(hiddenSlot?.allowDropIns,false)
    assert.equal(hiddenSlot?.allowFreeTrials,true)

    async function bookingAvailability() {
      const {groups}=await classDetail(db,facility,klass)
      const detailSlots=groups.flatMap(group=>group.slots)
      const {rows:[catalog]}=await listClasses(db,facility)
      const catalogSlots=[...catalog.scheduleGroups,...catalog.otherScheduleGroups].flatMap(group=>group.slots)
      const state=slots=>slots.map(({id,allowDropIns,allowFreeTrials,isTrialAssessment})=>({id,allowDropIns,allowFreeTrials,isTrialAssessment})).sort((a,b)=>a.id-b.id)
      assert.deepEqual(state(detailSlots),state(catalogSlots),'class details and catalog resolve the same booking settings')
      return new Map(detailSlots.map(time=>[time.id,time]))
    }
    await db.query('UPDATE programs SET exclude_from_drop_ins=TRUE WHERE id=$1',[program])
    let availability=await bookingAvailability()
    assert.equal(availability.get(Number(slot)).allowDropIns,false)
    assert.equal(availability.get(Number(slot)).allowFreeTrials,true,'explicit free trials remain available when drop-ins are blocked')
    assert.equal(availability.get(Number(otherSlot)).allowDropIns,false,'schedule inherits the program drop-in policy')
    assert.equal(availability.get(Number(otherSlot)).allowFreeTrials,false,'unset free trials inherit the effective drop-in policy')
    await db.query('UPDATE program SET exclude_from_drop_ins=FALSE WHERE id=$1',[klass])
    availability=await bookingAvailability()
    assert.equal(availability.get(Number(otherSlot)).allowDropIns,true,'class policy overrides the parent program')
    assert.equal(availability.get(Number(otherSlot)).allowFreeTrials,true)
    assert.equal(availability.get(Number(slot)).allowDropIns,false,'schedule override takes precedence over class policy')
    await db.query('UPDATE scheduling_time_slot SET allow_free_trials=FALSE WHERE id=$1',[otherSlot])
    await db.query('UPDATE program SET is_trial_assessment=TRUE WHERE id=$1',[klass])
    availability=await bookingAvailability()
    assert.equal(availability.get(Number(otherSlot)).allowDropIns,true)
    assert.equal(availability.get(Number(otherSlot)).allowFreeTrials,false,'free trials can be blocked independently of drop-ins')
    assert.ok([...availability.values()].every(time=>time.isTrialAssessment===true),'assessment marker is present for every schedule time')
  } finally {await db.query('ROLLBACK');db.release();await pool.end()}
})
