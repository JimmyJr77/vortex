import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  attachBillingPaymentAttemptStripeObject,
  completeBillingPaymentAttempt,
  paymentAttemptIsActive,
  paymentIntentFailureIsFinal,
  reconcileActiveBillingPaymentAttempts,
  recordAndCompleteBillingPaymentAttempt,
  releaseBillingPaymentAttempt,
  reserveBillingPaymentAttempt,
  withBillingAccountCollectionLock,
} from '../paymentAttemptReservations.js'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))

function reservationPool({ collectibleBalanceCents = 12_000, monthlyInvoiceStatus = null } = {}) {
  const state = {
    attempts: [],
    lines: [],
    applications: [],
    candidates: [
      { id: 10, member_id: 1, description: 'July tuition', created_at: '2026-07-01', available_cents: 7000 },
      { id: 11, member_id: 2, description: 'August tuition', created_at: '2026-08-01', available_cents: 5000 },
    ],
    nextAttemptId: 1,
    lockCalls: [],
    candidateSql: '',
    invoiceReservationStatuses: [],
  }
  const client = {
    state,
    release() {},
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock') || text.includes('pg_advisory_unlock')) {
        state.lockCalls.push({ text, params })
        return { rows: [] }
      }
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(text)) return { rows: [] }
      if (text.includes("SET status = 'expired'") && text.includes("status = 'reserved'")) return { rows: [] }
      if (text.includes('family_billing_account_id = $1 AND attempt_type = $2 AND request_key = $3')) {
        const row = state.attempts.find((attempt) => (
          attempt.family_billing_account_id === Number(params[0])
          && attempt.attempt_type === params[1]
          && attempt.request_key === params[2]
        ))
        return { rows: row ? [row] : [] }
      }
      if (text.includes('WITH application_totals AS') && text.includes('FOR UPDATE OF charge')) {
        state.candidateSql = text
        state.invoiceReservationStatuses = params[2] ?? []
        const reservedByInvoice = monthlyInvoiceStatus
          && state.invoiceReservationStatuses.includes(monthlyInvoiceStatus)
        return { rows: reservedByInvoice ? [] : state.candidates }
      }
      if (text.includes('canonical-billing:collectible-balance')) {
        return { rows: [{ collectible_balance_cents: collectibleBalanceCents }] }
      }
      if (text.includes('INSERT INTO billing_payment_attempt (')) {
        const row = {
          id: state.nextAttemptId++,
          family_billing_account_id: Number(params[0]),
          attempt_type: params[1],
          request_key: params[2],
          status: 'reserved',
          amount_cents: Number(params[3]),
          target_charge_id: params[4] == null ? null : Number(params[4]),
          expires_at: params[5],
          metadata: JSON.parse(params[6]),
        }
        state.attempts.push(row)
        return { rows: [row] }
      }
      if (text.includes('INSERT INTO billing_payment_attempt_charge')) {
        state.lines.push({
          billing_payment_attempt_id: Number(params[0]),
          billing_charge_id: Number(params[1]),
          amount_cents: Number(params[2]),
        })
        return { rows: [] }
      }
      if (text.includes('FROM billing_payment_attempt_charge reservation') && text.includes('JOIN billing_charge charge')) {
        return {
          rows: state.lines
            .filter((line) => line.billing_payment_attempt_id === Number(params[0]))
            .map((line) => {
              const charge = state.candidates.find((candidate) => candidate.id === line.billing_charge_id)
              return { ...line, description: charge?.description, member_id: charge?.member_id }
            }),
        }
      }
      throw new Error(`Unexpected reservation query: ${text}`)
    },
  }
  return client
}

test('remote payment attempts stay active until Stripe explicitly terminates them', () => {
  const past = '2020-01-01T00:00:00.000Z'
  assert.equal(paymentAttemptIsActive({ status: 'pending', expires_at: past }), true)
  assert.equal(paymentAttemptIsActive({ status: 'processing', expires_at: past }), true)
  assert.equal(paymentAttemptIsActive({ status: 'reconciliation_required', expires_at: past }), true)
  assert.equal(paymentAttemptIsActive({ status: 'reserved', expires_at: past }), false)
  assert.equal(paymentAttemptIsActive({ status: 'failed', expires_at: '2099-01-01T00:00:00.000Z' }), false)
  assert.equal(paymentIntentFailureIsFinal({ status: 'requires_payment_method' }), false)
  assert.equal(paymentIntentFailureIsFinal({ status: 'canceled' }), true)
})

test('a payment idempotency key reserves exact charge slices only once', async () => {
  const pool = reservationPool()
  const input = {
    accountId: 7,
    attemptType: 'member_balance_checkout',
    requestKey: 'member-request-123',
    amountCents: 9000,
    expiresAt: new Date(Date.now() + 60_000),
  }
  const first = await reserveBillingPaymentAttempt(pool, input)
  const replay = await reserveBillingPaymentAttempt(pool, input)

  assert.equal(first.id, replay.id)
  assert.equal(replay.replayed, true)
  assert.deepEqual(first.reservations.map((line) => [line.billing_charge_id, line.amount_cents]), [
    [10, 7000],
    [11, 2000],
  ])
  assert.equal(pool.state.attempts.length, 1)
  assert.equal(pool.state.lines.length, 2)
  assert.match(pool.state.candidateSql, /JOIN billing_payment payment ON payment\.id = application\.billing_payment_id/)
  assert.match(pool.state.candidateSql, /payment\.external_status IN \('settled', 'succeeded'\)/)
})

