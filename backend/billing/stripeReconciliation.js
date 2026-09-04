import { createHash } from 'crypto'
import {
  assertEnrollmentStripePaymentBinding,
  getStripeClient,
  stripeEnabled,
} from './stripeBilling.js'
import {
  beginStripeWebhookEvent,
  completeStripeWebhookEvent,
  failStripeWebhookEvent,
  recordStripeBillingAlert,
  stripeRefundReadyForLedgerFinalization,
  syncStripeRefund,
} from './stripeOperations.js'
import { recordBillingActivityBestEffort } from './billingActivity.js'
import { finalizeRefundLedgerTreatment } from './customerBillingPayments.js'
import { allocateHouseholdPayments } from './paymentAllocation.js'
import {
  collectRecurringPricingBoundaries,
  priceRecurringPeriod,
} from './recurringPeriodPricing.js'
import { addBillingMonths, billingMonthKey } from './customerBillingPricing.js'
import { buildPriceScheduleSegments } from './stripePriceSchedules.js'
import { requireAdminFacilityScope } from './adminFacilityScope.js'
import {
  BillingPaymentAttemptMappingConflict,
  findBillingPaymentAttemptForStripeObject,
  reconcileActiveBillingPaymentAttempts,
  recordAndCompleteBillingPaymentAttempt,
} from './paymentAttemptReservations.js'
import { recordAuthoritativeStripeInvoicePayment } from './stripeInvoicePayments.js'
import {
  assertStripeUsdCurrency,
  resolveStripePaymentIntentInvoice,
  resolveStripeInvoicePaymentIntentId,
  StripeInvoicePaymentBindingConflict,
  verifyStripeInvoicePaymentIntent,
} from './stripeInvoicePaymentBinding.js'
import { invoiceSubscriptionId } from './stripeWebhookLifecycle.js'
import {
  inspectStripePaymentIntentCheckoutSession,
  StripeCheckoutPaymentBindingConflict,
  stripePaymentIntentOwnershipIsFresh,
} from './stripeCheckoutPaymentBinding.js'
import { commitPendingEnrollment } from './stripeEnrollmentCheckout.js'
import { commitAnnualMembershipCheckout } from './annualMembershipCheckout.js'
import {
  completeStoreStripeCheckout,
  StoreStripeCheckoutBindingConflict,
} from '../store/registerRoutes.js'
import {
  inspectStripeCustomerSubscriptionInventory,
  inspectStripeCustomerSubscriptionScheduleInventory,
} from './canonicalBillingMigrationStripe.js'

async function ensureSchema() {
  // Compatibility hook. Startup billing readiness owns this schema contract.
}

function stripeId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

const PAYMENT_ATTEMPT_CHECKOUT_TYPES = new Set([
  'outstanding_balance',
  'custom_charge',
  'billing_charge_payment_request',
])

/**
 * Idempotently finish the local owner behind an already exact, paid Checkout
 * binding. This is the scheduled fallback when Stripe's companion Checkout
 * webhook (and, for member flows, the browser return) never arrives.
 */
export async function reconcilePaidStripeCheckoutFulfillment(pool, checkoutBinding, {
  stripe = null,
  completeStore = completeStoreStripeCheckout,
  commitEnrollment = commitPendingEnrollment,
  commitAnnualMembership = commitAnnualMembershipCheckout,
  findPaymentAttempt = findBillingPaymentAttemptForStripeObject,
  settlePaymentAttempt = recordAndCompleteBillingPaymentAttempt,
} = {}) {
  if (checkoutBinding?.state !== 'paid' || !checkoutBinding?.session?.id) {
    throw new StripeCheckoutPaymentBindingConflict(
      'Only one exact, paid Stripe Checkout Session can enter fulfillment reconciliation.',
      {
        checkoutState: checkoutBinding?.state ?? null,
        stripeCheckoutSessionId: checkoutBinding?.session?.id ?? null,
      },
    )
  }

  const { session, checkoutType } = checkoutBinding
  if (checkoutType === 'store') {
    const outcome = await completeStore(pool, session)
    if (outcome?.handled !== true) {
      return { status: 'unverified', reason: 'store_checkout_owner_not_completed' }
    }
    return {
      status: 'fulfilled',
      repaired: outcome.paymentCompleted === true,
      owner: 'store_order',
    }
  }

  if (checkoutType === 'enrollment') {
    const outcome = await commitEnrollment(pool, {
      pendingEnrollmentId: Number(session.metadata.pendingEnrollmentId),
      stripeSession: session,
    })
    if (outcome?.status === 'quarantined') {
      const payment = assertEnrollmentStripePaymentBinding(outcome.payment, {
        session,
        accountId: Number(session.metadata.familyBillingAccountId),
      })
      return {
        status: 'quarantined',
        reason: outcome.reason ?? 'paid_checkout_refund_required',
        owner: 'pending_enrollment',
        payment,
      }
    }
    if (!['completed', 'already_completed'].includes(outcome?.status)) {
      return {
        status: 'unverified',
        reason: `enrollment_checkout_${outcome?.status ?? 'missing'}`,
      }
    }
    if (!outcome?.payment) {
      throw new StripeCheckoutPaymentBindingConflict(
        `Paid enrollment Checkout ${session.id} completed without its exact settlement payment.`,
        {
          stripeCheckoutSessionId: session.id,
          pendingEnrollmentId: Number(session.metadata.pendingEnrollmentId),
          reason: 'enrollment_checkout_payment_missing',
        },
      )
    }
    const payment = assertEnrollmentStripePaymentBinding(outcome.payment, {
      session,
      accountId: Number(session.metadata.familyBillingAccountId),
    })
    return {
      status: 'fulfilled',
      repaired: outcome.status === 'completed' || payment.newly_inserted === true,
      owner: 'pending_enrollment',
      payment,
    }
  }

  if (checkoutType === 'annual_membership') {
    const outcome = await commitAnnualMembership(pool, {
      stripeSession: session,
      accountId: Number(session.metadata.familyBillingAccountId),
    })
    if (outcome?.status === 'quarantined') {
      const payment = assertEnrollmentStripePaymentBinding(outcome.payment, {
        session,
        accountId: Number(session.metadata.familyBillingAccountId),
      })
      return {
        status: 'quarantined',
        reason: outcome.reason ?? 'paid_checkout_refund_required',
        owner: 'annual_membership_checkout_request',
        payment,
      }
    }
    if (!['completed', 'already_active'].includes(outcome?.status)) {
      return {
        status: 'unverified',
        reason: `annual_membership_checkout_${outcome?.reason ?? outcome?.status ?? 'missing'}`,
      }
    }
    assertEnrollmentStripePaymentBinding(outcome.payment, {
      session,
      accountId: Number(session.metadata.familyBillingAccountId),
    })
    return {
      status: 'fulfilled',
      repaired: outcome.status === 'completed',
      owner: 'annual_membership_checkout_request',
    }
  }

  if (PAYMENT_ATTEMPT_CHECKOUT_TYPES.has(checkoutType)) {
    const attempt = await findPaymentAttempt(pool, session)
    if (!attempt) {
      return { status: 'unverified', reason: 'billing_payment_attempt_not_found' }
    }
    const settlement = await settlePaymentAttempt(pool, {
      stripeObject: session,
      paymentIntentId: stripeId(session.payment_intent),
      amountCents: session.amount_total,
      customerId: stripeId(session.customer),
    })
    if (!settlement || settlement.conflicted || !settlement.payment?.id) {
      return {
        status: 'unverified',
        reason: settlement?.reason ?? 'billing_payment_attempt_not_settled',
      }
    }
    return {
      status: 'fulfilled',
      repaired: settlement.payment.newly_inserted === true,
      owner: 'billing_payment_attempt',
      payment: settlement.payment,
    }
  }

  throw new StripeCheckoutPaymentBindingConflict(
    `Stripe Checkout type ${checkoutType || '(missing)'} has no supported fulfillment owner.`,
    {
      stripeCheckoutSessionId: session.id,
      checkoutType: checkoutType || null,
    },
  )
}

export function paymentAmountsMismatch(localAmountCents, stripeAmountCents) {
  return Number(localAmountCents) !== Number(stripeAmountCents)
}

function monthStartUnix(month) {
  const [year, value] = billingMonthKey(month).split('-').map(Number)
  return Date.UTC(year, value - 1, 1) / 1000
}

function monthFromUnix(value) {
  return billingMonthKey(new Date(Number(value) * 1000))
}

function phaseComparable(phase) {
  return {
    periodKey: phase.periodKey,
    amountCents: Number(phase.amountCents),
    endPeriodKey: phase.endPeriodKey ?? null,
  }
}

export function subscriptionScheduleHasDrift(expected, actual) {
  if (expected.length !== actual.length) return true
  return expected.some((phase, index) => {
    const left = phaseComparable(phase)
    const right = phaseComparable(actual[index] ?? {})
    return (
      left.periodKey !== right.periodKey ||
      left.amountCents !== right.amountCents ||
      left.endPeriodKey !== right.endPeriodKey
    )
  })
}

function reconciliationKey(subscriptionId, kind, details) {
  const digest = createHash('sha256').update(JSON.stringify(details)).digest('hex').slice(0, 16)
  return `subscription:${subscriptionId}:${kind}:${digest}`
}

function scheduleReleaseAfterMonth(adjustments) {
  if (adjustments.some((adjustment) => !adjustment.effective_through_month)) return null
  const reversions = adjustments
    .map((adjustment) => addBillingMonths(adjustment.effective_through_month, 1))
    .sort()
  return reversions.length > 0 ? addBillingMonths(reversions.at(-1), 1) : null
}

async function actualScheduleSnapshot(stripe, scheduleId, currentMonth) {
  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId, {
    expand: ['phases.items.price'],
  })
  const currentStart = monthStartUnix(currentMonth)
  const priceCache = new Map()
  const phases = []
  for (const phase of schedule.phases ?? []) {
    if (phase.end_date && Number(phase.end_date) <= currentStart) continue
    const item = phase.items?.[0]
    let price = item?.price ?? item?.plan ?? null
    if (typeof price === 'string') {
      if (!priceCache.has(price)) priceCache.set(price, await stripe.prices.retrieve(price))
      price = priceCache.get(price)
    }
    phases.push({
      periodKey: Number(phase.start_date) <= currentStart ? currentMonth : monthFromUnix(phase.start_date),
      amountCents: Number(price?.unit_amount ?? 0),
      endPeriodKey: phase.end_date ? monthFromUnix(phase.end_date) : null,
    })
  }
  phases.sort((left, right) => left.periodKey.localeCompare(right.periodKey))
  return { schedule, phases }
}

export function buildStripeReadiness({
  enabled,
  secretKey,
  webhookSecrets,
  latestReconciliation,
  failedWebhookCount,
  criticalAlertCount,
  emailDomainVerified,
  now = new Date(),
}) {
  const key = String(secretKey ?? '').trim()
  const mode = key.startsWith('sk_live_') ? 'live' : key.startsWith('sk_test_') ? 'test' : 'unconfigured'
  const webhookConfigured = String(webhookSecrets ?? '')
    .split(',')
    .some((value) => value.trim().startsWith('whsec_'))
  const latestCompletedAt =
    latestReconciliation?.completed_at ?? latestReconciliation?.completedAt ?? null
  const reconciliationFresh = Boolean(
    latestCompletedAt &&
      now.getTime() - new Date(latestCompletedAt).getTime() <= 26 * 60 * 60 * 1000 &&
      latestReconciliation?.status === 'succeeded',
  )
  const checks = [
    { key: 'stripe_enabled', label: 'Stripe collection enabled', passed: Boolean(enabled) },
    { key: 'api_key', label: `${mode === 'live' ? 'Live' : 'Test'} API key configured`, passed: mode !== 'unconfigured' },
    { key: 'webhook_signing', label: 'Webhook signing secret configured', passed: webhookConfigured },
    { key: 'reconciliation', label: 'Successful reconciliation within 26 hours', passed: reconciliationFresh },
    { key: 'webhook_failures', label: 'No failed webhooks in the last 7 days', passed: Number(failedWebhookCount) === 0 },
    { key: 'critical_alerts', label: 'No unresolved critical billing alerts', passed: Number(criticalAlertCount) === 0 },
    { key: 'email_domain', label: 'Stripe customer email domain verified', passed: Boolean(emailDomainVerified) },
  ]
  return {
    mode,
    readyForLivePayments: mode === 'live' && checks.every((check) => check.passed),
    checks,
  }
}

async function createReconciliationAlert(pool, key, type, severity, message, objectId, details = {}) {
  return recordStripeBillingAlert(pool, {
    event: { id: `reconciliation:${key}` },
    object: { id: objectId, metadata: {}, ...details },
    alertType: type,
    severity,
    message,
  })
}

async function recordSubscriptionDrift(pool, subscription, kind, message, details) {
  const key = reconciliationKey(subscription.id, kind, details)
  await createReconciliationAlert(
    pool,
    key,
    kind,
    'critical',
    message,
    subscription.stripe_subscription_id,
    {
      metadata: { familyBillingAccountId: String(subscription.family_billing_account_id) },
      reason: JSON.stringify(details).slice(0, 900),
    },
  )
  await recordBillingActivityBestEffort(pool, {
    eventKey: `reconciliation:${key}`,
    accountId: subscription.family_billing_account_id,
    memberId: subscription.member_id,
    signupId: subscription.source_type === 'scheduling_signup' ? Number(subscription.source_id) : null,
    eventType: kind,
    summary: message,
    details,
    stripeObjectId: subscription.stripe_subscription_id,
    actorType: 'system',
  })
}

const SUBSCRIPTION_RECONCILIATION_ALERT_TYPES = [
  'subscription_price_drift',
  'subscription_schedule_drift',
  'subscription_phase_drift',
  'subscription_reconciliation_failed',
]

