/**
 * Flag-gated Stripe scaffolding. Nothing here runs unless STRIPE_ENABLED=true
 * and STRIPE_SECRET_KEY is configured. The `stripe` SDK is imported lazily so
 * the app boots fine when the dependency or keys are absent.
 *
 * Production credentials and webhook endpoints remain deployment configuration;
 * live-mode webhook delivery is always signature verified below.
 */

import { resolveStripePaymentMethodLabel } from './paymentMethodLabel.js'

export function stripeEnabled() {
  return process.env.STRIPE_ENABLED === 'true' && Boolean(process.env.STRIPE_SECRET_KEY)
}

let cachedClient = null
let stripeBillingSchemaEnsured = false
let billingStripeLinksEnsured = false

async function runMigrationFile(pool, relativePath) {
  const fs = await import('fs')
  const migrationPath = new URL(relativePath, import.meta.url)
  await pool.query(fs.readFileSync(migrationPath, 'utf8'))
}

/** family_billing_account.stripe_customer_id + payment idempotency index (047). */
export async function ensureStripeBillingSchema(pool) {
  if (stripeBillingSchemaEnsured) return
  await runMigrationFile(pool, '../migrations/047_stripe_billing_scaffold.sql')
  stripeBillingSchemaEnsured = true
}

/** Billing payment links for Checkout, invoices, and recurring subscriptions. */
export async function ensureBillingStripeLinksSchema(pool) {
  if (billingStripeLinksEnsured) return
  await runMigrationFile(pool, '../migrations/058_billing_stripe_links.sql')
  await runMigrationFile(pool, '../migrations/768_annual_membership_auto_renewal.sql')
  await runMigrationFile(pool, '../migrations/769_annual_membership_renewal_tracking.sql')
  billingStripeLinksEnsured = true
}

async function getStripe() {
  if (!stripeEnabled()) return null
  if (cachedClient) return cachedClient
  try {
    const mod = await import('stripe')
    const Stripe = mod.default || mod
    cachedClient = new Stripe(process.env.STRIPE_SECRET_KEY)
    return cachedClient
  } catch (err) {
    console.warn('[stripe] SDK unavailable:', err.message)
    return null
  }
}

/** Shared Stripe client for billing modules (catalog sync, checkout, webhooks). */
export async function getStripeClient() {
  return getStripe()
}

/**
 * Resolve or create a Stripe Customer for a family billing account.
 * Recreates the customer when a stored ID is missing in the current Stripe
 * account/mode (common after test→live switch or deleted customers).
 */
export async function ensureStripeCustomer(pool, stripe, account) {
  await ensureStripeBillingSchema(pool)
  const existingId = account?.stripe_customer_id ? String(account.stripe_customer_id) : null

  if (existingId) {
    try {
      const existing = await stripe.customers.retrieve(existingId)
      if (existing && !existing.deleted) return existingId
    } catch (err) {
      const missing =
        err?.code === 'resource_missing' || /No such customer/i.test(String(err?.message ?? ''))
      if (!missing) throw err
      console.warn(
        `[stripe] stale customer ${existingId} for billing account ${account.id}; creating a new one`,
      )
    }
  }

  const customer = await stripe.customers.create({
    email: account.billing_email || undefined,
    metadata: {
      familyBillingAccountId: String(account.id),
      familyId: String(account.family_id),
      ...(existingId ? { replaced_stripe_customer_id: existingId } : {}),
    },
  })
  await pool.query(
    `UPDATE family_billing_account SET stripe_customer_id = $2, updated_at = now() WHERE id = $1`,
    [account.id, customer.id],
  )
  account.stripe_customer_id = customer.id
  return customer.id
}

/**
 * Create a hosted Stripe Checkout Session for the outstanding balance.
 * @returns {{url:string}|null} null when Stripe is disabled/unavailable.
 */