test('a reversed charge from paid invoice history is reservable but live invoice owners remain excluded', async (t) => {
  const paidHistory = reservationPool({ collectibleBalanceCents: 5000, monthlyInvoiceStatus: 'paid' })
  const attempt = await reserveBillingPaymentAttempt(paidHistory, {
    accountId: 7,
    attemptType: 'member_balance_checkout',
    requestKey: 'paid-invoice-refund-retry',
    amountCents: 5000,
    expiresAt: new Date(Date.now() + 60_000),
  })
  assert.equal(attempt.amount_cents, 5000)
  assert.match(paidHistory.state.candidateSql, /application_kind = 'reversal'/)
  assert.equal(paidHistory.state.invoiceReservationStatuses.includes('paid'), false)

  for (const status of ['open', 'failed']) {
    await t.test(status, async () => {
      const liveOwner = reservationPool({ collectibleBalanceCents: 5000, monthlyInvoiceStatus: status })
      await assert.rejects(
        reserveBillingPaymentAttempt(liveOwner, {
          accountId: 7,
          attemptType: 'member_balance_checkout',
          requestKey: `${status}-invoice-retry`,
          amountCents: 5000,
          expiresAt: new Date(Date.now() + 60_000),
        }),
        /exceeds the unreserved account balance/i,
      )
      assert.equal(liveOwner.state.invoiceReservationStatuses.includes(status), true)
    })
  }
})

test('an outer collection lock can call reservation with a PoolClient without reconnecting it', async () => {
  const client = reservationPool()
  client.connect = async () => { throw new Error('a checked-out PoolClient must not reconnect') }
  let releases = 0
  client.release = () => { releases += 1 }
  const pool = { connect: async () => client }

  await withBillingAccountCollectionLock(pool, 7, (db) => reserveBillingPaymentAttempt(db, {
    accountId: 7,
    attemptType: 'member_balance_checkout',
    requestKey: 'nested-client-reservation',
    amountCents: 5000,
    expiresAt: new Date(Date.now() + 60_000),
  }))

  assert.equal(client.state.lockCalls.filter(({ text }) => text.includes('pg_advisory_lock')).length, 2)
  assert.equal(client.state.lockCalls.filter(({ text }) => text.includes('pg_advisory_unlock')).length, 2)
  assert.equal(releases, 1)
})

test('Stripe attachment pins BEGIN, row lock, mutation, and COMMIT to the locked client', async () => {
  const calls = { pool: [], client: [] }
  const attempt = {
    id: 61,
    family_billing_account_id: 7,
    attempt_type: 'member_balance_checkout',
    status: 'processing',
    stripe_checkout_session_id: null,
  }
  const client = {
    release() {},
    async query(sql, params = []) {
      const text = String(sql)
      calls.client.push(text)
      if (text.includes('pg_advisory_lock') || text.includes('pg_advisory_unlock')) return { rows: [] }
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(text)) return { rows: [] }
      if (text.includes('SELECT * FROM billing_payment_attempt WHERE id = $1 FOR UPDATE')) return { rows: [attempt] }
      if (text.includes('UPDATE billing_payment_attempt')) {
        attempt.status = params[1]
        attempt.stripe_checkout_session_id = params[2]
        return { rows: [{ ...attempt }] }
      }
      throw new Error(`Unexpected attachment client query: ${text}`)
    },
  }
  const pool = {
    async query(sql) {
      const text = String(sql)
      calls.pool.push(text)
      if (text.includes('SELECT family_billing_account_id FROM billing_payment_attempt')) {
        return { rows: [{ family_billing_account_id: 7 }] }
      }
      throw new Error(`Transaction statement escaped to pool: ${text}`)
    },
    connect: async () => client,
  }

  const attached = await attachBillingPaymentAttemptStripeObject(pool, {
    attemptId: 61,
    checkoutSessionId: 'cs_61',
    checkoutUrl: 'https://checkout.test/cs_61',
    status: 'pending',
  })

  assert.equal(attached.stripe_checkout_session_id, 'cs_61')
  assert.deepEqual(calls.pool.map((text) => text.trim().split(/\s+/).slice(0, 2).join(' ')), ['SELECT family_billing_account_id'])
  const lockIndex = calls.client.findIndex((text) => text.includes('pg_advisory_lock'))
  const beginIndex = calls.client.indexOf('BEGIN')
  const updateIndex = calls.client.findIndex((text) => text.includes('UPDATE billing_payment_attempt'))
  const commitIndex = calls.client.indexOf('COMMIT')
  const unlockIndex = calls.client.findIndex((text) => text.includes('pg_advisory_unlock'))
  assert.ok(lockIndex >= 0 && lockIndex < beginIndex && beginIndex < updateIndex)
  assert.ok(updateIndex < commitIndex && commitIndex < unlockIndex)
})

test('unlock failure destroys the checked-out session instead of returning it locked', async () => {
  let releaseError = null
  const client = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock')) return { rows: [{ pg_advisory_lock: null }] }
      if (text.includes('pg_advisory_unlock')) throw new Error('simulated advisory unlock failure')
      throw new Error(`Unexpected lock query: ${text}`)
    },
    release(error) { releaseError = error ?? null },
  }
  const pool = { connect: async () => client }

  await assert.rejects(
    withBillingAccountCollectionLock(pool, 7, async () => 'done'),
    /simulated advisory unlock failure/,
  )
  assert.match(releaseError?.message ?? '', /simulated advisory unlock failure/)
})

