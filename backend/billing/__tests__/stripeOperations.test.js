import test from 'node:test'
import assert from 'node:assert/strict'
import {
  beginStripeWebhookEvent,
  completeStripeWebhookEvent,
  createBillingRefund,
  failStripeWebhookEvent,
  normalizeStripeRefundStatus,
  resolveStripeBillingAlert,
  stripeRefundReadyForLedgerFinalization,
  syncStripeRefund,
} from '../stripeOperations.js'

function createStripeRefundSyncHarness({ payment, refunds = [] }) {
  const calls = []
  const alerts = []
  const storedRefunds = refunds.map((row) => ({ ...row }))
  let nextRefundId = Math.max(100, ...storedRefunds.map((row) => Number(row.id) || 0)) + 1

  const query = async (sql, params = []) => {
    const text = String(sql)
    const compact = text.replace(/\s+/g, ' ').trim()
    calls.push({ text, compact, params })
    if (compact.includes('pg_advisory_lock')) return { rows: [{ pg_advisory_lock: null }] }
    if (compact.includes('pg_advisory_unlock')) return { rows: [{ pg_advisory_unlock: true }] }
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(compact)) return { rows: [] }
    if (compact.includes('FROM billing_payment') && compact.includes('stripe_payment_intent_id = $1')) {
      return { rows: payment?.stripe_payment_intent_id === params[0] ? [{ ...payment }] : [] }
    }
    if (compact.includes('FROM billing_payment') && compact.includes('FOR UPDATE')) {
      const exact = payment
        && Number(payment.id) === Number(params[0])
        && Number(payment.family_billing_account_id) === Number(params[1])
        && (params.length < 3 || payment.stripe_payment_intent_id === params[2])
      return { rows: exact ? [{ ...payment }] : [] }
    }
    if (compact.includes('FROM billing_refund WHERE id = $1 FOR UPDATE')) {
      return { rows: storedRefunds.filter((row) => Number(row.id) === Number(params[0])).map((row) => ({ ...row })) }
    }
    if (compact.includes('FROM billing_refund WHERE stripe_refund_id = $1 FOR UPDATE')) {
      return { rows: storedRefunds.filter((row) => row.stripe_refund_id === params[0]).map((row) => ({ ...row })) }
    }
    if (compact.includes('FROM billing_refund WHERE request_key = $1 FOR UPDATE')) {
      return { rows: storedRefunds.filter((row) => row.request_key === params[0]).map((row) => ({ ...row })) }
    }
    if (compact.includes('FROM billing_refund') && compact.includes('WHERE payment_id = $1')) {
      return {
        rows: storedRefunds
          .filter((row) => (
            Number(row.payment_id) === Number(params[0])
            && (params[1] == null || Number(row.id) !== Number(params[1]))
            && ['pending', 'succeeded', 'reconciliation_required'].includes(row.external_status ?? 'succeeded')
          ))
          .map(({ id, amount_cents }) => ({ id, amount_cents })),
      }
    }
    if (compact.startsWith('UPDATE billing_refund') && compact.includes('stripe_refund_id = CASE')) {
      const row = storedRefunds.find((candidate) => (
        Number(candidate.id) === Number(params[0])
        && Number(candidate.family_billing_account_id) === Number(params[5])
        && Number(candidate.payment_id) === Number(params[6])
      ))
      if (!row) return { rows: [] }
      if (params[1]) row.stripe_refund_id = params[2]
      row.external_reference = params[2]
      row.external_status = params[3]
      row.error_message = params[4]
      return { rows: [{ ...row }] }
    }
    if (compact.startsWith('UPDATE billing_refund') && compact.includes("SET external_status = 'pending'")) {
      const row = storedRefunds.find((candidate) => Number(candidate.id) === Number(params[0]))
      if (!row || row.external_status === 'reconciliation_required') return { rows: [] }
      row.external_status = 'pending'
      row.error_message = params[1]
      return { rows: [{ ...row }] }
    }
    if (compact.startsWith('UPDATE billing_refund') && compact.includes("SET external_status = 'reconciliation_required'")) {
      const row = storedRefunds.find((candidate) => Number(candidate.id) === Number(params[0]))
      if (!row) return { rows: [] }
      row.external_status = 'reconciliation_required'
      row.error_message = params[1]
      return { rows: [{ ...row }] }
    }
    if (compact.startsWith('INSERT INTO billing_refund')) {
      const isApprovedRequest = compact.includes('created_by_user_id')
      const row = isApprovedRequest
        ? {
          id: nextRefundId++,
          family_billing_account_id: params[0],
          payment_id: params[1],
          amount_cents: params[2],
          reason: params[3],
          external_reference: params[4],
          external_status: params[5],
          created_by_user_id: params[6],
          exception_category: params[7],
          evidence_note: params[8],
          ledger_treatment: params[9],
          related_charge_id: params[10],
          request_key: params[11] ?? null,
          stripe_refund_id: null,
        }
        : {
          id: nextRefundId++,
          family_billing_account_id: params[0],
          payment_id: params[1],
          amount_cents: params[2],
          reason: params[3],
          external_reference: params[4],
          stripe_refund_id: params[5],
          external_status: params[6],
          error_message: params[7],
          request_key: params[8],
          ledger_treatment: null,
        }
      storedRefunds.push(row)
      return { rows: [{ ...row }] }
    }
    if (compact.startsWith('INSERT INTO stripe_billing_alert')) {
      const alert = {
        id: alerts.length + 1,
        stripe_event_id: params[0],
        family_billing_account_id: params[1],
        alert_type: params[2],
        severity: params[3],
      }
      alerts.push(alert)
      return { rows: [alert] }
    }
    throw new Error(`Unexpected Stripe refund sync query: ${compact}`)
  }
  const client = { query, release() {} }
  return {
    pool: { query, connect: async () => client },
    calls,
    alerts,
    refunds: storedRefunds,
  }
}

