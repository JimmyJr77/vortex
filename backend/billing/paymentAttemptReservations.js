import { randomUUID } from 'node:crypto'
import {
  HOUSEHOLD_INVOICE_RESERVING_STATUSES,
  loadCanonicalCollectibleBalanceCents,
} from './canonicalBillingAccount.js'
import { allocateHouseholdPayments } from './paymentAllocation.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import {
  findActiveEnrollmentCheckoutBalanceCollector,
  findCompletedPaidCheckoutFulfillmentGap,
} from './paidCheckoutCollectionGuard.js'
import { prepareStripePaymentRecord, upsertStripePayment } from './stripeBilling.js'

export { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'

const ACTIVE_ATTEMPT_PREDICATE = `(
  attempt.status IN ('pending', 'processing', 'reconciliation_required')
  OR (
    attempt.status = 'reserved'
    AND attempt.expires_at > now()
  )
)`

const TERMINAL_ATTEMPT_STATUSES = new Set(['succeeded', 'failed', 'expired', 'canceled'])

export class BillingPaymentAttemptMappingConflict extends Error {
  constructor(message) {
    super(message)
    this.name = 'BillingPaymentAttemptMappingConflict'
    this.code = 'BILLING_PAYMENT_ATTEMPT_MAPPING_CONFLICT'
  }
}

function positiveId(value, label) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new Error(`${label} is required.`)
  return id
}

function positiveCents(value, label = 'Payment amount') {
  const amount = Number(value)
  if (!Number.isInteger(amount) || amount <= 0) throw new Error(`${label} must be a positive whole-cent amount.`)
  return amount
}

function validExpiration(value) {
  const expiration = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(expiration.getTime()) || expiration.getTime() <= Date.now()) {
    throw new Error('Payment attempt expiration must be in the future.')
  }
  return expiration
}

function normalizeRequestKey(value) {
  const key = String(value ?? '').trim() || randomUUID()
  if (key.length > 200) throw new Error('Payment attempt request key is too long.')
  return key
}

function normalizeAttemptType(value) {
  const type = String(value ?? '').trim()
  if (![
    'member_balance_checkout',
    'admin_balance_checkout',
    'admin_balance_saved_card',
    'charge_checkout',
    'charge_saved_card',
  ].includes(type)) {
    throw new Error('Payment attempt type is invalid.')
  }
  return type
}

export function paymentAttemptIsActive(attempt, now = new Date()) {
  const status = String(attempt?.status ?? '')
  if (['pending', 'processing', 'reconciliation_required'].includes(status)) return true
  if (status !== 'reserved') return false
  const expiresAt = new Date(attempt?.expires_at ?? attempt?.expiresAt ?? 0)
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > now.getTime()
}

async function loadAttemptLines(pool, attemptId) {
  return pool.query(
    `SELECT reservation.billing_charge_id, reservation.amount_cents,
            charge.description, charge.member_id
       FROM billing_payment_attempt_charge reservation
       JOIN billing_charge charge ON charge.id = reservation.billing_charge_id
      WHERE reservation.billing_payment_attempt_id = $1
      ORDER BY charge.created_at, charge.id`,
    [Number(attemptId)],
  ).then((result) => result.rows)
}

async function hydrateAttempt(pool, attempt, { replayed = false } = {}) {
  if (!attempt) return null
  return {
    ...attempt,
    id: Number(attempt.id),
    family_billing_account_id: Number(attempt.family_billing_account_id),
    amount_cents: Number(attempt.amount_cents),
    target_charge_id: attempt.target_charge_id == null ? null : Number(attempt.target_charge_id),
    billing_payment_id: attempt.billing_payment_id == null ? null : Number(attempt.billing_payment_id),
    reservations: (await loadAttemptLines(pool, attempt.id)).map((line) => ({
      ...line,
      billing_charge_id: Number(line.billing_charge_id),
      amount_cents: Number(line.amount_cents),
      member_id: line.member_id == null ? null : Number(line.member_id),
    })),
    replayed,
  }
}

export async function loadBillingPaymentAttemptByRequestKey(pool, {
  accountId,
  attemptType,
  requestKey,
}) {
  const normalizedAccountId = positiveId(accountId, 'Billing account ID')
  const type = normalizeAttemptType(attemptType)
  const key = String(requestKey ?? '').trim()
  if (!key) return null
  const attempt = await pool.query(
    `SELECT * FROM billing_payment_attempt
      WHERE family_billing_account_id = $1 AND attempt_type = $2 AND request_key = $3
      LIMIT 1`,
    [normalizedAccountId, type, key],
  ).then((result) => result.rows[0] ?? null)
  return hydrateAttempt(pool, attempt, { replayed: Boolean(attempt) })
}

async function expireUnlinkedReservations(pool, accountId) {
  await pool.query(
    `UPDATE billing_payment_attempt
        SET status = 'expired', released_at = now(), updated_at = now()
      WHERE family_billing_account_id = $1
        AND status = 'reserved'
        AND stripe_checkout_session_id IS NULL
        AND stripe_payment_intent_id IS NULL
        AND expires_at <= now()`,
    [Number(accountId)],
  )
}

