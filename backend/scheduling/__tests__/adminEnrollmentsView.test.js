import test from 'node:test'
import assert from 'node:assert/strict'
import { mapDropInEnrollmentPricing } from '../adminEnrollmentsView.js'

test('free-trial drop-ins retain their formula price and show the free class as a discount', () => {
  assert.deepEqual(mapDropInEnrollmentPricing({
    base_price_cents: 5000,
    amount_cents: 0,
    benefit_type: 'free_trial',
  }), {
    class_cost_cents: 5000,
    adjusted_cost_cents: 0,
    discount_components: [{
      name: 'Free trial',
      amountCents: 5000,
      source: 'drop_in_benefit',
      promoCode: null,
    }],
  })
})

test('paid drop-ins retain their membership-aware formula price without an invented discount', () => {
  assert.deepEqual(mapDropInEnrollmentPricing({
    base_price_cents: 3750,
    amount_cents: 3750,
    benefit_type: 'paid',
  }), {
    class_cost_cents: 3750,
    adjusted_cost_cents: 3750,
    discount_components: [],
  })
})
