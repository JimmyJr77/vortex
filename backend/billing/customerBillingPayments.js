import { randomUUID } from 'crypto'
import {
  buildBalanceCheckoutParams,
  createPaymentMethodSetupSession,
  ensureStripeCustomer,
  getStripeClient,
  stripeEnabled,
} from './stripeBilling.js'
import {
  createBillingRefund,
  REFUND_LEDGER_FINALIZATION_PREFIX,
  stripeRefundReadyForLedgerFinalization,
} from './stripeOperations.js'
import { recordBillingActivity } from './billingActivity.js'
import { ensureCustomerBillingAccount } from './customerBillingQueries.js'
import { ensureBillingChargeSchema } from './billingChargeSchema.js'
import { ensureHouseholdMonthlyInvoiceSchema } from './householdMonthlyInvoice.js'
import { membershipRenewsOnFromPurchase, toUtcDateString } from '../scheduling/membershipAnniversary.js'
import { loadActiveAdditionalFees } from '../scheduling/additionalFeesEngine.js'
import { memberHasActiveAnnualMembership } from '../scheduling/annualMembership.js'
import { membershipPromoDiscountCents, resolveMembershipFeePromo } from '../scheduling/discountEngine.js'
import {
  applyExactPayment,
  allocateHouseholdPayments,
  allocateHouseholdPaymentsLocked,
  endRefundedAnnualMembership,
  reverseRefundedApplicationsLocked,
} from './paymentAllocation.js'
import {
  HOUSEHOLD_INVOICE_RESERVING_STATUSES,
  loadCanonicalCollectibleBalanceCents,
} from './canonicalBillingAccount.js'
import { selectStripeCustomerPaymentMethod } from './stripePaymentMethodReadiness.js'
import { canonicalActiveHouseholdMemberPredicate } from './householdMembership.js'
import { guardLegacyRemoteSubscriptionMutation } from './remoteSubscriptionMutationGuard.js'
import {
  attachBillingPaymentAttemptStripeObject,
  loadBillingPaymentAttemptByRequestKey,
  markBillingPaymentAttemptRemotePending,
  paymentIntentFailureIsFinal,
  recordAndCompleteBillingPaymentAttempt,
  releaseBillingPaymentAttempt,
  reserveBillingPaymentAttempt,
  withBillingAccountCollectionLock,
} from './paymentAttemptReservations.js'

function positiveCents(value, label = 'Amount') {
  const amount = Number(value)
  if (!Number.isInteger(amount) || amount <= 0) throw new Error(`${label} must be a positive whole-cent amount.`)
  return amount
}

function nonNegativeCents(value, label = 'Amount') {
  const amount = Number(value)
  if (!Number.isInteger(amount) || amount < 0) throw new Error(`${label} must be a non-negative whole-cent amount.`)
  return amount
}

async function ensureAnnualMembershipRenewalPricingSchema() {
  // Compatibility hook. Startup billing readiness owns this schema contract.
}

function optionalDate(value, label) {
  if (value == null || value === '') return null
  const date = String(value).slice(0, 10)
  const parsed = new Date(`${date}T00:00:00Z`)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`${label} must be a valid calendar date.`)
  }
  return date
}

async function validateMemberScope(pool, account, memberId) {
  if (memberId == null) return null
  const activeHouseholdMember = canonicalActiveHouseholdMemberPredicate({
    memberAlias: 'm',
    familyIdReference: '$2',
  })
  const result = await pool.query(
    `SELECT m.id FROM member m
     WHERE m.id = $1
       AND ${activeHouseholdMember}`,
    [Number(memberId), Number(account.family_id)],
  )
  if (!result.rows[0]) throw new Error('Selected member does not belong to this household.')
  return Number(memberId)
}

function isAnnualMembershipFee(fee) {
  return (fee?.triggerType === 'once_per_year' || fee?.applyBasis === 'per_year') && Number(fee.amountCents) > 0
}

/**
 * Post an athlete-owned annual membership fee to the household ledger. This is
 * intentionally ledger-only: staff can then collect it with the normal account
 * balance workflow, and the payment allocator activates the membership once paid.
 */
export async function billAnnualMembershipNow(pool, {
  familyId,
  facilityId = null,
  memberId,
  actorUserId = null,
  idempotencyKey = null,
}) {
  const account = await ensureCustomerBillingAccount(pool, familyId, facilityId)
  if (!account) throw new Error('Family billing account was not found.')
  const scopedMemberId = await validateMemberScope(pool, account, memberId)
  if (scopedMemberId == null) throw new Error('An athlete is required for an annual membership bill.')
  if (await memberHasActiveAnnualMembership(pool, scopedMemberId)) {
    throw new Error('This athlete already has an active annual membership.')
  }

  const fees = await loadActiveAdditionalFees(pool, facilityId)
  const fee = fees.find(isAnnualMembershipFee)
  if (!fee) throw new Error('No active annual membership fee is configured for this facility.')

  await ensureBillingChargeSchema(pool)
  const outstanding = await pool.query(
    `SELECT c.id
       FROM billing_charge c
       LEFT JOIN LATERAL (
         SELECT SUM(CASE WHEN a.application_kind = 'reversal' THEN -a.amount_cents ELSE a.amount_cents END)::int AS applied_cents
         FROM billing_payment_application a
         JOIN billing_payment payment ON payment.id = a.billing_payment_id
         WHERE a.billing_charge_id = c.id
           AND payment.external_status IN ('settled', 'succeeded')
       ) applications ON TRUE
      WHERE c.family_billing_account_id = $1
        AND c.member_id = $2
        AND c.source_type = 'additional_fee'
        AND split_part(c.source_id, ':', 1) = $3
        AND GREATEST(0, c.amount_cents - COALESCE(applications.applied_cents, 0)) > 0
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT 1`,
    [account.id, scopedMemberId, String(fee.id)],
  )
  if (outstanding.rows[0]) {
    throw new Error('This athlete already has an outstanding annual membership bill.')
  }

  const billedAt = new Date()
  const renewalDate = toUtcDateString(membershipRenewsOnFromPurchase(billedAt)) || toUtcDateString(billedAt)
  const sourceId = `${fee.id}:${scopedMemberId}:${renewalDate}`
  const sourceKey = String(idempotencyKey ?? '').trim()
  const inserted = await pool.query(
    `INSERT INTO billing_charge (
       family_billing_account_id, member_id, source_type, source_id, description,
       amount_cents, gross_amount_cents, discount_amount_cents,
       charge_type, billing_interval, service_period_start, service_period_end,
       collection_status, created_by_user_id, metadata
     ) VALUES (
       $1, $2, 'additional_fee', $3, $4, $5, $5, 0,
       'one_time', 'one_time', $6, $6, 'unpaid', $7,
       jsonb_strip_nulls(jsonb_build_object('createdBy', 'customer_billing_bill_now', 'requestKey', NULLIF($8, '')))
     )
     ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
     RETURNING *`,
    [
      account.id,
      scopedMemberId,
      sourceId,
      fee.name || 'Annual Fee',
      Math.round(Number(fee.amountCents)),
      toUtcDateString(billedAt),
      actorUserId,
      sourceKey,
    ],
  )
  let charge = inserted.rows[0] ?? null
  const created = Boolean(charge)
  if (!charge) {
    charge = await pool.query(
      `SELECT * FROM billing_charge WHERE source_type = 'additional_fee' AND source_id = $1 LIMIT 1`,
      [sourceId],
    ).then((result) => result.rows[0] ?? null)
    if (!charge) throw new Error('Annual membership bill could not be created.')
  }
  if (created) {
    await recordBillingActivity(pool, {
      eventKey: `annual-membership-billed:${charge.id}`,
      accountId: account.id,
      memberId: scopedMemberId,
      chargeId: charge.id,
      eventType: 'annual_membership_bill_created',
      summary: `Annual membership fee added for this athlete.`,
      afterValue: {
        chargeId: Number(charge.id),
        feeId: Number(fee.id),
        amountCents: Number(charge.amount_cents),
        renewalDate,
      },
      actorUserId,
    })
    await allocateHouseholdPayments(pool, { accountId: account.id, actorUserId, actorType: 'admin' })
  }
  return { account, charge, created, renewalDate }
}

async function loadCharge(pool, accountId, chargeId) {
  const result = await pool.query(
    `SELECT * FROM billing_charge WHERE id = $1 AND family_billing_account_id = $2`,
    [Number(chargeId), Number(accountId)],
  )
  if (!result.rows[0]) throw new Error('Custom charge was not found.')
  return result.rows[0]
}

function annualMembershipFeeId(charge) {
  if (charge?.source_type !== 'additional_fee') return null
  const feeId = Number(String(charge.source_id ?? '').split(':')[0])
  return Number.isInteger(feeId) && feeId > 0 ? feeId : null
}

async function recordMembershipPromoRedemption(pool, { ruleId, memberId, discountCents }) {
  await pool.query(
    `INSERT INTO discount_redemption
      (rule_id, member_id, signup_id, program_id, form_id, kind, units, amount_cents)
     VALUES ($1, $2, NULL, NULL, NULL, 'discount', 0, $3)`,
    [ruleId, memberId, discountCents],
  )
  await pool.query(
    `UPDATE discount_rule SET redeemed_count = redeemed_count + 1, updated_at = now() WHERE id = $1`,
    [ruleId],
  )
}

