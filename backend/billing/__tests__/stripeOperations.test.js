import test from 'node:test'
import assert from 'node:assert/strict'
import {
  beginStripeWebhookEvent,
  completeStripeWebhookEvent,
  createBillingRefund,
  failStripeWebhookEvent,
  normalizeStripeRefundStatus,
  resolveStripeBillingAlert,
} from '../stripeOperations.js'

test('Stripe refund states remain pending until Stripe reports success', () => {
  assert.equal(normalizeStripeRefundStatus('pending'), 'pending')
  assert.equal(normalizeStripeRefundStatus('requires_action'), 'pending')
  assert.equal(normalizeStripeRefundStatus('succeeded'), 'succeeded')
  assert.equal(normalizeStripeRefundStatus('failed'), 'failed')
})

test('webhook claim treats an already processed event as a replay', async () => {
  const pool = {
    query: async (sql) => {
      const text = String(sql)
      if (text.includes('INSERT INTO stripe_webhook_event')) return { rows: [] }
      if (text.includes('SELECT status, attempts')) return { rows: [{ status: 'processed', attempts: 2 }] }
      return { rows: [] }
    },
  }
  const result = await beginStripeWebhookEvent(pool, { id: 'evt_1', type: 'invoice.paid' })
  assert.deepEqual(result, { replayed: true, claimed: false, attempts: 2 })
})

test('expired webhook processing lease is atomically reclaimed with a new claim token', async () => {
  const calls = []
  const pool = {
    query: async (sql, params = []) => {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('INSERT INTO stripe_webhook_event')) return { rows: [] }
      if (text.includes('UPDATE stripe_webhook_event') && text.includes("status = 'failed'")) {
        return {
          rows: [{
            status: 'processing',
            attempts: 3,
            claim_token: params[1],
            lease_expires_at: '2026-08-31T18:15:00.000Z',
          }],
        }
      }
      throw new Error(`Unexpected webhook lease query: ${text}`)
    },
  }

  const result = await beginStripeWebhookEvent(pool, { id: 'evt_stale', type: 'invoice.paid' })
  assert.equal(result.claimed, true)
  assert.equal(result.reclaimed, true)
  assert.equal(result.replayed, false)
  assert.equal(result.attempts, 3)
  assert.match(result.claimToken, /^[0-9a-f-]{36}$/)
  const reclaim = calls.find(({ text }) => text.includes('COALESCE(lease_expires_at'))
  assert.ok(reclaim)
  assert.equal(reclaim.params[0], 'evt_stale')
  assert.equal(reclaim.params[1], result.claimToken)
})

test('active webhook processing lease is retryable and is not acknowledged as a replay', async () => {
  const pool = {
    query: async (sql) => {
      const text = String(sql)
      if (text.includes('INSERT INTO stripe_webhook_event')) return { rows: [] }
      if (text.includes('UPDATE stripe_webhook_event')) return { rows: [] }
      if (text.includes('SELECT status, attempts')) {
        return { rows: [{ status: 'processing', attempts: 2, lease_expires_at: '2026-08-31T18:15:00.000Z' }] }
      }
      throw new Error(`Unexpected active webhook query: ${text}`)
    },
  }

  const result = await beginStripeWebhookEvent(pool, { id: 'evt_active', type: 'invoice.paid' })
  assert.deepEqual(result, {
    replayed: false,
    claimed: false,
    inProgress: true,
    attempts: 2,
    leaseExpiresAt: '2026-08-31T18:15:00.000Z',
  })
})

