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

async function ensureStripeCustomer(pool, stripe, account) {
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

/**
 * Verify and parse a Stripe webhook event. Falls back to JSON parsing when no
 * signing secret/raw body is available (scaffold only — harden before go-live).
 */
export async function parseWebhookEvent(rawBody, signature) {
  const stripe = await getStripe()
  if (!stripe) return null
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (secret && signature && rawBody) {
    return stripe.webhooks.constructEvent(rawBody, signature, secret)
  }
  return typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody
}

/**
 * Idempotently record a successful Stripe payment into billing_payment.
 */
export async function recordStripePayment(pool, { paymentIntentId, amountCents, accountId, customerId }) {
  if (!paymentIntentId || !accountId) return
  await pool.query(
    `
      INSERT INTO billing_payment
        (family_billing_account_id, amount_cents, method, external_processor,
         external_status, stripe_customer_id, stripe_payment_intent_id)
      VALUES ($1, $2, 'card', 'stripe', 'settled', $3, $4)
      ON CONFLICT (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL
      DO NOTHING
    `,
    [accountId, Math.round(Number(amountCents) || 0), customerId ?? null, paymentIntentId],
  )
}
