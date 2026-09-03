import assert from 'node:assert/strict'
import test from 'node:test'

import {
  prepareStripePaymentRecord,
  stripeEventCreatedAt,
  upsertStripePayment,
} from '../stripeBilling.js'

function succeededPaymentIntent(overrides = {}) {
  return {
    id: 'pi_timestamped',
    object: 'payment_intent',
    status: 'succeeded',
    created: 1_800_000_000,
    amount_received: 5_000,
    customer: 'cus_timestamped',
    payment_method: {
      id: 'pm_timestamped',
      type: 'card',
      card: { brand: 'visa', last4: '4242' },
    },
    latest_charge: {
      id: 'ch_timestamped',
      created: 1_800_000_123,
      payment_method_details: {
        type: 'card',
        card: { brand: 'visa', last4: '4242' },
      },
    },
    ...overrides,
  }
}

test('generic Stripe payment recording persists Stripe charge time instead of database now', async () => {
  const paymentIntent = succeededPaymentIntent()
  let retrieved = 0
  const stripe = {
    paymentIntents: {
      async retrieve() {
        retrieved += 1
        return paymentIntent
      },
    },
  }

  const prepared = await prepareStripePaymentRecord({
    paymentIntentId: paymentIntent.id,
    paymentIntent,
    amountCents: 5_000,
    accountId: 7,
    customerId: paymentIntent.customer,
  }, { stripe })

  assert.equal(retrieved, 0)
  assert.equal(prepared.method, 'Visa •••• 4242')
  assert.equal(prepared.paidAt.toISOString(), '2027-01-15T08:02:03.000Z')

  let insert = null
  const pool = {
    async query(sql, params) {
      insert = { sql: String(sql), params }
      return {
        rows: [{
          id: 91,
          family_billing_account_id: params[0],
          amount_cents: params[1],
          method: params[2],
          paid_at: params[3],
          stripe_customer_id: params[4],
          stripe_payment_intent_id: params[5],
        }],
      }
    },
  }
  const recorded = await upsertStripePayment(pool, prepared)

  assert.match(insert.sql, /method, paid_at, external_processor/)
  assert.match(insert.sql, /billing_payment\.paid_at - billing_payment\.created_at/)
  assert.equal(insert.params[3].toISOString(), prepared.paidAt.toISOString())
  assert.equal(recorded.paid_at.toISOString(), prepared.paidAt.toISOString())
})

test('a succeeded webhook event time wins over delayed delivery and PaymentIntent creation time', async () => {
  const paymentIntent = succeededPaymentIntent()
  const eventPaidAt = stripeEventCreatedAt({ created: 1_800_000_999 })
  const prepared = await prepareStripePaymentRecord({
    paymentIntentId: paymentIntent.id,
    paymentIntent,
    paidAt: eventPaidAt,
    amountCents: 5_000,
    accountId: 7,
    customerId: paymentIntent.customer,
  }, { stripe: {} })

  assert.equal(eventPaidAt.toISOString(), '2027-01-15T08:16:39.000Z')
  assert.equal(prepared.paidAt.toISOString(), eventPaidAt.toISOString())
  assert.equal(stripeEventCreatedAt({ created: null }), null)
  assert.equal(stripeEventCreatedAt({ created: -1 }), null)
})

test('missing event timestamp is recovered from the exact Stripe PaymentIntent', async () => {
  const remote = succeededPaymentIntent({
    latest_charge: 'ch_timestamped',
    created: 1_800_000_321,
  })
  const calls = []
  const stripe = {
    paymentIntents: {
      async retrieve(id, params) {
        calls.push({ id, params })
        return remote
      },
    },
    paymentMethods: {
      async retrieve() {
        return remote.payment_method
      },
    },
  }

  const prepared = await prepareStripePaymentRecord({
    paymentIntentId: remote.id,
    paymentIntent: { id: remote.id, status: 'succeeded' },
    amountCents: 5_000,
    accountId: 7,
    customerId: remote.customer,
  }, { stripe })

  assert.deepEqual(calls, [{
    id: remote.id,
    params: { expand: ['payment_method', 'latest_charge'] },
  }])
  assert.equal(prepared.paidAt.toISOString(), '2027-01-15T08:05:21.000Z')
})

