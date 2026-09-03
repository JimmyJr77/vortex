import test from 'node:test'
import assert from 'node:assert/strict'
import {
  invoicePaymentIntentId,
  invoiceSubscriptionId,
  preparePaidStripeInvoiceRecord,
  recordPaidStripeInvoice,
  resolveStripeWebhookAccountId,
  syncStripeSubscriptionStatus,
  upsertPaidStripeInvoicePayment,
} from '../stripeWebhookLifecycle.js'
import { buildMembershipFirstAllocationPlan } from '../paymentAllocation.js'

test('webhook customer ownership rejects one active and one inactive local owner', async () => {
  const pool = {
    async query(sql, params) {
      assert.match(String(sql), /stripe-webhook:customer-owner/)
      assert.deepEqual(params, ['cus_shared'])
      return { rows: [{ id: 44, is_active: true }, { id: 71, is_active: false }] }
    },
  }

  assert.equal(await resolveStripeWebhookAccountId(pool, {
    customer: 'cus_shared',
    metadata: { familyBillingAccountId: '44' },
  }), null)
})

test('webhook customer ownership requires metadata and unique customer owner to agree', async () => {
  const pool = { query: async () => ({ rows: [{ id: 44 }] }) }
  assert.equal(await resolveStripeWebhookAccountId(pool, {
    customer: 'cus_44',
    metadata: { familyBillingAccountId: '45' },
  }), null)
  assert.equal(await resolveStripeWebhookAccountId(pool, {
    customer: 'cus_44',
    metadata: { familyBillingAccountId: '44' },
  }), 44)
})

function legacyOwnershipRow(overrides = {}) {
  return {
    billing_subscription_id: 52,
    family_billing_account_id: 44,
    member_id: 7,
    source_type: 'annual_membership',
    pricing_option_key: 'annual_membership',
    local_status: 'active',
    stripe_customer_id: 'cus_family',
    stripe_customer_owner_count: 1,
    household_monthly_billing_enabled: false,
    migration_state: null,
    claimed_account_id: null,
    ...overrides,
  }
}

test('extracts subscription and payment intent from current invoice shapes', () => {
  const invoice = {
    parent: { subscription_details: { subscription: 'sub_123' } },
    payments: { data: [{ payment: { type: 'payment_intent', payment_intent: 'pi_123' } }] },
  }
  assert.equal(invoiceSubscriptionId(invoice), 'sub_123')
  assert.equal(invoicePaymentIntentId(invoice), 'pi_123')
})

test('records a renewal invoice once with Stripe identifiers', async () => {
  const calls = []
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql: String(sql), params })
      if (String(sql).includes('stripe-subscription:ownership')) {
        return { rows: [legacyOwnershipRow({
          billing_subscription_id: 51,
          source_type: 'scheduling_signup',
          pricing_option_key: null,
        })] }
      }
      if (String(sql).includes('SELECT id FROM family_billing_account')) return { rows: [{ id: 44 }] }
      if (String(sql).includes('INSERT INTO billing_payment')) {
        return { rows: [{
          id: 9,
          family_billing_account_id: 44,
          amount_cents: 15000,
          external_processor: 'stripe',
          external_status: 'settled',
          stripe_invoice_id: 'in_renewal',
          stripe_payment_intent_id: 'pi_renewal',
          stripe_subscription_id: 'sub_renewal',
        }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const payment = await recordPaidStripeInvoice(pool, {
    id: 'in_renewal',
    paid: true,
    status: 'paid',
    amount_paid: 15000,
    currency: 'usd',
    customer: 'cus_family',
    payment_intent: 'pi_renewal',
    parent: { subscription_details: { subscription: 'sub_renewal' } },
    status_transitions: { paid_at: 1_800_000_000 },
  })
  assert.equal(payment.newly_inserted, true)
  const insert = calls.find((call) => call.sql.includes('INSERT INTO billing_payment'))
  assert.deepEqual(insert.params.slice(0, 4), [44, 15000, insert.params[2], 'Card'])
  assert.equal(insert.params[7], 'sub_renewal')
  assert.match(insert.sql, /stripe_subscription_id/)
  assert.match(insert.sql, /ON CONFLICT DO NOTHING/)
})

test('accepts the terminal paid status when the legacy invoice paid flag is stale', async () => {
  const pool = {
    query: async (sql) => {
      if (String(sql).includes('stripe-subscription:ownership')) {
        return { rows: [legacyOwnershipRow({
          billing_subscription_id: 51,
          source_type: 'scheduling_signup',
          pricing_option_key: null,
        })] }
      }
      if (String(sql).includes('SELECT id FROM family_billing_account')) return { rows: [{ id: 44 }] }
      if (String(sql).includes('INSERT INTO billing_payment')) {
        return { rows: [{
          id: 9,
          family_billing_account_id: 44,
          amount_cents: 15000,
          external_processor: 'stripe',
          external_status: 'settled',
          stripe_invoice_id: 'in_paid_status',
          stripe_payment_intent_id: null,
          stripe_subscription_id: 'sub_renewal',
        }] }
      }
      return { rows: [] }
    },
  }

  const payment = await recordPaidStripeInvoice(pool, {
    id: 'in_paid_status',
    paid: false,
    status: 'paid',
    amount_paid: 15000,
    currency: 'usd',
    customer: 'cus_family',
    parent: { subscription_details: { subscription: 'sub_renewal' } },
  })

  assert.equal(payment?.id, 9)
})

test('invoice upsert quarantines split invoice and PaymentIntent ledger rows', async () => {
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('INSERT INTO billing_payment')) return { rows: [] }
      if (text.includes('WHERE stripe_invoice_id')) {
        return { rows: [{
          id: 44,
          family_billing_account_id: 8,
          amount_cents: 25500,
          external_processor: 'stripe',
          external_status: 'settled',
          stripe_invoice_id: 'in_household',
          stripe_payment_intent_id: null,
          stripe_subscription_id: null,
        }] }
      }
      if (text.includes('WHERE stripe_payment_intent_id')) {
        return { rows: [{
          id: 69,
          family_billing_account_id: 8,
          amount_cents: 25500,
          external_processor: 'stripe',
          external_status: 'settled',
          stripe_invoice_id: null,
          stripe_payment_intent_id: 'pi_household',
          stripe_subscription_id: null,
        }] }
      }
      throw new Error(`Unexpected split-payment query: ${text}`)
    },
  }

  await assert.rejects(
    upsertPaidStripeInvoicePayment(pool, {
      accountId: 8,
      amountCents: 25500,
      paidAt: new Date('2026-09-01T04:31:28Z'),
      method: 'Visa ending in 4242',
      invoiceId: 'in_household',
      customerId: 'cus_household',
      paymentIntentId: 'pi_household',
      subscriptionId: null,
    }),
    (error) => error?.reasonCode === 'paid_invoice_split_payment_conflict',
  )
})

test('invoice upsert never mutates a mismatched existing invoice payment', async () => {
  let updateCount = 0
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('INSERT INTO billing_payment')) return { rows: [] }
      if (text.includes('WHERE stripe_invoice_id = $1')) {
        return { rows: [{
          id: 44,
          family_billing_account_id: 999,
          amount_cents: 25500,
          external_processor: 'stripe',
          external_status: 'settled',
          stripe_customer_id: 'cus_other',
          stripe_invoice_id: 'in_household',
          stripe_payment_intent_id: null,
          stripe_subscription_id: null,
        }] }
      }
      if (text.includes('WHERE stripe_payment_intent_id = $1')) return { rows: [] }
      if (text.includes('UPDATE billing_payment')) {
        updateCount += 1
        return { rows: [] }
      }
      throw new Error(`Unexpected mismatch query: ${text}`)
    },
  }

  await assert.rejects(
    upsertPaidStripeInvoicePayment(pool, {
      accountId: 8,
      amountCents: 25500,
      paidAt: new Date('2026-09-01T04:31:28Z'),
      method: 'Visa ending in 4242',
      invoiceId: 'in_household',
      customerId: 'cus_household',
      paymentIntentId: 'pi_household',
      subscriptionId: null,
    }),
    (error) => error?.reasonCode === 'paid_invoice_payment_binding_conflict',
  )
  assert.equal(updateCount, 0)
})

