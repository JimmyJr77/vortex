import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import express from 'express'
import pg from 'pg'
import jwt from 'jsonwebtoken'
import { registerNewAdminRoutes } from '../registerRoutes.js'

const url=process.env.NEW_ADMIN_TEST_DATABASE_URL
if(url && (!['localhost','127.0.0.1'].includes(new URL(url).hostname) || !/^\/vortex_new_admin_dev(?:_[a-z0-9_]+)?$/.test(new URL(url).pathname))) throw new Error('Isolated local test database required')

test('timesheets authorize self/team access, record time atomically, and preserve change history',{skip:!url},async()=>{
  const pool=new pg.Pool({connectionString:url}),client=await pool.connect(),suffix=crypto.randomUUID(),secret=crypto.randomUUID()
  let server
  try {
    await client.query('BEGIN')
    const migration=await fs.readFile(new URL('../../migrations/849_staff_timesheets.sql',import.meta.url),'utf8')
    await client.query(migration); await client.query(migration)
    const weeklyMigration=await fs.readFile(new URL('../../migrations/850_weekly_timesheets.sql',import.meta.url),'utf8')
    await client.query(weeklyMigration);await client.query(weeklyMigration)
    // Each HTTP write uses a savepoint inside this rollback-only fixture.
    const db={query:client.query.bind(client),connect:async()=>({release(){},query:(sql,values)=>client.query(sql==='BEGIN'?'SAVEPOINT time_write':sql==='COMMIT'?'RELEASE SAVEPOINT time_write':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT time_write':sql,values)})}
    const facility=(await db.query("INSERT INTO facility(name,timezone) VALUES('Timesheet fixture','America/New_York') RETURNING id")).rows[0].id
    const foreignFacility=(await db.query("INSERT INTO facility(name,timezone) VALUES('Foreign timesheet fixture','America/Los_Angeles') RETURNING id")).rows[0].id
    const createUser=async(name,scope=facility,role='ADMIN')=>Number((await db.query('INSERT INTO app_user(facility_id,role,email,full_name,username,is_active) VALUES($1,$2,$3,$4,$5,true) RETURNING id',[scope,role,`${name}-${suffix}@example.test`,name,`${name}-${suffix}`])).rows[0].id)
    const admin=await createUser('Admin'),staff=await createUser('Staff'),other=await createUser('Other'),foreign=await createUser('Foreign',foreignFacility),member=await createUser('Member',facility,'MEMBER_ATHLETE')
    await db.query("INSERT INTO app_user_permission_override(user_id,permission_id,effect) SELECT $1,id,'deny' FROM permission WHERE key IN ('timesheets.view_all','payroll.view','payroll.manage')",[staff])
    const app=express();app.use(express.json());registerNewAdminRoutes(app,db,{jwtSecret:secret})
    server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
    const request=async(user,path='',method='GET',body)=>{
      const response=await fetch(`http://127.0.0.1:${server.address().port}/api/admin/new-admin/timesheets${path}`,{method,headers:{...(user?{Authorization:`Bearer ${jwt.sign({userId:user,role:'MASTER_ADMIN',facilityId:foreignFacility},secret)}`}:{ }),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})
      return {status:response.status,...await response.json()}
    }
    assert.equal((await request(null)).status,401)
    assert.equal((await request(member)).status,403)
    const ownOptions=await request(staff,'/options')
    assert.equal(ownOptions.status,200);assert.equal(ownOptions.data.canViewAll,false);assert.deepEqual(ownOptions.data.people,[])
    const adminOptions=await request(admin,'/options')
    assert.equal(adminOptions.data.canViewAll,true)
    assert.ok(adminOptions.data.people.some(p=>p.id===staff))
    assert.ok(!adminOptions.data.people.some(p=>p.id===foreign || p.id===member))
    const body={date:'2026-10-02',startTime:'09:00',endDate:'2026-10-02',endTime:'12:00',breakMinutes:15,notes:'Class setup',userId:other,facilityId:foreignFacility}
    const created=await request(staff,'','POST',body)
    assert.equal(created.status,200)
    const saved=(await db.query('SELECT * FROM staff_time_entry WHERE id=$1',[created.data.id])).rows[0]
    assert.equal(Number(saved.user_id),staff);assert.equal(Number(saved.facility_id),Number(facility))
    assert.equal(saved.started_at.toISOString(),'2026-10-02T13:00:00.000Z')
    assert.equal((await request(staff,'','POST',body)).status,409,'overlap cannot double count hours')
    assert.equal((await request(other,'','POST',{...body,startTime:'10:00',breakMinutes:0})).status,200)
    assert.equal((await request(foreign,'','POST',body)).status,200)
    const range='?start=2026-10-01&end=2026-10-31'
    let own=await request(staff,range)
    assert.equal(own.data.total,1);assert.equal(own.data.totalMinutes,165);assert.equal(own.data.rows[0].userId,staff)
    assert.equal((await request(admin,range)).data.total,0,'admins also default to their own records')
    assert.equal((await request(staff,`${range}&person=all`)).status,403)
    assert.equal((await request(staff,`${range}&person=${other}`)).status,403)
    assert.equal((await request(admin,`${range}&person=${foreign}`)).status,404)
    const everyone=await request(admin,`${range}&person=all&pageSize=1`)
    assert.equal(everyone.data.total,2);assert.equal(everyone.data.totalMinutes,285);assert.equal(everyone.data.rows.length,1)
    assert.equal((await request(admin,`${range}&person=all&page=50`)).data.totalMinutes,285)
    assert.equal((await request(admin,`${range}&person=${staff}`)).data.totalMinutes,165)
    assert.equal((await request(staff,'?start=2026-02-30&end=2026-03-02')).status,400)
    assert.equal((await request(staff,'?start=2026-10-31&end=2026-10-01')).status,400)
    for(const bad of [{breakMinutes:180},{breakMinutes:-1},{startTime:'99:00'},{endTime:'08:00'},{date:'2099-01-01',endDate:'2099-01-01'},{date:'2026-03-08',endDate:'2026-03-08',startTime:'02:30',endTime:'04:00'}]) {
      assert.equal((await request(staff,'','POST',{...body,...bad})).status,400)
    }
    assert.equal((await request(staff,'','POST',{...body,date:'2026-10-03',endDate:'2026-10-04',startTime:'23:00',endTime:'01:00',breakMinutes:0})).status,200)
    own=await request(staff,range)
    const original=own.data.rows.find(row=>row.id===created.data.id)
    assert.equal((await request(admin,`/${original.id}`,'PATCH',{...body,updatedAt:original.updatedAt})).status,404,'team viewing does not permit editing another person')
    assert.equal((await request(other,`/${original.id}`,'DELETE',{updatedAt:original.updatedAt})).status,404)
    assert.equal((await request(staff,`/${original.id}`,'PATCH',{...body,notes:'Corrected setup',updatedAt:original.updatedAt})).status,200)
    assert.equal((await request(staff,`/${original.id}`,'PATCH',{...body,updatedAt:original.updatedAt})).status,409,'stale updates cannot silently overwrite corrections')
    assert.equal((await request(staff,'/clock-in','POST')).status,200)
    assert.equal((await request(staff,'/clock-in','POST')).status,409)
    const running=(await request(staff,range)).data.activeEntry
    assert.ok(running,'open clock stays available even when viewing a historical range')
    assert.equal((await request(other,`/${running.id}/clock-out`,'POST',{updatedAt:running.updatedAt})).status,404)
    assert.equal((await request(staff,`/${running.id}/clock-out`,'POST',{updatedAt:running.updatedAt})).status,200)
    assert.equal((await request(staff,range)).data.activeEntry,null)
    const edited=(await request(staff,range)).data.rows.find(row=>row.id===original.id)
    assert.equal((await request(staff,`/${edited.id}`,'DELETE',{updatedAt:edited.updatedAt})).status,200)
    assert.equal((await request(staff,range)).data.total,1)
    const audit=(await db.query('SELECT action,before_record,after_record FROM staff_time_entry_change WHERE entry_id=$1 ORDER BY id',[original.id])).rows
    assert.deepEqual(audit.map(row=>row.action),['create','edit','remove'])
    assert.equal(audit[1].before_record.notes,'Class setup');assert.equal(audit[1].after_record.notes,'Corrected setup')
    assert.ok(audit[2].after_record.deleted_at)
    const weeklyPath='/week?week=2026-10-03'
    let weekly=await request(staff,weeklyPath)
    assert.equal(weekly.data.week,'2026-09-28','calendar selection resolves to Monday')
    assert.equal(weekly.data.people.length,1)
    assert.equal(weekly.data.people[0].days.find(day=>day.date==='2026-10-03').minutes,120,'existing time records carry into the weekly view')
    assert.equal((await request(staff,weeklyPath+'&person=all')).status,403)
    assert.equal((await request(admin,weeklyPath+`&person=${foreign}`)).status,404)
    const assignment={userId:staff,date:'2026-10-02',startTime:'10:00',endTime:'12:00',notes:'Assigned coaching'}
    assert.equal((await request(staff,'/assignments','POST',assignment)).status,403)
    assert.equal((await request(admin,'/assignments','POST',{...assignment,userId:foreign})).status,404)
    const assigned=await request(admin,'/assignments','POST',assignment)
    assert.equal(assigned.status,200)
    assert.equal((await request(admin,'/assignments','POST',assignment)).status,409)
    weekly=await request(staff,weeklyPath)
    const assignedDay=weekly.data.people[0].days.find(day=>day.date===assignment.date)
    assert.equal(assignedDay.minutes,null,'assigned hours are never reported as actual hours')
    assert.equal(assignedDay.assignments[0].minutes,120)
    const filled={week:'2026-09-28',days:[{date:'2026-10-02',minutes:240,notes:'Worked beyond assignment',version:0},{date:'2026-10-01',minutes:90,notes:'Unassigned work',version:0}]}
    assert.equal((await request(staff,'/week','PUT',filled)).status,200,'actual hours may exceed assignments or have no assignment')
    assert.equal((await request(staff,'/week','PUT',filled)).status,409,'weekly edits enforce optimistic versions')
    assert.equal((await request(staff,'/week','PUT',{...filled,days:[{...filled.days[0],minutes:1441}]})).status,400)
    assert.equal((await request(staff,'/week','PUT',{...filled,days:[{...filled.days[0],date:'2026-10-05'}]})).status,400)
    const adminWeek=await request(admin,weeklyPath+`&person=${staff}`)
    assert.equal(adminWeek.data.people[0].days.find(day=>day.date==='2026-10-02').minutes,240)
    assert.equal(adminWeek.data.people[0].days.find(day=>day.date==='2026-10-01').minutes,90)
    assert.equal((await request(staff,`/assignments/${assigned.data.id}`,'DELETE')).status,403)
    assert.equal((await request(admin,`/assignments/${assigned.data.id}`,'DELETE')).status,200)
    assert.equal((await request(staff,weeklyPath)).data.people[0].days.find(day=>day.date==='2026-10-02').minutes,240,'removing an assignment preserves actual hours')
    assert.equal((await db.query("SELECT count(*)::int AS n FROM staff_timesheet_change WHERE facility_id=$1",[facility])).rows[0].n,4)
    await db.query('UPDATE app_user SET is_active=false WHERE id=$1',[staff])
    assert.equal((await request(staff,range)).status,403)
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve))
    await client.query('ROLLBACK');client.release();await pool.end()
  }
})
