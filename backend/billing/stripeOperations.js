import { randomUUID } from 'crypto'
import { sendEmail } from '../email/sendEmail.js'
import { billingMailbox } from '../email/emailPolicy.js'
import { requireAdminFacilityScope } from './adminFacilityScope.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { getStripeClient } from './stripeBilling.js'

export async function ensureStripeOperationsSchema() {
  // Compatibility hook. Startup billing readiness owns this schema contract.
}

export async function resolveStripeBillingAlert(pool, {
  alertId,
  resolutionNote,
  resolvedByUserId,
  facilityId = null,
  allowGlobal = false,
}) {
  const note = String(resolutionNote ?? '').trim()
  if (!note) throw new Error('A resolution note is required.')
  if (resolvedByUserId == null) throw new Error('Authenticated resolver identity is required.')
  const scopedFacilityId = requireAdminFacilityScope({ facilityId, allowGlobal })
  await ensureStripeOperationsSchema(pool)
  const result = await pool.query(
    `UPDATE stripe_billing_alert
     SET action_status = 'resolved',
         resolved_at = now(),
         resolved_by_user_id = $2,
         resolution_note = $3,
         updated_at = now()
     WHERE id = $1
       AND action_status <> 'suspended'
       AND ($4::bigint IS NULL OR EXISTS (
         SELECT 1
         FROM family_billing_account scoped_account
         JOIN family scoped_family ON scoped_family.id = scoped_account.family_id
         WHERE scoped_account.id = stripe_billing_alert.family_billing_account_id
           AND scoped_family.facility_id = $4
       ))
     RETURNING *`,
    [Number(alertId), resolvedByUserId, note, scopedFacilityId],
  )
  if (result.rows[0]) return result.rows[0]
  const existing = await pool.query(
    `SELECT alert.action_status
     FROM stripe_billing_alert alert
     LEFT JOIN family_billing_account scoped_account
       ON scoped_account.id = alert.family_billing_account_id
     LEFT JOIN family scoped_family ON scoped_family.id = scoped_account.family_id
     WHERE alert.id = $1
       AND ($2::bigint IS NULL OR scoped_family.facility_id = $2)`,
    [Number(alertId), scopedFacilityId],
  )
  if (existing.rows[0]?.action_status === 'suspended') {
    throw new Error('Restore access before resolving this alert.')
  }
  throw new Error('Billing alert not found.')
}

const STRIPE_WEBHOOK_LEASE_SECONDS = 15 * 60

export async function beginStripeWebhookEvent(pool, event) {
  if (!event?.id) return { replayed: false, claimed: true, claimToken: null }
  await ensureStripeOperationsSchema(pool)
  const claimToken = randomUUID()
  const inserted = await pool.query(
    `
      INSERT INTO stripe_webhook_event (
        event_id, event_type, status, attempts, claim_token, lease_expires_at
      )
      VALUES ($1, $2, 'processing', 1, $3, now() + ($4::int * interval '1 second'))
      ON CONFLICT (event_id) DO NOTHING
      RETURNING status, attempts, claim_token, lease_expires_at
    `,
    [event.id, event.type ?? 'unknown', claimToken, STRIPE_WEBHOOK_LEASE_SECONDS],
  )
  if (inserted.rows[0]) {
    return {
      replayed: false,
      claimed: true,
      attempts: Number(inserted.rows[0].attempts ?? 1),
      claimToken,
      leaseExpiresAt: inserted.rows[0].lease_expires_at ?? null,
    }
  }

  // One atomic CAS covers both explicit failures and abandoned processing
  // leases. A stale worker's token is replaced, so it can no longer complete
  // or fail this event after the new worker takes ownership.
  const reclaimed = await pool.query(
    `UPDATE stripe_webhook_event
        SET status = 'processing',
            attempts = attempts + 1,
            claim_token = $2,
            lease_expires_at = now() + ($3::int * interval '1 second'),
            last_error = NULL,
            processed_at = NULL,
            updated_at = now()
      WHERE event_id = $1
        AND (
          status = 'failed'
          OR (
            status = 'processing'
            AND COALESCE(lease_expires_at, updated_at + interval '15 minutes') <= now()
          )
        )
      RETURNING status, attempts, claim_token, lease_expires_at`,
    [event.id, claimToken, STRIPE_WEBHOOK_LEASE_SECONDS],
  )
  if (reclaimed.rows[0]) {
    return {
      replayed: false,
      claimed: true,
      reclaimed: true,
      attempts: Number(reclaimed.rows[0].attempts ?? 1),
      claimToken,
      leaseExpiresAt: reclaimed.rows[0].lease_expires_at ?? null,
    }
  }

  const existing = await pool.query(
    `SELECT status, attempts, claim_token, lease_expires_at
       FROM stripe_webhook_event
      WHERE event_id = $1`,
    [event.id],
  )
  const row = existing.rows[0]
  if (row?.status === 'processed') {
    return { replayed: true, claimed: false, attempts: Number(row.attempts ?? 1) }
  }
  if (row?.status === 'processing') {
    return {
      replayed: false,
      claimed: false,
      inProgress: true,
      attempts: Number(row.attempts ?? 1),
      leaseExpiresAt: row.lease_expires_at ?? null,
    }
  }
  throw new Error(`Stripe webhook ${event.id} could not acquire a processing lease.`)
}

