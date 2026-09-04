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
import {
  findActiveEnrollmentCheckoutBalanceCollector,
  findCompletedPaidCheckoutFulfillmentGap,
} from './paidCheckoutCollectionGuard.js'
import { loadCanonicalCollectibleBalanceCents } from './canonicalBillingAccount.js'
import { canonicalActiveHouseholdMemberPredicate } from './householdMembership.js'
import { selectStripeCustomerPaymentMethod } from './stripePaymentMethodReadiness.js'
import { listStripeInvoicePaymentInventory } from './stripeInvoicePaymentBinding.js'
import {
  BillingMigrationSafetyError,
  inspectStripeCustomerBillingMonthCollectors,
  inspectStripeCustomerSubscriptionInventory,
  inspectStripeCustomerSubscriptionScheduleInventory,
} from './canonicalBillingMigrationStripe.js'

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

function invoiceBillingMonthKey(value) {
  return dateOnly(value)?.slice(0, 7) ?? null
}

export function stripeInvoiceIsPaid(invoice) {
  return invoice?.status === 'paid' || invoice?.paid === true
}

async function defaultPaymentMethod(stripe, customerId, billingMonth) {
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ['invoice_settings.default_payment_method'],
  })
  if (customer.deleted) return null
  const selection = await selectStripeCustomerPaymentMethod(stripe, customer, {
    expectedCustomerId: customerId,
    billingMonth,
  })
  return selection.readiness.ready ? selection.readiness.paymentMethodId : null
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
    message: `Monthly household invoice for ${invoiceBillingMonthKey(invoice.billing_month) ?? 'unknown month'} needs a saved card or payment link.`,
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

function validPositiveInteger(value) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0
}

async function loadHouseholdInvoiceAuthority(pool, {
  accountId,
  invoiceId,
  billingMonth,
  stripeInvoiceId,
  stripeCustomerId,
  facilityTimeZone,
  migrationAuthorization = null,
  paymentOnly = true,
}) {
  const saga = migrationAuthorization != null
  if (saga && (
    !validPositiveInteger(migrationAuthorization.migrationId)
    || !validPositiveInteger(migrationAuthorization.runId)
    || !String(migrationAuthorization.leaseOwner ?? '').trim()
    || dateOnly(migrationAuthorization.effectiveCollectionMonth) !== dateOnly(billingMonth)
  )) return null
  return pool.query(
    `SELECT migration.id, migration.billing_migration_run_id, migration.state
       FROM billing_monthly_invoice invoice
       JOIN family_billing_account account
         ON account.id = invoice.family_billing_account_id
       JOIN family ON family.id = account.family_id
       JOIN facility ON facility.id = family.facility_id
       JOIN billing_account_migration migration
         ON migration.family_billing_account_id = account.id
       JOIN billing_migration_run run
         ON run.id = migration.billing_migration_run_id
       CROSS JOIN LATERAL (
         SELECT CASE
           WHEN NULLIF(migration.parity_snapshot ->> 'collectionDeferredToMonth', '') IS NULL
             THEN migration.cutover_month
           WHEN migration.parity_snapshot ->> 'collectionDeferredToMonth'
                ~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$'
             THEN (migration.parity_snapshot ->> 'collectionDeferredToMonth')::date
           ELSE NULL::date
         END AS effective_month
       ) boundary
      WHERE account.id = $1
        AND account.is_active = TRUE
        AND account.household_monthly_billing_enabled = TRUE
        AND account.stripe_customer_id = $5
        AND facility.timezone = $6
        AND run.facility_timezone = facility.timezone
        AND EXISTS (
          SELECT 1
            FROM member current_payer
           WHERE current_payer.id = account.payer_member_id
             AND current_payer.facility_id = family.facility_id
             AND ${canonicalActiveHouseholdMemberPredicate({
               memberAlias: 'current_payer',
               familyIdReference: 'account.family_id',
               membershipAlias: 'current_payer_membership',
               historyAlias: 'current_payer_history',
             })}
        )
        AND NOT EXISTS (
          SELECT 1
            FROM family_billing_account customer_owner
           WHERE customer_owner.id <> account.id
             AND customer_owner.stripe_customer_id = account.stripe_customer_id
        )
        AND invoice.id = $2
        AND invoice.billing_month = $3::date
        AND invoice.stripe_invoice_id = $4
        AND (
          ($11::boolean = TRUE AND invoice.status = 'open')
          OR
          ($11::boolean = FALSE
            AND invoice.status IN ('draft', 'open', 'failed', 'payment_method_required'))
        )
        AND invoice.total_cents > 0
        AND migration.target_collection_mode = 'household_monthly'
        AND migration.payer_validation_status = 'verified'
        AND migration.parity_status = 'matched'
        AND migration.household_activated_at IS NOT NULL
        AND migration.snapshot_hash ~ '^[0-9a-f]{64}$'
        AND migration.accepted_snapshot_hash ~ '^[0-9a-f]{64}$'
        AND migration.accepted_baseline_version > 0
        AND migration.accepted_at IS NOT NULL
        AND migration.accepted_account_snapshot ->> 'id' ~ '^[0-9]+$'
        AND (migration.accepted_account_snapshot ->> 'id')::bigint = account.id
        AND migration.accepted_account_snapshot ->> 'familyId' ~ '^[0-9]+$'
        AND (migration.accepted_account_snapshot ->> 'familyId')::bigint = account.family_id
        AND migration.accepted_account_snapshot ->> 'facilityId' ~ '^[0-9]+$'
        AND (migration.accepted_account_snapshot ->> 'facilityId')::bigint = family.facility_id
        AND migration.accepted_account_snapshot ->> 'payerMemberId' ~ '^[0-9]+$'
        AND (migration.accepted_account_snapshot ->> 'payerMemberId')::bigint = account.payer_member_id
        AND migration.accepted_account_snapshot ->> 'facilityTimezone' = facility.timezone
        AND (
          migration.accepted_account_snapshot ->> 'stripeCustomerId' = account.stripe_customer_id
          OR (
            jsonb_typeof(migration.accepted_account_snapshot -> 'stripeCustomerId') = 'null'
            AND EXISTS (
              SELECT 1
                FROM billing_account_activity payment_method_activity
               WHERE payment_method_activity.family_billing_account_id = account.id
                 AND payment_method_activity.event_type = 'payment_method_link_created'
                 AND payment_method_activity.occurred_at >= migration.accepted_at
            )
          )
        )
        AND run.mode = 'apply'
        AND run.migration_key = 'canonical-household-billing-v1'
        AND NULLIF(BTRIM(run.code_version), '') IS NOT NULL
        AND run.manifest_checksum ~ '^[0-9a-f]{64}$'
        AND run.target_month = migration.cutover_month
        AND run.facility_id = family.facility_id
        AND COALESCE(run.configuration -> 'accountIds', '[]'::jsonb)
              @> to_jsonb(ARRAY[account.id])
        AND boundary.effective_month IS NOT NULL
        AND boundary.effective_month <=
              date_trunc('month', now() AT TIME ZONE facility.timezone)::date
        AND invoice.billing_month <=
              date_trunc('month', now() AT TIME ZONE facility.timezone)::date
        AND (
          ($7::boolean = FALSE
            AND migration.state = 'verified'
            AND migration.verified_at IS NOT NULL
            AND run.status IN ('running', 'completed', 'completed_with_exceptions')
            AND invoice.billing_month >= boundary.effective_month)
          OR
          ($7::boolean = TRUE
            AND migration.id = $8
            AND run.id = $9
            AND migration.state = 'household_active'
            AND migration.lease_owner = $10
            AND migration.lease_expires_at > now()
            AND run.status = 'running'
            AND invoice.billing_month = boundary.effective_month)
        )
      ORDER BY migration.id DESC
      LIMIT 1`,
    [
      Number(accountId),
      Number(invoiceId),
      dateOnly(billingMonth),
      String(stripeInvoiceId),
      String(stripeCustomerId),
      String(facilityTimeZone),
      saga,
      saga ? Number(migrationAuthorization.migrationId) : null,
      saga ? Number(migrationAuthorization.runId) : null,
      saga ? String(migrationAuthorization.leaseOwner) : null,
      paymentOnly,
    ],
  ).then((result) => result.rows[0] ?? null)
}

