import assert from 'node:assert/strict'
import test from 'node:test'
import { createSchedulingHandlers } from '../handlers.js'

function captureResponse() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body },
  }
}

const week = { startDate: '2026-11-16', endDate: '2026-11-22', formActive: 'active' }

test('admin calendar scopes its class query to the authenticated facility', async () => {
  const pool = {
    async query(sql, params) {
      if (sql.includes('information_schema')) return { rows: [] }
      assert.match(sql, /p\.facility_id = \$1/)
      assert.match(sql, /p\.is_active = TRUE/)
      assert.doesNotMatch(sql, /sf\.is_active = TRUE/)
      assert.deepEqual(params, [12])
      return { rows: [] }
    },
  }
  const res = captureResponse()
  await createSchedulingHandlers(pool).getAdminCalendar({
    canonicalAccess: { facilityId: 12 }, query: { ...week, facilityId: 50 },
  }, res)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.success, true)
})

test('admin calendar requires authenticated facility scope even when a query parameter is supplied', async () => {
  const res = captureResponse()
  await createSchedulingHandlers({}).getAdminCalendar({ query: { ...week, facilityId: 50 } }, res)
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.success, false)
})
