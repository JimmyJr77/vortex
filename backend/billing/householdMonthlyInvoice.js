import { getStripeClient, ensureStripeCustomer, stripeEnabled } from './stripeBilling.js'
import { allocateHouseholdPayments } from './paymentAllocation.js'
import { recordBillingActivityBestEffort } from './billingActivity.js'
import { recordStripeBillingAlert } from './stripeOperations.js'
import {
  preparePaidStripeInvoiceRecord,
  upsertPaidStripeInvoicePayment,
} from './stripeWebhookLifecycle.js'
import {
  billingHouseholdAutoActivateEnabled,
  billingHouseholdInvoiceEnabled,
} from './billingFeatureFlags.js'
import { facilityMonth, isValidTimeZone } from './canonicalBillingMigrationState.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { loadCanonicalCollectibleBalanceCents } from './canonicalBillingAccount.js'

let schemaEnsured = false

export async function ensureHouseholdMonthlyInvoiceSchema(pool) {
  if (schemaEnsured) return
  // Schema creation used to happen here on the first billing request. Migrations
  // now own that responsibility (774_household_monthly_invoicing.sql), keeping
  // request paths free of schema DDL and schema-probing round trips.
  schemaEnsured = true
}

export function billingMonthStart(value = new Date(), timeZone) {
  if (!isValidTimeZone(timeZone)) {
    throw new Error(`A valid facility timezone is required for household billing: ${timeZone || '(missing)'}.`)
  }
  // A date-only value is already a facility civil date. Parsing it as UTC and
  // converting it back through a western timezone would incorrectly move it
  // into the prior month.
  const civilDate = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null
  if (civilDate) {
    const date = new Date(`${civilDate[1]}-${civilDate[2]}-${civilDate[3]}T12:00:00.000Z`)
    if (
      Number.isNaN(date.getTime())
      || date.getUTCFullYear() !== Number(civilDate[1])
      || date.getUTCMonth() + 1 !== Number(civilDate[2])
      || date.getUTCDate() !== Number(civilDate[3])
    ) {
      throw new Error('Billing month must be a valid date.')
    }
    return `${civilDate[1]}-${civilDate[2]}-01`
  }
  return facilityMonth(value, timeZone)
}

function positive(value) {
  return Math.max(0, Math.round(Number(value) || 0))
}

function dateOnly(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  const match = String(value ?? '').match(/^\d{4}-\d{2}-\d{2}/)
  return match?.[0] ?? null
}

export function stripeInvoiceIsPaid(invoice) {
  return invoice?.status === 'paid' || invoice?.paid === true
}

async function defaultPaymentMethod(stripe, customerId) {
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ['invoice_settings.default_payment_method'],
  })
  if (customer.deleted) return null
  let method = customer.invoice_settings?.default_payment_method ?? null
  // Stripe expands this field to either a PaymentMethod object or null.  Null
  // is also an object in JavaScript, so guard it before reading its id.
  if (method && typeof method === 'object') method = method.id
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

// Compatibility export for existing callers. All account collectors now use
// the same lock implementation as durable payment-attempt reservations.
export const withHouseholdMonthlyInvoiceAccountLock = withBillingAccountCollectionLock

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

async function loadActiveCanonicalBillingMigration(pool, accountId) {
  return pool.query(
    `SELECT id, billing_migration_run_id, state
       FROM billing_account_migration
      WHERE family_billing_account_id = $1
        AND state NOT IN ('verified', 'rolled_back')
      ORDER BY id DESC
      LIMIT 1`,
    [Number(accountId)],
  ).then((result) => result.rows[0] ?? null)
}