async function loadReservationCandidates(pool, { accountId, targetChargeId = null }) {
  const target = targetChargeId == null ? null : positiveId(targetChargeId, 'Billing charge ID')
  const result = await pool.query(
    `WITH application_totals AS (
       SELECT application.billing_charge_id,
              SUM(CASE
                WHEN application.application_kind = 'reversal' THEN -application.amount_cents
                ELSE application.amount_cents
              END)::bigint AS applied_cents
         FROM billing_payment_application application
         JOIN billing_payment payment ON payment.id = application.billing_payment_id
         JOIN billing_charge scoped_charge ON scoped_charge.id = application.billing_charge_id
        WHERE scoped_charge.family_billing_account_id = $1
          AND payment.external_status IN ('settled', 'succeeded')
        GROUP BY application.billing_charge_id
     ), credit_application_totals AS (
       SELECT target_line.billing_charge_id,
              SUM(application.amount_cents)::bigint AS applied_cents
         FROM billing_charge_credit_application application
         JOIN billing_monthly_invoice_line target_line
           ON target_line.id = application.target_invoice_line_id
         JOIN billing_monthly_invoice_line credit_line
           ON credit_line.id = application.credit_invoice_line_id
         JOIN billing_charge credit_source
           ON credit_source.id = credit_line.billing_charge_id
         JOIN billing_charge scoped_charge
           ON scoped_charge.id = target_line.billing_charge_id
        WHERE scoped_charge.family_billing_account_id = $1
          AND NOT (
            credit_source.related_charge_id = target_line.billing_charge_id
            AND credit_source.source_type IN ('charge_adjustment', 'refund_offset')
          )
        GROUP BY target_line.billing_charge_id
     ), linked_offset_totals AS (
       SELECT linked.related_charge_id AS billing_charge_id,
              SUM(linked.amount_cents)::bigint AS offset_cents
         FROM billing_charge linked
        WHERE linked.family_billing_account_id = $1
          AND linked.source_type IN ('charge_adjustment', 'refund_offset')
          AND linked.related_charge_id IS NOT NULL
        GROUP BY linked.related_charge_id
     ), active_reservations AS (
       SELECT reservation.billing_charge_id,
              SUM(reservation.amount_cents)::bigint AS reserved_cents
         FROM billing_payment_attempt_charge reservation
         JOIN billing_payment_attempt attempt ON attempt.id = reservation.billing_payment_attempt_id
        WHERE attempt.family_billing_account_id = $1
          AND ${ACTIVE_ATTEMPT_PREDICATE}
        GROUP BY reservation.billing_charge_id
     )
     SELECT charge.id, charge.member_id, charge.description, charge.created_at,
            GREATEST(
              0,
              charge.amount_cents
                + COALESCE(linked_offset.offset_cents, 0)
                - COALESCE(application.applied_cents, 0)
                - COALESCE(credit_application.applied_cents, 0)
                - COALESCE(reservation.reserved_cents, 0)
            )::int AS available_cents
       FROM billing_charge charge
       LEFT JOIN application_totals application ON application.billing_charge_id = charge.id
       LEFT JOIN credit_application_totals credit_application
         ON credit_application.billing_charge_id = charge.id
       LEFT JOIN linked_offset_totals linked_offset
         ON linked_offset.billing_charge_id = charge.id
       LEFT JOIN active_reservations reservation ON reservation.billing_charge_id = charge.id
      WHERE charge.family_billing_account_id = $1
        AND charge.amount_cents > 0
        AND charge.charge_type <> 'credit'
        AND (
          $2::bigint IS NULL
          OR charge.id = $2
          OR (charge.related_charge_id = $2 AND charge.source_type = 'charge_adjustment')
        )
        AND NOT EXISTS (
          SELECT 1
            FROM billing_monthly_invoice_line line
            JOIN billing_monthly_invoice invoice ON invoice.id = line.billing_monthly_invoice_id
           WHERE line.billing_charge_id = charge.id
             AND invoice.status = ANY($3::text[])
        )
        AND NOT EXISTS (
          SELECT 1
            FROM billing_payment_attempt attempt
           WHERE attempt.family_billing_account_id = $1
             AND attempt.target_charge_id IS NOT NULL
             AND ${ACTIVE_ATTEMPT_PREDICATE}
             AND (
               attempt.target_charge_id = charge.id
               OR attempt.target_charge_id = charge.related_charge_id
             )
        )
        AND GREATEST(
              0,
              charge.amount_cents
                + COALESCE(linked_offset.offset_cents, 0)
                - COALESCE(application.applied_cents, 0)
                - COALESCE(credit_application.applied_cents, 0)
                - COALESCE(reservation.reserved_cents, 0)
            ) > 0
      ORDER BY charge.created_at, charge.id
      FOR UPDATE OF charge`,
    [Number(accountId), target, HOUSEHOLD_INVOICE_RESERVING_STATUSES],
  )
  return result.rows.map((row) => ({ ...row, id: Number(row.id), available_cents: Number(row.available_cents) }))
}

