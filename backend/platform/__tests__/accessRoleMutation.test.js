import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import bcrypt from 'bcryptjs'
import express from 'express'
import jwt from 'jsonwebtoken'

import { registerPlatformRoutes, updateAccessUserRoles } from '../registerRoutes.js'

const OWNER_PROFILE_JWT_SECRET = 'owner-profile-hardening-test-secret'

function ownerProfilePool({
  actorUserId,
  ownerUserId = 9,
  linkedMemberId = null,
  failMemberUpdate = false,
} = {}) {
  const calls = []
  const actorIsOwner = Number(actorUserId) === Number(ownerUserId)
  let released = false
  const query = async (sql, params = []) => {
    const text = String(sql)
    calls.push({ text, params })
    if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
      return { rows: [], rowCount: 0 }
    }
    if (text.includes('FROM v_app_user_access_context')) {
      return {
        rows: [{
          user_id: actorUserId,
          facility_id: 7,
          owner_user_id: ownerUserId,
          primary_storage_role: actorIsOwner ? 'MASTER_ADMIN' : 'ADMIN',
          storage_roles: [actorIsOwner ? 'MASTER_ADMIN' : 'ADMIN'],
          staff_roles: [actorIsOwner ? 'OWNER' : 'ADMINISTRATOR'],
          is_active: true,
          staff_access_active: true,
          member_portal_access_active: true,
          is_owner: actorIsOwner,
          member_portal_status: 'no_login',
          can_access_admin_portal: true,
          can_access_coach_portal: false,
          can_access_member_portal: false,
        }],
      }
    }
    if (text.includes('FROM app_user_role')) return { rows: [] }
    if (text.includes('SELECT key FROM permission ORDER BY key')) {
      return { rows: [{ key: 'admin_access.manage' }] }
    }
    if (text.includes('FROM role r') && text.includes('role_permission')) {
      return { rows: [{ key: 'admin_access.manage' }] }
    }
    if (text.includes('FROM app_user_permission_override')) return { rows: [] }
    if (text.includes('FROM app_user account') && text.includes('JOIN facility')) {
      const targetUserId = Number(params[0])
      return {
        rows: [{
          id: String(targetUserId),
          full_name: targetUserId === ownerUserId ? 'Facility Owner' : 'Linked Staff Member',
          email: targetUserId === ownerUserId ? 'owner@example.test' : 'staff@example.test',
          phone: '555-0100',
          username: targetUserId === ownerUserId ? 'owner' : 'staff-user',
          address: '1 Existing Way',
          is_owner: targetUserId === ownerUserId,
        }],
      }
    }
    if (text.includes('SELECT id') && text.includes('FROM app_user') && text.includes('id <> $1')) {
      return { rows: [] }
    }
    if (text.includes('FROM member') && text.includes('FOR UPDATE')) {
      return { rows: linkedMemberId == null ? [] : [{ id: String(linkedMemberId) }] }
    }
    if (text.includes('UPDATE member')) {
      if (failMemberUpdate) throw new Error('injected linked member update failure')
      return { rows: [], rowCount: 1 }
    }
    if (text.includes('UPDATE app_user')) return { rows: [{ id: String(params.at(-2)) }], rowCount: 1 }
    throw new Error(`Unexpected query: ${text}`)
  }
  const client = {
    query,
    release() { released = true },
  }
  return {
    calls,
    pool: {
      query,
      async connect() { return client },
    },
    wasReleased: () => released,
  }
}

function createOwnerProfileApp(pool) {
  const app = express()
  app.use(express.json())
  registerPlatformRoutes(app, pool, { jwtSecret: OWNER_PROFILE_JWT_SECRET })
  return app
}