async function resolveAlertsAutomatically(pool, {
  accountId,
  alertIds,
  reason,
  actorUserId = null,
  actorType = 'system',
}) {
  const ids = [...new Set((alertIds ?? []).map(Number).filter(Number.isFinite))]
  if (!accountId || ids.length === 0) return []
  const result = await pool.query(
    `UPDATE stripe_billing_alert
     SET action_status = 'resolved',
         resolved_at = now(),
         resolved_by_user_id = $3,
         resolution_note = $4,
         updated_at = now()
     WHERE family_billing_account_id = $1
       AND id = ANY($2::bigint[])
       AND resolved_at IS NULL
     RETURNING *`,
    [accountId, ids, actorUserId, reason],
  )
  await Promise.all(result.rows.map((alert) => recordBillingActivityBestEffort(pool, {
    eventKey: `stripe-alert-auto-resolved:${alert.id}`,
    accountId,
    eventType: 'stripe_alert_auto_resolved',
    summary: `Stripe alert #${alert.id} was automatically resolved after live verification.`,
    beforeValue: {
      alertType: alert.alert_type,
      stripeObjectId: alert.stripe_object_id,
      message: alert.message,
    },
    afterValue: { actionStatus: 'resolved', resolution: reason },
    stripeObjectId: alert.stripe_object_id,
    actorUserId,
    actorType,
  })))
  return result.rows
}

async function resolveCleanSubscriptionAlerts(pool, subscription, options = {}) {
  const alerts = await pool.query(
    `SELECT id FROM stripe_billing_alert
     WHERE family_billing_account_id = $1
       AND stripe_object_id = $2
       AND alert_type = ANY($3::text[])
       AND resolved_at IS NULL`,
    [
      subscription.family_billing_account_id,
      subscription.stripe_subscription_id,
      SUBSCRIPTION_RECONCILIATION_ALERT_TYPES,
    ],
  )
  return resolveAlertsAutomatically(pool, {
    accountId: subscription.family_billing_account_id,
    alertIds: alerts.rows.map((row) => row.id),
    reason: 'Automatically resolved after Stripe subscription reconciliation found no pricing or schedule drift.',
    ...options,
  })
}

export async function reconcileStripeSubscriptionPrices(pool, stripe, {
  now = new Date(),
  accountId = null,
  alertResolutionActor = {},
} = {}) {
  let subscriptions
  try {
    subscriptions = await pool.query(
      `SELECT bs.*, fba.family_id
       FROM billing_subscription bs
       JOIN family_billing_account fba ON fba.id = bs.family_billing_account_id
       WHERE bs.status = 'active'
         AND bs.source_type = 'scheduling_signup'
         AND bs.stripe_subscription_id IS NOT NULL
         AND fba.household_monthly_billing_enabled = FALSE
         AND NOT EXISTS (
           SELECT 1
             FROM billing_account_migration migration
            WHERE migration.family_billing_account_id = bs.family_billing_account_id
              AND migration.state IN (
                'armed', 'cancellation_scheduled', 'detached', 'remote_retired',
                'household_active', 'verified', 'failed_forward_only', 'rollback_pending'
              )
         )
         AND ($1::bigint IS NULL OR bs.family_billing_account_id = $1)`,
      [accountId == null ? null : Number(accountId)],
    )
  } catch (error) {
    if (error?.code === '42703' || error?.code === '42P01') {
      return { subscriptionsChecked: 0, subscriptionDriftsFound: 0, skipped: true }
    }
    throw error
  }

  const currentMonth = billingMonthKey(now)
  const accountContext = new Map()
  const pricedPeriods = new Map()
  let subscriptionsChecked = 0
  let subscriptionDriftsFound = 0
  let alertsResolved = 0

  async function contextFor(subscription) {
    const accountId = Number(subscription.family_billing_account_id)
    if (!accountContext.has(accountId)) {
      const [accountSubscriptions, charges] = await Promise.all([
        pool.query(
          `SELECT * FROM billing_subscription
           WHERE family_billing_account_id = $1 AND status = 'active'`,
          [accountId],
        ),
        pool.query(
          `SELECT * FROM billing_charge
           WHERE family_billing_account_id = $1 AND source_type = 'billing_subscription'`,
          [accountId],
        ),
      ])
      accountContext.set(accountId, {
        subscriptions: accountSubscriptions.rows,
        charges: charges.rows,
      })
    }
    return accountContext.get(accountId)
  }

  async function pricingFor(subscription, periodKey) {
    const cacheKey = `${subscription.family_billing_account_id}:${periodKey}`
    if (!pricedPeriods.has(cacheKey)) {
      const context = await contextFor(subscription)
      pricedPeriods.set(cacheKey, await priceRecurringPeriod(pool, {
        familyId: subscription.family_id,
        subscriptions: context.subscriptions,
        charges: context.charges,
        periodKey,
      }))
    }
    return pricedPeriods.get(cacheKey)
  }

  for (const subscription of subscriptions.rows) {
    subscriptionsChecked += 1
    const drifts = []
    try {
      const remote = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
        expand: ['items.data.price', 'schedule'],
      })
      const item = remote.items?.data?.[0]
      if (!item?.price) throw new Error('Stripe subscription has no recurring price item.')
      const currentPricing = await pricingFor(subscription, currentMonth)
      const currentLine = currentPricing.lines.find(
        (line) => Number(line.subscriptionId) === Number(subscription.id),
      )
      const expectedAmountCents = Number(currentLine?.netCents ?? subscription.net_monthly_cents)
      const actualAmountCents = Number(item.price.unit_amount ?? 0)
      if (paymentAmountsMismatch(expectedAmountCents, actualAmountCents)) {
        drifts.push({
          kind: 'subscription_price_drift',
          message: `Stripe subscription ${remote.id} has a different current price than local billing.`,
          details: { expectedAmountCents, actualAmountCents },
        })
      }

      const adjustmentResult = await pool.query(
        `SELECT * FROM enrollment_price_adjustment
         WHERE billing_subscription_id = $1 AND status = 'active'
         ORDER BY effective_from_month, id`,
        [subscription.id],
      )
      const adjustments = adjustmentResult.rows.filter(
        (adjustment) => !adjustment.effective_through_month || billingMonthKey(adjustment.effective_through_month) >= currentMonth,
      )
      const remoteScheduleId = stripeId(remote.schedule)
      const localScheduleId = subscription.stripe_subscription_schedule_id ?? null
      const scheduleExpected = adjustments.length > 0
      if (
        scheduleExpected !== Boolean(remoteScheduleId) ||
        (remoteScheduleId && localScheduleId !== remoteScheduleId)
      ) {
        drifts.push({
          kind: 'subscription_schedule_drift',
          message: `Stripe subscription ${remote.id} has a local/remote schedule mismatch.`,
          details: { scheduleExpected, localScheduleId, remoteScheduleId },
        })
      }

      if (scheduleExpected && remoteScheduleId) {
        const context = await contextFor(subscription)
        const boundaries = collectRecurringPricingBoundaries({
          subscriptions: context.subscriptions,
          charges: context.charges,
          adjustments,
          currentMonth,
        })
        const releaseAfterMonth = scheduleReleaseAfterMonth(adjustments)
        const scheduleBoundaries = boundaries.filter(
          (key) => !releaseAfterMonth || key < billingMonthKey(releaseAfterMonth),
        )
        const amountByMonth = new Map()
        for (const periodKey of scheduleBoundaries) {
          const pricing = await pricingFor(subscription, periodKey)
          const line = pricing.lines.find(
            (candidate) => Number(candidate.subscriptionId) === Number(subscription.id),
          )
          amountByMonth.set(periodKey, Number(line?.netCents ?? subscription.net_monthly_cents))
        }
        const actual = await actualScheduleSnapshot(stripe, remoteScheduleId, currentMonth)
        const currentPhaseStart = Number(actual.schedule.current_phase?.start_date) ||
          Number(remote.current_period_start) || monthStartUnix(currentMonth)
        const expected = buildPriceScheduleSegments({
          currentMonth,
          currentPhaseStart,
          boundaries: scheduleBoundaries,
          amountByMonth,
          releaseAfterMonth,
        }).map((phase) => ({
          periodKey: phase.periodKey,
          amountCents: phase.amountCents,
          endPeriodKey: phase.endDate ? monthFromUnix(phase.endDate) : null,
        }))
        if (subscriptionScheduleHasDrift(expected, actual.phases)) {
          drifts.push({
            kind: 'subscription_phase_drift',
            message: `Stripe subscription ${remote.id} has phases that differ from local effective-dated pricing.`,
            details: { expected, actual: actual.phases },
          })
        }
      }
    } catch (error) {
      drifts.push({
        kind: 'subscription_reconciliation_failed',
        message: `Stripe subscription ${subscription.stripe_subscription_id} could not be reconciled.`,
        details: { reason: error?.message ?? String(error) },
      })
    }

    if (drifts.length > 0) {
      subscriptionDriftsFound += drifts.length
      const combined = drifts.map((drift) => drift.message).join(' ')
      await pool.query(
        `UPDATE billing_subscription
         SET price_sync_status = 'failed', price_sync_error = $2, updated_at = now()
         WHERE id = $1`,
        [subscription.id, `[reconciliation] ${combined}`.slice(0, 1000)],
      )
      for (const drift of drifts) {
        await recordSubscriptionDrift(pool, subscription, drift.kind, drift.message, drift.details)
      }
    } else if (
      subscription.price_sync_status === 'failed' &&
      String(subscription.price_sync_error ?? '').startsWith('[reconciliation]')
    ) {
      await pool.query(
        `UPDATE billing_subscription
         SET price_sync_status = 'synced', price_sync_error = NULL, price_synced_at = now(), updated_at = now()
         WHERE id = $1`,
        [subscription.id],
      )
    }
    if (drifts.length === 0) {
      const resolved = await resolveCleanSubscriptionAlerts(pool, subscription, alertResolutionActor)
      alertsResolved += resolved.length
    }
  }

  return { subscriptionsChecked, subscriptionDriftsFound, alertsResolved, skipped: false }
}

/**
 * Enumerate every remote recurring collector owned by a canonical customer.
 * Canonical/household accounts must have zero live Stripe subscriptions and
 * zero active/future Subscription Schedules; annual labels do not exempt a
 * remote collector from this post-cutover invariant.
 */
export async function reconcileCanonicalStripeCollectorInventory(pool, stripe, {
  accountId = null,
} = {}) {
  let accounts
  try {
    accounts = await pool.query(
      `/* canonical-collector:account-inventory */
       SELECT account.id,
              account.stripe_customer_id,
              (
                SELECT COUNT(*)::integer
                  FROM family_billing_account customer_owner
                 WHERE customer_owner.stripe_customer_id = account.stripe_customer_id
              ) AS stripe_customer_owner_count,
              migration.state AS migration_state
         FROM family_billing_account account
         LEFT JOIN LATERAL (
           SELECT candidate.state
             FROM billing_account_migration candidate
            WHERE candidate.family_billing_account_id = account.id
            ORDER BY candidate.id DESC
            LIMIT 1
         ) migration ON TRUE
        WHERE account.stripe_customer_id IS NOT NULL
          AND (
            account.household_monthly_billing_enabled = TRUE
            OR migration.state IN (
              'armed', 'cancellation_scheduled', 'detached', 'remote_retired',
              'household_active', 'verified', 'rollback_pending', 'failed_forward_only'
            )
          )
          AND ($1::bigint IS NULL OR account.id = $1)
        ORDER BY account.id`,
      [accountId == null ? null : Number(accountId)],
    )
  } catch (error) {
    if (error?.code === '42703' || error?.code === '42P01') {
      return { accountsChecked: 0, collectorDriftsFound: 0, alertsResolved: 0, skipped: true }
    }
    throw error
  }

  let collectorDriftsFound = 0
  let alertsResolved = 0
  for (const account of accounts.rows) {
    const normalizedAccountId = Number(account.id)
    try {
      if (Number(account.stripe_customer_owner_count) !== 1) {
        throw new Error(
          `Stripe customer ${account.stripe_customer_id} is linked to ${Number(account.stripe_customer_owner_count) || 0} local billing accounts, including inactive accounts.`,
        )
      }
      const localSubscriptions = await pool.query(
        `SELECT id, source_type, pricing_option_key, status, stripe_subscription_id
           FROM billing_subscription
          WHERE family_billing_account_id = $1
          ORDER BY id`,
        [normalizedAccountId],
      )
      const [subscriptions, schedules] = await Promise.all([
        inspectStripeCustomerSubscriptionInventory(stripe, {
          stripeCustomerId: account.stripe_customer_id,
          accountId: normalizedAccountId,
          localSubscriptions: localSubscriptions.rows,
        }),
        inspectStripeCustomerSubscriptionScheduleInventory(stripe, {
          stripeCustomerId: account.stripe_customer_id,
          accountId: normalizedAccountId,
        }),
      ])
      const liveSubscriptionCount = Number(subscriptions.snapshot?.liveSubscriptionCount ?? 0)
      const liveScheduleCount = Number(schedules.snapshot?.liveScheduleCount ?? 0)
      const issues = [...(subscriptions.issues ?? []), ...(schedules.issues ?? [])]
      if (liveSubscriptionCount > 0 || liveScheduleCount > 0 || issues.length > 0) {
        collectorDriftsFound += Math.max(1, liveSubscriptionCount + liveScheduleCount)
        const details = {
          migrationState: account.migration_state ?? null,
          liveSubscriptionCount,
          liveScheduleCount,
          subscriptions: subscriptions.snapshot?.subscriptions ?? [],
          schedules: schedules.snapshot?.schedules ?? [],
          issues,
        }
        const digest = createHash('sha256').update(JSON.stringify(details)).digest('hex').slice(0, 16)
        await createReconciliationAlert(
          pool,
          `canonical-collector:${normalizedAccountId}:${digest}`,
          'canonical_remote_collector_drift',
          'critical',
          `Canonical billing account ${normalizedAccountId} still has ${liveSubscriptionCount} live Stripe subscription(s) and ${liveScheduleCount} live schedule(s).`,
          account.stripe_customer_id,
          {
            metadata: { familyBillingAccountId: String(normalizedAccountId) },
            reason: JSON.stringify(details).slice(0, 900),
          },
        )
      } else {
        const openAlerts = await pool.query(
          `SELECT id
             FROM stripe_billing_alert
            WHERE family_billing_account_id = $1
              AND alert_type IN ('canonical_remote_collector_drift', 'canonical_collector_inventory_failed')
              AND resolved_at IS NULL`,
          [normalizedAccountId],
        )
        const resolved = await resolveAlertsAutomatically(pool, {
          accountId: normalizedAccountId,
          alertIds: openAlerts.rows.map((row) => row.id),
          reason: 'Automatically resolved after full Stripe customer inventory found no live subscriptions or schedules.',
        })
        alertsResolved += resolved.length
      }
    } catch (error) {
      collectorDriftsFound += 1
      await createReconciliationAlert(
        pool,
        `canonical-collector:${normalizedAccountId}:inventory-failed:${createHash('sha256').update(String(error?.message ?? error)).digest('hex').slice(0, 16)}`,
        'canonical_collector_inventory_failed',
        'critical',
        `Canonical billing account ${normalizedAccountId} remote collector inventory failed closed.`,
        account.stripe_customer_id,
        {
          metadata: { familyBillingAccountId: String(normalizedAccountId) },
          reason: String(error?.message ?? error).slice(0, 900),
        },
      )
    }
  }
  return {
    accountsChecked: accounts.rows.length,
    collectorDriftsFound,
    alertsResolved,
    skipped: false,
  }
}