/** Reserve exact ledger charge slices under the household collection lock. */
export async function reserveBillingPaymentAttempt(pool, {
  accountId,
  attemptType,
  requestKey = null,
  amountCents,
  targetChargeId = null,
  expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000),
  metadata = {},
}) {
  const normalizedAccountId = positiveId(accountId, 'Billing account ID')
  const type = normalizeAttemptType(attemptType)
  const key = normalizeRequestKey(requestKey)
  const amount = positiveCents(amountCents)
  const target = targetChargeId == null ? null : positiveId(targetChargeId, 'Billing charge ID')
  const expiration = validExpiration(expiresAt)

  return withBillingAccountCollectionLock(pool, normalizedAccountId, async (db) => {
    await db.query('BEGIN')
    try {
      await expireUnlinkedReservations(db, normalizedAccountId)
      const existing = await db.query(
      `SELECT * FROM billing_payment_attempt
        WHERE family_billing_account_id = $1 AND attempt_type = $2 AND request_key = $3
        FOR UPDATE`,
      [normalizedAccountId, type, key],
      ).then((result) => result.rows[0] ?? null)
      if (existing) {
        if (
          Number(existing.amount_cents) !== amount
          || Number(existing.target_charge_id ?? 0) !== Number(target ?? 0)
        ) {
          throw new Error('Payment idempotency key was reused with different payment details.')
        }
        await db.query('COMMIT')
        return hydrateAttempt(db, existing, { replayed: true })
      }

      const unresolvedPaidCheckout = await db.query(
        `SELECT id
           FROM billing_payment
          WHERE family_billing_account_id = $1
            AND external_status = 'reconciliation_required'
            AND (
              position('[paid-checkout-fulfillment-pending:' in COALESCE(note, '')) > 0
              OR position('[paid-checkout-refund-required:' in COALESCE(note, '')) > 0
            )
          LIMIT 1`,
        [normalizedAccountId],
      )
      if (unresolvedPaidCheckout.rows[0]) {
        throw new Error('This household has a paid Stripe Checkout awaiting fulfillment reconciliation; do not collect another payment.')
      }

      const unresolvedRefund = await db.query(
        `SELECT id
           FROM billing_refund
          WHERE family_billing_account_id = $1
            AND external_status = 'reconciliation_required'
          LIMIT 1`,
        [normalizedAccountId],
      )
      if (unresolvedRefund.rows[0]) {
        throw new Error('This household has a Stripe refund awaiting ledger reconciliation; do not collect another payment.')
      }

      const activeEnrollmentCheckout = await findActiveEnrollmentCheckoutBalanceCollector(
        db,
        normalizedAccountId,
      )
      if (activeEnrollmentCheckout) {
        throw new Error(
          'This household has an active enrollment Checkout already collecting part of its account balance; do not open another payment.',
        )
      }

      const completedCheckoutGap = await findCompletedPaidCheckoutFulfillmentGap(
        db,
        normalizedAccountId,
      )
      if (completedCheckoutGap) {
        throw new Error(
          `This household has a completed paid ${completedCheckoutGap.owner_kind} Checkout without exact local fulfillment; do not collect another payment.`,
        )
      }

      const candidates = await loadReservationCandidates(db, {
        accountId: normalizedAccountId,
        targetChargeId: target,
      })
      const available = candidates.reduce((sum, candidate) => sum + candidate.available_cents, 0)
      const collectibleBalanceCents = await loadCanonicalCollectibleBalanceCents(db, normalizedAccountId)
      if (available < amount || collectibleBalanceCents < amount) {
        throw new Error(target
          ? 'This bill is already paid, reserved, or included in a household monthly invoice.'
          : 'The collection amount exceeds the unreserved account balance.')
      }

      const inserted = await db.query(
        `INSERT INTO billing_payment_attempt (
           family_billing_account_id, attempt_type, request_key, status,
           amount_cents, target_charge_id, expires_at, metadata
         ) VALUES ($1, $2, $3, 'reserved', $4, $5, $6, $7::jsonb)
         RETURNING *`,
        [normalizedAccountId, type, key, amount, target, expiration, JSON.stringify(metadata ?? {})],
      )
      const attempt = inserted.rows[0]
      let remaining = amount
      for (const candidate of candidates) {
        if (remaining <= 0) break
        const reservedCents = Math.min(remaining, candidate.available_cents)
        await db.query(
          `INSERT INTO billing_payment_attempt_charge (
             billing_payment_attempt_id, billing_charge_id, amount_cents
           ) VALUES ($1, $2, $3)`,
          [attempt.id, candidate.id, reservedCents],
        )
        remaining -= reservedCents
      }
      if (remaining !== 0) throw new Error('Payment attempt charge reservation is incomplete.')
      await db.query('COMMIT')
      return hydrateAttempt(db, attempt)
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {})
      throw error
    }
  })
}

