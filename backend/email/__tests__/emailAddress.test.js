import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeEmail,
  isValidEmail,
  emailDomain,
  extractEmailAddress,
  inspectEmail,
} from '../emailAddress.js'

test('normalizeEmail trims and lowercases the domain only', () => {
  assert.equal(normalizeEmail('  Parent@GMAIL.COM '), 'Parent@gmail.com')
  assert.equal(normalizeEmail('a@b.CO'), 'a@b.co')
})

test('isValidEmail accepts valid and rejects malformed', () => {
  assert.ok(isValidEmail('parent@gmail.com'))
  assert.ok(!isValidEmail('parent@@gmail.com'))
  assert.ok(!isValidEmail('parent gmail.com'))
  assert.ok(!isValidEmail(''))
})

test('emailDomain extracts the domain', () => {
  assert.equal(emailDomain('Parent@Gmail.com'), 'gmail.com')
})

test('extractEmailAddress unwraps display names', () => {
  assert.equal(extractEmailAddress('Vortex Athletics <team@vortexathletics.com>'), 'team@vortexathletics.com')
  assert.equal(extractEmailAddress('team@vortexathletics.com'), 'team@vortexathletics.com')
})

test('inspectEmail flags common typos with a suggestion (does not auto-correct)', () => {
  const r = inspectEmail('parent@gamil.com')
  assert.equal(r.valid, true)
  assert.equal(r.reason, 'possible_typo')
  assert.equal(r.suggestion, 'parent@gmail.com')
  assert.equal(r.normalized, 'parent@gamil.com') // unchanged
})

test('inspectEmail returns no suggestion for clean addresses', () => {
  const r = inspectEmail('parent@gmail.com')
  assert.equal(r.suggestion, null)
  assert.equal(r.reason, null)
})

test('inspectEmail rejects malformed', () => {
  assert.equal(inspectEmail('nope').valid, false)
})