async function configureAnnualMembershipRenewalPricing(pool, {
  account,
  charge,
  feeId,
  pricing,
  reason,
  actorUserId,
  idempotencyKey,
}) {
  await ensureAnnualMembershipRenewalPricingSchema(pool)
  const subscription = await pool.query(
    `SELECT *
       FROM billing_subscription
      WHERE family_billing_account_id = $1
        AND member_id = $2
        AND source_type = 'annual_membership'
        AND source_id = $3
        AND status <> 'cancelled'
      ORDER BY id DESC
      LIMIT 1`,
    [account.id, charge.member_id, `${feeId}:${charge.member_id}`],
  ).then((result) => result.rows[0] ?? null)
  const existing = await pool.query(
    `SELECT * FROM annual_membership_renewal_pricing
      WHERE family_billing_account_id = $1 AND member_id = $2 AND additional_fee_id = $3`,
    [account.id, charge.member_id, feeId],
  ).then((result) => result.rows[0] ?? null)

  const save = async ({ syncStatus, syncError = null, stripeSubscriptionId = null, stripeSubscriptionItemId = null, stripePriceId = null }) => pool.query(
    `INSERT INTO annual_membership_renewal_pricing (
       family_billing_account_id, member_id, additional_fee_id, pricing_kind,
       final_amount_cents, promo_code, discount_rule_id, discount_rule_snapshot,
       reason, stripe_subscription_id, stripe_subscription_item_id, stripe_price_id,
       sync_status, sync_error, created_by_user_id
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8::jsonb,
       $9, $10, $11, $12, $13, $14, $15
     ) ON CONFLICT (family_billing_account_id, member_id, additional_fee_id)
     DO UPDATE SET
       pricing_kind = EXCLUDED.pricing_kind,
       final_amount_cents = EXCLUDED.final_amount_cents,
       promo_code = EXCLUDED.promo_code,
       discount_rule_id = EXCLUDED.discount_rule_id,
       discount_rule_snapshot = EXCLUDED.discount_rule_snapshot,
       reason = EXCLUDED.reason,
       stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, annual_membership_renewal_pricing.stripe_subscription_id),
       stripe_subscription_item_id = COALESCE(EXCLUDED.stripe_subscription_item_id, annual_membership_renewal_pricing.stripe_subscription_item_id),
       stripe_price_id = COALESCE(EXCLUDED.stripe_price_id, annual_membership_renewal_pricing.stripe_price_id),
       sync_status = EXCLUDED.sync_status,
       sync_error = EXCLUDED.sync_error,
       created_by_user_id = EXCLUDED.created_by_user_id,
       updated_at = now()
     RETURNING *`,
    [
      account.id,
      charge.member_id,
      feeId,
      pricing.kind,
      pricing.finalAmountCents,
      pricing.promoCode,
      pricing.rule?.id ?? null,
      pricing.rule ? JSON.stringify(pricing.rule) : null,
      reason,
      stripeSubscriptionId,
      stripeSubscriptionItemId,
      stripePriceId,
      syncStatus,
      syncError,
      actorUserId,
    ],
  ).then((result) => result.rows[0] ?? null)

  const activity = async (instruction, summary, eventType, stripeObjectId = null) => recordBillingActivity(pool, {
    eventKey: idempotencyKey
      ? `annual-membership-renewal-pricing:${idempotencyKey}:${eventType}`
      : `annual-membership-renewal-pricing:${instruction.id}:${instruction.updated_at}:${eventType}`,
    accountId: account.id,
    memberId: charge.member_id,
    chargeId: charge.id,
    eventType,
    summary,
    beforeValue: existing,
    afterValue: instruction,
    stripeObjectId,
    actorUserId,
    actorType: 'admin',
  })

  if (!subscription?.stripe_subscription_id) {
    const instruction = await save({ syncStatus: 'not_required' })
    await activity(instruction, 'Future annual membership renewal pricing was configured for this athlete.', 'annual_membership_renewal_price_configured')
    return { instruction, syncStatus: instruction.sync_status }
  }

  const remoteMutation = await guardLegacyRemoteSubscriptionMutation(pool, {
    accountId: account.id,
    stripeSubscriptionId: subscription.stripe_subscription_id,
    operation: 'annual-membership-renewal-price-update',
  })
  if (!remoteMutation.allowed) {
    const instruction = await save({
      syncStatus: 'not_required',
      syncError: remoteMutation.reason,
      stripeSubscriptionId: subscription.stripe_subscription_id,
    })
    await activity(
      instruction,
      'Future annual membership renewal pricing was saved to the household ledger; a stale Stripe collector was quarantined.',
      'annual_membership_remote_collector_quarantined',
      subscription.stripe_subscription_id,
    )
    return {
      instruction,
      syncStatus: instruction.sync_status,
      remoteCollectorQuarantined: true,
    }
  }

  if (!stripeEnabled()) {
    const instruction = await save({
      syncStatus: 'pending',
      stripeSubscriptionId: subscription.stripe_subscription_id,
    })
    await activity(instruction, 'Future annual membership renewal pricing is pending Stripe synchronization.', 'annual_membership_renewal_price_configured')
    return { instruction, syncStatus: instruction.sync_status }
  }

  const stripe = await getStripeClient()
  if (!stripe) {
    const instruction = await save({ syncStatus: 'pending', stripeSubscriptionId: subscription.stripe_subscription_id })
    await activity(instruction, 'Future annual membership renewal pricing is pending Stripe synchronization.', 'annual_membership_renewal_price_configured')
    return { instruction, syncStatus: instruction.sync_status }
  }

  try {
    const remoteSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
    const item = remoteSubscription.items?.data?.[0]
    const product = typeof item?.price?.product === 'string' ? item.price.product : item?.price?.product?.id
    if (!item?.id || !product) throw new Error('Annual membership Stripe subscription has no renewable item.')
    const price = await stripe.prices.create({
      product,
      currency: 'usd',
      unit_amount: pricing.finalAmountCents,
      recurring: { interval: 'year' },
      metadata: {
        vortex_annual_membership: 'true',
        vortex_fee_id: String(feeId),
        vortex_member_id: String(charge.member_id),
        annual_renewal_pricing: pricing.kind,
        ...(pricing.promoCode ? { promo_code: pricing.promoCode } : {}),
      },
    }, idempotencyKey ? { idempotencyKey: `${idempotencyKey}:annual-renewal-price` } : undefined)
    await stripe.subscriptions.update(remoteSubscription.id, {
      items: [{ id: item.id, price: price.id }],
      proration_behavior: 'none',
      metadata: {
        ...(remoteSubscription.metadata ?? {}),
        annualRenewalPriceCents: String(pricing.finalAmountCents),
        annualRenewalPricingKind: pricing.kind,
        annualRenewalPromoCode: pricing.promoCode ?? '',
        annualRenewalDiscountRuleId: pricing.rule?.id == null ? '' : String(pricing.rule.id),
      },
    }, idempotencyKey ? { idempotencyKey: `${idempotencyKey}:annual-renewal-subscription` } : undefined)
    const instruction = await save({
      syncStatus: 'synced',
      stripeSubscriptionId: remoteSubscription.id,
      stripeSubscriptionItemId: item.id,
      stripePriceId: price.id,
    })
    await pool.query(
      `UPDATE billing_subscription SET stripe_subscription_item_id = $2, updated_at = now() WHERE id = $1`,
      [subscription.id, item.id],
    )
    await activity(instruction, 'Future annual membership renewal pricing was synchronized to Stripe.', 'annual_membership_renewal_price_configured', remoteSubscription.id)
    return { instruction, syncStatus: instruction.sync_status }
  } catch (error) {
    const instruction = await save({
      syncStatus: 'sync_failed',
      syncError: String(error?.message ?? error).slice(0, 1000),
      stripeSubscriptionId: subscription.stripe_subscription_id,
    })
    await activity(instruction, 'Future annual membership renewal pricing needs Stripe synchronization.', 'annual_membership_renewal_price_sync_failed', subscription.stripe_subscription_id)
    throw new Error(`Renewal pricing was saved locally, but Stripe synchronization failed: ${error?.message ?? error}`)
  }
}

async function loadAnnualMembershipRenewalPromo(pool, stripeSubscriptionId) {
  await ensureAnnualMembershipRenewalPricingSchema(pool)
  return pool.query(
    `SELECT pricing.*, account.family_id, fee.facility_id, fee.amount_cents AS standard_amount_cents,
            subscription.id AS billing_subscription_id, subscription.stripe_subscription_id
       FROM annual_membership_renewal_pricing pricing
       JOIN family_billing_account account ON account.id = pricing.family_billing_account_id
       JOIN additional_fee fee ON fee.id = pricing.additional_fee_id
       JOIN billing_subscription subscription
         ON subscription.family_billing_account_id = pricing.family_billing_account_id
        AND subscription.member_id = pricing.member_id
        AND subscription.source_type = 'annual_membership'
        AND subscription.source_id = CONCAT(pricing.additional_fee_id, ':', pricing.member_id)
        AND subscription.status <> 'cancelled'
      WHERE subscription.stripe_subscription_id = $1
        AND pricing.pricing_kind = 'promo_code'
        AND NULLIF(BTRIM(pricing.promo_code), '') IS NOT NULL
      LIMIT 1`,
    [stripeSubscriptionId],
  ).then((result) => result.rows[0] ?? null)
}

/**
 * A promo selected for a future annual renewal is not a perpetual entitlement.
 * Revalidate it at the next invoice boundary; an expired, capped, or ineligible
 * code is removed and the athlete's standard annual price is restored.
 */
