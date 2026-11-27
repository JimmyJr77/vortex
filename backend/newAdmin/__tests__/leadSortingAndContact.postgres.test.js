import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { listLeads, saveLead, createLead } from '../leads.js'
import { validateRehearsalDatabaseUrl } from '../migrationAudit.js'

const connectionString=process.env.NEW_ADMIN_TEST_DATABASE_URL
if(connectionString)validateRehearsalDatabaseUrl(connectionString,{nodeEnv:'development'})

test('lead sorting, date migration and grouped contact edits use real PostgreSQL', {skip:!connectionString}, async t=>{
  const schema=`lead_sort_contact_${randomBytes(6).toString('hex')}`
  const db=new pg.Client({connectionString});await db.connect()
  const one=async(sql,values=[])=>(await db.query(sql,values)).rows[0]
  const migration=await readFile(new URL('../../migrations/883_lead_last_contacted_date.sql',import.meta.url),'utf8')
  const adapter={query:(sql,values)=>db.query(sql==='BEGIN'?'SAVEPOINT contact_edit':sql==='COMMIT'?'RELEASE SAVEPOINT contact_edit':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT contact_edit':sql,values),release(){}}
  try{
    await db.query('BEGIN');await db.query(`CREATE SCHEMA ${schema}`);await db.query(`SET LOCAL search_path=${schema}`)
    await db.query(`
      CREATE TABLE facility(id bigint PRIMARY KEY,timezone text);
      CREATE TABLE family(id bigint PRIMARY KEY,facility_id bigint);
      CREATE TABLE member(id bigint PRIMARY KEY,facility_id bigint,family_id bigint,email text,app_user_id bigint,is_active boolean DEFAULT TRUE,first_name text,last_name text);
      CREATE TABLE app_user(id bigint,facility_id bigint,email text,is_active boolean);
      CREATE TABLE family_member(family_id bigint,member_id bigint,is_active boolean);
      CREATE TABLE account_record_source(family_id bigint,member_id bigint,facility_id bigint,deleted boolean);
      CREATE TABLE registrations(id bigserial PRIMARY KEY,facility_id bigint,first_name text,last_name text,email text,phone text,
        converted_member_id bigint,converted_at timestamptz,trial_contact_member_id bigint,member_id bigint,lead_status text DEFAULT 'new',contacted boolean,follow_up boolean,
        archived boolean DEFAULT FALSE,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),first_contacted_at timestamptz,
        admin_notes text,message text,athlete_age int,interests text,interests_array text[],interest text,class_types text[],child_ages int[],campers jsonb,
        submitter_role text,inquiry_source text,submitted_by_user_id bigint,submitted_by_name text,newsletter_opt_in boolean);
      CREATE TABLE newsletter_subscribers(email text UNIQUE);
      CREATE TABLE account_invite(id bigint,facility_id bigint,registration_id bigint,invite_type text,suggested_username text,expires_at timestamptz,used_at timestamptz,delivery_status text,pending_payload jsonb);
      CREATE TABLE program(id bigint PRIMARY KEY,facility_id bigint,display_name text,name text);
      CREATE TABLE scheduling_form(id bigint PRIMARY KEY,program_id bigint,title text);
      CREATE TABLE drop_in_registration(id bigint,member_id bigint,benefit_type text,form_id bigint,class_date date,status text);
      CREATE TABLE account_enrollment_current(id bigint,record_source text,record_member_id bigint,record_facility_id bigint,status text,cancel_effective_date date);
      CREATE TABLE billing_account_activity(signup_id bigint,member_id bigint,event_type text,after_value jsonb,details jsonb);
      CREATE TABLE enrollment_action(signup_id bigint,requested_status text,status text,effective_date date);
      CREATE TABLE additional_fee(id bigint,trigger_type text,apply_basis text,name text);
      CREATE TABLE additional_fee_redemption(fee_id bigint,member_id bigint,billing_charge_id bigint,period_key text,amount_cents int,satisfied_at timestamptz,ended_at timestamptz);
      CREATE TABLE billing_charge(id bigint,member_id bigint,source_type text,source_id text,metadata jsonb,collection_status text,related_charge_id bigint,amount_cents int,created_at timestamptz,service_period_start date);
      CREATE FUNCTION account_source_date(value text) RETURNS date LANGUAGE sql IMMUTABLE AS 'SELECT value::date';
      CREATE TABLE note(id bigserial PRIMARY KEY,subject_type text,subject_id bigint,note_type text,body text,author_name text,created_at timestamptz DEFAULT now(),source text,is_deleted boolean DEFAULT FALSE);
      INSERT INTO facility VALUES(1,'America/New_York'),(2,'America/New_York');
      INSERT INTO member(id,facility_id,first_name,last_name,email) VALUES(1,1,'Zoe','Adams','one@example.test'),(2,1,'Amy','Baker','two@example.test'),(3,1,'Aaron','Adams','three@example.test'),(4,1,'Only','','four@example.test'),
        (10,1,'Child','Adams',NULL),(20,1,'Child','Baker',NULL),(30,1,'Child','Adams',NULL);
      INSERT INTO registrations(id,facility_id,first_name,last_name,email,created_at,contacted,first_contacted_at,inquiry_source,campers) VALUES
        (1,1,'Zoe','Adams','one@example.test','2026-01-01',TRUE,'2026-01-02T02:00:00Z','admin_portal','[{"memberId":10}]'),
        (2,1,'Amy','Baker','two@example.test','2026-01-02',FALSE,NULL,'admin_portal','[]'),
        (3,1,'Aaron','Adams','three@example.test','2026-01-03',FALSE,NULL,'admin_portal','[{"memberId":30}]'),
        (4,1,'Only','','four@example.test','2026-01-04',FALSE,NULL,'admin_portal','[]'),
        (10,1,'Amy','Baker','two@example.test','2026-02-01',FALSE,NULL,'free_trial','[{"memberId":20}]');
      UPDATE registrations SET member_id=2 WHERE id=10;
      UPDATE registrations SET converted_member_id=1,converted_at='2026-01-15T13:00:00Z' WHERE id=1;
      UPDATE registrations SET converted_member_id=3 WHERE id=3;
      UPDATE registrations SET converted_member_id=4 WHERE id=4;
      INSERT INTO account_invite VALUES(3,1,3,'lead_registration','test',now()+INTERVAL '1 week','2026-03-01T13:00:00Z','sent','{"purpose":"registration"}');
      INSERT INTO program VALUES(1,1,'Test class','Test class');INSERT INTO scheduling_form VALUES(1,1,'Test class');
      INSERT INTO drop_in_registration VALUES(1,10,'free_trial',1,'2026-04-01','attended'),(2,10,'free_trial',1,'2026-05-01','attended'),
        (3,20,'free_trial',1,'2026-03-01','attended'),(4,30,'free_trial',1,'2026-06-01','confirmed');
      SELECT setval(pg_get_serial_sequence('registrations','id'),100);
    `)
    await db.query(await readFile(new URL('../../migrations/875_business_acquisition.sql',import.meta.url),'utf8'))
    await db.query(migration)
    const filters={includeMembers:'true',pageSize:25}
    const sorted=async(sortBy,sortDirection)=>(await listLeads(db,1,{...filters,sortBy,sortDirection})).rows.map(row=>row.id)
    await t.test('backfill preserves facility-local first contact without inventing dates, and replay preserves a clear',async()=>{
      assert.equal((await one("SELECT last_contacted_date::text AS date FROM registrations WHERE id=1")).date,'2026-01-01')
      assert.equal((await one("SELECT last_contacted_date::text AS date FROM registrations WHERE id=2")).date,null)
      await db.query('UPDATE registrations SET last_contacted_date=NULL WHERE id=1')
      await db.query(migration)
      assert.equal((await one("SELECT last_contacted_date::text AS date FROM registrations WHERE id=1")).date,null)
    })
    await t.test('all four sort keys work in both directions after grouping, keep nulls last and paginate stably',async()=>{
      assert.deepEqual(await sorted('name','asc'),[3,1,2,4]);assert.deepEqual(await sorted('name','desc'),[2,1,3,4])
      assert.deepEqual(await sorted('inquiryDate','asc'),[1,2,3,4]);assert.deepEqual(await sorted('inquiryDate','desc'),[4,3,2,1])
      assert.deepEqual(await sorted('freeTrialDate','asc'),[2,1,3,4]);assert.deepEqual(await sorted('freeTrialDate','desc'),[3,1,2,4])
      assert.deepEqual(await sorted('conversionDate','asc'),[1,3,2,4]);assert.deepEqual(await sorted('conversionDate','desc'),[3,1,4,2])
      const pages=await Promise.all([1,2].map(page=>listLeads(db,1,{...filters,sortBy:'name',sortDirection:'asc',page,pageSize:2})))
      assert.deepEqual(pages.flatMap(page=>page.rows.map(row=>row.id)),[3,1,2,4]);assert.ok(pages.every(page=>page.total===4))
    })
    await t.test('group date uses latest saved source and explicit edits or clears persist through later note saves',async()=>{
      await db.query("UPDATE registrations SET last_contacted_date=CASE WHEN id=2 THEN DATE '2026-01-20' ELSE DATE '2026-02-20' END WHERE id IN(2,10)")
      assert.equal((await listLeads(db,1,filters)).rows.find(row=>row.id===2).lastContactedAt,'2026-02-20')
      const save=body=>saveLead({connect:async()=>adapter},1,10,body,{})
      await save({lastContactedAt:'2026-02-01'})
      assert.deepEqual((await db.query('SELECT last_contacted_date::text AS date FROM registrations WHERE id IN(2,10) ORDER BY id')).rows,[{date:'2026-02-01'},{date:'2026-02-01'}])
      await save({contacted:true,lastContactedAt:null})
      assert.equal((await listLeads(db,1,filters)).rows.find(row=>row.id===2).lastContactedAt,null)
      await save({contacted:true,message:'Keep the manually cleared date'})
      assert.equal((await listLeads(db,1,filters)).rows.find(row=>row.id===2).lastContactedAt,null)
      await save({contacted:false});await save({contacted:true})
      const today=(await one("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date::text AS today")).today
      assert.equal((await listLeads(db,1,filters)).rows.find(row=>row.id===2).lastContactedAt,today)
      await save({lastContactedAt:'2026-01-10',contacted:true})
      await save({contacted:true,followUp:true})
      assert.equal((await listLeads(db,1,filters)).rows.find(row=>row.id===2).lastContactedAt,'2026-01-10')
      assert.ok((await one('SELECT first_contacted_at FROM registrations WHERE id=2')).first_contacted_at)
      await assert.rejects(save({lastContactedAt:'9999-12-31'}),{statusCode:400})
    })
    await t.test('admin creation accepts a manual date or clear and marks first checked contact using the facility date',async()=>{
      const explicit=await createLead(db,1,{email:'manual@example.test',contacted:true,lastContactedAt:'2026-01-05'})
      assert.equal(explicit.lastContactedAt,'2026-01-05')
      const cleared=await createLead(db,1,{email:'clear@example.test',contacted:true,lastContactedAt:null})
      assert.equal(cleared.lastContactedAt,null)
      const automatic=await createLead(db,1,{email:'auto@example.test',contacted:true})
      assert.equal(automatic.lastContactedAt,(await one("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date::text AS today")).today)
    })
  }finally{await db.query('ROLLBACK');await db.end()}
})
