import { recordBillingActivity } from './billingActivity.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import {
  resolveStripeInvoicePaymentIntentId,
  resolveStripePaymentIntentInvoice,
} from './stripeInvoicePaymentBinding.js'
import { resolveStripePaymentMethodLabel } from './paymentMethodLabel.js'
import { refreshChargeStatuses } from './paymentAllocation.js'

const SETTLED_PAYMENT_STATUSES = new Set(['settled', 'succeeded'])

function objectId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

function positiveId(value, label) {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`${label} must be a positive integer.`)
  return id
}

function pairKey(pair) {
  return `${positiveId(pair.invoicePaymentId, 'Invoice payment ID')}:${positiveId(pair.duplicatePaymentId, 'Duplicate payment ID')}`
}

function remoteAmount(paymentIntent) {
  return Number(paymentIntent?.amount_received ?? paymentIntent?.amount ?? 0)
}

function paymentSummary(payment) {
  return payment ? {
    id: Number(payment.id),
    accountId: Number(payment.family_billing_account_id),
    amountCents: Number(payment.amount_cents),
    method: payment.method ?? null,
    status: payment.external_status,
    stripeCustomerId: payment.stripe_customer_id ?? null,
    stripeInvoiceId: payment.stripe_invoice_id ?? null,
    stripePaymentIntentId: payment.stripe_payment_intent_id ?? null,
    externalReference: payment.external_reference ?? null,
  } : null
}

async function loadLocalEvidence(db, pair, { lock = false } = {}) {
  const ids = [
    positiveId(pair.invoicePaymentId, 'Invoice payment ID'),
    positiveId(pair.duplicatePaymentId, 'Duplicate payment ID'),
  ]
  if (ids[0] === ids[1]) throw new Error('Invoice and duplicate payment IDs must be different.')
  const rows = await db.query(
    `SELECT payment.*, account.stripe_customer_id AS account_stripe_customer_id
       FROM billing_payment payment
       JOIN family_billing_account account ON account.id = payment.family_billing_account_id
      WHERE payment.id = ANY($1::bigint[])
      ORDER BY payment.id
      ${lock ? 'FOR UPDATE OF payment' : ''}`,
    [ids],
  ).then((result) => result.rows)
  const byId = new Map(rows.map((row) => [Number(row.id), row]))
  const invoicePayment = byId.get(ids[0]) ?? null
  const duplicatePayment = byId.get(ids[1]) ?? null
  if (!invoicePayment || !duplicatePayment) {
    throw new Error(`Payment pair ${ids.join(':')} is incomplete in the local ledger.`)
  }

  const applications = await db.query(
    `SELECT application.*,
            charge.family_billing_account_id AS charge_account_id,
            charge.charge_type, charge.source_type AS charge_source_type,
            charge.source_id AS charge_source_id, charge.subscription_id,
            EXISTS (
              SELECT 1 FROM billing_monthly_invoice_line invoice_line
               WHERE invoice_line.billing_charge_id = charge.id
            ) AS has_monthly_invoice_line,
            EXISTS (
              SELECT 1 FROM billing_statement_line statement_line
               WHERE statement_line.charge_id = charge.id
            ) AS has_statement_line,
            EXISTS (
              SELECT 1 FROM additional_fee_redemption entitlement
               WHERE entitlement.billing_charge_id = charge.id
            ) AS has_entitlement,
            EXISTS (
              SELECT 1
                FROM billing_payment_attempt attempt
                LEFT JOIN billing_payment_attempt_charge reservation
                  ON reservation.billing_payment_attempt_id = attempt.id
               WHERE attempt.family_billing_account_id = charge.family_billing_account_id
                 AND (
                   attempt.status IN ('pending', 'processing', 'reconciliation_required')
                   OR (attempt.status = 'reserved' AND attempt.expires_at > now())
                 )
                 AND (
                   reservation.billing_charge_id = charge.id
                   OR attempt.target_charge_id = charge.id
                   OR attempt.target_charge_id = charge.related_charge_id
                 )
            ) AS has_active_payment_attempt,
            COALESCE(SUM(reversal.amount_cents), 0)::int AS reversed_cents
       FROM billing_payment_application application
       JOIN billing_charge charge ON charge.id = application.billing_charge_id
       LEFT JOIN billing_payment_application reversal
         ON reversal.reverses_application_id = application.id
        AND reversal.application_kind = 'reversal'
      WHERE application.billing_payment_id = $1
        AND application.application_kind = 'application'
      GROUP BY application.id, charge.id
      ORDER BY application.id`,
    [duplicatePayment.id],
  ).then((result) => result.rows)
  const refunds = await db.query(
    `SELECT id, payment_id, amount_cents, external_status, stripe_refund_id
       FROM billing_refund
      WHERE payment_id = ANY($1::bigint[])
      ORDER BY id`,
    [ids],
  ).then((result) => result.rows)
  const invoiceCredits = await db.query(
    `SELECT id, billing_monthly_invoice_id
       FROM billing_monthly_invoice_line
      WHERE billing_payment_id = $1
      ORDER BY id`,
    [duplicatePayment.id],
  ).then((result) => result.rows)
  const attempts = await db.query(
    `SELECT id, billing_payment_id, stripe_payment_intent_id, status
       FROM billing_payment_attempt
      WHERE billing_payment_id = $1
         OR ($2::text IS NOT NULL AND stripe_payment_intent_id = $2)
      ORDER BY id`,
    [duplicatePayment.id, duplicatePayment.stripe_payment_intent_id],
  ).then((result) => result.rows)
  const repairActivity = await db.query(
    `SELECT id, event_key, family_billing_account_id, related_payment_id,
            event_type, details, stripe_object_id
       FROM billing_account_activity
      WHERE event_key = $1
      LIMIT 1`,
    [`duplicate-stripe-invoice-payment-repaired:${invoicePayment.id}:${duplicatePayment.id}`],
  ).then((result) => result.rows[0] ?? null)

  return {
    invoicePayment,
    duplicatePayment,
    applications,
    refunds,
    invoiceCredits,
    attempts,
    repairActivity,
  }
}