export async function validateAnnualMembershipRenewalDiscount(pool, {
  stripeSubscriptionId,
  stripe = null,
  now = new Date(),
  collectionLockHeld = false,
} = {}) {
  if (!stripeSubscriptionId) return { status: 'not_applicable' }
  const pricing = await loadAnnualMembershipRenewalPromo(pool, stripeSubscriptionId)
  if (!pricing) return { status: 'not_applicable' }

  const valid = await resolveMembershipFeePromo(pool, {
    facilityId: pricing.facility_id,
    promoCodes: [pricing.promo_code],
    memberId: pricing.member_id,
    familyId: pricing.family_id,
    now,
  })
  if (valid?.rule?.id === pricing.discount_rule_id) {
    return { status: 'valid', pricing }
  }

  if (!collectionLockHeld) {
    return withBillingAccountCollectionLock(
      pool,
      pricing.family_billing_account_id,
      (db) => validateAnnualMembershipRenewalDiscount(db, {
        stripeSubscriptionId,
        stripe,
        now,
        collectionLockHeld: true,
      }),
    )
  }

  const standardAmountCents = Math.max(0, Number(pricing.standard_amount_cents))
  const remoteMutation = await guardLegacyRemoteSubscriptionMutation(pool, {
    accountId: pricing.family_billing_account_id,
    stripeSubscriptionId,
    operation: 'annual-membership-renewal-discount-reset',
  })
  if (!remoteMutation.allowed) {
    const invalidated = await pool.query(
      `UPDATE annual_membership_renewal_pricing
          SET pricing_kind = 'manual_final_price',
              final_amount_cents = $2,
              promo_code = NULL,
              discount_rule_id = NULL,
              discount_rule_snapshot = NULL,
              sync_status = 'not_required',
              sync_error = $3,
              updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [pricing.id, standardAmountCents, remoteMutation.reason],
    ).then((result) => result.rows[0] ?? null)
    await recordBillingActivity(pool, {
      eventKey: `annual-membership-renewal-promo-invalidated:${pricing.id}:local-ledger`,
      accountId: pricing.family_billing_account_id,
      memberId: pricing.member_id,
      eventType: 'annual_membership_remote_collector_quarantined',
      summary: 'Expired annual membership renewal pricing was restored in the household ledger; the stale Stripe collector was quarantined.',
      beforeValue: pricing,
      afterValue: invalidated,
      stripeObjectId: stripeSubscriptionId,
      actorType: 'system',
    })
    return {
      status: 'local_authoritative',
      pricing: invalidated,
      remoteCollectorQuarantined: true,
    }
  }
  const stripeClient = stripe || await getStripeClient()
  if (!stripeClient) {
    await pool.query(
      `UPDATE annual_membership_renewal_pricing
          SET sync_status = 'sync_failed',
              sync_error = 'Discount code is no longer valid; Stripe price reset is pending.',
              updated_at = now()
        WHERE id = $1`,
      [pricing.id],
    )
    return { status: 'sync_failed', pricing }
  }

  const remoteSubscription = await stripeClient.subscriptions.retrieve(stripeSubscriptionId)
  const item = remoteSubscription.items?.data?.[0]
  const product = typeof item?.price?.product === 'string' ? item.price.product : item?.price?.product?.id
  if (!item?.id || !product) throw new Error('Annual membership Stripe subscription has no renewable item.')
  const price = await stripeClient.prices.create({
    product,
    currency: 'usd',
    unit_amount: standardAmountCents,
    recurring: { interval: 'year' },
    metadata: {
      vortex_annual_membership: 'true',
      vortex_fee_id: String(pricing.additional_fee_id),
      vortex_member_id: String(pricing.member_id),
      annual_renewal_pricing: 'standard_price',
    },
  })
  await stripeClient.subscriptions.update(remoteSubscription.id, {
    items: [{ id: item.id, price: price.id }],
    proration_behavior: 'none',
    metadata: {
      ...(remoteSubscription.metadata ?? {}),
      annualRenewalPriceCents: String(standardAmountCents),
      annualRenewalPricingKind: 'standard_price',
      annualRenewalPromoCode: '',
      annualRenewalDiscountRuleId: '',
    },
  })
  const invalidated = await pool.query(
    `UPDATE annual_membership_renewal_pricing
        SET pricing_kind = 'manual_final_price',
            final_amount_cents = $2,
            promo_code = NULL,
            discount_rule_id = NULL,
            discount_rule_snapshot = NULL,
            stripe_subscription_id = $3,
            stripe_subscription_item_id = $4,
            stripe_price_id = $5,
            sync_status = 'synced',
            sync_error = NULL,
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [pricing.id, standardAmountCents, remoteSubscription.id, item.id, price.id],
  ).then((result) => result.rows[0] ?? null)
  await pool.query(
    `UPDATE billing_subscription SET stripe_subscription_item_id = $2, updated_at = now() WHERE id = $1`,
    [pricing.billing_subscription_id, item.id],
  )
  await recordBillingActivity(pool, {
    eventKey: `annual-membership-renewal-promo-invalidated:${pricing.id}:${String(now instanceof Date ? now.toISOString() : now)}`,
    accountId: pricing.family_billing_account_id,
    memberId: pricing.member_id,
    eventType: 'annual_membership_renewal_promo_invalidated',
    summary: `Annual membership discount code ${pricing.promo_code} is no longer valid; the standard renewal price was restored.`,
    beforeValue: pricing,
    afterValue: invalidated,
    stripeObjectId: remoteSubscription.id,
    actorType: 'system',
  })
  return { status: 'invalidated', pricing: invalidated, previousPromoCode: pricing.promo_code }
}

export async function revalidateAnnualMembershipRenewalDiscounts(pool, {
  stripe = null,
  now = new Date(),
} = {}) {
  await ensureAnnualMembershipRenewalPricingSchema(pool)
  const subscriptions = await pool.query(
    `SELECT DISTINCT subscription.stripe_subscription_id
       FROM annual_membership_renewal_pricing pricing
       JOIN billing_subscription subscription
         ON subscription.family_billing_account_id = pricing.family_billing_account_id
        AND subscription.member_id = pricing.member_id
        AND subscription.source_type = 'annual_membership'
        AND subscription.source_id = CONCAT(pricing.additional_fee_id, ':', pricing.member_id)
        AND subscription.status <> 'cancelled'
      WHERE pricing.pricing_kind = 'promo_code'
        AND NULLIF(BTRIM(pricing.promo_code), '') IS NOT NULL
        AND NULLIF(BTRIM(subscription.stripe_subscription_id), '') IS NOT NULL`,
  )
  const stripeClient = stripe || await getStripeClient()
  const results = []
  for (const row of subscriptions.rows) {
    results.push(await validateAnnualMembershipRenewalDiscount(pool, {
      stripeSubscriptionId: row.stripe_subscription_id,
      stripe: stripeClient,
      now,
    }))
  }
  return results
}

export async function recordAnnualMembershipRenewalPromoRedemption(pool, {
  stripeSubscriptionId,
  stripeInvoiceId,
  paidAmountCents,
  paidAt = new Date(),
} = {}) {
  if (!stripeSubscriptionId || !stripeInvoiceId) return null
  const pricing = await loadAnnualMembershipRenewalPromo(pool, stripeSubscriptionId)
  if (!pricing?.discount_rule_id) return null
  const discountCents = Math.max(0, Number(pricing.standard_amount_cents) - Math.max(0, Number(paidAmountCents)))
  if (discountCents <= 0) return null
  const inserted = await pool.query(
    `WITH inserted AS (
       INSERT INTO discount_redemption (
         rule_id, member_id, signup_id, program_id, form_id, kind, units,
         amount_cents, stripe_invoice_id, annual_membership_renewal_pricing_id
       ) VALUES ($1, $2, NULL, NULL, NULL, 'discount', 0, $3, $4, $5)
       ON CONFLICT (stripe_invoice_id, rule_id)
         WHERE stripe_invoice_id IS NOT NULL AND rule_id IS NOT NULL
       DO NOTHING
       RETURNING id, rule_id
     )
     UPDATE discount_rule rule
        SET redeemed_count = rule.redeemed_count + 1,
            updated_at = now()
       FROM inserted
      WHERE rule.id = inserted.rule_id
      RETURNING inserted.id`,
    [pricing.discount_rule_id, pricing.member_id, discountCents, stripeInvoiceId, pricing.id],
  )
  if (!inserted.rows[0]) return { pricing, replayed: true }
  await recordBillingActivity(pool, {
    eventKey: `annual-membership-renewal-promo-redeemed:${stripeInvoiceId}:${pricing.discount_rule_id}`,
    accountId: pricing.family_billing_account_id,
    memberId: pricing.member_id,
    eventType: 'annual_membership_renewal_promo_redeemed',
    summary: `Annual membership discount code ${pricing.promo_code} was applied to a paid renewal.`,
    afterValue: { discountCode: pricing.promo_code, discountCents, paidAt },
    stripeObjectId: stripeInvoiceId,
    actorType: 'stripe',
    occurredAt: paidAt,
  })
  return { pricing, replayed: false, discountCents }
}

/**
 * Financial charges are immutable. A correction posts a linked debit or credit
 * so the audit continues to show both the original bill and its correction.
 */
export async function adjustCustomerBillingCharge(pool, {
  familyId,
  facilityId = null,
  actorUserId = null,
  chargeId,
  finalAmountCents = null,
  promoCode = null,
  appliesTo = 'current_term',
  reason,
  idempotencyKey = null,
}) {
  const account = await ensureCustomerBillingAccount(pool, familyId, facilityId)
  if (!account) throw new Error('Family billing account was not found.')
  await ensureBillingChargeSchema(pool)
  await ensureHouseholdMonthlyInvoiceSchema(pool)
  const charge = await loadCharge(pool, account.id, chargeId)
  if (Number(charge.amount_cents) <= 0 || ['credit', 'refund_offset', 'charge_adjustment'].includes(String(charge.source_type))) {
    throw new Error('Only a positive bill can be modified.')
  }
  const note = String(reason ?? '').trim()
  if (!note) throw new Error('A reason is required when modifying a bill.')
  const scope = String(appliesTo ?? 'current_term').trim()
  if (!['current_term', 'renewals'].includes(scope)) {
    throw new Error('Apply to must be current_term or renewals.')
  }
  const code = String(promoCode ?? '').trim()
  if (code && finalAmountCents != null && finalAmountCents !== '') {
    throw new Error('Choose either a discount code or a manual price, not both.')
  }
  if (!code && (finalAmountCents == null || finalAmountCents === '')) {
    throw new Error('Enter a discount code or a modified bill amount.')
  }

  const feeId = annualMembershipFeeId(charge)
  if (code && feeId == null) throw new Error('Discount codes can only be applied to annual membership fees here.')
  const grossAmount = Math.max(0, Number(charge.gross_amount_cents ?? charge.amount_cents))
  let pricing = {
    kind: 'manual_final_price',
    finalAmountCents: nonNegativeCents(finalAmountCents, 'Modified bill amount'),
    promoCode: null,
    rule: null,
    discountCents: 0,
  }
  if (code) {
    const resolved = await resolveMembershipFeePromo(pool, {
      facilityId,
      promoCodes: [code],
      memberId: charge.member_id,
      familyId: account.family_id,
    })
    if (!resolved) throw new Error('This discount code is not valid for annual membership.')
    const discountCents = membershipPromoDiscountCents(resolved.rule, grossAmount)
    pricing = {
      kind: 'promo_code',
      finalAmountCents: Math.max(0, grossAmount - discountCents),
      promoCode: resolved.code,
      rule: resolved.rule,
      discountCents,
    }
  }

  if (scope === 'renewals') {
    if (feeId == null) throw new Error('Only annual membership fees can be applied to renewals.')
    const renewal = await withBillingAccountCollectionLock(pool, account.id, (db) => (
      configureAnnualMembershipRenewalPricing(db, {
        account,
        charge,
        feeId,
        pricing,
        reason: note,
        actorUserId,
        idempotencyKey,
      })
    ))
    return {
      account,
      charge,
      adjustment: null,
      renewal,
      effectiveAmountCents: Number(charge.amount_cents),
      replayed: false,
    }
  }

  const targetAmount = pricing.finalAmountCents
  return withBillingAccountCollectionLock(pool, account.id, async (db) => {
    let transactionOpen = false
    let result
    try {
      await db.query('BEGIN')
      transactionOpen = true
      const lockedCharge = await db.query(
        `SELECT *
           FROM billing_charge
          WHERE id = $1 AND family_billing_account_id = $2
          FOR UPDATE`,
        [Number(charge.id), Number(account.id)],
      ).then((queryResult) => queryResult.rows[0] ?? null)
      if (!lockedCharge) throw new Error('Custom charge was not found.')
      if (
        Number(lockedCharge.amount_cents) <= 0
        || ['credit', 'refund_offset', 'charge_adjustment'].includes(String(lockedCharge.source_type))
      ) {
        throw new Error('Only a positive bill can be modified.')
      }

      // This reservation check deliberately runs after the account collection
      // lock is acquired and inside the mutation transaction. All collectors use
      // the same lock, so a new invoice/attempt cannot appear after this check.
      const reserved = await db.query(
        `SELECT 1
           FROM billing_monthly_invoice_line line
           JOIN billing_monthly_invoice invoice ON invoice.id = line.billing_monthly_invoice_id
          WHERE line.billing_charge_id = $1
            AND invoice.status IN ('draft', 'open', 'payment_method_required', 'failed')
          UNION ALL
         SELECT 1
           FROM billing_payment_attempt attempt
           LEFT JOIN billing_payment_attempt_charge reservation
             ON reservation.billing_payment_attempt_id = attempt.id
          WHERE attempt.family_billing_account_id = $2
            AND (
              attempt.status IN ('pending', 'processing', 'reconciliation_required')
              OR (attempt.status = 'reserved' AND attempt.expires_at > now())
            )
            AND (
              reservation.billing_charge_id = $1
              OR attempt.target_charge_id = $1
            )
          LIMIT 1`,
        [lockedCharge.id, account.id],
      )
      if (reserved.rows[0]) {
        throw new Error('This bill is reserved by an active collection attempt. Modify it after that collection is resolved.')
      }

      const prior = await db.query(
        `SELECT COALESCE(SUM(amount_cents), 0)::int AS cents
           FROM billing_charge
          WHERE family_billing_account_id = $1
            AND related_charge_id = $2
            AND source_type = 'charge_adjustment'`,
        [account.id, lockedCharge.id],
      )
      const effectiveAmount = Number(lockedCharge.amount_cents) + Number(prior.rows[0]?.cents ?? 0)
      const difference = targetAmount - effectiveAmount
      if (difference === 0) {
        await db.query('COMMIT')
        transactionOpen = false
        return { account, charge: lockedCharge, adjustment: null, effectiveAmountCents: effectiveAmount, replayed: true }
      }

      const requestKey = String(idempotencyKey ?? '').trim()
      const sourceId = `charge:${lockedCharge.id}:${requestKey || randomUUID()}`
      const inserted = await db.query(
        `INSERT INTO billing_charge (
           family_billing_account_id, member_id, source_type, source_id, related_charge_id,
           description, amount_cents, gross_amount_cents, discount_amount_cents,
           charge_type, billing_interval, service_period_start, service_period_end,
           collection_status, created_by_user_id, metadata
         ) VALUES (
           $1, $2, 'charge_adjustment', $3, $4,
           $5, $6, $6, 0,
           $7, 'one_time', $8, $9,
           'none', $10, $11::jsonb
         )
         ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
         RETURNING *`,
        [
          account.id,
          lockedCharge.member_id,
          sourceId,
          lockedCharge.id,
          `${difference < 0 ? 'Credit' : 'Additional amount'} for ${lockedCharge.description}`,
          difference,
          difference < 0 ? 'credit' : 'adjustment',
          lockedCharge.service_period_start,
          lockedCharge.service_period_end,
          actorUserId,
          JSON.stringify({
            originalChargeId: Number(lockedCharge.id),
            originalAmountCents: Number(lockedCharge.amount_cents),
            previousEffectiveAmountCents: effectiveAmount,
            finalAmountCents: targetAmount,
            reason: note,
            ...(pricing.kind === 'promo_code' ? {
              discountCode: pricing.promoCode,
              discountRuleId: pricing.rule?.id ?? null,
              discountAmountCents: pricing.discountCents,
              discountRuleSnapshot: pricing.rule,
            } : {}),
          }),
        ],
      )
      const created = Boolean(inserted.rows[0])
      const adjustment = inserted.rows[0] ?? await db.query(
        `SELECT * FROM billing_charge WHERE source_type = 'charge_adjustment' AND source_id = $1`,
        [sourceId],
      ).then((queryResult) => queryResult.rows[0] ?? null)
      if (!adjustment) throw new Error('Bill adjustment could not be created.')
      if (created && pricing.kind === 'promo_code' && pricing.rule?.id) {
        await recordMembershipPromoRedemption(db, {
          ruleId: pricing.rule.id,
          memberId: lockedCharge.member_id,
          discountCents: pricing.discountCents,
        })
      }

      await recordBillingActivity(db, {
        eventKey: `billing-charge-adjusted:${adjustment.id}`,
        accountId: account.id,
        memberId: lockedCharge.member_id,
        chargeId: lockedCharge.id,
        eventType: 'billing_charge_adjusted',
        summary: `${lockedCharge.description} was modified with a linked ${difference < 0 ? 'credit' : 'debit'}.`,
        beforeValue: { effectiveAmountCents: effectiveAmount },
        afterValue: {
          effectiveAmountCents: targetAmount,
          adjustmentChargeId: Number(adjustment.id),
          adjustmentAmountCents: difference,
          reason: note,
          ...(pricing.kind === 'promo_code' ? { discountCode: pricing.promoCode, discountAmountCents: pricing.discountCents } : {}),
        },
        actorUserId,
        actorType: 'admin',
      })
      await db.query('COMMIT')
      transactionOpen = false
      result = { account, charge: lockedCharge, adjustment, effectiveAmountCents: targetAmount, replayed: false }
    } catch (error) {
      if (transactionOpen) await db.query('ROLLBACK').catch(() => {})
      throw error
    }
    await allocateHouseholdPaymentsLocked(db, {
      accountId: account.id,
      actorUserId,
      actorType: 'admin',
    })
    return result
  })
}

function assertCustomCharge(charge) {
  if (charge.source_type !== 'manual' || Number(charge.amount_cents) <= 0) {
    throw new Error('Only a positive custom ledger charge can use exact-amount collection.')
  }
}

function assertCollectibleCustomCharge(charge) {
  assertCustomCharge(charge)
  if (charge.collection_status === 'paid') {
    throw new Error('This custom charge has already been paid.')
  }
}

function parsePersistedStripeCreateRequest(value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value && typeof value === 'object' ? value : null
}

async function persistStripeCheckoutCreateRequest(db, attemptId, requestParams) {
  const requested = {
    version: 1,
    object: 'checkout.session',
    params: requestParams,
  }
  const result = await db.query(
    `UPDATE billing_payment_attempt
        SET metadata = CASE
              WHEN jsonb_typeof(COALESCE(metadata, '{}'::jsonb)->'stripeCreateRequest') = 'object'
                THEN metadata
              ELSE jsonb_set(
                COALESCE(metadata, '{}'::jsonb),
                '{stripeCreateRequest}',
                $2::jsonb,
                true
              )
            END,
            updated_at = now()
      WHERE id = $1
      RETURNING metadata->'stripeCreateRequest' AS stripe_create_request`,
    [Number(attemptId), JSON.stringify(requested)],
  )
  const persisted = parsePersistedStripeCreateRequest(result.rows[0]?.stripe_create_request)
  if (
    persisted?.version !== 1
    || persisted?.object !== 'checkout.session'
    || !persisted.params
    || typeof persisted.params !== 'object'
  ) {
    throw new Error('The persisted Stripe Checkout request is invalid.')
  }
  return persisted.params
}

function checkoutExpirationSeconds(attempt) {
  const expirationMs = new Date(attempt?.expires_at ?? 0).getTime()
  if (!Number.isFinite(expirationMs)) throw new Error('Payment attempt expiration is invalid.')
  return Math.floor(expirationMs / 1000)
}

/**
 * Persist the complete Stripe request before crossing the network boundary. A
 * retry after Stripe created the Session but before local attachment must send
 * byte-for-byte-equivalent values with the same idempotency key.
 */
export async function createOrRecoverBillingCheckoutSession(db, stripe, {
  attempt,
  requestParams,
  attachAttempt = attachBillingPaymentAttemptStripeObject,
}) {
  const params = await persistStripeCheckoutCreateRequest(db, attempt.id, requestParams)
  const idempotencyKey = `billing-payment-attempt:${attempt.id}:checkout`
  await markBillingPaymentAttemptRemotePending(db, attempt.id)
  const session = await stripe.checkout.sessions.create(params, { idempotencyKey })
  const expiresAt = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : new Date(Number(params.expires_at) * 1000).toISOString()
  await attachAttempt(db, {
    attemptId: attempt.id,
    checkoutSessionId: session.id,
    checkoutUrl: session.url,
    status: 'pending',
    expiresAt,
  })
  return { session, expiresAt, params, idempotencyKey }
}

export async function checkoutAmountForBillingCharge(pool, { account, charge, requireManualCharge }) {
  if (requireManualCharge) assertCollectibleCustomCharge(charge)
  else if (!charge || Number(charge.amount_cents) <= 0) {
    throw new Error('Only a positive outstanding bill can receive a payment request.')
  }
  await ensureHouseholdMonthlyInvoiceSchema(pool)
  const result = await pool.query(
    `SELECT
       GREATEST(0,
         charge.amount_cents
         + COALESCE((
           SELECT SUM(adjustment.amount_cents)
           FROM billing_charge adjustment
           WHERE adjustment.related_charge_id = charge.id
             AND adjustment.source_type IN ('charge_adjustment', 'refund_offset')
         ), 0)
         - COALESCE((
           SELECT SUM(application.amount_cents)
             FROM billing_charge_credit_application application
             JOIN billing_monthly_invoice_line target_line
               ON target_line.id = application.target_invoice_line_id
             JOIN billing_monthly_invoice_line credit_line
               ON credit_line.id = application.credit_invoice_line_id
             JOIN billing_charge credit_source
               ON credit_source.id = credit_line.billing_charge_id
            WHERE target_line.billing_charge_id = charge.id
              AND NOT (
                credit_source.related_charge_id = charge.id
                AND credit_source.source_type IN ('charge_adjustment', 'refund_offset')
              )
         ), 0)
         - COALESCE((
           SELECT SUM(CASE WHEN application.application_kind = 'reversal' THEN -application.amount_cents ELSE application.amount_cents END)
           FROM billing_payment_application application
           JOIN billing_payment payment ON payment.id = application.billing_payment_id
           WHERE application.billing_charge_id = charge.id
             AND payment.external_status IN ('settled', 'succeeded')
         ), 0)
       )::int AS amount_cents,
       EXISTS (
         SELECT 1
         FROM billing_monthly_invoice_line line
         JOIN billing_monthly_invoice invoice ON invoice.id = line.billing_monthly_invoice_id
         WHERE line.billing_charge_id = charge.id
           AND invoice.status = ANY($2::text[])
       ) AS reserved_on_monthly_invoice`,
    [charge.id, HOUSEHOLD_INVOICE_RESERVING_STATUSES],
  )
  if (result.rows[0]?.reserved_on_monthly_invoice) {
    throw new Error('This bill is already included in a household monthly invoice and cannot receive a separate payment request.')
  }
  const amountCents = Number(result.rows[0]?.amount_cents ?? 0)
  if (amountCents <= 0) throw new Error('This bill is already paid or fully credited.')
  return amountCents
}

async function createBillingChargeCheckoutSession(pool, {
  account,
  charge,
  successUrl,
  cancelUrl,
  actorUserId = null,
  attemptKey = null,
  requireManualCharge = false,
  checkoutType = 'custom_charge',
  eventType = 'custom_charge_checkout_created',
}) {
  if (!stripeEnabled()) throw new Error('Stripe is not enabled.')
  const stripe = await getStripeClient()
  if (!stripe) throw new Error('Stripe is unavailable.')
  const requestKey = String(attemptKey || randomUUID())
  return withBillingAccountCollectionLock(pool, account.id, async (db) => {
    const existing = await loadBillingPaymentAttemptByRequestKey(db, {
      accountId: account.id,
      attemptType: 'charge_checkout',
      requestKey,
    })
    if (existing?.status === 'succeeded') {
      return { id: existing.stripe_checkout_session_id, url: null, amountCents: existing.amount_cents, expiresAt: existing.expires_at, replayed: true, status: 'succeeded' }
    }
    if (existing?.status === 'pending' && existing.stripe_checkout_session_id && existing.stripe_checkout_url) {
      return { id: existing.stripe_checkout_session_id, url: existing.stripe_checkout_url, amountCents: existing.amount_cents, expiresAt: existing.expires_at, replayed: true }
    }
    if (existing && ['failed', 'expired', 'canceled'].includes(existing.status)) {
      throw new Error(`This payment attempt is ${existing.status}; start a new request.`)
    }

    const amountCents = existing?.amount_cents
      ?? await checkoutAmountForBillingCharge(db, { account, charge, requireManualCharge })
    const expiration = existing?.expires_at
      ? new Date(existing.expires_at)
      : new Date(Date.now() + 24 * 60 * 60 * 1000)
    const reservation = existing ?? await reserveBillingPaymentAttempt(db, {
      accountId: account.id,
      attemptType: 'charge_checkout',
      requestKey,
      amountCents,
      targetChargeId: charge.id,
      expiresAt: expiration,
      metadata: { checkoutType, actorUserId },
    })
    let customerId
    try {
      customerId = await ensureStripeCustomer(db, stripe, account)
    } catch (error) {
      await releaseBillingPaymentAttempt(db, {
        attemptId: reservation.id,
        status: 'failed',
        reason: `Stripe Checkout creation was not started: ${error?.message ?? String(error)}`,
        remoteCreationDefinitelyNotStarted: true,
      }).catch(() => {})
      throw error
    }
    const metadata = {
      checkoutType,
      familyBillingAccountId: String(account.id),
      billingChargeId: String(charge.id),
      billingPaymentAttemptId: String(reservation.id),
    }
    const requestParams = {
      mode: 'payment',
      customer: customerId,
      client_reference_id: `billing-charge:${charge.id}`,
      expires_at: checkoutExpirationSeconds(reservation),
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: { name: String(charge.description).slice(0, 127) },
        },
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      payment_intent_data: { metadata },
    }
    let created
    try {
      created = await createOrRecoverBillingCheckoutSession(db, stripe, {
        attempt: reservation,
        requestParams,
      })
    } catch (error) {
      await attachBillingPaymentAttemptStripeObject(db, {
        attemptId: reservation.id,
        status: 'reconciliation_required',
      }).catch(() => {})
      throw error
    }
    const { session, expiresAt } = created
    await db.query(
      `UPDATE billing_charge
       SET collection_status = 'checkout_pending', stripe_checkout_session_id = $2
       WHERE id = $1`,
      [charge.id, session.id],
    )
    await recordBillingActivity(db, {
      eventKey: `billing-charge-checkout:${charge.id}:${session.id}`,
      accountId: account.id,
      memberId: charge.member_id,
      chargeId: charge.id,
      eventType,
      summary: `Secure payment link created for ${charge.description}.`,
      details: { amountCents, expiresAt, billingPaymentAttemptId: reservation.id },
      stripeObjectId: session.id,
      actorUserId,
    })
    return { id: session.id, url: session.url, amountCents, expiresAt, replayed: reservation.replayed }
  })
}