function migrationManagedActivationResult(account, migration) {
  return {
    status: 'migration_managed',
    enabled: account?.household_monthly_billing_enabled === true,
    migrationId: Number(migration.id),
    migrationRunId: Number(migration.billing_migration_run_id),
    migrationState: migration.state,
  }
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
  let rolledForward = 0
  for (const invoice of prior.rows) {
    if (invoice.stripe_invoice_id && !stripe) {
      throw new Error(`Prior monthly invoice ${invoice.stripe_invoice_id} cannot be safely carried forward while Stripe is unavailable.`)
    }
    if (invoice.stripe_invoice_id && stripe) {
      let remote
      try {
        remote = await stripe.invoices.retrieve(invoice.stripe_invoice_id)
      } catch (error) {
        throw new Error(`Prior monthly invoice ${invoice.stripe_invoice_id} could not be verified before roll-forward: ${error?.message ?? error}`)
      }
      if (
        String(remote?.metadata?.monthlyInvoiceId ?? '') !== String(invoice.id)
        || String(remote?.metadata?.familyBillingAccountId ?? '') !== String(accountId)
        || String(remote?.metadata?.billingMonth ?? '') !== String(invoice.billing_month).slice(0, 7)
      ) {
        throw new Error(`Prior Stripe invoice ${invoice.stripe_invoice_id} does not match monthly invoice ${invoice.id}.`)
      }
      if (stripeInvoiceIsPaid(remote)) {
        const settlement = await recordAndApplyHouseholdMonthlyInvoicePayment(pool, {
          invoice: remote,
          stripe,
        })
        if (settlement?.conflicted) {
          throw new Error(`Paid prior household invoice requires reconciliation: ${settlement.reason}`)
        }
        continue
      }

      const paymentIntentId = stripeObjectId(remote.payment_intent)
        ?? invoice.stripe_payment_intent_id
      if (paymentIntentId) {
        if (typeof stripe?.paymentIntents?.retrieve !== 'function') {
          throw new Error(`Prior monthly invoice ${invoice.stripe_invoice_id} has an unverifiable payment attempt.`)
        }
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
        if (intent?.status === 'succeeded') {
          const refreshed = await stripe.invoices.retrieve(invoice.stripe_invoice_id)
          if (!stripeInvoiceIsPaid(refreshed)) {
            throw new Error(`Prior monthly invoice ${invoice.stripe_invoice_id} has a succeeded payment that is not settled.`)
          }
          const settlement = await recordAndApplyHouseholdMonthlyInvoicePayment(pool, {
            invoice: refreshed,
            stripe,
          })
          if (settlement?.conflicted) {
            throw new Error(`Paid prior household invoice requires reconciliation: ${settlement.reason}`)
          }
          continue
        }
        if (!['requires_payment_method', 'canceled'].includes(intent?.status)) {
          throw new Error(
            `Prior monthly invoice ${invoice.stripe_invoice_id} payment is ${intent?.status || 'unknown'}; roll-forward stopped.`,
          )
        }
      }

      try {
        if (remote.status === 'draft') {
          if (typeof stripe?.invoices?.del !== 'function') {
            throw new Error('Stripe draft-invoice deletion is unavailable.')
          }
          await stripe.invoices.del(invoice.stripe_invoice_id)
        } else if (remote.status === 'open') {
          await stripe.invoices.voidInvoice(invoice.stripe_invoice_id)
        } else if (!['void', 'uncollectible'].includes(remote.status)) {
          throw new Error(`Stripe invoice status ${remote.status || 'unknown'} is not safe to roll forward.`)
        }
      } catch (error) {
        throw new Error(`Prior monthly invoice ${invoice.stripe_invoice_id} could not be retired before charges carry forward: ${error?.message ?? error}`)
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
    rolledForward += 1
  }
  return rolledForward
}

export async function createLocalHouseholdInvoice(client, { accountId, billingMonth }) {
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [Number(accountId)])
    const existing = await client.query(
      `SELECT * FROM billing_monthly_invoice
        WHERE family_billing_account_id = $1 AND billing_month = $2::date`,
      [accountId, billingMonth],
    )
    if (existing.rows[0]) {
      const lines = await client.query(
        `SELECT * FROM billing_monthly_invoice_line
          WHERE billing_monthly_invoice_id = $1
          ORDER BY id`,
        [existing.rows[0].id],
      )
      await client.query('COMMIT')
      return { invoice: existing.rows[0], created: false, lines: lines.rows }
    }
    const charges = await client.query(
      `SELECT charge.id, charge.member_id, charge.description,
              GREATEST(
                0,
                charge.amount_cents
                  - COALESCE(application.applied_cents, 0)
                  - COALESCE(credit_application.applied_cents, 0)
              )::int AS remaining_cents
         FROM billing_charge charge
         LEFT JOIN LATERAL (
           SELECT SUM(CASE WHEN item.application_kind = 'reversal' THEN -item.amount_cents ELSE item.amount_cents END)::int AS applied_cents
             FROM billing_payment_application item
             JOIN billing_payment settled_payment
               ON settled_payment.id = item.billing_payment_id
            WHERE item.billing_charge_id = charge.id
              AND settled_payment.external_status IN ('settled', 'succeeded')
         ) application ON TRUE
         LEFT JOIN LATERAL (
           SELECT SUM(credit.amount_cents)::int AS applied_cents
             FROM billing_charge_credit_application credit
             JOIN billing_monthly_invoice_line target_line
               ON target_line.id = credit.target_invoice_line_id
            WHERE target_line.billing_charge_id = charge.id
         ) credit_application ON TRUE
        WHERE charge.family_billing_account_id = $1
          AND charge.amount_cents > 0
          AND GREATEST(
                0,
                charge.amount_cents
                  - COALESCE(application.applied_cents, 0)
                  - COALESCE(credit_application.applied_cents, 0)
              ) > 0
          AND NOT EXISTS (
            SELECT 1
              FROM billing_monthly_invoice_line line
              JOIN billing_monthly_invoice prior ON prior.id = line.billing_monthly_invoice_id
             WHERE line.billing_charge_id = charge.id
               AND prior.status IN ('draft', 'open', 'failed', 'payment_method_required')
          )
          AND NOT EXISTS (
            SELECT 1
              FROM billing_payment_attempt attempt
              LEFT JOIN billing_payment_attempt_charge reservation
                ON reservation.billing_payment_attempt_id = attempt.id
             WHERE attempt.family_billing_account_id = $1
               AND (
                 attempt.status IN ('pending', 'processing', 'reconciliation_required')
                 OR (attempt.status = 'reserved' AND attempt.expires_at > now())
               )
               AND (
                 reservation.billing_charge_id = charge.id
                 OR attempt.target_charge_id = charge.id
                 OR attempt.target_charge_id = charge.related_charge_id
               )
          )
        ORDER BY charge.service_period_start NULLS FIRST, charge.created_at, charge.id`,
      [accountId],
    )
    if (charges.rows.length === 0) {
      await client.query('COMMIT')
      return { invoice: null, created: false, lines: [] }
    }
    const credits = await client.query(
      `SELECT charge.id, charge.member_id, charge.description, charge.related_charge_id,
              -LEAST(
                ABS(charge.amount_cents),
                GREATEST(
                  0,
                  ABS(charge.amount_cents) - COALESCE(consumed.consumed_cents, 0)
                )
              )::int AS available_cents
         FROM billing_charge charge
         LEFT JOIN LATERAL (
           SELECT SUM(consumption.amount_cents)::int AS consumed_cents
             FROM (
               SELECT application.amount_cents
                 FROM billing_charge_credit_application application
                 JOIN billing_monthly_invoice_line credit_line
                   ON credit_line.id = application.credit_invoice_line_id
                WHERE credit_line.billing_charge_id = charge.id
               UNION ALL
               SELECT ABS(line.amount_cents)::int AS amount_cents
                 FROM billing_monthly_invoice_line line
                 JOIN billing_monthly_invoice prior ON prior.id = line.billing_monthly_invoice_id
                WHERE line.billing_charge_id = charge.id
                  AND line.line_type = 'credit'
                  AND prior.status IN ('draft', 'open', 'failed', 'payment_method_required')
             ) consumption
         ) consumed ON TRUE
        WHERE charge.family_billing_account_id = $1
          AND charge.amount_cents < 0
          AND GREATEST(
                0,
                ABS(charge.amount_cents) - COALESCE(consumed.consumed_cents, 0)
              ) > 0
        ORDER BY
          CASE WHEN charge.related_charge_id IS NULL THEN 1 ELSE 0 END,
          charge.created_at,
          charge.id
        FOR UPDATE OF charge`,
      [accountId],
    )
    const subtotal = charges.rows.reduce((sum, row) => sum + positive(row.remaining_cents), 0)
    const availableCreditCents = credits.rows.reduce(
      (sum, row) => sum + Math.abs(Number(row.available_cents) || 0),
      0,
    )
    const creditCents = Math.min(subtotal, availableCreditCents)
    const total = subtotal - creditCents
    const canonicalCollectibleCents = await loadCanonicalCollectibleBalanceCents(client, accountId)
    if (canonicalCollectibleCents !== total) {
      throw new Error(
        `Household invoice net ${total} does not match canonical unreserved collectible balance ${canonicalCollectibleCents}.`,
      )
    }
    if (total <= 0) {
      await client.query('COMMIT')
      return { invoice: null, created: false, lines: [] }
    }
    const inserted = await client.query(
      `INSERT INTO billing_monthly_invoice (
         family_billing_account_id, billing_month, status, subtotal_cents, credit_cents, total_cents
       ) VALUES ($1, $2::date, 'draft', $3, $4, $5) RETURNING *`,
      [accountId, billingMonth, subtotal, creditCents, total],
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
    let remainingCreditCents = creditCents
    for (const credit of credits.rows) {
      if (remainingCreditCents <= 0) break
      const appliedCreditCents = Math.min(
        remainingCreditCents,
        Math.abs(Number(credit.available_cents) || 0),
      )
      if (appliedCreditCents <= 0) continue
      const line = await client.query(
        `INSERT INTO billing_monthly_invoice_line (
           billing_monthly_invoice_id, billing_charge_id, member_id, line_type, description, amount_cents
         ) VALUES ($1, $2, $3, 'credit', $4, $5) RETURNING *`,
        [invoice.id, credit.id, credit.member_id, credit.description, -appliedCreditCents],
      )
      lines.push(line.rows[0])
      remainingCreditCents -= appliedCreditCents
    }
    if (remainingCreditCents !== 0) {
      throw new Error('Household invoice credit lines do not equal its canonical credit total.')
    }
    await client.query('COMMIT')
    return { invoice, created: true, lines }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  }
}

function stripeObjectId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

function paymentAttemptDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function nextPaymentAttemptDate(previous) {
  const prior = paymentAttemptDate(previous)?.getTime() ?? 0
  return new Date(Math.max(Date.now(), prior + 1))
}

function paymentIntentFromError(error) {
  return stripeObjectId(
    error?.payment_intent
    ?? error?.paymentIntent
    ?? error?.raw?.payment_intent
    ?? error?.raw?.paymentIntent,
  )
}

async function priorPaymentAttemptCanAdvance(stripe, invoice) {
  if (invoice.status !== 'failed' || !invoice.stripe_payment_intent_id) return false
  if (typeof stripe?.paymentIntents?.retrieve !== 'function') {
    throw new Error(`Cannot verify failed payment intent ${invoice.stripe_payment_intent_id}; household invoice retry stopped.`)
  }
  const intent = await stripe.paymentIntents.retrieve(invoice.stripe_payment_intent_id)
  if (['requires_payment_method', 'canceled'].includes(intent?.status)) return true
  throw new Error(
    `Payment intent ${invoice.stripe_payment_intent_id} is ${intent?.status || 'unknown'}; household invoice retry stopped to prevent duplicate collection.`,
  )
}

async function reservePaymentAttempt(pool, invoice, stripe) {
  const priorAttempt = paymentAttemptDate(invoice.payment_attempted_at)
  const priorFailureConfirmed = await priorPaymentAttemptCanAdvance(stripe, invoice)
  const attemptedAt = !priorAttempt || priorFailureConfirmed
    ? nextPaymentAttemptDate(priorAttempt)
    : priorAttempt
  const values = {
    status: 'open',
    payment_attempted_at: attemptedAt,
    failure_message: null,
  }
  // A non-null payment intent on a failed row proves that Stripe completed the
  // prior attempt. Clearing it while durably advancing the timestamp creates a
  // new attempt generation. When the outcome is unknown, retain both the token
  // and null intent so a restarted worker replays the exact same Stripe key.
  if (priorFailureConfirmed) values.stripe_payment_intent_id = null
  const saved = await markInvoice(pool, invoice.id, values)
  return {
    invoice: saved ?? { ...invoice, ...values },
    idempotencyKey: `household-monthly-invoice:${invoice.id}:pay:${attemptedAt.getTime()}`,
  }
}

function remoteInvoiceMetadataMatches(remote, { account, invoice }) {
  return Boolean(
    remote
    && String(remote.metadata?.monthlyInvoiceId ?? '') === String(invoice.id)
    && String(remote.metadata?.familyBillingAccountId ?? '') === String(account.id)
    && String(remote.metadata?.billingMonth ?? '') === String(invoice.billing_month).slice(0, 7)
  )
}

function remoteInvoiceMatches(remote, { account, invoice, customerId }) {
  return remoteInvoiceMetadataMatches(remote, { account, invoice })
    && String(stripeObjectId(remote.customer) ?? '') === String(customerId)
}

async function listStripeCollection(fetchPage, initialParams, cursorField) {
  const rows = []
  let cursor = null
  do {
    const response = await fetchPage({
      ...initialParams,
      ...(cursor ? { [cursorField]: cursor } : {}),
    })
    rows.push(...(response?.data ?? []))
    cursor = response?.has_more
      ? (cursorField === 'page' ? response.next_page : response.data?.at(-1)?.id)
      : null
    if (response?.has_more && !cursor) {
      throw new Error('Stripe pagination did not return a continuation cursor.')
    }
  } while (cursor)
  return rows
}

async function findRecoverableStripeInvoice(stripe, { account, invoice, customerId }) {
  if (invoice.stripe_invoice_id) {
    const remote = await stripe.invoices.retrieve(invoice.stripe_invoice_id)
    if (!remoteInvoiceMatches(remote, { account, invoice, customerId })) {
      throw new Error(`Stripe invoice ${invoice.stripe_invoice_id} does not match monthly invoice ${invoice.id}.`)
    }
    return remote
  }

  const candidates = new Map()
  if (typeof stripe.invoices.search === 'function') {
    const searched = await listStripeCollection(
      (params) => stripe.invoices.search(params),
      { query: `metadata['monthlyInvoiceId']:'${Number(invoice.id)}'`, limit: 100 },
      'page',
    )
    for (const remote of searched) {
      if (
        remoteInvoiceMetadataMatches(remote, { account, invoice })
        && String(stripeObjectId(remote.customer) ?? '') !== String(customerId)
      ) {
        throw new Error(`Stripe invoice ${remote.id} matches monthly invoice ${invoice.id} under a different customer.`)
      }
      if (remoteInvoiceMatches(remote, { account, invoice, customerId })) candidates.set(remote.id, remote)
    }
  }
  if (typeof stripe.invoices.list === 'function') {
    const listed = await listStripeCollection(
      (params) => stripe.invoices.list(params),
      { customer: customerId, limit: 100 },
      'starting_after',
    )
    for (const remote of listed) {
      if (remoteInvoiceMatches(remote, { account, invoice, customerId })) candidates.set(remote.id, remote)
    }
  }
  if (candidates.size > 1) {
    throw new Error(`Multiple Stripe invoices match monthly invoice ${invoice.id}; manual review is required.`)
  }
  return candidates.values().next().value ?? null
}

async function persistStripeInvoiceId(pool, invoice, stripeInvoiceId) {
  const result = await pool.query(
    `UPDATE billing_monthly_invoice
        SET stripe_invoice_id = $2, updated_at = now()
      WHERE id = $1
        AND (stripe_invoice_id IS NULL OR stripe_invoice_id = $2)
      RETURNING *`,
    [invoice.id, stripeInvoiceId],
  )
  if (!result.rows[0]) {
    throw new Error(`Monthly invoice ${invoice.id} is already linked to a different Stripe invoice.`)
  }
  return result.rows[0]
}

async function ensureRemoteInvoice(pool, { account, invoice, stripe, customerId, collectionMethod }) {
  let remote = await findRecoverableStripeInvoice(stripe, { account, invoice, customerId })
  if (!remote) {
    remote = await stripe.invoices.create({
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
  }
  await persistStripeInvoiceId(pool, invoice, remote.id)
  return remote
}

async function listRemoteInvoiceItems(stripe, remoteId) {
  return listStripeCollection(
    (params) => stripe.invoiceItems.list(params),
    { invoice: remoteId, limit: 100 },
    'starting_after',
  )
}

async function persistStripeInvoiceItemId(pool, line, itemId) {
  const result = await pool.query(
    `UPDATE billing_monthly_invoice_line
        SET stripe_invoice_item_id = $2
      WHERE id = $1
        AND (stripe_invoice_item_id IS NULL OR stripe_invoice_item_id = $2)
      RETURNING *`,
    [line.id, itemId],
  )
  if (!result.rows[0]) {
    throw new Error(`Monthly invoice line ${line.id} is already linked to a different Stripe invoice item.`)
  }
}

async function ensureRemoteInvoiceItems(pool, { invoice, lines, remote, stripe, customerId }) {
  const remoteItems = await listRemoteInvoiceItems(stripe, remote.id)
  const expectedById = new Map(lines.map((line) => [String(line.id), line]))
  const remoteByLineId = new Map()
  for (const item of remoteItems) {
    const monthlyInvoiceId = String(item.metadata?.monthlyInvoiceId ?? '')
    const lineId = String(item.metadata?.monthlyInvoiceLineId ?? '')
    if (monthlyInvoiceId !== String(invoice.id) || !expectedById.has(lineId)) {
      throw new Error(`Stripe invoice ${remote.id} contains an unexpected invoice item ${item.id}.`)
    }
    if (remoteByLineId.has(lineId)) {
      throw new Error(`Stripe invoice ${remote.id} contains duplicate items for monthly invoice line ${lineId}.`)
    }
    const line = expectedById.get(lineId)
    if (Number(item.amount) !== Number(line.amount_cents)) {
      throw new Error(`Stripe invoice item ${item.id} does not match monthly invoice line ${lineId}.`)
    }
    remoteByLineId.set(lineId, item)
  }

  for (const line of lines) {
    const existing = remoteByLineId.get(String(line.id))
    if (line.stripe_invoice_item_id) {
      if (!existing || String(existing.id) !== String(line.stripe_invoice_item_id)) {
        throw new Error(`Monthly invoice line ${line.id} has an inconsistent Stripe invoice item link.`)
      }
      continue
    }
    if (existing) {
      await persistStripeInvoiceItemId(pool, line, existing.id)
      continue
    }
    if (remote.status !== 'draft') {
      throw new Error(`Finalized Stripe invoice ${remote.id} is missing monthly invoice line ${line.id}.`)
    }
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
        lineType: String(line.line_type),
      },
    }, { idempotencyKey: `household-monthly-invoice:${invoice.id}:line:${line.id}` })
    await persistStripeInvoiceItemId(pool, line, item.id)
  }
}

