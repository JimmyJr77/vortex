import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveEnrollmentCheckoutPayment,
  recordEnrollmentStripePayment,
  recordPaidCheckoutFulfillmentQuarantine,
  applyAndSettlePaidCheckoutFulfillment,
} from '../stripeBilling.js'

test('resolveEnrollmentCheckoutPayment reads payment_intent from expanded invoice', async () => {
  const stripe = {
    checkout: {
      sessions: {
        retrieve: async () => ({
          id: 'cs_test_abc',
          payment_intent: null,
          invoice: {
            id: 'in_test_1',
            payment_intent: 'pi_test_from_invoice',
          },
        }),
      },
    },
  }

  const resolved = await resolveEnrollmentCheckoutPayment(stripe, { id: 'cs_test_abc' })
  assert.equal(resolved.paymentIntentId, 'pi_test_from_invoice')
  assert.equal(resolved.invoiceId, 'in_test_1')
})

test('recordEnrollmentStripePayment inserts by checkout session when PI is absent', async () => {
  const queries = []
  const pool = {
    query: async (sql, params) => {
      queries.push(String(sql))
      if (/058_billing_stripe_links/.test(sql) || /047_stripe_billing/.test(sql)) {
        return { rows: [] }
      }
      if (/INSERT INTO billing_payment/.test(sql)) {
        return {
          rows: [{
            id: 99,
            family_billing_account_id: params[0],
            amount_cents: params[1],
            external_processor: 'stripe',
            external_status: 'settled',
            stripe_customer_id: params[4],
            stripe_payment_intent_id: null,
            stripe_checkout_session_id: params[5],
            stripe_invoice_id: params[6],
            newly_inserted: true,
          }],
        }
      }
      if (/UPDATE billing_charge/.test(sql)) {
        return { rows: [] }
      }
      return { rows: [] }
    },
  }

  const payment = await recordEnrollmentStripePayment(pool, null, {
    session: {
      id: 'cs_test_xyz',
      amount_total: 23500,
      currency: 'usd',
      payment_status: 'paid',
      customer: 'cus_1',
    },
    accountId: 461,
  })

  assert.ok(payment)
  assert.ok(queries.some((q) => q.includes('stripe_checkout_session_id')))
})

test('recordEnrollmentStripePayment preserves an exact PI replay and guards immutable ownership in SQL', async () => {
  let insertSql = ''
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('INSERT INTO billing_payment')) {
        insertSql = text
        return {
          rows: [{
            id: 99,
            family_billing_account_id: params[0],
            amount_cents: params[1],
            external_processor: 'stripe',
            external_status: 'settled',
            stripe_customer_id: params[4],
            stripe_payment_intent_id: params[5],
            stripe_checkout_session_id: params[6],
            stripe_invoice_id: params[7],
            newly_inserted: false,
          }],
        }
      }
      return { rows: [] }
    },
  }
  const session = {
    id: 'cs_exact',
    payment_intent: 'pi_exact',
    amount_total: 23500,
    currency: 'usd',
    payment_status: 'paid',
    customer: 'cus_1',
  }

  const payment = await recordEnrollmentStripePayment(pool, null, {
    session,
    accountId: 461,
  })

  assert.equal(payment.id, 99)
  assert.equal(payment.newly_inserted, false)
  assert.match(insertSql, /billing_payment\.family_billing_account_id = EXCLUDED\.family_billing_account_id/)
  assert.match(insertSql, /billing_payment\.amount_cents = EXCLUDED\.amount_cents/)
  assert.match(insertSql, /billing_payment\.stripe_customer_id IS NOT DISTINCT FROM EXCLUDED\.stripe_customer_id/)
  assert.match(insertSql, /billing_payment\.stripe_checkout_session_id IS NULL[\s\S]*OR billing_payment\.stripe_checkout_session_id = EXCLUDED\.stripe_checkout_session_id/)
  assert.match(insertSql, /billing_payment\.external_status IN \('settled', 'succeeded'\)/)
})