test('Stripe refund states remain pending until Stripe reports success', () => {
  assert.equal(normalizeStripeRefundStatus('pending'), 'pending')
  assert.equal(normalizeStripeRefundStatus('requires_action'), 'pending')
  assert.equal(normalizeStripeRefundStatus('succeeded'), 'succeeded')
  assert.equal(normalizeStripeRefundStatus('failed'), 'failed')
  assert.equal(stripeRefundReadyForLedgerFinalization({
    stripe_refund_id: 're_conflict',
    external_status: 'reconciliation_required',
    ledger_treatment: 'return_overpayment',
    error_message: 'Stripe refund identity conflicts with its local owner.',
  }), false)
})

test('refund sync resolves a missing PaymentIntent through its exact Stripe Charge under the account lock', async () => {
  const payment = {
    id: 8,
    family_billing_account_id: 3,
    amount_cents: 10000,
    stripe_payment_intent_id: 'pi_exact',
    stripe_customer_id: 'cus_exact',
    external_processor: 'stripe',
  }
  const harness = createStripeRefundSyncHarness({
    payment,
    refunds: [{
      id: 77,
      family_billing_account_id: 3,
      payment_id: 8,
      amount_cents: 2000,
      external_status: 'pending',
      stripe_refund_id: null,
      ledger_treatment: 'return_overpayment',
    }],
  })
  const chargeRetrievals = []
  const stripe = {
    charges: {
      async retrieve(id) {
        chargeRetrievals.push(id)
        return { id, payment_intent: 'pi_exact' }
      },
    },
  }

  const synced = await syncStripeRefund(harness.pool, {
    id: 're_exact',
    object: 'refund',
    charge: 'ch_exact',
    amount: 2000,
    currency: 'usd',
    status: 'succeeded',
    metadata: {
      vortexRefundId: '77',
      billingPaymentId: '8',
      familyBillingAccountId: '3',
    },
  }, { stripeClient: stripe, event: { id: 'evt_refund_exact' } })

  assert.deepEqual(chargeRetrievals, ['ch_exact'])
  assert.equal(synced.id, 77)
  assert.equal(synced.external_status, 'reconciliation_required')
  assert.equal(synced.stripe_refund_id, 're_exact')
  assert.equal(stripeRefundReadyForLedgerFinalization(synced), true)
  assert.equal(harness.alerts.length, 0)
  const lockIndex = harness.calls.findIndex(({ compact }) => compact.includes('pg_advisory_lock'))
  const beginIndex = harness.calls.findIndex(({ compact }) => compact === 'BEGIN')
  const paymentLockIndex = harness.calls.findIndex(({ compact }) => compact.includes('FROM billing_payment') && compact.includes('FOR UPDATE'))
  const commitIndex = harness.calls.findIndex(({ compact }) => compact === 'COMMIT')
  const unlockIndex = harness.calls.findIndex(({ compact }) => compact.includes('pg_advisory_unlock'))
  assert.ok(lockIndex >= 0 && lockIndex < beginIndex)
  assert.ok(beginIndex < paymentLockIndex && paymentLockIndex < commitIndex)
  assert.ok(commitIndex < unlockIndex)
})

