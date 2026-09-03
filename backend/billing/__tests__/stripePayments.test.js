import assert from 'node:assert/strict'
import test from 'node:test'

import { listStripePayments, stripePaymentDto } from '../stripePayments.js'

test('Stripe payment DTO only exposes payment data returned by Stripe', () => {
  assert.deepEqual(stripePaymentDto({
    id: 'pi_123',
    created: 1_774_979_200,
    amount: 12_500,
    amount_received: 10_000,
    currency: 'usd',
    status: 'succeeded',
    description: 'September tuition',
    receipt_email: 'receipt@example.com',
    customer: { id: 'cus_123', name: 'Alex Parent', email: 'alex@example.com' },
    latest_charge: {
      id: 'ch_123',
      amount_refunded: 2_500,
      payment_method_details: { type: 'card' },
    },
    livemode: true,
  }), {
    id: 'pi_123',
    createdAt: '2026-03-31T17:46:40.000Z',
    amountMinor: 12_500,
    amountReceivedMinor: 10_000,
    amountRefundedMinor: 2_500,
    currency: 'usd',
    status: 'succeeded',
    description: 'September tuition',
    customerId: 'cus_123',
    customerName: 'Alex Parent',
    customerEmail: 'alex@example.com',
    paymentMethod: 'card',
    latestChargeId: 'ch_123',
    liveMode: true,
  })
})

test('Stripe payment listing follows Stripe pagination until every payment is returned', async () => {
  const requests = []
  const stripe = {
    paymentIntents: {
      async list(params) {
        requests.push(params)
        if (!params.starting_after) {
          return {
            data: [{ id: 'pi_first', amount: 500, amount_received: 500, currency: 'usd', status: 'succeeded', created: 1 }],
            has_more: true,
          }
        }
        return {
          data: [{ id: 'pi_second', amount: 900, amount_received: 0, currency: 'usd', status: 'canceled', created: 2 }],
          has_more: false,
        }
      },
    },
  }

  const result = await listStripePayments(stripe)

  assert.deepEqual(result.payments.map((payment) => payment.id), ['pi_first', 'pi_second'])
  assert.equal(requests.length, 2)
  assert.deepEqual(requests[0], { limit: 100, expand: ['data.customer', 'data.latest_charge'] })
  assert.deepEqual(requests[1], { limit: 100, expand: ['data.customer', 'data.latest_charge'], starting_after: 'pi_first' })
})

test('Stripe payment listing rejects an unavailable Stripe client', async () => {
  await assert.rejects(() => listStripePayments(null), {
    code: 'STRIPE_PAYMENTS_UNAVAILABLE',
    statusCode: 503,
  })
})
