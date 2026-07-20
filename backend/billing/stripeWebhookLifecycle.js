import { ensureBillingStripeLinksSchema } from './stripeBilling.js'
import { ensureBillingRecurringSchema } from './stripeCatalogSync.js'

function objectId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

export function invoiceSubscriptionId(invoice) {
  return (
    objectId(invoice?.subscription) ||
    objectId(invoice?.parent?.subscription_details?.subscription) ||
    null
  )
}

export function invoicePaymentIntentId(invoice) {
  const direct = objectId(invoice?.payment_intent)
  if (direct) return direct
  for (const invoicePayment of invoice?.payments?.data ?? []) {
    const payment = invoicePayment?.payment
    const id = objectId(payment?.payment_intent) ||
      (payment?.type === 'payment_intent' ? objectId(payment?.payment_intent) : null)
    if (id) return id
  }
  return null
}

async function resolveAccountId(pool, object) {
  const metadataId = Number(object?.metadata?.familyBillingAccountId)
  if (Number.isFinite(metadataId) && metadataId > 0) return metadataId

  const customerId = objectId(object?.customer)
  if (!customerId) return null
  const result = await pool.query(
    `SELECT id FROM family_billing_account WHERE stripe_customer_id = $1 LIMIT 1`,
    [customerId],
  )
  return result.rows[0]?.id ? Number(result.rows[0].id) : null
}

/** Idempotently mirror a paid Stripe renewal invoice into the Vortex ledger. */
export async function recordPaidStripeInvoice(pool, invoice) {
  if (!invoice?.id || invoice.paid === false || invoice.status === 'void') return null
  const accountId = await resolveAccountId(pool, invoice)
  if (!accountId) return null

  await ensureBillingStripeLinksSchema(pool)
  const paymentIntentId = invoicePaymentIntentId(invoice)
  const amountCents = Math.round(Number(invoice.amount_paid ?? invoice.amount_due) || 0)
  if (amountCents <= 0) return null

  const result = await pool.query(
    `
      INSERT INTO billing_payment
        (family_billing_account_id, amount_cents, paid_at, method, note,
         external_processor, external_reference, external_status,
         stripe_customer_id, stripe_payment_intent_id, stripe_invoice_id)
      VALUES ($1, $2, $3, 'card', 'Stripe subscription renewal',
              'stripe', $4, 'settled', $5, $6, $4)
      ON CONFLICT DO NOTHING
      RETURNING *
    `,
    [
      accountId,
      amountCents,
      invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : new Date(),
      invoice.id,
      objectId(invoice.customer),
      paymentIntentId,
    ],
  )
  const payment = result.rows[0] ?? null
  if (payment) payment.newly_inserted = true
  return payment
}

/** Mirror Stripe lifecycle status without cancelling service on a transient decline. */
export async function syncStripeSubscriptionStatus(pool, subscription, eventType) {
  if (!subscription?.id) return { updated: 0, status: null }
  await ensureBillingRecurringSchema(pool)

  const stripeStatus = String(subscription.status ?? '')
  let localStatus = null
  if (eventType === 'customer.subscription.deleted' || stripeStatus === 'canceled') {
    localStatus = 'cancelled'
  } else if (stripeStatus === 'paused') {
    localStatus = 'paused'
  } else if (['active', 'trialing'].includes(stripeStatus)) {
    localStatus = 'active'
  }
  if (!localStatus) return { updated: 0, status: null }

  const endAt = subscription.ended_at || subscription.cancel_at || null
  const result = await pool.query(
    `
      UPDATE billing_subscription
      SET status = $2,
          end_date = CASE
            WHEN $2 = 'cancelled' THEN COALESCE(to_timestamp($3)::date, CURRENT_DATE)
            ELSE NULL
          END,
          next_bill_date = CASE WHEN $2 = 'cancelled' THEN NULL ELSE next_bill_date END,
          updated_at = now()
      WHERE stripe_subscription_id = $1
    `,
    [subscription.id, localStatus, endAt],
  )
  return { updated: result.rowCount ?? 0, status: localStatus }
}

export async function resolveStripeWebhookAccountId(pool, object) {
  return resolveAccountId(pool, object)
}