async function paymentFailureHasRecovered(pool, stripe, alert) {
  const objectId = String(alert.stripe_object_id ?? '').trim()
  if (!objectId) return false

  if (objectId.startsWith('in_')) {
    const invoice = await stripe.invoices.retrieve(objectId)
    return invoice?.paid === true || invoice?.status === 'paid'
  }

  if (!objectId.startsWith('pi_')) return false
  const paymentIntent = await stripe.paymentIntents.retrieve(objectId)
  if (paymentIntent?.status === 'succeeded') return true
  const invoiceId = stripeId(paymentIntent?.invoice)
  if (invoiceId) {
    const invoice = await stripe.invoices.retrieve(invoiceId)
    if (invoice?.paid === true || invoice?.status === 'paid') return true
  }
  const payment = await pool.query(
    `SELECT id FROM billing_payment
     WHERE family_billing_account_id = $1
       AND stripe_payment_intent_id = $2
       AND COALESCE(external_status, 'settled') NOT IN ('failed', 'canceled', 'cancelled')
     LIMIT 1`,
    [alert.family_billing_account_id, objectId],
  )
  return Boolean(payment.rows[0])
}

/**
 * Refresh one account against Stripe. Only alerts that Stripe now proves healthy are closed;
 * failed invoices and declined Payment Intents remain visible until payment actually succeeds.
 */
export async function refreshCustomerBillingStripeAlerts(pool, {
  accountId,
  actorUserId = null,
} = {}) {
  if (!Number.isFinite(Number(accountId)) || Number(accountId) <= 0) {
    throw new Error('A valid billing account is required.')
  }
  if (!stripeEnabled()) throw new Error('Stripe is disabled or not configured.')
  await ensureSchema(pool)
  const stripe = await getStripeClient()
  if (!stripe) throw new Error('Stripe SDK is unavailable.')

  const subscriptionSummary = await reconcileStripeSubscriptionPrices(pool, stripe, {
    accountId: Number(accountId),
    alertResolutionActor: { actorUserId, actorType: actorUserId == null ? 'system' : 'admin' },
  })
  const collectorInventory = await reconcileCanonicalStripeCollectorInventory(pool, stripe, {
    accountId: Number(accountId),
  })
  const paymentAlerts = await pool.query(
    `SELECT * FROM stripe_billing_alert
     WHERE family_billing_account_id = $1
       AND alert_type IN ('payment_failed', 'payment_recovery_exhausted')
       AND resolved_at IS NULL
     ORDER BY id`,
    [Number(accountId)],
  )
  const recoveredAlertIds = []
  const verificationErrors = []
  for (const alert of paymentAlerts.rows) {
    try {
      if (await paymentFailureHasRecovered(pool, stripe, alert)) recoveredAlertIds.push(alert.id)
    } catch (error) {
      verificationErrors.push({ alertId: Number(alert.id), message: error?.message ?? String(error) })
    }
  }
  const paymentAlertsResolved = await resolveAlertsAutomatically(pool, {
    accountId: Number(accountId),
    alertIds: recoveredAlertIds,
    reason: 'Automatically resolved after Stripe confirmed the previously failed payment was paid.',
    actorUserId,
    actorType: actorUserId == null ? 'system' : 'admin',
  })
  return {
    ...subscriptionSummary,
    canonicalCollectorAccountsChecked: collectorInventory.accountsChecked,
    canonicalCollectorDriftsFound: collectorInventory.collectorDriftsFound,
    paymentAlertsChecked: paymentAlerts.rows.length,
    paymentAlertsResolved: paymentAlertsResolved.length,
    alertsResolved: Number(subscriptionSummary.alertsResolved ?? 0)
      + Number(collectorInventory.alertsResolved ?? 0)
      + paymentAlertsResolved.length,
    verificationErrors,
  }
}

const DEFAULT_RECONCILIATION_LOOKBACK_HOURS = 168
const RECONCILIATION_HIGH_WATER_OVERLAP_MS = 60 * 60 * 1000

function normalizedReconciliationLookbackHours(value) {
  const hours = Number(value)
  return Number.isFinite(hours)
    ? Math.max(1, hours)
    : DEFAULT_RECONCILIATION_LOOKBACK_HOURS
}

/**
 * Preserve the configured rolling lookback as the normal minimum scan, while
 * extending it back to the last successfully completed window after an outage.
 * Failed and still-running attempts are deliberately excluded: their declared
 * window end is not evidence that Stripe objects were completely inspected.
 */
export async function resolveStripeReconciliationWindow(pool, {
  lookbackHours = DEFAULT_RECONCILIATION_LOOKBACK_HOURS,
  endedAt = new Date(),
} = {}) {
  const normalizedEndedAt = new Date(endedAt)
  if (!Number.isFinite(normalizedEndedAt.getTime())) {
    throw new Error('Stripe reconciliation requires a valid window end.')
  }
  const normalStartedAt = new Date(
    normalizedEndedAt.getTime()
      - normalizedReconciliationLookbackHours(lookbackHours) * 60 * 60 * 1000,
  )
  const latestSuccessful = await pool.query(
    `/* stripe-reconciliation:successful-high-water */
     SELECT window_ended_at
       FROM stripe_reconciliation_run
      WHERE status = 'succeeded'
        AND window_ended_at IS NOT NULL
        AND window_ended_at <= $1
      ORDER BY window_ended_at DESC, id DESC
      LIMIT 1`,
    [normalizedEndedAt],
  ).then((result) => result.rows[0] ?? null)
  const successfulEndedAt = latestSuccessful?.window_ended_at == null
    ? null
    : new Date(latestSuccessful.window_ended_at)
  const validSuccessfulEndedAt = successfulEndedAt && Number.isFinite(successfulEndedAt.getTime())
    ? successfulEndedAt
    : null
  const highWaterStartedAt = validSuccessfulEndedAt
    ? new Date(validSuccessfulEndedAt.getTime() - RECONCILIATION_HIGH_WATER_OVERLAP_MS)
    : null
  const startedAt = highWaterStartedAt && highWaterStartedAt < normalStartedAt
    ? highWaterStartedAt
    : normalStartedAt
  return {
    startedAt,
    endedAt: normalizedEndedAt,
    lastSuccessfulWindowEndedAt: validSuccessfulEndedAt,
  }
}

const DURABLE_ENROLLMENT_REFUND_PREFIX = '[paid-checkout-refund-required]'

function durableCheckoutOwnerMetadata(owner) {
  if (owner.owner_kind === 'enrollment') {
    return { checkoutType: 'enrollment', ownerKey: 'pendingEnrollmentId' }
  }
  if (owner.owner_kind === 'annual_membership') {
    return {
      checkoutType: 'annual_membership',
      ownerKey: 'annualMembershipCheckoutRequestId',
    }
  }
  if (owner.owner_kind === 'store') {
    return { checkoutType: 'store', ownerKey: 'storeOrderId' }
  }
  throw new StripeCheckoutPaymentBindingConflict(
    `Durable Stripe Checkout owner kind ${owner.owner_kind ?? '(missing)'} is unsupported.`,
    { durableOwnerKind: owner.owner_kind ?? null, durableOwnerId: owner.owner_id ?? null },
  )
}

function assertDurableCheckoutOwnerSession(owner, session) {
  const expected = durableCheckoutOwnerMetadata(owner)
  const sessionId = stripeId(session)
  const metadata = session?.metadata ?? {}
  const problems = []
  if (!sessionId || sessionId !== String(owner.stripe_checkout_session_id ?? '')) {
    problems.push('checkout_session_mismatch')
  }
  if (String(metadata.checkoutType ?? '') !== expected.checkoutType) {
    problems.push('checkout_type_mismatch')
  }
  if (String(metadata[expected.ownerKey] ?? '') !== String(owner.owner_id ?? '')) {
    problems.push('checkout_owner_mismatch')
  }
  if (
    expected.checkoutType !== 'store'
    && owner.family_billing_account_id != null
    && String(metadata.familyBillingAccountId ?? '') !== String(owner.family_billing_account_id)
  ) {
    problems.push('checkout_account_mismatch')
  }
  const remoteMode = String(session?.mode ?? '')
  if (owner.owner_kind === 'enrollment') {
    const expectedMode = String(owner.expected_checkout_mode ?? '')
    if (
      !['payment', 'subscription'].includes(expectedMode)
      || remoteMode !== expectedMode
    ) {
      problems.push('checkout_mode_mismatch')
    }
  } else if (owner.owner_kind === 'annual_membership') {
    if (!['payment', 'subscription'].includes(remoteMode)) {
      problems.push('checkout_mode_mismatch')
    }
  } else if (remoteMode !== 'payment') {
    problems.push('checkout_mode_mismatch')
  }
  if (String(session?.currency ?? '').trim().toLowerCase() !== 'usd') {
    problems.push('checkout_currency_mismatch')
  }
  if (
    !Number.isSafeInteger(Number(session?.amount_total))
    || Number(session.amount_total) !== Number(owner.expected_amount_cents)
  ) {
    problems.push('checkout_amount_mismatch')
  }
  if (problems.length > 0) {
    throw new StripeCheckoutPaymentBindingConflict(
      `Stripe Checkout Session ${sessionId ?? '(missing)'} does not match its durable ${owner.owner_kind} owner.`,
      {
        durableOwnerKind: owner.owner_kind,
        durableOwnerId: Number(owner.owner_id),
        familyBillingAccountId: owner.family_billing_account_id == null
          ? null
          : Number(owner.family_billing_account_id),
        stripeCheckoutSessionId: sessionId,
        expectedStripeCheckoutSessionId: owner.stripe_checkout_session_id,
        problems,
      },
    )
  }
  return expected
}

/**
 * Re-read the exact Session stored on a durable local owner. A paid Session is
 * additionally proven through its one-and-only PaymentIntent-to-Checkout
 * binding before any idempotent fulfillment routine is called.
 */