function validateLocalEvidence(evidence) {
  const {
    invoicePayment,
    duplicatePayment,
    applications,
    refunds,
    invoiceCredits,
    attempts,
    repairActivity,
  } = evidence
  if (Number(invoicePayment.family_billing_account_id) !== Number(duplicatePayment.family_billing_account_id)) {
    throw new Error('Invoice and duplicate payment rows belong to different billing accounts.')
  }
  if (Number(invoicePayment.amount_cents) !== Number(duplicatePayment.amount_cents)) {
    throw new Error('Invoice and duplicate payment rows have different amounts.')
  }
  if (!SETTLED_PAYMENT_STATUSES.has(String(invoicePayment.external_status))) {
    throw new Error(`Invoice payment ${invoicePayment.id} is not settled.`)
  }
  if (!invoicePayment.stripe_invoice_id) throw new Error('Authoritative payment has no Stripe invoice ID.')
  if (
    duplicatePayment.stripe_invoice_id
    && duplicatePayment.stripe_invoice_id !== invoicePayment.stripe_invoice_id
  ) {
    throw new Error('Duplicate payment is linked to a different Stripe invoice.')
  }
  if (refunds.length > 0) throw new Error('A payment in the pair has refund history and requires manual review.')
  if (invoiceCredits.length > 0) {
    throw new Error('The duplicate payment is already an immutable monthly-invoice credit and requires manual review.')
  }
  if (attempts.length > 0) {
    throw new Error('The duplicate payment is bound to a durable payment attempt and requires manual review.')
  }

  const reversalPlan = applications.map((application) => {
    if (Number(application.charge_account_id) !== Number(invoicePayment.family_billing_account_id)) {
      throw new Error(`Application ${application.id} funds a charge on a different account.`)
    }
    const remainingCents = Number(application.amount_cents) - Number(application.reversed_cents)
    if (remainingCents < 0) throw new Error(`Application ${application.id} is over-reversed.`)
    if (
      application.charge_type !== 'recurring'
      || application.charge_source_type !== 'scheduling_signup'
      || !application.charge_source_id
    ) {
      throw new Error(`Application ${application.id} is not an ordinary recurring enrollment charge.`)
    }
    if (application.has_monthly_invoice_line) {
      throw new Error(`Application ${application.id} targets a charge already used by a monthly invoice.`)
    }
    if (application.has_statement_line) {
      throw new Error(`Application ${application.id} targets a charge already used by a statement.`)
    }
    if (application.has_entitlement) {
      throw new Error(`Application ${application.id} targets an entitlement-bearing charge.`)
    }
    if (application.has_active_payment_attempt) {
      throw new Error(`Application ${application.id} targets a charge reserved by an active payment attempt.`)
    }
    return {
      applicationId: Number(application.id),
      chargeId: Number(application.billing_charge_id),
      amountCents: remainingCents,
    }
  }).filter((application) => application.amountCents > 0)
  const activeAppliedCents = reversalPlan.reduce((sum, application) => sum + application.amountCents, 0)
  if (activeAppliedCents > Number(duplicatePayment.amount_cents)) {
    throw new Error('Duplicate payment applications exceed the payment amount.')
  }

  const repaired = duplicatePayment.external_status === 'canceled'
    && !duplicatePayment.stripe_payment_intent_id
    && Boolean(invoicePayment.stripe_payment_intent_id)
  if (repaired) {
    if (activeAppliedCents !== 0) {
      throw new Error('Canceled duplicate payment still has an active payment application.')
    }
    const details = repairActivity?.details ?? {}
    if (
      repairActivity?.event_type !== 'duplicate_payment_reconciled'
      || Number(repairActivity.family_billing_account_id) !== Number(invoicePayment.family_billing_account_id)
      || Number(repairActivity.related_payment_id) !== Number(duplicatePayment.id)
      || repairActivity.stripe_object_id !== invoicePayment.stripe_invoice_id
      || details.stripeInvoiceId !== invoicePayment.stripe_invoice_id
      || details.stripePaymentIntentId !== invoicePayment.stripe_payment_intent_id
      || details.paymentMethod !== invoicePayment.method
    ) {
      throw new Error('Canceled duplicate payment lacks exact append-only repair evidence.')
    }
    return { repaired: true, reversalPlan: [] }
  }

  if (repairActivity) throw new Error('Repair activity exists but the payment pair is not in its repaired state.')
  if (!SETTLED_PAYMENT_STATUSES.has(String(duplicatePayment.external_status))) {
    throw new Error(`Duplicate payment ${duplicatePayment.id} is not settled.`)
  }
  if (!duplicatePayment.stripe_payment_intent_id) throw new Error('Duplicate payment has no Stripe PaymentIntent ID.')
  if (
    invoicePayment.stripe_payment_intent_id
    && invoicePayment.stripe_payment_intent_id !== duplicatePayment.stripe_payment_intent_id
  ) {
    throw new Error('Authoritative payment is linked to a different Stripe PaymentIntent.')
  }
  return { repaired: false, reversalPlan }
}

