import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activateEligibleHouseholdMonthlyBilling,
  activateHouseholdMonthlyBillingForAccount,
  billingMonthStart,
  buildHouseholdInvoiceApplicationPlan,
  createHouseholdMonthlyInvoice,
  createLocalHouseholdInvoice,
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
  assert.match(creditSelection, /billing_charge_credit_application/)
  assert.match(creditSelection, /credit_invoice_line_id/)
  assert.match(creditSelection, /prior\.status IN \('draft', 'open', 'failed', 'payment_method_required'\)/)
  assert.doesNotMatch(creditSelection, /prior\.status IN \([^)]*'paid'/)
  assert.doesNotMatch(creditSelection, /prior\.status IN \([^)]*'void'/)
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

function resumePool({
  status = 'draft',
  stripeInvoiceId = 'in_42',
  stripePaymentIntentId = null,
  paymentAttemptedAt = null,
} = {}) {
  const invoice = {
    id: 42,
    family_billing_account_id: 8,
    billing_month: '2026-09-01',
    status,
    subtotal_cents: 25000,
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
      description: 'Tornadoes Monday',
      amount_cents: 12000,
      stripe_invoice_item_id: 'ii_101',
    },
    {
      id: 102,
      billing_monthly_invoice_id: 42,
      billing_charge_id: 502,
      member_id: 11,
      description: 'Tornadoes Wednesday',
      amount_cents: 13000,
      stripe_invoice_item_id: null,
    },
  ]
  const calls = []
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
            is_active: true,
          }],
        }
      }
      if (
        text.includes('SELECT * FROM billing_monthly_invoice')
        && text.includes('family_billing_account_id = $1 AND billing_month = $2::date')
      ) {
        return { rows: [{ ...invoice }] }
      }
      if (text.includes('SELECT * FROM billing_monthly_invoice_line') && text.includes('ORDER BY id')) {
        return { rows: lines.map((line) => ({ ...line })) }
      }
      if (text.includes('UPDATE billing_monthly_invoice_line') && text.includes('stripe_invoice_item_id = $2')) {
        const line = lines.find((item) => item.id === Number(params[0]))
        if (!line || (line.stripe_invoice_item_id && line.stripe_invoice_item_id !== params[1])) return { rows: [] }
        line.stripe_invoice_item_id = params[1]
        return { rows: [{ ...line }] }
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
} = {}) {
  const calls = []
  const payRequests = []
  const remote = {
    id: 'in_42',
    customer: 'cus_8',
    status: remoteStatus,
    collection_method: collectionMethod,
    hosted_invoice_url: 'https://stripe.test/in_42',
    metadata: {
      monthlyInvoiceId: '42',
      familyBillingAccountId: '8',
      billingMonth: '2026-09',
    },
  }
  const items = [
    {
      id: 'ii_101',
      amount: 12000,
      metadata: { monthlyInvoiceId: '42', monthlyInvoiceLineId: '101' },
    },
    {
      id: 'ii_102',
      amount: 13000,
      metadata: { monthlyInvoiceId: '42', monthlyInvoiceLineId: '102' },
    },
  ]
  const stripe = {
    calls,
    payRequests,
    customers: {
      async retrieve() {
        calls.push('customers.retrieve')
        return {
          id: 'cus_8',
          deleted: false,
          invoice_settings: { default_payment_method: hasPaymentMethod ? { id: 'pm_8' } : null },
        }
      },
    },
    paymentMethods: { async list() { calls.push('paymentMethods.list'); return { data: [] } } },
    paymentIntents: {
      async retrieve(id) {
        calls.push('paymentIntents.retrieve')
        return { id, status: paymentIntentStatus }
      },
    },
    invoices: {
      async retrieve() { calls.push('invoices.retrieve'); return { ...remote } },
      async search() { calls.push('invoices.search'); return { data: discoverOnly ? [{ ...remote }] : [], has_more: false } },
      async list() { calls.push('invoices.list'); return { data: discoverOnly ? [{ ...remote }] : [], has_more: false } },
      async create() { calls.push('invoices.create'); return { ...remote, status: 'draft' } },
      async finalizeInvoice() { calls.push('invoices.finalize'); remote.status = 'open'; return { ...remote } },
      async pay(invoiceId, params, options) {
        calls.push('invoices.pay')
        payRequests.push({ invoiceId, params, options })
        if (payErrorAfterRemotePaid) {
          remote.status = 'paid'
          remote.paid = true
          remote.amount_paid = 25000
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

test('household invoices use the facility month rather than the UTC month', () => {
  assert.equal(billingMonthStart(new Date('2026-10-01T00:00:00.000Z'), 'America/New_York'), '2026-09-01')
  assert.equal(billingMonthStart(new Date('2026-10-01T04:00:00.000Z'), 'America/New_York'), '2026-10-01')
  assert.equal(billingMonthStart(new Date('2026-09-30T11:00:00.000Z'), 'Pacific/Kiritimati'), '2026-10-01')
  assert.equal(billingMonthStart('2026-10-01', 'America/New_York'), '2026-10-01')
  assert.throws(() => billingMonthStart(new Date(), null), /valid facility timezone/)
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

test('an unknown Stripe payment outcome resumes with the same durable idempotency key', async () => {
  const pool = resumePool()
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
  assert.ok(pool.invoice.payment_attempted_at instanceof Date)

  const second = await createHouseholdMonthlyInvoice(pool, options)
  assert.equal(second.resumed, true)
  assert.equal(stripe.calls.filter((call) => call === 'invoices.pay').length, 2)
  assert.match(stripe.payRequests[0].options.idempotencyKey, /^household-monthly-invoice:42:pay:\d+$/)
  assert.equal(stripe.payRequests[1].options.idempotencyKey, stripe.payRequests[0].options.idempotencyKey)
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
    /processing; household invoice retry stopped to prevent duplicate collection/,
  )
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
