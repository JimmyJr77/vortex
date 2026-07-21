import test from 'node:test'
import assert from 'node:assert/strict'

import {
  emitStripePurchaseEvent,
  purchaseItemsFromPreview,
  sendGa4MpEvent,
} from '../ga4Measurement.js'

const withGa4Env = async (values, run) => {
  const previous = {
    measurementId: process.env.GA4_MEASUREMENT_ID,
    apiSecret: process.env.GA4_API_SECRET,
  }
  if (values.measurementId == null) delete process.env.GA4_MEASUREMENT_ID
  else process.env.GA4_MEASUREMENT_ID = values.measurementId
  if (values.apiSecret == null) delete process.env.GA4_API_SECRET
  else process.env.GA4_API_SECRET = values.apiSecret
  try {
    await run()
  } finally {
    if (previous.measurementId == null) delete process.env.GA4_MEASUREMENT_ID
    else process.env.GA4_MEASUREMENT_ID = previous.measurementId
    if (previous.apiSecret == null) delete process.env.GA4_API_SECRET
    else process.env.GA4_API_SECRET = previous.apiSecret
  }
}

test('sendGa4MpEvent is a no-op when Measurement Protocol is not configured', async () => {
  const previousFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => {
    called = true
    return { ok: true }
  }
  try {
    await withGa4Env({ measurementId: null, apiSecret: null }, async () => {
      assert.equal(await sendGa4MpEvent({ clientId: '123.456', name: 'purchase' }), false)
      assert.equal(called, false)
    })
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('sendGa4MpEvent sends a GA4 Measurement Protocol event with session attribution', async () => {
  const previousFetch = globalThis.fetch
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return { ok: true }
  }
  try {
    await withGa4Env({ measurementId: 'G-TEST123', apiSecret: 'secret-value' }, async () => {
      const sent = await sendGa4MpEvent({
        clientId: '123.456',
        sessionId: '789',
        name: 'purchase',
        params: { transaction_id: 'pi_123', value: 19.99, currency: 'USD' },
      })
      assert.equal(sent, true)
      assert.match(request.url, /measurement_id=G-TEST123/)
      assert.match(request.url, /api_secret=secret-value/)
      const payload = JSON.parse(request.options.body)
      assert.equal(payload.client_id, '123.456')
      assert.equal(payload.events[0].name, 'purchase')
      assert.deepEqual(payload.events[0].params, {
        session_id: '789',
        transaction_id: 'pi_123',
        value: 19.99,
        currency: 'USD',
      })
    })
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('purchaseItemsFromPreview maps enrollments and passes without personal data', () => {
  assert.deepEqual(
    purchaseItemsFromPreview({
      newSignups: [
        { formId: 12, displayLine: 'Monday 6 PM', billingType: 'recurring', monthlyPrice: 149 },
      ],
      passPurchases: [
        { programsId: 4, packageId: 8, packageLabel: 'Five-class pass', priceCents: 12500 },
      ],
    }),
    [
      {
        item_id: '12',
        item_name: 'Monday 6 PM',
        item_category: 'Recurring Program',
        price: 149,
        quantity: 1,
      },
      {
        item_id: 'pass_4_8',
        item_name: 'Five-class pass',
        item_category: 'Class Pass',
        price: 125,
        quantity: 1,
      },
    ],
  )
})

test('emitStripePurchaseEvent suppresses replayed payments', async () => {
  const previousFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => {
    called = true
    return { ok: true }
  }
  try {
    await withGa4Env({ measurementId: 'G-TEST123', apiSecret: 'secret-value' }, async () => {
      await emitStripePurchaseEvent(
        { query: async () => ({ rows: [] }) },
        {
          payment: { id: 1, newly_inserted: false, amount_cents: 19900 },
          session: { id: 'cs_123' },
          paymentType: 'initial_enrollment',
        },
      )
      assert.equal(called, false)
    })
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('emitStripePurchaseEvent sends canonical revenue and acquisition-only events for initial enrollment', async () => {
  const previousFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body))
    return { ok: true }
  }
  try {
    await withGa4Env({ measurementId: 'G-TEST123', apiSecret: 'secret-value' }, async () => {
      await emitStripePurchaseEvent(
        { query: async () => ({ rows: [] }) },
        {
          payment: {
            id: 2,
            newly_inserted: true,
            amount_cents: 2500,
            stripe_payment_intent_id: 'pi_initial_123',
          },
          session: { id: 'cs_initial_123', metadata: { gaClientId: '123.456', gaSessionId: '789' } },
          paymentType: 'initial_enrollment',
        },
      )

      assert.deepEqual(
        requests.map((request) => request.events[0].name).sort(),
        ['initial_enrollment_purchase', 'purchase'],
      )
      for (const request of requests) {
        assert.equal(request.events[0].params.transaction_id, 'pi_initial_123')
        assert.equal(request.events[0].params.value, 25)
        assert.equal(request.events[0].params.payment_type, 'initial_enrollment')
      }
    })
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('emitStripePurchaseEvent excludes outstanding balances from acquisition conversion', async () => {
  const previousFetch = globalThis.fetch
  const eventNames = []
  globalThis.fetch = async (_url, options) => {
    eventNames.push(JSON.parse(options.body).events[0].name)
    return { ok: true }
  }
  try {
    await withGa4Env({ measurementId: 'G-TEST123', apiSecret: 'secret-value' }, async () => {
      await emitStripePurchaseEvent(
        { query: async () => ({ rows: [] }) },
        {
          payment: { id: 3, newly_inserted: true, amount_cents: 5000, stripe_payment_intent_id: 'pi_balance_123' },
          session: { id: 'cs_balance_123', metadata: { gaClientId: '123.456' } },
          paymentType: 'outstanding_balance',
        },
      )

      assert.deepEqual(eventNames, ['purchase'])
    })
  } finally {
    globalThis.fetch = previousFetch
  }
})