test('invoice upsert never reuses quarantined, canceled, refunded, or non-Stripe payment rows', async () => {
  const invalidStates = [
    { external_processor: 'stripe', external_status: 'reconciliation_required' },
    { external_processor: 'stripe', external_status: 'canceled' },
    { external_processor: 'stripe', external_status: 'refunded' },
    { external_processor: 'manual', external_status: 'settled' },
  ]

  for (const invalidState of invalidStates) {
    let updateCount = 0
    const existing = {
      id: 44,
      family_billing_account_id: 8,
      amount_cents: 25500,
      stripe_customer_id: 'cus_household',
      stripe_invoice_id: 'in_household',
      stripe_payment_intent_id: 'pi_household',
      stripe_subscription_id: null,
      ...invalidState,
    }
    const pool = {
      async query(sql) {
        const text = String(sql)
        if (text.includes('INSERT INTO billing_payment')) return { rows: [] }
        if (text.includes('WHERE stripe_invoice_id = $1')) return { rows: [existing] }
        if (text.includes('WHERE stripe_payment_intent_id = $1')) return { rows: [existing] }
        if (text.includes('UPDATE billing_payment')) {
          updateCount += 1
          return { rows: [] }
        }
        throw new Error(`Unexpected invalid-state query: ${text}`)
      },
    }

    await assert.rejects(
      upsertPaidStripeInvoicePayment(pool, {
        accountId: 8,
        amountCents: 25500,
        paidAt: new Date('2026-09-01T04:31:28Z'),
        method: 'Visa ending in 4242',
        invoiceId: 'in_household',
        customerId: 'cus_household',
        paymentIntentId: 'pi_household',
        subscriptionId: null,
      }),
      (error) => (
        error?.reasonCode === 'paid_invoice_payment_state_conflict'
        && error.details.externalProcessor === invalidState.external_processor
        && error.details.externalStatus === invalidState.external_status
      ),
      `${invalidState.external_processor}:${invalidState.external_status}`,
    )
    assert.equal(updateCount, 0)
  }
})

test('annual fulfillment-pending replay backfills a newly discovered PaymentIntent without promotion', async () => {
  const pendingMarker = '[annual-invoice-fulfillment-pending:in_annual_pending]'
  const existing = {
    id: 44,
    family_billing_account_id: 8,
    amount_cents: 6800,
    external_processor: 'stripe',
    external_status: 'reconciliation_required',
    note: `Stripe invoice payment\n${pendingMarker}`,
    stripe_customer_id: 'cus_household',
    stripe_invoice_id: 'in_annual_pending',
    stripe_payment_intent_id: null,
    stripe_subscription_id: 'sub_annual_pending',
  }
  let backfill = null
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('INSERT INTO billing_payment')) return { rows: [] }
      if (text.includes('WHERE stripe_invoice_id = $1')) return { rows: [existing] }
      if (text.includes('WHERE stripe_payment_intent_id = $1')) return { rows: [] }
      if (text.includes('UPDATE billing_payment')) {
        backfill = { text, params }
        assert.match(text, /external_status = 'reconciliation_required'/)
        assert.match(text, /position\(\$9 in COALESCE\(note, ''\)\) = 0/)
        assert.equal(params[7], pendingMarker)
        assert.equal(params[8], '[annual-invoice-refund-required:in_annual_pending]')
        return { rows: [{
          ...existing,
          stripe_payment_intent_id: 'pi_annual_pending',
        }] }
      }
      throw new Error(`Unexpected annual pending backfill query: ${text}`)
    },
  }

  const payment = await upsertPaidStripeInvoicePayment(pool, {
    accountId: 8,
    amountCents: 6800,
    paidAt: new Date('2026-09-01T04:31:28Z'),
    method: 'Visa ending in 4242',
    invoiceId: 'in_annual_pending',
    customerId: 'cus_household',
    paymentIntentId: 'pi_annual_pending',
    subscriptionId: 'sub_annual_pending',
    annualBinding: { memberId: 7 },
  })

  assert.ok(backfill)
  assert.equal(payment.stripe_payment_intent_id, 'pi_annual_pending')
  assert.equal(payment.external_status, 'reconciliation_required')
  assert.match(payment.note, /annual-invoice-fulfillment-pending/)
})

test('replayed invoice webhook returns its existing payment for idempotent line allocation', async () => {
  const pool = {
    query: async (sql) => {
      if (String(sql).includes('SELECT id FROM family_billing_account')) return { rows: [{ id: 44 }] }
      if (String(sql).includes('INSERT INTO billing_payment')) return { rows: [], rowCount: 0 }
      if (String(sql).includes('SELECT * FROM billing_payment WHERE stripe_invoice_id')) {
        return { rows: [{
          id: 9,
          family_billing_account_id: 44,
          amount_cents: 15000,
          external_processor: 'stripe',
          external_status: 'settled',
          stripe_invoice_id: 'in_renewal',
          stripe_payment_intent_id: 'pi_renewal',
        }] }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const payment = await recordPaidStripeInvoice(pool, {
    id: 'in_renewal', paid: true, status: 'paid', amount_paid: 15000,
    currency: 'usd',
    customer: 'cus_family', payment_intent: 'pi_renewal',
  })
  assert.equal(payment.id, 9)
  assert.equal(payment.newly_inserted, false)
})

test('invoice recovery safely restores ownership on a matching legacy generic PaymentIntent row', async () => {
  const generic = {
    id: 9,
    family_billing_account_id: 44,
    amount_cents: 15000,
    external_processor: 'stripe',
    external_status: 'succeeded',
    stripe_payment_intent_id: 'pi_renewal',
    stripe_invoice_id: null,
    stripe_subscription_id: null,
  }
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock')) return { rows: [{ pg_advisory_lock: null }] }
      if (text.includes('pg_advisory_unlock')) return { rows: [{ pg_advisory_unlock: true }] }
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] }
      if (text.includes('SELECT id FROM family_billing_account')) return { rows: [{ id: 44 }] }
      if (text.includes('INSERT INTO billing_payment')) return { rows: [] }
      if (text.includes('WHERE stripe_invoice_id = $1')) return { rows: [] }
      if (text.includes('WHERE stripe_payment_intent_id = $1')) return { rows: [generic] }
      if (text.includes('UPDATE billing_payment')) {
        assert.deepEqual(params.slice(0, 3), [9, 'in_renewal', null])
        return { rows: [{ ...generic, stripe_invoice_id: 'in_renewal' }] }
      }
      throw new Error(`Unexpected legacy invoice recovery query: ${text}`)
    },
  }
  const payment = await recordPaidStripeInvoice(pool, {
    id: 'in_renewal', paid: true, status: 'paid', amount_paid: 15000,
    currency: 'usd',
    customer: 'cus_family', payment_intent: 'pi_renewal',
  })
  assert.equal(payment.id, 9)
  assert.equal(payment.stripe_invoice_id, 'in_renewal')
  assert.equal(payment.newly_inserted, false)
})

