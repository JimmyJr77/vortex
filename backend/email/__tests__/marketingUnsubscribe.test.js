import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  makeUnsubscribeToken,
  readUnsubscribeToken,
  applyUnsubscribe,
} from '../marketingUnsubscribe.js'

test('token round-trips email + scope without exposing the address', () => {
  const token = makeUnsubscribeToken('Parent@Gmail.com', 'marketing')
  assert.ok(!token.includes('parent'), 'address must not appear in the token')
  assert.ok(!token.includes('@'))
  const decoded = readUnsubscribeToken(token)
  assert.deepEqual(decoded, { email: 'Parent@gmail.com', scope: 'marketing' })
})

test('tampered tokens are rejected', () => {
  const token = makeUnsubscribeToken('parent@gmail.com')
  assert.equal(readUnsubscribeToken(token.slice(0, -2) + 'xx'), null)
  assert.equal(readUnsubscribeToken('garbage'), null)
  assert.equal(readUnsubscribeToken(''), null)
})

test('applyUnsubscribe is idempotent for a valid token (no pool registered)', async () => {
  const token = makeUnsubscribeToken('parent@gmail.com')
  const first = await applyUnsubscribe(token)
  const second = await applyUnsubscribe(token)
  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
})

test('applyUnsubscribe rejects an invalid token', async () => {
  const result = await applyUnsubscribe('not-a-real-token')
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'invalid_token')
})
