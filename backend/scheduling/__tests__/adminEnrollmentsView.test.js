import test from 'node:test'
import assert from 'node:assert/strict'
import {
  autoCompleteEndedEnrollments,
  mapDropInEnrollmentPricing,
} from '../adminEnrollmentsView.js'

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

test('strict ended-enrollment completion rolls back signup and subscription together', async () => {
  const calls = []
  const client = {
    release() {},
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (/SELECT DISTINCT signup\.id/.test(text)) return { rows: [{ id: 101 }] }
      if (/SELECT stripe_subscription_id/.test(text)) return { rows: [] }
      if (text === 'BEGIN' || text === 'ROLLBACK') return { rows: [] }
      if (/FOR UPDATE OF signup/.test(text)) return { rows: [{ id: 101 }] }
      if (/FOR UPDATE OF subscription/.test(text)) return { rows: [{ id: 41 }] }
      if (/UPDATE scheduling_signup/.test(text)) return { rows: [{ id: 101 }] }
      if (/UPDATE billing_subscription/.test(text)) {
        const error = new Error('injected subscription completion failure')
        error.code = 'injected_completion_failure'
        throw error
      }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  await assert.rejects(
    autoCompleteEndedEnrollments(client, {
      strict: true,
      accountId: 9,
      facilityId: 2,
      asOfDate: '2026-09-01',
    }),
    /injected subscription completion failure/,
  )
  assert.ok(calls.some((call) => call.text === 'ROLLBACK'))
  assert.equal(calls.some((call) => call.text === 'COMMIT'), false)
  const scoped = calls.find((call) => /SELECT DISTINCT signup\.id/.test(call.text))
  assert.deepEqual(scoped.params, [9, 2, '2026-09-01'])
})