test('missed annual invoice recovery reconstructs charge and promo exactly once on replay', async () => {
  let payment = null
  let charge = null
  let exactApplication = null
  let promoRecorded = false
  let promoLoadCalls = 0
  const calls = []
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('pg_advisory_lock')) return { rows: [{ pg_advisory_lock: null }] }
      if (text.includes('pg_advisory_unlock')) return { rows: [{ pg_advisory_unlock: true }] }
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] }
      if (text.includes('stripe-subscription:ownership')) return { rows: [legacyOwnershipRow()] }
      if (text.includes('FROM billing_subscription') && text.includes('ORDER BY id') && text.includes('LIMIT 3')) {
        return { rows: [{
          id: 52,
          family_billing_account_id: 44,
          member_id: 7,
          source_type: 'annual_membership',
          source_id: '42:7',
          description: 'Annual Membership',
          stripe_subscription_id: 'sub_annual',
          pricing_option_key: 'annual_membership',
        }] }
      }
      if (text.includes('FROM family_billing_account') && text.includes('ORDER BY id')) {
        return { rows: [{ id: 44 }] }
      }
      if (text.includes('FROM billing_subscription') && text.includes('FOR SHARE')) {
        return { rows: [{ id: 52 }] }
      }
      if (text.includes('INSERT INTO billing_payment') && !text.includes('INSERT INTO billing_payment_application')) {
        if (payment) return { rows: [] }
        payment = {
          id: 9,
          family_billing_account_id: 44,
          amount_cents: 6800,
          external_processor: 'stripe',
          external_status: 'settled',
          stripe_invoice_id: 'in_annual_2026',
          stripe_payment_intent_id: 'pi_annual_2026',
          stripe_subscription_id: 'sub_annual',
        }
        return { rows: [payment] }
      }
      if (text.includes('SELECT * FROM billing_payment WHERE stripe_invoice_id')) return { rows: payment ? [payment] : [] }
      if (text.includes('SELECT * FROM billing_payment WHERE stripe_payment_intent_id')) return { rows: payment ? [payment] : [] }
      if (text.includes('UPDATE billing_payment') && text.includes('NULLIF(BTRIM(REPLACE')) {
        payment.external_status = 'settled'
        payment.note = 'Stripe invoice payment'
        return { rows: [{ ...payment }] }
      }
      if (text.includes('UPDATE billing_payment') && text.includes("SET external_status = 'reconciliation_required'")) {
        payment.external_status = 'reconciliation_required'
        payment.note = params[7]
        return { rows: [{ ...payment }] }
      }
      if (text.includes('SELECT id FROM billing_payment') && text.includes('FOR UPDATE')) return { rows: [{ id: 9 }] }
      if (text.includes('INSERT INTO billing_charge')) {
        if (charge) return { rows: [] }
        charge = {
          id: 72,
          family_billing_account_id: 44,
          member_id: 7,
          source_type: 'additional_fee',
          source_id: '42:7:2027-08-28',
          amount_cents: 6800,
          collection_status: 'unpaid',
          metadata: { stripeInvoiceId: 'in_annual_2026', stripeSubscriptionId: 'sub_annual' },
        }
        return { rows: [charge] }
      }
      if (text.includes('SELECT *') && text.includes("source_type = 'additional_fee'")) return { rows: charge ? [charge] : [] }
      if (text.includes('SUM(amount_cents)') && text.includes("source_type = 'charge_adjustment'")) {
        return { rows: [{ cents: 0 }] }
      }
      if (text.includes('FROM billing_refund')) return { rows: [{ cents: 0 }] }
      if (text.includes('FROM billing_payment_application application') && text.includes('charge_account_id')) {
        return { rows: exactApplication ? [{ ...exactApplication, charge_account_id: 44, reversed_cents: 0 }] : [] }
      }
      if (text.includes('INSERT INTO billing_payment_application') && text.includes("'exact_annual_invoice'")) {
        if (exactApplication) return { rows: [] }
        exactApplication = {
          id: 91,
          billing_payment_id: 9,
          billing_charge_id: 72,
          amount_cents: 6800,
          application_kind: 'application',
          idempotency_key: 'annual-invoice:in_annual_2026:payment:9:charge:72',
          allocation_reason: 'exact_annual_invoice',
        }
        return { rows: [exactApplication] }
      }
      if (text.includes('UPDATE billing_charge candidate')) return { rows: [], rowCount: 1 }
      if (text.includes('SELECT pricing.*, account.family_id')) {
        promoLoadCalls += 1
        if (promoLoadCalls % 2 === 0) return { rows: [] }
        return { rows: [{
          id: 71,
          family_billing_account_id: 44,
          family_id: 22,
          member_id: 7,
          additional_fee_id: 42,
          facility_id: 4,
          standard_amount_cents: 8500,
          discount_rule_id: 62,
          promo_code: 'RENEW20',
          pricing_kind: 'promo_code',
          billing_subscription_id: 52,
        }] }
      }
      if (text.startsWith('WITH inserted AS (') && text.includes('INSERT INTO discount_redemption')) {
        if (promoRecorded) return { rows: [] }
        promoRecorded = true
        return { rows: [{ id: 82 }] }
      }
      if (text.includes('INSERT INTO billing_account_activity')) return { rows: [{ id: 1 }] }
      throw new Error(`Unexpected annual recovery query: ${text}`)
    },
  }
  const invoice = {
    id: 'in_annual_2026',
    paid: true,
    status: 'paid',
    amount_paid: 6800,
    currency: 'usd',
    customer: 'cus_family',
    payment_intent: 'pi_annual_2026',
    parent: { subscription_details: { subscription: 'sub_annual' } },
    metadata: {
      annualMembership: 'true',
      familyBillingAccountId: '44',
      memberId: '7',
    },
    lines: {
      data: [{ period: { end: 1_819_411_200 } }],
      has_more: false,
    },
    status_transitions: { paid_at: 1_787_894_400 },
  }

  const first = await recordPaidStripeInvoice(pool, invoice)
  assert.equal(first.id, 9)
  assert.equal(first.newly_inserted, true)
  assert.equal(first.external_status, 'settled')
  assert.equal(first.fulfillment_pending, false)
  const replay = await recordPaidStripeInvoice(pool, invoice)
  assert.equal(replay.id, 9)
  assert.equal(replay.newly_inserted, false)
  assert.equal(Boolean(charge), true)
  assert.equal(Boolean(exactApplication), true)
  assert.equal(promoRecorded, true)
  assert.equal(calls.filter(({ text }) => (
    text.includes('INSERT INTO billing_payment') && !text.includes('INSERT INTO billing_payment_application')
  )).length, 2)
  assert.equal(calls.filter(({ text }) => text.includes('INSERT INTO billing_charge')).length, 2)
  assert.equal(calls.filter(({ text }) => text.includes("'exact_annual_invoice'")).length, 1)
  assert.equal(calls.filter(({ text }) => text.includes("'annual_invoice_reconstruction'")).length, 0)
  assert.equal(calls.filter(({ text }) => text.startsWith('WITH inserted AS (')).length, 2)
  assert.equal(calls.some(({ text }) => /^UPDATE discount_rule/.test(text)), false)
})

