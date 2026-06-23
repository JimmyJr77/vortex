import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EMAIL_CATEGORIES,
  isKnownCategory,
  streamForCategory,
  isTransactional,
  isMarketing,
  isSecurityCategory,
  findPromotionalContent,
  STREAM_TRANSACTIONAL,
  STREAM_MARKETING,
} from '../emailCategories.js'

test('parent account categories are transactional', () => {
  for (const c of [
    'parent_account_invitation',
    'parent_email_verification',
    'parent_account_created',
    'password_reset',
    'registration_confirmation',
  ]) {
    assert.equal(streamForCategory(c), STREAM_TRANSACTIONAL, c)
    assert.ok(isTransactional(c), c)
    assert.ok(!isMarketing(c), c)
  }
})

test('promotional categories are marketing', () => {
  for (const c of ['newsletter', 'discount', 'referral_offer', 'promotional_announcement']) {
    assert.equal(streamForCategory(c), STREAM_MARKETING, c)
    assert.ok(isMarketing(c), c)
  }
})

test('unknown categories are rejected', () => {
  assert.ok(!isKnownCategory('totally_made_up'))
  assert.equal(streamForCategory('totally_made_up'), null)
})

test('security categories include invitations and verification', () => {
  assert.ok(isSecurityCategory('parent_account_invitation'))
  assert.ok(isSecurityCategory('password_reset'))
  assert.ok(!isSecurityCategory('account_welcome'))
})

test('findPromotionalContent detects promo phrases', () => {
  assert.deepEqual(findPromotionalContent('Verify your email'), [])
  assert.ok(findPromotionalContent('Get 20% off today!').length > 0)
  assert.ok(findPromotionalContent('Refer a friend and earn').length > 0)
  assert.ok(findPromotionalContent('Subject', 'Limited-time discount inside').length > 0)
})

test('every category maps to a known stream', () => {
  for (const [cat, stream] of Object.entries(EMAIL_CATEGORIES)) {
    assert.ok([STREAM_TRANSACTIONAL, STREAM_MARKETING].includes(stream), cat)
  }
})