test('only the current webhook lease owner can complete or fail processing', async () => {
  const calls = []
  const pool = {
    query: async (sql, params = []) => {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes("SET status = 'processed'")) return { rows: [] }
      if (text.includes('SELECT status FROM stripe_webhook_event')) return { rows: [{ status: 'processing' }] }
      if (text.includes("SET status = 'failed'")) return { rows: [] }
      throw new Error(`Unexpected webhook ownership query: ${text}`)
    },
  }

  await assert.rejects(
    completeStripeWebhookEvent(pool, { id: 'evt_reclaimed' }, { claimToken: 'stale-token' }),
    /no longer owned/i,
  )
  const failed = await failStripeWebhookEvent(
    pool,
    { id: 'evt_reclaimed' },
    new Error('stale worker failed'),
    { claimToken: 'stale-token' },
  )
  assert.deepEqual(failed, { failed: false })
  assert.deepEqual(calls.at(-1).params.slice(0, 2), ['evt_reclaimed', 'stale-token'])
  assert.match(calls[0].text, /claim_token = NULL, lease_expires_at = NULL/)
  assert.match(calls.at(-1).text, /claim_token = NULL/)
})

test('webhook terminal transitions clear lease credentials for the current owner', async () => {
  const calls = []
  const pool = {
    query: async (sql, params = []) => {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes("SET status = 'processed'")) return { rows: [{ event_id: params[0] }] }
      if (text.includes("SET status = 'failed'")) return { rows: [{ event_id: params[0] }] }
      throw new Error(`Unexpected terminal webhook query: ${text}`)
    },
  }

  assert.deepEqual(
    await completeStripeWebhookEvent(pool, { id: 'evt_complete' }, { claimToken: 'complete-token' }),
    { completed: true },
  )
  assert.deepEqual(
    await failStripeWebhookEvent(
      pool,
      { id: 'evt_fail' },
      new Error('handler failed'),
      { claimToken: 'fail-token' },
    ),
    { failed: true },
  )
  for (const call of calls) {
    assert.match(call.text, /claim_token = NULL/)
    assert.match(call.text, /lease_expires_at = NULL/)
    assert.match(call.text, /claim_token = \$2/)
  }
})

test('manual refund rejects an amount above the remaining payment balance', async () => {
  const pool = {
    query: async (sql) => {
      const text = String(sql)
      if (text.includes('FROM billing_payment')) return { rows: [{ id: 8, amount_cents: 10000 }] }
      if (text.includes('FROM billing_refund')) return { rows: [{ id: 3, amount_cents: 4000 }] }
      return { rows: [] }
    },
  }
  await assert.rejects(
    createBillingRefund(pool, {
      accountId: 3, paymentId: 8, amountCents: 7000,
      exceptionCategory: 'duplicate_charge', evidenceNote: 'Payment processor shows the same charge twice.', createdByUserId: 2,
    }),
    /exceeds the remaining refundable/i,
  )
})