async function inspectDurableCheckoutOwner(stripe, owner) {
  const session = await stripe.checkout.sessions.retrieve(
    owner.stripe_checkout_session_id,
    { expand: ['payment_intent', 'invoice.payment_intent', 'subscription'] },
  )
  const expected = assertDurableCheckoutOwnerSession(owner, session)
  if (!(session?.status === 'complete' && session?.payment_status === 'paid')) {
    const forbiddenCollectorStillPossible = session?.mode === 'subscription'
      && (session?.status !== 'expired' || Boolean(stripeId(session?.subscription)))
    return {
      state: forbiddenCollectorStillPossible
        ? 'forbidden_subscription_pending'
        : session?.status === 'expired' && session?.payment_status !== 'paid'
          ? 'expired'
          : 'pending',
      session,
      checkoutType: expected.checkoutType,
    }
  }

  if (session.mode === 'subscription') {
    const sessionInvoiceId = stripeId(session.invoice)
    const sessionSubscriptionId = stripeId(session.subscription)
    if (!sessionInvoiceId || !sessionSubscriptionId) {
      throw new StripeCheckoutPaymentBindingConflict(
        `Paid historical subscription-mode Checkout ${session.id} has no exact invoice and subscription binding.`,
        {
          stripeCheckoutSessionId: session.id,
          stripeInvoiceId: sessionInvoiceId,
          stripeSubscriptionId: sessionSubscriptionId,
          durableOwnerKind: owner.owner_kind,
        },
      )
    }
    const invoice = await stripe.invoices.retrieve(sessionInvoiceId, {
      expand: ['payment_intent', 'payments.data.payment.payment_intent'],
    })
    const invoiceId = stripeId(invoice)
    const problems = []
    if (invoiceId !== sessionInvoiceId) problems.push('checkout_invoice_mismatch')
    if (!paidStripeInvoice(invoice)) problems.push('checkout_invoice_not_paid')
    if (String(invoice?.currency ?? '').trim().toLowerCase() !== 'usd') {
      problems.push('checkout_invoice_currency_mismatch')
    }
    if (
      !Number.isSafeInteger(Number(invoice?.amount_paid))
      || Number(invoice.amount_paid) !== Number(session.amount_total)
    ) {
      problems.push('checkout_invoice_amount_mismatch')
    }
    if (stripeId(invoice?.customer) !== stripeId(session.customer)) {
      problems.push('checkout_invoice_customer_mismatch')
    }
    if (invoiceSubscriptionId(invoice) !== sessionSubscriptionId) {
      problems.push('checkout_invoice_subscription_mismatch')
    }
    if (problems.length > 0) {
      throw new StripeCheckoutPaymentBindingConflict(
        `Paid historical subscription-mode Checkout ${session.id} does not match its exact Stripe invoice.`,
        {
          stripeCheckoutSessionId: session.id,
          stripeInvoiceId: invoiceId,
          expectedStripeInvoiceId: sessionInvoiceId,
          stripeSubscriptionId: sessionSubscriptionId,
          invoiceStripeSubscriptionId: invoiceSubscriptionId(invoice),
          durableOwnerKind: owner.owner_kind,
          durableOwnerId: Number(owner.owner_id),
          problems,
        },
      )
    }
    const paymentIntentId = await resolveStripeInvoicePaymentIntentId(stripe, invoice)
    if (!paymentIntentId) {
      throw new StripeCheckoutPaymentBindingConflict(
        `Paid historical subscription-mode Checkout ${session.id} has no exact paid PaymentIntent binding.`,
        {
          stripeCheckoutSessionId: session.id,
          stripeInvoiceId: invoiceId,
          stripeSubscriptionId: sessionSubscriptionId,
          durableOwnerKind: owner.owner_kind,
        },
      )
    }
    const paymentIntent = await verifyStripeInvoicePaymentIntent(
      stripe,
      invoice,
      paymentIntentId,
    )
    const verifiedSession = {
      ...session,
      invoice,
      payment_intent: paymentIntent,
    }
    assertDurableCheckoutOwnerSession(owner, verifiedSession)
    return {
      state: 'paid',
      checkoutType: expected.checkoutType,
      session: verifiedSession,
      invoice,
      paymentIntent,
    }
  }
  let paymentIntent = session.payment_intent
  if (
    typeof paymentIntent === 'string'
    || !stripeId(paymentIntent)
    || typeof paymentIntent?.status !== 'string'
  ) {
    const paymentIntentId = stripeId(paymentIntent)
    if (!paymentIntentId) {
      throw new StripeCheckoutPaymentBindingConflict(
        `Paid Stripe Checkout Session ${session.id} has no exact PaymentIntent.`,
        { stripeCheckoutSessionId: session.id, durableOwnerKind: owner.owner_kind },
      )
    }
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
  }
  const binding = await inspectStripePaymentIntentCheckoutSession(stripe, paymentIntent)
  if (!binding || stripeId(binding.session) !== String(owner.stripe_checkout_session_id)) {
    throw new StripeCheckoutPaymentBindingConflict(
      `Stripe PaymentIntent ${stripeId(paymentIntent)} did not resolve back to its exact durable Checkout Session.`,
      {
        stripePaymentIntentId: stripeId(paymentIntent),
        stripeCheckoutSessionId: stripeId(binding?.session),
        expectedStripeCheckoutSessionId: owner.stripe_checkout_session_id,
        durableOwnerKind: owner.owner_kind,
        durableOwnerId: Number(owner.owner_id),
      },
    )
  }
  assertDurableCheckoutOwnerSession(owner, binding.session)
  return binding
}

async function loadDurableCheckoutOwners(pool) {
  return pool.query(
    `/* stripe-reconciliation:durable-checkout-owners */
     WITH unresolved_checkout_owner AS (
       SELECT 'enrollment'::text AS owner_kind,
              enrollment.id AS owner_id,
              enrollment.family_billing_account_id,
              enrollment.stripe_checkout_session_id,
              enrollment.due_now_cents AS expected_amount_cents,
              enrollment.status AS local_status,
              enrollment.checkout_mode AS expected_checkout_mode
         FROM (
           SELECT candidate.*,
                  GREATEST(
                    0,
                    COALESCE(CASE
                      WHEN jsonb_typeof(candidate.preview_snapshot->'additionalFeesOneTime') = 'number'
                      THEN ROUND((candidate.preview_snapshot->>'additionalFeesOneTime')::numeric * 100)
                    END, 0)
                    + COALESCE(CASE
                      WHEN jsonb_typeof(candidate.preview_snapshot#>'{firstMonth,totalCents}') = 'number'
                      THEN ROUND((candidate.preview_snapshot#>>'{firstMonth,totalCents}')::numeric)
                    END, 0)
                    + COALESCE(CASE
                      WHEN jsonb_typeof(candidate.preview_snapshot->'passPurchaseTotalCents') = 'number'
                      THEN ROUND((candidate.preview_snapshot->>'passPurchaseTotalCents')::numeric)
                    END, 0)
                  )::int AS purchase_target_cents
             FROM stripe_pending_enrollment candidate
         ) enrollment
        WHERE enrollment.checkout_mode IN ('payment', 'subscription')
          AND enrollment.stripe_checkout_session_id IS NOT NULL
          AND (
            enrollment.status IN ('pending', 'processing', 'expired')
            OR (
              enrollment.status = 'failed'
              AND COALESCE(enrollment.error_message, '') NOT LIKE '${DURABLE_ENROLLMENT_REFUND_PREFIX}%'
            )
            OR (
              enrollment.status = 'completed'
              AND NOT EXISTS (
                SELECT 1
                  FROM billing_payment settled_payment
                 WHERE settled_payment.family_billing_account_id = enrollment.family_billing_account_id
                   AND settled_payment.amount_cents = enrollment.due_now_cents
                   AND settled_payment.external_processor = 'stripe'
                   AND settled_payment.external_status IN ('settled', 'succeeded')
                   AND settled_payment.stripe_checkout_session_id = enrollment.stripe_checkout_session_id
                   AND COALESCE((
                     SELECT SUM(tagged_charge.amount_cents)::int
                       FROM billing_charge tagged_charge
                      WHERE tagged_charge.family_billing_account_id = enrollment.family_billing_account_id
                        AND tagged_charge.stripe_checkout_session_id = enrollment.stripe_checkout_session_id
                   ), 0) = enrollment.purchase_target_cents
                   AND COALESCE((
                     SELECT SUM(CASE
                              WHEN application.application_kind = 'reversal'
                              THEN -application.amount_cents
                              ELSE application.amount_cents
                            END)::int
                       FROM billing_payment_application application
                       JOIN billing_charge charged
                         ON charged.id = application.billing_charge_id
                      WHERE application.billing_payment_id = settled_payment.id
                        AND charged.family_billing_account_id = enrollment.family_billing_account_id
                        AND charged.stripe_checkout_session_id = enrollment.stripe_checkout_session_id
                   ), 0) = enrollment.purchase_target_cents
                   AND COALESCE((
                     SELECT SUM(CASE
                              WHEN all_application.application_kind = 'reversal'
                              THEN -all_application.amount_cents
                              ELSE all_application.amount_cents
                            END)::int
                       FROM billing_payment_application all_application
                      WHERE all_application.billing_payment_id = settled_payment.id
                   ), 0) BETWEEN enrollment.purchase_target_cents AND enrollment.due_now_cents
                   AND NOT EXISTS (
                     SELECT 1
                       FROM billing_charge reserved_charge
                       JOIN billing_monthly_invoice_line reserved_line
                         ON reserved_line.billing_charge_id = reserved_charge.id
                       JOIN billing_monthly_invoice reserved_invoice
                         ON reserved_invoice.id = reserved_line.billing_monthly_invoice_id
                      WHERE reserved_charge.family_billing_account_id = enrollment.family_billing_account_id
                        AND reserved_charge.stripe_checkout_session_id = enrollment.stripe_checkout_session_id
                        AND reserved_invoice.status IN ('draft', 'open', 'failed', 'payment_method_required')
                   )
                   AND NOT EXISTS (
                     SELECT 1
                       FROM billing_charge reserved_charge
                       JOIN billing_payment_attempt attempt
                         ON attempt.family_billing_account_id = reserved_charge.family_billing_account_id
                       LEFT JOIN billing_payment_attempt_charge reservation
                         ON reservation.billing_payment_attempt_id = attempt.id
                      WHERE reserved_charge.family_billing_account_id = enrollment.family_billing_account_id
                        AND reserved_charge.stripe_checkout_session_id = enrollment.stripe_checkout_session_id
                        AND (
                          attempt.status IN ('pending', 'processing', 'reconciliation_required')
                          OR (attempt.status = 'reserved' AND attempt.expires_at > now())
                        )
                        AND (
                          reservation.billing_charge_id = reserved_charge.id
                          OR attempt.target_charge_id = reserved_charge.id
                          OR attempt.target_charge_id = reserved_charge.related_charge_id
                        )
                   )
                   AND NOT EXISTS (
                     SELECT 1
                       FROM billing_charge credit
                       JOIN billing_monthly_invoice_line credit_line
                         ON credit_line.billing_charge_id = credit.id
                       JOIN billing_charge_credit_application credit_application
                         ON credit_application.credit_invoice_line_id = credit_line.id
                       JOIN billing_monthly_invoice_line target_line
                         ON target_line.id = credit_application.target_invoice_line_id
                       LEFT JOIN billing_charge target_charge
                         ON target_charge.id = target_line.billing_charge_id
                      WHERE credit.family_billing_account_id = enrollment.family_billing_account_id
                        AND credit.stripe_checkout_session_id = enrollment.stripe_checkout_session_id
                        AND credit.amount_cents < 0
                        AND target_charge.stripe_checkout_session_id
                              IS DISTINCT FROM enrollment.stripe_checkout_session_id
                   )
              )
              AND NOT EXISTS (
                SELECT 1
                  FROM billing_payment reconciled_payment
                  JOIN billing_account_activity activity
                    ON activity.event_key = 'manual-checkout-payment-reconciled:' || reconciled_payment.id::text
                   AND activity.family_billing_account_id = enrollment.family_billing_account_id
                   AND activity.related_payment_id = reconciled_payment.id
                   AND activity.event_type = 'checkout_payment_reconciled'
                   AND activity.actor_type = 'system'
                   AND activity.stripe_object_id = enrollment.stripe_checkout_session_id
                   AND activity.after_value->>'externalStatus' = 'settled'
                   AND activity.details->>'amountCents' = enrollment.due_now_cents::text
                   AND activity.details->>'applicationTotalCents' = enrollment.due_now_cents::text
                 WHERE reconciled_payment.family_billing_account_id = enrollment.family_billing_account_id
                   AND reconciled_payment.amount_cents = enrollment.due_now_cents
                   AND reconciled_payment.external_processor = 'stripe'
                   AND reconciled_payment.external_status IN ('settled', 'succeeded')
                   AND reconciled_payment.stripe_checkout_session_id = enrollment.stripe_checkout_session_id
                   AND COALESCE((
                     SELECT SUM(CASE
                              WHEN application.application_kind = 'reversal'
                              THEN -application.amount_cents
                              ELSE application.amount_cents
                            END)::int
                       FROM billing_payment_application application
                      WHERE application.billing_payment_id = reconciled_payment.id
                   ), 0) = enrollment.due_now_cents
                   AND COALESCE((
                     SELECT SUM(tagged_charge.amount_cents)::int
                       FROM billing_charge tagged_charge
                      WHERE tagged_charge.family_billing_account_id = enrollment.family_billing_account_id
                        AND tagged_charge.stripe_checkout_session_id = enrollment.stripe_checkout_session_id
                   ), 0) > 0
                   AND COALESCE((
                     SELECT SUM(CASE
                              WHEN application.application_kind = 'reversal'
                              THEN -application.amount_cents
                              ELSE application.amount_cents
                            END)::int
                       FROM billing_payment_application application
                       JOIN billing_payment settled_household_payment
                         ON settled_household_payment.id = application.billing_payment_id
                        AND settled_household_payment.family_billing_account_id = enrollment.family_billing_account_id
                        AND settled_household_payment.external_status IN ('settled', 'succeeded')
                       JOIN billing_charge tagged_charge
                         ON tagged_charge.id = application.billing_charge_id
                      WHERE tagged_charge.family_billing_account_id = enrollment.family_billing_account_id
                        AND tagged_charge.stripe_checkout_session_id = enrollment.stripe_checkout_session_id
                   ), 0) = COALESCE((
                     SELECT SUM(tagged_charge.amount_cents)::int
                       FROM billing_charge tagged_charge
                      WHERE tagged_charge.family_billing_account_id = enrollment.family_billing_account_id
                        AND tagged_charge.stripe_checkout_session_id = enrollment.stripe_checkout_session_id
                   ), 0)
              )
            )
          )
          AND NOT EXISTS (
            SELECT 1
              FROM billing_payment refund_payment
             WHERE refund_payment.stripe_checkout_session_id = enrollment.stripe_checkout_session_id
               AND refund_payment.external_status = 'reconciliation_required'
               AND position(
                 '[paid-checkout-refund-required:' || enrollment.stripe_checkout_session_id || ']'
                 in COALESCE(refund_payment.note, '')
               ) > 0
          )
       UNION ALL
       SELECT 'annual_membership'::text AS owner_kind,
              annual_request.id AS owner_id,
              annual_request.family_billing_account_id,
              annual_request.stripe_checkout_session_id,
              annual_request.expected_amount_cents,
              annual_request.status AS local_status,
              NULL::text AS expected_checkout_mode
         FROM annual_membership_checkout_request annual_request
        WHERE annual_request.stripe_checkout_session_id IS NOT NULL
          AND annual_request.status <> 'quarantined'
          AND (
            annual_request.status IN ('pending', 'fulfilling', 'failed', 'expired')
            OR (
              annual_request.status = 'completed'
              AND NOT EXISTS (
                SELECT 1
                  FROM billing_payment settled_payment
                 WHERE settled_payment.family_billing_account_id = annual_request.family_billing_account_id
                   AND settled_payment.amount_cents = annual_request.expected_amount_cents
                   AND settled_payment.external_processor = 'stripe'
                   AND settled_payment.external_status IN ('settled', 'succeeded')
                   AND settled_payment.stripe_checkout_session_id = annual_request.stripe_checkout_session_id
                   AND COALESCE((
                     SELECT SUM(tagged_charge.amount_cents)::int
                       FROM billing_charge tagged_charge
                      WHERE tagged_charge.family_billing_account_id = annual_request.family_billing_account_id
                        AND tagged_charge.stripe_checkout_session_id = annual_request.stripe_checkout_session_id
                   ), 0) = annual_request.expected_amount_cents
                   AND COALESCE((
                     SELECT SUM(CASE
                              WHEN application.application_kind = 'reversal'
                              THEN -application.amount_cents
                              ELSE application.amount_cents
                            END)::int
                       FROM billing_payment_application application
                       JOIN billing_charge charged
                         ON charged.id = application.billing_charge_id
                      WHERE application.billing_payment_id = settled_payment.id
                        AND charged.family_billing_account_id = annual_request.family_billing_account_id
                        AND charged.stripe_checkout_session_id = annual_request.stripe_checkout_session_id
                   ), 0) = annual_request.expected_amount_cents
                   AND COALESCE((
                     SELECT SUM(CASE
                              WHEN all_application.application_kind = 'reversal'
                              THEN -all_application.amount_cents
                              ELSE all_application.amount_cents
                            END)::int
                       FROM billing_payment_application all_application
                      WHERE all_application.billing_payment_id = settled_payment.id
                   ), 0) = annual_request.expected_amount_cents
                   AND NOT EXISTS (
                     SELECT 1
                       FROM billing_charge reserved_charge
                       JOIN billing_monthly_invoice_line reserved_line
                         ON reserved_line.billing_charge_id = reserved_charge.id
                       JOIN billing_monthly_invoice reserved_invoice
                         ON reserved_invoice.id = reserved_line.billing_monthly_invoice_id
                      WHERE reserved_charge.family_billing_account_id = annual_request.family_billing_account_id
                        AND reserved_charge.stripe_checkout_session_id = annual_request.stripe_checkout_session_id
                        AND reserved_invoice.status IN ('draft', 'open', 'failed', 'payment_method_required')
                   )
                   AND NOT EXISTS (
                     SELECT 1
                       FROM billing_charge reserved_charge
                       JOIN billing_payment_attempt attempt
                         ON attempt.family_billing_account_id = reserved_charge.family_billing_account_id
                       LEFT JOIN billing_payment_attempt_charge reservation
                         ON reservation.billing_payment_attempt_id = attempt.id
                      WHERE reserved_charge.family_billing_account_id = annual_request.family_billing_account_id
                        AND reserved_charge.stripe_checkout_session_id = annual_request.stripe_checkout_session_id
                        AND (
                          attempt.status IN ('pending', 'processing', 'reconciliation_required')
                          OR (attempt.status = 'reserved' AND attempt.expires_at > now())
                        )
                        AND (
                          reservation.billing_charge_id = reserved_charge.id
                          OR attempt.target_charge_id = reserved_charge.id
                          OR attempt.target_charge_id = reserved_charge.related_charge_id
                        )
                   )
                   AND NOT EXISTS (
                     SELECT 1
                       FROM billing_charge credit
                       JOIN billing_monthly_invoice_line credit_line
                         ON credit_line.billing_charge_id = credit.id
                       JOIN billing_charge_credit_application credit_application
                         ON credit_application.credit_invoice_line_id = credit_line.id
                       JOIN billing_monthly_invoice_line target_line
                         ON target_line.id = credit_application.target_invoice_line_id
                       LEFT JOIN billing_charge target_charge
                         ON target_charge.id = target_line.billing_charge_id
                      WHERE credit.family_billing_account_id = annual_request.family_billing_account_id
                        AND credit.stripe_checkout_session_id = annual_request.stripe_checkout_session_id
                        AND credit.amount_cents < 0
                        AND target_charge.stripe_checkout_session_id
                              IS DISTINCT FROM annual_request.stripe_checkout_session_id
                   )
              )
            )
          )
          AND NOT EXISTS (
            SELECT 1
              FROM billing_payment refund_payment
             WHERE refund_payment.stripe_checkout_session_id = annual_request.stripe_checkout_session_id
               AND refund_payment.external_status = 'reconciliation_required'
               AND position(
                 '[paid-checkout-refund-required:' || annual_request.stripe_checkout_session_id || ']'
                 in COALESCE(refund_payment.note, '')
               ) > 0
          )
       UNION ALL
       SELECT 'store'::text AS owner_kind,
              store_order.id AS owner_id,
              store_order.family_billing_account_id,
              store_order.stripe_checkout_session_id,
              store_order.total_cents AS expected_amount_cents,
              store_order.status AS local_status,
              'payment'::text AS expected_checkout_mode
         FROM store_order
        WHERE store_order.payment_method = 'card'
          AND store_order.stripe_checkout_session_id IS NOT NULL
          AND (
            store_order.status = 'awaiting_payment'
            OR store_order.payment_status <> 'paid'
          )
     )
     SELECT owner_kind, owner_id, family_billing_account_id,
            stripe_checkout_session_id, expected_amount_cents, local_status,
            expected_checkout_mode
       FROM unresolved_checkout_owner
      ORDER BY owner_kind, owner_id`,
  ).then((result) => result.rows)
}