async function verifyRemoteBinding(stripe, evidence) {
  const { invoicePayment, duplicatePayment } = evidence
  const proposedPaymentIntentId = duplicatePayment.stripe_payment_intent_id
    ?? invoicePayment.stripe_payment_intent_id
  if (!proposedPaymentIntentId) throw new Error('The payment pair has no Stripe PaymentIntent to verify.')
  const invoice = await stripe.invoices.retrieve(invoicePayment.stripe_invoice_id)
  const paymentIntent = await stripe.paymentIntents.retrieve(proposedPaymentIntentId, {
    expand: ['payment_method', 'latest_charge'],
  })
  const invoicePaymentIntentId = await resolveStripeInvoicePaymentIntentId(stripe, invoice)
  const paymentIntentInvoice = await resolveStripePaymentIntentInvoice(stripe, paymentIntent)
  if (invoice?.paid !== true && invoice?.status !== 'paid') throw new Error('Stripe invoice is not paid.')
  if (paymentIntent?.status !== 'succeeded') throw new Error('Stripe PaymentIntent is not succeeded.')
  if (invoicePaymentIntentId !== proposedPaymentIntentId) {
    throw new Error('Stripe Invoice Payment does not bind the proposed PaymentIntent to the invoice.')
  }
  if (objectId(paymentIntentInvoice) !== invoicePayment.stripe_invoice_id) {
    throw new Error('Stripe PaymentIntent does not resolve back to the proposed invoice.')
  }
  if (
    Number(invoice.amount_paid) !== Number(invoicePayment.amount_cents)
    || remoteAmount(paymentIntent) !== Number(invoicePayment.amount_cents)
  ) {
    throw new Error('Stripe invoice, PaymentIntent, and local payment amounts do not match.')
  }
  if (objectId(invoice.customer) !== objectId(paymentIntent.customer)) {
    throw new Error('Stripe invoice and PaymentIntent customers do not match.')
  }
  if (
    invoicePayment.stripe_customer_id
    && objectId(invoice.customer) !== invoicePayment.stripe_customer_id
  ) {
    throw new Error('Local invoice payment customer does not match Stripe.')
  }
  if (
    duplicatePayment.stripe_customer_id
    && objectId(paymentIntent.customer) !== duplicatePayment.stripe_customer_id
  ) {
    throw new Error('Local duplicate payment customer does not match Stripe.')
  }
  if (
    invoicePayment.account_stripe_customer_id
    && objectId(invoice.customer) !== invoicePayment.account_stripe_customer_id
  ) {
    throw new Error('Billing account customer does not match Stripe invoice ownership.')
  }
  const method = await resolveStripePaymentMethodLabel(stripe, {
    paymentIntentId: proposedPaymentIntentId,
    paymentIntent,
    invoice,
  })
  const [refunds, disputes] = await Promise.all([
    stripe.refunds.list({ payment_intent: proposedPaymentIntentId, limit: 1 }),
    stripe.disputes.list({ payment_intent: proposedPaymentIntentId, limit: 1 }),
  ])
  if ((refunds?.data ?? []).length > 0) {
    throw new Error('Stripe PaymentIntent has remote refund history and requires manual review.')
  }
  if ((disputes?.data ?? []).length > 0) {
    throw new Error('Stripe PaymentIntent has remote dispute history and requires manual review.')
  }
  return {
    stripeInvoiceId: objectId(invoice),
    stripePaymentIntentId: objectId(paymentIntent),
    stripeCustomerId: objectId(invoice.customer),
    amountCents: Number(invoice.amount_paid),
    currency: invoice.currency ?? paymentIntent.currency ?? null,
    method,
  }
}