test('refund transport ambiguity replays the exact same Stripe operation and local row', async () => {
  let storedRefund = null
  let nextId = 77
  const order = []
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock')) {
        order.push('account-lock')
        return { rows: [{ pg_advisory_lock: null }] }
      }
      if (text.includes('pg_advisory_unlock')) {
        order.push('account-unlock')
        return { rows: [{ pg_advisory_unlock: true }] }
      }
      if (text === 'BEGIN' || text === 'ROLLBACK') {
        order.push(text.toLowerCase())
        return { rows: [] }
      }
      if (text === 'COMMIT') {
        order.push('commit')
        return { rows: [] }
      }
      if (text.includes('WHERE request_key = $1 FOR UPDATE')) {
        return { rows: storedRefund ? [{ ...storedRefund }] : [] }
      }
      if (text.includes('FROM billing_payment')) {
        return { rows: [{ id: 8, family_billing_account_id: 3, amount_cents: 10000, stripe_payment_intent_id: 'pi_8' }] }
      }
      if (text.includes('FROM billing_refund') && text.includes("external_status IN ('pending', 'succeeded')")) {
        return { rows: storedRefund ? [{ id: storedRefund.id, amount_cents: storedRefund.amount_cents }] : [] }
      }
      if (text.includes('INSERT INTO billing_refund')) {
        storedRefund = {
          id: nextId++,
          family_billing_account_id: params[0],
          payment_id: params[1],
          amount_cents: params[2],
          reason: params[3],
          external_status: params[5],
          created_by_user_id: params[6],
          exception_category: params[7],
          evidence_note: params[8],
          ledger_treatment: params[9],
          related_charge_id: params[10],
          request_key: params[11],
          stripe_refund_id: null,
        }
        return { rows: [{ ...storedRefund }] }
      }
      if (text.includes('SET stripe_refund_id = $2')) {
        storedRefund = {
          ...storedRefund,
          stripe_refund_id: params[1],
          external_reference: params[1],
          external_status: params[2],
          error_message: null,
        }
        return { rows: [{ ...storedRefund }] }
      }
      if (text.includes("SET external_status = 'pending'")) {
        storedRefund = { ...storedRefund, external_status: 'pending', error_message: params[1] }
        return { rows: [{ ...storedRefund }] }
      }
      throw new Error(`Unexpected ambiguous-refund query: ${text}`)
    },
  }
  const stripeCalls = []
  const stripe = {
    refunds: {
      async create(payload, options) {
        order.push('stripe-call')
        stripeCalls.push({ payload, options })
        if (stripeCalls.length === 1) throw new Error('simulated connection reset after Stripe accepted the request')
        return { id: 're_same_77', status: 'succeeded' }
      },
    },
  }
  const input = {
    accountId: 3,
    paymentId: 8,
    amountCents: 2000,
    reason: 'Duplicate charge',
    createdByUserId: 2,
    exceptionCategory: 'duplicate_charge',
    evidenceNote: 'Processor evidence attached.',
    ledgerTreatment: 'return_overpayment',
    requestKey: 'refund-exact-retry',
    stripeClient: stripe,
  }

  await assert.rejects(createBillingRefund(pool, input), /connection reset/)
  const replay = await createBillingRefund(pool, input)

  assert.equal(storedRefund.id, 77)
  assert.equal(replay.id, 77)
  assert.equal(replay.external_status, 'succeeded')
  assert.equal(replay.idempotency_replayed, true)
  assert.equal(stripeCalls.length, 2)
  assert.deepEqual(stripeCalls[1], stripeCalls[0])
  assert.equal(stripeCalls[0].options.idempotencyKey, 'vortex-refund-77')
  for (let index = 0; index < order.length; index += 1) {
    if (order[index] === 'stripe-call') assert.equal(order[index - 1], 'commit')
  }
})

test('different refund request keys serialize before the remaining-refundable check', async () => {
  const refunds = []
  let lockTail = Promise.resolve()
  const releases = []
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock')) {
        const previous = lockTail
        let release
        lockTail = new Promise((resolve) => { release = resolve })
        await previous
        releases.push(release)
        return { rows: [{ pg_advisory_lock: null }] }
      }
      if (text.includes('pg_advisory_unlock')) {
        releases.shift()?.()
        return { rows: [{ pg_advisory_unlock: true }] }
      }
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(text)) return { rows: [] }
      if (text.includes('WHERE request_key = $1 FOR UPDATE')) {
        return { rows: refunds.filter((row) => row.request_key === params[0]) }
      }
      if (text.includes('FROM billing_payment')) {
        return { rows: [{ id: 8, family_billing_account_id: 3, amount_cents: 10000, stripe_payment_intent_id: null }] }
      }
      if (text.includes('FROM billing_refund') && text.includes("external_status IN ('pending', 'succeeded')")) {
        return { rows: refunds.map(({ id, amount_cents }) => ({ id, amount_cents })) }
      }
      if (text.includes('INSERT INTO billing_refund')) {
        const row = {
          id: refunds.length + 1,
          family_billing_account_id: params[0],
          payment_id: params[1],
          amount_cents: params[2],
          reason: params[3],
          external_status: params[5],
          created_by_user_id: params[6],
          exception_category: params[7],
          evidence_note: params[8],
          ledger_treatment: params[9],
          related_charge_id: params[10],
          request_key: params[11],
        }
        refunds.push(row)
        return { rows: [row] }
      }
      throw new Error(`Unexpected concurrent-refund query: ${text}`)
    },
  }
  const input = (requestKey) => ({
    accountId: 3,
    paymentId: 8,
    amountCents: 7000,
    reason: 'Approved refund',
    createdByUserId: 2,
    exceptionCategory: 'owner_discretion',
    evidenceNote: 'Owner approval attached.',
    ledgerTreatment: 'return_overpayment',
    requestKey,
  })

  const results = await Promise.allSettled([
    createBillingRefund(pool, input('refund-concurrent-a')),
    createBillingRefund(pool, input('refund-concurrent-b')),
  ])

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1)
  assert.match(results.find((result) => result.status === 'rejected').reason.message, /remaining refundable/i)
  assert.equal(refunds.length, 1)
})