test('recordEnrollmentStripePayment fails closed when a PI conflict returns another owner', async () => {
  const expected = {
    id: 99,
    family_billing_account_id: 461,
    amount_cents: 23500,
    external_processor: 'stripe',
    external_status: 'settled',
    stripe_customer_id: 'cus_1',
    stripe_payment_intent_id: 'pi_exact',
    stripe_checkout_session_id: 'cs_exact',
    stripe_invoice_id: null,
    newly_inserted: false,
  }
  const session = {
    id: 'cs_exact',
    payment_intent: 'pi_exact',
    amount_total: 23500,
    currency: 'usd',
    payment_status: 'paid',
    customer: 'cus_1',
  }

  for (const overrides of [
    { family_billing_account_id: 999 },
    { amount_cents: 1 },
    { stripe_customer_id: 'cus_other' },
    { stripe_checkout_session_id: 'cs_other' },
    { external_status: 'failed' },
  ]) {
    const pool = {
      async query(sql) {
        if (String(sql).includes('INSERT INTO billing_payment')) {
          return { rows: [{ ...expected, ...overrides }] }
        }
        return { rows: [] }
      },
    }
    await assert.rejects(
      recordEnrollmentStripePayment(pool, null, { session, accountId: 461 }),
      (error) => error?.code === 'stripe_enrollment_payment_binding_conflict',
    )
  }

  await assert.rejects(
    recordEnrollmentStripePayment({
      async query() {
        return { rows: [] }
      },
    }, null, { session, accountId: 461 }),
    (error) => (
      error?.code === 'stripe_enrollment_payment_binding_conflict'
      && error.details.problems.includes('payment_missing')
    ),
  )
})

test('recordEnrollmentStripePayment does not create a payment for an exact $0 Setup Checkout', async () => {
  let queried = false
  const payment = await recordEnrollmentStripePayment({
    async query() {
      queried = true
      return { rows: [] }
    },
  }, null, {
    accountId: 461,
    session: {
      id: 'cs_setup',
      mode: 'setup',
      status: 'complete',
      payment_status: 'no_payment_required',
      amount_total: null,
      currency: 'usd',
      customer: 'cus_1',
    },
  })
  assert.equal(payment, null)
  assert.equal(queried, false)
})

test('recordEnrollmentStripePayment rejects missing expected identity before any write', async () => {
  const exact = {
    id: 'cs_exact',
    mode: 'payment',
    payment_status: 'paid',
    amount_total: 23500,
    currency: 'usd',
    customer: 'cus_1',
    payment_intent: 'pi_exact',
  }
  for (const options of [
    { accountId: null, session: exact },
    { accountId: 461, session: { ...exact, id: null } },
    { accountId: 461, session: { ...exact, customer: null } },
    { accountId: 461, session: { ...exact, amount_total: null } },
  ]) {
    let queried = false
    await assert.rejects(
      recordEnrollmentStripePayment({
        async query() {
          queried = true
          return { rows: [] }
        },
      }, null, options),
      (error) => error?.code === 'stripe_enrollment_payment_binding_conflict',
    )
    assert.equal(queried, false)
  }
})

test('recordEnrollmentStripePayment keeps pre-fulfillment cash non-allocatable', async () => {
  const queries = []
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      queries.push(text)
      if (text.includes('INSERT INTO billing_payment')) {
        return {
          rows: [{
            id: 301,
            family_billing_account_id: params[0],
            amount_cents: params[1],
            external_processor: 'stripe',
            external_status: params[10],
            note: params[11],
            stripe_customer_id: params[4],
            stripe_payment_intent_id: params[5],
            stripe_checkout_session_id: params[6],
            stripe_invoice_id: params[7],
            newly_inserted: true,
          }],
        }
      }
      return { rows: [] }
    },
  }
  const payment = await recordEnrollmentStripePayment(pool, null, {
    accountId: 461,
    fulfillmentPending: true,
    session: {
      id: 'cs_pre_fulfillment',
      mode: 'payment',
      status: 'complete',
      payment_status: 'paid',
      amount_total: 23500,
      currency: 'usd',
      customer: 'cus_original',
      payment_intent: 'pi_pre_fulfillment',
    },
  })

  assert.equal(payment.id, 301)
  assert.equal(payment.external_status, 'reconciliation_required')
  assert.match(payment.note, /paid-checkout-fulfillment-pending:cs_pre_fulfillment/)
  assert.equal(queries.filter((sql) => sql.includes('UPDATE billing_charge')).length, 0)
})

