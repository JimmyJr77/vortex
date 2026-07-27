/**
 * Keep Stripe Subscriptions in sync with local billing_subscription lifecycle.
 * Best-effort: enrollment actions succeed even when Stripe is disabled or IDs are missing.
 */

import { getStripeClient, stripeEnabled } from './stripeBilling.js'

/** UTC midnight for a YYYY-MM-DD date → Unix seconds (Stripe cancel_at). */
export function billingDateToUnixStart(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return Math.floor(Date.UTC(y, m - 1, d) / 1000)
}

/**
 * Update a Stripe subscription's recurring unit amount (household discount changes).
 * Uses proration_behavior=none so trial / next invoice picks up the new price cleanly.
 */
export async function updateStripeSubscriptionUnitAmount(
  stripeSubscriptionId,
  amountCents,
  { productName = null } = {},
) {
  if (!stripeSubscriptionId) return { status: 'skipped', reason: 'missing_id' }
  const cents = Math.max(0, Math.round(Number(amountCents) || 0))
  if (!Number.isFinite(cents)) return { status: 'skipped', reason: 'invalid_amount' }
  if (!stripeEnabled()) return { status: 'skipped', reason: 'stripe_disabled' }

  const stripe = await getStripeClient()
  if (!stripe) return { status: 'skipped', reason: 'stripe_unavailable' }

  try {
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ['items.data.price.product'],
    })
    const item = sub.items?.data?.[0]
    if (!item) return { status: 'skipped', reason: 'no_item' }

    const currentAmount = Number(item.price?.unit_amount ?? 0)
    if (currentAmount === cents) return { status: 'unchanged', amountCents: cents }

    let productId =
      typeof item.price?.product === 'object' ? item.price.product?.id : item.price?.product
    if (!productId) {
      const product = await stripe.products.create({
        name: String(productName || 'Monthly class membership').slice(0, 200),
        metadata: { vortex_ad_hoc_enrollment_price: 'true' },
      })
      productId = product.id
    }

    const price = await stripe.prices.create({
      product: productId,
      currency: 'usd',
      unit_amount: cents,
      recurring: { interval: item.price?.recurring?.interval || 'month' },
      metadata: {
        vortex_net_monthly: 'true',
        vortex_discount_sync: 'true',
      },
    })

    await stripe.subscriptions.update(stripeSubscriptionId, {
      items: [{ id: item.id, price: price.id }],
      proration_behavior: 'none',
    })
    return { status: 'updated', amountCents: cents, previousAmountCents: currentAmount }
  } catch (err) {
    console.warn('[stripe] update subscription amount:', err?.message ?? err)
    return { status: 'error', reason: err?.message ?? String(err) }
  }
}

/**
 * Push local net_monthly_cents onto each active Stripe subscription for a family.
 */
export async function syncFamilyStripeSubscriptionAmounts(pool, familyId) {
  if (!familyId) return { updated: 0, results: [] }
  if (!stripeEnabled()) return { updated: 0, results: [], reason: 'stripe_disabled' }

  const res = await pool.query(
    `
      SELECT bs.id, bs.stripe_subscription_id, bs.net_monthly_cents, bs.description
      FROM billing_subscription bs
      JOIN family_billing_account fba ON fba.id = bs.family_billing_account_id
      WHERE fba.family_id = $1
        AND bs.status = 'active'
        AND bs.stripe_subscription_id IS NOT NULL
    `,
    [familyId],
  )

  const results = []
  let updated = 0
  for (const row of res.rows) {
    const outcome = await updateStripeSubscriptionUnitAmount(
      row.stripe_subscription_id,
      row.net_monthly_cents,
      { productName: row.description },
    )
    results.push({
      billingSubscriptionId: Number(row.id),
      stripeSubscriptionId: row.stripe_subscription_id,
      ...outcome,
    })
    if (outcome.status === 'updated') updated += 1
  }
  return { updated, results }
}

/**
 * Schedule Stripe subscription cancellation on a billing anchor date (1st of month).
 * @returns {Promise<{ status: string, reason?: string }>}
 */
