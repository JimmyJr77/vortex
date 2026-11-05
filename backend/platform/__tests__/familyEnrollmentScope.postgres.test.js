import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { prepareFamilyEnrollmentCheckout } from '../familyEnrollmentCheckout.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL

test('PostgreSQL enrollment handoff rejects cross-facility and mismatched submitted relations', { skip: !connectionString }, async () => {
  const url = new URL(connectionString)
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    && ['postgres:', 'postgresql:'].includes(url.protocol) && !url.search && !url.hash
    && /^\/vortex_new_admin_dev(?:_[a-z0-9_]+)?$/i.test(url.pathname), 'test requires the dedicated local database without URL overrides')
  const db = new pg.Client({ connectionString })
  await db.connect()
  const schema = `signup_scope_${randomUUID().replaceAll('-', '')}`
  try {
    await db.query(`CREATE SCHEMA ${schema}`)
    await db.query(`SET search_path TO ${schema}`)
    await db.query(`CREATE TABLE programs (id bigint PRIMARY KEY, facility_id bigint, is_active boolean DEFAULT TRUE, archived boolean DEFAULT FALSE);
      CREATE TABLE program (id bigint PRIMARY KEY, programs_id bigint, facility_id bigint, is_active boolean DEFAULT TRUE, archived boolean DEFAULT FALSE);
      CREATE TABLE member (id bigint PRIMARY KEY, facility_id bigint, is_active boolean DEFAULT TRUE);
      CREATE TABLE scheduling_form (id bigint PRIMARY KEY, program_id bigint, programs_id bigint, title text, is_active boolean DEFAULT TRUE, deleted_at timestamptz);
      CREATE TABLE scheduling_offering (id bigint PRIMARY KEY, form_id bigint);
      CREATE TABLE scheduling_slot_group (id bigint PRIMARY KEY, form_id bigint, offering_id bigint, is_active boolean DEFAULT TRUE);
      CREATE TABLE scheduling_time_slot (id bigint PRIMARY KEY, form_id bigint, slot_group_id bigint, is_active boolean DEFAULT TRUE)`)
    await db.query(`INSERT INTO programs(id,facility_id) VALUES (2,1),(12,2);
      INSERT INTO program(id,programs_id,facility_id) VALUES (3,2,1),(13,12,2);
      INSERT INTO member(id,facility_id) VALUES (205,1),(305,2);
      INSERT INTO scheduling_form(id,program_id,programs_id,title) VALUES (9,3,2,'Local'),(19,13,12,'Foreign');
      INSERT INTO scheduling_offering(id,form_id) VALUES (8,9),(18,19);
      INSERT INTO scheduling_slot_group(id,form_id,offering_id) VALUES (225,9,8),(325,19,18);
      INSERT INTO scheduling_time_slot(id,form_id,slot_group_id) VALUES (301,9,225),(401,19,325)`)
    const enrollment = { classEventId: 3, programsId: 2, schedulingFormId: 9, slotGroupId: 225,
      timeSlotId: 301, offeringId: 8, offeringIds: [8], enrollmentStartDate: '2026-11-02' }
    assert.equal((await prepareFamilyEnrollmentCheckout(db, { memberId: 205, facilityId: 1, enrollment })).classLabel, 'Local')
    for (const input of [
      { memberId: 305, facilityId: 1, enrollment },
      { memberId: 205, facilityId: 2, enrollment },
      ...[{ programsId: 12 }, { classEventId: 13 }, { schedulingFormId: 19 }, { slotGroupId: 325 },
        { timeSlotId: 401 }, { offeringId: 18 }, { offeringIds: [18] }]
        .map(change => ({ memberId: 205, facilityId: 1, enrollment: { ...enrollment, ...change } })),
    ]) await assert.rejects(prepareFamilyEnrollmentCheckout(db, input), /no longer available/)
    await db.query('UPDATE program SET programs_id=12 WHERE id=3')
    await assert.rejects(prepareFamilyEnrollmentCheckout(db, { memberId: 205, facilityId: 1, enrollment }), /no longer available/)
  } finally {
    await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await db.end()
  }
})