export async function completeStripeWebhookEvent(pool, event, { claimToken = null } = {}) {
  if (!event?.id) return { completed: false }
  if (!claimToken) throw new Error('Stripe webhook claim token is required to complete an event.')
  const completed = await pool.query(
    `UPDATE stripe_webhook_event
        SET status = 'processed', processed_at = now(), last_error = NULL,
            claim_token = NULL, lease_expires_at = NULL, updated_at = now()
      WHERE event_id = $1
        AND status = 'processing'
        AND claim_token = $2
      RETURNING event_id`,
    [event.id, claimToken],
  )
  if (completed.rows[0]) return { completed: true }
  const existing = await pool.query(
    `SELECT status FROM stripe_webhook_event WHERE event_id = $1`,
    [event.id],
  )
  if (existing.rows[0]?.status === 'processed') return { completed: false, replayed: true }
  throw new Error(`Stripe webhook ${event.id} processing lease is no longer owned by this worker.`)
}

export async function failStripeWebhookEvent(pool, event, error, { claimToken = null } = {}) {
  if (!event?.id || !claimToken) return { failed: false }
  const failed = await pool.query(
    `UPDATE stripe_webhook_event
        SET status = 'failed', last_error = $3, claim_token = NULL,
            lease_expires_at = NULL, updated_at = now()
      WHERE event_id = $1
        AND status = 'processing'
        AND claim_token = $2
      RETURNING event_id`,
    [event.id, claimToken, String(error?.message ?? error).slice(0, 1000)],
  ).catch(() => {})
  return { failed: Boolean(failed?.rows?.[0]) }
}

function stripeId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

function normalizeRefundReason(reason) {
  const value = String(reason ?? '').toLowerCase()
  if (value.includes('duplicate')) return 'duplicate'
  if (value.includes('fraud')) return 'fraudulent'
  return 'requested_by_customer'
}

export function normalizeStripeRefundStatus(status) {
  if (status === 'succeeded') return 'succeeded'
  if (status === 'failed' || status === 'canceled') return 'failed'
  return 'pending'
}

export const REFUND_LEDGER_FINALIZATION_PREFIX = '[stripe-refund-ledger-finalization-pending:'

function refundLedgerFinalizationMessage(stripeRefundId) {
  return `${REFUND_LEDGER_FINALIZATION_PREFIX}${stripeRefundId}] Stripe returned the money; approved ledger treatment must commit before household collection resumes.`
}

/**
 * A successful Stripe refund is deliberately kept collection-blocking until
 * its approved ledger treatment commits in the same transaction that promotes
 * the refund to succeeded. Historical succeeded rows remain eligible so the
 * durable reconciliation sweep can finish pre-hardening refunds.
 */
export function stripeRefundReadyForLedgerFinalization(refund) {
  if (!refund?.ledger_treatment || !refund?.stripe_refund_id) return false
  if (refund.external_status === 'succeeded') return true
  return refund.external_status === 'reconciliation_required'
    && String(refund.error_message ?? '').startsWith(
      `${REFUND_LEDGER_FINALIZATION_PREFIX}${refund.stripe_refund_id}]`,
    )
}

