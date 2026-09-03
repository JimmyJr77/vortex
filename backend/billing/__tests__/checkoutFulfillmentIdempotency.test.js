import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  checkoutFingerprint,
  normalizeCheckoutRequestKey,
  stripeCheckoutIdempotencyKey,
} from '../checkoutIdempotency.js'
import {
  annualCheckoutSnapshot,
  parseAnnualCheckoutSnapshot,
  validateAnnualMembershipCheckoutSettlement,
} from '../annualMembershipCheckout.js'

const directory = path.dirname(fileURLToPath(import.meta.url))

test('checkout idempotency keys are required, scoped, and deterministic for Stripe', () => {
  assert.throws(
    () => normalizeCheckoutRequestKey(null, 'enrollment'),
    (error) => error?.code === 'CHECKOUT_IDEMPOTENCY_KEY_REQUIRED' && error.statusCode === 400,
  )
  const requestKey = normalizeCheckoutRequestKey('client-request-123', 'enrollment')
  assert.equal(requestKey, 'enrollment:client-request-123')
  assert.equal(
    stripeCheckoutIdempotencyKey('enrollment', 8, requestKey),
    stripeCheckoutIdempotencyKey('enrollment', 8, requestKey),
  )
  assert.notEqual(
    stripeCheckoutIdempotencyKey('enrollment', 8, requestKey),
    stripeCheckoutIdempotencyKey('enrollment', 9, requestKey),
  )
})

test('annual fulfillment reads immutable per-member gross discount and net terms', () => {
  const snapshot = annualCheckoutSnapshot(
    {
      id: 4,
      name: 'Annual fee',
      triggerType: 'once_per_year',
      applyBasis: 'per_year',
    },
    [
      { memberId: 12, grossCents: 8500, discountCents: 1500, netCents: 7000, promo: { rule: { id: 7 }, code: 'SAVE15' } },
      { memberId: 11, grossCents: 8500, discountCents: 8500, netCents: 0, promo: { rule: { id: 8 }, code: 'WAIVED' } },
    ],
  )
  const request = {
    pricing_snapshot: snapshot,
    pricing_snapshot_hash: checkoutFingerprint(snapshot),
    currency: 'usd',
    expected_amount_cents: 7000,
  }
  assert.deepEqual(parseAnnualCheckoutSnapshot(request), snapshot)
  assert.deepEqual(snapshot.members.map((row) => row.memberId), [11, 12])
  assert.equal(snapshot.members[1].grossCents, 8500)
  assert.equal(snapshot.members[1].discountCents, 1500)
  assert.equal(snapshot.members[1].netCents, 7000)

  const tampered = structuredClone(request)
  tampered.pricing_snapshot.members[1].netCents = 6900
  assert.throws(() => parseAnnualCheckoutSnapshot(tampered), /integrity validation/i)
})

test('annual fulfillment rejects a paid Session whose amount or currency differs', () => {
  const request = { currency: 'usd', expected_amount_cents: 7000 }
  const paid = {
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    currency: 'usd',
    amount_total: 7000,
  }
  assert.deepEqual(validateAnnualMembershipCheckoutSettlement(paid, request), { ok: true })
  assert.deepEqual(
    validateAnnualMembershipCheckoutSettlement({ ...paid, amount_total: 8500 }, request),
    { ok: false, reason: 'settlement_amount_mismatch' },
  )
  assert.deepEqual(
    validateAnnualMembershipCheckoutSettlement({ ...paid, currency: 'cad' }, request),
    { ok: false, reason: 'settlement_currency_mismatch' },
  )
  assert.deepEqual(
    validateAnnualMembershipCheckoutSettlement(
      { ...paid, customer: 'cus_other' },
      request,
      { expectedCustomerId: 'cus_family' },
    ),
    { ok: false, reason: 'settlement_customer_mismatch' },
  )
  assert.deepEqual(
    validateAnnualMembershipCheckoutSettlement(
      { ...paid, customer: 'cus_family' },
      request,
      { expectedCustomerId: 'cus_family' },
    ),
    { ok: true },
  )
})

test('checkout migration enforces durable request uniqueness and immutable annual terms', () => {
  const migration = fs.readFileSync(
    path.resolve(directory, '../../migrations/798_checkout_fulfillment_idempotency.sql'),
    'utf8',
  )
  assert.match(migration, /uq_stripe_pending_enrollment_request/)
  assert.match(migration, /UNIQUE \(family_billing_account_id, request_key\)/)
  assert.match(migration, /annual_membership_checkout_promo_reservation/)
  assert.match(migration, /guard_annual_membership_checkout_request_terms/)
  assert.match(migration, /uq_discount_redemption_annual_checkout_member_rule/)
})
