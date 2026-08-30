import { getStripeClient, stripeEnabled } from './stripeBilling.js'
import {
  addBillingMonths,
  adjustmentCoversPeriod,
  applyEnrollmentPriceAdjustment,
  billingMonthKey,
  normalizeBillingMonth,
} from './customerBillingPricing.js'

function unixMonthStart(month) {
  const [year, value] = billingMonthKey(month).split('-').map(Number)
  return Math.floor(Date.UTC(year, value - 1, 1) / 1000)
}

export function buildPriceScheduleSegments({
  currentMonth,
  currentPhaseStart,
  boundaries = [],
  amountByMonth,
  releaseAfterMonth = null,
}) {
  const first = billingMonthKey(currentMonth)
  const keys = [...new Set([first, ...boundaries.map(billingMonthKey)])]
    .filter((key) => key >= first)
    .sort()
  const segments = []
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]
    const next = keys[index + 1] ?? null
    const amountCents = Math.max(0, Math.round(Number(amountByMonth.get(key)) || 0))
    const previous = segments.at(-1)
    if (previous && previous.amountCents === amountCents) {
      previous.endDate = next ? unixMonthStart(next) : releaseAfterMonth ? unixMonthStart(releaseAfterMonth) : null
      continue
    }
    segments.push({
      periodKey: key,
      amountCents,
      startDate: index === 0 ? Number(currentPhaseStart) : unixMonthStart(key),
      endDate: next ? unixMonthStart(next) : releaseAfterMonth ? unixMonthStart(releaseAfterMonth) : null,
    })
  }
  return segments
}

async function loadScheduleContext(pool, billingSubscriptionId) {
  const result = await pool.query(
    `SELECT bs.*, fba.family_id
     FROM billing_subscription bs
     JOIN family_billing_account fba ON fba.id = bs.family_billing_account_id
     WHERE bs.id = $1`,
    [Number(billingSubscriptionId)],
  )
  const subscription = result.rows[0]
  if (!subscription) throw new Error('Billing subscription was not found.')
  const adjustments = await pool.query(
    `SELECT * FROM enrollment_price_adjustment
     WHERE signup_id = $1 AND status IN ('active', 'pending_sync')
     ORDER BY effective_from_month, id`,
    [Number(subscription.source_id)],
  )
  return { subscription, adjustments: adjustments.rows }
}

async function setSyncState(pool, id, status, { scheduleId = undefined, error = null } = {}) {
  await pool.query(
    `UPDATE billing_subscription
     SET price_sync_status = $2,
         price_sync_error = $3,
         price_synced_at = CASE WHEN $2 = 'synced' THEN now() ELSE price_synced_at END,
         stripe_subscription_schedule_id = CASE WHEN $4::text IS NULL THEN stripe_subscription_schedule_id ELSE NULLIF($4, '') END,
         updated_at = now()
     WHERE id = $1`,
    [id, status, error ? String(error).slice(0, 1000) : null, scheduleId],
  )
}

/**
 * Materialize active effective-dated prices as Stripe Subscription Schedule phases.
 * Local pricing remains authoritative; this function only marks the local adjustment
 * synced after Stripe accepts every phase.
 */