async function syncAlreadyFinalizedInvoice(pool, {
  account,
  invoice,
  remote,
  stripe,
  paymentMethodId = null,
}) {
  if (stripeInvoiceIsPaid(remote)) {
    const settlement = await recordAndApplyHouseholdMonthlyInvoicePayment(pool, { invoice: remote, stripe })
    if (settlement?.conflicted) {
      throw new Error(`Paid household invoice requires reconciliation: ${settlement.reason}`)
    }
    if (settlement?.invoice) return settlement.invoice
    return markInvoice(pool, invoice.id, {
      status: 'paid',
      paid_at: remote.status_transitions?.paid_at
        ? new Date(Number(remote.status_transitions.paid_at) * 1000)
        : new Date(),
      hosted_invoice_url: remote.hosted_invoice_url ?? null,
      failure_message: null,
    })
  }
  if (remote.status === 'open') {
    const status = paymentMethodId ? 'open' : 'payment_method_required'
    const saved = await markInvoice(pool, invoice.id, {
      status,
      hosted_invoice_url: remote.hosted_invoice_url ?? null,
      failure_message: null,
    })
    if (status === 'payment_method_required') await createPaymentMethodAlert(pool, account.id, saved ?? invoice)
    // An automatic-payment invoice can be open because the worker stopped
    // after finalization but before the idempotent pay call completed. Return
    // null so the caller resumes that stable Stripe operation. A paid remote
    // invoice is handled above, which prevents duplicate collection.
    return status === 'payment_method_required' ? (saved ?? invoice) : null
  }
  if (remote.status === 'void') {
    return markInvoice(pool, invoice.id, { status: 'void', failure_message: 'Stripe invoice was voided.' })
  }
  if (remote.status === 'uncollectible') {
    return markInvoice(pool, invoice.id, { status: 'failed', failure_message: 'Stripe invoice is uncollectible.' })
  }
  return null
}

