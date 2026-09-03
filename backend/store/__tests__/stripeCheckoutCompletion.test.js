import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertStoreStripeCheckoutBinding,
  completeStoreStripeCheckout,
  sendReceiptIfNeeded,
  StoreStripeCheckoutBindingConflict,
} from '../registerRoutes.js'

function order(overrides = {}) {
  return {
    id: 71,
    status: 'awaiting_payment',
    payment_status: 'pending',
    payment_method: 'card',
    total_cents: 5100,
    stripe_checkout_session_id: 'cs_store',
    external_reference: null,
    ...overrides,
  }
}

function session(overrides = {}) {
  return {
    id: 'cs_store',
    object: 'checkout.session',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    payment_intent: 'pi_store',
    amount_total: 5100,
    currency: 'usd',
    customer: null,
    metadata: { checkoutType: 'store', storeOrderId: '71' },
    ...overrides,
  }
}

test('guest store Checkout binds by its persisted Session, order, PaymentIntent, amount, and USD', () => {
  assert.deepEqual(assertStoreStripeCheckoutBinding(order(), session()), {
    orderId: 71,
    sessionId: 'cs_store',
    paymentIntentId: 'pi_store',
    amountTotal: 5100,
  })
  assert.equal(session().customer, null)
})

test('store Checkout completion fails closed for missing, ambiguous, or mismatched ownership', () => {
  const cases = [
    [null, session(), 'store_order_mismatch'],
    [order(), session({ metadata: { checkoutType: 'store' } }), 'store_order_mismatch'],
    [order({ stripe_checkout_session_id: null }), session(), 'checkout_session_mismatch'],
    [order({ stripe_checkout_session_id: 'cs_other' }), session(), 'checkout_session_mismatch'],
    [order(), session({ payment_intent: null }), 'payment_intent_missing'],
    [order(), session({ amount_total: 5000 }), 'checkout_amount_mismatch'],
    [order(), session({ currency: 'cad' }), 'checkout_currency_mismatch'],
    [order(), session({ status: 'open' }), 'checkout_not_paid'],
    [order({ payment_method: 'cash' }), session(), 'store_payment_method_mismatch'],
    [order({ status: 'cancelled' }), session(), 'store_order_status_mismatch'],
    [order({ status: 'placed', payment_status: 'external' }), session(), 'store_payment_status_mismatch'],
    [order({ status: 'placed', payment_status: 'paid', external_reference: 'pi_other' }), session(), 'store_external_reference_mismatch'],
  ]

  for (const [localOrder, stripeSession, expectedProblem] of cases) {
    assert.throws(
      () => assertStoreStripeCheckoutBinding(localOrder, stripeSession),
      (error) => (
        error instanceof StoreStripeCheckoutBindingConflict
        && error.details.problems.includes(expectedProblem)
      ),
    )
  }
})

test('a replayed store Checkout is accepted only for the same already-paid order', () => {
  const replay = order({
    status: 'placed',
    payment_status: 'paid',
    external_reference: 'pi_store',
  })
  assert.doesNotThrow(() => assertStoreStripeCheckoutBinding(replay, session()))
  assert.throws(
    () => assertStoreStripeCheckoutBinding(
      { ...replay, external_reference: 'pi_different' },
      session(),
    ),
    /does not exactly match store order/,
  )
})

test('store Checkout fulfillment replays without another sale mutation, discount, audit, or receipt', async () => {
  const state = {
    row: {
      ...order(),
      facility_id: 9,
      order_number: 'ST-EXACT',
      member_id: null,
      family_billing_account_id: null,
      billing_charge_id: null,
      discount_code_id: 5,
      purchaser_name: 'Store Guest',
      purchaser_email: null,
      source: 'public',
      external_reference: null,
      stripe_checkout_session_url: 'https://checkout.test/cs_store',
      subtotal_cents: 5100,
      discount_cents: 0,
      fulfillment_note: 'Pickup',
      picked_up_at: null,
      receipt_sent_at: null,
      created_at: new Date('2026-09-03T00:00:00Z'),
      updated_at: new Date('2026-09-03T00:00:00Z'),
    },
    paymentUpdates: 0,
    discountsConsumed: 0,
    saleAudits: 0,
  }
  const client = {
    async query(sql) {
      const text = String(sql)
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] }
      if (text.includes('SELECT * FROM store_order WHERE id = $1 FOR UPDATE')) {
        return { rows: [state.row] }
      }
      if (text.includes("SET status = 'placed', payment_status = 'paid'")) {
        state.paymentUpdates += 1
        state.row.status = 'placed'
        state.row.payment_status = 'paid'
        state.row.external_reference = 'pi_store'
        state.row.stripe_checkout_session_url = null
        return { rows: [] }
      }
      if (text.includes('UPDATE store_discount_code')) {
        state.discountsConsumed += 1
        return { rows: [] }
      }
      if (text.includes('INSERT INTO store_action_audit')) {
        state.saleAudits += 1
        return { rows: [] }
      }
      if (text.includes('FROM store_order o')) {
        return { rows: [{ ...state.row, discount_code: null }] }
      }
      if (text.includes('FROM store_order_item')) return { rows: [] }
      throw new Error(`Unexpected store Checkout test query: ${text}`)
    },
    release() {},
  }
  const pool = {
    async connect() {
      return client
    },
  }

  const first = await completeStoreStripeCheckout(pool, session())
  const replay = await completeStoreStripeCheckout(pool, session())

  assert.equal(first.paymentCompleted, true)
  assert.equal(replay.paymentCompleted, false)
  assert.equal(state.paymentUpdates, 1)
  assert.equal(state.discountsConsumed, 1)
  assert.equal(state.saleAudits, 1)
  assert.equal(state.row.stripe_checkout_session_url, null)
})

test('a persisted store receipt stamp suppresses email on reconciliation replay', async () => {
  let sends = 0
  const paidOrder = {
    ...order({ status: 'placed', payment_status: 'paid' }),
    order_number: 'ST-RECEIPT',
    purchaser_name: 'Store Guest',
    purchaser_email: 'guest@example.com',
    source: 'public',
    subtotal_cents: 5100,
    discount_cents: 0,
    fulfillment_note: 'Pickup',
    receipt_sent_at: new Date('2026-09-03T01:00:00Z'),
  }
  const client = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('FROM store_order o')) {
        return { rows: [{ ...paidOrder, discount_code: null }] }
      }
      if (text.includes('FROM store_order_item')) return { rows: [] }
      throw new Error(`Unexpected receipt replay query: ${text}`)
    },
    release() {},
  }
  const result = await sendReceiptIfNeeded(
    { connect: async () => client },
    71,
    {
      sendReceiptEmail: async () => {
        sends += 1
        return { sent: true }
      },
    },
  )

  assert.deepEqual(result, { sent: false, replayed: true })
  assert.equal(sends, 0)
})