export async function markBillingPaymentAttemptRemotePending(pool, attemptId) {
  const result = await pool.query(
    `UPDATE billing_payment_attempt
        SET status = CASE WHEN status = 'reserved' THEN 'processing' ELSE status END,
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [positiveId(attemptId, 'Payment attempt ID')],
  )
  return result.rows[0] ?? null
}

export async function attachBillingPaymentAttemptStripeObject(pool, {
  attemptId,
  checkoutSessionId = null,
  checkoutUrl = null,
  paymentIntentId = null,
  status,
  expiresAt = null,
}) {
  const id = positiveId(attemptId, 'Payment attempt ID')
  const normalizedStatus = String(status ?? '').trim()
  if (!['pending', 'processing', 'reconciliation_required'].includes(normalizedStatus)) {
    throw new Error('Remote payment attempt status is invalid.')
  }
  const located = await pool.query(
    `SELECT family_billing_account_id FROM billing_payment_attempt WHERE id = $1`,
    [id],
  ).then((result) => result.rows[0] ?? null)
  if (!located) throw new Error('Payment attempt was not found.')
  return withBillingAccountCollectionLock(pool, located.family_billing_account_id, async (db) => {
    await db.query('BEGIN')
    try {
      const existing = await db.query(
        `SELECT * FROM billing_payment_attempt WHERE id = $1 FOR UPDATE`,
        [id],
      ).then((result) => result.rows[0] ?? null)
      if (!existing) throw new Error('Payment attempt was not found.')
      if (TERMINAL_ATTEMPT_STATUSES.has(existing.status)) {
        await db.query('COMMIT')
        return existing
      }
      if (
        (checkoutSessionId && existing.stripe_checkout_session_id && existing.stripe_checkout_session_id !== checkoutSessionId)
        || (paymentIntentId && existing.stripe_payment_intent_id && existing.stripe_payment_intent_id !== paymentIntentId)
      ) {
        throw new Error('Payment attempt is already linked to a different Stripe object.')
      }
      const updated = await db.query(
        `UPDATE billing_payment_attempt
            SET status = $2,
                stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, $3),
                stripe_checkout_url = COALESCE(stripe_checkout_url, $4),
                stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, $5),
                expires_at = COALESCE($6, expires_at),
                updated_at = now()
          WHERE id = $1
          RETURNING *`,
        [id, normalizedStatus, checkoutSessionId, checkoutUrl, paymentIntentId, expiresAt],
      )
      await db.query('COMMIT')
      return updated.rows[0]
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {})
      throw error
    }
  })
}

function stripeObjectId(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  return typeof value.id === 'string' ? value.id : null
}

function stripeObjectIdentifiers(object = {}) {
  const metadataId = Number(object?.metadata?.billingPaymentAttemptId)
  const checkoutSessionId = String(
    object?.object === 'checkout.session' || String(object?.id ?? '').startsWith('cs_')
      ? object?.id ?? ''
      : '',
  ).trim() || null
  const paymentIntentId = stripeObjectId(object?.payment_intent)
    ?? (String(object?.object ?? '') === 'payment_intent' || String(object?.id ?? '').startsWith('pi_')
      ? stripeObjectId(object)
      : null)
  return {
    metadataId: Number.isInteger(metadataId) && metadataId > 0 ? metadataId : null,
    checkoutSessionId,
    paymentIntentId,
  }
}

function assertStripeObjectMatchesAttempt(attempt, object = {}) {
  if (!attempt) throw new BillingPaymentAttemptMappingConflict('Payment attempt was not found.')
  const identifiers = stripeObjectIdentifiers(object)
  if (identifiers.metadataId != null && identifiers.metadataId !== Number(attempt.id)) {
    throw new BillingPaymentAttemptMappingConflict(
      'Stripe payment metadata identifies a different payment attempt.',
    )
  }
  if (identifiers.checkoutSessionId) {
    if (!attempt.stripe_checkout_session_id) {
      throw new BillingPaymentAttemptMappingConflict(
        'Stripe Checkout Session is not durably linked to this payment attempt.',
      )
    }
    if (String(attempt.stripe_checkout_session_id) !== identifiers.checkoutSessionId) {
      throw new BillingPaymentAttemptMappingConflict(
        'Stripe Checkout Session does not match this payment attempt.',
      )
    }
  }
  if (identifiers.paymentIntentId && attempt.stripe_payment_intent_id) {
    if (String(attempt.stripe_payment_intent_id) !== identifiers.paymentIntentId) {
      throw new BillingPaymentAttemptMappingConflict(
        'Stripe PaymentIntent does not match this payment attempt.',
      )
    }
  } else if (identifiers.paymentIntentId && !identifiers.checkoutSessionId) {
    throw new BillingPaymentAttemptMappingConflict(
      'Stripe PaymentIntent is not durably linked to this payment attempt.',
    )
  }
  if (!identifiers.checkoutSessionId && !identifiers.paymentIntentId) {
    throw new BillingPaymentAttemptMappingConflict(
      'Stripe payment object has no durable remote identifier.',
    )
  }
  return identifiers
}

export async function findBillingPaymentAttemptForStripeObject(pool, object = {}) {
  const { metadataId, checkoutSessionId, paymentIntentId } = stripeObjectIdentifiers(object)
  if (!metadataId && !checkoutSessionId && !paymentIntentId) return null
  const result = await pool.query(
    `SELECT * FROM billing_payment_attempt attempt
      WHERE ($1::bigint IS NOT NULL AND attempt.id = $1)
         OR ($2::text IS NOT NULL AND attempt.stripe_checkout_session_id = $2)
         OR ($3::text IS NOT NULL AND attempt.stripe_payment_intent_id = $3)
      ORDER BY attempt.id`,
    [metadataId, checkoutSessionId, paymentIntentId],
  )
  const candidates = new Map(result.rows.map((row) => [Number(row.id), row]))
  if (candidates.size === 0) return null
  if (candidates.size !== 1) {
    throw new BillingPaymentAttemptMappingConflict(
      'Stripe payment identifiers resolve to different payment attempts.',
    )
  }
  const attempt = candidates.values().next().value
  assertStripeObjectMatchesAttempt(attempt, object)
  return attempt
}

export async function releaseBillingPaymentAttempt(pool, {
  attemptId = null,
  stripeObject = null,
  status,
  reason = null,
  checkoutTerminal = false,
  remoteCreationDefinitelyNotStarted = false,
  allocationFunction = allocateHouseholdPayments,
}) {
  const normalizedStatus = String(status ?? '').trim()
  if (!['failed', 'expired', 'canceled'].includes(normalizedStatus)) {
    throw new Error('Released payment attempt status is invalid.')
  }
  const existing = attemptId
    ? await pool.query(`SELECT * FROM billing_payment_attempt WHERE id = $1`, [positiveId(attemptId, 'Payment attempt ID')])
      .then((result) => result.rows[0] ?? null)
    : await findBillingPaymentAttemptForStripeObject(pool, stripeObject)
  if (!existing) return existing
  if (stripeObject) assertStripeObjectMatchesAttempt(existing, stripeObject)
  if (existing.status === 'succeeded') return existing
  const savedCardAttempt = String(existing.attempt_type).endsWith('_saved_card')
  const verifiedPaymentIntentCancellation = (
    normalizedStatus === 'canceled'
    && String(stripeObject?.status ?? '') === 'canceled'
    && String(stripeObjectId(stripeObject) ?? '').startsWith('pi_')
  )
  const definitePreRequestFailure = (
    normalizedStatus === 'failed'
    && remoteCreationDefinitelyNotStarted === true
    && !existing.stripe_payment_intent_id
    && !existing.stripe_checkout_session_id
  )
  // A declined off-session PaymentIntent commonly returns to
  // requires_payment_method and can later be reconfirmed. Keep its immutable
  // reservation until Stripe proves cancellation. The only safe failed state
  // without remote proof is a failure known to precede the create request.
  if (savedCardAttempt && !verifiedPaymentIntentCancellation && !definitePreRequestFailure) {
    return existing
  }
  // A card failure inside a still-open hosted Checkout Session is not terminal:
  // Checkout may let the customer retry. Only the Checkout expired/canceled
  // lifecycle may release that reservation.
  if (
    ['failed', 'canceled'].includes(normalizedStatus)
    && String(existing.attempt_type).includes('checkout')
    && checkoutTerminal !== true
    && remoteCreationDefinitelyNotStarted !== true
  ) {
    return existing
  }
  return withBillingAccountCollectionLock(pool, existing.family_billing_account_id, async (db) => {
    const result = await db.query(
      `UPDATE billing_payment_attempt
          SET status = $2,
              released_at = COALESCE(released_at, now()),
              metadata = metadata || jsonb_strip_nulls(jsonb_build_object('releaseReason', $3::text)),
              updated_at = now()
        WHERE id = $1 AND status <> 'succeeded'
        RETURNING *`,
      [existing.id, normalizedStatus, reason == null ? null : String(reason).slice(0, 500)],
    )
    const released = result.rows[0] ?? existing
    // A manual payment may have arrived while this attempt owned its charges.
    // Reallocate it before the lock is released so neither a retry nor the
    // monthly invoice can collect a balance that is already paid locally.
    await allocationFunction(db, {
      accountId: existing.family_billing_account_id,
      actorType: 'system',
      idempotencyNamespace: `payment-attempt-release:${existing.id}`,
    })
    return released
  })
}

async function loadPaymentApplications(pool, paymentId) {
  const result = await pool.query(
    `SELECT billing_charge_id, amount_cents, application_kind, idempotency_key
       FROM billing_payment_application
      WHERE billing_payment_id = $1
      ORDER BY id`,
    [Number(paymentId)],
  )
  return result.rows
}

function paymentApplicationNetCents(applications) {
  return applications.reduce((sum, application) => (
    sum + (application.application_kind === 'reversal' ? -1 : 1) * Number(application.amount_cents)
  ), 0)
}

function assertPaymentApplicationCapacity(payment, applications) {
  const appliedCents = paymentApplicationNetCents(applications)
  if (appliedCents < 0 || appliedCents > Number(payment.amount_cents)) {
    throw new BillingPaymentAttemptMappingConflict(
      `Payment #${payment.id} has ${appliedCents} cents applied against ${payment.amount_cents} received cents.`,
    )
  }
  return appliedCents
}

