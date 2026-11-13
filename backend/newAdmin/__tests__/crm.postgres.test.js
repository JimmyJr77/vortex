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

test('CRM paginates the facility directory and computes activity from enrollments, paid fees and attended drop-ins', { skip: !connectionString }, async t => {
  const schema = `crm_${randomBytes(6).toString('hex')}`
  const admin = new pg.Pool({ connectionString })
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema}`, max: 2 })
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end() })
  const fixture = await readFile(new URL('../../billing/__tests__/fixtures/turnover-schema.sql', import.meta.url), 'utf8')
  await pool.query(fixture.replaceAll('public.', `"${schema}".`))
  await installSharedAccountRecords(pool)
  await pool.query(`
    ALTER TABLE scheduling_signup DROP CONSTRAINT scheduling_signup_status_check;
    ALTER TABLE scheduling_signup ADD CONSTRAINT scheduling_signup_status_check
      CHECK (status IN ('confirmed','waitlisted','cancelled','paused','completed','pending_setup'));
    ALTER TABLE app_user ADD COLUMN facility_id bigint, ADD COLUMN email text, ADD COLUMN phone text,
      ADD COLUMN username text, ADD COLUMN updated_at timestamptz DEFAULT now(), ADD COLUMN is_active boolean DEFAULT true;
    CREATE TABLE parent_guardian_authority(parent_member_id bigint, child_member_id bigint, has_legal_authority boolean);
    CREATE TABLE registrations(id bigint PRIMARY KEY, facility_id bigint, first_name text, last_name text,
      email text, phone text, lead_status text, archived boolean, member_id bigint, converted_member_id bigint,
      athlete_age int, child_ages int[], campers jsonb, submitter_role text, message text, admin_notes text,
      interest text, interests_array text[], class_types text[], inquiry_source text, contacted boolean, follow_up boolean,
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

  await t.test('person and family activity use independent scoped rules', async () => {
    const active = await listCrm(pool, 1, { status: 'active', sortBy: 'age', sortDir: 'desc' })
    assert.deepEqual(active.rows.map(row => row.id), [4, 3, 2])
    const inactiveInActiveFamily = await listCrm(pool, 1, { status: 'inactive', familyActive: 'true', source: 'member' })
    assert.deepEqual(new Set(inactiveInActiveFamily.rows.map(row => row.id)), new Set([1, 5]))
    const families = await listCrm(pool, 1, { familiesOnly: 'true', hasChildren: 'true', classSearch: 'Gymnastics', participation: 'current' })
    assert.equal(families.total, 1)
    assert.deepEqual(families.rows.map(row => [row.id, row.email, row.familyActive, row.childCount]), [[1, 'billing@example.test', true, 1]])
    assert.deepEqual((await listCrm(pool, 1, { source: 'member', participation: 'past', classSearch: 'Imported class' })).rows.map(row => row.id), [2])
  })

  await t.test('details load children, linked inquiry and class history independently of the directory', async () => {
    const lead = await loadCrmDetail(pool, 1, 'lead', 2)
    assert.deepEqual(lead.children.map(child => [child.name, child.age, child.gender]), [['Camper', 8, 'female']])
    assert.deepEqual(lead.classes.rows, [])
    const parent = await loadCrmDetail(pool, 1, 'member', 1)
    assert.equal(parent.inquiries[0].message, 'Original inquiry is retained')
    assert.deepEqual(parent.children.map(child => child.id), [2])
    const family = await loadCrmDetail(pool, 1, 'family', 1, { pageSize: 2 })
    const older = await loadCrmDetail(pool, 1, 'family', 1, { pageSize: 2, page: 2 })
    assert.equal(family.classes.total, 3)
    assert.deepEqual(older.classes.rows.map(row => [row.className, row.source]), [['Imported class', 'Jackrabbit']])
    assert.ok(family.people.some(row => row.id === 6 && row.isActive === false))
  })
})
