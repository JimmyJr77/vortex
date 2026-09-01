import { createHash } from 'crypto'
import { getStripeClient, recordStripePayment, stripeEnabled } from './stripeBilling.js'
import { recordStripeBillingAlert } from './stripeOperations.js'
import { recordBillingActivityBestEffort } from './billingActivity.js'
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
  inspectStripeCustomerSubscriptionInventory,
  inspectStripeCustomerSubscriptionScheduleInventory,
} from './canonicalBillingMigrationStripe.js'

async function ensureSchema() {
  // Compatibility hook. Startup billing readiness owns this schema contract.
}

function stripeId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
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

async function accountIdForPaymentIntent(pool, intent) {
  const metadataId = Number(intent?.metadata?.familyBillingAccountId)
  if (Number.isFinite(metadataId) && metadataId > 0) return metadataId
  const customerId = stripeId(intent?.customer)
  if (!customerId) return null
  const result = await pool.query(
    `SELECT id FROM family_billing_account WHERE stripe_customer_id = $1 LIMIT 1`,
    [customerId],
  )
  return result.rows[0]?.id ? Number(result.rows[0].id) : null
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

export async function runStripeReconciliation(pool, { lookbackHours = 48 } = {}) {
  const reconciliationStartedAtMs = Date.now()
  if (!stripeEnabled()) throw new Error('Stripe is disabled or not configured.')
  await ensureSchema(pool)
  const stripe = await getStripeClient()
  if (!stripe) throw new Error('Stripe SDK is unavailable.')

  const endedAt = new Date()
  const startedAt = new Date(endedAt.getTime() - Math.max(1, Number(lookbackHours)) * 60 * 60 * 1000)
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
  }

  try {
    for await (const intent of stripe.paymentIntents.list({
      created: { gte: Math.floor(startedAt.getTime() / 1000), lte: Math.floor(endedAt.getTime() / 1000) },
      limit: 100,
    })) {
      if (intent.status !== 'succeeded') continue
      summary.stripePaymentsChecked += 1
      const local = await pool.query(
        `SELECT id, amount_cents, family_billing_account_id FROM billing_payment
         WHERE stripe_payment_intent_id = $1 LIMIT 1`,
        [intent.id],
      )
      const stripeAmount = Number(intent.amount_received ?? intent.amount ?? 0)
      let reservedAttempt = null
      try {
        reservedAttempt = await findBillingPaymentAttemptForStripeObject(pool, intent)
      } catch (error) {
        if (!(error instanceof BillingPaymentAttemptMappingConflict)) throw error
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

      const stripeInvoiceId = stripeId(intent.invoice)
      if (stripeInvoiceId) {
        const stripeInvoice = typeof intent.invoice === 'object'
          ? intent.invoice
          : await stripe.invoices.retrieve(stripeInvoiceId)
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

      if (local.rows[0]) {
        if (paymentAmountsMismatch(local.rows[0].amount_cents, stripeAmount)) {
          summary.mismatchesFound += 1
          await createReconciliationAlert(
            pool, `${intent.id}:amount`, 'reconciliation_mismatch', 'critical',
            `Stripe payment ${intent.id} does not match the local ledger amount`, intent.id,
            { amount: stripeAmount, reason: `local_amount_cents:${local.rows[0].amount_cents}` },
          )
        }
        continue
      }

      const accountId = await accountIdForPaymentIntent(pool, intent)
      if (accountId) {
        const inserted = await recordStripePayment(pool, {
          paymentIntentId: intent.id,
          amountCents: stripeAmount,
          accountId,
          customerId: stripeId(intent.customer),
        })
        if (inserted) {
          summary.paymentsInserted += 1
          await allocateHouseholdPayments(pool, { accountId, actorType: 'reconciliation' })
        }
      } else {
        summary.mismatchesFound += 1
        await createReconciliationAlert(
          pool, `${intent.id}:unmapped`, 'unmapped_stripe_payment', 'critical',
          `Stripe payment ${intent.id} could not be mapped to a family`, intent.id,
          { amount: stripeAmount },
        )
      }
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
