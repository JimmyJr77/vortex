import { ensureBillingStripeLinksSchema, getStripeClient } from './stripeBilling.js'
import { ensureBillingRecurringSchema } from './stripeCatalogSync.js'
import { resolveStripePaymentMethodLabel } from './paymentMethodLabel.js'
import {
  recordAnnualMembershipRenewalPromoRedemption,
  validateAnnualMembershipRenewalDiscount,
} from './customerBillingPayments.js'
import { recordBillingActivity } from './billingActivity.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import {
  BILLING_MIGRATION_STATES,
  sanitizeBillingMigrationSnapshot,
} from './canonicalBillingMigrationState.js'
import { classifyLegacyStripeSubscriptionOwnership } from './stripeSubscriptionOwnership.js'

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
  const metadataId = Number(object?.metadata?.familyBillingAccountId)
  if (Number.isFinite(metadataId) && metadataId > 0) return metadataId

  const customerId = objectId(object?.customer)
  if (!customerId) return null
  const result = await pool.query(
    `SELECT id FROM family_billing_account WHERE stripe_customer_id = $1 LIMIT 1`,
    [customerId],
  )
  return result.rows[0]?.id ? Number(result.rows[0].id) : null
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

async function loadAnnualInvoiceBinding(pool, invoice, { stripeClient, subscriptionId }) {
  if (!subscriptionId) return null
  const annualRows = await pool.query(
    `SELECT id, family_billing_account_id, member_id, source_type, source_id,
            description, stripe_subscription_id, pricing_option_key
       FROM billing_subscription
      WHERE stripe_subscription_id = $1
        AND (source_type = 'annual_membership' OR pricing_option_key = 'annual_membership')
      ORDER BY id
      LIMIT 3`,
    [subscriptionId],
  ).then((result) => result.rows)

  let remoteSubscription = null
  if (annualRows.length > 0 && typeof stripeClient?.subscriptions?.retrieve === 'function') {
    remoteSubscription = await stripeClient.subscriptions.retrieve(subscriptionId)
  }
  const metadataLayers = annualMetadataLayers(invoice, remoteSubscription)
  const claimsAnnual = metadataClaimsAnnualMembership(metadataLayers)
  if (annualRows.length === 0) {
    if (claimsAnnual) {
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
  const customerAccountId = positiveMetadataId(customerOwners[0].id)
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
} = {}) {
  if (!invoice?.id || invoice.paid === false || invoice.status === 'void') return null
  await ensureBillingStripeLinksSchema(pool)
  const paymentIntentId = invoicePaymentIntentId(invoice)
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

  const stripeClient = stripe || (await getStripeClient())
  const annualBinding = await loadAnnualInvoiceBinding(pool, invoice, {
    stripeClient,
    subscriptionId,
  })
  const accountId = subscriptionOwnership?.accountId
    ?? annualBinding?.accountId
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
      VALUES ($1, $2, $3, $4, 'Stripe subscription renewal',
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
    `SELECT * FROM billing_payment WHERE stripe_invoice_id = $1 LIMIT 1`,
    [prepared.invoiceId],
  ).then((lookup) => lookup.rows[0] ?? null)
  // Older reconciliation code could insert an invoice-backed PaymentIntent as
  // a generic payment before the invoice webhook arrived. Repair that row only
  // when its immutable account and amount exactly match this paid invoice.
  if (!payment && prepared.paymentIntentId) {
    const priorIntentPayment = await pool.query(
      `SELECT * FROM billing_payment WHERE stripe_payment_intent_id = $1 LIMIT 1`,
      [prepared.paymentIntentId],
    ).then((lookup) => lookup.rows[0] ?? null)
    if (priorIntentPayment) {
      if (
        Number(priorIntentPayment.family_billing_account_id) !== Number(prepared.accountId)
        || Number(priorIntentPayment.amount_cents) !== Number(prepared.amountCents)
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
                note = COALESCE(note, 'Stripe subscription renewal')
          WHERE id = $1
            AND (stripe_invoice_id IS NULL OR stripe_invoice_id = $2)
            AND (stripe_subscription_id IS NULL OR stripe_subscription_id IS NOT DISTINCT FROM $3)
          RETURNING *`,
        [priorIntentPayment.id, prepared.invoiceId, prepared.subscriptionId, prepared.customerId],
      ).then((updated) => updated.rows[0] ?? null)
      if (!payment) throw new Error('Existing Stripe PaymentIntent payment changed before invoice ownership could be restored.')
    }
  }
  if (payment) {
    const mismatch = (
      Number(payment.family_billing_account_id) !== Number(prepared.accountId)
      || Number(payment.amount_cents) !== Number(prepared.amountCents)
      || (payment.stripe_invoice_id && payment.stripe_invoice_id !== prepared.invoiceId)
      || (
        payment.stripe_payment_intent_id
        && prepared.paymentIntentId
        && payment.stripe_payment_intent_id !== prepared.paymentIntentId
      )
      || (
        payment.stripe_subscription_id
        && prepared.subscriptionId
        && payment.stripe_subscription_id !== prepared.subscriptionId
      )
    )
    if (mismatch) {
      quarantineInvoice(
        'paid_invoice_payment_binding_conflict',
        'Existing Stripe payment does not match its paid invoice identity, account, or amount.',
        { billingPaymentId: Number(payment.id), stripeInvoiceId: prepared.invoiceId },
      )
    }
  }
  if (payment) payment.newly_inserted = Boolean(result.rows[0])
  return payment
}

function annualRenewalDate(paidAt) {
  return new Date(Date.UTC(
    paidAt.getUTCFullYear() + 1,
    paidAt.getUTCMonth(),
    paidAt.getUTCDate(),
  )).toISOString().slice(0, 10)
}

async function assertAnnualBindingStillCurrent(db, prepared) {
  const binding = prepared.annualBinding
  const result = await db.query(
    `SELECT id
       FROM billing_subscription
      WHERE id = $1
        AND stripe_subscription_id = $2
        AND family_billing_account_id = $3
        AND member_id = $4
        AND (source_type = 'annual_membership' OR pricing_option_key = 'annual_membership')
      FOR SHARE`,
    [
      Number(binding.annualSubscription.id),
      prepared.subscriptionId,
      prepared.accountId,
      binding.memberId,
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
  const sourceId = `${binding.feeId}:${binding.memberId}:${annualRenewalDate(prepared.paidAt)}`
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

async function recordAnnualPaidStripeInvoice(pool, prepared) {
  return withBillingAccountCollectionLock(pool, prepared.accountId, async (db) => {
    try {
      await db.query('BEGIN')
      await assertAnnualBindingStillCurrent(db, prepared)
      const payment = await upsertPaidStripeInvoicePayment(db, prepared)
      if (!payment) {
        quarantineInvoice(
          'annual_invoice_payment_missing',
          'Annual membership invoice payment could not be recorded.',
          { stripeInvoiceId: prepared.invoiceId },
        )
      }
      const charge = await reconstructAnnualInvoiceCharge(db, prepared)
      await exactApplyReconstructedAnnualCharge(db, prepared, payment, charge)
      await recordAnnualMembershipRenewalPromoRedemption(db, {
        stripeSubscriptionId: prepared.subscriptionId,
        stripeInvoiceId: prepared.invoiceId,
        paidAmountCents: prepared.amountCents,
        paidAt: prepared.paidAt,
      })
      await db.query('COMMIT')
      payment.annual_charge_id = Number(charge.id)
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
  if (!prepared.annualBinding) return upsertPaidStripeInvoicePayment(pool, prepared)
  const payment = await recordAnnualPaidStripeInvoice(pool, prepared)
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
