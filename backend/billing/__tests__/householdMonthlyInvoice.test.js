import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activateEligibleHouseholdMonthlyBilling,
  activateHouseholdMonthlyBillingForAccount,
  billingMonthStart,
  buildHouseholdInvoiceApplicationPlan,
  createHouseholdMonthlyInvoice,
  createLocalHouseholdInvoice,
  assertHouseholdPaymentBoundary,
  listHouseholdMonthlyInvoices,
  recordAndApplyHouseholdMonthlyInvoicePayment,
  stripeInvoiceIsPaid,
} from '../householdMonthlyInvoice.js'

test('Stripe paid status is authoritative when the legacy paid boolean is absent', () => {
  assert.equal(stripeInvoiceIsPaid({ status: 'paid' }), true)
  assert.equal(stripeInvoiceIsPaid({ status: 'open', paid: true }), true)
  assert.equal(stripeInvoiceIsPaid({ status: 'open' }), false)
})

test('monthly invoice history hides suppressed correction lines while preserving the paid total', async () => {
  const queries = []
  const pool = {
    async query(sql) {
      const text = String(sql)
      queries.push(text)
      if (text.includes('SELECT invoice.*')) {
        return { rows: [{
          id: 4,
          billing_month: new Date('2026-09-01T04:00:00.000Z'),
          status: 'paid',
          subtotal_cents: 59500,
          credit_cents: 27624,
          total_cents: 31876,
          line_count: 4,
        }] }
      }
      if (text.includes('SELECT line.*')) {
        return { rows: [
          { id: 1, billing_monthly_invoice_id: 4, member_name: 'Lael Roberts', description: 'Vortex A4 Elite', line_type: 'charge', amount_cents: 12750, customer_visible: true },
          { id: 2, billing_monthly_invoice_id: 4, member_name: 'Lael Roberts', description: 'Vortex A4 Elite', line_type: 'charge', amount_cents: 12750, customer_visible: true },
          { id: 3, billing_monthly_invoice_id: 4, member_name: 'Lael Roberts', description: 'Annual Fee', line_type: 'charge', amount_cents: 8500, customer_visible: true },
          { id: 4, billing_monthly_invoice_id: 4, member_name: 'Lael Roberts', description: 'Credit for Annual Fee', line_type: 'credit', amount_cents: -8500, customer_visible: true },
          { id: 5, billing_monthly_invoice_id: 4, amount_cents: 9562, customer_visible: false },
          { id: 6, billing_monthly_invoice_id: 4, amount_cents: 3188, customer_visible: false },
          { id: 7, billing_monthly_invoice_id: 4, amount_cents: 9562, customer_visible: false },
          { id: 8, billing_monthly_invoice_id: 4, amount_cents: 3188, customer_visible: false },
          { id: 9, billing_monthly_invoice_id: 4, amount_cents: -9562, customer_visible: false },
          { id: 10, billing_monthly_invoice_id: 4, amount_cents: -9562, customer_visible: false },
        ] }
      }
      throw new Error(`Unexpected invoice history query: ${text}`)
    },
  }

  const [invoice] = await listHouseholdMonthlyInvoices(pool, 10903)

  assert.equal(invoice.lineCount, 4)
  assert.equal(invoice.billingMonth, '2026-09-01')
  assert.equal(invoice.lines.length, 4)
  assert.equal(invoice.totalCents, 31876)
  assert.equal(invoice.postPaymentCreditCents, 6376)
  assert.equal(invoice.lines.some((line) => /prorat|reversal/i.test(line.description)), false)
  assert.match(queries[0], /customerAuditVisibility/)
  assert.match(queries[1], /AS customer_visible/)
})

test('household invoice application plan applies linked and account credits before collection', () => {
  const plan = buildHouseholdInvoiceApplicationPlan([
    { id: 1, line_type: 'charge', billing_charge_id: 101, amount_cents: 10000 },
    { id: 2, line_type: 'charge', billing_charge_id: 102, amount_cents: 5000 },
    { id: 3, line_type: 'credit', billing_charge_id: 201, related_charge_id: 102, amount_cents: -3000 },
    { id: 4, line_type: 'credit', billing_charge_id: 202, related_charge_id: null, amount_cents: -5000 },
  ])

  assert.deepEqual(plan.paymentApplications.map((line) => ({
    chargeId: line.billing_charge_id,
    applicationCents: line.application_cents,
  })), [
    { chargeId: 101, applicationCents: 5000 },
    { chargeId: 102, applicationCents: 2000 },
  ])
  assert.deepEqual(plan.creditApplications.map((application) => ({
    creditLineId: application.credit_invoice_line_id,
    targetLineId: application.target_invoice_line_id,
    applicationCents: application.amount_cents,
  })), [
    { creditLineId: 3, targetLineId: 2, applicationCents: 3000 },
    { creditLineId: 4, targetLineId: 1, applicationCents: 5000 },
  ])
})

test('local household invoice persists canonical negative charge credits and the exact net total', async () => {
  const state = { invoiceParams: null, lineParams: [], rolledBack: false, queries: [] }
  let lineId = 0
  const client = {
    async query(sql, params = []) {
      const text = String(sql)
      state.queries.push(text)
      if (text === 'BEGIN' || text === 'COMMIT' || text.includes('pg_advisory_xact_lock')) return { rows: [] }
      if (text === 'ROLLBACK') { state.rolledBack = true; return { rows: [] } }
      if (text.includes('WITH active_enrollment_checkout AS')) return { rows: [] }
      if (text.includes('FROM billing_payment') && text.includes('paid-checkout-fulfillment-pending')) return { rows: [] }
      if (text.includes('FROM billing_refund') && text.includes("external_status = 'reconciliation_required'")) return { rows: [] }
      if (text.includes('FROM stripe_pending_enrollment pending') && text.includes('annual_membership_checkout_request')) return { rows: [] }
      if (text.includes('SELECT * FROM billing_monthly_invoice') && text.includes('billing_month = $2::date')) return { rows: [] }
      if (text.includes('SELECT charge.id, charge.member_id, charge.description') && text.includes('remaining_cents')) {
        return { rows: [
          { id: 101, member_id: 1, description: 'Class A', remaining_cents: 10000 },
          { id: 102, member_id: 2, description: 'Class B', remaining_cents: 5000 },
        ] }
      }
      if (text.includes('charge.related_charge_id') && text.includes('available_cents')) {
        return { rows: [
          { id: 201, member_id: 2, description: 'Linked discount', related_charge_id: 102, available_cents: -3000 },
          { id: 202, member_id: null, description: 'Account credit', related_charge_id: null, available_cents: -5000 },
        ] }
      }
      if (text.includes('canonical-billing:collectible-balance')) {
        return { rows: [{ collectible_balance_cents: 7000 }] }
      }
      if (text.includes('INSERT INTO billing_monthly_invoice (')) {
        state.invoiceParams = params
        return { rows: [{
          id: 77,
          family_billing_account_id: params[0],
          billing_month: params[1],
          status: 'draft',
          subtotal_cents: params[2],
          credit_cents: params[3],
          total_cents: params[4],
        }] }
      }
      if (text.includes('INSERT INTO billing_monthly_invoice_line')) {
        state.lineParams.push(params)
        return { rows: [{
          id: ++lineId,
          billing_monthly_invoice_id: params[0],
          billing_charge_id: params[1],
          member_id: params[2],
          line_type: text.includes("'credit'") ? 'credit' : 'charge',
          description: params[3],
          amount_cents: params[4],
        }] }
      }
      throw new Error(`Unexpected local invoice query: ${text}`)
    },
  }

  const result = await createLocalHouseholdInvoice(client, {
    accountId: 8,
    billingMonth: '2026-09-01',
  })

  assert.equal(state.rolledBack, false)
  assert.deepEqual(state.invoiceParams, [8, '2026-09-01', 15000, 8000, 7000])
  assert.deepEqual(result.lines.map((line) => line.amount_cents), [10000, 5000, -3000, -5000])
  assert.equal(result.invoice.total_cents, 7000)
  const chargeSelection = state.queries.find((sql) => sql.includes('AS remaining_cents'))
  const creditSelection = state.queries.find((sql) => sql.includes('AS available_cents'))
  assert.match(chargeSelection, /billing_charge_credit_application/)
  assert.match(chargeSelection, /target_invoice_line_id/)
  assert.match(chargeSelection, /offset_charge\.source_type = 'refund_offset'/)
  assert.match(chargeSelection, /credit_source\.source_type = 'refund_offset'/)
  assert.match(creditSelection, /billing_charge_credit_application/)
  assert.match(creditSelection, /credit_invoice_line_id/)
  assert.match(creditSelection, /charge\.source_type <> 'refund_offset'/)
  assert.match(creditSelection, /prior\.status IN \('draft', 'open', 'failed', 'payment_method_required'\)/)
  assert.doesNotMatch(creditSelection, /prior\.status IN \([^)]*'paid'/)
  assert.doesNotMatch(creditSelection, /prior\.status IN \([^)]*'void'/)
})

test('local household invoice blocks collection while paid Checkout cash is unresolved', async (t) => {
  for (const marker of [
    '[paid-checkout-fulfillment-pending:cs_pending]',
    '[paid-checkout-refund-required:cs_refund]',
  ]) {
    await t.test(marker, async () => {
      const calls = []
      const client = {
        async query(sql) {
          const text = String(sql)
          calls.push(text)
          if (text === 'BEGIN' || text === 'COMMIT' || text.includes('pg_advisory_xact_lock')) {
            return { rows: [] }
          }
          if (text.includes('WITH active_enrollment_checkout AS')) return { rows: [] }
          if (text.includes('FROM billing_payment') && text.includes('paid-checkout-fulfillment-pending')) {
            return { rows: [{ id: 301, note: marker }] }
          }
          throw new Error(`Invoice collection continued past unresolved paid Checkout: ${text}`)
        },
      }

      const result = await createLocalHouseholdInvoice(client, {
        accountId: 8,
        billingMonth: '2026-09-01',
      })
      assert.equal(result.blocked, 'paid_checkout_fulfillment_pending')
      assert.equal(result.invoice, null)
      assert.equal(calls.some((text) => (
        text.includes('FROM billing_charge charge')
        && text.includes('refund_offset.offset_cents')
      )), false)
      assert.equal(calls.at(-1), 'COMMIT')
    })
  }
})

test('local household invoice blocks collection while a Stripe refund awaits ledger reconciliation', async () => {
  const calls = []
  const client = {
    async query(sql) {
      const text = String(sql)
      calls.push(text)
      if (text === 'BEGIN' || text === 'COMMIT' || text.includes('pg_advisory_xact_lock')) {
        return { rows: [] }
      }
      if (text.includes('WITH active_enrollment_checkout AS')) return { rows: [] }
      if (text.includes('FROM billing_payment') && text.includes('paid-checkout-fulfillment-pending')) {
        return { rows: [] }
      }
      if (text.includes('FROM billing_refund') && text.includes("external_status = 'reconciliation_required'")) {
        return { rows: [{ id: 401 }] }
      }
      throw new Error(`Invoice collection continued past unresolved Stripe refund: ${text}`)
    },
  }

  const result = await createLocalHouseholdInvoice(client, {
    accountId: 8,
    billingMonth: '2026-09-01',
  })

  assert.equal(result.blocked, 'stripe_refund_reconciliation_required')
  assert.equal(result.invoice, null)
  assert.equal(calls.some((text) => text.includes('FROM billing_charge charge')), false)
  assert.equal(calls.at(-1), 'COMMIT')
})

test('local household invoice blocks a completed Checkout owner with no exact payment', async (t) => {
  for (const owner of [
    { owner_kind: 'enrollment', owner_id: 71 },
    { owner_kind: 'annual_membership', owner_id: 72 },
  ]) {
    await t.test(owner.owner_kind, async () => {
      const calls = []
      const client = {
        async query(sql) {
          const text = String(sql)
          calls.push(text)
          if (text === 'BEGIN' || text === 'COMMIT' || text.includes('pg_advisory_xact_lock')) {
            return { rows: [] }
          }
          if (text.includes('WITH active_enrollment_checkout AS')) return { rows: [] }
          if (text.includes('FROM billing_payment') && text.includes('paid-checkout-fulfillment-pending')) {
            return { rows: [] }
          }
          if (text.includes('FROM billing_refund') && text.includes("external_status = 'reconciliation_required'")) return { rows: [] }
          if (text.includes('FROM stripe_pending_enrollment pending') && text.includes('annual_membership_checkout_request')) {
            return { rows: [owner] }
          }
          throw new Error(`Invoice collection continued past unresolved Checkout owner: ${text}`)
        },
      }

      const result = await createLocalHouseholdInvoice(client, {
        accountId: 8,
        billingMonth: '2026-09-01',
      })
      assert.equal(result.blocked, 'paid_checkout_owner_payment_gap')
      assert.equal(result.blockedOwnerKind, owner.owner_kind)
      assert.equal(result.blockedOwnerId, owner.owner_id)
      assert.equal(result.invoice, null)
      assert.equal(calls.some((text) => (
        text.includes('FROM billing_charge charge')
        && text.includes('refund_offset.offset_cents')
      )), false)
      const ownerGuard = calls.find((text) => text.includes('WITH completed_owner AS'))
      assert.match(ownerGuard, /purchase_target_cents/)
      assert.match(ownerGuard, /tagged_charge\.stripe_checkout_session_id = owner\.stripe_checkout_session_id/)
      assert.match(ownerGuard, /application\.billing_payment_id = payment\.id/)
      assert.match(ownerGuard, /application_kind = 'reversal'/)
      assert.equal(calls.at(-1), 'COMMIT')
    })
  }
})