test('pre-fulfillment replay atomically reopens a legacy settled Checkout for exact validation', async () => {
  let insertSql = ''
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('INSERT INTO billing_payment')) {
        insertSql = text
        return { rows: [{
          id: 303,
          family_billing_account_id: 8,
          amount_cents: 5100,
          external_processor: 'stripe',
          external_status: 'reconciliation_required',
          stripe_customer_id: 'cus_legacy',
          stripe_payment_intent_id: 'pi_legacy',
          stripe_checkout_session_id: 'cs_legacy',
          stripe_invoice_id: null,
          newly_inserted: false,
          note: '[paid-checkout-fulfillment-pending:cs_legacy]',
        }] }
      }
      return { rows: [] }
    },
  }
  const payment = await recordEnrollmentStripePayment(pool, null, {
    accountId: 8,
    fulfillmentPending: true,
    session: {
      id: 'cs_legacy',
      mode: 'payment',
      status: 'complete',
      payment_status: 'paid',
      amount_total: 5100,
      currency: 'usd',
      customer: 'cus_legacy',
      payment_intent: 'pi_legacy',
    },
  })

  assert.equal(payment.external_status, 'reconciliation_required')
  assert.match(payment.note, /paid-checkout-fulfillment-pending:cs_legacy/)
  assert.match(insertSql, /external_status = CASE[\s\S]*EXCLUDED\.external_status = 'reconciliation_required'/)
  assert.match(insertSql, /CONCAT_WS\(' ', NULLIF\(BTRIM\(billing_payment\.note\), ''\), \$10\)/)
})

test('paid Checkout fulfillment quarantine records critical refund-required evidence idempotently', async () => {
  let alertWrite = null
  let quarantineWrite = null
  const pool = {
    async query(sql, params) {
      const text = String(sql)
      if (text.includes('UPDATE billing_payment')) {
        quarantineWrite = { sql: text, params }
        return { rows: [{
          id: 302,
          family_billing_account_id: 8,
          amount_cents: 5100,
          external_processor: 'stripe',
          external_status: 'reconciliation_required',
          stripe_customer_id: 'cus_historical',
          stripe_payment_intent_id: 'pi_paid_drift',
          stripe_checkout_session_id: 'cs_paid_drift',
          stripe_invoice_id: null,
          note: params[8],
        }] }
      }
      alertWrite = { sql: text, params }
      return { rows: [] }
    },
  }

  await recordPaidCheckoutFulfillmentQuarantine(pool, {
    checkoutKind: 'enrollment',
    ownerId: 44,
    accountId: 8,
    session: {
      id: 'cs_paid_drift',
      amount_total: 5100,
      customer: 'cus_historical',
      payment_intent: 'pi_paid_drift',
    },
    payment: { id: 302, stripe_payment_intent_id: 'pi_paid_drift' },
    reason: 'account_inactive',
  })

  assert.match(quarantineWrite.sql, /external_status = 'reconciliation_required'/)
  assert.equal(quarantineWrite.params[3], 'cs_paid_drift')
  assert.match(quarantineWrite.params[8], /paid-checkout-refund-required:cs_paid_drift/)
  assert.match(alertWrite.sql, /'paid_checkout_fulfillment_quarantined', 'critical'/)
  assert.match(alertWrite.sql, /ON CONFLICT \(stripe_event_id\) DO NOTHING/)
  assert.equal(alertWrite.params[0], 'paid-checkout-fulfillment-quarantined:enrollment:cs_paid_drift')
  assert.equal(alertWrite.params[1], 8)
  const details = JSON.parse(alertWrite.params[4])
  assert.equal(details.paymentId, 302)
  assert.equal(details.paymentRecorded, true)
  assert.equal(details.entitlementGranted, false)
  assert.equal(details.refundRequired, true)
})

