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
 * When productName is provided, moves the subscription onto a dedicated Product so
 * Customer Portal can show class + day/time (catalog products are shared/generic).
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
    const currentProduct =
      typeof item.price?.product === 'object' ? item.price.product : null
    const desiredName = productName ? String(productName).trim().slice(0, 200) : null
    const nameMatches =
      !desiredName || (currentProduct?.name && currentProduct.name === desiredName)
    const isDedicated =
      currentProduct?.metadata?.vortex_per_class_subscription === 'true'

    if (currentAmount === cents && nameMatches && isDedicated) {
      return { status: 'unchanged', amountCents: cents }
    }

    let productId = currentProduct?.id
    if (desiredName && (!isDedicated || !nameMatches)) {
      const product = await stripe.products.create({
        name: desiredName,
        metadata: {
          vortex_per_class_subscription: 'true',
          vortex_discount_sync: 'true',
        },
      })
      productId = product.id
    } else if (!productId) {
      const product = await stripe.products.create({
        name: desiredName || 'Monthly class membership',
        metadata: { vortex_per_class_subscription: 'true' },
      })
      productId = product.id
    } else if (desiredName && isDedicated && !nameMatches) {
      await stripe.products.update(productId, { name: desiredName })
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
      ...(desiredName ? { description: desiredName.slice(0, 500) } : {}),
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
      SELECT bs.id, bs.stripe_subscription_id, bs.net_monthly_cents, bs.description,
             bs.stripe_subscription_schedule_id,
             sf.title AS form_title,
             m.first_name, m.last_name,
             ts.week_letter, ts.schedule_mode, ts.specific_date, ts.day_of_week,
             ts.start_time, ts.end_time
      FROM billing_subscription bs
      JOIN family_billing_account fba ON fba.id = bs.family_billing_account_id
      LEFT JOIN scheduling_signup ss
        ON ss.id::text = bs.source_id AND bs.source_type = 'scheduling_signup'
      LEFT JOIN scheduling_form sf ON sf.id = ss.form_id
      LEFT JOIN member m ON m.id = bs.member_id
      LEFT JOIN scheduling_time_slot ts ON ts.id = ss.time_slot_id
      WHERE fba.family_id = $1
        AND bs.status = 'active'
        AND bs.source_type = 'scheduling_signup'
        AND bs.stripe_subscription_id IS NOT NULL
    `,
    [familyId],
  )

  const { buildSlotDisplayLabel } = await import('../scheduling/slotDisplayLabel.js')
  const { formatPerClassStripeProductName, pluralizeWeekdayLabel } = await import(
    './stripeProductNaming.js'
  )

  const results = []
  let updated = 0
  for (const row of res.rows) {
    const scheduleLabel = pluralizeWeekdayLabel(buildSlotDisplayLabel(row))
    const athleteName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
    const productName = formatPerClassStripeProductName({
      classTitle: row.form_title || row.description,
      scheduleLabel,
      athleteName,
    })
    let hasEffectiveDatedPrice = Boolean(row.stripe_subscription_schedule_id)
    if (!hasEffectiveDatedPrice) {
      try {
        const adjustment = await pool.query(
          `SELECT 1 FROM enrollment_price_adjustment
           WHERE billing_subscription_id = $1 AND status = 'active' LIMIT 1`,
          [row.id],
        )
        hasEffectiveDatedPrice = adjustment.rows.length > 0
      } catch (error) {
        if (error?.code !== '42P01' && error?.code !== '42703') throw error
      }
    }
    const outcome = hasEffectiveDatedPrice
      ? await import('./stripePriceSchedules.js').then(({ syncEnrollmentStripePriceSchedule }) =>
          syncEnrollmentStripePriceSchedule(pool, row.id),
        )
      : await updateStripeSubscriptionUnitAmount(
          row.stripe_subscription_id,
          row.net_monthly_cents,
          { productName },
        )
    results.push({
      billingSubscriptionId: Number(row.id),
      stripeSubscriptionId: row.stripe_subscription_id,
      productName,
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
