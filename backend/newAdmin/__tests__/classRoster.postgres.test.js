import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import pg from 'pg'
import { classRoster } from '../classRoster.js'
import { createScopedMember } from '../leads.js'

const url=process.env.NEW_ADMIN_TEST_DATABASE_URL
if(url && (!['localhost','127.0.0.1'].includes(new URL(url).hostname) || !new URL(url).pathname.startsWith('/vortex_new_admin_dev'))) throw new Error('Isolated local test database required')
test('class roster combines schedule, slot, status, athlete search and pagination within facility scope',{skip:!url},async()=>{
  const pool=new pg.Pool({connectionString:url}),db=await pool.connect(),suffix=crypto.randomUUID()
  try {
    await db.query('BEGIN')
    const facility=(await db.query("INSERT INTO facility(name,timezone) VALUES('Roster test','America/New_York') RETURNING id")).rows[0].id
    const program=(await db.query('INSERT INTO programs(facility_id,name,display_name) VALUES($1,$2,$2) RETURNING id',[facility,suffix])).rows[0].id
    const klass=(await db.query("INSERT INTO program(facility_id,category,name,display_name,programs_id) VALUES($1,(enum_range(NULL::program_category))[1],$2,$2,$3) RETURNING id",[facility,suffix,program])).rows[0].id
    const form=(await db.query("INSERT INTO scheduling_form(program_id,programs_id,title) VALUES($1,$2,'Roster test') RETURNING id",[klass,program])).rows[0].id
    const group=(await db.query('INSERT INTO scheduling_slot_group(form_id,max_participants) VALUES($1,100) RETURNING id',[form])).rows[0].id
    const otherGroup=(await db.query('INSERT INTO scheduling_slot_group(form_id,max_participants) VALUES($1,100) RETURNING id',[form])).rows[0].id
    const slot=(await db.query("INSERT INTO scheduling_time_slot(form_id,slot_group_id,day_of_week,start_time,end_time) VALUES($1,$2,1,'16:00','17:00') RETURNING id",[form,group])).rows[0].id
    const otherSlot=(await db.query("INSERT INTO scheduling_time_slot(form_id,slot_group_id,day_of_week,start_time,end_time) VALUES($1,$2,3,'16:00','17:00') RETURNING id",[form,group])).rows[0].id
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
    await enroll('OtherGroup','confirmed',otherGroup,null)
    const filters={slotGroupId:group,timeSlotId:slot}
    const all=await classRoster(db,facility,klass,filters)
    assert.equal(all.total,7)
    assert.ok(!all.rows.some(row=>row.firstName.startsWith('Other')))
    assert.ok(all.rows.some(row=>row.firstName==='WholeGroup'))
    for(const [status,total] of [['active',2],['paused',1],['disenrolled',2],['waitlisted',2]]) {
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
    assert.equal((await classRoster(db,facility,klass,{})).total,9)
    await assert.rejects(classRoster(db,facility+999999,klass,{}),/not found/)
    await assert.rejects(classRoster(db,facility,klass,{slotGroupId:otherGroup,timeSlotId:slot}),/not found/)
    await assert.rejects(classRoster(db,facility,klass,{status:'invalid'}),/Invalid enrollment status/)
  } finally {await db.query('ROLLBACK');db.release();await pool.end()}
})
