import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import pg from 'pg'
import { validateRehearsalDatabaseUrl } from '../migrationAudit.js'
import { createLead, updateLead, leadInput } from '../leads.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('admin leads have no mandatory fields and validate optional values when supplied', () => {
  assert.equal(leadInput({ email: 'prospect@example.test' }).firstName, '')
  assert.equal(leadInput({ email: 'prospect@example.test' }).lastName, '')
  assert.equal(leadInput({}).email, '')
  assert.equal(leadInput({ firstName: 'Only a name' }).email, '')
  assert.equal(leadInput({ email: '  ' }).email, '')
  assert.throws(() => leadInput({ email: 'invalid' }), /valid email/)
  assert.throws(() => leadInput({ email: 'prospect@example.test', inquiry: { newsletter: 'yes' } }), /boolean/)
  assert.throws(() => leadInput({ email: 'prospect@example.test', inquiry: { campers: [{ dateOfBirth: '2020-02-31', gender: 'male' }] } }), /birthday/)
  assert.deepEqual(leadInput({ inquiry: { campers: [{ gender: 'female' }, { dateOfBirth: '2020-02-20' }, {}] } }).inquiry.campers, [
    { firstName: '', lastName: '', dateOfBirth: '', gender: 'female' },
    { firstName: '', lastName: '', dateOfBirth: '2020-02-20', gender: '' },
    { firstName: '', lastName: '', dateOfBirth: '', gender: '' },
  ])
})

test('admin inquiry creation stores trusted staff attribution, optional public fields, and newsletter choice atomically', { skip: !connectionString }, async () => {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    for (const migration of ['855_repeat_public_inquiries.sql', '857_admin_lead_submission.sql', '875_business_acquisition.sql']) {
      await db.query(await readFile(new URL(`../../migrations/${migration}`, import.meta.url), 'utf8'))
    }
    const facility = (await db.query("INSERT INTO facility(name) VALUES('Admin lead fixture') RETURNING id")).rows[0]
    const staff = (await db.query("INSERT INTO app_user(facility_id,full_name,role) VALUES($1,'Staff Who Entered Lead','ADMIN') RETURNING id", [facility.id])).rows[0]
    const subscribersBefore = (await db.query("SELECT count(*)::int AS count FROM newsletter_subscribers WHERE NULLIF(btrim(email),'') IS NULL")).rows[0].count
    const blank = await createLead(db, facility.id, {}, { userId: staff.id })
    assert.equal(blank.firstName, '')
    assert.equal(blank.lastName, '')
    assert.equal(blank.email, '')
    assert.equal(blank.phone, null)
    assert.equal(blank.inquiry.submittedBy.userId, Number(staff.id))
    assert.equal(blank.matchedMemberId, null)
    const incomplete = await createLead(db, facility.id, { inquiry: { campers: [{ firstName: 'Optional' }, { gender: 'female' }, {}], newsletter: true } }, { userId: staff.id })
    assert.equal(incomplete.email, '')
    assert.equal(incomplete.inquiry.campers.length, 3)
    assert.equal(incomplete.inquiry.campers[0].firstName, 'Optional')
    assert.equal(incomplete.inquiry.campers[0].dateOfBirth, '')
    assert.equal(incomplete.inquiry.newsletter, true)
    assert.equal((await db.query("SELECT count(*)::int AS count FROM newsletter_subscribers WHERE NULLIF(btrim(email),'') IS NULL")).rows[0].count, subscribersBefore)
    const incompleteEdit = await updateLead(db, facility.id, incomplete.id, { email: '', phone: '', inquiry: { campers: [{ dateOfBirth: '2020-02-20' }], newsletter: true } })
    assert.equal(incompleteEdit.email, '')
    assert.equal(incompleteEdit.phone, null)
    assert.equal(incompleteEdit.inquiry.campers[0].gender, '')
    assert.equal(incompleteEdit.inquiry.submittedBy.userId, Number(staff.id))
    assert.equal((await db.query("SELECT count(*)::int AS count FROM newsletter_subscribers WHERE NULLIF(btrim(email),'') IS NULL")).rows[0].count, subscribersBefore)
    const email = `${randomUUID()}@example.test`
    const lead = await createLead(db, facility.id, { email, acquisitionSource: 'Friend referral', submittedBy: { name: 'Forged' }, inquiry: { submittedBy: { userId: -1, name: 'Forged' } } }, { userId: staff.id })
    assert.equal(lead.acquisition.source, 'Friend referral')
    assert.equal(lead.acquisition.medium, 'self_reported')
    const attemptedSourceEdit = await updateLead(db, facility.id, lead.id, { message: 'Follow up', acquisitionSource: 'Google Ads' })
    assert.deepEqual(attemptedSourceEdit.acquisition, lead.acquisition)
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
    const cleared = await updateLead(db, facility.id, complete.id, { phone: '', email: '' })
    assert.equal(cleared.phone, null)
    assert.equal(cleared.email, '')
    assert.equal(cleared.inquiry.campers.length, 2)
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
