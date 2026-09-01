/**
 * Stripe Checkout for member enrollment — pay-then-commit flow.
 * See docs/STRIPE_CATALOG_INTEGRATION.md Phase 2.
 */

import crypto from 'crypto'
import { getStripeClient, stripeEnabled, ensureStripeBillingSchema, ensureStripeCustomer, recordEnrollmentStripePayment } from './stripeBilling.js'
import { allocateHouseholdPayments } from './paymentAllocation.js'
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
  checkoutSessionHasForbiddenSubscriptionCollector,
  rejectForbiddenSubscriptionCheckoutCompletion,
} from './checkoutSessionCollectionPolicy.js'
import {
  checkoutFingerprint,
  checkoutIdempotencyConflict,
  normalizeCheckoutRequestKey,
  stripeCheckoutIdempotencyKey,
} from './checkoutIdempotency.js'

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

async function buildCheckoutLineItems(pool, preview) {
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
  const sessionId = typeof stripeSession === 'string' ? stripeSession : stripeSession?.id
  let customerId = suppliedCustomerId
  let defaultPaymentMethod = suppliedDefaultPaymentMethodId
  if (sessionId) {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent.payment_method', 'setup_intent.payment_method'],
    })
    customerId = session.customer
    defaultPaymentMethod =
      session.payment_intent?.payment_method ?? session.setup_intent?.payment_method ?? null
  } else if (!customerId && familyBillingAccountId != null) {
    const accountRes = await pool.query(
      `SELECT stripe_customer_id FROM family_billing_account WHERE id = $1`,
      [familyBillingAccountId],
    )
    customerId = accountRes.rows[0]?.stripe_customer_id ?? null
    if (customerId) {
      const customer = await stripe.customers.retrieve(customerId, {
        expand: ['invoice_settings.default_payment_method'],
      })
      if (!customer.deleted) {
        defaultPaymentMethod = customer.invoice_settings?.default_payment_method ?? null
      }
    }
  }
  if (!customerId) return { customerId: null, defaultPaymentMethodId: null, saved: false }

  if (defaultPaymentMethod && typeof defaultPaymentMethod === 'object') {
    defaultPaymentMethod = defaultPaymentMethod.id
  }
  let saved = false
  if (defaultPaymentMethod) {
    try {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: defaultPaymentMethod },
      })
      saved = true
    } catch (err) {
      console.warn('[stripe] set default payment method:', err.message)
    }
  }
  return {
    customerId: String(customerId),
    defaultPaymentMethodId: defaultPaymentMethod ? String(defaultPaymentMethod) : null,
    saved,
  }
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
  if (existingRequest?.status === 'completed') {
    return {
      alreadyCompleted: true,
      skipCheckout: true,
      pendingEnrollmentId: Number(existingRequest.id),
      preview: existingRequest.preview_snapshot ?? null,
    }
  }
  if (['failed', 'expired'].includes(String(existingRequest?.status ?? ''))) {
    throw checkoutIdempotencyConflict(
      'This enrollment checkout request can no longer be resumed. Start it again with a new Idempotency-Key.',
    )
  }
  if (existingRequest?.stripe_checkout_session_id) {
    const replay = await stripe.checkout.sessions.retrieve(
      existingRequest.stripe_checkout_session_id,
    )
    if (checkoutSessionHasForbiddenSubscriptionCollector(replay)) {
      await rejectForbiddenSubscriptionCheckoutCompletion(pool, {
        session: replay,
        checkoutKind: 'enrollment',
        accountId: account.id,
        pendingEnrollmentId: existingRequest.id,
      })
    }
    return {
      url: replay.url ?? existingRequest.stripe_checkout_session_url ?? null,
      pendingEnrollmentId: Number(existingRequest.id),
      preview: existingRequest.preview_snapshot ?? null,
      replayed: true,
    }
  }

  let preview = existingRequest?.preview_snapshot ?? null
  if (!preview) preview = await buildSignupOrderPreview(pool, {
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
  })

  if (!enrollmentNeedsStripeCheckout(preview)) {
    return { skipCheckout: true, preview }
  }

  const dueNowCents = computeEnrollmentDueNowCents(preview)
  const hasRecurring = enrollmentHasRecurringMembership(preview)
  const mode = resolveEnrollmentCheckoutMode(preview)
  const lineItems = mode === 'setup' ? [] : await buildCheckoutLineItems(pool, preview)

  if (mode === 'payment' && lineItems.length === 0) {
    return { skipCheckout: true, preview }
  }

  const pending = existingRequest ? { rows: [existingRequest] } : await pool.query(
    `INSERT INTO stripe_pending_enrollment (
       family_billing_account_id, member_id, payload, preview_snapshot,
       due_now_cents, checkout_mode, status, request_key, request_fingerprint
     ) VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8)
     ON CONFLICT (family_billing_account_id, request_key)
       WHERE request_key IS NOT NULL
     DO NOTHING
     RETURNING *`,
    [
      account.id,
      enrolledMemberId,
      JSON.stringify(batchPayload),
      JSON.stringify(preview),
      dueNowCents,
      mode,
      requestKey,
      requestFingerprint,
    ],
  )
  if (!pending.rows[0]) {
    existingRequest = await pool.query(
      `SELECT *
         FROM stripe_pending_enrollment
        WHERE family_billing_account_id = $1 AND request_key = $2
        LIMIT 1`,
      [account.id, requestKey],
    ).then((result) => result.rows[0] ?? null)
    if (
      !existingRequest ||
      String(existingRequest.request_fingerprint ?? '') !== requestFingerprint ||
      Number(existingRequest.member_id) !== Number(enrolledMemberId)
    ) throw checkoutIdempotencyConflict()
  } else {
    existingRequest = pending.rows[0]
  }
  const pendingId = existingRequest.id

  const customerId = await ensureStripeCustomer(pool, stripe, account)

  const sessionParams = {
    mode,
    customer: customerId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      checkoutType: 'enrollment',
      pendingEnrollmentId: String(pendingId),
      familyBillingAccountId: String(account.id),
      memberId: String(enrolledMemberId),
      payerMemberId: String(memberId),
      previewHash: previewFingerprint(preview),
      hasRecurring: hasRecurring ? 'true' : 'false',
      perClassSubscriptions: 'false',
      householdCollection: hasRecurring ? 'true' : 'false',
    },
  }

  if (mode === 'setup') {
    // Recurring enrollments with $0 due now still collect a reusable payment
    // method. The active collection phase is applied after the local commit.
    sessionParams.currency = 'usd'
  } else {
    sessionParams.line_items = lineItems
    sessionParams.payment_intent_data = {
      setup_future_usage: 'off_session',
    }
  }

  if (hasRecurring && shouldShowEnrollmentCheckoutSubmitMessage(preview)) {
    sessionParams.custom_text = {
      submit: {
        message: formatEnrollmentCheckoutSubmitMessage(),
      },
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams, {
    idempotencyKey: stripeCheckoutIdempotencyKey(
      'member-enrollment-checkout',
      account.id,
      requestKey,
    ),
  })

  const linked = await pool.query(
    `UPDATE stripe_pending_enrollment
     SET stripe_checkout_session_id = $2,
         stripe_checkout_session_url = $3,
         updated_at = now()
     WHERE id = $1
       AND request_fingerprint = $4
       AND (stripe_checkout_session_id IS NULL OR stripe_checkout_session_id = $2)
     RETURNING id`,
    [pendingId, session.id, session.url ?? null, requestFingerprint],
  )
  if (!linked.rows[0]) {
    throw checkoutIdempotencyConflict('Enrollment checkout session binding changed during creation.')
  }

  return { url: session.url, pendingEnrollmentId: pendingId, preview }
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
    `SELECT pe.*, fba.family_id, fba.payer_member_id
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

  await rejectForbiddenSubscriptionCheckoutCompletion(pool, {
    session,
    checkoutKind: 'enrollment',
    pendingEnrollmentId: pendingId,
    accountId: pending.family_billing_account_id,
  })

  if (!enrollmentCheckoutSessionCanFinalize(session, pending)) {
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

  const payment = await recordEnrollmentStripePayment(pool, stripe, {
    session,
    accountId: Number(pending.family_billing_account_id),
  })
  await allocateHouseholdPayments(pool, {
    accountId: Number(pending.family_billing_account_id),
    actorType: 'stripe',
  })
  void emitStripePurchaseEvent(pool, {
    payment,
    session,
    paymentType: 'initial_enrollment',
  })

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
  if (
    metadata.checkoutType !== 'enrollment' ||
    Number(metadata.pendingEnrollmentId) !== pendingId ||
    Number(metadata.familyBillingAccountId) !== accountId ||
    Number(metadata.memberId) !== memberId ||
    !Number.isSafeInteger(payerMemberId) ||
    payerMemberId <= 0 ||
    Number(metadata.payerMemberId) !== payerMemberId ||
    !stripeSession.id ||
    (pending.stripe_checkout_session_id &&
      String(pending.stripe_checkout_session_id) !== String(stripeSession.id))
  ) {
    throw enrollmentCheckoutAuthorizationError('Checkout session does not match this enrollment.')
  }
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
            pending.stripe_checkout_session_id,
            pending.status,
            account.family_id,
            account.payer_member_id
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
 * Claim → signup (no row lock) → ledger repair → completed → Stripe I/O.
 * Concurrent webhook + confirm: one worker claims; the other waits for completed.
 */
export async function commitPendingEnrollment(pool, {
  pendingEnrollmentId,
  stripeSession = null,
  expectedFamilyId = null,
  expectedPayerMemberId = null,
}) {
  const authorizedPending = await authorizePendingEnrollmentCheckout(pool, {
    pendingEnrollmentId,
    stripeSession,
    expectedFamilyId,
    expectedPayerMemberId,
  })
  await rejectForbiddenSubscriptionCheckoutCompletion(pool, {
    session: stripeSession,
    checkoutKind: 'enrollment',
    pendingEnrollmentId,
    accountId: authorizedPending.family_billing_account_id,
  })
  await ensureBillingRecurringSchema(pool)
  await ensurePendingEnrollmentSchema(pool)

  for (let attempt = 0; attempt < 16; attempt++) {
    const outcome = await tryCommitPendingEnrollmentOnce(pool, {
      pendingEnrollmentId,
      stripeSession,
      authorizedPending,
    })
    if (outcome.status !== 'in_progress') return outcome
    await sleep(400 + attempt * 150)
  }

  const final = await pool.query(`SELECT status FROM stripe_pending_enrollment WHERE id = $1`, [
    pendingEnrollmentId,
  ])
  if (final.rows[0]?.status === 'completed') return { status: 'already_completed' }
  return { status: 'in_progress' }
}

async function tryCommitPendingEnrollmentOnce(pool, {
  pendingEnrollmentId,
  stripeSession,
  authorizedPending,
}) {
  // Claim quickly — never hold FOR UPDATE across signup / Stripe network I/O.
  const claim = await pool.query(
    `
      UPDATE stripe_pending_enrollment
      SET status = 'processing', error_message = NULL, updated_at = now()
      WHERE id = $1
        AND (
          status IN ('pending', 'failed')
          OR (status = 'processing' AND updated_at < now() - interval '2 minutes')
        )
      RETURNING *
    `,
    [pendingEnrollmentId],
  )
  const pending = claim.rows[0]
  if (!pending) {
    const existing = await pool.query(`SELECT status FROM stripe_pending_enrollment WHERE id = $1`, [
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
      result = await executeSignupBatch(pool, signupBatchPayload)
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
      })
    }

    await pool.query(
      `UPDATE stripe_pending_enrollment
       SET status = 'completed', error_message = NULL, updated_at = now()
       WHERE id = $1`,
      [pendingEnrollmentId],
    )

  } catch (err) {
    await pool.query(
      `UPDATE stripe_pending_enrollment
       SET status = 'failed', error_message = $2, updated_at = now()
       WHERE id = $1 AND status IN ('processing', 'failed', 'pending')`,
      [pendingEnrollmentId, String(err.message ?? err).slice(0, 500)],
    )
    throw err
  }

  // Stripe network I/O after the pending row is completed (no DB locks held).
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

  if (previewSnapshot && stripeSession && familyBillingAccountId != null && pending.member_id != null) {
    try {
      const stripe = await getStripeClient()
      await createEnrollmentAnnualMembershipSubscriptions(pool, stripe, {
        preview: previewSnapshot,
        stripeSession,
        familyBillingAccountId,
        memberId: Number(pending.member_id),
        purchasedAt: new Date(pending.updated_at ?? pending.created_at ?? Date.now()),
      })
    } catch (err) {
      console.error('[billing] preserve annual membership renewal schedule after enrollment commit:', err)
    }
  }

  if (stripeSession?.id && familyBillingAccountId != null) {
    try {
      const stripe = await getStripeClient()
      if (stripe) {
        const payment = await recordEnrollmentStripePayment(pool, stripe, {
          session: stripeSession,
          accountId: Number(familyBillingAccountId),
        })
        await allocateHouseholdPayments(pool, {
          accountId: Number(familyBillingAccountId),
          actorType: 'stripe',
        })
        void emitStripePurchaseEvent(pool, {
          payment,
          session: stripeSession,
          paymentType: 'initial_enrollment',
        })
      }
    } catch (err) {
      console.error('[stripe] enrollment payment record after commit:', err)
    }
  }

  return { status: 'completed', result }
}

/** Re-run ledger bridge when signup batch charge persistence was skipped/failed. */
export async function ensureEnrollmentLedgerRows(pool, { memberId, signupIds, preview }) {
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
        AND bs.id IS NULL
    `,
    [signupIds],
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
  })
  return { repaired: true, count: missing.rows.length }
}

export { getCatalogSyncStatus } from './stripeCatalogSync.js'
