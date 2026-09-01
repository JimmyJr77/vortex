import crypto from 'node:crypto'

import { publicAppUrl } from '../email/publicAppUrl.js'
import { notifyPaymentReceipt, notifyRefundReceipt } from '../email/memberNotifications.js'
import { beginBillingAdminAction, finishBillingAdminAction } from './billingAdminActions.js'
import { recordBillingActivityBestEffort } from './billingActivity.js'
import { allocateHouseholdPayments } from './paymentAllocation.js'
import { canonicalActiveHouseholdMemberPredicate } from './householdMembership.js'
import { requireAdminFacilityScope } from './adminFacilityScope.js'
import { withHouseholdMonthlyInvoiceAccountLock } from './householdMonthlyInvoice.js'

function optionalText(value) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function requiredRequestKey(value) {
  const requestKey = String(value ?? '').trim()
  if (!requestKey) throw new Error('An idempotency key is required.')
  return requestKey
}

/**
 * Keep persisted/provider idempotency keys bounded and server-owned. The
 * client key remains in activity details for support, while the digest binds
 * it to exactly one account and, when applicable, one related resource.
 */
export function adminBillingIdempotencyScopeKey({
  operation,
  accountId,
  resourceType = null,
  resourceId = null,
  requestKey,
}) {
  const normalizedOperation = String(operation ?? '').trim()
  const normalizedAccountId = Number(accountId)
  const normalizedResourceType = resourceType == null ? null : String(resourceType).trim()
  const normalizedResourceId = resourceId == null ? null : Number(resourceId)
  if (!normalizedOperation) throw new Error('An idempotency operation is required.')
  if (!Number.isSafeInteger(normalizedAccountId) || normalizedAccountId <= 0) {
    throw new Error('A billing account is required for idempotency.')
  }
  if (
    (normalizedResourceType == null) !== (normalizedResourceId == null)
    || (normalizedResourceId != null && (!Number.isSafeInteger(normalizedResourceId) || normalizedResourceId <= 0))
  ) {
    throw new Error('A complete billing resource scope is required for idempotency.')
  }
  const digest = crypto.createHash('sha256').update(JSON.stringify({
    operation: normalizedOperation,
    accountId: normalizedAccountId,
    resourceType: normalizedResourceType,
    resourceId: normalizedResourceId,
    requestKey: requiredRequestKey(requestKey),
  })).digest('hex')
  return `${normalizedOperation}:v2:${digest}`
}

