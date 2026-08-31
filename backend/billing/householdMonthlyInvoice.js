import { getStripeClient, ensureStripeCustomer, stripeEnabled } from './stripeBilling.js'
import { allocateHouseholdPayments } from './paymentAllocation.js'
import { recordBillingActivityBestEffort } from './billingActivity.js'
import { recordStripeBillingAlert } from './stripeOperations.js'
import { recordPaidStripeInvoice } from './stripeWebhookLifecycle.js'

let schemaEnsured = false

export async function ensureHouseholdMonthlyInvoiceSchema(pool) {
  if (schemaEnsured) return
  const fs = await import('fs')
  const path = new URL('../migrations/774_household_monthly_invoicing.sql', import.meta.url)
  await pool.query(fs.readFileSync(path, 'utf8'))
  schemaEnsured = true
}

export function billingMonthStart(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Billing month must be a valid date.')
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function positive(value) {
  return Math.max(0, Math.round(Number(value) || 0))
}

async function defaultPaymentMethod(stripe, customerId) {
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ['invoice_settings.default_payment_method'],
  })
  if (customer.deleted) return null
  let method = customer.invoice_settings?.default_payment_method ?? null
  if (typeof method === 'object') method = method.id
  if (method) return method
  const methods = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 })
  return methods.data?.[0]?.id ?? null
}

async function markInvoice(pool, invoiceId, values) {
  const entries = Object.entries(values)
  if (entries.length === 0) return null
  const columns = entries.map(([key], index) => `${key} = $${index + 2}`).join(', ')
  const result = await pool.query(
    `UPDATE billing_monthly_invoice SET ${columns}, updated_at = now() WHERE id = $1 RETURNING *`,
    [invoiceId, ...entries.map(([, value]) => value)],
  )
  return result.rows[0] ?? null
}

async function loadInvoice(pool, invoiceId) {
  const result = await pool.query(
    `SELECT invoice.*, account.family_id
       FROM billing_monthly_invoice invoice
       JOIN family_billing_account account ON account.id = invoice.family_billing_account_id
      WHERE invoice.id = $1`,
    [invoiceId],
  )
  return result.rows[0] ?? null
}

async function createPaymentMethodAlert(pool, accountId, invoice) {
  await recordStripeBillingAlert(pool, {
    event: { id: `monthly-invoice-payment-method:${invoice.id}` },
    object: {
      id: invoice.stripe_invoice_id ?? `monthly-invoice:${invoice.id}`,
      metadata: { familyBillingAccountId: String(accountId), monthlyInvoiceId: String(invoice.id) },
    },
    alertType: 'monthly_invoice_payment_method_required',
    severity: 'warning',
    message: `Monthly household invoice for ${String(invoice.billing_month).slice(0, 7)} needs a saved card or payment link.`,
  }).catch(() => {})
}

/**
 * Before a new month is built, void any prior unpaid remote invoice. This is
 * deliberately fail-closed: if Stripe cannot be voided, we leave the prior
 * invoice open and do not risk presenting the same charges on a second invoice.
 */
async function rollForwardPriorInvoices(pool, { accountId, billingMonth, stripe }) {
  const prior = await pool.query(
    `SELECT * FROM billing_monthly_invoice
      WHERE family_billing_account_id = $1
        AND billing_month < $2::date
        AND status IN ('draft', 'open', 'failed', 'payment_method_required')
      ORDER BY billing_month, id`,
    [accountId, billingMonth],
  )
  for (const invoice of prior.rows) {
    if (invoice.stripe_invoice_id && !stripe) {
      throw new Error(`Prior monthly invoice ${invoice.stripe_invoice_id} cannot be safely carried forward while Stripe is unavailable.`)
    }
    if (invoice.stripe_invoice_id && stripe) {
      try {
        await stripe.invoices.voidInvoice(invoice.stripe_invoice_id)
      } catch (error) {
        throw new Error(`Prior monthly invoice ${invoice.stripe_invoice_id} must be voided before charges can carry forward: ${error?.message ?? error}`)
      }
    }
    await markInvoice(pool, invoice.id, { status: 'void', failure_message: 'Superseded by the next monthly household invoice.' })
    await recordBillingActivityBestEffort(pool, {
      eventKey: `monthly-invoice-voided:${invoice.id}:roll-forward`,
      accountId,
      eventType: 'monthly_invoice_voided',
      summary: `Monthly household invoice for ${String(invoice.billing_month).slice(0, 7)} was voided so its unpaid items can carry forward.`,
      details: { monthlyInvoiceId: Number(invoice.id), billingMonth: invoice.billing_month },
      stripeObjectId: invoice.stripe_invoice_id,
      actorType: 'system',
    })
  }
}