/** Create one account-balance Checkout Session backed by exact charge reservations. */
export async function createCustomerBalanceCheckoutSession(pool, {
  account,
  successUrl,
  cancelUrl,
  analytics = null,
  idempotencyKey = null,
  attemptType = 'member_balance_checkout',
}) {
  if (!stripeEnabled()) throw new Error('Stripe is not enabled.')
  const stripe = await getStripeClient()
  if (!stripe) throw new Error('Stripe is unavailable.')
  const requestKey = String(idempotencyKey || randomUUID())
  return withBillingAccountCollectionLock(pool, account.id, async (db) => {
    const existing = await loadBillingPaymentAttemptByRequestKey(db, {
      accountId: account.id,
      attemptType,
      requestKey,
    })
    if (existing?.status === 'succeeded') {
      return { id: existing.stripe_checkout_session_id, url: null, amountCents: existing.amount_cents, expiresAt: existing.expires_at, replayed: true, status: 'succeeded' }
    }
    if (existing?.status === 'pending' && existing.stripe_checkout_session_id && existing.stripe_checkout_url) {
      return { id: existing.stripe_checkout_session_id, url: existing.stripe_checkout_url, amountCents: existing.amount_cents, expiresAt: existing.expires_at, replayed: true }
    }
    if (existing && ['failed', 'expired', 'canceled'].includes(existing.status)) {
      throw new Error(`This payment attempt is ${existing.status}; start a new request.`)
    }
    const amountCents = existing?.amount_cents ?? await loadCanonicalCollectibleBalanceCents(db, account.id)
    if (amountCents <= 0) throw new Error('This account has no unpaid balance.')
    const expiration = existing?.expires_at
      ? new Date(existing.expires_at)
      : new Date(Date.now() + 24 * 60 * 60 * 1000)
    const reservation = existing ?? await reserveBillingPaymentAttempt(db, {
      accountId: account.id,
      attemptType,
      requestKey,
      amountCents,
      expiresAt: expiration,
      metadata: { checkoutType: 'outstanding_balance' },
    })
    let customerId
    try {
      customerId = await ensureStripeCustomer(db, stripe, account)
    } catch (error) {
      await releaseBillingPaymentAttempt(db, {
        attemptId: reservation.id,
        status: 'failed',
        reason: `Stripe Checkout creation was not started: ${error?.message ?? String(error)}`,
        remoteCreationDefinitelyNotStarted: true,
      }).catch(() => {})
      throw error
    }
    const params = buildBalanceCheckoutParams({
      account,
      customerId,
      balanceCents: amountCents,
      successUrl,
      cancelUrl,
      analytics,
      nowMs: expiration.getTime() - 24 * 60 * 60 * 1000,
    })
    params.expires_at = checkoutExpirationSeconds(reservation)
    const metadata = {
      ...params.metadata,
      checkoutType: 'outstanding_balance',
      billingPaymentAttemptId: String(reservation.id),
    }
    params.metadata = metadata
    params.payment_intent_data = { metadata }
    let created
    try {
      created = await createOrRecoverBillingCheckoutSession(db, stripe, {
        attempt: reservation,
        requestParams: params,
      })
    } catch (error) {
      await attachBillingPaymentAttemptStripeObject(db, {
        attemptId: reservation.id,
        status: 'reconciliation_required',
      }).catch(() => {})
      throw error
    }
    const { session, expiresAt } = created
    return { id: session.id, url: session.url, amountCents, expiresAt, replayed: reservation.replayed }
  })
}

