/**
 * GA4 Measurement Protocol sender — server-side conversion events.
 *
 * The Stripe webhook is the authoritative source for `purchase` events
 * (browser return URLs can be refreshed, revisited, or blocked). Events are
 * deduplicated upstream: emit helpers only fire when the billing_payment row
 * was newly inserted (see recordStripePayment / recordEnrollmentStripePayment),
 * so webhook retries and the browser confirm backup never double-send.
 *
 * No-op unless GA4_MEASUREMENT_ID and GA4_API_SECRET are set.
 * Never sends PII — only transaction/program/amount metadata.
 */

const MP_ENDPOINT = 'https://www.google-analytics.com/mp/collect'

export function ga4MeasurementEnabled() {
  return Boolean(process.env.GA4_MEASUREMENT_ID && process.env.GA4_API_SECRET)
}

/**
 * Low-level Measurement Protocol send. Swallows errors (analytics must never
 * break payment processing); logs a warning on failure.
 */
export async function sendGa4MpEvent({ clientId, sessionId, name, params = {} }) {
  if (!ga4MeasurementEnabled() || !clientId || !name) return false
  const url = `${MP_ENDPOINT}?measurement_id=${encodeURIComponent(process.env.GA4_MEASUREMENT_ID)}&api_secret=${encodeURIComponent(process.env.GA4_API_SECRET)}`
  const body = {
    client_id: String(clientId),
    timestamp_micros: Date.now() * 1000,
    events: [
      {
        name,
        params: {
          ...(sessionId ? { session_id: String(sessionId) } : {}),
          ...params,
        },
      },
    ],
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    // MP returns 2xx even for malformed payloads; non-2xx means transport/auth issues.
    if (!res.ok) {
      console.warn(`[ga4-mp] ${name} send failed: HTTP ${res.status}`)
      return false
    }
    return true
  } catch (err) {
    console.warn(`[ga4-mp] ${name} send failed:`, err?.message ?? err)
    return false
  }
}

function parseJsonColumn(value) {
  if (value == null) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

/** GA4 ecommerce items from a stored enrollment order preview (no PII). */
export function purchaseItemsFromPreview(preview) {
  if (!preview) return []
  const items = []
  for (const line of preview.newSignups ?? []) {
    items.push({
      item_id: line.formId != null ? String(line.formId) : 'class',
      item_name: String(line.displayLine ?? line.formTitle ?? 'Class enrollment').slice(0, 100),
      item_category: line.billingType === 'recurring' ? 'Recurring Program' : 'One-time Program',
      price: Number(line.monthlyPrice ?? line.incrementalMonthly ?? 0),
      quantity: 1,
    })
  }
  for (const pass of preview.passPurchases ?? []) {
    items.push({
      item_id: `pass_${pass.programsId ?? ''}_${pass.packageId ?? ''}`,
      item_name: String(pass.packageLabel ?? pass.label ?? 'Multi-class pass').slice(0, 100),
      item_category: 'Class Pass',
      price: Number(pass.priceCents ?? 0) / 100,
      quantity: 1,
    })
  }
  return items
}

/**
 * Attribution context captured at checkout creation.
 * Enrollment checkouts store it in stripe_pending_enrollment.payload.analytics;
 * balance checkouts carry gaClientId/gaSessionId in Stripe session metadata.
 */
async function resolveCheckoutAnalyticsContext(pool, session) {
  const metadata = session?.metadata ?? {}
  const context = {
    gaClientId: metadata.gaClientId || null,
    gaSessionId: metadata.gaSessionId || null,
    preview: null,
    checkoutMode: null,
  }

  const pendingId = metadata.pendingEnrollmentId ? Number(metadata.pendingEnrollmentId) : null
  if (pendingId) {
    try {
      const res = await pool.query(
        `SELECT payload, preview_snapshot, checkout_mode FROM stripe_pending_enrollment WHERE id = $1`,
        [pendingId],
      )
      const row = res.rows[0]
      if (row) {
        const payload = parseJsonColumn(row.payload)
        context.gaClientId = payload?.analytics?.gaClientId || context.gaClientId
        context.gaSessionId = payload?.analytics?.gaSessionId || context.gaSessionId
        context.preview = parseJsonColumn(row.preview_snapshot)
        context.checkoutMode = row.checkout_mode ?? null
      }
    } catch (err) {
      console.warn('[ga4-mp] pending enrollment lookup failed:', err?.message ?? err)
    }
  }
  return context
}

/**
 * Send a GA4 `purchase` for a newly recorded Stripe payment. Fire-and-forget:
 * callers should `void`/`.catch(() => {})` this; it never throws.
 *
 * @param payment billing_payment row returned by recordStripePayment /
 *   recordEnrollmentStripePayment — must carry `newly_inserted === true`.
 * @param paymentType 'initial_enrollment' | 'outstanding_balance'
 */
export async function emitStripePurchaseEvent(pool, { payment, session, paymentType }) {
  try {
    if (!ga4MeasurementEnabled()) return
    if (!payment || payment.newly_inserted !== true) return

    const context = await resolveCheckoutAnalyticsContext(pool, session)
    // Without a captured client id the purchase still lands in GA4 (unattributed)
    // so revenue reporting stays complete.
    const clientId = context.gaClientId || `server.${payment.id}`
    const transactionId =
      payment.stripe_payment_intent_id || payment.stripe_checkout_session_id || `payment_${payment.id}`
    const valueCents = Number(payment.amount_cents) || Number(session?.amount_total) || 0
    const enrollmentType =
      paymentType === 'initial_enrollment'
        ? context.checkoutMode === 'subscription'
          ? 'recurring'
          : 'one_time'
        : undefined
    const items = paymentType === 'initial_enrollment' ? purchaseItemsFromPreview(context.preview) : []

    await sendGa4MpEvent({
      clientId,
      sessionId: context.gaSessionId,
      name: 'purchase',
      params: {
        transaction_id: transactionId,
        value: valueCents / 100,
        currency: 'USD',
        payment_type: paymentType,
        ...(enrollmentType ? { enrollment_type: enrollmentType } : {}),
        ...(items.length ? { items } : {}),
      },
    })
  } catch (err) {
    console.warn('[ga4-mp] purchase emit failed:', err?.message ?? err)
  }
}

/**
 * Send a GA4 `payment_failed` diagnostic event when Stripe reports a failed
 * payment. Skipped when no attribution context is resolvable (no PII fallback).
 */
export async function emitStripePaymentFailedEvent(pool, { object, paymentType }) {
  try {
    if (!ga4MeasurementEnabled()) return
    const context = await resolveCheckoutAnalyticsContext(pool, object)
    if (!context.gaClientId) return
    const amountCents = Number(object?.amount_due ?? object?.amount ?? object?.amount_total) || 0
    await sendGa4MpEvent({
      clientId: context.gaClientId,
      sessionId: context.gaSessionId,
      name: 'payment_failed',
      params: {
        value: amountCents / 100,
        currency: 'USD',
        ...(paymentType ? { payment_type: paymentType } : {}),
      },
    })
  } catch (err) {
    console.warn('[ga4-mp] payment_failed emit failed:', err?.message ?? err)
  }
}
