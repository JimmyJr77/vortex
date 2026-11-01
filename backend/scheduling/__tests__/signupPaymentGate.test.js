import test from 'node:test'
import assert from 'node:assert/strict'
import { requireSignupCheckout } from '../signupPaymentGate.js'
import { createSchedulingHandlers } from '../handlers.js'

const recurring = { newSignups: [{ slotKey: '9:225:301', billingType: 'recurring', monthlyPrice: 150 }],
  firstMonth: { totalCents: 15000 } }
for (const [label, preview] of [
  ['monthly tuition', recurring],
  ['future start with no immediate tuition', { ...recurring, firstMonth: { totalCents: 0 } }],
  ['one-time fee', { additionalFeesOneTime: 50 }],
  ['pass purchase', { passPurchases: [{ packageId: 'ten' }], passPurchaseTotalCents: 10000 }],
  ['carried balance', { carriedForward: { totalCents: 15000 } }],
]) {
  test(`${label} cannot be confirmed by a direct signup request`, () => {
    assert.throws(() => requireSignupCheckout(preview), { statusCode: 402, code: 'ENROLLMENT_CHECKOUT_REQUIRED' })
    assert.throws(() => requireSignupCheckout(preview, { payment_status: 'paid' }), { statusCode: 402 })
    assert.doesNotThrow(() => requireSignupCheckout(preview, { stripeCheckoutSessionId: 'cs_verified' }))
  })
}
test('free enrollment is permitted and unavailable pricing fails closed', () => {
  assert.doesNotThrow(() => requireSignupCheckout({ firstMonth: { totalCents: 0 }, newSignups: [] }))
  assert.throws(() => requireSignupCheckout(null), /pricing is unavailable/)
})
// Keep the boundary at the public handlers, not just the browser UI.
for (const name of ['createSignup', 'createSignupBatch']) test(`${name} enforces checkout before enrollment insertion`, () => {
  const source = String(createSchedulingHandlers({})[name])
  const gate = source.indexOf('requireSignupCheckout(')
  assert.ok(gate > source.indexOf('await buildSignupOrderPreview('))
  assert.ok(gate < source.indexOf('await insertSignupForMember('))
  assert.ok(!source.includes('req.body.billingCheckout'))
})
