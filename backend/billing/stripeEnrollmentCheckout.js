/**
 * Stripe Checkout for member enrollment — pay-then-commit flow.
 * See docs/STRIPE_CATALOG_INTEGRATION.md Phase 2.
 */

import crypto from 'crypto'
import {
  getStripeClient,
  stripeEnabled,
  ensureStripeBillingSchema,
  ensureStripeCustomer,
  applyAndSettlePaidCheckoutFulfillment,
  recordEnrollmentStripePayment,
  recordPaidCheckoutFulfillmentQuarantine,
} from './stripeBilling.js'
import {
  allocateHouseholdPaymentsLocked,
} from './paymentAllocation.js'
import {
  feeLookupKey,
  passLookupKey,
  resolveStripePriceId,
  ensureStripeCatalogSchema,
  ensureBillingRecurringSchema,
  getCatalogSyncStatus,
} from './stripeCatalogSync.js'
import {
  ANNUAL_MEMBERSHIP_PRICING_KEY,
  ANNUAL_MEMBERSHIP_SOURCE_TYPE,
  membershipRenewsOnFromPurchase,
  toUtcDateString,
} from '../scheduling/membershipAnniversary.js'
import { buildSignupOrderPreview } from '../scheduling/orderPricing.js'
import { executeSignupBatch } from '../scheduling/handlers.js'
import { firstOfNextMonth, todayDateOnly } from '../scheduling/firstMonthProration.js'
import {
  issueSignupAuthToken,
  verifySignupAuthToken,
} from '../scheduling/signupAuth.js'
import { findMemberById } from '../members/createMemberStub.js'
import { emitStripePurchaseEvent } from '../analytics/ga4Measurement.js'
import { requireEnrollmentStartDate } from '../scheduling/enrollmentStartDate.js'
import { billingMigrationCollectionLocked } from './canonicalBillingMigrationState.js'
import {
  billingStripeSubscriptionCreationAllowed,
  legacyPerClassStripeCollectionAllowed,
} from './billingFeatureFlags.js'
import {
  FORBIDDEN_SUBSCRIPTION_CHECKOUT_CODE,
  checkoutSessionHasForbiddenSubscriptionCollector,
  rejectForbiddenSubscriptionCheckoutCompletion,
} from './checkoutSessionCollectionPolicy.js'
import {
  checkoutFingerprint,
  checkoutIdempotencyConflict,
  normalizeCheckoutRequestKey,
  stripeCheckoutIdempotencyKey,
} from './checkoutIdempotency.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import {
  findActiveEnrollmentCheckoutBalanceCollector,
  findCompletedPaidCheckoutFulfillmentGap,
} from './paidCheckoutCollectionGuard.js'
import { findActivePurchaseCheckoutOwner } from './purchaseCheckoutAdmission.js'

export { formatPerClassStripeProductName } from './stripeProductNaming.js'

async function loadFormProgramsId(pool, formId) {
  const res = await pool.query(`SELECT programs_id FROM scheduling_form WHERE id = $1`, [formId])
  return res.rows[0]?.programs_id != null ? Number(res.rows[0].programs_id) : null
}

function enrollmentCheckoutAuthorizationError(message = 'Selected member is not eligible for this household checkout.') {
  const error = new Error(message)
  error.code = 'ENROLLMENT_CHECKOUT_FORBIDDEN'
  error.statusCode = 403
  return error
}

function enrollmentCheckoutTokenError() {
  const error = new Error('Enrollment session expired. Please try again.')
  error.code = 'ENROLLMENT_CHECKOUT_TOKEN_INVALID'
  error.statusCode = 401
  return error
}

/**
 * Resolve the athlete only from a cryptographically verified signup token.
 * The caller still has to prove that athlete belongs to the payer's household.
 */
export async function resolveVerifiedEnrollmentMemberId(
  pool,
  payload,
  payerOrFallbackMemberId,
  { familyBillingAccountId = null } = {},
) {
  const body = typeof payload === 'string' ? JSON.parse(payload) : payload
  if (!body?.signupAuthToken) return Number(payerOrFallbackMemberId)

  const firstFormId = body.signups?.find((signup) => signup?.formId != null)?.formId
  const firstProgramsId =
    firstFormId != null
      ? await loadFormProgramsId(pool, firstFormId)
      : body.signups?.find((signup) => signup?.programsId != null)?.programsId ?? null
  let decoded
  try {
    decoded = verifySignupAuthToken(String(body.signupAuthToken), firstFormId ?? null, {
      programsId: firstProgramsId,
    })
  } catch {
    throw enrollmentCheckoutTokenError()
  }

  const enrolledMemberId = Number(decoded.memberId)
  const authority = decoded.signupAuthority
  const payerMemberId = Number(payerOrFallbackMemberId)
  if (
    !Number.isSafeInteger(enrolledMemberId) ||
    enrolledMemberId <= 0 ||
    !Number.isSafeInteger(payerMemberId) ||
    payerMemberId <= 0 ||
    authority.actorMemberId !== payerMemberId ||
    authority.targetMemberId !== enrolledMemberId
  ) {
    throw enrollmentCheckoutAuthorizationError(
      'Only the family payer can authorize this enrollment session.',
    )
  }
  if (
    authority.familyBillingAccountId != null &&
    Number(authority.familyBillingAccountId) !== Number(familyBillingAccountId)
  ) {
    throw enrollmentCheckoutAuthorizationError(
      'Enrollment session belongs to a different billing account.',
    )
  }

  return enrolledMemberId
}

/**
 * Authorize the target member against the billing account's canonical family.
 * An active family_member link wins. Legacy member.family_id is accepted only
 * when the member has no family_member history at all, matching portal access.
 */
export async function assertEnrollmentCheckoutMemberScope(pool, {
  familyBillingAccountId,
  memberId,
  payerMemberId = null,
}) {
  const normalizedAccountId = Number(familyBillingAccountId)
  const normalizedMemberId = Number(memberId)
  const normalizedPayerId = payerMemberId == null ? null : Number(payerMemberId)
  if (
    !Number.isInteger(normalizedAccountId) || normalizedAccountId <= 0 ||
    !Number.isInteger(normalizedMemberId) || normalizedMemberId <= 0 ||
    (normalizedPayerId != null && (!Number.isInteger(normalizedPayerId) || normalizedPayerId <= 0))
  ) {
    throw enrollmentCheckoutAuthorizationError()
  }

  const result = await pool.query(
    `SELECT member.id
       FROM family_billing_account account
       JOIN member ON member.id = $2
      WHERE account.id = $1
        AND account.is_active = TRUE
        AND member.is_active = TRUE
        AND ($3::bigint IS NULL OR account.payer_member_id = $3)
        AND (
          EXISTS (
            SELECT 1
              FROM family_member membership
             WHERE membership.member_id = member.id
               AND membership.family_id = account.family_id
               AND membership.is_active = TRUE
          )
          OR (
            member.family_id = account.family_id
            AND NOT EXISTS (
              SELECT 1
                FROM family_member historical_membership
               WHERE historical_membership.member_id = member.id
            )
          )
        )
      LIMIT 1`,
    [normalizedAccountId, normalizedMemberId, normalizedPayerId],
  )
  if (!result.rows[0]) throw enrollmentCheckoutAuthorizationError()
  return normalizedMemberId
}

/** Drop Stripe-only fields before Joi signup-batch validation. */
export function stripSignupBatchPayload(payload) {
  const body = typeof payload === 'string' ? JSON.parse(payload) : { ...payload }
  const { analytics: _analytics, ...signupBatchPayload } = body
  return signupBatchPayload
}

export async function refreshSignupAuthForCommit(pool, payload, enrolledMemberId, {
  actorMemberId,
  familyBillingAccountId,
}) {
  const body = typeof payload === 'string' ? JSON.parse(payload) : { ...payload }
  const firstFormId = body.signups?.find((s) => s.formId != null)?.formId ?? null
  const passProgramsId = body.signups?.find((s) => s.programsId != null)?.programsId ?? null
  if (firstFormId == null && passProgramsId == null) throw new Error('Invalid enrollment payload')

  const member = await findMemberById(pool, enrolledMemberId)
  if (!member) throw new Error('Member account not found')
  const programsId =
    firstFormId != null ? await loadFormProgramsId(pool, firstFormId) : Number(passProgramsId)
  body.signupAuthToken = issueSignupAuthToken({
    formId: firstFormId ?? 0,
    memberId: enrolledMemberId,
    email: member.email,
    programsId,
    actorMemberId,
    familyBillingAccountId,
    authorityGrant: 'pending_checkout',
  })
  return body
}

function parsePendingPayload(payload) {
  return typeof payload === 'string' ? JSON.parse(payload) : payload
}

const PAID_ENROLLMENT_QUARANTINE_PREFIX = '[paid-checkout-refund-required]'

async function ensurePendingEnrollmentSchema() {
  // Compatibility hook. Startup billing readiness owns this schema contract.
}

export function computeEnrollmentDueNowCents(preview) {
  const fees = Math.round((preview.additionalFeesOneTime ?? 0) * 100)
  const firstMonth = preview.firstMonth?.totalCents ?? 0
  const passes = preview.passPurchaseTotalCents ?? 0
  const carriedForward = preview.carriedForward?.totalCents ?? 0
  return Math.max(0, fees + firstMonth + passes + (carriedForward > 0 ? carriedForward : 0))
}

export function computeEnrollmentCheckoutPurchaseCents(preview) {
  const fees = Math.round((preview?.additionalFeesOneTime ?? 0) * 100)
  const firstMonth = Math.round(Number(preview?.firstMonth?.totalCents) || 0)
  const passes = Math.round(Number(preview?.passPurchaseTotalCents) || 0)
  return Math.max(0, fees + firstMonth + passes)
}

export function computeEnrollmentCheckoutCarriedBalanceCents(preview) {
  return Math.max(
    0,
    computeEnrollmentDueNowCents(preview) - computeEnrollmentCheckoutPurchaseCents(preview),
  )
}

/**
 * Find a pre-existing collector whose reserved balance can overlap the
 * carried-forward slice of a new enrollment Checkout. The caller holds the
 * household collection advisory lock, so an empty result remains valid until
 * the pending enrollment reservation is durably inserted.
 */
export async function findEnrollmentCheckoutCreationConflict(db, accountId) {
  return db.query(
    `SELECT owner_kind, owner_id, owner_status
       FROM (
         SELECT 'payment_attempt'::text AS owner_kind,
                attempt.id AS owner_id,
                attempt.status AS owner_status
           FROM billing_payment_attempt attempt
          WHERE attempt.family_billing_account_id = $1
            AND (
              attempt.status IN ('pending', 'processing', 'reconciliation_required')
              OR (attempt.status = 'reserved' AND attempt.expires_at > now())
            )
         UNION ALL
         SELECT 'monthly_invoice'::text AS owner_kind,
                invoice.id AS owner_id,
                invoice.status AS owner_status
           FROM billing_monthly_invoice invoice
          WHERE invoice.family_billing_account_id = $1
            AND invoice.status IN ('draft', 'open', 'failed', 'payment_method_required')
         UNION ALL
         SELECT 'legacy_stripe_collector'::text AS owner_kind,
                subscription.id AS owner_id,
                subscription.status AS owner_status
           FROM billing_subscription subscription
          WHERE subscription.family_billing_account_id = $1
            AND (
              NULLIF(BTRIM(subscription.stripe_subscription_id), '') IS NOT NULL
              OR NULLIF(BTRIM(subscription.stripe_subscription_item_id), '') IS NOT NULL
              OR NULLIF(BTRIM(subscription.stripe_subscription_schedule_id), '') IS NOT NULL
            )
         UNION ALL
         SELECT 'paid_checkout_reconciliation'::text AS owner_kind,
                payment.id AS owner_id,
                payment.external_status AS owner_status
           FROM billing_payment payment
          WHERE payment.family_billing_account_id = $1
            AND payment.external_status = 'reconciliation_required'
            AND (
              position('[paid-checkout-fulfillment-pending:' in COALESCE(payment.note, '')) > 0
              OR position('[paid-checkout-refund-required:' in COALESCE(payment.note, '')) > 0
            )
         UNION ALL
         SELECT 'stripe_refund_reconciliation'::text AS owner_kind,
                refund.id AS owner_id,
                refund.external_status AS owner_status
           FROM billing_refund refund
          WHERE refund.family_billing_account_id = $1
            AND refund.external_status = 'reconciliation_required'
       ) owner
      ORDER BY owner_kind, owner_id
      LIMIT 1`,
    [Number(accountId)],
  ).then((result) => result.rows[0] ?? null)
}

function enrollmentCheckoutCollectionConflict(owner, message = null) {
  const error = new Error(
    message
      ?? 'This household already has a payment collection in progress. Complete or reconcile it before opening an enrollment Checkout that includes account balance.',
  )
  error.code = 'ENROLLMENT_CHECKOUT_COLLECTION_CONFLICT'
  error.statusCode = 409
  if (owner) {
    error.ownerKind = owner.owner_kind ?? null
    error.ownerId = Number(owner.owner_id) || null
    error.ownerStatus = owner.owner_status ?? null
  }
  return error
}

