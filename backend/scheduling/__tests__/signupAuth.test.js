import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { verifyMemberPassword } from '../signupAuth.js'

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