async function invokeOwnerProfileRoute(app, { actorUserId, targetUserId, body }) {
  const path = '/api/admin/access/users/:userId'
  const routeLayer = app._router.stack.find((layer) => (
    layer.route?.path === path && layer.route.methods.put === true
  ))
  assert.ok(routeLayer, `route PUT ${path} must be registered`)
  const headers = {
    authorization: `Bearer ${jwt.sign({ userId: actorUserId }, OWNER_PROFILE_JWT_SECRET, { expiresIn: '5m' })}`,
  }
  const request = {
    method: 'PUT',
    path,
    params: { userId: String(targetUserId) },
    query: {},
    body,
    headers,
    get(name) { return headers[String(name).toLowerCase()] },
  }
  return new Promise((resolve, reject) => {
    let statusCode = 200
    const response = {
      status(code) { statusCode = Number(code); return this },
      setHeader() {},
      json(payload) { resolve({ status: statusCode, body: payload }); return this },
      send(payload) { resolve({ status: statusCode, body: payload }); return this },
    }
    let index = 0
    const next = (error) => {
      if (error) return reject(error)
      const handler = routeLayer.route.stack[index]?.handle
      index += 1
      if (!handler) return reject(new Error(`Route PUT ${path} completed without a response.`))
      Promise.resolve(handler(request, response, next)).catch(reject)
    }
    next()
  })
}

function transactionalPool({ ownerUserId = null, failOn = null } = {}) {
  const calls = []
  let released = false
  const client = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (failOn && text.includes(failOn)) throw new Error('injected mutation failure')
      if (text.includes('FROM app_user au') && text.includes('FOR UPDATE')) {
        return {
          rows: [{
            id: '9',
            role: ownerUserId === 9 ? 'MASTER_ADMIN' : 'ADMIN',
            facility_id: '2',
            owner_user_id: ownerUserId == null ? null : String(ownerUserId),
          }],
        }
      }
      return { rows: [], rowCount: 1 }
    },
    release() {
      released = true
    },
  }
  const pool = {
    async query() {
      throw new Error('role mutation must not use pool.query outside its checked-out client')
    },
    async connect() {
      return client
    },
  }
  return { pool, calls, wasReleased: () => released }
}

test('staff role mutation is atomic and does not create or modify member records', async () => {
  const fixture = transactionalPool()
  const result = await updateAccessUserRoles(fixture.pool, {
    userId: 9,
    facilityId: 2,
    actorUserId: 1,
    roles: ['ADMIN', 'COACH', 'MEMBER_ATHLETE'],
  })

  assert.deepEqual(result, { roles: ['ADMIN', 'COACH'], isOwner: false })
  assert.equal(fixture.calls[0].text, 'BEGIN')
  assert.equal(fixture.calls.at(-1).text, 'COMMIT')
  assert.equal(fixture.wasReleased(), true)
  assert.equal(fixture.calls.some(({ text }) => /\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+member\b/i.test(text)), false)
})

test('staff role mutation rolls back on failure using the same checked-out client', async () => {
  const fixture = transactionalPool({ failOn: 'INSERT INTO app_user_role' })
  await assert.rejects(
    updateAccessUserRoles(fixture.pool, {
      userId: 9,
      facilityId: 2,
      actorUserId: 1,
      roles: ['ADMIN'],
    }),
    /injected mutation failure/,
  )

  assert.equal(fixture.calls.some(({ text }) => text === 'ROLLBACK'), true)
  assert.equal(fixture.calls.some(({ text }) => text === 'COMMIT'), false)
  assert.equal(fixture.wasReleased(), true)
})

test('only the immutable facility owner may retain the owner storage role', async () => {
  const nonOwner = transactionalPool({ ownerUserId: 1 })
  await assert.rejects(
    updateAccessUserRoles(nonOwner.pool, {
      userId: 9,
      facilityId: 2,
      actorUserId: 1,
      roles: ['MASTER_ADMIN'],
    }),
    /Owner is immutable/,
  )
  assert.equal(nonOwner.calls.some(({ text }) => text === 'ROLLBACK'), true)

  const owner = transactionalPool({ ownerUserId: 9 })
  await assert.rejects(
    updateAccessUserRoles(owner.pool, {
      userId: 9,
      facilityId: 2,
      actorUserId: 9,
      roles: ['ADMIN'],
    }),
    /must keep the Owner role/,
  )
})