export function enrollmentHasRecurringMembership(preview) {
  return (preview.newSignups ?? []).some(
    (line) =>
      line.billingType === 'recurring' &&
      !line.multiClassPassApplied &&
      (line.monthlyPrice ?? line.incrementalMonthly ?? 0) > 0,
  )
}

/** Stripe trial_end disclaimer — only for recurring membership checkout, not one-time purchases. */
export function shouldShowEnrollmentCheckoutSubmitMessage(preview) {
  return enrollmentHasRecurringMembership(preview)
}

export function enrollmentNeedsStripeCheckout(preview) {
  const dueNow = computeEnrollmentDueNowCents(preview)
  const hasRecurring = enrollmentHasRecurringMembership(preview)
  const hasPassPurchase = (preview.passPurchases?.length ?? 0) > 0
  return dueNow > 0 || hasRecurring || hasPassPurchase
}

function dateStringToUnixBillingAnchor(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d, 12, 0, 0) / 1000)
}

/** trial_end must be in the future; clamp so Stripe accepts deferred renewals. */
export function resolveSubscriptionTrialEndUnix(anchorDate, nowSec = Math.floor(Date.now() / 1000)) {
  const anchorUnix = dateStringToUnixBillingAnchor(anchorDate)
  const minTrialEnd = nowSec + 60
  return Math.max(anchorUnix, minTrialEnd)
}

/** @deprecated use dateStringToUnixBillingAnchor */
function dateStringToUnixTrialEnd(dateStr) {
  return dateStringToUnixBillingAnchor(dateStr)
}

/**
 * Checkout line label for first-month tuition due at enrollment.
 * Full remaining months use neutral "tuition" wording; partial months say "prorated".
 */
export function formatFirstMonthTuitionLineName(fm) {
  const label = fm.displayLine ?? fm.formTitle ?? 'Class enrollment'
  const prepaid = Math.round(Number(fm.prepaidFirstMonthCents) || 0)
  const prorated = Math.round(Number(fm.proratedCents) || 0)
  if (prepaid > 0) {
    return `${label} — first month (prepaid)`
  }
  const classesPerMonth = fm.classesPerMonth ?? 4
  const remaining = fm.remainingClasses ?? classesPerMonth
  const ratio = Number(fm.ratio ?? 1)
  const isFullMonth = ratio >= 1 || remaining >= classesPerMonth
  if (prorated > 0 && !isFullMonth) {
    return `${label} — first month (prorated)`
  }
  return `${label} — first month tuition`
}

/**
 * One-time tuition line items matching preview.firstMonth (prorated now + prepaid now).
 * Does not include fees, passes, or recurring subscription amounts.
 */
export function computeFirstMonthTuitionLineItems(preview) {
  const lines = []
  if (!preview.firstMonth?.enabled) return lines
  for (const fm of preview.firstMonth.items ?? []) {
    const prorated = Math.round(Number(fm.proratedCents) || 0)
    const prepaid = Math.round(Number(fm.prepaidFirstMonthCents) || 0)
    if (prorated > 0) {
      lines.push({
        amountCents: prorated,
        name: formatFirstMonthTuitionLineName({ ...fm, prepaidFirstMonthCents: 0 }),
      })
    }
    if (prepaid > 0) {
      lines.push({
        amountCents: prepaid,
        name: formatFirstMonthTuitionLineName(fm),
      })
    }
  }
  return lines
}

/**
 * When recurring billing should start in Stripe for one first-month line item.
 * - In-session classes: next 1st after prorated/prepaid tuition collected at checkout.
 * - Future-start prepaid classes: 1st of the month after the prepaid service month.
 */
export function computeFirstMonthBillingAnchorDate(fmItem, fromDate) {
  if (fmItem?.classStartsFutureMonth) {
    const serviceMonthStart = fmItem.firstBillDate ?? fmItem.firstServicePeriodStart ?? fromDate
    return firstOfNextMonth(serviceMonthStart)
  }
  if ((fmItem?.proratedCents ?? 0) > 0 || (fmItem?.prepaidFirstMonthCents ?? 0) > 0) {
    return fmItem.firstBillDate ?? firstOfNextMonth(fromDate)
  }
  return firstOfNextMonth(fromDate)
}

/** Latest billing anchor when multiple classes enroll in one checkout. */
export function computeSubscriptionBillingAnchorDate(preview, asOfDate = null) {
  const fromDate = asOfDate ?? todayDateOnly()
  const fmItems = preview.firstMonth?.enabled ? preview.firstMonth.items ?? [] : []
  let maxAnchorDate = null
  for (const fm of fmItems) {
    const anchorDate = computeFirstMonthBillingAnchorDate(fm, fromDate)
    if (!maxAnchorDate || anchorDate > maxAnchorDate) maxAnchorDate = anchorDate
  }
  return maxAnchorDate ?? firstOfNextMonth(fromDate)
}

/** Unix timestamp for deferred recurring billing in Checkout (required with one-time line items). */
export function computeSubscriptionTrialEndUnix(preview, asOfDate = null) {
  return dateStringToUnixBillingAnchor(computeSubscriptionBillingAnchorDate(preview, asOfDate))
}

/**
 * Checkout submit note — Stripe trial_end can show misleading "X days free" copy in the bill overview.
 */
export function formatEnrollmentCheckoutSubmitMessage() {
  return (
    "Today's payment covers first-month tuition and any additional fees. " +
    'Membership starts on assigned class start date. ' +
    'Future monthly tuition is managed through your family billing account.'
  ).slice(0, 500)
}

/**
 * Net monthly cents for one class after enrollment discounts (matches Vortex ledger).
 * Prefers billing_subscription.net when available; else first-month monthlyNetCents;
 * else discount-line finalCents; else preview incremental monthly.
 */
export function resolvePerClassMonthlyAmountCents(preview, slotKey, { netMonthlyCents = null } = {}) {
  if (netMonthlyCents != null && Number.isFinite(Number(netMonthlyCents))) {
    return Math.max(0, Math.round(Number(netMonthlyCents)))
  }
  const fm = (preview?.firstMonth?.items ?? []).find((item) => item.slotKey === slotKey)
  if (fm?.monthlyNetCents != null) {
    return Math.max(0, Math.round(Number(fm.monthlyNetCents)))
  }
  if (preview?.discounts?.enabled && Array.isArray(preview.discounts.lines)) {
    const line = preview.discounts.lines.find((l) => l.key === slotKey)
    if (line?.finalCents != null) {
      return Math.max(0, Math.round(Number(line.finalCents)))
    }
  }
  const previewLine = (preview?.newSignups ?? []).find((line) => line.slotKey === slotKey)
  return Math.max(0, Math.round(Number(previewLine?.monthlyPrice ?? previewLine?.incrementalMonthly ?? 0) * 100))
}

/** Checkout mode for enrollment: never use subscription Checkout (one sub for many classes). */
export function resolveEnrollmentCheckoutMode(preview) {
  const dueNowCents = computeEnrollmentDueNowCents(preview)
  const hasRecurring = enrollmentHasRecurringMembership(preview)
  if (hasRecurring && dueNowCents <= 0) return 'setup'
  return 'payment'
}

export async function buildCheckoutLineItems(pool, preview) {
  const lineItems = []

  for (const pass of preview.passPurchases ?? []) {
    const lookupKey = passLookupKey(Number(pass.programsId), pass.packageId)
    const priceId = await resolveStripePriceId(pool, lookupKey)
    if (!priceId) {
      throw new Error(`Stripe price not synced for pass ${lookupKey}.`)
    }
    lineItems.push({ price: priceId, quantity: 1 })
  }

  for (const fee of preview.additionalFees?.items ?? []) {
    if ((fee.amountCents ?? 0) <= 0) continue
    const hasPromoDiscount = Math.round(Number(fee.discountCents) || 0) > 0
    const lookupKey = feeLookupKey(Number(fee.feeId ?? fee.id))
    // Catalog prices are full price; promo-discounted fees must charge the net
    // amount, so they always use ad-hoc price_data.
    const priceId = hasPromoDiscount ? null : await resolveStripePriceId(pool, lookupKey)
    if (priceId) {
      lineItems.push({ price: priceId, quantity: 1 })
    } else {
      const promoSuffix = hasPromoDiscount && fee.promoCode
        ? ` (promo ${String(fee.promoCode).toUpperCase()})`
        : ''
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(fee.amountCents),
          product_data: { name: `${fee.name || 'Additional fee'}${promoSuffix}`.slice(0, 200) },
        },
      })
    }
  }

  for (const tuition of computeFirstMonthTuitionLineItems(preview)) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: tuition.amountCents,
        product_data: { name: tuition.name.slice(0, 200) },
      },
    })
  }

  const carriedBalanceCents = computeEnrollmentCheckoutCarriedBalanceCents(preview)
  if (carriedBalanceCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: carriedBalanceCents,
        product_data: { name: 'Vortex Athletics account balance' },
      },
    })
  }

  if (lineItems.length === 0) {
    const dueNow = computeEnrollmentDueNowCents(preview)
    if (dueNow > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: dueNow,
          product_data: { name: 'Vortex Athletics enrollment' },
        },
      })
    }
  }

  return lineItems
}

export function shouldSkipPerClassStripeCollection(
  collectionState,
  environment = process.env,
) {
  return !legacyPerClassStripeCollectionAllowed(environment)
    || collectionState?.global_creation_cutoff_durable === true
    || collectionState?.household_monthly_billing_enabled === true
    || collectionState?.migration_collection_locked === true
    || billingMigrationCollectionLocked(collectionState?.migration_state)
}

/**
 * Preserve the reusable payment method captured by enrollment Checkout without
 * creating another remote collector. Local billing_subscription rows remain
 * authoritative and are collected by the canonical household/balance path.
 */
export async function createEnrollmentStripeSubscriptions(pool, stripe, options = {}) {
  // Validate the deployment invariant before any Stripe operation. The only
  // supported future-creation mode is disabled, so stale values fail closed.
  shouldSkipPerClassStripeCollection(null, options.environment ?? process.env)
  if (stripe) await preserveEnrollmentCheckoutPaymentMethod(pool, stripe, options)
  await synchronizeEnrollmentHouseholdPricing(pool, options.familyBillingAccountId)
  return []
}

async function synchronizeEnrollmentHouseholdPricing(pool, familyBillingAccountId) {
  if (familyBillingAccountId == null || typeof pool?.query !== 'function') return
  try {
    const account = await pool.query(
      `SELECT family_id FROM family_billing_account WHERE id = $1`,
      [familyBillingAccountId],
    )
    const familyId = account.rows[0]?.family_id
    if (familyId == null) return
    const { syncFamilyEnrollmentDiscounts } = await import(
      '../scheduling/pauseEnrollmentBilling.js'
    )
    await syncFamilyEnrollmentDiscounts(pool, Number(familyId))
  } catch (error) {
    console.warn('[billing] family enrollment pricing sync after enrollment:', error?.message ?? error)
  }
}