export async function createCustomerBillingCustomCharge(pool, {
  familyId,
  facilityId = null,
  actorUserId,
  memberId = null,
  description,
  amountCents,
  servicePeriodStart = null,
  servicePeriodEnd = null,
  collectionMethod = 'checkout',
  idempotencyKey = null,
}) {
  const account = await ensureCustomerBillingAccount(pool, familyId, facilityId)
  if (!account) throw new Error('Family billing account was not found.')
  const scopedMemberId = await validateMemberScope(pool, account, memberId)
  const amount = positiveCents(amountCents)
  const label = String(description ?? '').trim()
  if (!label) throw new Error('A custom charge description is required.')
  if (!['checkout', 'saved_card', 'ledger_only'].includes(collectionMethod)) {
    throw new Error('Collection method must be checkout, saved_card, or ledger_only.')
  }
  const periodStart = optionalDate(servicePeriodStart, 'Service period start')
  const periodEnd = optionalDate(servicePeriodEnd, 'Service period end')
  if (periodStart && periodEnd && periodEnd < periodStart) {
    throw new Error('Service period end cannot be before its start.')
  }
  const requestKey = String(idempotencyKey ?? '').trim()
  const sourceId = `custom:${requestKey || randomUUID()}`
  const result = await pool.query(
    `INSERT INTO billing_charge (
       family_billing_account_id, member_id, source_type, source_id,
       description, amount_cents, gross_amount_cents, discount_amount_cents,
       charge_type, billing_interval, service_period_start, service_period_end,
       collection_status, created_by_user_id, metadata
     ) VALUES (
       $1, $2, 'manual', $3, $4, $5, $5, 0, 'one_time', 'one_time',
       $6, $7, 'unpaid', $8, $9::jsonb
     )
     ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
     RETURNING *`,
    [
      account.id,
      scopedMemberId,
      sourceId,
      label,
      amount,
      periodStart,
      periodEnd,
      actorUserId,
      JSON.stringify({ collectionMethod }),
    ],
  )
  let charge = result.rows[0]
  const created = Boolean(charge)
  if (!charge) {
    charge = await pool.query(
      `SELECT * FROM billing_charge
       WHERE family_billing_account_id = $1 AND source_type = 'manual' AND source_id = $2`,
      [account.id, sourceId],
    ).then((lookup) => lookup.rows[0] ?? null)
    if (!charge) throw new Error('The custom-charge request key is already in use by another account.')
    const sameRequest =
      Number(charge.member_id ?? 0) === Number(scopedMemberId ?? 0) &&
      Number(charge.amount_cents) === amount &&
      String(charge.description) === label &&
      String(charge.service_period_start ?? '').slice(0, 10) === String(periodStart ?? '').slice(0, 10) &&
      String(charge.service_period_end ?? '').slice(0, 10) === String(periodEnd ?? '').slice(0, 10)
    if (!sameRequest) throw new Error('The custom-charge request key was reused with different charge details.')
  }
  if (created) {
    await recordBillingActivity(pool, {
      eventKey: `custom-charge-created:${charge.id}`,
      accountId: account.id,
      memberId: scopedMemberId,
      chargeId: charge.id,
      eventType: 'custom_charge_created',
      summary: `Custom charge created: ${label}.`,
      afterValue: {
        chargeId: Number(charge.id),
        amountCents: amount,
        servicePeriodStart: periodStart,
        servicePeriodEnd: periodEnd,
        collectionMethod,
      },
      actorUserId,
    })
    if (collectionMethod === 'ledger_only') {
      await allocateHouseholdPayments(pool, { accountId: account.id, actorType: 'admin' })
    }
  }
  return { account, charge, created }
}

export async function createCustomChargeCheckoutSession(pool, {
  account,
  charge,
  successUrl,
  cancelUrl,
  actorUserId = null,
  attemptKey = null,
}) {
  return createBillingChargeCheckoutSession(pool, {
    account,
    charge,
    successUrl,
    cancelUrl,
    actorUserId,
    attemptKey,
    requireManualCharge: true,
    checkoutType: 'custom_charge',
    eventType: 'custom_charge_checkout_created',
  })
}

/** Send a hosted exact-balance request for any eligible positive ledger bill. */
export async function createCustomerBillingChargePaymentRequest(pool, options) {
  return createBillingChargeCheckoutSession(pool, {
    ...options,
    requireManualCharge: false,
    checkoutType: 'billing_charge_payment_request',
    eventType: 'billing_charge_payment_request_created',
  })
}

export async function resolveDefaultPaymentMethod(stripe, customerId, {
  billingMonth = new Date(),
} = {}) {
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ['invoice_settings.default_payment_method'],
  })
  if (!customer || customer.deleted) throw new Error('Stripe customer is unavailable.')
  const selection = await selectStripeCustomerPaymentMethod(stripe, customer, {
    expectedCustomerId: customerId,
    billingMonth,
  })
  if (!selection.readiness.ready || !selection.readiness.paymentMethodId) {
    const reason = selection.readiness.reason ?? 'payment_method_required'
    const error = new Error(`No eligible default Stripe payment method is available for this household (${reason}).`)
    error.code = 'STRIPE_PAYMENT_METHOD_NOT_READY'
    error.paymentMethodReadinessReason = reason
    throw error
  }
  return selection.readiness.paymentMethodId
}

function validateAuthorization(authorization, amountCents) {
  const source = String(authorization?.source ?? '').trim()
  const note = String(authorization?.note ?? '').trim()
  const date = String(authorization?.date ?? '').slice(0, 10)
  if (!source || !note || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Authorization source, date, and note are required for a saved-card charge.')
  }
  if (authorization?.confirmedAmountCents !== amountCents || authorization?.confirmed !== true) {
    throw new Error('The exact saved-card charge amount must be confirmed for this attempt.')
  }
  return { source, note, date }
}

export class SavedCardCollectionError extends Error {
  constructor(message, { fallback = null, stripeStatus = null } = {}) {
    super(message)
    this.name = 'SavedCardCollectionError'
    this.fallback = fallback
    this.stripeStatus = stripeStatus
  }
}

async function retrieveVerifiedCanceledPaymentIntent(stripe, intent) {
  const paymentIntentId = typeof intent === 'string' ? intent : intent?.id
  if (!paymentIntentId || typeof stripe?.paymentIntents?.retrieve !== 'function') return null
  try {
    const verified = await stripe.paymentIntents.retrieve(paymentIntentId)
    return paymentIntentFailureIsFinal(verified) ? verified : null
  } catch {
    // A retrieval failure is not terminal proof. Keep the reservation so a
    // delayed success cannot race a replacement collector.
    return null
  }
}

/** Collect only the balance not already reserved by a household invoice. */
export async function collectOutstandingBalanceWithSavedCard(pool, {
  account,
  amountCents = null,
  authorization,
  actorUserId = null,
  attemptKey = null,
}) {
  if (!stripeEnabled()) throw new Error('Stripe is not enabled.')
  const stripe = await getStripeClient()
  if (!stripe) throw new Error('Stripe is unavailable.')
  const requestKey = String(attemptKey || randomUUID())
  return withBillingAccountCollectionLock(pool, account.id, async (db) => {
    const existing = await loadBillingPaymentAttemptByRequestKey(db, {
      accountId: account.id,
      attemptType: 'admin_balance_saved_card',
      requestKey,
    })
    if (existing?.status === 'succeeded' && existing.billing_payment_id) {
      const payment = await db.query(`SELECT * FROM billing_payment WHERE id = $1`, [existing.billing_payment_id])
        .then((result) => result.rows[0] ?? null)
      return { payment, amountCents: existing.amount_cents, replayed: true }
    }
    if (existing && ['failed', 'expired', 'canceled'].includes(existing.status)) {
      throw new Error(`This payment attempt is ${existing.status}; start a new request.`)
    }
    const availableCents = existing?.amount_cents ?? await loadCanonicalCollectibleBalanceCents(db, account.id)
    const amount = amountCents == null ? availableCents : positiveCents(amountCents, 'Collection amount')
    if (existing && amount !== existing.amount_cents) {
      throw new Error('Payment idempotency key was reused with a different amount.')
    }
    if (availableCents <= 0) throw new Error('This account has no unpaid balance.')
    if (!existing && amount > availableCents) throw new Error('The collection amount cannot exceed the current account balance.')
    const auth = validateAuthorization(authorization, amount)
    const reservation = existing ?? await reserveBillingPaymentAttempt(db, {
      accountId: account.id,
      attemptType: 'admin_balance_saved_card',
      requestKey,
      amountCents: amount,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      metadata: { authorization: auth, actorUserId },
    })
    let customerId
    let paymentMethodId
    try {
      customerId = await ensureStripeCustomer(db, stripe, account)
      paymentMethodId = await resolveDefaultPaymentMethod(stripe, customerId, { billingMonth: auth.date })
    } catch (error) {
      await releaseBillingPaymentAttempt(db, {
        attemptId: reservation.id,
        status: 'failed',
        reason: `Stripe PaymentIntent creation was not started: ${error?.message ?? String(error)}`,
        remoteCreationDefinitelyNotStarted: true,
      }).catch(() => {})
      throw error
    }
    await recordBillingActivity(db, {
      eventKey: `outstanding-balance-attempt:${account.id}:${reservation.id}`,
      accountId: account.id,
      eventType: 'outstanding_balance_payment_attempted',
      summary: 'Saved card collection attempted for the prior-month balance.',
      details: { amountCents: amount, authorization: auth, billingPaymentAttemptId: reservation.id },
      actorUserId,
    })
    await markBillingPaymentAttemptRemotePending(db, reservation.id)
    let succeededIntent = null
    try {
      const intent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: 'Vortex Athletics account balance',
        metadata: {
          checkoutType: 'outstanding_balance',
          familyBillingAccountId: String(account.id),
          billingPaymentAttemptId: String(reservation.id),
          authorizationDate: auth.date,
          authorizationSource: auth.source.slice(0, 100),
        },
      }, { idempotencyKey: `billing-payment-attempt:${reservation.id}:intent` })
      await attachBillingPaymentAttemptStripeObject(db, {
        attemptId: reservation.id,
        paymentIntentId: intent.id,
        status: intent.status === 'succeeded' ? 'processing' : 'reconciliation_required',
      })
      if (intent.status !== 'succeeded') {
        throw Object.assign(new Error(`Stripe payment requires additional action (${intent.status}).`), {
          payment_intent: intent,
        })
      }
      succeededIntent = intent
      const settlement = await recordAndCompleteBillingPaymentAttempt(db, {
        stripeObject: intent,
        paymentIntentId: intent.id,
        amountCents: intent.amount_received || intent.amount,
        customerId,
      })
      if (settlement?.conflicted) {
        throw new Error(`Stripe payment settlement requires reconciliation: ${settlement.reason}`)
      }
      const payment = settlement?.payment
      if (!payment?.id) throw new Error('The successful Stripe payment was not recorded locally.')
      await allocateHouseholdPayments(db, { accountId: account.id, actorType: 'system' })
      await recordBillingActivity(db, {
        eventKey: `outstanding-balance-paid:${account.id}:${intent.id}`,
        accountId: account.id,
        paymentId: payment.id,
        eventType: 'outstanding_balance_payment_succeeded',
        summary: 'Saved card payment collected for the prior-month balance.',
        details: { amountCents: amount, billingPaymentAttemptId: reservation.id },
        stripeObjectId: intent.id,
        actorUserId,
      })
      return { payment, amountCents: amount, replayed: reservation.replayed }
    } catch (error) {
      const intent = error?.payment_intent ?? error?.raw?.payment_intent ?? null
      const canceledIntent = await retrieveVerifiedCanceledPaymentIntent(stripe, intent)
      const finalFailure = Boolean(canceledIntent)
      if (finalFailure) {
        await releaseBillingPaymentAttempt(db, {
          attemptId: reservation.id,
          stripeObject: canceledIntent,
          status: 'canceled',
          reason: error?.message ?? String(error),
        }).catch(() => {})
      } else {
        await attachBillingPaymentAttemptStripeObject(db, {
          attemptId: reservation.id,
          paymentIntentId: intent?.id ?? succeededIntent?.id ?? null,
          status: 'reconciliation_required',
        }).catch(() => {})
      }
      await recordBillingActivity(db, {
        eventKey: `outstanding-balance-failed:${account.id}:${reservation.id}`,
        accountId: account.id,
        eventType: succeededIntent ? 'outstanding_balance_payment_reconciliation_required' : 'outstanding_balance_payment_failed',
        summary: succeededIntent
          ? 'Stripe accepted the saved-card balance payment, but local reconciliation is required.'
          : 'Saved card payment failed for the prior-month balance.',
        details: { amountCents: amount, reason: error?.message ?? String(error), billingPaymentAttemptId: reservation.id },
        stripeObjectId: intent?.id ?? succeededIntent?.id ?? null,
        actorUserId,
      }).catch(() => {})
      if (succeededIntent) {
        throw new SavedCardCollectionError(
          'Stripe accepted this balance payment, but local recording is still reconciling. Do not retry.',
          { stripeStatus: 'succeeded' },
        )
      }
      throw error
    }
  })
}

