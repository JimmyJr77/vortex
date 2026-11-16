import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { resolveJwtSecret, resetJwtSecretCacheForTests } from '../jwtSecret.js'
import { encryptAccountInviteToken, decryptAccountInviteToken } from '../../email/accountInviteTokens.js'

const legacy = 'dev-insecure-jwt-secret'
function configure(secret) {
  resetJwtSecretCacheForTests()
  process.env.NODE_ENV = 'production'
  if (secret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = secret
}
for (const secret of [undefined, legacy, 'short', ' '.repeat(64), 'your-super-secret-jwt-key-change-this-in-production']) {
  test(`production rejects ${secret === undefined ? 'missing' : 'unsafe'} signing configuration`, () => {
    configure(secret)
    assert.throws(resolveJwtSecret, /JWT_SECRET/)
  })
}
test('rotation accepts new sessions and rejects development-key sessions', () => {
  configure(crypto.randomBytes(64).toString('hex'))
  const key = resolveJwtSecret()
  const claims = { userId: 42 }
  assert.equal(jwt.verify(jwt.sign(claims, key), key).userId, 42)
  assert.throws(() => jwt.verify(jwt.sign(claims, legacy), key), /invalid signature/)
})
test('existing invitations survive rotation without changing token hashes or accepting legacy versioned ciphertext', () => {
  const token = crypto.randomBytes(32).toString('hex')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', crypto.createHash('sha256').update(legacy).digest(), iv)
  const data = Buffer.concat([cipher.update(token), cipher.final()])
  const old = Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url')
  configure(crypto.randomBytes(64).toString('hex'))
  assert.equal(decryptAccountInviteToken(old), token)
  assert.equal(decryptAccountInviteToken('v2.' + old), null)
  const encrypted = encryptAccountInviteToken(token)
  assert.match(encrypted, /^v2\./)
  assert.equal(decryptAccountInviteToken(encrypted), token)
  assert.equal(decryptAccountInviteToken('broken'), null)
})
