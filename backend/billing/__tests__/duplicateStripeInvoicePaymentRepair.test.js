import test from 'node:test'
import assert from 'node:assert/strict'

import { repairDuplicateStripeInvoicePayments } from '../duplicateStripeInvoicePaymentRepair.js'

function clone(value) {
  return structuredClone(value)
}

function repairFixture({
  withApplication = false,
  invoiceAccountId = 8,
  duplicateAccountId = 8,
  remoteRefund = false,
  reversalConflict = false,
  commitErrorAfterApply = false,
  secondPair = false,
  failCanonicalPaymentId = null,
  invoiceCurrency = 'usd',
  paymentIntentCurrency = 'usd',
  invoicePaymentCurrency = 'usd',
  extraOpenInvoicePayment = false,
} = {}) {
  const state = {
    payments: [
      {
        id: 1,
        family_billing_account_id: invoiceAccountId,
        family_name: 'Test Family',
        amount_cents: 7125,
        external_status: 'settled',
        stripe_invoice_id: 'in_exact',
        stripe_payment_intent_id: null,
        stripe_customer_id: 'cus_exact',
        external_reference: 'in_exact',
        method: 'Card',
        note: 'Stripe invoice payment',
      },
      {
        id: 2,
        family_billing_account_id: duplicateAccountId,
        family_name: 'Test Family',
        amount_cents: 7125,
        external_status: 'settled',
        stripe_invoice_id: null,
        stripe_payment_intent_id: 'pi_exact',
        stripe_customer_id: 'cus_exact',
        external_reference: 'pi_exact',
        method: 'Link',
        note: 'Stripe payment',
      },
    ],
    applications: withApplication ? [{
      id: 49,
      billing_payment_id: 2,
      billing_charge_id: 31,
      amount_cents: 7125,
      application_kind: 'application',
      reverses_application_id: null,
      idempotency_key: 'allocation:2:31',
      allocation_reason: 'oldest_charge',
      charge_account_id: 8,
      charge_type: 'recurring',
      charge_source_type: 'scheduling_signup',
      charge_source_id: '98',
      subscription_id: 29,
      has_monthly_invoice_line: false,
      has_statement_line: false,
      has_entitlement: false,
      has_active_payment_attempt: false,
    }] : [],
    activities: [],
    chargeStatus: withApplication ? 'paid' : null,
    writes: [],
    transactionEvents: [],
    snapshot: null,
  }
  if (secondPair) {
    state.payments.push(
      {
        id: 3,
        family_billing_account_id: 8,
        family_name: 'Test Family',
        amount_cents: 5000,
        external_status: 'settled',
        stripe_invoice_id: 'in_second',
        stripe_payment_intent_id: null,
        stripe_customer_id: 'cus_exact',
        external_reference: 'in_second',
        method: 'Card',
        note: 'Stripe invoice payment',
      },
      {
        id: 4,
        family_billing_account_id: 8,
        family_name: 'Test Family',
        amount_cents: 5000,
        external_status: 'settled',
        stripe_invoice_id: null,
        stripe_payment_intent_id: 'pi_second',
        stripe_customer_id: 'cus_exact',
        external_reference: 'pi_second',
        method: 'Link',
        note: 'Stripe payment',
      },
    )
  }

  const client = {
    release() {},
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock')) return { rows: [{}] }
      if (text.includes('pg_advisory_unlock')) return { rows: [{ pg_advisory_unlock: true }] }
      if (text === 'BEGIN') {
        state.transactionEvents.push('BEGIN')
        state.snapshot = clone({
          payments: state.payments,
          applications: state.applications,
          activities: state.activities,
          chargeStatus: state.chargeStatus,
        })
        return { rows: [] }
      }
      if (text === 'COMMIT') {
        state.transactionEvents.push('COMMIT')
        state.snapshot = null
        if (commitErrorAfterApply) throw new Error('connection lost while awaiting COMMIT')
        return { rows: [] }
      }
      if (text === 'ROLLBACK') {
        state.transactionEvents.push('ROLLBACK')
        if (state.snapshot) Object.assign(state, clone(state.snapshot))
        state.snapshot = null
        return { rows: [] }
      }
      if (text.includes('FROM billing_payment payment')) {
        const ids = params[0].map(Number)
        return {
          rows: state.payments
            .filter((payment) => ids.includes(Number(payment.id)))
            .map((payment) => ({
              ...clone(payment),
              account_stripe_customer_id: 'cus_exact',
            })),
        }
      }
      if (text.includes('FROM billing_payment_application application') && text.includes('reversed_cents')) {
        const originals = state.applications.filter((application) => (
          Number(application.billing_payment_id) === Number(params[0])
          && application.application_kind === 'application'
        ))
        return {
          rows: originals.map((application) => ({
            ...clone(application),
            reversed_cents: state.applications
              .filter((candidate) => (
                candidate.application_kind === 'reversal'
                && Number(candidate.reverses_application_id) === Number(application.id)
              ))
              .reduce((sum, candidate) => sum + Number(candidate.amount_cents), 0),
          })),
        }
      }
      if (text.includes('FROM billing_refund')) return { rows: [] }
      if (text.includes('FROM billing_monthly_invoice_line') && text.includes('billing_payment_id')) return { rows: [] }
      if (text.includes('FROM billing_payment_attempt')) return { rows: [] }
      if (text.includes('FROM billing_account_activity')) {
        return { rows: state.activities.filter((activity) => activity.event_key === params[0]).map(clone) }
      }
      if (text.includes('INSERT INTO billing_payment_application')) {
        state.writes.push({ text, params: clone(params) })
        if (reversalConflict) return { rows: [] }
        const row = {
          id: 50,
          billing_payment_id: params[0],
          billing_charge_id: params[1],
          amount_cents: params[2],
          application_kind: 'reversal',
          reverses_application_id: params[3],
          idempotency_key: params[4],
          allocation_reason: 'duplicate_stripe_invoice_payment_repair',
        }
        state.applications.push(row)
        return { rows: [clone(row)] }
      }
      if (text.includes('SELECT * FROM billing_payment_application WHERE idempotency_key')) {
        if (reversalConflict) {
          return { rows: [{
            id: 999,
            billing_payment_id: 2,
            billing_charge_id: 31,
            amount_cents: 1,
            application_kind: 'reversal',
            reverses_application_id: 49,
            idempotency_key: params[0],
            allocation_reason: 'different_reason',
          }] }
        }
        return { rows: state.applications.filter((application) => application.idempotency_key === params[0]).map(clone) }
      }
      if (text.includes("SET external_status = 'canceled'")) {
        state.writes.push({ text, params: clone(params) })
        const payment = state.payments.find((row) => Number(row.id) === Number(params[0]))
        if (!payment || payment.stripe_payment_intent_id !== params[1]) return { rows: [] }
        payment.external_status = 'canceled'
        payment.stripe_payment_intent_id = null
        payment.external_reference ||= params[1]
        payment.note = `${payment.note} | ${params[2]}`
        return { rows: [clone(payment)] }
      }
      if (text.includes('SET stripe_payment_intent_id = $2') && text.includes('stripe_invoice_id = $4')) {
        state.writes.push({ text, params: clone(params) })
        const payment = state.payments.find((row) => Number(row.id) === Number(params[0]))
        if (Number(params[0]) === Number(failCanonicalPaymentId)) return { rows: [] }
        if (!payment || payment.stripe_invoice_id !== params[3]) return { rows: [] }
        payment.stripe_payment_intent_id = params[1]
        payment.stripe_customer_id ||= params[2]
        payment.method = params[4]
        return { rows: [clone(payment)] }
      }
      if (text.includes('UPDATE billing_charge charge')) {
        state.writes.push({ text, params: clone(params) })
        state.chargeStatus = 'unpaid'
        return { rows: [] }
      }
      if (text.includes('UPDATE billing_statement statement')) {
        state.writes.push({ text, params: clone(params) })
        return { rows: [] }
      }
      if (text.includes('INSERT INTO billing_account_activity')) {
        state.writes.push({ text, params: clone(params) })
        if (state.activities.some((activity) => activity.event_key === params[0])) return { rows: [] }
        const activity = {
          id: 700,
          event_key: params[0],
          family_billing_account_id: params[1],
          related_payment_id: params[5],
          event_type: params[7],
          details: JSON.parse(params[11]),
          stripe_object_id: params[12],
        }
        state.activities.push(activity)
        return { rows: [clone(activity)] }
      }
      throw new Error(`Unexpected repair query: ${text}`)
    },
  }
  const pool = {
    query: (...args) => client.query(...args),
    connect: async () => client,
  }
  const invoices = new Map([
    ['in_exact', {
      id: 'in_exact',
      status: 'paid',
      paid: true,
      amount_paid: 7125,
      customer: 'cus_exact',
      currency: invoiceCurrency,
    }],
    ['in_second', {
      id: 'in_second',
      status: 'paid',
      paid: true,
      amount_paid: 5000,
      customer: 'cus_exact',
      currency: invoiceCurrency,
    }],
  ])
  const invoiceForIntent = (paymentIntentId) => (
    paymentIntentId === 'pi_second' ? 'in_second' : 'in_exact'
  )
  const intentForInvoice = (invoiceId) => (
    invoiceId === 'in_second' ? 'pi_second' : 'pi_exact'
  )
  const stripe = {
    invoices: { retrieve: async (id) => clone(invoices.get(id)) },
    paymentIntents: {
      retrieve: async (id) => ({
        id,
        status: 'succeeded',
        amount_received: id === 'pi_second' ? 5000 : 7125,
        customer: 'cus_exact',
        currency: paymentIntentCurrency,
        payment_method: { id: `pm_${id}`, type: 'link', customer: 'cus_exact' },
        latest_charge: { payment_method_details: { type: 'link', link: {} } },
      }),
    },
    invoicePayments: {
      list: async (params) => {
        const paymentIntentId = params.invoice
          ? intentForInvoice(params.invoice)
          : params.payment?.payment_intent
        const invoiceId = params.invoice ?? invoiceForIntent(paymentIntentId)
        const invoice = clone(invoices.get(invoiceId))
        const data = [{
            id: `inpay_${invoiceId}`,
            invoice: params.invoice ? invoiceId : invoice,
            status: 'paid',
            amount_paid: invoice.amount_paid,
            currency: invoicePaymentCurrency,
            payment: { type: 'payment_intent', payment_intent: paymentIntentId },
          }]
        if (extraOpenInvoicePayment && params.invoice) {
          data.push({
            id: `inpay_${invoiceId}_open`,
            invoice: invoiceId,
            status: 'open',
            amount_paid: null,
            currency: 'usd',
            payment: { type: 'payment_intent', payment_intent: 'pi_competing' },
          })
        }
        return { data, has_more: false }
      },
    },
    refunds: { list: async () => ({ data: remoteRefund ? [{ id: 're_1' }] : [] }) },
    disputes: { list: async () => ({ data: [] }) },
  }
  return { state, pool, stripe }
}

