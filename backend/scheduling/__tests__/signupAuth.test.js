import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import {
  issueSignupAuthToken,
  verifyMemberPassword,
  verifySignupAuthToken,
} from '../signupAuth.js'

test('verifyMemberPassword accepts only the canonical password for a linked login', async () => {
  const appHash = await bcrypt.hash('portal-password', 4)
  const memberHash = await bcrypt.hash('old-stub-password', 4)

  const linked = { app_user_id: 12, password_hash: memberHash, app_user_password_hash: appHash }
  assert.equal(await verifyMemberPassword(linked, 'portal-password'), true)
  assert.equal(await verifyMemberPassword(linked, 'old-stub-password'), false)
  assert.equal(await verifyMemberPassword({ ...linked, app_user_password_hash: null }, 'old-stub-password'), false)
})

test('verifyMemberPassword still recognizes a legacy password for an unlinked member', async () => {
  const memberHash = await bcrypt.hash('legacy-password', 4)
  assert.equal(await verifyMemberPassword({ app_user_id: null, password_hash: memberHash }, 'legacy-password'), true)
})

test('signup token carries signed actor, target, grant, and account authority', () => {
  const token = issueSignupAuthToken({
    formId: 31,
    programsId: 7,
    memberId: 62,
    actorMemberId: 13,
    familyBillingAccountId: 8,
    authorityGrant: 'household_payer',
    email: 'child@example.com',
  })
  const decoded = verifySignupAuthToken(token, 31, { programsId: 7 })
  assert.deepEqual(decoded.signupAuthority, {
    version: 1,
    actorMemberId: 13,
    targetMemberId: 62,
    familyBillingAccountId: 8,
    grant: 'household_payer',
  })
})

test('signup token rejects a delegated target without payer account authority', () => {
  assert.throws(
    () => issueSignupAuthToken({
      formId: 31,
      memberId: 62,
      actorMemberId: 13,
      authorityGrant: 'household_payer',
      email: 'child@example.com',
    }),
    (error) => error?.name === 'JsonWebTokenError',
  )
})