async function inspectPair(pool, stripe, pair) {
  const local = await loadLocalEvidence(pool, pair)
  const validation = validateLocalEvidence(local)
  const remote = await verifyRemoteBinding(stripe, local)
  return { pair, local, validation, remote }
}

function publicInspection(inspection) {
  return {
    pair: pairKey(inspection.pair),
    accountId: Number(inspection.local.invoicePayment.family_billing_account_id),
    accountStripeCustomerId: inspection.local.invoicePayment.account_stripe_customer_id ?? null,
    amountCents: Number(inspection.local.invoicePayment.amount_cents),
    invoicePayment: paymentSummary(inspection.local.invoicePayment),
    duplicatePayment: paymentSummary(inspection.local.duplicatePayment),
    reversals: inspection.validation.reversalPlan,
    remote: inspection.remote,
    state: inspection.validation.repaired ? 'already_repaired' : 'ready',
  }
}

function evidenceFingerprint(evidence) {
  const payment = (row) => ({
    ...paymentSummary(row),
    accountStripeCustomerId: row.account_stripe_customer_id ?? null,
  })
  return {
    invoicePayment: payment(evidence.invoicePayment),
    duplicatePayment: payment(evidence.duplicatePayment),
    applications: evidence.applications.map((application) => ({
      id: Number(application.id),
      paymentId: Number(application.billing_payment_id),
      chargeId: Number(application.billing_charge_id),
      amountCents: Number(application.amount_cents),
      reversedCents: Number(application.reversed_cents),
      kind: application.application_kind,
      chargeType: application.charge_type,
      chargeSourceType: application.charge_source_type,
      chargeSourceId: application.charge_source_id,
      hasMonthlyInvoiceLine: application.has_monthly_invoice_line === true,
      hasStatementLine: application.has_statement_line === true,
      hasEntitlement: application.has_entitlement === true,
      hasActivePaymentAttempt: application.has_active_payment_attempt === true,
    })),
    refunds: evidence.refunds.map((refund) => ({ ...refund })),
    invoiceCredits: evidence.invoiceCredits.map((credit) => ({ ...credit })),
    attempts: evidence.attempts.map((attempt) => ({ ...attempt })),
    repairActivity: evidence.repairActivity ? {
      eventKey: evidence.repairActivity.event_key,
      accountId: Number(evidence.repairActivity.family_billing_account_id),
      paymentId: Number(evidence.repairActivity.related_payment_id),
      eventType: evidence.repairActivity.event_type,
      stripeObjectId: evidence.repairActivity.stripe_object_id,
      details: evidence.repairActivity.details,
    } : null,
  }
}

