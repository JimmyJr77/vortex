import { installSharedAccountRecords } from './sharedAccountFixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import pg from 'pg'
import { loadFamilyWorkspace, listFamilies, withFamilyRead } from '../familyWorkspace.js'
import { validateRehearsalDatabaseUrl } from '../migrationAudit.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('family workspace preserves ledger/history, scopes families, paginates without gaps and batches people', { skip: !connectionString }, async t => {
  const schema = `family_workspace_${crypto.randomBytes(6).toString('hex')}`
  const admin = new pg.Pool({ connectionString })
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema}`, max: 2 })
  const queries = []
  const tracked = { connect: async () => {
    const client = await pool.connect()
    return { query: (sql, values) => { queries.push(sql); return client.query(sql, values) }, release: () => client.release() }
  } }
  try {
    const fixture = await fs.readFile(new URL('../../billing/__tests__/fixtures/turnover-schema.sql', import.meta.url), 'utf8')
    await pool.query(fixture.replaceAll('public.', `"${schema}".`))
    await installSharedAccountRecords(pool)
    await pool.query(`
      CREATE TABLE parent_guardian_authority(parent_member_id bigint,child_member_id bigint,has_legal_authority boolean);
      CREATE TABLE registrations(id int PRIMARY KEY,first_name text,last_name text,member_id bigint,lead_status text,created_at timestamp,
        first_contacted_at timestamptz,follow_up boolean,archived boolean,message text,admin_notes text);
      CREATE TABLE note(id bigint PRIMARY KEY,subject_type text,subject_id bigint,author_name text,body text,is_deleted boolean,created_at timestamptz);
      INSERT INTO facility(id,name) VALUES(1,'Workspace fixture'),(2,'Other facility');
      INSERT INTO family(id,facility_id,family_name) VALUES(1,1,'Fixture Family'),(2,2,'Other Family'),(3,1,'No Billing Family');
      INSERT INTO member(id,facility_id,family_id,first_name,last_name) VALUES
        (1,1,1,'Parent','Fixture'),(2,1,1,'Child','Fixture'),(3,1,1,'Former','Fixture'),(4,2,2,'Foreign','Fixture');
      INSERT INTO family_member(family_id,member_id,is_active) VALUES(1,1,TRUE),(1,2,TRUE),(1,3,FALSE),(2,4,TRUE);
      INSERT INTO parent_guardian_authority VALUES(1,2,TRUE);
      INSERT INTO family_billing_account(id,family_id,payer_member_id,stripe_customer_id) VALUES(1,1,1,'cus_fixture');
      INSERT INTO scheduling_form(id,title) VALUES(1,'Fixture Gymnastics');
      INSERT INTO scheduling_slot_group(id,form_id,max_participants) VALUES(1,1,12);
      INSERT INTO scheduling_time_slot(id,form_id,slot_group_id,day_of_week,start_time,end_time) VALUES(1,1,1,1,'16:00','17:00');
      INSERT INTO scheduling_signup(id,form_id,slot_group_id,member_id,status,enrollment_start_date) VALUES
        (1,1,1,2,'confirmed','2020-01-01'),(2,1,1,3,'confirmed','2020-01-01'),(3,1,1,2,'cancelled','2020-01-01');
      INSERT INTO billing_charge(id,family_billing_account_id,description,amount_cents) VALUES(1,1,'Fixture tuition',15000);
      INSERT INTO billing_payment(id,family_billing_account_id,amount_cents,method) VALUES(1,1,5000,'cash');
      INSERT INTO billing_payment_application(billing_payment_id,billing_charge_id,amount_cents) VALUES(1,1,5000);
      INSERT INTO registrations VALUES(1,'Parent','Fixture',1,'qualified','2020-01-01',NULL,TRUE,FALSE,'Original inquiry','Original follow-up');
      INSERT INTO note VALUES(1,'member',2,'Staff','Original note',FALSE,'2020-01-01'),
        (2,'family',1,'Staff','Household correspondence',FALSE,'2020-01-01'),
        (3,'family',2,'Staff','Other household correspondence',FALSE,'2020-01-01');
      INSERT INTO jackrabbit_history_record(facility_id,organization_id,record_kind,source_id,family_id,member_id,occurred_on,source_data)
        SELECT 1,'fixture','enrollment',i::text,1,2,'2019-01-01','{"Class":"Imported class"}'::jsonb FROM generate_series(1,30) i;
      INSERT INTO jackrabbit_history_record(facility_id,organization_id,record_kind,source_id,family_id,member_id,amount_cents,source_data)
        VALUES(1,'fixture','transaction','payment',1,2,-3000,'{"Type":"Payment"}');
      INSERT INTO billing_account_activity(family_billing_account_id,event_type,summary) VALUES
        (1,'jackrabbit_transaction','Duplicate display copy'),(1,'payment_recorded','Cash payment');
    `)
    const fingerprint = async () => (await pool.query(`SELECT md5(string_agg(value::text,'|' ORDER BY value::text)) AS hash FROM (
      SELECT to_jsonb(t) AS value FROM billing_charge t UNION ALL SELECT to_jsonb(t) FROM billing_payment t
      UNION ALL SELECT to_jsonb(t) FROM billing_payment_application t UNION ALL SELECT to_jsonb(t) FROM billing_subscription t
      UNION ALL SELECT to_jsonb(t) FROM jackrabbit_history_record t UNION ALL SELECT to_jsonb(t) FROM scheduling_signup t
      UNION ALL SELECT to_jsonb(t) FROM billing_account_activity t UNION ALL SELECT to_jsonb(t) FROM family_billing_account t) facts`)).rows[0].hash
    const before = await fingerprint()
    let first
    await t.test('read-only protection and family/member scope', async () => {
      await assert.rejects(withFamilyRead(pool, db => db.query("UPDATE family SET family_name='forbidden'")), error => error.code === '25006')
      await assert.rejects(loadFamilyWorkspace(pool, { facilityId: 2, familyId: 1 }), error => error.statusCode === 404)
      await assert.rejects(loadFamilyWorkspace(pool, { facilityId: 1, memberId: 4 }), error => error.statusCode === 404)
      await assert.rejects(loadFamilyWorkspace(pool, { facilityId: 1, memberId: 3 }), error => error.statusCode === 409)
      const directory = await listFamilies(pool, 1)
      assert.deepEqual(directory.rows.map(r => r.id), [1, 3])
      assert.equal(directory.rows[0].peopleCount, 2)
    })
    await t.test('one snapshot includes canonical balances and history without creating missing accounts', async () => {
      first = await loadFamilyWorkspace(tracked, { facilityId: 1, memberId: 2, canViewBilling: true })
      assert.equal(first.family.id, 1)
      assert.deepEqual(first.people.find(p => p.id === 1).guardianFor, [2])
      assert.equal(first.people.find(p => p.id === 3).currentHousehold, false)
      assert.deepEqual(first.participation.map(r => r.id), [1])
      assert.equal(first.financial.balanceCents, 10000)
      assert.equal(first.financial.outstandingBalanceCents, 10000)
      assert.equal(first.financial.paymentMethod.syncStatus, 'pending')
      assert.equal(first.leads.rows[0].linkType, 'contact_match')
      assert.equal((await loadFamilyWorkspace(pool, { facilityId: 1, familyId: 3, canViewBilling: true })).financial, null)
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM family_billing_account')).rows[0].n, 1)
    })
    await t.test('tied and unknown dates paginate every source event exactly once, hiding financial rows without permission', async () => {
      const all = [...first.history.rows]
      let cursor = first.history.nextCursor
      while (cursor) {
        const page = await loadFamilyWorkspace(pool, { facilityId: 1, familyId: 1, canViewBilling: true, historyCursor: cursor })
        all.push(...page.rows); cursor = page.nextCursor
      }
      assert.equal(new Set(all.map(r => r.key)).size, all.length)
      assert.equal(all.filter(r => r.source === 'Jackrabbit').length, 31)
      assert.equal(all.filter(r => r.kind === 'account_activity').length, 1)
      assert.ok(all.some(r => r.summary.includes('Original note')))
      assert.deepEqual(all.filter(r => r.key === 'note:2').map(r => [r.memberId, r.summary]), [[null, 'Household correspondence']])
      assert.ok(all.every(r => r.key !== 'note:3'))
      assert.ok(all.some(r => r.summary.includes('Original inquiry')))
      assert.equal(all.at(-1).date, null)
      const restricted = await loadFamilyWorkspace(pool, { facilityId: 1, familyId: 1 })
      assert.equal(restricted.financial, null)
      const history = [...restricted.history.rows]
      cursor = restricted.history.nextCursor
      while (cursor) {
        const page = await loadFamilyWorkspace(pool, { facilityId: 1, familyId: 1, historyCursor: cursor })
        history.push(...page.rows); cursor = page.nextCursor
      }
      assert.ok(history.every(r => r.amountCents === null && !['transaction','account_activity'].includes(r.kind)))
      assert.equal(history.filter(r => r.source === 'Jackrabbit').length, 30)
    })
    await t.test('reads preserve ledger and history byte-for-byte and query count does not grow per person', async () => {
      assert.equal(await fingerprint(), before)
      queries.length = 0
      await loadFamilyWorkspace(tracked, { facilityId: 1, familyId: 1, canViewBilling: true })
      const count = queries.length
      await pool.query(`INSERT INTO member(id,facility_id,family_id,first_name,last_name) SELECT i,1,1,'Extra',i::text FROM generate_series(100,149) i;
        INSERT INTO family_member(family_id,member_id,is_active) SELECT 1,i,TRUE FROM generate_series(100,149) i`)
      queries.length = 0
      const larger = await loadFamilyWorkspace(tracked, { facilityId: 1, familyId: 1, canViewBilling: true })
      assert.equal(larger.people.length, 53)
      assert.equal(queries.length, count)
      assert.equal(queries.filter(sql => sql.includes('family-workspace:participation')).length, 1)
    })
    await t.test('explicit lead conversion metadata is honored when available', async () => {
      await pool.query('ALTER TABLE registrations ADD COLUMN facility_id bigint, ADD COLUMN converted_member_id bigint')
      await pool.query('UPDATE registrations SET facility_id=1,converted_member_id=2 WHERE id=1')
      const result = await loadFamilyWorkspace(pool, { facilityId: 1, familyId: 1 })
      assert.equal(result.leads.rows[0].linkType, 'explicit_conversion')
    })
  } finally {
    await pool.end()
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`)
    await admin.end()
  }
})