export async function preserveEnrollmentCheckoutPaymentMethod(
  pool,
  stripe,
  {
    stripeSession,
    familyBillingAccountId,
    customerId: suppliedCustomerId = null,
    defaultPaymentMethodId: suppliedDefaultPaymentMethodId = null,
  } = {},
) {
  const objectId = (value) => {
    const id = typeof value === 'string' ? value : value?.id
    return String(id ?? '').trim() || null
  }
  const bindingConflict = (message, details = {}) => {
    const error = new Error(message)
    error.code = 'STRIPE_ENROLLMENT_PAYMENT_METHOD_BINDING_CONFLICT'
    error.statusCode = 409
    error.familyBillingAccountId = Number(familyBillingAccountId) || null
    Object.assign(error, details)
    return error
  }
  const loadCanonicalAccount = async (db, accountId) => db.query(
    `/* stripe-enrollment-payment-method:canonical-account */
     SELECT account.id,
            account.stripe_customer_id,
            account.is_active,
            (
              SELECT COUNT(*)::integer
                FROM family_billing_account customer_owner
               WHERE customer_owner.stripe_customer_id = account.stripe_customer_id
            ) AS stripe_customer_owner_count
       FROM family_billing_account account
      WHERE account.id = $1
      LIMIT 1`,
    [accountId],
  ).then((result) => result.rows[0] ?? null)

  const sessionId = objectId(stripeSession)
  const suppliedCustomer = objectId(suppliedCustomerId)
  const suppliedPaymentMethod = objectId(suppliedDefaultPaymentMethodId)
  // Administrative enrollment without Checkout has no new method to save.
  // Avoid Stripe or account-lock work for this intentionally empty operation.
  if (!sessionId && !suppliedPaymentMethod) {
    return {
      customerId: suppliedCustomer,
      defaultPaymentMethodId: null,
      saved: false,
    }
  }

  const accountId = Number(familyBillingAccountId)
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    throw bindingConflict('A canonical billing account is required to preserve a Checkout payment method.')
  }
  if (!stripe?.customers?.retrieve || !stripe?.customers?.update || !stripe?.paymentMethods?.retrieve) {
    throw bindingConflict('Stripe customer and payment-method verification is unavailable.')
  }

  return withBillingAccountCollectionLock(pool, accountId, async (db) => {
    const initialAccount = await loadCanonicalAccount(db, accountId)
    const canonicalCustomerId = objectId(initialAccount?.stripe_customer_id)
    if (
      !initialAccount
      || initialAccount.is_active !== true
      || !canonicalCustomerId
      || Number(initialAccount.stripe_customer_owner_count) !== 1
    ) {
      throw bindingConflict(
        'The active billing account does not have one unambiguous canonical Stripe customer.',
        {
          canonicalCustomerId,
          customerOwnerCount: Number(initialAccount?.stripe_customer_owner_count) || 0,
        },
      )
    }
    if (suppliedCustomer && suppliedCustomer !== canonicalCustomerId) {
      throw bindingConflict('The supplied Stripe customer does not match the canonical billing account.', {
        canonicalCustomerId,
        observedCustomerId: suppliedCustomer,
      })
    }

    let paymentMethodId = suppliedPaymentMethod
    if (sessionId) {
      if (!stripe?.checkout?.sessions?.retrieve) {
        throw bindingConflict('Stripe Checkout Session verification is unavailable.')
      }
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent.payment_method', 'setup_intent.payment_method'],
      })
      const observedSessionId = objectId(session)
      const sessionCustomerId = objectId(session?.customer)
      const checkoutType = String(session?.metadata?.checkoutType ?? '')
      if (
        observedSessionId !== sessionId
        || !['enrollment', 'annual_membership'].includes(checkoutType)
        || String(session?.metadata?.familyBillingAccountId ?? '') !== String(accountId)
        || sessionCustomerId !== canonicalCustomerId
      ) {
        throw bindingConflict('The Checkout Session does not belong to the canonical billing account.', {
          sessionId,
          observedSessionId,
          canonicalCustomerId,
          observedCustomerId: sessionCustomerId,
        })
      }

      let intent
      if (session.mode === 'payment') {
        intent = session.payment_intent
        if (typeof intent === 'string') {
          if (!stripe?.paymentIntents?.retrieve) {
            throw bindingConflict('Stripe PaymentIntent verification is unavailable.')
          }
          intent = await stripe.paymentIntents.retrieve(intent, { expand: ['payment_method'] })
        }
        if (
          session.status !== 'complete'
          || session.payment_status !== 'paid'
          || intent?.status !== 'succeeded'
          || objectId(intent?.customer) !== canonicalCustomerId
        ) {
          throw bindingConflict('The Checkout payment is not a succeeded payment for the canonical customer.', {
            sessionId,
          })
        }
      } else if (session.mode === 'setup') {
        intent = session.setup_intent
        if (typeof intent === 'string') {
          if (!stripe?.setupIntents?.retrieve) {
            throw bindingConflict('Stripe SetupIntent verification is unavailable.')
          }
          intent = await stripe.setupIntents.retrieve(intent, { expand: ['payment_method'] })
        }
        if (
          session.status !== 'complete'
          || intent?.status !== 'succeeded'
          || objectId(intent?.customer) !== canonicalCustomerId
        ) {
          throw bindingConflict('The Checkout setup is not a succeeded setup for the canonical customer.', {
            sessionId,
          })
        }
      } else {
        throw bindingConflict('Only completed payment or setup Checkout Sessions can save a payment method.', {
          sessionId,
        })
      }

      const sessionPaymentMethodId = objectId(intent?.payment_method)
      if (!sessionPaymentMethodId || (
        suppliedPaymentMethod && suppliedPaymentMethod !== sessionPaymentMethodId
      )) {
        throw bindingConflict('The Checkout payment method does not match the requested payment method.', {
          sessionId,
          observedPaymentMethodId: sessionPaymentMethodId,
        })
      }
      paymentMethodId = sessionPaymentMethodId
    }

    const customer = await stripe.customers.retrieve(canonicalCustomerId)
    const remoteCustomerId = objectId(customer)
    const remoteOwner = String(customer?.metadata?.familyBillingAccountId ?? '').trim()
    if (
      !customer
      || customer.deleted === true
      || remoteCustomerId !== canonicalCustomerId
      || (remoteOwner && remoteOwner !== String(accountId))
    ) {
      throw bindingConflict('The canonical Stripe customer could not be verified for this billing account.', {
        canonicalCustomerId,
        observedCustomerId: remoteCustomerId,
      })
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
    if (
      objectId(paymentMethod) !== paymentMethodId
      || objectId(paymentMethod?.customer) !== canonicalCustomerId
      || !['card', 'link'].includes(String(paymentMethod?.type ?? ''))
    ) {
      throw bindingConflict('The payment method is not an eligible method owned by the canonical Stripe customer.', {
        canonicalCustomerId,
        paymentMethodId,
        observedCustomerId: objectId(paymentMethod?.customer),
        paymentMethodType: paymentMethod?.type ?? null,
      })
    }

    // Stripe verification above performs network I/O but holds no database
    // transaction. Re-read immediately before the remote mutation so even a
    // non-cooperating local remap fails closed while our advisory lock is held.
    const currentAccount = await loadCanonicalAccount(db, accountId)
    if (
      currentAccount?.is_active !== true
      || objectId(currentAccount?.stripe_customer_id) !== canonicalCustomerId
      || Number(currentAccount?.stripe_customer_owner_count) !== 1
    ) {
      throw bindingConflict('The canonical Stripe customer changed during payment-method verification.', {
        canonicalCustomerId,
        observedCustomerId: objectId(currentAccount?.stripe_customer_id),
      })
    }

    await stripe.customers.update(canonicalCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })
    return {
      customerId: canonicalCustomerId,
      defaultPaymentMethodId: paymentMethodId,
      saved: true,
    }
  })
}

/**
 * Preserve the annual-membership renewal schedule locally after Checkout.
 * Future remote Stripe Subscription creation is retired; Checkout may still
 * save the payment method for canonical household and balance collection.
 */
export async function createEnrollmentAnnualMembershipSubscriptions(
  pool,
  stripe,
  {
    preview,
    stripeSession,
    familyBillingAccountId,
    memberId,
    purchasedAt = new Date(),
    environment = process.env,
  },
) {
  if (familyBillingAccountId == null || memberId == null) return []
  billingStripeSubscriptionCreationAllowed(environment)

  const feeItems = (preview?.additionalFees?.items ?? []).filter((fee) => {
    // Renewal bills at the full (gross) fee — a promo only waives/discounts year 1.
    const renewalCents = Math.round(Number(fee.grossAmountCents ?? fee.amountCents) || 0)
    if (renewalCents <= 0 || fee.feeId == null) return false
    return fee.triggerType === 'once_per_year' || fee.applyBasis === 'per_year'
  })
  if (feeItems.length === 0) return []

  if (stripe) {
    await preserveEnrollmentCheckoutPaymentMethod(pool, stripe, {
      stripeSession,
      familyBillingAccountId,
    })
  }

  const memberRes = await pool.query(
    `SELECT first_name, last_name FROM member WHERE id = $1`,
    [memberId],
  )
  const athleteName = [memberRes.rows[0]?.first_name, memberRes.rows[0]?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()

  const renewsOnDate = membershipRenewsOnFromPurchase(purchasedAt)
  const renewsOn = toUtcDateString(renewsOnDate)
  if (!renewsOn) return []
  const startDate = toUtcDateString(purchasedAt) || renewsOn
  const anchorDay = renewsOnDate.getUTCDate()
  const created = []

  for (const fee of feeItems) {
    const standardAmountCents = Math.round(Number(fee.grossAmountCents ?? fee.amountCents) || 0)
    const sourceId = `${fee.feeId}:${memberId}`
    const productName = [fee.name || 'Annual membership', athleteName]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 200)

    const existing = await pool.query(
      `
        SELECT id, stripe_subscription_id
        FROM billing_subscription
        WHERE source_type = $1 AND source_id = $2 AND status <> 'cancelled'
        LIMIT 1
      `,
      [ANNUAL_MEMBERSHIP_SOURCE_TYPE, sourceId],
    )
    if (existing.rows[0]?.stripe_subscription_id) {
      const error = new Error(
        `Annual membership schedule ${existing.rows[0].id} is still linked to a Stripe Subscription; local ledger activation is blocked.`,
      )
      error.code = 'ANNUAL_STRIPE_COLLECTOR_STILL_LINKED'
      error.billingSubscriptionId = Number(existing.rows[0].id)
      error.stripeSubscriptionId = String(existing.rows[0].stripe_subscription_id)
      throw error
    }

    // A staff member can configure a future renewal before the first annual
    // subscription exists. Use that athlete-specific instruction here without
    // changing the fee collected for the current membership term.
    let renewalInstruction = null
    try {
      renewalInstruction = await pool.query(
        `SELECT * FROM annual_membership_renewal_pricing
          WHERE family_billing_account_id = $1 AND member_id = $2 AND additional_fee_id = $3
          LIMIT 1`,
        [familyBillingAccountId, memberId, fee.feeId],
      ).then((result) => result.rows[0] ?? null)
    } catch (error) {
      if (error?.code !== '42P01') throw error
    }
    const amountCents = renewalInstruction
      ? Math.max(0, Math.round(Number(renewalInstruction.final_amount_cents) || 0))
      : standardAmountCents

    let billingSubId = existing.rows[0]?.id != null ? Number(existing.rows[0].id) : null
    if (billingSubId == null) {
      const ins = await pool.query(
        `
          INSERT INTO billing_subscription
            (family_billing_account_id, member_id, source_type, source_id, description,
             monthly_amount_cents, discount_amount_cents, net_monthly_cents, status,
             start_date, anchor_day, next_bill_date, pricing_option_key, auto_renewal)
          VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 'active', $6, $7, $8, $9, TRUE)
          ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL AND status <> 'cancelled'
          DO UPDATE SET
            description = EXCLUDED.description,
            next_bill_date = EXCLUDED.next_bill_date,
            auto_renewal = CASE
              WHEN billing_subscription.stripe_subscription_id IS NULL THEN TRUE
              ELSE billing_subscription.auto_renewal
            END,
            updated_at = now()
          RETURNING id, stripe_subscription_id, auto_renewal
        `,
        [
          familyBillingAccountId,
          memberId,
          ANNUAL_MEMBERSHIP_SOURCE_TYPE,
          sourceId,
          productName,
          startDate,
          anchorDay,
          renewsOn,
          ANNUAL_MEMBERSHIP_PRICING_KEY,
        ],
      )
      billingSubId = Number(ins.rows[0].id)
    } else {
      await pool.query(
        `UPDATE billing_subscription
         SET next_bill_date = $2, description = $3, auto_renewal = TRUE, updated_at = now()
         WHERE id = $1 AND stripe_subscription_id IS NULL`,
        [billingSubId, renewsOn, productName],
      )
    }

    if (renewalInstruction) {
      await pool.query(
        `UPDATE annual_membership_renewal_pricing
            SET sync_status = 'not_required',
                sync_error = NULL,
                updated_at = now()
          WHERE id = $1
            AND stripe_subscription_id IS NULL`,
        [renewalInstruction.id],
      )
    }
    created.push({
      billingSubscriptionId: billingSubId,
      stripeSubscriptionId: null,
      renewsOn,
      amountCents,
      autoRenewal: true,
      status: 'local_only',
    })
  }

  return created
}

function previewFingerprint(preview) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        dueNow: computeEnrollmentDueNowCents(preview),
        monthly: preview.estimatedMonthlyTotal,
        newCount: preview.newSignups?.length ?? 0,
        passTotal: preview.passPurchaseTotalCents ?? 0,
      }),
    )
    .digest('hex')
    .slice(0, 16)
}

/**
 * Price, reserve, create, and durably bind one enrollment Checkout while the
 * account-wide collection lock is held. The pending row is inserted before
 * the remote create, so a lost Stripe response remains a fail-closed balance
 * reservation that can only be resumed with the same request key.
 */
