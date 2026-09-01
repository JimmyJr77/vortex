/**
 * Flag-gated Stripe scaffolding. Nothing here runs unless STRIPE_ENABLED=true
 * and STRIPE_SECRET_KEY is configured. The `stripe` SDK is imported lazily so
 * the app boots fine when the dependency or keys are absent.
 *
 * Production credentials and webhook endpoints remain deployment configuration;
 * live-mode webhook delivery is always signature verified below.
 */

import { resolveStripePaymentMethodLabel } from './paymentMethodLabel.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'

export const STRIPE_CUSTOMER_RECONCILIATION_REQUIRED_CODE =
  'STRIPE_CUSTOMER_RECONCILIATION_REQUIRED'

export function stripeEnabled() {
  return process.env.STRIPE_ENABLED === 'true' && Boolean(process.env.STRIPE_SECRET_KEY)
}

let cachedClient = null

/** family_billing_account.stripe_customer_id + payment idempotency index (047). */
export async function ensureStripeBillingSchema() {
  // Compatibility hook. Startup billing readiness owns this schema contract.
}

/** Billing payment links for Checkout, invoices, and recurring subscriptions. */
export async function ensureBillingStripeLinksSchema() {
  // Compatibility hook. Startup billing readiness owns this schema contract.
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

function stripeCustomerMissing(error) {
  return error?.code === 'resource_missing'
    || /No such customer/i.test(String(error?.message ?? ''))
}

function stripeCustomerReconciliationError(accountId, customerId, reason) {
  const error = new Error(
    `Stripe customer ${customerId} for billing account ${accountId} requires reconciliation: ${reason}.`,
  )
  error.code = STRIPE_CUSTOMER_RECONCILIATION_REQUIRED_CODE
  error.statusCode = 409
  error.billingAccountId = Number(accountId)
  error.stripeCustomerId = String(customerId)
  return error
}

async function quarantineStripeCustomerLink(db, { accountId, customerId, reason }) {
  const message = `Stripe customer ${customerId} could not be verified (${reason}); automatic replacement was blocked.`
  await db.query(
    `INSERT INTO stripe_billing_alert
      (stripe_event_id, family_billing_account_id, alert_type, severity,
       stripe_object_id, message, details)
     VALUES ($1, $2, 'stripe_customer_reconciliation_required', 'critical', $3, $4, $5::jsonb)
     ON CONFLICT (stripe_event_id) DO NOTHING`,
    [
      `stripe-customer-reconciliation:${Number(accountId)}:${String(customerId)}`,
      Number(accountId),
      String(customerId),
      message,
      JSON.stringify({ reason, automaticReplacementBlocked: true }),
    ],
  )
}

/**
 * Resolve or create a Stripe Customer for one family billing account.
 *
 * Creation is serialized by the account collection advisory lock and a locked
 * account row. Stripe also receives a deterministic idempotency key so a
 * process crash after remote creation cannot fan out duplicate customers.
 * Existing IDs are never replaced automatically: a missing/deleted/wrong-mode
 * customer is quarantined for reviewed reconciliation.
 */
export async function ensureStripeCustomer(pool, stripe, account) {
  await ensureStripeBillingSchema(pool)
  const accountId = Number(account?.id)
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    throw new Error('A billing account is required to resolve a Stripe customer.')
  }
  if (!stripe?.customers?.retrieve) {
    throw new Error('Stripe customer retrieval is unavailable.')
  }

  return withBillingAccountCollectionLock(pool, accountId, async (db) => {
    let transactionOpen = false
    try {
      await db.query('BEGIN')
      transactionOpen = true
      const locked = await db.query(
        `SELECT id, family_id, billing_email, stripe_customer_id, is_active
           FROM family_billing_account
          WHERE id = $1
          LIMIT 1
          FOR UPDATE`,
        [accountId],
      ).then((result) => result.rows[0] ?? null)
      if (!locked || locked.is_active === false) {
        throw new Error(`Billing account ${accountId} is not active.`)
      }

      const existingId = locked.stripe_customer_id
        ? String(locked.stripe_customer_id)
        : null
      if (existingId) {
        let existing
        try {
          existing = await stripe.customers.retrieve(existingId)
        } catch (error) {
          if (!stripeCustomerMissing(error)) throw error
          await quarantineStripeCustomerLink(db, {
            accountId,
            customerId: existingId,
            reason: 'customer is missing from the configured Stripe account or mode',
          })
          await db.query('COMMIT')
          transactionOpen = false
          throw stripeCustomerReconciliationError(
            accountId,
            existingId,
            'the stored customer is missing from the configured Stripe account or mode',
          )
        }
        if (!existing || existing.deleted) {
          await quarantineStripeCustomerLink(db, {
            accountId,
            customerId: existingId,
            reason: 'customer is deleted',
          })
          await db.query('COMMIT')
          transactionOpen = false
          throw stripeCustomerReconciliationError(accountId, existingId, 'the stored customer is deleted')
        }
        const owner = Number(existing.metadata?.familyBillingAccountId)
        if (Number.isSafeInteger(owner) && owner > 0 && owner !== accountId) {
          await quarantineStripeCustomerLink(db, {
            accountId,
            customerId: existingId,
            reason: `customer metadata belongs to billing account ${owner}`,
          })
          await db.query('COMMIT')
          transactionOpen = false
          throw stripeCustomerReconciliationError(
            accountId,
            existingId,
            `customer metadata belongs to billing account ${owner}`,
          )
        }
        await db.query('COMMIT')
        transactionOpen = false
        account.stripe_customer_id = existingId
        return existingId
      }

      if (!stripe?.customers?.create) {
        throw new Error('Stripe customer creation is unavailable.')
      }
      const customer = await stripe.customers.create(
        {
          email: locked.billing_email || account.billing_email || undefined,
          metadata: {
            familyBillingAccountId: String(accountId),
            familyId: String(locked.family_id ?? account.family_id),
          },
        },
        { idempotencyKey: `family-billing-account:${accountId}:stripe-customer:v1` },
      )
      if (!customer?.id) throw new Error('Stripe did not return a customer ID.')
      const updated = await db.query(
        `UPDATE family_billing_account
            SET stripe_customer_id = $2, updated_at = now()
          WHERE id = $1
            AND stripe_customer_id IS NULL
          RETURNING stripe_customer_id`,
        [accountId, customer.id],
      )
      if (!updated.rows[0]) {
        throw new Error(`Billing account ${accountId} acquired a different Stripe customer concurrently.`)
      }
      await db.query('COMMIT')
      transactionOpen = false
      account.stripe_customer_id = customer.id
      return customer.id
    } catch (error) {
      if (transactionOpen) await db.query('ROLLBACK').catch(() => {})
      throw error
    }
  })
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

export async function createCheckoutSession(pool, {
  account,
  balanceCents,
  successUrl,
  cancelUrl,
  analytics = null,
  idempotencyKey = null,
}) {
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
    idempotencyKey ? { idempotencyKey: String(idempotencyKey) } : undefined,
  )
  return {
    id: session.id,
    url: session.url,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
  }
}

