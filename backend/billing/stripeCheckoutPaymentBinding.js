function objectId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

const VORTEX_PAYMENT_CHECKOUT_TYPES = new Set([
  'store',
  'enrollment',
  'annual_membership',
  'outstanding_balance',
  'custom_charge',
  'billing_charge_payment_request',
])

export const STRIPE_PAYMENT_OWNER_GRACE_MS = 15 * 60 * 1000

export class StripeCheckoutPaymentBindingConflict extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'StripeCheckoutPaymentBindingConflict'
    this.code = 'stripe_checkout_payment_binding_conflict'
    this.details = details
  }
}

function conflict(message, details = {}) {
  throw new StripeCheckoutPaymentBindingConflict(message, details)
}

async function listCheckoutSessionsByPaymentIntent(stripe, paymentIntentId) {
  if (typeof stripe?.checkout?.sessions?.list !== 'function') {
    conflict(
      `Stripe Checkout Sessions are unavailable while resolving PaymentIntent ${paymentIntentId}.`,
      { stripePaymentIntentId: paymentIntentId },
    )
  }

  const params = { payment_intent: paymentIntentId, limit: 100 }
  const listing = stripe.checkout.sessions.list(params)
  const rows = []

  // stripe-node's ApiListPromise is an async iterable that exhausts every page.
  if (typeof listing?.[Symbol.asyncIterator] === 'function') {
    for await (const session of listing) {
      rows.push(session)
      if (rows.length > 1) break
    }
    return rows
  }

  let page = await listing
  const cursors = new Set()
  while (page) {
    if (!Array.isArray(page.data) || typeof page.has_more !== 'boolean') {
      conflict(
        `Stripe Checkout Session pagination is incomplete for PaymentIntent ${paymentIntentId}.`,
        {
          stripePaymentIntentId: paymentIntentId,
          hasData: Array.isArray(page?.data),
          hasMore: page?.has_more ?? null,
        },
      )
    }
    rows.push(...page.data)
    if (rows.length > 1 || page.has_more === false) return rows

    const cursor = objectId(page.data.at(-1))
    if (!cursor || cursors.has(cursor)) {
      conflict(
        `Stripe Checkout Session pagination did not advance for PaymentIntent ${paymentIntentId}.`,
        { stripePaymentIntentId: paymentIntentId, cursor },
      )
    }
    cursors.add(cursor)
    page = await stripe.checkout.sessions.list({ ...params, starting_after: cursor })
  }
  conflict(
    `Stripe Checkout Session pagination ended before proving completeness for PaymentIntent ${paymentIntentId}.`,
    { stripePaymentIntentId: paymentIntentId, checkoutSessionCount: rows.length },
  )
}

function exactCurrency(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : null
}

function positiveMetadataInteger(metadata, key) {
  const value = Number(metadata?.[key])
  return Number.isSafeInteger(value) && value > 0
}

function checkoutOwnerMetadataProblems(checkoutType, metadata) {
  const problems = []
  if (checkoutType === 'store') {
    if (!positiveMetadataInteger(metadata, 'storeOrderId')) problems.push('store_order_id_missing')
    return problems
  }
  if (checkoutType === 'enrollment') {
    for (const key of ['pendingEnrollmentId', 'familyBillingAccountId', 'memberId', 'payerMemberId']) {
      if (!positiveMetadataInteger(metadata, key)) problems.push(`${key}_missing`)
    }
    return problems
  }
  if (checkoutType === 'annual_membership') {
    for (const key of ['annualMembershipCheckoutRequestId', 'familyBillingAccountId', 'payerMemberId']) {
      if (!positiveMetadataInteger(metadata, key)) problems.push(`${key}_missing`)
    }
    if (!String(metadata?.pricingSnapshotHash ?? '').trim()) problems.push('pricing_snapshot_hash_missing')
    return problems
  }
  if (
    checkoutType === 'outstanding_balance'
    || checkoutType === 'custom_charge'
    || checkoutType === 'billing_charge_payment_request'
  ) {
    if (!positiveMetadataInteger(metadata, 'familyBillingAccountId')) {
      problems.push('familyBillingAccountId_missing')
    }
    if (!positiveMetadataInteger(metadata, 'billingPaymentAttemptId')) {
      problems.push('billingPaymentAttemptId_missing')
    }
    if (
      (checkoutType === 'custom_charge' || checkoutType === 'billing_charge_payment_request')
      && !positiveMetadataInteger(metadata, 'billingChargeId')
    ) {
      problems.push('billingChargeId_missing')
    }
  }
  return problems
}