function completionPool() {
  const attempt = {
    id: 9,
    family_billing_account_id: 7,
    attempt_type: 'member_balance_checkout',
    request_key: 'request-9',
    status: 'pending',
    amount_cents: 9000,
    target_charge_id: null,
    billing_payment_id: null,
    stripe_checkout_session_id: 'cs_9',
    stripe_payment_intent_id: 'pi_9',
    expires_at: '2026-09-01T00:00:00.000Z',
  }
  const state = {
    attempt,
    applications: [],
    lockCalls: [],
    lines: [
      { billing_payment_attempt_id: 9, billing_charge_id: 10, amount_cents: 7000, description: 'July', member_id: 1 },
      { billing_payment_attempt_id: 9, billing_charge_id: 11, amount_cents: 2000, description: 'August', member_id: 2 },
    ],
  }
  const client = {
    release() {},
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock') || text.includes('pg_advisory_unlock')) {
        state.lockCalls.push({ text, params })
        return { rows: [] }
      }
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(text)) return { rows: [] }
      if (text.includes('SELECT * FROM billing_payment_attempt attempt')) {
        return { rows: [state.attempt] }
      }
      if (text.includes('SELECT * FROM billing_payment_attempt WHERE id = $1 FOR UPDATE')) {
        return { rows: [state.attempt] }
      }
      if (text.includes('FROM billing_payment_attempt_charge reservation') && text.includes('JOIN billing_charge charge')) {
        return { rows: state.lines }
      }
      if (text.includes('FROM billing_payment_application') && text.includes('WHERE billing_payment_id = $1')) {
        return {
          rows: state.applications.map((application) => ({
            billing_charge_id: application.chargeId,
            amount_cents: application.amountCents,
            application_kind: 'application',
            idempotency_key: application.key,
          })),
        }
      }
      if (text.includes('INSERT INTO billing_payment_application')) {
        state.applications.push({ paymentId: params[0], chargeId: params[1], amountCents: params[2], key: params[3] })
        return { rows: [] }
      }
      if (text.includes('UPDATE billing_charge charge')) return { rows: [] }
      if (text.includes("SET status = 'succeeded'")) {
        state.attempt = {
          ...state.attempt,
          status: 'succeeded',
          billing_payment_id: Number(params[1]),
        }
        return { rows: [state.attempt] }
      }
      throw new Error(`Unexpected completion query: ${text}`)
    },
  }
  return {
    state,
    query: (...args) => client.query(...args),
    connect: async () => client,
  }
}

test('webhook completion applies only the charges carried by the reservation', async () => {
  const pool = completionPool()
  const completed = await completeBillingPaymentAttempt(pool, {
    stripeObject: {
      id: 'cs_9',
      object: 'checkout.session',
      payment_intent: 'pi_9',
      metadata: { billingPaymentAttemptId: '9' },
    },
    payment: {
      id: 22,
      family_billing_account_id: 7,
      amount_cents: 9000,
      stripe_payment_intent_id: 'pi_9',
    },
  })

  assert.equal(completed.status, 'succeeded')
  assert.deepEqual(pool.state.applications, [
    { paymentId: 22, chargeId: 10, amountCents: 7000, key: 'payment-attempt:9:charge:10' },
    { paymentId: 22, chargeId: 11, amountCents: 2000, key: 'payment-attempt:9:charge:11' },
  ])
  assert.ok(pool.state.lockCalls.some(({ text }) => text.includes('pg_advisory_lock')))
})

test('a PaymentIntent failure cannot release a still-open Checkout reservation', async () => {
  const attempt = {
    id: 5,
    family_billing_account_id: 7,
    attempt_type: 'member_balance_checkout',
    status: 'pending',
    stripe_checkout_session_id: 'cs_open',
  }
  let updates = 0
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('SELECT * FROM billing_payment_attempt WHERE id')) return { rows: [attempt] }
      if (text.includes('UPDATE billing_payment_attempt')) { updates += 1; return { rows: [] } }
      throw new Error(`Unexpected release query: ${text}`)
    },
  }
  const result = await releaseBillingPaymentAttempt(pool, {
    attemptId: 5,
    status: 'failed',
    reason: 'card declined inside Checkout',
  })
  assert.equal(result.status, 'pending')
  assert.equal(updates, 0)
})

test('PaymentIntent lifecycle cannot release a Checkout attempt before its session link is persisted', async () => {
  const attempt = {
    id: 51,
    family_billing_account_id: 7,
    attempt_type: 'charge_checkout',
    status: 'processing',
    stripe_checkout_session_id: null,
  }
  let updates = 0
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('SELECT * FROM billing_payment_attempt WHERE id')) return { rows: [attempt] }
      if (text.includes('UPDATE billing_payment_attempt')) { updates += 1; return { rows: [] } }
      throw new Error(`Unexpected release query: ${text}`)
    },
  }
  const result = await releaseBillingPaymentAttempt(pool, {
    attemptId: 51,
    status: 'failed',
    reason: 'PaymentIntent failed before Checkout attachment',
  })
  assert.equal(result.status, 'processing')
  assert.equal(updates, 0)
})

