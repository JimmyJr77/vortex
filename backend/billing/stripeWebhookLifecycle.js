import { ensureBillingStripeLinksSchema, getStripeClient } from './stripeBilling.js'
import { ensureBillingRecurringSchema } from './stripeCatalogSync.js'
import { resolveStripePaymentMethodLabel } from './paymentMethodLabel.js'

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

function subscriptionPeriodEnd(subscription) {
  const trialEnd = Number(subscription?.trial_end)
  if (String(subscription?.status ?? '') === 'trialing' && trialEnd > 0) return trialEnd

  const directPeriodEnd = Number(subscription?.current_period_end)
  const itemPeriodEnds = (subscription?.items?.data ?? [])
    .map((item) => Number(item?.current_period_end))
    .filter((value) => value > 0)
  const periodEnd = Math.max(directPeriodEnd > 0 ? directPeriodEnd : 0, ...itemPeriodEnds)
  if (periodEnd > 0) return periodEnd
  return trialEnd > 0 ? trialEnd : null
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
export async function recordPaidStripeInvoice(pool, invoice, { stripe = null } = {}) {
  if (!invoice?.id || invoice.paid === false || invoice.status === 'void') return null
  const accountId = await resolveAccountId(pool, invoice)
  if (!accountId) return null

  await ensureBillingStripeLinksSchema(pool)
  const paymentIntentId = invoicePaymentIntentId(invoice)
  const subscriptionId = invoiceSubscriptionId(invoice)
  const amountCents = Math.round(Number(invoice.amount_paid ?? invoice.amount_due) || 0)
  if (amountCents <= 0) return null
  const paidAt = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : new Date()

  const stripeClient = stripe || (await getStripeClient())
  const method = await resolveStripePaymentMethodLabel(stripeClient, {
    paymentIntentId,
    invoice,
  })

  const result = await pool.query(
    `
      INSERT INTO billing_payment
        (family_billing_account_id, amount_cents, paid_at, method, note,
         external_processor, external_reference, external_status,
         stripe_customer_id, stripe_payment_intent_id, stripe_invoice_id,
         stripe_subscription_id)
      VALUES ($1, $2, $3, $4, 'Stripe subscription renewal',
              'stripe', $5, 'settled', $6, $7, $5, $8)
      ON CONFLICT DO NOTHING
      RETURNING *
    `,
    [
      accountId,
      amountCents,
      paidAt,
      method,
      invoice.id,
      objectId(invoice.customer),
      paymentIntentId,
      subscriptionId,
    ],
  )
  const payment = result.rows[0] ?? await pool.query(
    `SELECT * FROM billing_payment WHERE stripe_invoice_id = $1 LIMIT 1`,
    [invoice.id],
  ).then((lookup) => lookup.rows[0] ?? null)
  if (payment) {
    payment.newly_inserted = Boolean(result.rows[0])
    if (subscriptionId) {
      const annualSubscription = await pool.query(
        `SELECT * FROM billing_subscription
         WHERE stripe_subscription_id = $1
           AND (source_type = 'annual_membership' OR pricing_option_key = 'annual_membership')
         LIMIT 1`,
        [subscriptionId],
      ).then((lookup) => lookup.rows[0] ?? null)
      if (annualSubscription?.member_id) {
        const feeId = Number(String(annualSubscription.source_id || '').split(':')[0])
        const renewal = new Date(Date.UTC(
          paidAt.getUTCFullYear() + 1,
          paidAt.getUTCMonth(),
          paidAt.getUTCDate(),
        )).toISOString().slice(0, 10)
        if (Number.isFinite(feeId) && feeId > 0) {
          await pool.query(
            `INSERT INTO billing_charge (
               family_billing_account_id, member_id, source_type, source_id,
               description, amount_cents, gross_amount_cents, discount_amount_cents,
               charge_type, billing_interval, collection_status, metadata, created_at
             ) VALUES ($1, $2, 'additional_fee', $3, $4, $5, $5, 0,
                       'one_time', 'one_time', 'unpaid', $6::jsonb, $7)
             ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING`,
            [
              accountId,
              annualSubscription.member_id,
              `${feeId}:${annualSubscription.member_id}:${renewal}`,
              annualSubscription.description || 'Annual Membership',
              amountCents,
              JSON.stringify({ stripeInvoiceId: invoice.id, stripeSubscriptionId: subscriptionId, renewal: true }),
              paidAt,
            ],
          )
        }
      }
    }
  }
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
  const nextBillAt = subscriptionPeriodEnd(subscription)
  const autoRenewal = !(
    localStatus === 'cancelled' ||
    subscription.cancel_at_period_end === true ||
    Number(subscription.cancel_at) > 0
  )
  const result = await pool.query(
    `
      UPDATE billing_subscription
      SET status = $2,
          end_date = CASE
            WHEN $2 = 'cancelled' THEN COALESCE(to_timestamp($3)::date, CURRENT_DATE)
            ELSE NULL
          END,
          next_bill_date = CASE
            WHEN (
              source_type = 'annual_membership' OR
              pricing_option_key = 'annual_membership'
            ) AND $5::double precision IS NOT NULL
              THEN to_timestamp($5::double precision)::date
            WHEN $2 = 'cancelled' AND NOT (
              source_type = 'annual_membership' OR
              pricing_option_key = 'annual_membership'
            ) THEN NULL
            ELSE next_bill_date
          END,
          auto_renewal = $4,
          updated_at = now()
      WHERE stripe_subscription_id = $1
    `,
    [subscription.id, localStatus, endAt, autoRenewal, nextBillAt],
  )
  return { updated: result.rowCount ?? 0, status: localStatus }
}

export async function resolveStripeWebhookAccountId(pool, object) {
  return resolveAccountId(pool, object)
}
