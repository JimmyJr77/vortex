import test from 'node:test'
import assert from 'node:assert/strict'

import {
  classifyStripeInvoicePayment,
  recordAuthoritativeStripeInvoicePayment,
} from '../stripeInvoicePayments.js'

function classifierPool(local = null, ownership = null) {
  return {
    async query(sql) {
      const text = String(sql)
      if (text.includes('FROM billing_monthly_invoice')) return { rows: local ? [local] : [] }
      if (text.includes('stripe-subscription:ownership')) return { rows: ownership ? [ownership] : [] }
      throw new Error(`Unexpected classifier query: ${text}`)
    },
  }
}

function paidLegacyStripe({
  customerId = 'cus_family',
  subscriptionCustomerId = customerId,
  invoiceMetadata = { familyBillingAccountId: '44' },
  subscriptionMetadata = { familyBillingAccountId: '44' },
} = {}) {
  const invoice = {
    id: 'in_legacy_paid',
    paid: true,
    status: 'paid',
    amount_paid: 15000,
    amount_due: 15000,
    currency: 'usd',
    customer: customerId,
    metadata: invoiceMetadata,
    parent: { subscription_details: { subscription: 'sub_legacy_paid' } },
    status_transitions: { paid_at: 1_800_000_000 },
  }
  const subscription = {
    id: 'sub_legacy_paid',
    customer: subscriptionCustomerId,
    status: 'active',
    metadata: subscriptionMetadata,
  }
  const paymentIntent = {
    id: 'pi_legacy_paid',
    status: 'succeeded',
    customer: customerId,
    currency: 'usd',
    amount: 15000,
    amount_received: 15000,
    payment_method: {
      id: 'pm_legacy_paid',
      type: 'card',
      customer: customerId,
      card: { brand: 'visa', last4: '4242' },
    },
  }
  const invoicePayment = {
    id: 'inpay_legacy_paid',
    invoice: invoice.id,
    is_default: true,
    status: 'paid',
    amount_requested: 15000,
    amount_paid: 15000,
    currency: 'usd',
    payment: { type: 'payment_intent', payment_intent: paymentIntent.id },
  }
  return {
    invoice,
    subscription,
    invoices: { retrieve: async () => structuredClone(invoice) },
    subscriptions: { retrieve: async () => structuredClone(subscription) },
    paymentIntents: { retrieve: async () => structuredClone(paymentIntent) },
    invoicePayments: {
      list: async (params) => ({
        data: [{
          ...structuredClone(invoicePayment),
          ...(params?.expand ? { invoice: structuredClone(invoice) } : {}),
        }],
        has_more: false,
      }),
    },
  }
}

function paidCurrentOwnershipRow(overrides = {}) {
  return {
    billing_subscription_id: 51,
    family_billing_account_id: 44,
    member_id: 7,
    source_type: 'scheduling_signup',
    source_id: '501',
    pricing_option_key: null,
    local_status: 'active',
    current_account_customer_id: 'cus_family',
    account_is_active: true,
    household_monthly_billing_enabled: false,
    current_customer_owner_count: 1,
    migration_state: null,
    ...overrides,
  }
}

function paidClaimOwnershipRow(overrides = {}) {
  return {
    claimed_account_id: 44,
    first_migration_item_id: 91,
    migration_item_id: 91,
    item_type: 'billing_subscription',
    claimed_billing_subscription_id: 51,
    former_stripe_subscription_id: 'sub_legacy_paid',
    source_snapshot: {
      local: { id: 51, stripeSubscriptionId: 'sub_legacy_paid' },
      remote: { id: 'sub_legacy_paid', customerId: 'cus_family' },
    },
    migration_account_id: 44,
    migration_state: 'verified',
    accepted_account_snapshot: { id: 44, stripeCustomerId: 'cus_family' },
    claimed_subscription_account_id: 44,
    claimed_member_id: 7,
    claimed_source_type: 'scheduling_signup',
    claimed_source_id: '501',
    claimed_pricing_option_key: null,
    claimed_local_status: 'active',
    claimed_current_stripe_subscription_id: null,
    current_account_customer_id: 'cus_family',
    account_is_active: true,
    household_monthly_billing_enabled: true,
    current_customer_owner_count: 1,
    ...overrides,
  }
}