async function raiseHouseholdPaymentBoundaryAlert(pool, {
  account,
  invoice,
  stripeInvoiceId,
  code,
  message,
  details = {},
}) {
  await recordStripeBillingAlert(pool, {
    event: { id: `household-payment-boundary:${invoice.id}:${code}` },
    object: {
      id: stripeInvoiceId ?? `monthly-invoice:${invoice.id}`,
      customer: account.stripe_customer_id ?? null,
      metadata: {
        familyBillingAccountId: String(account.id),
        monthlyInvoiceId: String(invoice.id),
        billingMonth: dateOnly(invoice.billing_month)?.slice(0, 7) ?? '',
      },
    },
    alertType: code,
    severity: 'critical',
    message,
  }).catch(() => {})
  throw new BillingMigrationSafetyError(code, message, details, { forwardOnly: true })
}

async function assertFreshHouseholdInvoiceStructure(pool, {
  account,
  invoice,
  stripe,
  stripeInvoiceId,
  stripeCustomerId,
  billingMonth,
  allowedLocalStatuses = ['open'],
  expectedRemoteStatus = 'open',
  verificationFailureCode = 'household_payment_invoice_verification_failed',
  mismatchCode = 'household_payment_invoice_mismatch',
  action = 'payment',
  allowRemoteCustomerAsHistoricalIdentity = false,
}) {
  let inspection
  try {
    inspection = await inspectFreshPayableHouseholdInvoice(pool, stripe, {
      accountId: account?.id,
      invoiceId: invoice?.id,
      stripeInvoiceId,
      stripeCustomerId,
      billingMonth,
      allowedLocalStatuses,
      expectedRemoteStatus,
      allowRemoteCustomerAsHistoricalIdentity,
    })
  } catch (error) {
    await raiseHouseholdPaymentBoundaryAlert(pool, {
      account,
      invoice,
      stripeInvoiceId,
      code: verificationFailureCode,
      message: `Household invoice ${action} was blocked because the final Stripe invoice could not be verified.`,
      details: { accountId: Number(account?.id), reason: error?.message ?? String(error) },
    })
  }
  if (!inspection.verified) {
    const issueCodes = inspection.issues.map((issue) => issue.code).filter(Boolean).join(', ')
    await raiseHouseholdPaymentBoundaryAlert(pool, {
      account,
      invoice,
      stripeInvoiceId,
      code: mismatchCode,
      message: `Household invoice ${action} was blocked because the final Stripe invoice no longer exactly matches the local household invoice${issueCodes ? ` (${issueCodes})` : ''}.`,
      details: { accountId: Number(account?.id), issues: inspection.issues },
    })
  }
  return inspection
}

async function assertFreshHouseholdInvoicePaymentBinding(pool, {
  account,
  invoice,
  stripe,
  stripeInvoiceId,
  stripeCustomerId,
  expectedStatus = 'open',
  verificationFailureCode = 'household_payment_binding_verification_failed',
  mismatchCode = 'household_payment_binding_mismatch',
  action = 'payment',
}) {
  let inspection
  try {
    inspection = await inspectRemoteHouseholdInvoicePaymentBinding(stripe, {
      stripeInvoiceId,
      stripeCustomerId,
      totalCents: Number(invoice?.total_cents),
      durablePaymentIntentId: stripeObjectId(invoice?.stripe_payment_intent_id),
      expectedStatus,
    })
  } catch (error) {
    await raiseHouseholdPaymentBoundaryAlert(pool, {
      account,
      invoice,
      stripeInvoiceId,
      code: verificationFailureCode,
      message: `Household invoice ${action} was blocked because its final Stripe payment binding could not be verified.`,
      details: { accountId: Number(account?.id), reason: error?.message ?? String(error) },
    })
  }
  if (!inspection.verified) {
    await raiseHouseholdPaymentBoundaryAlert(pool, {
      account,
      invoice,
      stripeInvoiceId,
      code: mismatchCode,
      message: `Household invoice ${action} was blocked because its final Stripe payment binding is not exact.`,
      details: { accountId: Number(account?.id), issues: inspection.issues },
    })
  }
  return inspection
}

async function inspectFreshHouseholdCollectorBoundary(stripe, {
  accountId,
  stripeCustomerId,
  billingMonth,
  facilityTimeZone,
  stripeInvoiceId,
}) {
  // Keep these reads ordered. A Stripe schedule can release on its own: if
  // subscription inventory were sampled first, the schedule could disappear
  // before its newly-created subscription was visible to that earlier read.
  // Sampling the schedule first means either it is blocked while live or its
  // released subscription is caught by the subsequent subscription scan.
  const schedules = await inspectStripeCustomerSubscriptionScheduleInventory(stripe, {
    stripeCustomerId,
    accountId,
  })
  const subscriptions = await inspectStripeCustomerSubscriptionInventory(stripe, {
    stripeCustomerId,
    accountId,
    localSubscriptions: [],
  })
  const collectors = await inspectStripeCustomerBillingMonthCollectors(stripe, {
    stripeCustomerId,
    billingMonth: dateOnly(billingMonth),
    facilityTimezone: facilityTimeZone,
    expectedStripeInvoiceIds: [stripeInvoiceId],
    excludedSubscriptionIds: [],
  })
  return { schedules, subscriptions, collectors }
}

function householdCollectorBoundaryIsSafe({ schedules, subscriptions, collectors }) {
  return subscriptions.verified === true
    && Number(subscriptions.snapshot?.liveSubscriptionCount ?? -1) === 0
    && schedules.verified === true
    && Number(schedules.snapshot?.liveScheduleCount ?? -1) === 0
    && collectors.verified === true
    && Number(collectors.snapshot?.collectorCount ?? -1) === 1
    && Number(collectors.snapshot?.householdInvoiceCount ?? -1) === 1
}

