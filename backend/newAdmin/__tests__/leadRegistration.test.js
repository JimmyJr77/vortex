import assert from 'node:assert/strict'
import test from 'node:test'
import { invitationSummary } from '../leadRegistration.js'
import { registerNewAdminRoutes } from '../registerRoutes.js'

test('invitation editing exposes saved details and revision without temporary credentials', () => {
  const guardian = { firstName: 'Test', email: 'test@example.test' }
  const summary = invitationSummary({ id: 1, expires_at: '2099-01-01', delivery_status: 'sent',
    token_hash: 'secret', token_ciphertext: 'secret', temporary_password_hash: 'secret',
    pending_payload: { guardian, children: [], selections: [], instructions: 'Review your classes', passwordCiphertext: 'secret', revision: 2 },
  })
  assert.equal(summary.revision, 2)
  assert.equal(summary.instructions, 'Review your classes')
  assert.deepEqual(summary.guardian, guardian)
  assert.ok(!JSON.stringify(summary).includes('secret'))
})

test('editing invitation route requires member edit access before loading or writing data', async () => {
  let authorize
  const app = { use() {}, get() {}, post() {}, delete() {}, put() {}, patch(path, ...chain) {
    if (path === '/api/admin/new-admin/lead-registration/:id') authorize = chain[0]
  } }
  registerNewAdminRoutes(app, { query: () => assert.fail('Unauthorized edits must not query data') }, { jwtSecret: 'test-only' })
  assert.equal(typeof authorize, 'function')
  const req = { canonicalAccess: { portalAccess: { admin: true }, facilityId: 1 }, newAdminPermissions: new Map([['members.edit', Promise.resolve(false)]]) }
  const res = { status(code) { this.statusCode = code; return this }, json(body) { this.body = body } }
  await authorize(req, res, () => assert.fail('Unauthorized edits must not reach handler'))
  assert.equal(res.statusCode, 403)
  assert.match(res.body.message, /members.edit/)
})