function annualRecoveryFixture({
  applications = [],
  annualNextBillDate = '2027-08-28',
  transientBindingFailures = 0,
} = {}) {
  const calls = []
  const commitSnapshots = []
  const alerts = new Set()
  let remainingBindingFailures = transientBindingFailures
  const payment = {
    id: 9,
    family_billing_account_id: 44,
    amount_cents: 6800,
    external_processor: 'stripe',
    external_status: 'succeeded',
    stripe_payment_intent_id: 'pi_annual_repair',
    stripe_invoice_id: null,
    stripe_subscription_id: null,
  }
  const charge = {
    id: 72,
    family_billing_account_id: 44,
    member_id: 7,
    source_type: 'additional_fee',
    source_id: '42:7:2027-08-28',
    amount_cents: 6800,
    collection_status: 'unpaid',
    metadata: { stripeInvoiceId: 'in_annual_repair', stripeSubscriptionId: 'sub_annual' },
  }
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('pg_advisory_lock')) return { rows: [{ pg_advisory_lock: null }] }
      if (text.includes('pg_advisory_unlock')) return { rows: [{ pg_advisory_unlock: true }] }
      if (text === 'COMMIT') {
        commitSnapshots.push({ ...payment })
        return { rows: [] }
      }
      if (text === 'BEGIN' || text === 'ROLLBACK') return { rows: [] }
      if (text.includes('stripe-subscription:ownership')) return { rows: [legacyOwnershipRow()] }
      if (text.includes('FROM billing_subscription') && text.includes('ORDER BY id') && text.includes('LIMIT 3')) {
        return { rows: [{
          id: 52,
          family_billing_account_id: 44,
          member_id: 7,
          source_type: 'annual_membership',
          source_id: '42:7',
          description: 'Annual Membership',
          stripe_subscription_id: 'sub_annual',
          pricing_option_key: 'annual_membership',
          next_bill_date: annualNextBillDate,
        }] }
      }
      if (text.includes('FROM family_billing_account') && text.includes('ORDER BY id')) return { rows: [{ id: 44 }] }
      if (text.includes('FROM billing_subscription') && text.includes('FOR SHARE')) {
        if (remainingBindingFailures > 0) {
          remainingBindingFailures -= 1
          throw new Error('simulated annual entitlement database outage')
        }
        return { rows: [{ id: 52 }] }
      }
      if (text.includes('INSERT INTO billing_payment') && !text.includes('INSERT INTO billing_payment_application')) return { rows: [] }
      if (text.includes('WHERE stripe_invoice_id = $1')) {
        return { rows: payment.stripe_invoice_id === params[0] ? [payment] : [] }
      }
      if (text.includes('WHERE stripe_payment_intent_id = $1')) return { rows: [payment] }
      if (text.includes('UPDATE billing_payment')) {
        if (text.includes('NULLIF(BTRIM(REPLACE')) {
          payment.external_status = 'settled'
          payment.note = 'Stripe invoice payment'
          return { rows: [{ ...payment }] }
        }
        if (text.includes("SET external_status = 'reconciliation_required'")) {
          payment.external_status = 'reconciliation_required'
          payment.note = text.includes("WHEN COALESCE(note, '') = '' THEN $8")
            ? params[7]
            : params[8]
          return { rows: [{ ...payment }] }
        }
        Object.assign(payment, {
          stripe_invoice_id: 'in_annual_repair',
          stripe_subscription_id: 'sub_annual',
          stripe_customer_id: 'cus_family',
          external_status: 'settled',
        })
        return { rows: [{ ...payment }] }
      }
      if (text.includes('INSERT INTO billing_charge')) return { rows: [charge] }
      if (text.includes('SUM(amount_cents)') && text.includes("source_type = 'charge_adjustment'")) return { rows: [{ cents: 0 }] }
      if (text.includes('SELECT id FROM billing_payment') && text.includes('FOR UPDATE')) return { rows: [{ id: 9 }] }
      if (text.includes('FROM billing_refund')) return { rows: [{ cents: 0 }] }
      if (text.includes('FROM billing_payment_application application') && text.includes('charge_account_id')) {
        return { rows: applications.map((application) => ({
          ...application,
          charge_account_id: 44,
          reversed_cents: 0,
        })) }
      }
      if (text.includes('INSERT INTO billing_payment_application') && text.includes("'annual_invoice_reconstruction'")) {
        return { rows: [{ id: 101 }] }
      }
      if (text.includes('INSERT INTO billing_payment_application') && text.includes("'exact_annual_invoice'")) {
        return { rows: [{ id: 102 }] }
      }
      if (text.includes('UPDATE billing_charge candidate')) return { rows: [], rowCount: 2 }
      if (text.includes('SELECT pricing.*, account.family_id')) return { rows: [] }
      if (text.includes('INSERT INTO stripe_billing_alert')) {
        alerts.add(params[0])
        return { rows: [] }
      }
      throw new Error(`Unexpected locked annual recovery query: ${text}`)
    },
  }
  return { pool, calls, payment, alerts, commitSnapshots }
}

function annualRepairInvoice(overrides = {}) {
  return {
    id: 'in_annual_repair',
    paid: true,
    status: 'paid',
    amount_paid: 6800,
    currency: 'usd',
    customer: 'cus_family',
    payment_intent: 'pi_annual_repair',
    metadata: {
      annualMembership: 'true',
      familyBillingAccountId: '44',
      memberId: '7',
    },
    parent: { subscription_details: { subscription: 'sub_annual' } },
    lines: {
      data: [{ period: { end: 1_819_411_200 } }],
      has_more: false,
    },
    status_transitions: { paid_at: 1_787_894_400 },
    ...overrides,
  }
}

function verifiedPaidAnnualOwnership(overrides = {}) {
  return {
    expectedLegacy: true,
    paidSettlementVerified: true,
    accountId: 44,
    billingSubscriptionId: 52,
    memberId: 7,
    sourceType: 'annual_membership',
    sourceId: '42:7',
    pricingOptionKey: 'annual_membership',
    stripeCustomerId: 'cus_family',
    ownershipSource: 'current_link',
    subscription: {
      id: 'sub_annual',
      customer: 'cus_family',
      metadata: {
        familyBillingAccountId: '44',
        memberId: '7',
        annualMembership: 'true',
      },
    },
    ...overrides,
  }
}

test('paid annual settlement uses the exact proven subscription row instead of mutable customer ownership', async () => {
  const calls = []
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('FROM billing_subscription') && text.includes('ORDER BY id')) {
        assert.deepEqual(params, ['sub_annual', 52])
        return { rows: [{
          id: 52,
          family_billing_account_id: 44,
          member_id: 7,
          source_type: 'annual_membership',
          source_id: '42:7',
          description: 'Annual Membership',
          stripe_subscription_id: 'sub_annual',
          pricing_option_key: 'annual_membership',
        }] }
      }
      throw new Error(`Unexpected proven annual binding query: ${text}`)
    },
  }

  const prepared = await preparePaidStripeInvoiceRecord(pool, annualRepairInvoice(), {
    expectedLegacySubscriptionOwnership: verifiedPaidAnnualOwnership(),
  })

  assert.equal(prepared.accountId, 44)
  assert.equal(prepared.annualBinding.annualSubscription.id, 52)
  assert.equal(prepared.subscriptionOwnership.paidSettlementVerified, true)
  assert.equal(
    calls.some(({ text }) => text.includes('FROM family_billing_account')),
    false,
  )
})