async function createLocalInvoice(pool, { accountId, billingMonth }) {
  const client = typeof pool.connect === 'function' ? await pool.connect() : pool
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [Number(accountId)])
    const existing = await client.query(
      `SELECT * FROM billing_monthly_invoice
        WHERE family_billing_account_id = $1 AND billing_month = $2::date`,
      [accountId, billingMonth],
    )
    if (existing.rows[0]) {
      await client.query('COMMIT')
      return { invoice: existing.rows[0], created: false, lines: [] }
    }
    const charges = await client.query(
      `SELECT charge.id, charge.member_id, charge.description,
              GREATEST(0, charge.amount_cents - COALESCE(application.applied_cents, 0))::int AS remaining_cents
         FROM billing_charge charge
         LEFT JOIN LATERAL (
           SELECT SUM(CASE WHEN item.application_kind = 'reversal' THEN -item.amount_cents ELSE item.amount_cents END)::int AS applied_cents
             FROM billing_payment_application item
            WHERE item.billing_charge_id = charge.id
         ) application ON TRUE
        WHERE charge.family_billing_account_id = $1
          AND charge.amount_cents > 0
          AND GREATEST(0, charge.amount_cents - COALESCE(application.applied_cents, 0)) > 0
          AND NOT EXISTS (
            SELECT 1
              FROM billing_monthly_invoice_line line
              JOIN billing_monthly_invoice prior ON prior.id = line.billing_monthly_invoice_id
             WHERE line.billing_charge_id = charge.id
               AND prior.status IN ('draft', 'open', 'paid', 'payment_method_required')
          )
        ORDER BY charge.service_period_start NULLS FIRST, charge.created_at, charge.id`,
      [accountId],
    )
    if (charges.rows.length === 0) {
      await client.query('COMMIT')
      return { invoice: null, created: false, lines: [] }
    }
    const subtotal = charges.rows.reduce((sum, row) => sum + positive(row.remaining_cents), 0)
    const inserted = await client.query(
      `INSERT INTO billing_monthly_invoice (
         family_billing_account_id, billing_month, status, subtotal_cents, credit_cents, total_cents
       ) VALUES ($1, $2::date, 'draft', $3, 0, $3) RETURNING *`,
      [accountId, billingMonth, subtotal],
    )
    const invoice = inserted.rows[0]
    const lines = []
    for (const charge of charges.rows) {
      const line = await client.query(
        `INSERT INTO billing_monthly_invoice_line (
           billing_monthly_invoice_id, billing_charge_id, member_id, line_type, description, amount_cents
         ) VALUES ($1, $2, $3, 'charge', $4, $5) RETURNING *`,
        [invoice.id, charge.id, charge.member_id, charge.description, positive(charge.remaining_cents)],
      )
      lines.push(line.rows[0])
    }
    await client.query('COMMIT')
    return { invoice, created: true, lines }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    if (client !== pool && typeof client.release === 'function') client.release()
  }
}