const PAIRS = [{ invoicePaymentId: 1, duplicatePaymentId: 2 }]
const APPLY_PROVENANCE = Object.freeze({
  planHash: 'a'.repeat(64),
  sourceChecksum: 'b'.repeat(64),
  changeTicket: 'INC-42',
  operator: 'billing-admin',
  codeVersion: 'release-42',
})

test('duplicate invoice-payment repair dry run proves evidence without local writes', async () => {
  const fixture = repairFixture({ withApplication: true })
  const result = await repairDuplicateStripeInvoicePayments(fixture.pool, fixture.stripe, { pairs: PAIRS })

  assert.equal(result.mode, 'dry_run')
  assert.equal(result.cohortStopped, false)
  assert.equal(result.ready[0].pair, '1:2')
  assert.deepEqual(result.ready[0].reversals, [{ applicationId: 49, chargeId: 31, amountCents: 7125 }])
  assert.deepEqual(fixture.state.writes, [])
  assert.deepEqual(fixture.state.transactionEvents, [])
})

test('apply atomically transfers the PaymentIntent and is remotely verified on replay', async () => {
  const fixture = repairFixture()
  const first = await repairDuplicateStripeInvoicePayments(fixture.pool, fixture.stripe, {
    pairs: PAIRS,
    apply: true,
    provenance: APPLY_PROVENANCE,
  })

  assert.equal(first.cohortStopped, false)
  assert.equal(first.repaired[0].state, 'committed')
  assert.equal(fixture.state.payments[0].stripe_payment_intent_id, 'pi_exact')
  assert.equal(fixture.state.payments[0].method, 'Link')
  assert.equal(fixture.state.payments[1].stripe_payment_intent_id, null)
  assert.equal(fixture.state.payments[1].external_status, 'canceled')
  assert.equal(fixture.state.activities.length, 1)
  assert.equal(fixture.state.activities[0].details.repairProvenance.changeTicket, 'INC-42')
  assert.equal(fixture.state.activities[0].details.paymentMethod, 'Link')

  const replay = await repairDuplicateStripeInvoicePayments(fixture.pool, fixture.stripe, {
    pairs: PAIRS,
    apply: true,
    provenance: APPLY_PROVENANCE,
  })
  assert.equal(replay.cohortStopped, false)
  assert.equal(replay.repaired[0].state, 'committed')
  assert.equal(fixture.state.activities.length, 1)
})

