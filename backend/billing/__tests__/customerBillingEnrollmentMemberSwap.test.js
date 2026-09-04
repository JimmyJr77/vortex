import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeCustomerBillingEnrollmentMemberSwapInput,
  reassignCustomerBillingEnrollmentMember,
} from '../customerBillingEnrollmentMemberSwap.js'

test('a member reassignment requires a valid target family member', () => {
  assert.deepEqual(
    normalizeCustomerBillingEnrollmentMemberSwapInput({ targetMemberId: 42 }),
    { targetMemberId: 42 },
  )
  assert.throws(
    () => normalizeCustomerBillingEnrollmentMemberSwapInput({ targetMemberId: 'none' }),
    /family member/i,
  )
})

test('a member reassignment changes only the enrollment identity and writes an audit event', async () => {
  const calls = []
  const client = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text === 'BEGIN' || text === 'COMMIT' || text.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [] }
      if (text.includes('FROM billing_account_activity') && text.includes('FOR UPDATE')) return { rows: [] }
      if (text.includes('FROM scheduling_signup signup')) {
        return {
          rows: [{
            signup_id: 301,
            source_member_id: 11,
            signup_status: 'confirmed',
            cancel_effective_date: null,
            enrollment_start_date: '2026-05-10',
            created_at: '2026-05-10T12:00:00.000Z',
            first_name: 'Alex',
            last_name: 'Stone',
            email: 'alex@example.com',
            phone: '555-0100',
            field_responses: { first_name: 'Alex', last_name: 'Stone', answer: 'kept' },
            responses: { first_name: 'Alex', last_name: 'Stone', answer: 'kept' },
            family_id: 71,
            facility_id: 9,
            account_id: 501,
            class_name: 'Tumbling I',
          }],
        }
      }
      if (text.includes('FROM member') && text.includes('FOR KEY SHARE')) {
        return { rows: [{ id: 22, family_id: 71, first_name: 'Blair', last_name: 'Stone', email: 'blair@example.com', phone: '555-0122', is_active: true }] }
      }
      if (text.includes('UPDATE scheduling_signup')) {
        return { rows: [{ id: 301, member_id: 22, enrollment_start_date: '2026-05-10', created_at: '2026-05-10T12:00:00.000Z' }] }
      }
      if (text.includes('INSERT INTO billing_account_activity')) return { rows: [{ id: 900 }] }
      throw new Error(`Unexpected query: ${text}`)
    },
    release() {},
  }
  const pool = { async connect() { return client } }

  const result = await reassignCustomerBillingEnrollmentMember(pool, {
    signupId: 301,
    facilityId: 9,
    actorUserId: 7,
    requestKey: 'enrollment-member-swap:test-key',
    input: { targetMemberId: 22 },
  })

  assert.deepEqual(result, {
    signupId: 301,
    previousMemberId: 11,
    previousMemberName: 'Alex Stone',
    memberId: 22,
    memberName: 'Blair Stone',
    enrollmentStartDate: '2026-05-10',
    createdAt: '2026-05-10T12:00:00.000Z',
    replayed: false,
  })

  const enrollmentUpdate = calls.find((call) => call.text.includes('UPDATE scheduling_signup'))
  assert.ok(enrollmentUpdate)
  assert.doesNotMatch(enrollmentUpdate.text, /enrollment_start_date\s*=/i)
  assert.deepEqual(JSON.parse(enrollmentUpdate.params[6]), {
    first_name: 'Blair', last_name: 'Stone', email: 'blair@example.com', phone: '555-0122', answer: 'kept',
  })
  assert.equal(calls.some((call) => /UPDATE\s+billing_subscription|INSERT\s+INTO\s+billing_charge|UPDATE\s+billing_charge/i.test(call.text)), false)
  const activity = calls.find((call) => call.text.includes('INSERT INTO billing_account_activity'))
  assert.ok(activity)
  assert.equal(activity.params[7], 'enrollment_member_reassigned')
  assert.match(activity.params[8], /Billing was not changed/)
})