async function insertExactApplicationReversal(db, {
  invoicePaymentId,
  duplicatePaymentId,
  duplicatePayment,
  reversal,
}) {
  const idempotencyKey = `duplicate-stripe-invoice-payment:${invoicePaymentId}:${duplicatePaymentId}:reverse:${reversal.applicationId}`
  let row = await db.query(
    `INSERT INTO billing_payment_application (
       billing_payment_id, billing_charge_id, amount_cents, application_kind,
       reverses_application_id, idempotency_key, allocation_reason
     ) VALUES (
       $1::bigint, $2::bigint, $3::integer, 'reversal',
       $4::bigint, $5::text, 'duplicate_stripe_invoice_payment_repair'
     )
     ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
     RETURNING *`,
    [
      duplicatePayment.id,
      reversal.chargeId,
      reversal.amountCents,
      reversal.applicationId,
      idempotencyKey,
    ],
  ).then((result) => result.rows[0] ?? null)
  if (!row) {
    row = await db.query(
      `SELECT * FROM billing_payment_application WHERE idempotency_key = $1 LIMIT 1`,
      [idempotencyKey],
    ).then((result) => result.rows[0] ?? null)
  }
  if (
    !row
    || Number(row.billing_payment_id) !== Number(duplicatePayment.id)
    || Number(row.billing_charge_id) !== Number(reversal.chargeId)
    || Number(row.amount_cents) !== Number(reversal.amountCents)
    || row.application_kind !== 'reversal'
    || Number(row.reverses_application_id) !== Number(reversal.applicationId)
    || row.allocation_reason !== 'duplicate_stripe_invoice_payment_repair'
  ) {
    throw new Error(`Application ${reversal.applicationId} does not have the exact repair reversal.`)
  }
  return row
}