test('completion never resurrects a terminal payment attempt', async () => {
  const pool = completionPool()
  pool.state.attempt.status = 'expired'
  await assert.rejects(
    completeBillingPaymentAttempt(pool, {
      stripeObject: {
        id: 'cs_9',
        object: 'checkout.session',
        payment_intent: 'pi_9',
        metadata: { billingPaymentAttemptId: '9' },
      },
      payment: {
        id: 22,
        family_billing_account_id: 7,
        amount_cents: 9000,
        stripe_payment_intent_id: 'pi_9',
      },
    }),
    /after its reservation became expired/i,
  )
  assert.equal(pool.state.attempt.status, 'expired')
  assert.deepEqual(pool.state.applications, [])
})

function atomicSettlementPool({ status = 'processing' } = {}) {
  const state = {
    attempt: {
      id: 31,
      family_billing_account_id: 7,
      attempt_type: 'admin_balance_saved_card',
      request_key: 'atomic-31',
      status,
      amount_cents: 5000,
      target_charge_id: 11,
      billing_payment_id: null,
      stripe_payment_intent_id: 'pi_31',
      expires_at: '2026-09-01T00:00:00.000Z',
    },
    payments: [],
    applications: [],
    transactionSnapshot: null,
    events: [],
  }
  const client = {
    release() {},
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock')) { state.events.push('lock'); return { rows: [] } }
      if (text.includes('pg_advisory_unlock')) { state.events.push('unlock'); return { rows: [] } }
      if (text === 'BEGIN') {
        state.events.push('begin')
        state.transactionSnapshot = {
          payments: state.payments.map((payment) => ({ ...payment })),
          applications: state.applications.map((application) => ({ ...application })),
          attempt: { ...state.attempt },
        }
        return { rows: [] }
      }
      if (text === 'COMMIT') { state.transactionSnapshot = null; return { rows: [] } }
      if (text === 'ROLLBACK') {
        if (state.transactionSnapshot) {
          state.payments = state.transactionSnapshot.payments
          state.applications = state.transactionSnapshot.applications
          state.attempt = state.transactionSnapshot.attempt
        }
        state.transactionSnapshot = null
        return { rows: [] }
      }
      if (text.includes('SELECT * FROM billing_payment_attempt attempt')) {
        return { rows: [state.attempt] }
      }
      if (text.includes('SELECT * FROM billing_payment_attempt WHERE id = $1 FOR UPDATE')) {
        return { rows: [state.attempt] }
      }
      if (text.includes("SET external_status = 'reconciliation_required'")) {
        const payment = state.payments.find((row) => row.id === Number(params[0]))
        payment.external_status = 'reconciliation_required'
        return { rows: [{ ...payment }] }
      }
      if (text.includes("'lateSuccessPaymentId'")) return { rows: [] }
      if (text.includes('FROM billing_payment_application') && text.includes('WHERE billing_payment_id = $1')) {
        return { rows: state.applications }
      }
      throw new Error(`Unexpected atomic settlement query: ${text}`)
    },
  }
  return {
    state,
    client,
    query: (...args) => client.query(...args),
    connect: async () => client,
  }
}

test('an outer collection lock can atomically settle through the same PoolClient', async () => {
  const fixture = atomicSettlementPool()
  fixture.client.connect = async () => { throw new Error('nested settlement must not reconnect its PoolClient') }
  let releases = 0
  fixture.client.release = () => { releases += 1 }
  const pool = { connect: async () => fixture.client }

  await assert.rejects(
    withBillingAccountCollectionLock(pool, 7, (db) => recordAndCompleteBillingPaymentAttempt(db, {
      stripeObject: { id: 'pi_31', object: 'payment_intent', metadata: { billingPaymentAttemptId: '31' } },
      paymentIntentId: 'pi_31',
      amountCents: 5000,
      preparePaymentFunction: async (details) => details,
      recordPaymentFunction: async (_db, details) => ({
        id: 46,
        family_billing_account_id: details.accountId,
        amount_cents: details.amountCents,
        stripe_payment_intent_id: details.paymentIntentId,
      }),
      beforeMapping: async () => { throw new Error('settlement barrier') },
    })),
    /settlement barrier/,
  )

  assert.equal(fixture.state.events.filter((event) => event === 'lock').length, 2)
  assert.equal(fixture.state.events.filter((event) => event === 'unlock').length, 2)
  assert.equal(releases, 1)
})

test('a crash barrier between payment insert and exact mapping rolls back both', async () => {
  const pool = atomicSettlementPool()
  await assert.rejects(
    recordAndCompleteBillingPaymentAttempt(pool, {
      stripeObject: { id: 'pi_31', object: 'payment_intent', metadata: { billingPaymentAttemptId: '31' } },
      paymentIntentId: 'pi_31',
      amountCents: 5000,
      preparePaymentFunction: async (details) => {
        pool.state.events.push('prepare')
        return details
      },
      recordPaymentFunction: async (_db, details) => {
        pool.state.events.push('record')
        const payment = {
          id: 44,
          family_billing_account_id: Number(details.accountId),
          amount_cents: Number(details.amountCents),
          stripe_payment_intent_id: details.paymentIntentId,
          external_status: 'settled',
        }
        pool.state.payments.push(payment)
        return payment
      },
      beforeMapping: async () => {
        pool.state.events.push('barrier')
        throw new Error('simulated process interruption')
      },
    }),
    /simulated process interruption/,
  )
  assert.deepEqual(pool.state.payments, [])
  assert.deepEqual(pool.state.applications, [])
  assert.equal(pool.state.attempt.status, 'processing')
  assert.deepEqual(pool.state.events.slice(0, 5), ['prepare', 'lock', 'begin', 'record', 'barrier'])
})