function exactCheckoutFixture({
  refunds = [],
  existingApplications = [],
  competingCollection = null,
  targets = [{
    id: 81,
    amount_cents: 5100,
    source_type: 'scheduling_signup',
    remaining_cents: 5100,
  }],
  taggedNetCents = 5100,
  taggedUnfundedCents = 0,
  conflictingIdempotencyApplication = null,
} = {}) {
  const calls = []
  const applied = []
  let promoted = false
  const db = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] }
      if (text.includes('pg_advisory_xact_lock')) return { rows: [] }
      if (text.includes('FROM billing_charge charge') && text.includes('remaining_cents')) {
        return { rows: targets }
      }
      if (text.includes('SUM(amount_cents)') && text.includes('stripe_checkout_session_id')) {
        return { rows: [{ net_cents: taggedNetCents }] }
      }
      if (text.includes('credit_applied_elsewhere') && text.includes('payment_attempt')) {
        return { rows: competingCollection ? [competingCollection] : [] }
      }
      if (text.includes('FROM billing_refund')) return { rows: refunds }
      if (text.includes('AS tagged_unfunded_cents')) {
        return { rows: [{ tagged_unfunded_cents: taggedUnfundedCents }] }
      }
      if (text.includes('FROM billing_payment_application application')) {
        return { rows: existingApplications }
      }
      if (text.includes('INSERT INTO billing_payment_application')) {
        applied.push({
          paymentId: params[0],
          chargeId: params[1],
          amountCents: params[2],
          idempotencyKey: params[3],
          reason: params[4],
        })
        if (conflictingIdempotencyApplication) return { rows: [] }
        return {
          rows: [{
            billing_payment_id: params[0],
            billing_charge_id: params[1],
            amount_cents: params[2],
            application_kind: 'application',
            reverses_application_id: null,
            idempotency_key: params[3],
            allocation_reason: params[4],
          }],
        }
      }
      if (text.includes('WHERE idempotency_key = $1') && text.includes('FOR UPDATE')) {
        return { rows: conflictingIdempotencyApplication ? [conflictingIdempotencyApplication] : [] }
      }
      if (text.includes('UPDATE billing_payment')) {
        promoted = true
        return {
          rows: [{
            id: 301,
            family_billing_account_id: 8,
            amount_cents: 5100,
            external_processor: 'stripe',
            external_status: 'settled',
            stripe_customer_id: 'cus_exact',
            stripe_payment_intent_id: 'pi_exact_fulfillment',
            stripe_checkout_session_id: 'cs_exact_fulfillment',
            stripe_invoice_id: null,
          }],
        }
      }
      throw new Error(`Unexpected exact Checkout query: ${text}`)
    },
  }
  return {
    db,
    calls,
    applied,
    wasPromoted: () => promoted,
  }
}

const exactCheckoutSession = {
  id: 'cs_exact_fulfillment',
  amount_total: 5100,
  customer: 'cus_exact',
  payment_intent: 'pi_exact_fulfillment',
}
const pendingCheckoutPayment = {
  id: 301,
  family_billing_account_id: 8,
  amount_cents: 5100,
  external_processor: 'stripe',
  external_status: 'reconciliation_required',
  stripe_customer_id: 'cus_exact',
  stripe_payment_intent_id: 'pi_exact_fulfillment',
  stripe_checkout_session_id: 'cs_exact_fulfillment',
  stripe_invoice_id: null,
  note: '[paid-checkout-fulfillment-pending:cs_exact_fulfillment]',
}

test('exact Checkout settlement pays only its stamped purchase before promotion', async () => {
  const fixture = exactCheckoutFixture()
  const settled = await applyAndSettlePaidCheckoutFulfillment(fixture.db, {
    session: exactCheckoutSession,
    accountId: 8,
    payment: pendingCheckoutPayment,
    targetAmountCents: 5100,
    applicationNamespace: 'enrollment-checkout:44',
    allocationReason: 'enrollment_checkout_exact_charge',
  })

  assert.equal(settled.external_status, 'settled')
  assert.deepEqual(fixture.applied, [{
    paymentId: 301,
    chargeId: 81,
    amountCents: 5100,
    idempotencyKey: 'enrollment-checkout:44:charge:81',
    reason: 'enrollment_checkout_exact_charge',
  }])
  assert.equal(fixture.wasPromoted(), true)
  assert.equal(fixture.calls.at(-1).text, 'COMMIT')
})

test('exact Checkout settlement refuses prior unrelated applications', async () => {
  const fixture = exactCheckoutFixture({
    existingApplications: [{
      billing_charge_id: 5,
      stripe_checkout_session_id: null,
      amount_cents: 100,
      application_kind: 'application',
    }],
  })
  await assert.rejects(
    applyAndSettlePaidCheckoutFulfillment(fixture.db, {
      session: exactCheckoutSession,
      accountId: 8,
      payment: pendingCheckoutPayment,
      targetAmountCents: 5100,
      applicationNamespace: 'enrollment-checkout:44',
      allocationReason: 'enrollment_checkout_exact_charge',
    }),
    /already applied outside its permitted exact purchase/i,
  )
  assert.equal(fixture.applied.length, 0)
  assert.equal(fixture.wasPromoted(), false)
  assert.equal(fixture.calls.at(-1).text, 'ROLLBACK')
})

