import test from 'node:test'
import assert from 'node:assert/strict'
import {
  invoicePaymentIntentId,
  invoiceSubscriptionId,
  recordPaidStripeInvoice,
  syncStripeSubscriptionStatus,
} from '../stripeWebhookLifecycle.js'

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
          stripe_invoice_id: 'in_renewal',
          stripe_payment_intent_id: 'pi_renewal',
        }] }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const payment = await recordPaidStripeInvoice(pool, {
    id: 'in_renewal', paid: true, status: 'paid', amount_paid: 15000,
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
    stripe_payment_intent_id: 'pi_renewal',
    stripe_invoice_id: null,
    stripe_subscription_id: null,
  }
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
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
          stripe_invoice_id: 'in_annual_2026',
          stripe_payment_intent_id: 'pi_annual_2026',
          stripe_subscription_id: 'sub_annual',
        }
        return { rows: [payment] }
      }
      if (text.includes('SELECT * FROM billing_payment WHERE stripe_invoice_id')) return { rows: payment ? [payment] : [] }
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
    customer: 'cus_family',
    payment_intent: 'pi_annual_2026',
    parent: { subscription_details: { subscription: 'sub_annual' } },
    metadata: {
      annualMembership: 'true',
      familyBillingAccountId: '44',
      memberId: '7',
    },
    status_transitions: { paid_at: 1_787_894_400 },
  }

  const first = await recordPaidStripeInvoice(pool, invoice)
  assert.equal(first.id, 9)
  assert.equal(first.newly_inserted, true)
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

function annualRecoveryFixture({ applications = [] } = {}) {
  const calls = []
  const payment = {
    id: 9,
    family_billing_account_id: 44,
    amount_cents: 6800,
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
      if (text.includes('FROM family_billing_account') && text.includes('ORDER BY id')) return { rows: [{ id: 44 }] }
      if (text.includes('FROM billing_subscription') && text.includes('FOR SHARE')) return { rows: [{ id: 52 }] }
      if (text.includes('INSERT INTO billing_payment') && !text.includes('INSERT INTO billing_payment_application')) return { rows: [] }
      if (text.includes('WHERE stripe_invoice_id = $1')) return { rows: [] }
      if (text.includes('WHERE stripe_payment_intent_id = $1')) return { rows: [payment] }
      if (text.includes('UPDATE billing_payment')) {
        return { rows: [{
          ...payment,
          stripe_invoice_id: 'in_annual_repair',
          stripe_subscription_id: 'sub_annual',
          stripe_customer_id: 'cus_family',
        }] }
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
      throw new Error(`Unexpected locked annual recovery query: ${text}`)
    },
  }
  return { pool, calls }
}

function annualRepairInvoice(overrides = {}) {
  return {
    id: 'in_annual_repair',
    paid: true,
    status: 'paid',
    amount_paid: 6800,
    customer: 'cus_family',
    payment_intent: 'pi_annual_repair',
    metadata: {
      annualMembership: 'true',
      familyBillingAccountId: '44',
      memberId: '7',
    },
    parent: { subscription_details: { subscription: 'sub_annual' } },
    status_transitions: { paid_at: 1_787_894_400 },
    ...overrides,
  }
}

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
  const commit = calls.findIndex(({ text }) => text === 'COMMIT')
  assert.ok(begin >= 0 && reverse > begin && exact > reverse && commit > exact)
  assert.deepEqual(calls[reverse].params, [9, 88, 6800, 81, 'annual-invoice-repair:in_annual_repair:reverse:81'])
  assert.deepEqual(calls[exact].params, [9, 72, 6800, 'annual-invoice:in_annual_repair:payment:9:charge:72'])
})

test('annual invoice repair quarantines an unprovable allocation and rolls back without reassigning it', async () => {
  const { pool, calls } = annualRecoveryFixture({
    applications: [{
      id: 81,
      billing_payment_id: 9,
      billing_charge_id: 88,
      amount_cents: 6800,
      idempotency_key: 'exact:9:88',
      allocation_reason: 'exact_custom_charge',
    }],
  })

  await assert.rejects(
    recordPaidStripeInvoice(pool, annualRepairInvoice()),
    (error) => error?.code === 'stripe_invoice_quarantined'
      && error?.reasonCode === 'annual_invoice_allocation_ambiguous',
  )
  assert.ok(calls.some(({ text }) => text === 'ROLLBACK'))
  assert.equal(calls.some(({ text }) => text.includes("'annual_invoice_reconstruction'")), false)
  assert.equal(calls.some(({ text }) => text.includes("'exact_annual_invoice'")), false)
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
