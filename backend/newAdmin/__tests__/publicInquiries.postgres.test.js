import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import pg from 'pg'
import { registerPublicInquiryRoutes } from '../publicInquiries.js'
import { validateRehearsalDatabaseUrl } from '../migrationAudit.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('public inquiry intake accepts repeat addresses and preserves archived inquiries', { skip: !connectionString }, async () => {
  const schema = `public_inquiries_${randomBytes(6).toString('hex')}`
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    await db.query(`CREATE SCHEMA ${schema}`)
    await db.query(`SET LOCAL search_path=${schema}`)
    await db.query(`
      CREATE TABLE facility(id bigint PRIMARY KEY);
      CREATE TABLE member(id bigint PRIMARY KEY, facility_id bigint, email text, is_active boolean);
      CREATE TABLE app_user(id bigint PRIMARY KEY);
      CREATE TABLE registrations(id serial PRIMARY KEY, first_name text, last_name text, email text NOT NULL UNIQUE,
        phone text, athlete_age integer, interests text, interests_array text[], interest text, class_types text[],
        child_ages integer[], campers jsonb, message text, submitter_role text, inquiry_source text,
        archived boolean DEFAULT FALSE, lead_status text DEFAULT 'new', created_at timestamp DEFAULT now());
      INSERT INTO facility VALUES(1);
      INSERT INTO member VALUES(1,1,'returning@example.com',TRUE);
      INSERT INTO registrations(first_name,last_name,email,archived) VALUES('Existing','Inquiry','returning@example.com',TRUE);
    `)
    await db.query(await readFile(new URL('../../migrations/841_new_admin.sql', import.meta.url), 'utf8'))
    await db.query(await readFile(new URL('../../migrations/855_repeat_public_inquiries.sql', import.meta.url), 'utf8'))
    await db.query('INSERT INTO new_admin_public_lead_facility(facility_id) VALUES(1)')

    let handle
    const attributionIds = []
    registerPublicInquiryRoutes({ post(path, handler) { assert.equal(path, '/api/registrations'); handle = handler } },
      db, { applyAttribution: async (_pool, inquiryId) => { attributionIds.push(inquiryId) } })
    async function submit(body) {
      const response = { statusCode: 200, status(code) { this.statusCode = code; return this }, json(data) { this.data = data; return this } }
      return handle({ body }, response)
    }

    const returning = { firstName: 'Returning', lastName: 'Parent', email: 'returning@example.com' }
    const first = await submit({ ...returning, phone: '+1 (202) 555-0101', classTypes: ['Camps'], message: 'First follow-up',
      campers: [{ firstName: 'Camper', dateOfBirth: '2014-01-22' }], interests: ['Tumbling'], facilityId: 2, memberId: 1 })
    const second = await submit({ ...returning, message: 'Second follow-up' })
    assert.deepEqual([first.statusCode, second.statusCode], [200, 200])
    assert.deepEqual(Object.keys(first.data).sort(), ['id', 'message', 'success'])
    assert.notEqual(first.data.id, second.data.id)
    assert.deepEqual(attributionIds, [first.data.id, second.data.id])
    const invalid = await submit({ ...returning, email: 'invalid' })
    assert.equal(invalid.statusCode, 400)
    const invalidPhone = await submit({ ...returning, phone: '202-555-010' })
    assert.equal(invalidPhone.statusCode, 400)
    assert.match(invalidPhone.data.errors[0], /###-###-####/)

    const rows = (await db.query('SELECT archived,facility_id,message,submitter_role,converted_member_id,campers,interests_array,phone FROM registrations ORDER BY id')).rows
    assert.deepEqual(rows.map(row => [row.archived,row.facility_id,row.message,row.submitter_role,row.converted_member_id]), [
      [true,null,null,null,null], [false,'1','First follow-up','Parent/Guardian',null], [false,'1','Second follow-up',null,null],
    ])
    assert.deepEqual(rows[1].campers, [{ firstName: 'Camper', dateOfBirth: '2014-01-22' }])
    assert.deepEqual(rows[1].interests_array, ['Tumbling'])
    assert.equal(rows[1].phone, '202-555-0101')
    assert.equal(rows[2].phone, null)
  } finally {
    await db.query('ROLLBACK')
    await db.end()
  }
})