test('late success stays terminal and its payment is quarantined unapplied', async () => {
  const pool = atomicSettlementPool({ status: 'expired' })
  const settlement = await recordAndCompleteBillingPaymentAttempt(pool, {
    stripeObject: { id: 'pi_31', object: 'payment_intent', metadata: { billingPaymentAttemptId: '31' } },
    paymentIntentId: 'pi_31',
    amountCents: 5000,
    preparePaymentFunction: async (details) => details,
    recordPaymentFunction: async (_db, details) => {
      const payment = {
        id: 45,
        family_billing_account_id: Number(details.accountId),
        amount_cents: Number(details.amountCents),
        stripe_payment_intent_id: details.paymentIntentId,
        external_status: 'settled',
      }
      pool.state.payments.push(payment)
      return payment
    },
  })
  assert.equal(settlement.conflicted, true)
  assert.equal(pool.state.attempt.status, 'expired')
  assert.equal(pool.state.payments[0].external_status, 'reconciliation_required')
  assert.deepEqual(pool.state.applications, [])
})

test('verified cancellation reallocates a waiting manual payment before unlocking', async () => {
  const attempt = {
    id: 6,
    family_billing_account_id: 7,
    attempt_type: 'charge_saved_card',
    status: 'processing',
    stripe_payment_intent_id: 'pi_failed',
  }
  const calls = []
  const client = {
    release() {},
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('pg_advisory_lock') || text.includes('pg_advisory_unlock')) return { rows: [] }
      if (text.includes('SELECT * FROM billing_payment_attempt WHERE id')) return { rows: [attempt] }
      if (text.includes('UPDATE billing_payment_attempt')) {
        attempt.status = params[1]
        return { rows: [{ ...attempt }] }
      }
      throw new Error(`Unexpected release query: ${text}`)
    },
  }
  const pool = {
    query: (...args) => client.query(...args),
    connect: async () => client,
  }
  let allocation = null
  const released = await releaseBillingPaymentAttempt(pool, {
    attemptId: 6,
    stripeObject: { id: 'pi_failed', object: 'payment_intent', status: 'canceled' },
    status: 'canceled',
    reason: 'verified cancellation',
    allocationFunction: async (db, options) => {
      allocation = { db, options, statusAtAllocation: attempt.status }
      return { applications: [{ paymentId: 88, chargeId: 10 }] }
    },
  })
  assert.equal(released.status, 'canceled')
  assert.equal(allocation.db, client)
  assert.equal(allocation.statusAtAllocation, 'canceled')
  assert.equal(allocation.options.accountId, 7)
  const updateIndex = calls.findIndex(({ text }) => text.includes('UPDATE billing_payment_attempt'))
  const unlockIndex = calls.findIndex(({ text }) => text.includes('pg_advisory_unlock'))
  assert.ok(updateIndex >= 0 && unlockIndex > updateIndex)
})

test('a definite pre-request failure releases an unlinked saved-card reservation', async () => {
  const attempt = {
    id: 7,
    family_billing_account_id: 7,
    attempt_type: 'admin_balance_saved_card',
    status: 'reserved',
    stripe_payment_intent_id: null,
    stripe_checkout_session_id: null,
  }
  const client = {
    release() {},
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock') || text.includes('pg_advisory_unlock')) return { rows: [] }
      if (text.includes('SELECT * FROM billing_payment_attempt WHERE id')) return { rows: [attempt] }
      if (text.includes('UPDATE billing_payment_attempt')) {
        attempt.status = params[1]
        return { rows: [{ ...attempt }] }
      }
      throw new Error(`Unexpected pre-request release query: ${text}`)
    },
  }
  const released = await releaseBillingPaymentAttempt({
    query: (...args) => client.query(...args),
    connect: async () => client,
  }, {
    attemptId: 7,
    status: 'failed',
    reason: 'default payment method was unavailable before create',
    remoteCreationDefinitelyNotStarted: true,
    allocationFunction: async () => ({ applications: [] }),
  })
  assert.equal(released.status, 'failed')
})