export async function collectCustomChargeWithSavedCard(pool, {
  account,
  charge,
  authorization,
  successUrl,
  cancelUrl,
  actorUserId,
  attemptKey = null,
}) {
  assertCustomCharge(charge)
  if (!stripeEnabled()) throw new Error('Stripe is not enabled.')
  const stripe = await getStripeClient()
  if (!stripe) throw new Error('Stripe is unavailable.')
  const requestKey = String(attemptKey || randomUUID())
  return withBillingAccountCollectionLock(pool, account.id, async (db) => {
    const currentCharge = await loadCharge(db, account.id, charge.id)
    if (currentCharge.collection_status === 'paid') {
      const payment = await db.query(
        `SELECT payment.*
         FROM billing_payment_application application
         JOIN billing_payment payment ON payment.id = application.billing_payment_id
         WHERE application.billing_charge_id = $1
           AND payment.external_status IN ('settled', 'succeeded')
         ORDER BY payment.id LIMIT 1`,
        [currentCharge.id],
      ).then((result) => result.rows[0] ?? null)
      if (!payment) throw new Error('This charge is marked paid but its payment application needs reconciliation.')
      return { intent: null, payment, replayed: true }
    }
    assertCollectibleCustomCharge(currentCharge)
    const existing = await loadBillingPaymentAttemptByRequestKey(db, {
      accountId: account.id,
      attemptType: 'charge_saved_card',
      requestKey,
    })
    if (existing?.status === 'succeeded' && existing.billing_payment_id) {
      const payment = await db.query(`SELECT * FROM billing_payment WHERE id = $1`, [existing.billing_payment_id])
        .then((result) => result.rows[0] ?? null)
      return { intent: null, payment, replayed: true }
    }
    if (existing && ['failed', 'expired', 'canceled'].includes(existing.status)) {
      throw new Error(`This payment attempt is ${existing.status}; start a new request.`)
    }
    const amountCents = existing?.amount_cents
      ?? await checkoutAmountForBillingCharge(db, { account, charge: currentCharge, requireManualCharge: true })
    const auth = validateAuthorization(authorization, amountCents)
    const reservation = existing ?? await reserveBillingPaymentAttempt(db, {
      accountId: account.id,
      attemptType: 'charge_saved_card',
      requestKey,
      amountCents,
      targetChargeId: currentCharge.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      metadata: { authorization: auth, actorUserId },
    })
    let customerId
    let paymentMethodId
    try {
      customerId = await ensureStripeCustomer(db, stripe, account)
      paymentMethodId = await resolveDefaultPaymentMethod(stripe, customerId, { billingMonth: auth.date })
    } catch (error) {
      await releaseBillingPaymentAttempt(db, {
        attemptId: reservation.id,
        status: 'failed',
        reason: `Stripe PaymentIntent creation was not started: ${error?.message ?? String(error)}`,
        remoteCreationDefinitelyNotStarted: true,
      }).catch(() => {})
      throw error
    }
    await db.query(
      `UPDATE billing_charge
       SET collection_status = 'processing', authorization_source = $2,
           authorization_date = $3, authorization_note = $4
       WHERE id = $1`,
      [currentCharge.id, auth.source, auth.date, auth.note],
    )
    await recordBillingActivity(db, {
      eventKey: `saved-card-attempt:${currentCharge.id}:${reservation.id}`,
      accountId: account.id,
      memberId: currentCharge.member_id,
      chargeId: currentCharge.id,
      eventType: 'saved_card_payment_attempted',
      summary: `Saved card charge attempted for ${currentCharge.description}.`,
      details: { amountCents, authorization: auth, billingPaymentAttemptId: reservation.id },
      actorUserId,
    })
    await markBillingPaymentAttemptRemotePending(db, reservation.id)
    let succeededIntent = null
    try {
      const intent = await stripe.paymentIntents.create(
        {
          amount: amountCents,
          currency: 'usd',
          customer: customerId,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
          description: String(currentCharge.description).slice(0, 500),
          metadata: {
            checkoutType: 'custom_charge',
            familyBillingAccountId: String(account.id),
            billingChargeId: String(currentCharge.id),
            billingPaymentAttemptId: String(reservation.id),
            authorizationDate: auth.date,
            authorizationSource: auth.source.slice(0, 100),
          },
        },
        { idempotencyKey: `billing-payment-attempt:${reservation.id}:intent` },
      )
      await attachBillingPaymentAttemptStripeObject(db, {
        attemptId: reservation.id,
        paymentIntentId: intent.id,
        status: intent.status === 'succeeded' ? 'processing' : 'reconciliation_required',
      })
      if (intent.status !== 'succeeded') {
        throw Object.assign(new Error(`Stripe payment requires additional action (${intent.status}).`), {
          payment_intent: intent,
        })
      }
      succeededIntent = intent
      const settlement = await recordAndCompleteBillingPaymentAttempt(db, {
        stripeObject: intent,
        paymentIntentId: intent.id,
        amountCents: intent.amount_received || intent.amount,
        customerId,
      })
      if (settlement?.conflicted) {
        throw new Error(`Stripe payment settlement requires reconciliation: ${settlement.reason}`)
      }
      const payment = settlement?.payment
      if (!payment?.id) throw new Error('The successful Stripe payment was not recorded locally.')
      await allocateHouseholdPayments(db, { accountId: account.id, actorType: 'system' })
      await recordBillingActivity(db, {
        eventKey: `custom-charge-paid:${currentCharge.id}:${payment.id}`,
        accountId: account.id,
        memberId: currentCharge.member_id,
        chargeId: currentCharge.id,
        paymentId: payment.id,
        eventType: 'custom_charge_paid',
        summary: `Payment received for ${currentCharge.description}.`,
        afterValue: { paymentId: Number(payment.id), amountCents },
        stripeObjectId: intent.id,
        actorType: 'system',
      })
      return { intent, payment, replayed: reservation.replayed }
    } catch (error) {
      const intent = error?.payment_intent ?? error?.raw?.payment_intent ?? null
      const canceledIntent = await retrieveVerifiedCanceledPaymentIntent(stripe, intent)
      const finalFailure = Boolean(canceledIntent)
      if (finalFailure) {
        await releaseBillingPaymentAttempt(db, {
          attemptId: reservation.id,
          stripeObject: canceledIntent,
          status: 'canceled',
          reason: error?.message ?? String(error),
        }).catch(() => {})
      } else {
        await attachBillingPaymentAttemptStripeObject(db, {
          attemptId: reservation.id,
          paymentIntentId: intent?.id ?? succeededIntent?.id ?? null,
          status: 'reconciliation_required',
        }).catch(() => {})
      }
      await db.query(
        `UPDATE billing_charge charge
         SET collection_status = CASE
               WHEN charge.collection_status = 'paid'
                 OR COALESCE((
                   SELECT SUM(CASE
                     WHEN application.application_kind = 'reversal' THEN -application.amount_cents
                     ELSE application.amount_cents
                   END)
                   FROM billing_payment_application application
                   JOIN billing_payment payment ON payment.id = application.billing_payment_id
                   WHERE application.billing_charge_id = charge.id
                     AND payment.external_status IN ('settled', 'succeeded')
                 ), 0) >= GREATEST(0, charge.amount_cents + COALESCE((
                   SELECT SUM(adjustment.amount_cents)
                   FROM billing_charge adjustment
                   WHERE adjustment.related_charge_id = charge.id
                     AND adjustment.source_type IN ('charge_adjustment', 'refund_offset')
                 ), 0)) THEN 'paid'
               ELSE $2
             END,
             stripe_payment_intent_id = COALESCE($3, charge.stripe_payment_intent_id)
         WHERE charge.id = $1`,
        [currentCharge.id, finalFailure ? 'failed' : 'processing', intent?.id ?? succeededIntent?.id ?? null],
      ).catch(() => {})
      if (succeededIntent) {
        await db.query(
          `INSERT INTO stripe_billing_alert (
             family_billing_account_id, alert_type, severity, stripe_object_id, message, details
           ) VALUES ($1, 'custom_charge_reconciliation', 'critical', $2, $3, $4::jsonb)`,
          [
            account.id,
            succeededIntent.id,
            `Successful Stripe payment needs reconciliation for ${currentCharge.description}.`,
            JSON.stringify({ chargeId: Number(currentCharge.id), amountCents, billingPaymentAttemptId: reservation.id, reason: error?.message ?? String(error) }),
          ],
        ).catch(() => {})
      }
      await recordBillingActivity(db, {
        eventKey: `${succeededIntent ? 'saved-card-reconciliation' : 'saved-card-failed'}:${currentCharge.id}:${reservation.id}`,
        accountId: account.id,
        memberId: currentCharge.member_id,
        chargeId: currentCharge.id,
        eventType: succeededIntent ? 'saved_card_payment_reconciliation_required' : 'saved_card_payment_failed',
        summary: succeededIntent
          ? `Stripe accepted the saved-card charge for ${currentCharge.description}, but local reconciliation is required.`
          : `Saved card charge failed for ${currentCharge.description}.`,
        details: { amountCents, reason: error?.message ?? String(error), billingPaymentAttemptId: reservation.id },
        stripeObjectId: intent?.id ?? succeededIntent?.id ?? null,
        actorUserId,
      }).catch(() => {})
      if (!finalFailure) {
        throw new SavedCardCollectionError(
          succeededIntent
            ? 'Stripe accepted this card payment, but local recording is still reconciling. Do not retry or send a fallback link.'
            : 'This card attempt has an unresolved Stripe status. Do not retry or send a fallback link.',
          { fallback: null, stripeStatus: intent?.status ?? succeededIntent?.status ?? null },
        )
      }
      let fallback = null
      try {
        fallback = await createCustomChargeCheckoutSession(db, {
          account,
          charge: currentCharge,
          successUrl,
          cancelUrl,
          actorUserId,
          attemptKey: attemptKey ? `${attemptKey}-fallback` : null,
        })
      } catch {
        // The immutable charge remains outstanding if a fallback cannot be created.
      }
      throw new SavedCardCollectionError(
        error?.message ?? 'Saved card charge failed; the amount remains due.',
        { fallback, stripeStatus: intent?.status ?? null },
      )
    }
  })
}