export async function createAndBindEnrollmentCheckoutSession(
  pool,
  stripe,
  {
    account,
    enrolledMemberId,
    payerMemberId,
    batchPayload,
    successUrl,
    cancelUrl,
    requestKey,
    requestFingerprint,
    previewRequest,
    loadPreview = null,
  },
) {
  const accountId = Number(account?.id)
  const athleteId = Number(enrolledMemberId)
  const payerId = Number(payerMemberId)
  if (
    !Number.isSafeInteger(accountId) || accountId <= 0
    || !Number.isSafeInteger(athleteId) || athleteId <= 0
    || !Number.isSafeInteger(payerId) || payerId <= 0
    || !requestKey
    || !requestFingerprint
  ) {
    throw enrollmentCheckoutAuthorizationError('Enrollment Checkout ownership is incomplete.')
  }

  return withBillingAccountCollectionLock(pool, accountId, async (db) => {
    const loadDurableRequest = () => db.query(
      `SELECT *
         FROM stripe_pending_enrollment
        WHERE family_billing_account_id = $1
          AND request_key = $2
        LIMIT 1`,
      [accountId, requestKey],
    ).then((result) => result.rows[0] ?? null)

    let durable = await loadDurableRequest()
    if (
      durable
      && (
        String(durable.request_fingerprint ?? '') !== requestFingerprint
        || Number(durable.member_id) !== athleteId
      )
    ) {
      throw checkoutIdempotencyConflict()
    }
    if (durable?.stripe_checkout_session_id) {
      const replay = await stripe.checkout.sessions.retrieve(
        String(durable.stripe_checkout_session_id),
      )
      return {
        session: replay,
        pending: durable,
        pendingEnrollmentId: Number(durable.id),
        preview: parsePendingPayload(durable.preview_snapshot),
        replayed: true,
      }
    }
    if (durable?.status === 'completed') {
      return {
        alreadyCompleted: true,
        skipCheckout: true,
        pendingEnrollmentId: Number(durable.id),
        preview: parsePendingPayload(durable.preview_snapshot),
        replayed: true,
      }
    }
    if (durable && ['failed', 'expired'].includes(String(durable.status ?? ''))) {
      throw checkoutIdempotencyConflict(
        'This enrollment checkout request can no longer be resumed. Start it again with a new Idempotency-Key.',
      )
    }

    const freshPreview = durable
      ? null
      : loadPreview
        ? await loadPreview(db)
        : await buildSignupOrderPreview(db, previewRequest)
    let preview = durable
      ? parsePendingPayload(durable.preview_snapshot)
      : freshPreview
    const dueNowCents = computeEnrollmentDueNowCents(preview)
    const purchaseCents = computeEnrollmentCheckoutPurchaseCents(preview)
    const mode = resolveEnrollmentCheckoutMode(preview)

    if (durable) {
      if (
        !preview
        || Number(durable.due_now_cents) !== dueNowCents
        || String(durable.checkout_mode ?? '') !== mode
      ) {
        throw checkoutIdempotencyConflict(
          'The durable enrollment pricing snapshot is inconsistent. Keep this request reserved for review and do not start another payment.',
        )
      }
    }

    if (!enrollmentNeedsStripeCheckout(preview)) {
      return { skipCheckout: true, preview }
    }

    const hasRecurring = enrollmentHasRecurringMembership(preview)
    const storedLineItems = durable && Array.isArray(preview?.stripeCheckoutLineItems)
      ? preview.stripeCheckoutLineItems
      : null
    const lineItems = mode === 'setup'
      ? []
      : storedLineItems ?? await buildCheckoutLineItems(db, preview)
    if (mode === 'payment' && lineItems.length === 0) {
      if (durable) {
        throw checkoutIdempotencyConflict(
          'The durable enrollment Checkout has no immutable payment lines. Keep it reserved for review.',
        )
      }
      return { skipCheckout: true, preview }
    }
    if (!durable) {
      // Stripe treats an idempotency-key retry with different parameters as a
      // conflict. Preserve resolved catalog Price IDs and ad-hoc price_data in
      // the authoritative snapshot before the first remote create so a lost
      // response can be replayed byte-for-byte even if catalog mappings move.
      preview = { ...preview, stripeCheckoutLineItems: lineItems }
    }

    // Customer verification itself uses this same re-entrant session lock.
    // It runs before the pending insert so a known pre-Checkout failure cannot
    // strand a balance reservation with no possible remote payment surface.
    const customerId = await ensureStripeCustomer(db, stripe, account)

    let transactionOpen = false
    try {
      await db.query('BEGIN')
      transactionOpen = true
      const lockedAccount = await db.query(
        `SELECT account.id,
                account.family_id,
                account.payer_member_id,
                account.stripe_customer_id,
                account.is_active,
                (
                  SELECT COUNT(*)::integer
                    FROM family_billing_account customer_owner
                   WHERE customer_owner.stripe_customer_id = account.stripe_customer_id
                ) AS stripe_customer_owner_count
           FROM family_billing_account account
          WHERE account.id = $1
          LIMIT 1
          FOR UPDATE`,
        [accountId],
      ).then((result) => result.rows[0] ?? null)
      if (
        !lockedAccount
        || lockedAccount.is_active !== true
        || Number(lockedAccount.payer_member_id) !== payerId
        || (
          account.family_id != null
          && Number(lockedAccount.family_id) !== Number(account.family_id)
        )
        || String(lockedAccount.stripe_customer_id ?? '') !== String(customerId)
        || Number(lockedAccount.stripe_customer_owner_count) !== 1
      ) {
        throw enrollmentCheckoutAuthorizationError(
          'The active payer or canonical Stripe customer changed before Checkout creation.',
        )
      }
      await assertEnrollmentCheckoutMemberScope(db, {
        familyBillingAccountId: accountId,
        memberId: athleteId,
        payerMemberId: payerId,
      })

      durable = await db.query(
        `SELECT *
           FROM stripe_pending_enrollment
          WHERE family_billing_account_id = $1
            AND request_key = $2
          LIMIT 1
          FOR UPDATE`,
        [accountId, requestKey],
      ).then((result) => result.rows[0] ?? null)
      if (
        durable
        && (
          String(durable.request_fingerprint ?? '') !== requestFingerprint
          || Number(durable.member_id) !== athleteId
          || Number(durable.due_now_cents) !== dueNowCents
          || String(durable.checkout_mode ?? '') !== mode
        )
      ) {
        throw checkoutIdempotencyConflict()
      }
      if (durable?.stripe_checkout_session_id) {
        throw checkoutIdempotencyConflict(
          'Enrollment checkout session binding changed during creation. Retry the same request.',
        )
      }
      if (durable && String(durable.status ?? '') !== 'pending') {
        throw checkoutIdempotencyConflict(
          'This enrollment checkout request can no longer open a new payment session.',
        )
      }

      const activePurchaseCheckout = await findActivePurchaseCheckoutOwner(db, accountId, {
        excludePendingEnrollmentId: durable?.id ?? null,
      })
      if (activePurchaseCheckout) {
        throw enrollmentCheckoutCollectionConflict(
          activePurchaseCheckout,
          'This household already has a payable enrollment or annual-membership Checkout. Resume or reconcile it before opening another purchase Checkout.',
        )
      }

      const completedCheckoutGap = await findCompletedPaidCheckoutFulfillmentGap(db, accountId)
      if (completedCheckoutGap) {
        throw enrollmentCheckoutCollectionConflict(
          completedCheckoutGap,
          'This household has a completed paid Checkout without exact local fulfillment. Reconcile it before opening another purchase Checkout.',
        )
      }

      if (dueNowCents > purchaseCents) {
        const activeOwner = await findEnrollmentCheckoutCreationConflict(db, accountId)
        if (activeOwner) throw enrollmentCheckoutCollectionConflict(activeOwner)

        const activeEnrollmentCheckout = await findActiveEnrollmentCheckoutBalanceCollector(
          db,
          accountId,
          { excludePendingEnrollmentId: durable?.id ?? null },
        )
        if (activeEnrollmentCheckout) {
          throw enrollmentCheckoutCollectionConflict(activeEnrollmentCheckout)
        }
      }

      if (!durable) {
        durable = await db.query(
          `INSERT INTO stripe_pending_enrollment (
             family_billing_account_id, member_id, payload, preview_snapshot,
             due_now_cents, checkout_mode, status, request_key, request_fingerprint
           ) VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8)
           ON CONFLICT (family_billing_account_id, request_key)
             WHERE request_key IS NOT NULL
           DO NOTHING
           RETURNING *`,
          [
            accountId,
            athleteId,
            JSON.stringify(batchPayload),
            JSON.stringify(preview),
            dueNowCents,
            mode,
            requestKey,
            requestFingerprint,
          ],
        ).then((result) => result.rows[0] ?? null)
        if (!durable) throw checkoutIdempotencyConflict()
      }
      await db.query('COMMIT')
      transactionOpen = false
    } catch (error) {
      if (transactionOpen) await db.query('ROLLBACK').catch(() => {})
      throw error
    }

    const pendingId = Number(durable.id)
    const sessionParams = {
      mode,
      customer: customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        checkoutType: 'enrollment',
        pendingEnrollmentId: String(pendingId),
        familyBillingAccountId: String(accountId),
        memberId: String(athleteId),
        payerMemberId: String(payerId),
        previewHash: previewFingerprint(preview),
        hasRecurring: hasRecurring ? 'true' : 'false',
        perClassSubscriptions: 'false',
        householdCollection: hasRecurring ? 'true' : 'false',
      },
    }
    if (mode === 'setup') {
      sessionParams.currency = 'usd'
    } else {
      sessionParams.line_items = lineItems
      sessionParams.payment_intent_data = { setup_future_usage: 'off_session' }
    }
    if (hasRecurring && shouldShowEnrollmentCheckoutSubmitMessage(preview)) {
      sessionParams.custom_text = {
        submit: { message: formatEnrollmentCheckoutSubmitMessage() },
      }
    }

    // Once this call starts, any error is ambiguous: Stripe may have created
    // the payable Session even if the response was lost. Keep the pending row
    // active so only this deterministic idempotency key can recover it.
    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: stripeCheckoutIdempotencyKey(
        'member-enrollment-checkout',
        accountId,
        requestKey,
      ),
    })
    const expiresAt = Number(session?.expires_at)
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
      throw enrollmentCheckoutCollectionConflict(
        null,
        'Stripe did not return an exact Checkout expiration. The pending reservation was retained for reconciliation.',
      )
    }
    if (!['open', 'complete', 'expired'].includes(String(session?.status ?? ''))) {
      throw enrollmentCheckoutCollectionConflict(
        null,
        'Stripe returned an unsupported Checkout status. The pending reservation was retained for reconciliation.',
      )
    }
    if (session.status === 'open' && !session.url) {
      throw enrollmentCheckoutCollectionConflict(
        null,
        'Stripe did not return a payable Checkout URL. The pending reservation was retained for reconciliation.',
      )
    }

    let linkedPending
    transactionOpen = false
    try {
      await db.query('BEGIN')
      transactionOpen = true
      linkedPending = await db.query(
        `SELECT pending.*,
                account.family_id,
                account.payer_member_id,
                account.stripe_customer_id,
                account.is_active,
                (
                  SELECT COUNT(*)::integer
                    FROM family_billing_account customer_owner
                   WHERE customer_owner.stripe_customer_id = account.stripe_customer_id
                ) AS stripe_customer_owner_count
           FROM stripe_pending_enrollment pending
           JOIN family_billing_account account
             ON account.id = pending.family_billing_account_id
          WHERE pending.id = $1
            AND pending.request_fingerprint = $2
          LIMIT 1
          FOR UPDATE OF pending, account`,
        [pendingId, requestFingerprint],
      ).then((result) => result.rows[0] ?? null)
      if (!linkedPending) {
        throw checkoutIdempotencyConflict('Enrollment checkout reservation changed during creation.')
      }

      const paidSession = session.status === 'complete' && session.payment_status === 'paid'
      if (paidSession) {
        assertPaidEnrollmentCheckoutSettlementBinding(
          { ...linkedPending, stripe_checkout_session_id: session.id },
          session,
        )
      } else {
        if (
          linkedPending.is_active !== true
          || Number(linkedPending.payer_member_id) !== payerId
          || String(linkedPending.stripe_customer_id ?? '') !== String(customerId)
          || Number(linkedPending.stripe_customer_owner_count) !== 1
        ) {
          throw enrollmentCheckoutAuthorizationError(
            'The active payer or canonical Stripe customer changed before Checkout binding.',
          )
        }
        assertEnrollmentCheckoutSessionBinding(linkedPending, session)
      }

      const linked = await db.query(
        `UPDATE stripe_pending_enrollment
            SET stripe_checkout_session_id = $2,
                stripe_checkout_session_url = CASE WHEN $6 = 'open' THEN $3 ELSE NULL END,
                expires_at = to_timestamp($5::double precision),
                status = CASE WHEN $6 = 'expired' THEN 'expired' ELSE status END,
                error_message = CASE
                  WHEN $6 = 'expired' THEN 'Stripe Checkout Session expired.'
                  ELSE NULL
                END,
                updated_at = now()
          WHERE id = $1
            AND request_fingerprint = $4
            AND (stripe_checkout_session_id IS NULL OR stripe_checkout_session_id = $2)
            AND status IN ('pending', 'processing', 'failed', 'expired')
          RETURNING *`,
        [pendingId, session.id, session.url ?? null, requestFingerprint, expiresAt, session.status],
      ).then((result) => result.rows[0] ?? null)
      if (!linked) {
        throw checkoutIdempotencyConflict('Enrollment checkout session binding changed during creation.')
      }
      linkedPending = { ...linkedPending, ...linked }
      await db.query('COMMIT')
      transactionOpen = false
    } catch (error) {
      if (transactionOpen) await db.query('ROLLBACK').catch(() => {})
      throw error
    }

    return {
      session,
      pending: linkedPending,
      pendingEnrollmentId: pendingId,
      preview,
      replayed: false,
    }
  })
}

