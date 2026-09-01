import test from 'node:test'
import assert from 'node:assert/strict'
import {
  enumerateOpenSubscriptionCheckoutSessions,
  expireExplicitOpenSubscriptionCheckoutSessions,
} from '../../scripts/manage-stale-subscription-checkout-sessions.mjs'

test('stale subscription Checkout audit paginates without mutating Stripe', async () => {
  const listCalls = []
  let expireCalls = 0
  const pages = [
    {
      data: [
        { id: 'cs_test_sub_a', mode: 'subscription', status: 'open', metadata: { familyBillingAccountId: '8' } },
        { id: 'cs_test_pay', mode: 'payment', status: 'open' },
      ],
      has_more: true,
    },
    {
      data: [{ id: 'cs_test_sub_b', mode: 'subscription', status: 'open' }],
      has_more: false,
    },
  ]
  const stripe = {
    checkout: {
      sessions: {
        async list(params) {
          listCalls.push(params)
          return pages[listCalls.length - 1]
        },
        async expire() {
          expireCalls += 1
        },
      },
    },
  }

  const result = await enumerateOpenSubscriptionCheckoutSessions(stripe)

  assert.deepEqual(result.map((session) => session.id), ['cs_test_sub_a', 'cs_test_sub_b'])
  assert.deepEqual(listCalls, [
    { limit: 100, status: 'open' },
    { limit: 100, status: 'open', starting_after: 'cs_test_pay' },
  ])
  assert.equal(expireCalls, 0)
})

test('explicit stale Checkout expiry is preview-only unless apply is set', async () => {
  const expired = []
  const stripe = {
    checkout: {
      sessions: {
        async retrieve(id) {
          return { id, mode: 'subscription', status: 'open', subscription: null }
        },
        async expire(id, params, options) {
          expired.push({ id, params, options })
        },
      },
    },
  }

  const preview = await expireExplicitOpenSubscriptionCheckoutSessions(
    stripe,
    ['cs_test_stale'],
  )
  assert.equal(preview[0].action, 'eligible')
  assert.deepEqual(expired, [])

  const applied = await expireExplicitOpenSubscriptionCheckoutSessions(
    stripe,
    ['cs_test_stale'],
    { apply: true },
  )
  assert.equal(applied[0].action, 'expired')
  assert.deepEqual(expired, [{
    id: 'cs_test_stale',
    params: {},
    options: { idempotencyKey: 'expire-stale-subscription-checkout:cs_test_stale' },
  }])
})

test('expiry refuses completed sessions and sessions that already created a collector', async (t) => {
  await t.test('completed', async () => {
    const stripe = {
      checkout: { sessions: { retrieve: async (id) => ({ id, mode: 'subscription', status: 'complete' }) } },
    }
    await assert.rejects(
      expireExplicitOpenSubscriptionCheckoutSessions(stripe, ['cs_test_complete'], { apply: true }),
      /not open/,
    )
  })
  await t.test('collector attached', async () => {
    const stripe = {
      checkout: {
        sessions: {
          retrieve: async (id) => ({ id, mode: 'subscription', status: 'open', subscription: 'sub_existing' }),
        },
      },
    }
    await assert.rejects(
      expireExplicitOpenSubscriptionCheckoutSessions(stripe, ['cs_test_collector'], { apply: true }),
      /reviewed cancellation/,
    )
  })
})