test('annual invoice repair reverses only a provable legacy general allocation and exact-applies atomically', async () => {
  const { pool, calls } = annualRecoveryFixture({
    applications: [{
      id: 81,
      billing_payment_id: 9,
      billing_charge_id: 88,
      amount_cents: 6800,
      idempotency_key: 'allocation:9:88',
      allocation_reason: 'oldest_charge',
    }],
  })

  const payment = await recordPaidStripeInvoice(pool, annualRepairInvoice())
  assert.equal(payment.id, 9)
  assert.equal(payment.stripe_invoice_id, 'in_annual_repair')
  const begin = calls.findIndex(({ text }) => text === 'BEGIN')
  const reverse = calls.findIndex(({ text }) => text.includes("'annual_invoice_reconstruction'"))
  const exact = calls.findIndex(({ text }) => text.includes("'exact_annual_invoice'"))
  const begins = calls.map(({ text }, index) => text === 'BEGIN' ? index : -1).filter((index) => index >= 0)
  const commits = calls.map(({ text }, index) => text === 'COMMIT' ? index : -1).filter((index) => index >= 0)
  assert.ok(begin >= 0 && commits[0] > begin && begins[1] > commits[0])
  assert.ok(reverse > begins[1] && exact > reverse && commits[1] > exact)
  assert.deepEqual(calls[reverse].params, [9, 88, 6800, 81, 'annual-invoice-repair:in_annual_repair:reverse:81'])
  assert.deepEqual(calls[exact].params, [9, 72, 6800, 'annual-invoice:in_annual_repair:payment:9:charge:72'])
})

test('annual transient failure keeps cash fulfillment-pending and unallocatable until exact replay settles it', async () => {
  const {
    pool,
    calls,
    payment,
    alerts,
    commitSnapshots,
  } = annualRecoveryFixture({ transientBindingFailures: 1 })
  const invoice = annualRepairInvoice()

  await assert.rejects(
    recordPaidStripeInvoice(pool, invoice),
    /simulated annual entitlement database outage/,
  )

  assert.equal(payment.external_status, 'reconciliation_required')
  assert.match(payment.note, /\[annual-invoice-fulfillment-pending:in_annual_repair\]/)
  assert.doesNotMatch(payment.note, /annual-invoice-refund-required/)
  assert.deepEqual(
    commitSnapshots.map((snapshot) => snapshot.external_status),
    ['reconciliation_required'],
  )
  assert.deepEqual(buildMembershipFirstAllocationPlan({
    payments: [{
      id: payment.id,
      amountCents: payment.amount_cents,
      paidAt: new Date('2026-08-28T00:00:00.000Z'),
      status: payment.external_status,
    }],
    charges: [{
      id: 999,
      amountCents: payment.amount_cents,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
    }],
  }), [])
  assert.equal(alerts.size, 0)

  const replay = await recordPaidStripeInvoice(pool, invoice)

  assert.equal(replay.id, payment.id)
  assert.equal(replay.external_status, 'settled')
  assert.equal(replay.fulfillment_pending, false)
  assert.doesNotMatch(String(replay.note ?? ''), /annual-invoice-fulfillment-pending/)
  assert.deepEqual(
    commitSnapshots.map((snapshot) => snapshot.external_status),
    ['reconciliation_required', 'reconciliation_required', 'settled'],
  )
  assert.equal(calls.filter(({ text }) => text === 'ROLLBACK').length, 1)
  assert.equal(calls.filter(({ text }) => text.includes("'exact_annual_invoice'")).length, 1)
  assert.equal(alerts.size, 0)
})

test('delayed annual invoice keeps its immutable old period when current schedules have advanced', async () => {
  const { pool, calls } = annualRecoveryFixture({
    annualNextBillDate: '2029-08-28',
  })
  const advancedOwnership = verifiedPaidAnnualOwnership({
    subscription: {
      ...verifiedPaidAnnualOwnership().subscription,
      current_period_end: 1_882_569_600,
    },
  })

  const payment = await recordPaidStripeInvoice(pool, annualRepairInvoice(), {
    expectedLegacySubscriptionOwnership: advancedOwnership,
  })

  assert.equal(payment.external_status, 'settled')
  const chargeInsert = calls.find(({ text }) => text.includes('INSERT INTO billing_charge'))
  assert.equal(chargeInsert.params[2], '42:7:2027-08-28')
  assert.notEqual(chargeInsert.params[2], '42:7:2029-08-28')
})

test('annual invoice without an immutable invoice period never borrows the advanced current schedule', async () => {
  const { pool, calls, alerts } = annualRecoveryFixture({
    annualNextBillDate: '2029-08-28',
  })
  const advancedOwnership = verifiedPaidAnnualOwnership({
    subscription: {
      ...verifiedPaidAnnualOwnership().subscription,
      current_period_end: 1_882_569_600,
    },
  })

  const payment = await recordPaidStripeInvoice(pool, annualRepairInvoice({
    lines: { data: [], has_more: false },
  }), {
    expectedLegacySubscriptionOwnership: advancedOwnership,
  })

  assert.equal(payment.external_status, 'reconciliation_required')
  assert.equal(payment.refund_required, true)
  assert.equal(payment.reconciliation_code, 'annual_invoice_period_missing')
  assert.equal(calls.some(({ text }) => text.includes('INSERT INTO billing_charge')), false)
  assert.equal(alerts.size, 1)
})

test('annual entitlement conflict preserves one exact payment as refund-required and alerts once', async () => {
  const { pool, calls, alerts } = annualRecoveryFixture({
    applications: [{
      id: 81,
      billing_payment_id: 9,
      billing_charge_id: 88,
      amount_cents: 6800,
      idempotency_key: 'exact:9:88',
      allocation_reason: 'exact_custom_charge',
    }],
  })

  const first = await recordPaidStripeInvoice(pool, annualRepairInvoice())
  const replay = await recordPaidStripeInvoice(pool, annualRepairInvoice())
  assert.equal(first.id, 9)
  assert.equal(first.external_status, 'reconciliation_required')
  assert.equal(first.refund_required, true)
  assert.equal(first.reconciliation_code, 'annual_invoice_allocation_ambiguous')
  assert.equal(replay.id, first.id)
  assert.equal(replay.refund_required, true)
  assert.ok(calls.some(({ text }) => text === 'ROLLBACK'))
  assert.ok(calls.some(({ text }) => text.includes("external_status = 'reconciliation_required'")))
  assert.equal(calls.some(({ text }) => text.includes("'annual_invoice_reconstruction'")), false)
  assert.equal(calls.some(({ text }) => text.includes("'exact_annual_invoice'")), false)
  assert.equal(alerts.size, 1)
  const alert = calls.find(({ text }) => text.includes('INSERT INTO stripe_billing_alert'))
  assert.equal(alert.params[1], 44)
  assert.equal(alert.params[2], 'annual_invoice_refund_required')
  assert.equal(alert.params[3], 'critical')
})