async function listStripeRefundsForLocalOwner(stripe, payment, localRefund) {
  if (typeof stripe?.refunds?.list !== 'function') {
    throw new Error(
      `Refund #${localRefund.id} has no recorded Stripe Refund ID and Stripe cannot prove whether its earlier request succeeded.`,
    )
  }
  const matches = []
  let startingAfter = null
  do {
    const page = await stripe.refunds.list({
      payment_intent: payment.stripe_payment_intent_id,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    if (!Array.isArray(page?.data)) {
      throw new Error(`Stripe returned an invalid refund inventory for PaymentIntent ${payment.stripe_payment_intent_id}.`)
    }
    if (typeof page.has_more !== 'boolean') {
      throw new Error(`Stripe returned an incomplete refund inventory for PaymentIntent ${payment.stripe_payment_intent_id}.`)
    }
    for (const remote of page.data) {
      if (String(remote?.metadata?.vortexRefundId ?? '') === String(localRefund.id)) {
        matches.push(remote)
      }
    }
    if (!page.has_more) break
    const next = stripeId(page.data.at(-1))
    if (!next || next === startingAfter) {
      throw new Error(`Stripe refund inventory did not advance for PaymentIntent ${payment.stripe_payment_intent_id}.`)
    }
    startingAfter = next
  } while (true)
  return matches
}

function assertBillingRefundReplay(row, {
  accountId,
  paymentId,
  amount,
  reason,
  createdByUserId,
  exceptionCategory,
  evidenceNote,
  ledgerTreatment,
  relatedChargeId,
}) {
  const sameRequest =
    Number(row.family_billing_account_id) === Number(accountId) &&
    Number(row.payment_id ?? 0) === Number(paymentId ?? 0) &&
    Number(row.amount_cents) === Number(amount) &&
    String(row.reason ?? '').trim() === String(reason ?? '').trim() &&
    Number(row.created_by_user_id ?? 0) === Number(createdByUserId ?? 0) &&
    String(row.exception_category ?? '') === String(exceptionCategory ?? '') &&
    String(row.evidence_note ?? '').trim() === String(evidenceNote ?? '').trim() &&
    String(row.ledger_treatment ?? '') === String(ledgerTreatment ?? '') &&
    Number(row.related_charge_id ?? 0) === Number(relatedChargeId ?? 0)
  if (!sameRequest) throw new Error('The refund request key was reused with different refund details.')
}

async function createBillingRefundUnderCollectionLock(db, {
  accountId,
  paymentId = null,
  amountCents,
  reason = null,
  externalReference = null,
  createdByUserId = null,
  exceptionCategory = null,
  evidenceNote = null,
  ledgerTreatment = null,
  relatedChargeId = null,
  requestKey = null,
  stripeClient = undefined,
}) {
  const amount = Math.round(Number(amountCents) || 0)
  if (amount <= 0) throw new Error('Refund amount must be positive.')
  const allowedExceptions = new Set(['duplicate_charge', 'vortex_cancellation', 'medical', 'relocation', 'owner_discretion'])
  if (!allowedExceptions.has(exceptionCategory)) throw new Error('An approved refund exception category is required.')
  if (!String(evidenceNote || '').trim()) throw new Error('Supporting evidence or an approval note is required.')
  if (createdByUserId == null) throw new Error('Refund approval must identify an Owner/Admin user.')

  let transactionOpen = false
  let payment = null
  let row = null
  let replayed = false
  let usesStripe = false
  let remoteMutationAttempted = false
  try {
    await db.query('BEGIN')
    transactionOpen = true
    if (requestKey) {
      row = await db.query(
        `SELECT * FROM billing_refund WHERE request_key = $1 FOR UPDATE`,
        [requestKey],
      ).then((result) => result.rows[0] ?? null)
      if (row) {
        replayed = true
        assertBillingRefundReplay(row, {
          accountId,
          paymentId,
          amount,
          reason,
          createdByUserId,
          exceptionCategory,
          evidenceNote,
          ledgerTreatment,
          relatedChargeId,
        })
      }
    }
    if (paymentId != null) {
      const paymentResult = await db.query(
        `SELECT *
           FROM billing_payment
          WHERE id = $1 AND family_billing_account_id = $2
          FOR UPDATE`,
        [paymentId, accountId],
      )
      payment = paymentResult.rows[0] ?? null
      if (!payment) throw new Error('Related payment was not found for this family.')
      if (!replayed) {
        const priorRefunds = await db.query(
         `SELECT id, amount_cents
             FROM billing_refund
            WHERE payment_id = $1
              AND external_status IN ('pending', 'succeeded', 'reconciliation_required')
            ORDER BY id
            FOR UPDATE`,
          [paymentId],
        )
        const refundedCents = priorRefunds.rows.reduce(
          (sum, refund) => sum + Math.max(0, Number(refund.amount_cents) || 0),
          0,
        )
        if (refundedCents + amount > Number(payment.amount_cents ?? 0)) {
          throw new Error('Refund exceeds the remaining refundable payment amount.')
        }
      }
    }

    // A payment's immutable processor identity, not today's feature flag,
    // determines whether cash must be returned through Stripe. Treating a
    // historical Stripe payment as a local-only refund during an outage would
    // reverse the ledger without returning the customer's money.
    usesStripe = Boolean(payment && (
      payment.stripe_payment_intent_id
      || payment.stripe_checkout_session_id
      || payment.stripe_invoice_id
      || String(payment.external_processor ?? '').trim().toLowerCase() === 'stripe'
    ))
    if (usesStripe && !String(requestKey ?? '').trim()) {
      throw new Error('A stable refund idempotency key is required before contacting Stripe.')
    }
    if (!replayed) {
      const inserted = requestKey
        ? await db.query(
        `INSERT INTO billing_refund
          (family_billing_account_id, payment_id, amount_cents, reason, external_reference,
           external_status, created_by_user_id, exception_category, evidence_note,
           approved_by_user_id, approved_at, ledger_treatment, related_charge_id, request_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $7, now(), $10, $11, $12)
         ON CONFLICT (request_key) WHERE request_key IS NOT NULL DO NOTHING
         RETURNING *`,
        [accountId, paymentId, amount, reason, externalReference, usesStripe ? 'pending' : 'succeeded', createdByUserId, exceptionCategory, String(evidenceNote).trim(), ledgerTreatment, relatedChargeId, requestKey],
          )
        : await db.query(
        `INSERT INTO billing_refund
          (family_billing_account_id, payment_id, amount_cents, reason, external_reference,
           external_status, created_by_user_id, exception_category, evidence_note,
           approved_by_user_id, approved_at, ledger_treatment, related_charge_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $7, now(), $10, $11)
         RETURNING *`,
        [accountId, paymentId, amount, reason, externalReference, usesStripe ? 'pending' : 'succeeded', createdByUserId, exceptionCategory, String(evidenceNote).trim(), ledgerTreatment, relatedChargeId],
          )
      row = inserted.rows[0]
      if (!row && requestKey) {
        row = await db.query(
          `SELECT * FROM billing_refund WHERE request_key = $1 FOR UPDATE`,
          [requestKey],
        ).then((result) => result.rows[0] ?? null)
        if (!row) throw new Error('Refund request could not be recovered after an idempotency conflict.')
        replayed = true
        assertBillingRefundReplay(row, {
          accountId,
          paymentId,
          amount,
          reason,
          createdByUserId,
          exceptionCategory,
          evidenceNote,
          ledgerTreatment,
          relatedChargeId,
        })
      }
    }
    await db.query('COMMIT')
    transactionOpen = false
    if (!usesStripe) {
      return { ...row, ...(replayed ? { idempotency_replayed: true } : {}) }
    }
  } catch (error) {
    if (transactionOpen) await db.query('ROLLBACK').catch(() => {})
    throw error
  }

  try {
    if (!payment?.stripe_payment_intent_id) {
      throw new Error('A Stripe payment refund requires its exact PaymentIntent before money can be returned.')
    }
    const stripe = stripeClient === undefined ? await getStripeClient() : stripeClient
    if (!stripe) throw new Error('Stripe is unavailable.')

    // A durable remote ID is immutable ownership proof. Replays must retrieve
    // and synchronize that exact Refund and must never issue another create.
    if (replayed && row.stripe_refund_id) {
      if (typeof stripe.refunds?.retrieve !== 'function') {
        throw new Error(`Stripe Refund ${row.stripe_refund_id} cannot be revalidated because Stripe is unavailable.`)
      }
      const existingRemote = await stripe.refunds.retrieve(row.stripe_refund_id, { expand: ['charge'] })
      if (stripeId(existingRemote) !== String(row.stripe_refund_id)) {
        throw new Error(`Stripe returned a different Refund for exact replay ${row.stripe_refund_id}.`)
      }
      const synced = await syncStripeRefund(db, existingRemote, { stripeClient: stripe })
      return { ...synced, idempotency_replayed: true }
    }

    // A crash can occur after Stripe accepts create but before the returned ID
    // is stored. Exhaustively discover the metadata-bound Refund first. This
    // remains safe even after Stripe's idempotency retention window expires.
    if (replayed) {
      const discovered = await listStripeRefundsForLocalOwner(stripe, payment, row)
      if (discovered.length > 0) {
        let exactLocal = null
        for (const remote of discovered) {
          const synced = await syncStripeRefund(db, remote, { stripeClient: stripe })
          if (Number(synced?.id) === Number(row.id)) exactLocal = synced
        }
        return { ...(exactLocal ?? row), idempotency_replayed: true }
      }
    }

    remoteMutationAttempted = true
    const refund = await stripe.refunds.create(
      {
        payment_intent: payment.stripe_payment_intent_id,
        amount,
        reason: normalizeRefundReason(reason),
        metadata: {
          vortexRefundId: String(row.id),
          familyBillingAccountId: String(accountId),
          billingPaymentId: String(payment.id),
        },
      },
      { idempotencyKey: `vortex-refund-${row.id}` },
    )
    const synced = await syncStripeRefund(db, refund, { stripeClient: stripe })
    return { ...synced, ...(replayed ? { idempotency_replayed: true } : {}) }
  } catch (error) {
    const unresolvedRemoteOutcome = Boolean(
      row && (replayed || row.stripe_refund_id || remoteMutationAttempted),
    )
    if (unresolvedRemoteOutcome) {
      const message = (
        `Refund #${row.id} has an unresolved Stripe outcome; household collection is blocked: ${String(error?.message ?? error)}`
      ).slice(0, 1000)
      const quarantined = await db.query(
        `UPDATE billing_refund
            SET external_status = 'reconciliation_required', error_message = $2, updated_at = now()
          WHERE id = $1
          RETURNING *`,
        [row.id, message],
      ).then((result) => result.rows[0] ?? row)
      await recordStripeBillingAlert(db, {
        event: { id: row.stripe_refund_id
          ? `stripe-refund:${row.stripe_refund_id}:retry-failed`
          : `stripe-refund-request:${row.id}:remote-outcome-unresolved` },
        object: {
          id: row.stripe_refund_id ?? `refund-request:${row.id}`,
          object: 'refund',
          payment_intent: payment?.stripe_payment_intent_id ?? null,
          status: quarantined.external_status,
          amount,
          currency: 'usd',
        },
        alertType: 'refund_reconciliation_required',
        severity: 'critical',
        message,
      })
    } else if (row) {
      await db.query(
        `UPDATE billing_refund
            SET external_status = 'pending', error_message = $2, updated_at = now()
          WHERE id = $1`,
        [row.id, String(error?.message ?? error).slice(0, 1000)],
      )
    }
    throw error
  }
}

export async function createBillingRefund(pool, options) {
  await ensureStripeOperationsSchema(pool)
  if (options?.collectionLockHeld) return createBillingRefundUnderCollectionLock(pool, options)
  return withBillingAccountCollectionLock(pool, options?.accountId, (db) => (
    createBillingRefundUnderCollectionLock(db, options)
  ))
}

async function resolvePaymentForStripeObject(pool, object) {
  const paymentIntentId = stripeId(object?.payment_intent)
  if (!paymentIntentId) return null
  const result = await pool.query(
    `SELECT * FROM billing_payment WHERE stripe_payment_intent_id = $1`,
    [paymentIntentId],
  )
  return result.rows[0] ?? null
}

function optionalPositiveMetadataId(metadata, key, problems) {
  const raw = metadata?.[key]
  if (raw == null || raw === '') return null
  const value = String(raw).trim()
  if (!/^\d+$/.test(value)) {
    problems.push(`metadata.${key} is not a positive integer`)
    return null
  }
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) {
    problems.push(`metadata.${key} is not a positive integer`)
    return null
  }
  return id
}

async function resolveRefundPaymentIntentId(refund, stripeClient) {
  const directPaymentIntentId = stripeId(refund?.payment_intent)
  if (directPaymentIntentId) return directPaymentIntentId

  const expandedChargePaymentIntentId = stripeId(refund?.charge?.payment_intent)
  if (expandedChargePaymentIntentId) return expandedChargePaymentIntentId

  const chargeId = stripeId(refund?.charge)
  if (!chargeId) {
    throw new Error(`Stripe refund ${refund?.id ?? ''} has no immutable PaymentIntent or Charge owner.`.trim())
  }
  const stripe = stripeClient === undefined ? await getStripeClient() : stripeClient
  if (typeof stripe?.charges?.retrieve !== 'function') {
    throw new Error(`Stripe refund ${refund?.id ?? ''} requires Charge ownership lookup, but Stripe is unavailable.`.trim())
  }
  const charge = await stripe.charges.retrieve(chargeId)
  const paymentIntentId = stripeId(charge?.payment_intent)
  if (!paymentIntentId) {
    throw new Error(`Stripe Charge ${chargeId} has no immutable PaymentIntent owner.`)
  }
  return paymentIntentId
}

function exactRefundRow(row, payment) {
  return Boolean(
    row
    && Number(row.family_billing_account_id) === Number(payment.family_billing_account_id)
    && Number(row.payment_id) === Number(payment.id),
  )
}

function refundReconciliationMessage(refundId, problems) {
  const detail = [...new Set(problems.filter(Boolean))].join('; ')
  return `Stripe refund ${refundId} requires reconciliation before this household can be collected${detail ? `: ${detail}` : '.'}`
}

export async function syncStripeRefund(pool, refund, {
  stripeClient = undefined,
  event = null,
} = {}) {
  if (!refund?.id) return null
  await ensureStripeOperationsSchema(pool)
  const paymentIntentId = await resolveRefundPaymentIntentId(refund, stripeClient)
  const payment = await resolvePaymentForStripeObject(pool, { payment_intent: paymentIntentId })
  if (!payment) {
    throw new Error(`Stripe refund ${refund.id} belongs to unrecorded PaymentIntent ${paymentIntentId}; retry after payment reconciliation.`)
  }
  const accountId = Number(payment.family_billing_account_id)
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    throw new Error(`Stripe refund ${refund.id} resolved to a payment without a household billing account.`)
  }
  const amount = Number(refund.amount)
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`Stripe refund ${refund.id} has an invalid amount.`)
  }

  const outcome = await withBillingAccountCollectionLock(pool, accountId, async (db) => {
    let transactionOpen = false
    try {
      await db.query('BEGIN')
      transactionOpen = true
      const lockedPayment = await db.query(
        `SELECT *
           FROM billing_payment
          WHERE id = $1
            AND family_billing_account_id = $2
            AND stripe_payment_intent_id = $3
          FOR UPDATE`,
        [Number(payment.id), accountId, paymentIntentId],
      ).then((result) => result.rows[0] ?? null)
      if (!lockedPayment) {
        throw new Error(`Stripe refund ${refund.id} payment ownership changed before it could be recorded.`)
      }

      const problems = []
      const metadataRefundId = optionalPositiveMetadataId(refund.metadata, 'vortexRefundId', problems)
      const metadataPaymentId = optionalPositiveMetadataId(refund.metadata, 'billingPaymentId', problems)
      const metadataAccountId = optionalPositiveMetadataId(refund.metadata, 'familyBillingAccountId', problems)
      if (metadataPaymentId != null && metadataPaymentId !== Number(lockedPayment.id)) {
        problems.push(`metadata.billingPaymentId ${metadataPaymentId} does not own PaymentIntent ${paymentIntentId}`)
      }
      if (metadataAccountId != null && metadataAccountId !== accountId) {
        problems.push(`metadata.familyBillingAccountId ${metadataAccountId} does not own PaymentIntent ${paymentIntentId}`)
      }
      const refundCustomerId = stripeId(refund.customer)
      if (
        refundCustomerId
        && lockedPayment.stripe_customer_id
        && refundCustomerId !== lockedPayment.stripe_customer_id
      ) {
        problems.push(`Stripe customer ${refundCustomerId} does not match the exact payment owner`)
      }
      if (
        lockedPayment.external_processor
        && String(lockedPayment.external_processor).toLowerCase() !== 'stripe'
      ) {
        problems.push(`Payment ${lockedPayment.id} is not recorded as a Stripe payment`)
      }
      const currency = String(refund.currency ?? '').trim().toLowerCase()
      if (currency !== 'usd') problems.push(`refund currency ${currency || 'missing'} is not USD`)
      if (amount > Number(lockedPayment.amount_cents ?? 0)) {
        problems.push(`refund amount ${amount} exceeds payment amount ${Number(lockedPayment.amount_cents ?? 0)}`)
      }

      const metadataRow = metadataRefundId == null
        ? null
        : await db.query(
          `SELECT * FROM billing_refund WHERE id = $1 FOR UPDATE`,
          [metadataRefundId],
        ).then((result) => result.rows[0] ?? null)
      if (metadataRefundId != null && !metadataRow) {
        problems.push(`metadata.vortexRefundId ${metadataRefundId} was not found`)
      } else if (metadataRow && !exactRefundRow(metadataRow, lockedPayment)) {
        problems.push(`metadata.vortexRefundId ${metadataRefundId} belongs to a different payment`)
      }

      const stripeRow = await db.query(
        `SELECT * FROM billing_refund WHERE stripe_refund_id = $1 FOR UPDATE`,
        [refund.id],
      ).then((result) => result.rows[0] ?? null)
      if (stripeRow && !exactRefundRow(stripeRow, lockedPayment)) {
        problems.push(`Stripe refund ${refund.id} is already attached to a different payment`)
      }
      if (metadataRow && stripeRow && Number(metadataRow.id) !== Number(stripeRow.id)) {
        problems.push(`Stripe refund ${refund.id} conflicts with local refund ${metadataRow.id}`)
      }

      const exactStripeRow = exactRefundRow(stripeRow, lockedPayment) ? stripeRow : null
      const exactMetadataRow = exactRefundRow(metadataRow, lockedPayment) ? metadataRow : null
      const metadataOwnsDifferentStripeRefund = Boolean(
        exactMetadataRow?.stripe_refund_id
        && String(exactMetadataRow.stripe_refund_id) !== String(refund.id),
      )
      if (metadataOwnsDifferentStripeRefund) {
        problems.push(
          `local refund ${exactMetadataRow.id} already owns ${exactMetadataRow.stripe_refund_id}; ${refund.id} requires a separate quarantine row`,
        )
      }
      // Never overwrite an immutable Stripe Refund binding. If metadata for a
      // second remote Refund points at an already-bound local request, record
      // that second Refund as its own exact quarantine owner instead.
      let existing = exactStripeRow ?? (metadataOwnsDifferentStripeRefund ? null : exactMetadataRow)
      const quarantineRequestKey = `stripe-refund-reconciliation:${refund.id}`
      const quarantineRow = await db.query(
        `SELECT * FROM billing_refund WHERE request_key = $1 FOR UPDATE`,
        [quarantineRequestKey],
      ).then((result) => result.rows[0] ?? null)
      if (quarantineRow) {
        if (!exactRefundRow(quarantineRow, lockedPayment)) {
          throw new Error(`Stripe refund ${refund.id} reconciliation owner is inconsistent.`)
        }
        if (existing && Number(existing.id) !== Number(quarantineRow.id)) {
          problems.push(`Stripe refund ${refund.id} has multiple local refund owners`)
        } else if (!existing) {
          existing = quarantineRow
        }
      }

      if (existing) {
        if (Number(existing.amount_cents) !== amount) {
          problems.push(`local refund amount ${Number(existing.amount_cents)} does not match Stripe amount ${amount}`)
        }
        if (existing.stripe_refund_id && existing.stripe_refund_id !== refund.id) {
          problems.push(`local refund ${existing.id} already owns ${existing.stripe_refund_id}`)
        }
      }

      const otherRefunds = await db.query(
        `SELECT id, amount_cents
           FROM billing_refund
          WHERE payment_id = $1
            AND ($2::bigint IS NULL OR id <> $2)
            AND COALESCE(external_status, 'succeeded') IN ('pending', 'succeeded', 'reconciliation_required')
          ORDER BY id
          FOR UPDATE`,
        [Number(lockedPayment.id), existing?.id ?? null],
      )
      const otherRefundedCents = otherRefunds.rows.reduce(
        (sum, row) => sum + Math.max(0, Number(row.amount_cents) || 0),
        0,
      )
      if (otherRefundedCents + amount > Number(lockedPayment.amount_cents ?? 0)) {
        problems.push('recorded refunds exceed the exact payment amount')
      }

      const remoteStatus = normalizeStripeRefundStatus(refund.status)
      const lacksLedgerTreatment = !existing?.ledger_treatment
      if (lacksLedgerTreatment && remoteStatus !== 'failed') {
        problems.push('refund has no approved ledger treatment')
      }
      const requiresReconciliation = problems.length > 0
      const awaitsLedgerFinalization = (
        remoteStatus === 'succeeded'
        && !requiresReconciliation
        && Boolean(existing?.ledger_treatment)
      )
      const status = requiresReconciliation || awaitsLedgerFinalization
        ? 'reconciliation_required'
        : remoteStatus
      const reconciliationMessage = requiresReconciliation
        ? refundReconciliationMessage(refund.id, problems)
        : null
      const errorMessage = reconciliationMessage
        ?? (awaitsLedgerFinalization ? refundLedgerFinalizationMessage(refund.id) : null)
        ?? refund.failure_reason
        ?? null
      const canAttachStripeId = Boolean(
        existing
        && (!existing.stripe_refund_id || String(existing.stripe_refund_id) === String(refund.id))
        && (!stripeRow || Number(stripeRow.id) === Number(existing.id)),
      )

      let row
      if (existing) {
        row = await db.query(
          `UPDATE billing_refund
              SET stripe_refund_id = CASE WHEN $2::boolean THEN $3 ELSE stripe_refund_id END,
                  external_reference = $3,
                  external_status = $4,
                  error_message = $5,
                  updated_at = now()
            WHERE id = $1
              AND family_billing_account_id = $6
              AND payment_id = $7
            RETURNING *`,
          [existing.id, canAttachStripeId, refund.id, status, errorMessage, accountId, Number(lockedPayment.id)],
        ).then((result) => result.rows[0] ?? null)
      } else {
        row = await db.query(
          `INSERT INTO billing_refund (
             family_billing_account_id, payment_id, amount_cents, reason,
             external_reference, stripe_refund_id, external_status, error_message,
             request_key
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            accountId,
            Number(lockedPayment.id),
            amount,
            refund.reason ?? 'Stripe refund',
            refund.id,
            stripeRow ? null : refund.id,
            status,
            errorMessage,
            quarantineRequestKey,
          ],
        ).then((result) => result.rows[0] ?? null)
      }
      if (!row) throw new Error(`Stripe refund ${refund.id} could not be recorded.`)
      await db.query('COMMIT')
      transactionOpen = false
      return { row, reconciliationMessage }
    } catch (error) {
      if (transactionOpen) await db.query('ROLLBACK').catch(() => {})
      throw error
    }
  })

  if (outcome.reconciliationMessage) {
    await recordStripeBillingAlert(pool, {
      event: event?.id ? event : { id: `stripe-refund:${refund.id}` },
      object: { ...refund, payment_intent: paymentIntentId },
      alertType: 'refund_reconciliation_required',
      severity: 'critical',
      message: outcome.reconciliationMessage,
    })
  }
  return outcome.row
}

export async function recordStripeBillingAlert(pool, { event, object, alertType, severity = 'warning', message }) {
  await ensureStripeOperationsSchema(pool)
  const payment = await resolvePaymentForStripeObject(pool, object)
  const accountId = payment?.family_billing_account_id ??
    (object?.object === 'refund' ? null : (Number(object?.metadata?.familyBillingAccountId) || null))
  const inserted = await pool.query(
    `INSERT INTO stripe_billing_alert
      (stripe_event_id, family_billing_account_id, alert_type, severity, stripe_object_id, message, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (stripe_event_id) DO NOTHING RETURNING *`,
    [event?.id ?? null, accountId, alertType, severity, object?.id ?? null, message,
      JSON.stringify({
        status: object?.status ?? null,
        reason: object?.reason ?? null,
        amount: object?.amount ?? object?.amount_due ?? null,
        currency: object?.currency ?? null,
        attemptCount: object?.attempt_count ?? null,
        nextPaymentAttempt: object?.next_payment_attempt ?? null,
      })],
  )
  const alert = inserted.rows[0] ?? null
  const to = billingMailbox()
  if (alert && to) {
    await sendEmail({
      to,
      subject: `[Vortex billing] ${message}`,
      text: `${message}\nStripe object: ${object?.id ?? 'unknown'}\nAccount: ${accountId ?? 'unresolved'}`,
      html: `<p><strong>${message}</strong></p><p>Stripe object: ${object?.id ?? 'unknown'}<br>Family billing account: ${accountId ?? 'unresolved'}</p>`,
      category: 'billing_alert',
      idempotencyKey: `stripe-alert-${event?.id ?? object?.id}`,
      skipPolicy: true,
    }).catch((error) => console.warn('[stripe] billing alert email:', error?.message ?? error))
  }
  return alert
}