async function pushInvoiceToStripe(pool, { account, invoice, lines, stripe }) {
  const customerId = await ensureStripeCustomer(pool, stripe, account)
  const paymentMethodId = await defaultPaymentMethod(stripe, customerId)
  const collectionMethod = paymentMethodId ? 'charge_automatically' : 'send_invoice'
  const remote = await ensureRemoteInvoice(pool, { account, invoice, stripe, customerId, collectionMethod })
  await ensureRemoteInvoiceItems(pool, { invoice, lines, remote, stripe, customerId })
  const alreadyFinalized = await syncAlreadyFinalizedInvoice(pool, {
    account,
    invoice,
    remote,
    stripe,
    paymentMethodId,
  })
  if (alreadyFinalized) return alreadyFinalized

  const finalized = remote.status === 'draft'
    ? await stripe.invoices.finalizeInvoice(
        remote.id,
        { auto_advance: false },
        { idempotencyKey: `household-monthly-invoice:${invoice.id}:finalize` },
      )
    : remote
  if (finalized.status !== 'open') {
    const finalizedWithoutPayment = await syncAlreadyFinalizedInvoice(pool, {
      account,
      invoice,
      remote: finalized,
      stripe,
      paymentMethodId,
    })
    if (finalizedWithoutPayment) return finalizedWithoutPayment
    throw new Error(`Stripe invoice ${remote.id} finalized with unexpected status ${finalized.status}.`)
  }
  const saved = await markInvoice(pool, invoice.id, {
    status: paymentMethodId ? 'open' : 'payment_method_required',
    hosted_invoice_url: finalized.hosted_invoice_url ?? null,
  })
  if (!paymentMethodId) {
    await createPaymentMethodAlert(pool, account.id, saved ?? invoice)
    return saved ?? invoice
  }
  const paymentAttempt = await reservePaymentAttempt(pool, invoice, stripe)
  await markInvoice(pool, invoice.id, {
    hosted_invoice_url: finalized.hosted_invoice_url ?? null,
  })
  try {
    const paid = await stripe.invoices.pay(
      remote.id,
      { payment_method: paymentMethodId },
      { idempotencyKey: paymentAttempt.idempotencyKey },
    )
    const paymentConfirmed = stripeInvoiceIsPaid(paid)
    const attempted = await markInvoice(pool, invoice.id, {
      status: paymentConfirmed ? 'open' : 'failed',
      stripe_payment_intent_id: typeof paid.payment_intent === 'string' ? paid.payment_intent : paid.payment_intent?.id ?? null,
      hosted_invoice_url: paid.hosted_invoice_url ?? finalized.hosted_invoice_url ?? null,
      failure_message: paymentConfirmed ? null : 'Stripe did not confirm the invoice payment.',
    })
    // Stripe normally delivers invoice.paid immediately afterwards, but record
    // and map a synchronous success here too. The webhook then becomes a safe
    // replay instead of a window where next month's rollover could misclassify
    // a paid invoice as unpaid.
    if (paymentConfirmed) {
      const settlement = await recordAndApplyHouseholdMonthlyInvoicePayment(pool, { invoice: paid, stripe })
      if (settlement?.conflicted) {
        throw new Error(`Paid household invoice requires reconciliation: ${settlement.reason}`)
      }
      if (settlement?.invoice) return settlement.invoice
    }
    return attempted
  } catch (error) {
    const paymentIntentId = paymentIntentFromError(error)
    return markInvoice(pool, invoice.id, {
      status: 'failed',
      ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
      hosted_invoice_url: finalized.hosted_invoice_url ?? null,
      failure_message: String(error?.message ?? error).slice(0, 500),
    })
  }
}