test('refund sync never overwrites an immutable local binding when a second Stripe Refund claims the same metadata owner', async () => {
  const original = {
    id: 77,
    family_billing_account_id: 3,
    payment_id: 8,
    amount_cents: 2000,
    external_status: 'pending',
    stripe_refund_id: 're_original',
    external_reference: 're_original',
    ledger_treatment: 'return_overpayment',
  }
  const harness = createStripeRefundSyncHarness({
    payment: {
      id: 8,
      family_billing_account_id: 3,
      amount_cents: 10000,
      stripe_payment_intent_id: 'pi_exact',
      stripe_customer_id: 'cus_exact',
      external_processor: 'stripe',
    },
    refunds: [original],
  })

  const quarantine = await syncStripeRefund(harness.pool, {
    id: 're_conflicting_second',
    object: 'refund',
    payment_intent: 'pi_exact',
    customer: 'cus_exact',
    amount: 2000,
    currency: 'usd',
    status: 'succeeded',
    metadata: {
      vortexRefundId: '77',
      billingPaymentId: '8',
      familyBillingAccountId: '3',
    },
  })

  const preserved = harness.refunds.find((row) => row.id === 77)
  assert.equal(preserved.stripe_refund_id, 're_original')
  assert.equal(preserved.external_reference, 're_original')
  assert.equal(preserved.external_status, 'pending')
  assert.notEqual(quarantine.id, preserved.id)
  assert.equal(quarantine.stripe_refund_id, 're_conflicting_second')
  assert.equal(quarantine.request_key, 'stripe-refund-reconciliation:re_conflicting_second')
  assert.equal(quarantine.external_status, 'reconciliation_required')
  assert.match(quarantine.error_message, /separate quarantine row/i)
  assert.equal(harness.alerts[0]?.severity, 'critical')
})

test('refund replay with an immutable Stripe Refund ID retrieves and syncs exactly and never creates again', async () => {
  const local = {
    id: 77,
    family_billing_account_id: 3,
    payment_id: 8,
    amount_cents: 2000,
    reason: 'Duplicate charge',
    created_by_user_id: 2,
    exception_category: 'duplicate_charge',
    evidence_note: 'Processor evidence attached.',
    ledger_treatment: 'return_overpayment',
    related_charge_id: null,
    request_key: 'refund-known-remote',
    external_status: 'pending',
    stripe_refund_id: 're_known_77',
  }
  const harness = createStripeRefundSyncHarness({
    payment: {
      id: 8,
      family_billing_account_id: 3,
      amount_cents: 10000,
      stripe_payment_intent_id: 'pi_8',
      stripe_customer_id: 'cus_8',
      external_processor: 'stripe',
    },
    refunds: [local],
  })
  const retrieved = []
  let createCalls = 0
  const stripe = {
    refunds: {
      async retrieve(id) {
        retrieved.push(id)
        return {
          id,
          object: 'refund',
          payment_intent: 'pi_8',
          customer: 'cus_8',
          amount: 2000,
          currency: 'usd',
          status: 'succeeded',
          metadata: {
            vortexRefundId: '77',
            billingPaymentId: '8',
            familyBillingAccountId: '3',
          },
        }
      },
      async create() { createCalls += 1 },
    },
  }

  const replay = await createBillingRefund(harness.pool, {
    accountId: 3,
    paymentId: 8,
    amountCents: 2000,
    reason: 'Duplicate charge',
    createdByUserId: 2,
    exceptionCategory: 'duplicate_charge',
    evidenceNote: 'Processor evidence attached.',
    ledgerTreatment: 'return_overpayment',
    requestKey: 'refund-known-remote',
    stripeClient: stripe,
  })

  assert.deepEqual(retrieved, ['re_known_77'])
  assert.equal(createCalls, 0)
  assert.equal(replay.id, 77)
  assert.equal(replay.stripe_refund_id, 're_known_77')
  assert.equal(replay.external_status, 'reconciliation_required')
  assert.equal(replay.idempotency_replayed, true)
  assert.equal(stripeRefundReadyForLedgerFinalization(replay), true)
})

