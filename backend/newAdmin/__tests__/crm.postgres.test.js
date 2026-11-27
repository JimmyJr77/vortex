import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { installSharedAccountRecords } from './sharedAccountFixture.js'
import { listCrm, loadCrmDetail } from '../crm.js'
import { validateRehearsalDatabaseUrl } from '../migrationAudit.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('CRM keeps membership/drop-in activity and current enrollment independent for people and families', { skip: !connectionString }, async t => {
  const schema = `crm_${randomBytes(6).toString('hex')}`
  const admin = new pg.Pool({ connectionString })
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema}`, max: 2 })
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end() })
  const fixture = await readFile(new URL('../../billing/__tests__/fixtures/turnover-schema.sql', import.meta.url), 'utf8')
  await pool.query(fixture.replaceAll('public.', `"${schema}".`))
  await installSharedAccountRecords(pool)
  await pool.query(await readFile(new URL('../../migrations/875_business_acquisition.sql', import.meta.url), 'utf8'))
  await pool.query(`
    ALTER TABLE scheduling_signup DROP CONSTRAINT scheduling_signup_status_check;
    ALTER TABLE scheduling_signup ADD CONSTRAINT scheduling_signup_status_check
      CHECK (status IN ('confirmed','waitlisted','cancelled','paused','completed','pending_setup'));
    ALTER TABLE app_user ADD COLUMN facility_id bigint, ADD COLUMN email text, ADD COLUMN phone text,
      ADD COLUMN username text, ADD COLUMN updated_at timestamptz DEFAULT now(), ADD COLUMN is_active boolean DEFAULT true, ADD COLUMN staff_access_active boolean DEFAULT true, ADD COLUMN member_portal_access_active boolean DEFAULT true;
    CREATE TABLE parent_guardian_authority(parent_member_id bigint, child_member_id bigint, has_legal_authority boolean);
    CREATE TABLE registrations(id bigint PRIMARY KEY, facility_id bigint, first_name text, last_name text,
      email text, phone text, lead_status text, archived boolean, member_id bigint, converted_member_id bigint,
      athlete_age int, child_ages int[], campers jsonb, submitter_role text, message text, admin_notes text,
      interest text, interests_array text[], class_types text[], inquiry_source text, contacted boolean, follow_up boolean,
      utm_source text, utm_medium text, utm_campaign text, landing_page text,
      created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    INSERT INTO facility(id,name,timezone) VALUES (1,'CRM fixture','America/New_York'),(2,'Other facility','America/New_York');
    INSERT INTO family(id,facility_id,family_name) VALUES (1,1,'First Household'),(2,1,'Second Household'),(3,2,'Foreign Family');
    INSERT INTO app_user(id,facility_id,full_name,email,username) VALUES
      (20,1,'Linked Parent','parent@example.test','parent'),(21,1,'Staff Example','staff@example.test','staff'),
      (22,2,'Foreign Staff','foreign-staff@example.test','foreign-staff');
    INSERT INTO member(id,facility_id,family_id,first_name,last_name,date_of_birth,email,phone,app_user_id,is_active) VALUES
      (1,1,1,'Linked','Parent',(current_date - interval '40 years')::date,'parent@example.test','(202) 555-0101',20,true),
      (2,1,1,'Young','Athlete',(current_date - interval '10 years')::date,NULL,NULL,NULL,true),
      (3,1,2,'Annual','Athlete',(current_date - interval '12 years')::date,NULL,NULL,NULL,true),
      (4,1,2,'Recent','Athlete',(current_date - interval '14 years')::date,NULL,NULL,NULL,true),
      (5,1,2,'Unpaid','Athlete',(current_date - interval '15 years')::date,NULL,NULL,NULL,true),
      (6,1,1,'Former','Athlete',(current_date - interval '20 years')::date,NULL,NULL,NULL,false),
      (7,2,3,'Foreign','Athlete',(current_date - interval '10 years')::date,NULL,NULL,NULL,true),
      (8,1,NULL,'No','Household',NULL,NULL,NULL,NULL,true);
    INSERT INTO family_member(family_id,member_id,is_active) VALUES (1,1,true),(1,2,true),(1,6,false),(2,3,true),(2,4,true),(2,5,true),(3,7,true);
    INSERT INTO family_billing_account(id,family_id,payer_member_id,billing_email) VALUES (1,1,1,'billing@example.test');
    INSERT INTO registrations(id,facility_id,first_name,last_name,email,lead_status,converted_member_id,campers,child_ages,message) VALUES
      (1,1,'Linked','Parent','parent@example.test','converted',1,'[]',NULL,'Original inquiry is retained'),
      (2,1,'Open','Prospect','open@example.test','qualified',NULL,'[{"firstName":"Camper","gender":"female"}]',ARRAY[8],NULL),
      (3,2,'Foreign','Prospect','foreign-lead@example.test','new',NULL,'[]',NULL,NULL);
    INSERT INTO business_acquisition(record_kind,record_id,source,medium,campaign,referrer_host,landing_path)
      VALUES ('inquiry',2,'google','cpc','fit_and_flip','google.com','/fit-and-flip');
    INSERT INTO scheduling_form(id,title) VALUES (1,'Gymnastics'),(2,'Evening Class');
    INSERT INTO scheduling_signup(id,form_id,member_id,status,enrollment_start_date) VALUES
      (1,1,2,'confirmed',current_date-1),(2,1,2,'cancelled',current_date-365),
      (3,2,5,'pending_setup',current_date-1),(4,1,7,'confirmed',current_date-1);
    INSERT INTO jackrabbit_history_record(facility_id,organization_id,record_kind,source_id,family_id,member_id,occurred_on,source_data)
      VALUES (1,'fixture','enrollment','old-class',1,2,current_date-730,'{"Class":"Imported class"}');
    INSERT INTO drop_in_registration(id,member_id,form_id,slot_group_id,class_date,first_name,last_name,email,status)
      VALUES (1,4,1,1,current_date-5,'Recent','Athlete','recent@example.test','attended'),
        (2,5,1,1,current_date-1,'Unpaid','Athlete','unpaid@example.test','payment_pending');
    INSERT INTO additional_fee(id,facility_id,name,amount_cents,apply_basis,trigger_type) VALUES (1,1,'Annual fee',8500,'per_year','once_per_year');
    INSERT INTO additional_fee_redemption(fee_id,member_id,period_key,amount_cents,satisfied_at)
      VALUES (1,3,(current_date + interval '1 year')::date::text,8500,now() - interval '1 day'),
        (1,5,(current_date + interval '1 year')::date::text,8500,NULL);
  `)

  await t.test('all person sources are scoped, converted people deduplicate and offset paging is stable', async () => {
    const first = await listCrm(pool, 1, { pageSize: 4 })
    const second = await listCrm(pool, 1, { pageSize: 4, page: 2 })
    const third = await listCrm(pool, 1, { pageSize: 4, page: 3 })
    assert.equal(first.total, 9)
    assert.equal(first.totalPages, 3)
    const people = [...first.rows, ...second.rows, ...third.rows]
    assert.equal(new Set(people.map(row => `${row.kind}:${row.id}`)).size, 9)
    assert.deepEqual(people.filter(row => row.kind === 'lead').map(row => row.id), [2])
    assert.deepEqual(people.filter(row => row.kind === 'staff').map(row => row.id), [21])
    assert.ok(people.every(row => !row.name.startsWith('Foreign')))
    assert.deepEqual((await listCrm(pool, 1, { page: 30 })).rows, [])
    assert.equal((await listCrm(pool, 1, { page: 30 })).total, 9)
    assert.deepEqual((await listCrm(pool, 1, { search: '2025550101', source: 'member', minAge: 30 })).rows.map(row => row.id), [1])
    assert.deepEqual((await listCrm(pool, 1, { search: 'Camper', source: 'lead' })).rows.map(row => row.id), [2])
    await assert.rejects(listCrm(pool, 1, { sortBy: 'invalid' }), { statusCode: 400 })
    await assert.rejects(loadCrmDetail(pool, 1, 'member', 7), { statusCode: 404 })
  })

  await t.test('activity and enrollment filters are independent for people and families', async () => {
    const active = await listCrm(pool, 1, { status: 'active', sortBy: 'age', sortDir: 'desc' })
    assert.deepEqual(active.rows.map(row => [row.id,row.enrolled]), [[4,false],[3,false]])
    const inactiveInActiveFamily = await listCrm(pool, 1, { status: 'inactive', familyActive: 'true', source: 'member' })
    assert.deepEqual(new Set(inactiveInActiveFamily.rows.map(row => row.id)), new Set([5]))
    assert.deepEqual((await listCrm(pool,1,{source:'member',enrolled:'true'})).rows.map(row=>[row.id,row.status,row.familyActive,row.familyEnrolled]),
      [[2,'inactive',false,true]])
    assert.deepEqual((await listCrm(pool,1,{source:'member',familyEnrolled:'true',enrolled:'false'})).rows.map(row=>row.id),[1])
    assert.deepEqual((await listCrm(pool,1,{source:'member',status:'active',enrolled:'true'})).rows,[])
    const notEnrolled = await listCrm(pool,1,{source:'member',enrolled:'false',sortBy:'enrolled'})
    assert.equal(notEnrolled.total,6)
    assert.ok(notEnrolled.rows.every(row=>!row.enrolled))
    const families = await listCrm(pool, 1, { familiesOnly: 'true', hasChildren: 'true', classSearch: 'Gymnastics', participation: 'current' })
    assert.equal(families.total, 1)
    assert.deepEqual(families.rows.map(row => [row.id, row.email, row.familyActive, row.familyEnrolled, row.enrolled, row.childCount]),
      [[1, 'billing@example.test', false, true, true, 1]])
    assert.deepEqual((await listCrm(pool,1,{familiesOnly:'true',familyActive:'true',familyEnrolled:'false'})).rows.map(row=>row.id),[2])
    assert.deepEqual((await listCrm(pool,1,{familiesOnly:'true',familyActive:'false',familyEnrolled:'true'})).rows.map(row=>row.id),[1])
    assert.deepEqual((await listCrm(pool,1,{source:'member',sortBy:'enrolled',sortDir:'desc',pageSize:1})).rows.map(row=>row.id),[2])
    assert.deepEqual((await listCrm(pool,1,{familiesOnly:'true',sortBy:'familyEnrolled',sortDir:'desc'})).rows.map(row=>row.id),[1,2])
    assert.deepEqual((await listCrm(pool, 1, { source: 'member', participation: 'past', classSearch: 'Imported class' })).rows.map(row => row.id), [2])
    for (const query of [{enrolled:'yes'},{familyEnrolled:'yes'}]) await assert.rejects(listCrm(pool,1,query),{statusCode:400})
  })

  await t.test('family activity requires a child while family enrollment accepts adult students and preserves record lifecycle separately', async () => {
    const db = await pool.connect()
    try {
      await db.query('BEGIN')
      await db.query(`
        INSERT INTO family(id,facility_id,family_name) SELECT id,1,'Matrix family '||id FROM generate_series(10,16) id;
        INSERT INTO member(id,facility_id,family_id,first_name,last_name,date_of_birth,is_active) VALUES
          (100,1,10,'Adult','Student',(CURRENT_DATE-INTERVAL '40 years')::date,TRUE),
          (101,1,10,'Child','Prospect',(CURRENT_DATE-INTERVAL '10 years')::date,TRUE),
          (102,1,11,'Child','Both',(CURRENT_DATE-INTERVAL '10 years')::date,TRUE),
          (103,1,12,'Archived','Child',(CURRENT_DATE-INTERVAL '10 years')::date,FALSE),
          (104,1,13,'Free','Trial',(CURRENT_DATE-INTERVAL '10 years')::date,TRUE),
          (105,1,13,'Future','Student',(CURRENT_DATE-INTERVAL '10 years')::date,TRUE),
          (106,1,13,'Paused','Student',(CURRENT_DATE-INTERVAL '10 years')::date,TRUE),
          (107,1,14,'Expired','Membership',(CURRENT_DATE-INTERVAL '10 years')::date,TRUE),
          (108,1,14,'Future','Membership',(CURRENT_DATE-INTERVAL '10 years')::date,TRUE),
          (109,1,14,'Unpaid','Membership',(CURRENT_DATE-INTERVAL '10 years')::date,TRUE),
          (110,1,15,'Recent','Dropin',(CURRENT_DATE-INTERVAL '10 years')::date,TRUE),
          (111,1,15,'Cancelled','Dropin',(CURRENT_DATE-INTERVAL '10 years')::date,TRUE),
          (112,1,15,'Old','Dropin',(CURRENT_DATE-INTERVAL '10 years')::date,TRUE),
          (113,1,16,'Former','Household',(CURRENT_DATE-INTERVAL '10 years')::date,TRUE),
          (114,1,13,'Future','Dropin',(CURRENT_DATE-INTERVAL '10 years')::date,TRUE);
        INSERT INTO family_member(family_id,member_id,is_active) SELECT family_id,id,id<>113 FROM member WHERE id BETWEEN 100 AND 114;
        UPDATE family SET archived=TRUE WHERE id=12;
        INSERT INTO scheduling_signup(id,form_id,member_id,status,enrollment_start_date) VALUES
          (100,1,100,'confirmed',CURRENT_DATE-1),(102,1,102,'confirmed',CURRENT_DATE-1),
          (103,1,103,'confirmed',CURRENT_DATE-1),(105,1,105,'confirmed',CURRENT_DATE+1),
          (106,1,106,'confirmed',CURRENT_DATE-1),(113,1,113,'confirmed',CURRENT_DATE-1);
        UPDATE scheduling_signup SET pause_effective_date=CURRENT_DATE WHERE id=106;
        INSERT INTO additional_fee_redemption(fee_id,member_id,period_key,amount_cents,satisfied_at)
          SELECT 1,id,(CURRENT_DATE+365)::text,8500,now()-INTERVAL '1 day' FROM member WHERE id IN (100,102,103,113);
        INSERT INTO additional_fee_redemption(fee_id,member_id,period_key,amount_cents,satisfied_at) VALUES
          (1,107,(CURRENT_DATE-1)::text,8500,now()-INTERVAL '1 year'),
          (1,108,(CURRENT_DATE+366)::text,8500,now()+INTERVAL '1 day'),
          (1,109,(CURRENT_DATE+365)::text,8500,NULL);
        INSERT INTO drop_in_registration(id,member_id,form_id,slot_group_id,class_date,first_name,last_name,email,status,benefit_type) VALUES
          (100,104,1,1,CURRENT_DATE-1,'Free','Trial','trial@example.test','attended','free_trial'),
          (101,110,1,1,CURRENT_DATE-1,'Recent','Dropin','recent@example.test','confirmed','paid'),
          (102,111,1,1,CURRENT_DATE-1,'Cancelled','Dropin','cancelled@example.test','cancelled','paid'),
          (103,112,1,1,(CURRENT_DATE-INTERVAL '2 months')::date-1,'Old','Dropin','old@example.test','attended','paid'),
          (104,114,1,1,CURRENT_DATE+1,'Future','Dropin','future@example.test','confirmed','paid');
      `)
      const families = await listCrm(db,1,{familiesOnly:'true',search:'Matrix family',sortBy:'id'})
      assert.deepEqual(families.rows.map(row=>[row.id,row.status,row.enrolled,row.familyActive,row.familyEnrolled,row.archived]),[
        [10,'inactive',true,false,true,false],
        [11,'active',true,true,true,false],
        [12,'active',true,true,true,true],
        [13,'inactive',false,false,false,false],
        [14,'inactive',false,false,false,false],
        [15,'active',false,true,false,false],
        [16,'inactive',false,false,false,false],
      ])
      const members = await listCrm(db,1,{source:'member',search:'Matrix family',sortBy:'id'})
      assert.deepEqual(members.rows.map(row=>[row.id,row.status,row.enrolled]),[
        [100,'active',true],[101,'inactive',false],[102,'active',true],[103,'active',true],
        [104,'inactive',false],[105,'inactive',false],[106,'inactive',false],[107,'inactive',false],
        [108,'inactive',false],[109,'inactive',false],[110,'active',false],[111,'inactive',false],
        [112,'inactive',false],[114,'inactive',false],
      ])
      const former = await loadCrmDetail(db,1,'member',113)
      assert.deepEqual([former.person.status,former.person.enrolled,former.person.familyId,former.person.familyActive,former.person.familyEnrolled],
        ['active',true,null,false,false])
      const archived = await loadCrmDetail(db,1,'family',12)
      assert.deepEqual(archived.people.map(person=>[person.id,person.isActive,person.isEnrolled,person.archived]),[[103,true,true,true]])
      const both = await loadCrmDetail(db,1,'family',11)
      assert.deepEqual(both.children.map(child=>[child.id,child.isActive,child.isEnrolled,child.archived]),[[102,true,true,false]])
      assert.equal((await listCrm(db,2,{source:'member',search:'Matrix family'})).total,0)
    } finally {
      await db.query('ROLLBACK')
      db.release()
    }
  })

  await t.test('current enrollment respects effective form, group and offering windows as well as the signup start', async () => {
    const db = await pool.connect()
    try {
      await db.query('BEGIN')
      await db.query(`
        INSERT INTO family(id,facility_id,family_name) VALUES(200,1,'Program window family');
        INSERT INTO member(id,facility_id,family_id,first_name,last_name,date_of_birth)
          SELECT id,1,200,'Program window',id::text,(CURRENT_DATE-INTERVAL '10 years')::date FROM generate_series(200,208) id;
        INSERT INTO family_member(family_id,member_id,is_active) SELECT 200,id,TRUE FROM member WHERE id BETWEEN 200 AND 208;
        INSERT INTO scheduling_form(id,title,start_date) SELECT id,'Program window '||id,CURRENT_DATE-10 FROM generate_series(200,208) id;
        UPDATE scheduling_form SET start_date=CURRENT_DATE+1 WHERE id IN (200,207);
        UPDATE scheduling_form SET end_date=CURRENT_DATE WHERE id=204;
        UPDATE scheduling_form SET end_date=CURRENT_DATE-1 WHERE id=205;
        INSERT INTO scheduling_slot_group(id,form_id) SELECT id,id FROM generate_series(200,207) id;
        UPDATE scheduling_slot_group SET active_start=CURRENT_DATE+1 WHERE id=201;
        INSERT INTO scheduling_offering(id,form_id,start_date,end_date) VALUES
          (202,202,CURRENT_DATE+1,CURRENT_DATE+30),
          (203,203,CURRENT_DATE-10,CURRENT_DATE-1),
          (206,206,CURRENT_DATE-10,CURRENT_DATE-1),
          (207,207,CURRENT_DATE-10,CURRENT_DATE+10);
        UPDATE scheduling_slot_group SET offering_id=id,inherits_offering_dates=TRUE WHERE id IN (202,206,207);
        UPDATE scheduling_slot_group SET offering_id=id,inherits_offering_dates=FALSE,
          active_start=CURRENT_DATE-2,active_end=CURRENT_DATE+2 WHERE id=203;
        INSERT INTO scheduling_signup(id,member_id,form_id,slot_group_id,status,enrollment_start_date)
          SELECT id,id,id,id,'confirmed',CURRENT_DATE-5 FROM generate_series(200,207) id;
        INSERT INTO jackrabbit_history_record(facility_id,organization_id,record_kind,source_id,family_id,member_id,occurred_on,source_data)
          VALUES(1,'window-fixture','enrollment','history-only-window',200,208,CURRENT_DATE-5,'{"Class":"History only","Type":"Enrolled"}');
      `)
      const directory = await listCrm(db,1,{source:'member',search:'Program window',sortBy:'id'})
      assert.deepEqual(directory.rows.map(row=>[row.id,row.enrolled]),[
        [200,false],[201,false],[202,false],[203,true],[204,true],[205,false],[206,false],[207,true],[208,false],
      ])
      assert.deepEqual((await listCrm(db,1,{source:'member',search:'Program window',enrolled:'true',sortBy:'id'})).rows.map(row=>row.id),[203,204,207])
      const future = await loadCrmDetail(db,1,'member',202)
      assert.equal(future.person.enrolled,false)
      assert.equal(future.people.find(person=>person.id===202).isEnrolled,false)
      assert.equal(future.person.familyEnrolled,true)
      assert.deepEqual((await db.query('SELECT historical_only FROM account_enrollment_current WHERE record_member_id=208')).rows,[{historical_only:true}])
    } finally {
      await db.query('ROLLBACK')
      db.release()
    }
  })

  await t.test('details load children, linked inquiry and class history independently of the directory', async () => {
    const lead = await loadCrmDetail(pool, 1, 'lead', 2)
    assert.deepEqual(lead.inquiries[0].acquisition, { source: 'google', medium: 'cpc', campaign: 'fit_and_flip', referrerHost: 'google.com', landingPath: '/fit-and-flip', direct: false })
    assert.deepEqual(lead.children.map(child => [child.name, child.age, child.gender]), [['Camper', 8, 'female']])
    assert.deepEqual(lead.classes.rows, [])
    const parent = await loadCrmDetail(pool, 1, 'member', 1)
    assert.equal(parent.inquiries[0].message, 'Original inquiry is retained')
    assert.deepEqual(parent.children.map(child => child.id), [2])
    assert.deepEqual(parent.children.map(child=>[child.id,child.isActive,child.isEnrolled,child.archived]),[[2,false,true,false]])
    const annual = await loadCrmDetail(pool,1,'member',3)
    assert.deepEqual(annual.people.filter(person=>person.id===3).map(person=>[person.isActive,person.isEnrolled,person.archived]),[[true,false,false]])
    assert.deepEqual(annual.children.find(person=>person.id===4).isActive,true)
    const family = await loadCrmDetail(pool, 1, 'family', 1, { pageSize: 2 })
    const older = await loadCrmDetail(pool, 1, 'family', 1, { pageSize: 2, page: 2 })
    assert.equal(family.classes.total, 3)
    assert.deepEqual(older.classes.rows.map(row => [row.className, row.source]), [['Imported class', 'Jackrabbit']])
    assert.ok(family.people.some(row => row.id === 6 && row.isActive === false))
  })

  await t.test('member contact matches appear on the member record and stay out of the prospect directory', async () => {
    await pool.query(`INSERT INTO registrations(id,facility_id,first_name,last_name,email,lead_status,message) VALUES
      (4,1,'Returning','Contact','PARENT@example.test','new','Member inquiry'),
      (5,2,'Other','Facility','parent@example.test','new','Out of facility'),
      (6,1,'Open','Contact','foreign-staff@example.test','new','Foreign email is not a member match')`)
    const prospects = await listCrm(pool, 1, { source: 'lead' })
    assert.deepEqual(prospects.rows.map(row => row.id).sort(), [2,6])
    const member = await loadCrmDetail(pool, 1, 'member', 1)
    assert.deepEqual(member.inquiries.map(inquiry => [inquiry.id, inquiry.memberInquiry]), [[4,true],[1,true]])
  })
  await t.test('archives retain converted and email-matched inquiries alongside archived people', async () => {
    await pool.query('UPDATE registrations SET archived=TRUE WHERE id IN (1,4,5)')
    const archived = await listCrm(pool, 1, { record: 'archived', source: 'member,lead' })
    assert.deepEqual(archived.rows.filter(row => row.kind === 'lead').map(row => row.id).sort(), [1,4])
    assert.ok(archived.rows.some(row => row.kind === 'member' && row.id === 6))
    assert.ok(archived.rows.every(row => row.archived))
    const converted = await loadCrmDetail(pool, 1, 'lead', 1)
    assert.deepEqual(converted.linkedMember, { id: 1, name: 'Linked Parent', archived: false })
    const contactOnly = await loadCrmDetail(pool, 1, 'lead', 4)
    assert.equal(contactOnly.linkedMember, null)
    // A malformed cross-facility pointer never exposes the foreign member.
    await pool.query('UPDATE registrations SET converted_member_id=7 WHERE id=4')
    assert.equal((await loadCrmDetail(pool, 1, 'lead', 4)).linkedMember, null)
    await pool.query('UPDATE registrations SET converted_member_id=NULL WHERE id=4')
    const search = await listCrm(pool, 1, { record: 'archived', source: 'member,lead', search: 'Returning' })
    assert.deepEqual(search.rows.map(row => [row.kind, row.id]), [['lead',4]])
    await pool.query('UPDATE registrations SET archived=FALSE WHERE id=4')
    assert.equal((await listCrm(pool, 1, { record: 'archived', source: 'lead', search: 'Returning' })).total, 0)
  })

  await t.test('archive view includes unlinked logins with both portals disabled', async () => {
    await pool.query('UPDATE app_user SET staff_access_active=FALSE,member_portal_access_active=FALSE WHERE id=21')
    const archived = await listCrm(pool, 1, { record: 'archived', source: 'staff' })
    assert.deepEqual(archived.rows.map(row => [row.id, row.archived]), [[21,true]])
    assert.equal((await listCrm(pool, 1, { record: 'active', source: 'staff' })).rows.some(row => row.id === 21), false)
  })

})