async function loadDurableInvoiceOwners(pool) {
  const [householdInvoices, annualInvoices] = await Promise.all([
    pool.query(
      `/* stripe-reconciliation:durable-household-invoices */
       SELECT 'household_invoice'::text AS owner_kind,
              invoice.id AS owner_id,
              invoice.family_billing_account_id,
              invoice.stripe_invoice_id,
              invoice.total_cents AS expected_amount_cents,
              invoice.status AS local_status
         FROM billing_monthly_invoice invoice
        WHERE invoice.stripe_invoice_id IS NOT NULL
          AND invoice.status IN ('draft', 'open', 'failed', 'payment_method_required', 'paid')
          AND (
            invoice.status <> 'paid'
            OR NOT EXISTS (
              SELECT 1
                FROM billing_payment settled_payment
               WHERE settled_payment.stripe_invoice_id = invoice.stripe_invoice_id
                 AND COALESCE(settled_payment.external_status, 'settled') IN ('settled', 'succeeded')
            )
          )
        ORDER BY invoice.id`,
    ).then((result) => result.rows),
    pool.query(
      `/* stripe-reconciliation:durable-annual-invoice-payments */
       SELECT 'annual_invoice'::text AS owner_kind,
              payment.id AS owner_id,
              payment.family_billing_account_id,
              payment.stripe_invoice_id,
              payment.amount_cents AS expected_amount_cents,
              payment.external_status AS local_status
         FROM billing_payment payment
        WHERE payment.external_processor = 'stripe'
          AND payment.external_status = 'reconciliation_required'
          AND payment.stripe_invoice_id IS NOT NULL
          AND position(
            '[annual-invoice-fulfillment-pending:' || payment.stripe_invoice_id || ']'
            in COALESCE(payment.note, '')
          ) > 0
          AND position(
            '[annual-invoice-refund-required:' || payment.stripe_invoice_id || ']'
            in COALESCE(payment.note, '')
          ) = 0
        ORDER BY payment.id`,
    ).then((result) => result.rows),
  ])
  return [...householdInvoices, ...annualInvoices]
}

function paidStripeInvoice(invoice) {
  return invoice?.paid === true || invoice?.status === 'paid'
}

function annualInvoicePaymentIsTerminal(payment, stripeInvoiceId) {
  return Boolean(
    payment?.refund_required === true
    || (
      payment?.external_status === 'reconciliation_required'
      && String(payment?.note ?? '').includes(
        `[annual-invoice-refund-required:${String(stripeInvoiceId)}]`,
      )
    )
  )
}

async function recordDurableOwnerIssue(pool, summary, row, error, recordAlert) {
  const objectId = row.stripe_checkout_session_id ?? row.stripe_invoice_id ?? null
  const ownerKey = `${row.owner_kind}:${row.owner_id}`
  const message = String(error?.message ?? error)
  summary.failures += 1
  summary.errors.push({
    ownerKind: row.owner_kind,
    ownerId: Number(row.owner_id),
    stripeObjectId: objectId,
    message,
  })
  try {
    await recordAlert(
      pool,
      `durable-owner:${ownerKey}:${objectId ?? 'missing'}`,
      'durable_stripe_owner_reconciliation_failed',
      'critical',
      `Durable Stripe owner ${ownerKey} could not be reconciled from ${objectId ?? 'its exact remote object'}`,
      objectId,
      {
        amount: Number(row.expected_amount_cents ?? 0),
        metadata: row.family_billing_account_id == null
          ? {}
          : { familyBillingAccountId: String(row.family_billing_account_id) },
        reason: message,
      },
    )
  } catch (alertError) {
    summary.errors.push({
      ownerKind: row.owner_kind,
      ownerId: Number(row.owner_id),
      stripeObjectId: objectId,
      message: `Billing alert write failed: ${alertError?.message ?? alertError}`,
    })
  }
}

async function releaseExpiredDurableCheckoutOwner(pool, owner, session) {
  if (session?.status !== 'expired' || session?.payment_status === 'paid') {
    throw new StripeCheckoutPaymentBindingConflict(
      `Stripe Checkout ${session?.id ?? '(missing)'} is not conclusively expired and unpaid.`,
      {
        stripeCheckoutSessionId: session?.id ?? null,
        checkoutStatus: session?.status ?? null,
        checkoutPaymentStatus: session?.payment_status ?? null,
      },
    )
  }
  if (owner.owner_kind === 'enrollment') {
    const released = await pool.query(
      `/* stripe-reconciliation:release-expired-enrollment-checkout */
       UPDATE stripe_pending_enrollment
          SET status = 'expired',
              error_message = $4,
              updated_at = now()
        WHERE id = $1
          AND stripe_checkout_session_id = $2
          AND checkout_mode = $3
          AND status IN ('pending', 'processing', 'failed')
          AND COALESCE(error_message, '') NOT LIKE $5
        RETURNING id`,
      [
        Number(owner.owner_id),
        String(session.id),
        String(owner.expected_checkout_mode),
        `Stripe Checkout ${session.id} was conclusively expired and unpaid during reconciliation.`,
        `${DURABLE_ENROLLMENT_REFUND_PREFIX}%`,
      ],
    )
    return { terminal: Boolean(released.rows[0]) || owner.local_status === 'expired', released: Boolean(released.rows[0]) }
  }
  if (owner.owner_kind === 'annual_membership') {
    const released = await pool.query(
      `/* stripe-reconciliation:release-expired-annual-checkout */
       UPDATE annual_membership_checkout_request
          SET status = 'expired', updated_at = now()
        WHERE id = $1
          AND stripe_checkout_session_id = $2
          AND status IN ('pending', 'fulfilling', 'failed')
        RETURNING id`,
      [Number(owner.owner_id), String(session.id)],
    )
    return { terminal: Boolean(released.rows[0]) || owner.local_status === 'expired', released: Boolean(released.rows[0]) }
  }
  return { terminal: false, released: false }
}

/**
 * Reconcile exact Stripe IDs that remain attached to unfinished local owners.
 * Unlike the rolling PaymentIntent scan, these queries have no time predicate:
 * an old object that succeeds late, or one whose prior attempt failed midway,
 * remains eligible on every run until the local owner becomes terminal.
 */
