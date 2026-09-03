import assert from 'node:assert/strict'
import test from 'node:test'

import {
  cancelStoreOrder,
  createCardCheckout,
  StoreStripeCheckoutBindingConflict,
} from '../registerRoutes.js'

function databaseOrder(overrides = {}) {
  return {
    id: 71,
    facility_id: 9,
    order_number: 'ST-CANCEL',
    member_id: null,
    family_billing_account_id: null,
    billing_charge_id: null,
    discount_code_id: null,
    purchaser_name: 'Store Guest',
    purchaser_email: null,
    source: 'public',
    status: 'awaiting_payment',
    payment_status: 'pending',
    payment_method: 'card',
    external_reference: null,
    subtotal_cents: 5100,
    discount_cents: 0,
    total_cents: 5100,
    fulfillment_note: 'Pickup',
    picked_up_at: null,
    receipt_sent_at: null,
    stripe_checkout_session_id: 'cs_store',
    stripe_checkout_session_url: 'https://checkout.test/cs_store',
    created_at: new Date('2026-09-03T00:00:00Z'),
    updated_at: new Date('2026-09-03T00:00:00Z'),
    ...overrides,
  }
}

function checkoutSession(overrides = {}) {
  return {
    id: 'cs_store',
    object: 'checkout.session',
    mode: 'payment',
    status: 'open',
    payment_status: 'unpaid',
    payment_intent: null,
    amount_total: 5100,
    currency: 'usd',
    url: 'https://checkout.test/cs_store',
    metadata: { checkoutType: 'store', storeOrderId: '71' },
    ...overrides,
  }
}

function cancellationPool({ row = databaseOrder(), items = [], onInventoryMutation = null } = {}) {
  const state = {
    row,
    items,
    locks: 0,
    restocks: 0,
    cancellationUpdates: 0,
    paymentUpdates: 0,
    audits: [],
    rollbacks: 0,
    releases: 0,
  }
  const client = {
    async query(sql, params = []) {
      const text = String(sql)
      if (text === 'BEGIN' || text === 'COMMIT') return { rows: [] }
      if (text === 'ROLLBACK') {
        state.rollbacks += 1
        return { rows: [] }
      }
      if (text.includes('SELECT * FROM store_order WHERE id = $1 AND facility_id = $2 FOR UPDATE')) {
        state.locks += 1
        return { rows: [state.row] }
      }
      if (text.includes('SELECT * FROM store_order WHERE id = $1 FOR UPDATE')) {
        state.locks += 1
        return { rows: [state.row] }
      }
      if (text.includes('SELECT * FROM store_order WHERE id = $1 LIMIT 1')) {
        return { rows: [state.row] }
      }
      if (text.includes('SET stripe_checkout_session_id = $2')) {
        state.row.stripe_checkout_session_id = params[1]
        state.row.stripe_checkout_session_url = params[2]
        return { rows: [{ id: state.row.id, facility_id: state.row.facility_id }] }
      }
      if (text.includes("SET status = 'placed', payment_status = 'paid'")) {
        state.paymentUpdates += 1
        state.row.status = 'placed'
        state.row.payment_status = 'paid'
        state.row.external_reference = params[1]
        state.row.stripe_checkout_session_url = null
        return { rows: [] }
      }
      if (text.includes("SET status = 'cancelled'")) {
        state.cancellationUpdates += 1
        state.row.status = 'cancelled'
        if (state.row.payment_method === 'card') state.row.stripe_checkout_session_url = null
        return { rows: [] }
      }
      if (text.includes('UPDATE store_product')) {
        onInventoryMutation?.()
        state.restocks += 1
        return { rows: [] }
      }
      if (text.includes('INSERT INTO store_inventory_adjustment')) return { rows: [] }
      if (text.includes('INSERT INTO store_action_audit')) {
        state.audits.push(params[2])
        return { rows: [] }
      }
      if (text.includes('FROM store_order o')) {
        return { rows: [{ ...state.row, discount_code: null }] }
      }
      if (text.includes('FROM store_order_item')) return { rows: state.items }
      throw new Error(`Unexpected store cancellation query: ${text}`)
    },
    release() { state.releases += 1 },
  }
  return {
    state,
    pool: {
      async connect() { return client },
      async query(sql, params) { return client.query(sql, params) },
    },
  }
}