async function loadHouseholdInvoicePaymentStructure(pool, {
  accountId,
  invoiceId,
  billingMonth,
  stripeInvoiceId,
}) {
  const invoice = await pool.query(
    `/* household-payment:invoice-structure */
     SELECT id, family_billing_account_id, billing_month, status,
            subtotal_cents, credit_cents, total_cents, stripe_invoice_id,
            stripe_payment_intent_id, payment_attempted_at
       FROM billing_monthly_invoice
      WHERE id = $1
        AND family_billing_account_id = $2
        AND billing_month = $3::date
        AND stripe_invoice_id = $4
      LIMIT 1`,
    [Number(invoiceId), Number(accountId), dateOnly(billingMonth), String(stripeInvoiceId)],
  ).then((result) => result.rows[0] ?? null)
  if (!invoice) return null
  const lines = await pool.query(
    `/* household-payment:invoice-lines */
     SELECT id, billing_charge_id, line_type, amount_cents, stripe_invoice_item_id
       FROM billing_monthly_invoice_line
      WHERE billing_monthly_invoice_id = $1
      ORDER BY id`,
    [Number(invoice.id)],
  )
  return { invoice, lines: lines.rows }
}

function stripeAdjustmentCollectionIsEmpty(rows) {
  return rows === null || (Array.isArray(rows) && rows.length === 0)
}

function stripeInvoiceLineInvoiceItemId(line) {
  if (line?.parent?.type !== 'invoice_item_details') return null
  return stripeObjectId(line.parent?.invoice_item_details?.invoice_item)
}

async function listRemoteInvoiceLines(stripe, remoteId) {
  return listStripeCollection(
    (params) => stripe.invoices.listLineItems(String(remoteId), params),
    { limit: 100 },
    'starting_after',
  )
}

async function inspectRemoteHouseholdInvoicePaymentBinding(stripe, {
  stripeInvoiceId,
  stripeCustomerId,
  totalCents,
  durablePaymentIntentId = null,
  expectedStatus = 'open',
}) {
  if (!['open', 'paid'].includes(expectedStatus)) {
    throw new Error(`Unsupported household Invoice Payment verification state: ${expectedStatus}.`)
  }
  if (!stripe?.invoicePayments?.list || !stripe?.paymentIntents?.retrieve) {
    throw new Error('Stripe Invoice Payment and PaymentIntent retrieval are required at the household payment boundary.')
  }

  const invoicePayments = await listStripeInvoicePaymentInventory(stripe, { stripeInvoiceId })
  if (!Array.isArray(invoicePayments)) {
    throw new Error('Stripe Invoice Payment inventory is unavailable at the household payment boundary.')
  }
  const issues = []
  let paymentIntentId = null
  if (invoicePayments.length !== 1) {
    issues.push({ code: 'remote_invoice_payment_count_mismatch', count: invoicePayments.length })
  } else {
    const invoicePayment = invoicePayments[0]
    paymentIntentId = invoicePayment?.payment?.type === 'payment_intent'
      ? stripeObjectId(invoicePayment.payment.payment_intent)
      : null
    const expectedAmountPaid = expectedStatus === 'paid' ? Number(totalCents) : null
    if (
      !invoicePayment?.id
      || invoicePayment?.is_default !== true
      || invoicePayment?.status !== expectedStatus
      || stripeObjectId(invoicePayment?.invoice) !== String(stripeInvoiceId)
      || String(invoicePayment?.currency ?? '').toLowerCase() !== 'usd'
      || !Number.isSafeInteger(invoicePayment?.amount_requested)
      || Number(invoicePayment.amount_requested) !== Number(totalCents)
      || invoicePayment?.amount_paid !== expectedAmountPaid
      || !paymentIntentId
      || (durablePaymentIntentId && String(durablePaymentIntentId) !== paymentIntentId)
    ) {
      issues.push({ code: 'remote_invoice_default_payment_mismatch' })
    } else {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
      const expectedIntentStatus = expectedStatus === 'paid' ? 'succeeded' : 'requires_payment_method'
      const expectedAmountReceived = expectedStatus === 'paid' ? Number(totalCents) : 0
      if (
        paymentIntent?.id !== paymentIntentId
        || paymentIntent?.status !== expectedIntentStatus
        || stripeObjectId(paymentIntent?.customer) !== String(stripeCustomerId)
        || String(paymentIntent?.currency ?? '').toLowerCase() !== 'usd'
        || !Number.isSafeInteger(paymentIntent?.amount)
        || Number(paymentIntent.amount) !== Number(totalCents)
        || !Number.isSafeInteger(paymentIntent?.amount_received)
        || Number(paymentIntent.amount_received) !== expectedAmountReceived
      ) {
        issues.push({ code: 'remote_invoice_default_payment_intent_mismatch' })
      }
    }
  }

  return {
    verified: issues.length === 0,
    issues,
    paymentIntentId,
    invoicePaymentCount: invoicePayments.length,
  }
}