export async function reconcileDurableStripeOwners(pool, stripe, {
  inspectCheckoutOwner = inspectDurableCheckoutOwner,
  fulfillCheckout = reconcilePaidStripeCheckoutFulfillment,
  recordInvoice = recordAuthoritativeStripeInvoicePayment,
  recordAlert = createReconciliationAlert,
  releaseExpiredCheckoutOwner = releaseExpiredDurableCheckoutOwner,
} = {}) {
  const checkoutOwners = await loadDurableCheckoutOwners(pool)
  const invoiceOwners = await loadDurableInvoiceOwners(pool)
  const summary = {
    checkoutOwnersChecked: checkoutOwners.length,
    checkoutOwnersFulfilled: 0,
    checkoutOwnersRepaired: 0,
    checkoutOwnersRetained: 0,
    checkoutOwnersTerminal: 0,
    checkoutOwnersReleased: 0,
    householdInvoicesChecked: 0,
    householdInvoicesRepaired: 0,
    householdInvoicesRetained: 0,
    annualInvoicesChecked: 0,
    annualInvoicesRepaired: 0,
    annualInvoicesRetained: 0,
    annualInvoicesTerminal: 0,
    paymentsInserted: 0,
    failures: 0,
    errors: [],
  }

  for (const owner of checkoutOwners) {
    try {
      const binding = await inspectCheckoutOwner(stripe, owner)
      if (binding?.state === 'forbidden_subscription_pending') {
        throw new StripeCheckoutPaymentBindingConflict(
          `Historical subscription-mode Checkout ${binding.session?.id ?? owner.stripe_checkout_session_id} is ${binding.session?.status ?? 'unresolved'}/${binding.session?.payment_status ?? 'unresolved'} and can still create or retain a forbidden recurring collector; expire the open Session or review its exact subscription under the controlled retirement workflow.`,
          {
            stripeCheckoutSessionId: binding.session?.id ?? owner.stripe_checkout_session_id,
            stripeSubscriptionId: stripeId(binding.session?.subscription),
            checkoutStatus: binding.session?.status ?? null,
            checkoutPaymentStatus: binding.session?.payment_status ?? null,
            durableOwnerKind: owner.owner_kind,
            durableOwnerId: Number(owner.owner_id),
          },
        )
      }
      if (binding?.state === 'expired') {
        const release = await releaseExpiredCheckoutOwner(pool, owner, binding.session)
        if (release?.terminal !== true) {
          throw new Error(
            `Expired Checkout ${binding.session?.id ?? owner.stripe_checkout_session_id} changed local ownership before its active collection guard could be released.`,
          )
        }
        summary.checkoutOwnersTerminal += 1
        if (release.released) summary.checkoutOwnersReleased += 1
        continue
      }
      if (binding?.state !== 'paid') {
        summary.checkoutOwnersRetained += 1
        continue
      }
      const outcome = await fulfillCheckout(pool, binding, { stripe })
      if (outcome?.status === 'quarantined') {
        summary.checkoutOwnersTerminal += 1
        continue
      }
      if (
        outcome?.status === 'unverified'
        && String(outcome?.reason ?? '').includes('in_progress')
      ) {
        // A webhook or browser confirmation currently owns the same idempotent
        // commit. Keep the durable row eligible without raising a false billing
        // incident; a later daily pass re-reads this exact Session.
        summary.checkoutOwnersRetained += 1
        continue
      }
      if (outcome?.status !== 'fulfilled') {
        throw new Error(
          `Paid Checkout fulfillment remained ${outcome?.status ?? 'unverified'} (${outcome?.reason ?? 'owner did not complete'}).`,
        )
      }
      summary.checkoutOwnersFulfilled += 1
      if (outcome.repaired) summary.checkoutOwnersRepaired += 1
      if (outcome.payment?.newly_inserted) summary.paymentsInserted += 1
    } catch (error) {
      summary.checkoutOwnersRetained += 1
      await recordDurableOwnerIssue(pool, summary, owner, error, recordAlert)
    }
  }

  for (const owner of invoiceOwners) {
    const isAnnual = owner.owner_kind === 'annual_invoice'
    if (isAnnual) summary.annualInvoicesChecked += 1
    else summary.householdInvoicesChecked += 1
    try {
      const invoice = await stripe.invoices.retrieve(owner.stripe_invoice_id)
      if (stripeId(invoice) !== String(owner.stripe_invoice_id)) {
        throw new Error(
          `Stripe returned invoice ${stripeId(invoice) ?? '(missing)'} for exact owner ${owner.stripe_invoice_id}.`,
        )
      }
      if (!paidStripeInvoice(invoice)) {
        if (isAnnual) {
          throw new Error(
            `Annual fulfillment-pending payment ${owner.owner_id} points to Stripe invoice ${owner.stripe_invoice_id}, but Stripe does not report it paid.`,
          )
        }
        summary.householdInvoicesRetained += 1
        continue
      }
      const outcome = await recordInvoice(pool, { invoice, stripe })
      if (isAnnual) {
        if (outcome?.classification?.kind !== 'subscription') {
          throw new Error(
            outcome?.classification?.reason
            ?? `Stripe invoice ${owner.stripe_invoice_id} is not an exact legacy annual subscription payment.`,
          )
        }
        if (annualInvoicePaymentIsTerminal(outcome.payment, owner.stripe_invoice_id)) {
          summary.annualInvoicesTerminal += 1
          continue
        }
        if (!['settled', 'succeeded'].includes(String(outcome.payment?.external_status ?? ''))) {
          throw new Error(
            `Annual Stripe invoice ${owner.stripe_invoice_id} did not finish its exact local entitlement settlement.`,
          )
        }
        summary.annualInvoicesRepaired += 1
      } else {
        if (
          outcome?.classification?.kind !== 'household'
          || !outcome.householdSettlement
          || outcome.householdSettlement.conflicted
        ) {
          throw new Error(
            outcome?.householdSettlement?.reason
            ?? outcome?.classification?.reason
            ?? `Stripe invoice ${owner.stripe_invoice_id} did not finish its exact household settlement.`,
          )
        }
        summary.householdInvoicesRepaired += 1
      }
      if (outcome.payment?.newly_inserted) summary.paymentsInserted += 1
    } catch (error) {
      if (isAnnual) summary.annualInvoicesRetained += 1
      else summary.householdInvoicesRetained += 1
      await recordDurableOwnerIssue(pool, summary, owner, error, recordAlert)
    }
  }

  return summary
}

async function listAllStripeRefunds(stripe) {
  const params = {
    limit: 100,
  }
  const listing = stripe.refunds.list(params)
  const rows = []
  if (typeof listing?.[Symbol.asyncIterator] === 'function') {
    for await (const refund of listing) rows.push(refund)
    return rows
  }

  let page = await listing
  const cursors = new Set()
  while (page) {
    if (!Array.isArray(page.data) || typeof page.has_more !== 'boolean') {
      throw new Error('Stripe Refund pagination returned an incomplete page.')
    }
    rows.push(...page.data)
    if (page.has_more === false) return rows
    const cursor = stripeId(page.data.at(-1))
    if (!cursor || cursors.has(cursor)) {
      throw new Error('Stripe Refund pagination did not advance.')
    }
    cursors.add(cursor)
    page = await stripe.refunds.list({ ...params, starting_after: cursor })
  }
  throw new Error('Stripe Refund pagination ended before proving completeness.')
}

const DURABLE_REFUND_WEBHOOK_TYPES = Object.freeze([
  'refund.created',
  'refund.updated',
  'refund.failed',
])

async function loadDurableStripeRefundWebhookEvents(pool) {
  return pool.query(
    `/* stripe-reconciliation:durable-refund-webhook-events */
     SELECT event_id, event_type, status
       FROM stripe_webhook_event
      WHERE event_type = ANY($1::text[])
        AND (
          status = 'failed'
          OR (
            status = 'processing'
            AND COALESCE(lease_expires_at, updated_at + interval '15 minutes') <= now()
          )
        )
      ORDER BY event_id`,
    [DURABLE_REFUND_WEBHOOK_TYPES],
  ).then((result) => result.rows)
}

async function loadDurableStripeRefundIds(pool) {
  return pool.query(
    `/* stripe-reconciliation:durable-refund-ids */
     WITH retryable_refund AS (
       SELECT refund.stripe_refund_id
         FROM billing_refund refund
        WHERE refund.stripe_refund_id IS NOT NULL
          AND (
            refund.external_status = 'pending'
            OR (
              refund.external_status = 'reconciliation_required'
              AND refund.ledger_treatment IS NOT NULL
            )
            OR (
              refund.external_status = 'succeeded'
              AND refund.ledger_treatment IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                  FROM billing_account_activity activity
                 WHERE activity.event_key = 'refund-succeeded:' || refund.id::text
              )
            )
          )
       UNION
       SELECT alert.stripe_object_id AS stripe_refund_id
         FROM stripe_billing_alert alert
        WHERE alert.alert_type = 'stripe_refund_reconciliation_failed'
          AND left(alert.stripe_object_id, 3) = 're_'
          AND alert.resolved_at IS NULL
     )
     SELECT stripe_refund_id
       FROM retryable_refund
      WHERE stripe_refund_id IS NOT NULL
      GROUP BY stripe_refund_id
      ORDER BY stripe_refund_id`,
  ).then((result) => result.rows.map((row) => String(row.stripe_refund_id)))
}

async function resolveDurableRefundRetryAlert(pool, stripeRefundId) {
  await pool.query(
    `/* stripe-reconciliation:resolve-durable-refund-alert */
     UPDATE stripe_billing_alert
        SET action_status = CASE
              WHEN action_status = 'suspended' THEN action_status
              ELSE 'resolved'
            END,
            resolved_at = CASE
              WHEN action_status = 'suspended' THEN resolved_at
              ELSE COALESCE(resolved_at, now())
            END,
            resolution_note = CASE
              WHEN action_status = 'suspended' THEN resolution_note
              ELSE COALESCE(
                resolution_note,
                'Automatically resolved after exact Stripe refund reconciliation.'
              )
            END,
            updated_at = now()
      WHERE alert_type = 'stripe_refund_reconciliation_failed'
        AND stripe_object_id = $1
        AND resolved_at IS NULL`,
    [stripeRefundId],
  )
}

async function resolveDurableRefundWebhookRetryAlert(pool, stripeWebhookEventId) {
  await pool.query(
    `/* stripe-reconciliation:resolve-durable-refund-webhook-alert */
     UPDATE stripe_billing_alert
        SET action_status = CASE
              WHEN action_status = 'suspended' THEN action_status
              ELSE 'resolved'
            END,
            resolved_at = CASE
              WHEN action_status = 'suspended' THEN resolved_at
              ELSE COALESCE(resolved_at, now())
            END,
            resolution_note = CASE
              WHEN action_status = 'suspended' THEN resolution_note
              ELSE COALESCE(
                resolution_note,
                'Automatically resolved after the failed refund webhook completed exact reconciliation.'
              )
            END,
            updated_at = now()
      WHERE alert_type IN (
              'stripe_refund_webhook_reconciliation_failed',
              'webhook_failure'
            )
        AND stripe_object_id = $1
        AND resolved_at IS NULL`,
    [stripeWebhookEventId],
  )
}

async function persistDurableRefundFailure(pool, refund, error, recordAlert) {
  const refundId = stripeId(refund)
  if (!refundId) {
    // There is no exact retry anchor to persist. Failing the whole run keeps
    // its high-water mark from advancing past the malformed Stripe response.
    throw new Error(`Stripe refund reconciliation failed without an exact refund ID: ${error?.message ?? error}`)
  }
  await recordAlert(
    pool,
    `refund:${refundId}:retry`,
    'stripe_refund_reconciliation_failed',
    'critical',
    `Stripe refund ${refundId} could not complete exact local reconciliation`,
    refundId,
    {
      amount: Number(refund?.amount ?? 0),
      status: refund?.status ?? null,
      payment_intent: stripeId(refund?.payment_intent)
        ?? stripeId(refund?.charge?.payment_intent),
      reason: String(error?.message ?? error),
    },
  )
}

/**
 * Reconcile the complete Stripe Refund inventory plus durable exact refund IDs
 * retained after earlier failures. The all-age inventory is intentional: it is
 * the bootstrap safety net for old refunds whose webhook was absent, rejected
 * before persistence, or incorrectly marked processed by historical code. The
 * retry anchor is the Refund ID; its immutable Charge/PaymentIntent owner is
 * resolved only inside syncStripeRefund.
 */
export async function reconcileStripeRefunds(pool, stripe, {
  startedAt,
  endedAt,
  listRefunds = listAllStripeRefunds,
  loadDurableIds = loadDurableStripeRefundIds,
  loadFailedWebhookEvents = loadDurableStripeRefundWebhookEvents,
  syncRefund = syncStripeRefund,
  finalizeRefund = finalizeRefundLedgerTreatment,
  recordAlert = createReconciliationAlert,
  resolveRetryAlert = resolveDurableRefundRetryAlert,
  resolveWebhookRetryAlert = resolveDurableRefundWebhookRetryAlert,
  beginWebhook = beginStripeWebhookEvent,
  completeWebhook = completeStripeWebhookEvent,
  failWebhook = failStripeWebhookEvent,
} = {}) {
  const [durableIds, failedWebhookEvents] = await Promise.all([
    loadDurableIds(pool),
    loadFailedWebhookEvents(pool),
  ])
  const refunds = new Map()
  const failures = []
  const webhookClaimsByRefundId = new Map()

  // Prove complete inventory before acquiring any failed-webhook leases. If
  // pagination fails, the run stops without leaving fresh processing claims.
  const allAgeRefunds = await listRefunds(stripe, { startedAt, endedAt })
  for (const refund of allAgeRefunds) {
    const refundId = stripeId(refund)
    if (!refundId) {
      await persistDurableRefundFailure(
        pool,
        refund,
        new Error('Stripe listed a refund without an ID.'),
        recordAlert,
      )
    }
    refunds.set(refundId, refund)
  }

  for (const webhook of failedWebhookEvents) {
    try {
      const event = await stripe.events.retrieve(webhook.event_id)
      if (
        stripeId(event) !== String(webhook.event_id)
        || String(event?.type ?? '') !== String(webhook.event_type ?? '')
        || !DURABLE_REFUND_WEBHOOK_TYPES.includes(String(event?.type ?? ''))
      ) {
        throw new Error(
          `Stripe returned a different event for durable refund webhook ${webhook.event_id}.`,
        )
      }
      const refund = event?.data?.object
      const refundId = stripeId(refund)
      if (!refundId || refund?.object !== 'refund') {
        throw new Error(
          `Stripe refund webhook ${webhook.event_id} has no exact Refund object.`,
        )
      }
      const claim = await beginWebhook(pool, event)
      if (claim?.replayed === true) {
        await resolveWebhookRetryAlert(pool, webhook.event_id)
        continue
      }
      if (claim?.claimed !== true || !claim.claimToken) {
        // A live webhook worker owns this event. It will either complete it or
        // leave an expired lease for a later durable pass.
        continue
      }
      const claims = webhookClaimsByRefundId.get(refundId) ?? []
      claims.push({ event, claimToken: claim.claimToken })
      webhookClaimsByRefundId.set(refundId, claims)
      if (!refunds.has(refundId)) refunds.set(refundId, refund)
    } catch (error) {
      await recordAlert(
        pool,
        `refund-webhook:${webhook.event_id}:retry`,
        'stripe_refund_webhook_reconciliation_failed',
        'critical',
        `Failed Stripe refund webhook ${webhook.event_id} could not be re-read for exact reconciliation`,
        webhook.event_id,
        { status: webhook.status ?? null, reason: String(error?.message ?? error) },
      )
      failures.push({
        stripeWebhookEventId: webhook.event_id,
        message: String(error?.message ?? error),
      })
    }
  }

  for (const refundId of durableIds) {
    try {
      const refund = await stripe.refunds.retrieve(refundId, { expand: ['charge'] })
      if (stripeId(refund) !== refundId) {
        throw new Error(`Stripe returned refund ${stripeId(refund) ?? '(missing)'} for exact retry ${refundId}.`)
      }
      refunds.set(refundId, refund)
    } catch (error) {
      const exact = { id: refundId, object: 'refund' }
      await persistDurableRefundFailure(pool, exact, error, recordAlert)
      failures.push({ stripeRefundId: refundId, message: String(error?.message ?? error) })
    }
  }

  const summary = {
    checked: 0,
    synced: 0,
    finalized: 0,
    pending: 0,
    reconciliationRequired: 0,
    failed: failures.length,
    durableIdsChecked: durableIds.length,
    failedWebhookEventsChecked: failedWebhookEvents.length,
    errors: failures,
  }
  const orderedRefunds = [...refunds.values()].sort((left, right) => {
    const createdDifference = Number(left?.created ?? 0) - Number(right?.created ?? 0)
    return createdDifference || String(left?.id ?? '').localeCompare(String(right?.id ?? ''))
  })

  for (const refund of orderedRefunds) {
    const refundId = stripeId(refund)
    summary.checked += 1
    try {
      let local = await syncRefund(pool, refund, {
        stripeClient: stripe,
        event: { id: `reconciliation:refund:${refundId}`, type: 'refund.reconciliation' },
      })
      if (!local?.id) throw new Error(`Stripe refund ${refundId} did not produce an exact local refund row.`)
      summary.synced += 1
      if (stripeRefundReadyForLedgerFinalization(local)) {
        local = await finalizeRefund(pool, local, { actorType: 'reconciliation' })
        if (!local?.id || local.external_status !== 'succeeded') {
          throw new Error(`Stripe refund ${refundId} did not finish its approved ledger treatment.`)
        }
        summary.finalized += 1
      } else if (local.external_status === 'pending') {
        summary.pending += 1
      } else if (local.external_status === 'reconciliation_required') {
        summary.reconciliationRequired += 1
      }
      await resolveRetryAlert(pool, refundId)
      for (const claim of webhookClaimsByRefundId.get(refundId) ?? []) {
        await completeWebhook(pool, claim.event, { claimToken: claim.claimToken })
        await resolveWebhookRetryAlert(pool, claim.event.id)
      }
    } catch (error) {
      await persistDurableRefundFailure(pool, refund, error, recordAlert)
      for (const claim of webhookClaimsByRefundId.get(refundId) ?? []) {
        await failWebhook(pool, claim.event, error, { claimToken: claim.claimToken })
      }
      summary.failed += 1
      summary.errors.push({ stripeRefundId: refundId, message: String(error?.message ?? error) })
    }
  }
  return summary
}