export async function createEnrollmentCheckoutSession(
  pool,
  { account, memberId, batchPayload, successUrl, cancelUrl, idempotencyKey },
) {
  if (!stripeEnabled()) return null
  await ensureStripeBillingSchema(pool)
  await ensureStripeCatalogSchema(pool)
  await ensurePendingEnrollmentSchema(pool)

  const stripe = await getStripeClient()
  if (!stripe) return null

  const slotSignups = (batchPayload.signups ?? []).filter((s) => s.lineType !== 'multi_class_pass')
  const passSignups = (batchPayload.signups ?? []).filter((s) => s.lineType === 'multi_class_pass')
  for (const signup of slotSignups) {
    signup.enrollmentStartDate = requireEnrollmentStartDate(signup.enrollmentStartDate)
  }

  // Fees, existing enrollments, and once-per-year redemptions are athlete-scoped.
  // Verify the signup token before resolving its athlete, then prove that athlete
  // belongs to the authenticated payer's billing family on the server.
  const enrolledMemberId = await resolveVerifiedEnrollmentMemberId(
    pool,
    batchPayload,
    memberId,
    { familyBillingAccountId: account.id },
  )
  await assertEnrollmentCheckoutMemberScope(pool, {
    familyBillingAccountId: account.id,
    memberId: enrolledMemberId,
    payerMemberId: memberId,
  })

  const requestKey = normalizeCheckoutRequestKey(
    idempotencyKey,
    'member-enrollment-checkout',
  )
  const requestFingerprint = checkoutFingerprint({
    accountId: Number(account.id),
    enrolledMemberId,
    payerMemberId: Number(memberId),
    batchPayload,
    successUrl: String(successUrl ?? ''),
    cancelUrl: String(cancelUrl ?? ''),
  })
  let existingRequest = await pool.query(
    `SELECT *
       FROM stripe_pending_enrollment
      WHERE family_billing_account_id = $1
        AND request_key = $2
      LIMIT 1`,
    [account.id, requestKey],
  ).then((result) => result.rows[0] ?? null)
  if (
    existingRequest &&
    (
      String(existingRequest.request_fingerprint ?? '') !== requestFingerprint ||
      Number(existingRequest.member_id) !== Number(enrolledMemberId)
    )
  ) {
    throw checkoutIdempotencyConflict()
  }
  if (
    existingRequest?.status === 'completed'
    && !existingRequest?.stripe_checkout_session_id
  ) {
    return {
      alreadyCompleted: true,
      skipCheckout: true,
      pendingEnrollmentId: Number(existingRequest.id),
      preview: existingRequest.preview_snapshot ?? null,
    }
  }
  if (
    !existingRequest?.stripe_checkout_session_id
    && ['failed', 'expired'].includes(String(existingRequest?.status ?? ''))
  ) {
    throw checkoutIdempotencyConflict(
      'This enrollment checkout request can no longer be resumed. Start it again with a new Idempotency-Key.',
    )
  }
  if (existingRequest?.stripe_checkout_session_id) {
    const replay = await stripe.checkout.sessions.retrieve(
      existingRequest.stripe_checkout_session_id,
    )
    if (
      replay?.status === 'complete'
      && (replay?.payment_status === 'paid' || replay?.mode === 'setup')
    ) {
      const commitResult = await commitPendingEnrollment(pool, {
        pendingEnrollmentId: Number(existingRequest.id),
        stripeSession: replay,
        expectedFamilyId: account.family_id,
        expectedPayerMemberId: memberId,
      })
      const terminalStatus = String(commitResult?.status ?? '')
      if (!['completed', 'already_completed', 'quarantined'].includes(terminalStatus)) {
        throw checkoutIdempotencyConflict(
          `The completed enrollment Checkout could not be finalized (${terminalStatus || 'unknown'}). Do not start another payment; contact support.`,
        )
      }
      return {
        ...commitResult,
        skipCheckout: true,
        alreadyCompleted: ['completed', 'already_completed'].includes(terminalStatus),
        requiresReview: terminalStatus === 'quarantined',
        pendingEnrollmentId: Number(existingRequest.id),
        preview: existingRequest.preview_snapshot ?? null,
        replayed: true,
      }
    }
    await authorizePendingEnrollmentCheckout(pool, {
      pendingEnrollmentId: Number(existingRequest.id),
      stripeSession: replay,
      expectedFamilyId: account.family_id,
      expectedPayerMemberId: memberId,
    })
    if (checkoutSessionHasForbiddenSubscriptionCollector(replay)) {
      await rejectForbiddenSubscriptionCheckoutCompletion(pool, {
        session: replay,
        checkoutKind: 'enrollment',
        accountId: account.id,
        pendingEnrollmentId: existingRequest.id,
      })
    }
    if (replay?.status === 'expired' && replay?.payment_status !== 'paid') {
      const replayExpiresAt = Number(replay.expires_at)
      await withBillingAccountCollectionLock(pool, account.id, async (db) => {
        await db.query(
          `UPDATE stripe_pending_enrollment
                  SET status = 'expired',
                  stripe_checkout_session_url = NULL,
                  expires_at = COALESCE(to_timestamp($3::double precision), expires_at),
                  error_message = 'Stripe Checkout Session expired.',
                  updated_at = now()
            WHERE id = $1
              AND stripe_checkout_session_id = $2
              AND status IN ('pending', 'processing', 'failed', 'expired')
              AND COALESCE(error_message, '') NOT LIKE $4`,
          [
            Number(existingRequest.id),
            String(replay.id),
            Number.isSafeInteger(replayExpiresAt) && replayExpiresAt > 0
              ? replayExpiresAt
              : null,
            `${PAID_ENROLLMENT_QUARANTINE_PREFIX}%`,
          ],
        )
      })
      throw checkoutIdempotencyConflict(
        'This enrollment Checkout expired. Start it again with a new Idempotency-Key.',
      )
    }
    if (replay?.status === 'open') {
      const replayExpiresAt = Number(replay.expires_at)
      if (!replay?.url || !Number.isSafeInteger(replayExpiresAt) || replayExpiresAt <= 0) {
        throw checkoutIdempotencyConflict(
          'Stripe did not return a complete payable Checkout state. Keep this request reserved for reconciliation.',
        )
      }
      const refreshed = await withBillingAccountCollectionLock(pool, account.id, async (db) => db.query(
        `UPDATE stripe_pending_enrollment
            SET status = CASE WHEN status = 'expired' THEN 'pending' ELSE status END,
                stripe_checkout_session_url = $3,
                expires_at = to_timestamp($4::double precision),
                error_message = CASE WHEN status = 'expired' THEN NULL ELSE error_message END,
                updated_at = now()
          WHERE id = $1
            AND stripe_checkout_session_id = $2
            AND status IN ('pending', 'processing', 'failed', 'expired')
            AND COALESCE(error_message, '') NOT LIKE $5
          RETURNING status, error_message`,
        [
          Number(existingRequest.id),
          String(replay.id),
          String(replay.url),
          replayExpiresAt,
          `${PAID_ENROLLMENT_QUARANTINE_PREFIX}%`,
        ],
      ).then((result) => result.rows[0] ?? null))
      if (refreshed) existingRequest = { ...existingRequest, ...refreshed }
    }
    if (existingRequest.status === 'completed') {
      throw checkoutIdempotencyConflict(
        'The completed enrollment request does not match a completed Stripe Checkout. Reconcile it before starting another payment.',
      )
    }
    if (['failed', 'expired'].includes(String(existingRequest.status ?? ''))) {
      throw checkoutIdempotencyConflict(
        'This enrollment checkout request can no longer be resumed. Start it again with a new Idempotency-Key.',
      )
    }
    if (replay?.status !== 'open' || !replay?.url) {
      throw checkoutIdempotencyConflict(
        'This enrollment Checkout is no longer payable. Do not start another payment until its status is reconciled.',
      )
    }
    return {
      url: replay.url,
      pendingEnrollmentId: Number(existingRequest.id),
      preview: existingRequest.preview_snapshot ?? null,
      replayed: true,
    }
  }

  const previewRequest = {
    memberId: enrolledMemberId,
    newSignups: [
      ...slotSignups.map((s) => ({
        formId: s.formId,
        slotGroupId: s.slotGroupId,
        timeSlotId: s.timeSlotId,
        formTitle: s.formTitle,
        selectedPricingOptionKey: s.selectedPricingOptionKey,
        useMultiClassPass: s.useMultiClassPass,
        enrollmentStartDate: s.enrollmentStartDate,
        lineType: 'slot',
      })),
      ...passSignups.map((p) => ({
        lineType: 'multi_class_pass',
        programsId: p.programsId,
        packageId: p.packageId,
      })),
    ],
    promoCodes: batchPayload.promoCodes ?? [],
  }
  const creation = await createAndBindEnrollmentCheckoutSession(pool, stripe, {
    account,
    enrolledMemberId,
    payerMemberId: memberId,
    batchPayload,
    successUrl,
    cancelUrl,
    requestKey,
    requestFingerprint,
    previewRequest,
  })
  if (creation.skipCheckout) return creation

  const { session, pendingEnrollmentId, preview } = creation
  const isPaid = session?.status === 'complete' && session?.payment_status === 'paid'
  const isCompletedSetup = session?.status === 'complete' && session?.mode === 'setup'
  if (isPaid || isCompletedSetup) {
    const commitResult = await commitPendingEnrollment(pool, {
      pendingEnrollmentId,
      stripeSession: session,
      expectedFamilyId: account.family_id,
      expectedPayerMemberId: memberId,
    })
    const terminalStatus = String(commitResult?.status ?? '')
    if (!['completed', 'already_completed', 'quarantined'].includes(terminalStatus)) {
      throw checkoutIdempotencyConflict(
        `The completed enrollment Checkout could not be finalized (${terminalStatus || 'unknown'}). Do not start another payment; contact support.`,
      )
    }
    return {
      ...commitResult,
      skipCheckout: true,
      alreadyCompleted: ['completed', 'already_completed'].includes(terminalStatus),
      requiresReview: terminalStatus === 'quarantined',
      pendingEnrollmentId,
      preview,
      replayed: creation.replayed,
    }
  }
  await authorizePendingEnrollmentCheckout(pool, {
    pendingEnrollmentId,
    stripeSession: session,
    expectedFamilyId: account.family_id,
    expectedPayerMemberId: memberId,
  })
  if (checkoutSessionHasForbiddenSubscriptionCollector(session)) {
    await rejectForbiddenSubscriptionCheckoutCompletion(pool, {
      session,
      checkoutKind: 'enrollment',
      accountId: account.id,
      pendingEnrollmentId,
    })
  }
  if (session?.status === 'expired') {
    throw checkoutIdempotencyConflict(
      'This enrollment Checkout expired. Start it again with a new Idempotency-Key.',
    )
  }
  if (session?.status !== 'open' || !session?.url) {
    throw checkoutIdempotencyConflict(
      'This enrollment Checkout is no longer payable. Do not start another payment until its status is reconciled.',
    )
  }
  return {
    url: session.url,
    pendingEnrollmentId,
    preview,
    replayed: creation.replayed,
  }
}

async function findLatestFamilyEnrollmentReturn(pool, familyId) {
  const res = await pool.query(
    `SELECT pe.id, pe.stripe_checkout_session_id, pe.status
     FROM stripe_pending_enrollment pe
     JOIN family_billing_account fba ON fba.id = pe.family_billing_account_id
     WHERE fba.family_id = $1
       AND pe.created_at > now() - interval '7 days'
     ORDER BY pe.updated_at DESC
     LIMIT 1`,
    [familyId],
  )
  return res.rows[0] ?? null
}

/**
 * Commit enrollment after Stripe Checkout when the member returns to the portal.
 * Backup for webhook delivery — verifies payment with Stripe before creating signups.
 */