async function inspectFreshPayableHouseholdInvoice(pool, stripe, {
  accountId,
  invoiceId,
  stripeInvoiceId,
  stripeCustomerId,
  billingMonth,
  allowedLocalStatuses = ['open'],
  expectedRemoteStatus = 'open',
  allowRemoteCustomerAsHistoricalIdentity = false,
}) {
  if (!['open', 'paid'].includes(expectedRemoteStatus)) {
    throw new Error(`Unsupported household invoice verification state: ${expectedRemoteStatus}.`)
  }
  if (
    !stripe?.invoices?.retrieve
    || !stripe?.invoices?.listLineItems
    || !stripe?.invoicePayments?.list
    || !stripe?.paymentIntents?.retrieve
  ) {
    throw new Error('Stripe invoice, line, and payment retrieval are required at the household payment boundary.')
  }
  const local = await loadHouseholdInvoicePaymentStructure(pool, {
    accountId,
    invoiceId,
    billingMonth,
    stripeInvoiceId,
  })
  if (!local) {
    return { verified: false, issues: [{ code: 'local_invoice_identity_mismatch' }] }
  }
  const remote = await stripe.invoices.retrieve(String(stripeInvoiceId))
  const lines = await listRemoteInvoiceLines(stripe, String(stripeInvoiceId))
  const issues = []
  const remoteCustomerId = stripeObjectId(remote?.customer)
  const verifiedStripeCustomerId = stripeCustomerId
    || (allowRemoteCustomerAsHistoricalIdentity ? remoteCustomerId : null)
  const expectedMonth = dateOnly(billingMonth)?.slice(0, 7) ?? null
  const totalCents = Number(local.invoice.total_cents)
  const expectedMetadata = {
    householdMonthlyInvoice: 'true',
    monthlyInvoiceId: String(local.invoice.id),
    familyBillingAccountId: String(accountId),
    billingMonth: expectedMonth,
  }

  const acceptedLocalStatuses = new Set(allowedLocalStatuses.map(String))
  if (!acceptedLocalStatuses.has(String(local.invoice.status ?? ''))) {
    issues.push({ code: 'local_invoice_not_open', status: local.invoice.status ?? null })
  }
  if (remote?.id !== String(stripeInvoiceId)) {
    issues.push({ code: 'remote_invoice_identity_mismatch', remoteInvoiceId: remote?.id ?? null })
  }
  if (!verifiedStripeCustomerId || remoteCustomerId !== String(verifiedStripeCustomerId)) {
    issues.push({ code: 'remote_invoice_customer_mismatch' })
  }
  for (const [key, expected] of Object.entries(expectedMetadata)) {
    if (String(remote?.metadata?.[key] ?? '') !== String(expected ?? '')) {
      issues.push({ code: 'remote_invoice_metadata_mismatch', key })
    }
  }
  if (remote?.status !== expectedRemoteStatus) {
    issues.push({
      code: 'remote_invoice_status_mismatch',
      expectedStatus: expectedRemoteStatus,
      status: remote?.status ?? null,
    })
  }
  // A household invoice first published before a payment method existed is a
  // send_invoice object. Once a reusable method is added, Vortex still makes
  // the reviewed off-session collection explicitly through invoices.pay.
  if (!['charge_automatically', 'send_invoice'].includes(remote?.collection_method)) {
    issues.push({ code: 'remote_invoice_collection_method_mismatch' })
  }
  if (remote?.auto_advance !== false) {
    issues.push({ code: 'remote_invoice_auto_advance_enabled' })
  }
  if (String(remote?.currency ?? '').toLowerCase() !== 'usd') {
    issues.push({ code: 'remote_invoice_currency_mismatch', currency: remote?.currency ?? null })
  }
  for (const field of ['subtotal', 'total', 'amount_due']) {
    if (!Number.isSafeInteger(remote?.[field]) || Number(remote[field]) !== totalCents) {
      issues.push({ code: 'remote_invoice_amount_mismatch', field })
    }
  }
  const expectedAmountPaid = expectedRemoteStatus === 'paid' ? totalCents : 0
  const expectedAmountRemaining = expectedRemoteStatus === 'paid' ? 0 : totalCents
  if (!Number.isSafeInteger(remote?.amount_paid) || Number(remote.amount_paid) !== expectedAmountPaid) {
    issues.push({ code: 'remote_invoice_amount_mismatch', field: 'amount_paid' })
  }
  if (!Number.isSafeInteger(remote?.amount_remaining) || Number(remote.amount_remaining) !== expectedAmountRemaining) {
    issues.push({ code: 'remote_invoice_amount_mismatch', field: 'amount_remaining' })
  }
  const unexpectedAdjustment = (
    ['amount_overpaid', 'starting_balance', 'pre_payment_credit_notes_amount', 'post_payment_credit_notes_amount']
      .some((field) => !Number.isSafeInteger(remote?.[field]) || Number(remote[field]) !== 0)
    || !stripeAdjustmentCollectionIsEmpty(remote?.total_discount_amounts)
    || !stripeAdjustmentCollectionIsEmpty(remote?.total_taxes)
    || !stripeAdjustmentCollectionIsEmpty(remote?.total_pretax_credit_amounts)
    || !stripeAdjustmentCollectionIsEmpty(remote?.discounts)
    || !stripeAdjustmentCollectionIsEmpty(remote?.default_tax_rates)
    || remote?.shipping_cost !== null
    || remote?.automatic_tax?.enabled !== false
  )
  if (unexpectedAdjustment) issues.push({ code: 'remote_invoice_unexpected_adjustment' })

  const expectedLines = new Map(local.lines.map((line) => [String(line.id), line]))
  const seen = new Set()
  for (const line of lines) {
    const lineId = String(line?.metadata?.monthlyInvoiceLineId ?? '')
    const expected = expectedLines.get(lineId)
    const stripeInvoiceItemId = stripeInvoiceLineInvoiceItemId(line)
    if (
      !expected
      || String(line?.metadata?.monthlyInvoiceId ?? '') !== String(local.invoice.id)
      || !stripeInvoiceItemId
    ) {
      issues.push({
        code: stripeInvoiceItemId ? 'remote_invoice_line_unexpected' : 'remote_invoice_line_parent_mismatch',
        stripeInvoiceLineId: line?.id ?? null,
        stripeInvoiceItemId,
      })
      continue
    }
    if (seen.has(lineId)) {
      issues.push({ code: 'remote_invoice_line_duplicate', monthlyInvoiceLineId: lineId })
      continue
    }
    seen.add(lineId)
    if (
      !expected.stripe_invoice_item_id
      || String(stripeInvoiceItemId) !== String(expected.stripe_invoice_item_id)
      || !Number.isSafeInteger(line?.amount)
      || Number(line.amount) !== Number(expected.amount_cents)
      || !Number.isSafeInteger(line?.subtotal)
      || Number(line.subtotal) !== Number(expected.amount_cents)
      || String(line?.currency ?? '').toLowerCase() !== 'usd'
      || stripeObjectId(line?.invoice) !== String(stripeInvoiceId)
      || String(line?.metadata?.billingChargeId ?? '') !== String(expected.billing_charge_id)
      || String(line?.metadata?.lineType ?? '') !== String(expected.line_type)
      || !stripeAdjustmentCollectionIsEmpty(line?.discount_amounts)
      || !stripeAdjustmentCollectionIsEmpty(line?.taxes)
      || !stripeAdjustmentCollectionIsEmpty(line?.pretax_credit_amounts)
    ) {
      issues.push({ code: 'remote_invoice_line_mismatch', monthlyInvoiceLineId: lineId })
    }
  }
  for (const lineId of expectedLines.keys()) {
    if (!seen.has(lineId)) {
      issues.push({ code: 'remote_invoice_line_missing', monthlyInvoiceLineId: lineId })
    }
  }

  const paymentBinding = await inspectRemoteHouseholdInvoicePaymentBinding(stripe, {
    stripeInvoiceId,
    stripeCustomerId: verifiedStripeCustomerId,
    totalCents,
    durablePaymentIntentId: stripeObjectId(local.invoice.stripe_payment_intent_id),
    expectedStatus: expectedRemoteStatus,
  })
  issues.push(...paymentBinding.issues)
  return {
    verified: issues.length === 0,
    issues,
    remoteInvoice: remote,
    snapshot: {
      stripeInvoiceId: remote?.id ?? null,
      stripeCustomerId: remoteCustomerId,
      totalCents,
      currency: remote?.currency ?? null,
      lineCount: lines.length,
      invoicePaymentCount: paymentBinding.invoicePaymentCount,
      paymentIntentId: paymentBinding.paymentIntentId,
    },
  }
}

/**
 * Prevent a draft Stripe invoice from becoming a payable hosted invoice until
 * both canonical authority and the fresh remote collector inventory are exact.
 * The payment boundary below repeats both checks immediately before charging.
 */
