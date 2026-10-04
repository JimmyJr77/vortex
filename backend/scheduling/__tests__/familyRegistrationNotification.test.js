import test from 'node:test'
import assert from 'node:assert/strict'
import { notifyFamilyEnrollmentRegistrations } from '../registrationNotificationEmail.js'

test('family alerts group by athlete, ignore missing signup IDs, and isolate failures', async () => {
  const calls = []
  const warnings = []
  await notifyFamilyEnrollmentRegistrations({}, [
    { memberId: 1, schedulingSignupId: 11 },
    { memberId: 1, schedulingSignupId: 12 },
    { memberId: 1, schedulingSignupId: 11 },
    { memberId: 2, schedulingSignupId: 13 },
    { memberId: 3, schedulingSignupId: null },
  ], {
    send: async (_pool, input) => {
      calls.push(input.signupIds)
      if (calls.length === 1) throw new Error('SMTP unavailable')
      return { sent: true }
    },
    logger: { warn: (...args) => warnings.push(args) },
  })
  assert.deepEqual(calls, [[11, 12], [13]])
  assert.equal(warnings.length, 1)
})
