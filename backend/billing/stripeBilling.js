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
        `SELECT account.id,
                account.family_id,
                account.billing_email,
                account.stripe_customer_id,
                account.is_active,
                (
                  SELECT COUNT(*)::integer
                    FROM family_billing_account customer_owner
                   WHERE customer_owner.stripe_customer_id = account.stripe_customer_id
                ) AS stripe_customer_owner_count
           FROM family_billing_account account
          WHERE account.id = $1
          LIMIT 1
          FOR UPDATE`,
        [accountId],
      ).then((result) => result.rows[0] ?? null)
      if (!locked || locked.is_active !== true) {
        throw new Error(`Billing account ${accountId} is not active.`)
      }

      const existingId = locked.stripe_customer_id
        ? String(locked.stripe_customer_id)
        : null
      if (existingId) {
        if (Number(locked.stripe_customer_owner_count) !== 1) {
          const ownerCount = Number(locked.stripe_customer_owner_count) || 0
          await quarantineStripeCustomerLink(db, {
            accountId,
            customerId: existingId,
            reason: `customer is linked to ${ownerCount} local billing accounts`,
          })
          await db.query('COMMIT')
          transactionOpen = false
          throw stripeCustomerReconciliationError(
            accountId,
            existingId,
            `the stored customer is linked to ${ownerCount} local billing accounts`,
          )
        }
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
        if (stripeObjectId(existing) !== existingId) {
          await quarantineStripeCustomerLink(db, {
            accountId,
            customerId: existingId,
            reason: 'customer retrieval returned a different Stripe object',
          })
          await db.query('COMMIT')
          transactionOpen = false
          throw stripeCustomerReconciliationError(
            accountId,
            existingId,
            'customer retrieval returned a different Stripe object',
          )
        }
        const ownerClaim = String(existing.metadata?.familyBillingAccountId ?? '').trim()
        if (ownerClaim && ownerClaim !== String(accountId)) {
          await quarantineStripeCustomerLink(db, {
            accountId,
            customerId: existingId,
            reason: `customer metadata claims billing account ${ownerClaim}`,
          })
          await db.query('COMMIT')
          transactionOpen = false
          throw stripeCustomerReconciliationError(
            accountId,
            existingId,
            `customer metadata claims billing account ${ownerClaim}`,
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
      // Stripe idempotency can replay an earlier successful create response.
      // Re-read that Customer and prove it is still live, still claims this
      // account, and is not already retained by any local row (including an
      // inactive historical row) before assigning the durable link.
      const createdId = String(customer.id)
      const verifiedCustomer = await stripe.customers.retrieve(createdId)
      const ownerClaim = String(verifiedCustomer?.metadata?.familyBillingAccountId ?? '').trim()
      const createdCustomerInvalid = (
        !verifiedCustomer
        || verifiedCustomer.deleted === true
        || stripeObjectId(verifiedCustomer) !== createdId
        || ownerClaim !== String(accountId)
      )
      if (createdCustomerInvalid) {
        const reason = verifiedCustomer?.deleted === true
          ? 'newly resolved customer is deleted'
          : stripeObjectId(verifiedCustomer) !== createdId
            ? 'newly resolved customer retrieval returned a different Stripe object'
            : `newly resolved customer metadata claims billing account ${ownerClaim || 'missing'}`
        await quarantineStripeCustomerLink(db, {
          accountId,
          customerId: createdId,
          reason,
        })
        await db.query('COMMIT')
        transactionOpen = false
        throw stripeCustomerReconciliationError(accountId, createdId, reason)
      }
      const priorOwners = await db.query(
        `/* stripe-customer-create:prior-local-owners */
         SELECT id, is_active
           FROM family_billing_account
          WHERE stripe_customer_id = $1
          ORDER BY id
          LIMIT 3
          FOR SHARE`,
        [createdId],
      ).then((result) => result.rows ?? [])
      if (priorOwners.length > 0) {
        const ownerIds = priorOwners.map((owner) => Number(owner.id)).join(', ')
        const reason = `newly resolved customer is already linked to local billing account(s) ${ownerIds}`
        await quarantineStripeCustomerLink(db, {
          accountId,
          customerId: createdId,
          reason,
        })
        await db.query('COMMIT')
        transactionOpen = false
        throw stripeCustomerReconciliationError(accountId, createdId, reason)
      }
      const updated = await db.query(
        `UPDATE family_billing_account
            SET stripe_customer_id = $2, updated_at = now()
          WHERE id = $1
            AND stripe_customer_id IS NULL
          RETURNING stripe_customer_id`,
        [accountId, createdId],
      )
      if (!updated.rows[0]) {
        throw new Error(`Billing account ${accountId} acquired a different Stripe customer concurrently.`)
      }
      await db.query('COMMIT')
      transactionOpen = false
      account.stripe_customer_id = createdId
      return createdId
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

export async function createCheckoutSession() {
  const error = new Error(
    'Direct balance Checkout is disabled. Use the reserved customer-balance Checkout flow.',
  )
  error.code = 'DIRECT_BALANCE_CHECKOUT_DISABLED'
  throw error
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
  const sessionId = stripeObjectId(session)
  if (!sessionId) {
    throw new Error('Stripe payment-method setup session has no valid session ID.')
  }
  const stripe = suppliedStripe ?? await getStripe()
  if (
    !stripe?.checkout?.sessions?.retrieve
    || !stripe?.customers?.retrieve
    || !stripe?.customers?.update
    || !stripe?.paymentMethods?.retrieve
  ) {
    throw new Error('Stripe payment-method setup completion is unavailable.')
  }

  return withBillingAccountCollectionLock(pool, accountId, async (db) => {
    const loadAccount = () => db.query(
      `/* payment-method-setup:canonical-account */
       SELECT account.id,
              account.stripe_customer_id,
              account.is_active,
              (
                SELECT COUNT(*)::integer
                  FROM family_billing_account customer_owner
                 WHERE customer_owner.stripe_customer_id = account.stripe_customer_id
              ) AS stripe_customer_owner_count
         FROM family_billing_account account
        WHERE account.id = $1
        LIMIT 1`,
      [accountId],
    ).then((result) => result.rows[0] ?? null)
    const account = await loadAccount()
    if (!account || account.is_active !== true) {
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
    if (Number(account.stripe_customer_owner_count) !== 1) {
      throw stripeCustomerReconciliationError(
        accountId,
        expectedCustomerId,
        `the stored customer is linked to ${Number(account.stripe_customer_owner_count) || 0} local billing accounts`,
      )
    }

    const expanded = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['setup_intent.payment_method'],
    })
    if (
      stripeObjectId(expanded) !== sessionId
      || expanded?.mode !== 'setup'
      || expanded?.status !== 'complete'
      || expanded?.metadata?.checkoutType !== PAYMENT_METHOD_SETUP_CHECKOUT_TYPE
      || String(expanded?.metadata?.familyBillingAccountId ?? '') !== String(accountId)
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
      || String(setupIntentCustomerId ?? '') !== expectedCustomerId
      || setupIntent?.status !== 'succeeded'
      || !paymentMethodId
    ) {
      throw new Error('Stripe payment-method setup intent is not a succeeded setup for the canonical customer.')
    }

    const customer = await stripe.customers.retrieve(expectedCustomerId)
    const remoteCustomerId = stripeObjectId(customer)
    const metadataOwner = String(customer?.metadata?.familyBillingAccountId ?? '').trim()
    if (
      !customer
      || customer.deleted === true
      || remoteCustomerId !== expectedCustomerId
      || (metadataOwner && metadataOwner !== String(accountId))
    ) {
      throw stripeCustomerReconciliationError(
        accountId,
        remoteCustomerId ?? expectedCustomerId,
        'the remote customer identity or account metadata does not match the canonical billing account',
      )
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(String(paymentMethodId))
    if (
      stripeObjectId(paymentMethod) !== String(paymentMethodId)
      || stripeObjectId(paymentMethod?.customer) !== expectedCustomerId
      || !['card', 'link'].includes(String(paymentMethod?.type ?? ''))
    ) {
      throw stripeCustomerReconciliationError(
        accountId,
        expectedCustomerId,
        'the setup payment method is not an eligible method owned by the canonical customer',
      )
    }

    const currentAccount = await loadAccount()
    if (
      currentAccount?.is_active !== true
      || String(currentAccount?.stripe_customer_id ?? '').trim() !== expectedCustomerId
      || Number(currentAccount?.stripe_customer_owner_count) !== 1
    ) {
      throw stripeCustomerReconciliationError(
        accountId,
        expectedCustomerId,
        'the canonical customer changed during setup verification',
      )
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
function stripePaymentIntentPaidAt(paymentIntent) {
  const latestChargeCreated = typeof paymentIntent?.latest_charge === 'object'
    ? Number(paymentIntent.latest_charge?.created)
    : null
  const paymentIntentCreated = Number(paymentIntent?.created)
  const timestamp = Number.isFinite(latestChargeCreated) && latestChargeCreated > 0
    ? latestChargeCreated
    : paymentIntentCreated
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null
  const paidAt = new Date(timestamp * 1000)
  return Number.isNaN(paidAt.getTime()) ? null : paidAt
}

function stripePaymentIntentAmountCents(paymentIntent) {
  const amount = Number(paymentIntent?.amount_received ?? paymentIntent?.amount)
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}

export function stripeEventCreatedAt(event) {
  const timestamp = Number(event?.created)
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) return null
  const createdAt = new Date(timestamp * 1000)
  return Number.isNaN(createdAt.getTime()) ? null : createdAt
}

export async function prepareStripePaymentRecord({
  paymentIntentId,
  paymentIntent = null,
  paidAt: suppliedPaidAt = null,
  amountCents,
  accountId,
  customerId,
}, {
  stripe = null,
} = {}) {
  if (!paymentIntentId) return null
  const normalizedAccountId = Number(accountId)
  const normalizedAmountCents = Number(amountCents)
  const expectedCustomerId = stripeObjectId(customerId)
  if (!Number.isSafeInteger(normalizedAccountId) || normalizedAccountId <= 0) {
    throw new Error(`Stripe PaymentIntent ${paymentIntentId} has an invalid billing account.`)
  }
  if (!Number.isSafeInteger(normalizedAmountCents) || normalizedAmountCents <= 0) {
    throw new Error(`Stripe PaymentIntent ${paymentIntentId} has an invalid expected amount.`)
  }
  if (!expectedCustomerId) {
    throw new Error(`Stripe PaymentIntent ${paymentIntentId} has no expected Stripe customer.`)
  }
  const stripeClient = stripe || await getStripe()
  const explicitPaidAt = suppliedPaidAt == null
    ? null
    : suppliedPaidAt instanceof Date
      ? new Date(suppliedPaidAt.getTime())
      : new Date(suppliedPaidAt)
  if (suppliedPaidAt != null && Number.isNaN(explicitPaidAt.getTime())) {
    throw new Error(`Stripe PaymentIntent ${paymentIntentId} has an invalid supplied payment timestamp.`)
  }
  let verifiedPaymentIntent = paymentIntent
  if (
    !verifiedPaymentIntent
    || String(verifiedPaymentIntent?.id ?? '') !== String(paymentIntentId)
    || verifiedPaymentIntent?.status !== 'succeeded'
    || stripePaymentIntentAmountCents(verifiedPaymentIntent) !== normalizedAmountCents
    || stripeObjectId(verifiedPaymentIntent?.customer) !== expectedCustomerId
    || (
      !explicitPaidAt
      && (
        typeof verifiedPaymentIntent?.latest_charge !== 'object'
        || !stripePaymentIntentPaidAt(verifiedPaymentIntent)
      )
    )
  ) {
    if (!stripeClient?.paymentIntents?.retrieve) {
      throw new Error(`Stripe PaymentIntent ${paymentIntentId} cannot be retrieved to preserve its payment timestamp.`)
    }
    verifiedPaymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId, {
      expand: ['payment_method', 'latest_charge'],
    })
  }
  if (
    String(verifiedPaymentIntent?.id ?? '') !== String(paymentIntentId)
    || verifiedPaymentIntent?.status !== 'succeeded'
  ) {
    throw new Error(`Stripe PaymentIntent ${paymentIntentId} is not an exact succeeded payment.`)
  }
  const stripeAmountCents = stripePaymentIntentAmountCents(verifiedPaymentIntent)
  if (stripeAmountCents !== normalizedAmountCents) {
    throw new Error(
      `Stripe PaymentIntent ${paymentIntentId} amount does not match the expected billing payment.`,
    )
  }
  const stripeCustomerId = stripeObjectId(verifiedPaymentIntent.customer)
  if (stripeCustomerId !== expectedCustomerId) {
    throw new Error(
      `Stripe PaymentIntent ${paymentIntentId} customer does not match the expected household.`,
    )
  }
  const paidAt = explicitPaidAt ?? stripePaymentIntentPaidAt(verifiedPaymentIntent)
  if (!paidAt) {
    throw new Error(`Stripe PaymentIntent ${paymentIntentId} has no valid Stripe payment timestamp.`)
  }
  const method = await resolveStripePaymentMethodLabel(stripeClient, {
    paymentIntentId,
    paymentIntent: verifiedPaymentIntent,
  })
  return {
    paymentIntentId,
    amountCents: normalizedAmountCents,
    accountId: normalizedAccountId,
    customerId: expectedCustomerId,
    method,
    paidAt,
  }
}

/** Pure local upsert; safe to compose inside a caller-owned transaction. */
export async function upsertStripePayment(pool, prepared) {
  if (!prepared?.paymentIntentId || !prepared?.accountId) return null
  const result = await pool.query(
    `
      INSERT INTO billing_payment
        (family_billing_account_id, amount_cents, method, paid_at, external_processor,
         external_status, stripe_customer_id, stripe_payment_intent_id)
      VALUES ($1, $2, $3, $4, 'stripe', 'settled', $5, $6)
      ON CONFLICT (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL
      DO UPDATE SET
        paid_at = CASE
          -- Releases before this hardening used both DEFAULT now() values. An
          -- exact replay may repair those rows from Stripe time, while a row
          -- that already carries explicit remote time keeps its first durable
          -- timestamp across webhook/reconciliation replays.
          WHEN ABS(EXTRACT(EPOCH FROM (billing_payment.paid_at - billing_payment.created_at))) < 1
          THEN EXCLUDED.paid_at
          ELSE billing_payment.paid_at
        END,
        method = CASE
          WHEN billing_payment.method IS NULL
            OR lower(trim(billing_payment.method)) IN ('card', 'credit card', 'debit card', '')
          THEN EXCLUDED.method
          ELSE billing_payment.method
        END
      WHERE billing_payment.family_billing_account_id = EXCLUDED.family_billing_account_id
        AND billing_payment.amount_cents = EXCLUDED.amount_cents
        AND billing_payment.external_processor = 'stripe'
        AND billing_payment.stripe_customer_id IS NOT DISTINCT FROM EXCLUDED.stripe_customer_id
      RETURNING *, (xmax = 0) AS newly_inserted
    `,
    [
      prepared.accountId,
      prepared.amountCents,
      prepared.method,
      prepared.paidAt,
      prepared.customerId,
      prepared.paymentIntentId,
    ],
  )
  const payment = result.rows[0] ?? null
  if (!payment) {
    const error = new Error(
      `Stripe PaymentIntent ${prepared.paymentIntentId} conflicts with an existing billing payment.`,
    )
    error.code = 'STRIPE_PAYMENT_RECORD_CONFLICT'
    throw error
  }
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

function stripeObjectId(value) {
  const id = typeof value === 'string' ? value : value?.id ?? null
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

function paidCheckoutRefundMarker(checkoutSessionId) {
  return `[paid-checkout-refund-required:${String(checkoutSessionId)}]`
}

function paidCheckoutFulfillmentPendingMarker(checkoutSessionId) {
  return `[paid-checkout-fulfillment-pending:${String(checkoutSessionId)}]`
}

export class StripeEnrollmentPaymentBindingConflict extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'StripeEnrollmentPaymentBindingConflict'
    this.code = 'stripe_enrollment_payment_binding_conflict'
    this.details = details
  }
}

/**
 * Prove that a billing_payment returned from an enrollment or annual Checkout
 * write is the exact settled owner of that Checkout. This is deliberately
 * repeated after the atomic SQL conflict guard so callers and injected test
 * seams cannot accidentally accept a different PaymentIntent owner.
 */
export function assertEnrollmentStripePaymentBinding(payment, {
  session,
  accountId,
  paymentIntentId = stripeObjectId(session?.payment_intent),
  invoiceId = stripeObjectId(session?.invoice),
} = {}) {
  const expectedAccountId = Number(accountId)
  const expectedAmountCents = Number(session?.amount_total)
  const expectedCustomerId = stripeObjectId(session?.customer)
  const expectedCheckoutSessionId = stripeObjectId(session)
  const expectedPaymentIntentId = stripeObjectId(paymentIntentId)
  const expectedInvoiceId = stripeObjectId(invoiceId)
  const refundMarker = expectedCheckoutSessionId
    ? paidCheckoutRefundMarker(expectedCheckoutSessionId)
    : null
  const pendingMarker = expectedCheckoutSessionId
    ? paidCheckoutFulfillmentPendingMarker(expectedCheckoutSessionId)
    : null
  const nonAllocatableMarker = [refundMarker, pendingMarker]
    .find((marker) => marker && String(payment?.note ?? '').includes(marker))
  const exactNonAllocatablePayment = (
    String(payment?.external_status ?? '') === 'reconciliation_required'
    && Boolean(nonAllocatableMarker)
  )
  const problems = []

  if (!Number.isSafeInteger(expectedAccountId) || expectedAccountId <= 0) {
    problems.push('expected_account_missing')
  }
  if (!Number.isSafeInteger(expectedAmountCents) || expectedAmountCents <= 0) {
    problems.push('expected_amount_invalid')
  }
  if (!expectedCustomerId) problems.push('expected_customer_missing')
  if (!expectedCheckoutSessionId) problems.push('expected_checkout_session_missing')
  if (String(session?.payment_status ?? '') !== 'paid') problems.push('checkout_not_paid')
  if (String(session?.currency ?? '').toLowerCase() !== 'usd') problems.push('currency_not_usd')
  if (!payment?.id) problems.push('payment_missing')
  if (Number(payment?.family_billing_account_id) !== expectedAccountId) {
    problems.push('account_mismatch')
  }
  if (Number(payment?.amount_cents) !== expectedAmountCents) problems.push('amount_mismatch')
  if (String(payment?.external_processor ?? '') !== 'stripe') problems.push('processor_mismatch')
  if (
    !['settled', 'succeeded'].includes(String(payment?.external_status ?? ''))
    && !exactNonAllocatablePayment
  ) {
    problems.push('status_not_settled')
  }
  if (String(payment?.stripe_customer_id ?? '') !== String(expectedCustomerId ?? '')) {
    problems.push('customer_mismatch')
  }
  if (
    String(payment?.stripe_checkout_session_id ?? '')
    !== String(expectedCheckoutSessionId ?? '')
  ) problems.push('checkout_session_mismatch')
  if (
    String(payment?.stripe_payment_intent_id ?? '')
    !== String(expectedPaymentIntentId ?? '')
  ) problems.push('payment_intent_mismatch')
  if (
    expectedInvoiceId
    && String(payment?.stripe_invoice_id ?? '') !== String(expectedInvoiceId)
  ) problems.push('invoice_mismatch')

  if (problems.length > 0) {
    throw new StripeEnrollmentPaymentBindingConflict(
      `Stripe Checkout ${expectedCheckoutSessionId ?? '(missing)'} does not have one exact settled billing payment.`,
      {
        problems,
        expectedAccountId,
        expectedAmountCents,
        expectedCustomerId,
        expectedCheckoutSessionId,
        expectedPaymentIntentId,
        expectedInvoiceId,
        recordedPaymentId: payment?.id ?? null,
        recordedAccountId: payment?.family_billing_account_id ?? null,
        recordedAmountCents: payment?.amount_cents ?? null,
        recordedCustomerId: payment?.stripe_customer_id ?? null,
        recordedCheckoutSessionId: payment?.stripe_checkout_session_id ?? null,
        recordedPaymentIntentId: payment?.stripe_payment_intent_id ?? null,
        recordedInvoiceId: payment?.stripe_invoice_id ?? null,
        recordedProcessor: payment?.external_processor ?? null,
        recordedStatus: payment?.external_status ?? null,
      },
    )
  }
  return payment
}

/**
 * Idempotently record enrollment Checkout payment (handles subscription-mode invoice PI).
 * Returned row carries `newly_inserted` (true only on first insert; xmax=0 detects
 * insert vs conflict-update), used to fire the GA4 purchase event exactly once.
 */
export async function recordEnrollmentStripePayment(pool, stripe, {
  session,
  accountId,
  paidAt = null,
  fulfillmentPending = false,
} = {}) {
  session ??= {}
  const amountCents = Number(session.amount_total)
  const customerId = stripeObjectId(session.customer)
  const checkoutSessionId = stripeObjectId(session)
  const refundMarker = checkoutSessionId ? paidCheckoutRefundMarker(checkoutSessionId) : null
  const pendingMarker = checkoutSessionId
    ? paidCheckoutFulfillmentPendingMarker(checkoutSessionId)
    : null
  const initialExternalStatus = fulfillmentPending ? 'reconciliation_required' : 'settled'
  const initialNote = fulfillmentPending ? pendingMarker : null
  const normalizedAccountId = Number(accountId)
  const zeroAmountSetup = (
    session.mode === 'setup'
    && (session.amount_total == null || amountCents === 0)
  )
  const expectedProblems = []
  if (!Number.isSafeInteger(normalizedAccountId) || normalizedAccountId <= 0) {
    expectedProblems.push('expected_account_missing')
  }
  if (!checkoutSessionId) expectedProblems.push('expected_checkout_session_missing')
  if (!customerId) expectedProblems.push('expected_customer_missing')
  if (String(session.currency ?? '').toLowerCase() !== 'usd') {
    expectedProblems.push('currency_not_usd')
  }
  if (zeroAmountSetup) {
    if (session.status !== 'complete' || session.payment_status !== 'no_payment_required') {
      expectedProblems.push('setup_not_complete')
    }
  } else {
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      expectedProblems.push('expected_amount_invalid')
    }
    if (session.payment_status !== 'paid') expectedProblems.push('checkout_not_paid')
  }
  if (expectedProblems.length > 0) {
    throw new StripeEnrollmentPaymentBindingConflict(
      `Stripe Checkout ${checkoutSessionId ?? '(missing)'} is missing exact payment identity.`,
      {
        problems: expectedProblems,
        expectedAccountId: Number.isSafeInteger(normalizedAccountId) ? normalizedAccountId : null,
        expectedAmountCents: Number.isSafeInteger(amountCents) ? amountCents : null,
        expectedCustomerId: customerId,
        expectedCheckoutSessionId: checkoutSessionId,
      },
    )
  }
  const noPaymentSetup = (
    zeroAmountSetup
    && session.status === 'complete'
    && session.payment_status === 'no_payment_required'
    && String(session.currency ?? '').toLowerCase() === 'usd'
    && Number.isSafeInteger(normalizedAccountId)
    && normalizedAccountId > 0
    && customerId
    && checkoutSessionId
  )
  // A completed $0 Setup Checkout establishes a reusable method but is not a
  // payment and must not create a settled billing_payment row.
  if (noPaymentSetup) return null

  await ensureStripeBillingSchema(pool)
  await ensureBillingStripeLinksSchema(pool)

  const { paymentIntentId, invoiceId } = await resolveEnrollmentCheckoutPayment(stripe, session)
  // Validate every expected identity field before the INSERT. Otherwise an
  // exported caller could create a malformed row and only discover it when
  // validating RETURNING after the mutation.
  assertEnrollmentStripePaymentBinding({
    id: 'expected-checkout-payment',
    family_billing_account_id: Number(accountId),
    amount_cents: amountCents,
    external_processor: 'stripe',
    external_status: 'settled',
    stripe_customer_id: customerId,
    stripe_payment_intent_id: paymentIntentId,
    stripe_checkout_session_id: checkoutSessionId,
    stripe_invoice_id: invoiceId,
  }, {
    session,
    accountId,
    paymentIntentId,
    invoiceId,
  })
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
           external_status, note, stripe_customer_id, stripe_payment_intent_id,
           stripe_checkout_session_id, stripe_invoice_id)
        VALUES ($1, $2, $3, $4, 'stripe', $11, $12, $5, $6, $7, $8)
        ON CONFLICT (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL
        DO UPDATE SET
          external_status = CASE
            WHEN EXCLUDED.external_status = 'reconciliation_required'
              THEN 'reconciliation_required'
            ELSE billing_payment.external_status
          END,
          note = CASE
            WHEN EXCLUDED.external_status = 'reconciliation_required'
              AND position($9 in COALESCE(billing_payment.note, '')) = 0
              AND position($10 in COALESCE(billing_payment.note, '')) = 0
            THEN CONCAT_WS(' ', NULLIF(BTRIM(billing_payment.note), ''), $10)
            ELSE billing_payment.note
          END,
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
        WHERE billing_payment.family_billing_account_id = EXCLUDED.family_billing_account_id
          AND billing_payment.amount_cents = EXCLUDED.amount_cents
          AND billing_payment.external_processor = 'stripe'
          AND (
            billing_payment.external_status IN ('settled', 'succeeded')
            OR (
              billing_payment.external_status = 'reconciliation_required'
              AND (
                position($9 in COALESCE(billing_payment.note, '')) > 0
                OR position($10 in COALESCE(billing_payment.note, '')) > 0
              )
            )
          )
          AND billing_payment.stripe_customer_id IS NOT DISTINCT FROM EXCLUDED.stripe_customer_id
          AND (
            billing_payment.stripe_checkout_session_id IS NULL
            OR billing_payment.stripe_checkout_session_id = EXCLUDED.stripe_checkout_session_id
          )
          AND (
            EXCLUDED.stripe_invoice_id IS NULL
            OR billing_payment.stripe_invoice_id IS NULL
            OR billing_payment.stripe_invoice_id = EXCLUDED.stripe_invoice_id
          )
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
        refundMarker,
        pendingMarker,
        initialExternalStatus,
        initialNote,
      ],
    )
    const payment = assertEnrollmentStripePaymentBinding(result.rows[0] ?? null, {
      session,
      accountId,
      paymentIntentId,
      invoiceId,
    })
    return payment
  }

  const method = await resolveStripePaymentMethodLabel(stripe, { checkoutSessionId })
  const result = await pool.query(
    `
      INSERT INTO billing_payment
        (family_billing_account_id, amount_cents, paid_at, method, external_processor,
         external_status, note, stripe_customer_id, stripe_checkout_session_id, stripe_invoice_id)
      VALUES ($1, $2, $3, $4, 'stripe', $10, $11, $5, $6, $7)
      ON CONFLICT (stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL
      DO UPDATE SET
        external_status = CASE
          WHEN EXCLUDED.external_status = 'reconciliation_required'
            THEN 'reconciliation_required'
          ELSE billing_payment.external_status
        END,
        note = CASE
          WHEN EXCLUDED.external_status = 'reconciliation_required'
            AND position($8 in COALESCE(billing_payment.note, '')) = 0
            AND position($9 in COALESCE(billing_payment.note, '')) = 0
          THEN CONCAT_WS(' ', NULLIF(BTRIM(billing_payment.note), ''), $9)
          ELSE billing_payment.note
        END,
        stripe_invoice_id = COALESCE(billing_payment.stripe_invoice_id, EXCLUDED.stripe_invoice_id),
        method = CASE
          WHEN billing_payment.method IS NULL
            OR lower(trim(billing_payment.method)) IN ('card', 'credit card', 'debit card', '')
          THEN EXCLUDED.method
          ELSE billing_payment.method
        END
      WHERE billing_payment.family_billing_account_id = EXCLUDED.family_billing_account_id
        AND billing_payment.amount_cents = EXCLUDED.amount_cents
        AND billing_payment.external_processor = 'stripe'
        AND (
          billing_payment.external_status IN ('settled', 'succeeded')
          OR (
            billing_payment.external_status = 'reconciliation_required'
            AND (
              position($8 in COALESCE(billing_payment.note, '')) > 0
              OR position($9 in COALESCE(billing_payment.note, '')) > 0
            )
          )
        )
        AND billing_payment.stripe_customer_id IS NOT DISTINCT FROM EXCLUDED.stripe_customer_id
        AND billing_payment.stripe_payment_intent_id IS NULL
        AND (
          EXCLUDED.stripe_invoice_id IS NULL
          OR billing_payment.stripe_invoice_id IS NULL
          OR billing_payment.stripe_invoice_id = EXCLUDED.stripe_invoice_id
        )
      RETURNING *, (xmax = 0) AS newly_inserted
    `,
    [
      accountId,
      amountCents,
      paidAtValue,
      method,
      customerId,
      checkoutSessionId,
      invoiceId,
      refundMarker,
      pendingMarker,
      initialExternalStatus,
      initialNote,
    ],
  )
  const payment = assertEnrollmentStripePaymentBinding(result.rows[0] ?? null, {
    session,
    accountId,
    paymentIntentId: null,
    invoiceId,
  })

  return payment
}

/** Promote one exact fulfilled Checkout payment into the allocatable ledger. */
export async function settlePaidCheckoutFulfillment(pool, {
  session,
  accountId,
  payment,
} = {}) {
  const checkoutSessionId = stripeObjectId(session)
  const normalizedAccountId = Number(accountId)
  const pendingMarker = checkoutSessionId
    ? paidCheckoutFulfillmentPendingMarker(checkoutSessionId)
    : null
  const refundMarker = checkoutSessionId ? paidCheckoutRefundMarker(checkoutSessionId) : null
  if (
    !checkoutSessionId
    || !Number.isSafeInteger(normalizedAccountId)
    || normalizedAccountId <= 0
    || !payment?.id
    || !pendingMarker
  ) {
    throw new Error('Settling Checkout fulfillment requires an exact payment, account, and session.')
  }
  const paymentIntentId = payment.stripe_payment_intent_id ?? null
  const invoiceId = payment.stripe_invoice_id ?? null
  const settled = await pool.query(
    `UPDATE billing_payment
        SET external_status = 'settled',
            note = NULLIF(BTRIM(REPLACE(COALESCE(note, ''), $8, '')), '')
      WHERE id = $1
        AND family_billing_account_id = $2
        AND amount_cents = $3
        AND stripe_checkout_session_id = $4
        AND stripe_customer_id = $5
        AND stripe_payment_intent_id IS NOT DISTINCT FROM $6
        AND stripe_invoice_id IS NOT DISTINCT FROM $7
        AND external_processor = 'stripe'
        AND (
          external_status IN ('settled', 'succeeded')
          OR (
            external_status = 'reconciliation_required'
            AND position($8 in COALESCE(note, '')) > 0
            AND position($9 in COALESCE(note, '')) = 0
          )
        )
      RETURNING *`,
    [
      Number(payment.id),
      normalizedAccountId,
      Number(session?.amount_total),
      checkoutSessionId,
      stripeObjectId(session?.customer),
      paymentIntentId,
      invoiceId,
      pendingMarker,
      refundMarker,
    ],
  ).then((result) => result.rows[0] ?? null)
  if (!settled) {
    throw new Error(`Paid Checkout payment ${payment.id} changed before fulfillment could be settled.`)
  }
  settled.newly_inserted = payment.newly_inserted === true
  return settled
}

/**
 * Apply a paid Checkout only to the positive charges durably stamped with that
 * exact Session, then promote the payment. Callers must hold the household's
 * session-level collection lock so a monthly invoice cannot reserve the new
 * charges between persistence and this transaction.
 *
 * `targetAmountCents` excludes any explicit carried-forward balance included
 * in enrollment Checkout. The remaining cash is intentionally left available
 * for the normal household allocator after this transaction commits.
 */
export async function applyAndSettlePaidCheckoutFulfillment(db, {
  session,
  accountId,
  payment,
  targetAmountCents,
  applicationNamespace,
  allocationReason,
  manageTransaction = true,
} = {}) {
  const checkoutSessionId = stripeObjectId(session)
  const normalizedAccountId = Number(accountId)
  const normalizedTargetCents = Number(targetAmountCents)
  if (
    !checkoutSessionId
    || !Number.isSafeInteger(normalizedAccountId)
    || normalizedAccountId <= 0
    || !payment?.id
    || !Number.isSafeInteger(normalizedTargetCents)
    || normalizedTargetCents < 0
    || !String(applicationNamespace ?? '').trim()
    || !String(allocationReason ?? '').trim()
  ) {
    throw new Error('Exact Checkout allocation requires a session, payment, account, and target amount.')
  }

  let transactionOpen = false
  try {
    if (manageTransaction) {
      await db.query('BEGIN')
      transactionOpen = true
      await db.query('SELECT pg_advisory_xact_lock($1)', [normalizedAccountId])
    }

    const targets = await db.query(
      `SELECT charge.id,
              charge.amount_cents,
              charge.source_type,
              charge.created_at,
              GREATEST(
                0,
                charge.amount_cents
                  - COALESCE(applications.applied_cents, 0)
                  - COALESCE(credits.applied_cents, 0)
              )::int AS remaining_cents
         FROM billing_charge charge
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(CASE
                    WHEN application.application_kind = 'reversal' THEN -application.amount_cents
                    ELSE application.amount_cents
                  END), 0)::int AS applied_cents
             FROM billing_payment_application application
            WHERE application.billing_charge_id = charge.id
         ) applications ON TRUE
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(application.amount_cents), 0)::int AS applied_cents
             FROM billing_charge_credit_application application
             JOIN billing_monthly_invoice_line target_line
               ON target_line.id = application.target_invoice_line_id
            WHERE target_line.billing_charge_id = charge.id
         ) credits ON TRUE
        WHERE charge.family_billing_account_id = $1
          AND charge.stripe_checkout_session_id = $2
          AND charge.amount_cents > 0
        ORDER BY
          CASE WHEN charge.source_type = 'additional_fee' THEN 0 ELSE 1 END,
          charge.created_at,
          charge.id
        FOR UPDATE OF charge`,
      [normalizedAccountId, checkoutSessionId],
    )
    const taggedNet = await db.query(
      `SELECT COALESCE(SUM(amount_cents), 0)::int AS net_cents
         FROM billing_charge
        WHERE family_billing_account_id = $1
          AND stripe_checkout_session_id = $2`,
      [normalizedAccountId, checkoutSessionId],
    ).then((result) => Number(result.rows[0]?.net_cents ?? 0))
    if (taggedNet !== normalizedTargetCents) {
      throw new Error(
        `Checkout ${checkoutSessionId} expected ${normalizedTargetCents} cents of exact charges but found ${taggedNet}.`,
      )
    }

    const competingCollection = await db.query(
      `SELECT conflict_kind, billing_charge_id
         FROM (
           SELECT 'monthly_invoice'::text AS conflict_kind,
                  charge.id AS billing_charge_id
             FROM billing_charge charge
            WHERE charge.family_billing_account_id = $1
              AND charge.stripe_checkout_session_id = $2
              AND EXISTS (
                SELECT 1
                  FROM billing_monthly_invoice_line line
                  JOIN billing_monthly_invoice invoice
                    ON invoice.id = line.billing_monthly_invoice_id
                 WHERE line.billing_charge_id = charge.id
                   AND invoice.status IN ('draft', 'open', 'failed', 'payment_method_required')
              )
           UNION ALL
           SELECT 'payment_attempt'::text AS conflict_kind,
                  charge.id AS billing_charge_id
             FROM billing_charge charge
            WHERE charge.family_billing_account_id = $1
              AND charge.stripe_checkout_session_id = $2
              AND EXISTS (
                SELECT 1
                  FROM billing_payment_attempt attempt
                  LEFT JOIN billing_payment_attempt_charge reservation
                    ON reservation.billing_payment_attempt_id = attempt.id
                 WHERE attempt.family_billing_account_id = $1
                   AND (
                     attempt.status IN ('pending', 'processing', 'reconciliation_required')
                     OR (attempt.status = 'reserved' AND attempt.expires_at > now())
                   )
                   AND (
                     reservation.billing_charge_id = charge.id
                     OR attempt.target_charge_id = charge.id
                     OR attempt.target_charge_id = charge.related_charge_id
                   )
              )
           UNION ALL
           SELECT 'credit_applied_elsewhere'::text AS conflict_kind,
                  credit.id AS billing_charge_id
             FROM billing_charge credit
             JOIN billing_monthly_invoice_line credit_line
               ON credit_line.billing_charge_id = credit.id
             JOIN billing_charge_credit_application credit_application
               ON credit_application.credit_invoice_line_id = credit_line.id
             JOIN billing_monthly_invoice_line target_line
               ON target_line.id = credit_application.target_invoice_line_id
             LEFT JOIN billing_charge target_charge
               ON target_charge.id = target_line.billing_charge_id
            WHERE credit.family_billing_account_id = $1
              AND credit.stripe_checkout_session_id = $2
              AND credit.amount_cents < 0
              AND target_charge.stripe_checkout_session_id IS DISTINCT FROM $2
         ) conflict
        LIMIT 1`,
      [normalizedAccountId, checkoutSessionId],
    ).then((result) => result.rows[0] ?? null)
    if (competingCollection) {
      const error = new Error(
        `Checkout ${checkoutSessionId} charge ${competingCollection.billing_charge_id} has a competing ${competingCollection.conflict_kind} collection owner.`,
      )
      error.code = 'PAID_CHECKOUT_COMPETING_COLLECTION'
      error.conflictKind = competingCollection.conflict_kind
      throw error
    }

    const refunds = await db.query(
      `SELECT id, amount_cents, COALESCE(external_status, 'succeeded') AS external_status
         FROM billing_refund
        WHERE payment_id = $1
          AND COALESCE(external_status, 'succeeded') IN (
            'pending', 'succeeded', 'reconciliation_required'
          )
        FOR UPDATE`,
      [Number(payment.id)],
    )
    const refundedCents = refunds.rows.reduce(
      (sum, refund) => sum + Math.max(0, Number(refund.amount_cents ?? 0)),
      0,
    )
    if (refundedCents > 0) {
      const error = new Error(
        `Checkout ${checkoutSessionId} was refunded before fulfillment and cannot be promoted.`,
      )
      error.code = 'PAID_CHECKOUT_REFUNDED_BEFORE_FULFILLMENT'
      error.refundedCents = refundedCents
      throw error
    }

    const existing = await db.query(
      `SELECT application.billing_charge_id,
              charge.stripe_checkout_session_id,
              application.amount_cents,
              application.application_kind
         FROM billing_payment_application application
         JOIN billing_charge charge ON charge.id = application.billing_charge_id
        WHERE application.billing_payment_id = $1
        FOR UPDATE OF application`,
      [Number(payment.id)],
    )
    let exactAppliedCents = 0
    let unrelatedAppliedCents = 0
    for (const row of existing.rows) {
      const appliedCents = (
        String(row.application_kind ?? '') === 'reversal' ? -1 : 1
      ) * Number(row.amount_cents ?? 0)
      if (String(row.stripe_checkout_session_id ?? '') === checkoutSessionId) {
        exactAppliedCents += appliedCents
      } else {
        unrelatedAppliedCents += appliedCents
      }
    }
    const checkoutAmountCents = Number(session?.amount_total)
    const allowedRemainderCents = checkoutAmountCents - normalizedTargetCents
    if (exactAppliedCents < 0 || exactAppliedCents > normalizedTargetCents) {
      throw new Error(`Checkout ${checkoutSessionId} has conflicting exact payment applications.`)
    }
    if (
      !Number.isSafeInteger(allowedRemainderCents)
      || allowedRemainderCents < 0
      || unrelatedAppliedCents < 0
      || unrelatedAppliedCents > allowedRemainderCents
      || exactAppliedCents + unrelatedAppliedCents > Number(payment.amount_cents)
    ) {
      throw new Error(
        `Checkout ${checkoutSessionId} payment is already applied outside its permitted exact purchase.`,
      )
    }

    let neededCents = normalizedTargetCents - exactAppliedCents
    for (const charge of targets.rows) {
      if (neededCents <= 0) break
      const availableCents = Math.max(0, Number(charge.remaining_cents ?? 0))
      if (availableCents <= 0) continue
      const amountCents = Math.min(neededCents, availableCents)
      const idempotencyKey = `${String(applicationNamespace).trim()}:charge:${Number(charge.id)}`
      const inserted = await db.query(
        `INSERT INTO billing_payment_application (
           billing_payment_id, billing_charge_id, amount_cents,
           application_kind, idempotency_key, allocation_reason
         ) VALUES ($1, $2, $3, 'application', $4, $5)
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
         RETURNING billing_payment_id, billing_charge_id, amount_cents,
                   application_kind, reverses_application_id,
                   idempotency_key, allocation_reason`,
        [
          Number(payment.id),
          Number(charge.id),
          amountCents,
          idempotencyKey,
          String(allocationReason).trim(),
        ],
      )
      let exactApplication = inserted.rows[0] ?? null
      if (!exactApplication) {
        exactApplication = await db.query(
          `SELECT billing_payment_id, billing_charge_id, amount_cents,
                  application_kind, reverses_application_id,
                  idempotency_key, allocation_reason
             FROM billing_payment_application
            WHERE idempotency_key = $1
            FOR UPDATE`,
          [idempotencyKey],
        ).then((result) => result.rows[0] ?? null)
      }
      if (
        !exactApplication
        || Number(exactApplication.billing_payment_id) !== Number(payment.id)
        || Number(exactApplication.billing_charge_id) !== Number(charge.id)
        || Number(exactApplication.amount_cents) !== amountCents
        || String(exactApplication.application_kind ?? '') !== 'application'
        || exactApplication.reverses_application_id != null
        || String(exactApplication.idempotency_key ?? '') !== idempotencyKey
        || String(exactApplication.allocation_reason ?? '') !== String(allocationReason).trim()
      ) {
        throw new Error(
          `Checkout ${checkoutSessionId} found a conflicting exact application for charge ${charge.id}.`,
        )
      }
      if (inserted.rows[0]) {
        const appliedCents = Number(exactApplication.amount_cents)
        exactAppliedCents += appliedCents
        neededCents -= appliedCents
      }
    }
    if (neededCents !== 0 || exactAppliedCents !== normalizedTargetCents) {
      throw new Error(
        `Checkout ${checkoutSessionId} could not apply its exact ${normalizedTargetCents}-cent purchase.`,
      )
    }

    // Aggregate equality is insufficient for historical rows that predate the
    // deferred per-charge capacity trigger. Prove that this exact payment has
    // not overfunded one Session-tagged charge while leaving another due. A
    // Session-tagged negative order credit may cover the remaining positive
    // balance, but the competing-collection check above proves it has not been
    // consumed by another purchase.
    const taggedUnfundedCents = await db.query(
      `SELECT GREATEST(
                0,
                COALESCE(SUM(positive.unfunded_cents), 0)
                  + COALESCE((
                    SELECT SUM(credit.amount_cents)
                      FROM billing_charge credit
                     WHERE credit.family_billing_account_id = $1
                       AND credit.stripe_checkout_session_id = $2
                       AND credit.amount_cents < 0
                  ), 0)
              )::int AS tagged_unfunded_cents
         FROM (
           SELECT GREATEST(
                    0,
                    charge.amount_cents - COALESCE(exact_application.applied_cents, 0)
                  )::int AS unfunded_cents
             FROM billing_charge charge
             LEFT JOIN LATERAL (
               SELECT COALESCE(SUM(CASE
                        WHEN application.application_kind = 'reversal'
                        THEN -application.amount_cents
                        ELSE application.amount_cents
                      END), 0)::int AS applied_cents
                 FROM billing_payment_application application
                WHERE application.billing_payment_id = $3
                  AND application.billing_charge_id = charge.id
             ) exact_application ON TRUE
            WHERE charge.family_billing_account_id = $1
              AND charge.stripe_checkout_session_id = $2
              AND charge.amount_cents > 0
         ) positive`,
      [normalizedAccountId, checkoutSessionId, Number(payment.id)],
    ).then((result) => Number(result.rows[0]?.tagged_unfunded_cents ?? 0))
    if (taggedUnfundedCents !== 0) {
      throw new Error(
        `Checkout ${checkoutSessionId} has ${taggedUnfundedCents} cents still due on an exact tagged charge.`,
      )
    }

    const settledPayment = await settlePaidCheckoutFulfillment(db, {
      session,
      accountId: normalizedAccountId,
      payment,
    })
    if (manageTransaction) {
      await db.query('COMMIT')
      transactionOpen = false
    }
    return settledPayment
  } catch (error) {
    if (manageTransaction && transactionOpen) await db.query('ROLLBACK').catch(() => {})
    throw error
  }
}

/**
 * Leave durable, idempotent operator evidence when Stripe has collected an
 * exact Checkout payment but mutable local authorization no longer permits the
 * purchased entitlement. The payment itself must be recorded before calling
 * this helper so remote cash is never hidden by the fulfillment quarantine.
 */
export async function recordPaidCheckoutFulfillmentQuarantine(pool, {
  checkoutKind,
  ownerId,
  accountId,
  session,
  payment,
  reason,
}) {
  const normalizedAccountId = Number(accountId)
  const checkoutSessionId = stripeObjectId(session)
  if (
    !checkoutKind
    || !Number.isSafeInteger(Number(ownerId))
    || Number(ownerId) <= 0
    || !Number.isSafeInteger(normalizedAccountId)
    || normalizedAccountId <= 0
    || !checkoutSessionId
    || !payment?.id
  ) {
    throw new Error('A paid Checkout quarantine requires an exact owner, account, session, and payment.')
  }

  const normalizedReason = String(reason ?? 'current_authorization_changed').slice(0, 500)
  const paymentIntentId = stripeObjectId(session?.payment_intent)
    ?? payment.stripe_payment_intent_id
    ?? null
  const invoiceId = stripeObjectId(session?.invoice)
    ?? payment.stripe_invoice_id
    ?? null
  const marker = paidCheckoutRefundMarker(checkoutSessionId)
  const message = [
    `Stripe collected Checkout ${checkoutSessionId}, but ${String(checkoutKind).replaceAll('_', ' ')} fulfillment was quarantined.`,
    `Payment #${payment.id} is recorded on billing account ${normalizedAccountId}.`,
    'Do not grant the entitlement automatically; review and refund this payment unless fulfillment is explicitly approved.',
    `Reason: ${normalizedReason}`,
  ].join(' ')

  const quarantinedPayment = await pool.query(
    `UPDATE billing_payment
        SET external_status = 'reconciliation_required',
            note = CASE
              WHEN position($8 in COALESCE(note, '')) > 0 THEN note
              WHEN COALESCE(note, '') = '' THEN $9
              ELSE note || chr(10) || $9
            END
      WHERE id = $1
        AND family_billing_account_id = $2
        AND amount_cents = $3
        AND stripe_checkout_session_id = $4
        AND stripe_customer_id = $5
        AND stripe_payment_intent_id IS NOT DISTINCT FROM $6
        AND stripe_invoice_id IS NOT DISTINCT FROM $7
        AND external_processor = 'stripe'
        AND external_status IN ('settled', 'succeeded', 'reconciliation_required')
      RETURNING *`,
    [
      Number(payment.id),
      normalizedAccountId,
      Number(session?.amount_total),
      checkoutSessionId,
      stripeObjectId(session?.customer),
      paymentIntentId,
      invoiceId,
      marker,
      `${marker} ${normalizedReason}`.slice(0, 1000),
    ],
  ).then((result) => result.rows[0] ?? null)
  if (!quarantinedPayment) {
    throw new Error(`Paid Checkout payment ${payment.id} changed before it could be quarantined.`)
  }
  quarantinedPayment.newly_inserted = payment.newly_inserted === true

  await pool.query(
    `INSERT INTO stripe_billing_alert
      (stripe_event_id, family_billing_account_id, alert_type, severity,
       stripe_object_id, message, details)
     VALUES ($1, $2, 'paid_checkout_fulfillment_quarantined', 'critical', $3, $4, $5::jsonb)
     ON CONFLICT (stripe_event_id) DO NOTHING`,
    [
      `paid-checkout-fulfillment-quarantined:${String(checkoutKind)}:${checkoutSessionId}`,
      normalizedAccountId,
      checkoutSessionId,
      message,
      JSON.stringify({
        checkoutKind: String(checkoutKind),
        durableOwnerId: Number(ownerId),
        paymentId: Number(payment.id),
        stripeCheckoutSessionId: checkoutSessionId,
        stripePaymentIntentId: paymentIntentId,
        stripeCustomerId: stripeObjectId(session?.customer),
        amountCents: Number(session?.amount_total),
        reason: normalizedReason,
        paymentRecorded: true,
        entitlementGranted: false,
        refundRequired: true,
        manualReviewRequired: true,
      }),
    ],
  )

  return { message, reason: normalizedReason, payment: quarantinedPayment }
}
