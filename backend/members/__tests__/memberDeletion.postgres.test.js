import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import pg from 'pg'
import { validateRehearsalDatabaseUrl } from '../../newAdmin/migrationAudit.js'
import { deleteArchivedMember } from '../memberDeletion.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('permanent member deletion releases an archived login and preserves protected records', { skip: !connectionString }, async () => {
  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    await client.query('BEGIN')
    // Each deletion is atomic within a savepoint. The outer transaction keeps
    // test identities and their dependent records out of the shared database.
    const transactionCommands = {
      BEGIN: 'SAVEPOINT deletion',
      COMMIT: 'RELEASE SAVEPOINT deletion',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT deletion',
    }
    const pool = {
      async connect() {
        return {
          query(sql, parameters) { return client.query(transactionCommands[sql] || sql, parameters) },
          release() {},
        }
      },
    }
    const { rows: [facility] } = await client.query("INSERT INTO facility (name) VALUES ('Member lifecycle fixture') RETURNING id")
    const { rows: [other] } = await client.query("INSERT INTO facility (name) VALUES ('Other facility fixture') RETURNING id")
    const email = `member-deletion-${randomUUID()}@example.test`
    const { rows: [login] } = await client.query(
      "INSERT INTO app_user (facility_id, email, full_name, role) VALUES ($1, $2, 'Archive Fixture', 'MEMBER_ATHLETE') RETURNING id",
      [facility.id, email],
    )
    const { rows: [member] } = await client.query(
      `INSERT INTO member (facility_id, app_user_id, first_name, last_name, email)
       VALUES ($1, $2, 'Archive', 'Fixture', $3) RETURNING id`,
      [facility.id, login.id, email],
    )
    const target = { memberId: member.id, facilityId: facility.id }
    await assert.rejects(deleteArchivedMember(pool, { ...target, facilityId: other.id }), { statusCode: 404 })
    await assert.rejects(deleteArchivedMember(pool, target), { code: 'MEMBER_ARCHIVE_REQUIRED' })

    await client.query('UPDATE member SET is_active = FALSE WHERE id = $1', [member.id])
    const { rows: [history] } = await client.query(
      `INSERT INTO jackrabbit_history_record (facility_id, organization_id, record_kind, source_id, member_id, source_data)
       VALUES ($1, 'fixture', 'person', $2, $3, '{}') RETURNING id`,
      [facility.id, randomUUID(), member.id],
    )
    await assert.rejects(deleteArchivedMember(pool, target), error => (
      error.code === 'MEMBER_DELETE_BLOCKED'
      && error.blockers.some(({ message }) => message.includes('Imported history'))
    ))
    assert.equal((await client.query('SELECT 1 FROM jackrabbit_history_record WHERE id = $1', [history.id])).rowCount, 1)
    assert.equal((await client.query('SELECT 1 FROM member WHERE id = $1', [member.id])).rowCount, 1)

    await client.query('DELETE FROM jackrabbit_history_record WHERE id = $1', [history.id])
    await deleteArchivedMember(pool, target)
    assert.equal((await client.query('SELECT 1 FROM member WHERE id = $1', [member.id])).rowCount, 0)
    assert.equal((await client.query('SELECT 1 FROM app_user WHERE email = $1', [email])).rowCount, 0)
  } finally {
    await client.query('ROLLBACK').catch(() => {})
    await client.end()
  }
})