async function pushInvoiceToStripe(pool, { account, invoice, lines, stripe }) {
  const customerId = await ensureStripeCustomer(pool, stripe, account)
  const paymentMethodId = await defaultPaymentMethod(stripe, customerId)
  const collectionMethod = paymentMethodId ? 'charge_automatically' : 'send_invoice'
  const remote = await stripe.invoices.create({
    customer: customerId,
    collection_method: collectionMethod,
    ...(collectionMethod === 'send_invoice' ? { days_until_due: 30 } : {}),
    auto_advance: false,
    description: `Vortex Athletics household billing — ${String(invoice.billing_month).slice(0, 7)}`,
    metadata: {
      householdMonthlyInvoice: 'true',
      monthlyInvoiceId: String(invoice.id),
      familyBillingAccountId: String(account.id),
      billingMonth: String(invoice.billing_month).slice(0, 7),
    },
  }, { idempotencyKey: `household-monthly-invoice:${invoice.id}:create` })
  await markInvoice(pool, invoice.id, { stripe_invoice_id: remote.id })
  for (const line of lines) {
    const item = await stripe.invoiceItems.create({
      customer: customerId,
      invoice: remote.id,
      amount: Number(line.amount_cents),
      currency: 'usd',
      description: line.description,
      metadata: {
        monthlyInvoiceId: String(invoice.id),
        monthlyInvoiceLineId: String(line.id),
        billingChargeId: String(line.billing_charge_id),
      },
    }, { idempotencyKey: `household-monthly-invoice:${invoice.id}:line:${line.id}` })
    await pool.query(
      `UPDATE billing_monthly_invoice_line SET stripe_invoice_item_id = $2 WHERE id = $1`,
      [line.id, item.id],
    )
  }
  const finalized = await stripe.invoices.finalizeInvoice(remote.id, { auto_advance: false })
  const saved = await markInvoice(pool, invoice.id, {
    status: paymentMethodId ? 'open' : 'payment_method_required',
    hosted_invoice_url: finalized.hosted_invoice_url ?? null,
  })
  if (!paymentMethodId) {
    await createPaymentMethodAlert(pool, account.id, saved ?? invoice)
    return saved ?? invoice
  }
  try {
    const paid = await stripe.invoices.pay(remote.id, { payment_method: paymentMethodId })
    const attempted = await markInvoice(pool, invoice.id, {
      status: paid.paid ? 'open' : 'failed',
      stripe_payment_intent_id: typeof paid.payment_intent === 'string' ? paid.payment_intent : paid.payment_intent?.id ?? null,
      payment_attempted_at: new Date(),
      hosted_invoice_url: paid.hosted_invoice_url ?? finalized.hosted_invoice_url ?? null,
      failure_message: paid.paid ? null : 'Stripe did not confirm the invoice payment.',
    })
    // Stripe normally delivers invoice.paid immediately afterwards, but record
    // and map a synchronous success here too. The webhook then becomes a safe
    // replay instead of a window where next month's rollover could misclassify
    // a paid invoice as unpaid.
    if (paid.paid) {
      const payment = await recordPaidStripeInvoice(pool, paid, { stripe })
      if (payment) return (await applyHouseholdMonthlyInvoicePayment(pool, { invoice: paid, payment })) ?? attempted
    }
    return attempted
  } catch (error) {
    return markInvoice(pool, invoice.id, {
      status: 'failed',
      payment_attempted_at: new Date(),
      hosted_invoice_url: finalized.hosted_invoice_url ?? null,
      failure_message: String(error?.message ?? error).slice(0, 500),
    })
  }
}

/** Build and attempt the single Stripe invoice for one enabled household/month. */
export async function createHouseholdMonthlyInvoice(pool, {
  account,
  billingMonth = new Date(),
  actorUserId = null,
}) {
  await ensureHouseholdMonthlyInvoiceSchema(pool)
  if (!account?.id || account.household_monthly_billing_enabled !== true) return { skipped: 'not_enabled', invoice: null }
  const month = billingMonthStart(billingMonth)
  await allocateHouseholdPayments(pool, { accountId: account.id, actorType: 'system' })
  const stripe = stripeEnabled() ? await getStripeClient() : null
  await rollForwardPriorInvoices(pool, { accountId: account.id, billingMonth: month, stripe })
  const local = await createLocalInvoice(pool, { accountId: account.id, billingMonth: month })
  if (!local.invoice || !local.created) return { ...local, skipped: local.invoice ? 'already_created' : 'no_open_charges' }
  await recordBillingActivityBestEffort(pool, {
    eventKey: `monthly-invoice-created:${local.invoice.id}`,
    accountId: account.id,
    eventType: 'monthly_invoice_created',
    summary: `Household monthly invoice for ${month.slice(0, 7)} was created.`,
    afterValue: { monthlyInvoiceId: Number(local.invoice.id), billingMonth: month, totalCents: Number(local.invoice.total_cents) },
    details: { lineCount: local.lines.length },
    actorUserId,
    actorType: 'system',
  })
  if (!stripe) {
    const invoice = await markInvoice(pool, local.invoice.id, {
      status: 'payment_method_required',
      failure_message: 'Stripe is not enabled; no automatic card payment was attempted.',
    })
    await createPaymentMethodAlert(pool, account.id, invoice)
    return { invoice, lines: local.lines, created: true, skipped: 'stripe_unavailable' }
  }
  const invoice = await pushInvoiceToStripe(pool, { account, invoice: local.invoice, lines: local.lines, stripe })
  return { invoice, lines: local.lines, created: true }
}