test('local household invoice blocks an active enrollment Checkout carrying account balance', async () => {
  const calls = []
  const client = {
    async query(sql) {
      const text = String(sql)
      calls.push(text)
      if (text === 'BEGIN' || text === 'COMMIT' || text.includes('pg_advisory_xact_lock')) {
        return { rows: [] }
      }
      if (text.includes('WITH active_enrollment_checkout AS')) {
        return { rows: [{ owner_kind: 'enrollment', owner_id: 73 }] }
      }
      throw new Error(`Invoice collection continued past active enrollment Checkout: ${text}`)
    },
  }

  const result = await createLocalHouseholdInvoice(client, {
    accountId: 8,
    billingMonth: '2026-09-01',
  })

  assert.equal(result.blocked, 'active_enrollment_checkout_balance_collector')
  assert.equal(result.blockedOwnerId, 73)
  assert.equal(result.invoice, null)
  assert.equal(calls.some((text) => text.includes('FROM billing_charge charge')), false)
  assert.equal(calls.at(-1), 'COMMIT')
})

function invoiceSettlementPool({
  status = 'open',
  applications = [],
  creditApplications = [],
  invoice: invoiceOverrides = {},
  lines: lineOverrides = null,
} = {}) {
  const state = {
    invoice: {
      id: 71,
      family_billing_account_id: 8,
      billing_month: '2026-09-01',
      status,
      subtotal_cents: 5000,
      credit_cents: 0,
      total_cents: 5000,
      stripe_invoice_id: 'in_71',
      stripe_payment_intent_id: 'pi_71',
      ...invoiceOverrides,
    },
    lines: lineOverrides ?? [{
      id: 72,
      billing_monthly_invoice_id: 71,
      billing_charge_id: 73,
      line_type: 'charge',
      amount_cents: 5000,
    }],
    payments: [],
    applications: applications.map((application) => ({ ...application })),
    creditApplications: creditApplications.map((application) => ({ ...application })),
    snapshot: null,
    events: [],
    writes: [],
  }
  const client = {
    release() {},
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock') || text.includes('pg_advisory_unlock')) return { rows: [] }
      if (text === 'BEGIN') {
        state.events.push('begin')
        state.snapshot = {
          payments: state.payments.map((payment) => ({ ...payment })),
          invoice: { ...state.invoice },
          applications: state.applications.map((application) => ({ ...application })),
          creditApplications: state.creditApplications.map((application) => ({ ...application })),
        }
        return { rows: [] }
      }
      if (text === 'COMMIT') { state.snapshot = null; return { rows: [] } }
      if (text === 'ROLLBACK') {
        if (state.snapshot) {
          state.payments = state.snapshot.payments
          state.invoice = state.snapshot.invoice
          state.applications = state.snapshot.applications
          state.creditApplications = state.snapshot.creditApplications
        }
        state.snapshot = null
        return { rows: [] }
      }
      if (text.startsWith('SAVEPOINT') || text.startsWith('RELEASE SAVEPOINT') || text.startsWith('ROLLBACK TO SAVEPOINT')) {
        return { rows: [] }
      }
      if (text.includes('SELECT * FROM billing_monthly_invoice WHERE stripe_invoice_id')) {
        return { rows: [{ ...state.invoice }] }
      }
      if (text.includes('SELECT * FROM billing_monthly_invoice WHERE id = $1 FOR UPDATE')) {
        return { rows: [{ ...state.invoice }] }
      }
      if (text.includes('FROM billing_monthly_invoice_line') && text.includes('ORDER BY id')) return { rows: state.lines }
      if (text.includes('FROM billing_payment_application') && text.includes('WHERE billing_payment_id = $1')) {
        return { rows: state.applications }
      }
      if (text.includes('FROM billing_charge_credit_application application')) {
        return { rows: state.creditApplications }
      }
      if (text.includes('INSERT INTO billing_charge_credit_application')) {
        const existing = state.creditApplications.find((application) => application.idempotency_key === params[4])
        if (!existing) {
          const creditLine = state.lines.find((line) => Number(line.id) === Number(params[1]))
          const targetLine = state.lines.find((line) => Number(line.id) === Number(params[2]))
          state.creditApplications.push({
            id: 90 + state.creditApplications.length,
            credit_invoice_line_id: params[1],
            target_invoice_line_id: params[2],
            amount_cents: params[3],
            idempotency_key: params[4],
            credit_billing_charge_id: creditLine?.billing_charge_id,
            target_billing_charge_id: targetLine?.billing_charge_id,
          })
        }
        state.writes.push({ text, params })
        return { rows: [] }
      }
      if (text.includes('INSERT INTO billing_payment_application')) {
        const existing = state.applications.find((application) => application.idempotency_key === params[3])
        if (!existing) {
          state.applications.push({
            id: 80 + state.applications.length,
            billing_charge_id: params[1],
            amount_cents: params[2],
            application_kind: 'application',
            idempotency_key: params[3],
            reverses_application_id: null,
          })
        }
        state.writes.push({ text, params })
        return { rows: [] }
      }
      if (text.includes('UPDATE billing_monthly_invoice') && text.includes('RETURNING *')) {
        const assignments = text.slice(text.indexOf('SET') + 3, text.indexOf('WHERE')).matchAll(/([a-z_]+)\s*=\s*\$(\d+)/g)
        for (const [, key, position] of assignments) state.invoice[key] = params[Number(position) - 1]
        state.writes.push({ text, params })
        return { rows: [{ ...state.invoice }] }
      }
      if (text.includes('UPDATE billing_payment') || text.includes('UPDATE billing_monthly_invoice')) {
        state.writes.push({ text, params })
        return { rows: [] }
      }
      throw new Error(`Unexpected invoice settlement query: ${text}`)
    },
  }
  return {
    state,
    query: (...args) => client.query(...args),
    connect: async () => client,
  }
}

function paymentAuthority(overrides = {}) {
  return {
    id: 91,
    billing_migration_run_id: 81,
    family_billing_account_id: 8,
    state: 'verified',
    payer_validation_status: 'verified',
    parity_status: 'matched',
    target_collection_mode: 'household_monthly',
    cutover_month: '2026-09-01',
    parity_snapshot: {},
    verified_at: new Date('2026-08-31T12:00:00.000Z'),
    run_mode: 'apply',
    run_status: 'completed',
    migration_key: 'canonical-household-billing-v1',
    code_version: 'test-release',
    manifest_checksum: 'a'.repeat(64),
    run_target_month: '2026-09-01',
    run_configuration: { accountIds: [8] },
    snapshot_hash: 'b'.repeat(64),
    accepted_snapshot_hash: 'b'.repeat(64),
    accepted_baseline_version: 1,
    account_is_active: true,
    account_household_enabled: true,
    account_stripe_customer_id: 'cus_8',
    account_facility_timezone: 'America/New_York',
    ...overrides,
  }
}

function resumePool({
  status = 'draft',
  stripeInvoiceId = 'in_42',
  stripePaymentIntentId = null,
  paymentAttemptedAt = null,
  secondStripeInvoiceItemId = 'ii_102',
  billingMonth = '2026-09-01',
} = {}) {
  const invoice = {
    id: 42,
    family_billing_account_id: 8,
    billing_month: billingMonth,
    status,
    subtotal_cents: 25000,
    credit_cents: 0,
    total_cents: 25000,
    stripe_invoice_id: stripeInvoiceId,
    stripe_payment_intent_id: stripePaymentIntentId,
    payment_attempted_at: paymentAttemptedAt,
  }
  const lines = [
    {
      id: 101,
      billing_monthly_invoice_id: 42,
      billing_charge_id: 501,
      member_id: 11,
      line_type: 'charge',
      description: 'Tornadoes Monday',
      amount_cents: 12000,
      stripe_invoice_item_id: 'ii_101',
    },
    {
      id: 102,
      billing_monthly_invoice_id: 42,
      billing_charge_id: 502,
      member_id: 11,
      line_type: 'charge',
      description: 'Tornadoes Wednesday',
      amount_cents: 13000,
      stripe_invoice_item_id: secondStripeInvoiceItemId,
    },
  ]
  const calls = []
  const paymentApplications = []
  const pool = {
    invoice,
    lines,
    calls,
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ sql: text, params })
      if (text.includes('FROM family_billing_account') && text.includes('FOR UPDATE')) {
        return {
          rows: [{
            id: 8,
            family_id: 6,
            billing_email: 'payer@example.com',
            stripe_customer_id: 'cus_8',
            stripe_customer_owner_count: 1,
            is_active: true,
          }],
        }
      }
      if (text.includes('household-paid:account')) {
        return {
          rows: [{
            id: 8,
            stripe_customer_id: 'cus_8',
            stripe_customer_owner_count: 1,
            is_active: true,
          }],
        }
      }
      if (text.includes('stripe-webhook:customer-owner')) {
        return { rows: [{ id: 8 }] }
      }
      if (text.includes('billing_account_migration migration')) {
        return { rows: [paymentAuthority()] }
      }
      if (text.includes('household-payment:invoice-structure')) {
        return { rows: [{ ...invoice }] }
      }
      if (text.includes('household-payment:invoice-lines')) {
        return { rows: lines.map((line) => ({ ...line })) }
      }
      if (text.includes('SELECT * FROM billing_monthly_invoice WHERE stripe_invoice_id')) {
        return String(params[0]) === String(invoice.stripe_invoice_id)
          ? { rows: [{ ...invoice }] }
          : { rows: [] }
      }
      if (text.includes('SELECT * FROM billing_monthly_invoice WHERE id = $1 FOR UPDATE')) {
        return Number(params[0]) === Number(invoice.id)
          ? { rows: [{ ...invoice }] }
          : { rows: [] }
      }
      if (
        text.includes('SELECT * FROM billing_monthly_invoice')
        && text.includes('family_billing_account_id = $1 AND billing_month = $2::date')
      ) {
        return { rows: [{ ...invoice }] }
      }
      if (text.includes('FROM billing_monthly_invoice_line') && text.includes('ORDER BY id')) {
        return { rows: lines.map((line) => ({ ...line })) }
      }
      if (text.includes('FROM billing_payment_application') && text.includes('WHERE billing_payment_id = $1')) {
        return { rows: paymentApplications.map((application) => ({ ...application })) }
      }
      if (text.includes('FROM billing_charge_credit_application application')) return { rows: [] }
      if (text.includes('INSERT INTO billing_payment_application')) {
        const key = params[3]
        if (!paymentApplications.some((application) => application.idempotency_key === key)) {
          paymentApplications.push({
            id: 900 + paymentApplications.length,
            billing_payment_id: params[0],
            billing_charge_id: params[1],
            amount_cents: params[2],
            application_kind: 'application',
            idempotency_key: key,
            reverses_application_id: null,
          })
        }
        return { rows: [] }
      }
      if (text.includes('UPDATE billing_monthly_invoice_line') && text.includes('stripe_invoice_item_id = $2')) {
        const line = lines.find((item) => item.id === Number(params[0]))
        if (!line || (line.stripe_invoice_item_id && line.stripe_invoice_item_id !== params[1])) return { rows: [] }
        line.stripe_invoice_item_id = params[1]
        return { rows: [{ ...line }] }
      }
      if (/INSERT INTO billing_payment\s*\(/.test(text)) {
        return {
          rows: [{
            id: 801,
            family_billing_account_id: 8,
            amount_cents: Number(params[1]),
            paid_at: params[2],
            method: params[3],
            external_processor: 'stripe',
            external_status: 'settled',
            stripe_customer_id: params[5],
            stripe_payment_intent_id: params[6],
            stripe_invoice_id: params[4],
          }],
        }
      }
      if (text.includes('UPDATE billing_monthly_invoice') && text.includes('RETURNING *')) {
        if (Number(params[0]) !== invoice.id) return { rows: [] }
        if (
          text.includes('stripe_invoice_id IS NULL OR stripe_invoice_id = $2')
          && invoice.stripe_invoice_id
          && invoice.stripe_invoice_id !== params[1]
        ) return { rows: [] }
        const assignments = text.slice(text.indexOf('SET') + 3, text.indexOf('WHERE')).matchAll(/([a-z_]+)\s*=\s*\$(\d+)/g)
        for (const [, key, position] of assignments) invoice[key] = params[Number(position) - 1]
        return { rows: [{ ...invoice }] }
      }
      return { rows: [] }
    },
  }
  return pool
}

