import assert from 'node:assert/strict'
import test from 'node:test'
import { assertTerminalIntentBinding, registerStripeTerminalRoutes } from '../stripeTerminal.js'
import { terminalLocationForFacility } from '../stripeTerminalConfig.js'

test('Stripe Terminal locations are explicitly scoped to one facility', () => {
  const config = (locations) => ({ STRIPE_TERMINAL_ENABLED: 'true', STRIPE_TERMINAL_LOCATIONS: locations })
  assert.equal(terminalLocationForFacility(2, config('{"2":"tml_example"}')), 'tml_example')
  assert.equal(terminalLocationForFacility(3, config('{"2":"tml_example"}')), null)
  assert.equal(terminalLocationForFacility(2, config('{"2":"tml_example","3":"tml_example"}')), null)
  assert.equal(terminalLocationForFacility(2, config('invalid')), null)
})

test('a completed Terminal intent must match the exact amount and payment owner', () => {
  const attempt = {
    id: 'attempt', kind: 'billing', facility_id: 2, target_id: 37, livemode: false,
    amount_cents: 1200, stripe_customer_id: 'cus_example', stripe_payment_intent_id: 'pi_example',
  }
  const intent = {
    id: 'pi_example', amount: 1200, amount_received: 1200, currency: 'usd', status: 'succeeded',
    livemode: false, customer: 'cus_example', payment_method_types: ['card_present'],
    metadata: { vortexTerminal: 'billing', terminalAttemptId: 'attempt', terminalFacilityId: '2', terminalTargetId: '37' },
  }
  assert.doesNotThrow(() => assertTerminalIntentBinding(attempt, intent))
  for (const mismatch of [
    { amount_received: 1100 }, { payment_method_types: ['card'] }, { customer: 'cus_other' },
    { livemode: true }, { metadata: { ...intent.metadata, terminalFacilityId: '3' } },
  ]) {
    assert.throws(() => assertTerminalIntentBinding(attempt, { ...intent, ...mismatch }), /do not match/)
  }
})

test('a decline retries the same store intent, and cancel leaves an unrelated reader action alone', async (t) => {
  const environment = {
    STRIPE_TERMINAL_ENABLED: 'true', STRIPE_TERMINAL_LOCATIONS: '{"2":"tml_example"}',
    STRIPE_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_not_used',
  }
  const previous = Object.fromEntries(Object.keys(environment).map((key) => [key, process.env[key]]))
  Object.assign(process.env, environment)
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key]
      else process.env[key] = value
    }
  })

  let attempt
  const db = {
    release() {},
    async query(sql, args) {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] }
      if (sql.includes('pg_advisory_unlock')) return { rows: [{ released: true }] }
      if (sql.includes('FROM stripe_terminal_payment')) {
        return { rows: attempt && Number(attempt.facility_id) === args[0] ? [attempt] : [] }
      }
      if (sql.includes('FROM store_order')) {
        return { rows: args[0] === 37 && args[1] === 2 ? [{
          id: 37, source: 'admin', payment_method: 'terminal', status: 'awaiting_payment',
          payment_status: 'pending', total_cents: 1200,
        }] : [] }
      }
      if (sql.includes('INSERT INTO stripe_terminal_payment')) {
        const [id, facility_id, kind, target_id, actor_user_id, reader_id, reader_simulated, livemode] = args
        attempt = { id, facility_id, kind, target_id, actor_user_id, reader_id, reader_simulated, livemode, state: 'open', dispatch_number: 0 }
      } else if (sql.includes('SET amount_cents')) {
        const [, amount_cents, stripe_customer_id, stripe_metadata] = args
        Object.assign(attempt, { amount_cents, stripe_customer_id, stripe_metadata, create_started_at: new Date() })
      } else if (sql.includes('SET stripe_payment_intent_id')) {
        attempt.stripe_payment_intent_id = args[1]
      } else if (sql.includes('SET dispatch_number')) {
        attempt.dispatch_number += 1
      } else if (sql.includes('SET state')) {
        attempt.state = args[1]
      } else {
        assert.fail(`Unexpected query: ${sql}`)
      }
      return { rows: [attempt] }
    },
  }
  let intent
  let created = 0
  let readerCancels = 0
  const dispatches = []
  const reader = { id: 'tmr_example', label: 'Test reader', device_type: 'simulated_wisepos_e', livemode: false, status: 'online', location: 'tml_example' }
  const readerAction = (payment_intent, status) => ({ type: 'process_payment_intent', status, process_payment_intent: { payment_intent } })
  const stripe = {
    paymentIntents: {
      async create(params) {
        created += 1
        assert.equal(params.amount, 1200)
        intent = { ...params, id: 'pi_example', status: 'requires_payment_method', livemode: false }
        return intent
      },
      async retrieve(id) {
        assert.equal(id, intent.id)
        return intent
      },
      async cancel(id) {
        assert.equal(id, intent.id)
        return { ...intent, status: 'canceled' }
      },
    },
    terminal: {
      readers: {
        async retrieve(id) {
          assert.equal(id, reader.id)
          return reader
        },
        async processPaymentIntent(id, { payment_intent }) {
          assert.equal(id, reader.id)
          dispatches.push(payment_intent)
          reader.action = readerAction(payment_intent, 'in_progress')
          return reader
        },
        async cancelAction() { readerCancels += 1 },
      },
    },
    testHelpers: {
      terminal: {
        readers: {
          async presentPaymentMethod(id, params) {
            assert.equal(id, reader.id)
            assert.equal(params.card_present.number, '4000000000009995')
            reader.action = readerAction(intent.id, 'failed')
          },
        },
      },
    },
  }
  const handlers = new Map()
  registerStripeTerminalRoutes({
    get: (path, fn) => handlers.set(`GET ${path}`, fn),
    post: (path, fn) => handlers.set(`POST ${path}`, fn),
  }, { connect: async () => db }, [], { getStripe: async () => stripe })
  const path = '/api/admin/stripe-terminal/:kind/:targetId'
  const call = async (method, body = {}, suffix = '', facilityId = 2) => {
    let code = 200
    let payload
    await handlers.get(`${method} ${path}${suffix}`)({
      platformAuth: { user: { id: 10, facility_id: facilityId } },
      params: { kind: 'store', targetId: '37' },
      body,
    }, {
      set() {},
      status(value) { code = value; return this },
      json(value) { payload = value },
    })
    return { code, ...payload }
  }
  const start = { readerId: 'tmr_example', expectedAmountCents: 1200 }
  assert.equal((await call('POST', { ...start, expectedAmountCents: 1300 })).code, 409)
  assert.equal(created, 0)
  const first = (await call('POST', start)).data
  assert.equal(first.status, 'awaiting_card')
  assert.equal((await call('GET', {}, '', 9)).data, null)
  assert.equal((await call('POST', { attemptId: first.id, outcome: 'declined' }, '/simulate')).data.status, 'retryable')
  assert.equal((await call('POST', start)).data.id, first.id)
  assert.equal((await call('POST', start)).data.status, 'awaiting_card')
  assert.equal(created, 1)
  assert.deepEqual(dispatches, ['pi_example', 'pi_example'])
  reader.action = readerAction('pi_other', 'in_progress')
  assert.equal((await call('POST', { attemptId: first.id }, '/cancel')).data.status, 'canceled')
  assert.equal(readerCancels, 0)
})