function paidLegacyRecordingPool({
  strictRows = [],
  currentRows = [],
  claimRows = [],
} = {}) {
  const state = { payment: null, alerts: new Set(), calls: [] }
  const pool = {
    state,
    async query(sql, params = []) {
      const text = String(sql)
      state.calls.push({ text, params })
      if (text.includes('FROM billing_monthly_invoice')) return { rows: [] }
      if (text.includes('stripe-subscription:ownership')) return { rows: strictRows }
      if (text.includes('stripe-subscription:customer-owner')) return { rows: [] }
      if (text.includes('stripe-subscription:paid-settlement-current')) return { rows: currentRows }
      if (text.includes('stripe-subscription:paid-settlement-claim')) return { rows: claimRows }
      if (text.includes('FROM billing_subscription') && text.includes('ORDER BY id')) return { rows: [] }
      if (text.includes('pg_advisory_lock')) return { rows: [{ pg_advisory_lock: null }] }
      if (text.includes('pg_advisory_unlock')) return { rows: [{ pg_advisory_unlock: true }] }
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] }
      if (/INSERT INTO billing_payment\s*\(/.test(text)) {
        if (state.payment) return { rows: [] }
        state.payment = {
          id: 701,
          family_billing_account_id: Number(params[0]),
          amount_cents: Number(params[1]),
          paid_at: params[2],
          method: params[3],
          external_processor: 'stripe',
          external_status: 'settled',
          stripe_invoice_id: params[4],
          stripe_customer_id: params[5],
          stripe_payment_intent_id: params[6],
          stripe_subscription_id: params[7],
        }
        return { rows: [state.payment] }
      }
      if (text.includes('SELECT * FROM billing_payment WHERE stripe_invoice_id')) {
        return { rows: state.payment ? [state.payment] : [] }
      }
      if (text.includes('SELECT * FROM billing_payment WHERE stripe_payment_intent_id')) {
        return { rows: state.payment ? [state.payment] : [] }
      }
      if (text.includes('INSERT INTO stripe_billing_alert')) {
        const eventId = params[0]
        if (state.alerts.has(eventId)) return { rows: [] }
        state.alerts.add(eventId)
        return { rows: [] }
      }
      throw new Error(`Unexpected paid legacy recording query: ${text}`)
    },
  }
  return pool
}

test('authoritative invoice classifier recognizes an immutable local household invoice', async () => {
  const result = await classifyStripeInvoicePayment(
    classifierPool({ id: 44, family_billing_account_id: 8 }),
    {
      id: 'in_44',
      metadata: { householdMonthlyInvoice: 'true', monthlyInvoiceId: '44', familyBillingAccountId: '8' },
    },
  )
  assert.equal(result.kind, 'household')
})

test('authoritative invoice classifier quarantines orphan, conflicting, and unclassified invoices', async () => {
  const orphan = await classifyStripeInvoicePayment(classifierPool(), {
    id: 'in_orphan',
    metadata: { householdMonthlyInvoice: 'true', monthlyInvoiceId: '99' },
  })
  assert.equal(orphan.kind, 'orphan_household')

  const conflict = await classifyStripeInvoicePayment(
    classifierPool({ id: 44, family_billing_account_id: 8 }),
    {
      id: 'in_conflict',
      subscription: 'sub_44',
      metadata: { householdMonthlyInvoice: 'true', monthlyInvoiceId: '44' },
    },
  )
  assert.equal(conflict.kind, 'conflict')

  const unclassified = await classifyStripeInvoicePayment(classifierPool(), { id: 'in_unknown' })
  assert.equal(unclassified.kind, 'unclassified')
})

test('authoritative invoice classifier admits only an exactly owned legacy subscription renewal', async () => {
  const result = await classifyStripeInvoicePayment(classifierPool(null, {
    billing_subscription_id: 51,
    family_billing_account_id: 8,
    member_id: 7,
    source_type: 'annual_membership',
    pricing_option_key: 'annual_membership',
    local_status: 'active',
    stripe_customer_id: 'cus_family',
    stripe_customer_owner_count: 1,
    household_monthly_billing_enabled: false,
    migration_state: null,
    claimed_account_id: null,
  }), {
    id: 'in_annual',
    customer: 'cus_family',
    parent: { subscription_details: { subscription: 'sub_annual' } },
  })
  assert.equal(result.kind, 'subscription')
  assert.equal(result.subscriptionId, 'sub_annual')
})