export async function linkCustomerBillingPayment(pool, {
  payment,
  chargeId,
  accountId,
  stripeObjectId = null,
  actorType = 'stripe',
}) {
  if (!payment?.id || !chargeId || !accountId) return null
  const charge = await loadCharge(pool, accountId, chargeId)
  if (Number(payment.family_billing_account_id) !== Number(accountId)) {
    throw new Error('Payment and custom charge belong to different billing accounts.')
  }
  const amount = Number(payment.amount_cents)
  if (amount !== Number(charge.amount_cents)) {
    throw new Error('Payment amount does not exactly match the custom charge.')
  }
  const application = await applyExactPayment(pool, {
    accountId,
    paymentId: payment.id,
    chargeId: charge.id,
    amountCents: amount,
    actorType,
  })
  if (!application || Number(application.billing_payment_id) !== Number(payment.id)) {
    throw new Error('Custom charge is already linked to a different payment.')
  }
  await pool.query(
    `UPDATE billing_charge
     SET collection_status = 'paid',
         stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id)
     WHERE id = $1`,
    [charge.id, payment.stripe_payment_intent_id ?? stripeObjectId],
  )
  await recordBillingActivity(pool, {
    eventKey: `custom-charge-paid:${charge.id}:${payment.id}`,
    accountId,
    memberId: charge.member_id,
    chargeId: charge.id,
    paymentId: payment.id,
    eventType: 'custom_charge_paid',
    summary: `Payment received for ${charge.description}.`,
    afterValue: { paymentId: Number(payment.id), amountCents: amount },
    stripeObjectId: payment.stripe_payment_intent_id ?? stripeObjectId,
    actorType,
  })
  return application
}

async function accountBalance(pool, accountId) {
  const result = await pool.query(
    `SELECT
       COALESCE((SELECT SUM(amount_cents) FROM billing_charge WHERE family_billing_account_id = $1), 0)::int
       - COALESCE((SELECT SUM(amount_cents) FROM billing_payment
                   WHERE family_billing_account_id = $1
                     AND external_status IN ('settled', 'succeeded')), 0)::int
       + COALESCE((SELECT SUM(amount_cents) FROM billing_refund
                   WHERE family_billing_account_id = $1 AND COALESCE(external_status, 'succeeded') = 'succeeded'), 0)::int
       AS balance_cents`,
    [accountId],
  )
  return Number(result.rows[0]?.balance_cents ?? 0)
}

export async function previewCustomerBillingRefund(pool, {
  account,
  paymentId,
  amountCents,
  ledgerTreatment,
  relatedChargeId = null,
}) {
  const amount = positiveCents(amountCents, 'Refund amount')
  if (!['reverse_charge', 'return_overpayment'].includes(ledgerTreatment)) {
    throw new Error('Choose whether the refund reverses a charge or returns an unapplied overpayment.')
  }
  const payment = await pool.query(
    `SELECT * FROM billing_payment WHERE id = $1 AND family_billing_account_id = $2`,
    [Number(paymentId), account.id],
  ).then((result) => result.rows[0])
  if (!payment?.stripe_payment_intent_id) throw new Error('Refunds must be tied to an eligible Stripe card payment.')
  if (['failed', 'canceled', 'cancelled'].includes(String(payment.external_status ?? '').toLowerCase())) {
    throw new Error('Only completed Stripe card payments can be refunded.')
  }
  const refunded = await pool.query(
    `SELECT COALESCE(SUM(amount_cents), 0)::int AS cents
     FROM billing_refund WHERE payment_id = $1 AND external_status IN ('pending', 'succeeded', 'reconciliation_required')`,
    [payment.id],
  )
  const remainingRefundableCents = Number(payment.amount_cents) - Number(refunded.rows[0]?.cents ?? 0)
  if (amount > remainingRefundableCents) throw new Error('Refund exceeds the remaining refundable card payment amount.')
  const currentBalanceCents = await accountBalance(pool, account.id)
  let relatedCharge = null
  if (ledgerTreatment === 'reverse_charge') {
    if (!relatedChargeId) throw new Error('Select the charge that this refund reverses or waives.')
    relatedCharge = await loadCharge(pool, account.id, relatedChargeId)
    const appliedFromPayment = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN application_kind = 'reversal' THEN -amount_cents ELSE amount_cents END), 0)::int AS cents
       FROM billing_payment_application
       WHERE billing_payment_id = $1 AND billing_charge_id = $2`,
      [payment.id, relatedCharge.id],
    )
    if (amount > Number(appliedFromPayment.rows[0]?.cents ?? 0)) {
      throw new Error('Refund amount exceeds this payment’s application to the selected charge.')
    }
    const prior = await pool.query(
      `SELECT COALESCE(SUM(amount_cents), 0)::int AS cents
       FROM billing_refund
       WHERE related_charge_id = $1 AND ledger_treatment = 'reverse_charge'
         AND external_status IN ('pending', 'succeeded', 'reconciliation_required')`,
      [relatedCharge.id],
    )
    if (Number(prior.rows[0]?.cents ?? 0) + amount > Math.max(0, Number(relatedCharge.amount_cents))) {
      throw new Error('Refund exceeds the remaining reversible amount on the selected charge.')
    }
  } else {
    const overpaymentCents = Math.max(0, -currentBalanceCents)
    if (amount > overpaymentCents) throw new Error('Refund exceeds the household’s unapplied overpayment.')
  }
  return {
    paymentId: Number(payment.id),
    paymentAmountCents: Number(payment.amount_cents),
    remainingRefundableCents,
    amountCents: amount,
    ledgerTreatment,
    relatedCharge: relatedCharge
      ? { id: Number(relatedCharge.id), description: relatedCharge.description, amountCents: Number(relatedCharge.amount_cents) }
      : null,
    currentBalanceCents,
    resultingBalanceCents: ledgerTreatment === 'reverse_charge'
      ? currentBalanceCents
      : currentBalanceCents + amount,
  }
}

export async function finalizeRefundLedgerTreatment(pool, refundOrId, {
  actorUserId = null,
  actorType = 'system',
  collectionLockHeld = false,
  stripeClient = undefined,
} = {}) {
  const candidate = typeof refundOrId === 'object'
    ? refundOrId
    : await pool.query(`SELECT * FROM billing_refund WHERE id = $1`, [Number(refundOrId)]).then((result) => result.rows[0])
  if (!candidate) return null
  const accountId = Number(candidate.family_billing_account_id)
  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new Error('Refund is not linked to a household billing account.')
  }

  const finalizeUnderCollectionLock = async (db) => {
    let transactionOpen = false
    let finalized
    let membershipEnd = { ended: false, subscriptions: [] }
    try {
      await db.query('BEGIN')
      transactionOpen = true
      let refund = await db.query(
        `SELECT *
           FROM billing_refund
          WHERE id = $1 AND family_billing_account_id = $2
          FOR UPDATE`,
        [Number(candidate.id), accountId],
      ).then((result) => result.rows[0] ?? null)
      if (!refund) throw new Error('Refund was not found for this household account.')
      if (!stripeRefundReadyForLedgerFinalization(refund)) {
        await db.query('COMMIT')
        transactionOpen = false
        return refund
      }

      if (refund.external_status === 'reconciliation_required') {
        refund = await db.query(
          `UPDATE billing_refund
              SET external_status = 'succeeded', error_message = NULL, updated_at = now()
            WHERE id = $1
              AND family_billing_account_id = $2
              AND external_status = 'reconciliation_required'
              AND stripe_refund_id = $3
            RETURNING *`,
          [refund.id, accountId, refund.stripe_refund_id],
        ).then((result) => result.rows[0] ?? null)
        if (!refund) {
          throw new Error('Refund ledger-finalization ownership changed before it could be committed.')
        }
      }

      let offsetCredit = null
      if (refund.ledger_treatment === 'reverse_charge') {
        const relatedCharge = await db.query(
          `SELECT id
             FROM billing_charge
            WHERE id = $1 AND family_billing_account_id = $2
            FOR UPDATE`,
          [Number(refund.related_charge_id), accountId],
        ).then((result) => result.rows[0] ?? null)
        if (!relatedCharge) throw new Error('Refund charge does not belong to this household account.')
        const reserved = await db.query(
          `SELECT 1
             FROM billing_monthly_invoice_line line
             JOIN billing_monthly_invoice invoice ON invoice.id = line.billing_monthly_invoice_id
            WHERE line.billing_charge_id = $1
              AND invoice.status IN ('draft', 'open', 'payment_method_required', 'failed')
            UNION ALL
           SELECT 1
             FROM billing_payment_attempt attempt
             LEFT JOIN billing_payment_attempt_charge reservation
               ON reservation.billing_payment_attempt_id = attempt.id
            WHERE attempt.family_billing_account_id = $2
              AND (
                attempt.status IN ('pending', 'processing', 'reconciliation_required')
                OR (attempt.status = 'reserved' AND attempt.expires_at > now())
              )
              AND (
                reservation.billing_charge_id = $1
                OR attempt.target_charge_id = $1
              )
            LIMIT 1`,
          [relatedCharge.id, accountId],
        )
        if (reserved.rows[0]) {
          const error = new Error('The refunded charge is reserved by an active collection attempt and requires reconciliation.')
          error.code = 'REFUND_CHARGE_RESERVED'
          throw error
        }
        const result = await db.query(
          `INSERT INTO billing_charge (
             family_billing_account_id, member_id, source_type, source_id,
             description, amount_cents, gross_amount_cents, discount_amount_cents,
             charge_type, billing_interval, related_charge_id,
             collection_status, created_by_user_id, metadata
           )
           SELECT
             $1, original.member_id, 'refund_offset', $2,
             'Credit offset for refund #' || $3, -$4, -$4, 0,
             'credit', 'one_time', original.id, 'none', $5,
             jsonb_build_object('refundId', $3, 'ledgerTreatment', 'reverse_charge')
           FROM billing_charge original
           WHERE original.id = $6 AND original.family_billing_account_id = $1
           ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
           RETURNING *`,
          [
            accountId,
            `refund:${refund.id}`,
            refund.id,
            Number(refund.amount_cents),
            actorUserId,
            refund.related_charge_id,
          ],
        )
        offsetCredit = result.rows[0] ?? await db.query(
          `SELECT *
             FROM billing_charge
            WHERE family_billing_account_id = $1
              AND source_type = 'refund_offset'
              AND source_id = $2
            FOR UPDATE`,
          [accountId, `refund:${refund.id}`],
        ).then((lookup) => lookup.rows[0] ?? null)
        if (!offsetCredit || Number(offsetCredit.related_charge_id) !== Number(refund.related_charge_id)) {
          throw new Error(`Refund #${refund.id} has a conflicting ledger-offset credit.`)
        }
        await db.query(
          `UPDATE billing_refund SET offset_credit_charge_id = $2, updated_at = now() WHERE id = $1`,
          [refund.id, offsetCredit.id],
        )
      }

      const applicationReversals = await reverseRefundedApplicationsLocked(db, { refund })
      membershipEnd = refund.ledger_treatment === 'reverse_charge'
        ? await endRefundedAnnualMembership(db, null, refund)
        : membershipEnd
      await recordBillingActivity(db, {
        eventKey: `refund-succeeded:${refund.id}`,
        accountId,
        chargeId: refund.related_charge_id,
        paymentId: refund.payment_id,
        refundId: refund.id,
        eventType: 'refund_succeeded',
        summary: `Refund #${refund.id} completed.`,
        afterValue: {
          amountCents: Number(refund.amount_cents),
          ledgerTreatment: refund.ledger_treatment,
          offsetCreditChargeId: offsetCredit ? Number(offsetCredit.id) : null,
          paymentApplicationReversalIds: applicationReversals.map((row) => Number(row.id)),
          annualMembershipEnded: membershipEnd.ended,
          annualMembershipSubscriptions: membershipEnd.subscriptions.map((row) => ({
            billingSubscriptionId: Number(row.id),
            stripeSubscriptionId: row.stripe_subscription_id ?? null,
            memberId: row.member_id == null ? null : Number(row.member_id),
            sourceId: row.source_id ?? null,
          })),
        },
        stripeObjectId: refund.stripe_refund_id,
        actorUserId,
        actorType,
      })
      const remoteSubscriptions = membershipEnd.subscriptions.filter((row) => row.stripe_subscription_id)
      if (remoteSubscriptions.length > 0) {
        const subscriptionIds = remoteSubscriptions.map((row) => String(row.stripe_subscription_id))
        const cancellationMarker = `${REFUND_LEDGER_FINALIZATION_PREFIX}${refund.stripe_refund_id}] Stripe returned the money and the approved ledger treatment committed; linked legacy Stripe subscriptions (${subscriptionIds.join(', ')}) must be canceled before household collection resumes.`
        finalized = await db.query(
          `UPDATE billing_refund
              SET external_status = 'reconciliation_required',
                  error_message = $3,
                  updated_at = now()
            WHERE id = $1
              AND family_billing_account_id = $2
              AND stripe_refund_id = $4
              AND external_status = 'succeeded'
            RETURNING *`,
          [refund.id, accountId, cancellationMarker, refund.stripe_refund_id],
        ).then((result) => result.rows[0] ?? null)
        if (!finalized) {
          throw new Error('Refund ownership changed before legacy Stripe subscription cancellation could be reserved.')
        }
        finalized.offset_credit_charge_id = offsetCredit?.id ?? refund.offset_credit_charge_id
      } else {
        finalized = { ...refund, offset_credit_charge_id: offsetCredit?.id ?? refund.offset_credit_charge_id }
      }
      await db.query('COMMIT')
      transactionOpen = false
    } catch (error) {
      if (transactionOpen) await db.query('ROLLBACK').catch(() => {})
      throw error
    }

    const remoteSubscriptions = membershipEnd.subscriptions.filter((row) => row.stripe_subscription_id)
    if (remoteSubscriptions.length > 0) {
      try {
        const stripe = stripeClient === undefined ? await getStripeClient() : stripeClient
        if (!stripe) {
          const error = new Error('Stripe is unavailable; refunded annual membership cancellation remains pending.')
          error.code = 'REFUND_MEMBERSHIP_STRIPE_CANCELLATION_PENDING'
          throw error
        }
        await cancelRefundedAnnualMembershipSubscriptions(stripe, remoteSubscriptions)

        let completionTransactionOpen = false
        try {
          await db.query('BEGIN')
          completionTransactionOpen = true
          const lockedRefund = await db.query(
            `SELECT *
               FROM billing_refund
              WHERE id = $1 AND family_billing_account_id = $2
              FOR UPDATE`,
            [finalized.id, accountId],
          ).then((result) => result.rows[0] ?? null)
          if (!lockedRefund || String(lockedRefund.stripe_refund_id ?? '') !== String(finalized.stripe_refund_id ?? '')) {
            throw new Error('Refund ownership changed while legacy Stripe subscriptions were being canceled.')
          }
          if (lockedRefund.external_status === 'succeeded') {
            finalized = lockedRefund
          } else {
            const expectedPrefix = `${REFUND_LEDGER_FINALIZATION_PREFIX}${lockedRefund.stripe_refund_id}]`
            if (
              lockedRefund.external_status !== 'reconciliation_required'
              || !String(lockedRefund.error_message ?? '').startsWith(expectedPrefix)
            ) {
              throw new Error('Refund reconciliation state changed while legacy Stripe subscriptions were being canceled.')
            }
            finalized = await db.query(
              `UPDATE billing_refund
                  SET external_status = 'succeeded', error_message = NULL, updated_at = now()
                WHERE id = $1
                  AND family_billing_account_id = $2
                  AND stripe_refund_id = $3
                  AND external_status = 'reconciliation_required'
                  AND position($4 in COALESCE(error_message, '')) = 1
                RETURNING *`,
              [lockedRefund.id, accountId, lockedRefund.stripe_refund_id, expectedPrefix],
            ).then((result) => result.rows[0] ?? null)
            if (!finalized) {
              throw new Error('Refund reconciliation state changed before subscription cancellation could be finalized.')
            }
          }
          await db.query('COMMIT')
          completionTransactionOpen = false
        } catch (error) {
          if (completionTransactionOpen) await db.query('ROLLBACK').catch(() => {})
          throw error
        }
        await db.query(
          `UPDATE stripe_billing_alert
              SET action_status = CASE WHEN action_status = 'suspended' THEN action_status ELSE 'resolved' END,
                  resolved_at = CASE WHEN action_status = 'suspended' THEN resolved_at ELSE COALESCE(resolved_at, now()) END,
                  resolution_note = CASE
                    WHEN action_status = 'suspended' THEN resolution_note
                    ELSE COALESCE(resolution_note, 'Automatically resolved after linked legacy Stripe subscriptions were canceled.')
                  END,
                  updated_at = now()
            WHERE stripe_event_id = $1`,
          [`refund-subscription-cancellation:${finalized.id}`],
        ).catch(() => {})
      } catch (error) {
        await db.query(
          `INSERT INTO stripe_billing_alert (
             stripe_event_id, family_billing_account_id, alert_type, severity,
             stripe_object_id, message, details
           ) VALUES ($1, $2, 'stripe_refund_reconciliation_failed', 'critical', $3, $4, $5::jsonb)
           ON CONFLICT (stripe_event_id) DO UPDATE
             SET family_billing_account_id = EXCLUDED.family_billing_account_id,
                 alert_type = EXCLUDED.alert_type,
                 severity = 'critical',
                 stripe_object_id = EXCLUDED.stripe_object_id,
                 message = EXCLUDED.message,
                 details = EXCLUDED.details,
                 action_status = CASE
                   WHEN stripe_billing_alert.action_status = 'suspended' THEN stripe_billing_alert.action_status
                   ELSE 'open'
                 END,
                 resolved_at = CASE
                   WHEN stripe_billing_alert.action_status = 'suspended' THEN stripe_billing_alert.resolved_at
                   ELSE NULL
                 END,
                 updated_at = now()`,
          [
            `refund-subscription-cancellation:${finalized.id}`,
            accountId,
            finalized.stripe_refund_id,
            `Refund #${finalized.id} returned money but linked legacy Stripe subscription cancellation is still pending.`,
            JSON.stringify({
              refundId: Number(finalized.id),
              stripeRefundId: finalized.stripe_refund_id,
              stripeSubscriptionIds: remoteSubscriptions.map((row) => row.stripe_subscription_id),
              reason: String(error?.message ?? error),
            }),
          ],
        ).catch(() => {})
        if (!error.code) error.code = 'REFUND_MEMBERSHIP_STRIPE_CANCELLATION_PENDING'
        throw error
      }
    }
    // Re-run allocation on the already-locked session, but in its own short
    // transaction. For annual refunds, wait until every linked legacy Stripe
    // subscription is confirmed canceled so no collector can observe an
    // unblocked refund while the old remote renewal is still live.
    await allocateHouseholdPaymentsLocked(db, { accountId, actorType })
    return finalized
  }
  return collectionLockHeld
    ? finalizeUnderCollectionLock(pool)
    : withBillingAccountCollectionLock(pool, accountId, finalizeUnderCollectionLock)
}