export async function assertHouseholdInvoicePublicationBoundary(pool, {
  account,
  invoice,
  stripe,
  stripeInvoiceId,
  stripeCustomerId = account?.stripe_customer_id,
  billingMonth = invoice?.billing_month,
  facilityTimeZone = account?.facility_timezone,
  migrationAuthorization = null,
} = {}) {
  let evidence
  try {
    evidence = await inspectFreshHouseholdCollectorBoundary(stripe, {
      accountId: account.id,
      stripeCustomerId,
      billingMonth,
      facilityTimeZone,
      stripeInvoiceId,
    })
  } catch (error) {
    await raiseHouseholdPaymentBoundaryAlert(pool, {
      account,
      invoice,
      stripeInvoiceId,
      code: 'household_invoice_publication_remote_inventory_failed',
      message: 'Household invoice publication was blocked because Stripe collector inventory could not be verified.',
      details: { accountId: Number(account.id), reason: error?.message ?? String(error) },
    })
  }
  if (!householdCollectorBoundaryIsSafe(evidence)) {
    await raiseHouseholdPaymentBoundaryAlert(pool, {
      account,
      invoice,
      stripeInvoiceId,
      code: 'household_invoice_publication_collector_conflict',
      message: 'Household invoice publication was blocked because Stripe contains another recurring or target-month collector.',
      details: {
        accountId: Number(account.id),
        subscriptions: evidence.subscriptions.snapshot,
        schedules: evidence.schedules.snapshot,
        collectors: evidence.collectors.snapshot,
        issues: [
          ...evidence.subscriptions.issues,
          ...evidence.schedules.issues,
          ...evidence.collectors.issues,
        ],
      },
    })
  }
  const migration = await loadHouseholdInvoiceAuthority(pool, {
    accountId: account?.id,
    invoiceId: invoice?.id,
    stripeCustomerId,
    stripeInvoiceId,
    billingMonth,
    facilityTimeZone,
    migrationAuthorization,
    paymentOnly: false,
  })
  if (!migration) {
    await raiseHouseholdPaymentBoundaryAlert(pool, {
      account: { ...account, stripe_customer_id: stripeCustomerId },
      invoice,
      stripeInvoiceId,
      code: 'household_invoice_publication_authority_missing',
      message: 'Household invoice publication was blocked because verified canonical migration authority is missing, changed, or not yet effective.',
      details: { accountId: Number(account?.id), billingMonth: dateOnly(billingMonth) },
    })
  }
  return { migration, ...evidence }
}

/**
 * Last irreversible collection gate. Every caller, including migration and
 * repair tooling, must prove durable canonical authority and a fresh, empty
 * Stripe recurring-collector inventory immediately before invoices.pay.
 */
