import test from 'node:test'
import assert from 'node:assert/strict'
import { retryStripeStateWebhooks } from '../stripeStateWebhookRetry.js'

test('failed state events reuse durable claims and current-state handlers, with retryable failures', async () => {
  const calls = []
  const rows = [
    { event_id: 'evt_subscription', event_type: 'customer.subscription.updated' },
    { event_id: 'evt_customer', event_type: 'customer.updated' },
    { event_id: 'evt_retry', event_type: 'payment_method.updated' },
  ]
  const pool = { async query(sql, params) {
    assert.match(sql, /lease_expires_at/)
    assert.match(sql, /ORDER BY updated_at, event_id LIMIT \$2/)
    assert.equal(params[1], 100)
    return { rows }
  } }
  const stripe = { events: { retrieve: async (id) => {
    if (id === 'evt_retry') throw new Error('temporary Stripe failure')
    const row = rows.find((item) => item.event_id === id)
    return { id, type: row.event_type, data: { object: { id: 'obj_test' } } }
  } } }
  const result = await retryStripeStateWebhooks(pool, stripe, {
    begin: async (_, event) => ({ claimed: true, claimToken: event.id }),
    complete: async (_, event, claim) => { assert.equal(claim.claimToken, event.id); calls.push(`completed:${event.id}`) },
    fail: async (_, event, error, claim) => { assert.equal(claim.claimToken, event.id); assert.match(error.message, /temporary/); calls.push(`failed:${event.id}`) },
    syncSubscription: async (_, object, type, options) => { assert.equal(options.stripe, stripe); calls.push(type) },
    refreshCustomer: async (_, suppliedStripe, event) => { assert.equal(suppliedStripe, stripe); calls.push(event.type) },
  })
  assert.deepEqual(result, { checked: 3, completed: 2, failed: 1, inProgress: 0 })
  assert.deepEqual(calls, ['customer.subscription.updated', 'completed:evt_subscription', 'customer.updated', 'completed:evt_customer', 'failed:evt_retry'])
})

test('retry never dispatches a foreign event or an actively claimed duplicate', async () => {
  const rows = [{ event_id: 'evt_busy', event_type: 'customer.updated' }, { event_id: 'evt_wrong', event_type: 'customer.updated' }]
  let retrieved = 0
  let failed = 0
  const result = await retryStripeStateWebhooks({ query: async () => ({ rows }) }, { events: { retrieve: async () => {
    retrieved += 1
    return { id: 'evt_foreign', type: 'customer.updated', data: { object: { id: 'cus_test' } } }
  } } }, {
    begin: async (_, event) => event.id === 'evt_busy' ? { claimed: false } : { claimed: true, claimToken: 'token' },
    complete: async () => assert.fail('unverified event must not complete'),
    fail: async () => { failed += 1 },
    refreshCustomer: async () => assert.fail('unverified event must not dispatch'),
  })
  assert.equal(retrieved, 1)
  assert.equal(failed, 1)
  assert.deepEqual(result, { checked: 2, completed: 0, failed: 1, inProgress: 1 })
})