function stripeFixture({
  remoteStatus = 'draft',
  discoverOnly = false,
  payError = null,
  payErrorAfterRemotePaid = null,
  paymentIntentStatus = 'requires_payment_method',
  collectionMethod = 'charge_automatically',
  hasPaymentMethod = true,
  defaultPaymentMethod = undefined,
  paidAt = 1_800_000_000,
} = {}) {
  const calls = []
  const payRequests = []
  const invoiceCreateRequests = []
  let remoteExists = discoverOnly
  const configuredPaymentMethod = defaultPaymentMethod === undefined
    ? {
        id: 'pm_8',
        type: 'card',
        customer: 'cus_8',
        card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
      }
    : defaultPaymentMethod
  const remote = {
    id: 'in_42',
    customer: 'cus_8',
    status: remoteStatus,
    paid: remoteStatus === 'paid',
    collection_method: collectionMethod,
    auto_advance: false,
    currency: 'usd',
    subtotal: 25000,
    total: 25000,
    amount_due: 25000,
    amount_paid: remoteStatus === 'paid' ? 25000 : 0,
    amount_remaining: remoteStatus === 'paid' ? 0 : 25000,
    amount_overpaid: 0,
    starting_balance: 0,
    pre_payment_credit_notes_amount: 0,
    post_payment_credit_notes_amount: 0,
    total_discount_amounts: [],
    total_taxes: [],
    total_pretax_credit_amounts: [],
    discounts: [],
    default_tax_rates: [],
    shipping_cost: null,
    automatic_tax: { enabled: false },
    status_transitions: { paid_at: paidAt },
    hosted_invoice_url: 'https://stripe.test/in_42',
    metadata: {
      householdMonthlyInvoice: 'true',
      monthlyInvoiceId: '42',
      familyBillingAccountId: '8',
      billingMonth: '2026-09',
    },
  }
  const items = [
    {
      id: 'ii_101',
      amount: 12000,
      currency: 'usd',
      customer: 'cus_8',
      invoice: 'in_42',
      metadata: {
        monthlyInvoiceId: '42',
        monthlyInvoiceLineId: '101',
        billingChargeId: '501',
        lineType: 'charge',
      },
    },
    {
      id: 'ii_102',
      amount: 13000,
      currency: 'usd',
      customer: 'cus_8',
      invoice: 'in_42',
      metadata: {
        monthlyInvoiceId: '42',
        monthlyInvoiceLineId: '102',
        billingChargeId: '502',
        lineType: 'charge',
      },
    },
  ]
  const invoiceLines = items.map((item) => ({
    id: item.id.replace(/^ii_/, 'il_'),
    amount: item.amount,
    subtotal: item.amount,
    currency: item.currency,
    invoice: item.invoice,
    metadata: { ...item.metadata },
    parent: {
      type: 'invoice_item_details',
      invoice_item_details: { invoice_item: item.id },
      subscription_item_details: null,
    },
    discount_amounts: [],
    taxes: [],
    pretax_credit_amounts: [],
  }))
  const invoicePayments = [{
    id: 'inpay_42',
    invoice: 'in_42',
    is_default: true,
    status: 'open',
    amount_requested: 25000,
    amount_paid: null,
    currency: 'usd',
    payment: { type: 'payment_intent', payment_intent: 'pi_42' },
  }]
  const stripe = {
    calls,
    payRequests,
    invoiceCreateRequests,
    customers: {
      async retrieve() {
        calls.push('customers.retrieve')
        return {
          id: 'cus_8',
          deleted: false,
          invoice_settings: {
            default_payment_method: hasPaymentMethod ? structuredClone(configuredPaymentMethod) : null,
          },
        }
      },
    },
    paymentMethods: {
      async list() {
        calls.push('paymentMethods.list')
        return { data: [], has_more: false }
      },
    },
    paymentIntents: {
      async retrieve(id) {
        calls.push('paymentIntents.retrieve')
        return {
          id,
          status: remote.status === 'paid'
            ? 'succeeded'
            : (id === 'pi_42' ? 'requires_payment_method' : paymentIntentStatus),
          customer: 'cus_8',
          currency: 'usd',
          amount: 25000,
          amount_received: remote.status === 'paid' ? 25000 : 0,
        }
      },
    },
    invoicePayments: {
      async list() {
        calls.push('invoicePayments.list')
        return {
          data: invoicePayments.map((payment) => remote.status === 'paid'
            ? { ...payment, status: 'paid', amount_paid: 25000 }
            : { ...payment }),
          has_more: false,
        }
      },
    },
    subscriptions: {
      async list() { calls.push('subscriptions.list'); return { data: [], has_more: false } },
    },
    subscriptionSchedules: {
      async list() { calls.push('subscriptionSchedules.list'); return { data: [], has_more: false } },
    },
    invoices: {
      async retrieve() { calls.push('invoices.retrieve'); remoteExists = true; return { ...remote } },
      async search() { calls.push('invoices.search'); return { data: discoverOnly ? [{ ...remote }] : [], has_more: false } },
      async list() { calls.push('invoices.list'); return { data: remoteExists ? [{ ...remote }] : [], has_more: false } },
      async listLineItems() { calls.push('invoices.listLineItems'); return { data: invoiceLines.map((line) => structuredClone(line)), has_more: false } },
      async create(params) {
        calls.push('invoices.create')
        invoiceCreateRequests.push(structuredClone(params))
        remoteExists = true
        return { ...remote, status: 'draft' }
      },
      async finalizeInvoice() { calls.push('invoices.finalize'); remote.status = 'open'; return { ...remote } },
      async pay(invoiceId, params, options) {
        calls.push('invoices.pay')
        payRequests.push({ invoiceId, params, options })
        if (payErrorAfterRemotePaid) {
          remote.status = 'paid'
          remote.paid = true
          remote.amount_paid = 25000
          remote.amount_remaining = 0
          throw payErrorAfterRemotePaid
        }
        if (payError) throw payError
        return { ...remote, paid: false, payment_intent: 'pi_42' }
      },
    },
    invoiceItems: {
      async list() { calls.push('invoiceItems.list'); return { data: items.map((item) => ({ ...item })), has_more: false } },
      async create() { calls.push('invoiceItems.create'); throw new Error('No invoice item should be duplicated.') },
    },
  }
  return stripe
}

function paymentBoundaryInput(stripe = stripeFixture({ discoverOnly: true, remoteStatus: 'open' })) {
  return {
    account: {
      id: 8,
      stripe_customer_id: 'cus_8',
      facility_timezone: 'America/New_York',
    },
    invoice: {
      id: 42,
      billing_month: '2026-09-01',
    },
    stripe,
    stripeInvoiceId: 'in_42',
    stripeCustomerId: 'cus_8',
    billingMonth: '2026-09-01',
    facilityTimeZone: 'America/New_York',
    now: new Date('2026-09-01T04:00:00.000Z'),
  }
}

test('household payment boundary accepts only a fully verified durable migration', async () => {
  const pool = resumePool({ status: 'open' })
  const stripe = stripeFixture({ discoverOnly: true, remoteStatus: 'open' })
  const result = await assertHouseholdPaymentBoundary(pool, paymentBoundaryInput(stripe))

  assert.equal(result.migration.state, 'verified')
  assert.equal(result.subscriptions.snapshot.liveSubscriptionCount, 0)
  assert.equal(result.schedules.snapshot.liveScheduleCount, 0)
  assert.equal(result.collectors.snapshot.collectorCount, 1)
  assert.equal(stripe.calls.includes('invoices.list'), true)
  assert.equal(pool.calls.some(({ sql }) => sql.includes('billing_account_migration migration')), true)
  const authority = pool.calls.find(({ sql }) => sql.includes('billing_account_migration migration'))
  assert.match(authority.sql, /invoice\.status = 'open'/)
  assert.match(authority.sql, /migration\.state = 'verified'/)
  assert.match(authority.sql, /migration\.lease_expires_at > now\(\)/)
  assert.match(authority.sql, /account\.stripe_customer_id = \$5/)
  assert.match(authority.sql, /customer_owner\.id <> account\.id/)
  assert.doesNotMatch(authority.sql, /customer_owner\.is_active/)
  assert.match(authority.sql, /run\.facility_timezone = facility\.timezone/)
  assert.match(authority.sql, /accepted_account_snapshot ->> 'payerMemberId'/)
  assert.match(authority.sql, /accepted_account_snapshot ->> 'stripeCustomerId' = account\.stripe_customer_id/)
  assert.match(authority.sql, /boundary\.effective_month <=\s+date_trunc\('month', now\(\) AT TIME ZONE facility\.timezone\)::date/)
  assert.match(authority.sql, /invoice\.billing_month <=\s+date_trunc\('month', now\(\) AT TIME ZONE facility\.timezone\)::date/)
  assert.deepEqual(authority.params.slice(0, 7), [
    8,
    42,
    '2026-09-01',
    'in_42',
    'cus_8',
    'America/New_York',
    false,
  ])
  assert.equal(authority.params[10], true)
})

test('a household invoice cannot be finalized or exposed before publication authority is exact', async () => {
  const pool = resumePool()
  const originalQuery = pool.query.bind(pool)
  pool.query = async (sql, params = []) => {
    if (String(sql).includes('billing_account_migration migration') && params[10] === false) {
      return { rows: [] }
    }
    return originalQuery(sql, params)
  }
  const stripe = stripeFixture({ hasPaymentMethod: false })

  await assert.rejects(
    createHouseholdMonthlyInvoice(pool, {
      account: {
        id: 8,
        family_id: 6,
        stripe_customer_id: 'cus_8',
        facility_timezone: 'America/New_York',
        household_monthly_billing_enabled: true,
      },
      billingMonth: '2026-09-01',
      environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
      stripeClient: stripe,
    }),
    /publication was blocked because verified canonical migration authority is missing, changed, or not yet effective/,
  )

  assert.equal(stripe.calls.includes('invoices.finalize'), false)
  assert.equal(stripe.calls.includes('invoices.pay'), false)
  assert.equal(pool.invoice.status, 'draft')
  assert.equal(pool.invoice.hosted_invoice_url, null)
})

test('household payment boundary blocks direct callers without verified migration evidence', async () => {
  const pool = resumePool({ status: 'open' })
  const originalQuery = pool.query.bind(pool)
  pool.query = async (sql, params = []) => {
    if (String(sql).includes('billing_account_migration migration')) return { rows: [] }
    return originalQuery(sql, params)
  }
  const stripe = stripeFixture({ discoverOnly: true, remoteStatus: 'open' })

  await assert.rejects(
    assertHouseholdPaymentBoundary(pool, paymentBoundaryInput(stripe)),
    /verified canonical migration authority is missing or expired/,
  )
  assert.equal(stripe.calls.includes('invoices.pay'), false)
})

test('paid settlement records exact historical cash and alerts when current account authority drifted', async () => {
  const scenarios = [
    {
      name: 'shared customer',
      account: { id: 8, stripe_customer_id: 'cus_8', stripe_customer_owner_count: 2, is_active: true },
    },
    {
      name: 'inactive account',
      account: { id: 8, stripe_customer_id: 'cus_8', stripe_customer_owner_count: 1, is_active: false },
    },
    {
      name: 'remapped customer',
      account: { id: 8, stripe_customer_id: 'cus_replacement', stripe_customer_owner_count: 1, is_active: true },
    },
    { name: 'missing account', account: null },
  ]

  for (const scenario of scenarios) {
    const pool = resumePool({ status: 'open' })
    const originalQuery = pool.query.bind(pool)
    pool.query = async (sql, params = []) => {
      if (String(sql).includes('household-paid:account')) {
        return { rows: scenario.account ? [{ ...scenario.account }] : [] }
      }
      return originalQuery(sql, params)
    }

    const result = await recordAndApplyHouseholdMonthlyInvoicePayment(pool, {
      invoice: {
        id: 'in_42',
        status: 'paid',
        customer: 'cus_stale_event',
        amount_paid: 1,
        status_transitions: { paid_at: 1 },
      },
      stripe: stripeFixture({ remoteStatus: 'paid' }),
    })

    assert.equal(result?.conflicted, false, scenario.name)
    assert.equal(result?.payment?.family_billing_account_id, 8, scenario.name)
    assert.equal(result?.payment?.stripe_customer_id, 'cus_8', scenario.name)
    assert.equal(result?.payment?.paid_at?.toISOString(), '2027-01-15T08:00:00.000Z', scenario.name)
    assert.equal(pool.invoice.status, 'paid', scenario.name)
    assert.equal(pool.invoice.paid_at?.toISOString(), '2027-01-15T08:00:00.000Z', scenario.name)
    assert.equal(
      pool.calls.some(({ sql }) => sql.includes('INSERT INTO stripe_billing_alert')),
      true,
      scenario.name,
    )
    assert.equal(
      pool.calls.some(({ sql }) => sql.includes('stripe-webhook:customer-owner')),
      false,
      scenario.name,
    )
  }
})