test('a second paid annual invoice for the same renewal period records cash but grants no second entitlement', async () => {
  const calls = []
  const alerts = new Set()
  let payment = null
  let paymentCreates = 0
  let chargeInsertAttempts = 0
  const existingCharge = {
    id: 72,
    family_billing_account_id: 44,
    member_id: 7,
    source_type: 'additional_fee',
    source_id: '42:7:2027-08-28',
    amount_cents: 6800,
    collection_status: 'paid',
    metadata: { stripeInvoiceId: 'in_annual_first', stripeSubscriptionId: 'sub_annual' },
  }
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('pg_advisory_lock')) return { rows: [{ pg_advisory_lock: null }] }
      if (text.includes('pg_advisory_unlock')) return { rows: [{ pg_advisory_unlock: true }] }
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] }
      if (text.includes('FROM billing_subscription') && text.includes('ORDER BY id')) {
        return { rows: [{
          id: 52,
          family_billing_account_id: 44,
          member_id: 7,
          source_type: 'annual_membership',
          source_id: '42:7',
          description: 'Annual Membership',
          stripe_subscription_id: 'sub_annual',
          pricing_option_key: 'annual_membership',
        }] }
      }
      if (text.includes('FROM billing_subscription') && text.includes('FOR SHARE')) {
        return { rows: [{ id: 52 }] }
      }
      if (text.includes('INSERT INTO billing_payment') && !text.includes('INSERT INTO billing_payment_application')) {
        if (payment) return { rows: [] }
        paymentCreates += 1
        payment = {
          id: 10,
          family_billing_account_id: Number(params[0]),
          amount_cents: Number(params[1]),
          external_processor: 'stripe',
          external_status: 'settled',
          stripe_invoice_id: params[4],
          stripe_customer_id: params[5],
          stripe_payment_intent_id: params[6],
          stripe_subscription_id: params[7],
          note: 'Stripe invoice payment',
        }
        return { rows: [payment] }
      }
      if (text.includes('SELECT * FROM billing_payment WHERE stripe_invoice_id')) {
        return { rows: payment && payment.stripe_invoice_id === params[0] ? [payment] : [] }
      }
      if (text.includes('SELECT * FROM billing_payment WHERE stripe_payment_intent_id')) {
        return { rows: payment && payment.stripe_payment_intent_id === params[0] ? [payment] : [] }
      }
      if (text.includes('INSERT INTO billing_charge')) {
        chargeInsertAttempts += 1
        return { rows: [] }
      }
      if (text.includes('SELECT *') && text.includes("source_type = 'additional_fee'")) {
        return { rows: [existingCharge] }
      }
      if (text.includes('NULLIF(BTRIM(REPLACE')) {
        payment.external_status = 'settled'
        payment.note = 'Stripe invoice payment'
        return { rows: [{ ...payment }] }
      }
      if (text.includes("SET external_status = 'reconciliation_required'")) {
        payment.external_status = 'reconciliation_required'
        payment.note = text.includes("WHEN COALESCE(note, '') = '' THEN $8")
          ? params[7]
          : params[8]
        return { rows: [{ ...payment }] }
      }
      if (text.includes('INSERT INTO stripe_billing_alert')) {
        alerts.add(params[0])
        return { rows: [] }
      }
      throw new Error(`Unexpected duplicate annual renewal query: ${text}`)
    },
  }
  const invoice = annualRepairInvoice({
    id: 'in_annual_second',
    payment_intent: 'pi_annual_second',
    status_transitions: { paid_at: 1_787_980_800 },
  })
  const options = { expectedLegacySubscriptionOwnership: verifiedPaidAnnualOwnership() }

  const first = await recordPaidStripeInvoice(pool, invoice, options)
  const replay = await recordPaidStripeInvoice(pool, invoice, options)

  assert.equal(first.id, 10)
  assert.equal(first.external_status, 'reconciliation_required')
  assert.equal(first.refund_required, true)
  assert.equal(first.reconciliation_code, 'annual_invoice_charge_binding_conflict')
  assert.equal(replay.id, first.id)
  assert.equal(replay.refund_required, true)
  assert.equal(paymentCreates, 1)
  assert.equal(chargeInsertAttempts, 1)
  assert.equal(
    calls.some(({ text }) => text.includes('INSERT INTO billing_payment_application')),
    false,
  )
  assert.equal(alerts.size, 1)
})

test('annual invoice binding quarantines missing, ambiguous, and conflicting provenance before ledger writes', async () => {
  const cases = [
    {
      name: 'missing local subscription',
      annualRows: [],
      customerRows: [{ id: 44 }],
      reasonCode: 'stripe_subscription_owner_missing',
    },
    {
      name: 'multiple local subscriptions',
      annualRows: [
        { id: 51, family_billing_account_id: 44, member_id: 7, source_id: '42:7' },
        { id: 52, family_billing_account_id: 44, member_id: 7, source_id: '42:7' },
      ],
      customerRows: [{ id: 44 }],
      reasonCode: 'annual_invoice_subscription_ambiguous',
    },
    {
      name: 'missing customer owner',
      annualRows: [{ id: 52, family_billing_account_id: 44, member_id: 7, source_id: '42:7' }],
      customerRows: [],
      reasonCode: 'annual_invoice_customer_owner_missing',
    },
    {
      name: 'multiple customer owners',
      annualRows: [{ id: 52, family_billing_account_id: 44, member_id: 7, source_id: '42:7' }],
      customerRows: [{ id: 44 }, { id: 45 }],
      reasonCode: 'annual_invoice_customer_owner_ambiguous',
    },
    {
      name: 'account conflict',
      annualRows: [{ id: 52, family_billing_account_id: 44, member_id: 7, source_id: '42:7' }],
      customerRows: [{ id: 45 }],
      reasonCode: 'annual_invoice_account_binding_conflict',
    },
  ]

  for (const fixture of cases) {
    const calls = []
    const pool = {
      async query(sql) {
        const text = String(sql)
        calls.push(text)
        if (text.includes('stripe-subscription:ownership')) {
          return { rows: fixture.annualRows.length > 0 ? [legacyOwnershipRow()] : [] }
        }
        if (text.includes('FROM billing_subscription')) return { rows: fixture.annualRows }
        if (text.includes('FROM family_billing_account')) return { rows: fixture.customerRows }
        throw new Error(`Unexpected ${fixture.name} query: ${text}`)
      },
    }
    await assert.rejects(
      recordPaidStripeInvoice(pool, annualRepairInvoice()),
      (error) => error?.code === 'stripe_invoice_quarantined'
        && error?.reasonCode === fixture.reasonCode,
      fixture.name,
    )
    assert.equal(calls.some((text) => text.includes('INSERT INTO billing_payment')), false, fixture.name)
  }
})

test('subscription deletion cancels matching local subscriptions', async () => {
  const calls = []
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql: String(sql), params })
      if (String(sql).includes('stripe-subscription:ownership')) {
        return { rows: [legacyOwnershipRow({
          billing_subscription_id: 51,
          source_type: 'scheduling_signup',
          pricing_option_key: null,
        })] }
      }
      return { rows: [], rowCount: String(sql).includes('UPDATE billing_subscription') ? 2 : 0 }
    },
  }
  const result = await syncStripeSubscriptionStatus(
    pool,
    { id: 'sub_ended', customer: 'cus_family', status: 'canceled', ended_at: 1_800_000_000 },
    'customer.subscription.deleted',
  )
  assert.deepEqual(result, { updated: 2, status: 'cancelled' })
  const update = calls.find((call) => call.sql.includes('auto_renewal = $4'))
  assert.ok(update)
  assert.equal(update.params[3], false)
})

test('scheduled cancellation disables renewal without ending paid-through access', async () => {
  const calls = []
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql: String(sql), params })
      if (String(sql).includes('stripe-subscription:ownership')) {
        return { rows: [legacyOwnershipRow({
          billing_subscription_id: 51,
          source_type: 'scheduling_signup',
          pricing_option_key: null,
        })] }
      }
      return { rows: [], rowCount: String(sql).includes('UPDATE billing_subscription') ? 1 : 0 }
    },
  }
  const result = await syncStripeSubscriptionStatus(
    pool,
    {
      id: 'sub_ending_later',
      customer: 'cus_family',
      status: 'active',
      cancel_at_period_end: true,
      cancel_at: 1_830_297_600,
      current_period_end: 1_830_297_600,
    },
    'customer.subscription.updated',
  )

  assert.deepEqual(result, { updated: 1, status: 'active' })
  const update = calls.find((call) => call.sql.includes('UPDATE billing_subscription'))
  assert.match(update.sql, /auto_renewal = \$4/)
  assert.deepEqual(update.params, [
    'sub_ending_later',
    'active',
    1_830_297_600,
    false,
    1_830_297_600,
  ])
})