export function buildBalanceCheckoutParams({
  account,
  customerId,
  balanceCents,
  successUrl,
  cancelUrl,
  analytics = null,
  nowMs = Date.now(),
}) {
  const amount = Math.round(Number(balanceCents) || 0)
  if (!account?.id || !customerId || amount <= 0) {
    throw new Error('A billing account, Stripe customer, and positive balance are required.')
  }
  return {
    mode: 'payment',
    customer: customerId,
    client_reference_id: `family-billing-account:${account.id}`,
    expires_at: Math.floor(nowMs / 1000) + 24 * 60 * 60,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amount,
          product_data: { name: 'Vortex Athletics account balance' },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      familyBillingAccountId: String(account.id),
      ...(analytics?.gaClientId ? { gaClientId: String(analytics.gaClientId).slice(0, 100) } : {}),
      ...(analytics?.gaSessionId ? { gaSessionId: String(analytics.gaSessionId).slice(0, 100) } : {}),
    },
  }
}

export async function createCheckoutSession(pool, { account, balanceCents, successUrl, cancelUrl, analytics = null }) {
  const stripe = await getStripe()
  if (!stripe || !account || balanceCents <= 0) return null
  const customerId = await ensureStripeCustomer(pool, stripe, account)
  const session = await stripe.checkout.sessions.create(
    buildBalanceCheckoutParams({
      account,
      customerId,
      balanceCents,
      successUrl,
      cancelUrl,
      analytics,
    }),
  )
  return {
    id: session.id,
    url: session.url,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
  }
}

/** Create a short-lived Stripe Customer Portal session for payment-method management. */
export async function createCustomerPortalSession(pool, { account, returnUrl }) {
  const stripe = await getStripe()
  if (!stripe || !account) return null
  const customerId = await ensureStripeCustomer(pool, stripe, account)
  return stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl })
}

function normalizeWebhookSecret(value) {
  if (!value) return null
  let secret = String(value).trim()
  if (
    (secret.startsWith('"') && secret.endsWith('"')) ||
    (secret.startsWith("'") && secret.endsWith("'"))
  ) {
    secret = secret.slice(1, -1).trim()
  }
  return secret || null
}

function webhookSigningSecrets() {
  const secrets = []
  const primary = normalizeWebhookSecret(process.env.STRIPE_WEBHOOK_SECRET)
  if (primary) secrets.push(primary)
  const extra = process.env.STRIPE_WEBHOOK_SECRETS ?? ''
  for (const part of extra.split(',')) {
    const secret = normalizeWebhookSecret(part)
    if (secret && !secrets.includes(secret)) secrets.push(secret)
  }
  return secrets
}

/** Live credentials must never accept an unsigned or unverifiable webhook. */
function liveWebhookVerificationRequired() {
  return String(process.env.STRIPE_SECRET_KEY ?? '').trim().startsWith('sk_live_')
}

/**
 * Raw request body for Stripe webhook signature verification.
 * @returns {Buffer|string|null}
 */
export function stripeWebhookRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody
  if (typeof req.rawBody === 'string') return req.rawBody
  return null
}

/**
 * Verify and parse a Stripe webhook event.
 */