export async function cancelRefundedAnnualMembershipSubscriptions(stripe, subscriptions) {
  const results = []
  for (const subscription of subscriptions) {
    const subscriptionId = String(subscription?.stripe_subscription_id ?? '').trim()
    if (!subscriptionId) continue
    const remote = await stripe.subscriptions.retrieve(subscriptionId)
    if (remote?.status === 'canceled') {
      results.push({ id: subscriptionId, canceled: true, replayed: true })
      continue
    }
    await stripe.subscriptions.cancel(subscriptionId, { prorate: false })
    results.push({ id: subscriptionId, canceled: true, replayed: false })
  }
  return results
}

export async function createCustomerBillingRefund(pool, {
  account,
  actorUserId,
  paymentId,
  amountCents,
  ledgerTreatment,
  relatedChargeId = null,
  exceptionCategory,
  evidenceNote,
  reason,
  idempotencyKey = null,
}) {
  if (!stripeEnabled()) throw new Error('Stripe is not enabled; card refunds cannot be submitted.')
  const refundReason = String(reason ?? '').trim()
  if (!refundReason) throw new Error('A refund reason is required.')
  const requestKey = String(idempotencyKey ?? '').trim() || null
  if (!requestKey) throw new Error('A stable refund idempotency key is required.')
  return withBillingAccountCollectionLock(pool, account.id, async (db) => {
    if (requestKey) {
      const existing = await db.query(
        `SELECT * FROM billing_refund WHERE request_key = $1`,
        [requestKey],
      ).then((result) => result.rows[0] ?? null)
      if (existing) {
        const sameRequest =
          Number(existing.family_billing_account_id) === Number(account.id) &&
          Number(existing.payment_id) === Number(paymentId) &&
          Number(existing.amount_cents) === Number(amountCents) &&
          String(existing.ledger_treatment ?? '') === String(ledgerTreatment ?? '') &&
          Number(existing.related_charge_id ?? 0) === Number(relatedChargeId ?? 0) &&
          String(existing.exception_category ?? '') === String(exceptionCategory ?? '') &&
          String(existing.evidence_note ?? '').trim() === String(evidenceNote ?? '').trim() &&
          String(existing.reason ?? '').trim() === refundReason
        if (!sameRequest) throw new Error('The refund request key was reused with different refund details.')
        const resumed = await createBillingRefund(db, {
          accountId: account.id,
          paymentId: paymentId == null ? null : Number(paymentId),
          amountCents: Number(amountCents),
          reason: refundReason,
          createdByUserId: actorUserId,
          exceptionCategory,
          evidenceNote,
          ledgerTreatment,
          relatedChargeId: relatedChargeId == null ? null : Number(relatedChargeId),
          requestKey,
          collectionLockHeld: true,
        })
        const finalized = await finalizeRefundLedgerTreatment(db, resumed, {
          actorUserId,
          actorType: 'admin',
          collectionLockHeld: true,
        })
        return { refund: finalized, preview: null, replayed: true }
      }
    }
    const preview = await previewCustomerBillingRefund(db, {
      account,
      paymentId,
      amountCents,
      ledgerTreatment,
      relatedChargeId,
    })
    const refund = await createBillingRefund(db, {
      accountId: account.id,
      paymentId: preview.paymentId,
      amountCents: preview.amountCents,
      reason: refundReason,
      createdByUserId: actorUserId,
      exceptionCategory,
      evidenceNote,
      ledgerTreatment,
      relatedChargeId: relatedChargeId == null ? null : Number(relatedChargeId),
      requestKey,
      collectionLockHeld: true,
    })
    const finalized = await finalizeRefundLedgerTreatment(db, refund, {
      actorUserId,
      actorType: 'admin',
      collectionLockHeld: true,
    })
    if (refund.external_status !== 'succeeded') {
      await recordBillingActivity(db, {
        eventKey: `refund-created:${refund.id}`,
        accountId: account.id,
        chargeId: relatedChargeId,
        paymentId: paymentId,
        refundId: refund.id,
        eventType: 'refund_pending',
        summary: `Refund #${refund.id} was submitted to Stripe.`,
        afterValue: { amountCents: preview.amountCents, ledgerTreatment, status: refund.external_status },
        stripeObjectId: refund.stripe_refund_id,
        actorUserId,
      })
    }
    return { refund: finalized, preview, replayed: Boolean(refund.idempotency_replayed) }
  })
}

export async function createCustomerBillingPaymentMethodLink(pool, {
  account,
  returnUrl,
  actorUserId,
}) {
  if (!stripeEnabled()) throw new Error('Stripe is not enabled.')
  const session = await createPaymentMethodSetupSession(pool, { account, returnUrl })
  if (!session?.url) throw new Error('Stripe did not return a payment-method update URL.')
  await recordBillingActivity(pool, {
    eventKey: `payment-method-link:${account.id}:${session.id}`,
    accountId: account.id,
    eventType: 'payment_method_link_created',
    summary: 'Secure payment-method update link created.',
    stripeObjectId: session.id,
    actorUserId,
  })
  return { url: session.url }
}

export async function loadCustomerBillingCharge(pool, accountId, chargeId) {
  return loadCharge(pool, accountId, chargeId)
}