test('cutover deletion preserves the local enrollment schedule and clears only its former Stripe link', async () => {
  const calls = []
  const pool = {
    query: async (sql, params) => {
      const text = String(sql)
      calls.push({ sql: text, params })
      if (text.includes('canonical-cutover:webhook-guard')) {
        return { rows: [{
          billing_subscription_id: 91,
          family_billing_account_id: 44,
          member_id: 7,
          source_type: 'scheduling_signup',
          source_id: '501',
          local_status: 'active',
          local_end_date: null,
          local_next_bill_date: '2026-10-01',
          local_auto_renewal: true,
          current_stripe_subscription_id: 'sub_legacy',
          current_stripe_item_id: 'si_legacy',
          current_stripe_schedule_id: 'sub_sched_legacy',
          account_migration_id: 12,
          billing_migration_run_id: 8,
          migration_state: 'household_active',
          migration_item_id: 33,
        }] }
      }
      if (text.includes('canonical-cutover:webhook-audit-item')) return { rows: [], rowCount: 1 }
      if (text.includes('INSERT INTO billing_account_activity')) return { rows: [{ id: 200 }], rowCount: 1 }
      if (text.includes('canonical-cutover:webhook-clear-former-link')) return { rows: [], rowCount: 1 }
      if (text.includes('SET status = $2')) throw new Error('business subscription status must not be mutated')
      return { rows: [], rowCount: 0 }
    },
  }

  const result = await syncStripeSubscriptionStatus(
    pool,
    { id: 'sub_legacy', status: 'canceled', ended_at: 1_800_000_000 },
    'customer.subscription.deleted',
  )

  assert.deepEqual(result, {
    updated: 0,
    status: 'active',
    guarded: true,
    migrationState: 'household_active',
    linkageCleared: true,
  })
  assert.equal(calls.some((call) => call.sql.includes('SET status = $2')), false)
  const guardLookup = calls.find((call) => call.sql.includes('canonical-cutover:webhook-guard'))
  assert.deepEqual(guardLookup.params[1], [
    'armed',
    'cancellation_scheduled',
    'detached',
    'remote_retired',
    'household_active',
    'verified',
    'rollback_pending',
    'failed_forward_only',
  ])
  const clear = calls.find((call) => call.sql.includes('canonical-cutover:webhook-clear-former-link'))
  assert.ok(clear)
  assert.deepEqual(clear.params, [91, 'sub_legacy'])
  assert.doesNotMatch(clear.sql, /next_bill_date|(?:^|\s)status\s*=/m)
  const activity = calls.find((call) => call.sql.includes('INSERT INTO billing_account_activity'))
  assert.ok(activity)
  assert.match(activity.params[8], /without changing the canonical enrollment schedule/)
})

test('cutover update records scheduled remote cancellation without clearing or changing local dates', async () => {
  const calls = []
  const pool = {
    query: async (sql, params) => {
      const text = String(sql)
      calls.push({ sql: text, params })
      if (text.includes('canonical-cutover:webhook-guard')) {
        return { rows: [{
          billing_subscription_id: 91,
          family_billing_account_id: 44,
          member_id: 7,
          source_type: 'scheduling_signup',
          source_id: '501',
          local_status: 'paused',
          local_end_date: null,
          local_next_bill_date: '2026-10-01',
          local_auto_renewal: true,
          current_stripe_subscription_id: 'sub_legacy',
          account_migration_id: 12,
          billing_migration_run_id: 8,
          migration_state: 'cancellation_scheduled',
          migration_item_id: 33,
        }] }
      }
      if (text.includes('canonical-cutover:webhook-audit-item')) return { rows: [], rowCount: 1 }
      if (text.includes('INSERT INTO billing_account_activity')) return { rows: [{ id: 201 }], rowCount: 1 }
      if (text.includes('UPDATE billing_subscription')) throw new Error('local subscription must be preserved')
      return { rows: [], rowCount: 0 }
    },
  }

  const result = await syncStripeSubscriptionStatus(
    pool,
    {
      id: 'sub_legacy',
      status: 'active',
      cancel_at_period_end: true,
      cancel_at: 1_830_297_600,
      current_period_start: 1_827_705_600,
      current_period_end: 1_830_297_600,
    },
    'customer.subscription.updated',
  )

  assert.equal(result.guarded, true)
  assert.equal(result.status, 'paused')
  assert.equal(result.linkageCleared, false)
  assert.equal(calls.some((call) => call.sql.includes('UPDATE billing_subscription')), false)
  const itemAudit = calls.find((call) => call.sql.includes('canonical-cutover:webhook-audit-item'))
  assert.equal(itemAudit.params[1], 'active')
  assert.equal(itemAudit.params[4], '2028-01-01T00:00:00.000Z')
})

test('rollback-pending lifecycle events cannot cancel or disable the restored local schedule', async () => {
  const calls = []
  const pool = {
    query: async (sql, params) => {
      const text = String(sql)
      calls.push({ sql: text, params })
      if (text.includes('canonical-cutover:webhook-guard')) {
        return { rows: [{
          billing_subscription_id: 91,
          family_billing_account_id: 44,
          member_id: 7,
          source_type: 'scheduling_signup',
          source_id: '501',
          local_status: 'active',
          local_end_date: null,
          local_next_bill_date: '2026-10-01',
          local_auto_renewal: true,
          current_stripe_subscription_id: 'sub_legacy',
          account_migration_id: 12,
          billing_migration_run_id: 8,
          migration_state: 'rollback_pending',
          migration_item_id: 33,
        }] }
      }
      if (text.includes('canonical-cutover:webhook-audit-item')) return { rows: [], rowCount: 1 }
      if (text.includes('INSERT INTO billing_account_activity')) return { rows: [{ id: 202 }], rowCount: 1 }
      if (text.includes('canonical-cutover:webhook-clear-former-link')) return { rows: [], rowCount: 1 }
      if (text.includes('SET status = $2')) throw new Error('restored local schedule must not be mutated')
      return { rows: [], rowCount: 0 }
    },
  }

  const result = await syncStripeSubscriptionStatus(
    pool,
    { id: 'sub_legacy', status: 'canceled', ended_at: 1_800_000_000 },
    'customer.subscription.deleted',
  )

  assert.equal(result.guarded, true)
  assert.equal(result.migrationState, 'rollback_pending')
  assert.equal(result.status, 'active')
  assert.equal(calls.some((call) => call.sql.includes('SET status = $2')), false)
})

