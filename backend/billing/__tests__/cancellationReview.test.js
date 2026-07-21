import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewCancellationRequest } from '../cancellationReview.js'

function mockPool(request) {
  const calls = []
  const client = {
    query: async (sql, params = []) => {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('SELECT * FROM enrollment_cancellation_request')) return { rows: request ? [request] : [] }
      if (text.includes('UPDATE enrollment_cancellation_request')) {
        return { rows: [{ ...request, status: params[1], approved_effective_date: params[2], review_note: params[3] }] }
      }
      return { rows: [] }
    },
    release() {},
  }
  return { pool: { connect: async () => client, query: client.query }, calls }
}

test('approval schedules enrollment and subscription end without immediate cancellation', async () => {
  const { pool, calls } = mockPool({
    id: 8, signup_id: 42, status: 'pending', recommended_effective_date: '2026-08-01',
  })
  const result = await reviewCancellationRequest(pool, {
    requestId: 8, decision: 'approved', reviewNote: 'Recurring membership; end paid period.', reviewedByUserId: 3,
  })
  assert.equal(result.status, 'approved')
  assert.equal(result.approved_effective_date, '2026-08-01')
  assert.ok(calls.some(({ text }) => text.includes('UPDATE scheduling_signup') && text.includes('cancel_effective_date')))
  assert.ok(calls.some(({ text }) => text.includes('UPDATE billing_subscription') && text.includes('next_bill_date = NULL')))
  assert.ok(!calls.some(({ text }) => text.includes("SET status = 'cancelled'")))
})

test('decline records the decision without changing enrollment or subscription', async () => {
  const { pool, calls } = mockPool({
    id: 9, signup_id: 43, status: 'pending', recommended_effective_date: '2026-08-01',
  })
  const result = await reviewCancellationRequest(pool, {
    requestId: 9, decision: 'declined', reviewNote: 'Fixed-term commitment requires follow-up.', reviewedByUserId: 3,
  })
  assert.equal(result.status, 'declined')
  assert.ok(!calls.some(({ text }) => text.includes('UPDATE scheduling_signup')))
  assert.ok(!calls.some(({ text }) => text.includes('UPDATE billing_subscription')))
})

test('review requires a staff note', async () => {
  const { pool } = mockPool({ id: 9, signup_id: 43, status: 'pending', recommended_effective_date: '2026-08-01' })
  await assert.rejects(
    () => reviewCancellationRequest(pool, { requestId: 9, decision: 'approved', reviewNote: '' }),
    /review note is required/i,
  )
})
