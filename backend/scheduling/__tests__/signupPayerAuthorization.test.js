import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import { resolveJwtSecret } from '../../auth/jwtSecret.js'
import { createSchedulingHandlers } from '../handlers.js'
import { registerSchedulingRoutes } from '../registerRoutes.js'
import {
  authorizeSignupBatchPayer,
  findExplicitlyLinkedSchedulingMember,
} from '../signupPayerAuthorization.js'
import { issueSignupAuthToken, verifySignupAuthToken } from '../signupAuth.js'

function responseCapture() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    },
  }
}

function registeredSchedulingHandler(pool, path) {
  const app = express()
  registerSchedulingRoutes(app, pool)
  const layer = app._router.stack.find((entry) => entry.route?.path === path)
  assert.ok(layer, `route ${path} must be registered`)
  return layer.route.stack.at(-1).handle
}

function authorityRow({
  targetFamilies = [20],
  actorFamilies = [20],
  accounts = [8],
  payers = [13],
} = {}) {
  return {
    target_member_id: 62,
    target_legacy_family_id: targetFamilies[0] ?? null,
    actor_member_id: 13,
    actor_legacy_family_id: actorFamilies[0] ?? null,
    target_membership_history_count: targetFamilies.length > 0 ? 1 : 0,
    actor_membership_history_count: actorFamilies.length > 0 ? 1 : 0,
    target_family_ids: targetFamilies,
    actor_family_ids: actorFamilies,
    active_account_ids: accounts,
    active_account_payer_ids: payers,
  }
}

test('explicit scheduling identity lookup never falls back to member id or email', async () => {
  let sqlText = ''
  const member = await findExplicitlyLinkedSchedulingMember({
    async query(sql) {
      sqlText = String(sql)
      return { rows: [] }
    },
  }, 91)
  assert.equal(member, null)
  assert.match(sqlText, /member\.app_user_id = app_identity\.id/)
  assert.doesNotMatch(sqlText, /member\.id = \$1/)
  assert.doesNotMatch(sqlText, /member\.email/)
})