export async function assertHouseholdPaymentBoundary(pool, {
  account,
  invoice,
  stripe,
  stripeInvoiceId,
  stripeCustomerId = account?.stripe_customer_id,
  billingMonth = invoice?.billing_month,
  facilityTimeZone = account?.facility_timezone,
  migrationAuthorization = null,
} = {}) {
  let evidence
  try {
    evidence = await inspectFreshHouseholdCollectorBoundary(stripe, {
      accountId: account.id,
      stripeCustomerId,
      billingMonth,
      facilityTimeZone,
      stripeInvoiceId,
    })
  } catch (error) {
    await raiseHouseholdPaymentBoundaryAlert(pool, {
      account,
      invoice,
      stripeInvoiceId,
      code: 'household_payment_remote_inventory_failed',
      message: 'Household payment was blocked because Stripe collector inventory could not be verified.',
      details: { accountId: Number(account.id), reason: error?.message ?? String(error) },
    })
  }

  if (!householdCollectorBoundaryIsSafe(evidence)) {
    await raiseHouseholdPaymentBoundaryAlert(pool, {
      account,
      invoice,
      stripeInvoiceId,
      code: 'household_payment_collector_conflict',
      message: 'Household payment was blocked because Stripe contains another recurring or target-month collector.',
      details: {
        accountId: Number(account.id),
        subscriptions: evidence.subscriptions.snapshot,
        schedules: evidence.schedules.snapshot,
        collectors: evidence.collectors.snapshot,
        issues: [
          ...evidence.subscriptions.issues,
          ...evidence.schedules.issues,
          ...evidence.collectors.issues,
        ],
      },
    })
  }

  const payableInvoice = await assertFreshHouseholdInvoiceStructure(pool, {
    account,
    invoice,
    stripe,
    stripeInvoiceId,
    stripeCustomerId,
    billingMonth,
  })

  // The method selected while the draft was being assembled is only a hint for
  // Stripe's collection_method. Resolve the current customer-owned method again
  // at the irreversible boundary and never pass the earlier ID to invoices.pay.
  const paymentMethodId = await defaultPaymentMethod(stripe, stripeCustomerId, billingMonth)

  // The durable state check is intentionally after the remote scans, adjacent
  // to the payment reservation and Stripe call. A migration lease that expires
  // during inventory cannot authorize a charge.
  const migration = await loadHouseholdInvoiceAuthority(pool, {
    accountId: account?.id,
    invoiceId: invoice?.id,
    stripeCustomerId,
    stripeInvoiceId,
    billingMonth,
    facilityTimeZone,
    migrationAuthorization,
    paymentOnly: true,
  })
  if (!migration) {
    await raiseHouseholdPaymentBoundaryAlert(pool, {
      account: { ...account, stripe_customer_id: stripeCustomerId },
      invoice,
      stripeInvoiceId,
      code: 'household_payment_canonical_authority_missing',
      message: 'Household payment was blocked because verified canonical migration authority is missing or expired.',
      details: {
        accountId: Number(account?.id),
        billingMonth: dateOnly(billingMonth),
        migrationId: migration?.id == null ? null : Number(migration.id),
        migrationState: migration?.state ?? null,
      },
    })
  }
  return { migration, payableInvoice, paymentMethodId, ...evidence }
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
        || String(remote?.metadata?.billingMonth ?? '') !== invoiceBillingMonthKey(invoice.billing_month)
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
        if (!settlement?.invoice) {
          throw new Error(`Paid prior household invoice ${invoice.stripe_invoice_id} lost its local settlement mapping.`)
        }
        continue
      }

      if (remote.status === 'open') {
        let binding
        try {
          binding = await inspectRemoteHouseholdInvoicePaymentBinding(stripe, {
            stripeInvoiceId: invoice.stripe_invoice_id,
            stripeCustomerId: stripeObjectId(remote.customer),
            totalCents: Number(invoice.total_cents),
            durablePaymentIntentId: stripeObjectId(invoice.stripe_payment_intent_id),
            expectedStatus: 'open',
          })
        } catch (error) {
          throw new Error(`Prior monthly invoice ${invoice.stripe_invoice_id} payment inventory could not be verified before voiding: ${error?.message ?? error}`)
        }
        if (!binding.verified) {
          const issueCodes = binding.issues.map((issue) => issue.code).filter(Boolean).join(', ')
          throw new Error(
            `Prior monthly invoice ${invoice.stripe_invoice_id} has unsafe Invoice Payment inventory${issueCodes ? ` (${issueCodes})` : ''}; roll-forward stopped.`,
          )
        }
      }

      const paymentIntentId = remote.status === 'open'
        ? null
        : (stripeObjectId(remote.payment_intent) ?? invoice.stripe_payment_intent_id)
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
          if (!settlement?.invoice) {
            throw new Error(`Paid prior household invoice ${invoice.stripe_invoice_id} lost its local settlement mapping.`)
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
      summary: `Monthly household invoice for ${invoiceBillingMonthKey(invoice.billing_month) ?? 'unknown month'} was voided so its unpaid items can carry forward.`,
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
    const activeEnrollmentCheckout = await findActiveEnrollmentCheckoutBalanceCollector(
      client,
      accountId,
    )
    if (activeEnrollmentCheckout) {
      await client.query('COMMIT')
      return {
        invoice: null,
        created: false,
        lines: [],
        blocked: 'active_enrollment_checkout_balance_collector',
        blockedOwnerId: Number(activeEnrollmentCheckout.owner_id),
      }
    }
    const paidCheckoutPending = await client.query(
      `SELECT id
         FROM billing_payment
        WHERE family_billing_account_id = $1
          AND external_status = 'reconciliation_required'
          AND (
            position('[paid-checkout-fulfillment-pending:' in COALESCE(note, '')) > 0
            OR position('[paid-checkout-refund-required:' in COALESCE(note, '')) > 0
          )
        LIMIT 1`,
      [accountId],
    )
    if (paidCheckoutPending.rows[0]) {
      await client.query('COMMIT')
      return {
        invoice: null,
        created: false,
        lines: [],
        blocked: 'paid_checkout_fulfillment_pending',
      }
    }
    const unresolvedRefund = await client.query(
      `SELECT id
         FROM billing_refund
        WHERE family_billing_account_id = $1
          AND external_status = 'reconciliation_required'
        LIMIT 1`,
      [accountId],
    )
    if (unresolvedRefund.rows[0]) {
      await client.query('COMMIT')
      return {
        invoice: null,
        created: false,
        lines: [],
        blocked: 'stripe_refund_reconciliation_required',
      }
    }
    const completedCheckoutPaymentGap = await findCompletedPaidCheckoutFulfillmentGap(
      client,
      accountId,
    )
    if (completedCheckoutPaymentGap) {
      await client.query('COMMIT')
      return {
        invoice: null,
        created: false,
        lines: [],
        blocked: 'paid_checkout_owner_payment_gap',
        blockedOwnerKind: completedCheckoutPaymentGap.owner_kind,
        blockedOwnerId: Number(completedCheckoutPaymentGap.owner_id),
      }
    }
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
                  + COALESCE(refund_offset.offset_cents, 0)
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
           SELECT COALESCE(SUM(offset_charge.amount_cents), 0)::int AS offset_cents
             FROM billing_charge offset_charge
            WHERE offset_charge.related_charge_id = charge.id
              AND offset_charge.source_type = 'refund_offset'
         ) refund_offset ON TRUE
         LEFT JOIN LATERAL (
           SELECT SUM(credit.amount_cents)::int AS applied_cents
             FROM billing_charge_credit_application credit
             JOIN billing_monthly_invoice_line target_line
               ON target_line.id = credit.target_invoice_line_id
             JOIN billing_monthly_invoice_line credit_line
               ON credit_line.id = credit.credit_invoice_line_id
             JOIN billing_charge credit_source
               ON credit_source.id = credit_line.billing_charge_id
            WHERE target_line.billing_charge_id = charge.id
              AND NOT (
                credit_source.related_charge_id = charge.id
                AND credit_source.source_type = 'refund_offset'
              )
         ) credit_application ON TRUE
        WHERE charge.family_billing_account_id = $1
          AND charge.amount_cents > 0
          AND GREATEST(
                0,
                charge.amount_cents
                  + COALESCE(refund_offset.offset_cents, 0)
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
          AND charge.source_type <> 'refund_offset'
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

function automaticAttemptAllowed(invoice, {
  policy = null,
  now = new Date(),
  facilityTimeZone,
} = {}) {
  if (!policy || policy === 'manual') return true
  const attempts = Number(invoice?.automatic_attempt_count ?? 0)
  if (policy === 'initial') return attempts === 0
  if (policy === 'retry_on_fifth') {
    const date = facilityDate(now, facilityTimeZone)
    return Number(date.slice(8, 10)) === 5 && attempts === 1 && invoice?.status === 'failed'
  }
  return false
}

async function priorPaymentAttemptCanAdvance(stripe, invoice) {
  const priorAttempt = paymentAttemptDate(invoice.payment_attempted_at)
  if (
    priorAttempt
    && !invoice.stripe_payment_intent_id
    && ['open', 'failed'].includes(String(invoice.status))
  ) {
    throw new Error(
      `Household invoice ${invoice.id} has an unknown Stripe payment outcome; manual reconciliation is required before retry.`,
    )
  }
  if (!['failed', 'payment_method_required'].includes(String(invoice.status))) return false
  if (!invoice.stripe_payment_intent_id) {
    return false
  }
  if (typeof stripe?.paymentIntents?.retrieve !== 'function') {
    throw new Error(`Cannot verify failed payment intent ${invoice.stripe_payment_intent_id}; household invoice retry stopped.`)
  }
  const intent = await stripe.paymentIntents.retrieve(invoice.stripe_payment_intent_id)
  if (intent?.status === 'requires_payment_method') return true
  throw new Error(
    `Payment intent ${invoice.stripe_payment_intent_id} is ${intent?.status || 'unknown'}; household invoice retry stopped to prevent duplicate collection.`,
  )
}

async function reservePaymentAttempt(pool, invoice, stripe, {
  automaticAttemptPolicy = null,
  now = new Date(),
  facilityTimeZone,
} = {}) {
  if (!automaticAttemptAllowed(invoice, {
    policy: automaticAttemptPolicy,
    now,
    facilityTimeZone,
  })) {
    const error = new Error('This household invoice is not eligible for another automatic collection attempt.')
    error.code = 'household_automatic_attempt_not_eligible'
    throw error
  }
  const priorAttempt = paymentAttemptDate(invoice.payment_attempted_at)
  const priorFailureConfirmed = await priorPaymentAttemptCanAdvance(stripe, invoice)
  const attemptedAt = !priorAttempt || priorFailureConfirmed
    ? new Date(Math.max(new Date(now).getTime(), paymentAttemptDate(priorAttempt)?.getTime() ?? 0) + 1)
    : priorAttempt
  const values = {
    status: 'open',
    payment_attempted_at: attemptedAt,
    failure_message: null,
  }
  // A non-null payment intent in a confirmed failure state proves that Stripe
  // completed the prior attempt. Clearing it while durably advancing the
  // timestamp creates a new attempt generation. A prior attempt with no durable
  // PaymentIntent is blocked above: replaying its idempotency key with a newly
  // selected method could change Stripe request parameters after an unknown
  // outcome.
  if (priorFailureConfirmed) values.stripe_payment_intent_id = null
  let saved
  if (automaticAttemptPolicy && automaticAttemptPolicy !== 'manual') {
    const expectedAttemptCount = automaticAttemptPolicy === 'initial' ? 0 : 1
    const entries = Object.entries(values)
    const columns = entries.map(([key], index) => `${key} = $${index + 3}`).join(', ')
    const result = await pool.query(
      `UPDATE billing_monthly_invoice
          SET automatic_attempt_count = automatic_attempt_count + 1,
              last_automatic_attempt_at = $2::timestamptz,
              ${columns},
              updated_at = now()
        WHERE id = $1
          AND automatic_attempt_count = $${entries.length + 3}
        RETURNING *`,
      [invoice.id, attemptedAt, ...entries.map(([, value]) => value), expectedAttemptCount],
    )
    saved = result.rows[0] ?? null
    if (!saved) {
      const error = new Error('This household invoice was changed before its automatic collection attempt could be reserved.')
      error.code = 'household_automatic_attempt_race'
      throw error
    }
  } else {
    saved = await markInvoice(pool, invoice.id, values)
  }
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
    && String(remote.metadata?.billingMonth ?? '') === invoiceBillingMonthKey(invoice.billing_month)
  )
}

function remoteInvoiceMatches(remote, { account, invoice, customerId }) {
  return remoteInvoiceMetadataMatches(remote, { account, invoice })
    && String(stripeObjectId(remote.customer) ?? '') === String(customerId)
}