export async function parseWebhookEvent(rawBody, signature) {
  const stripe = await getStripe()
  if (!stripe) return null

  const secrets = webhookSigningSecrets()
  if (liveWebhookVerificationRequired()) {
    if (!secrets.length) {
      throw new Error('Stripe webhook signing secret is required in live mode.')
    }
    if (!signature) {
      throw new Error('Stripe webhook signature is required in live mode.')
    }
    if (rawBody == null || (!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string')) {
      throw new Error(
        'Webhook raw body missing — Stripe signature verification requires the unparsed request body.',
      )
    }
  }
  if (secrets.length && signature && rawBody != null) {
    if (typeof rawBody === 'object' && !Buffer.isBuffer(rawBody)) {
      throw new Error(
        'Webhook raw body missing — Stripe signature verification requires the unparsed request body.',
      )
    }

    let lastError = null
    for (const secret of secrets) {
      try {
        return stripe.webhooks.constructEvent(rawBody, signature, secret)
      } catch (err) {
        lastError = err
      }
    }
    throw lastError ?? new Error('Webhook signature verification failed.')
  }

  if (Buffer.isBuffer(rawBody)) {
    return JSON.parse(rawBody.toString('utf8'))
  }
  return typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody
}

export function logWebhookVerificationFailure(err, { rawBody, signature }) {
  const secrets = webhookSigningSecrets()
  console.error('[stripe] webhook signature verification failed:', err?.message ?? err, {
    bodyIsBuffer: Buffer.isBuffer(rawBody),
    bodyLength: Buffer.isBuffer(rawBody) ? rawBody.length : null,
    bodyType: rawBody == null ? 'null' : typeof rawBody,
    hasSignature: Boolean(signature),
    configuredSecretCount: secrets.length,
    secretPrefixes: secrets.map((s) => s.slice(0, 6)),
  })
}

/**
 * Idempotently record a successful Stripe payment into billing_payment.
 * Returned row carries `newly_inserted: true` (ON CONFLICT DO NOTHING returns
 * no row on replay), used to fire the GA4 purchase event exactly once.
 */
export async function recordStripePayment(pool, { paymentIntentId, amountCents, accountId, customerId }) {
  if (!paymentIntentId || !accountId) return null
  await ensureStripeBillingSchema(pool)
  await ensureBillingStripeLinksSchema(pool)
  const stripe = await getStripe()
  const method = await resolveStripePaymentMethodLabel(stripe, { paymentIntentId })
  const result = await pool.query(
    `
      INSERT INTO billing_payment
        (family_billing_account_id, amount_cents, method, external_processor,
         external_status, stripe_customer_id, stripe_payment_intent_id)
      VALUES ($1, $2, $3, 'stripe', 'settled', $4, $5)
      ON CONFLICT (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL
      DO UPDATE SET
        method = CASE
          WHEN billing_payment.method IS NULL
            OR lower(trim(billing_payment.method)) IN ('card', 'credit card', 'debit card', '')
          THEN EXCLUDED.method
          ELSE billing_payment.method
        END
      RETURNING *, (xmax = 0) AS newly_inserted
    `,
    [accountId, Math.round(Number(amountCents) || 0), method, customerId ?? null, paymentIntentId],
  )
  const payment = result.rows[0] ?? null
  return payment
}

/**
 * Resolve PaymentIntent / invoice from a Checkout Session (subscription mode often has PI on invoice).
 */
export async function resolveEnrollmentCheckoutPayment(stripe, session) {
  let paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null
  let invoiceId = typeof session.invoice === 'string' ? session.invoice : session.invoice?.id ?? null

  if ((!paymentIntentId || !invoiceId) && stripe && session.id) {
    const expanded = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['payment_intent', 'invoice.payment_intent'],
    })
    paymentIntentId =
      typeof expanded.payment_intent === 'string'
        ? expanded.payment_intent
        : expanded.payment_intent?.id ?? paymentIntentId
    if (expanded.invoice && typeof expanded.invoice === 'object') {
      invoiceId = expanded.invoice.id ?? invoiceId
      const invPi = expanded.invoice.payment_intent
      paymentIntentId =
        typeof invPi === 'string' ? invPi : invPi?.id ?? paymentIntentId
    } else if (expanded.invoice) {
      invoiceId = expanded.invoice
    }
  } else if (invoiceId && !paymentIntentId && stripe) {
    const invoice =
      session.invoice && typeof session.invoice === 'object'
        ? session.invoice
        : await stripe.invoices.retrieve(invoiceId)
    const invPi = invoice.payment_intent
    paymentIntentId = typeof invPi === 'string' ? invPi : invPi?.id ?? null
  }

  return { paymentIntentId, invoiceId }
}