test('canonical household authority permits payer to enroll an active household member', async () => {
  const queries = []
  const authority = await authorizeSignupBatchPayer({
    async query(sql) {
      queries.push(String(sql))
      if (/WITH target_member/.test(String(sql))) return { rows: [authorityRow()] }
      if (/FOR SHARE/.test(String(sql))) {
        return { rows: [{ id: 8, family_id: 20, payer_member_id: 13 }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }, { actorMemberId: 13, targetMemberId: 62, expectedFamilyBillingAccountId: 8 })

  assert.equal(authority.kind, 'household_payer')
  assert.equal(authority.familyBillingAccountId, 8)
  assert.match(queries[0], /family_member membership/)
  assert.match(queries[0], /membership\.is_active = TRUE/)
  assert.match(queries[0], /NOT EXISTS[\s\S]*membership_history/)
})

test('canonical household authority rejects a linked non-payer', async () => {
  await assert.rejects(
    authorizeSignupBatchPayer({
      async query(sql) {
        if (/WITH target_member/.test(String(sql))) {
          return { rows: [authorityRow({ payers: [13] })] }
        }
        throw new Error('Account lock must not be reached for a non-payer')
      },
    }, { actorMemberId: 14, targetMemberId: 62, expectedFamilyBillingAccountId: 8 }),
    (error) => error?.statusCode === 403 && error?.code === 'SIGNUP_PAYER_REQUIRED',
  )
})

test('a genuinely new unhoused member can still complete public registration', async () => {
  const authority = await authorizeSignupBatchPayer({
    async query(sql) {
      assert.match(String(sql), /WITH target_member/)
      return {
        rows: [{
          ...authorityRow({ targetFamilies: [], actorFamilies: [], accounts: [], payers: [] }),
          target_member_id: 77,
          actor_member_id: 77,
          target_legacy_family_id: null,
          actor_legacy_family_id: null,
          target_membership_history_count: 0,
          actor_membership_history_count: 0,
        }],
      }
    },
  }, { actorMemberId: 77, targetMemberId: 77 })
  assert.equal(authority.kind, 'unhoused_self')
})

test('inactive household history cannot masquerade as a new unhoused account', async () => {
  await assert.rejects(
    authorizeSignupBatchPayer({
      async query() {
        return {
          rows: [{
            ...authorityRow({ targetFamilies: [], actorFamilies: [], accounts: [], payers: [] }),
            target_member_id: 62,
            actor_member_id: 62,
            target_legacy_family_id: 20,
            actor_legacy_family_id: 20,
            target_membership_history_count: 1,
            actor_membership_history_count: 1,
          }],
        }
      },
    }, { actorMemberId: 62, targetMemberId: 62 }),
    (error) => error?.statusCode === 403,
  )
})

test('authMemberSession blocks an unlinked staff id collision', async () => {
  const pool = {
    async query(sql) {
      assert.match(String(sql), /member\.app_user_id = app_identity\.id/)
      return { rows: [] }
    },
  }
  const handler = registeredSchedulingHandler(pool, '/api/scheduling/auth/member-session')
  const res = responseCapture()
  await handler({
    headers: {
      authorization: `Bearer ${jwt.sign({ userId: 91, adminId: 91 }, resolveJwtSecret())}`,
    },
    body: { formId: 31, targetMemberId: 91 },
  }, res)
  assert.equal(res.statusCode, 403)
  assert.equal(res.payload.code, 'MEMBER_ACCOUNT_LINK_REQUIRED')
})

test('authMemberSession issues a payer-bound token for another household member', async () => {
  const actor = { id: 13, app_user_id: 91, first_name: 'Pat', last_name: 'Payer', email: 'payer@example.com' }
  const target = { id: 62, first_name: 'Chris', last_name: 'Child', email: 'child@example.com', profile_complete: true }
  const pool = {
    async query(sql, params) {
      const text = String(sql)
      if (/JOIN member ON member\.app_user_id = app_identity\.id/.test(text)) {
        return { rows: [actor] }
      }
      if (/SELECT \* FROM member WHERE id = \$1 AND is_active = TRUE/.test(text)) {
        return { rows: Number(params[0]) === 62 ? [target] : [] }
      }
      if (/WITH target_member/.test(text)) return { rows: [authorityRow()] }
      if (/FOR SHARE/.test(text)) {
        return { rows: [{ id: 8, family_id: 20, payer_member_id: 13 }] }
      }
      if (/SELECT program_id, programs_id FROM scheduling_form/.test(text)) {
        return { rows: [{ program_id: null, programs_id: 7 }] }
      }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  const res = responseCapture()
  await createSchedulingHandlers(pool).authMemberSession({
    headers: { authorization: `Bearer ${jwt.sign({ userId: 91 }, resolveJwtSecret())}` },
    body: { formId: 31, targetMemberId: 62 },
  }, res)

  assert.equal(res.statusCode, 200)
  const decoded = verifySignupAuthToken(res.payload.data.signupAuthToken, 31, { programsId: 7 })
  assert.equal(decoded.memberId, 62)
  assert.deepEqual(decoded.signupAuthority, {
    version: 1,
    actorMemberId: 13,
    targetMemberId: 62,
    familyBillingAccountId: 8,
    grant: 'household_payer',
  })
})

test('direct signup batch cannot bypass payer authority before preview or writes', async () => {
  const token = issueSignupAuthToken({
    formId: 31,
    programsId: 7,
    memberId: 62,
    actorMemberId: 14,
    familyBillingAccountId: 8,
    authorityGrant: 'household_payer',
    email: 'child@example.com',
  })
  const clientQueries = []
  const client = {
    async query(sql) {
      const text = String(sql)
      clientQueries.push(text)
      if (text === 'BEGIN' || text === 'ROLLBACK') return { rows: [] }
      if (/WITH target_member/.test(text)) {
        return { rows: [authorityRow({ payers: [13] })] }
      }
      throw new Error(`Mutation/preview unexpectedly reached: ${text}`)
    },
    release() {},
  }
  const pool = {
    async query(sql) {
      if (/SELECT \* FROM member WHERE id = \$1 AND is_active = TRUE/.test(String(sql))) {
        return { rows: [{ id: 62, first_name: 'Chris', last_name: 'Child', email: 'child@example.com' }] }
      }
      throw new Error(`Unexpected pool query: ${sql}`)
    },
    async connect() {
      return client
    },
  }
  const res = responseCapture()
  const handler = registeredSchedulingHandler(pool, '/api/scheduling/signups/batch')
  await handler({
    body: {
      signups: [{ lineType: 'multi_class_pass', programsId: 7, packageId: 'ten-pack' }],
      signupAuthToken: token,
    },
  }, res)

  assert.equal(res.statusCode, 403)
  assert.equal(res.payload.success, false)
  assert.equal(clientQueries.some((sql) => /buildSignupOrderPreview|INSERT INTO/.test(sql)), false)
  assert.deepEqual(clientQueries.slice(-1), ['ROLLBACK'])
})
