import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { leadActionEligibilityJoin } from '../leadActions.js'
import { validateRehearsalDatabaseUrl } from '../migrationAudit.js'

const connectionString=process.env.NEW_ADMIN_TEST_DATABASE_URL
if(connectionString)validateRehearsalDatabaseUrl(connectionString,{nodeEnv:'development'})

test('lead trial actions use noncancelled reservations and verified account links rather than request tags', {skip:!connectionString},async()=>{
  const db=new pg.Client({connectionString});await db.connect()
  try{
    await db.query('BEGIN')
    const schema=`lead_actions_${randomBytes(6).toString('hex')}`
    await db.query(`CREATE SCHEMA ${schema}`)
    await db.query(`SET LOCAL search_path=${schema}`)
    await db.query(`
      CREATE TABLE member(id bigint PRIMARY KEY,facility_id bigint,family_id bigint,is_active boolean DEFAULT TRUE);
      CREATE TABLE family(id bigint PRIMARY KEY,facility_id bigint);
      CREATE TABLE family_member(family_id bigint,member_id bigint,is_active boolean);
      CREATE TABLE registrations(id bigint PRIMARY KEY,facility_id bigint,member_id bigint,converted_member_id bigint,
        trial_contact_member_id bigint,inquiry_source text,campers jsonb);
      CREATE TABLE program(id bigint PRIMARY KEY,facility_id bigint);
      CREATE TABLE scheduling_form(id bigint PRIMARY KEY,program_id bigint);
      CREATE TABLE drop_in_registration(member_id bigint,form_id bigint,class_date date,status text,benefit_type text);
      INSERT INTO member(id,facility_id) SELECT id,1 FROM generate_series(1,15) id;
      INSERT INTO member(id,facility_id) VALUES(20,2);
      INSERT INTO registrations(id,facility_id,campers) SELECT id,1,'[]' FROM generate_series(1,15) id;
      UPDATE registrations SET inquiry_source='free_trial' WHERE id=1;
      UPDATE registrations SET campers=jsonb_build_array(jsonb_build_object('memberId',id)) WHERE id IN(2,3,4,5,6,7,12);
      UPDATE registrations SET trial_contact_member_id=8 WHERE id=8;
      UPDATE member SET family_id=1 WHERE id IN(8,9);
      INSERT INTO family VALUES(1,1);
      INSERT INTO family_member VALUES(1,8,TRUE),(1,9,TRUE);
      UPDATE registrations SET campers='[{"firstName":"Same name"}]' WHERE id=10;
      UPDATE registrations SET campers='[{"memberId":20}]' WHERE id=11;
      UPDATE registrations SET campers='[{"memberId":"invalid"},{"memberId":"999999999999999999999"}]' WHERE id=13;
      UPDATE registrations SET converted_member_id=20 WHERE id=14;
      UPDATE registrations SET member_id=15,inquiry_source='free_trial' WHERE id=15;
      INSERT INTO program VALUES(1,1),(2,2);
      INSERT INTO scheduling_form VALUES(1,1),(2,2);
      INSERT INTO drop_in_registration VALUES
        (2,1,CURRENT_DATE-1,'confirmed','free_trial'),(3,1,CURRENT_DATE+30,'confirmed','free_trial'),
        (4,1,CURRENT_DATE-1,'attended','free_trial'),(5,1,CURRENT_DATE-1,'cancelled','free_trial'),
        (6,1,CURRENT_DATE+1,'payment_pending','free_trial'),(7,1,CURRENT_DATE+1,'account_required','free_trial'),
        (9,1,CURRENT_DATE-1,'attended','free_trial'),(20,2,CURRENT_DATE-1,'attended','free_trial'),
        (12,2,CURRENT_DATE-1,'attended','free_trial');
      ALTER TABLE drop_in_registration ADD COLUMN expires_at timestamptz;
      UPDATE registrations SET campers='[{"memberId":1}]' WHERE id=1;
      INSERT INTO drop_in_registration(member_id,form_id,class_date,status,benefit_type,expires_at)
        VALUES(1,1,CURRENT_DATE+1,'account_required','free_trial',now()-INTERVAL '1 minute');
    `)
    const rows=(await db.query(`SELECT r.id,lead_actions.* FROM registrations r
      LEFT JOIN LATERAL (SELECT NULL::bigint AS member_id) inquiry_contact ON TRUE
      ${leadActionEligibilityJoin()} ORDER BY r.id`)).rows
    assert.deepEqual(rows.filter(row=>row.has_free_trial_used).map(row=>Number(row.id)),[2,3,4,6,7,8])
    assert.equal(Number(rows.find(row=>Number(row.id)===8).linked_member_id),8)
    assert.equal(Number(rows.find(row=>Number(row.id)===15).linked_member_id),15)
    assert.equal(rows.find(row=>Number(row.id)===14).linked_member_id,null)
    assert.equal(rows.find(row=>Number(row.id)===1).has_free_trial_used,false)
  }finally{await db.query('ROLLBACK');await db.end()}
})