test('Barnett-shaped allocation gets one exact reversal and reopens the charge', async () => {
  const fixture = repairFixture({ withApplication: true })
  const result = await repairDuplicateStripeInvoicePayments(fixture.pool, fixture.stripe, {
    pairs: PAIRS,
    apply: true,
    provenance: APPLY_PROVENANCE,
  })

  assert.equal(result.cohortStopped, false)
  const reversals = fixture.state.applications.filter((application) => application.application_kind === 'reversal')
  assert.deepEqual(reversals.map((application) => ({
    paymentId: application.billing_payment_id,
    chargeId: application.billing_charge_id,
    amountCents: application.amount_cents,
    reverses: application.reverses_application_id,
  })), [{ paymentId: 2, chargeId: 31, amountCents: 7125, reverses: 49 }])
  assert.equal(fixture.state.chargeStatus, 'unpaid')
})

test('malformed repaired state and cross-account pairs never pass preflight', async () => {
  const fixture = repairFixture({ duplicateAccountId: 9 })
  fixture.state.payments[0].stripe_payment_intent_id = 'pi_exact'
  fixture.state.payments[1].stripe_payment_intent_id = null
  fixture.state.payments[1].external_status = 'canceled'

  const result = await repairDuplicateStripeInvoicePayments(fixture.pool, fixture.stripe, {
    pairs: PAIRS,
    apply: true,
    provenance: APPLY_PROVENANCE,
  })
  assert.equal(result.cohortStopped, true)
  assert.match(result.failed[0].message, /different billing accounts/)
  assert.deepEqual(fixture.state.writes, [])
})