test('refund replay fails closed on incomplete remote discovery proof before creating', async () => {
  const local = {
    id: 78,
    family_billing_account_id: 3,
    payment_id: 8,
    amount_cents: 2000,
    reason: 'Duplicate charge',
    created_by_user_id: 2,
    exception_category: 'duplicate_charge',
    evidence_note: 'Processor evidence attached.',
    ledger_treatment: 'return_overpayment',
    related_charge_id: null,
    request_key: 'refund-ambiguous-owner',
    external_status: 'pending',
    stripe_refund_id: null,
  }
  const harness = createStripeRefundSyncHarness({
    payment: {
      id: 8,
      family_billing_account_id: 3,
      amount_cents: 10000,
      stripe_payment_intent_id: 'pi_8',
      external_processor: 'stripe',
    },
    refunds: [local],
  })
  let createCalls = 0
  const stripe = {
    refunds: {
      async list() { return { data: [] } },
      async create() { createCalls += 1 },
    },
  }

  await assert.rejects(
    createBillingRefund(harness.pool, {
      accountId: 3,
      paymentId: 8,
      amountCents: 2000,
      reason: 'Duplicate charge',
      createdByUserId: 2,
      exceptionCategory: 'duplicate_charge',
      evidenceNote: 'Processor evidence attached.',
      ledgerTreatment: 'return_overpayment',
      requestKey: 'refund-ambiguous-owner',
      stripeClient: stripe,
    }),
    /incomplete refund inventory/i,
  )
  assert.equal(createCalls, 0)
  assert.equal(harness.refunds[0].external_status, 'reconciliation_required')
  assert.equal(harness.alerts[0]?.severity, 'critical')
})

test('refund sync never chooses a latest customer payment and quarantines a wrong-customer event on the exact PaymentIntent', async () => {
  const harness = createStripeRefundSyncHarness({
    payment: {
      id: 8,
      family_billing_account_id: 3,
      amount_cents: 10000,
      stripe_payment_intent_id: 'pi_exact',
      stripe_customer_id: 'cus_exact',
      external_processor: 'stripe',
    },
  })

  const synced = await syncStripeRefund(harness.pool, {
    id: 're_wrong_customer',
    object: 'refund',
    payment_intent: 'pi_exact',
    customer: 'cus_other',
    amount: 2500,
    currency: 'usd',
    status: 'succeeded',
    metadata: {},
  })

  assert.equal(synced.family_billing_account_id, 3)
  assert.equal(synced.payment_id, 8)
  assert.equal(synced.external_status, 'reconciliation_required')
  assert.match(synced.error_message, /customer cus_other does not match/i)
  assert.equal(harness.alerts[0]?.severity, 'critical')
  assert.equal(harness.alerts[0]?.family_billing_account_id, 3)
  assert.equal(harness.alerts[0]?.stripe_event_id, 'stripe-refund:re_wrong_customer')
  assert.equal(harness.calls.some(({ compact }) => compact.includes('ORDER BY p.paid_at')), false)
})