test('household payment boundary blocks any live Stripe subscription before checking authority', async () => {
  const pool = resumePool()
  const stripe = stripeFixture({ discoverOnly: true })
  stripe.subscriptions.list = async () => ({
    data: [{
      id: 'sub_legacy',
      status: 'active',
      customer: 'cus_8',
      metadata: { perClassSubscription: 'true', familyBillingAccountId: '8' },
      items: { data: [] },
    }],
    has_more: false,
  })

  await assert.rejects(
    assertHouseholdPaymentBoundary(pool, paymentBoundaryInput(stripe)),
    /another recurring or target-month collector/,
  )
  assert.equal(pool.calls.some(({ sql }) => sql.includes('billing_account_migration migration')), false)
})

test('household payment boundary samples schedules before subscriptions so a release cannot escape both inventories', async () => {
  const pool = resumePool()
  const stripe = stripeFixture({ discoverOnly: true })
  let scheduleSampled = false
  stripe.subscriptionSchedules.list = async () => {
    stripe.calls.push('subscriptionSchedules.list')
    scheduleSampled = true
    return {
      data: [{ id: 'sub_sched_released', status: 'released', customer: 'cus_8' }],
      has_more: false,
    }
  }
  stripe.subscriptions.list = async () => {
    stripe.calls.push('subscriptions.list')
    return {
      data: scheduleSampled ? [{
        id: 'sub_released_during_boundary',
        status: 'active',
        customer: 'cus_8',
        metadata: { perClassSubscription: 'true', familyBillingAccountId: '8' },
        items: { data: [] },
      }] : [],
      has_more: false,
    }
  }

  await assert.rejects(
    assertHouseholdPaymentBoundary(pool, paymentBoundaryInput(stripe)),
    /another recurring or target-month collector/,
  )
  assert.ok(
    stripe.calls.indexOf('subscriptionSchedules.list') < stripe.calls.indexOf('subscriptions.list'),
  )
  assert.equal(pool.calls.some(({ sql }) => sql.includes('billing_account_migration migration')), false)
})

test('migration saga authority is exact, leased, and limited to its effective first collection month', async () => {
  const pool = resumePool({ status: 'open' })
  const originalQuery = pool.query.bind(pool)
  pool.query = async (sql, params = []) => {
    if (String(sql).includes('billing_account_migration migration')) {
      const exactSaga = params[6] === true
        && Number(params[7]) === 91
        && Number(params[8]) === 81
        && params[9] === 'migration-worker-1'
      return { rows: exactSaga ? [paymentAuthority({
        state: 'household_active',
        verified_at: null,
        run_status: 'running',
        lease_owner: 'migration-worker-1',
        lease_expires_at: new Date('2026-09-01T05:00:00.000Z'),
      })] : [] }
    }
    return originalQuery(sql, params)
  }
  const input = paymentBoundaryInput(stripeFixture({ discoverOnly: true, remoteStatus: 'open' }))
  input.migrationAuthorization = {
    migrationId: 91,
    runId: 81,
    leaseOwner: 'migration-worker-1',
    effectiveCollectionMonth: '2026-09-01',
  }

  const result = await assertHouseholdPaymentBoundary(pool, input)
  assert.equal(result.migration.state, 'household_active')

  await assert.rejects(
    assertHouseholdPaymentBoundary(pool, {
      ...input,
      migrationAuthorization: { ...input.migrationAuthorization, leaseOwner: 'different-worker' },
    }),
    /verified canonical migration authority is missing or expired/,
  )
})

test('household invoices use the facility month rather than the UTC month', () => {
  assert.equal(billingMonthStart(new Date('2026-10-01T00:00:00.000Z'), 'America/New_York'), '2026-09-01')
  assert.equal(billingMonthStart(new Date('2026-10-01T04:00:00.000Z'), 'America/New_York'), '2026-10-01')
  assert.equal(billingMonthStart(new Date('2026-09-30T11:00:00.000Z'), 'Pacific/Kiritimati'), '2026-10-01')
  assert.equal(billingMonthStart('2026-10-01', 'America/New_York'), '2026-10-01')
  assert.throws(() => billingMonthStart(new Date(), null), /valid facility timezone/)
})

test('Stripe invoice metadata normalizes PostgreSQL Date billing months', async () => {
  const pool = resumePool({
    stripeInvoiceId: null,
    billingMonth: new Date('2026-09-01T00:00:00.000Z'),
  })
  const stripe = stripeFixture()

  await createHouseholdMonthlyInvoice(pool, {
    account: {
      id: 8,
      family_id: 6,
      stripe_customer_id: 'cus_8',
      facility_timezone: 'America/New_York',
      household_monthly_billing_enabled: true,
    },
    billingMonth: '2026-09-01',
    environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
    stripeClient: stripe,
  })

  assert.equal(stripe.invoiceCreateRequests.length, 1)
  assert.equal(stripe.invoiceCreateRequests[0].metadata.billingMonth, '2026-09')
  assert.match(stripe.invoiceCreateRequests[0].description, /2026-09$/)
})

test('household payment preparation precedes BEGIN and a crash barrier rolls back its local insert', async () => {
  const pool = invoiceSettlementPool()
  await assert.rejects(
    recordAndApplyHouseholdMonthlyInvoicePayment(pool, {
      invoice: { id: 'in_71', paid: true, amount_paid: 5000, payment_intent: 'pi_71' },
      preparePaymentFunction: async () => {
        pool.state.events.push('prepare')
        return { accountId: 8, amountCents: 5000, invoiceId: 'in_71', subscriptionId: null }
      },
      recordPaymentFunction: async (_db, prepared) => {
        pool.state.events.push('record')
        const payment = {
          id: 74,
          family_billing_account_id: prepared.accountId,
          amount_cents: prepared.amountCents,
          stripe_payment_intent_id: 'pi_71',
          external_status: 'settled',
        }
        pool.state.payments.push(payment)
        return payment
      },
      beforeMapping: async () => {
        pool.state.events.push('barrier')
        throw new Error('simulated invoice settlement interruption')
      },
      finishSettlementFunction: async () => {},
    }),
    /simulated invoice settlement interruption/,
  )
  assert.deepEqual(pool.state.events.slice(0, 4), ['prepare', 'begin', 'record', 'barrier'])
  assert.deepEqual(pool.state.payments, [])
  assert.equal(pool.state.invoice.status, 'open')
})

test('invoice.paid replay after refund verifies original lines without reapplying or quarantining', async () => {
  const exactKey = 'monthly-invoice:71:payment:74:line:72'
  const pool = invoiceSettlementPool({
    status: 'paid',
    applications: [
      {
        id: 80,
        billing_charge_id: 73,
        amount_cents: 5000,
        application_kind: 'application',
        idempotency_key: exactKey,
        reverses_application_id: null,
      },
      {
        id: 81,
        billing_charge_id: 73,
        amount_cents: 5000,
        application_kind: 'reversal',
        idempotency_key: 'refund:12:application:80',
        reverses_application_id: 80,
      },
    ],
  })
  const payment = {
    id: 74,
    family_billing_account_id: 8,
    amount_cents: 5000,
    stripe_payment_intent_id: 'pi_71',
    external_status: 'settled',
    newly_inserted: false,
  }
  pool.state.payments.push(payment)
  const result = await recordAndApplyHouseholdMonthlyInvoicePayment(pool, {
    invoice: { id: 'in_71', paid: true, amount_paid: 5000, payment_intent: 'pi_71' },
    preparePaymentFunction: async () => ({ accountId: 8, amountCents: 5000, invoiceId: 'in_71', subscriptionId: null }),
    recordPaymentFunction: async () => payment,
    finishSettlementFunction: async () => {},
  })

  assert.equal(result.conflicted, false)
  assert.equal(result.invoice.status, 'paid')
  assert.equal(payment.external_status, 'settled')
  assert.deepEqual(pool.state.writes, [])
})

test('paid invoice replay accepts exact append-only canonical repair mappings', async () => {
  const pool = invoiceSettlementPool({
    status: 'paid',
    invoice: {
      subtotal_cents: 10000,
      credit_cents: 3000,
      total_cents: 7000,
    },
    lines: [
      {
        id: 72,
        billing_monthly_invoice_id: 71,
        billing_charge_id: 73,
        line_type: 'charge',
        amount_cents: 10000,
      },
      {
        id: 75,
        billing_monthly_invoice_id: 71,
        billing_charge_id: 76,
        related_charge_id: 73,
        line_type: 'credit',
        amount_cents: -3000,
      },
    ],
    applications: [
      {
        id: 80,
        billing_charge_id: 73,
        amount_cents: 10000,
        application_kind: 'application',
        idempotency_key: 'monthly-invoice:71:payment:74:line:72',
        reverses_application_id: null,
        allocation_reason: 'monthly_invoice_line',
      },
      {
        id: 81,
        billing_charge_id: 73,
        amount_cents: 10000,
        application_kind: 'reversal',
        idempotency_key: 'monthly-invoice:71:canonical-repair:reverse:80',
        reverses_application_id: 80,
        allocation_reason: 'monthly_invoice_credit_mapping_repair',
      },
      {
        id: 82,
        billing_charge_id: 73,
        amount_cents: 7000,
        application_kind: 'application',
        idempotency_key: 'monthly-invoice:71:canonical-repair:line:72',
        reverses_application_id: null,
        allocation_reason: 'monthly_invoice_credit_mapping_repair',
      },
      {
        id: 83,
        billing_charge_id: 99,
        amount_cents: 1000,
        application_kind: 'application',
        idempotency_key: 'allocation:legacy:83',
        reverses_application_id: null,
        allocation_reason: 'general',
      },
      {
        id: 84,
        billing_charge_id: 99,
        amount_cents: 1000,
        application_kind: 'reversal',
        idempotency_key: 'monthly-invoice:71:canonical-repair:reverse:83',
        reverses_application_id: 83,
        allocation_reason: 'monthly_invoice_credit_mapping_repair',
      },
    ],
    creditApplications: [{
      id: 90,
      credit_invoice_line_id: 75,
      target_invoice_line_id: 72,
      amount_cents: 3000,
      idempotency_key: 'monthly-invoice:71:credit:75:target:72',
      credit_billing_charge_id: 76,
      target_billing_charge_id: 73,
    }],
  })
  const payment = {
    id: 74,
    family_billing_account_id: 8,
    amount_cents: 7000,
    stripe_payment_intent_id: 'pi_71',
    external_status: 'settled',
    newly_inserted: false,
  }
  pool.state.payments.push(payment)

  const result = await recordAndApplyHouseholdMonthlyInvoicePayment(pool, {
    invoice: { id: 'in_71', status: 'paid', amount_paid: 7000, payment_intent: 'pi_71' },
    preparePaymentFunction: async () => ({ accountId: 8, amountCents: 7000, invoiceId: 'in_71', subscriptionId: null }),
    recordPaymentFunction: async () => payment,
    finishSettlementFunction: async () => {},
  })

  assert.equal(result.conflicted, false)
  assert.equal(result.invoice.status, 'paid')
  assert.deepEqual(pool.state.writes, [])
})

test('paid invoice replay rejects an unrelated active payment allocation', async () => {
  const pool = invoiceSettlementPool({
    status: 'paid',
    applications: [
      {
        id: 80,
        billing_charge_id: 73,
        amount_cents: 5000,
        application_kind: 'application',
        idempotency_key: 'monthly-invoice:71:payment:74:line:72',
        reverses_application_id: null,
      },
      {
        id: 81,
        billing_charge_id: 99,
        amount_cents: 100,
        application_kind: 'application',
        idempotency_key: 'allocation:unrelated:81',
        reverses_application_id: null,
      },
    ],
  })
  const payment = {
    id: 74,
    family_billing_account_id: 8,
    amount_cents: 5000,
    stripe_payment_intent_id: 'pi_71',
    external_status: 'settled',
    newly_inserted: false,
  }
  pool.state.payments.push(payment)

  const result = await recordAndApplyHouseholdMonthlyInvoicePayment(pool, {
    invoice: { id: 'in_71', status: 'paid', amount_paid: 5000, payment_intent: 'pi_71' },
    preparePaymentFunction: async () => ({ accountId: 8, amountCents: 5000, invoiceId: 'in_71', subscriptionId: null }),
    recordPaymentFunction: async () => payment,
    finishSettlementFunction: async () => {},
  })

  assert.equal(result.conflicted, true)
  assert.match(result.reason, /unrelated active payment application/)
})

