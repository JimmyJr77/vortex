/**
 * Flag-gated Stripe scaffolding. Nothing here runs unless STRIPE_ENABLED=true
 * and STRIPE_SECRET_KEY is configured. The `stripe` SDK is imported lazily so
 * the app boots fine when the dependency or keys are absent.
 *
 * Go-live TODO (intentionally deferred): production keys, full reconciliation,
 * customer portal, dunning, and raw-body webhook signature hardening.
 */

export function stripeEnabled() {
  return process.env.STRIPE_ENABLED === 'true' && Boolean(process.env.STRIPE_SECRET_KEY)
}

let cachedClient = null
let stripeBillingSchemaEnsured = false

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

async function ensureStripeCustomer(pool, stripe, account) {
  await ensureStripeBillingSchema(pool)
  if (account.stripe_customer_id) return account.stripe_customer_id
  const customer = await stripe.customers.create({
    email: account.billing_email || undefined,
    metadata: { familyBillingAccountId: String(account.id), familyId: String(account.family_id) },
  })
  await pool.query(
    `UPDATE family_billing_account SET stripe_customer_id = $2, updated_at = now() WHERE id = $1`,
    [account.id, customer.id],
  )
  return customer.id
}

/**
 * Create a hosted Stripe Checkout Session for the outstanding balance.
 * @returns {{url:string}|null} null when Stripe is disabled/unavailable.
 */
export async function createCheckoutSession(pool, { account, balanceCents, successUrl, cancelUrl }) {
  const stripe = await getStripe()
  if (!stripe || !account || balanceCents <= 0) return null
  const customerId = await ensureStripeCustomer(pool, stripe, account)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: balanceCents,
          product_data: { name: 'Vortex Athletics account balance' },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { familyBillingAccountId: String(account.id) },
  })
  return { url: session.url }
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
 */
export async function recordStripePayment(pool, { paymentIntentId, amountCents, accountId, customerId }) {
  if (!paymentIntentId || !accountId) return null
  const result = await pool.query(
    `
      INSERT INTO billing_payment
        (family_billing_account_id, amount_cents, method, external_processor,
         external_status, stripe_customer_id, stripe_payment_intent_id)
      VALUES ($1, $2, 'card', 'stripe', 'settled', $3, $4)
      ON CONFLICT (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL
      DO NOTHING
      RETURNING *
    `,
    [accountId, Math.round(Number(amountCents) || 0), customerId ?? null, paymentIntentId],
  )
  return result.rows[0] ?? null
}