export const PAYMENT_METHOD_SETUP_CHECKOUT_TYPE = 'payment_method_update'

export function buildPaymentMethodSetupCheckoutParams({ accountId, customerId, returnUrl }) {
  const normalizedAccountId = Number(accountId)
  if (!Number.isSafeInteger(normalizedAccountId) || normalizedAccountId <= 0) {
    throw new Error('A billing account is required to update a payment method.')
  }
  if (!customerId || !returnUrl) {
    throw new Error('A Stripe customer and return URL are required to update a payment method.')
  }
  const metadata = {
    checkoutType: PAYMENT_METHOD_SETUP_CHECKOUT_TYPE,
    familyBillingAccountId: String(normalizedAccountId),
  }
  return {
    mode: 'setup',
    customer: String(customerId),
    payment_method_types: ['card'],
    success_url: String(returnUrl),
    cancel_url: String(returnUrl),
    metadata,
    setup_intent_data: { metadata },
  }
}

/**
 * Create a subscription-incapable Stripe Checkout setup session. Customer
 * Portal is intentionally not used because an unrestricted Portal
 * configuration can expose subscription creation or mutation controls.
 */
export async function createPaymentMethodSetupSession(pool, { account, returnUrl }) {
  const stripe = await getStripe()
  if (!stripe || !account) return null
  const customerId = await ensureStripeCustomer(pool, stripe, account)
  return stripe.checkout.sessions.create(buildPaymentMethodSetupCheckoutParams({
    accountId: account.id,
    customerId,
    returnUrl,
  }))
}

/**
 * Promote the card collected by a completed setup-only Checkout Session to the
 * canonical customer's invoice default. Account and customer identity are
 * server-verified again under the household collection lock.
 */