test('an idempotency-key collision rolls back before either payment changes', async () => {
  const fixture = repairFixture({ withApplication: true, reversalConflict: true })
  const before = clone(fixture.state.payments)

  const result = await repairDuplicateStripeInvoicePayments(fixture.pool, fixture.stripe, {
    pairs: PAIRS,
    apply: true,
    provenance: APPLY_PROVENANCE,
  })
  assert.equal(result.cohortStopped, true)
  assert.match(result.failed[0].message, /does not have the exact repair reversal/)
  assert.deepEqual(fixture.state.payments, before)
  assert.deepEqual(fixture.state.transactionEvents, ['BEGIN', 'ROLLBACK'])
})

test('remote refund history stops the entire cohort before local mutation', async () => {
  const fixture = repairFixture({ remoteRefund: true })
  const result = await repairDuplicateStripeInvoicePayments(fixture.pool, fixture.stripe, {
    pairs: PAIRS,
    apply: true,
    provenance: APPLY_PROVENANCE,
  })

  assert.equal(result.cohortStopped, true)
  assert.match(result.failed[0].message, /remote refund history/)
  assert.deepEqual(fixture.state.writes, [])
})

test('an extra open Invoice Payment stops duplicate repair before local mutation', async () => {
  const fixture = repairFixture({ extraOpenInvoicePayment: true })
  const result = await repairDuplicateStripeInvoicePayments(fixture.pool, fixture.stripe, {
    pairs: PAIRS,
    apply: true,
    provenance: APPLY_PROVENANCE,
  })

  assert.equal(result.cohortStopped, true)
  assert.match(result.failed[0].message, /non-paid Invoice Payment|ambiguous/)
  assert.deepEqual(fixture.state.writes, [])
})