function accountDto(row) {
  return {
    id: Number(row.id),
    familyId: Number(row.family_id),
    familyName: row.family_name ?? null,
    payerMemberId: row.payer_member_id == null ? null : Number(row.payer_member_id),
    billingEmail: row.billing_email ?? null,
    billingPhone: row.billing_phone ?? null,
    billingStreet: row.billing_street ?? null,
    billingCity: row.billing_city ?? null,
    billingState: row.billing_state ?? null,
    billingZip: row.billing_zip ?? null,
    stripeCustomerId: row.stripe_customer_id ?? null,
    householdMonthlyBillingEnabled: row.household_monthly_billing_enabled === true,
    isActive: row.is_active !== false,
    revision: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function paymentDto(row) {
  return {
    id: Number(row.id),
    amountCents: Number(row.amount_cents ?? 0),
    paidAt: row.paid_at,
    method: row.method ?? null,
    note: row.note ?? null,
    externalProcessor: row.external_processor ?? null,
    externalReference: row.external_reference ?? null,
    externalStatus: row.external_status ?? null,
    requestKey: row.request_key ?? null,
  }
}

export async function loadAdminCustomerBillingAccount(pool, familyId, facilityId = null) {
  const scopedFacilityId = requireAdminFacilityScope({ facilityId })
  const result = await pool.query(
    `SELECT account.*, family.family_name
       FROM family
       LEFT JOIN family_billing_account account ON account.family_id = family.id
      WHERE family.id = $1
        AND ($2::bigint IS NULL OR family.facility_id = $2)`,
    [Number(familyId), scopedFacilityId],
  )
  const row = result.rows[0]
  if (!row || row.id == null) return null
  return row
}

export async function updateAdminCustomerBillingAccount(pool, {
  familyId,
  facilityId = null,
  actorUserId = null,
  input = {},
}) {
  const scopedFacilityId = requireAdminFacilityScope({ facilityId })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const family = (
      await client.query(
        `SELECT id, family_name
           FROM family
          WHERE id = $1 AND ($2::bigint IS NULL OR facility_id = $2)
          FOR SHARE`,
        [Number(familyId), scopedFacilityId],
      )
    ).rows[0]
    if (!family) throw new Error('Family billing account was not found.')

    await client.query('SELECT pg_advisory_xact_lock($1)', [Number(familyId)])
    let before = (
      await client.query(
        `SELECT account.*, $2::text AS family_name
           FROM family_billing_account account
          WHERE account.family_id = $1
          FOR UPDATE`,
        [Number(familyId), family.family_name],
      )
    ).rows[0] ?? null

    if (!before) {
      before = (
        await client.query(
          `INSERT INTO family_billing_account (family_id, payer_member_id, is_active)
           VALUES ($1, NULL, TRUE)
           RETURNING *, $2::text AS family_name`,
          [Number(familyId), family.family_name],
        )
      ).rows[0]
    }

    const has = (key) => Object.prototype.hasOwnProperty.call(input, key)
    const payerMemberId = has('payerMemberId')
      ? (input.payerMemberId == null || input.payerMemberId === '' ? null : Number(input.payerMemberId))
      : (before.payer_member_id == null ? null : Number(before.payer_member_id))
    if (payerMemberId != null) {
      const payer = (
        await client.query(
          `SELECT member.id
             FROM member
            WHERE member.id = $1
              AND member.is_active = TRUE
              AND ${canonicalActiveHouseholdMemberPredicate({
                memberAlias: 'member',
                familyIdReference: '$2',
                membershipAlias: 'payer_membership',
                historyAlias: 'payer_membership_history',
              })}`,
          [payerMemberId, Number(familyId)],
        )
      ).rows[0]
      if (!payer) throw new Error('Payer must be an active member of this family.')
    }

    const updated = (
      await client.query(
        `UPDATE family_billing_account
            SET payer_member_id = $2,
                billing_email = $3,
                billing_phone = $4,
                billing_street = $5,
                billing_city = $6,
                billing_state = $7,
                billing_zip = $8,
                is_active = COALESCE($9, is_active),
                updated_at = now()
          WHERE family_id = $1
          RETURNING *, $10::text AS family_name`,
        [
          Number(familyId),
          payerMemberId,
          has('billingEmail') ? optionalText(input.billingEmail) : before.billing_email,
          has('billingPhone') ? optionalText(input.billingPhone) : before.billing_phone,
          has('billingStreet') ? optionalText(input.billingStreet) : before.billing_street,
          has('billingCity') ? optionalText(input.billingCity) : before.billing_city,
          has('billingState') ? optionalText(input.billingState) : before.billing_state,
          has('billingZip') ? optionalText(input.billingZip) : before.billing_zip,
          typeof input.isActive === 'boolean' ? input.isActive : before.is_active,
          family.family_name,
        ],
      )
    ).rows[0]

    await recordBillingActivityBestEffort(client, {
      eventKey: `billing-contact-updated:${updated.id}:${new Date(updated.updated_at).getTime()}`,
      accountId: Number(updated.id),
      eventType: 'billing_contact_updated',
      summary: 'Household billing contact was updated.',
      beforeValue: accountDto(before),
      afterValue: accountDto(updated),
      actorUserId,
      actorType: 'admin',
    })
    await client.query('COMMIT')
    return accountDto(updated)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

export async function loadAdminCustomerBillingMigrationStatus(pool, {
  familyId,
  facilityId = null,
}) {
  const scopedFacilityId = requireAdminFacilityScope({ facilityId })
  const result = await pool.query(
    `SELECT account.id AS account_id,
            migration.id AS migration_id,
            migration.state,
            migration.parity_status,
            migration.parity_snapshot,
            migration.cutover_month,
            migration.attempt_count,
            migration.last_error,
            migration.updated_at AS migration_updated_at,
            run.id AS run_id,
            run.migration_key,
            run.mode AS run_mode,
            run.status AS run_status,
            run.code_version,
            run.manifest_checksum,
            run.configuration AS run_configuration
       FROM family
       JOIN family_billing_account account ON account.family_id = family.id
       LEFT JOIN LATERAL (
         SELECT candidate.*
           FROM billing_account_migration candidate
          WHERE candidate.family_billing_account_id = account.id
          ORDER BY candidate.created_at DESC, candidate.id DESC
          LIMIT 1
       ) migration ON TRUE
       LEFT JOIN billing_migration_run run
         ON run.id = migration.billing_migration_run_id
      WHERE family.id = $1
        AND ($2::bigint IS NULL OR family.facility_id = $2)`,
    [Number(familyId), scopedFacilityId],
  )
  const row = result.rows[0]
  if (!row) return null
  if (row.migration_id == null) {
    return {
      accountId: Number(row.account_id),
      state: 'not_started',
      parityStatus: 'not_applicable',
      parity: {},
      targetMonth: null,
      attempts: 0,
      lastError: null,
      updatedAt: null,
      run: null,
      exceptions: [],
    }
  }

  const exceptions = (
    await pool.query(
      `SELECT id, exception_type, severity, status, message, details,
              resolution_note, detected_at, resolved_at
         FROM billing_migration_exception
        WHERE billing_account_migration_id = $1
        ORDER BY
          CASE severity WHEN 'critical' THEN 0 WHEN 'blocking' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
          detected_at DESC,
          id DESC
        LIMIT 50`,
      [Number(row.migration_id)],
    )
  ).rows.map((exception) => ({
    id: Number(exception.id),
    type: exception.exception_type,
    severity: exception.severity,
    status: exception.status,
    message: exception.message,
    details: exception.details ?? {},
    resolutionNote: exception.resolution_note ?? null,
    detectedAt: exception.detected_at,
    resolvedAt: exception.resolved_at ?? null,
  }))

  return {
    accountId: Number(row.account_id),
    migrationId: Number(row.migration_id),
    state: row.state,
    parityStatus: row.parity_status,
    parity: row.parity_snapshot ?? {},
    targetMonth: row.cutover_month ?? null,
    attempts: Number(row.attempt_count ?? 0),
    lastError: row.last_error ?? null,
    updatedAt: row.migration_updated_at ?? null,
    run: {
      id: Number(row.run_id),
      key: row.migration_key,
      mode: row.run_mode,
      status: row.run_status,
      codeVersion: row.code_version ?? null,
      manifestChecksum: row.manifest_checksum ?? null,
      configuration: row.run_configuration ?? {},
    },
    exceptions,
  }
}

export async function loadScopedAdminReceiptReplay(pool, {
  operation,
  accountId,
  resourceType,
  resourceId,
  requestKey,
}) {
  if (!['payment', 'refund'].includes(resourceType)) {
    throw new Error('Receipt replay resource type is invalid.')
  }
  const scopedKey = adminBillingIdempotencyScopeKey({
    operation,
    accountId,
    resourceType,
    resourceId,
    requestKey,
  })
  const scopedEventKey = `${operation}:${scopedKey}`
  // Compatibility: releases before scoped keys used the client key directly.
  // It is safe to accept that row only when its account and related resource
  // also match this request.
  const legacyEventKey = `${operation}:${requiredRequestKey(requestKey)}`
  const resourceColumn = resourceType === 'payment' ? 'payment_id' : 'refund_id'
  const existing = await pool.query(
    `SELECT details, event_key
       FROM billing_account_activity
      WHERE family_billing_account_id = $1
        AND ${resourceColumn} = $2
        AND event_key = ANY($3::text[])
      ORDER BY CASE WHEN event_key = $4 THEN 0 ELSE 1 END
      LIMIT 1`,
    [Number(accountId), Number(resourceId), [scopedEventKey, legacyEventKey], scopedEventKey],
  )
  return {
    eventKey: scopedEventKey,
    providerIdempotencyKey: `admin-${scopedKey}`,
    replay: existing.rows[0]
      ? {
          replayed: true,
          recipientEmail: existing.rows[0].details?.recipientEmail ?? null,
        }
      : null,
  }
}

export async function resendAdminPaymentReceipt(pool, {
  familyId,
  facilityId = null,
  paymentId,
  actorUserId = null,
  requestKey,
}) {
  const account = await loadAdminCustomerBillingAccount(pool, familyId, facilityId)
  if (!account) throw new Error('Family billing account was not found.')
  return withHouseholdMonthlyInvoiceAccountLock(pool, account.id, async (client) => {
    const payment = (
      await client.query(
      `SELECT * FROM billing_payment
        WHERE id = $1 AND family_billing_account_id = $2`,
        [Number(paymentId), Number(account.id)],
      )
    ).rows[0]
    if (!payment) throw new Error('Payment was not found.')
    const replayState = await loadScopedAdminReceiptReplay(client, {
      operation: 'payment-receipt-resent',
      accountId: account.id,
      resourceType: 'payment',
      resourceId: payment.id,
      requestKey,
    })
    if (replayState.replay) return replayState.replay

    const action = await beginBillingAdminAction(client, {
      accountId: account.id,
      actionType: 'payment_receipt_resent',
      amountCents: Number(payment.amount_cents),
      paymentId: payment.id,
      initiatedByUserId: actorUserId,
      details: { requestKey, scopedEventKey: replayState.eventKey },
    })
    try {
      const delivery = await notifyPaymentReceipt(client, {
        account,
        payment,
        billingUrl: `${publicAppUrl()}/?billing=portal-return`,
        bestEffort: false,
        idempotencyKey: replayState.providerIdempotencyKey,
      })
      if (!delivery.sent) throw new Error(delivery.reason || 'No billing recipient was available.')
      await finishBillingAdminAction(client, action.id, {
        status: 'succeeded',
        recipientEmail: delivery.email,
        details: { recipientEmail: delivery.email, requestKey, scopedEventKey: replayState.eventKey },
      })
      await recordBillingActivityBestEffort(client, {
        eventKey: replayState.eventKey,
        accountId: account.id,
        paymentId: payment.id,
        eventType: 'payment_receipt_resent',
        summary: `Payment #${payment.id} receipt was resent.`,
        details: { recipientEmail: delivery.email, requestKey },
        actorUserId,
        actorType: 'admin',
      })
      return { replayed: false, recipientEmail: delivery.email }
    } catch (error) {
      await finishBillingAdminAction(client, action.id, {
        status: 'failed',
        errorMessage: String(error?.message ?? error).slice(0, 1000),
        details: { requestKey, scopedEventKey: replayState.eventKey },
      }).catch(() => {})
      throw error
    }
  })
}

export async function resendAdminRefundReceipt(pool, {
  familyId,
  facilityId = null,
  refundId,
  actorUserId = null,
  requestKey,
}) {
  const account = await loadAdminCustomerBillingAccount(pool, familyId, facilityId)
  if (!account) throw new Error('Family billing account was not found.')
  return withHouseholdMonthlyInvoiceAccountLock(pool, account.id, async (client) => {
    const refund = (
      await client.query(
      `SELECT * FROM billing_refund
        WHERE id = $1 AND family_billing_account_id = $2`,
        [Number(refundId), Number(account.id)],
      )
    ).rows[0]
    if (!refund) throw new Error('Refund was not found.')
    if (refund.external_status !== 'succeeded') throw new Error('Only completed refunds can receive a receipt.')
    const replayState = await loadScopedAdminReceiptReplay(client, {
      operation: 'refund-receipt-resent',
      accountId: account.id,
      resourceType: 'refund',
      resourceId: refund.id,
      requestKey,
    })
    if (replayState.replay) return replayState.replay

    const action = await beginBillingAdminAction(client, {
      accountId: account.id,
      actionType: 'refund_receipt_resent',
      amountCents: Number(refund.amount_cents),
      refundId: refund.id,
      initiatedByUserId: actorUserId,
      details: { requestKey, scopedEventKey: replayState.eventKey },
    })
    try {
      const delivery = await notifyRefundReceipt(client, {
        account,
        refund,
        billingUrl: `${publicAppUrl()}/?billing=portal-return`,
        bestEffort: false,
        idempotencyKey: replayState.providerIdempotencyKey,
      })
      if (!delivery.sent) throw new Error(delivery.reason || 'No billing recipient was available.')
      await finishBillingAdminAction(client, action.id, {
        status: 'succeeded',
        recipientEmail: delivery.email,
        details: { recipientEmail: delivery.email, requestKey, scopedEventKey: replayState.eventKey },
      })
      await recordBillingActivityBestEffort(client, {
        eventKey: replayState.eventKey,
        accountId: account.id,
        refundId: refund.id,
        eventType: 'refund_receipt_resent',
        summary: `Refund #${refund.id} receipt was resent.`,
        details: { recipientEmail: delivery.email, requestKey },
        actorUserId,
        actorType: 'admin',
      })
      return { replayed: false, recipientEmail: delivery.email }
    } catch (error) {
      await finishBillingAdminAction(client, action.id, {
        status: 'failed',
        errorMessage: String(error?.message ?? error).slice(0, 1000),
        details: { requestKey, scopedEventKey: replayState.eventKey },
      }).catch(() => {})
      throw error
    }
  })
}

const MANUAL_PAYMENT_METHODS = new Set(['cash', 'check', 'bank_transfer', 'other'])

function idempotencyConflict(message) {
  const error = new Error(message)
  error.code = 'IDEMPOTENCY_CONFLICT'
  error.statusCode = 409
  return error
}

const SETTLED_MANUAL_PAYMENT_STATUSES = new Set([
  'settled',
  'succeeded',
])

function sameTimestamp(left, right) {
  const leftTime = new Date(left).getTime()
  const rightTime = new Date(right).getTime()
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime
}

export function assertAdminExternalPaymentReplayMatches(payment, {
  amountCents,
  method,
  paidAt = null,
  note = null,
  externalReference = null,
}) {
  const mismatches = []
  if (Number(payment?.amount_cents) !== Number(amountCents)) mismatches.push('amount')
  if (String(payment?.method ?? '').trim().toLowerCase() !== String(method ?? '').trim().toLowerCase()) {
    mismatches.push('method')
  }
  if (optionalText(payment?.note) !== optionalText(note)) mismatches.push('note')
  if (optionalText(payment?.external_reference) !== optionalText(externalReference)) {
    mismatches.push('external reference')
  }
  if (paidAt != null && !sameTimestamp(payment?.paid_at, paidAt)) mismatches.push('paid timestamp')
  if (String(payment?.external_processor ?? '') !== 'manual_admin') mismatches.push('payment source')
  if (!SETTLED_MANUAL_PAYMENT_STATUSES.has(String(payment?.external_status ?? '').toLowerCase())) {
    mismatches.push('settlement status')
  }
  if (mismatches.length > 0) {
    throw idempotencyConflict(
      `External payment idempotency key was reused with different payment details: ${mismatches.join(', ')}.`,
    )
  }
  return payment
}

function passAdjustmentFingerprint({ accountId, passId, memberId, delta, reason }) {
  return crypto.createHash('sha256').update(JSON.stringify({
    accountId: Number(accountId),
    passId: Number(passId),
    memberId: Number(memberId),
    delta: Number(delta),
    reason,
  })).digest('hex')
}

export async function recordAdminExternalPayment(pool, {
  familyId,
  facilityId = null,
  actorUserId = null,
  requestKey,
  input = {},
}) {
  const amountCents = Number(input.amountCents)
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('amountCents must be a positive integer.')
  }
  const method = String(input.method ?? '').trim().toLowerCase()
  if (!MANUAL_PAYMENT_METHODS.has(method)) {
    throw new Error('method must be cash, check, bank_transfer, or other.')
  }
  const explicitPaidAt = input.paidAt == null || input.paidAt === '' ? null : new Date(input.paidAt)
  const paidAt = explicitPaidAt ?? new Date()
  if (Number.isNaN(paidAt.getTime())) throw new Error('paidAt must be a valid timestamp.')
  const note = optionalText(input.note)
  const externalReference = optionalText(input.externalReference)

  const account = await loadAdminCustomerBillingAccount(pool, familyId, facilityId)
  if (!account) throw new Error('Family billing account was not found.')
  const scopedRequestKey = adminBillingIdempotencyScopeKey({
    operation: 'external-payment',
    accountId: account.id,
    requestKey,
  })
  let payment
  let replayed = false
  await withHouseholdMonthlyInvoiceAccountLock(pool, account.id, async (client) => {
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock($1)', [Number(account.id)])
      payment = (
        await client.query(
          `SELECT * FROM billing_payment
            WHERE family_billing_account_id = $1
              AND request_key = ANY($2::text[])
            ORDER BY CASE WHEN request_key = $3 THEN 0 ELSE 1 END
            LIMIT 1`,
          [Number(account.id), [scopedRequestKey, requiredRequestKey(requestKey)], scopedRequestKey],
        )
      ).rows[0]
      if (payment) {
        assertAdminExternalPaymentReplayMatches(payment, {
          amountCents,
          method,
          paidAt: explicitPaidAt,
          note,
          externalReference,
        })
        replayed = true
      } else {
        const activeOwner = await client.query(
          `SELECT owner_kind, owner_id, owner_status
             FROM (
               SELECT 'payment_attempt'::text AS owner_kind,
                      attempt.id AS owner_id,
                      attempt.status AS owner_status
                 FROM billing_payment_attempt attempt
                 JOIN billing_payment_attempt_charge reservation
                   ON reservation.billing_payment_attempt_id = attempt.id
                WHERE attempt.family_billing_account_id = $1
                  AND (
                    attempt.status IN ('pending', 'processing', 'reconciliation_required')
                    OR (attempt.status = 'reserved' AND attempt.expires_at > now())
                  )
               UNION ALL
               SELECT 'monthly_invoice'::text AS owner_kind,
                      invoice.id AS owner_id,
                      invoice.status AS owner_status
                FROM billing_monthly_invoice invoice
                 JOIN billing_monthly_invoice_line line
                   ON line.billing_monthly_invoice_id = invoice.id
                WHERE invoice.family_billing_account_id = $1
                  AND invoice.status IN ('draft', 'open', 'failed', 'payment_method_required')
             ) owner
            ORDER BY owner_kind, owner_id
            LIMIT 1`,
          [Number(account.id)],
        ).then((result) => result.rows[0] ?? null)
        if (activeOwner) {
          const label = activeOwner.owner_kind === 'monthly_invoice'
            ? 'household monthly invoice'
            : 'remote payment attempt'
          throw new Error(
            `This account has an active ${label} (${activeOwner.owner_status}). Resolve or cancel that collector before recording a manual payment.`,
          )
        }
        payment = (
          await client.query(
            `INSERT INTO billing_payment (
               family_billing_account_id, amount_cents, paid_at, method, note,
               external_processor, external_reference, external_status,
               recorded_by_user_id, request_key
             ) VALUES ($1, $2, $3, $4, $5, 'manual_admin', $6, 'settled', $7, $8)
             RETURNING *`,
            [
              Number(account.id),
              amountCents,
              paidAt.toISOString(),
              method,
              note,
              externalReference,
              actorUserId,
              scopedRequestKey,
            ],
          )
        ).rows[0]
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    }

    await allocateHouseholdPayments(client, { accountId: account.id, actorType: 'admin' })
    await recordBillingActivityBestEffort(client, {
      eventKey: `manual-payment-recorded:${payment.id}`,
      accountId: account.id,
      paymentId: payment.id,
      eventType: 'manual_payment_recorded',
      summary: 'External or manual payment was recorded.',
      afterValue: paymentDto({ ...payment, request_key: requestKey }),
      details: { requestKey, scopedRequestKey },
      actorUserId,
      actorType: 'admin',
    })
  })
  if (!replayed) {
    notifyPaymentReceipt(pool, {
      account,
      payment,
      billingUrl: `${publicAppUrl()}/?billing=portal-return`,
      idempotencyKey: `manual-payment-receipt-${scopedRequestKey}`,
    }).catch(() => {})
  }
  return { payment: paymentDto({ ...payment, request_key: requestKey }), replayed }
}

export async function adjustAdminMultiClassPass(pool, {
  passId,
  facilityId = null,
  actorUserId = null,
  requestKey,
  input = {},
}) {
  const scopedFacilityId = requireAdminFacilityScope({ facilityId })
  const delta = Number(input.delta)
  if (!Number.isInteger(delta) || delta === 0) throw new Error('delta must be a non-zero integer.')
  const reason = optionalText(input.reason)
  if (!reason) throw new Error('A reason is required.')
  const normalizedRequestKey = optionalText(requestKey)
  if (!normalizedRequestKey) throw new Error('An idempotency key is required.')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [normalizedRequestKey])
    const activeHouseholdMember = canonicalActiveHouseholdMemberPredicate({
      memberAlias: 'member',
      familyIdReference: 'family.id',
    })
    const passRows = (
      await client.query(
        `SELECT pass.*, family.id AS family_id, account.id AS account_id
           FROM member_multi_class_pass pass
           JOIN member ON member.id = pass.member_id
           JOIN family
             ON ${activeHouseholdMember}
            AND family.archived = FALSE
           LEFT JOIN family_billing_account account
             ON account.family_id = family.id
            AND account.is_active = TRUE
          WHERE pass.id = $1
            AND family.facility_id = $2
          FOR UPDATE OF pass`,
        [Number(passId), scopedFacilityId],
      )
    ).rows
    if (passRows.length > 1) throw new Error('Multi-class pass household membership is ambiguous.')
    const pass = passRows[0]
    if (!pass) throw new Error('Multi-class pass was not found.')
    if (!pass.account_id) throw new Error('The pass family does not have a billing account.')
    await client.query('SELECT pg_advisory_xact_lock($1)', [Number(pass.account_id)])
    const fingerprint = passAdjustmentFingerprint({
      accountId: pass.account_id,
      passId: pass.id,
      memberId: pass.member_id,
      delta,
      reason,
    })

    const prior = (
      await client.query(
        `SELECT * FROM multi_class_pass_redemption
          WHERE request_key = $1
          LIMIT 1`,
        [normalizedRequestKey],
      )
    ).rows[0]
    if (prior) {
      const exactReplay = (
        Number(prior.member_pass_id) === Number(pass.id)
        && String(prior.entry_type ?? '') === 'adjust'
        && String(prior.idempotency_fingerprint ?? '') === fingerprint
      )
      if (!exactReplay) {
        throw idempotencyConflict(
          'This idempotency key was already used for a different pass adjustment request.',
        )
      }
      await client.query('COMMIT')
      return {
        passId: Number(pass.id),
        classesRemaining: Number(prior.classes_remaining_after),
        appliedDelta: Number(prior.credit_delta),
        replayed: true,
      }
    }

    const currentRemaining = Number(pass.classes_remaining ?? 0)
    const classesRemaining = Math.max(0, currentRemaining + delta)
    const appliedDelta = classesRemaining - currentRemaining
    if (appliedDelta === 0) throw new Error('The requested adjustment would not change the pass balance.')

    await client.query(
      `UPDATE member_multi_class_pass
          SET classes_remaining = $2,
              status = CASE WHEN $2 > 0 AND status IN ('expired', 'refunded') THEN 'active' ELSE status END,
              updated_at = now()
        WHERE id = $1`,
      [Number(pass.id), classesRemaining],
    )
    await client.query(
      `INSERT INTO multi_class_pass_redemption (
         member_pass_id, signup_id, member_id, programs_id, classes_used,
         classes_remaining_after, entry_type, credit_delta, reason, request_key,
         idempotency_fingerprint
       ) VALUES ($1, NULL, $2, $3, $4, $5, 'adjust', $6, $7, $8, $9)`,
      [
        Number(pass.id),
        Number(pass.member_id),
        pass.programs_id,
        Math.abs(appliedDelta),
        classesRemaining,
        appliedDelta,
        reason,
        normalizedRequestKey,
        fingerprint,
      ],
    )
    await recordBillingActivityBestEffort(client, {
      eventKey: `multi-class-pass-adjusted:${normalizedRequestKey}`,
      accountId: Number(pass.account_id),
      memberId: Number(pass.member_id),
      eventType: 'multi_class_pass_adjusted',
      summary: 'A multi-class pass balance was adjusted.',
      beforeValue: { classesRemaining: currentRemaining },
      afterValue: { classesRemaining, appliedDelta },
      details: { passId: Number(pass.id), reason, requestKey: normalizedRequestKey },
      actorUserId,
      actorType: 'admin',
    })
    await client.query('COMMIT')
    return { passId: Number(pass.id), classesRemaining, appliedDelta, replayed: false }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