test('paid invoice replay rejects a reversal that does not match its original charge', async () => {
  const pool = invoiceSettlementPool({
    status: 'paid',
    applications: [
      {
        id: 80,
        billing_charge_id: 73,
        amount_cents: 5000,
        application_kind: 'application',
        idempotency_key: 'monthly-invoice:71:payment:74:line:72',
        reverses_application_id: null,
      },
      {
        id: 81,
        billing_charge_id: 99,
        amount_cents: 5000,
        application_kind: 'reversal',
        idempotency_key: 'refund:12:application:80',
        reverses_application_id: 80,
        allocation_reason: 'refund_reversal',
      },
    ],
  })
  const payment = {
    id: 74,
    family_billing_account_id: 8,
    amount_cents: 5000,
    stripe_payment_intent_id: 'pi_71',
    external_status: 'settled',
    newly_inserted: false,
  }
  pool.state.payments.push(payment)

  const result = await recordAndApplyHouseholdMonthlyInvoicePayment(pool, {
    invoice: { id: 'in_71', status: 'paid', amount_paid: 5000, payment_intent: 'pi_71' },
    preparePaymentFunction: async () => ({ accountId: 8, amountCents: 5000, invoiceId: 'in_71', subscriptionId: null }),
    recordPaymentFunction: async () => payment,
    finishSettlementFunction: async () => {},
  })

  assert.equal(result.conflicted, true)
  assert.match(result.reason, /invalid payment reversal provenance/)
})

test('paid net invoice durably allocates its credit and replay is idempotent', async () => {
  const pool = invoiceSettlementPool({
    invoice: {
      subtotal_cents: 10000,
      credit_cents: 3000,
      total_cents: 7000,
    },
    lines: [
      {
        id: 72,
        billing_monthly_invoice_id: 71,
        billing_charge_id: 73,
        line_type: 'charge',
        amount_cents: 10000,
      },
      {
        id: 75,
        billing_monthly_invoice_id: 71,
        billing_charge_id: 76,
        related_charge_id: 73,
        line_type: 'credit',
        amount_cents: -3000,
      },
    ],
  })
  const payment = {
    id: 74,
    family_billing_account_id: 8,
    amount_cents: 7000,
    stripe_payment_intent_id: 'pi_71',
    external_status: 'settled',
  }
  const options = {
    invoice: { id: 'in_71', paid: true, amount_paid: 7000, payment_intent: 'pi_71' },
    preparePaymentFunction: async () => ({
      accountId: 8,
      amountCents: 7000,
      invoiceId: 'in_71',
      subscriptionId: null,
    }),
    recordPaymentFunction: async () => payment,
    finishSettlementFunction: async () => {},
  }

  const settled = await recordAndApplyHouseholdMonthlyInvoicePayment(pool, options)
  assert.equal(settled.conflicted, false)
  assert.equal(settled.invoice.status, 'paid')
  assert.deepEqual(pool.state.creditApplications.map((application) => ({
    creditLineId: application.credit_invoice_line_id,
    targetLineId: application.target_invoice_line_id,
    amountCents: application.amount_cents,
  })), [{ creditLineId: 75, targetLineId: 72, amountCents: 3000 }])
  assert.deepEqual(pool.state.applications.map((application) => ({
    chargeId: application.billing_charge_id,
    amountCents: application.amount_cents,
  })), [{ chargeId: 73, amountCents: 7000 }])

  const writeCount = pool.state.writes.length
  const replay = await recordAndApplyHouseholdMonthlyInvoicePayment(pool, options)
  assert.equal(replay.conflicted, false)
  assert.equal(pool.state.creditApplications.length, 1)
  assert.equal(pool.state.applications.length, 1)
  assert.equal(pool.state.writes.length, writeCount)
})

test('generic activation requires the canonical migration and never flips account state', async () => {
  const calls = []
  const pool = {
    async query(sql) {
      const text = String(sql)
      calls.push(text)
      if (text.includes('SELECT * FROM family_billing_account')) {
        return { rows: [{ id: 8, family_id: 6, stripe_customer_id: 'cus_8', household_monthly_billing_enabled: false }] }
      }
      if (text.includes('FROM billing_account_migration')) return { rows: [] }
      return { rows: [] }
    },
  }
  const stripe = {
    customers: {
      retrieve: async () => { throw new Error('Generic activation must not inspect Stripe.') },
    },
  }

  const result = await activateHouseholdMonthlyBillingForAccount(pool, {
    accountId: 8,
    stripe,
    environment: { BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED: 'true' },
  })

  assert.deepEqual(result, { status: 'canonical_migration_required', enabled: false })
  assert.equal(calls.some((sql) => sql.includes('UPDATE family_billing_account')), false)
})

test('an already-enabled historical household remains readable without generic mutation', async () => {
  let stripeRead = false
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('SELECT * FROM family_billing_account')) {
        return { rows: [{ id: 8, family_id: 6, stripe_customer_id: 'cus_8', household_monthly_billing_enabled: true }] }
      }
      if (text.includes('FROM billing_account_migration')) return { rows: [] }
      return { rows: [] }
    },
  }
  const stripe = {
    customers: { retrieve: async () => { stripeRead = true; return {} } },
  }
  const result = await activateHouseholdMonthlyBillingForAccount(pool, {
    accountId: 8,
    stripe,
    environment: { BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED: 'true' },
  })
  assert.deepEqual(result, { status: 'already_enabled', enabled: true })
  assert.equal(stripeRead, false)
})

test('household billing activation is disabled unless explicitly enabled', async () => {
  let queried = false
  const pool = { async query() { queried = true; return { rows: [] } } }
  const result = await activateHouseholdMonthlyBillingForAccount(pool, {
    accountId: 8,
    stripe: {},
    environment: {},
  })
  assert.deepEqual(result, { status: 'feature_disabled', enabled: false })
  assert.equal(queried, false)
})

test('every nonterminal canonical migration state owns household activation', async () => {
  const migrationStates = [
    'discovered',
    'repairing',
    'blocked',
    'shadow_verified',
    'armed',
    'cancellation_scheduled',
    'detached',
    'remote_retired',
    'household_active',
    'rollback_pending',
    'failed_forward_only',
  ]
  for (const state of migrationStates) {
    const calls = []
    const pool = {
      async query(sql) {
        const text = String(sql)
        calls.push(text)
        if (text.includes('SELECT * FROM family_billing_account')) {
          return {
            rows: [{
              id: 8,
              household_monthly_billing_enabled: state === 'household_active',
            }],
          }
        }
        if (text.includes('FROM billing_account_migration')) {
          return { rows: [{ id: 19, billing_migration_run_id: 7, state }] }
        }
        throw new Error(`Auto-activation continued past migration guard in ${state}: ${text}`)
      },
    }

    const result = await activateHouseholdMonthlyBillingForAccount(pool, {
      accountId: 8,
      stripe: { customers: { retrieve: async () => { throw new Error('Stripe must not be read.') } } },
      environment: { BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED: 'true' },
    })

    assert.deepEqual(result, {
      status: 'migration_managed',
      enabled: state === 'household_active',
      migrationId: 19,
      migrationRunId: 7,
      migrationState: state,
    })
    assert.equal(calls.some((sql) => sql.includes('UPDATE family_billing_account')), false)
  }
})

test('an account without migration evidence remains disabled', async () => {
  let updated = false
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('SELECT * FROM family_billing_account')) {
        return { rows: [{ id: 8, family_id: 6, stripe_customer_id: 'cus_8', household_monthly_billing_enabled: false }] }
      }
      if (text.includes('FROM billing_account_migration')) return { rows: [] }
      if (text.includes('UPDATE family_billing_account')) updated = true
      return { rows: [] }
    },
  }

  const result = await activateHouseholdMonthlyBillingForAccount(pool, {
    accountId: 8,
    environment: { BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED: 'true' },
  })

  assert.deepEqual(result, { status: 'canonical_migration_required', enabled: false })
  assert.equal(updated, false)
})

test('bulk household activation reports migration-managed accounts without enabling them', async () => {
  let updated = false
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('SELECT DISTINCT account.id')) return { rows: [{ id: 8 }] }
      if (text.includes('SELECT * FROM family_billing_account')) {
        return { rows: [{ id: 8, household_monthly_billing_enabled: false }] }
      }
      if (text.includes('FROM billing_account_migration')) {
        return { rows: [{ id: 21, billing_migration_run_id: 10, state: 'cancellation_scheduled' }] }
      }
      if (text.includes('UPDATE family_billing_account')) updated = true
      return { rows: [] }
    },
  }

  const results = await activateEligibleHouseholdMonthlyBilling(pool, {
    stripe: {},
    environment: { BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED: 'true' },
  })

  assert.deepEqual(results, [{
    status: 'migration_managed',
    enabled: false,
    migrationId: 21,
    migrationRunId: 10,
    migrationState: 'cancellation_scheduled',
  }])
  assert.equal(updated, false)
})

test('an unknown Stripe payment outcome blocks method drift under the prior idempotency key', async () => {
  const pool = resumePool({ secondStripeInvoiceItemId: null })
  const stripe = stripeFixture({ payError: new Error('request outcome unknown') })
  const options = {
    account: {
      id: 8,
      family_id: 6,
      stripe_customer_id: 'cus_8',
      facility_timezone: 'America/New_York',
      household_monthly_billing_enabled: true,
    },
    billingMonth: '2026-09-01',
    environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
    stripeClient: stripe,
  }

  const first = await createHouseholdMonthlyInvoice(pool, options)
  assert.equal(first.created, false)
  assert.equal(first.resumed, true)
  assert.equal(pool.lines[1].stripe_invoice_item_id, 'ii_102')
  assert.equal(stripe.calls.filter((call) => call === 'invoices.create').length, 0)
  assert.equal(stripe.calls.filter((call) => call === 'invoiceItems.create').length, 0)
  assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 1)
  assert.equal(pool.invoice.status, 'failed')
  assert.equal(pool.invoice.hosted_invoice_url, null)
  assert.ok(pool.invoice.payment_attempted_at instanceof Date)

  stripe.customers.retrieve = async () => ({
    id: 'cus_8',
    deleted: false,
    invoice_settings: {
      default_payment_method: {
        id: 'pm_changed_after_unknown_outcome',
        type: 'card',
        customer: 'cus_8',
        card: { brand: 'visa', last4: '1881', exp_month: 12, exp_year: 2030 },
      },
    },
  })
  await assert.rejects(
    createHouseholdMonthlyInvoice(pool, options),
    /unknown Stripe payment outcome; manual reconciliation is required before retry/,
  )
  assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 1)
  assert.match(stripe.payRequests[0].options.idempotencyKey, /^household-monthly-invoice:42:pay:\d+$/)
  assert.equal(stripe.payRequests.length, 1)
})

test('an open reserved attempt with no durable PaymentIntent is treated as an unknown outcome', async () => {
  const attemptedAt = new Date('2026-09-01T12:00:00.000Z')
  const pool = resumePool({ status: 'open', paymentAttemptedAt: attemptedAt })
  const stripe = stripeFixture({
    remoteStatus: 'open',
    defaultPaymentMethod: {
      id: 'pm_changed_after_worker_crash',
      type: 'card',
      customer: 'cus_8',
      card: { brand: 'visa', last4: '1881', exp_month: 12, exp_year: 2030 },
    },
  })

  await assert.rejects(
    createHouseholdMonthlyInvoice(pool, {
      account: {
        id: 8,
        family_id: 6,
        stripe_customer_id: 'cus_8',
        facility_timezone: 'America/New_York',
        household_monthly_billing_enabled: true,
      },
      billingMonth: '2026-09-01',
      environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
      stripeClient: stripe,
    }),
    /unknown Stripe payment outcome; manual reconciliation is required before retry/,
  )

  assert.equal(pool.invoice.payment_attempted_at, attemptedAt)
  assert.equal(stripe.payRequests.length, 0)
})

test('a finalized payment-method-required invoice is paid after a card is added', async () => {
  const pool = resumePool({ status: 'payment_method_required' })
  const stripe = stripeFixture({
    remoteStatus: 'open',
    collectionMethod: 'send_invoice',
    hasPaymentMethod: true,
    payError: new Error('declined after the resumed payment attempt'),
  })

  const result = await createHouseholdMonthlyInvoice(pool, {
    account: {
      id: 8,
      family_id: 6,
      stripe_customer_id: 'cus_8',
      facility_timezone: 'America/New_York',
      household_monthly_billing_enabled: true,
    },
    billingMonth: '2026-09-01',
    environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
    stripeClient: stripe,
  })

  assert.equal(result.resumed, true)
  assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 1)
  assert.equal(stripe.payRequests[0].params.payment_method, 'pm_8')
  assert.equal(pool.invoice.status, 'failed')
})

test('a customer-owned Link PaymentMethod is used for an off-session household invoice', async () => {
  const pool = resumePool({ status: 'payment_method_required' })
  const stripe = stripeFixture({
    remoteStatus: 'open',
    collectionMethod: 'send_invoice',
    defaultPaymentMethod: {
      id: 'pm_link',
      type: 'link',
      customer: 'cus_8',
      link: { email: null },
    },
    payError: new Error('declined after the resumed Link payment attempt'),
  })

  const result = await createHouseholdMonthlyInvoice(pool, {
    account: {
      id: 8,
      family_id: 6,
      stripe_customer_id: 'cus_8',
      facility_timezone: 'America/New_York',
      household_monthly_billing_enabled: true,
    },
    billingMonth: '2026-09-01',
    environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
    stripeClient: stripe,
  })

  assert.equal(result.resumed, true)
  assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 1)
  assert.equal(stripe.payRequests[0].params.payment_method, 'pm_link')
})

