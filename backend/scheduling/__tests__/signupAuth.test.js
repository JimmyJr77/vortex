import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import {
  issueSignupAuthToken,
  verifyMemberPassword,
  verifySignupAuthToken,
} from '../signupAuth.js'

test('verifyMemberPassword accepts linked app_user password when member hash differs', async () => {
  const appHash = await bcrypt.hash('portal-password', 4)
  const memberHash = await bcrypt.hash('old-stub-password', 4)

  const ok = await verifyMemberPassword(
    { password_hash: memberHash, app_user_password_hash: appHash },
    'portal-password',
  )
  assert.equal(ok, true)
})

test('verifyMemberPassword falls back to app_user hash when member hash is empty', async () => {
  const appHash = await bcrypt.hash('portal-password', 4)

  const ok = await verifyMemberPassword(
    { password_hash: null, app_user_password_hash: appHash },
    'portal-password',
  )
  assert.equal(ok, true)
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
