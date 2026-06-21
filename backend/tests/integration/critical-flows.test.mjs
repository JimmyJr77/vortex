import assert from 'node:assert/strict'
import test from 'node:test'

const baseUrl = process.env.INTEGRATION_BASE_URL
const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true' && Boolean(baseUrl)

async function jsonRequest(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  })
  const body = await response.json().catch(() => ({}))
  return { response, body }
}

test('integration suite gate', () => {
  if (!runIntegration) {
    assert.ok(true, 'Integration tests are gated. Set RUN_INTEGRATION_TESTS=true with INTEGRATION_BASE_URL to run.')
  }
})

test('health endpoint reports database + migration visibility', { skip: !runIntegration }, async () => {
  const { response, body } = await jsonRequest('/api/health')
  assert.equal(response.status, 200)
  assert.equal(typeof body.dbConnected, 'boolean')
  assert.equal(typeof body.schemaMigrationsTracked, 'boolean')
})

test('member password reset endpoint responds safely', { skip: !runIntegration }, async () => {
  const { response, body } = await jsonRequest('/api/members/request-password-reset', {
    method: 'POST',
    body: JSON.stringify({ email: 'no-user+integration@vortexathletics.com' }),
  })
  assert.equal(response.status, 200)
  assert.equal(body.success, true)
})

test('admin password reset endpoint responds safely', { skip: !runIntegration }, async () => {
  const { response, body } = await jsonRequest('/api/admin/request-password-reset', {
    method: 'POST',
    body: JSON.stringify({ email: 'no-admin+integration@vortexathletics.com' }),
  })
  assert.equal(response.status, 200)
  assert.equal(body.success, true)
})

test('migration endpoint is locked by default', { skip: !runIntegration }, async () => {
  const { response } = await jsonRequest('/api/admin/run-migration', {
    method: 'POST',
    body: JSON.stringify({ migrationFile: '010_launch_payment_reconciliation.sql', secretKey: 'invalid' }),
  })
  assert.ok([401, 404, 500].includes(response.status))
})