test('the final payment boundary blocks amount or currency drift before Stripe collection', async () => {
  const pool = resumePool()
  const stripe = stripeFixture({ remoteStatus: 'draft' })
  const retrieve = stripe.invoices.retrieve.bind(stripe.invoices)
  stripe.invoices.retrieve = async (...args) => ({
    ...(await retrieve(...args)),
    amount_due: 24999,
    currency: 'eur',
  })

  await assert.rejects(
    createHouseholdMonthlyInvoice(pool, {
      account: {
        id: 8,
        family_id: 6,
        stripe_customer_id: 'cus_8',
        facility_timezone: 'America/New_York',
        household_monthly_billing_enabled: true,
      },
      billingMonth: '2026-09-01',
      environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
      stripeClient: stripe,
    }),
    (error) => (
      error?.code === 'household_invoice_publication_invoice_mismatch'
      && error.details.issues.some((issue) => issue.code === 'remote_invoice_amount_mismatch')
      && error.details.issues.some((issue) => issue.code === 'remote_invoice_currency_mismatch')
    ),
  )

  assert.equal(stripe.calls.includes('invoices.finalize'), true)
  assert.equal(stripe.calls.includes('invoices.pay'), false)
})

test('a finalized invoice is verified before a no-method hosted payment link is exposed', async () => {
  const pool = resumePool()
  const stripe = stripeFixture({ hasPaymentMethod: false })
  const retrieve = stripe.invoices.retrieve.bind(stripe.invoices)
  stripe.invoices.retrieve = async (...args) => {
    const invoice = await retrieve(...args)
    return invoice.status === 'open' ? { ...invoice, currency: 'eur' } : invoice
  }

  await assert.rejects(
    createHouseholdMonthlyInvoice(pool, {
      account: {
        id: 8,
        family_id: 6,
        stripe_customer_id: 'cus_8',
        facility_timezone: 'America/New_York',
        household_monthly_billing_enabled: true,
      },
      billingMonth: '2026-09-01',
      environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
      stripeClient: stripe,
    }),
    (error) => (
      error?.code === 'household_invoice_publication_invoice_mismatch'
      && error.details.issues.some((issue) => issue.code === 'remote_invoice_currency_mismatch')
    ),
  )

  assert.equal(pool.invoice.hosted_invoice_url, null)
  assert.equal(stripe.calls.includes('invoices.pay'), false)
})

test('the final boundary uses authoritative invoice lines and current adjustment fields', async () => {
  const adjustmentPool = resumePool({ status: 'open' })
  const adjustmentStripe = stripeFixture({ discoverOnly: true, remoteStatus: 'open' })
  const retrieve = adjustmentStripe.invoices.retrieve.bind(adjustmentStripe.invoices)
  adjustmentStripe.invoices.retrieve = async (...args) => ({
    ...(await retrieve(...args)),
    total_taxes: [{ amount: 0, tax_behavior: 'inclusive', type: 'tax_rate_details' }],
    total_pretax_credit_amounts: [{ amount: 0, type: 'credit_balance_transaction' }],
  })
  const listAdjustedLines = adjustmentStripe.invoices.listLineItems.bind(adjustmentStripe.invoices)
  adjustmentStripe.invoices.listLineItems = async (...args) => {
    const page = await listAdjustedLines(...args)
    page.data[0].taxes = [{ amount: 0, tax_behavior: 'inclusive', type: 'tax_rate_details' }]
    page.data[0].pretax_credit_amounts = [{ amount: 0, type: 'credit_balance_transaction' }]
    return page
  }

  await assert.rejects(
    assertHouseholdPaymentBoundary(adjustmentPool, paymentBoundaryInput(adjustmentStripe)),
    (error) => (
      error?.code === 'household_payment_invoice_mismatch'
      && error.details.issues.some((issue) => issue.code === 'remote_invoice_unexpected_adjustment')
      && error.details.issues.some((issue) => issue.code === 'remote_invoice_line_mismatch')
    ),
  )

  const parentPool = resumePool({ status: 'open' })
  const parentStripe = stripeFixture({ discoverOnly: true, remoteStatus: 'open' })
  const listLines = parentStripe.invoices.listLineItems.bind(parentStripe.invoices)
  parentStripe.invoices.listLineItems = async (...args) => {
    const page = await listLines(...args)
    page.data[0].parent = {
      type: 'subscription_item_details',
      invoice_item_details: null,
      subscription_item_details: { subscription: 'sub_unexpected' },
    }
    return page
  }

  await assert.rejects(
    assertHouseholdPaymentBoundary(parentPool, paymentBoundaryInput(parentStripe)),
    (error) => (
      error?.code === 'household_payment_invoice_mismatch'
      && error.details.issues.some((issue) => issue.code === 'remote_invoice_line_parent_mismatch')
    ),
  )
  assert.equal(parentStripe.calls.includes('invoiceItems.list'), false)
  assert.equal(parentStripe.calls.includes('invoices.listLineItems'), true)
})

test('the final boundary fully paginates the authoritative invoice line list', async () => {
  const pool = resumePool({ status: 'open' })
  const stripe = stripeFixture({ discoverOnly: true, remoteStatus: 'open' })
  const completePage = await stripe.invoices.listLineItems()
  stripe.calls.length = 0
  stripe.invoices.listLineItems = async (_invoiceId, params = {}) => {
    stripe.calls.push('invoices.listLineItems')
    if (!params.starting_after) {
      return { data: [completePage.data[0]], has_more: true }
    }
    return { data: [completePage.data[1]], has_more: false }
  }

  const result = await assertHouseholdPaymentBoundary(pool, paymentBoundaryInput(stripe))

  assert.equal(result.payableInvoice.verified, true)
  // Collector inventory and the final structure proof each consume both pages.
  assert.equal(stripe.calls.filter((call) => call === 'invoices.listLineItems').length, 4)
})

test('the final boundary fully paginates Invoice Payments and blocks an extra collector', async () => {
  const pool = resumePool()
  const stripe = stripeFixture({ remoteStatus: 'draft' })
  const safePage = await stripe.invoicePayments.list()
  stripe.calls.length = 0
  stripe.invoicePayments.list = async (params = {}) => {
    stripe.calls.push('invoicePayments.list')
    if (!params.starting_after) {
      return { data: safePage.data, has_more: true }
    }
    return {
      data: [{
        id: 'inpay_external',
        invoice: 'in_42',
        is_default: false,
        status: 'open',
        amount_requested: 25000,
        amount_paid: null,
        currency: 'usd',
        payment: { type: 'payment_intent', payment_intent: 'pi_external' },
      }],
      has_more: false,
    }
  }

  await assert.rejects(
    createHouseholdMonthlyInvoice(pool, {
      account: {
        id: 8,
        family_id: 6,
        stripe_customer_id: 'cus_8',
        facility_timezone: 'America/New_York',
        household_monthly_billing_enabled: true,
      },
      billingMonth: '2026-09-01',
      environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
      stripeClient: stripe,
    }),
    (error) => (
      error?.code === 'household_invoice_publication_invoice_mismatch'
      && error.details.issues.some((issue) => (
        issue.code === 'remote_invoice_payment_count_mismatch' && issue.count === 2
      ))
    ),
  )

  assert.equal(stripe.calls.filter((call) => call === 'invoicePayments.list').length, 2)
  assert.equal(stripe.calls.includes('invoices.pay'), false)
  assert.equal(pool.invoice.hosted_invoice_url, null)
})

test('a last-moment Invoice Payment inventory race blocks collection', async () => {
  const pool = resumePool()
  const stripe = stripeFixture({ remoteStatus: 'draft' })
  const listInvoicePayments = stripe.invoicePayments.list.bind(stripe.invoicePayments)
  let inventoryReads = 0
  stripe.invoicePayments.list = async (...args) => {
    inventoryReads += 1
    const page = await listInvoicePayments(...args)
    if (inventoryReads === 3) {
      page.data.push({
        id: 'inpay_racing_collector',
        invoice: 'in_42',
        is_default: false,
        status: 'open',
        amount_requested: 25000,
        amount_paid: null,
        currency: 'usd',
        payment: { type: 'payment_intent', payment_intent: 'pi_racing_collector' },
      })
    }
    return page
  }

  await assert.rejects(
    createHouseholdMonthlyInvoice(pool, {
      account: {
        id: 8,
        family_id: 6,
        stripe_customer_id: 'cus_8',
        facility_timezone: 'America/New_York',
        household_monthly_billing_enabled: true,
      },
      billingMonth: '2026-09-01',
      environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
      stripeClient: stripe,
    }),
    (error) => (
      error?.code === 'household_payment_binding_mismatch'
      && error.details.issues.some((issue) => (
        issue.code === 'remote_invoice_payment_count_mismatch' && issue.count === 2
      ))
    ),
  )

  assert.equal(inventoryReads, 3)
  assert.equal(stripe.calls.includes('invoices.pay'), false)
  assert.equal(pool.invoice.hosted_invoice_url, null)
})

test('paid settlement rejects a paid binding plus any extra open binding', async () => {
  const pool = resumePool({ status: 'failed' })
  const stripe = stripeFixture({ discoverOnly: true, remoteStatus: 'paid' })
  const listInvoicePayments = stripe.invoicePayments.list.bind(stripe.invoicePayments)
  stripe.invoicePayments.list = async (...args) => {
    const page = await listInvoicePayments(...args)
    page.data.push({
      id: 'inpay_extra_open',
      invoice: 'in_42',
      is_default: false,
      status: 'open',
      amount_requested: 25000,
      amount_paid: null,
      currency: 'usd',
      payment: { type: 'payment_intent', payment_intent: 'pi_extra_open' },
    })
    return page
  }

  await assert.rejects(
    recordAndApplyHouseholdMonthlyInvoicePayment(pool, {
      invoice: {
        id: 'in_42',
        status: 'paid',
        paid: true,
        amount_paid: 25000,
        currency: 'usd',
        customer: 'cus_8',
      },
      stripe,
    }),
    (error) => (
      error?.code === 'household_paid_invoice_mismatch'
      && error.details.issues.some((issue) => (
        issue.code === 'remote_invoice_payment_count_mismatch' && issue.count === 2
      ))
    ),
  )

  assert.equal(pool.calls.some(({ sql }) => /INSERT INTO billing_payment\s*\(/.test(sql)), false)
})

test('a remote default Invoice Payment must match the durable retry PaymentIntent', async () => {
  const pool = resumePool({
    status: 'open',
    stripePaymentIntentId: 'pi_expected_retry',
    paymentAttemptedAt: new Date('2026-09-01T12:00:00.000Z'),
  })
  const stripe = stripeFixture({ remoteStatus: 'open' })

  await assert.rejects(
    createHouseholdMonthlyInvoice(pool, {
      account: {
        id: 8,
        family_id: 6,
        stripe_customer_id: 'cus_8',
        facility_timezone: 'America/New_York',
        household_monthly_billing_enabled: true,
      },
      billingMonth: '2026-09-01',
      environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
      stripeClient: stripe,
    }),
    (error) => (
      error?.code === 'household_invoice_publication_invoice_mismatch'
      && error.details.issues.some((issue) => issue.code === 'remote_invoice_default_payment_mismatch')
    ),
  )

  assert.equal(stripe.calls.includes('invoices.pay'), false)
})

test('a non-paid automatic attempt never exposes a competing hosted payment page', async () => {
  const pool = resumePool()
  const stripe = stripeFixture()
  stripe.invoices.pay = async () => {
    stripe.calls.push('invoices.pay')
    return {
      id: 'in_42',
      customer: 'cus_8',
      status: 'open',
      paid: false,
      payment_intent: 'pi_processing_after_pay',
      hosted_invoice_url: 'https://stripe.test/in_42',
    }
  }

  const result = await createHouseholdMonthlyInvoice(pool, {
    account: {
      id: 8,
      family_id: 6,
      stripe_customer_id: 'cus_8',
      facility_timezone: 'America/New_York',
      household_monthly_billing_enabled: true,
    },
    billingMonth: '2026-09-01',
    environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
    stripeClient: stripe,
  })

  assert.equal(result.invoice.status, 'failed')
  assert.equal(result.invoice.stripe_payment_intent_id, 'pi_processing_after_pay')
  assert.equal(result.invoice.hosted_invoice_url, null)
})

test('the irreversible payment boundary reselects and uses only the current default method', async () => {
  const pool = resumePool()
  const stripe = stripeFixture({ payError: new Error('declined after fresh-method selection') })
  let customerReads = 0
  stripe.customers.retrieve = async () => {
    stripe.calls.push('customers.retrieve')
    customerReads += 1
    const paymentMethodId = customerReads < 3 ? 'pm_old' : 'pm_current'
    return {
      id: 'cus_8',
      deleted: false,
      invoice_settings: {
        default_payment_method: {
          id: paymentMethodId,
          type: 'card',
          customer: 'cus_8',
          card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
        },
      },
    }
  }

  await createHouseholdMonthlyInvoice(pool, {
    account: {
      id: 8,
      family_id: 6,
      stripe_customer_id: 'cus_8',
      facility_timezone: 'America/New_York',
      household_monthly_billing_enabled: true,
    },
    billingMonth: '2026-09-01',
    environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
    stripeClient: stripe,
  })

  assert.equal(customerReads, 3)
  assert.equal(stripe.payRequests.length, 1)
  assert.equal(stripe.payRequests[0].params.payment_method, 'pm_current')
})

test('household invoice payment selection fails closed for expired, foreign, and unsupported defaults', async () => {
  const invalidMethods = [
    {
      id: 'pm_expired',
      type: 'card',
      customer: 'cus_8',
      card: { brand: 'visa', last4: '4242', exp_month: 8, exp_year: 2026 },
    },
    {
      id: 'pm_foreign',
      type: 'card',
      customer: 'cus_other',
      card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
    },
    {
      id: 'pm_bank',
      type: 'us_bank_account',
      customer: 'cus_8',
      us_bank_account: { last4: '6789' },
    },
  ]

  for (const defaultPaymentMethod of invalidMethods) {
    const pool = resumePool({ status: 'payment_method_required' })
    const stripe = stripeFixture({
      remoteStatus: 'open',
      collectionMethod: 'send_invoice',
      defaultPaymentMethod,
    })
    const result = await createHouseholdMonthlyInvoice(pool, {
      account: {
        id: 8,
        family_id: 6,
        stripe_customer_id: 'cus_8',
        facility_timezone: 'America/New_York',
        household_monthly_billing_enabled: true,
      },
      billingMonth: '2026-09-01',
      environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
      stripeClient: stripe,
    })

    assert.equal(result.invoice.status, 'payment_method_required')
    assert.equal(result.invoice.hosted_invoice_url, 'https://stripe.test/in_42')
    assert.equal(result.invoice.payment_attempted_at, null)
    assert.equal(stripe.calls.includes('invoices.pay'), false)
  }
})

test('an interrupted response after Stripe payment is reconciled without a second collection', async () => {
  const pool = resumePool({ status: 'open' })
  const stripe = stripeFixture({
    remoteStatus: 'open',
    payErrorAfterRemotePaid: new Error('connection closed after Stripe completed the payment'),
  })
  const options = {
    account: {
      id: 8,
      family_id: 6,
      stripe_customer_id: 'cus_8',
      facility_timezone: 'America/New_York',
      household_monthly_billing_enabled: true,
    },
    billingMonth: '2026-09-01',
    environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
    stripeClient: stripe,
  }

  await createHouseholdMonthlyInvoice(pool, options)
  assert.equal(pool.invoice.status, 'failed')
  assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 1)

  const resumed = await createHouseholdMonthlyInvoice(pool, options)
  assert.equal(resumed.resumed, true)
  assert.equal(pool.invoice.status, 'paid')
  assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 1)
})