test('generic Stripe payment recording fails closed without exact succeeded timestamp evidence', async () => {
  await assert.rejects(
    prepareStripePaymentRecord({
      paymentIntentId: 'pi_invalid',
      amountCents: 5_000,
      accountId: 7,
      customerId: 'cus_timestamped',
    }, {
      stripe: {
        paymentIntents: {
          async retrieve() {
            return {
              id: 'pi_invalid',
              status: 'succeeded',
              amount_received: 5_000,
              customer: 'cus_timestamped',
              created: null,
            }
          },
        },
      },
    }),
    /no valid Stripe payment timestamp/i,
  )
})

test('generic Stripe payment recording rejects amount and customer identity mismatches', async (t) => {
  await t.test('amount mismatch', async () => {
    const mismatched = succeededPaymentIntent({ amount_received: 4_999 })
    await assert.rejects(
      prepareStripePaymentRecord({
        paymentIntentId: mismatched.id,
        paymentIntent: mismatched,
        paidAt: new Date('2026-09-01T12:00:00.000Z'),
        amountCents: 5_000,
        accountId: 7,
        customerId: 'cus_timestamped',
      }, {
        stripe: { paymentIntents: { retrieve: async () => mismatched } },
      }),
      /amount does not match/i,
    )
  })

  await t.test('customer mismatch', async () => {
    const mismatched = succeededPaymentIntent({ customer: 'cus_other' })
    await assert.rejects(
      prepareStripePaymentRecord({
        paymentIntentId: mismatched.id,
        paymentIntent: mismatched,
        paidAt: new Date('2026-09-01T12:00:00.000Z'),
        amountCents: 5_000,
        accountId: 7,
        customerId: 'cus_timestamped',
      }, {
        stripe: { paymentIntents: { retrieve: async () => mismatched } },
      }),
      /customer does not match/i,
    )
  })
})

test('generic Stripe payment recording rejects invalid local identity before a Stripe lookup', async () => {
  const stripe = {
    paymentIntents: {
      async retrieve() {
        assert.fail('invalid local identity must fail before remote lookup')
      },
    },
  }
  await assert.rejects(
    prepareStripePaymentRecord({
      paymentIntentId: 'pi_invalid_account',
      amountCents: 5_000,
      accountId: 0,
      customerId: 'cus_timestamped',
    }, { stripe }),
    /invalid billing account/i,
  )
  await assert.rejects(
    prepareStripePaymentRecord({
      paymentIntentId: 'pi_invalid_amount',
      amountCents: 0,
      accountId: 7,
      customerId: 'cus_timestamped',
    }, { stripe }),
    /invalid expected amount/i,
  )
  await assert.rejects(
    prepareStripePaymentRecord({
      paymentIntentId: 'pi_missing_customer',
      amountCents: 5_000,
      accountId: 7,
      customerId: null,
    }, { stripe }),
    /no expected Stripe customer/i,
  )
})

test('an exact PaymentIntent replay cannot mutate a payment with conflicting immutable identity', async () => {
  let statement = null
  const pool = {
    async query(sql) {
      statement = String(sql)
      return { rows: [] }
    },
  }
  await assert.rejects(
    upsertStripePayment(pool, {
      paymentIntentId: 'pi_collision',
      amountCents: 5_000,
      accountId: 7,
      customerId: 'cus_timestamped',
      method: 'Link',
      paidAt: new Date('2026-09-01T12:00:00.000Z'),
    }),
    (error) => error?.code === 'STRIPE_PAYMENT_RECORD_CONFLICT',
  )
  assert.match(statement, /family_billing_account_id = EXCLUDED\.family_billing_account_id/)
  assert.match(statement, /amount_cents = EXCLUDED\.amount_cents/)
  assert.match(statement, /stripe_customer_id IS NOT DISTINCT FROM EXCLUDED\.stripe_customer_id/)
})