async function applyInspectedPair(pool, stripe, initial, provenance) {
  const accountId = Number(initial.local.invoicePayment.family_billing_account_id)
  return withBillingAccountCollectionLock(pool, accountId, async (db) => {
    const refreshed = await inspectPair(db, stripe, initial.pair)
    if (refreshed.validation.repaired) return { ...publicInspection(refreshed), state: 'already_repaired' }
    if (JSON.stringify(publicInspection(refreshed)) !== JSON.stringify(publicInspection(initial))) {
      throw new Error(`Payment pair ${pairKey(initial.pair)} changed after preflight.`)
    }

    await db.query('BEGIN')
    try {
      const locked = await loadLocalEvidence(db, initial.pair, { lock: true })
      const validation = validateLocalEvidence(locked)
      if (validation.repaired) {
        await db.query('ROLLBACK')
        return { ...publicInspection({ ...refreshed, local: locked, validation }), state: 'already_repaired' }
      }
      if (JSON.stringify(evidenceFingerprint(locked)) !== JSON.stringify(evidenceFingerprint(refreshed.local))) {
        throw new Error(`Payment pair ${pairKey(initial.pair)} local evidence changed after preflight.`)
      }
      for (const reversal of validation.reversalPlan) {
        await insertExactApplicationReversal(db, {
          invoicePaymentId: locked.invoicePayment.id,
          duplicatePaymentId: locked.duplicatePayment.id,
          duplicatePayment: locked.duplicatePayment,
          reversal,
        })
      }

      const paymentIntentId = locked.duplicatePayment.stripe_payment_intent_id
      const duplicate = await db.query(
        `UPDATE billing_payment
            SET external_status = 'canceled',
                stripe_payment_intent_id = NULL,
                external_reference = COALESCE(external_reference, $2::text),
                note = CONCAT_WS(' | ', NULLIF(note, ''), $3::text)
          WHERE id = $1
            AND stripe_payment_intent_id = $2
            AND external_status IN ('settled', 'succeeded')
          RETURNING *`,
        [
          locked.duplicatePayment.id,
          paymentIntentId,
          `Neutralized duplicate local record; remote Stripe payment belongs to billing_payment #${locked.invoicePayment.id}.`,
        ],
      ).then((result) => result.rows[0] ?? null)
      if (!duplicate) throw new Error('Duplicate payment changed before it could be neutralized.')

      const canonical = await db.query(
        `UPDATE billing_payment
            SET stripe_payment_intent_id = $2,
                stripe_customer_id = COALESCE(stripe_customer_id, $3::text),
                method = $5
          WHERE id = $1
            AND stripe_invoice_id = $4
            AND (stripe_payment_intent_id IS NULL OR stripe_payment_intent_id = $2)
          RETURNING *`,
        [
          locked.invoicePayment.id,
          paymentIntentId,
          refreshed.remote.stripeCustomerId,
          locked.invoicePayment.stripe_invoice_id,
          refreshed.remote.method,
        ],
      ).then((result) => result.rows[0] ?? null)
      if (!canonical) throw new Error('Authoritative invoice payment changed before its binding could be completed.')

      await refreshChargeStatuses(db, accountId)
      const activity = await recordBillingActivity(db, {
        eventKey: `duplicate-stripe-invoice-payment-repaired:${canonical.id}:${duplicate.id}`,
        accountId,
        paymentId: duplicate.id,
        eventType: 'duplicate_payment_reconciled',
        summary: `Duplicate local payment #${duplicate.id} was neutralized without refunding Stripe.`,
        beforeValue: {
          invoicePayment: paymentSummary(locked.invoicePayment),
          duplicatePayment: paymentSummary(locked.duplicatePayment),
        },
        afterValue: {
          invoicePayment: paymentSummary(canonical),
          duplicatePayment: paymentSummary(duplicate),
        },
        details: {
          stripeInvoiceId: canonical.stripe_invoice_id,
          stripePaymentIntentId: paymentIntentId,
          paymentMethod: refreshed.remote.method,
          reversedApplications: validation.reversalPlan,
          repairProvenance: provenance,
        },
        stripeObjectId: canonical.stripe_invoice_id,
        actorType: 'admin',
      })
      if (!activity) throw new Error('Exact duplicate-payment repair activity could not be recorded.')
      await db.query('COMMIT')
      return {
        ...publicInspection({ ...refreshed, local: { ...locked, invoicePayment: canonical, duplicatePayment: duplicate } }),
        state: 'repaired',
      }
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {})
      throw error
    }
  })
}

async function observeAppliedCohort(pool, stripe, pairs) {
  const committed = []
  const notApplied = []
  const unknown = []
  for (const pair of pairs) {
    try {
      const inspection = await inspectPair(pool, stripe, pair)
      const observed = publicInspection(inspection)
      if (inspection.validation.repaired) {
        committed.push({ ...observed, state: 'committed' })
      } else {
        notApplied.push({ ...observed, state: 'not_applied' })
      }
    } catch (error) {
      unknown.push({
        pair: pairKey(pair),
        state: 'unknown',
        message: error?.message ?? String(error),
      })
    }
  }
  return { committed, notApplied, unknown }
}