test('an administrator cannot change the Owner profile or password', async () => {
  const fixture = ownerProfilePool({ actorUserId: 91, ownerUserId: 9 })
  const response = await invokeOwnerProfileRoute(createOwnerProfileApp(fixture.pool), {
    actorUserId: 91,
    targetUserId: 9,
    body: { password: 'attempted-owner-password-change' },
  })

  assert.equal(response.status, 403)
  assert.equal(response.body.code, 'OWNER_SELF_EDIT_REQUIRED')
  assert.match(response.body.message, /Only the facility Owner/)
  assert.equal(fixture.calls.some(({ text }) => text.includes('UPDATE app_user')), false)
})

test('the stable Owner identity can update its own password', async () => {
  const fixture = ownerProfilePool({ actorUserId: 9, ownerUserId: 9 })
  const password = 'owner-self-service-password'
  const response = await invokeOwnerProfileRoute(createOwnerProfileApp(fixture.pool), {
    actorUserId: 9,
    targetUserId: 9,
    body: { password },
  })

  assert.equal(response.status, 200)
  const mutation = fixture.calls.find(({ text }) => (
    text.includes('UPDATE app_user') && text.includes('password_hash')
  ))
  assert.ok(mutation)
  assert.equal(mutation.params.at(-2), 9)
  assert.equal(mutation.params.at(-1), 7)
  assert.equal(await bcrypt.compare(password, mutation.params[0]), true)
})

test('staff profile updates atomically synchronize the explicitly linked member identity', async () => {
  const fixture = ownerProfilePool({
    actorUserId: 9,
    ownerUserId: 9,
    linkedMemberId: 42,
  })
  const response = await invokeOwnerProfileRoute(createOwnerProfileApp(fixture.pool), {
    actorUserId: 9,
    targetUserId: 12,
    body: {
      fullName: '  Morgan   Lee Rivera  ',
      email: 'morgan@example.test',
      phone: '555-0112',
      username: 'morgan-rivera',
      address: '12 Canonical Lane',
    },
  })

  assert.equal(response.status, 200)
  const appUserUpdate = fixture.calls.find(({ text }) => text.includes('UPDATE app_user'))
  const memberUpdate = fixture.calls.find(({ text }) => text.includes('UPDATE member'))
  assert.ok(appUserUpdate)
  assert.ok(memberUpdate)
  assert.deepEqual(memberUpdate.params, [
    '42',
    'Morgan',
    'Lee Rivera',
    'morgan@example.test',
    '555-0112',
    'morgan-rivera',
    '12 Canonical Lane',
    12,
    7,
  ])
  assert.equal(fixture.calls.some(({ text }) => text === 'COMMIT'), true)
  assert.equal(fixture.calls.some(({ text }) => text === 'ROLLBACK'), false)
  assert.equal(fixture.wasReleased(), true)
})

test('staff profile updates roll back app_user changes when linked member sync fails', async () => {
  const fixture = ownerProfilePool({
    actorUserId: 9,
    ownerUserId: 9,
    linkedMemberId: 42,
    failMemberUpdate: true,
  })
  const response = await invokeOwnerProfileRoute(createOwnerProfileApp(fixture.pool), {
    actorUserId: 9,
    targetUserId: 12,
    body: { fullName: 'Atomic Failure' },
  })

  assert.equal(response.status, 500)
  assert.equal(fixture.calls.some(({ text }) => text.includes('UPDATE app_user')), true)
  assert.equal(fixture.calls.some(({ text }) => text.includes('UPDATE member')), true)
  assert.equal(fixture.calls.some(({ text }) => text === 'ROLLBACK'), true)
  assert.equal(fixture.calls.some(({ text }) => text === 'COMMIT'), false)
  assert.equal(fixture.wasReleased(), true)
})