test('non-USD invoice, Invoice Payment, or PaymentIntent evidence stops repair before local mutation', async () => {
  for (const options of [
    { invoiceCurrency: 'eur' },
    { invoicePaymentCurrency: 'eur' },
    { paymentIntentCurrency: 'eur' },
  ]) {
    const fixture = repairFixture(options)
    const result = await repairDuplicateStripeInvoicePayments(fixture.pool, fixture.stripe, {
      pairs: PAIRS,
      apply: true,
      provenance: APPLY_PROVENANCE,
    })

    assert.equal(result.cohortStopped, true)
    assert.match(result.failed[0].message, /must use USD/)
    assert.deepEqual(fixture.state.writes, [])
  }
})

test('a commit-ambiguous outcome is re-inspected and reported as committed', async () => {
  const fixture = repairFixture({ commitErrorAfterApply: true })
  const result = await repairDuplicateStripeInvoicePayments(fixture.pool, fixture.stripe, {
    pairs: PAIRS,
    apply: true,
    provenance: APPLY_PROVENANCE,
  })

  assert.equal(result.cohortStopped, true)
  assert.match(result.failed[0].message, /connection lost while awaiting COMMIT/)
  assert.deepEqual(result.committed.map((row) => row.pair), ['1:2'])
  assert.deepEqual(result.notApplied, [])
  assert.deepEqual(result.unknown, [])
  assert.equal(fixture.state.payments[0].stripe_payment_intent_id, 'pi_exact')
  assert.equal(fixture.state.payments[1].external_status, 'canceled')
})

test('a later pair failure reports earlier commits from fresh evidence and leaves the rest not applied', async () => {
  const fixture = repairFixture({ secondPair: true, failCanonicalPaymentId: 3 })
  const result = await repairDuplicateStripeInvoicePayments(fixture.pool, fixture.stripe, {
    pairs: [
      { invoicePaymentId: 1, duplicatePaymentId: 2 },
      { invoicePaymentId: 3, duplicatePaymentId: 4 },
    ],
    apply: true,
    provenance: APPLY_PROVENANCE,
  })

  assert.equal(result.cohortStopped, true)
  assert.deepEqual(result.committed.map((row) => row.pair), ['1:2'])
  assert.deepEqual(result.notApplied.map((row) => row.pair), ['3:4'])
  assert.deepEqual(result.unknown, [])
  assert.equal(fixture.state.payments.find((row) => row.id === 2).external_status, 'canceled')
  assert.equal(fixture.state.payments.find((row) => row.id === 4).external_status, 'settled')
})

test('service-layer apply refuses missing reviewed provenance', async () => {
  const fixture = repairFixture()
  await assert.rejects(
    repairDuplicateStripeInvoicePayments(fixture.pool, fixture.stripe, {
      pairs: PAIRS,
      apply: true,
    }),
    /exact plan hash, source checksum, change ticket, operator, and code version/,
  )
  assert.deepEqual(fixture.state.writes, [])
})