test('manual refund requires an approved exception, evidence, and Owner/Admin identity', async () => {
  const pool = { query: async () => ({ rows: [] }) }
  await assert.rejects(
    createBillingRefund(pool, { accountId: 3, amountCents: 1000, createdByUserId: 2 }),
    /exception category is required/i,
  )
  await assert.rejects(
    createBillingRefund(pool, { accountId: 3, amountCents: 1000, exceptionCategory: 'medical', createdByUserId: 2 }),
    /supporting evidence/i,
  )
  await assert.rejects(
    createBillingRefund(pool, { accountId: 3, amountCents: 1000, exceptionCategory: 'medical', evidenceNote: 'Doctor note on file.' }),
    /Owner\/Admin/i,
  )
})

test('billing alert resolution requires a note and authenticated actor', async () => {
  const pool = { query: async () => ({ rows: [] }) }
  await assert.rejects(
    resolveStripeBillingAlert(pool, { alertId: 3, resolutionNote: '', resolvedByUserId: 9 }),
    /resolution note is required/i,
  )
  await assert.rejects(
    resolveStripeBillingAlert(pool, { alertId: 3, resolutionNote: 'Reconciled to Stripe.', resolvedByUserId: null }),
    /resolver identity is required/i,
  )
})

test('billing alert resolution stores the actor and note', async () => {
  const calls = []
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql: String(sql), params })
      if (String(sql).includes('UPDATE stripe_billing_alert')) {
        return { rows: [{ id: 3, resolved_by_user_id: params[1], resolution_note: params[2] }] }
      }
      return { rows: [] }
    },
  }
  const resolved = await resolveStripeBillingAlert(pool, {
    alertId: 3,
    resolutionNote: '  Reconciled to Stripe and verified the ledger.  ',
    resolvedByUserId: 9,
    facilityId: 4,
  })
  assert.equal(resolved.resolved_by_user_id, 9)
  assert.equal(resolved.resolution_note, 'Reconciled to Stripe and verified the ledger.')
  assert.equal(calls[0].params[3], 4)
  assert.match(calls[0].sql, /scoped_family\.facility_id = \$4/)
})

test('billing alert resolution cannot mutate another facility alert', async () => {
  const calls = []
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql: String(sql), params })
      return { rows: [] }
    },
  }

  await assert.rejects(
    resolveStripeBillingAlert(pool, {
      alertId: 3,
      resolutionNote: 'Forged cross-facility resolution.',
      resolvedByUserId: 9,
      facilityId: 4,
    }),
    /billing alert not found/i,
  )
  assert.equal(calls.length, 2)
  assert.equal(calls[0].params[3], 4)
  assert.equal(calls[1].params[1], 4)
  assert.match(calls[0].sql, /scoped_family\.facility_id = \$4/)
  assert.match(calls[1].sql, /scoped_family\.facility_id = \$2/)
})