/**
 * Existing accounts created before household invoices defaulted on are safe to
 * enable once they have a reusable card and local recurring schedules, provided
 * no legacy class-level Stripe subscription can collect the same tuition.
 */
export async function activateHouseholdMonthlyBillingForAccount(pool, {
  accountId,
  stripe = null,
  actorUserId = null,
  actorType = 'system',
} = {}) {
  await ensureHouseholdMonthlyInvoiceSchema(pool)
  const account = await pool.query(
    `SELECT * FROM family_billing_account WHERE id = $1 LIMIT 1`,
    [Number(accountId)],
  ).then((result) => result.rows[0] ?? null)
  if (!account) return { status: 'not_found', enabled: false }
  if (account.household_monthly_billing_enabled === true) return { status: 'already_enabled', enabled: true }

  const recurring = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM billing_subscription
      WHERE family_billing_account_id = $1
        AND status = 'active'
        AND source_type <> 'annual_membership'
        AND COALESCE(pricing_option_key, '') <> 'annual_membership'`,
    [account.id],
  )
  if (Number(recurring.rows[0]?.count ?? 0) === 0) return { status: 'no_recurring_enrollments', enabled: false }

  const legacy = await pool.query(
    `SELECT id, stripe_subscription_id
       FROM billing_subscription
      WHERE family_billing_account_id = $1
        AND status = 'active'
        AND source_type <> 'annual_membership'
        AND COALESCE(pricing_option_key, '') <> 'annual_membership'
        AND stripe_subscription_id IS NOT NULL
      LIMIT 1`,
    [account.id],
  )
  if (legacy.rows[0]) {
    return { status: 'legacy_subscription_active', enabled: false, legacySubscriptionId: legacy.rows[0].stripe_subscription_id }
  }

  if (!account.stripe_customer_id) return { status: 'payment_method_required', enabled: false }
  const stripeClient = stripe || (stripeEnabled() ? await getStripeClient() : null)
  if (!stripeClient) return { status: 'stripe_unavailable', enabled: false }
  const customer = await stripeClient.customers.retrieve(account.stripe_customer_id, {
    expand: ['invoice_settings.default_payment_method'],
  })
  if (customer.deleted || !await defaultPaymentMethod(stripeClient, account.stripe_customer_id)) {
    return { status: 'payment_method_required', enabled: false }
  }

  const updated = await pool.query(
    `UPDATE family_billing_account
        SET household_monthly_billing_enabled = TRUE, updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [account.id],
  ).then((result) => result.rows[0] ?? null)
  await recordBillingActivityBestEffort(pool, {
    eventKey: `household-monthly-billing-enabled:${account.id}`,
    accountId: account.id,
    eventType: 'household_monthly_billing_enabled',
    summary: 'Saved-card household monthly billing was enabled for active recurring enrollments.',
    afterValue: { householdMonthlyBillingEnabled: true },
    actorUserId,
    actorType,
  })
  return { status: 'enabled', enabled: true, account: updated }
}

/** Enable the consolidated collection path for every safe saved-card account. */
export async function activateEligibleHouseholdMonthlyBilling(pool, { stripe = null } = {}) {
  await ensureHouseholdMonthlyInvoiceSchema(pool)
  const accounts = await pool.query(
    `SELECT DISTINCT account.id
       FROM family_billing_account account
       JOIN billing_subscription subscription ON subscription.family_billing_account_id = account.id
      WHERE account.household_monthly_billing_enabled = FALSE
        AND account.stripe_customer_id IS NOT NULL
        AND subscription.status = 'active'
        AND subscription.source_type <> 'annual_membership'
        AND COALESCE(subscription.pricing_option_key, '') <> 'annual_membership'
      ORDER BY account.id`,
  )
  const stripeClient = stripe || (stripeEnabled() ? await getStripeClient() : null)
  const results = []
  for (const account of accounts.rows) {
    results.push(await activateHouseholdMonthlyBillingForAccount(pool, {
      accountId: account.id,
      stripe: stripeClient,
      actorType: 'system',
    }))
  }
  return results
}

