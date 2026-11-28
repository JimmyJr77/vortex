import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { createNotesHandlers } from '../handlers.js'
import { familyNotes } from '../../newAdmin/accountNotes.js'
import { validateRehearsalDatabaseUrl } from '../../newAdmin/migrationAudit.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('contact notes update only their account using the note date, with an atomic opt-out', { skip: !connectionString }, async t => {
  const db = new pg.Client({ connectionString })
  await db.connect()
  const schema = `note_contact_${randomBytes(6).toString('hex')}`
  const handlers = createNotesHandlers(db)
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0]
  const dates = async () => (await db.query('SELECT id,last_contacted_date::text AS date FROM registrations ORDER BY id')).rows
  const add = async (subjectType, subjectId, nonContact) => {
    const res = { statusCode: 200, status(value) { this.statusCode = value; return this }, json(value) { this.payload = value } }
    await handlers.addNote({ body: { subjectType, subjectId, noteType: 'staff_note', body: 'Called about classes',
      ...(nonContact === undefined ? {} : { nonContact }) }, canonicalAccess: { facilityId: 1 } }, res)
    assert.equal(res.statusCode, 200, JSON.stringify(res.payload))
    return res.payload.data
  }
  try {
    await db.query('BEGIN')
    await db.query(`CREATE SCHEMA ${schema}`)
    await db.query(`SET LOCAL search_path=${schema}`)
    await db.query(`
      CREATE TABLE facility(id bigint PRIMARY KEY,timezone text);
      CREATE TABLE family(id bigint PRIMARY KEY,facility_id bigint);
      CREATE TABLE member(id bigint PRIMARY KEY,facility_id bigint,family_id bigint,first_name text,last_name text,email text);
      CREATE TABLE family_member(family_id bigint,member_id bigint,is_active boolean);
      CREATE TABLE account_record_source(family_id bigint,member_id bigint,facility_id bigint,deleted boolean);
      CREATE TABLE registrations(id bigint PRIMARY KEY,facility_id bigint,member_id bigint,converted_member_id bigint,
        trial_contact_member_id bigint,first_name text,last_name text,email text,inquiry_source text,archived boolean DEFAULT FALSE,
        created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),converted_at timestamptz,lead_status text,
        contacted boolean DEFAULT FALSE,follow_up boolean DEFAULT FALSE,first_contacted_at timestamptz,
        campers jsonb DEFAULT '[]',last_contacted_date date,submitted_by_name text,message text,admin_notes text);
      CREATE TABLE account_invite(registration_id bigint,facility_id bigint,invite_type text);
      CREATE TABLE note(id bigserial PRIMARY KEY,subject_type text,subject_id bigint,note_type text,body text,
        author_kind text,author_id bigint,author_email text,author_name text,source text,is_deleted boolean DEFAULT FALSE,
        created_at timestamptz DEFAULT '2026-11-27T02:30:00Z');
      INSERT INTO facility VALUES(1,'America/Los_Angeles'),(2,'America/New_York');
      INSERT INTO family VALUES(1,1),(2,2);
      INSERT INTO member VALUES(1,1,1,'Jordan','Rivera','jordan@example.test'),(2,1,1,'Casey','Rivera',NULL),
        (3,1,1,'Former','Member',NULL),(4,2,2,'Foreign','Member',NULL);
      INSERT INTO family_member VALUES(1,1,TRUE),(1,2,TRUE),(1,3,FALSE),(2,4,TRUE);
      INSERT INTO account_record_source VALUES(1,3,1,FALSE);
      INSERT INTO registrations(id,facility_id,member_id,first_name,last_name,email,inquiry_source,last_contacted_date) VALUES
        (1,1,NULL,'Jordan','Rivera','jordan@example.test','admin_portal','2026-01-01'),
        (2,1,1,'Jordan','Rivera','jordan@example.test','free_trial','2026-01-01'),
        (3,1,2,'Casey','Rivera','casey@example.test','admin_portal','2026-01-01'),
        (4,1,3,'Former','Member','former@example.test','admin_portal','2026-01-01'),
        (5,2,4,'Foreign','Member','foreign@example.test','admin_portal','2026-01-01'),
        (6,1,NULL,'Unrelated','Lead','other@example.test','admin_portal',NULL);
    `)
    const migration = await readFile(new URL('../../migrations/884_note_contact_tracking.sql', import.meta.url), 'utf8')
    await db.query(migration)
    await db.query(migration)
    const reset = () => db.query("UPDATE registrations SET last_contacted_date=CASE WHEN id=6 THEN NULL ELSE DATE '2026-01-01' END")
    const expectHouseholdContact = async () => assert.deepEqual(await dates(), [
      { id: '1', date: '2026-01-01' }, { id: '2', date: '2026-11-26' }, { id: '3', date: '2026-11-26' },
      { id: '4', date: '2026-01-01' }, { id: '5', date: '2026-01-01' }, { id: '6', date: null },
    ])
    await t.test('standalone lead defaults to contact using the saved timestamp in facility time', async () => {
      const note = await add('registration', 6)
      assert.equal(note.nonContact, false)
      assert.equal(note.contactDate, '2026-11-26')
      assert.equal((await one('SELECT last_contacted_date::text AS date FROM registrations WHERE id=6')).date, '2026-11-26')
      assert.equal((await one('SELECT first_contacted_at FROM registrations WHERE id=6')).first_contacted_at, null)
      await reset()
    })
    await t.test('grouped leads update all original/trial rows and current family contacts', async () => {
      await add('registration', 1)
      assert.deepEqual((await dates()).slice(0, 3), [1, 2, 3].map(id => ({ id: String(id), date: '2026-11-26' })))
      assert.equal((await dates())[3].date, '2026-01-01')
      assert.equal((await dates())[4].date, '2026-01-01')
      await reset()
    })
    await t.test('member and family notes update current linked leads without crossing facilities or former household links', async () => {
      await add('member', 1)
      await expectHouseholdContact()
      await reset()
      await add('family', 1)
      await expectHouseholdContact()
      await reset()
    })
    await t.test('non-contact notes preserve manual or cleared dates and stay labelled after reload', async () => {
      const before = await dates()
      for (const [type, id] of [['registration', 1], ['registration', 6], ['member', 1], ['family', 1]]) {
        const note = await add(type, id, true)
        assert.equal(note.nonContact, true)
        assert.equal(note.contactDate, null)
        assert.deepEqual(await dates(), before)
      }
      assert.ok((await familyNotes(db, 1, 1)).some(note => note.nonContact === true))
    })
    await t.test('failed contact updates roll back the note insert too', async () => {
      await db.query('SAVEPOINT atomic_note')
      const before = Number((await one('SELECT count(*) AS count FROM note')).count)
      try {
        await db.query("ALTER TABLE registrations ADD CONSTRAINT reject_contact CHECK (id<>6 OR last_contacted_date IS NULL)")
        // Recover each failed statement independently, as separate pool queries
        // would. An earlier, separately committed insert must remain detectable.
        const guardedDb = { async query(sql, values) {
          await db.query('SAVEPOINT note_statement')
          try {
            const result = await db.query(sql, values)
            await db.query('RELEASE SAVEPOINT note_statement')
            return result
          } catch (error) {
            await db.query('ROLLBACK TO SAVEPOINT note_statement')
            await db.query('RELEASE SAVEPOINT note_statement')
            throw error
          }
        } }
        const res = { statusCode: 200, status(value) { this.statusCode = value; return this }, json() {} }
        const originalError = console.error
        try {
          console.error = () => {}
          await createNotesHandlers(guardedDb).addNote({ body: { subjectType: 'registration', subjectId: 6, noteType: 'staff_note', body: 'Must roll back' }, canonicalAccess: { facilityId: 1 } }, res)
        } finally { console.error = originalError }
        assert.equal(res.statusCode, 500)
        assert.equal(Number((await one('SELECT count(*) AS count FROM note')).count), before)
      } finally { await db.query('ROLLBACK TO SAVEPOINT atomic_note') }
      assert.equal(Number((await one('SELECT count(*) AS count FROM note')).count), before)
    })
  } finally {
    await db.query('ROLLBACK')
    await db.end()
  }
})