test('refund sync does not mutate a metadata-selected refund owned by another payment', async () => {
  const wrongRefund = {
    id: 99,
    family_billing_account_id: 9,
    payment_id: 90,
    amount_cents: 3000,
    external_status: 'pending',
    stripe_refund_id: null,
    ledger_treatment: 'return_overpayment',
  }
  const harness = createStripeRefundSyncHarness({
    payment: {
      id: 8,
      family_billing_account_id: 3,
      amount_cents: 10000,
      stripe_payment_intent_id: 'pi_exact',
      stripe_customer_id: 'cus_exact',
      external_processor: 'stripe',
    },
    refunds: [wrongRefund],
  })

  const synced = await syncStripeRefund(harness.pool, {
    id: 're_wrong_metadata',
    object: 'refund',
    payment_intent: 'pi_exact',
    amount: 3000,
    currency: 'usd',
    status: 'succeeded',
    metadata: {
      vortexRefundId: '99',
      billingPaymentId: '90',
      familyBillingAccountId: '9',
    },
  }, { event: { id: 'evt_wrong_metadata' } })

  assert.notEqual(synced.id, 99)
  assert.equal(synced.family_billing_account_id, 3)
  assert.equal(synced.payment_id, 8)
  assert.equal(synced.external_status, 'reconciliation_required')
  assert.match(synced.error_message, /different payment/i)
  assert.equal(harness.refunds.find((row) => row.id === 99).stripe_refund_id, null)
  assert.equal(harness.refunds.find((row) => row.id === 99).external_status, 'pending')
})

test('refund sync keeps an amount or currency mismatch quarantined instead of promoting the local refund', async () => {
  const harness = createStripeRefundSyncHarness({
    payment: {
      id: 8,
      family_billing_account_id: 3,
      amount_cents: 10000,
      stripe_payment_intent_id: 'pi_exact',
      stripe_customer_id: 'cus_exact',
      external_processor: 'stripe',
    },
    refunds: [{
      id: 77,
      family_billing_account_id: 3,
      payment_id: 8,
      amount_cents: 2000,
      external_status: 'pending',
      stripe_refund_id: null,
      ledger_treatment: 'return_overpayment',
    }],
  })

  const synced = await syncStripeRefund(harness.pool, {
    id: 're_mismatch',
    object: 'refund',
    payment_intent: 'pi_exact',
    amount: 3000,
    currency: 'eur',
    status: 'succeeded',
    metadata: {
      vortexRefundId: '77',
      billingPaymentId: '8',
      familyBillingAccountId: '3',
    },
  }, { event: { id: 'evt_refund_mismatch' } })

  assert.equal(synced.id, 77)
  assert.equal(synced.amount_cents, 2000)
  assert.equal(synced.external_status, 'reconciliation_required')
  assert.match(synced.error_message, /currency eur is not USD/i)
  assert.match(synced.error_message, /does not match Stripe amount 3000/i)
})