export async function runStripeReconciliation(pool, { lookbackHours = 168 } = {}) {
  const reconciliationStartedAtMs = Date.now()
  if (!stripeEnabled()) throw new Error('Stripe is disabled or not configured.')
  await ensureSchema(pool)
  const stripe = await getStripeClient()
  if (!stripe) throw new Error('Stripe SDK is unavailable.')

  const {
    startedAt,
    endedAt,
  } = await resolveStripeReconciliationWindow(pool, { lookbackHours })
  const runResult = await pool.query(
    `INSERT INTO stripe_reconciliation_run (status, window_started_at, window_ended_at)
     VALUES ('running', $1, $2) RETURNING id`,
    [startedAt, endedAt],
  )
  const runId = runResult.rows[0].id
  const summary = {
    stripePaymentsChecked: 0,
    paymentsInserted: 0,
    mismatchesFound: 0,
    disputesChecked: 0,
    subscriptionsChecked: 0,
    subscriptionDriftsFound: 0,
    canonicalCollectorAccountsChecked: 0,
    canonicalCollectorDriftsFound: 0,
    paymentAttemptsChecked: 0,
    paymentAttemptsSettled: 0,
    paymentAttemptsReleased: 0,
    paymentAttemptsRetained: 0,
    checkoutPaymentsDelegated: 0,
    checkoutFulfillmentsRepaired: 0,
    paymentsDeferred: 0,
    durableCheckoutOwnersChecked: 0,
    durableCheckoutOwnersFulfilled: 0,
    durableCheckoutOwnersRetained: 0,
    durableCheckoutOwnersTerminal: 0,
    durableCheckoutOwnersReleased: 0,
    durableHouseholdInvoicesChecked: 0,
    durableHouseholdInvoicesRepaired: 0,
    durableHouseholdInvoicesRetained: 0,
    durableAnnualInvoicesChecked: 0,
    durableAnnualInvoicesRepaired: 0,
    durableAnnualInvoicesRetained: 0,
    durableAnnualInvoicesTerminal: 0,
    durableOwnerFailures: 0,
    stripeRefundsChecked: 0,
    stripeRefundsSynced: 0,
    stripeRefundsFinalized: 0,
    stripeRefundsPending: 0,
    stripeRefundsReconciliationRequired: 0,
    stripeRefundFailures: 0,
    durableRefundIdsChecked: 0,
    durableRefundWebhookEventsChecked: 0,
  }

  try {
    for await (const intent of stripe.paymentIntents.list({
      created: { gte: Math.floor(startedAt.getTime() / 1000), lte: Math.floor(endedAt.getTime() / 1000) },
      limit: 100,
    })) {
      if (intent.status !== 'succeeded') continue
      summary.stripePaymentsChecked += 1
      try {
        assertStripeUsdCurrency(intent, {
          source: 'PaymentIntent',
          stripePaymentIntentId: intent.id,
        })
      } catch (error) {
        if (!(error instanceof StripeInvoicePaymentBindingConflict)) throw error
        summary.mismatchesFound += 1
        await createReconciliationAlert(
          pool,
          `${intent.id}:currency`,
          'reconciliation_mismatch',
          'critical',
          error.message,
          intent.id,
          { amount: Number(intent.amount_received ?? intent.amount ?? 0), ...error.details },
        )
        continue
      }
      const stripeAmount = Number(intent.amount_received ?? intent.amount ?? 0)
      let stripeInvoice = null
      try {
        stripeInvoice = await resolveStripePaymentIntentInvoice(stripe, intent)
      } catch (error) {
        if (!(error instanceof StripeInvoicePaymentBindingConflict)) throw error
        summary.mismatchesFound += 1
        await createReconciliationAlert(
          pool,
          `${intent.id}:invoice-payment-binding`,
          'reconciliation_mismatch',
          'critical',
          error.message,
          intent.id,
          { amount: stripeAmount, ...error.details },
        )
        continue
      }
      const stripeInvoiceId = stripeId(stripeInvoice)
      if (stripeInvoiceId) {
        const invoiceOutcome = await recordAuthoritativeStripeInvoicePayment(pool, {
          invoice: stripeInvoice,
          stripe,
        })
        if (invoiceOutcome.payment?.newly_inserted) summary.paymentsInserted += 1
        if (invoiceOutcome.classification.kind === 'household') {
          if (invoiceOutcome.householdSettlement?.conflicted) {
            summary.mismatchesFound += 1
            await createReconciliationAlert(
              pool,
              `${intent.id}:household-invoice`,
              'reconciliation_mismatch',
              'critical',
              `Stripe payment ${intent.id} could not consume its exact household invoice lines`,
              intent.id,
              { amount: stripeAmount, reason: invoiceOutcome.householdSettlement.reason, stripeInvoiceId },
            )
          }
          continue
        }
        if (invoiceOutcome.classification.kind !== 'subscription') {
          summary.mismatchesFound += 1
          await createReconciliationAlert(
            pool,
            `${intent.id}:${invoiceOutcome.classification.code}`,
            'reconciliation_mismatch',
            'critical',
            invoiceOutcome.classification.reason,
            intent.id,
            { amount: stripeAmount, stripeInvoiceId, monthlyInvoiceId: stripeInvoice?.metadata?.monthlyInvoiceId ?? null },
          )
          continue
        }
        await allocateHouseholdPayments(pool, {
          accountId: invoiceOutcome.payment.family_billing_account_id,
          actorType: 'reconciliation',
        })
        continue
      }

      let checkoutBinding = null
      try {
        checkoutBinding = await inspectStripePaymentIntentCheckoutSession(stripe, intent)
      } catch (error) {
        if (!(error instanceof StripeCheckoutPaymentBindingConflict)) throw error
        summary.mismatchesFound += 1
        await createReconciliationAlert(
          pool,
          `${intent.id}:checkout-payment-binding`,
          'reconciliation_mismatch',
          'critical',
          error.message,
          intent.id,
          { amount: stripeAmount, ...error.details },
        )
        continue
      }
      if (checkoutBinding?.state === 'paid') {
        let fulfillment = null
        try {
          fulfillment = await reconcilePaidStripeCheckoutFulfillment(pool, checkoutBinding, { stripe })
        } catch (error) {
          const canBeFreshOwnerRace = (
            error instanceof BillingPaymentAttemptMappingConflict
            || error instanceof StoreStripeCheckoutBindingConflict
            || error?.code === 'ENROLLMENT_CHECKOUT_FORBIDDEN'
            || error?.code === 'CHECKOUT_IDEMPOTENCY_CONFLICT'
          )
          if (
            canBeFreshOwnerRace
            && stripePaymentIntentOwnershipIsFresh(intent, { nowMs: endedAt.getTime() })
          ) {
            summary.paymentsDeferred += 1
            continue
          }
          summary.mismatchesFound += 1
          await createReconciliationAlert(
            pool,
            `${intent.id}:checkout-fulfillment`,
            'stripe_checkout_fulfillment_unverified',
            'critical',
            `Paid Stripe Checkout ${checkoutBinding.session.id} could not verify its local fulfillment owner`,
            intent.id,
            {
              amount: stripeAmount,
              stripeCheckoutSessionId: checkoutBinding.session.id,
              checkoutType: checkoutBinding.checkoutType,
              reason: error?.message ?? String(error),
            },
          )
          continue
        }
        if (fulfillment?.status !== 'fulfilled') {
          if (stripePaymentIntentOwnershipIsFresh(intent, { nowMs: endedAt.getTime() })) {
            summary.paymentsDeferred += 1
            continue
          }
          summary.mismatchesFound += 1
          await createReconciliationAlert(
            pool,
            `${intent.id}:checkout-fulfillment`,
            'stripe_checkout_fulfillment_unverified',
            'critical',
            `Paid Stripe Checkout ${checkoutBinding.session.id} has no verified local fulfillment owner`,
            intent.id,
            {
              amount: stripeAmount,
              stripeCheckoutSessionId: checkoutBinding.session.id,
              checkoutType: checkoutBinding.checkoutType,
              reason: fulfillment?.reason ?? 'checkout_fulfillment_missing',
            },
          )
          continue
        }
        summary.checkoutPaymentsDelegated += 1
        if (fulfillment.repaired) summary.checkoutFulfillmentsRepaired += 1
        continue
      }
      if (checkoutBinding?.state === 'pending') {
        if (stripePaymentIntentOwnershipIsFresh(intent, { nowMs: endedAt.getTime() })) {
          summary.paymentsDeferred += 1
          continue
        }
        summary.mismatchesFound += 1
        await createReconciliationAlert(
          pool,
          `${intent.id}:checkout-payment-pending`,
          'stripe_checkout_payment_owner_unverified',
          'critical',
          `Succeeded Stripe payment ${intent.id} is linked to a Checkout Session that is not conclusively paid`,
          intent.id,
          {
            amount: stripeAmount,
            stripeCheckoutSessionId: checkoutBinding.session?.id ?? null,
            checkoutType: checkoutBinding.checkoutType,
            checkoutStatus: checkoutBinding.session?.status ?? null,
            checkoutPaymentStatus: checkoutBinding.session?.payment_status ?? null,
          },
        )
        continue
      }

      let reservedAttempt = null
      try {
        reservedAttempt = await findBillingPaymentAttemptForStripeObject(pool, intent)
      } catch (error) {
        if (!(error instanceof BillingPaymentAttemptMappingConflict)) throw error
        if (stripePaymentIntentOwnershipIsFresh(intent, { nowMs: endedAt.getTime() })) {
          summary.paymentsDeferred += 1
          continue
        }
        summary.mismatchesFound += 1
        await createReconciliationAlert(
          pool,
          `${intent.id}:payment-attempt-identity`,
          'reconciliation_mismatch',
          'critical',
          `Stripe payment ${intent.id} could not be bound to its durable payment attempt`,
          intent.id,
          { amount: stripeAmount, reason: error.message },
        )
        continue
      }
      if (reservedAttempt) {
        const settlement = await recordAndCompleteBillingPaymentAttempt(pool, {
          stripeObject: intent,
          paymentIntentId: intent.id,
          amountCents: stripeAmount,
          customerId: stripeId(intent.customer),
        })
        if (settlement?.payment?.newly_inserted) summary.paymentsInserted += 1
        if (settlement?.conflicted) {
          summary.mismatchesFound += 1
          await createReconciliationAlert(
            pool,
            `${intent.id}:payment-attempt`,
            'reconciliation_mismatch',
            'critical',
            `Stripe payment ${intent.id} could not consume its exact payment-attempt reservation`,
            intent.id,
            { amount: stripeAmount, reason: settlement.reason },
          )
        }
        continue
      }

      const local = await pool.query(
        `SELECT id, amount_cents, family_billing_account_id, external_status,
                stripe_customer_id
           FROM billing_payment
          WHERE stripe_payment_intent_id = $1
          ORDER BY id
          LIMIT 2`,
        [intent.id],
      )
      if (local.rows[0]) {
        const localPayment = local.rows[0]
        const customerId = stripeId(intent.customer)
        const metadataAccountId = Number(intent?.metadata?.familyBillingAccountId)
        const mismatchReasons = []
        if (local.rows.length !== 1) {
          mismatchReasons.push(`local_payment_count:${local.rows.length}`)
        }
        if (paymentAmountsMismatch(localPayment.amount_cents, stripeAmount)) {
          mismatchReasons.push(`local_amount_cents:${localPayment.amount_cents}`)
        }
        if (!['settled', 'succeeded'].includes(String(localPayment.external_status ?? ''))) {
          mismatchReasons.push(`local_status:${localPayment.external_status ?? 'missing'}`)
        }
        if (String(localPayment.stripe_customer_id ?? '') !== String(customerId ?? '')) {
          mismatchReasons.push(`local_customer:${localPayment.stripe_customer_id ?? 'missing'}`)
        }
        if (
          Number.isFinite(metadataAccountId)
          && metadataAccountId > 0
          && Number(localPayment.family_billing_account_id) !== metadataAccountId
        ) {
          mismatchReasons.push(`metadata_account:${metadataAccountId}`)
        }
        if (mismatchReasons.length > 0) {
          summary.mismatchesFound += 1
          await createReconciliationAlert(
            pool, `${intent.id}:recorded-owner`, 'reconciliation_mismatch', 'critical',
            `Stripe payment ${intent.id} does not match its recorded ledger owner`, intent.id,
            { amount: stripeAmount, reason: mismatchReasons.join(',') },
          )
        }
        continue
      }

      if (stripePaymentIntentOwnershipIsFresh(intent, { nowMs: endedAt.getTime() })) {
        summary.paymentsDeferred += 1
        continue
      }

      summary.mismatchesFound += 1
      await createReconciliationAlert(
        pool, `${intent.id}:owner-unverified`, 'stripe_payment_owner_unverified', 'critical',
        `Stripe payment ${intent.id} has neither a paid invoice binding, an existing ledger payment, nor a durable payment-attempt owner`,
        intent.id,
        { amount: stripeAmount, customer: stripeId(intent.customer) },
      )
    }

    const attemptSummary = await reconcileActiveBillingPaymentAttempts(pool, stripe)
    summary.paymentAttemptsChecked = attemptSummary.checked
    summary.paymentAttemptsSettled = attemptSummary.settled
    summary.paymentAttemptsReleased = attemptSummary.released
    summary.paymentAttemptsRetained = attemptSummary.retained
    summary.mismatchesFound += attemptSummary.conflicted
    for (const issue of attemptSummary.errors) {
      await createReconciliationAlert(
        pool,
        `payment-attempt:${issue.attemptId}:remote-reconciliation`,
        'reconciliation_mismatch',
        'critical',
        `Billing payment attempt ${issue.attemptId} could not verify its remote Stripe state`,
        null,
        { reason: issue.message },
      )
    }
    for (const ambiguity of attemptSummary.ambiguities) {
      await createReconciliationAlert(
        pool,
        `payment-attempt:${ambiguity.attemptId}:remote-object-ambiguous`,
        'reconciliation_mismatch',
        'warning',
        `Billing payment attempt ${ambiguity.attemptId} has no conclusive remote Stripe object; its reservation remains active`,
        null,
        { reason: ambiguity.message },
      )
    }

    const durableOwnerSummary = await reconcileDurableStripeOwners(pool, stripe)
    summary.durableCheckoutOwnersChecked = durableOwnerSummary.checkoutOwnersChecked
    summary.durableCheckoutOwnersFulfilled = durableOwnerSummary.checkoutOwnersFulfilled
    summary.durableCheckoutOwnersRetained = durableOwnerSummary.checkoutOwnersRetained
    summary.durableCheckoutOwnersTerminal = durableOwnerSummary.checkoutOwnersTerminal
    summary.durableCheckoutOwnersReleased = durableOwnerSummary.checkoutOwnersReleased
    summary.durableHouseholdInvoicesChecked = durableOwnerSummary.householdInvoicesChecked
    summary.durableHouseholdInvoicesRepaired = durableOwnerSummary.householdInvoicesRepaired
    summary.durableHouseholdInvoicesRetained = durableOwnerSummary.householdInvoicesRetained
    summary.durableAnnualInvoicesChecked = durableOwnerSummary.annualInvoicesChecked
    summary.durableAnnualInvoicesRepaired = durableOwnerSummary.annualInvoicesRepaired
    summary.durableAnnualInvoicesRetained = durableOwnerSummary.annualInvoicesRetained
    summary.durableAnnualInvoicesTerminal = durableOwnerSummary.annualInvoicesTerminal
    summary.durableOwnerFailures = durableOwnerSummary.failures
    summary.checkoutPaymentsDelegated += durableOwnerSummary.checkoutOwnersFulfilled
    summary.checkoutFulfillmentsRepaired += durableOwnerSummary.checkoutOwnersRepaired
    summary.paymentsInserted += durableOwnerSummary.paymentsInserted
    summary.mismatchesFound += durableOwnerSummary.failures

    const refundSummary = await reconcileStripeRefunds(pool, stripe, { startedAt, endedAt })
    summary.stripeRefundsChecked = refundSummary.checked
    summary.stripeRefundsSynced = refundSummary.synced
    summary.stripeRefundsFinalized = refundSummary.finalized
    summary.stripeRefundsPending = refundSummary.pending
    summary.stripeRefundsReconciliationRequired = refundSummary.reconciliationRequired
    summary.stripeRefundFailures = refundSummary.failed
    summary.durableRefundIdsChecked = refundSummary.durableIdsChecked
    summary.durableRefundWebhookEventsChecked = refundSummary.failedWebhookEventsChecked
    summary.mismatchesFound += refundSummary.failed + refundSummary.reconciliationRequired

    for await (const dispute of stripe.disputes.list({
      created: { gte: Math.floor(startedAt.getTime() / 1000) },
      limit: 100,
    })) {
      summary.disputesChecked += 1
      if (['won', 'lost'].includes(dispute.status)) continue
      await createReconciliationAlert(
        pool, `dispute:${dispute.id}`, 'dispute', 'critical',
        `Stripe dispute ${dispute.status ?? 'requires attention'} (${dispute.reason ?? 'reason unavailable'})`,
        dispute.id, { status: dispute.status, reason: dispute.reason, amount: dispute.amount },
      )
    }

    const subscriptionSummary = await reconcileStripeSubscriptionPrices(pool, stripe, { now: endedAt })
    summary.subscriptionsChecked = subscriptionSummary.subscriptionsChecked
    summary.subscriptionDriftsFound = subscriptionSummary.subscriptionDriftsFound
    summary.mismatchesFound += subscriptionSummary.subscriptionDriftsFound
    const collectorInventory = await reconcileCanonicalStripeCollectorInventory(pool, stripe)
    summary.canonicalCollectorAccountsChecked = collectorInventory.accountsChecked
    summary.canonicalCollectorDriftsFound = collectorInventory.collectorDriftsFound
    summary.mismatchesFound += collectorInventory.collectorDriftsFound

    const staleWebhooks = await pool.query(
      `SELECT event_id, event_type, status, last_error FROM stripe_webhook_event
       WHERE status = 'failed' OR (status = 'processing' AND updated_at < now() - interval '15 minutes')`,
    )
    for (const webhook of staleWebhooks.rows) {
      await createReconciliationAlert(
        pool, `webhook:${webhook.event_id}`, 'webhook_failure', 'critical',
        `Stripe webhook ${webhook.event_type} is ${webhook.status}`, webhook.event_id,
        { status: webhook.status, reason: webhook.last_error },
      )
    }

    await pool.query(
      `UPDATE stripe_reconciliation_run SET status = 'succeeded', stripe_payments_checked = $2,
       payments_inserted = $3, mismatches_found = $4, disputes_checked = $5, completed_at = now()
       WHERE id = $1`,
      [runId, summary.stripePaymentsChecked, summary.paymentsInserted, summary.mismatchesFound, summary.disputesChecked],
    )
    const durationMs = Date.now() - reconciliationStartedAtMs
    console.log(JSON.stringify({
      level: 'info',
      message: 'Stripe reconciliation completed',
      runId,
      durationMs,
      ...summary,
    }))
    return {
      runId: Number(runId),
      ...summary,
      durationMs,
      status: 'succeeded',
      windowStartedAt: startedAt,
      windowEndedAt: endedAt,
    }
  } catch (error) {
    await pool.query(
      `UPDATE stripe_reconciliation_run SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1`,
      [runId, String(error?.message ?? error).slice(0, 1000)],
    )
    await createReconciliationAlert(pool, `run:${runId}`, 'reconciliation_failed', 'critical',
      `Daily Stripe reconciliation failed: ${error?.message ?? error}`, String(runId))
    throw error
  }
}

