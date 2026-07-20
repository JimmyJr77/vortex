import { sendEmail } from '../email/sendEmail.js'
import { getStripeClient, stripeEnabled } from './stripeBilling.js'

let schemaEnsured = false

export async function ensureStripeOperationsSchema(pool) {
  if (schemaEnsured) return
  const fs = await import('fs')
  const migrationPath = new URL('../migrations/230_stripe_operations.sql', import.meta.url)
  await pool.query(fs.readFileSync(migrationPath, 'utf8'))
  schemaEnsured = true
}

export async function beginStripeWebhookEvent(pool, event) {
  if (!event?.id) return { replayed: false }
  await ensureStripeOperationsSchema(pool)
  const inserted = await pool.query(
    `
      INSERT INTO stripe_webhook_event (event_id, event_type)
      VALUES ($1, $2)
      ON CONFLICT (event_id) DO NOTHING
      RETURNING status, attempts
    `,
    [event.id, event.type ?? 'unknown'],
  )
  if (inserted.rows[0]) return { replayed: false, attempts: 1 }

  const existing = await pool.query(
    `SELECT status, attempts FROM stripe_webhook_event WHERE event_id = $1`,
    [event.id],
  )
  if (existing.rows[0]?.status !== 'failed') {
    return { replayed: true, attempts: Number(existing.rows[0]?.attempts ?? 1) }
  }
  const retry = await pool.query(
    `UPDATE stripe_webhook_event SET status = 'processing', attempts = attempts + 1,
     last_error = NULL, updated_at = now() WHERE event_id = $1 AND status = 'failed'
     RETURNING attempts`,
    [event.id],
  )
  return { replayed: !retry.rows[0], attempts: Number(retry.rows[0]?.attempts ?? existing.rows[0]?.attempts ?? 1) }
}

export async function completeStripeWebhookEvent(pool, event) {
  if (!event?.id) return
  await pool.query(
    `UPDATE stripe_webhook_event SET status = 'processed', processed_at = now(), last_error = NULL, updated_at = now() WHERE event_id = $1`,
    [event.id],
  )
}

export async function failStripeWebhookEvent(pool, event, error) {
  if (!event?.id) return
  await pool.query(
    `UPDATE stripe_webhook_event SET status = 'failed', last_error = $2, updated_at = now() WHERE event_id = $1`,
    [event.id, String(error?.message ?? error).slice(0, 1000)],
  ).catch(() => {})
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

export async function createBillingRefund(pool, {
  accountId,
  paymentId = null,
  amountCents,
  reason = null,
  externalReference = null,
  createdByUserId = null,
}) {
  await ensureStripeOperationsSchema(pool)
  const amount = Math.round(Number(amountCents) || 0)
  if (amount <= 0) throw new Error('Refund amount must be positive.')

  let payment = null
  if (paymentId != null) {
    const paymentResult = await pool.query(
      `SELECT * FROM billing_payment WHERE id = $1 AND family_billing_account_id = $2`,
      [paymentId, accountId],
    )
    payment = paymentResult.rows[0] ?? null
    if (!payment) throw new Error('Related payment was not found for this family.')
    const refunded = await pool.query(
      `SELECT COALESCE(SUM(amount_cents), 0)::int AS cents FROM billing_refund
       WHERE payment_id = $1 AND external_status IN ('pending', 'succeeded')`,
      [paymentId],
    )
    if (Number(refunded.rows[0]?.cents ?? 0) + amount > Number(payment.amount_cents ?? 0)) {
      throw new Error('Refund exceeds the remaining refundable payment amount.')
    }
  }

  const usesStripe = Boolean(payment?.stripe_payment_intent_id && stripeEnabled())
  const inserted = await pool.query(
    `
      INSERT INTO billing_refund
        (family_billing_account_id, payment_id, amount_cents, reason, external_reference,
         external_status, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [accountId, paymentId, amount, reason, externalReference, usesStripe ? 'pending' : 'succeeded', createdByUserId],
  )
  const row = inserted.rows[0]
  if (!usesStripe) return row

  try {
    const stripe = await getStripeClient()
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
    const updated = await pool.query(
      `UPDATE billing_refund
       SET stripe_refund_id = $2, external_reference = $2, external_status = $3,
           error_message = NULL, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [row.id, refund.id, refund.status === 'failed' ? 'failed' : 'succeeded'],
    )
    return updated.rows[0]
  } catch (error) {
    await pool.query(
      `UPDATE billing_refund SET external_status = 'failed', error_message = $2, updated_at = now() WHERE id = $1`,
      [row.id, String(error?.message ?? error).slice(0, 1000)],
    )
    throw error
  }
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
  const status = refund.status === 'failed' || refund.status === 'canceled' ? 'failed' : 'succeeded'
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
      JSON.stringify({ status: object?.status ?? null, reason: object?.reason ?? null, amount: object?.amount ?? object?.amount_due ?? null })],
  )
  const alert = inserted.rows[0] ?? null
  const to = process.env.BILLING_ALERT_EMAIL || process.env.SMTP_REPLY_TO || process.env.SMTP_USER
  if (alert && to) {
    await sendEmail({
      to,
      subject: `[Vortex billing] ${message}`,
      text: `${message}\nStripe object: ${object?.id ?? 'unknown'}\nAccount: ${accountId ?? 'unresolved'}`,
      html: `<p><strong>${message}</strong></p><p>Stripe object: ${object?.id ?? 'unknown'}<br>Family billing account: ${accountId ?? 'unresolved'}</p>`,
      idempotencyKey: `stripe-alert-${event?.id ?? object?.id}`,
      skipPolicy: true,
    }).catch((error) => console.warn('[stripe] billing alert email:', error?.message ?? error))
  }
  return alert
}