/** Exact line-level allocation for a successful household monthly Stripe invoice. */
export async function applyHouseholdMonthlyInvoicePayment(pool, { invoice, payment }) {
  await ensureHouseholdMonthlyInvoiceSchema(pool)
  const local = await pool.query(
    `SELECT * FROM billing_monthly_invoice WHERE stripe_invoice_id = $1 LIMIT 1`,
    [invoice?.id],
  ).then((result) => result.rows[0] ?? null)
  if (!local || !payment?.id) return null
  const lines = await pool.query(
    `SELECT * FROM billing_monthly_invoice_line
      WHERE billing_monthly_invoice_id = $1 AND line_type = 'charge'
      ORDER BY id`,
    [local.id],
  )
  for (const line of lines.rows) {
    await pool.query(
      `INSERT INTO billing_payment_application (
         billing_payment_id, billing_charge_id, amount_cents, application_kind, idempotency_key, allocation_reason
       ) VALUES ($1, $2, $3, 'application', $4, 'monthly_invoice_line')
       ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
      [payment.id, line.billing_charge_id, line.amount_cents, `monthly-invoice:${local.id}:payment:${payment.id}:line:${line.id}`],
    )
  }
  const paidAt = invoice?.status_transitions?.paid_at
    ? new Date(Number(invoice.status_transitions.paid_at) * 1000)
    : new Date()
  const updated = await markInvoice(pool, local.id, {
    status: 'paid',
    stripe_payment_intent_id: payment.stripe_payment_intent_id ?? local.stripe_payment_intent_id,
    paid_at: paidAt,
    failure_message: null,
  })
  await allocateHouseholdPayments(pool, { accountId: local.family_billing_account_id, actorType: 'stripe' })
  await recordBillingActivityBestEffort(pool, {
    eventKey: `monthly-invoice-paid:${local.id}:${payment.id}`,
    accountId: local.family_billing_account_id,
    paymentId: payment.id,
    eventType: 'monthly_invoice_paid',
    summary: `Household monthly invoice for ${String(local.billing_month).slice(0, 7)} was paid.`,
    afterValue: { monthlyInvoiceId: Number(local.id), paymentId: Number(payment.id), totalCents: Number(local.total_cents) },
    stripeObjectId: local.stripe_invoice_id,
    actorType: 'stripe',
  })
  return updated
}

export async function listHouseholdMonthlyInvoices(pool, accountId, { limit = 6 } = {}) {
  await ensureHouseholdMonthlyInvoiceSchema(pool)
  const result = await pool.query(
    `SELECT invoice.*,
            COALESCE(lines.line_count, 0)::int AS line_count
       FROM billing_monthly_invoice invoice
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS line_count
         FROM billing_monthly_invoice_line line WHERE line.billing_monthly_invoice_id = invoice.id
       ) lines ON TRUE
      WHERE invoice.family_billing_account_id = $1
      ORDER BY invoice.billing_month DESC, invoice.id DESC
      LIMIT $2`,
    [accountId, Math.max(1, Math.min(24, Number(limit) || 6))],
  )
  const invoiceIds = result.rows.map((row) => Number(row.id))
  const lines = invoiceIds.length === 0
    ? []
    : await pool.query(
      `SELECT line.*, TRIM(CONCAT(member.first_name, ' ', member.last_name)) AS member_name
         FROM billing_monthly_invoice_line line
         LEFT JOIN member ON member.id = line.member_id
        WHERE line.billing_monthly_invoice_id = ANY($1::bigint[])
        ORDER BY line.billing_monthly_invoice_id, line.id`,
      [invoiceIds],
    ).then((response) => response.rows)
  const linesByInvoice = new Map()
  for (const line of lines) {
    const list = linesByInvoice.get(Number(line.billing_monthly_invoice_id)) ?? []
    list.push({
      id: Number(line.id), memberName: line.member_name ?? null, description: line.description,
      lineType: line.line_type, amountCents: Number(line.amount_cents),
    })
    linesByInvoice.set(Number(line.billing_monthly_invoice_id), list)
  }
  return result.rows.map((row) => ({
    id: Number(row.id), billingMonth: String(row.billing_month).slice(0, 10), status: row.status,
    subtotalCents: Number(row.subtotal_cents), creditCents: Number(row.credit_cents), totalCents: Number(row.total_cents),
    stripeInvoiceId: row.stripe_invoice_id ?? null, hostedInvoiceUrl: row.hosted_invoice_url ?? null,
    paymentAttemptedAt: row.payment_attempted_at ?? null, paidAt: row.paid_at ?? null,
    failureMessage: row.failure_message ?? null, lineCount: Number(row.line_count),
    lines: linesByInvoice.get(Number(row.id)) ?? [],
  }))
}