test('retryable saved-card failure blocks replacement and a late reconfirmation can still settle', async () => {
  const oldAttempt = {
    id: 6,
    family_billing_account_id: 7,
    attempt_type: 'charge_saved_card',
    status: 'reconciliation_required',
    stripe_payment_intent_id: 'pi_retryable',
  }
  let releaseUpdates = 0
  const releasePool = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('SELECT * FROM billing_payment_attempt WHERE id')) return { rows: [oldAttempt] }
      if (text.includes('UPDATE billing_payment_attempt')) { releaseUpdates += 1; return { rows: [] } }
      throw new Error(`Unexpected retryable release query: ${text}`)
    },
  }
  const retained = await releaseBillingPaymentAttempt(releasePool, {
    attemptId: oldAttempt.id,
    stripeObject: { id: 'pi_retryable', object: 'payment_intent', status: 'requires_payment_method' },
    status: 'failed',
    reason: 'card declined',
  })
  assert.equal(retained.status, 'reconciliation_required')
  assert.equal(releaseUpdates, 0)

  const replacementPool = reservationPool({ collectibleBalanceCents: 0 })
  await assert.rejects(
    reserveBillingPaymentAttempt(replacementPool, {
      accountId: 7,
      attemptType: 'charge_saved_card',
      requestKey: 'replacement-attempt',
      amountCents: 5000,
      targetChargeId: 11,
      expiresAt: new Date(Date.now() + 60_000),
    }),
    /already paid, reserved, or included/i,
  )

  const lateSuccessPool = completionPool()
  lateSuccessPool.state.attempt.attempt_type = 'charge_saved_card'
  lateSuccessPool.state.attempt.status = 'reconciliation_required'
  lateSuccessPool.state.attempt.stripe_checkout_session_id = null
  lateSuccessPool.state.attempt.stripe_payment_intent_id = 'pi_retryable'
  const completed = await completeBillingPaymentAttempt(lateSuccessPool, {
    stripeObject: {
      id: 'pi_retryable',
      object: 'payment_intent',
      status: 'succeeded',
      metadata: { billingPaymentAttemptId: '9' },
    },
    payment: {
      id: 22,
      family_billing_account_id: 7,
      amount_cents: 9000,
      stripe_payment_intent_id: 'pi_retryable',
    },
  })
  assert.equal(completed.status, 'succeeded')
})

function activeAttemptReconciliationPool(attempts) {
  return {
    async query(sql) {
      assert.match(String(sql), /FROM billing_payment_attempt attempt/)
      return { rows: attempts }
    },
  }
}

test('active-attempt reconciliation recovers an unattached retryable PaymentIntent and retains ownership', async () => {
  const attempt = {
    id: 91,
    family_billing_account_id: 7,
    attempt_type: 'admin_balance_saved_card',
    status: 'processing',
    stripe_customer_id: 'cus_7',
    stripe_payment_intent_id: null,
    stripe_checkout_session_id: null,
  }
  const attached = []
  const summary = await reconcileActiveBillingPaymentAttempts(
    activeAttemptReconciliationPool([attempt]),
    {
      paymentIntents: {
        search: async () => ({ data: [{
          id: 'pi_91',
          object: 'payment_intent',
          status: 'requires_payment_method',
          customer: 'cus_7',
          metadata: { billingPaymentAttemptId: '91' },
        }] }),
      },
    },
    {
      attachFunction: async (_pool, details) => { attached.push(details) },
      releaseFunction: async () => assert.fail('retryable PaymentIntent must not release'),
      settleFunction: async () => assert.fail('retryable PaymentIntent must not settle'),
    },
  )
  assert.deepEqual({ recovered: summary.recovered, retained: summary.retained, released: summary.released }, {
    recovered: 1,
    retained: 1,
    released: 0,
  })
  assert.equal(attached[0].paymentIntentId, 'pi_91')
  assert.equal(attached[0].status, 'reconciliation_required')
})

test('active-attempt reconciliation releases only a remotely verified terminal PaymentIntent', async () => {
  const attempt = {
    id: 92,
    family_billing_account_id: 7,
    attempt_type: 'charge_saved_card',
    status: 'reconciliation_required',
    stripe_customer_id: 'cus_7',
    stripe_payment_intent_id: 'pi_92',
    stripe_checkout_session_id: null,
  }
  let released = null
  const summary = await reconcileActiveBillingPaymentAttempts(
    activeAttemptReconciliationPool([attempt]),
    { paymentIntents: { retrieve: async () => ({ id: 'pi_92', status: 'canceled' }) } },
    {
      attachFunction: async () => assert.fail('canceled PaymentIntent need not be reattached'),
      settleFunction: async () => assert.fail('canceled PaymentIntent must not settle'),
      releaseFunction: async (_pool, details) => { released = details },
    },
  )
  assert.equal(summary.released, 1)
  assert.equal(released.status, 'canceled')
  assert.equal(released.stripeObject.status, 'canceled')
})

test('active-attempt reconciliation settles a remotely recovered success after an attachment crash', async () => {
  const attempt = {
    id: 93,
    family_billing_account_id: 7,
    attempt_type: 'admin_balance_saved_card',
    status: 'processing',
    stripe_customer_id: 'cus_7',
    stripe_payment_intent_id: null,
    stripe_checkout_session_id: null,
  }
  let settlement = null
  let attached = null
  const summary = await reconcileActiveBillingPaymentAttempts(
    activeAttemptReconciliationPool([attempt]),
    {
      paymentIntents: {
        search: async () => ({ data: [{
          id: 'pi_93', object: 'payment_intent', status: 'succeeded',
          amount: 5000, amount_received: 5000, customer: 'cus_7',
          metadata: { billingPaymentAttemptId: '93' },
        }] }),
      },
    },
    {
      attachFunction: async (_pool, details) => { attached = details },
      releaseFunction: async () => assert.fail('successful recovery must not release'),
      settleFunction: async (_pool, details) => {
        settlement = details
        return { conflicted: false, payment: { id: 55 } }
      },
    },
  )
  assert.equal(summary.recovered, 1)
  assert.equal(summary.settled, 1)
  assert.equal(attached.paymentIntentId, 'pi_93')
  assert.equal(attached.status, 'processing')
  assert.equal(settlement.paymentIntentId, 'pi_93')
})

