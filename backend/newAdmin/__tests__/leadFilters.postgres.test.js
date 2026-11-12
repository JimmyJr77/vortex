import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import pg from 'pg'
import { listLeads, leadNotes } from '../leads.js'
import { familyNotes } from '../accountNotes.js'
import { validateRehearsalDatabaseUrl } from '../migrationAudit.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('lead filters and shared account correspondence use real PostgreSQL and stay facility scoped', { skip: !connectionString }, async t => {
  const schema = `lead_filters_${crypto.randomBytes(6).toString('hex')}`
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    await db.query(`CREATE SCHEMA ${schema}`)
    await db.query(`SET LOCAL search_path=${schema}`)
    await db.query(`
      CREATE TABLE facility(id bigint PRIMARY KEY,timezone text);
      CREATE TABLE family(id bigint PRIMARY KEY,facility_id bigint);
      CREATE TABLE member(id bigint PRIMARY KEY,facility_id bigint,family_id bigint);
      CREATE TABLE family_member(family_id bigint,member_id bigint,is_active boolean);
      CREATE TABLE account_record_source(family_id bigint,member_id bigint,facility_id bigint,deleted boolean);
      CREATE TABLE registrations(id bigint PRIMARY KEY,facility_id bigint,first_name text,last_name text,email text,phone text,
        converted_member_id bigint,member_id bigint,lead_status text DEFAULT 'new',contacted boolean,follow_up boolean,
        archived boolean DEFAULT FALSE,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
        first_contacted_at timestamptz,admin_notes text,message text,athlete_age int,interests text,interests_array text[],
        interest text,class_types text[],child_ages int[],campers jsonb,submitter_role text,inquiry_source text);
      CREATE TABLE account_invite(id bigint,registration_id bigint,invite_type text,suggested_username text,expires_at timestamptz,used_at timestamptz,delivery_status text);
      CREATE TABLE note(id bigint PRIMARY KEY,subject_type text,subject_id bigint,note_type text DEFAULT 'staff_note',body text,
        author_name text,created_at timestamptz DEFAULT now(),source text,is_deleted boolean DEFAULT FALSE);
      INSERT INTO facility VALUES(1,'America/New_York'),(2,'America/New_York');
      INSERT INTO family VALUES(1,1),(2,2);
      INSERT INTO member VALUES(1,1,1),(2,1,1),(3,1,1),(4,2,2);
      INSERT INTO family_member VALUES(1,1,TRUE),(1,2,TRUE),(1,3,FALSE),(2,4,TRUE);
      INSERT INTO registrations(id,facility_id,first_name,last_name,email,phone,contacted,follow_up) VALUES
        (1,1,'Alex','Inquiry','alex@example.test','(202) 555-0111',FALSE,TRUE),
        (2,1,'Robin','Converted','robin@example.test','2025550222',TRUE,FALSE),
        (3,1,'Sam','Legacy','sam@example.test',NULL,FALSE,FALSE),
        (4,1,'Taylor','Legacy','taylor@example.test',NULL,FALSE,FALSE),
        (5,1,'Archived','Inquiry','archived@example.test',NULL,FALSE,FALSE),
        (6,2,'Foreign','Inquiry','foreign@example.test',NULL,FALSE,FALSE),
        (7,1,'Jamie','Converted','jamie@example.test',NULL,TRUE,TRUE),
        (8,1,'Invalid','Birthday','invalid@example.test',NULL,FALSE,FALSE);
      UPDATE registrations SET archived=TRUE WHERE id=5;
      UPDATE registrations SET converted_member_id=1,class_types=ARRAY['Adult Classes'] WHERE id=2;
      UPDATE registrations SET member_id=2 WHERE id=7;
      UPDATE registrations SET athlete_age=8 WHERE id=3;
      UPDATE registrations SET child_ages=ARRAY[12] WHERE id=4;
      UPDATE registrations SET campers=jsonb_build_array(jsonb_build_object('gender','female','dateOfBirth',to_char(CURRENT_DATE-interval '10 years 6 months','YYYY-MM-DD')),
        jsonb_build_object('gender','male','dateOfBirth',to_char(CURRENT_DATE-interval '15 years 6 months','YYYY-MM-DD'))),
        message='Gymnastics trial request',admin_notes='Original inquiry note',interests_array=ARRAY['Tumbling'] WHERE id=1;
      UPDATE registrations SET campers=jsonb_build_array(jsonb_build_object('gender','male','dateOfBirth',to_char(CURRENT_DATE-interval '10 years 6 months','YYYY-MM-DD'))) WHERE id=2;
      UPDATE registrations SET campers=jsonb_build_array(jsonb_build_object('gender','female','dateOfBirth',to_char(CURRENT_DATE-interval '10 years 6 months','YYYY-MM-DD'))) WHERE id=7;
      UPDATE registrations SET campers='[{"gender":"female","dateOfBirth":"2020-02-31"},{"gender":"male","dateOfBirth":"invalid"}]' WHERE id=8;
      INSERT INTO note(id,subject_type,subject_id,body) VALUES
        (1,'registration',1,'Call Tuesday'),(2,'member',2,'Sibling milestone'),(3,'registration',7,'Trial correspondence'),
        (4,'member',3,'Former member note'),(5,'member',4,'Private foreign note'),(6,'member',2,'Deleted note');
      UPDATE note SET is_deleted=TRUE WHERE id=6;
    `)
    const ids = async query => (await listLeads(db, 1, query)).rows.map(row => row.id).sort((a,b) => a-b)
    await t.test('contact, follow-up and conversion are independent, combinable filters', async () => {
      assert.deepEqual(await ids({contacted:'false'}),[1,3,4,8])
      assert.deepEqual(await ids({contacted:'true'}),[2,7])
      assert.deepEqual(await ids({followUp:'true',converted:'false'}),[1])
      assert.deepEqual(await ids({converted:'true'}),[2,7])
      assert.deepEqual(await ids({adultClasses:'true'}),[2])
    })
    await t.test('age and gender must match the same child; legacy age-only forms still match', async () => {
      assert.deepEqual(await ids({ageMin:'10',ageMax:'10',gender:'female'}),[1,7])
      assert.deepEqual(await ids({ageMin:'10',ageMax:'10',gender:'male'}),[2])
      assert.deepEqual(await ids({ageMin:'8',ageMax:'8'}),[3])
      assert.deepEqual(await ids({ageMin:'12',ageMax:'12'}),[4])
      assert.deepEqual(await ids({ageMin:'0',ageMax:'2'}),[])
    })
    await t.test('contact search normalizes phone punctuation; keywords search messages, interests and shared notes', async () => {
      assert.deepEqual(await ids({search:'2025550111'}),[1])
      assert.deepEqual(await ids({search:'Alex Inquiry'}),[1])
      assert.deepEqual(await ids({search:'robin@example.test'}),[2])
      assert.deepEqual(await ids({keywords:'gymnastics Tuesday Tumbling'}),[1])
      assert.deepEqual(await ids({keywords:'Sibling milestone'}),[2,7])
      assert.deepEqual(await ids({keywords:'Private foreign'}),[])
      assert.deepEqual(await ids({keywords:'Deleted note'}),[])
      assert.deepEqual(await ids({keywords:'%'}),[])
    })
    await t.test('filtered pagination has accurate totals and no duplicate leads', async () => {
      const page = await listLeads(db,1,{contacted:'false',page:2,pageSize:2})
      assert.equal(page.total,4);assert.equal(page.totalPages,2);assert.equal(page.rows.length,2)
      assert.deepEqual(page.rows.map(row=>row.id),[3,1])
    })
    await t.test('family and converted leads show the same notes in both directions without tenant leaks', async () => {
      assert.deepEqual(await leadNotes(db,1,2),await familyNotes(db,1,1))
      assert.deepEqual(await leadNotes(db,1,7),await familyNotes(db,1,1))
      assert.deepEqual((await familyNotes(db,1,1)).map(note=>note.body).sort(),['Former member note','Sibling milestone','Trial correspondence'])
      await db.query("INSERT INTO note(id,subject_type,subject_id,body) VALUES(7,'member',1,'Added from family'),(8,'registration',2,'Added from lead')")
      const notes=await familyNotes(db,1,1)
      assert.deepEqual(await leadNotes(db,1,2),notes)
      assert.ok(notes.some(note=>note.body==='Added from family'));assert.ok(notes.some(note=>note.body==='Added from lead'))
      const unconverted=await leadNotes(db,1,1)
      assert.deepEqual(unconverted.map(note=>note.body).sort(),['Call Tuesday','Gymnastics trial request','Original inquiry note'])
      await assert.rejects(familyNotes(db,2,1),error=>error.statusCode===404)
      await assert.rejects(leadNotes(db,2,2),error=>error.statusCode===404)
    })
    await t.test('invalid filter values fail before querying', async () => {
      for(const query of [{contacted:'yes'},{converted:'nope'},{ageMin:'-1'},{ageMax:'3.5'},{ageMin:'15',ageMax:'4'},{gender:'invalid'}]) {
        await assert.rejects(listLeads(db,1,query),error=>error.statusCode===400)
      }
    })
  } finally { await db.query('ROLLBACK'); await db.end() }
})
