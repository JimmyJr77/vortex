import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { loadLeadConversionTrend } from '../leadConversionTrend.js'
import { validateRehearsalDatabaseUrl } from '../migrationAudit.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('lead timeline counts first family purchases, direct signups and scoped confirmed bookings in local time', { skip: !connectionString }, async () => {
  const schema = `lead_trend_${randomBytes(6).toString('hex')}`
  const admin = new pg.Pool({ connectionString })
  await admin.query(`CREATE SCHEMA ${schema}`)
  const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema} -c timezone=UTC` })
  try {
    await pool.query((await readFile(new URL('../../billing/__tests__/fixtures/turnover-schema.sql', import.meta.url), 'utf8')).replaceAll('public.', `${schema}.`))
    await pool.query(`CREATE TABLE registrations(id bigint PRIMARY KEY,facility_id bigint,first_name text,last_name text,email text,
      inquiry_source text,member_id bigint,converted_member_id bigint,trial_contact_member_id bigint,campers jsonb DEFAULT '[]',
      archived boolean DEFAULT FALSE,created_at timestamp,converted_at timestamptz,lead_status text,contacted boolean,
      follow_up boolean,first_contacted_at timestamptz,last_contacted_date date);
      CREATE TABLE account_invite(registration_id bigint,facility_id bigint,invite_type text);
      CREATE FUNCTION account_source_date(value text) RETURNS date LANGUAGE sql IMMUTABLE AS 'SELECT value::date';
      INSERT INTO facility(id,name,timezone) VALUES(1,'Local','America/New_York'),(2,'Foreign','America/New_York');
      INSERT INTO family(id,facility_id,family_name) VALUES(1,1,'Lead household'),(2,1,'Direct household'),(3,1,'Old member'),(4,2,'Foreign'),(5,1,'Unpaid'),(6,1,'Moved household');
      INSERT INTO member(id,facility_id,family_id,first_name,last_name) VALUES(1,1,1,'Lead','Parent'),(2,1,1,'Lead','Child'),
        (3,1,2,'Direct','Person'),(4,1,3,'Old','Member'),(5,2,4,'Foreign','Person'),(6,1,5,'Unpaid','Person');
      INSERT INTO family_member(family_id,member_id,is_active) VALUES(1,1,TRUE),(1,2,FALSE),(2,3,TRUE),(3,4,TRUE),(4,5,TRUE),(5,6,TRUE);
      INSERT INTO family_billing_account(id,family_id) VALUES(1,1),(2,2),(3,3),(4,4),(5,5);
      INSERT INTO additional_fee(id,facility_id,name,trigger_type,apply_basis) VALUES(1,1,'Annual membership','once_per_year','per_year');
      INSERT INTO additional_fee_redemption(fee_id,member_id,period_key,amount_cents,satisfied_at,ended_at) VALUES
        (1,2,'2027-11-03',8500,'2026-11-04T02:00:00Z',NULL),
        (1,1,'2027-11-05',8500,'2026-11-05T12:00:00Z',NULL),
        (1,3,'2027-11-04',8500,'2026-11-04T15:00:00Z',NULL),
        (1,4,'2021-11-03',8500,'2020-11-03T12:00:00Z','2021-11-03'),
        (1,4,'2027-11-04',8500,'2026-11-04T12:00:00Z',NULL),
        (1,5,'2027-11-04',8500,'2026-11-04T12:00:00Z',NULL),
        (1,6,'2027-11-04',8500,NULL,NULL);
      INSERT INTO registrations(id,facility_id,first_name,last_name,email,inquiry_source,member_id,created_at) VALUES
        (1,1,'Lead','Parent','parent@example.test','/',1,'2026-11-02 02:00:00'),
        (2,1,'Lead','Parent','parent@example.test','free_trial',1,'2026-11-02 12:00:00'),
        (3,1,'Lead','Parent','parent@example.test','/',1,'2026-11-02 16:00:00'),
        (4,2,'Foreign','Person','foreign@example.test','/',5,'2026-11-02 12:00:00'),
        (5,1,'Direct','Person','direct@example.test','/',3,'2026-11-10 12:00:00');
      INSERT INTO program(id,facility_id,category,name,display_name) VALUES
        (1,1,(enum_range(NULL::program_category))[1],'Local','Local'),(2,2,(enum_range(NULL::program_category))[1],'Foreign','Foreign');
      INSERT INTO scheduling_form(id,title,program_id) VALUES(1,'Local',1),(2,'Foreign',2);
      INSERT INTO scheduling_slot_group(id,form_id) VALUES(1,1),(2,2);
      INSERT INTO drop_in_registration(id,member_id,form_id,slot_group_id,class_date,first_name,last_name,email,benefit_type,status,created_at) VALUES
        (1,2,1,1,'2026-11-02','Lead','Child','parent@example.test','free_trial','attended','2026-11-02T13:00:00Z'),
        (2,2,1,1,'2026-11-03','Lead','Child','parent@example.test','paid','confirmed','2026-11-03T13:00:00Z'),
        (3,4,1,1,'2026-11-04','Old','Member','old@example.test','paid','confirmed','2026-11-03T13:00:00Z'),
        (4,3,1,1,'2026-11-08','Direct','Person','direct@example.test','free_trial','cancelled','2026-11-02T13:00:00Z'),
        (5,3,1,1,'2026-11-09','Direct','Person','direct@example.test','paid','payment_pending','2026-11-02T13:00:00Z'),
        (6,5,2,2,'2026-11-04','Foreign','Person','foreign@example.test','free_trial','confirmed','2026-11-03T13:00:00Z');
    `)
    const now = new Date('2026-11-27T02:00:00Z'), range = { start: '2026-11-01', end: '2026-11-26', interval: 'day' }
    const tracked = { connect: async () => {
      const db = await pool.connect()
      return { query: async (sql, values) => {
        if (sql.includes('new-admin:lead-conversion-trend')) assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on')
        return db.query(sql, values)
      }, release: () => db.release() }
    } }
    const data = await loadLeadConversionTrend(tracked, 1, range, now)
    assert.equal(data.today, '2026-11-26')
    assert.deepEqual(data.totals, { inquiries: 3, freeTrials: 1, dropIns: 1, directSignups: 1, conversions: 2 })
    assert.equal(data.buckets[0].inquiries, 1, 'legacy UTC inquiry timestamp becomes November 1 locally')
    assert.equal(data.buckets[2].conversions, 1, 'purchase near UTC midnight uses local day')
    const narrowed = await loadLeadConversionTrend(pool, 1, { ...range, start: '2026-11-04', end: '2026-11-04' }, now)
    assert.equal(narrowed.totals.directSignups, 1, 'later inquiry does not retroactively erase direct signup')
    assert.equal(narrowed.totals.conversions, 1, 'first purchase computed across all history, outside selected range')
    const foreign = await loadLeadConversionTrend(pool, 2, range, now)
    assert.deepEqual(foreign.totals, { inquiries: 1, freeTrials: 1, dropIns: 0, directSignups: 0, conversions: 1 })
    await pool.query(`INSERT INTO billing_charge(id,family_billing_account_id,member_id,description,source_type,source_id,amount_cents,collection_status,created_at)
      VALUES(1,1,2,'Original household membership','additional_fee','1:2:2027-11-03',8500,'paid','2026-11-04T02:00:00Z');
      UPDATE additional_fee_redemption SET billing_charge_id=1 WHERE member_id=2;
      UPDATE member SET family_id=6 WHERE id=2;
      INSERT INTO family_member(family_id,member_id,is_active) VALUES(6,2,TRUE);`)
    const moved = await loadLeadConversionTrend(pool, 1, range, now)
    assert.equal(moved.totals.conversions, 2, 'moving households preserves original billing ownership without creating a second conversion')
    assert.equal(moved.buckets[2].conversions, 1)
    await assert.rejects(loadLeadConversionTrend(pool, 1, { end: '2026-11-27' }, now), { statusCode: 400 })
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM family_billing_account')).rows[0].count, 5)
  } finally {
    await pool.end()
    await admin.query(`DROP SCHEMA ${schema} CASCADE`)
    await admin.end()
  }
})
