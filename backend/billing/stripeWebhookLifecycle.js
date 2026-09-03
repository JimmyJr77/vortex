import { ensureBillingStripeLinksSchema, getStripeClient } from './stripeBilling.js'
import { ensureBillingRecurringSchema } from './stripeCatalogSync.js'
import { resolveStripePaymentMethodLabel } from './paymentMethodLabel.js'
import {
  recordAnnualMembershipRenewalPromoRedemption,
  validateAnnualMembershipRenewalDiscount,
} from './customerBillingPayments.js'
import { recordBillingActivity } from './billingActivity.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { recordStripeBillingAlert } from './stripeOperations.js'
import {
  BILLING_MIGRATION_STATES,
  sanitizeBillingMigrationSnapshot,
} from './canonicalBillingMigrationState.js'
import { classifyLegacyStripeSubscriptionOwnership } from './stripeSubscriptionOwnership.js'
import {
  resolveStripeInvoicePaymentIntentId,
  StripeInvoicePaymentBindingConflict,
  verifyStripeInvoicePaymentIntent,
} from './stripeInvoicePaymentBinding.js'

const MIGRATION_WEBHOOK_GUARD_STATES = Object.freeze([
  BILLING_MIGRATION_STATES.ARMED,
  BILLING_MIGRATION_STATES.CANCELLATION_SCHEDULED,
  BILLING_MIGRATION_STATES.DETACHED,
  BILLING_MIGRATION_STATES.REMOTE_RETIRED,
  BILLING_MIGRATION_STATES.HOUSEHOLD_ACTIVE,
  BILLING_MIGRATION_STATES.VERIFIED,
  BILLING_MIGRATION_STATES.ROLLBACK_PENDING,
  BILLING_MIGRATION_STATES.FAILED_FORWARD_ONLY,
])

const DETACHED_MIGRATION_STATES = new Set([
  BILLING_MIGRATION_STATES.DETACHED,
  BILLING_MIGRATION_STATES.REMOTE_RETIRED,
  BILLING_MIGRATION_STATES.HOUSEHOLD_ACTIVE,
  BILLING_MIGRATION_STATES.VERIFIED,
  BILLING_MIGRATION_STATES.FAILED_FORWARD_ONLY,
])

const MIGRATION_WEBHOOK_RECHECK_STATES = Object.freeze([
  ...MIGRATION_WEBHOOK_GUARD_STATES,
  BILLING_MIGRATION_STATES.ROLLED_BACK,
])

function objectId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

export function invoiceSubscriptionId(invoice) {
  return (
    objectId(invoice?.subscription) ||
    objectId(invoice?.parent?.subscription_details?.subscription) ||
    null
  )
}

export function invoicePaymentIntentId(invoice) {
  const direct = objectId(invoice?.payment_intent)
  if (direct) return direct
  for (const invoicePayment of invoice?.payments?.data ?? []) {
    const payment = invoicePayment?.payment
    const id = objectId(payment?.payment_intent) ||
      (payment?.type === 'payment_intent' ? objectId(payment?.payment_intent) : null)
    if (id) return id
  }
  return null
}

function subscriptionPeriodEnd(subscription) {
  const trialEnd = Number(subscription?.trial_end)
  if (String(subscription?.status ?? '') === 'trialing' && trialEnd > 0) return trialEnd

  const directPeriodEnd = Number(subscription?.current_period_end)
  const itemPeriodEnds = (subscription?.items?.data ?? [])
    .map((item) => Number(item?.current_period_end))
    .filter((value) => value > 0)
  const periodEnd = Math.max(directPeriodEnd > 0 ? directPeriodEnd : 0, ...itemPeriodEnds)
  if (periodEnd > 0) return periodEnd
  return trialEnd > 0 ? trialEnd : null
}

function subscriptionPeriodStart(subscription) {
  const directPeriodStart = Number(subscription?.current_period_start)
  const itemPeriodStarts = (subscription?.items?.data ?? [])
    .map((item) => Number(item?.current_period_start))
    .filter((value) => value > 0)
  if (directPeriodStart > 0) return directPeriodStart
  return itemPeriodStarts.length > 0 ? Math.min(...itemPeriodStarts) : null
}

function stripeTimestamp(value) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return new Date(seconds * 1000).toISOString()
}

async function loadCanonicalCutoverWebhookGuard(
  pool,
  stripeSubscriptionId,
  states = MIGRATION_WEBHOOK_GUARD_STATES,
) {
  const result = await pool.query(
    `/* canonical-cutover:webhook-guard */
     SELECT local.id AS billing_subscription_id,
            local.family_billing_account_id,
            local.member_id,
            local.source_type,
            local.source_id,
            local.status AS local_status,
            local.end_date AS local_end_date,
            local.next_bill_date AS local_next_bill_date,
            local.auto_renewal AS local_auto_renewal,
            local.stripe_subscription_id AS current_stripe_subscription_id,
            local.stripe_subscription_item_id AS current_stripe_item_id,
            local.stripe_subscription_schedule_id AS current_stripe_schedule_id,
            account.household_monthly_billing_enabled,
            migration.id AS account_migration_id,
            migration.billing_migration_run_id,
            migration.state AS migration_state,
            item.id AS migration_item_id
       FROM billing_subscription local
       JOIN family_billing_account account
         ON account.id = local.family_billing_account_id
       LEFT JOIN LATERAL (
         SELECT candidate.id,
                candidate.billing_migration_run_id,
                candidate.state,
                candidate.created_at
           FROM billing_account_migration candidate
          WHERE candidate.family_billing_account_id = local.family_billing_account_id
          ORDER BY candidate.id DESC
          LIMIT 1
       ) migration ON TRUE
       LEFT JOIN billing_account_migration_item item
         ON item.billing_account_migration_id = migration.id
        AND (
          item.billing_subscription_id = local.id
          OR (
            item.billing_subscription_id IS NULL
            AND item.target_id = local.id::text
          )
        )
      WHERE (
          account.household_monthly_billing_enabled = TRUE
          OR migration.state = ANY($2::text[])
        )
        AND (
          local.stripe_subscription_id = $1
          OR item.former_stripe_subscription_id = $1
          OR (item.item_type = 'stripe_subscription' AND item.source_id = $1)
        )
      ORDER BY migration.created_at DESC, migration.id DESC, item.id DESC NULLS LAST
      LIMIT 1`,
    [String(stripeSubscriptionId), states],
  )
  return result.rows[0] ?? null
}

function remoteLifecycleSnapshot(subscription, eventType, guard, linkageAction) {
  return sanitizeBillingMigrationSnapshot({
    eventType,
    stripeSubscriptionId: subscription.id,
    remoteStatus: subscription.status ?? null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    cancelAt: stripeTimestamp(subscription.cancel_at),
    endedAt: stripeTimestamp(subscription.ended_at),
    currentPeriodStart: stripeTimestamp(subscriptionPeriodStart(subscription)),
    currentPeriodEnd: stripeTimestamp(subscriptionPeriodEnd(subscription)),
    migrationState: guard.migration_state,
    linkageAction,
    observedAt: new Date().toISOString(),
  })
}

async function recordUnexpectedSubscriptionLifecycle(pool, {
  subscription,
  eventType,
  accountId = null,
  reason,
}) {
  const subscriptionId = String(subscription?.id ?? '').trim() || 'unknown'
  const normalizedAccountId = Number(accountId)
  await pool.query(
    `INSERT INTO stripe_billing_alert
      (stripe_event_id, family_billing_account_id, alert_type, severity,
       stripe_object_id, message, details)
     VALUES ($1, $2, 'unexpected_stripe_subscription_lifecycle', 'critical', $3, $4, $5::jsonb)
     ON CONFLICT (stripe_event_id) DO NOTHING`,
    [
      `unexpected-subscription-lifecycle:${eventType}:${subscriptionId}:${String(subscription?.status ?? 'unknown')}`,
      Number.isSafeInteger(normalizedAccountId) && normalizedAccountId > 0
        ? normalizedAccountId
        : null,
      subscriptionId === 'unknown' ? null : subscriptionId,
      reason,
      JSON.stringify(sanitizeBillingMigrationSnapshot({
        eventType,
        remoteStatus: subscription?.status ?? null,
        customerId: objectId(subscription?.customer),
        cancelAtPeriodEnd: subscription?.cancel_at_period_end === true,
        automaticLocalMutationBlocked: true,
      })),
    ],
  )
}

