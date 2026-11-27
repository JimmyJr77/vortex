import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { readFile } from 'node:fs/promises'
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
    await db.query(await readFile(new URL('../../migrations/875_business_acquisition.sql', import.meta.url), 'utf8'))
    await db.query(`
      CREATE TABLE facility(id bigint PRIMARY KEY,timezone text);
      CREATE TABLE family(id bigint PRIMARY KEY,facility_id bigint);
      CREATE TABLE member(id bigint PRIMARY KEY,facility_id bigint,family_id bigint,email text,app_user_id bigint,is_active boolean DEFAULT TRUE,first_name text,last_name text);
      CREATE TABLE app_user(id bigint PRIMARY KEY,facility_id bigint,email text,is_active boolean DEFAULT TRUE);
      CREATE TABLE family_member(family_id bigint,member_id bigint,is_active boolean);
      CREATE TABLE account_record_source(family_id bigint,member_id bigint,facility_id bigint,deleted boolean);
      CREATE TABLE registrations(id bigint PRIMARY KEY,facility_id bigint,first_name text,last_name text,email text,phone text,
        converted_member_id bigint,member_id bigint,lead_status text DEFAULT 'new',contacted boolean,follow_up boolean,
        archived boolean DEFAULT FALSE,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
        first_contacted_at timestamptz,admin_notes text,message text,athlete_age int,interests text,interests_array text[],
        interest text,class_types text[],child_ages int[],campers jsonb,submitter_role text,inquiry_source text,submitted_by_name text);
      CREATE TABLE account_invite(id bigint,facility_id bigint,registration_id bigint,invite_type text,suggested_username text,expires_at timestamptz,used_at timestamptz,delivery_status text,pending_payload jsonb);
      CREATE TABLE program(id bigint PRIMARY KEY,facility_id bigint,display_name text,name text,is_trial_assessment boolean DEFAULT FALSE);
      CREATE TABLE scheduling_form(id bigint PRIMARY KEY,program_id bigint,title text);
      CREATE TABLE drop_in_registration(id bigint PRIMARY KEY,member_id bigint,benefit_type text,form_id bigint,class_date date,status text);
      CREATE TABLE account_enrollment_current(id bigint,record_source text DEFAULT 'vortex',record_member_id bigint,record_facility_id bigint,form_id bigint,
        historical_only boolean DEFAULT FALSE,archived_at timestamptz,orphaned_at timestamptz,status text,
        enrollment_start_date date,cancel_effective_date date,pause_effective_date date,record_program_end date);
      CREATE TABLE billing_account_activity(signup_id bigint,member_id bigint,event_type text,after_value jsonb,details jsonb);
      CREATE TABLE enrollment_action(signup_id bigint,requested_status text,status text,effective_date date);
      CREATE TABLE additional_fee(id bigint PRIMARY KEY,trigger_type text,apply_basis text,name text);
      CREATE TABLE additional_fee_redemption(fee_id bigint,member_id bigint,billing_charge_id bigint,period_key text,
        amount_cents int,satisfied_at timestamptz,ended_at timestamptz);
      CREATE TABLE billing_charge(id bigint PRIMARY KEY,member_id bigint,source_type text,source_id text,metadata jsonb,
        collection_status text,related_charge_id bigint,amount_cents int,created_at timestamptz,service_period_start date);
      CREATE FUNCTION account_source_date(value text) RETURNS date LANGUAGE sql IMMUTABLE AS 'SELECT value::date';
      CREATE TABLE note(id bigint PRIMARY KEY,subject_type text,subject_id bigint,note_type text DEFAULT 'staff_note',body text,
        author_name text,created_at timestamptz DEFAULT now(),source text,is_deleted boolean DEFAULT FALSE);
      INSERT INTO facility VALUES(1,'America/New_York'),(2,'America/New_York');
      INSERT INTO family VALUES(1,1),(2,2),(3,1);
      INSERT INTO member(id,facility_id,family_id) VALUES(1,1,1),(2,1,1),(3,1,1),(4,2,2);
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
      INSERT INTO business_acquisition(record_kind,record_id,landing_path) VALUES ('inquiry',1,'/gymnastics');
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
    await t.test('known direct inquiries are distinct from older records with no source', async () => {
      const { rows } = await listLeads(db, 1)
      assert.deepEqual(rows.find(row => row.id === 1).acquisition, { source: null, medium: null, campaign: null, referrerHost: null, landingPath: '/gymnastics', direct: true })
      assert.equal(rows.find(row => row.id === 3).acquisition, null)
    })
    await t.test('contact, follow-up and conversion are independent, combinable filters', async () => {
      assert.deepEqual(await ids({contacted:'false'}),[1,3,4,8])
      assert.deepEqual(await ids({contacted:'true'}),[])
      assert.deepEqual(await ids({}),[1,3,4,8])
      assert.deepEqual(await ids({followUp:'true',converted:'false'}),[1])
      assert.deepEqual(await ids({converted:'true'}),[2,7])
      assert.deepEqual(await ids({adultClasses:'true',converted:'true'}),[2])
    })
    await t.test('age and gender must match the same child; legacy age-only forms still match', async () => {
      assert.deepEqual(await ids({ageMin:'10',ageMax:'10',gender:'female'}),[1])
      assert.deepEqual(await ids({ageMin:'10',ageMax:'10',gender:'male',converted:'true'}),[2])
      assert.deepEqual(await ids({ageMin:'8',ageMax:'8'}),[3])
      assert.deepEqual(await ids({ageMin:'12',ageMax:'12'}),[4])
      assert.deepEqual(await ids({ageMin:'0',ageMax:'2'}),[])
    })
    await t.test('contact search normalizes phone punctuation; keywords search messages, interests and shared notes', async () => {
      assert.deepEqual(await ids({search:'2025550111'}),[1])
      assert.deepEqual(await ids({search:'+1 (202) 555-0111'}),[1])
      assert.deepEqual(await ids({search:'Alex Inquiry'}),[1])
      assert.deepEqual(await ids({search:'robin@example.test'}),[])
      assert.deepEqual(await ids({keywords:'gymnastics Tuesday Tumbling'}),[1])
      assert.deepEqual(await ids({keywords:'Sibling milestone',converted:'true'}),[2,7])
      assert.deepEqual(await ids({keywords:'Private foreign'}),[])
      assert.deepEqual(await ids({keywords:'Deleted note'}),[])
      assert.deepEqual(await ids({keywords:'%'}),[])
    })
    await t.test('name search includes the same listed child, legacy child names and facility-scoped trial athletes', async () => {
      await db.query('SAVEPOINT child_name_search')
      try {
        await db.query(`
          UPDATE registrations SET campers='[{"firstName":"Avery","lastName":"Student"},{"firstName":"Morgan","lastName":"Sibling"},{"memberId":"invalid"},{"memberId":"999999999999999999999999"}]' WHERE id=1;
          UPDATE registrations SET campers='[{"first_name":"Casey","last_name":"Legacy"}]' WHERE id=3;
          UPDATE registrations SET campers='[{"name":"Reese Historical"}]' WHERE id=4;
          UPDATE registrations SET campers='[{"firstName":"Avery","lastName":"Student"}]' WHERE id IN (5,6);
          UPDATE registrations SET campers='{"firstName":"Malformed","lastName":"Object"}' WHERE id=8;
          UPDATE member SET first_name='Linked',last_name='Trialname' WHERE id=2;
          UPDATE member SET first_name='Foreign',last_name='Linkedchild' WHERE id=4;
          INSERT INTO member(id,facility_id,first_name,last_name) VALUES(30,1,'Harper','Contact');
          INSERT INTO registrations(id,facility_id,first_name,last_name,email,member_id,inquiry_source,campers) VALUES
            (30,1,'Harper','Contact','harper@example.test',30,'free_trial','[{"memberId":2}]'),
            (31,1,'Private','Link','private-link@example.test',NULL,NULL,'[{"memberId":4}]');
          INSERT INTO program(id,facility_id,display_name,name) VALUES(30,1,'Name search trial','Name search trial');
          INSERT INTO scheduling_form VALUES(30,30,'Name search trial');
          INSERT INTO drop_in_registration VALUES(30,2,'free_trial',30,'2027-01-15','confirmed');
        `)
        assert.deepEqual(await ids({search:'Avery Student'}),[1])
        assert.deepEqual(await ids({search:'aVeR'}),[1])
        assert.deepEqual(await ids({search:'STUDENT'}),[1])
        assert.deepEqual(await ids({search:'ave stu'}),[1])
        assert.deepEqual(await ids({search:'Student Avery'}),[1])
        assert.deepEqual(await ids({search:'Avery Sibling'}),[], 'name tokens cannot come from different siblings')
        assert.deepEqual(await ids({search:'Casey Legacy'}),[3])
        assert.deepEqual(await ids({search:'Reese Historical'}),[4])
        const linked = await listLeads(db,1,{search:'Linked Trialname'})
        assert.deepEqual(linked.rows.map(row=>row.id),[30])
        assert.equal(linked.rows[0].freeTrials[0].childName,'Linked Trialname')
        assert.deepEqual(await ids({search:'Foreign Linkedchild'}),[], 'a linked ID cannot reveal a different facility’s athlete')
        assert.deepEqual(await ids({search:'Avery Student',archived:'true'}),[5])
        assert.deepEqual((await listLeads(db,2,{search:'Avery Student'})).rows.map(row=>row.id),[6])
        assert.deepEqual(await ids({search:'Malformed Object'}),[])
        assert.deepEqual(await ids({search:'%'}),[], 'name searches treat SQL wildcard characters literally')
        assert.deepEqual(await ids({search:'Alex Inquiry'}),[1])
        assert.deepEqual(await ids({search:'alex@example.test'}),[1])
        assert.deepEqual(await ids({search:'+1 (202) 555-0111'}),[1])
      } finally { await db.query('ROLLBACK TO SAVEPOINT child_name_search') }
    })
    await t.test('filtered pagination has accurate totals and no duplicate leads', async () => {
      const page = await listLeads(db,1,{contacted:'false',page:2,pageSize:2})
      assert.equal(page.total,4);assert.equal(page.totalPages,2);assert.equal(page.rows.length,2)
      assert.deepEqual(page.rows.map(row=>row.id),[3,1])
    })
    await t.test('participation buttons use actual linked bookings and current households without hiding converted leads', async () => {
      await db.query('SAVEPOINT participation_bookings')
      try {
        await db.query(`
          INSERT INTO member(id,facility_id,first_name,last_name) SELECT id,1,'Category',id::text FROM generate_series(100,112) id;
          INSERT INTO registrations(id,facility_id,first_name,last_name,email,campers,contacted,follow_up)
            SELECT id,1,'Category',id::text,'category-'||id||'@example.test',jsonb_build_array(jsonb_build_object('memberId',id)),FALSE,TRUE
            FROM generate_series(100,108) id;
          INSERT INTO program(id,facility_id,display_name,name) VALUES(100,1,'Category class','Category class'),(101,2,'Foreign category','Foreign category');
          INSERT INTO scheduling_form VALUES(100,100,'Category class'),(101,101,'Foreign category');
          INSERT INTO drop_in_registration VALUES
            (100,100,'free_trial',100,CURRENT_DATE+1,'confirmed'),(101,101,'paid',100,CURRENT_DATE-1,'attended'),
            (102,102,'free_trial',100,CURRENT_DATE-1,'cancelled'),(103,105,'paid',101,CURRENT_DATE-1,'attended'),
            (104,106,'paid',100,CURRENT_DATE-1,'attended'),(105,4,'free_trial',101,CURRENT_DATE-1,'attended'),
            (106,108,'free_trial',100,CURRENT_DATE-10,'attended');
          UPDATE registrations SET converted_member_id=100,lead_status='converted' WHERE id=100;
          INSERT INTO family VALUES(100,1),(101,1);
          UPDATE member SET family_id=100 WHERE id IN(101,111);
          UPDATE member SET family_id=101 WHERE id IN(106,112);
          INSERT INTO family_member VALUES(100,101,TRUE),(100,111,TRUE),(101,106,FALSE),(101,112,TRUE);
          UPDATE registrations SET campers='[]',member_id=111 WHERE id=101;
          UPDATE registrations SET campers='[{"firstName":"Category","lastName":"100"}]' WHERE id=103;
          UPDATE registrations SET campers='[]',inquiry_source='free_trial' WHERE id=104;
          UPDATE registrations SET campers='[]',member_id=112 WHERE id=106;
          UPDATE registrations SET campers='[{"memberId":4},{"memberId":"invalid"}]' WHERE id=107;
        `)
        assert.deepEqual(await ids({participation:'free_trial',search:'category'}),[100,108])
        assert.deepEqual(await ids({participation:'drop_in',search:'category'}),[101])
        assert.deepEqual(await ids({participation:'free_trial',search:'category',converted:'false'}),[108])
        assert.deepEqual(await ids({participation:'free_trial',search:'category',followUp:'false'}),[])
        const page=await listLeads(db,1,{participation:'free_trial',search:'category',pageSize:1,page:2})
        assert.equal(page.total,2);assert.equal(page.totalPages,2);assert.deepEqual(page.rows.map(row=>row.id),[100])
        assert.deepEqual(await ids({search:'category'}),[102,103,104,107,108])
        await db.query('UPDATE registrations SET archived=TRUE WHERE id=108')
        assert.deepEqual(await ids({participation:'free_trial',search:'category'}),[100])
        assert.deepEqual(await ids({participation:'free_trial',search:'category',archived:'true'}),[108])
      } finally { await db.query('ROLLBACK TO SAVEPOINT participation_bookings') }
    })
    await t.test('inquiry participation keeps saved inquiries separate from trial requests and linked participation before or after booking', async () => {
      await db.query('SAVEPOINT participation_inquiries')
      try {
        await db.query(`
          INSERT INTO member(id,facility_id,first_name,last_name)
            SELECT id,1,'Inquiry category',id::text FROM generate_series(200,222) id;
          INSERT INTO registrations(id,facility_id,first_name,last_name,email,campers,contacted,follow_up,inquiry_source)
            SELECT id,1,'Inquiry category',id::text,'inquiry-category-'||id||'@example.test',
              jsonb_build_array(jsonb_build_object('memberId',id)),FALSE,TRUE,'admin_portal' FROM generate_series(200,221) id;
          UPDATE registrations SET inquiry_source='/',interests_array=ARRAY['Gymnastics'],message='We are not ready for a trial.' WHERE id=201;
          UPDATE registrations SET inquiry_source=NULL,interest='Free trial information' WHERE id=202;
          UPDATE registrations SET inquiry_source='free_trial' WHERE id=203;
          UPDATE registrations SET inquiry_source='/Free-Trial/' WHERE id=217;
          UPDATE registrations SET archived=TRUE WHERE id=215;
          UPDATE registrations SET campers='[{"firstName":"Inquiry category","lastName":"206"}]' WHERE id=218;
          UPDATE registrations SET converted_member_id=219,lead_status='converted' WHERE id=219;
          UPDATE registrations SET facility_id=2 WHERE id=220;
          INSERT INTO program(id,facility_id,display_name,name) VALUES(200,1,'Inquiry category class','Inquiry category class'),(201,2,'Foreign inquiry category','Foreign inquiry category');
          INSERT INTO scheduling_form VALUES(200,200,'Inquiry category class'),(201,201,'Foreign inquiry category');
          INSERT INTO account_invite(id,facility_id,registration_id,invite_type,expires_at,delivery_status,pending_payload) VALUES
            (200,1,204,'lead_registration',now()+INTERVAL '1 week','pending','{"purpose":"trial"}'),
            (201,1,205,'lead_registration',now()-INTERVAL '1 day','sent','{"purpose":"trial"}'),
            (202,2,214,'lead_registration',now()+INTERVAL '1 week','pending','{"purpose":"trial"}'),
            (203,1,216,'lead_registration',now()+INTERVAL '1 week','pending','{"purpose":"registration"}');
          INSERT INTO drop_in_registration VALUES
            (200,206,'free_trial',200,CURRENT_DATE+1,'confirmed'),
            (201,207,'free_trial',200,CURRENT_DATE-1,'cancelled'),
            (202,208,'free_trial',200,CURRENT_DATE+1,'payment_pending'),
            (203,209,'paid',200,CURRENT_DATE-1,'attended'),
            (204,213,'free_trial',201,CURRENT_DATE-1,'attended'),
            (205,222,'free_trial',200,CURRENT_DATE-1,'attended');
          INSERT INTO account_enrollment_current(record_member_id,record_facility_id,status,historical_only,enrollment_start_date) VALUES
            (210,1,'confirmed',FALSE,CURRENT_DATE-1),
            (211,1,'cancelled',TRUE,CURRENT_DATE-365),
            (212,1,'pending_setup',FALSE,CURRENT_DATE+1);
          INSERT INTO family VALUES(200,1);
          INSERT INTO family_member VALUES(200,221,TRUE),(200,222,TRUE);
          UPDATE registrations SET campers='[]',member_id=221 WHERE id=221;
        `)
        const query={participation:'inquiry',search:'inquiry-category'}
        assert.deepEqual(await ids(query),[200,201,202,212,213,214,216,218,219])
        assert.deepEqual(await ids({...query,converted:'false'}),[200,201,202,212,213,214,216,218])
        assert.deepEqual(await ids({...query,converted:'true'}),[219])
        assert.deepEqual(await ids({...query,archived:'true'}),[215])
        assert.deepEqual(await ids({...query,followUp:'false'}),[])
        const page=await listLeads(db,1,{...query,pageSize:3,page:2})
        assert.equal(page.total,9)
        assert.equal(page.totalPages,3)
        assert.deepEqual(page.rows.map(row=>row.id),[214,213,212])
        assert.deepEqual((await listLeads(db,2,query)).rows.map(row=>row.id),[220])
      } finally { await db.query('ROLLBACK TO SAVEPOINT participation_inquiries') }
    })
    await t.test('recent drops use the last 90 facility-local effective days, retain finalized cancellations and exclude class swaps', async () => {
      await db.query('SAVEPOINT participation_drops')
      try {
        await db.query(`
          INSERT INTO member(id,facility_id,first_name,last_name) SELECT id,1,'Drop',id::text FROM generate_series(120,138) id;
          INSERT INTO registrations(id,facility_id,first_name,last_name,email,converted_member_id,campers,contacted,follow_up)
            SELECT id,1,'Drop',id::text,'drop-'||id||'@example.test',id,jsonb_build_array(jsonb_build_object('memberId',id)),FALSE,TRUE
            FROM generate_series(120,138) id;
          INSERT INTO account_enrollment_current(id,record_member_id,record_facility_id,status,enrollment_start_date,cancel_effective_date)
            SELECT id,id,1,'cancelled',CURRENT_DATE-365,CURRENT_DATE-10 FROM generate_series(120,138) id;
          UPDATE account_enrollment_current SET cancel_effective_date=(CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date-90 WHERE id=120;
          UPDATE account_enrollment_current SET cancel_effective_date=(CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date-91 WHERE id=121;
          UPDATE account_enrollment_current SET cancel_effective_date=CURRENT_DATE+1 WHERE id=122;
          INSERT INTO billing_account_activity(signup_id,member_id,event_type) VALUES(123,123,'enrollment_class_swapped'),(128,128,'enrollment_class_swapped');
          UPDATE account_enrollment_current SET cancel_effective_date=NULL WHERE id IN(124,125,126,127,131,136);
          INSERT INTO billing_account_activity VALUES
            (124,124,'enrollment_cancellation_scheduled',jsonb_build_object('cancelEffectiveDate',(CURRENT_DATE-5)::text),NULL),
            (131,131,'enrollment_cancelled_immediately',NULL,jsonb_build_object('preview',jsonb_build_object('effectiveDate',(CURRENT_DATE+1)::text)));
          INSERT INTO enrollment_action VALUES(125,'cancelled','applied',CURRENT_DATE-7),
            (126,'cancelled','applied',CURRENT_DATE-8),(136,'cancelled','cancelled',CURRENT_DATE-9);
          UPDATE account_enrollment_current SET status='confirmed' WHERE id=126;
          UPDATE account_enrollment_current SET status='completed',record_program_end=CURRENT_DATE-2 WHERE id=127;
          INSERT INTO account_enrollment_current(id,record_member_id,record_facility_id,status,enrollment_start_date,cancel_effective_date) VALUES
            (228,128,1,'cancelled',CURRENT_DATE-9,CURRENT_DATE-2),(230,130,1,'confirmed',CURRENT_DATE-9,NULL);
          UPDATE account_enrollment_current SET id=-129,record_source='jackrabbit',historical_only=TRUE WHERE id=129;
          UPDATE registrations SET archived=TRUE WHERE id=132;
          UPDATE registrations SET facility_id=2 WHERE id=133;
          INSERT INTO family VALUES(120,1),(121,1);
          UPDATE member SET family_id=120 WHERE id IN(134,137);
          UPDATE member SET family_id=121 WHERE id IN(135,138);
          INSERT INTO family_member VALUES(120,134,TRUE),(120,137,TRUE),(121,135,FALSE),(121,138,TRUE);
          DELETE FROM account_enrollment_current WHERE record_member_id IN(137,138);
          UPDATE registrations SET converted_member_id=137,campers='[]' WHERE id=134;
          UPDATE registrations SET converted_member_id=138,campers='[]' WHERE id=135;
          UPDATE registrations SET campers='{}',converted_member_id=NULL WHERE id=137;
        `)
        assert.deepEqual(await ids({participation:'recent_drop',search:'drop'}),[120,124,125,128,129,130,134])
        assert.deepEqual(await ids({participation:'recent_drop',search:'drop',archived:'true'}),[132])
        assert.deepEqual(await ids({participation:'recent_drop',search:'drop',followUp:'false'}),[])
        const page=await listLeads(db,1,{participation:'recent_drop',search:'drop',pageSize:2,page:2})
        assert.equal(page.total,7);assert.equal(page.totalPages,4);assert.deepEqual(page.rows.map(row=>row.id),[129,128])
        await db.query(`UPDATE billing_account_activity SET after_value=NULL,
          details=jsonb_build_object('preview',jsonb_build_object('effectiveDate',(CURRENT_DATE-5)::text)) WHERE signup_id=124`)
        assert.deepEqual(await ids({participation:'recent_drop',search:'drop-124'}),[124])
      } finally { await db.query('ROLLBACK TO SAVEPOINT participation_drops') }
    })
    await t.test('family and converted leads show the same notes in both directions without tenant leaks', async () => {
      assert.deepEqual(await leadNotes(db,1,2),await familyNotes(db,1,1))
      assert.deepEqual(await leadNotes(db,1,7),await familyNotes(db,1,1))
      assert.deepEqual((await familyNotes(db,1,1)).map(note=>note.body).sort(),['Former member note','Sibling milestone','Trial correspondence'])
      await db.query(`INSERT INTO note(id,subject_type,subject_id,body) VALUES
        (7,'family',1,'Household scheduling update'),(8,'registration',2,'Added from lead'),
        (9,'family',2,'Foreign family scheduling update'),(10,'family',3,'New family note without members')`)
      const notes=await familyNotes(db,1,1)
      assert.deepEqual(await leadNotes(db,1,2),notes)
      assert.deepEqual(await leadNotes(db,1,7),notes)
      assert.deepEqual(notes.map(note=>note.body).sort(),['Added from lead','Former member note','Household scheduling update','Sibling milestone','Trial correspondence'])
      assert.equal(notes.find(note=>note.body==='Household scheduling update').subjectType,'family')
      assert.deepEqual((await familyNotes(db,1,3)).map(note=>note.body),['New family note without members'])
      assert.deepEqual(await ids({keywords:'Household scheduling update',converted:'true'}),[2,7])
      assert.deepEqual(await ids({keywords:'Foreign family scheduling update'}),[])
      const unconverted=await leadNotes(db,1,1)
      assert.deepEqual(unconverted.map(note=>note.body).sort(),['Call Tuesday','Gymnastics trial request','Original inquiry note'])
      await assert.rejects(familyNotes(db,2,1),error=>error.statusCode===404)
      await assert.rejects(leadNotes(db,2,2),error=>error.statusCode===404)
    })
    await t.test('invalid filter values fail before querying', async () => {
      for(const query of [{contacted:'yes'},{converted:'nope'},{includeMembers:'yes'},{ageMin:'-1'},{ageMax:'3.5'},{ageMin:'15',ageMax:'4'},{gender:'invalid'},{participation:'invented'}]) {
        await assert.rejects(listLeads(db,1,query),error=>error.statusCode===400)
      }
    })
    await t.test('matching nonarchived members without paid activity leaves inquiries in the follow-up queue without creating links', async () => {
      await db.query(`
        UPDATE member SET email='  ALEX@Example.test ' WHERE id=1;
        UPDATE member SET email='sam@example.test' WHERE id=4;
        UPDATE member SET email='invalid@example.test',is_active=FALSE WHERE id=3;
        INSERT INTO app_user(id,facility_id,email) VALUES(1,1,'taylor@example.test');
        UPDATE member SET app_user_id=1 WHERE id=2;
      `)
      const { rows } = await listLeads(db, 1)
      assert.deepEqual(rows.map(row => [row.id, row.matchedMemberId, row.convertedMemberId]), [
        [8,null,null], [4,2,null], [3,null,null], [1,1,null],
      ])
      await db.query("UPDATE member SET email='alex@example.test' WHERE id=2")
      const { rows: [ambiguous] } = await listLeads(db, 1, { search: 'alex@example.test' })
      assert.equal(ambiguous.matchedMemberId, null)
      assert.deepEqual((await leadNotes(db,1,1)).map(note=>note.body).sort(),
        ['Call Tuesday','Gymnastics trial request','Original inquiry note'])
    })
    await t.test('member visibility uses membership or recent paid drop-ins independently of enrollment and conversion', async () => {
      await db.query('SAVEPOINT member_visibility')
      try {
        await db.query(`
          INSERT INTO member(id,facility_id,email) SELECT id,1,'visibility-'||id||'@example.test' FROM generate_series(10,24) id;
          UPDATE member SET is_active=FALSE WHERE id=18;
          UPDATE member SET facility_id=2 WHERE id=22;
          INSERT INTO registrations(id,facility_id,first_name,last_name,email,contacted,follow_up)
            SELECT id,1,'Visibility',id::text,'visibility-'||id||'@example.test',FALSE,TRUE FROM generate_series(10,24) id;
          UPDATE registrations SET lead_status='converted' WHERE id=17;
          UPDATE registrations SET converted_member_id=18 WHERE id=18;
          UPDATE registrations SET inquiry_source='free_trial',member_id=id WHERE id IN (19,20,23);
          UPDATE registrations SET email='different-contact@example.test',campers='[{"memberId":21}]' WHERE id=21;
          INSERT INTO program(id,facility_id,display_name,name,is_trial_assessment) VALUES(10,1,'Assessment','Assessment',TRUE);
          INSERT INTO scheduling_form VALUES(10,10,'Assessment');
          INSERT INTO account_enrollment_current(record_member_id,record_facility_id,status,enrollment_start_date,form_id) VALUES
            (10,1,'confirmed',CURRENT_DATE-1,NULL),(15,1,'confirmed',CURRENT_DATE+1,NULL),
            (16,1,'confirmed',CURRENT_DATE-1,NULL),(20,1,'confirmed',CURRENT_DATE-1,NULL),
            (21,1,'confirmed',CURRENT_DATE-1,NULL),(22,2,'confirmed',CURRENT_DATE-1,NULL),
            (23,1,'confirmed',CURRENT_DATE-1,10);
          UPDATE account_enrollment_current SET pause_effective_date=CURRENT_DATE WHERE record_member_id=16;
          INSERT INTO additional_fee VALUES(10,'once_per_year','per_year','Annual membership');
          INSERT INTO additional_fee_redemption(fee_id,member_id,period_key,amount_cents,satisfied_at) VALUES
            (10,12,(CURRENT_DATE+365)::text,8500,now()-INTERVAL '1 day'),
            (10,24,(CURRENT_DATE-1)::text,8500,now()-INTERVAL '1 year');
          INSERT INTO drop_in_registration VALUES
            (10,13,'paid',NULL,CURRENT_DATE-1,'attended'),(11,14,'free_trial',NULL,CURRENT_DATE-1,'attended');
        `)
        const query = { search:'visibility', followUp:'true' }
        assert.deepEqual(await ids(query),[10,11,14,15,16,19,20,21,22,23,24])
        assert.deepEqual(await ids({...query,includeMembers:'false'}),[10,11,14,15,16,19,20,21,22,23,24])
        assert.deepEqual(await ids({...query,includeMembers:'true'}),[10,11,12,13,14,15,16,17,18,19,20,21,22,23,24])
        assert.deepEqual(await ids({...query,converted:'true'}),[17,18])
        assert.deepEqual(await ids({...query,status:'converted'}),[17,18])
        assert.deepEqual(await ids({...query,includeMembers:'true',converted:'false'}),[10,11,12,13,14,15,16,19,20,21,22,23,24])
        const page = await listLeads(db,1,{...query,pageSize:3,page:2})
        assert.equal(page.total,11)
        assert.equal(page.totalPages,4)
        assert.deepEqual(page.rows.map(row=>row.id),[21,20,19])
        const shown = await listLeads(db,1,{...query,includeMembers:'true',pageSize:100})
        assert.equal(shown.total,15)
        assert.ok(shown.rows.every(row=>row.createdAt instanceof Date && !Number.isNaN(row.createdAt.getTime())))
        assert.deepEqual((await db.query('SELECT id FROM registrations WHERE id BETWEEN 10 AND 24 AND archived IS TRUE')).rows,[])
        await db.query("UPDATE member SET is_active=FALSE WHERE id=12; UPDATE registrations SET member_id=12,inquiry_source='free_trial' WHERE id=12")
        assert.deepEqual(await ids({...query,search:'visibility-12'}),[])
        assert.deepEqual(await ids({...query,search:'visibility-12',includeMembers:'true'}),[12])
      } finally { await db.query('ROLLBACK TO SAVEPOINT member_visibility') }
    })
    await t.test('initial inquiry notes use the entering staff snapshot for both fallback and previously saved notes', async () => {
      const publicNote = (await leadNotes(db,1,1)).find(note => note.source === 'inquiry_message')
      assert.equal(publicNote.authorName,'Alex Inquiry')
      assert.equal(publicNote.noteType,'user_comment')
      await db.query("UPDATE registrations SET submitted_by_name='Staff Who Entered Lead' WHERE id=1")
      const fallback = (await leadNotes(db,1,1)).find(note => note.source === 'inquiry_message')
      assert.equal(fallback.authorName,'Staff Who Entered Lead')
      assert.equal(fallback.noteType,'staff_note')
      await db.query(`INSERT INTO note(id,subject_type,subject_id,note_type,body,author_name,source)
        SELECT 11,'registration',id,'user_comment',message,'Alex Inquiry','inquiry_message' FROM registrations WHERE id=1`)
      const saved = (await leadNotes(db,1,1)).find(note => note.source === 'inquiry_message')
      assert.equal(saved.authorName,'Staff Who Entered Lead')
      assert.equal(saved.noteType,'staff_note')
    })
    await t.test('trial accounts stay leads and display only exact child/facility free trial bookings', async () => {
      await db.query(`
        INSERT INTO program(id,facility_id,display_name,name) VALUES(1,1,'Cyclones','Cyclones'),(2,2,'Foreign class','Foreign class');
        INSERT INTO scheduling_form VALUES(1,1,'Cyclones'),(2,2,'Foreign class');
        INSERT INTO member(id,facility_id,first_name,last_name) VALUES(40,1,'Trial','Contact');
        UPDATE member SET first_name='Listed',last_name='Child' WHERE id=2;
        UPDATE registrations SET member_id=40,inquiry_source='free_trial',lead_status='qualified',
          campers='[{"memberId":2,"firstName":"Listed"},{"firstName":"No trial"}]' WHERE id=1;
        INSERT INTO drop_in_registration VALUES(1,2,'free_trial',1,'2027-01-15','confirmed'),
          (2,2,'paid',1,'2027-01-16','confirmed'),(3,4,'free_trial',2,'2027-01-15','confirmed'),
          (4,2,'free_trial',2,'2027-01-17','confirmed');
      `)
      const trial = (await listLeads(db,1,{search:'alex@example.test'})).rows[0]
      assert.equal(trial.status,'qualified')
      assert.equal(trial.convertedMemberId,null)
      assert.deepEqual(trial.freeTrials,[{ id:1,memberId:2,childName:'Listed Child',childIndex:0,date:'2027-01-15',className:'Cyclones',status:'confirmed' }])
      assert.deepEqual(await ids({converted:'true',search:'alex@example.test'}),[])
      await db.query('UPDATE registrations SET converted_member_id=40 WHERE id=1')
      assert.deepEqual(await ids({search:'alex@example.test'}),[])
      assert.deepEqual(await ids({converted:'true',search:'alex@example.test'}),[1])
    })
  } finally { await db.query('ROLLBACK'); await db.end() }
})