/** Build and attempt the single Stripe invoice for one enabled household/month. */
export async function createHouseholdMonthlyInvoice(pool, {
  account,
  billingMonth = new Date(),
  facilityTimeZone = account?.facility_timezone,
  actorUserId = null,
  environment = process.env,
  stripeClient = undefined,
}) {
  await ensureHouseholdMonthlyInvoiceSchema(pool)
  if (!billingHouseholdInvoiceEnabled(environment)) {
    return { skipped: 'feature_disabled', invoice: null, created: false }
  }
  if (!account?.id || account.household_monthly_billing_enabled !== true) return { skipped: 'not_enabled', invoice: null }
  return withHouseholdMonthlyInvoiceAccountLock(pool, account.id, async (db) => {
    const month = billingMonthStart(billingMonth, facilityTimeZone)
    await allocateHouseholdPayments(db, { accountId: account.id, actorType: 'system' })
    const stripe = stripeClient === undefined
      ? (stripeEnabled() ? await getStripeClient() : null)
      : stripeClient
    const rolledForwardInvoices = await rollForwardPriorInvoices(db, {
      accountId: account.id,
      billingMonth: month,
      stripe,
    })
    // Open monthly invoices reserve their charges from the general allocator.
    // Once those invoices are safely voided, replay allocation before building
    // the replacement so cash/check/external payments recorded in the meantime
    // reduce the carried balance instead of being collected again by Stripe.
    if (rolledForwardInvoices > 0) {
      await allocateHouseholdPayments(db, { accountId: account.id, actorType: 'system' })
    }
    const local = await createLocalHouseholdInvoice(db, { accountId: account.id, billingMonth: month })
    if (!local.invoice) return { ...local, skipped: 'no_open_charges' }

    const resumable = local.invoice.status === 'draft'
      || local.invoice.status === 'open'
      || local.invoice.status === 'payment_method_required'
      || local.invoice.status === 'failed'
    if (!local.created && !resumable) return { ...local, skipped: 'already_created' }

    if (local.created) {
      await recordBillingActivityBestEffort(db, {
        eventKey: `monthly-invoice-created:${local.invoice.id}`,
        accountId: account.id,
        eventType: 'monthly_invoice_created',
        summary: `Household monthly invoice for ${month.slice(0, 7)} was created.`,
        afterValue: { monthlyInvoiceId: Number(local.invoice.id), billingMonth: month, totalCents: Number(local.invoice.total_cents) },
        details: { lineCount: local.lines.length },
        actorUserId,
        actorType: 'system',
      })
    }
    if (!stripe) {
      const invoice = await markInvoice(db, local.invoice.id, {
        status: 'draft',
        failure_message: 'Stripe is not enabled; invoice creation remains pending.',
      })
      await createPaymentMethodAlert(db, account.id, invoice)
      return {
        invoice,
        lines: local.lines,
        created: local.created,
        resumed: !local.created,
        skipped: 'stripe_unavailable',
      }
    }
    const invoice = await pushInvoiceToStripe(db, { account, invoice: local.invoice, lines: local.lines, stripe })
    return { invoice, lines: local.lines, created: local.created, resumed: !local.created }
  })
}

/**
 * Existing accounts created before household invoices defaulted on are safe to
 * enable once they have a reusable card and local recurring schedules, provided
 * no legacy class-level Stripe subscription can collect the same tuition.
 */
export async function activateHouseholdMonthlyBillingForAccount(pool, {
  accountId,
  environment = process.env,
} = {}) {
  await ensureHouseholdMonthlyInvoiceSchema(pool)
  if (!billingHouseholdAutoActivateEnabled(environment)) {
    return { status: 'feature_disabled', enabled: false }
  }
  const account = await pool.query(
    `SELECT * FROM family_billing_account WHERE id = $1 LIMIT 1`,
    [Number(accountId)],
  ).then((result) => result.rows[0] ?? null)
  if (!account) return { status: 'not_found', enabled: false }
  const activeMigration = await loadActiveCanonicalBillingMigration(pool, account.id)
  if (activeMigration) return migrationManagedActivationResult(account, activeMigration)
  if (account.household_monthly_billing_enabled === true) return { status: 'already_enabled', enabled: true }

  // The canonical migration saga owns the only FALSE -> TRUE transition. A
  // generic repair or recurring sweep may observe state, but it cannot infer
  // that remote per-class collection was retired safely.
  return { status: 'canonical_migration_required', enabled: false }
}

/** Inspect generic saved-card candidates without bypassing canonical cutover. */
export async function activateEligibleHouseholdMonthlyBilling(pool, {
  stripe = null,
  environment = process.env,
} = {}) {
  await ensureHouseholdMonthlyInvoiceSchema(pool)
  if (!billingHouseholdAutoActivateEnabled(environment)) return []
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
  const results = []
  for (const account of accounts.rows) {
    results.push(await activateHouseholdMonthlyBillingForAccount(pool, {
      accountId: account.id,
      stripe,
      actorType: 'system',
      environment,
    }))
  }
  return results
}

class HouseholdInvoicePaymentConflict extends Error {
  constructor(message) {
    super(message)
    this.name = 'HouseholdInvoicePaymentConflict'
    this.code = 'HOUSEHOLD_INVOICE_PAYMENT_CONFLICT'
  }
}

async function loadHouseholdInvoicePaymentApplications(db, paymentId) {
  return db.query(
    `SELECT id, billing_charge_id, amount_cents, application_kind,
            idempotency_key, reverses_application_id, allocation_reason
       FROM billing_payment_application
      WHERE billing_payment_id = $1
      ORDER BY id`,
    [Number(paymentId)],
  ).then((result) => result.rows)
}

async function loadHouseholdInvoiceCreditApplications(db, invoiceId) {
  return db.query(
    `SELECT application.id, application.credit_invoice_line_id,
            application.target_invoice_line_id, application.amount_cents,
            application.idempotency_key,
            credit_line.billing_charge_id AS credit_billing_charge_id,
            target_line.billing_charge_id AS target_billing_charge_id
       FROM billing_charge_credit_application application
       JOIN billing_monthly_invoice_line credit_line
         ON credit_line.id = application.credit_invoice_line_id
       JOIN billing_monthly_invoice_line target_line
         ON target_line.id = application.target_invoice_line_id
      WHERE application.billing_monthly_invoice_id = $1
      ORDER BY application.id`,
    [Number(invoiceId)],
  ).then((result) => result.rows)
}

