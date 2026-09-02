import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMemberCustomerBillingAccess,
  decodeMemberBillingTransactionCursor,
  encodeMemberBillingTransactionCursor,
  linkedPlatformMemberId,
  loadAuthenticatedPlatformUser,
  normalizeMemberBillingIdempotencyKey,
  resolveActiveMemberBillingFamilyId,
} from '../registerRoutes.js'

test('active family members can view household billing while payer capabilities stay payer-only', () => {
  const account = { payer_member_id: '74', is_active: true }

  assert.deepEqual(buildMemberCustomerBillingAccess(account, 74, true), {
    viewerMemberId: 74,
    canViewHousehold: true,
    canManagePayments: true,
    canManagePaymentMethod: true,
  })
  assert.deepEqual(buildMemberCustomerBillingAccess(account, 75, true), {
    viewerMemberId: 75,
    canViewHousehold: true,
    canManagePayments: false,
    canManagePaymentMethod: false,
  })
})

test('inactive or unrelated viewers receive no household billing capabilities', () => {
  assert.deepEqual(buildMemberCustomerBillingAccess({ payer_member_id: '74', is_active: true }, 74, false), {
    viewerMemberId: 74,
    canViewHousehold: false,
    canManagePayments: false,
    canManagePaymentMethod: false,
  })
  assert.deepEqual(buildMemberCustomerBillingAccess(null, 74, true), {
    viewerMemberId: 74,
    canViewHousehold: false,
    canManagePayments: false,
    canManagePaymentMethod: false,
  })
  assert.deepEqual(buildMemberCustomerBillingAccess({ payer_member_id: '74', is_active: false }, 74, true), {
    viewerMemberId: 74,
    canViewHousehold: false,
    canManagePayments: false,
    canManagePaymentMethod: false,
  })
})

test('member balance checkout requires a URL-safe idempotency key', () => {
  assert.equal(
    normalizeMemberBillingIdempotencyKey('request_1234'),
    'member-balance-checkout:request_1234',
  )
  assert.throws(() => normalizeMemberBillingIdempotencyKey(null), /required/i)
  assert.throws(() => normalizeMemberBillingIdempotencyKey('too short'), /URL-safe/i)
  assert.throws(() => normalizeMemberBillingIdempotencyKey('x'.repeat(121)), /URL-safe/i)
})

test('member billing family identity is resolved from one active server-side household', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params })
      return { rows: [{ family_id: '42' }] }
    },
  }

  assert.equal(
    await resolveActiveMemberBillingFamilyId(pool, { memberId: 74, facilityId: 9 }),
    42,
  )
  assert.deepEqual(calls[0].params, [74, 9])
  assert.match(calls[0].sql, /family_member/)
  assert.match(calls[0].sql, /m\.is_active = TRUE/)
  assert.match(calls[0].sql, /LIMIT 2/)
})

test('ambiguous or invalid member billing family identity fails closed', async () => {
  const ambiguousPool = {
    async query() {
      return { rows: [{ family_id: 42 }, { family_id: 43 }] }
    },
  }

  assert.equal(
    await resolveActiveMemberBillingFamilyId(ambiguousPool, { memberId: 74, facilityId: 9 }),
    null,
  )
  assert.equal(
    await resolveActiveMemberBillingFamilyId(ambiguousPool, { memberId: 'invalid', facilityId: 9 }),
    null,
  )
})

test('platform auth resolves member identity only through an explicit app-user link', async () => {
  let captured = null
  const pool = {
    async query(sql, params) {
      captured = { sql, params }
      return {
        rows: [{
          user_id: 9,
          facility_id: 1,
          primary_storage_role: 'MEMBER_ATHLETE',
          storage_roles: ['MEMBER_ATHLETE'],
          staff_roles: [],
          member_id: 74,
          family_id: 42,
          member_portal_status: 'active',
          is_active: true,
          is_owner: false,
          can_access_admin_portal: false,
          can_access_coach_portal: false,
          can_access_member_portal: true,
        }],
      }
    },
  }

  const user = await loadAuthenticatedPlatformUser(pool, 9)
  assert.equal(user.member_id, 74)
  assert.deepEqual(captured.params, [9])
  assert.match(captured.sql, /v_app_user_access_context/)
  assert.match(captured.sql, /WHERE user_id = \$1/)
  assert.doesNotMatch(captured.sql, /admin_profile/)
  assert.doesNotMatch(captured.sql, /email\s*=/i)
  assert.equal(linkedPlatformMemberId({ user }), 74)
  assert.equal(linkedPlatformMemberId({ user: { id: 74, member_id: null } }), null)
})

test('member transaction cursors are signed and scoped to the server-selected account', () => {
  const cursor = Buffer.from(JSON.stringify({ runningBalanceCents: 12000 })).toString('base64url')
  const token = encodeMemberBillingTransactionCursor(cursor, {
    accountId: 42,
    jwtSecret: 'billing-test-secret',
  })

  assert.notEqual(token, cursor)
  assert.equal(
    decodeMemberBillingTransactionCursor(token, {
      accountId: 42,
      jwtSecret: 'billing-test-secret',
    }),
    cursor,
  )
  assert.throws(
    () => decodeMemberBillingTransactionCursor(`${token.slice(0, -1)}x`, {
      accountId: 42,
      jwtSecret: 'billing-test-secret',
    }),
    /invalid/i,
  )
  assert.throws(
    () => decodeMemberBillingTransactionCursor(token, {
      accountId: 43,
      jwtSecret: 'billing-test-secret',
    }),
    /invalid/i,
  )
})
