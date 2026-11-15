import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import pg from 'pg'
import { validateRehearsalDatabaseUrl } from '../../newAdmin/migrationAudit.js'
import { deleteArchivedFamily } from '../familyDeletion.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('family deletion is scoped, guarded, atomic, and removes unused logins', { skip: !connectionString }, async () => {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    const commands = { BEGIN: 'SAVEPOINT deletion', COMMIT: 'RELEASE SAVEPOINT deletion', ROLLBACK: 'ROLLBACK TO SAVEPOINT deletion' }
    const pool = { async connect() { return { query: (sql, args) => db.query(commands[sql] || sql, args), release() {} } } }
    const { rows: [facility] } = await db.query("INSERT INTO facility(name) VALUES ('Family deletion fixture') RETURNING id")
    const addFamily = async () => (await db.query("INSERT INTO family(facility_id,family_name,archived) VALUES ($1,'Deletion fixture',TRUE) RETURNING id", [facility.id])).rows[0].id
    const familyId = await addFamily()
    const target = { familyId, facilityId: facility.id }
    const addMember = async name => {
      const { rows: [login] } = await db.query("INSERT INTO app_user(facility_id,full_name,role,email) VALUES ($1,$2,'MEMBER_ATHLETE',$3) RETURNING id", [facility.id, name, `${randomUUID()}@example.test`])
      const { rows: [member] } = await db.query("INSERT INTO member(facility_id,family_id,app_user_id,first_name,last_name,is_active) VALUES ($1,$2,$3,$4,'Fixture',FALSE) RETURNING id", [facility.id, familyId, login.id, name])
      await db.query('INSERT INTO family_member(family_id,member_id) VALUES ($1,$2)', [familyId, member.id])
      return { id: member.id, loginId: login.id }
    }
    const first = await addMember('First')
    const second = await addMember('Second')
    const count = async (table, id) => (await db.query(`SELECT 1 FROM ${table} WHERE id=$1`, [id])).rowCount
    await assert.rejects(deleteArchivedFamily(pool, { ...target, facilityId: -1 }), { statusCode: 404 })
    await db.query('UPDATE family SET archived=FALSE WHERE id=$1', [familyId])
    await assert.rejects(deleteArchivedFamily(pool, target), { code: 'FAMILY_ARCHIVE_REQUIRED' })
    await db.query('UPDATE family SET archived=TRUE WHERE id=$1', [familyId])

    // Failure on the second member must roll back deletion of the first/login.
    await db.query('UPDATE member SET is_active=TRUE WHERE id=$1', [second.id])
    await assert.rejects(deleteArchivedFamily(pool, target), /Second Fixture: Archive this member/)
    assert.equal(await count('member', first.id), 1)
    assert.equal(await count('app_user', first.loginId), 1)
    await db.query('UPDATE member SET is_active=FALSE WHERE id=$1', [second.id])
    await db.query('SAVEPOINT owner_fixture')
    await db.query('UPDATE facility SET owner_user_id=$1 WHERE id=$2', [second.loginId, facility.id])
    await assert.rejects(deleteArchivedFamily(pool, target), /Owner account cannot be deleted/)
    await db.query('ROLLBACK TO SAVEPOINT owner_fixture')

    const otherFamily = await addFamily()
    await db.query('INSERT INTO family_member(family_id,member_id,is_active) VALUES ($1,$2,FALSE)', [otherFamily, first.id])
    await assert.rejects(deleteArchivedFamily(pool, target), /another family/)
    await db.query('DELETE FROM family_member WHERE family_id=$1', [otherFamily])

    const { rows: [account] } = await db.query('INSERT INTO family_billing_account(family_id,payer_member_id) VALUES ($1,$2) RETURNING id', [familyId, first.id])
    const { rows: [history] } = await db.query("INSERT INTO billing_admin_action(family_billing_account_id,action_type) VALUES ($1,'payment_link_sent') RETURNING id", [account.id])
    await assert.rejects(deleteArchivedFamily(pool, target), /Billing, enrollment, or imported history/)
    assert.equal(await count('billing_admin_action', history.id), 1)
    await db.query('DELETE FROM billing_admin_action WHERE id=$1', [history.id])

    await deleteArchivedFamily(pool, target)
    for (const member of [first, second]) {
      assert.equal(await count('member', member.id), 0)
      assert.equal(await count('app_user', member.loginId), 0)
    }
    assert.equal(await count('family', familyId), 0)
    assert.equal(await count('family_billing_account', account.id), 0)
    // Empty archived families can also be removed.
    await deleteArchivedFamily(pool, { ...target, familyId: otherFamily })
    assert.equal(await count('family', otherFamily), 0)
  } finally {
    await db.query('ROLLBACK').catch(() => {})
    await db.end()
  }
})