test('card cancellation expires the exact bound Checkout Session before inventory is restored', async () => {
  let stripeExpired = false
  const item = {
    id: 4,
    product_id: 18,
    product_name: 'Team shirt',
    sku: 'TS-1',
    unit_price_cents: 5100,
    quantity: 1,
    line_total_cents: 5100,
  }
  const { pool, state } = cancellationPool({
    items: [item],
    onInventoryMutation() {
      assert.equal(stripeExpired, true, 'inventory cannot move before Stripe confirms expiration')
    },
  })
  const stripe = {
    checkout: {
      sessions: {
        async retrieve(id, options) {
          assert.equal(id, 'cs_store')
          assert.deepEqual(options, { expand: ['payment_intent'] })
          return checkoutSession()
        },
        async expire(id) {
          assert.equal(id, 'cs_store')
          stripeExpired = true
          return checkoutSession({ status: 'expired' })
        },
      },
    },
  }

  const result = await cancelStoreOrder(pool, {
    orderId: 71,
    facilityId: 9,
    actorUserId: 3,
    stripe,
  })

  assert.equal(result.status, 'cancelled')
  assert.equal(state.locks, 2)
  assert.equal(state.restocks, 1)
  assert.equal(state.cancellationUpdates, 1)
  assert.equal(state.paymentUpdates, 0)
})

test('card cancellation finalizes a paid Checkout race and never restocks the order', async () => {
  const { pool, state } = cancellationPool({
    items: [{
      id: 4,
      product_id: 18,
      product_name: 'Team shirt',
      sku: 'TS-1',
      unit_price_cents: 5100,
      quantity: 1,
      line_total_cents: 5100,
    }],
  })
  const paid = checkoutSession({
    status: 'complete',
    payment_status: 'paid',
    payment_intent: 'pi_store',
  })
  const stripe = {
    checkout: {
      sessions: {
        async retrieve() { return paid },
        async expire() { throw new Error('a paid Checkout must never be expired') },
      },
    },
  }
  let receiptAttempts = 0

  await assert.rejects(
    cancelStoreOrder(pool, {
      orderId: 71,
      facilityId: 9,
      actorUserId: 3,
      stripe,
      async sendReceipt() {
        receiptAttempts += 1
        assert.equal(state.releases, 1, 'receipt delivery must start after the locked client is released')
        return { sent: true }
      },
    }),
    (error) => (
      error.statusCode === 409
      && error.code === 'store_card_payment_completed'
      && error.details.orderStatus === 'placed'
      && error.details.paymentStatus === 'paid'
    ),
  )

  assert.equal(state.row.status, 'placed')
  assert.equal(state.row.payment_status, 'paid')
  assert.equal(state.row.external_reference, 'pi_store')
  assert.equal(state.row.stripe_checkout_session_url, null)
  assert.equal(state.locks, 2)
  assert.equal(state.paymentUpdates, 1)
  assert.equal(state.cancellationUpdates, 0)
  assert.equal(state.restocks, 0)
  assert.deepEqual(state.audits, ['sale_card_payment_completed'])
  assert.equal(receiptAttempts, 1)
  assert.equal(state.releases, 1)
})

test('card cancellation fails closed when Stripe does not confirm exact expiration', async () => {
  const { pool, state } = cancellationPool({
    items: [{ product_id: 18, quantity: 1 }],
  })
  const stripe = {
    checkout: {
      sessions: {
        async retrieve() { return checkoutSession() },
        async expire() { return checkoutSession({ id: 'cs_wrong', status: 'expired' }) },
      },
    },
  }

  await assert.rejects(
    cancelStoreOrder(pool, {
      orderId: 71,
      facilityId: 9,
      actorUserId: 3,
      stripe,
    }),
    (error) => (
      error instanceof StoreStripeCheckoutBindingConflict
      && error.details.expectedStripeCheckoutSessionId === 'cs_store'
    ),
  )
  assert.equal(state.restocks, 0)
  assert.equal(state.cancellationUpdates, 0)
  assert.equal(state.rollbacks, 1)
})

