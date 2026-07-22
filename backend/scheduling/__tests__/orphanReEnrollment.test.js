import test from 'node:test'
import assert from 'node:assert/strict'

import { createSchedulingHandlers } from '../handlers.js'

test('re-enrollment retry returns the existing replacement without creating a duplicate', async () => {
  const queries = []
  let released = false
  const existing = {
    id: 49,
    form_id: 3,
    member_id: 41,
    slot_group_id: 203,
    time_slot_id: 901,
    status: 'confirmed',
    responses: {},
  }
  const client = {
    async query(sql) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim()
      queries.push(normalized)
      if (normalized === 'BEGIN' || normalized === 'COMMIT') return { rows: [] }
      if (normalized.includes('FOR UPDATE')) {
        return {
          rows: [{
            id: 48,
            orphaned_at: new Date(),
            re_enrolled_at: new Date(),
            re_enrolled_signup_id: 49,
          }],
        }
      }
      if (normalized === 'SELECT * FROM scheduling_signup WHERE id = $1') {
        return { rows: [existing] }
      }
      if (normalized.startsWith('SELECT max_participants')) {
        return { rows: [{ max_participants: 8 }] }
      }
      if (normalized === 'SELECT status FROM scheduling_signup WHERE id = $1') {
        return { rows: [{ status: 'confirmed' }] }
      }
      if (normalized.includes('SELECT rn FROM')) return { rows: [{ rn: 1 }] }
      throw new Error(`Unexpected query: ${normalized}`)
    },
    release() {
      released = true
    },
  }
  const pool = { async connect() { return client } }
  const handler = createSchedulingHandlers(pool).reEnrollOrphanedSignup
  let statusCode = 200
  let payload = null
  const res = {
    status(code) {
      statusCode = code
      return this
    },
    json(body) {
      payload = body
      return body
    },
  }

  await handler(
    { params: { id: '48' }, body: { targetFormId: 3, slotGroupId: 203 } },
    res,
  )

  assert.equal(statusCode, 200)
  assert.equal(payload.success, true)
  assert.equal(payload.message, 'Athlete is already re-enrolled.')
  assert.equal(payload.data.id, 49)
  assert.equal(payload.data.signupNumber, 1)
  assert.equal(released, true)
  assert.equal(queries.some((query) => /\bINSERT\b/.test(query)), false)
})