async function guardCanonicalCutoverLifecycle(pool, subscription, eventType, guard) {
  const terminalRemote = eventType === 'customer.subscription.deleted' || subscription.status === 'canceled'
  const shouldClearFormerLink = terminalRemote || DETACHED_MIGRATION_STATES.has(guard.migration_state)
  const linkageMatches = guard.current_stripe_subscription_id === subscription.id
  const linkageAction = shouldClearFormerLink && linkageMatches ? 'clear_former_link' : 'ignore_remote_lifecycle'
  const lifecycle = remoteLifecycleSnapshot(subscription, eventType, guard, linkageAction)

  if ([
    'customer.subscription.created',
    'customer.subscription.paused',
    'customer.subscription.resumed',
  ].includes(eventType)) {
    await recordUnexpectedSubscriptionLifecycle(pool, {
      subscription,
      eventType,
      accountId: Number(guard.family_billing_account_id),
      reason: `Unexpected Stripe ${eventType} reached an account owned by household or cutover collection.`,
    })
  }

  if (guard.migration_item_id != null) {
    await pool.query(
      `/* canonical-cutover:webhook-audit-item */
       UPDATE billing_account_migration_item
          SET remote_status = $2,
              remote_period_start = COALESCE($3::timestamptz, remote_period_start),
              remote_period_end = COALESCE($4::timestamptz, remote_period_end),
              remote_cancel_at = COALESCE($5::timestamptz, remote_cancel_at),
              target_snapshot = COALESCE(target_snapshot, '{}'::jsonb)
                || jsonb_build_object('lastRemoteLifecycleWebhook', $6::jsonb),
              updated_at = now()
        WHERE id = $1`,
      [
        Number(guard.migration_item_id),
        String(subscription.status ?? ''),
        lifecycle.currentPeriodStart,
        lifecycle.currentPeriodEnd,
        lifecycle.cancelAt ?? lifecycle.endedAt,
        JSON.stringify(lifecycle),
      ],
    )
  }

  const eventVersion = [
    eventType,
    subscription.status ?? 'unknown',
    subscription.ended_at ?? subscription.cancel_at ?? subscriptionPeriodEnd(subscription) ?? 'none',
    subscription.cancel_at_period_end === true ? 'scheduled' : 'immediate',
  ].join(':')
  await recordBillingActivity(pool, {
    eventKey: `canonical-cutover-stripe-lifecycle:${guard.account_migration_id ?? `account-${guard.family_billing_account_id}`}:${subscription.id}:${eventVersion}`,
    accountId: Number(guard.family_billing_account_id),
    memberId: guard.member_id == null ? null : Number(guard.member_id),
    signupId: guard.source_type === 'scheduling_signup' && /^\d+$/.test(String(guard.source_id ?? ''))
      ? Number(guard.source_id)
      : null,
    eventType: 'canonical_billing_remote_subscription_lifecycle_guarded',
    summary: `Stripe ${eventType} was recorded without changing the canonical enrollment schedule.`,
    beforeValue: {
      status: guard.local_status,
      endDate: guard.local_end_date ?? null,
      nextBillDate: guard.local_next_bill_date ?? null,
      autoRenewal: guard.local_auto_renewal,
      stripeSubscriptionId: guard.current_stripe_subscription_id ?? null,
    },
    afterValue: {
      status: guard.local_status,
      endDate: guard.local_end_date ?? null,
      nextBillDate: guard.local_next_bill_date ?? null,
      autoRenewal: guard.local_auto_renewal,
      stripeSubscriptionId: linkageAction === 'clear_former_link'
        ? null
        : guard.current_stripe_subscription_id ?? null,
    },
    details: {
      billingMigrationRunId: guard.billing_migration_run_id == null
        ? null
        : Number(guard.billing_migration_run_id),
      accountMigrationId: guard.account_migration_id == null
        ? null
        : Number(guard.account_migration_id),
      migrationItemId: guard.migration_item_id == null ? null : Number(guard.migration_item_id),
      remoteLifecycle: lifecycle,
    },
    stripeObjectId: subscription.id,
    actorType: 'stripe',
  })

  let linkageCleared = false
  if (linkageAction === 'clear_former_link') {
    const cleared = await pool.query(
      `/* canonical-cutover:webhook-clear-former-link */
       UPDATE billing_subscription
          SET stripe_subscription_id = NULL,
              stripe_subscription_item_id = NULL,
              stripe_subscription_schedule_id = NULL,
              price_sync_status = 'not_required',
              price_sync_error = NULL,
              updated_at = now()
        WHERE id = $1 AND stripe_subscription_id = $2`,
      [Number(guard.billing_subscription_id), String(subscription.id)],
    )
    linkageCleared = Number(cleared.rowCount ?? 0) > 0
  }

  return {
    updated: 0,
    status: guard.local_status,
    guarded: true,
    migrationState: guard.migration_state,
    linkageCleared,
  }
}

async function resolveAccountId(pool, object) {
  const rawMetadataId = object?.metadata?.familyBillingAccountId
  const metadataProvided = rawMetadataId != null && String(rawMetadataId).trim() !== ''
  const metadataId = Number(rawMetadataId)
  const validMetadataId = Number.isSafeInteger(metadataId) && metadataId > 0
  if (metadataProvided && !validMetadataId) return null
  const customerId = objectId(object?.customer)
  if (!customerId) return validMetadataId ? metadataId : null
  const result = await pool.query(
    `/* stripe-webhook:customer-owner */
     SELECT id FROM family_billing_account
      WHERE stripe_customer_id = $1
      ORDER BY id
      LIMIT 3`,
    [customerId],
  )
  if (result.rows.length !== 1) return null
  const customerOwnerId = Number(result.rows[0]?.id)
  if (!Number.isSafeInteger(customerOwnerId) || customerOwnerId <= 0) return null
  if (validMetadataId && metadataId !== customerOwnerId) return null
  return customerOwnerId
}

export class StripeInvoiceQuarantineError extends Error {
  constructor(reasonCode, message, details = {}) {
    super(message)
    this.name = 'StripeInvoiceQuarantineError'
    this.code = 'stripe_invoice_quarantined'
    this.reasonCode = reasonCode
    this.details = details
  }
}

function quarantineInvoice(reasonCode, message, details = {}) {
  throw new StripeInvoiceQuarantineError(reasonCode, message, details)
}