async function listStripeCollection(fetchPage, initialParams, cursorField) {
  const rows = []
  let cursor = null
  const cursors = new Set()
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
    if (cursor && cursors.has(cursor)) {
      throw new Error('Stripe pagination repeated a continuation cursor.')
    }
    if (cursor) cursors.add(cursor)
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
      description: `Vortex Athletics household billing — ${invoiceBillingMonthKey(invoice.billing_month) ?? 'unknown month'}`,
      metadata: {
        householdMonthlyInvoice: 'true',
        monthlyInvoiceId: String(invoice.id),
        familyBillingAccountId: String(account.id),
        billingMonth: invoiceBillingMonthKey(invoice.billing_month),
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
  invoice,
  remote,
  stripe,
}) {
  if (stripeInvoiceIsPaid(remote)) {
    const settlement = await recordAndApplyHouseholdMonthlyInvoicePayment(pool, { invoice: remote, stripe })
    if (settlement?.conflicted) {
      throw new Error(`Paid household invoice requires reconciliation: ${settlement.reason}`)
    }
    if (settlement?.invoice) return settlement.invoice
    throw new Error(`Paid household invoice ${remote.id} lost its local settlement mapping.`)
  }
  if (remote.status === 'open') {
    // An open invoice remains resumable, but its hosted URL must not be exposed
    // until the post-finalization structure and payment bindings are verified.
    // A paid remote invoice is handled above, which prevents duplicate
    // collection when an earlier Stripe response was interrupted.
    return null
  }
  if (remote.status === 'void') {
    return markInvoice(pool, invoice.id, { status: 'void', failure_message: 'Stripe invoice was voided.' })
  }
  if (remote.status === 'uncollectible') {
    return markInvoice(pool, invoice.id, { status: 'failed', failure_message: 'Stripe invoice is uncollectible.' })
  }
  return null
}