test('a remote invoice created before a crash is recovered and its idempotent payment is resumed', async () => {
  const pool = resumePool({ stripeInvoiceId: null })
  const stripe = stripeFixture({ discoverOnly: true, remoteStatus: 'open' })
  const result = await createHouseholdMonthlyInvoice(pool, {
    account: {
      id: 8,
      family_id: 6,
      stripe_customer_id: 'cus_8',
      facility_timezone: 'America/New_York',
      household_monthly_billing_enabled: true,
    },
    billingMonth: '2026-09-01',
    environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
    stripeClient: stripe,
  })

  assert.equal(result.resumed, true)
  assert.equal(pool.invoice.stripe_invoice_id, 'in_42')
  assert.equal(pool.invoice.status, 'failed')
  assert.equal(stripe.calls.filter((call) => call === 'invoices.create').length, 0)
  assert.equal(stripe.calls.filter((call) => call === 'invoices.finalize').length, 0)
  assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 1)
  assert.equal(stripe.payRequests[0].invoiceId, 'in_42')
  assert.deepEqual(stripe.payRequests[0].params, { payment_method: 'pm_8' })
  assert.match(stripe.payRequests[0].options.idempotencyKey, /^household-monthly-invoice:42:pay:\d+$/)
})

test('a pre-payment failure resumes an already-open remote invoice without refinalizing it', async () => {
  const pool = resumePool({ status: 'failed', paymentAttemptedAt: null })
  const stripe = stripeFixture({ remoteStatus: 'open' })
  const result = await createHouseholdMonthlyInvoice(pool, {
    account: {
      id: 8,
      family_id: 6,
      stripe_customer_id: 'cus_8',
      facility_timezone: 'America/New_York',
      household_monthly_billing_enabled: true,
    },
    billingMonth: '2026-09-01',
    environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
    stripeClient: stripe,
  })

  assert.equal(result.resumed, true)
  assert.equal(pool.invoice.status, 'failed')
  assert.equal(stripe.calls.filter((call) => call === 'invoices.finalize').length, 0)
  assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 1)
})

test('a one-time final payment gate failure leaves no attempt marker and safely reaches pay on retry', async () => {
  for (const failureMode of ['authority', 'binding']) {
    const pool = resumePool()
    const stripe = stripeFixture()
    const originalQuery = pool.query.bind(pool)
    const originalInvoicePaymentList = stripe.invoicePayments.list.bind(stripe.invoicePayments)
    let paymentAuthorityPassed = false
    let failureInjected = false
    pool.query = async (sql, params = []) => {
      if (String(sql).includes('billing_account_migration migration') && params[10] === true) {
        if (failureMode === 'authority' && !failureInjected) {
          failureInjected = true
          return { rows: [] }
        }
        paymentAuthorityPassed = true
      }
      return originalQuery(sql, params)
    }
    stripe.invoicePayments.list = async (...args) => {
      if (failureMode === 'binding' && paymentAuthorityPassed && !failureInjected) {
        failureInjected = true
        return { data: [], has_more: false }
      }
      return originalInvoicePaymentList(...args)
    }
    const options = {
      account: {
        id: 8,
        family_id: 6,
        stripe_customer_id: 'cus_8',
        facility_timezone: 'America/New_York',
        household_monthly_billing_enabled: true,
      },
      billingMonth: '2026-09-01',
      environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
      stripeClient: stripe,
    }

    await assert.rejects(
      createHouseholdMonthlyInvoice(pool, options),
      (error) => error?.code === (
        failureMode === 'authority'
          ? 'household_payment_canonical_authority_missing'
          : 'household_payment_binding_mismatch'
      ),
    )
    assert.equal(failureInjected, true)
    assert.equal(pool.invoice.payment_attempted_at, null)
    assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 0)

    await createHouseholdMonthlyInvoice(pool, options)
    assert.ok(pool.invoice.payment_attempted_at instanceof Date)
    assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 1)
  }
})

test('a confirmed failed payment advances to a new attempt generation on retry', async () => {
  const pool = resumePool({ status: 'open' })
  const stripe = stripeFixture({ remoteStatus: 'open' })
  const options = {
    account: {
      id: 8,
      family_id: 6,
      stripe_customer_id: 'cus_8',
      facility_timezone: 'America/New_York',
      household_monthly_billing_enabled: true,
    },
    billingMonth: '2026-09-01',
    environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
    stripeClient: stripe,
  }

  await createHouseholdMonthlyInvoice(pool, options)
  const firstAttemptAt = pool.invoice.payment_attempted_at.getTime()
  const firstKey = stripe.payRequests[0].options.idempotencyKey
  assert.equal(pool.invoice.status, 'failed')
  assert.equal(pool.invoice.stripe_payment_intent_id, 'pi_42')

  await createHouseholdMonthlyInvoice(pool, options)
  assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 2)
  assert.ok(pool.invoice.payment_attempted_at.getTime() > firstAttemptAt)
  assert.notEqual(stripe.payRequests[1].options.idempotencyKey, firstKey)
  assert.equal(pool.invoice.stripe_payment_intent_id, 'pi_42')
})

test('a nonterminal payment intent stops retry before another collection attempt', async () => {
  const attemptedAt = new Date('2026-09-01T12:00:00.000Z')
  const pool = resumePool({
    status: 'failed',
    stripePaymentIntentId: 'pi_processing',
    paymentAttemptedAt: attemptedAt,
  })
  const stripe = stripeFixture({ remoteStatus: 'open', paymentIntentStatus: 'processing' })
  const listInvoicePayments = stripe.invoicePayments.list.bind(stripe.invoicePayments)
  stripe.invoicePayments.list = async (...args) => {
    const page = await listInvoicePayments(...args)
    page.data[0].payment.payment_intent = 'pi_processing'
    return page
  }

  await assert.rejects(
    createHouseholdMonthlyInvoice(pool, {
      account: {
        id: 8,
        family_id: 6,
        stripe_customer_id: 'cus_8',
        facility_timezone: 'America/New_York',
        household_monthly_billing_enabled: true,
      },
      billingMonth: '2026-09-01',
      environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
      stripeClient: stripe,
    }),
    (error) => (
      error?.code === 'household_invoice_publication_invoice_mismatch'
      && error.details.issues.some((issue) => issue.code === 'remote_invoice_default_payment_intent_mismatch')
    ),
  )
  assert.equal(pool.invoice.payment_attempted_at, attemptedAt)
  assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 0)
})

test('a canceled prior PaymentIntent cannot advance a retry generation', async () => {
  const attemptedAt = new Date('2026-09-01T12:00:00.000Z')
  const pool = resumePool({
    status: 'failed',
    stripePaymentIntentId: 'pi_canceled',
    paymentAttemptedAt: attemptedAt,
  })
  const stripe = stripeFixture({ remoteStatus: 'open' })
  const listInvoicePayments = stripe.invoicePayments.list.bind(stripe.invoicePayments)
  stripe.invoicePayments.list = async (...args) => {
    const page = await listInvoicePayments(...args)
    page.data[0].payment.payment_intent = 'pi_canceled'
    return page
  }
  let intentReads = 0
  stripe.paymentIntents.retrieve = async (id) => {
    intentReads += 1
    return {
      id,
      status: intentReads === 1 ? 'requires_payment_method' : 'canceled',
      customer: 'cus_8',
      currency: 'usd',
      amount: 25000,
      amount_received: 0,
    }
  }

  await assert.rejects(
    createHouseholdMonthlyInvoice(pool, {
      account: {
        id: 8,
        family_id: 6,
        stripe_customer_id: 'cus_8',
        facility_timezone: 'America/New_York',
        household_monthly_billing_enabled: true,
      },
      billingMonth: '2026-09-01',
      environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
      stripeClient: stripe,
    }),
    (error) => (
      error?.code === 'household_payment_invoice_mismatch'
      && error.details.issues.some((issue) => issue.code === 'remote_invoice_default_payment_intent_mismatch')
    ),
  )

  assert.equal(intentReads, 2)
  assert.equal(pool.invoice.payment_attempted_at, attemptedAt)
  assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 0)
})

test('multiple matching remote invoices fail closed instead of creating or collecting another invoice', async () => {
  const pool = resumePool({ stripeInvoiceId: null })
  const stripe = stripeFixture()
  const metadata = {
    monthlyInvoiceId: '42',
    familyBillingAccountId: '8',
    billingMonth: '2026-09',
  }
  stripe.invoices.search = async () => ({
    data: [
      { id: 'in_duplicate_a', customer: 'cus_8', status: 'draft', metadata },
      { id: 'in_duplicate_b', customer: 'cus_8', status: 'draft', metadata },
    ],
    has_more: false,
  })

  await assert.rejects(
    createHouseholdMonthlyInvoice(pool, {
      account: {
        id: 8,
        family_id: 6,
        stripe_customer_id: 'cus_8',
        facility_timezone: 'America/New_York',
        household_monthly_billing_enabled: true,
      },
      billingMonth: '2026-09-01',
      environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
      stripeClient: stripe,
    }),
    /Multiple Stripe invoices match/,
  )
  assert.equal(stripe.calls.filter((call) => call === 'invoices.create').length, 0)
  assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 0)
})

test('an open local invoice resumes the stable payment operation while a paid invoice is terminal', async () => {
  const openPool = resumePool({ status: 'open' })
  const stripe = stripeFixture({ remoteStatus: 'open' })
  const options = {
    account: {
      id: 8,
      family_id: 6,
      stripe_customer_id: 'cus_8',
      facility_timezone: 'America/New_York',
      household_monthly_billing_enabled: true,
    },
    billingMonth: '2026-09-01',
    environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
    stripeClient: stripe,
  }
  const resumed = await createHouseholdMonthlyInvoice(openPool, options)
  assert.equal(resumed.resumed, true)
  assert.equal(openPool.invoice.status, 'failed')
  assert.equal(stripe.calls.filter((call) => call === 'invoices.finalize').length, 0)
  assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 1)

  const paidPool = resumePool({ status: 'paid' })
  const terminal = await createHouseholdMonthlyInvoice(paidPool, { ...options, stripeClient: stripeFixture() })
  assert.equal(terminal.skipped, 'already_created')
})

