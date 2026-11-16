import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import express from 'express'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import { validateRehearsalDatabaseUrl } from '../../newAdmin/migrationAudit.js'
import { registerPlatformRoutes } from '../registerRoutes.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('only the Owner can list and remove archived unlinked logins in the facility', { skip: !connectionString }, async () => {
  const client = new pg.Client({ connectionString })
  await client.connect()
  let server
  try {
    await client.query('BEGIN')
    const savepointCommands = { BEGIN: 'SAVEPOINT route', COMMIT: 'RELEASE SAVEPOINT route', ROLLBACK: 'ROLLBACK TO SAVEPOINT route' }
    const pool = {
      query: (sql, args) => client.query(sql, args),
      async connect() {
        return { query: (sql, args) => client.query(savepointCommands[sql] || sql, args), release() {} }
      },
    }
    const addFacility = async () => (await client.query(
      "INSERT INTO facility (name) VALUES ('Archived login fixture') RETURNING id",
    )).rows[0].id
    const facilityId = await addFacility()
    const otherFacilityId = await addFacility()
    const addLogin = async ({ role = 'MEMBER_ATHLETE', global = true, staff = true, memberPortal = true, facility = facilityId } = {}) => {
      const email = `login-${randomUUID()}@example.test`
      const result = await client.query(
        `INSERT INTO app_user (facility_id, role, email, full_name, is_active, staff_access_active, member_portal_access_active)
         VALUES ($1, $2, $3, 'Archive Fixture', $4, $5, $6) RETURNING id`,
        [facility, role, email, global, staff, memberPortal],
      )
      return Number(result.rows[0].id)
    }
    const owner = await addLogin({ role: 'ADMIN' })
    await client.query('UPDATE facility SET owner_user_id = $1 WHERE id = $2', [owner, facilityId])
    const admin = await addLogin({ role: 'ADMIN' })
    await client.query(`INSERT INTO app_user_permission_override(user_id, permission_id, effect)
      SELECT $1, id, 'allow' FROM permission WHERE key = 'admin_access.manage'`, [admin])
    const active = await addLogin()
    const inactive = await addLogin({ global: false })
    const legacyArchived = await addLogin({ staff: false, memberPortal: false })
    const linkedArchived = await addLogin({ global: false })
    const foreign = await addLogin({ global: false, facility: otherFacilityId })
    await client.query(`INSERT INTO member (facility_id, app_user_id, first_name, last_name, is_active)
      VALUES ($1, $2, 'Linked', 'Fixture', FALSE)`, [facilityId, linkedArchived])

    const app = express()
    const secret = 'archived-login-test-secret'
    app.use(express.json())
    registerPlatformRoutes(app, pool, { jwtSecret: secret })
    server = await new Promise(resolve => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
    })
    const request = async (path, { actor = owner, method = 'GET', body } = {}) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/access/users${path}`, {
        method,
        headers: { Authorization: `Bearer ${jwt.sign({ userId: actor }, secret)}`, 'Content-Type': 'application/json', Connection: 'close' },
        body: body && JSON.stringify(body),
      })
      return { status: response.status, json: await response.json() }
    }

    assert.equal((await request('?scope=archived-logins', { actor: admin })).status, 403)
    assert.equal((await request(`/${active}/active`, { actor: admin, method: 'PATCH', body: { isActive: false } })).status, 403)
    assert.equal((await request(`/${legacyArchived}`, { actor: admin, method: 'DELETE' })).status, 403)
    const list = await request('?scope=archived-logins')
    assert.equal(list.status, 200)
    assert.deepEqual(new Set(list.json.data.map(user => user.id)), new Set([inactive, legacyArchived]))
    assert.equal((await request(`/${owner}`, { method: 'DELETE' })).status, 400)
    assert.equal((await request(`/${active}`, { method: 'DELETE' })).status, 409)
    assert.equal((await request(`/${linkedArchived}`, { method: 'DELETE' })).status, 409)
    assert.equal((await request(`/${foreign}`, { method: 'DELETE' })).status, 404)
    assert.equal((await request(`/${legacyArchived}`, { method: 'DELETE' })).status, 200)
    assert.equal((await request(`/${inactive}`, { method: 'DELETE' })).status, 200)
    assert.deepEqual((await request('?scope=archived-logins')).json.data, [])

    // A suspended coach still owns real roster assignments. The deletion route
    // must not quietly remove them before checking the login's dependencies.
    const assignedCoach = await addLogin({ role: 'COACH', staff: false })
    const program = (await client.query(
      "INSERT INTO program(facility_id,category,name,display_name) VALUES($1,'GYMNASTICS','Retained coach assignment','Retained coach assignment') RETURNING id",
      [facilityId],
    )).rows[0]
    const assignment = (await client.query(
      'INSERT INTO coach_class_assignment(coach_user_id,program_id) VALUES($1,$2) RETURNING id',
      [assignedCoach, program.id],
    )).rows[0]
    assert.equal((await request(`/${assignedCoach}`, { method: 'DELETE' })).status, 409)
    assert.equal(Number((await client.query('SELECT coach_user_id FROM coach_class_assignment WHERE id=$1', [assignment.id])).rows[0].coach_user_id), assignedCoach)
    assert.equal((await client.query('SELECT 1 FROM app_user WHERE id=$1', [assignedCoach])).rowCount, 1)

    // Future modules must receive the same protection, regardless of whether
    // their foreign key deletes evidence or silently clears its attribution.
    for (const action of ['CASCADE', 'SET NULL']) {
      await client.query('SAVEPOINT retained_login_evidence')
      const staff = await addLogin({ role: 'COACH', staff: false })
      const table = `login_delete_evidence_${randomUUID().replaceAll('-', '')}`
      await client.query(`CREATE TABLE public.${table} (id integer PRIMARY KEY, author bigint REFERENCES app_user(id) ON DELETE ${action}, body text NOT NULL)`)
      await client.query(`INSERT INTO public.${table}(id,author,body) VALUES(1,$1,'Retained business evidence')`, [staff])
      const before = (await client.query(`SELECT to_jsonb(e) AS row FROM public.${table} e`)).rows
      assert.equal((await request(`/${staff}`, { method: 'DELETE' })).status, 409)
      assert.deepEqual((await client.query(`SELECT to_jsonb(e) AS row FROM public.${table} e`)).rows, before)
      assert.equal((await client.query('SELECT 1 FROM app_user WHERE id=$1', [staff])).rowCount, 1)
      await client.query('ROLLBACK TO SAVEPOINT retained_login_evidence')
      await client.query('RELEASE SAVEPOINT retained_login_evidence')
    }

    // Notes store their author without a foreign key; their attribution still
    // prevents removal of the staff identity that wrote them.
    const noteAuthor = await addLogin({ role: 'ADMIN', staff: false })
    const inquiry = (await client.query(`INSERT INTO registrations(facility_id,first_name,last_name,email)
      VALUES($1,'Staff note','Fixture',$2) RETURNING id`, [facilityId, `${randomUUID()}@example.test`])).rows[0]
    const note = (await client.query(`INSERT INTO note(subject_type,subject_id,note_type,body,author_kind,author_id)
      VALUES('registration',$1,'staff_note','Retain staff attribution','admin',$2) RETURNING *`, [inquiry.id, noteAuthor])).rows[0]
    assert.equal((await request(`/${noteAuthor}`, { method: 'DELETE' })).status, 409)
    assert.deepEqual((await client.query('SELECT * FROM note WHERE id=$1', [note.id])).rows[0], note)
    assert.equal((await client.query('SELECT 1 FROM app_user WHERE id=$1', [noteAuthor])).rowCount, 1)

    // Login-only configuration may be removed with an otherwise unused login.
    const unusedCoach = await addLogin({ role: 'COACH', staff: false })
    await client.query("INSERT INTO app_user_role(user_id,role) VALUES($1,'COACH')", [unusedCoach])
    await client.query("INSERT INTO coach_profile(user_id,bio) VALUES($1,'Unused coach profile')", [unusedCoach])
    await client.query(`INSERT INTO app_user_permission_override(user_id,permission_id,effect)
      SELECT $1,id,'allow' FROM permission WHERE key='admin_access.manage'`, [unusedCoach])
    await client.query(`INSERT INTO email_verification_token(user_id,email,token_hash,expires_at)
      VALUES($1,'unused@example.test',$2,now()+interval '1 day')`, [unusedCoach, randomUUID()])
    assert.equal((await request(`/${unusedCoach}`, { method: 'DELETE' })).status, 200)
    assert.equal((await client.query('SELECT 1 FROM app_user WHERE id=$1', [unusedCoach])).rowCount, 0)
    for (const table of ['app_user_role', 'coach_profile', 'app_user_permission_override', 'email_verification_token']) {
      assert.equal((await client.query(`SELECT 1 FROM ${table} WHERE user_id=$1`, [unusedCoach])).rowCount, 0)
    }
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    await client.query('ROLLBACK').catch(() => {})
    await client.end()
  }
})