export async function confirmEnrollmentCheckoutSession(
  pool,
  { checkoutSessionId, pendingEnrollmentId, memberId, familyId, roles },
) {
  const stripe = await getStripeClient()
  if (!stripe) throw new Error('Online payments are not available right now.')

  let sessionId = checkoutSessionId ? String(checkoutSessionId).trim() : null
  let pendingId = pendingEnrollmentId ? Number(pendingEnrollmentId) : null

  if (!sessionId && !pendingId && familyId) {
    const latest = await findLatestFamilyEnrollmentReturn(pool, familyId)
    if (!latest) return { status: 'none' }
    if (latest.status === 'completed') return { status: 'already_completed' }
    pendingId = Number(latest.id)
    sessionId = latest.stripe_checkout_session_id ?? null
  }

  if (!sessionId && pendingId) {
    const pendingRes = await pool.query(
      `SELECT stripe_checkout_session_id FROM stripe_pending_enrollment WHERE id = $1`,
      [pendingId],
    )
    sessionId = pendingRes.rows[0]?.stripe_checkout_session_id ?? null
  }

  if (!sessionId) {
    return { status: 'none' }
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.metadata?.checkoutType !== 'enrollment') {
    throw new Error('This checkout session is not an enrollment payment.')
  }

  pendingId = pendingId || Number(session.metadata?.pendingEnrollmentId)
  if (!pendingId) throw new Error('Enrollment reference missing from checkout session.')

  const pendingRes = await pool.query(
    `SELECT pe.*, fba.family_id, fba.payer_member_id, fba.stripe_customer_id
     FROM stripe_pending_enrollment pe
     JOIN family_billing_account fba ON fba.id = pe.family_billing_account_id
     WHERE pe.id = $1`,
    [pendingId],
  )
  const pending = pendingRes.rows[0]
  if (!pending) throw new Error('Enrollment checkout not found.')
  if (Number(pending.family_id) !== Number(familyId)) {
    throw new Error('This enrollment belongs to a different family account.')
  }

  const canPay =
    Number(pending.payer_member_id) === Number(memberId)
  if (!canPay) {
    throw new Error('Only the family payer or a guardian can confirm enrollment checkout.')
  }

  if (pending.stripe_checkout_session_id && pending.stripe_checkout_session_id !== session.id) {
    throw new Error('Checkout session does not match this enrollment.')
  }

  const paidForbiddenCollector = checkoutSessionHasForbiddenSubscriptionCollector(session)
    && session?.status === 'complete'
    && session?.payment_status === 'paid'
  if (!paidForbiddenCollector) {
    await rejectForbiddenSubscriptionCheckoutCompletion(pool, {
      session,
      checkoutKind: 'enrollment',
      pendingEnrollmentId: pendingId,
      accountId: pending.family_billing_account_id,
    })
  }

  if (!paidForbiddenCollector && !enrollmentCheckoutSessionCanFinalize(session, pending)) {
    throw new Error('Payment is not complete yet. If you were charged, please wait a moment and refresh.')
  }

  const commitResult = await commitPendingEnrollment(pool, {
    pendingEnrollmentId: pendingId,
    stripeSession: session,
    expectedFamilyId: familyId,
    expectedPayerMemberId: memberId,
  })

  if (commitResult.status === 'not_found') {
    throw new Error('Enrollment checkout not found.')
  }

  if (commitResult.status === 'in_progress') {
    throw new Error(
      'Enrollment is still being finalized. Please wait a moment and refresh this page.',
    )
  }

  if (commitResult.status !== 'completed' && commitResult.status !== 'already_completed') {
    return commitResult
  }

  const payment = session.payment_status === 'paid' ? commitResult.payment : null
  if (session.payment_status === 'paid' && !payment) {
    throw new Error(
      'Enrollment payment was collected but its exact ledger settlement is incomplete. Do not pay again.',
    )
  }

  // Fire-once flag for the browser-side vortex_purchase dataLayer push (GTM
  // Google Ads conversion): only the first confirm after payment returns
  // firstConfirmation=true, so refresh/revisit never re-fires the conversion.
  const confirmStamp = await pool.query(
    `UPDATE stripe_pending_enrollment
     SET client_confirmed_at = now(), updated_at = now()
     WHERE id = $1 AND client_confirmed_at IS NULL
     RETURNING id`,
    [pendingId],
  )
  const firstConfirmation = (confirmStamp.rowCount ?? 0) > 0

  const purchase = {
    transactionId:
      payment?.stripe_payment_intent_id || payment?.stripe_checkout_session_id || session.id,
    valueCents: Number(payment?.amount_cents ?? session.amount_total) || 0,
    currency: 'USD',
    enrollmentType:
      pending.checkout_mode === 'setup' ||
      pending.checkout_mode === 'subscription' ||
      session.metadata?.hasRecurring === 'true'
        ? 'recurring'
        : 'one_time',
    paymentType: 'initial_enrollment',
  }

  return { ...commitResult, firstConfirmation, purchase }
}

/**
 * Payment-mode Checkout must be paid. The sole no-payment exception is a
 * completed Setup Checkout whose remote mode matches the durable pending row.
 * Requiring both sides prevents a forged/stale session from using `complete`
 * alone to create an enrollment before delayed payment settles.
 */