test('a replayed cancellation neither calls Stripe nor restores inventory twice', async () => {
  const { pool, state } = cancellationPool({
    row: databaseOrder({ status: 'cancelled' }),
    items: [{ product_id: 18, quantity: 1 }],
  })
  const stripe = {
    checkout: {
      sessions: {
        async retrieve() { throw new Error('Stripe should not be called on a completed cancellation') },
        async expire() { throw new Error('Stripe should not be called on a completed cancellation') },
      },
    },
  }

  const result = await cancelStoreOrder(pool, {
    orderId: 71,
    facilityId: 9,
    actorUserId: 3,
    stripe,
  })

  assert.equal(result.status, 'cancelled')
  assert.equal(state.locks, 1)
  assert.equal(state.restocks, 0)
  assert.equal(state.cancellationUpdates, 0)
})

function checkoutOrder() {
  return {
    id: 71,
    orderNumber: 'ST-CREATE-RACE',
    purchaserEmail: 'guest@example.com',
    status: 'awaiting_payment',
    paymentStatus: 'pending',
    paymentMethod: 'card',
    discountCents: 0,
    totalCents: 5100,
    stripeCheckoutUrl: null,
    items: [{
      productName: 'Team shirt',
      sku: 'TS-1',
      unitPriceCents: 5100,
      quantity: 1,
      lineTotalCents: 5100,
    }],
  }
}

test('cancellation between remote Checkout creation and local bind expires the unbound Session', async () => {
  let expired = false
  const open = checkoutSession()
  const stripe = {
    checkout: {
      sessions: {
        async create() { return open },
        async retrieve(id) {
          assert.equal(id, 'cs_store')
          return open
        },
        async expire(id) {
          assert.equal(id, 'cs_store')
          expired = true
          return checkoutSession({ status: 'expired' })
        },
      },
    },
  }
  const pool = {
    async query(sql, params) {
      const text = String(sql)
      assert.match(text, /status = 'awaiting_payment'/)
      assert.match(text, /payment_status = 'pending'/)
      assert.match(text, /payment_method = 'card'/)
      assert.deepEqual(params, [71, 'cs_store', 'https://checkout.test/cs_store'])
      return { rows: [] }
    },
  }

  await assert.rejects(
    createCardCheckout(pool, checkoutOrder(), { stripe }),
    (error) => (
      error instanceof StoreStripeCheckoutBindingConflict
      && error.details.checkoutDisposition === 'expired'
    ),
  )
  assert.equal(expired, true)
})

test('a cached paid Checkout is settled once and its terminal URL is never returned', async () => {
  const { pool, state } = cancellationPool()
  const paid = checkoutSession({
    status: 'complete',
    payment_status: 'paid',
    payment_intent: 'pi_store',
  })
  const stripe = {
    checkout: {
      sessions: {
        async retrieve(id) {
          assert.equal(id, 'cs_store')
          return paid
        },
      },
    },
  }

  await assert.rejects(
    createCardCheckout(pool, {
      ...checkoutOrder(),
      stripeCheckoutUrl: 'https://checkout.test/cs_store',
    }, { stripe }),
    (error) => (
      error instanceof StoreStripeCheckoutBindingConflict
      && error.details.checkoutDisposition === 'paid'
    ),
  )

  assert.equal(state.row.status, 'placed')
  assert.equal(state.row.payment_status, 'paid')
  assert.equal(state.row.stripe_checkout_session_url, null)
  assert.equal(state.paymentUpdates, 1)
  assert.deepEqual(state.audits, ['sale_card_payment_completed'])
})

