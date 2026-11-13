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
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    await client.query('ROLLBACK').catch(() => {})
    await client.end()
  }
})