export function buildHouseholdInvoiceApplicationPlan(lines) {
  const positiveLines = lines
    .filter((line) => line.line_type === 'charge' && Number(line.amount_cents) > 0)
    .map((line) => ({ ...line, application_cents: Number(line.amount_cents) }))
  const positiveByChargeId = new Map(
    positiveLines.map((line) => [Number(line.billing_charge_id), line]),
  )
  const creditApplications = []
  const applyCredit = (credit, target, amountCents) => {
    if (amountCents <= 0) return
    target.application_cents -= amountCents
    creditApplications.push({
      credit_invoice_line_id: Number(credit.id),
      credit_billing_charge_id: Number(credit.billing_charge_id),
      target_invoice_line_id: Number(target.id),
      target_billing_charge_id: Number(target.billing_charge_id),
      amount_cents: amountCents,
    })
  }
  for (const credit of lines.filter((line) => line.line_type === 'credit' && Number(line.amount_cents) < 0)) {
    let remainingCreditCents = Math.abs(Number(credit.amount_cents))
    const target = credit.related_charge_id == null
      ? null
      : positiveByChargeId.get(Number(credit.related_charge_id))
    if (target) {
      const applied = Math.min(target.application_cents, remainingCreditCents)
      applyCredit(credit, target, applied)
      remainingCreditCents -= applied
    }
    for (const line of positiveLines) {
      if (remainingCreditCents <= 0) break
      const applied = Math.min(line.application_cents, remainingCreditCents)
      applyCredit(credit, line, applied)
      remainingCreditCents -= applied
    }
    if (remainingCreditCents !== 0) {
      throw new HouseholdInvoicePaymentConflict(
        'Household invoice credits exceed its immutable positive charge lines.',
      )
    }
  }
  return {
    paymentApplications: positiveLines.filter((line) => line.application_cents > 0),
    creditApplications,
  }
}

function invoicePaymentAppliedCents(applications) {
  return applications.reduce((sum, application) => (
    sum + (application.application_kind === 'reversal' ? -1 : 1) * Number(application.amount_cents)
  ), 0)
}