export async function completePaymentMethodSetupSession(pool, {
  session,
  stripe: suppliedStripe = null,
} = {}) {
  if (
    session?.mode !== 'setup'
    || session?.status !== 'complete'
    || session?.metadata?.checkoutType !== PAYMENT_METHOD_SETUP_CHECKOUT_TYPE
  ) {
    throw new Error('Stripe payment-method setup session is not complete or has the wrong type.')
  }
  const accountId = Number(session.metadata?.familyBillingAccountId)
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    throw new Error('Stripe payment-method setup session has no valid billing account.')
  }
  const stripe = suppliedStripe ?? await getStripe()
  if (!stripe?.checkout?.sessions?.retrieve || !stripe?.customers?.update) {
    throw new Error('Stripe payment-method setup completion is unavailable.')
  }

  return withBillingAccountCollectionLock(pool, accountId, async (db) => {
    const account = await db.query(
      `SELECT id, stripe_customer_id, is_active
         FROM family_billing_account
        WHERE id = $1
        LIMIT 1`,
      [accountId],
    ).then((result) => result.rows[0] ?? null)
    if (!account || account.is_active === false) {
      throw new Error(`Billing account ${accountId} is not active.`)
    }
    const expectedCustomerId = String(account.stripe_customer_id ?? '').trim()
    const observedCustomerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id ?? null
    if (!expectedCustomerId || String(observedCustomerId ?? '') !== expectedCustomerId) {
      throw stripeCustomerReconciliationError(
        accountId,
        observedCustomerId ?? expectedCustomerId ?? 'missing',
        'the setup session customer does not match the canonical billing account',
      )
    }

    const expanded = await stripe.checkout.sessions.retrieve(String(session.id), {
      expand: ['setup_intent.payment_method'],
    })
    if (
      expanded?.mode !== 'setup'
      || expanded?.status !== 'complete'
      || expanded?.metadata?.checkoutType !== PAYMENT_METHOD_SETUP_CHECKOUT_TYPE
      || Number(expanded?.metadata?.familyBillingAccountId) !== accountId
    ) {
      throw new Error('Stripe payment-method setup session changed during verification.')
    }
    const expandedCustomerId = typeof expanded.customer === 'string'
      ? expanded.customer
      : expanded.customer?.id ?? null
    const setupIntent = expanded.setup_intent
    const setupIntentCustomerId = typeof setupIntent?.customer === 'string'
      ? setupIntent.customer
      : setupIntent?.customer?.id ?? null
    const paymentMethodId = typeof setupIntent?.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent?.payment_method?.id ?? null
    if (
      String(expandedCustomerId ?? '') !== expectedCustomerId
      || (setupIntentCustomerId && String(setupIntentCustomerId) !== expectedCustomerId)
      || setupIntent?.status !== 'succeeded'
      || !paymentMethodId
    ) {
      throw new Error('Stripe payment-method setup intent is not a succeeded setup for the canonical customer.')
    }

    await stripe.customers.update(expectedCustomerId, {
      invoice_settings: { default_payment_method: String(paymentMethodId) },
    })
    return {
      accountId,
      customerId: expectedCustomerId,
      paymentMethodId: String(paymentMethodId),
    }
  })
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
export async function prepareStripePaymentRecord({ paymentIntentId, amountCents, accountId, customerId }, {
  stripe = null,
} = {}) {
  if (!paymentIntentId || !accountId) return null
  const stripeClient = stripe || await getStripe()
  const method = await resolveStripePaymentMethodLabel(stripeClient, { paymentIntentId })
  return {
    paymentIntentId,
    amountCents: Math.round(Number(amountCents) || 0),
    accountId: Number(accountId),
    customerId: customerId ?? null,
    method,
  }
}

/** Pure local upsert; safe to compose inside a caller-owned transaction. */
export async function upsertStripePayment(pool, prepared) {
  if (!prepared?.paymentIntentId || !prepared?.accountId) return null
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
    [
      prepared.accountId,
      prepared.amountCents,
      prepared.method,
      prepared.customerId,
      prepared.paymentIntentId,
    ],
  )
  const payment = result.rows[0] ?? null
  return payment
}

export async function recordStripePayment(pool, details) {
  await ensureStripeBillingSchema(pool)
  await ensureBillingStripeLinksSchema(pool)
  const prepared = await prepareStripePaymentRecord(details)
  return upsertStripePayment(pool, prepared)
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