async function quarantinePayment(db, payment, reason) {
  return db.query(
    `UPDATE billing_payment
        SET external_status = 'reconciliation_required',
            note = CASE
              WHEN COALESCE(note, '') = '' THEN $2
              WHEN position($2 in note) > 0 THEN note
              ELSE note || chr(10) || $2
            END
      WHERE id = $1
      RETURNING *`,
    [Number(payment.id), String(reason).slice(0, 500)],
  ).then((result) => result.rows[0] ?? payment)
}

async function completeBillingPaymentAttemptLocked(db, {
  attempt,
  stripeObject,
  payment,
}) {
  if (!attempt) throw new Error('Payment attempt was not found.')
  assertStripeObjectMatchesAttempt(attempt, stripeObject)
  if (Number(payment.family_billing_account_id) !== Number(attempt.family_billing_account_id)) {
    throw new Error('Stripe payment belongs to a different billing account than its reservation.')
  }
  if (Number(payment.amount_cents) !== Number(attempt.amount_cents)) {
    throw new BillingPaymentAttemptMappingConflict('Stripe payment amount does not match its reserved ledger charges.')
  }
  if (attempt.status === 'succeeded') {
    if (Number(attempt.billing_payment_id) !== Number(payment.id)) {
      throw new BillingPaymentAttemptMappingConflict('Payment attempt is already completed by a different payment.')
    }
    return hydrateAttempt(db, attempt, { replayed: true })
  }
  if (['failed', 'expired', 'canceled'].includes(attempt.status)) {
    throw new BillingPaymentAttemptMappingConflict(
      `A successful Stripe payment arrived after its reservation became ${attempt.status}; manual reconciliation is required.`,
    )
  }
  const reservations = await loadAttemptLines(db, attempt.id)
  const reservedTotal = reservations.reduce((sum, row) => sum + Number(row.amount_cents), 0)
  if (reservedTotal !== Number(attempt.amount_cents)) {
    throw new BillingPaymentAttemptMappingConflict('Payment attempt reservation total is inconsistent.')
  }

  const expectedApplications = new Map(reservations.map((reservation) => [
    `payment-attempt:${attempt.id}:charge:${reservation.billing_charge_id}`,
    reservation,
  ]))
  const existingApplications = await loadPaymentApplications(db, payment.id)
  assertPaymentApplicationCapacity(payment, existingApplications)
  for (const application of existingApplications) {
    const reservation = expectedApplications.get(application.idempotency_key)
    if (
      application.application_kind !== 'application'
      || !reservation
      || Number(application.billing_charge_id) !== Number(reservation.billing_charge_id)
      || Number(application.amount_cents) !== Number(reservation.amount_cents)
    ) {
      throw new BillingPaymentAttemptMappingConflict(
        'Stripe payment was already allocated outside its durable payment-attempt reservation.',
      )
    }
  }

  for (const reservation of reservations) {
    await db.query(
      `INSERT INTO billing_payment_application (
         billing_payment_id, billing_charge_id, amount_cents,
         application_kind, idempotency_key, allocation_reason
       ) VALUES ($1, $2, $3, 'application', $4, 'payment_attempt_reservation')
       ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
      [
        payment.id,
        reservation.billing_charge_id,
        reservation.amount_cents,
        `payment-attempt:${attempt.id}:charge:${reservation.billing_charge_id}`,
      ],
    )
  }
  const completedApplications = await loadPaymentApplications(db, payment.id)
  const completedAppliedCents = assertPaymentApplicationCapacity(payment, completedApplications)
  if (completedAppliedCents !== Number(payment.amount_cents)) {
    throw new BillingPaymentAttemptMappingConflict('Payment attempt did not apply its complete received amount.')
  }

  // A payment can settle several charge reservations. The payment row is the
  // canonical owner of its Stripe PaymentIntent, and the applications explain
  // every funded charge. `billing_charge.stripe_payment_intent_id` is unique,
  // so only a one-charge attempt may mirror that reference onto the charge.
  const singleChargePaymentIntentId = reservations.length === 1
    ? payment.stripe_payment_intent_id
      ?? stripeObjectId(stripeObject?.payment_intent)
      ?? stripeObjectId(stripeObject)
    : null

  await db.query(
    `UPDATE billing_charge charge
        SET collection_status = CASE
          WHEN charge.id = $2::bigint THEN 'paid'
          WHEN COALESCE((
            SELECT SUM(CASE
              WHEN application.application_kind = 'reversal' THEN -application.amount_cents
              ELSE application.amount_cents
            END)
            FROM billing_payment_application application
            JOIN billing_payment payment ON payment.id = application.billing_payment_id
            WHERE application.billing_charge_id = charge.id
              AND payment.external_status IN ('settled', 'succeeded')
          ), 0) + COALESCE((
            SELECT SUM(credit_application.amount_cents)
              FROM billing_charge_credit_application credit_application
              JOIN billing_monthly_invoice_line target_line
                ON target_line.id = credit_application.target_invoice_line_id
             WHERE target_line.billing_charge_id = charge.id
          ), 0) >= charge.amount_cents THEN 'paid'
          ELSE charge.collection_status
        END,
            stripe_payment_intent_id = COALESCE($3, charge.stripe_payment_intent_id)
      WHERE charge.id IN (
        SELECT billing_charge_id
          FROM billing_payment_attempt_charge
         WHERE billing_payment_attempt_id = $1
      )`,
    [attempt.id, attempt.target_charge_id, singleChargePaymentIntentId],
  )
  const updated = await db.query(
    `UPDATE billing_payment_attempt
        SET status = 'succeeded',
            billing_payment_id = $2,
            stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, $3),
            stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, $4),
            completed_at = COALESCE(completed_at, now()),
            released_at = NULL,
            updated_at = now()
      WHERE id = $1
        AND status NOT IN ('failed', 'expired', 'canceled')
      RETURNING *`,
    [
      attempt.id,
      payment.id,
      String(stripeObject?.id ?? '').startsWith('cs_') ? stripeObject.id : null,
      payment.stripe_payment_intent_id ?? stripeObjectId(stripeObject?.payment_intent) ?? (
        String(stripeObject?.id ?? '').startsWith('pi_') ? stripeObject.id : null
      ),
    ],
  )
  if (!updated.rows[0]) {
    throw new BillingPaymentAttemptMappingConflict('Payment attempt became terminal before exact settlement completed.')
  }
  return hydrateAttempt(db, updated.rows[0])
}

/** Apply an already-recorded payment to its exact reservation in one transaction. */
export async function completeBillingPaymentAttempt(pool, {
  stripeObject,
  payment,
}) {
  const located = await findBillingPaymentAttemptForStripeObject(pool, stripeObject)
  if (!located || !payment?.id) return null
  return withBillingAccountCollectionLock(pool, located.family_billing_account_id, async (db) => {
    await db.query('BEGIN')
    try {
      const attempt = await db.query(
        `SELECT * FROM billing_payment_attempt WHERE id = $1 FOR UPDATE`,
        [located.id],
      ).then((result) => result.rows[0] ?? null)
      const completed = await completeBillingPaymentAttemptLocked(db, { attempt, stripeObject, payment })
      await db.query('COMMIT')
      return completed
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {})
      throw error
    }
  })
}

/**
 * Atomically mirror a successful Stripe payment and consume its exact charge
 * reservation. Terminal/out-of-order success is retained but quarantined and
 * deliberately left unapplied for administrator reconciliation.
 */
export async function recordAndCompleteBillingPaymentAttempt(pool, {
  stripeObject,
  paymentIntentId,
  paidAt = null,
  amountCents,
  customerId = null,
  preparePaymentFunction = prepareStripePaymentRecord,
  recordPaymentFunction = upsertStripePayment,
  beforeMapping = null,
}) {
  const located = await findBillingPaymentAttemptForStripeObject(pool, stripeObject)
  if (!located) return null
  const preparedPayment = await preparePaymentFunction({
    paymentIntentId,
    paymentIntent: String(stripeObject?.id ?? '').startsWith('pi_') ? stripeObject : null,
    paidAt,
    amountCents,
    accountId: located.family_billing_account_id,
    customerId,
  })
  if (!preparedPayment) throw new Error('The successful Stripe payment could not be prepared for recording.')
  return withBillingAccountCollectionLock(pool, located.family_billing_account_id, async (db) => {
    await db.query('BEGIN')
    try {
      const attempt = await db.query(
        `SELECT * FROM billing_payment_attempt WHERE id = $1 FOR UPDATE`,
        [located.id],
      ).then((result) => result.rows[0] ?? null)
      if (!attempt) throw new Error('Payment attempt was not found.')
      if (Number(preparedPayment.accountId) !== Number(attempt.family_billing_account_id)) {
        throw new Error('Prepared Stripe payment belongs to a different billing account.')
      }
      const payment = await recordPaymentFunction(db, preparedPayment)
      if (!payment?.id) throw new Error('The successful Stripe payment was not recorded locally.')
      if (Number(payment.family_billing_account_id) !== Number(attempt.family_billing_account_id)) {
        throw new Error('Stripe payment was previously recorded against a different billing account.')
      }
      if (beforeMapping) await beforeMapping({ db, stripeObject, attempt, payment })

      if (['failed', 'expired', 'canceled'].includes(attempt.status)) {
        const reason = `Late Stripe success arrived after payment attempt ${attempt.id} became ${attempt.status}.`
        const quarantinedPayment = await quarantinePayment(db, payment, reason)
        await db.query(
          `UPDATE billing_payment_attempt
              SET metadata = metadata || jsonb_build_object(
                    'lateSuccessPaymentId', $2::bigint,
                    'lateSuccessAt', now(),
                    'lateSuccessReason', $3::text
                  ),
                  updated_at = now()
            WHERE id = $1`,
          [attempt.id, payment.id, reason],
        )
        const applications = await loadPaymentApplications(db, payment.id)
        assertPaymentApplicationCapacity(payment, applications)
        await db.query('COMMIT')
        return { attempt, payment: quarantinedPayment, completed: null, conflicted: true, reason }
      }

      await db.query('SAVEPOINT billing_payment_attempt_mapping')
      try {
        const completed = await completeBillingPaymentAttemptLocked(db, { attempt, stripeObject, payment })
        await db.query('RELEASE SAVEPOINT billing_payment_attempt_mapping')
        await db.query('COMMIT')
        return { attempt: completed, payment, completed, conflicted: false, reason: null }
      } catch (error) {
        if (error?.code !== 'BILLING_PAYMENT_ATTEMPT_MAPPING_CONFLICT') throw error
        await db.query('ROLLBACK TO SAVEPOINT billing_payment_attempt_mapping')
        const reason = String(error.message || 'Payment attempt mapping conflict.').slice(0, 500)
        const quarantinedPayment = await quarantinePayment(db, payment, reason)
        await db.query(
          `UPDATE billing_payment_attempt
              SET status = CASE
                    WHEN status IN ('failed', 'expired', 'canceled', 'succeeded') THEN status
                    ELSE 'reconciliation_required'
                  END,
                  metadata = metadata || jsonb_build_object(
                    'settlementConflictPaymentId', $2::bigint,
                    'settlementConflictAt', now(),
                    'settlementConflictReason', $3::text
                  ),
                  updated_at = now()
            WHERE id = $1
            RETURNING *`,
          [attempt.id, payment.id, reason],
        )
        await db.query('COMMIT')
        return { attempt, payment: quarantinedPayment, completed: null, conflicted: true, reason }
      }
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {})
      throw error
    }
  })
}

export function paymentIntentFailureIsFinal(intent) {
  const status = String(intent?.status ?? '').trim()
  return status === 'canceled'
}

async function findUnattachedStripeObject(stripe, attempt) {
  const attemptId = String(attempt.id)
  if (String(attempt.attempt_type).includes('checkout')) {
    if (!attempt.stripe_customer_id || typeof stripe?.checkout?.sessions?.list !== 'function') return null
    const firstListing = stripe.checkout.sessions.list({
      customer: attempt.stripe_customer_id,
      limit: 100,
    })
    if (typeof firstListing?.[Symbol.asyncIterator] === 'function') {
      for await (const session of firstListing) {
        if (String(session?.metadata?.billingPaymentAttemptId ?? '') === attemptId) return session
      }
      return null
    }
    let page = await firstListing
    while (page) {
      const match = (page.data ?? []).find((session) => (
        String(session?.metadata?.billingPaymentAttemptId ?? '') === attemptId
      ))
      if (match) return match
      if (page.has_more !== true || (page.data ?? []).length === 0) return null
      page = await stripe.checkout.sessions.list({
        customer: attempt.stripe_customer_id,
        limit: 100,
        starting_after: page.data.at(-1).id,
      })
    }
    return null
  }
  if (typeof stripe?.paymentIntents?.search !== 'function') return null
  const page = await stripe.paymentIntents.search({
    query: `metadata['billingPaymentAttemptId']:'${attemptId}'`,
    limit: 10,
  })
  return (page?.data ?? []).find((intent) => (
    String(intent?.metadata?.billingPaymentAttemptId ?? '') === attemptId
    && (
      !attempt.stripe_customer_id
      || stripeObjectId(intent?.customer) === attempt.stripe_customer_id
    )
  )) ?? null
}

async function checkoutPaymentIntent(stripe, session) {
  if (session?.payment_intent && typeof session.payment_intent === 'object') {
    return session.payment_intent
  }
  const paymentIntentId = stripeObjectId(session?.payment_intent)
  if (!paymentIntentId || typeof stripe?.paymentIntents?.retrieve !== 'function') return null
  return stripe.paymentIntents.retrieve(paymentIntentId)
}

async function markPaymentAttemptReconciled(pool, attemptId) {
  await pool.query(
    `UPDATE billing_payment_attempt
        SET last_reconciled_at = now()
      WHERE id = $1
        AND status IN ('pending', 'processing', 'reconciliation_required')`,
    [Number(attemptId)],
  )
}

/**
 * Reconcile every durable remote reservation, regardless of its original
 * request age. Missing object IDs are recovered by metadata search where the
 * Stripe API supports it; an inconclusive search always retains ownership.
 */
export async function reconcileActiveBillingPaymentAttempts(pool, stripe, {
  limit = 100,
  attachFunction = attachBillingPaymentAttemptStripeObject,
  settleFunction = recordAndCompleteBillingPaymentAttempt,
  releaseFunction = releaseBillingPaymentAttempt,
} = {}) {
  const boundedLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 100)))
  const attempts = await pool.query(
    `SELECT attempt.*, account.stripe_customer_id
       FROM billing_payment_attempt attempt
       JOIN family_billing_account account ON account.id = attempt.family_billing_account_id
      WHERE attempt.status IN ('pending', 'processing', 'reconciliation_required')
      ORDER BY attempt.last_reconciled_at NULLS FIRST, attempt.id
      LIMIT $1`,
    [boundedLimit],
  ).then((result) => result.rows)
  const summary = {
    checked: attempts.length,
    settled: 0,
    released: 0,
    retained: 0,
    recovered: 0,
    conflicted: 0,
    ambiguities: [],
    errors: [],
  }

  for (const attempt of attempts) {
    try {
      let remote = null
      if (attempt.stripe_checkout_session_id) {
        remote = await stripe.checkout.sessions.retrieve(
          attempt.stripe_checkout_session_id,
          { expand: ['payment_intent'] },
        )
      } else if (attempt.stripe_payment_intent_id) {
        remote = await stripe.paymentIntents.retrieve(attempt.stripe_payment_intent_id)
      } else {
        remote = await findUnattachedStripeObject(stripe, attempt)
        if (remote) summary.recovered += 1
      }

      if (!remote) {
        summary.retained += 1
        if (!attempt.stripe_checkout_session_id && !attempt.stripe_payment_intent_id) {
          summary.ambiguities.push({
            attemptId: Number(attempt.id),
            message: 'No Stripe object ID was attached and metadata recovery found no conclusive remote object; reservation retained.',
          })
        }
        continue
      }

      const isCheckout = String(remote.object ?? '') === 'checkout.session'
        || String(remote.id ?? '').startsWith('cs_')
      if (isCheckout) {
        const intent = await checkoutPaymentIntent(stripe, remote)
        if (
          !attempt.stripe_checkout_session_id
          || (intent?.id && !attempt.stripe_payment_intent_id)
        ) {
          await attachFunction(pool, {
            attemptId: attempt.id,
            checkoutSessionId: remote.id,
            checkoutUrl: remote.url ?? null,
            paymentIntentId: intent?.id ?? null,
            status: intent?.status === 'succeeded' || remote.payment_status === 'paid'
              ? 'processing'
              : 'pending',
            expiresAt: remote.expires_at ? new Date(Number(remote.expires_at) * 1000) : null,
          })
        }
        if (intent?.status === 'succeeded' || remote.payment_status === 'paid') {
          if (!intent?.id) throw new Error('Paid Checkout Session has no retrievable PaymentIntent.')
          const settlement = await settleFunction(pool, {
            stripeObject: remote,
            paymentIntentId: intent.id,
            amountCents: intent.amount_received || intent.amount,
            customerId: stripeObjectId(intent.customer) ?? stripeObjectId(remote.customer),
          })
          summary.settled += settlement ? 1 : 0
          summary.conflicted += settlement?.conflicted ? 1 : 0
          continue
        }
        if (remote.status === 'expired') {
          await releaseFunction(pool, {
            attemptId: attempt.id,
            stripeObject: remote,
            status: 'expired',
            reason: 'Stripe Checkout Session is expired and has no successful payment.',
            checkoutTerminal: true,
          })
          summary.released += 1
          continue
        }
        await attachFunction(pool, {
          attemptId: attempt.id,
          checkoutSessionId: remote.id,
          checkoutUrl: remote.url ?? null,
          paymentIntentId: intent?.id ?? null,
          status: 'pending',
          expiresAt: remote.expires_at ? new Date(Number(remote.expires_at) * 1000) : null,
        })
        summary.retained += 1
        continue
      }

      if (remote.status === 'succeeded') {
        if (!attempt.stripe_payment_intent_id) {
          await attachFunction(pool, {
            attemptId: attempt.id,
            paymentIntentId: remote.id,
            status: 'processing',
          })
        }
        const settlement = await settleFunction(pool, {
          stripeObject: remote,
          paymentIntentId: remote.id,
          amountCents: remote.amount_received || remote.amount,
          customerId: stripeObjectId(remote.customer),
        })
        summary.settled += settlement ? 1 : 0
        summary.conflicted += settlement?.conflicted ? 1 : 0
      } else if (remote.status === 'canceled') {
        if (!attempt.stripe_payment_intent_id) {
          await attachFunction(pool, {
            attemptId: attempt.id,
            paymentIntentId: remote.id,
            status: 'reconciliation_required',
          })
        }
        await releaseFunction(pool, {
          attemptId: attempt.id,
          stripeObject: remote,
          status: 'canceled',
          reason: 'Stripe PaymentIntent cancellation was verified during reconciliation.',
        })
        summary.released += 1
      } else {
        await attachFunction(pool, {
          attemptId: attempt.id,
          paymentIntentId: remote.id,
          status: 'reconciliation_required',
        })
        summary.retained += 1
      }
    } catch (error) {
      summary.retained += 1
      summary.errors.push({
        attemptId: Number(attempt.id),
        message: String(error?.message ?? error).slice(0, 500),
      })
    } finally {
      await markPaymentAttemptReconciled(pool, attempt.id).catch(() => {})
    }
  }
  return summary
}