async function applyHouseholdMonthlyInvoicePaymentLocked(db, { invoice, local, payment }) {
  if (Number(payment.family_billing_account_id) !== Number(local.family_billing_account_id)) {
    throw new Error('Stripe invoice payment belongs to a different household account.')
  }
  const lines = await db.query(
    `SELECT *, (
              SELECT charge.related_charge_id
                FROM billing_charge charge
               WHERE charge.id = billing_monthly_invoice_line.billing_charge_id
            ) AS related_charge_id
       FROM billing_monthly_invoice_line
      WHERE billing_monthly_invoice_id = $1
      ORDER BY id`,
    [local.id],
  )
  const positiveLineCents = lines.rows.reduce(
    (sum, line) => sum + (line.line_type === 'charge' ? Number(line.amount_cents) : 0),
    0,
  )
  const creditLineCents = lines.rows.reduce(
    (sum, line) => sum + (line.line_type === 'credit' ? Math.abs(Number(line.amount_cents)) : 0),
    0,
  )
  const lineTotalCents = positiveLineCents - creditLineCents
  if (
    positiveLineCents !== Number(local.subtotal_cents)
    || creditLineCents !== Number(local.credit_cents)
    || lineTotalCents !== Number(local.total_cents)
    || lineTotalCents !== Number(payment.amount_cents)
  ) {
    throw new HouseholdInvoicePaymentConflict(
      `Household invoice ${local.id} lines, total, and received payment do not match.`,
    )
  }
  const applicationPlan = buildHouseholdInvoiceApplicationPlan(lines.rows)
  const expectedApplications = new Map(applicationPlan.paymentApplications.map((line) => [
    `monthly-invoice:${local.id}:payment:${payment.id}:line:${line.id}`,
    line,
  ]))
  const expectedCreditApplications = new Map(applicationPlan.creditApplications.map((application) => [
    `monthly-invoice:${local.id}:credit:${application.credit_invoice_line_id}:target:${application.target_invoice_line_id}`,
    application,
  ]))
  const existingApplications = await loadHouseholdInvoicePaymentApplications(db, payment.id)
  const existingCreditApplications = await loadHouseholdInvoiceCreditApplications(db, local.id)
  const assertExactCreditApplications = (applications) => {
    if (applications.length !== expectedCreditApplications.size) {
      throw new HouseholdInvoicePaymentConflict(
        'Paid household invoice is missing an exact durable credit allocation.',
      )
    }
    for (const application of applications) {
      const expected = expectedCreditApplications.get(application.idempotency_key)
      if (
        !expected
        || Number(application.credit_invoice_line_id) !== expected.credit_invoice_line_id
        || Number(application.credit_billing_charge_id) !== expected.credit_billing_charge_id
        || Number(application.target_invoice_line_id) !== expected.target_invoice_line_id
        || Number(application.target_billing_charge_id) !== expected.target_billing_charge_id
        || Number(application.amount_cents) !== expected.amount_cents
      ) {
        throw new HouseholdInvoicePaymentConflict(
          'Household invoice has an unexpected durable credit allocation.',
        )
      }
    }
  }
  if (local.status === 'paid') {
    if (
      local.stripe_payment_intent_id
      && payment.stripe_payment_intent_id
      && local.stripe_payment_intent_id !== payment.stripe_payment_intent_id
    ) {
      throw new HouseholdInvoicePaymentConflict('Paid household invoice is linked to a different Stripe payment.')
    }
    const originalApplications = existingApplications.filter((application) => application.application_kind === 'application')
    const reversals = existingApplications.filter((application) => application.application_kind === 'reversal')
    if (originalApplications.length + reversals.length !== existingApplications.length) {
      throw new HouseholdInvoicePaymentConflict('Paid household invoice has an invalid payment application kind.')
    }
    const originalById = new Map(originalApplications.map((application) => [Number(application.id), application]))
    if (originalById.size !== originalApplications.length) {
      throw new HouseholdInvoicePaymentConflict('Paid household invoice has duplicate payment application identities.')
    }
    const reversalsByApplicationId = new Map()
    for (const reversal of reversals) {
      const originalId = Number(reversal.reverses_application_id)
      const original = originalById.get(originalId)
      const amountCents = Number(reversal.amount_cents)
      if (
        !original
        || !Number.isInteger(amountCents)
        || amountCents <= 0
        || Number(reversal.billing_charge_id) !== Number(original.billing_charge_id)
      ) {
        throw new HouseholdInvoicePaymentConflict('Paid household invoice has an invalid payment reversal provenance.')
      }
      const expectedRepairKey = `monthly-invoice:${local.id}:canonical-repair:reverse:${originalId}`
      const hasRepairKey = reversal.idempotency_key === expectedRepairKey
      const hasRepairReason = reversal.allocation_reason === 'monthly_invoice_credit_mapping_repair'
      if (hasRepairKey !== hasRepairReason) {
        throw new HouseholdInvoicePaymentConflict('Paid household invoice has an invalid canonical repair reversal.')
      }
      const list = reversalsByApplicationId.get(originalId) ?? []
      list.push({ ...reversal, isCanonicalRepair: hasRepairKey })
      reversalsByApplicationId.set(originalId, list)
    }

    const expectedPaidBindings = new Map()
    const expectedByLineId = new Map()
    for (const line of applicationPlan.paymentApplications) {
      const lineId = Number(line.id)
      expectedByLineId.set(lineId, line)
      expectedPaidBindings.set(
        `monthly-invoice:${local.id}:payment:${payment.id}:line:${lineId}`,
        { line, isCanonicalRepair: false },
      )
      expectedPaidBindings.set(
        `monthly-invoice:${local.id}:canonical-repair:line:${lineId}`,
        { line, isCanonicalRepair: true },
      )
    }
    const settledByLineId = new Map()
    for (const application of originalApplications) {
      const amountCents = Number(application.amount_cents)
      if (!Number.isInteger(amountCents) || amountCents <= 0) {
        throw new HouseholdInvoicePaymentConflict('Paid household invoice has an invalid original payment application.')
      }
      const applicationReversals = reversalsByApplicationId.get(Number(application.id)) ?? []
      const reversedCents = applicationReversals.reduce((sum, reversal) => sum + Number(reversal.amount_cents), 0)
      if (reversedCents > amountCents) {
        throw new HouseholdInvoicePaymentConflict('Paid household invoice has an over-reversed payment application.')
      }
      const effectiveCents = amountCents - reversedCents
      const binding = expectedPaidBindings.get(application.idempotency_key)
      // Append-only history may retain an obsolete allocation, but it must be
      // completely neutralized. Any unrelated allocation that still carries
      // value remains a reconciliation conflict.
      if (!binding) {
        if (effectiveCents !== 0) {
          throw new HouseholdInvoicePaymentConflict('Paid household invoice has an unrelated active payment application.')
        }
        continue
      }
      if (Number(application.billing_charge_id) !== Number(binding.line.billing_charge_id)) {
        throw new HouseholdInvoicePaymentConflict('Paid household invoice payment application targets the wrong charge.')
      }
      if (
        binding.isCanonicalRepair
        && application.allocation_reason !== 'monthly_invoice_credit_mapping_repair'
      ) {
        throw new HouseholdInvoicePaymentConflict('Paid household invoice has an invalid canonical repair application.')
      }
      // Canonical repair reversals supersede the original settlement mapping.
      // Later refund reversals reduce the live charge balance but do not erase
      // the exact invoice-payment provenance that a replay must verify.
      const repairReversedCents = applicationReversals.reduce((sum, reversal) => (
        sum + (reversal.isCanonicalRepair ? Number(reversal.amount_cents) : 0)
      ), 0)
      const settledCents = amountCents - repairReversedCents
      if (settledCents < 0) {
        throw new HouseholdInvoicePaymentConflict('Paid household invoice canonical repair over-reversed an application.')
      }
      const lineId = Number(binding.line.id)
      settledByLineId.set(lineId, (settledByLineId.get(lineId) ?? 0) + settledCents)
    }
    if (
      settledByLineId.size !== expectedByLineId.size
      || [...expectedByLineId].some(([lineId, line]) => (
        settledByLineId.get(lineId) !== Number(line.application_cents)
      ))
    ) {
      throw new HouseholdInvoicePaymentConflict('Paid household invoice is missing an exact effective line allocation.')
    }
    assertExactCreditApplications(existingCreditApplications)
    return local
  }
  if (existingCreditApplications.length > 0) {
    throw new HouseholdInvoicePaymentConflict(
      'An unpaid household invoice already has a durable credit allocation.',
    )
  }
  const existingAppliedCents = invoicePaymentAppliedCents(existingApplications)
  if (existingAppliedCents < 0 || existingAppliedCents > Number(payment.amount_cents)) {
    throw new HouseholdInvoicePaymentConflict('Household invoice payment is over-applied.')
  }
  for (const application of existingApplications) {
    const line = expectedApplications.get(application.idempotency_key)
    if (
      application.application_kind !== 'application'
      || !line
      || Number(application.billing_charge_id) !== Number(line.billing_charge_id)
      || Number(application.amount_cents) !== Number(line.application_cents)
    ) {
      throw new HouseholdInvoicePaymentConflict(
        'Household invoice payment was already allocated outside its immutable invoice lines.',
      )
    }
  }
  for (const application of applicationPlan.creditApplications) {
    const idempotencyKey = `monthly-invoice:${local.id}:credit:${application.credit_invoice_line_id}:target:${application.target_invoice_line_id}`
    await db.query(
      `INSERT INTO billing_charge_credit_application (
         billing_monthly_invoice_id, credit_invoice_line_id,
         target_invoice_line_id, amount_cents, idempotency_key
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        local.id,
        application.credit_invoice_line_id,
        application.target_invoice_line_id,
        application.amount_cents,
        idempotencyKey,
      ],
    )
  }
  for (const line of applicationPlan.paymentApplications) {
    await db.query(
      `INSERT INTO billing_payment_application (
         billing_payment_id, billing_charge_id, amount_cents, application_kind, idempotency_key, allocation_reason
       ) VALUES ($1, $2, $3, 'application', $4, 'monthly_invoice_line')
       ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
      [payment.id, line.billing_charge_id, line.application_cents, `monthly-invoice:${local.id}:payment:${payment.id}:line:${line.id}`],
    )
  }
  const completedApplications = await loadHouseholdInvoicePaymentApplications(db, payment.id)
  const completedCreditApplications = await loadHouseholdInvoiceCreditApplications(db, local.id)
  assertExactCreditApplications(completedCreditApplications)
  const completedAppliedCents = invoicePaymentAppliedCents(completedApplications)
  if (completedAppliedCents !== Number(payment.amount_cents)) {
    throw new HouseholdInvoicePaymentConflict('Household invoice payment was not fully applied to its exact lines.')
  }
  const paidAt = invoice?.status_transitions?.paid_at
    ? new Date(Number(invoice.status_transitions.paid_at) * 1000)
    : new Date()
  return markInvoice(db, local.id, {
    status: 'paid',
    stripe_payment_intent_id: payment.stripe_payment_intent_id ?? local.stripe_payment_intent_id,
    paid_at: paidAt,
    failure_message: null,
  })
}

async function finishHouseholdInvoiceSettlement(db, { invoice, local, payment }) {
  await allocateHouseholdPayments(db, { accountId: local.family_billing_account_id, actorType: 'stripe' })
  await recordBillingActivityBestEffort(db, {
    eventKey: `monthly-invoice-paid:${local.id}:${payment.id}`,
    accountId: local.family_billing_account_id,
    paymentId: payment.id,
    eventType: 'monthly_invoice_paid',
    summary: `Household monthly invoice for ${String(local.billing_month).slice(0, 7)} was paid.`,
    afterValue: { monthlyInvoiceId: Number(local.id), paymentId: Number(payment.id), totalCents: Number(local.total_cents) },
    stripeObjectId: local.stripe_invoice_id ?? invoice?.id ?? null,
    actorType: 'stripe',
  })
}

/** Exact line-level allocation for an already-recorded household invoice payment. */
export async function applyHouseholdMonthlyInvoicePayment(pool, { invoice, payment }) {
  await ensureHouseholdMonthlyInvoiceSchema(pool)
  const local = await pool.query(
    `SELECT * FROM billing_monthly_invoice WHERE stripe_invoice_id = $1 LIMIT 1`,
    [invoice?.id],
  ).then((result) => result.rows[0] ?? null)
  if (!local || !payment?.id) return null
  return withBillingAccountCollectionLock(pool, local.family_billing_account_id, async (db) => {
    await db.query('BEGIN')
    try {
      const locked = await db.query(
        `SELECT * FROM billing_monthly_invoice WHERE id = $1 FOR UPDATE`,
        [local.id],
      ).then((result) => result.rows[0] ?? null)
      const updated = await applyHouseholdMonthlyInvoicePaymentLocked(db, { invoice, local: locked, payment })
      await db.query('COMMIT')
      await finishHouseholdInvoiceSettlement(db, { invoice, local: locked, payment })
      return updated
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {})
      throw error
    }
  })
}