async function pushInvoiceToStripe(pool, {
  account,
  invoice,
  lines,
  stripe,
  billingMonth,
  facilityTimeZone,
  migrationAuthorization,
  automaticAttemptPolicy = null,
  now = new Date(),
}) {
  const customerId = await ensureStripeCustomer(pool, stripe, account)
  const paymentMethodId = await defaultPaymentMethod(stripe, customerId, billingMonth)
  const collectionMethod = paymentMethodId ? 'charge_automatically' : 'send_invoice'
  const remote = await ensureRemoteInvoice(pool, { account, invoice, stripe, customerId, collectionMethod })
  // A URL stored by an older/interrupted run is not trusted until this run has
  // reverified the finalized Stripe invoice below.
  await markInvoice(pool, invoice.id, { hosted_invoice_url: null })
  await ensureRemoteInvoiceItems(pool, { invoice, lines, remote, stripe, customerId })
  // A draft invoice is not payable and auto-advance is disabled. Recheck the
  // canonical migration and complete remote collector inventory before this
  // invoice can be finalized into either an automatic charge or hosted link.
  await assertHouseholdInvoicePublicationBoundary(pool, {
    account,
    invoice,
    stripe,
    stripeInvoiceId: remote.id,
    stripeCustomerId: customerId,
    billingMonth,
    facilityTimeZone,
    migrationAuthorization,
  })
  const alreadyFinalized = await syncAlreadyFinalizedInvoice(pool, {
    invoice,
    remote,
    stripe,
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
      invoice,
      remote: finalized,
      stripe,
    })
    if (finalizedWithoutPayment) return finalizedWithoutPayment
    throw new Error(`Stripe invoice ${remote.id} finalized with unexpected status ${finalized.status}.`)
  }
  await assertFreshHouseholdInvoiceStructure(pool, {
    account,
    invoice,
    stripe,
    stripeInvoiceId: remote.id,
    stripeCustomerId: customerId,
    billingMonth,
    allowedLocalStatuses: ['draft', 'open', 'failed', 'payment_method_required'],
    verificationFailureCode: 'household_invoice_publication_verification_failed',
    mismatchCode: 'household_invoice_publication_invoice_mismatch',
    action: 'publication',
  })
  // Remote finalization and the local payable state are durable and safely
  // resumable. Do not reserve a payment-attempt generation until every remote
  // and canonical pre-pay gate below has passed.
  const openedInvoice = await markInvoice(pool, invoice.id, {
    status: 'open',
    failure_message: null,
  })
  if (!openedInvoice) {
    throw new Error(`Household invoice ${invoice.id} could not enter its payable state.`)
  }
  const boundary = await assertHouseholdPaymentBoundary(pool, {
    account,
    invoice: openedInvoice,
    stripe,
    stripeInvoiceId: remote.id,
    stripeCustomerId: customerId,
    billingMonth,
    facilityTimeZone,
    migrationAuthorization,
  })
  if (!boundary.paymentMethodId) {
    // Stripe can add or advance an Invoice Payment independently after the
    // broader boundary scan. Re-read the complete binding inventory directly
    // beside the only local write that exposes the hosted payment surface.
    await assertFreshHouseholdInvoicePaymentBinding(pool, {
      account,
      invoice: openedInvoice,
      stripe,
      stripeInvoiceId: remote.id,
      stripeCustomerId: customerId,
      expectedStatus: 'open',
      verificationFailureCode: 'household_invoice_publication_payment_binding_verification_failed',
      mismatchCode: 'household_invoice_publication_payment_binding_mismatch',
      action: 'publication',
    })
    const saved = await markInvoice(pool, invoice.id, {
      status: 'payment_method_required',
      hosted_invoice_url: finalized.hosted_invoice_url ?? null,
      failure_message: null,
    })
    await createPaymentMethodAlert(pool, account.id, saved ?? invoice)
    return saved ?? invoice
  }
  // Keep this read immediately adjacent to invoices.pay. In particular, do not
  // let a second paid/open/external binding appear after the canonical authority
  // check and then collect the same invoice again here.
  await assertFreshHouseholdInvoicePaymentBinding(pool, {
    account,
    invoice: openedInvoice,
    stripe,
    stripeInvoiceId: remote.id,
    stripeCustomerId: customerId,
    expectedStatus: 'open',
  })
  // This durable timestamp defines the idempotency generation and therefore
  // belongs directly beside the first possible Stripe pay dispatch. Any gate
  // failure above leaves no false "unknown outcome" marker behind.
  // Preserve the pre-publication status for retry eligibility: the local row is
  // deliberately moved to open before the boundary checks, but a fifth-day
  // retry is authorized only when its prior state was a confirmed failure.
  const paymentAttempt = await reservePaymentAttempt(pool, invoice, stripe, {
    automaticAttemptPolicy,
    now,
    facilityTimeZone,
  })
  try {
    const paid = await stripe.invoices.pay(
      remote.id,
      { payment_method: boundary.paymentMethodId },
      { idempotencyKey: paymentAttempt.idempotencyKey },
    )
    const paymentConfirmed = stripeInvoiceIsPaid(paid)
    const attempted = await markInvoice(pool, invoice.id, {
      status: paymentConfirmed ? 'open' : 'failed',
      stripe_payment_intent_id: typeof paid.payment_intent === 'string' ? paid.payment_intent : paid.payment_intent?.id ?? null,
      // Never expose a second payment surface after an automatic attempt unless
      // Stripe has already made the invoice terminal. A non-paid response can
      // still carry a processing or action-required PaymentIntent.
      hosted_invoice_url: paymentConfirmed
        ? (paid.hosted_invoice_url ?? finalized.hosted_invoice_url ?? null)
        : null,
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
      throw new Error(`Paid household invoice ${paid.id} lost its local settlement mapping.`)
    }
    return attempted
  } catch (error) {
    const paymentIntentId = paymentIntentFromError(error)
    return markInvoice(pool, invoice.id, {
      status: 'failed',
      ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
      // The request outcome may be unknown or its PaymentIntent may still be
      // processing, so publishing the hosted page here could create a second
      // collector for the same invoice.
      hosted_invoice_url: null,
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
  migrationAuthorization = null,
  automaticAttemptPolicy = null,
  now = new Date(),
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
    if (!local.invoice) {
      return {
        ...local,
        skipped: local.blocked ?? 'no_open_charges',
      }
    }

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
    const invoice = await pushInvoiceToStripe(db, {
      account,
      invoice: local.invoice,
      lines: local.lines,
      stripe,
      billingMonth: month,
      facilityTimeZone,
      migrationAuthorization,
      automaticAttemptPolicy,
      now,
    })
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
    summary: `Household monthly invoice for ${invoiceBillingMonthKey(local.billing_month) ?? 'unknown month'} was paid.`,
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

async function assertPaidHouseholdInvoiceSettlementBoundary(pool, stripe, local) {
  // Once Stripe has settled an invoice, current collection authority is no
  // longer the ownership source for the cash receipt. The durable local
  // invoice ID plus its exact Stripe invoice, metadata, lines, amount, Invoice
  // Payment, and PaymentIntent form the historical settlement identity. This
  // lets a delayed webhook record real cash even if the account was disabled
  // or remapped after Stripe charged it.
  const settlementIdentity = { id: local.family_billing_account_id, stripe_customer_id: null }
  const inspection = await assertFreshHouseholdInvoiceStructure(pool, {
    account: settlementIdentity,
    invoice: local,
    stripe,
    stripeInvoiceId: local.stripe_invoice_id,
    stripeCustomerId: null,
    billingMonth: local.billing_month,
    allowedLocalStatuses: ['draft', 'open', 'failed', 'payment_method_required', 'paid'],
    expectedRemoteStatus: 'paid',
    verificationFailureCode: 'household_paid_invoice_verification_failed',
    mismatchCode: 'household_paid_invoice_mismatch',
    action: 'paid settlement',
    allowRemoteCustomerAsHistoricalIdentity: true,
  })
  const historicalCustomerId = inspection.snapshot?.stripeCustomerId ?? null

  // Current drift still matters for every future collection, but it must not
  // erase an already-settled receipt. Record it as a critical, idempotent
  // anomaly and continue using the immutable paid-invoice identity above.
  let account = null
  let authorityLookupError = null
  try {
    account = await pool.query(
      `/* household-paid:account */
       SELECT account.id,
              account.stripe_customer_id,
              account.is_active,
              (
                SELECT COUNT(*)::integer
                  FROM family_billing_account customer_owner
                 WHERE customer_owner.stripe_customer_id = account.stripe_customer_id
              ) AS stripe_customer_owner_count
         FROM family_billing_account account
        WHERE account.id = $1
        LIMIT 1`,
      [Number(local.family_billing_account_id)],
    ).then((result) => result.rows[0] ?? null)
  } catch (error) {
    authorityLookupError = error
  }
  const authorityDrifted = (
    !account
    || account.is_active !== true
    || String(account.stripe_customer_id ?? '') !== String(historicalCustomerId ?? '')
    || Number(account.stripe_customer_owner_count) !== 1
  )
  if (authorityDrifted || authorityLookupError) {
    const reasons = [
      !account ? 'account missing' : null,
      account && account.is_active !== true ? 'account inactive' : null,
      account && String(account.stripe_customer_id ?? '') !== String(historicalCustomerId ?? '')
        ? 'customer remapped'
        : null,
      account && Number(account.stripe_customer_owner_count) !== 1
        ? `current customer has ${Number(account.stripe_customer_owner_count) || 0} local owners`
        : null,
      authorityLookupError ? `authority lookup failed: ${authorityLookupError.message ?? String(authorityLookupError)}` : null,
    ].filter(Boolean)
    await recordStripeBillingAlert(pool, {
      event: { id: `household-paid-authority-drift:${local.id}` },
      object: {
        // Keep this deliberately narrow: neither a shared Customer nor a
        // pre-existing PaymentIntent row may override the immutable local
        // monthly-invoice account used for this anomaly.
        id: local.stripe_invoice_id,
        status: inspection.remoteInvoice?.status ?? 'paid',
        amount_due: inspection.remoteInvoice?.amount_due ?? Number(local.total_cents),
        currency: inspection.remoteInvoice?.currency ?? 'usd',
        metadata: {
          familyBillingAccountId: String(local.family_billing_account_id),
          monthlyInvoiceId: String(local.id),
        },
      },
      alertType: 'household_paid_invoice_current_authority_drift',
      severity: 'critical',
      message: `Stripe reports household invoice ${local.stripe_invoice_id} paid, but current future-collection authority is unsafe (${reasons.join(', ') || 'unknown drift'}). Historical settlement recording will continue from the exact invoice identity.`,
    }).catch(() => {})
  }
  return {
    inspection,
    verifiedInvoice: inspection.remoteInvoice,
    accountId: Number(local.family_billing_account_id),
    customerId: historicalCustomerId,
  }
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
  // Webhook payloads and earlier retrieve responses are not sufficient paid
  // evidence. Re-read the exact immutable invoice structure plus the complete
  // all-status Invoice Payment inventory before any ledger write.
  const paidBoundary = stripe
    ? await assertPaidHouseholdInvoiceSettlementBoundary(pool, stripe, local)
    : null
  const settlementInvoice = paidBoundary?.verifiedInvoice ?? invoice
  const preparedPayment = await preparePaymentFunction(pool, settlementInvoice, {
    stripe,
    historicalSettlementBinding: paidBoundary ? {
      kind: 'household_monthly',
      accountId: paidBoundary.accountId,
      customerId: paidBoundary.customerId,
      invoiceId: local.stripe_invoice_id,
      monthlyInvoiceId: local.id,
    } : null,
  })
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
      if (beforeMapping) await beforeMapping({ db, invoice: settlementInvoice, local: locked, payment })
      await db.query('SAVEPOINT household_invoice_payment_mapping')
      try {
        const updated = await applyHouseholdMonthlyInvoicePaymentLocked(db, {
          invoice: settlementInvoice,
          local: locked,
          payment,
        })
        await db.query('RELEASE SAVEPOINT household_invoice_payment_mapping')
        await db.query('COMMIT')
        await finishSettlementFunction(db, { invoice: settlementInvoice, local: locked, payment })
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
    automaticAttemptCount: Number(row.automatic_attempt_count ?? 0),
    lastAutomaticAttemptAt: row.last_automatic_attempt_at ?? null,
    failureMessage: row.failure_message ?? null, lineCount: Number(row.line_count),
    postPaymentCreditCents: Math.max(0, suppressedNetByInvoice.get(Number(row.id)) ?? 0),
    lines: linesByInvoice.get(Number(row.id)) ?? [],
  }))
}