test('unattached Checkout recovery paginates until it finds terminal remote proof', async () => {
  const attempt = {
    id: 94,
    family_billing_account_id: 7,
    attempt_type: 'member_balance_checkout',
    status: 'reconciliation_required',
    stripe_customer_id: 'cus_7',
    stripe_payment_intent_id: null,
    stripe_checkout_session_id: null,
  }
  const listCalls = []
  let released = null
  let attached = null
  const summary = await reconcileActiveBillingPaymentAttempts(
    activeAttemptReconciliationPool([attempt]),
    {
      checkout: {
        sessions: {
          list: async (params) => {
            listCalls.push(params)
            if (!params.starting_after) {
              return { data: [{ id: 'cs_unrelated', metadata: {} }], has_more: true }
            }
            return {
              data: [{
                id: 'cs_94', object: 'checkout.session', status: 'expired', payment_status: 'unpaid',
                customer: 'cus_7', metadata: { billingPaymentAttemptId: '94' },
              }],
              has_more: false,
            }
          },
        },
      },
    },
    {
      attachFunction: async (_pool, details) => { attached = details },
      settleFunction: async () => assert.fail('unpaid Checkout must not settle'),
      releaseFunction: async (_pool, details) => { released = details },
    },
  )
  assert.equal(listCalls.length, 2)
  assert.equal(listCalls[1].starting_after, 'cs_unrelated')
  assert.equal(summary.recovered, 1)
  assert.equal(summary.released, 1)
  assert.equal(attached.checkoutSessionId, 'cs_94')
  assert.equal(released.checkoutTerminal, true)
})

test('paid Checkout settlement takes precedence over an expired session status', async () => {
  const attempt = {
    id: 95,
    family_billing_account_id: 7,
    attempt_type: 'member_balance_checkout',
    status: 'pending',
    stripe_customer_id: 'cus_7',
    stripe_checkout_session_id: 'cs_95',
    stripe_payment_intent_id: 'pi_95',
  }
  let settlement = null
  const summary = await reconcileActiveBillingPaymentAttempts(
    activeAttemptReconciliationPool([attempt]),
    {
      checkout: {
        sessions: {
          retrieve: async () => ({
            id: 'cs_95', object: 'checkout.session', status: 'expired', payment_status: 'paid',
            customer: 'cus_7', metadata: { billingPaymentAttemptId: '95' },
            payment_intent: {
              id: 'pi_95', object: 'payment_intent', status: 'succeeded',
              amount: 5000, amount_received: 5000, customer: 'cus_7',
            },
          }),
        },
      },
    },
    {
      attachFunction: async () => assert.fail('paid Checkout settles directly'),
      releaseFunction: async () => assert.fail('paid Checkout must never release as expired'),
      settleFunction: async (_pool, details) => {
        settlement = details
        return { conflicted: false, payment: { id: 56 } }
      },
    },
  )
  assert.equal(summary.settled, 1)
  assert.equal(summary.released, 0)
  assert.equal(settlement.stripeObject.id, 'cs_95')
  assert.equal(settlement.paymentIntentId, 'pi_95')
})

test('foreign Stripe object IDs cannot settle an attempt selected by metadata', async () => {
  const attempt = {
    id: 96,
    family_billing_account_id: 7,
    attempt_type: 'charge_saved_card',
    status: 'processing',
    amount_cents: 5000,
    stripe_payment_intent_id: 'pi_expected',
  }
  let paymentRecorded = false
  const pool = {
    async query(sql) {
      if (String(sql).includes('SELECT * FROM billing_payment_attempt attempt')) return { rows: [attempt] }
      throw new Error(`Unexpected foreign settlement query: ${sql}`)
    },
  }

  await assert.rejects(
    recordAndCompleteBillingPaymentAttempt(pool, {
      stripeObject: {
        id: 'pi_foreign',
        object: 'payment_intent',
        status: 'succeeded',
        metadata: { billingPaymentAttemptId: '96' },
      },
      paymentIntentId: 'pi_foreign',
      amountCents: 5000,
      preparePaymentFunction: async (details) => details,
      recordPaymentFunction: async () => { paymentRecorded = true },
    }),
    /does not match this payment attempt/i,
  )
  assert.equal(paymentRecorded, false)
})

test('foreign canceled PaymentIntent cannot release an explicitly selected attempt', async () => {
  const attempt = {
    id: 97,
    family_billing_account_id: 7,
    attempt_type: 'charge_saved_card',
    status: 'processing',
    stripe_payment_intent_id: 'pi_expected',
  }
  let updated = false
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('SELECT * FROM billing_payment_attempt WHERE id = $1')) return { rows: [attempt] }
      if (text.includes('UPDATE billing_payment_attempt')) updated = true
      return { rows: [] }
    },
  }

  await assert.rejects(
    releaseBillingPaymentAttempt(pool, {
      attemptId: 97,
      stripeObject: {
        id: 'pi_foreign',
        object: 'payment_intent',
        status: 'canceled',
        metadata: { billingPaymentAttemptId: '97' },
      },
      status: 'canceled',
    }),
    /does not match this payment attempt/i,
  )
  assert.equal(updated, false)
})