/**
 * Find the one Stripe Checkout Session, if any, that owns a PaymentIntent.
 * A paid result is safe to delegate to the idempotent Checkout Session webhook;
 * a pending result represents a short Stripe event-ordering window and must not
 * be treated as permanent, generic billing ownership.
 */
export async function inspectStripePaymentIntentCheckoutSession(stripe, paymentIntent) {
  const paymentIntentId = objectId(paymentIntent)
  if (!paymentIntentId) {
    conflict('Stripe PaymentIntent is missing its identifier.')
  }

  const rows = await listCheckoutSessionsByPaymentIntent(stripe, paymentIntentId)
  if (rows.length === 0) return null
  if (rows.length !== 1) {
    conflict(
      `Stripe PaymentIntent ${paymentIntentId} is linked to multiple Checkout Sessions.`,
      {
        stripePaymentIntentId: paymentIntentId,
        stripeCheckoutSessionIds: rows.map((row) => objectId(row)),
      },
    )
  }

  const session = rows[0]
  const sessionId = objectId(session)
  const checkoutType = String(session?.metadata?.checkoutType ?? '').trim()
  const amountReceived = paymentIntent?.amount_received
  const amountTotal = session?.amount_total
  const paymentIntentCurrency = exactCurrency(paymentIntent?.currency)
  const sessionCurrency = exactCurrency(session?.currency)
  const paymentIntentCustomerId = objectId(paymentIntent?.customer)
  const sessionCustomerId = objectId(session?.customer)
  const metadata = session?.metadata ?? {}
  const problems = []

  if (!sessionId) problems.push('checkout_session_id_missing')
  if (paymentIntent?.status !== 'succeeded') problems.push('payment_intent_not_succeeded')
  if (objectId(session?.payment_intent) !== paymentIntentId) problems.push('payment_intent_mismatch')
  if (session?.mode !== 'payment') problems.push('checkout_mode_not_payment')
  if (!VORTEX_PAYMENT_CHECKOUT_TYPES.has(checkoutType)) problems.push('checkout_type_unrecognized')
  problems.push(...checkoutOwnerMetadataProblems(checkoutType, metadata))
  if (!Number.isSafeInteger(amountReceived) || amountReceived <= 0) problems.push('payment_intent_amount_invalid')
  if (!Number.isSafeInteger(amountTotal) || amountTotal !== amountReceived) problems.push('checkout_amount_mismatch')
  if (paymentIntentCurrency !== 'usd' || sessionCurrency !== 'usd') problems.push('checkout_currency_mismatch')
  if (!sessionCustomerId && !paymentIntentCustomerId && checkoutType !== 'store') {
    problems.push('checkout_customer_missing')
  } else if (String(sessionCustomerId ?? '') !== String(paymentIntentCustomerId ?? '')) {
    problems.push('checkout_customer_mismatch')
  }

  if (problems.length > 0) {
    conflict(
      `Stripe Checkout Session ${sessionId ?? '(missing)'} does not exactly match PaymentIntent ${paymentIntentId}.`,
      {
        stripePaymentIntentId: paymentIntentId,
        stripeCheckoutSessionId: sessionId,
        checkoutType: checkoutType || null,
        paymentIntentAmountReceived: amountReceived ?? null,
        checkoutAmountTotal: amountTotal ?? null,
        paymentIntentCurrency,
        checkoutCurrency: sessionCurrency,
        paymentIntentCustomerId,
        checkoutCustomerId: sessionCustomerId,
        problems,
      },
    )
  }

  const state = session.status === 'complete' && session.payment_status === 'paid'
    ? 'paid'
    : 'pending'
  return { state, session, checkoutType }
}

export function stripePaymentIntentOwnershipIsFresh(paymentIntent, {
  event = null,
  nowMs = Date.now(),
  graceMs = STRIPE_PAYMENT_OWNER_GRACE_MS,
} = {}) {
  const createdSeconds = Number(event?.created ?? paymentIntent?.created)
  if (!Number.isFinite(createdSeconds) || createdSeconds <= 0) return false
  const ageMs = Number(nowMs) - createdSeconds * 1000
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < Math.max(0, Number(graceMs) || 0)
}
