import { randomUUID } from 'crypto'
import { sendEmail } from '../email/sendEmail.js'
import { billingMailbox } from '../email/emailPolicy.js'
import { requireAdminFacilityScope } from './adminFacilityScope.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { getStripeClient, stripeEnabled } from './stripeBilling.js'

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
              AND external_status IN ('pending', 'succeeded')
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

    usesStripe = Boolean(
      payment?.stripe_payment_intent_id
      && (stripeClient !== undefined || stripeEnabled()),
    )
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
    const confirmedTerminalReplay = replayed && (
      row.external_status === 'succeeded'
      || (row.external_status === 'failed' && row.stripe_refund_id)
    )
    if (!usesStripe || confirmedTerminalReplay) {
      return { ...row, ...(replayed ? { idempotency_replayed: true } : {}) }
    }
  } catch (error) {
    if (transactionOpen) await db.query('ROLLBACK').catch(() => {})
    throw error
  }

  try {
    const stripe = stripeClient === undefined ? await getStripeClient() : stripeClient
    if (!stripe) throw new Error('Stripe is unavailable.')
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
    const updated = await db.query(
      `UPDATE billing_refund
       SET stripe_refund_id = $2, external_reference = $2, external_status = $3,
           error_message = NULL, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [
        row.id,
        refund.id,
        refund.status === 'failed' || refund.status === 'canceled'
          ? 'failed'
          : refund.status === 'succeeded'
            ? 'succeeded'
            : 'pending',
      ],
    )
    return { ...updated.rows[0], ...(replayed ? { idempotency_replayed: true } : {}) }
  } catch (error) {
    await db.query(
      `UPDATE billing_refund SET external_status = 'pending', error_message = $2, updated_at = now() WHERE id = $1`,
      [row.id, String(error?.message ?? error).slice(0, 1000)],
    )
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
  if (paymentIntentId) {
    const result = await pool.query(`SELECT * FROM billing_payment WHERE stripe_payment_intent_id = $1 LIMIT 1`, [paymentIntentId])
    if (result.rows[0]) return result.rows[0]
  }
  const customerId = stripeId(object?.customer)
  if (!customerId) return null
  const result = await pool.query(
    `SELECT p.* FROM billing_payment p
     WHERE p.stripe_customer_id = $1 ORDER BY p.paid_at DESC LIMIT 1`,
    [customerId],
  )
  return result.rows[0] ?? null
}

export async function syncStripeRefund(pool, refund) {
  if (!refund?.id) return null
  await ensureStripeOperationsSchema(pool)
  let vortexRefundId = Number(refund.metadata?.vortexRefundId)
  let existing = null
  if (Number.isFinite(vortexRefundId) && vortexRefundId > 0) {
    existing = await pool.query(`SELECT * FROM billing_refund WHERE id = $1`, [vortexRefundId]).then((r) => r.rows[0] ?? null)
  }
  if (!existing) {
    existing = await pool.query(`SELECT * FROM billing_refund WHERE stripe_refund_id = $1`, [refund.id]).then((r) => r.rows[0] ?? null)
  }
  const status = normalizeStripeRefundStatus(refund.status)
  if (existing) {
    return pool.query(
      `UPDATE billing_refund SET stripe_refund_id = $2, external_reference = $2,
       external_status = $3, error_message = $4, updated_at = now() WHERE id = $1 RETURNING *`,
      [existing.id, refund.id, status, refund.failure_reason ?? null],
    ).then((r) => r.rows[0] ?? null)
  }
  const payment = await resolvePaymentForStripeObject(pool, refund)
  if (!payment) return null
  return pool.query(
    `INSERT INTO billing_refund
      (family_billing_account_id, payment_id, amount_cents, reason, external_reference,
       stripe_refund_id, external_status)
     VALUES ($1, $2, $3, $4, $5, $5, $6)
     ON CONFLICT (stripe_refund_id) WHERE stripe_refund_id IS NOT NULL DO UPDATE
       SET external_status = EXCLUDED.external_status, updated_at = now()
     RETURNING *`,
    [payment.family_billing_account_id, payment.id, Number(refund.amount ?? 0), refund.reason ?? 'Stripe refund', refund.id, status],
  ).then((r) => r.rows[0] ?? null)
}

export async function recordStripeBillingAlert(pool, { event, object, alertType, severity = 'warning', message }) {
  await ensureStripeOperationsSchema(pool)
  const payment = await resolvePaymentForStripeObject(pool, object)
  const accountId = payment?.family_billing_account_id ??
    (Number(object?.metadata?.familyBillingAccountId) || null)
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
