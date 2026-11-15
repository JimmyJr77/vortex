import assert from 'node:assert/strict'
import test from 'node:test'
import pg from 'pg'
import { validateRehearsalDatabaseUrl } from '../../newAdmin/migrationAudit.js'
import { setFamilyArchived } from '../familyArchive.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('family archive checks enrollments, owner and shared members atomically; restore preserves history', { skip: !connectionString }, async () => {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    const commands = { BEGIN: 'SAVEPOINT archive', COMMIT: 'RELEASE SAVEPOINT archive', ROLLBACK: 'ROLLBACK TO SAVEPOINT archive' }
    const pool = { async connect() { return { query: (sql, args) => db.query(commands[sql] || sql, args), release() {} } } }
    const facilityId = (await db.query("INSERT INTO facility(name) VALUES('Family archive fixture') RETURNING id")).rows[0].id
    const familyId = (await db.query("INSERT INTO family(facility_id,family_name) VALUES($1,'Archive fixture') RETURNING id", [facilityId])).rows[0].id
    const members = []
    for (const name of ['Parent', 'Child']) {
      const memberId = (await db.query("INSERT INTO member(facility_id,family_id,first_name,last_name,is_active) VALUES($1,$2,$3,'Fixture',TRUE) RETURNING id", [facilityId,familyId,name])).rows[0].id
      await db.query('INSERT INTO family_member(family_id,member_id,is_active) VALUES($1,$2,TRUE)', [familyId,memberId])
      members.push(memberId)
    }
    const scope = { facilityId }
    const form = (await db.query("INSERT INTO scheduling_form(title,is_active) VALUES('Archive class fixture',TRUE) RETURNING id")).rows[0]
    const signup = (await db.query("INSERT INTO scheduling_signup(form_id,member_id,first_name,last_name,email,status) VALUES($1,$2,'Child','Fixture','fixture@example.test','confirmed') RETURNING id", [form.id,members[1]])).rows[0]
    assert.equal((await setFamilyArchived(pool, familyId, true, { facilityId: -1 })).found, false)
    for (const status of ['confirmed','paused','waitlisted']) {
      await db.query('UPDATE scheduling_signup SET status=$1 WHERE id=$2', [status,signup.id])
      const result = await setFamilyArchived(pool, familyId, true, scope)
      assert.equal(result.canArchive, false)
      assert.equal(result.blockers[0].type, 'active_enrollments')
      assert.equal((await db.query('SELECT archived FROM family WHERE id=$1', [familyId])).rows[0].archived, false)
      assert.equal((await db.query('SELECT count(*)::int AS count FROM member WHERE id=ANY($1::bigint[]) AND is_active', [members])).rows[0].count, 2)
    }
    await db.query("UPDATE scheduling_signup SET status='cancelled' WHERE id=$1", [signup.id])
    const otherFamily = (await db.query("INSERT INTO family(facility_id,family_name) VALUES($1,'Other fixture') RETURNING id", [facilityId])).rows[0].id
    await db.query('UPDATE member SET family_id=$1 WHERE id=$2', [otherFamily,members[0]])
    assert.equal((await setFamilyArchived(pool, familyId, true, scope)).blockers[0].type, 'shared_member')
    await db.query('UPDATE member SET family_id=$1 WHERE id=$2', [familyId,members[0]])
    await db.query('SAVEPOINT owner_fixture')
    const login = (await db.query("INSERT INTO app_user(facility_id,full_name,role) VALUES($1,'Owner Fixture','ADMIN') RETURNING id", [facilityId])).rows[0]
    await db.query('UPDATE member SET app_user_id=$1 WHERE id=$2', [login.id,members[0]])
    await db.query('UPDATE facility SET owner_user_id=$1 WHERE id=$2', [login.id,facilityId])
    assert.equal((await setFamilyArchived(pool, familyId, true, scope)).blockers[0].type, 'owner')
    await db.query('ROLLBACK TO SAVEPOINT owner_fixture')
    // Archiving the entire household is allowed to retain its own payer.
    const account = (await db.query('INSERT INTO family_billing_account(family_id,payer_member_id) VALUES($1,$2) RETURNING id', [familyId,members[0]])).rows[0]
    assert.equal((await setFamilyArchived(pool, familyId, true, scope)).canArchive, true)
    assert.equal((await db.query('SELECT count(*)::int AS count FROM member WHERE id=ANY($1::bigint[]) AND is_active', [members])).rows[0].count, 0)
    await db.query("UPDATE scheduling_signup SET status='confirmed' WHERE id=$1", [signup.id])
    assert.equal((await setFamilyArchived(pool, familyId, false, scope)).canArchive, true)
    assert.equal((await db.query('SELECT count(*)::int AS count FROM member WHERE id=ANY($1::bigint[]) AND is_active', [members])).rows[0].count, 2)
    assert.equal((await db.query('SELECT member_id FROM scheduling_signup WHERE id=$1', [signup.id])).rows[0].member_id, members[1])
    assert.equal((await db.query('SELECT payer_member_id FROM family_billing_account WHERE id=$1', [account.id])).rows[0].payer_member_id, members[0])
  } finally {
    await db.query('ROLLBACK').catch(() => {})
    await db.end()
  }
})