/** Atomically insert and exactly map a paid household Stripe invoice. */
export async function recordAndApplyHouseholdMonthlyInvoicePayment(pool, {
  invoice,
  stripe = null,
  preparePaymentFunction = preparePaidStripeInvoiceRecord,
  recordPaymentFunction = upsertPaidStripeInvoicePayment,
  beforeMapping = null,
  finishSettlementFunction = finishHouseholdInvoiceSettlement,
}) {
  await ensureHouseholdMonthlyInvoiceSchema(pool)
  const local = await pool.query(
    `SELECT * FROM billing_monthly_invoice WHERE stripe_invoice_id = $1 LIMIT 1`,
    [invoice?.id],
  ).then((result) => result.rows[0] ?? null)
  if (!local) return null
  const preparedPayment = await preparePaymentFunction(pool, invoice, { stripe })
  if (!preparedPayment) throw new Error('The paid Stripe household invoice could not be prepared for recording.')
  if (Number(preparedPayment.accountId) !== Number(local.family_billing_account_id)) {
    throw new Error('Prepared Stripe invoice payment belongs to a different household account.')
  }
  if (preparedPayment.subscriptionId) {
    throw new Error('A household monthly invoice cannot also be a Stripe subscription renewal.')
  }
  return withBillingAccountCollectionLock(pool, local.family_billing_account_id, async (db) => {
    await db.query('BEGIN')
    try {
      const locked = await db.query(
        `SELECT * FROM billing_monthly_invoice WHERE id = $1 FOR UPDATE`,
        [local.id],
      ).then((result) => result.rows[0] ?? null)
      const payment = await recordPaymentFunction(db, preparedPayment)
      if (!payment?.id) throw new Error('The paid Stripe household invoice was not recorded locally.')
      if (beforeMapping) await beforeMapping({ db, invoice, local: locked, payment })
      await db.query('SAVEPOINT household_invoice_payment_mapping')
      try {
        const updated = await applyHouseholdMonthlyInvoicePaymentLocked(db, { invoice, local: locked, payment })
        await db.query('RELEASE SAVEPOINT household_invoice_payment_mapping')
        await db.query('COMMIT')
        await finishSettlementFunction(db, { invoice, local: locked, payment })
        return { invoice: updated, payment, conflicted: false, reason: null }
      } catch (error) {
        if (error?.code !== 'HOUSEHOLD_INVOICE_PAYMENT_CONFLICT') throw error
        await db.query('ROLLBACK TO SAVEPOINT household_invoice_payment_mapping')
        const reason = String(error.message || 'Household invoice payment mapping conflict.').slice(0, 500)
        const quarantined = await db.query(
          `UPDATE billing_payment
              SET external_status = 'reconciliation_required',
                  note = CASE
                    WHEN COALESCE(note, '') = '' THEN $2
                    WHEN position($2 in note) > 0 THEN note
                    ELSE note || chr(10) || $2
                  END
            WHERE id = $1
            RETURNING *`,
          [payment.id, reason],
        ).then((result) => result.rows[0] ?? payment)
        await db.query(
          `UPDATE billing_monthly_invoice
              SET status = 'failed', failure_message = $2, updated_at = now()
            WHERE id = $1 AND status <> 'paid'`,
          [locked.id, reason],
        )
        await db.query('COMMIT')
        return { invoice: locked, payment: quarantined, conflicted: true, reason }
      }
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {})
      throw error
    }
  })
}

export async function listHouseholdMonthlyInvoices(pool, accountId, { limit = 6, includeLines = true } = {}) {
  await ensureHouseholdMonthlyInvoiceSchema(pool)
  const result = await pool.query(
    `SELECT invoice.*,
            COALESCE(lines.line_count, 0)::int AS line_count
       FROM billing_monthly_invoice invoice
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS line_count
           FROM billing_monthly_invoice_line line
           LEFT JOIN billing_charge charge ON charge.id = line.billing_charge_id
          WHERE line.billing_monthly_invoice_id = invoice.id
            AND COALESCE(charge.metadata->>'customerAuditVisibility', 'visible') <> 'suppressed'
       ) lines ON TRUE
      WHERE invoice.family_billing_account_id = $1
      ORDER BY invoice.billing_month DESC, invoice.id DESC
      LIMIT $2`,
    [accountId, Math.max(1, Math.min(24, Number(limit) || 6))],
  )
  const invoiceIds = result.rows.map((row) => Number(row.id))
  const lines = !includeLines || invoiceIds.length === 0
    ? []
    : await pool.query(
      `SELECT line.*, TRIM(CONCAT(member.first_name, ' ', member.last_name)) AS member_name,
              COALESCE(charge.metadata->>'customerAuditVisibility', 'visible') <> 'suppressed'
                AS customer_visible
         FROM billing_monthly_invoice_line line
         LEFT JOIN member ON member.id = line.member_id
         LEFT JOIN billing_charge charge ON charge.id = line.billing_charge_id
        WHERE line.billing_monthly_invoice_id = ANY($1::bigint[])
        ORDER BY line.billing_monthly_invoice_id, line.id`,
      [invoiceIds],
    ).then((response) => response.rows)
  const linesByInvoice = new Map()
  const suppressedNetByInvoice = new Map()
  for (const line of lines) {
    const invoiceId = Number(line.billing_monthly_invoice_id)
    if (line.customer_visible === false) {
      suppressedNetByInvoice.set(
        invoiceId,
        (suppressedNetByInvoice.get(invoiceId) ?? 0) + Number(line.amount_cents),
      )
      continue
    }
    const list = linesByInvoice.get(invoiceId) ?? []
    list.push({
      id: Number(line.id), memberName: line.member_name ?? null, description: line.description,
      lineType: line.line_type, amountCents: Number(line.amount_cents),
    })
    linesByInvoice.set(invoiceId, list)
  }
  return result.rows.map((row) => ({
    id: Number(row.id), billingMonth: dateOnly(row.billing_month), status: row.status,
    subtotalCents: Number(row.subtotal_cents), creditCents: Number(row.credit_cents), totalCents: Number(row.total_cents),
    stripeInvoiceId: row.stripe_invoice_id ?? null, hostedInvoiceUrl: row.hosted_invoice_url ?? null,
    paymentAttemptedAt: row.payment_attempted_at ?? null, paidAt: row.paid_at ?? null,
    failureMessage: row.failure_message ?? null, lineCount: Number(row.line_count),
    postPaymentCreditCents: Math.max(0, suppressedNetByInvoice.get(Number(row.id)) ?? 0),
    lines: linesByInvoice.get(Number(row.id)) ?? [],
  }))
}