export async function getStripeOperationsDashboard(pool, {
  facilityId = null,
  allowGlobal = false,
} = {}) {
  const scopedFacilityId = requireAdminFacilityScope({ facilityId, allowGlobal })
  await ensureSchema(pool)
  const [alerts, recentRuns, webhookCounts, webhookIncidents] = await Promise.all([
    pool.query(`
      SELECT a.*,
             f.family_name,
             NULLIF(TRIM(CONCAT_WS(' ', payer.first_name, payer.last_name)), '') AS payer_name,
             COALESCE(NULLIF(TRIM(fba.billing_email), ''), NULLIF(TRIM(payer.email), '')) AS payer_email,
             NULLIF(a.details->>'amount', '')::numeric AS attempted_amount,
             a.details->>'reason' AS failure_reason,
             a.details->>'attemptCount' AS attempt_count,
             a.details->>'nextPaymentAttempt' AS next_payment_attempt
      FROM stripe_billing_alert a
      LEFT JOIN family_billing_account fba ON fba.id = a.family_billing_account_id
      LEFT JOIN family f ON f.id = fba.family_id
      LEFT JOIN member payer ON payer.id = fba.payer_member_id
      WHERE a.resolved_at IS NULL
        AND ($1::bigint IS NULL OR f.facility_id = $1)
      ORDER BY a.created_at DESC LIMIT 100
    `, [scopedFacilityId]),
    pool.query(
      `SELECT * FROM stripe_reconciliation_run
       WHERE $1::bigint IS NULL
       ORDER BY started_at DESC LIMIT 10`,
      [scopedFacilityId],
    ),
    pool.query(
      `SELECT e.status, COUNT(DISTINCT e.event_id)::int AS count
       FROM stripe_webhook_event e
       LEFT JOIN stripe_billing_alert a ON a.stripe_event_id = e.event_id
       LEFT JOIN family_billing_account fba ON fba.id = a.family_billing_account_id
       LEFT JOIN family f ON f.id = fba.family_id
       WHERE e.received_at >= now() - interval '7 days'
         AND ($1::bigint IS NULL OR f.facility_id = $1)
       GROUP BY e.status`,
      [scopedFacilityId],
    ),
    pool.query(
      `SELECT e.event_id, e.event_type, e.status, e.attempts,
              LEFT(COALESCE(last_error, ''), 500) AS last_error,
              e.received_at, e.processed_at, e.updated_at,
              a.stripe_object_id, a.message AS alert_message,
              f.family_name,
              NULLIF(TRIM(CONCAT_WS(' ', payer.first_name, payer.last_name)), '') AS payer_name,
              COALESCE(NULLIF(TRIM(fba.billing_email), ''), NULLIF(TRIM(payer.email), '')) AS payer_email,
              NULLIF(a.details->>'amount', '')::numeric AS attempted_amount,
              a.details->>'reason' AS failure_reason,
              a.details->>'attemptCount' AS attempt_count,
              a.details->>'nextPaymentAttempt' AS next_payment_attempt
       FROM stripe_webhook_event e
       LEFT JOIN stripe_billing_alert a ON a.stripe_event_id = e.event_id
       LEFT JOIN family_billing_account fba ON fba.id = a.family_billing_account_id
       LEFT JOIN family f ON f.id = fba.family_id
       LEFT JOIN member payer ON payer.id = fba.payer_member_id
       WHERE (
         e.status = 'failed'
         OR (e.status = 'processing' AND e.updated_at < now() - interval '15 minutes')
       )
         AND ($1::bigint IS NULL OR f.facility_id = $1)
       ORDER BY e.updated_at DESC
       LIMIT 25`,
      [scopedFacilityId],
    ),
  ])
  const enabled = stripeEnabled()
  const latestReconciliation = recentRuns.rows[0] ?? null
  const webhookCountsMap = Object.fromEntries(webhookCounts.rows.map((row) => [row.status, Number(row.count)]))
  const emailDomainVerified = process.env.STRIPE_EMAIL_DOMAIN_VERIFIED === 'true'
  const readiness = buildStripeReadiness({
    enabled,
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecrets: [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_WEBHOOK_SECRETS]
      .filter(Boolean)
      .join(','),
    latestReconciliation,
    failedWebhookCount: webhookCountsMap.failed ?? 0,
    criticalAlertCount: alerts.rows.filter((alert) => alert.severity === 'critical').length,
    emailDomainVerified,
  })
  return {
    stripeEnabled: enabled,
    stripeMode: readiness.mode,
    readyForLivePayments: readiness.readyForLivePayments,
    readinessChecks: readiness.checks,
    emailDomain: process.env.STRIPE_EMAIL_DOMAIN || null,
    emailDomainVerified,
    alerts: alerts.rows,
    latestReconciliation,
    recentReconciliations: recentRuns.rows,
    webhookCounts: webhookCountsMap,
    webhookIncidents: webhookIncidents.rows,
  }
}