test('Stripe unavailability leaves the local draft resumable', async () => {
  const pool = resumePool({ stripeInvoiceId: null })
  const account = {
    id: 8,
    family_id: 6,
    stripe_customer_id: 'cus_8',
    facility_timezone: 'America/New_York',
    household_monthly_billing_enabled: true,
  }
  const unavailable = await createHouseholdMonthlyInvoice(pool, {
    account,
    billingMonth: '2026-09-01',
    environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
    stripeClient: null,
  })
  assert.equal(unavailable.skipped, 'stripe_unavailable')
  assert.equal(pool.invoice.status, 'draft')

  const stripe = stripeFixture({ discoverOnly: true, remoteStatus: 'open' })
  const resumed = await createHouseholdMonthlyInvoice(pool, {
    account,
    billingMonth: '2026-09-01',
    environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
    stripeClient: stripe,
  })
  assert.equal(resumed.resumed, true)
  assert.equal(pool.invoice.status, 'failed')
  assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 1)
})

test('roll-forward reallocates a manual payment before rebuilding the next monthly invoice', async () => {
  const priorInvoice = {
    id: 41,
    family_billing_account_id: 8,
    billing_month: '2026-08-01',
    status: 'failed',
    subtotal_cents: 10000,
    total_cents: 10000,
    stripe_invoice_id: 'in_august',
  }
  const payment = { id: 71, amount_cents: 10000, paid_at: new Date('2026-08-31T18:00:00Z'), status: 'settled' }
  const charge = {
    id: 501,
    member_id: 11,
    description: 'August tuition',
    amount_cents: 10000,
    service_period_start: '2026-08-01',
    created_at: new Date('2026-08-01T04:00:00Z'),
    is_annual_membership: false,
  }
  const applications = []
  const events = []
  let sessionLocked = false
  let sessionLockDepth = 0
  let allocationPasses = 0
  let replacementInvoiceInserted = false
  let connectCalls = 0

  const pool = {
    async connect() {
      connectCalls += 1
      return {
        query: (sql, params) => pool.query(sql, params),
        release() {},
      }
    },
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock(hashtextextended')) {
        sessionLockDepth += 1
        sessionLocked = sessionLockDepth > 0
        events.push('account-lock')
        return { rows: [] }
      }
      if (text.includes('pg_advisory_unlock(hashtextextended')) {
        sessionLockDepth = Math.max(0, sessionLockDepth - 1)
        sessionLocked = sessionLockDepth > 0
        events.push('account-unlock')
        return { rows: [] }
      }
      if (text.includes('SELECT id, amount_cents, paid_at') && text.includes('FROM billing_payment')) {
        return { rows: [payment] }
      }
      if (text.includes('SELECT c.id,') && text.includes("invoice.status IN ('draft', 'open', 'failed', 'payment_method_required')")) {
        allocationPasses += 1
        const reserved = ['draft', 'open', 'failed', 'payment_method_required'].includes(priorInvoice.status)
        events.push(`allocation-read:${reserved ? 'reserved' : 'available'}:${sessionLocked}`)
        return { rows: reserved ? [] : [charge] }
      }
      if (text.includes('SELECT application.billing_payment_id') && text.includes('JOIN billing_payment payment')) {
        return { rows: applications.map((item) => ({ ...item })) }
      }
      if (text.includes('SELECT payment_id, amount_cents') && text.includes('FROM billing_refund')) {
        return { rows: [] }
      }
      if (text.includes('INSERT INTO billing_payment_application') && text.includes("'application'")) {
        const row = {
          id: 901,
          billing_payment_id: Number(params[0]),
          billing_charge_id: Number(params[1]),
          amount_cents: Number(params[2]),
          application_kind: 'application',
        }
        applications.push(row)
        events.push(`payment-applied:${row.amount_cents}:${sessionLocked}`)
        return { rows: [row] }
      }
      if (text.includes('billing_month < $2::date') && text.includes('FROM billing_monthly_invoice')) {
        return { rows: priorInvoice.status === 'void' ? [] : [{ ...priorInvoice }] }
      }
      if (text.includes('UPDATE billing_monthly_invoice') && text.includes('RETURNING *')) {
        const assignments = text.slice(text.indexOf('SET') + 3, text.indexOf('WHERE')).matchAll(/([a-z_]+)\s*=\s*\$(\d+)/g)
        for (const [, key, position] of assignments) priorInvoice[key] = params[Number(position) - 1]
        events.push(`invoice:${priorInvoice.status}:${sessionLocked}`)
        return { rows: [{ ...priorInvoice }] }
      }
      if (
        text.includes('SELECT * FROM billing_monthly_invoice')
        && text.includes('family_billing_account_id = $1 AND billing_month = $2::date')
      ) {
        return { rows: [] }
      }
      if (text.includes('SELECT charge.id, charge.member_id, charge.description')) {
        const applied = applications.reduce((sum, item) => sum + Number(item.amount_cents), 0)
        const remaining = Math.max(0, charge.amount_cents - applied)
        events.push(`replacement-read:${remaining}:${sessionLocked}`)
        return { rows: remaining > 0 ? [{ ...charge, remaining_cents: remaining }] : [] }
      }
      if (text.includes('INSERT INTO billing_monthly_invoice (')) {
        replacementInvoiceInserted = true
        throw new Error('A fully paid charge must not be placed on a replacement Stripe invoice.')
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const stripe = {
    invoices: {
      async retrieve(id) {
        events.push(`stripe-retrieve:${id}:${sessionLocked}`)
        return {
          id,
          status: 'open',
          customer: 'cus_8',
          metadata: {
            monthlyInvoiceId: String(priorInvoice.id),
            familyBillingAccountId: String(priorInvoice.family_billing_account_id),
            billingMonth: '2026-08',
          },
        }
      },
      async voidInvoice(id) {
        events.push(`stripe-void:${id}:${sessionLocked}`)
        return { id, status: 'void' }
      },
    },
    invoicePayments: {
      async list() {
        return {
          data: [{
            id: 'inpay_august',
            invoice: 'in_august',
            is_default: true,
            status: 'open',
            amount_requested: 10000,
            amount_paid: null,
            currency: 'usd',
            payment: { type: 'payment_intent', payment_intent: 'pi_august' },
          }],
          has_more: false,
        }
      },
    },
    paymentIntents: {
      async retrieve(id) {
        return {
          id,
          status: 'requires_payment_method',
          customer: 'cus_8',
          currency: 'usd',
          amount: 10000,
          amount_received: 0,
        }
      },
    },
  }

  const result = await createHouseholdMonthlyInvoice(pool, {
    account: {
      id: 8,
      family_id: 6,
      stripe_customer_id: 'cus_8',
      facility_timezone: 'America/New_York',
      household_monthly_billing_enabled: true,
    },
    billingMonth: '2026-09-01',
    environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
    stripeClient: stripe,
  })

  assert.equal(result.skipped, 'no_open_charges')
  assert.equal(priorInvoice.status, 'void')
  assert.equal(allocationPasses, 2)
  assert.equal(applications.length, 1)
  assert.equal(applications[0].amount_cents, 10000)
  assert.equal(replacementInvoiceInserted, false)
  assert.equal(connectCalls, 1)
  assert.ok(events.indexOf('stripe-void:in_august:true') < events.indexOf('payment-applied:10000:true'))
  assert.ok(events.indexOf('payment-applied:10000:true') < events.indexOf('replacement-read:0:true'))
  assert.equal(sessionLocked, false)
})

test('roll-forward cannot void an open invoice with a processing Invoice Payment', async () => {
  const priorInvoice = {
    id: 51,
    family_billing_account_id: 8,
    billing_month: '2026-08-01',
    status: 'open',
    subtotal_cents: 10000,
    credit_cents: 0,
    total_cents: 10000,
    stripe_invoice_id: 'in_open_august',
  }
  const pool = {
    async connect() {
      return { query: (sql, params) => pool.query(sql, params), release() {} }
    },
    async query(sql) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock') || text.includes('pg_advisory_unlock')) return { rows: [] }
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] }
      if (text.includes('SELECT id, amount_cents, paid_at') && text.includes('FROM billing_payment')) return { rows: [] }
      if (text.includes('billing_month < $2::date') && text.includes('FROM billing_monthly_invoice')) {
        return { rows: [{ ...priorInvoice }] }
      }
      return { rows: [] }
    },
  }
  let voidCalls = 0
  const stripe = {
    invoices: {
      async retrieve(id) {
        return {
          id,
          status: 'open',
          customer: 'cus_8',
          metadata: {
            monthlyInvoiceId: '51',
            familyBillingAccountId: '8',
            billingMonth: '2026-08',
          },
        }
      },
      async voidInvoice() {
        voidCalls += 1
        return { id: 'in_open_august', status: 'void' }
      },
    },
    invoicePayments: {
      async list() {
        return {
          data: [{
            id: 'inpay_processing',
            invoice: 'in_open_august',
            is_default: true,
            status: 'open',
            amount_requested: 10000,
            amount_paid: null,
            currency: 'usd',
            payment: { type: 'payment_intent', payment_intent: 'pi_processing' },
          }],
          has_more: false,
        }
      },
    },
    paymentIntents: {
      async retrieve(id) {
        return {
          id,
          status: 'processing',
          customer: 'cus_8',
          currency: 'usd',
          amount: 10000,
          amount_received: 0,
        }
      },
    },
  }

  await assert.rejects(
    createHouseholdMonthlyInvoice(pool, {
      account: {
        id: 8,
        family_id: 6,
        stripe_customer_id: 'cus_8',
        facility_timezone: 'America/New_York',
        household_monthly_billing_enabled: true,
      },
      billingMonth: '2026-09-01',
      environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
      stripeClient: stripe,
    }),
    /unsafe Invoice Payment inventory.*remote_invoice_default_payment_intent_mismatch/,
  )
  assert.equal(voidCalls, 0)
})

test('roll-forward deletes a crashed draft Stripe invoice instead of trying to void it', async () => {
  const priorInvoice = {
    id: 51,
    family_billing_account_id: 8,
    billing_month: '2026-08-01',
    status: 'draft',
    stripe_invoice_id: 'in_draft_august',
  }
  const pool = {
    async connect() {
      return { query: (sql, params) => pool.query(sql, params), release() {} }
    },
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock') || text.includes('pg_advisory_unlock')) return { rows: [] }
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] }
      if (text.includes('SELECT id, amount_cents, paid_at') && text.includes('FROM billing_payment')) return { rows: [] }
      if (text.includes('billing_month < $2::date') && text.includes('FROM billing_monthly_invoice')) {
        return { rows: priorInvoice.status === 'void' ? [] : [{ ...priorInvoice }] }
      }
      if (text.includes('UPDATE billing_monthly_invoice') && text.includes('RETURNING *')) {
        const assignments = text.slice(text.indexOf('SET') + 3, text.indexOf('WHERE')).matchAll(/([a-z_]+)\s*=\s*\$(\d+)/g)
        for (const [, key, position] of assignments) priorInvoice[key] = params[Number(position) - 1]
        return { rows: [{ ...priorInvoice }] }
      }
      if (text.includes('family_billing_account_id = $1 AND billing_month = $2::date')) return { rows: [] }
      if (text.includes('SELECT charge.id, charge.member_id, charge.description')) return { rows: [] }
      return { rows: [] }
    },
  }
  let deleted = 0
  const stripe = {
    invoices: {
      async retrieve(id) {
        return {
          id,
          status: 'draft',
          metadata: {
            monthlyInvoiceId: '51',
            familyBillingAccountId: '8',
            billingMonth: '2026-08',
          },
        }
      },
      async del(id) {
        assert.equal(id, 'in_draft_august')
        deleted += 1
        return { id, deleted: true }
      },
      async voidInvoice() {
        throw new Error('A draft invoice must be deleted, not voided.')
      },
    },
  }

  const result = await createHouseholdMonthlyInvoice(pool, {
    account: {
      id: 8,
      family_id: 6,
      stripe_customer_id: 'cus_8',
      facility_timezone: 'America/New_York',
      household_monthly_billing_enabled: true,
    },
    billingMonth: '2026-09-01',
    environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
    stripeClient: stripe,
  })

  assert.equal(result.skipped, 'no_open_charges')
  assert.equal(deleted, 1)
  assert.equal(priorInvoice.status, 'void')
})

test('household invoice creation is fail-closed before any query or injected Stripe call', async () => {
  let queried = false
  const pool = { async query() { queried = true; return { rows: [] } } }
  const stripe = stripeFixture()
  const result = await createHouseholdMonthlyInvoice(pool, {
    account: { id: 8, household_monthly_billing_enabled: true },
    environment: {},
    stripeClient: stripe,
  })
  assert.deepEqual(result, { skipped: 'feature_disabled', invoice: null, created: false })
  assert.equal(queried, false)
  assert.deepEqual(stripe.calls, [])
})
