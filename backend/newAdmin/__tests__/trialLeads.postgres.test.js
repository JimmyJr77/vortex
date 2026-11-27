import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import pg from 'pg'
import { validateRehearsalDatabaseUrl } from '../migrationAudit.js'
import { leadFreeTrialsJoin, recordFreeTrialLead } from '../trialLeads.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('trial lead history backfill is exact, idempotent, facility scoped and converts only on class enrollment', { skip: !connectionString }, async () => {
  const db = new pg.Client({ connectionString })
  await db.connect()
  const schema = `trial_leads_${crypto.randomBytes(6).toString('hex')}`
  try {
    await db.query('BEGIN')
    await db.query(`CREATE SCHEMA ${schema}`)
    await db.query(`SET LOCAL search_path=${schema}`)
    await db.query(`
      CREATE TABLE family(id bigint PRIMARY KEY,facility_id bigint);
      CREATE TABLE member(id bigint PRIMARY KEY,facility_id bigint,family_id bigint,first_name text,last_name text,
        email text,phone text,date_of_birth date,gender text);
      CREATE TABLE family_member(family_id bigint,member_id bigint,is_active boolean);
      CREATE TABLE family_billing_account(family_id bigint,payer_member_id bigint,is_active boolean);
      CREATE TABLE parent_guardian_authority(parent_member_id bigint,child_member_id bigint,has_legal_authority boolean);
      CREATE TABLE registrations(id bigserial PRIMARY KEY,facility_id bigint,member_id bigint,converted_member_id bigint,
        converted_at timestamptz,first_name text,last_name text,email text,phone text,campers jsonb,inquiry_source text,
        lead_status text,contacted boolean,follow_up boolean,archived boolean DEFAULT FALSE,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
      CREATE TABLE account_invite(registration_id bigint,facility_id bigint,invite_type text);
      CREATE TABLE program(id bigint PRIMARY KEY,facility_id bigint,name text,display_name text,is_trial_assessment boolean DEFAULT FALSE);
      CREATE TABLE scheduling_form(id bigint PRIMARY KEY,program_id bigint,title text);
      CREATE TABLE drop_in_registration(id bigint PRIMARY KEY,member_id bigint,form_id bigint,benefit_type text,class_date date,status text);
      CREATE TABLE scheduling_signup(id bigserial PRIMARY KEY,form_id bigint DEFAULT 1,member_id bigint,status text,orphaned_at timestamptz,archived_at timestamptz);
      INSERT INTO family VALUES(1,1),(2,2);
      INSERT INTO member(id,facility_id,family_id,first_name,last_name,email,date_of_birth,gender) VALUES
        (1,1,1,'Parent','One','parent@example.test','1990-01-01','female'),
        (2,1,1,'Casey','One','parent@example.test','2016-01-01','female'),
        (3,1,1,'Alex','One','parent@example.test','2018-01-01','male'),
        (4,2,2,'Foreign','Parent','parent@example.test','1990-01-01','female'),
        (5,2,2,'Foreign','Child','parent@example.test','2016-01-01','female'),
        (6,1,NULL,'No guardian','Child','child@example.test','2016-01-01','female');
      INSERT INTO family_member VALUES(1,1,TRUE),(1,2,TRUE),(1,3,TRUE),(2,4,TRUE),(2,5,TRUE);
      INSERT INTO family_billing_account VALUES(1,1,TRUE),(2,4,TRUE);
      INSERT INTO parent_guardian_authority VALUES(1,2,TRUE),(1,3,TRUE),(4,5,TRUE);
      INSERT INTO program(id,facility_id,name,display_name) VALUES(1,1,'Cyclones','Cyclones'),(2,2,'Foreign class','Foreign class');
      INSERT INTO scheduling_form VALUES(1,1,'Cyclones'),(2,2,'Foreign class');
      INSERT INTO drop_in_registration VALUES
        (1,2,1,'free_trial','2027-01-15','attended'),(2,3,1,'free_trial','2027-01-16','confirmed'),
        (3,5,2,'free_trial','2027-01-15','confirmed'),(4,6,1,'free_trial','2027-01-15','cancelled'),
        (5,2,2,'free_trial','2027-01-18','confirmed'),(6,2,1,'paid','2027-01-19','confirmed');
      INSERT INTO registrations(facility_id,member_id,inquiry_source,lead_status,campers)
        VALUES(1,1,'free_trial','qualified','[{"memberId":2,"firstName":"Casey","lastName":"One"}]');
    `)
    const migration = await readFile(new URL('../../migrations/877_free_trial_leads.sql', import.meta.url), 'utf8')
    await db.query(migration)
    await db.query(migration)
    await db.query(await readFile(new URL('../../migrations/882_lead_trial_contact_identity.sql', import.meta.url), 'utf8'))
    const leads = (await db.query('SELECT * FROM registrations ORDER BY id')).rows
    assert.equal(leads.length,3)
    assert.deepEqual(leads[0].campers.map(child => child.memberId),[2,3])
    assert.equal(leads[0].converted_member_id,null)
    assert.equal(leads.find(lead => Number(lead.member_id)===4).facility_id,'2')
    assert.equal(leads.find(lead => Number(lead.member_id)===6).campers[0].memberId,6)

    const originalId = Number(leads[0].id)
    assert.equal(await recordFreeTrialLead(db,{facilityId:1,payerMemberId:1,memberId:3}),originalId)
    assert.equal(await recordFreeTrialLead(db,{facilityId:1,payerMemberId:1,memberId:3}),originalId)
    const trial = (await db.query(`SELECT trial_history.free_trials FROM registrations r ${leadFreeTrialsJoin} WHERE r.id=$1`,[originalId])).rows[0]
    assert.deepEqual(trial.free_trials.map(item => [item.memberId,item.childIndex,item.date,item.className,item.status]),[
      [2,0,'2027-01-15','Cyclones','attended'],[3,1,'2027-01-16','Cyclones','confirmed'],
    ])
    await db.query("INSERT INTO scheduling_signup(member_id,status) VALUES(3,'pending_setup')")
    assert.equal((await db.query('SELECT converted_member_id FROM registrations WHERE id=$1',[originalId])).rows[0].converted_member_id,null)
    await db.query("UPDATE scheduling_signup SET status='confirmed' WHERE member_id=3")
    const converted = (await db.query('SELECT converted_member_id,lead_status FROM registrations WHERE id=$1',[originalId])).rows[0]
    assert.equal(Number(converted.converted_member_id),1)
    assert.equal(converted.lead_status,'converted')
    assert.equal((await db.query('SELECT count(*)::int AS count FROM registrations')).rows[0].count,3)
    assert.equal((await db.query("SELECT count(*)::int AS count FROM drop_in_registration WHERE benefit_type='free_trial'")).rows[0].count,5)
  } finally {
    await db.query('ROLLBACK')
    await db.end()
  }
})