test('round-robin reconciliation reaches a successful 101st active attempt', async () => {
  let tick = 0
  const attempts = Array.from({ length: 101 }, (_, index) => ({
    id: index + 1,
    family_billing_account_id: 7,
    attempt_type: 'charge_saved_card',
    status: 'processing',
    stripe_customer_id: index === 100 ? 'cus_7' : null,
    stripe_payment_intent_id: index === 100 ? 'pi_101' : null,
    stripe_checkout_session_id: null,
    last_reconciled_at: null,
  }))
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('SELECT attempt.*, account.stripe_customer_id')) {
        const ordered = attempts.slice().sort((left, right) => {
          const leftAt = left.last_reconciled_at?.getTime() ?? -1
          const rightAt = right.last_reconciled_at?.getTime() ?? -1
          return leftAt - rightAt || left.id - right.id
        })
        return { rows: ordered.slice(0, Number(params[0])) }
      }
      if (text.includes('SET last_reconciled_at = now()')) {
        attempts.find((attempt) => attempt.id === Number(params[0])).last_reconciled_at = new Date(++tick)
        return { rows: [] }
      }
      throw new Error(`Unexpected round-robin query: ${text}`)
    },
  }
  let settledAttemptId = null
  const options = {
    attachFunction: async () => assert.fail('stored PaymentIntent must not be reattached'),
    releaseFunction: async () => assert.fail('successful PaymentIntent must not release'),
    settleFunction: async (_pool, details) => {
      settledAttemptId = Number(details.stripeObject.metadata.billingPaymentAttemptId)
      return { conflicted: false, payment: { id: 801 } }
    },
  }
  const stripe = {
    paymentIntents: {
      retrieve: async () => ({
        id: 'pi_101',
        object: 'payment_intent',
        status: 'succeeded',
        amount: 5000,
        amount_received: 5000,
        customer: 'cus_7',
        metadata: { billingPaymentAttemptId: '101' },
      }),
    },
  }

  const first = await reconcileActiveBillingPaymentAttempts(pool, stripe, options)
  const second = await reconcileActiveBillingPaymentAttempts(pool, stripe, options)
  assert.equal(first.settled, 0)
  assert.equal(second.settled, 1)
  assert.equal(settledAttemptId, 101)
})

test('an exact-charge retry is blocked when a released attempt payment reduced account balance to zero', async () => {
  const pool = reservationPool({ collectibleBalanceCents: 0 })
  await assert.rejects(
    reserveBillingPaymentAttempt(pool, {
      accountId: 7,
      attemptType: 'charge_checkout',
      requestKey: 'retry-after-cash-payment',
      amountCents: 5000,
      targetChargeId: 11,
      expiresAt: new Date(Date.now() + 60_000),
    }),
    /already paid, reserved, or included/i,
  )
  assert.equal(pool.state.attempts.length, 0)
})

test('invoice selection and general allocation exclude every active remote attempt status', () => {
  const invoiceSource = fs.readFileSync(path.join(testDirectory, '../householdMonthlyInvoice.js'), 'utf8')
  const allocationSource = fs.readFileSync(path.join(testDirectory, '../paymentAllocation.js'), 'utf8')
  for (const source of [invoiceSource, allocationSource]) {
    assert.match(source, /attempt\.status IN \('pending', 'processing', 'reconciliation_required'\)/)
    assert.match(source, /attempt\.status = 'reserved' AND attempt\.expires_at > now\(\)/)
    assert.match(source, /billing_payment_attempt_charge/)
  }
})

test('reservation availability and completion status ignore unsettled payment applications', () => {
  const source = fs.readFileSync(path.join(testDirectory, '../paymentAttemptReservations.js'), 'utf8')
  const candidateSource = source.slice(
    source.indexOf('async function loadReservationCandidates'),
    source.indexOf('export async function reserveBillingPaymentAttempt'),
  )
  const completionSource = source.slice(
    source.indexOf('async function completeBillingPaymentAttemptLocked'),
    source.indexOf('export async function completeBillingPaymentAttempt'),
  )

  for (const scopedSource of [candidateSource, completionSource]) {
    assert.match(scopedSource, /JOIN billing_payment payment ON payment\.id = application\.billing_payment_id/)
    assert.match(scopedSource, /payment\.external_status IN \('settled', 'succeeded'\)/)
  }
})

test('saved-card failure cannot overwrite a paid charge after terminal-release allocation', () => {
  const paymentSource = fs.readFileSync(path.join(testDirectory, '../customerBillingPayments.js'), 'utf8')
  const failureUpdate = paymentSource.match(
    /UPDATE billing_charge charge\s+SET collection_status = CASE[\s\S]*?WHERE charge\.id = \$1/,
  )?.[0] ?? ''

  assert.match(failureUpdate, /charge\.collection_status = 'paid'/)
  assert.match(failureUpdate, /FROM billing_payment_application application/)
  assert.match(failureUpdate, /application\.application_kind = 'reversal'/)
  assert.match(failureUpdate, /payment\.external_status IN \('settled', 'succeeded'\)/)
  assert.match(failureUpdate, /THEN 'paid'\s+ELSE \$2/)
})

test('PaymentIntent failure webhook retains retryable reservations', () => {
  const routeSource = fs.readFileSync(path.join(testDirectory, '../../platform/registerRoutes.js'), 'utf8')
  assert.match(
    routeSource,
    /if \(event\.type === 'payment_intent\.canceled'\) \{[\s\S]*?releaseBillingPaymentAttempt\(pool/,
  )
  assert.doesNotMatch(
    routeSource,
    /if \(event\.type !== 'invoice\.payment_failed'\) \{[\s\S]*?releaseBillingPaymentAttempt\(pool/,
  )
})
