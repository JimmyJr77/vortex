import test from 'node:test'
import assert from 'node:assert/strict'
import { parseWebhookEvent, stripeWebhookRawBody } from '../stripeBilling.js'

async function withStripeEnv(values, callback) {
  const names = ['STRIPE_ENABLED', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRETS']
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]))
  try {
    for (const name of names) delete process.env[name]
    Object.assign(process.env, values)
    await callback()
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]
      else process.env[name] = previous[name]
    }
  }
}

test('stripeWebhookRawBody prefers the bytes captured before JSON parsing', () => {
  const rawBody = Buffer.from('{"id":"evt_live"}')
  assert.equal(stripeWebhookRawBody({ body: { id: 'evt_live' }, rawBody }), rawBody)
})

test('live mode refuses webhook events when the signing secret is absent', async () => {
  await withStripeEnv(
    { STRIPE_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_live_placeholder' },
    async () => {
      await assert.rejects(
        parseWebhookEvent(Buffer.from('{"id":"evt_live"}'), 't=1,v1=bad'),
        /signing secret is required in live mode/i,
      )
    },
  )
})

test('live mode refuses webhook events when the Stripe signature is absent', async () => {
  await withStripeEnv(
    {
      STRIPE_ENABLED: 'true',
      STRIPE_SECRET_KEY: 'sk_live_placeholder',
      STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
    },
    async () => {
      await assert.rejects(
        parseWebhookEvent(Buffer.from('{"id":"evt_live"}'), null),
        /signature is required in live mode/i,
      )
    },
  )
})
