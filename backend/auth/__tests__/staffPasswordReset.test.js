import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import {
  StaffPasswordResetDeliveryError,
  resetStaffPasswordByEmail,
} from '../staffPasswordReset.js'

function resetPool({ user = null, users = null } = {}) {
  const events = []
  const client = {
    async query(sql, params = []) {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim()
      events.push({ sql: normalizedSql, params })
      if (normalizedSql.startsWith('SELECT account.id, account.email, account.full_name')) {
        return { rows: users ?? (user ? [user] : []) }
      }
      return { rows: [] }
    },
    release() {
      events.push({ sql: 'RELEASE', params: [] })
    },
  }
  return {
    events,
    pool: { async connect() { return client } },
  }
}

const account = {
  id: 42,
  email: 'staff@example.com',
  full_name: 'Morgan Vortex',
}

test('unknown staff reset is generic and selects canonical active staff under a row lock', async () => {
  const { pool, events } = resetPool()
  let sent = false

  const result = await resetStaffPasswordByEmail(pool, ' Missing@Example.com ', {
    createTemporaryPassword: () => 'TempPassword1',
    hashPassword: async () => 'hashed',
    sendTemporaryEmail: async () => {
      sent = true
      return { sent: true }
    },
  })

  assert.deepEqual(result, { accountFound: false, sent: false, userId: null })
  assert.equal(sent, false)
  assert.deepEqual(events.map((event) => event.sql), [
    'BEGIN',
    'SELECT account.id, account.email, account.full_name FROM app_user account JOIN v_app_user_access_context access ON access.user_id = account.id WHERE LOWER(BTRIM(account.email)) = $1 AND access.is_active = TRUE AND access.staff_access_active = TRUE AND ( access.can_access_admin_portal = TRUE OR access.can_access_coach_portal = TRUE ) ORDER BY account.id LIMIT 2 FOR UPDATE OF account',
    'COMMIT',
    'RELEASE',
  ])
  assert.deepEqual(events[1].params, ['missing@example.com'])
})

test('ambiguous normalized staff email does not reset either account', async () => {
  const { pool, events } = resetPool({
    users: [account, { ...account, id: 84 }],
  })
  let hashed = false
  let sent = false

  const result = await resetStaffPasswordByEmail(pool, account.email, {
    createTemporaryPassword: () => 'TempPassword1',
    hashPassword: async () => {
      hashed = true
      return 'hashed'
    },
    sendTemporaryEmail: async () => {
      sent = true
      return { sent: true }
    },
  })

  assert.deepEqual(result, { accountFound: false, sent: false, userId: null })
  assert.equal(hashed, false)
  assert.equal(sent, false)
  assert.equal(events.some((event) => event.sql.startsWith('UPDATE')), false)
  assert.equal(events.some((event) => event.sql === 'COMMIT'), true)
})

test('staff reset updates only app_user and commits after accepted delivery', async () => {
  const { pool, events } = resetPool({ user: account })

  const result = await resetStaffPasswordByEmail(pool, account.email, {
    createTemporaryPassword: () => 'TempPassword1',
    hashPassword: async (password) => `hash:${password}`,
    sendTemporaryEmail: async (mail) => {
      events.push({ sql: 'DELIVERY', params: [mail] })
      return { sent: true, messageId: 'message-1' }
    },
  })

  assert.deepEqual(result, { accountFound: true, sent: true, userId: 42 })
  const updates = events.filter((event) => event.sql.startsWith('UPDATE'))
  assert.equal(updates.length, 1)
  assert.match(updates[0].sql, /^UPDATE app_user SET password_hash = \$2/)
  assert.deepEqual(updates[0].params, [42, 'hash:TempPassword1'])
  assert.equal(events.some((event) => event.sql.startsWith('UPDATE member')), false)
  const statements = events.map((event) => event.sql)
  assert.ok(statements.indexOf('DELIVERY') > statements.findIndex((sql) => sql.startsWith('UPDATE app_user')))
  assert.ok(statements.indexOf('COMMIT') > statements.indexOf('DELIVERY'))
})

test('failed staff reset delivery throws a typed error and rolls back', async () => {
  const { pool, events } = resetPool({ user: account })

  await assert.rejects(
    () => resetStaffPasswordByEmail(pool, account.email, {
      createTemporaryPassword: () => 'TempPassword1',
      hashPassword: async () => 'hashed-temp-password',
      sendTemporaryEmail: async () => {
        const error = new Error('SMTP authentication failed')
        error.reason = 'auth_failed'
        throw error
      },
    }),
    (error) => {
      assert.ok(error instanceof StaffPasswordResetDeliveryError)
      assert.equal(error.code, 'STAFF_PASSWORD_RESET_DELIVERY_FAILED')
      assert.equal(error.reason, 'auth_failed')
      assert.equal(error.userId, 42)
      return true
    },
  )

  const statements = events.map((event) => event.sql)
  assert.equal(statements.includes('COMMIT'), false)
  assert.ok(statements.indexOf('ROLLBACK') > statements.findIndex((sql) => sql.startsWith('UPDATE app_user')))
})

test('skipped staff reset delivery is a typed failure and rolls back', async () => {
  const { pool, events } = resetPool({ user: account })

  await assert.rejects(
    () => resetStaffPasswordByEmail(pool, account.email, {
      createTemporaryPassword: () => 'TempPassword1',
      hashPassword: async () => 'hashed-temp-password',
      sendTemporaryEmail: async () => ({ sent: false, skipped: true, reason: 'category_disabled' }),
    }),
    (error) => {
      assert.ok(error instanceof StaffPasswordResetDeliveryError)
      assert.equal(error.reason, 'category_disabled')
      return true
    },
  )

  assert.equal(events.some((event) => event.sql === 'COMMIT'), false)
  assert.equal(events.some((event) => event.sql === 'ROLLBACK'), true)
})

test('admin staff reset route is public, rate limited, email-only, and service-backed', async () => {
  const source = await fs.readFile(new URL('../../server.js', import.meta.url), 'utf8')
  const middlewareStart = source.indexOf("app.use('/api/admin', async (req, res, next) => {")
  const middlewareEnd = source.indexOf('// Analytics & consent', middlewareStart)
  const middleware = source.slice(middlewareStart, middlewareEnd)
  const publicResetCheck = middleware.indexOf("req.path === '/request-password-reset'")
  const authentication = middleware.indexOf('return authenticateCanonicalAdmin')

  assert.ok(publicResetCheck >= 0 && publicResetCheck < authentication)
  assert.match(middleware, /req\.originalUrl === '\/api\/admin\/request-password-reset'/)
  assert.match(middleware.slice(publicResetCheck, authentication), /req\.method === 'POST'/)
  assert.match(middleware.slice(publicResetCheck, authentication), /return next\(\)/)

  const routeStart = source.indexOf("app.post('/api/admin/request-password-reset'")
  const routeEnd = source.indexOf('// Retired legacy staff directory', routeStart)
  const route = source.slice(routeStart, routeEnd)
  assert.match(route, /^app\.post\('\/api\/admin\/request-password-reset', passwordResetLimiter,/)
  assert.match(route, /resetStaffPasswordByEmail\(pool, value\.email\)/)
  assert.match(route, /error instanceof StaffPasswordResetDeliveryError/)
  assert.match(route, /If a staff account exists for that email/)
  assert.doesNotMatch(route, /req\.body\?\.id|req\.body\.id|targetId|userId\s*=/)
  assert.doesNotMatch(route, /UPDATE app_user|generateTemporaryPassword|bcrypt\.hash/)
})
