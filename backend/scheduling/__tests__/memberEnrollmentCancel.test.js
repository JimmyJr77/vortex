import test from 'node:test'
import assert from 'node:assert/strict'
import {
  nextEnrollmentBillingChangeDate,
  requestMemberEnrollmentCancellation,
} from '../memberEnrollmentCancel.js'
import { firstOfNextMonth } from '../firstMonthProration.js'
import { billingDateToUnixStart } from '../../billing/stripeSubscriptionSync.js'

test('nextEnrollmentBillingChangeDate is the 1st of the next month', () => {
  assert.equal(nextEnrollmentBillingChangeDate('2026-07-08'), '2026-08-01')
  assert.equal(nextEnrollmentBillingChangeDate('2026-07-01'), '2026-08-01')
  assert.equal(nextEnrollmentBillingChangeDate('2026-12-15'), '2027-01-01')
  assert.equal(nextEnrollmentBillingChangeDate('2026-07-08'), firstOfNextMonth('2026-07-08'))
})

test('billingDateToUnixStart converts YYYY-MM-DD to UTC midnight unix', () => {
  assert.equal(billingDateToUnixStart('2026-08-01'), 1785542400)
})

function mockPool(state) {
  const client = {
    query: async (sql, params = []) => {
      const text = String(sql)
      if (
        text.includes('BEGIN')
        || text.includes('COMMIT')
        || text.includes('ROLLBACK')
        || text.startsWith('SAVEPOINT')
        || text.startsWith('RELEASE SAVEPOINT')
      ) {
        return { rows: [] }
      }
      if (text.includes('FROM scheduling_signup s') && text.includes('WHERE s.id = $1')) {
        return { rows: state.signup ? [state.signup] : [] }
      }
      if (text.includes('FROM enrollment_cancellation_request')) return { rows: [] }
      if (text.includes('INSERT INTO enrollment_cancellation_request')) {
        state.request = { id: 91, signup_id: params[0], recommended_effective_date: params[4] }
        return { rows: [{ id: 91 }] }
      }
      if (text.includes('UPDATE scheduling_signup') && text.includes('cancel_effective_date')) {
        state.signup = { ...state.signup, cancel_effective_date: params[1] }
        return { rows: [] }
      }
      if (text.includes('UPDATE scheduling_signup') && text.includes("SET status = 'cancelled'")) {
        state.signup = { ...state.signup, status: 'cancelled', cancel_effective_date: null }
        return { rows: [{ id: state.signup.id }] }
      }
      if (text.includes('FROM billing_subscription')) {
        return { rows: [] }
      }
      if (text.includes('UPDATE billing_subscription')) {
        return { rows: [] }
      }
      if (text.includes('FROM member WHERE id')) {
        return { rows: [{ family_id: 3 }] }
      }
      if (text.includes('ALTER TABLE')) return { rows: [] }
      if (text.includes('DROP CONSTRAINT')) return { rows: [] }
      if (text.includes('ADD CONSTRAINT')) return { rows: [] }
      if (text.includes('information_schema.columns')) return { rows: [{ n: 2 }] }
      if (text.includes('pg_constraint')) return { rows: [] }
      return { rows: [] }
    },
    release: () => {},
  }

  return {
    query: client.query,
    connect: async () => client,
  }
}

test('requestMemberEnrollmentCancellation queues billing review without changing access', async () => {
  const state = {
    signup: {
      id: 42,
      member_id: 7,
      status: 'confirmed',
      slot_group_id: 3,
      cancel_effective_date: null,
      orphaned_at: null,
    },
  }
  const pool = mockPool(state)

  const result = await requestMemberEnrollmentCancellation(pool, {
    signupId: 42,
    allowedMemberIds: [7],
  })

  assert.equal(result.immediate, false)
  assert.equal(result.pendingReview, true)
  assert.equal(result.requestId, 91)
  assert.equal(result.effectiveDate, nextEnrollmentBillingChangeDate())
  assert.equal(state.signup?.cancel_effective_date, null)
  assert.equal(state.request?.recommended_effective_date, result.effectiveDate)
})

test('requestMemberEnrollmentCancellation cancels waitlisted signups immediately', async () => {
  const state = {
    signup: {
      id: 55,
      member_id: 7,
      status: 'waitlisted',
      slot_group_id: 3,
      cancel_effective_date: null,
      orphaned_at: null,
    },
  }
  const pool = mockPool(state)

  const result = await requestMemberEnrollmentCancellation(pool, {
    signupId: 55,
    allowedMemberIds: [7],
  })

  assert.equal(result.immediate, true)
  assert.equal(result.effectiveDate, null)
})

test('requestMemberEnrollmentCancellation rejects unauthorized members', async () => {
  const pool = mockPool({
    signup: {
      id: 42,
      member_id: 99,
      status: 'confirmed',
      slot_group_id: 3,
      cancel_effective_date: null,
      orphaned_at: null,
    },
  })

  await assert.rejects(
    () =>
      requestMemberEnrollmentCancellation(pool, {
        signupId: 42,
        allowedMemberIds: [7],
      }),
    (err) => err.statusCode === 403,
  )
})
