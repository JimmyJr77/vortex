import assert from 'node:assert/strict'
import test from 'node:test'
import bcrypt from 'bcryptjs'
import { createSchedulingHandlers } from '../handlers.js'

test('signup password resets use the linked login address and commit only after delivery', async () => {
  const member = {
    id: 17,
    facility_id: 3,
    app_user_id: 29,
    first_name: 'Jordan',
    email: 'stale-member@example.test',
    username: 'old-username',
  }
  const events = []
  let stagedHash
  let deliveryAccepted = false
  const client = {
    async query(sql, params) {
      const query = sql.trim()
      events.push(query)
      if (query.startsWith('SELECT *')) return { rows: [{ ...member }] }
      if (query.startsWith('UPDATE app_user')) {
        stagedHash = params[0]
        assert.deepEqual(params.slice(1), [29, 3, false, false])
        return { rows: [{ id: 29, email: 'canonical-login@example.test' }] }
      }
      return { rows: [] }
    },
    release() {},
  }
  const pool = {
    async query(sql, params) {
      assert.match(sql, /member\.facility_id = \$2/)
      assert.deepEqual(params, ['42', 3])
      return { rows: [{ member_id: 17 }] }
    },
    async connect() { return client },
  }
  const handler = createSchedulingHandlers(pool, {
    async sendTemporaryEmail(mail) {
      events.push('SEND')
      assert.equal(mail.registrantEmail, 'canonical-login@example.test')
      assert.equal(await bcrypt.compare(mail.temporaryPassword, stagedHash), true)
      return { sent: deliveryAccepted }
    },
  }).updateSignupMemberPassword
  const req = { params: { id: '42' }, body: { mode: 'email_temp' }, canonicalAccess: { facilityId: 3 } }
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body } }

  await handler(req, res)
  assert.equal(res.statusCode, 503)
  assert.equal(res.body.success, false)
  assert.deepEqual(events.slice(-2), ['SEND', 'ROLLBACK'])
  assert.equal(events.includes('COMMIT'), false)

  events.length = 0
  res.statusCode = 200
  deliveryAccepted = true
  await handler(req, res)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.success, true)
  assert.deepEqual(events.slice(-2), ['SEND', 'COMMIT'])
})