function positiveMetadataId(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function uniqueMetadataId(layers, key, label) {
  const raw = layers
    .map((metadata) => metadata?.[key])
    .filter((value) => value != null && String(value).trim() !== '')
  if (raw.length === 0) {
    quarantineInvoice(
      `annual_invoice_${key}_missing`,
      `Annual membership invoice is missing ${label} metadata.`,
    )
  }
  const parsed = raw.map(positiveMetadataId)
  if (parsed.some((value) => value == null)) {
    quarantineInvoice(
      `annual_invoice_${key}_invalid`,
      `Annual membership invoice has invalid ${label} metadata.`,
      { values: raw.map(String) },
    )
  }
  const distinct = [...new Set(parsed)]
  if (distinct.length !== 1) {
    quarantineInvoice(
      `annual_invoice_${key}_conflict`,
      `Annual membership invoice has conflicting ${label} metadata.`,
      { values: distinct },
    )
  }
  return distinct[0]
}

function annualMetadataLayers(invoice, remoteSubscription = null) {
  return [
    invoice?.metadata,
    invoice?.subscription_details?.metadata,
    invoice?.parent?.subscription_details?.metadata,
    remoteSubscription?.metadata,
  ].filter((metadata) => metadata && typeof metadata === 'object')
}

function metadataClaimsAnnualMembership(layers) {
  return layers.some((metadata) => (
    String(metadata?.annualMembership ?? '').toLowerCase() === 'true'
    || String(metadata?.vortex_annual_membership ?? '').toLowerCase() === 'true'
  ))
}

async function loadAnnualInvoiceBinding(pool, invoice, {
  stripeClient,
  subscriptionId,
  subscriptionOwnership = null,
}) {
  if (!subscriptionId) return null
  const provenBillingSubscriptionId = subscriptionOwnership?.paidSettlementVerified
    ? positiveMetadataId(subscriptionOwnership.billingSubscriptionId)
    : null
  const annualRows = await pool.query(
    `SELECT id, family_billing_account_id, member_id, source_type, source_id,
            description, stripe_subscription_id, pricing_option_key, next_bill_date
       FROM billing_subscription
      WHERE (
          ($2::bigint IS NOT NULL AND id = $2)
          OR ($2::bigint IS NULL AND stripe_subscription_id = $1)
        )
        AND (source_type = 'annual_membership' OR pricing_option_key = 'annual_membership')
      ORDER BY id
      LIMIT 3`,
    [subscriptionId, provenBillingSubscriptionId],
  ).then((result) => result.rows)

  let remoteSubscription = subscriptionOwnership?.paidSettlementVerified
    ? subscriptionOwnership.subscription ?? null
    : null
  if (annualRows.length > 0 && typeof stripeClient?.subscriptions?.retrieve === 'function') {
    remoteSubscription ??= await stripeClient.subscriptions.retrieve(subscriptionId)
  }
  const metadataLayers = annualMetadataLayers(invoice, remoteSubscription)
  const claimsAnnual = metadataClaimsAnnualMembership(metadataLayers)
  const ownershipClaimsAnnual = subscriptionOwnership?.paidSettlementVerified === true
    && (
      subscriptionOwnership.sourceType === 'annual_membership'
      || subscriptionOwnership.pricingOptionKey === 'annual_membership'
    )
  if (annualRows.length === 0) {
    if (claimsAnnual || ownershipClaimsAnnual) {
      quarantineInvoice(
        'annual_invoice_subscription_missing',
        'Annual membership invoice has no matching local annual subscription.',
        { stripeSubscriptionId: subscriptionId },
      )
    }
    return null
  }
  if (annualRows.length !== 1) {
    quarantineInvoice(
      'annual_invoice_subscription_ambiguous',
      'Annual membership invoice maps to multiple local annual subscriptions.',
      { stripeSubscriptionId: subscriptionId, subscriptionCount: annualRows.length },
    )
  }

  const annualSubscription = annualRows[0]
  const localAccountId = positiveMetadataId(annualSubscription.family_billing_account_id)
  const localMemberId = positiveMetadataId(annualSubscription.member_id)
  if (!localAccountId || !localMemberId) {
    quarantineInvoice(
      'annual_invoice_local_binding_invalid',
      'Annual membership subscription is missing its local account or member binding.',
      { billingSubscriptionId: Number(annualSubscription.id) },
    )
  }

  const metadataAccountId = uniqueMetadataId(
    metadataLayers,
    'familyBillingAccountId',
    'family billing account',
  )
  const metadataMemberId = uniqueMetadataId(metadataLayers, 'memberId', 'member')
  const customerId = objectId(invoice?.customer) ?? objectId(remoteSubscription?.customer)
  if (!customerId) {
    quarantineInvoice(
      'annual_invoice_customer_missing',
      'Annual membership invoice is missing its Stripe customer.',
      { stripeSubscriptionId: subscriptionId },
    )
  }
  let customerAccountId = null
  if (subscriptionOwnership?.paidSettlementVerified) {
    customerAccountId = positiveMetadataId(subscriptionOwnership.accountId)
    if (
      !customerAccountId
      || String(subscriptionOwnership.stripeCustomerId ?? '') !== String(customerId)
      || (
        subscriptionOwnership.billingSubscriptionId != null
        && Number(subscriptionOwnership.billingSubscriptionId) !== Number(annualSubscription.id)
      )
      || (
        subscriptionOwnership.memberId != null
        && Number(subscriptionOwnership.memberId) !== Number(annualSubscription.member_id)
      )
    ) {
      quarantineInvoice(
        'annual_invoice_paid_ownership_conflict',
        'Annual membership invoice does not match its freshly verified paid subscription ownership.',
        {
          customerId,
          ownershipAccountId: subscriptionOwnership.accountId ?? null,
          ownershipBillingSubscriptionId: subscriptionOwnership.billingSubscriptionId ?? null,
          billingSubscriptionId: Number(annualSubscription.id),
        },
      )
    }
  } else {
    const customerOwners = await pool.query(
      `SELECT id
         FROM family_billing_account
        WHERE stripe_customer_id = $1
        ORDER BY id
        LIMIT 3`,
      [customerId],
    ).then((result) => result.rows)
    if (customerOwners.length !== 1) {
      quarantineInvoice(
        customerOwners.length === 0
          ? 'annual_invoice_customer_owner_missing'
          : 'annual_invoice_customer_owner_ambiguous',
        customerOwners.length === 0
          ? 'Annual membership invoice customer has no local billing-account owner.'
          : 'Annual membership invoice customer has multiple local billing-account owners.',
        { customerId, ownerCount: customerOwners.length },
      )
    }
    customerAccountId = positiveMetadataId(customerOwners[0].id)
  }
  if (
    metadataAccountId !== customerAccountId
    || metadataAccountId !== localAccountId
  ) {
    quarantineInvoice(
      'annual_invoice_account_binding_conflict',
      'Annual membership invoice metadata, Stripe customer, and local subscription disagree on the billing account.',
      { metadataAccountId, customerAccountId, localAccountId },
    )
  }
  if (metadataMemberId !== localMemberId) {
    quarantineInvoice(
      'annual_invoice_member_binding_conflict',
      'Annual membership invoice metadata disagrees with the local annual subscription member.',
      { metadataMemberId, localMemberId },
    )
  }
  const feeId = positiveMetadataId(String(annualSubscription.source_id ?? '').split(':')[0])
  if (!feeId) {
    quarantineInvoice(
      'annual_invoice_fee_binding_invalid',
      'Annual membership subscription has no provable annual-fee binding.',
      { billingSubscriptionId: Number(annualSubscription.id) },
    )
  }
  return {
    accountId: localAccountId,
    memberId: localMemberId,
    feeId,
    annualSubscription,
    customerId,
  }
}

function validatePreparedSubscriptionOwnership({
  invoice,
  subscriptionId,
  ownership,
  canonicalMigrationSettlement,
}) {
  const customerId = objectId(invoice?.customer)
  if (canonicalMigrationSettlement) {
    const expectedAccountId = Number(canonicalMigrationSettlement.accountId)
    if (
      String(canonicalMigrationSettlement.subscriptionId ?? '') !== String(subscriptionId ?? '')
      || String(canonicalMigrationSettlement.customerId ?? '') !== String(customerId ?? '')
      || !Number.isSafeInteger(expectedAccountId)
      || expectedAccountId <= 0
    ) {
      quarantineInvoice(
        'canonical_migration_invoice_binding_conflict',
        'The paid legacy invoice does not match its frozen canonical-migration settlement identity.',
        { subscriptionId, customerId, canonicalMigrationSettlement },
      )
    }
    return { accountId: expectedAccountId, canonicalMigrationSettlement: true }
  }
  if (!ownership?.expectedLegacy) {
    quarantineInvoice(
      ownership?.code ?? 'stripe_subscription_owner_unverified',
      ownership?.reason ?? `Stripe subscription ${subscriptionId} has no verified legacy collector owner.`,
      { subscriptionId, customerId },
    )
  }
  if (
    String(ownership.stripeCustomerId ?? '') !== String(customerId ?? '')
    || !Number.isSafeInteger(Number(ownership.accountId))
    || Number(ownership.accountId) <= 0
  ) {
    quarantineInvoice(
      'stripe_subscription_owner_recheck_conflict',
      `Stripe subscription ${subscriptionId} changed identity before its invoice could be recorded.`,
      { subscriptionId, customerId, ownership },
    )
  }
  return ownership
}

/** Resolve Stripe/network metadata before entering any ledger transaction. */
export async function preparePaidStripeInvoiceRecord(pool, invoice, {
  stripe = null,
  expectedLegacySubscriptionOwnership = null,
  canonicalMigrationSettlement = null,
  historicalSettlementBinding = null,
} = {}) {
  // Current Stripe API versions may omit the legacy `paid` boolean, or return
  // a stale false value while the terminal status is already `paid`. Accept
  // either affirmative signal, but never infer settlement from amount alone.
  if (!invoice?.id || (invoice.status !== 'paid' && invoice.paid !== true)) return null
  await ensureBillingStripeLinksSchema(pool)
  const stripeClient = stripe || (await getStripeClient())
  let paymentIntentId
  let paymentIntent = null
  try {
    paymentIntentId = await resolveStripeInvoicePaymentIntentId(stripeClient, invoice)
    if (paymentIntentId && stripeClient) {
      paymentIntent = await verifyStripeInvoicePaymentIntent(
        stripeClient,
        invoice,
        paymentIntentId,
      )
    }
  } catch (error) {
    if (!(error instanceof StripeInvoicePaymentBindingConflict)) throw error
    quarantineInvoice(
      error.code,
      error.message,
      error.details,
    )
  }
  const subscriptionId = invoiceSubscriptionId(invoice)
  const amountCents = Math.round(Number(invoice.amount_paid ?? invoice.amount_due) || 0)
  if (amountCents <= 0) return null
  const paidAt = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : new Date()

  let subscriptionOwnership = null
  if (subscriptionId) {
    const observedOwnership = expectedLegacySubscriptionOwnership
      ?? (canonicalMigrationSettlement ? null : await classifyLegacyStripeSubscriptionOwnership(pool, {
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: invoice?.customer,
        metadataAccountId: invoice?.metadata?.familyBillingAccountId ?? null,
      }))
    subscriptionOwnership = validatePreparedSubscriptionOwnership({
      invoice,
      subscriptionId,
      ownership: observedOwnership,
      canonicalMigrationSettlement,
    })
  }

  const annualBinding = await loadAnnualInvoiceBinding(pool, invoice, {
    stripeClient,
    subscriptionId,
    subscriptionOwnership,
  })
  let historicalAccountId = null
  if (historicalSettlementBinding) {
    const expectedAccountId = Number(historicalSettlementBinding.accountId)
    const expectedCustomerId = String(historicalSettlementBinding.customerId ?? '')
    const expectedInvoiceId = String(historicalSettlementBinding.invoiceId ?? '')
    const expectedMonthlyInvoiceId = String(historicalSettlementBinding.monthlyInvoiceId ?? '')
    const observedCustomerId = String(objectId(invoice?.customer) ?? '')
    if (
      historicalSettlementBinding.kind !== 'household_monthly'
      || subscriptionId
      || !Number.isSafeInteger(expectedAccountId)
      || expectedAccountId <= 0
      || !expectedCustomerId
      || expectedInvoiceId !== String(invoice.id)
      || observedCustomerId !== expectedCustomerId
      || String(invoice?.metadata?.householdMonthlyInvoice ?? '') !== 'true'
      || String(invoice?.metadata?.monthlyInvoiceId ?? '') !== expectedMonthlyInvoiceId
      || String(invoice?.metadata?.familyBillingAccountId ?? '') !== String(expectedAccountId)
    ) {
      quarantineInvoice(
        'historical_household_invoice_binding_conflict',
        'The paid household invoice does not match its verified historical settlement identity.',
        { historicalSettlementBinding, invoiceId: invoice?.id ?? null, customerId: observedCustomerId },
      )
    }
    historicalAccountId = expectedAccountId
  }
  const accountId = subscriptionOwnership?.accountId
    ?? annualBinding?.accountId
    ?? historicalAccountId
    ?? await resolveAccountId(pool, invoice)
  if (!accountId) return null
  if (annualBinding && Number(annualBinding.accountId) !== Number(accountId)) {
    quarantineInvoice(
      'annual_invoice_subscription_owner_conflict',
      'Annual membership invoice ownership disagrees with its verified Stripe subscription owner.',
      { annualAccountId: annualBinding.accountId, subscriptionAccountId: accountId },
    )
  }
  const method = await resolveStripePaymentMethodLabel(stripeClient, {
    paymentIntentId,
    paymentIntent,
    invoice,
  })
  return {
    accountId,
    amountCents,
    paidAt,
    method,
    invoiceId: invoice.id,
    customerId: objectId(invoice.customer),
    paymentIntentId,
    subscriptionId,
    invoice,
    stripeClient,
    annualBinding,
    subscriptionOwnership,
  }
}

function annualRefundRequiredMarker(invoiceId) {
  return `[annual-invoice-refund-required:${String(invoiceId)}]`
}

function annualFulfillmentPendingMarker(invoiceId) {
  return `[annual-invoice-fulfillment-pending:${String(invoiceId)}]`
}

function isAnnualRefundRequiredPayment(payment, prepared) {
  return Boolean(
    prepared?.annualBinding
    && payment?.external_status === 'reconciliation_required'
    && String(payment?.note ?? '').includes(annualRefundRequiredMarker(prepared.invoiceId)),
  )
}

function isAnnualFulfillmentPendingPayment(payment, prepared) {
  return Boolean(
    prepared?.annualBinding
    && payment?.external_status === 'reconciliation_required'
    && String(payment?.note ?? '').includes(annualFulfillmentPendingMarker(prepared.invoiceId))
    && !String(payment?.note ?? '').includes(annualRefundRequiredMarker(prepared.invoiceId)),
  )
}

/** Pure local upsert; safe inside the household settlement transaction. */
export async function upsertPaidStripeInvoicePayment(pool, prepared) {
  if (!prepared?.invoiceId || !prepared?.accountId) return null
  const result = await pool.query(
    `
      INSERT INTO billing_payment
        (family_billing_account_id, amount_cents, paid_at, method, note,
         external_processor, external_reference, external_status,
         stripe_customer_id, stripe_payment_intent_id, stripe_invoice_id,
         stripe_subscription_id)
      VALUES ($1, $2, $3, $4, 'Stripe invoice payment',
              'stripe', $5, 'settled', $6, $7, $5, $8)
      ON CONFLICT DO NOTHING
      RETURNING *
    `,
    [
      prepared.accountId,
      prepared.amountCents,
      prepared.paidAt,
      prepared.method,
      prepared.invoiceId,
      prepared.customerId,
      prepared.paymentIntentId,
      prepared.subscriptionId,
    ],
  )
  let payment = result.rows[0] ?? await pool.query(
    `SELECT * FROM billing_payment WHERE stripe_invoice_id = $1 LIMIT 1 FOR UPDATE`,
    [prepared.invoiceId],
  ).then((lookup) => lookup.rows[0] ?? null)
  const priorIntentPayment = prepared.paymentIntentId
    ? result.rows[0] ?? await pool.query(
      `SELECT * FROM billing_payment WHERE stripe_payment_intent_id = $1 LIMIT 1 FOR UPDATE`,
      [prepared.paymentIntentId],
    ).then((lookup) => lookup.rows[0] ?? null)
    : null

  const validateReusableStripeSettlement = (existing) => {
    if (!existing) return
    if (
      String(existing.external_processor ?? '') !== 'stripe'
      || (
        !['settled', 'succeeded'].includes(String(existing.external_status ?? ''))
        && !isAnnualRefundRequiredPayment(existing, prepared)
        && !isAnnualFulfillmentPendingPayment(existing, prepared)
      )
    ) {
      quarantineInvoice(
        'paid_invoice_payment_state_conflict',
        'Existing invoice payment is not a settled Stripe payment and cannot be reused or applied.',
        {
          billingPaymentId: Number(existing.id),
          stripeInvoiceId: prepared.invoiceId,
          externalProcessor: existing.external_processor ?? null,
          externalStatus: existing.external_status ?? null,
        },
      )
    }
  }

  // A previously quarantined, canceled, or refunded payment cannot become
  // collectible again merely because Stripe still reports the invoice paid.
  // Lock and validate both possible local identities before any backfill or
  // downstream charge application can occur.
  validateReusableStripeSettlement(payment)
  validateReusableStripeSettlement(priorIntentPayment)

  const validateExistingInvoicePayment = (existing) => {
    if (!existing) return
    const mismatch = (
      Number(existing.family_billing_account_id) !== Number(prepared.accountId)
      || Number(existing.amount_cents) !== Number(prepared.amountCents)
      || existing.stripe_invoice_id !== prepared.invoiceId
      || (
        existing.stripe_customer_id
        && existing.stripe_customer_id !== prepared.customerId
      )
      || (
        existing.stripe_payment_intent_id
        && existing.stripe_payment_intent_id !== prepared.paymentIntentId
      )
      || (
        existing.stripe_subscription_id
        && existing.stripe_subscription_id !== prepared.subscriptionId
      )
    )
    if (mismatch) {
      quarantineInvoice(
        'paid_invoice_payment_binding_conflict',
        'Existing Stripe payment does not match its paid invoice identity, account, customer, or amount.',
        { billingPaymentId: Number(existing.id), stripeInvoiceId: prepared.invoiceId },
      )
    }
  }

  // One remote invoice payment must never be represented by separate
  // invoice-keyed and PaymentIntent-keyed ledger rows. This was possible when
  // Stripe stopped exposing PaymentIntent.invoice directly. Keep the conflict
  // visible for an explicit reviewed repair instead of silently treating the
  // second row as household credit.
  if (payment && priorIntentPayment && Number(payment.id) !== Number(priorIntentPayment.id)) {
    quarantineInvoice(
      'paid_invoice_split_payment_conflict',
      'The same Stripe invoice payment is represented by separate invoice and PaymentIntent ledger rows.',
      {
        stripeInvoiceId: prepared.invoiceId,
        stripePaymentIntentId: prepared.paymentIntentId,
        invoicePaymentId: Number(payment.id),
        intentPaymentId: Number(priorIntentPayment.id),
      },
    )
  }

  // Validate immutable identity before any backfill UPDATE. A mismatched row
  // must remain byte-for-byte unchanged for explicit reconciliation.
  validateExistingInvoicePayment(payment)

  // Backfill the newly discoverable PaymentIntent onto an existing
  // invoice-keyed row only when no competing row owns that identifier. An
  // annual payment may already be durably fulfillment-pending from phase one;
  // preserve that nonallocatable state while completing its immutable binding.
  if (payment && prepared.paymentIntentId && !payment.stripe_payment_intent_id) {
    const annualPendingMarker = prepared.annualBinding
      ? annualFulfillmentPendingMarker(prepared.invoiceId)
      : null
    const annualRefundMarker = prepared.annualBinding
      ? annualRefundRequiredMarker(prepared.invoiceId)
      : null
    payment = await pool.query(
      `UPDATE billing_payment
          SET stripe_payment_intent_id = $2,
              stripe_customer_id = COALESCE(stripe_customer_id, $3),
              stripe_subscription_id = COALESCE(stripe_subscription_id, $4)
        WHERE id = $1
          AND stripe_payment_intent_id IS NULL
          AND family_billing_account_id = $5
          AND amount_cents = $6
          AND stripe_invoice_id = $7
          AND (stripe_customer_id IS NULL OR stripe_customer_id IS NOT DISTINCT FROM $3)
          AND (stripe_subscription_id IS NULL OR stripe_subscription_id IS NOT DISTINCT FROM $4)
          AND external_processor = 'stripe'
          AND (
            external_status IN ('settled', 'succeeded')
            OR (
              $8::text IS NOT NULL
              AND external_status = 'reconciliation_required'
              AND position($8 in COALESCE(note, '')) > 0
              AND position($9 in COALESCE(note, '')) = 0
            )
          )
        RETURNING *`,
      [
        payment.id,
        prepared.paymentIntentId,
        prepared.customerId,
        prepared.subscriptionId,
        prepared.accountId,
        prepared.amountCents,
        prepared.invoiceId,
        annualPendingMarker,
        annualRefundMarker,
      ],
    ).then((updated) => updated.rows[0] ?? null)
    if (!payment) {
      quarantineInvoice(
        'paid_invoice_payment_binding_changed',
        'Existing Stripe invoice payment changed before its PaymentIntent binding could be restored.',
        { stripeInvoiceId: prepared.invoiceId, stripePaymentIntentId: prepared.paymentIntentId },
      )
    }
  }
  // Older reconciliation code could insert an invoice-backed PaymentIntent as
  // a generic payment before the invoice webhook arrived. Repair that row only
  // when its immutable account and amount exactly match this paid invoice.
  if (!payment && priorIntentPayment) {
    if (
      Number(priorIntentPayment.family_billing_account_id) !== Number(prepared.accountId)
      || Number(priorIntentPayment.amount_cents) !== Number(prepared.amountCents)
      || (
        priorIntentPayment.stripe_customer_id
        && priorIntentPayment.stripe_customer_id !== prepared.customerId
      )
    ) {
      throw new Error('Existing Stripe PaymentIntent payment does not match its paid invoice account or amount.')
    }
    if (
      (priorIntentPayment.stripe_invoice_id && priorIntentPayment.stripe_invoice_id !== prepared.invoiceId)
      || (
        priorIntentPayment.stripe_subscription_id
        && priorIntentPayment.stripe_subscription_id !== prepared.subscriptionId
      )
    ) {
      throw new Error('Existing Stripe PaymentIntent payment is linked to a different invoice or subscription.')
    }
    payment = await pool.query(
      `UPDATE billing_payment
          SET stripe_invoice_id = COALESCE(stripe_invoice_id, $2),
              stripe_subscription_id = COALESCE(stripe_subscription_id, $3),
              stripe_customer_id = COALESCE(stripe_customer_id, $4),
              external_reference = COALESCE(external_reference, $2),
              external_status = 'settled',
              note = COALESCE(note, 'Stripe invoice payment')
        WHERE id = $1
          AND family_billing_account_id = $5
          AND amount_cents = $6
          AND stripe_payment_intent_id = $7
          AND (stripe_customer_id IS NULL OR stripe_customer_id IS NOT DISTINCT FROM $4)
          AND (stripe_invoice_id IS NULL OR stripe_invoice_id = $2)
          AND (stripe_subscription_id IS NULL OR stripe_subscription_id IS NOT DISTINCT FROM $3)
          AND external_processor = 'stripe'
          AND external_status IN ('settled', 'succeeded')
        RETURNING *`,
      [
        priorIntentPayment.id,
        prepared.invoiceId,
        prepared.subscriptionId,
        prepared.customerId,
        prepared.accountId,
        prepared.amountCents,
        prepared.paymentIntentId,
      ],
    ).then((updated) => updated.rows[0] ?? null)
    if (!payment) throw new Error('Existing Stripe PaymentIntent payment changed before invoice ownership could be restored.')
  }
  validateExistingInvoicePayment(payment)
  if (payment) payment.newly_inserted = Boolean(result.rows[0])
  return payment
}

function stripeTimestampDateOnly(value) {
  const seconds = Number(value)
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return null
  const date = new Date(seconds * 1000)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function annualInvoiceRenewalPeriodKey(prepared) {
  const invoiceLines = prepared.invoice?.lines
  if (invoiceLines?.has_more === true) {
    quarantineInvoice(
      'annual_invoice_period_incomplete',
      'Annual membership invoice has an incomplete line inventory, so its renewal period cannot be proven.',
      { stripeInvoiceId: prepared.invoiceId },
    )
  }
  const linePeriodKeys = [...new Set(
    (invoiceLines?.data ?? [])
      .map((line) => stripeTimestampDateOnly(line?.period?.end))
      .filter(Boolean),
  )]
  if (linePeriodKeys.length > 1) {
    quarantineInvoice(
      'annual_invoice_period_ambiguous',
      'Annual membership invoice lines disagree on the renewal period.',
      { stripeInvoiceId: prepared.invoiceId, renewalPeriodKeys: linePeriodKeys },
    )
  }
  if (linePeriodKeys.length === 1) return linePeriodKeys[0]

  const invoicePeriodKey = stripeTimestampDateOnly(prepared.invoice?.period_end)
  if (invoicePeriodKey) return invoicePeriodKey

  quarantineInvoice(
    'annual_invoice_period_missing',
    'Annual membership invoice has no immutable Stripe invoice renewal period.',
    { stripeInvoiceId: prepared.invoiceId },
  )
}

async function assertAnnualBindingStillCurrent(db, prepared) {
  const binding = prepared.annualBinding
  const detachedClaim = prepared.subscriptionOwnership?.paidSettlementVerified === true
    && prepared.subscriptionOwnership.ownershipSource === 'immutable_claim'
  const result = await db.query(
    `SELECT id
       FROM billing_subscription
      WHERE id = $1
        AND family_billing_account_id = $3
        AND member_id = $4
        AND (source_type = 'annual_membership' OR pricing_option_key = 'annual_membership')
        AND (
          stripe_subscription_id = $2
          OR ($5::boolean = TRUE AND stripe_subscription_id IS NULL)
        )
      FOR SHARE`,
    [
      Number(binding.annualSubscription.id),
      prepared.subscriptionId,
      prepared.accountId,
      binding.memberId,
      detachedClaim,
    ],
  )
  if (result.rows.length !== 1) {
    quarantineInvoice(
      'annual_invoice_binding_changed',
      'Annual membership invoice binding changed before its ledger write could complete.',
      { billingSubscriptionId: Number(binding.annualSubscription.id) },
    )
  }
}

async function reconstructAnnualInvoiceCharge(db, prepared) {
  const binding = prepared.annualBinding
  const renewalPeriodKey = annualInvoiceRenewalPeriodKey(prepared)
  const sourceId = `${binding.feeId}:${binding.memberId}:${renewalPeriodKey}`
  const metadata = {
    stripeInvoiceId: prepared.invoiceId,
    stripeSubscriptionId: prepared.subscriptionId,
    renewal: true,
  }
  const inserted = await db.query(
    `INSERT INTO billing_charge (
       family_billing_account_id, member_id, source_type, source_id,
       description, amount_cents, gross_amount_cents, discount_amount_cents,
       charge_type, billing_interval, collection_status, metadata, created_at
     ) VALUES ($1, $2, 'additional_fee', $3, $4, $5, $5, 0,
               'one_time', 'one_time', 'unpaid', $6::jsonb, $7)
     ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
     RETURNING *`,
    [
      prepared.accountId,
      binding.memberId,
      sourceId,
      binding.annualSubscription.description || 'Annual Membership',
      prepared.amountCents,
      JSON.stringify(metadata),
      prepared.paidAt,
    ],
  )
  const charge = inserted.rows[0] ?? await db.query(
    `SELECT *
       FROM billing_charge
      WHERE source_type = 'additional_fee' AND source_id = $1
      FOR UPDATE`,
    [sourceId],
  ).then((result) => result.rows[0] ?? null)
  if (!charge) {
    quarantineInvoice(
      'annual_invoice_charge_missing',
      'Annual membership renewal charge could not be reconstructed.',
      { stripeInvoiceId: prepared.invoiceId },
    )
  }
  const existingInvoiceId = charge.metadata?.stripeInvoiceId
  const existingSubscriptionId = charge.metadata?.stripeSubscriptionId
  if (
    Number(charge.family_billing_account_id) !== Number(prepared.accountId)
    || Number(charge.member_id) !== Number(binding.memberId)
    || (existingInvoiceId && existingInvoiceId !== prepared.invoiceId)
    || (existingSubscriptionId && existingSubscriptionId !== prepared.subscriptionId)
  ) {
    quarantineInvoice(
      'annual_invoice_charge_binding_conflict',
      'Existing annual membership charge conflicts with the paid Stripe invoice binding.',
      { billingChargeId: Number(charge.id), stripeInvoiceId: prepared.invoiceId },
    )
  }
  const adjustments = await db.query(
    `SELECT COALESCE(SUM(amount_cents), 0)::int AS cents
       FROM billing_charge
      WHERE family_billing_account_id = $1
        AND related_charge_id = $2
        AND source_type = 'charge_adjustment'`,
    [prepared.accountId, charge.id],
  )
  const effectiveChargeCents = Number(charge.amount_cents) + Number(adjustments.rows[0]?.cents ?? 0)
  if (effectiveChargeCents !== Number(prepared.amountCents)) {
    quarantineInvoice(
      'annual_invoice_charge_amount_conflict',
      'Annual membership charge does not match the amount paid on its Stripe invoice.',
      {
        billingChargeId: Number(charge.id),
        effectiveChargeCents,
        paidAmountCents: Number(prepared.amountCents),
      },
    )
  }
  charge.newly_inserted = Boolean(inserted.rows[0])
  return charge
}

function isProvableLegacyGeneralAllocation(application, paymentId) {
  return (
    application.idempotency_key === `allocation:${paymentId}:${application.billing_charge_id}`
    && ['annual_membership_first', 'oldest_charge'].includes(String(application.allocation_reason ?? ''))
  )
}

async function exactApplyReconstructedAnnualCharge(db, prepared, payment, charge) {
  await db.query(`SELECT id FROM billing_payment WHERE id = $1 FOR UPDATE`, [payment.id])
  const refunds = await db.query(
    `SELECT COALESCE(SUM(amount_cents), 0)::int AS cents
       FROM billing_refund
      WHERE payment_id = $1
        AND external_status IN ('pending', 'succeeded')`,
    [payment.id],
  )
  if (Number(refunds.rows[0]?.cents ?? 0) !== 0) {
    quarantineInvoice(
      'annual_invoice_payment_refunded',
      'Annual membership invoice payment has a refund and cannot be reconstructed automatically.',
      { billingPaymentId: Number(payment.id) },
    )
  }

  const applications = await db.query(
    `SELECT application.*,
            charge.family_billing_account_id AS charge_account_id,
            COALESCE(SUM(reversal.amount_cents), 0)::int AS reversed_cents
       FROM billing_payment_application application
       JOIN billing_charge charge ON charge.id = application.billing_charge_id
       LEFT JOIN billing_payment_application reversal
         ON reversal.reverses_application_id = application.id
        AND reversal.application_kind = 'reversal'
      WHERE application.application_kind = 'application'
        AND (
          application.billing_payment_id = $1
          OR application.billing_charge_id = $2
        )
      GROUP BY application.id, charge.family_billing_account_id
      ORDER BY application.id`,
    [payment.id, charge.id],
  )
  const exactKey = `annual-invoice:${prepared.invoiceId}:payment:${payment.id}:charge:${charge.id}`
  const legacyToReverse = []
  let exactAppliedCents = 0
  for (const application of applications.rows) {
    const effectiveCents = Math.max(
      0,
      Number(application.amount_cents) - Number(application.reversed_cents ?? 0),
    )
    if (effectiveCents === 0) continue
    if (Number(application.charge_account_id) !== Number(prepared.accountId)) {
      quarantineInvoice(
        'annual_invoice_cross_account_allocation',
        'Annual membership invoice payment has an allocation outside its billing account.',
        { billingPaymentApplicationId: Number(application.id) },
      )
    }
    if (Number(application.billing_payment_id) !== Number(payment.id)) {
      quarantineInvoice(
        'annual_invoice_charge_already_funded',
        'Annual membership renewal charge is already funded by another payment.',
        { billingPaymentApplicationId: Number(application.id), billingChargeId: Number(charge.id) },
      )
    }
    if (
      Number(application.billing_charge_id) === Number(charge.id)
      && application.idempotency_key === exactKey
      && application.allocation_reason === 'exact_annual_invoice'
    ) {
      exactAppliedCents += effectiveCents
      continue
    }
    if (!isProvableLegacyGeneralAllocation(application, payment.id)) {
      quarantineInvoice(
        'annual_invoice_allocation_ambiguous',
        'Annual membership invoice payment has allocations that are not provable legacy general allocations.',
        {
          billingPaymentApplicationId: Number(application.id),
          allocationReason: application.allocation_reason ?? null,
          idempotencyKey: application.idempotency_key ?? null,
        },
      )
    }
    legacyToReverse.push({ ...application, effectiveCents })
  }

  if (exactAppliedCents !== 0 && exactAppliedCents !== Number(prepared.amountCents)) {
    quarantineInvoice(
      'annual_invoice_exact_allocation_partial',
      'Annual membership invoice has a partial exact allocation and requires review.',
      { exactAppliedCents, paidAmountCents: Number(prepared.amountCents) },
    )
  }
  if (exactAppliedCents === 0) {
    for (const application of legacyToReverse) {
      await db.query(
        `INSERT INTO billing_payment_application (
           billing_payment_id, billing_charge_id, amount_cents, application_kind,
           reverses_application_id, idempotency_key, allocation_reason
         ) VALUES ($1, $2, $3, 'reversal', $4, $5, 'annual_invoice_reconstruction')
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
        [
          payment.id,
          application.billing_charge_id,
          application.effectiveCents,
          application.id,
          `annual-invoice-repair:${prepared.invoiceId}:reverse:${application.id}`,
        ],
      )
    }
    const exact = await db.query(
      `INSERT INTO billing_payment_application (
         billing_payment_id, billing_charge_id, amount_cents, application_kind,
         idempotency_key, allocation_reason
       ) VALUES ($1, $2, $3, 'application', $4, 'exact_annual_invoice')
       ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
       RETURNING *`,
      [payment.id, charge.id, prepared.amountCents, exactKey],
    )
    if (!exact.rows[0]) {
      quarantineInvoice(
        'annual_invoice_exact_allocation_missing',
        'Annual membership invoice exact allocation could not be verified.',
        { billingPaymentId: Number(payment.id), billingChargeId: Number(charge.id) },
      )
    }
  } else if (legacyToReverse.length > 0) {
    quarantineInvoice(
      'annual_invoice_extra_allocations',
      'Annual membership invoice has an exact allocation plus additional legacy allocations.',
      { billingPaymentId: Number(payment.id) },
    )
  }

  const affectedChargeIds = [...new Set([
    Number(charge.id),
    ...legacyToReverse.map((application) => Number(application.billing_charge_id)),
  ])]
  await db.query(
    `UPDATE billing_charge candidate
        SET collection_status = CASE
          WHEN COALESCE((
            SELECT SUM(CASE
              WHEN application_kind = 'reversal' THEN -amount_cents
              ELSE amount_cents
            END)
              FROM billing_payment_application
             WHERE billing_charge_id = candidate.id
          ), 0) >= GREATEST(0, candidate.amount_cents + COALESCE((
            SELECT SUM(amount_cents)
              FROM billing_charge adjustment
             WHERE adjustment.related_charge_id = candidate.id
               AND adjustment.source_type = 'charge_adjustment'
          ), 0)) THEN 'paid'
          WHEN COALESCE((
            SELECT SUM(CASE
              WHEN application_kind = 'reversal' THEN -amount_cents
              ELSE amount_cents
            END)
              FROM billing_payment_application
             WHERE billing_charge_id = candidate.id
          ), 0) > 0 THEN 'partially_paid'
          WHEN candidate.collection_status IN ('checkout_pending', 'processing', 'failed')
            THEN candidate.collection_status
          ELSE 'unpaid'
        END
      WHERE candidate.family_billing_account_id = $1
        AND candidate.id = ANY($2::bigint[])`,
    [prepared.accountId, affectedChargeIds],
  )
}

async function markAnnualPaymentFulfillmentPending(db, prepared, payment) {
  const pendingMarker = annualFulfillmentPendingMarker(prepared.invoiceId)
  const refundMarker = annualRefundRequiredMarker(prepared.invoiceId)
  const updated = await db.query(
    `UPDATE billing_payment
        SET external_status = 'reconciliation_required',
            note = CASE
              WHEN position($8 in COALESCE(note, '')) > 0 THEN note
              WHEN COALESCE(note, '') = '' THEN $8
              ELSE note || chr(10) || $8
            END
      WHERE id = $1
        AND family_billing_account_id = $2
        AND amount_cents = $3
        AND stripe_invoice_id = $4
        AND stripe_subscription_id = $5
        AND (stripe_customer_id IS NULL OR stripe_customer_id = $6)
        AND (
          $7::text IS NULL
          OR stripe_payment_intent_id IS NULL
          OR stripe_payment_intent_id = $7
        )
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
      payment.id,
      prepared.accountId,
      prepared.amountCents,
      prepared.invoiceId,
      prepared.subscriptionId,
      prepared.customerId,
      prepared.paymentIntentId,
      pendingMarker,
      refundMarker,
    ],
  ).then((result) => result.rows[0] ?? null)
  if (!updated) {
    throw new Error(`Annual invoice payment ${payment.id} changed before fulfillment could be reserved.`)
  }
  updated.newly_inserted = payment.newly_inserted === true
  updated.fulfillment_pending = true
  return updated
}

async function settleAnnualPaymentAfterFulfillment(db, prepared, payment) {
  const pendingMarker = annualFulfillmentPendingMarker(prepared.invoiceId)
  const refundMarker = annualRefundRequiredMarker(prepared.invoiceId)
  const updated = await db.query(
    `UPDATE billing_payment
        SET external_status = 'settled',
            note = NULLIF(BTRIM(REPLACE(COALESCE(note, ''), $8, '')), '')
      WHERE id = $1
        AND family_billing_account_id = $2
        AND amount_cents = $3
        AND stripe_invoice_id = $4
        AND stripe_subscription_id = $5
        AND (stripe_customer_id IS NULL OR stripe_customer_id = $6)
        AND (
          $7::text IS NULL
          OR stripe_payment_intent_id IS NULL
          OR stripe_payment_intent_id = $7
        )
        AND external_processor = 'stripe'
        AND external_status = 'reconciliation_required'
        AND position($8 in COALESCE(note, '')) > 0
        AND position($9 in COALESCE(note, '')) = 0
      RETURNING *`,
    [
      payment.id,
      prepared.accountId,
      prepared.amountCents,
      prepared.invoiceId,
      prepared.subscriptionId,
      prepared.customerId,
      prepared.paymentIntentId,
      pendingMarker,
      refundMarker,
    ],
  ).then((result) => result.rows[0] ?? null)
  if (!updated) {
    throw new Error(`Annual invoice payment ${payment.id} changed before fulfillment could be settled.`)
  }
  updated.newly_inserted = payment.newly_inserted === true
  updated.fulfillment_pending = false
  return updated
}

async function markAnnualPaymentRefundRequired(db, prepared, payment, error) {
  const marker = annualRefundRequiredMarker(prepared.invoiceId)
  const reason = String(error?.message ?? error).slice(0, 500)
  const note = `${marker} ${reason}`.slice(0, 1000)
  const updated = await db.query(
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
        AND stripe_invoice_id = $4
        AND stripe_subscription_id = $5
        AND (stripe_customer_id IS NULL OR stripe_customer_id = $6)
        AND (
          $7::text IS NULL
          OR stripe_payment_intent_id IS NULL
          OR stripe_payment_intent_id = $7
        )
        AND external_processor = 'stripe'
        AND external_status IN ('settled', 'succeeded', 'reconciliation_required')
      RETURNING *`,
    [
      payment.id,
      prepared.accountId,
      prepared.amountCents,
      prepared.invoiceId,
      prepared.subscriptionId,
      prepared.customerId,
      prepared.paymentIntentId,
      marker,
      note,
    ],
  ).then((result) => result.rows[0] ?? null)
  if (!updated) {
    throw new Error(`Annual invoice payment ${payment.id} changed before it could be quarantined for refund review.`)
  }
  updated.newly_inserted = payment.newly_inserted === true
  updated.refund_required = true
  updated.fulfillment_pending = false
  updated.reconciliation_reason = reason
  updated.reconciliation_code = error?.reasonCode ?? 'annual_invoice_entitlement_conflict'
  return updated
}

async function alertAnnualPaymentRefundRequired(pool, prepared, payment) {
  await recordStripeBillingAlert(pool, {
    event: { id: `annual-invoice-refund-required:${prepared.invoiceId}` },
    object: {
      id: prepared.invoiceId,
      status: 'paid',
      amount_due: prepared.amountCents,
      currency: prepared.invoice?.currency ?? 'usd',
      metadata: { familyBillingAccountId: String(prepared.accountId) },
    },
    alertType: 'annual_invoice_refund_required',
    severity: 'critical',
    message: `Stripe collected annual invoice ${prepared.invoiceId}, but its entitlement could not be applied safely. Payment ${payment.id} is quarantined and requires refund or reviewed reconciliation (${payment.reconciliation_code}).`,
  }).catch(() => {})
}

async function recordAnnualPaidStripeInvoice(pool, prepared) {
  const outcome = await withBillingAccountCollectionLock(pool, prepared.accountId, async (db) => {
    let payment
    try {
      await db.query('BEGIN')
      payment = await upsertPaidStripeInvoicePayment(db, prepared)
      if (!payment) {
        quarantineInvoice(
          'annual_invoice_payment_missing',
          'Annual membership invoice payment could not be recorded.',
          { stripeInvoiceId: prepared.invoiceId },
        )
      }
      if (!isAnnualRefundRequiredPayment(payment, prepared)) {
        payment = await markAnnualPaymentFulfillmentPending(db, prepared, payment)
      }
      await db.query('COMMIT')
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {})
      throw error
    }

    if (isAnnualRefundRequiredPayment(payment, prepared)) {
      payment.refund_required = true
      payment.reconciliation_code = 'annual_invoice_entitlement_conflict'
      return { payment, refundRequired: true }
    }

    try {
      await db.query('BEGIN')
      await assertAnnualBindingStillCurrent(db, prepared)
      const charge = await reconstructAnnualInvoiceCharge(db, prepared)
      await exactApplyReconstructedAnnualCharge(db, prepared, payment, charge)
      await recordAnnualMembershipRenewalPromoRedemption(db, {
        stripeSubscriptionId: prepared.subscriptionId,
        stripeInvoiceId: prepared.invoiceId,
        paidAmountCents: prepared.amountCents,
        paidAt: prepared.paidAt,
      })
      payment = await settleAnnualPaymentAfterFulfillment(db, prepared, payment)
      await db.query('COMMIT')
      payment.annual_charge_id = Number(charge.id)
      return { payment, refundRequired: false }
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {})
      if (!(error instanceof StripeInvoiceQuarantineError)) throw error
      try {
        await db.query('BEGIN')
        const quarantined = await markAnnualPaymentRefundRequired(db, prepared, payment, error)
        await db.query('COMMIT')
        return { payment: quarantined, refundRequired: true }
      } catch (quarantineError) {
        await db.query('ROLLBACK').catch(() => {})
        throw quarantineError
      }
    }
  })
  if (outcome.refundRequired) {
    await alertAnnualPaymentRefundRequired(pool, prepared, outcome.payment)
  }
  return outcome.payment
}

async function recordOrdinaryPaidStripeInvoice(pool, prepared) {
  return withBillingAccountCollectionLock(pool, prepared.accountId, async (db) => {
    try {
      await db.query('BEGIN')
      const payment = await upsertPaidStripeInvoicePayment(db, prepared)
      await db.query('COMMIT')
      return payment
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {})
      throw error
    }
  })
}

/** Idempotently mirror a paid Stripe renewal invoice into the Vortex ledger. */
export async function recordPaidStripeInvoice(pool, invoice, {
  stripe = null,
  expectedLegacySubscriptionOwnership = null,
  canonicalMigrationSettlement = null,
} = {}) {
  const prepared = await preparePaidStripeInvoiceRecord(pool, invoice, {
    stripe,
    expectedLegacySubscriptionOwnership,
    canonicalMigrationSettlement,
  })
  if (!prepared) return null
  if (!prepared.annualBinding) return recordOrdinaryPaidStripeInvoice(pool, prepared)
  const payment = await recordAnnualPaidStripeInvoice(pool, prepared)
  if (payment.refund_required) return payment
  // The next annual price can involve Stripe network calls, so validate it only
  // after the local payment/charge/allocation transaction has committed.
  await validateAnnualMembershipRenewalDiscount(pool, {
    stripeSubscriptionId: prepared.subscriptionId,
    stripe: prepared.stripeClient,
    now: prepared.paidAt,
  })
  return payment
}

/** Mirror Stripe lifecycle status without cancelling service on a transient decline. */
async function applyCurrentStripeSubscriptionStatus(pool, subscription, eventType) {
  const stripeStatus = String(subscription.status ?? '')
  let localStatus = null
  if (eventType === 'customer.subscription.deleted' || stripeStatus === 'canceled') {
    localStatus = 'cancelled'
  } else if (stripeStatus === 'paused') {
    localStatus = 'paused'
  } else if (['active', 'trialing'].includes(stripeStatus)) {
    localStatus = 'active'
  }
  if (!localStatus) return { updated: 0, status: null }

  const endAt = subscription.ended_at || subscription.cancel_at || null
  const nextBillAt = subscriptionPeriodEnd(subscription)
  const autoRenewal = !(
    localStatus === 'cancelled' ||
    subscription.cancel_at_period_end === true ||
    Number(subscription.cancel_at) > 0
  )
  const result = await pool.query(
    `
      UPDATE billing_subscription
      SET status = $2,
          end_date = CASE
            WHEN $2 = 'cancelled' THEN COALESCE(to_timestamp($3)::date, CURRENT_DATE)
            ELSE NULL
          END,
          next_bill_date = CASE
            WHEN (
              source_type = 'annual_membership' OR
              pricing_option_key = 'annual_membership'
            ) AND $5::double precision IS NOT NULL
              THEN to_timestamp($5::double precision)::date
            WHEN $2 = 'cancelled' AND NOT (
              source_type = 'annual_membership' OR
              pricing_option_key = 'annual_membership'
            ) THEN NULL
            ELSE next_bill_date
          END,
          auto_renewal = $4,
          updated_at = now()
      WHERE stripe_subscription_id = $1
    `,
    [subscription.id, localStatus, endAt, autoRenewal, nextBillAt],
  )
  return { updated: result.rowCount ?? 0, status: localStatus }
}

function stripeResourceMissing(error) {
  return error?.code === 'resource_missing' || error?.statusCode === 404 || error?.status === 404
}

export async function syncStripeSubscriptionStatus(
  pool,
  subscription,
  eventType,
  { stripe: suppliedStripe = null } = {},
) {
  if (!subscription?.id) return { updated: 0, status: null }
  await ensureBillingRecurringSchema(pool)

  const observedGuard = await loadCanonicalCutoverWebhookGuard(pool, subscription.id)
  if (observedGuard) {
    return withBillingAccountCollectionLock(
      pool,
      observedGuard.family_billing_account_id,
      async (db) => {
          // Rollback and webhook delivery may race. Re-read both the migration
          // state and local link only after taking the same collection lock
          // used by rollback; never act on the pre-lock guard snapshot.
          const guard = await loadCanonicalCutoverWebhookGuard(
            db,
            subscription.id,
            MIGRATION_WEBHOOK_RECHECK_STATES,
          )
          if (!guard) {
            const error = new Error('Canonical cutover webhook guard disappeared while acquiring its account lock.')
            error.code = 'canonical_cutover_webhook_guard_changed'
            throw error
          }
          if (guard.migration_state !== BILLING_MIGRATION_STATES.ROLLED_BACK) {
            return guardCanonicalCutoverLifecycle(db, subscription, eventType, guard)
          }

          // A delayed pre-rollback payload must not overwrite a restored local
          // schedule. Reconcile rolled-back accounts from Stripe's current
          // object while still holding the account collector lock.
          const stripe = suppliedStripe ?? await getStripeClient()
          let currentSubscription = subscription
          try {
            currentSubscription = await stripe.subscriptions.retrieve(String(subscription.id))
          } catch (error) {
            if (!stripeResourceMissing(error)) throw error
          }
          const currentEventType = String(currentSubscription?.status ?? '') === 'canceled'
            ? 'customer.subscription.deleted'
            : 'customer.subscription.updated'
          return applyCurrentStripeSubscriptionStatus(db, currentSubscription, currentEventType)
      },
    )
  }

  const observedOwnership = await classifyLegacyStripeSubscriptionOwnership(pool, {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer,
    metadataAccountId: subscription.metadata?.familyBillingAccountId ?? null,
  })
  if (!observedOwnership.expectedLegacy) {
    await recordUnexpectedSubscriptionLifecycle(pool, {
      subscription,
      eventType,
      accountId: observedOwnership.accountId,
      reason: observedOwnership.reason,
    })
    return {
      updated: 0,
      status: null,
      quarantined: true,
      reasonCode: observedOwnership.code,
    }
  }

  return withBillingAccountCollectionLock(pool, observedOwnership.accountId, async (db) => {
    const ownership = await classifyLegacyStripeSubscriptionOwnership(db, {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      metadataAccountId: subscription.metadata?.familyBillingAccountId ?? null,
    })
    if (!ownership.expectedLegacy) {
      await recordUnexpectedSubscriptionLifecycle(db, {
        subscription,
        eventType,
        accountId: ownership.accountId ?? observedOwnership.accountId,
        reason: ownership.reason,
      })
      return {
        updated: 0,
        status: null,
        quarantined: true,
        reasonCode: ownership.code,
      }
    }
    if (eventType === 'customer.subscription.created') {
      const reason = 'Vortex no longer creates recurring Stripe subscriptions; the new remote collector requires reviewed quarantine.'
      await recordUnexpectedSubscriptionLifecycle(db, {
        subscription,
        eventType,
        accountId: ownership.accountId,
        reason,
      })
      return {
        updated: 0,
        status: ownership.localStatus,
        quarantined: true,
        reasonCode: 'stripe_subscription_creation_forbidden',
      }
    }
    const applied = await applyCurrentStripeSubscriptionStatus(db, subscription, eventType)
    if (applied.updated > 0) return applied

    const reason = `Stripe ${eventType} could not be applied because its exact legacy subscription link disappeared.`
    await recordUnexpectedSubscriptionLifecycle(db, {
      subscription,
      eventType,
      accountId: ownership.accountId,
      reason,
    })
    return {
      updated: 0,
      status: null,
      quarantined: true,
      reasonCode: 'stripe_subscription_owner_changed',
    }
  })
}

export async function resolveStripeWebhookAccountId(pool, object) {
  return resolveAccountId(pool, object)
}