test('a cached open Checkout returns only the URL from its exact live Stripe Session', async () => {
  const { pool, state } = cancellationPool()
  const stripe = {
    checkout: {
      sessions: {
        async retrieve(id, options) {
          assert.equal(id, 'cs_store')
          assert.deepEqual(options, { expand: ['payment_intent'] })
          return checkoutSession({ url: 'https://checkout.test/cs_store/live' })
        },
      },
    },
  }

  const url = await createCardCheckout(pool, {
    ...checkoutOrder(),
    stripeCheckoutUrl: 'https://checkout.test/cs_store/stale-cache',
  }, { stripe })

  assert.equal(url, 'https://checkout.test/cs_store/live')
  assert.equal(state.row.status, 'awaiting_payment')
  assert.equal(state.paymentUpdates, 0)
  assert.equal(state.cancellationUpdates, 0)
})

test('a cached expired Checkout releases inventory and clears its reusable URL', async () => {
  const { pool, state } = cancellationPool({
    items: [{
      id: 4,
      product_id: 18,
      product_name: 'Team shirt',
      sku: 'TS-1',
      unit_price_cents: 5100,
      quantity: 1,
      line_total_cents: 5100,
    }],
  })
  const expired = checkoutSession({ status: 'expired' })
  const stripe = {
    checkout: {
      sessions: {
        async retrieve(id) {
          assert.equal(id, 'cs_store')
          return expired
        },
      },
    },
  }

  await assert.rejects(
    createCardCheckout(pool, {
      ...checkoutOrder(),
      stripeCheckoutUrl: 'https://checkout.test/cs_store',
    }, { stripe }),
    (error) => (
      error instanceof StoreStripeCheckoutBindingConflict
      && error.details.checkoutDisposition === 'expired'
    ),
  )

  assert.equal(state.row.status, 'cancelled')
  assert.equal(state.row.stripe_checkout_session_url, null)
  assert.equal(state.restocks, 1)
  assert.equal(state.cancellationUpdates, 1)
})

test('a newly bound paid Checkout is settled without returning its terminal URL', async () => {
  const { pool, state } = cancellationPool({
    row: databaseOrder({
      stripe_checkout_session_id: null,
      stripe_checkout_session_url: null,
    }),
  })
  const paid = checkoutSession({
    status: 'complete',
    payment_status: 'paid',
    payment_intent: 'pi_store',
  })
  const stripe = {
    checkout: {
      sessions: {
        async create() { return paid },
      },
    },
  }

  await assert.rejects(
    createCardCheckout(pool, { ...checkoutOrder(), stripeCheckoutUrl: null }, { stripe }),
    (error) => (
      error instanceof StoreStripeCheckoutBindingConflict
      && error.details.checkoutDisposition === 'paid'
    ),
  )

  assert.equal(state.row.stripe_checkout_session_id, 'cs_store')
  assert.equal(state.row.status, 'placed')
  assert.equal(state.row.stripe_checkout_session_url, null)
  assert.equal(state.paymentUpdates, 1)
  assert.deepEqual(state.audits, ['sale_card_payment_completed'])
})

test('a newly bound expired Checkout releases its reservation and returns no URL', async () => {
  const { pool, state } = cancellationPool({
    row: databaseOrder({
      stripe_checkout_session_id: null,
      stripe_checkout_session_url: null,
    }),
    items: [{
      id: 4,
      product_id: 18,
      product_name: 'Team shirt',
      sku: 'TS-1',
      unit_price_cents: 5100,
      quantity: 1,
      line_total_cents: 5100,
    }],
  })
  const expired = checkoutSession({ status: 'expired' })
  const stripe = {
    checkout: {
      sessions: {
        async create() { return expired },
        async retrieve(id) {
          assert.equal(id, 'cs_store')
          return expired
        },
      },
    },
  }

  await assert.rejects(
    createCardCheckout(pool, { ...checkoutOrder(), stripeCheckoutUrl: null }, { stripe }),
    (error) => (
      error instanceof StoreStripeCheckoutBindingConflict
      && error.details.checkoutDisposition === 'expired'
    ),
  )

  assert.equal(state.row.status, 'cancelled')
  assert.equal(state.row.stripe_checkout_session_url, null)
  assert.equal(state.restocks, 1)
  assert.equal(state.cancellationUpdates, 1)
})