/**
 * Idempotently record enrollment Checkout payment (handles subscription-mode invoice PI).
 * Returned row carries `newly_inserted` (true only on first insert; xmax=0 detects
 * insert vs conflict-update), used to fire the GA4 purchase event exactly once.
 */
export async function recordEnrollmentStripePayment(pool, stripe, { session, accountId, paidAt = null }) {
  if (!accountId || !session?.id) return null
  await ensureStripeBillingSchema(pool)
  await ensureBillingStripeLinksSchema(pool)

  const { paymentIntentId, invoiceId } = await resolveEnrollmentCheckoutPayment(stripe, session)
  const amountCents = Math.round(Number(session.amount_total) || 0)
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
  const checkoutSessionId = session.id
  const paidAtValue =
    paidAt instanceof Date
      ? paidAt
      : paidAt
        ? new Date(paidAt)
        : session.created
          ? new Date(session.created * 1000)
          : new Date()

  if (paymentIntentId) {
    const method = await resolveStripePaymentMethodLabel(stripe, {
      paymentIntentId,
      checkoutSessionId,
    })
    const result = await pool.query(
      `
        INSERT INTO billing_payment
          (family_billing_account_id, amount_cents, paid_at, method, external_processor,
           external_status, stripe_customer_id, stripe_payment_intent_id,
           stripe_checkout_session_id, stripe_invoice_id)
        VALUES ($1, $2, $3, $4, 'stripe', 'settled', $5, $6, $7, $8)
        ON CONFLICT (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL
        DO UPDATE SET
          stripe_checkout_session_id = COALESCE(
            billing_payment.stripe_checkout_session_id,
            EXCLUDED.stripe_checkout_session_id
          ),
          stripe_invoice_id = COALESCE(billing_payment.stripe_invoice_id, EXCLUDED.stripe_invoice_id),
          method = CASE
            WHEN billing_payment.method IS NULL
              OR lower(trim(billing_payment.method)) IN ('card', 'credit card', 'debit card', '')
            THEN EXCLUDED.method
            ELSE billing_payment.method
          END
        RETURNING *, (xmax = 0) AS newly_inserted
      `,
      [
        accountId,
        amountCents,
        paidAtValue,
        method,
        customerId,
        paymentIntentId,
        checkoutSessionId,
        invoiceId,
      ],
    )
    const payment = result.rows[0] ?? null
    if (payment && checkoutSessionId) {
      await pool.query(
        `
          UPDATE billing_charge
          SET stripe_checkout_session_id = $2
          WHERE family_billing_account_id = $1
            AND stripe_checkout_session_id IS NULL
            AND created_at >= now() - interval '15 minutes'
        `,
        [accountId, checkoutSessionId],
      )
    }
    return payment
  }

  const method = await resolveStripePaymentMethodLabel(stripe, { checkoutSessionId })
  const result = await pool.query(
    `
      INSERT INTO billing_payment
        (family_billing_account_id, amount_cents, paid_at, method, external_processor,
         external_status, stripe_customer_id, stripe_checkout_session_id, stripe_invoice_id)
      VALUES ($1, $2, $3, $4, 'stripe', 'settled', $5, $6, $7)
      ON CONFLICT (stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL
      DO NOTHING
      RETURNING *
    `,
    [accountId, amountCents, paidAtValue, method, customerId, checkoutSessionId, invoiceId],
  )
  const payment = result.rows[0] ?? null
  if (payment) payment.newly_inserted = true

  if (payment && checkoutSessionId) {
    await pool.query(
      `
        UPDATE billing_charge
        SET stripe_checkout_session_id = $2
        WHERE family_billing_account_id = $1
          AND stripe_checkout_session_id IS NULL
          AND created_at >= now() - interval '15 minutes'
      `,
      [accountId, checkoutSessionId],
    )
  }

  return payment
}
