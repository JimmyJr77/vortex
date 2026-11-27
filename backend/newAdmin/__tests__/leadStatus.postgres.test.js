import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { leadMetadataJoin, leadStatusMetadata } from '../leadStatus.js'
import { validateRehearsalDatabaseUrl } from '../migrationAudit.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('lead metadata retains provenance, booking-time membership and verified conversion dates', { skip: !connectionString }, async t => {
  const schema = `lead_status_${randomBytes(6).toString('hex')}`
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    await db.query(`CREATE SCHEMA ${schema}`)
    await db.query(`SET LOCAL search_path=${schema}`)
    await db.query(`
      CREATE TABLE member(id bigint PRIMARY KEY,facility_id bigint,family_id bigint,is_active boolean DEFAULT TRUE);
      CREATE TABLE family(id bigint PRIMARY KEY,facility_id bigint);
      CREATE TABLE family_member(family_id bigint,member_id bigint,is_active boolean);
      CREATE TABLE registrations(id bigint PRIMARY KEY,facility_id bigint,member_id bigint,converted_member_id bigint,
        trial_contact_member_id bigint,lead_status text,inquiry_source text,campers jsonb,converted_at timestamptz,
        related_registration_ids bigint[],has_inquiry_provenance boolean,has_trial_provenance boolean,is_converted boolean);
      CREATE TABLE account_invite(id bigint,facility_id bigint,registration_id bigint,invite_type text,used_at timestamptz,pending_payload jsonb);
      CREATE TABLE program(id bigint,facility_id bigint);
      CREATE TABLE scheduling_form(id bigint,program_id bigint);
      CREATE TABLE drop_in_registration(id bigint,member_id bigint,form_id bigint,class_date date,status text,benefit_type text);
      CREATE TABLE account_enrollment_current(id bigint,record_source text,record_member_id bigint,record_facility_id bigint,status text,cancel_effective_date date);
      CREATE TABLE billing_account_activity(signup_id bigint,member_id bigint,event_type text,after_value jsonb,details jsonb);
      CREATE TABLE enrollment_action(signup_id bigint,requested_status text,status text,effective_date date);
      CREATE TABLE additional_fee(id bigint,trigger_type text,apply_basis text,name text);
      CREATE TABLE additional_fee_redemption(fee_id bigint,member_id bigint,billing_charge_id bigint,period_key text,amount_cents int,satisfied_at timestamptz,ended_at timestamptz);
      CREATE TABLE billing_charge(id bigint,member_id bigint,source_type text,source_id text,metadata jsonb,collection_status text,related_charge_id bigint,amount_cents int,created_at timestamptz,service_period_start date);
      CREATE FUNCTION account_source_date(value text) RETURNS date LANGUAGE sql IMMUTABLE AS 'SELECT value::date';
      INSERT INTO member(id,facility_id) SELECT id,1 FROM generate_series(1,12) id;
      INSERT INTO registrations(id,facility_id,lead_status,inquiry_source,campers) SELECT id,1,'qualified','admin_portal','[]' FROM generate_series(1,12) id;
      UPDATE registrations SET inquiry_source='free_trial' WHERE id IN(2,5,10,11);
      UPDATE registrations SET lead_status='converted',is_converted=TRUE,related_registration_ids=ARRAY[id,id*10] WHERE id IN(3,4,5);
      UPDATE registrations SET converted_at='2026-11-20T13:00:00Z' WHERE id=3;
      UPDATE registrations SET member_id=12,is_converted=FALSE,has_inquiry_provenance=TRUE,has_trial_provenance=TRUE WHERE id=12;
      UPDATE registrations SET campers=jsonb_build_array(jsonb_build_object('memberId',id)) WHERE id IN(7,8,9);
      INSERT INTO account_invite VALUES
        (1,1,1,'lead_registration',NULL,'{"purpose":"trial"}'),
        (3,1,30,'lead_registration','2026-11-15T12:00:00Z','{"purpose":"registration"}'),
        (4,1,40,'lead_registration','2026-11-16T12:00:00Z','{"purpose":"registration"}'),
        (5,1,5,'lead_registration','2026-11-17T12:00:00Z','{"purpose":"trial"}'),
        (10,1,10,'lead_registration','2026-11-18T12:00:00Z','{"purpose":"trial","result":{"trialRegistration":true}}'),
        (11,2,11,'lead_registration',NULL,'{"purpose":"trial"}');
      INSERT INTO program VALUES(1,1),(2,2);
      INSERT INTO scheduling_form VALUES(1,1),(2,2);
      INSERT INTO drop_in_registration VALUES(7,7,1,'2026-11-01','attended','paid'),(8,8,1,'2026-11-01','attended','paid'),
        (9,9,1,'2026-11-01','attended','paid');
      INSERT INTO additional_fee VALUES(1,'once_per_year','per_year','Annual membership');
      INSERT INTO additional_fee_redemption VALUES(1,8,NULL,'2027-10-01',8500,'2026-10-01T12:00:00Z',NULL),
        (1,9,NULL,'2027-11-02',8500,'2026-11-02T12:00:00Z',NULL);
      INSERT INTO account_enrollment_current VALUES(7,'vortex',7,1,'cancelled','2026-11-15');
    `)
    const rows = (await db.query(`SELECT r.*,lead_metadata.display_status,lead_metadata.participation_tags,
      lead_metadata.converted_at AS metadata_converted_at FROM registrations r
      LEFT JOIN LATERAL (SELECT NULL::bigint AS member_id) inquiry_contact ON TRUE
      ${leadMetadataJoin("DATE '2026-11-27'")} ORDER BY r.id`)).rows
    const metadata = id => leadStatusMetadata(rows.find(row => Number(row.id) === id))
    await t.test('pending and completed trial invitations retain original inquiry alongside trial', () => {
      assert.deepEqual(metadata(1), { displayStatus:'lead',participationTags:['inquiry','free_trial'],convertedAt:null })
      assert.deepEqual(metadata(2).participationTags,['free_trial'])
      assert.deepEqual(metadata(10).participationTags,['inquiry','free_trial'])
      assert.deepEqual(metadata(11).participationTags,['free_trial'], 'foreign invitation does not invent inquiry provenance')
      assert.deepEqual(metadata(12), { displayStatus:'lead',participationTags:['inquiry','free_trial'],convertedAt:null })
    })
    await t.test('explicit date wins; paid registration completion is a source-scoped fallback; trials never invent conversion dates', () => {
      assert.equal(metadata(3).convertedAt,'2026-11-20T13:00:00.000Z')
      assert.equal(metadata(4).convertedAt,'2026-11-16T12:00:00.000Z')
      assert.equal(metadata(5).convertedAt,null)
      assert.equal(metadata(6).convertedAt,null)
    })
    await t.test('non-member drop-in uses membership on the booking date and overlaps recent drops', () => {
      assert.deepEqual(metadata(7).participationTags,['inquiry','drop_in','recent_drop'])
      assert.deepEqual(metadata(8).participationTags,['inquiry'])
      assert.deepEqual(metadata(9).participationTags,['inquiry','drop_in'], 'membership purchased after the visit does not rewrite its provenance')
    })
  } finally { await db.query('ROLLBACK'); await db.end() }
})