test('authoritative invoice recorder rejects a paid subscription without a current link or immutable claim', async () => {
  const stripe = paidLegacyStripe()
  const pool = paidLegacyRecordingPool()
  const result = await recordAuthoritativeStripeInvoicePayment(pool, {
    invoice: stripe.invoice,
    stripe,
  })
  assert.equal(result.classification.kind, 'conflict')
  assert.equal(result.classification.code, 'stripe_subscription_owner_missing')
  assert.equal(result.payment, null)
  assert.equal(pool.state.calls.some(({ text }) => text.includes('INSERT INTO billing_payment')), false)
})

test('authoritative invoice recorder does not disguise database or programming errors as quarantine', async () => {
  const pool = {
    async query(sql) {
      if (String(sql).includes('FROM billing_monthly_invoice')) return { rows: [] }
      throw new Error('database unavailable')
    },
  }
  await assert.rejects(
    recordAuthoritativeStripeInvoicePayment(pool, {
      invoice: {
        id: 'in_network_error',
        paid: true,
        status: 'paid',
        amount_paid: 8500,
        subscription: 'sub_annual',
      },
    }),
    /database unavailable/,
  )
})

test('paid legacy drift records exact cash once and raises one critical alert', async () => {
  const scenarios = [
    {
      name: 'household enabled',
      strictRows: [{
        billing_subscription_id: 51,
        family_billing_account_id: 44,
        household_monthly_billing_enabled: true,
        claimed_account_id: null,
      }],
      currentRows: [paidCurrentOwnershipRow({ household_monthly_billing_enabled: true })],
      claimRows: [],
    },
    {
      name: 'shared current customer',
      strictRows: [{
        billing_subscription_id: 51,
        family_billing_account_id: 44,
        stripe_customer_id: 'cus_family',
        stripe_customer_owner_count: 2,
        household_monthly_billing_enabled: false,
        claimed_account_id: null,
      }],
      currentRows: [paidCurrentOwnershipRow({ current_customer_owner_count: 2 })],
      claimRows: [],
    },
    {
      name: 'remapped customer',
      strictRows: [{
        billing_subscription_id: 51,
        family_billing_account_id: 44,
        stripe_customer_id: 'cus_replacement',
        stripe_customer_owner_count: 1,
        household_monthly_billing_enabled: false,
        claimed_account_id: null,
      }],
      currentRows: [paidCurrentOwnershipRow({ current_account_customer_id: 'cus_replacement' })],
      claimRows: [],
    },
    {
      name: 'detached immutable claim',
      strictRows: [{ claimed_account_id: 44 }],
      currentRows: [],
      claimRows: [paidClaimOwnershipRow()],
    },
  ]

  for (const scenario of scenarios) {
    const stripe = paidLegacyStripe()
    const pool = paidLegacyRecordingPool(scenario)
    const first = await recordAuthoritativeStripeInvoicePayment(pool, { invoice: stripe.invoice, stripe })
    const replay = await recordAuthoritativeStripeInvoicePayment(pool, { invoice: stripe.invoice, stripe })

    assert.equal(first.classification.kind, 'subscription', scenario.name)
    assert.equal(first.payment?.family_billing_account_id, 44, scenario.name)
    assert.equal(first.payment?.amount_cents, 15000, scenario.name)
    assert.equal(first.payment?.stripe_customer_id, 'cus_family', scenario.name)
    assert.equal(first.payment?.stripe_invoice_id, 'in_legacy_paid', scenario.name)
    assert.equal(replay.payment?.id, first.payment?.id, scenario.name)
    assert.equal(
      pool.state.calls.filter(({ text }) => /INSERT INTO billing_payment\s*\(/.test(text)).length,
      2,
      scenario.name,
    )
    assert.equal(pool.state.alerts.size, 1, scenario.name)
    const alert = pool.state.calls.find(({ text }) => text.includes('INSERT INTO stripe_billing_alert'))
    assert.equal(alert.params[1], 44, scenario.name)
    assert.equal(alert.params[2], 'paid_legacy_subscription_current_authority_drift', scenario.name)
    assert.equal(alert.params[3], 'critical', scenario.name)
  }
})

test('paid legacy settlement quarantines ambiguous or conflicting durable ownership', async () => {
  const remoteHouseholdStripe = paidLegacyStripe()
  const remoteHouseholdEvent = structuredClone(remoteHouseholdStripe.invoice)
  remoteHouseholdStripe.invoice.metadata = {
    ...remoteHouseholdStripe.invoice.metadata,
    householdMonthlyInvoice: 'true',
    monthlyInvoiceId: '91',
  }
  const cases = [
    {
      name: 'current and claim accounts conflict',
      stripe: paidLegacyStripe(),
      pool: paidLegacyRecordingPool({
        currentRows: [paidCurrentOwnershipRow()],
        claimRows: [paidClaimOwnershipRow({
          claimed_account_id: 45,
          migration_account_id: 45,
          accepted_account_snapshot: { id: 45, stripeCustomerId: 'cus_family' },
          claimed_subscription_account_id: 45,
        })],
      }),
      code: 'paid_stripe_subscription_owner_claim_conflict',
    },
    {
      name: 'current and claim local subscription bindings conflict',
      stripe: paidLegacyStripe(),
      pool: paidLegacyRecordingPool({
        currentRows: [paidCurrentOwnershipRow({ billing_subscription_id: 52 })],
        claimRows: [paidClaimOwnershipRow({ claimed_billing_subscription_id: 51 })],
      }),
      code: 'paid_stripe_subscription_owner_claim_conflict',
    },
    {
      name: 'duplicate current links',
      stripe: paidLegacyStripe(),
      pool: paidLegacyRecordingPool({
        currentRows: [
          paidCurrentOwnershipRow({ billing_subscription_id: 51 }),
          paidCurrentOwnershipRow({ billing_subscription_id: 52 }),
        ],
      }),
      code: 'paid_stripe_subscription_owner_ambiguous',
    },
    {
      name: 'subscription customer differs from invoice',
      stripe: paidLegacyStripe({ subscriptionCustomerId: 'cus_other' }),
      pool: paidLegacyRecordingPool({ currentRows: [paidCurrentOwnershipRow()] }),
      code: 'paid_stripe_subscription_customer_conflict',
    },
    {
      name: 'nonblank Stripe metadata points at another account',
      stripe: paidLegacyStripe({ subscriptionMetadata: { familyBillingAccountId: '45' } }),
      pool: paidLegacyRecordingPool({ currentRows: [paidCurrentOwnershipRow()] }),
      code: 'paid_stripe_subscription_metadata_account_conflict',
    },
    {
      name: 'immutable claim first item is not a subscription',
      stripe: paidLegacyStripe(),
      pool: paidLegacyRecordingPool({
        claimRows: [paidClaimOwnershipRow({ item_type: 'scheduling_signup' })],
      }),
      code: 'paid_stripe_subscription_claim_conflict',
    },
    {
      name: 'fresh remote invoice also claims household collection',
      stripe: remoteHouseholdStripe,
      eventInvoice: remoteHouseholdEvent,
      pool: paidLegacyRecordingPool({ currentRows: [paidCurrentOwnershipRow()] }),
      code: 'invoice_collection_classification_conflict',
    },
  ]

  for (const fixture of cases) {
    const result = await recordAuthoritativeStripeInvoicePayment(fixture.pool, {
      invoice: fixture.eventInvoice ?? fixture.stripe.invoice,
      stripe: fixture.stripe,
    })
    assert.equal(result.classification.kind, 'conflict', fixture.name)
    assert.equal(result.classification.code, fixture.code, fixture.name)
    assert.equal(result.payment, null, fixture.name)
    assert.equal(
      fixture.pool.state.calls.some(({ text }) => text.includes('INSERT INTO billing_payment')),
      false,
      fixture.name,
    )
  }
})