export function enrollmentCheckoutSessionCanFinalize(session, pending) {
  if (checkoutSessionHasForbiddenSubscriptionCollector(session)) return false
  const remoteMode = String(session?.mode ?? '')
  const durableMode = String(pending?.checkout_mode ?? '')
  if (!remoteMode || remoteMode !== durableMode) return false
  try {
    assertEnrollmentCheckoutSessionBinding(pending, session)
  } catch {
    return false
  }
  if (durableMode === 'setup') {
    return session?.status === 'complete'
  }
  return session?.payment_status === 'paid'
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAlreadySignedUpError(err) {
  return (
    err?.code === 'ALREADY_SIGNED_UP' ||
    /already signed up/i.test(String(err?.message ?? ''))
  )
}

/** Recover signup ids when a prior commit created rows but never marked completed. */
export async function findExistingSignupIdsForEnrollmentPayload(pool, payload, memberId) {
  const body = typeof payload === 'string' ? JSON.parse(payload) : payload
  const ids = []
  for (const entry of body?.signups ?? []) {
    if (entry?.formId == null || entry?.slotGroupId == null) continue
    const timeSlotId = entry.timeSlotId != null ? Number(entry.timeSlotId) : null
    const res = await pool.query(
      `
        SELECT id FROM scheduling_signup
        WHERE member_id = $1
          AND form_id = $2
          AND slot_group_id = $3
          AND ($4::bigint IS NULL OR time_slot_id = $4)
          AND orphaned_at IS NULL
          AND status IN ('confirmed', 'waitlisted')
        ORDER BY id DESC
        LIMIT 1
      `,
      [Number(memberId), Number(entry.formId), Number(entry.slotGroupId), timeSlotId],
    )
    if (res.rows[0]?.id != null) ids.push(Number(res.rows[0].id))
  }
  return ids
}

export function assertEnrollmentCheckoutSessionBinding(pending, stripeSession) {
  if (!stripeSession) return
  const metadata = stripeSession.metadata ?? {}
  const pendingId = Number(pending.id)
  const accountId = Number(pending.family_billing_account_id)
  const memberId = Number(pending.member_id)
  const payerMemberId = Number(pending.payer_member_id)
  const expectedAmountCents = Number(pending.due_now_cents)
  const checkoutMode = String(pending.checkout_mode ?? '')
  const expectedCustomerId = String(pending.stripe_customer_id ?? '').trim()
  const observedCustomerId = typeof stripeSession.customer === 'string'
    ? stripeSession.customer
    : stripeSession.customer?.id ?? null
  const observedAmountCents = stripeSession.amount_total == null && checkoutMode === 'setup'
    ? 0
    : Number(stripeSession.amount_total)
  // Historical subscription-mode sessions are rejected by the dedicated
  // legacy-collector guard immediately after authorization.
  const settlementMustMatch = checkoutMode !== 'subscription'
  if (
    metadata.checkoutType !== 'enrollment' ||
    Number(metadata.pendingEnrollmentId) !== pendingId ||
    Number(metadata.familyBillingAccountId) !== accountId ||
    Number(metadata.memberId) !== memberId ||
    !Number.isSafeInteger(payerMemberId) ||
    payerMemberId <= 0 ||
    Number(metadata.payerMemberId) !== payerMemberId ||
    !expectedCustomerId ||
    String(observedCustomerId ?? '') !== expectedCustomerId ||
    (
      settlementMustMatch
      && (
        !['payment', 'setup'].includes(checkoutMode) ||
        String(stripeSession.mode ?? '') !== checkoutMode ||
        !Number.isSafeInteger(expectedAmountCents) ||
        expectedAmountCents < 0 ||
        !Number.isSafeInteger(observedAmountCents) ||
        observedAmountCents !== expectedAmountCents ||
        String(stripeSession.currency ?? '').toLowerCase() !== 'usd'
      )
    ) ||
    !stripeSession.id ||
    (pending.stripe_checkout_session_id &&
      String(pending.stripe_checkout_session_id) !== String(stripeSession.id))
  ) {
    throw enrollmentCheckoutAuthorizationError('Checkout session does not match this enrollment.')
  }
}

/**
 * Bind already-collected cash to the durable pending row without consulting
 * mutable account, payer, customer-link, or household-member state. Those
 * current-state checks still run separately before any signup is created.
 */
export function assertPaidEnrollmentCheckoutSettlementBinding(pending, stripeSession) {
  const metadata = stripeSession?.metadata ?? {}
  const pendingId = Number(pending?.id)
  const accountId = Number(pending?.family_billing_account_id)
  const memberId = Number(pending?.member_id)
  const expectedAmountCents = Number(pending?.due_now_cents)
  const expectedMode = String(pending?.checkout_mode ?? '')
  const observedCustomerId = typeof stripeSession?.customer === 'string'
    ? stripeSession.customer
    : stripeSession?.customer?.id ?? null
  const payerMemberId = Number(metadata.payerMemberId)
  const problems = []

  if (!Number.isSafeInteger(pendingId) || pendingId <= 0) problems.push('pending_enrollment_missing')
  if (!Number.isSafeInteger(accountId) || accountId <= 0) problems.push('billing_account_missing')
  if (!Number.isSafeInteger(memberId) || memberId <= 0) problems.push('member_missing')
  if (!stripeSession?.id) problems.push('checkout_session_missing')
  if (
    !pending?.stripe_checkout_session_id
    || String(pending.stripe_checkout_session_id) !== String(stripeSession?.id ?? '')
  ) problems.push('checkout_session_mismatch')
  if (metadata.checkoutType !== 'enrollment') problems.push('checkout_type_mismatch')
  if (Number(metadata.pendingEnrollmentId) !== pendingId) problems.push('pending_enrollment_mismatch')
  if (Number(metadata.familyBillingAccountId) !== accountId) problems.push('billing_account_mismatch')
  if (Number(metadata.memberId) !== memberId) problems.push('member_mismatch')
  if (!Number.isSafeInteger(payerMemberId) || payerMemberId <= 0) problems.push('payer_missing')
  if (
    !['payment', 'subscription'].includes(expectedMode)
    || stripeSession?.mode !== expectedMode
  ) {
    problems.push('checkout_mode_mismatch')
  }
  if (stripeSession?.status !== 'complete' || stripeSession?.payment_status !== 'paid') {
    problems.push('checkout_not_paid')
  }
  if (String(stripeSession?.currency ?? '').toLowerCase() !== 'usd') {
    problems.push('checkout_currency_mismatch')
  }
  if (
    !Number.isSafeInteger(expectedAmountCents)
    || expectedAmountCents <= 0
    || !Number.isSafeInteger(Number(stripeSession?.amount_total))
    || Number(stripeSession.amount_total) !== expectedAmountCents
  ) problems.push('checkout_amount_mismatch')
  if (!observedCustomerId) problems.push('stripe_customer_missing')

  if (problems.length > 0) {
    const error = enrollmentCheckoutAuthorizationError(
      'Paid Checkout does not exactly match its durable pending enrollment.',
    )
    error.code = 'ENROLLMENT_CHECKOUT_SETTLEMENT_CONFLICT'
    error.details = {
      problems,
      pendingEnrollmentId: Number.isSafeInteger(pendingId) ? pendingId : null,
      familyBillingAccountId: Number.isSafeInteger(accountId) ? accountId : null,
      stripeCheckoutSessionId: stripeSession?.id ?? null,
    }
    throw error
  }

  return { pendingId, accountId, memberId, payerMemberId, expectedAmountCents }
}

async function loadPendingEnrollmentSettlementOwner(pool, pendingEnrollmentId) {
  const normalizedPendingId = Number(pendingEnrollmentId)
  if (!Number.isSafeInteger(normalizedPendingId) || normalizedPendingId <= 0) return null
  return pool.query(
    `SELECT id, family_billing_account_id, member_id, due_now_cents,
            checkout_mode, stripe_checkout_session_id, status, error_message,
            payload, preview_snapshot, created_at, updated_at
       FROM stripe_pending_enrollment
      WHERE id = $1
      LIMIT 1`,
    [normalizedPendingId],
  ).then((result) => result.rows[0] ?? null)
}

function paidEnrollmentAlreadyQuarantined(pending) {
  return String(pending?.status ?? '') === 'failed'
    && String(pending?.error_message ?? '').startsWith(PAID_ENROLLMENT_QUARANTINE_PREFIX)
}

async function quarantinePaidEnrollmentAuthorizationDrift(pool, {
  pending,
  stripeSession,
  payment,
  error,
}) {
  const reason = `${PAID_ENROLLMENT_QUARANTINE_PREFIX} ${String(
    error?.message ?? 'Current enrollment authorization changed after payment.',
  )}`.slice(0, 500)
  return withBillingAccountCollectionLock(
    pool,
    Number(pending.family_billing_account_id),
    async (db) => {
      let transactionOpen = false
      try {
        await db.query('BEGIN')
        transactionOpen = true
        const quarantined = await db.query(
          `UPDATE stripe_pending_enrollment
              SET status = 'failed',
                  error_message = $2,
                  updated_at = now()
            WHERE id = $1
              AND (
                status IN ('pending', 'expired')
                OR (
                  status = 'failed'
                  AND COALESCE(error_message, '') NOT LIKE $3
                )
                OR (
                  status = 'processing'
                  AND updated_at < now() - interval '2 minutes'
                )
              )
            RETURNING status, error_message`,
          [Number(pending.id), reason, `${PAID_ENROLLMENT_QUARANTINE_PREFIX}%`],
        ).then((result) => result.rows[0] ?? null)
        const owner = quarantined ?? await db.query(
          `SELECT status, error_message
             FROM stripe_pending_enrollment
            WHERE id = $1
            LIMIT 1
            FOR UPDATE`,
          [Number(pending.id)],
        ).then((result) => result.rows[0] ?? null)
        if (String(owner?.status ?? '') === 'completed') {
          await db.query('COMMIT')
          transactionOpen = false
          return { status: 'completed' }
        }
        if (
          !quarantined
          && !(
            String(owner?.status ?? '') === 'failed'
            && String(owner?.error_message ?? '').startsWith(PAID_ENROLLMENT_QUARANTINE_PREFIX)
          )
        ) {
          await db.query('COMMIT')
          transactionOpen = false
          return { status: 'in_progress' }
        }
        const quarantine = await recordPaidCheckoutFulfillmentQuarantine(db, {
          checkoutKind: 'enrollment',
          ownerId: Number(pending.id),
          accountId: Number(pending.family_billing_account_id),
          session: stripeSession,
          payment,
          reason,
        })
        await db.query('COMMIT')
        transactionOpen = false
        return { status: 'quarantined', reason, payment: quarantine.payment }
      } catch (error) {
        if (transactionOpen) await db.query('ROLLBACK').catch(() => {})
        throw error
      }
    },
  )
}

async function settleCompletedEnrollmentCheckout(pool, {
  pending,
  stripeSession,
  payment,
}) {
  const preview = typeof pending.preview_snapshot === 'string'
    ? JSON.parse(pending.preview_snapshot)
    : pending.preview_snapshot
  const payload = parsePendingPayload(pending.payload)
  const signupIds = await findExistingSignupIdsForEnrollmentPayload(
    pool,
    payload,
    Number(pending.member_id),
  )
  if (signupIds.length > 0 && preview) {
    await ensureEnrollmentLedgerRows(pool, {
      memberId: Number(pending.member_id),
      signupIds,
      preview,
      stripeCheckoutSessionId: stripeSession.id,
      purchasedAt: stripeSession.created
        ? new Date(stripeSession.created * 1000)
        : new Date(pending.created_at ?? Date.now()),
    })
  }
  const settledPayment = await withBillingAccountCollectionLock(
    pool,
    Number(pending.family_billing_account_id),
    async (db) => {
      const exact = await applyAndSettlePaidCheckoutFulfillment(db, {
        session: stripeSession,
        accountId: Number(pending.family_billing_account_id),
        payment,
        targetAmountCents: computeEnrollmentCheckoutPurchaseCents(preview),
        applicationNamespace: `enrollment-checkout:${Number(pending.id)}`,
        allocationReason: 'enrollment_checkout_exact',
      })
      await allocateHouseholdPaymentsLocked(db, {
        accountId: Number(pending.family_billing_account_id),
        actorType: 'stripe',
        idempotencyNamespace: `enrollment-checkout-remainder:${Number(pending.id)}`,
      })
      return exact
    },
  )
  void emitStripePurchaseEvent(pool, {
    payment: settledPayment,
    session: stripeSession,
    paymentType: 'initial_enrollment',
  })
  return settledPayment
}

/**
 * Re-authorize durable pending state before either browser-confirm or webhook
 * recovery can create signups. Payload JWT claims are intentionally ignored.
 */
export async function authorizePendingEnrollmentCheckout(pool, {
  pendingEnrollmentId,
  stripeSession = null,
  expectedFamilyId = null,
  expectedPayerMemberId = null,
}) {
  const normalizedPendingId = Number(pendingEnrollmentId)
  if (!Number.isInteger(normalizedPendingId) || normalizedPendingId <= 0) {
    throw enrollmentCheckoutAuthorizationError('Enrollment checkout not found.')
  }
  const result = await pool.query(
    `SELECT pending.id,
            pending.family_billing_account_id,
            pending.member_id,
            pending.due_now_cents,
            pending.checkout_mode,
            pending.stripe_checkout_session_id,
            pending.status,
            account.family_id,
            account.payer_member_id,
            account.stripe_customer_id
       FROM stripe_pending_enrollment pending
       JOIN family_billing_account account
         ON account.id = pending.family_billing_account_id
      WHERE pending.id = $1
        AND account.is_active = TRUE
      LIMIT 1`,
    [normalizedPendingId],
  )
  const pending = result.rows[0]
  if (!pending) throw enrollmentCheckoutAuthorizationError('Enrollment checkout not found.')
  const currentPayerMemberId = Number(pending.payer_member_id)
  if (!Number.isSafeInteger(currentPayerMemberId) || currentPayerMemberId <= 0) {
    throw enrollmentCheckoutAuthorizationError(
      'This household does not have an active payer for enrollment.',
    )
  }

  if (
    expectedFamilyId != null &&
    Number(pending.family_id) !== Number(expectedFamilyId)
  ) {
    throw enrollmentCheckoutAuthorizationError('This enrollment belongs to a different family account.')
  }
  if (
    expectedPayerMemberId != null &&
    Number(pending.payer_member_id) !== Number(expectedPayerMemberId)
  ) {
    throw enrollmentCheckoutAuthorizationError('Only the family payer can confirm enrollment checkout.')
  }

  await assertEnrollmentCheckoutMemberScope(pool, {
    familyBillingAccountId: pending.family_billing_account_id,
    memberId: pending.member_id,
    payerMemberId: currentPayerMemberId,
  })
  assertEnrollmentCheckoutSessionBinding(pending, stripeSession)
  return pending
}

/**
 * Freeze every mutable row/table that determines whether a paid pending
 * enrollment still belongs to this household.  The family_member table lock
 * is deliberate: locking only today's membership rows would not stop a
 * concurrent INSERT from creating membership history and invalidating the
 * legacy member.family_id fallback.  Callers must already be in a transaction
 * and keep it open through signup, exact payment application, and owner
 * completion.
 */
async function lockPaidEnrollmentAuthorizationScope(db, pendingEnrollmentId) {
  await db.query('LOCK TABLE family_member IN SHARE MODE')
  const locked = await db.query(
    `SELECT pending.id
       FROM stripe_pending_enrollment pending
       JOIN family_billing_account account
         ON account.id = pending.family_billing_account_id
       JOIN member enrolled_member
         ON enrolled_member.id = pending.member_id
       JOIN member payer_member
         ON payer_member.id = account.payer_member_id
      WHERE pending.id = $1
        AND account.is_active = TRUE
        AND enrolled_member.is_active = TRUE
        AND payer_member.is_active = TRUE
      FOR UPDATE OF pending
      FOR SHARE OF account, enrolled_member, payer_member`,
    [Number(pendingEnrollmentId)],
  )
  if (locked.rows.length !== 1) {
    throw enrollmentCheckoutAuthorizationError('Enrollment checkout authorization is no longer active.')
  }
}

/**
 * Claim → signup (no row lock) → ledger repair → completed → Stripe I/O.
 * Concurrent webhook + confirm: one worker claims; the other waits for completed.
 */
export async function commitPendingEnrollment(pool, {
  pendingEnrollmentId,
  stripeSession = null,
  expectedFamilyId = null,
  expectedPayerMemberId = null,
}) {
  let preFulfillmentPayment = null
  let settlementPending = null
  if (stripeSession?.payment_status === 'paid') {
    settlementPending = await loadPendingEnrollmentSettlementOwner(
      pool,
      pendingEnrollmentId,
    )
    if (!settlementPending) {
      const error = enrollmentCheckoutAuthorizationError(
        'Paid Checkout has no durable pending enrollment owner.',
      )
      error.code = 'ENROLLMENT_CHECKOUT_SETTLEMENT_CONFLICT'
      throw error
    }
    const settlement = assertPaidEnrollmentCheckoutSettlementBinding(
      settlementPending,
      stripeSession,
    )
    const stripe = await getStripeClient()
    preFulfillmentPayment = await recordEnrollmentStripePayment(pool, stripe, {
      session: stripeSession,
      accountId: settlement.accountId,
      fulfillmentPending: true,
    })

    // Replays must not reopen a payment that was deliberately quarantined after
    // current authorization drifted. Completed rows are checked after the
    // forbidden-collector guard so a stale live subscription remains visible.
    if (paidEnrollmentAlreadyQuarantined(settlementPending)) {
      const quarantine = await quarantinePaidEnrollmentAuthorizationDrift(pool, {
        pending: settlementPending,
        stripeSession,
        payment: preFulfillmentPayment,
        error: new Error(
          settlementPending.error_message ?? 'Paid enrollment Checkout requires refund review.',
        ),
      })
      preFulfillmentPayment = quarantine.payment
      return {
        status: 'quarantined',
        reason: 'paid_checkout_refund_required',
        payment: preFulfillmentPayment,
      }
    }
  }

  let authorizedPending
  try {
    await rejectForbiddenSubscriptionCheckoutCompletion(pool, {
      session: stripeSession,
      checkoutKind: 'enrollment',
      // Paid sessions first record cash and use the CAS quarantine below. Letting
      // this policy helper overwrite a concurrent `processing` claim could allow
      // the claimant to finish signup after the owner had been marked failed.
      pendingEnrollmentId: preFulfillmentPayment ? null : pendingEnrollmentId,
      accountId: settlementPending?.family_billing_account_id
        ?? stripeSession?.metadata?.familyBillingAccountId,
    })
    if (settlementPending?.status === 'completed') {
      preFulfillmentPayment = await settleCompletedEnrollmentCheckout(pool, {
        pending: settlementPending,
        stripeSession,
        payment: preFulfillmentPayment,
      })
      return { status: 'already_completed', payment: preFulfillmentPayment }
    }
    authorizedPending = await authorizePendingEnrollmentCheckout(pool, {
      pendingEnrollmentId,
      stripeSession,
      expectedFamilyId,
      expectedPayerMemberId,
    })
  } catch (error) {
    if (
      preFulfillmentPayment
      && [
        'ENROLLMENT_CHECKOUT_FORBIDDEN',
        FORBIDDEN_SUBSCRIPTION_CHECKOUT_CODE,
      ].includes(error?.code)
    ) {
      const quarantine = await quarantinePaidEnrollmentAuthorizationDrift(pool, {
        pending: settlementPending,
        stripeSession,
        payment: preFulfillmentPayment,
        error,
      })
      if (quarantine.status === 'completed') {
        preFulfillmentPayment = await settleCompletedEnrollmentCheckout(pool, {
          pending: settlementPending,
          stripeSession,
          payment: preFulfillmentPayment,
        })
        return { status: 'already_completed', payment: preFulfillmentPayment }
      }
      if (quarantine.status === 'in_progress') {
        return { status: 'in_progress', payment: preFulfillmentPayment }
      }
      return {
        status: 'quarantined',
        reason: 'current_authorization_changed_after_payment',
        payment: quarantine.payment,
      }
    }
    throw error
  }
  await ensureBillingRecurringSchema(pool)
  await ensurePendingEnrollmentSchema(pool)

  for (let attempt = 0; attempt < 16; attempt++) {
    const outcome = preFulfillmentPayment
      ? await withBillingAccountCollectionLock(
          pool,
          Number(settlementPending.family_billing_account_id),
          async (settlementDb) => {
            let transactionOpen = false
            try {
              await settlementDb.query('BEGIN')
              transactionOpen = true
              await lockPaidEnrollmentAuthorizationScope(settlementDb, pendingEnrollmentId)
              // The first authorization read happens before this transaction.
              // Re-read after locking the pending owner, account, payer, athlete,
              // and membership relation so even non-advisory-lock mutators
              // cannot change authority before exact settlement is committed.
              const lockedAuthorizedPending = await authorizePendingEnrollmentCheckout(
                settlementDb,
                {
                  pendingEnrollmentId,
                  stripeSession,
                  expectedFamilyId,
                  expectedPayerMemberId,
                },
              )
              const committed = await tryCommitPendingEnrollmentOnce(pool, {
                pendingEnrollmentId,
                stripeSession,
                authorizedPending: lockedAuthorizedPending,
                settlementDb,
                preFulfillmentPayment,
              })
              await settlementDb.query('COMMIT')
              transactionOpen = false
              return committed
            } catch (error) {
              if (transactionOpen) {
                await settlementDb.query('ROLLBACK').catch(() => {})
                transactionOpen = false
              }
              if (error?.code === 'ENROLLMENT_CHECKOUT_FORBIDDEN') {
                return { status: 'authorization_drift', error }
              }
              // Signup/ledger work commits on its own connection.  Preserve a
              // durable retry owner after rolling back every payment/application
              // mutation from this transaction.
              await settlementDb.query(
                `UPDATE stripe_pending_enrollment
                    SET status = 'failed', error_message = $2, updated_at = now()
                  WHERE id = $1
                    AND status IN ('pending', 'processing', 'failed')`,
                [pendingEnrollmentId, String(error?.message ?? error).slice(0, 500)],
              )
              throw error
            }
          },
        )
      : await tryCommitPendingEnrollmentOnce(pool, {
          pendingEnrollmentId,
          stripeSession,
          authorizedPending,
        })
    if (outcome.status === 'authorization_drift') {
      const quarantine = await quarantinePaidEnrollmentAuthorizationDrift(pool, {
        pending: settlementPending,
        stripeSession,
        payment: preFulfillmentPayment,
        error: outcome.error,
      })
      if (quarantine.status === 'completed') {
        const payment = await settleCompletedEnrollmentCheckout(pool, {
          pending: settlementPending,
          stripeSession,
          payment: preFulfillmentPayment,
        })
        return { status: 'already_completed', payment }
      }
      if (quarantine.status === 'in_progress') {
        return { status: 'in_progress', payment: preFulfillmentPayment }
      }
      return {
        status: 'quarantined',
        reason: 'current_authorization_changed_after_payment',
        payment: quarantine.payment,
      }
    }
    if (outcome.payment) preFulfillmentPayment = outcome.payment
    if (outcome.status !== 'in_progress') {
      if (
        preFulfillmentPayment
        && ['completed', 'already_completed'].includes(outcome.status)
        && !outcome.payment
      ) {
        preFulfillmentPayment = await settleCompletedEnrollmentCheckout(pool, {
          pending: settlementPending,
          stripeSession,
          payment: preFulfillmentPayment,
        })
      }
      if (outcome.postCommit) {
        await runEnrollmentPostCommitSideEffects(pool, outcome.postCommit)
      }
      if (outcome.payment) {
        void emitStripePurchaseEvent(pool, {
          payment: outcome.payment,
          session: stripeSession,
          paymentType: 'initial_enrollment',
        })
      }
      return preFulfillmentPayment ? { ...outcome, payment: preFulfillmentPayment } : outcome
    }
    await sleep(400 + attempt * 150)
  }

  const final = await pool.query(`SELECT status FROM stripe_pending_enrollment WHERE id = $1`, [
    pendingEnrollmentId,
  ])
  if (final.rows[0]?.status === 'completed') {
    if (preFulfillmentPayment) {
      preFulfillmentPayment = await settleCompletedEnrollmentCheckout(pool, {
        pending: settlementPending,
        stripeSession,
        payment: preFulfillmentPayment,
      })
    }
    return preFulfillmentPayment
      ? { status: 'already_completed', payment: preFulfillmentPayment }
      : { status: 'already_completed' }
  }
  return { status: 'in_progress' }
}

async function tryCommitPendingEnrollmentOnce(pool, {
  pendingEnrollmentId,
  stripeSession,
  authorizedPending,
  settlementDb = null,
  preFulfillmentPayment = null,
}) {
  const stateDb = settlementDb ?? pool
  // Claim quickly — never hold FOR UPDATE across signup / Stripe network I/O.
  const claim = await stateDb.query(
    `
      UPDATE stripe_pending_enrollment
      SET status = 'processing', error_message = NULL, updated_at = now()
      WHERE id = $1
        AND (
          status = 'pending'
          OR (
            status = 'failed'
            AND COALESCE(error_message, '') NOT LIKE $2
          )
          OR (status = 'processing' AND updated_at < now() - interval '2 minutes')
        )
      RETURNING *
    `,
    [pendingEnrollmentId, `${PAID_ENROLLMENT_QUARANTINE_PREFIX}%`],
  )
  const pending = claim.rows[0]
  if (!pending) {
    const existing = await stateDb.query(`SELECT status FROM stripe_pending_enrollment WHERE id = $1`, [
      pendingEnrollmentId,
    ])
    const status = existing.rows[0]?.status
    if (status === 'completed') return { status: 'already_completed' }
    if (status === 'processing') return { status: 'in_progress' }
    if (!status) return { status: 'not_found' }
    return { status: 'invalid', reason: status }
  }

  let signupIds = []
  let result = null
  const previewSnapshot =
    typeof pending.preview_snapshot === 'string'
      ? JSON.parse(pending.preview_snapshot)
      : pending.preview_snapshot
  const familyBillingAccountId = pending.family_billing_account_id
  const previewHasRecurring = enrollmentHasRecurringMembership(previewSnapshot ?? {})
  // pending.member_id was family-authorized before the claim. Never recover the
  // athlete from the stored payload: its original JWT may be expired or forged.
  const enrolledMemberId = Number(pending.member_id)

  try {
    if (
      Number(pending.family_billing_account_id) !==
        Number(authorizedPending.family_billing_account_id) ||
      enrolledMemberId !== Number(authorizedPending.member_id)
    ) {
      throw enrollmentCheckoutAuthorizationError(
        'Enrollment authority changed before the signup commit.',
      )
    }
    const refreshed = await refreshSignupAuthForCommit(
      pool,
      pending.payload,
      enrolledMemberId,
      {
        actorMemberId: Number(authorizedPending.payer_member_id),
        familyBillingAccountId: Number(authorizedPending.family_billing_account_id),
      },
    )
    const signupBatchPayload = stripSignupBatchPayload(refreshed)

    try {
      result = await executeSignupBatch(pool, signupBatchPayload, stripeSession?.id
        ? {
            stripeCheckoutSessionId: stripeSession.id,
            preview: previewSnapshot,
            purchasedAt: stripeSession.created
              ? new Date(stripeSession.created * 1000)
              : new Date(pending.created_at ?? Date.now()),
          }
        : null)
      signupIds = (result?.data?.signups ?? [])
        .map((row) => Number(row.id ?? row.signupId))
        .filter(Boolean)
    } catch (signupErr) {
      if (!isAlreadySignedUpError(signupErr)) throw signupErr
      signupIds = await findExistingSignupIdsForEnrollmentPayload(
        pool,
        signupBatchPayload,
        enrolledMemberId,
      )
      if (signupIds.length === 0) throw signupErr
      result = { success: true, data: { signups: signupIds.map((id) => ({ id })) }, recovered: true }
    }

    if (signupIds.length > 0 && previewSnapshot) {
      await ensureEnrollmentLedgerRows(pool, {
        memberId: enrolledMemberId,
        signupIds,
        preview: previewSnapshot,
        stripeCheckoutSessionId: stripeSession?.id ?? null,
        purchasedAt: stripeSession?.created
          ? new Date(stripeSession.created * 1000)
          : new Date(pending.created_at ?? Date.now()),
      })
    }
    if (stripeSession?.id && (result?.data?.purchasedPasses ?? []).length > 0) {
      await ensureEnrollmentPassLedgerRows(pool, {
        memberId: enrolledMemberId,
        purchasedPasses: result.data.purchasedPasses,
        stripeCheckoutSessionId: stripeSession.id,
      })
    }

    if (preFulfillmentPayment) {
      if (!settlementDb) throw new Error('Paid enrollment settlement lock is missing.')
      preFulfillmentPayment = await applyAndSettlePaidCheckoutFulfillment(settlementDb, {
        session: stripeSession,
        accountId: Number(familyBillingAccountId),
        payment: preFulfillmentPayment,
        targetAmountCents: computeEnrollmentCheckoutPurchaseCents(previewSnapshot),
        applicationNamespace: `enrollment-checkout:${Number(pendingEnrollmentId)}`,
        allocationReason: 'enrollment_checkout_exact',
        manageTransaction: false,
      })
      // Any explicit carried-forward portion is the only remaining cash and may
      // now flow through normal oldest/annual-first household allocation. The
      // session-level account lock is still held, so invoice creation cannot
      // interleave before these applications are durable.
      await allocateHouseholdPaymentsLocked(settlementDb, {
        accountId: Number(familyBillingAccountId),
        actorType: 'stripe',
        idempotencyNamespace: `enrollment-checkout-remainder:${Number(pendingEnrollmentId)}`,
        excludePendingEnrollmentId: Number(pendingEnrollmentId),
        manageTransaction: false,
      })
    }

    await stateDb.query(
      `UPDATE stripe_pending_enrollment
       SET status = 'completed', error_message = NULL, updated_at = now()
       WHERE id = $1`,
      [pendingEnrollmentId],
    )

  } catch (err) {
    // A paid path is wrapped by the caller's authorization/settlement
    // transaction. Let that caller roll back every partial application before
    // it records the durable retry state in a fresh transaction.
    if (!settlementDb) {
      await stateDb.query(
        `UPDATE stripe_pending_enrollment
         SET status = 'failed', error_message = $2, updated_at = now()
         WHERE id = $1 AND status IN ('processing', 'failed', 'pending')`,
        [pendingEnrollmentId, String(err.message ?? err).slice(0, 500)],
      )
    }
    throw err
  }

  return {
    status: 'completed',
    result,
    ...(preFulfillmentPayment ? { payment: preFulfillmentPayment } : {}),
    postCommit: {
      signupIds,
      previewSnapshot,
      previewHasRecurring,
      stripeSession,
      familyBillingAccountId,
      memberId: Number(pending.member_id),
      purchasedAt: stripeSession?.created
        ? new Date(stripeSession.created * 1000)
        : new Date(pending.created_at ?? Date.now()),
    },
  }
}

async function runEnrollmentPostCommitSideEffects(pool, {
  signupIds,
  previewSnapshot,
  previewHasRecurring,
  stripeSession,
  familyBillingAccountId,
  memberId,
  purchasedAt,
}) {
  // Stripe network I/O occurs only after the account collection lock is released.
  if (signupIds.length > 0 && previewSnapshot && previewHasRecurring && stripeSession) {
    try {
      const stripe = await getStripeClient()
      if (stripe) {
        await createEnrollmentStripeSubscriptions(pool, stripe, {
          preview: previewSnapshot,
          stripeSession,
          signupIds,
          familyBillingAccountId,
        })
      }
    } catch (err) {
      console.error('[stripe] preserve enrollment payment method after commit:', err)
    }
  }

  if (previewSnapshot && stripeSession && familyBillingAccountId != null && memberId != null) {
    try {
      const stripe = await getStripeClient()
      await createEnrollmentAnnualMembershipSubscriptions(pool, stripe, {
        preview: previewSnapshot,
        stripeSession,
        familyBillingAccountId,
        memberId: Number(memberId),
        purchasedAt,
      })
    } catch (err) {
      console.error('[billing] preserve annual membership renewal schedule after enrollment commit:', err)
    }
  }
}

/** Re-run ledger bridge when signup batch charge persistence was skipped/failed. */
export async function ensureEnrollmentLedgerRows(pool, {
  memberId,
  signupIds,
  preview,
  stripeCheckoutSessionId = null,
  purchasedAt = null,
}) {
  if (!memberId || !signupIds?.length || !preview) return { repaired: false }

  const missing = await pool.query(
    `
      SELECT ss.id AS signup_id, ss.form_id, ss.slot_group_id, ss.time_slot_id, sf.title
      FROM scheduling_signup ss
      JOIN scheduling_form sf ON sf.id = ss.form_id
      LEFT JOIN billing_subscription bs
        ON bs.source_type = 'scheduling_signup'
       AND bs.source_id = ss.id::text
       AND bs.status = 'active'
      WHERE ss.id = ANY($1::bigint[])
        AND ($2::text IS NOT NULL OR bs.id IS NULL)
    `,
    [signupIds, stripeCheckoutSessionId],
  )
  if (missing.rows.length === 0) return { repaired: false }

  const { persistSignupCharges } = await import('../scheduling/persistSignupCharges.js')
  await persistSignupCharges(pool, {
    memberId: Number(memberId),
    signups: missing.rows.map((row) => ({
      signupId: Number(row.signup_id),
      formId: Number(row.form_id),
      slotGroupId: Number(row.slot_group_id),
      timeSlotId: row.time_slot_id != null ? Number(row.time_slot_id) : null,
      formTitle: row.title,
      slotLabel: '',
    })),
    preview,
    stripeCheckoutSessionId,
    purchasedAt,
  })
  return { repaired: true, count: missing.rows.length }
}

/** Re-run exact pass-charge persistence when the post-signup bridge failed transiently. */
export async function ensureEnrollmentPassLedgerRows(pool, {
  memberId,
  purchasedPasses,
  stripeCheckoutSessionId,
}) {
  if (!memberId || !stripeCheckoutSessionId || !Array.isArray(purchasedPasses)) {
    return { repaired: false }
  }
  const { persistMultiClassPassPurchaseCharge } = await import(
    '../scheduling/persistMultiClassPassCharges.js'
  )
  let repaired = 0
  for (const purchased of purchasedPasses) {
    const passId = Number(purchased?.passId)
    const programsId = Number(purchased?.programsId)
    const priceCents = Number(purchased?.packageDef?.priceCents)
    if (
      !Number.isSafeInteger(passId)
      || passId <= 0
      || !Number.isSafeInteger(programsId)
      || programsId <= 0
      || !Number.isSafeInteger(priceCents)
      || priceCents < 0
    ) {
      throw new Error('Paid enrollment pass fulfillment is missing its exact durable purchase identity.')
    }
    const chargeId = await persistMultiClassPassPurchaseCharge(pool, {
      memberId: Number(memberId),
      passId,
      programsId,
      packageLabel: purchased.packageDef?.label ?? null,
      priceCents,
      programDisplayName: purchased.programDisplayName ?? null,
      stripeCheckoutSessionId,
    })
    if (!chargeId) {
      throw new Error(`Paid enrollment pass ${passId} could not be bound to its Checkout Session.`)
    }
    repaired += 1
  }
  return { repaired: repaired > 0, count: repaired }
}

export { getCatalogSyncStatus } from './stripeCatalogSync.js'