test('refund sync rejects customer-only ownership instead of guessing the latest payment', async () => {
  const harness = createStripeRefundSyncHarness({
    payment: {
      id: 8,
      family_billing_account_id: 3,
      amount_cents: 10000,
      stripe_payment_intent_id: 'pi_exact',
      stripe_customer_id: 'cus_exact',
    },
  })
  await assert.rejects(
    syncStripeRefund(harness.pool, {
      id: 're_customer_only',
      object: 'refund',
      customer: 'cus_exact',
      amount: 1000,
      currency: 'usd',
      status: 'succeeded',
    }, { stripeClient: { charges: { retrieve: async () => null } } }),
    /no immutable PaymentIntent or Charge owner/i,
  )
  assert.equal(harness.calls.some(({ compact }) => compact.includes('stripe_customer_id')), false)
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
      if (text.includes('UPDATE stripe_billing_alert')) return { rows: [] }
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
  for (const call of calls.filter(({ text }) => text.includes('UPDATE stripe_webhook_event'))) {
    assert.match(call.text, /claim_token = NULL/)
    assert.match(call.text, /lease_expires_at = NULL/)
    assert.match(call.text, /claim_token = \$2/)
  }
  const resolvedAlert = calls.find(({ text }) => text.includes('UPDATE stripe_billing_alert'))
  assert.ok(resolvedAlert)
  assert.equal(resolvedAlert.params[0], 'evt_complete')
  assert.match(resolvedAlert.text, /alert_type = 'webhook_failure'/)
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

test('a historical Stripe payment never becomes a local-only refund when Stripe is disabled', async () => {
  const previousEnabled = process.env.STRIPE_ENABLED
  const previousSecret = process.env.STRIPE_SECRET_KEY
  process.env.STRIPE_ENABLED = 'false'
  delete process.env.STRIPE_SECRET_KEY
  let insertedStatus = null
  const payment = {
    id: 8,
    family_billing_account_id: 3,
    amount_cents: 10_000,
    stripe_payment_intent_id: 'pi_historical',
    external_processor: 'stripe',
  }
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      if (
        text === 'BEGIN'
        || text === 'COMMIT'
        || text === 'ROLLBACK'
        || text.includes('pg_advisory_lock')
        || text.includes('pg_advisory_unlock')
      ) return { rows: [] }
      if (text.includes('FROM billing_payment') && text.includes('FOR UPDATE')) {
        return { rows: [payment] }
      }
      if (text.includes('FROM billing_refund WHERE request_key = $1 FOR UPDATE')) return { rows: [] }
      if (text.includes('FROM billing_refund') && text.includes("external_status IN ('pending', 'succeeded', 'reconciliation_required')")) {
        return { rows: [] }
      }
      if (text.includes('INSERT INTO billing_refund')) {
        insertedStatus = params[5]
        return { rows: [{
          id: 77,
          family_billing_account_id: params[0],
          payment_id: params[1],
          amount_cents: params[2],
          external_status: params[5],
        }] }
      }
      if (text.includes("SET external_status = 'pending'")) return { rows: [] }
      throw new Error(`Unexpected disabled-Stripe refund query: ${text}`)
    },
  }

  try {
    await assert.rejects(
      createBillingRefund(pool, {
        accountId: 3,
        paymentId: 8,
        amountCents: 2_000,
        reason: 'Approved duplicate refund',
        createdByUserId: 2,
        exceptionCategory: 'duplicate_charge',
        evidenceNote: 'Stripe payment evidence attached.',
        ledgerTreatment: 'return_overpayment',
        requestKey: 'historical-stripe-refund',
      }),
      /Stripe is unavailable/i,
    )
    assert.equal(insertedStatus, 'pending')
  } finally {
    if (previousEnabled == null) delete process.env.STRIPE_ENABLED
    else process.env.STRIPE_ENABLED = previousEnabled
    if (previousSecret == null) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = previousSecret
  }
})