test('exact Checkout settlement rejects a conflicting idempotency-key application tuple', async () => {
  const fixture = exactCheckoutFixture({
    conflictingIdempotencyApplication: {
      billing_payment_id: 999,
      billing_charge_id: 81,
      amount_cents: 5100,
      application_kind: 'application',
      reverses_application_id: null,
      idempotency_key: 'enrollment-checkout:44:charge:81',
      allocation_reason: 'enrollment_checkout_exact_charge',
    },
  })
  await assert.rejects(
    applyAndSettlePaidCheckoutFulfillment(fixture.db, {
      session: exactCheckoutSession,
      accountId: 8,
      payment: pendingCheckoutPayment,
      targetAmountCents: 5100,
      applicationNamespace: 'enrollment-checkout:44',
      allocationReason: 'enrollment_checkout_exact_charge',
    }),
    /conflicting exact application for charge 81/i,
  )
  assert.equal(fixture.wasPromoted(), false)
  assert.equal(fixture.calls.at(-1).text, 'ROLLBACK')
})

test('exact Checkout settlement rejects aggregate-equal applications skewed across two charges', async () => {
  const fixture = exactCheckoutFixture({
    targets: [
      { id: 81, amount_cents: 50, source_type: 'scheduling_signup', remaining_cents: 0 },
      { id: 82, amount_cents: 50, source_type: 'scheduling_signup', remaining_cents: 50 },
    ],
    taggedNetCents: 100,
    taggedUnfundedCents: 50,
    existingApplications: [{
      billing_charge_id: 81,
      stripe_checkout_session_id: 'cs_exact_fulfillment',
      amount_cents: 100,
      application_kind: 'application',
    }],
  })
  await assert.rejects(
    applyAndSettlePaidCheckoutFulfillment(fixture.db, {
      session: { ...exactCheckoutSession, amount_total: 100 },
      accountId: 8,
      payment: { ...pendingCheckoutPayment, amount_cents: 100 },
      targetAmountCents: 100,
      applicationNamespace: 'enrollment-checkout:44',
      allocationReason: 'enrollment_checkout_exact_charge',
    }),
    /50 cents still due on an exact tagged charge/i,
  )
  assert.equal(fixture.applied.length, 0)
  assert.equal(fixture.wasPromoted(), false)
  assert.equal(fixture.calls.at(-1).text, 'ROLLBACK')
})

test('exact Checkout settlement refuses a charge with another live collection owner', async () => {
  const fixture = exactCheckoutFixture({
    competingCollection: { conflict_kind: 'monthly_invoice', billing_charge_id: 81 },
  })
  await assert.rejects(
    applyAndSettlePaidCheckoutFulfillment(fixture.db, {
      session: exactCheckoutSession,
      accountId: 8,
      payment: pendingCheckoutPayment,
      targetAmountCents: 5100,
      applicationNamespace: 'enrollment-checkout:44',
      allocationReason: 'enrollment_checkout_exact_charge',
    }),
    (error) => (
      error?.code === 'PAID_CHECKOUT_COMPETING_COLLECTION'
      && error.conflictKind === 'monthly_invoice'
    ),
  )
  assert.equal(fixture.applied.length, 0)
  assert.equal(fixture.wasPromoted(), false)
  assert.equal(fixture.calls.at(-1).text, 'ROLLBACK')
})

test('exact Checkout settlement stays non-allocatable after any pre-fulfillment refund', async (t) => {
  for (const refund of [
    { id: 1, amount_cents: 100, external_status: 'pending' },
    { id: 2, amount_cents: 5100, external_status: 'succeeded' },
    { id: 3, amount_cents: 5100, external_status: 'reconciliation_required' },
  ]) {
    await t.test(`${refund.external_status} ${refund.amount_cents}`, async () => {
      const fixture = exactCheckoutFixture({ refunds: [refund] })
      await assert.rejects(
        applyAndSettlePaidCheckoutFulfillment(fixture.db, {
          session: exactCheckoutSession,
          accountId: 8,
          payment: pendingCheckoutPayment,
          targetAmountCents: 5100,
          applicationNamespace: 'enrollment-checkout:44',
          allocationReason: 'enrollment_checkout_exact_charge',
        }),
        (error) => (
          error?.code === 'PAID_CHECKOUT_REFUNDED_BEFORE_FULFILLMENT'
          && error.refundedCents === refund.amount_cents
        ),
      )
      assert.equal(fixture.applied.length, 0)
      assert.equal(fixture.wasPromoted(), false)
      assert.equal(fixture.calls.at(-1).text, 'ROLLBACK')
    })
  }
})