export async function syncEnrollmentStripePriceSchedule(pool, billingSubscriptionId, { now = new Date() } = {}) {
  const { subscription, adjustments } = await loadScheduleContext(pool, billingSubscriptionId)
  if (!subscription.stripe_subscription_id) {
    await setSyncState(pool, subscription.id, 'not_required', { error: null })
    return { status: 'skipped', reason: 'missing_id' }
  }
  if (!stripeEnabled()) {
    await setSyncState(pool, subscription.id, 'failed', { error: 'Stripe is disabled.' })
    return { status: 'error', reason: 'stripe_disabled' }
  }

  const stripe = await getStripeClient()
  if (!stripe) {
    await setSyncState(pool, subscription.id, 'failed', { error: 'Stripe is unavailable.' })
    return { status: 'error', reason: 'Stripe is unavailable.' }
  }

  await setSyncState(pool, subscription.id, 'pending')
  try {
    if (adjustments.length === 0) {
      if (subscription.stripe_subscription_schedule_id) {
        try {
          await stripe.subscriptionSchedules.release(subscription.stripe_subscription_schedule_id)
        } catch (error) {
          if (!/released|canceled|No such subscription schedule/i.test(String(error?.message ?? error))) throw error
        }
        await pool.query(
          `UPDATE billing_subscription SET stripe_subscription_schedule_id = NULL WHERE id = $1`,
          [subscription.id],
        )
      }
      const { updateStripeSubscriptionUnitAmount } = await import('./stripeSubscriptionSync.js')
      const direct = await updateStripeSubscriptionUnitAmount(
        subscription.stripe_subscription_id,
        subscription.net_monthly_cents,
        { productName: subscription.description },
      )
      if (direct.status === 'error') throw new Error(direct.reason)
      await setSyncState(pool, subscription.id, 'synced', { scheduleId: '' })
      return { status: 'synced', mode: 'direct', amountCents: Number(subscription.net_monthly_cents) }
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
      expand: ['items.data.price.product', 'schedule'],
    })
    const item = stripeSubscription.items?.data?.[0]
    if (!item?.price) throw new Error('Stripe subscription has no recurring item.')

    let scheduleId =
      typeof stripeSubscription.schedule === 'string'
        ? stripeSubscription.schedule
        : stripeSubscription.schedule?.id ?? subscription.stripe_subscription_schedule_id
    if (!scheduleId) {
      const created = await stripe.subscriptionSchedules.create({
        from_subscription: subscription.stripe_subscription_id,
        metadata: {
          vortex_billing_subscription_id: String(subscription.id),
          vortex_signup_id: String(subscription.source_id),
        },
      })
      scheduleId = created.id
    }
    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId)
    const currentMonth = billingMonthKey(now)
    const boundaries = new Set([currentMonth])
    for (const adjustment of adjustments) {
      const starts = billingMonthKey(adjustment.effective_from_month)
      if (starts > currentMonth) boundaries.add(starts)
      if (adjustment.effective_through_month) {
        boundaries.add(billingMonthKey(addBillingMonths(adjustment.effective_through_month, 1)))
      }
    }

    const familySubscriptions = await pool.query(
      `SELECT * FROM billing_subscription
       WHERE family_billing_account_id = $1 AND status = 'active'`,
      [subscription.family_billing_account_id],
    )
    const charges = await pool.query(
      `SELECT * FROM billing_charge
       WHERE family_billing_account_id = $1 AND source_type = 'billing_subscription'`,
      [subscription.family_billing_account_id],
    )
    const { collectRecurringPricingBoundaries, priceRecurringPeriod } = await import('./recurringPeriodPricing.js')
    for (const key of collectRecurringPricingBoundaries({
      subscriptions: familySubscriptions.rows,
      charges: charges.rows,
      adjustments,
      currentMonth,
    })) {
      boundaries.add(key)
    }
    const amountByMonth = new Map()
    for (const periodKey of [...boundaries].sort()) {
      const priced = await priceRecurringPeriod(pool, {
        familyId: subscription.family_id,
        subscriptions: familySubscriptions.rows,
        charges: charges.rows,
        periodKey,
      })
      let line = priced.lines.find((candidate) => Number(candidate.subscriptionId) === Number(subscription.id))
      const pending = adjustments.find(
        (adjustment) => adjustment.status === 'pending_sync' && adjustmentCoversPeriod(adjustment, periodKey),
      )
      if (pending) line = applyEnrollmentPriceAdjustment(line ?? {
        grossCents: Number(subscription.monthly_amount_cents),
        netCents: Number(subscription.net_monthly_cents),
      }, pending)
      amountByMonth.set(periodKey, Number(line?.netCents ?? subscription.net_monthly_cents))
    }

    const currentPhaseStart =
      Number(schedule.current_phase?.start_date) ||
      Number(item.current_period_start) ||
      Math.floor(now.getTime() / 1000)
    const finiteReversions = adjustments
      .filter((adjustment) => adjustment.effective_through_month)
      .map((adjustment) => addBillingMonths(adjustment.effective_through_month, 1))
      .sort()
    const releaseAfterMonth = adjustments.some((adjustment) => !adjustment.effective_through_month)
      ? null
      : finiteReversions.length > 0
        ? addBillingMonths(finiteReversions.at(-1), 1)
        : null
    const scheduleBoundaries = [...boundaries]
      .filter((key) => !releaseAfterMonth || key < billingMonthKey(releaseAfterMonth))
    const segments = buildPriceScheduleSegments({
      currentMonth,
      currentPhaseStart,
      boundaries: scheduleBoundaries,
      amountByMonth,
      releaseAfterMonth,
    })
    const currentProduct =
      typeof item.price.product === 'string' ? item.price.product : item.price.product?.id
    if (!currentProduct) throw new Error('Stripe subscription item has no product.')

    const priceByAmount = new Map()
    const phases = []
    for (const segment of segments) {
      let priceId = priceByAmount.get(segment.amountCents)
      if (!priceId && Number(item.price.unit_amount) === segment.amountCents) {
        priceId = item.price.id
      }
      if (!priceId) {
        const createdPrice = await stripe.prices.create({
          product: currentProduct,
          currency: item.price.currency || 'usd',
          unit_amount: segment.amountCents,
          recurring: { interval: item.price.recurring?.interval || 'month' },
          metadata: {
            vortex_effective_dated_price: 'true',
            vortex_billing_subscription_id: String(subscription.id),
          },
        })
        priceId = createdPrice.id
      }
      priceByAmount.set(segment.amountCents, priceId)
      phases.push({
        items: [{ price: priceId, quantity: item.quantity || 1 }],
        start_date: segment.startDate,
        ...(segment.endDate ? { end_date: segment.endDate } : {}),
        proration_behavior: 'none',
      })
    }

    await stripe.subscriptionSchedules.update(scheduleId, {
      end_behavior: 'release',
      phases,
      metadata: {
        vortex_billing_subscription_id: String(subscription.id),
        vortex_signup_id: String(subscription.source_id),
      },
    })
    await setSyncState(pool, subscription.id, 'synced', { scheduleId })
    return { status: 'synced', mode: 'schedule', scheduleId, segments }
  } catch (error) {
    await setSyncState(pool, subscription.id, 'failed', { error: error?.message ?? error })
    return { status: 'error', reason: error?.message ?? String(error) }
  }
}

export function adjustmentStripeWindow(adjustment) {
  return {
    startsAt: unixMonthStart(normalizeBillingMonth(adjustment.effective_from_month)),
    endsAt: adjustment.effective_through_month
      ? unixMonthStart(addBillingMonths(adjustment.effective_through_month, 1))
      : null,
  }
}