export async function repairDuplicateStripeInvoicePayments(pool, stripe, {
  pairs = [],
  apply = false,
  provenance = {},
} = {}) {
  if (typeof apply !== 'boolean') throw new Error('Apply must be a boolean.')
  if (
    !stripe?.invoices?.retrieve
    || !stripe?.paymentIntents?.retrieve
    || !stripe?.invoicePayments?.list
    || !stripe?.refunds?.list
    || !stripe?.disputes?.list
  ) {
    throw new Error('A Stripe client with Invoice Payments, refund, and dispute lookup support is required.')
  }
  const normalizedProvenance = {
    planHash: provenance?.planHash ? String(provenance.planHash).slice(0, 128) : null,
    changeTicket: provenance?.changeTicket ? String(provenance.changeTicket).slice(0, 200) : null,
    operator: provenance?.operator ? String(provenance.operator).slice(0, 200) : null,
    codeVersion: provenance?.codeVersion ? String(provenance.codeVersion).slice(0, 200) : null,
    sourceChecksum: provenance?.sourceChecksum ? String(provenance.sourceChecksum).slice(0, 64) : null,
  }
  if (apply && (
    !/^[0-9a-f]{64}$/.test(String(normalizedProvenance.planHash ?? ''))
    || !normalizedProvenance.changeTicket
    || !normalizedProvenance.operator
    || !normalizedProvenance.codeVersion
    || !/^[0-9a-f]{64}$/.test(String(normalizedProvenance.sourceChecksum ?? ''))
  )) {
    throw new Error(
      'Apply requires an exact plan hash, source checksum, change ticket, operator, and code version.',
    )
  }
  const normalizedPairs = pairs.map((pair) => ({
    invoicePaymentId: positiveId(pair.invoicePaymentId, 'Invoice payment ID'),
    duplicatePaymentId: positiveId(pair.duplicatePaymentId, 'Duplicate payment ID'),
  }))
  if (normalizedPairs.length === 0) throw new Error('At least one explicit payment pair is required.')
  if (new Set(normalizedPairs.flatMap((pair) => [pair.invoicePaymentId, pair.duplicatePaymentId])).size !== normalizedPairs.length * 2) {
    throw new Error('A payment ID cannot appear in more than one repair pair.')
  }

  const inspected = []
  const failed = []
  for (const pair of normalizedPairs) {
    try {
      inspected.push(await inspectPair(pool, stripe, pair))
    } catch (error) {
      failed.push({ pair: pairKey(pair), message: error?.message ?? String(error) })
    }
  }
  if (failed.length > 0) {
    const notApplied = inspected.map((inspection) => ({
      ...publicInspection(inspection),
      state: 'not_applied',
    }))
    return {
      mode: apply ? 'apply' : 'dry_run',
      cohortStopped: true,
      repaired: [],
      ready: apply ? [] : inspected.map(publicInspection),
      committed: [],
      notApplied: apply ? notApplied : [],
      unknown: apply
        ? failed.map((entry) => ({ ...entry, state: 'unknown' }))
        : [],
      failed,
    }
  }
  if (!apply) {
    return {
      mode: 'dry_run',
      cohortStopped: false,
      repaired: [],
      ready: inspected.map(publicInspection),
      failed: [],
    }
  }

  for (const inspection of inspected) {
    try {
      await applyInspectedPair(pool, stripe, inspection, normalizedProvenance)
    } catch (error) {
      failed.push({ pair: pairKey(inspection.pair), message: error?.message ?? String(error) })
      break
    }
  }
  const observed = await observeAppliedCohort(pool, stripe, normalizedPairs)
  return {
    mode: 'apply',
    cohortStopped:
      failed.length > 0
      || observed.notApplied.length > 0
      || observed.unknown.length > 0,
    repaired: observed.committed,
    ready: [],
    ...observed,
    failed,
  }
}