test('permission and suspension routes are facility-scoped while profile identity sync is canonical', async () => {
  const source = await fs.readFile(new URL('../registerRoutes.js', import.meta.url), 'utf8')
  const permissionReadStart = source.indexOf("app.get('/api/admin/access/users/:userId/permissions'")
  const roleMutationStart = source.indexOf("app.put('/api/admin/access/users/:userId/roles'")
  const permissionStart = source.indexOf("app.put('/api/admin/access/users/:userId/permissions'")
  const activeStart = source.indexOf("app.patch('/api/admin/access/users/:userId/active'")
  const profileStart = source.indexOf("app.put('/api/admin/access/users/:userId'")
  const deleteStart = source.indexOf("app.delete('/api/admin/access/users/:userId'")
  const permissionReadBlock = source.slice(permissionReadStart, roleMutationStart)
  const permissionBlock = source.slice(permissionStart, activeStart)
  const activeBlock = source.slice(activeStart, profileStart)
  const profileBlock = source.slice(profileStart, deleteStart)
  const deleteBlock = source.slice(deleteStart, source.indexOf("app.get('/api/admin/coaches'", deleteStart))
  const deleteHelper = source.slice(
    source.indexOf('async function deleteAppUserCompletely'),
    source.indexOf('export async function loadBillingAccountForFacility'),
  )

  assert.match(permissionReadBlock, /id = \$1 AND facility_id = \$2/)
  assert.match(permissionBlock, /id = \$1 AND facility_id = \$2/)
  assert.match(permissionBlock, /const client = await pool\.connect\(\)/)
  assert.match(permissionBlock, /await client\.query\('BEGIN'\)/)
  assert.doesNotMatch(permissionBlock, /await pool\.query\('BEGIN'\)/)
  assert.match(activeBlock, /id = \$1 AND facility_id = \$2/)
  assert.match(activeBlock, /SELECT is_active FROM app_user/)
  assert.match(activeBlock, /SET staff_access_active = \$3/)
  assert.match(activeBlock, /WHERE id = \$1\s+AND facility_id = \$2/)
  assert.match(activeBlock, /const client = await pool\.connect\(\)/)
  assert.match(activeBlock, /await client\.query\('BEGIN'\)/)
  assert.match(activeBlock, /await client\.query\('COMMIT'\)/)
  assert.match(activeBlock, /LOGIN_ACCOUNT_INACTIVE/)
  assert.match(
    activeBlock,
    /isFacilityOwnerUser\(pool, userId, req\.platformAuth\.user\.facility_id\)/,
  )
  assert.doesNotMatch(activeBlock, /UPDATE member/)
  assert.doesNotMatch(activeBlock, /SET is_active = \$3/)
  assert.match(profileBlock, /const client = await pool\.connect\(\)/)
  assert.match(profileBlock, /await client\.query\('BEGIN'\)/)
  assert.match(profileBlock, /await client\.query\('COMMIT'\)/)
  assert.match(profileBlock, /FROM member[\s\S]*app_user_id = \$1[\s\S]*facility_id = \$2[\s\S]*FOR UPDATE/)
  assert.match(profileBlock, /UPDATE member[\s\S]*first_name = \$2,[\s\S]*last_name = \$3,[\s\S]*email = \$4,[\s\S]*phone = \$5,[\s\S]*username = \$6,[\s\S]*address = \$7/)
  assert.match(profileBlock, /facility\.owner_user_id = account\.id/)
  assert.match(profileBlock, /existing\.rows\[0\]\.is_owner === true/)
  assert.match(profileBlock, /userId !== actorUserId/)
  assert.match(profileBlock, /OWNER_SELF_EDIT_REQUIRED/)
  assert.match(profileBlock, /LOWER\(BTRIM\(email\)\) = LOWER\(BTRIM\(\$2\)\)/)
  assert.match(profileBlock, /LOWER\(BTRIM\(username\)\) = LOWER\(BTRIM\(\$3\)\)/)
  assert.match(profileBlock, /WHERE id = \$\$\{userIdParam\}\s+AND facility_id = \$\$\{facilityIdParam\}/)
  assert.match(profileBlock, /error\?\.code === '23505'/)
  assert.match(deleteBlock, /isFacilityOwnerUser\(pool, userId, req\.platformAuth\.user\.facility_id\)/)
  assert.match(deleteHelper, /WHERE id = \$1\s+AND facility_id = \$2\s+FOR UPDATE/)
  assert.match(deleteHelper, /linked to a member.*Member Portal login are preserved/s)
  assert.doesNotMatch(deleteHelper, /DELETE FROM member/)
  assert.doesNotMatch(source, /['"][^'"\n]*(?:master admin|master administrator)[^'"\n]*['"]/i)
  assert.match(source, /Only the facility Owner can perform this action\./)
  assert.match(source, /Administrator role for other staff/)
})