test('a delayed deletion rechecks rollback under the collection lock and uses current Stripe state', async () => {
  const calls = []
  let guardReads = 0
  const pool = {
    query: async (sql, params) => {
      const text = String(sql)
      calls.push({ sql: text, params })
      if (text.includes('canonical-cutover:webhook-guard')) {
        guardReads += 1
        return { rows: [{
          billing_subscription_id: 91,
          family_billing_account_id: 44,
          member_id: 7,
          source_type: 'scheduling_signup',
          source_id: '501',
          local_status: 'active',
          local_end_date: null,
          local_next_bill_date: '2026-10-01',
          local_auto_renewal: true,
          current_stripe_subscription_id: 'sub_legacy',
          account_migration_id: 12,
          billing_migration_run_id: 8,
          migration_state: guardReads === 1 ? 'rollback_pending' : 'rolled_back',
          migration_item_id: 33,
        }] }
      }
      if (text.includes('pg_advisory_lock')) return { rows: [{ pg_advisory_lock: null }] }
      if (text.includes('pg_advisory_unlock')) return { rows: [{ pg_advisory_unlock: true }] }
      if (text.includes('UPDATE billing_subscription') && text.includes('SET status = $2')) {
        return { rows: [], rowCount: 1 }
      }
      if (text.includes('webhook-clear-former-link')) {
        throw new Error('a stale deletion must not clear the restored local link')
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const stripe = {
    subscriptions: {
      async retrieve(id) {
        assert.equal(id, 'sub_legacy')
        return {
          id,
          status: 'active',
          cancel_at: null,
          cancel_at_period_end: false,
          current_period_end: 1_830_297_600,
        }
      },
    },
  }

  const result = await syncStripeSubscriptionStatus(
    pool,
    { id: 'sub_legacy', status: 'canceled', ended_at: 1_800_000_000 },
    'customer.subscription.deleted',
    { stripe },
  )

  assert.deepEqual(result, { updated: 1, status: 'active' })
  assert.equal(guardReads, 2)
  const update = calls.find((call) => (
    call.sql.includes('UPDATE billing_subscription') && call.sql.includes('SET status = $2')
  ))
  assert.deepEqual(update.params, ['sub_legacy', 'active', null, true, 1_830_297_600])
  assert.equal(calls.some((call) => call.sql.includes('webhook-clear-former-link')), false)
})

test('annual memberships remain on the existing Stripe lifecycle path', async () => {
  const calls = []
  const pool = {
    query: async (sql, params) => {
      const text = String(sql)
      calls.push({ sql: text, params })
      if (text.includes('canonical-cutover:webhook-guard')) return { rows: [] }
      if (text.includes('stripe-subscription:ownership')) return { rows: [legacyOwnershipRow()] }
      return { rows: [], rowCount: text.includes('UPDATE billing_subscription') ? 1 : 0 }
    },
  }

  const result = await syncStripeSubscriptionStatus(
    pool,
    { id: 'sub_annual', customer: 'cus_family', status: 'active', current_period_end: 1_830_297_600 },
    'customer.subscription.updated',
  )

  assert.deepEqual(result, { updated: 1, status: 'active' })
  const guard = calls.find((call) => call.sql.includes('canonical-cutover:webhook-guard'))
  assert.match(guard.sql, /account\.household_monthly_billing_enabled = TRUE/)
  const update = calls.find((call) => call.sql.includes('SET status = $2'))
  assert.ok(update)
})

test('cutover guard fails closed before clearing local linkage when lifecycle audit fails', async () => {
  const calls = []
  const pool = {
    query: async (sql) => {
      const text = String(sql)
      calls.push(text)
      if (text.includes('canonical-cutover:webhook-guard')) {
        return { rows: [{
          billing_subscription_id: 91,
          family_billing_account_id: 44,
          member_id: 7,
          source_type: 'scheduling_signup',
          source_id: '501',
          local_status: 'active',
          local_next_bill_date: '2026-10-01',
          current_stripe_subscription_id: 'sub_legacy',
          account_migration_id: 12,
          billing_migration_run_id: 8,
          migration_state: 'verified',
          migration_item_id: 33,
        }] }
      }
      if (text.includes('canonical-cutover:webhook-audit-item')) return { rows: [], rowCount: 1 }
      if (text.includes('INSERT INTO billing_account_activity')) throw new Error('audit unavailable')
      return { rows: [], rowCount: 0 }
    },
  }

  await assert.rejects(
    syncStripeSubscriptionStatus(
      pool,
      { id: 'sub_legacy', status: 'canceled', ended_at: 1_800_000_000 },
      'customer.subscription.deleted',
    ),
    /audit unavailable/,
  )
  assert.equal(calls.some((sql) => sql.includes('webhook-clear-former-link')), false)
  assert.equal(calls.some((sql) => sql.includes('SET status = $2')), false)
})

test('unknown created, paused, and resumed subscriptions are quarantined and alerted', async () => {
  for (const eventType of [
    'customer.subscription.created',
    'customer.subscription.paused',
    'customer.subscription.resumed',
  ]) {
    const calls = []
    const pool = {
      async query(sql, params = []) {
        const text = String(sql)
        calls.push({ text, params })
        if (text.includes('canonical-cutover:webhook-guard')) return { rows: [] }
        if (text.includes('stripe-subscription:ownership')) return { rows: [] }
        if (text.includes('INSERT INTO stripe_billing_alert')) return { rows: [], rowCount: 1 }
        if (text.includes('UPDATE billing_subscription')) {
          throw new Error('unknown subscription must never change local lifecycle')
        }
        return { rows: [], rowCount: 0 }
      },
    }

    const result = await syncStripeSubscriptionStatus(pool, {
      id: `sub_rogue_${eventType.split('.').at(-1)}`,
      customer: 'cus_unknown',
      status: eventType.endsWith('paused') ? 'paused' : 'active',
    }, eventType)

    assert.equal(result.quarantined, true)
    assert.equal(result.reasonCode, 'stripe_subscription_owner_missing')
    const alert = calls.find(({ text }) => text.includes('INSERT INTO stripe_billing_alert'))
    assert.ok(alert, eventType)
    assert.equal(alert.params[1], null)
    assert.equal(calls.some(({ text }) => text.includes('UPDATE billing_subscription')), false)
  }
})

test('even an exactly linked legacy subscription creation event is quarantined', async () => {
  const calls = []
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('canonical-cutover:webhook-guard')) return { rows: [] }
      if (text.includes('stripe-subscription:ownership')) {
        return { rows: [legacyOwnershipRow({
          billing_subscription_id: 77,
          source_type: 'scheduling_signup',
          pricing_option_key: null,
        })] }
      }
      if (text.includes('pg_advisory_lock')) return { rows: [{ pg_advisory_lock: null }] }
      if (text.includes('pg_advisory_unlock')) return { rows: [{ pg_advisory_unlock: true }] }
      if (text.includes('INSERT INTO stripe_billing_alert')) return { rows: [], rowCount: 1 }
      if (text.includes('UPDATE billing_subscription')) {
        throw new Error('created subscription must never activate a local collector')
      }
      return { rows: [], rowCount: 0 }
    },
  }

  const result = await syncStripeSubscriptionStatus(pool, {
    id: 'sub_new_forbidden',
    customer: 'cus_family',
    status: 'active',
  }, 'customer.subscription.created')

  assert.equal(result.quarantined, true)
  assert.equal(result.reasonCode, 'stripe_subscription_creation_forbidden')
  assert.equal(calls.some(({ text }) => text.includes('UPDATE billing_subscription')), false)
})

test('unknown subscription on a canonical customer is quarantined against that household', async () => {
  const calls = []
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('canonical-cutover:webhook-guard')) return { rows: [] }
      if (text.includes('stripe-subscription:ownership')) return { rows: [] }
      if (text.includes('stripe-subscription:customer-owner')) {
        return { rows: [{ id: 44, household_monthly_billing_enabled: true, migration_state: 'verified' }] }
      }
      if (text.includes('INSERT INTO stripe_billing_alert')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    },
  }

  const result = await syncStripeSubscriptionStatus(pool, {
    id: 'sub_unknown_household',
    customer: 'cus_family',
    status: 'active',
  }, 'customer.subscription.resumed')

  assert.equal(result.quarantined, true)
  assert.equal(result.reasonCode, 'stripe_subscription_household_collector_conflict')
  const alert = calls.find(({ text }) => text.includes('INSERT INTO stripe_billing_alert'))
  assert.equal(alert.params[1], 44)
})