test('a succeeded Stripe refund without ledger treatment blocks collection immediately', async () => {
  let storedRefund = null
  const alerts = []
  const payment = {
    id: 8,
    family_billing_account_id: 3,
    amount_cents: 10_000,
    stripe_payment_intent_id: 'pi_exact_refund',
    stripe_customer_id: 'cus_exact',
    external_processor: 'stripe',
  }
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock')) return { rows: [{ pg_advisory_lock: null }] }
      if (text.includes('pg_advisory_unlock')) return { rows: [{ pg_advisory_unlock: true }] }
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(text)) return { rows: [] }
      if (text.includes('FROM billing_payment') && text.includes('FOR UPDATE')) {
        return { rows: [{ ...payment }] }
      }
      if (text.includes('FROM billing_payment') && text.includes('stripe_payment_intent_id = $1')) {
        return { rows: params[0] === payment.stripe_payment_intent_id ? [{ ...payment }] : [] }
      }
      if (text.includes('FROM billing_refund') && text.includes("external_status IN ('pending', 'succeeded', 'reconciliation_required')")) {
        return { rows: [] }
      }
      if (text.includes('FROM billing_refund WHERE id = $1 FOR UPDATE')) {
        return { rows: Number(storedRefund?.id) === Number(params[0]) ? [{ ...storedRefund }] : [] }
      }
      if (text.includes('FROM billing_refund WHERE stripe_refund_id = $1 FOR UPDATE')) {
        return { rows: storedRefund?.stripe_refund_id === params[0] ? [{ ...storedRefund }] : [] }
      }
      if (text.includes('FROM billing_refund WHERE request_key = $1 FOR UPDATE')) return { rows: [] }
      if (text.includes('FROM billing_refund') && text.includes('COALESCE(external_status')) {
        return { rows: Number(storedRefund?.id) === Number(params[1]) ? [] : [storedRefund] }
      }
      if (text.includes('INSERT INTO billing_refund')) {
        storedRefund = {
          id: 77,
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
          stripe_refund_id: null,
        }
        return { rows: [{ ...storedRefund }] }
      }
      if (text.includes('stripe_refund_id = CASE')) {
        storedRefund = {
          ...storedRefund,
          stripe_refund_id: params[2],
          external_reference: params[2],
          external_status: params[3],
          error_message: params[4],
        }
        return { rows: [{ ...storedRefund }] }
      }
      if (text.includes('INSERT INTO stripe_billing_alert')) {
        const alert = {
          stripe_event_id: params[0],
          family_billing_account_id: params[1],
          alert_type: params[2],
          severity: params[3],
        }
        alerts.push(alert)
        return { rows: [{ id: alerts.length, ...alert }] }
      }
      if (text.includes("SET external_status = 'pending'")) return { rows: [] }
      throw new Error(`Unexpected untreated-refund query: ${text}`)
    },
  }
  const stripe = {
    refunds: {
      async create(_payload) {
        return {
          id: 're_untreated',
          object: 'refund',
          payment_intent: payment.stripe_payment_intent_id,
          customer: payment.stripe_customer_id,
          amount: 2_000,
          currency: 'usd',
          status: 'succeeded',
          metadata: {
            vortexRefundId: '77',
            billingPaymentId: '8',
            familyBillingAccountId: '3',
          },
        }
      },
    },
  }

  const refund = await createBillingRefund(pool, {
    accountId: 3,
    paymentId: 8,
    amountCents: 2_000,
    reason: 'Approved legacy refund',
    createdByUserId: 2,
    exceptionCategory: 'owner_discretion',
    evidenceNote: 'Owner approval attached.',
    ledgerTreatment: null,
    requestKey: 'untreated-stripe-refund',
    stripeClient: stripe,
  })

  assert.equal(refund.external_status, 'reconciliation_required')
  assert.match(refund.error_message, /no approved ledger treatment/i)
  assert.deepEqual(alerts, [{
    stripe_event_id: 'stripe-refund:re_untreated',
    family_billing_account_id: 3,
    alert_type: 'refund_reconciliation_required',
    severity: 'critical',
  }])
})

test('refund transport ambiguity discovers the metadata-bound remote Refund before any replay create', async () => {
  const harness = createStripeRefundSyncHarness({
    payment: {
      id: 8,
      family_billing_account_id: 3,
      amount_cents: 10000,
      stripe_payment_intent_id: 'pi_8',
      stripe_customer_id: 'cus_8',
      external_processor: 'stripe',
    },
  })
  let acceptedRemote = null
  const createCalls = []
  const listCalls = []
  const stripe = {
    refunds: {
      async create(payload, options) {
        createCalls.push({ payload, options })
        acceptedRemote = {
          id: `re_same_${payload.metadata.vortexRefundId}`,
          object: 'refund',
          payment_intent: 'pi_8',
          customer: 'cus_8',
          amount: payload.amount,
          currency: 'usd',
          status: 'succeeded',
          metadata: { ...payload.metadata },
        }
        throw new Error('simulated connection reset after Stripe accepted the request')
      },
      async list(params) {
        listCalls.push(params)
        return { data: [acceptedRemote], has_more: false }
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

  await assert.rejects(createBillingRefund(harness.pool, input), /connection reset/)
  const replay = await createBillingRefund(harness.pool, input)

  assert.equal(harness.refunds.length, 1)
  assert.equal(replay.id, harness.refunds[0].id)
  assert.equal(replay.external_status, 'reconciliation_required')
  assert.equal(stripeRefundReadyForLedgerFinalization(replay), true)
  assert.equal(replay.idempotency_replayed, true)
  assert.equal(createCalls.length, 1)
  assert.equal(createCalls[0].options.idempotencyKey, `vortex-refund-${replay.id}`)
  assert.deepEqual(listCalls, [{ payment_intent: 'pi_8', limit: 100 }])
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
      if (text.includes('FROM billing_refund') && text.includes("external_status IN ('pending', 'succeeded', 'reconciliation_required')")) {
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