export async function scheduleStripeSubscriptionEnd(stripeSubscriptionId, effectiveDate) {
  if (!stripeSubscriptionId || !effectiveDate) {
    return { status: 'skipped', reason: 'missing_id_or_date' }
  }
  if (!stripeEnabled()) return { status: 'skipped', reason: 'stripe_disabled' }

  const stripe = await getStripeClient()
  if (!stripe) return { status: 'skipped', reason: 'stripe_unavailable' }

  const cancelAt = billingDateToUnixStart(effectiveDate)
  if (cancelAt == null) return { status: 'skipped', reason: 'invalid_date' }

  try {
    await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at: cancelAt,
      proration_behavior: 'none',
    })
    return { status: 'scheduled' }
  } catch (err) {
    console.warn('[stripe] schedule subscription end:', err?.message ?? err)
    return { status: 'error', reason: err?.message ?? String(err) }
  }
}

/**
 * Cancel a Stripe subscription immediately (waitlist removal / effective date reached).
 * @returns {Promise<{ status: string, reason?: string }>}
 */
export async function cancelStripeSubscriptionNow(stripeSubscriptionId) {
  if (!stripeSubscriptionId) return { status: 'skipped', reason: 'missing_id' }
  if (!stripeEnabled()) return { status: 'skipped', reason: 'stripe_disabled' }

  const stripe = await getStripeClient()
  if (!stripe) return { status: 'skipped', reason: 'stripe_unavailable' }

  try {
    await stripe.subscriptions.cancel(stripeSubscriptionId)
    return { status: 'cancelled' }
  } catch (err) {
    const msg = err?.message ?? String(err)
    if (/No such subscription|already been canceled|already canceled/i.test(msg)) {
      return { status: 'already_cancelled' }
    }
    console.warn('[stripe] cancel subscription:', msg)
    return { status: 'error', reason: msg }
  }
}

/** Keep manual admin pause/resume actions aligned with Stripe collection state. */
export async function setStripeSubscriptionOperationalStatus(stripeSubscriptionId, status) {
  if (!stripeSubscriptionId) return { status: 'skipped', reason: 'missing_id' }
  if (!stripeEnabled()) return { status: 'skipped', reason: 'stripe_disabled' }
  if (status === 'cancelled') return cancelStripeSubscriptionNow(stripeSubscriptionId)
  const stripe = await getStripeClient()
  if (!stripe) return { status: 'error', reason: 'stripe_unavailable' }
  try {
    if (status === 'paused') {
      await stripe.subscriptions.update(stripeSubscriptionId, {
        pause_collection: { behavior: 'void' },
      })
      return { status: 'paused' }
    }
    if (status === 'active') {
      await stripe.subscriptions.update(stripeSubscriptionId, {
        pause_collection: null,
        cancel_at_period_end: false,
      })
      return { status: 'active' }
    }
    return { status: 'skipped', reason: 'unsupported_status' }
  } catch (error) {
    return { status: 'error', reason: error?.message ?? String(error) }
  }
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {{ sourceType?: string, sourceId: number|string, effectiveDate?: string|null, immediate?: boolean }} opts
 */
export async function syncStripeForBillingSource(db, {
  sourceType = 'scheduling_signup',
  sourceId,
  effectiveDate = null,
  immediate = false,
}) {
  if (sourceId == null) return []

  let rows = []
  try {
    const res = await db.query(
      `
        SELECT id, stripe_subscription_id
        FROM billing_subscription
        WHERE source_type = $1 AND source_id = $2 AND status <> 'cancelled'
      `,
      [sourceType, String(sourceId)],
    )
    rows = res.rows
  } catch (err) {
    console.warn('[stripe] load billing_subscription for sync skipped:', err?.message ?? err)
    return []
  }

  const outcomes = []
  for (const row of rows) {
    const stripeId = row.stripe_subscription_id
    if (!stripeId) {
      outcomes.push({ subscriptionId: Number(row.id), status: 'skipped', reason: 'no_stripe_id' })
      continue
    }
    const result = immediate
      ? await cancelStripeSubscriptionNow(stripeId)
      : await scheduleStripeSubscriptionEnd(stripeId, effectiveDate)
    outcomes.push({ subscriptionId: Number(row.id), stripeSubscriptionId: stripeId, ...result })
  }
  return outcomes
}
