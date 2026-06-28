import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { resolveJwtSecret, resetJwtSecretCacheForTests } from '../jwtSecret.js'

test('resolveJwtSecret matches server member login signing secret', () => {
  resetJwtSecretCacheForTests()
  delete process.env.JWT_SECRET
  process.env.NODE_ENV = 'test'

  const secret = resolveJwtSecret()
  const token = jwt.sign({ userId: 42, email: 'parent@example.com' }, secret, { expiresIn: '30d' })
  const decoded = jwt.verify(token, resolveJwtSecret())

  assert.equal(decoded.userId, 42)
})

test('resolveJwtSecret is stable across calls', () => {
  resetJwtSecretCacheForTests()
  delete process.env.JWT_SECRET
  process.env.NODE_ENV = 'test'

  const a = resolveJwtSecret()
  const b = resolveJwtSecret()
  assert.equal(a, b)
})
