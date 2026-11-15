import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import pg from 'pg'
import { validateRehearsalDatabaseUrl } from '../migrationAudit.js'
import { createLead, updateLead, leadInput } from '../leads.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('admin leads require only email and optional fields are validated when supplied', () => {
  assert.equal(leadInput({ email: 'prospect@example.test' }).firstName, '')
  assert.equal(leadInput({ email: 'prospect@example.test' }).lastName, '')
  assert.throws(() => leadInput({}), /Email is required/)
  assert.throws(() => leadInput({ email: 'invalid' }), /valid email/)
  assert.throws(() => leadInput({ email: 'prospect@example.test', inquiry: { newsletter: 'yes' } }), /boolean/)
  assert.throws(() => leadInput({ email: 'prospect@example.test', inquiry: { campers: [{ dateOfBirth: '2020-02-31', gender: 'male' }] } }), /birthday/)
  assert.throws(() => leadInput({ email: 'prospect@example.test', inquiry: { campers: [{ gender: 'female' }] } }), /date of birth/)
  assert.throws(() => leadInput({ email: 'prospect@example.test', inquiry: { campers: [{ dateOfBirth: '2020-02-20' }] } }), /gender/)
})

test('admin inquiry creation stores trusted staff attribution, optional public fields, and newsletter choice atomically', { skip: !connectionString }, async () => {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    await db.query(await readFile(new URL('../../migrations/857_admin_lead_submission.sql', import.meta.url), 'utf8'))
    const facility = (await db.query("INSERT INTO facility(name) VALUES('Admin lead fixture') RETURNING id")).rows[0]
    const staff = (await db.query("INSERT INTO app_user(facility_id,full_name,role) VALUES($1,'Staff Who Entered Lead','ADMIN') RETURNING id", [facility.id])).rows[0]
    const email = `${randomUUID()}@example.test`
    const lead = await createLead(db, facility.id, { email, submittedBy: { name: 'Forged' }, inquiry: { submittedBy: { userId: -1, name: 'Forged' } } }, { userId: staff.id })
    assert.equal(lead.firstName, '')
    assert.equal(lead.lastName, '')
    assert.equal(lead.inquiry.submittedBy.name, 'Staff Who Entered Lead')
    assert.equal(lead.inquiry.submittedBy.userId, Number(staff.id))
    assert.equal(lead.inquiry.source, 'admin_portal')
    assert.equal(lead.inquiry.newsletter, false)
    assert.equal((await db.query('SELECT 1 FROM newsletter_subscribers WHERE email=$1', [email])).rowCount, 0)
    const fullEmail = `${randomUUID()}@example.test`
    const complete = await createLead(db, facility.id, { email: fullEmail, firstName: 'Optional', phone: '2025550101', message: 'Can we visit?', inquiry: {
      submitterRole: 'Parent/Guardian', interests: ['Speed & Agility','Gymnastics (Artistic)','Other: Hockey'],
      classTypes: ['Youth Classes','Camps'], campers: [{ dateOfBirth: '2020-02-20', gender: 'female' }, { gender: 'male', dateOfBirth: '2021-02-20' }], newsletter: true,
    } }, { userId: staff.id })
    assert.equal(complete.inquiry.submitterRole, 'Parent/Guardian')
    assert.deepEqual(complete.inquiry.interests, ['Speed & Agility','Gymnastics (Artistic)','Other: Hockey'])
    assert.deepEqual(complete.inquiry.classTypes, ['Youth Classes','Camps'])
    assert.equal(complete.inquiry.campers.length, 2)
    assert.equal(complete.inquiry.campers[1].dateOfBirth, '2021-02-20')
    assert.equal(complete.inquiry.campers[1].firstName, '')
    await assert.rejects(createLead(db, facility.id, { email, inquiry: { campers: [{ dateOfBirth: '2020-02-20', gender: 'female' }] } }, { userId: staff.id }), /phone number/)
    await assert.rejects(updateLead(db, facility.id, complete.id, { phone: '' }), /phone number/)
    assert.equal(complete.inquiry.newsletter, true)
    assert.equal((await db.query('SELECT 1 FROM newsletter_subscribers WHERE email=$1', [fullEmail])).rowCount, 1)
    const edited = await updateLead(db, facility.id, lead.id, { firstName: '', inquiry: { submittedBy: { name: 'Forged' }, newsletter: true } })
    assert.equal(edited.inquiry.submittedBy.name, 'Staff Who Entered Lead')
    assert.equal((await db.query('SELECT 1 FROM newsletter_subscribers WHERE email=$1', [email])).rowCount, 1)
    await updateLead(db, facility.id, lead.id, { inquiry: { newsletter: true } })
    assert.equal((await db.query('SELECT 1 FROM newsletter_subscribers WHERE email=$1', [email])).rowCount, 1)
    const otherFacility = (await db.query("INSERT INTO facility(name) VALUES('Other lead fixture') RETURNING id")).rows[0]
    await assert.rejects(createLead(db, otherFacility.id, { email }, { userId: staff.id }), /staff account/)
    await db.query('DELETE FROM app_user WHERE id=$1', [staff.id])
    const attributed = await updateLead(db, facility.id, lead.id, { message: 'Keep attribution' })
    assert.equal(attributed.inquiry.submittedBy.name, 'Staff Who Entered Lead')
    assert.equal(attributed.inquiry.submittedBy.userId, null)
  } finally {
    await db.query('ROLLBACK').catch(() => {})
    await db.end()
  }
})
