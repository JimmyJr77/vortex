import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import pg from 'pg'
import { convertLead } from '../leads.js'
import { validateRehearsalDatabaseUrl } from '../migrationAudit.js'

const connectionString=process.env.NEW_ADMIN_TEST_DATABASE_URL
if(connectionString)validateRehearsalDatabaseUrl(connectionString,{nodeEnv:'development'})

test('conversion waits for its requested guardian or household before locking the lead', {skip:!connectionString},async t=>{
  const schema=`lead_conversion_lock_${randomBytes(6).toString('hex')}`
  const control=new pg.Client({connectionString}),blocker=new pg.Client({connectionString}),worker=new pg.Client({connectionString})
  await Promise.all([control.connect(),blocker.connect(),worker.connect()])
  const pool={connect:async()=>({query:(sql,args)=>worker.query(sql,args),release(){}})}
  let inFlight
  try{
    await control.query(`CREATE SCHEMA ${schema}`)
    for(const client of [control,blocker,worker])await client.query(`SET search_path=${schema}`)
    await control.query(`
      CREATE TABLE member(id bigint PRIMARY KEY,facility_id bigint,is_active boolean);
      CREATE TABLE family(id bigint PRIMARY KEY,facility_id bigint,archived boolean);
      CREATE TABLE family_member(member_id bigint,family_id bigint,is_active boolean);
      CREATE TABLE registrations(id bigint PRIMARY KEY,facility_id bigint,archived boolean DEFAULT FALSE,
        member_id bigint,converted_member_id bigint,trial_contact_member_id bigint,converted_at timestamptz,
        converted_by_user_id bigint,lead_status text,contacted boolean,first_contacted_at timestamptz,updated_at timestamptz);
      CREATE TABLE account_invite(id bigint,registration_id bigint,facility_id bigint,invite_type text,
        used_at timestamptz,expires_at timestamptz,temporary_password_hash text,pending_payload jsonb);
      CREATE TABLE scheduling_signup(account_invite_id bigint,status text);
      INSERT INTO member VALUES(10,1,TRUE),(20,2,TRUE),(30,1,FALSE);
      INSERT INTO family VALUES(100,1,FALSE),(200,2,FALSE),(300,1,TRUE);
      INSERT INTO family_member VALUES(10,100,TRUE);
      INSERT INTO registrations(id,facility_id,trial_contact_member_id) VALUES(1,1,10),(2,1,NULL);
      INSERT INTO registrations(id,facility_id,converted_member_id) VALUES(3,1,10);
    `)
    const verifyOrder=async({lockSql,body,leadId})=>{
      await blocker.query('BEGIN');await blocker.query(lockSql)
      inFlight=convertLead(pool,{facilityId:1,leadId,userId:99,body})
      // Observe the actual blocked session, without relying on a timed sleep
      // to guess whether conversion has reached its first row lock.
      let waiting=false
      for(let attempt=0;attempt<100;attempt++){
        waiting=(await control.query('SELECT $1::integer=ANY(pg_blocking_pids($2::integer)) AS waiting',[blocker.processID,worker.processID])).rows[0].waiting
        if(waiting)break
        await setTimeout(10)
      }
      assert.equal(waiting,true,'conversion must wait for the existing target lock')
      await control.query('BEGIN')
      try{
        await control.query('SELECT id FROM registrations WHERE id=$1 FOR UPDATE NOWAIT',[leadId])
      }finally{await control.query('ROLLBACK')}
      await blocker.query('COMMIT')
      const result=await inFlight;inFlight=null
      return result
    }
    await t.test('existing member conversion cannot hold a lead while waiting for its guardian',async()=>{
      const result=await verifyOrder({lockSql:'SELECT id FROM member WHERE id=10 FOR UPDATE',body:{memberId:10},leadId:1})
      assert.deepEqual(result,{memberId:10,familyId:100,alreadyConverted:false})
      assert.equal(Number((await control.query('SELECT converted_member_id FROM registrations WHERE id=1')).rows[0].converted_member_id),10)
      assert.equal((await convertLead(pool,{facilityId:1,leadId:1,userId:99,body:{memberId:10}})).alreadyConverted,true)
    })
    await t.test('an existing household is acquired before the lead, including an idempotent replay',async()=>{
      const result=await verifyOrder({lockSql:'SELECT id FROM family WHERE id=100 FOR UPDATE',body:{familyId:100},leadId:3})
      assert.deepEqual(result,{memberId:10,familyId:100,alreadyConverted:true})
    })
    await t.test('prelocking keeps existing facility and lifecycle validation',async()=>{
      for(const body of [{memberId:20},{memberId:30},{familyId:200},{familyId:300}]){
        await assert.rejects(convertLead(pool,{facilityId:1,leadId:2,userId:99,body}),{statusCode:404})
      }
      assert.equal((await control.query('SELECT converted_member_id FROM registrations WHERE id=2')).rows[0].converted_member_id,null)
    })
  }finally{
    await blocker.query('ROLLBACK')
    if(inFlight)await inFlight.catch(()=>{})
    await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await Promise.all([control.end(),blocker.end(),worker.end()])
  }
})
