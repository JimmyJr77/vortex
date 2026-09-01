import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMemberCustomerBillingAccess,
  decodeMemberBillingTransactionCursor,
  encodeMemberBillingTransactionCursor,
  linkedPlatformMemberId,
  loadAuthenticatedPlatformUser,
  memberBillingReadV2Enabled,
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

test('legacy member billing rollback is disabled after legacy endpoints are retired', () => {
  assert.throws(
    () => memberBillingReadV2Enabled({
      BILLING_CANONICAL_READ_MODE: 'invalid',
      BILLING_LEGACY_ENDPOINTS_MODE: 'gone',
    }),
    /BILLING_CANONICAL_READ_MODE/,
  )
  assert.equal(memberBillingReadV2Enabled({
    MEMBER_BILLING_READ_V2: 'true',
    BILLING_CANONICAL_READ_MODE: 'off',
  }), false)
  assert.equal(memberBillingReadV2Enabled({
    MEMBER_BILLING_READ_V2: 'true',
    BILLING_CANONICAL_READ_MODE: 'shadow',
  }), false)
  assert.equal(memberBillingReadV2Enabled({
    MEMBER_BILLING_READ_V2: 'true',
    BILLING_CANONICAL_READ_MODE: 'active',
  }), true)
  assert.equal(memberBillingReadV2Enabled({
    MEMBER_BILLING_READ_V2: 'false',
    BILLING_CANONICAL_READ_MODE: 'active',
  }), false)
  assert.equal(
    memberBillingReadV2Enabled({
      MEMBER_BILLING_READ_V2: 'false',
      BILLING_CANONICAL_READ_MODE: 'off',
      BILLING_LEGACY_ENDPOINTS_MODE: 'gone',
    }),
    true,
  )
})

test('platform auth resolves member identity only through an explicit app-user link', async () => {
  let captured = null
  const pool = {
    async query(sql, params) {
      captured = { sql, params }
      return {
        rows: [{ id: 9, member_id: 74, family_id: 42, is_active: true }],
      }
    },
  }

  const user = await loadAuthenticatedPlatformUser(pool, 9)
  assert.equal(user.member_id, 74)
  assert.deepEqual(captured.params, [9])
  assert.match(captured.sql, /LEFT JOIN LATERAL/)
  assert.match(captured.sql, /candidate\.app_user_id = au\.id/)
  assert.doesNotMatch(captured.sql, /candidate\.id = au\.id/)
  assert.doesNotMatch(captured.sql, /candidate\.app_user_id IS NULL/)
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
