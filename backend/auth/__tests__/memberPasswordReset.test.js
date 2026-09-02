import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MemberPasswordResetDeliveryError,
  resetMemberPasswordByEmail,
} from '../memberPasswordReset.js'
import { sendTemporaryPasswordEmail } from '../../scheduling/tempPasswordEmail.js'

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
  email: 'member@example.com',
  full_name: 'Morgan Vortex',
}

test('unknown member reset returns generic no-account result without sending', async () => {
  const { pool, events } = resetPool()
  let sent = false

  const result = await resetMemberPasswordByEmail(pool, 'Missing@Example.com ', {
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
    'SELECT account.id, account.email, account.full_name FROM app_user account JOIN member linked_member ON linked_member.app_user_id = account.id AND linked_member.facility_id = account.facility_id WHERE LOWER(BTRIM(account.email)) = $1 AND account.is_active = TRUE AND account.member_portal_access_active = TRUE AND linked_member.is_active = TRUE ORDER BY account.id LIMIT 2 FOR UPDATE',
    'COMMIT',
    'RELEASE',
  ])
  assert.deepEqual(events[1].params, ['missing@example.com'])
})

test('ambiguous cross-facility email does not reset either login', async () => {
  const { pool, events } = resetPool({
    users: [account, { ...account, id: 84 }],
  })
  let sent = false

  const result = await resetMemberPasswordByEmail(pool, account.email, {
    createTemporaryPassword: () => 'TempPassword1',
    hashPassword: async () => 'hashed',
    sendTemporaryEmail: async () => {
      sent = true
      return { sent: true }
    },
  })

  assert.deepEqual(result, { accountFound: false, sent: false, userId: null })
  assert.equal(sent, false)
  assert.equal(events.some((event) => event.sql.startsWith('UPDATE app_user')), false)
  assert.equal(events.some((event) => event.sql.startsWith('UPDATE member')), false)
  assert.equal(events.some((event) => event.sql === 'COMMIT'), true)
})

test('delivery failure rolls back the temporary password update', async () => {
  const { pool, events } = resetPool({ user: account })

  await assert.rejects(
    () => resetMemberPasswordByEmail(pool, account.email, {
      createTemporaryPassword: () => 'TempPassword1',
      hashPassword: async () => 'hashed-temp-password',
      sendTemporaryEmail: async () => {
        const error = new Error('SMTP authentication failed')
        error.reason = 'auth_failed'
        throw error
      },
    }),
    (error) => {
      assert.ok(error instanceof MemberPasswordResetDeliveryError)
      assert.equal(error.reason, 'auth_failed')
      assert.equal(error.userId, 42)
      return true
    },
  )

  const statements = events.map((event) => event.sql)
  assert.ok(statements.some((sql) => sql.startsWith('UPDATE app_user')))
  assert.ok(statements.some((sql) => sql.startsWith('UPDATE member')))
  assert.equal(statements.includes('COMMIT'), false)
  const memberUpdateIndex = statements.findIndex((sql) => sql.startsWith('UPDATE member'))
  assert.ok(statements.indexOf('ROLLBACK') > memberUpdateIndex)
})

test('a policy skip is a delivery failure and rolls back', async () => {
  const { pool, events } = resetPool({ user: account })

  await assert.rejects(
    () => resetMemberPasswordByEmail(pool, account.email, {
      createTemporaryPassword: () => 'TempPassword1',
      hashPassword: async () => 'hashed-temp-password',
      sendTemporaryEmail: async () => ({ sent: false, skipped: true, reason: 'category_disabled' }),
    }),
    (error) => {
      assert.ok(error instanceof MemberPasswordResetDeliveryError)
      assert.equal(error.reason, 'category_disabled')
      return true
    },
  )

  assert.equal(events.some((event) => event.sql === 'COMMIT'), false)
  assert.equal(events.some((event) => event.sql === 'ROLLBACK'), true)
})

test('accepted email commits the password and forces a change at login', async () => {
  const { pool, events } = resetPool({ user: account })
  let deliveredPassword = null

  const result = await resetMemberPasswordByEmail(pool, account.email, {
    createTemporaryPassword: () => 'TempPassword1',
    hashPassword: async (password) => `hash:${password}`,
    sendTemporaryEmail: async (mail) => {
      deliveredPassword = mail.temporaryPassword
      return { sent: true, messageId: 'message-1' }
    },
  })

  assert.deepEqual(result, { accountFound: true, sent: true, userId: 42 })
  assert.equal(deliveredPassword, 'TempPassword1')
  const appUserUpdate = events.find((event) => event.sql.startsWith('UPDATE app_user'))
  assert.deepEqual(appUserUpdate.params, [42, 'hash:TempPassword1'])
  assert.ok(events.find((event) => event.sql.startsWith('UPDATE member')))
  assert.ok(events.findIndex((event) => event.sql === 'COMMIT') > events.findIndex((event) => event.sql.startsWith('UPDATE member')))
})

test('temporary-password email bypasses generic cooldown and rejects skipped delivery', async () => {
  let outgoing = null
  await assert.rejects(
    () => sendTemporaryPasswordEmail({
      registrantFirstName: 'Morgan',
      registrantEmail: account.email,
      temporaryPassword: 'TempPassword1',
    }, {
      send: async (mail) => {
        outgoing = mail
        return { sent: false, skipped: true, reason: 'suppressed' }
      },
    }),
    (error) => {
      assert.equal(error.code, 'TEMPORARY_PASSWORD_EMAIL_NOT_SENT')
      assert.equal(error.reason, 'suppressed')
      return true
    },
  )

  assert.equal(outgoing.category, 'password_reset')
  assert.equal(outgoing.skipPolicy, true)
})
