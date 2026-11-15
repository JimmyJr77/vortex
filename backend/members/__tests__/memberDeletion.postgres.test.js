import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import pg from 'pg'
import { validateRehearsalDatabaseUrl } from '../../newAdmin/migrationAudit.js'
import { changeLeadLifecycle } from '../../newAdmin/leadLifecycle.js'
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
    const form = (await client.query("INSERT INTO scheduling_form(title) VALUES('Member unpaid fixture') RETURNING id")).rows[0]
    const signup = (await client.query("INSERT INTO scheduling_signup(form_id,member_id,first_name,last_name,email,status) VALUES($1,$2,'Archive','Fixture',$3,'pending_setup') RETURNING id", [form.id,member.id,email])).rows[0]
    await client.query('SAVEPOINT meaningful_member_class')
    await client.query("UPDATE scheduling_signup SET status='confirmed' WHERE id=$1", [signup.id])
    await assert.rejects(deleteArchivedMember(pool, target), { code: 'ACCOUNT_HISTORY_PROTECTED' })
    await client.query('ROLLBACK TO SAVEPOINT meaningful_member_class')
    await client.query('SAVEPOINT attendance_history')
    await client.query('INSERT INTO member_missed_class(member_id,missed_on) VALUES($1,CURRENT_DATE)', [member.id])
    await assert.rejects(deleteArchivedMember(pool, target), { code: 'ACCOUNT_HISTORY_PROTECTED' })
    await client.query('ROLLBACK TO SAVEPOINT attendance_history')
    const waiver = (await client.query("INSERT INTO waiver_template(facility_id,name,version,body) VALUES($1,'Fixture','1','Fixture') RETURNING id", [facility.id])).rows[0]
    await client.query('INSERT INTO member_waiver_acceptance(member_id,waiver_template_id,accepted_by_member_id) VALUES($1,$2,$1)', [member.id,waiver.id])
    await client.query('SAVEPOINT other_member_waiver')
    const otherMember = (await client.query("INSERT INTO member(facility_id,first_name,last_name,is_active) VALUES($1,'Other','Child',FALSE) RETURNING id", [facility.id])).rows[0]
    await client.query('INSERT INTO member_waiver_acceptance(member_id,waiver_template_id,accepted_by_member_id) VALUES($1,$2,$3)', [otherMember.id,waiver.id,member.id])
    await assert.rejects(deleteArchivedMember(pool, target), { code: 'ACCOUNT_HISTORY_PROTECTED' })
    await client.query('ROLLBACK TO SAVEPOINT other_member_waiver')
    await client.query('SAVEPOINT payment_fixture')
    await client.query(`INSERT INTO jackrabbit_history_record(facility_id,organization_id,record_kind,source_id,member_id,amount_cents,source_data)
      VALUES($1,'fixture','transaction','payment',$2,-1000,'{"Type":"Payment"}')`, [facility.id,member.id])
    await assert.rejects(deleteArchivedMember(pool, target), /Payments have been made/)
    assert.equal((await client.query('SELECT 1 FROM member_waiver_acceptance WHERE member_id=$1', [member.id])).rowCount, 1)
    await client.query('ROLLBACK TO SAVEPOINT payment_fixture')
    const lead = (await client.query("INSERT INTO registrations(facility_id,first_name,last_name,email,converted_member_id,archived) VALUES($1,'Archive','Lead',$2,$3,TRUE) RETURNING id", [facility.id,email,member.id])).rows[0]
    await client.query("INSERT INTO account_invite(facility_id,registration_id,token_hash,invitee_email,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 day')", [facility.id,lead.id,randomUUID(),email])
    await changeLeadLifecycle(pool, facility.id, lead.id, 'delete')
    assert.equal((await client.query('SELECT 1 FROM member WHERE id=$1', [member.id])).rowCount, 1)
    assert.equal((await client.query('SELECT 1 FROM scheduling_signup WHERE id=$1', [signup.id])).rowCount, 1)
    await deleteArchivedMember(pool, target)
    assert.equal((await client.query('SELECT 1 FROM jackrabbit_history_record WHERE id=$1', [history.id])).rowCount, 0)
    assert.equal((await client.query('SELECT 1 FROM member_waiver_acceptance WHERE member_id=$1', [member.id])).rowCount, 0)
    assert.equal((await client.query('SELECT 1 FROM scheduling_signup WHERE id=$1', [signup.id])).rowCount, 0)
    assert.equal((await client.query('SELECT 1 FROM member WHERE id = $1', [member.id])).rowCount, 0)
    assert.equal((await client.query('SELECT 1 FROM app_user WHERE email = $1', [email])).rowCount, 0)
  } finally {
    await client.query('ROLLBACK').catch(() => {})
    await client.end()
  }
})
