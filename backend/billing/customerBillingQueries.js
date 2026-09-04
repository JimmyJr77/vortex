import { getStripeClient, stripeEnabled } from './stripeBilling.js'
import { loadCanonicalFinancialSnapshot } from './canonicalBillingAccount.js'
import { buildAdminMemberEnrollments } from '../scheduling/adminEnrollmentsView.js'
import { loadGroupDisplayLabels, slotLabelForSignupRow } from '../scheduling/slotDisplayLabel.js'
import {
  addBillingMonths,
  adjustmentCoversPeriod,
  applyEnrollmentPriceAdjustment,
  billingMonthInTimeZone,
  billingDateKey,
  billingMonthKey,
  mapPriceAdjustment,
} from './customerBillingPricing.js'
import { mapBillingActivity } from './billingActivity.js'
import {
  membershipRenewsOnFromPurchase,
} from '../scheduling/membershipAnniversary.js'
import { resolveFamilyEnrollmentPricing } from './familyEnrollmentPricing.js'
import { listHouseholdMonthlyInvoices } from './householdMonthlyInvoice.js'
import { canonicalActiveHouseholdMemberPredicate } from './householdMembership.js'
import { selectStripeCustomerPaymentMethod } from './stripePaymentMethodReadiness.js'

const INTERNAL_PRICE_SYNC_MESSAGES = new Set([
  'Restored promo assignment requires Stripe expiration-schedule synchronization.',
])

export function customerFacingPriceSyncError(value) {
  const message = String(value ?? '').trim()
  if (!message || INTERNAL_PRICE_SYNC_MESSAGES.has(message)) return null
  return message
}

function objectValue(value) {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(String(value))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

// Keep payment state separate from a class-transfer marker. A moved-out class
// can still be paid, and the replacement can still be unpaid; the marker
// describes the enrollment history without changing either financial status.
export function classTransferTag(metadata) {
  const chargeMetadata = objectValue(metadata)
  const transfer = objectValue(chargeMetadata.classTransfer)
  const direction = String(
    transfer.direction ?? chargeMetadata.classTransferDirection ?? '',
  ).trim().toLowerCase()
  if (direction === 'out') return 'X-out'
  if (direction === 'in') return 'X-in'
  return null
}

// Lifetime-owner tuition waivers are deliberately scoped to a canonical
// household. The same policy also gives every active member in that household
// a permanent annual-membership display state; it must not leak to other
// families simply because the rule is global in class scope.
export function lifetimeOwnerWaiverAppliesToFamily(rule, familyId) {
  const config = objectValue(rule?.config)
  if (config.lifetime_owner_waiver !== true) return false
  const eligibilityRules = Array.isArray(config.eligibility_rules) ? config.eligibility_rules : []
  return eligibilityRules.some((eligibility) => {
    const field = String(eligibility?.field ?? '').trim().toLowerCase()
    if (!['family_id', 'familyid'].includes(field)) return false
    const values = Array.isArray(eligibility?.value) ? eligibility.value : [eligibility?.value]
    return values.some((value) => Number(value) === Number(familyId))
  })
}

async function loadLifetimeOwnerWaiver(pool, { familyId, facilityId }) {
  try {
    const result = await pool.query(
      `SELECT config
         FROM discount_rule
        WHERE facility_id = $1
          AND active = TRUE
          AND COALESCE(config->>'lifetime_owner_waiver', 'false') = 'true'`,
      [Number(facilityId)],
    )
    return result.rows.some((rule) => lifetimeOwnerWaiverAppliesToFamily(rule, familyId))
  } catch (error) {
    // A billing overview remains available if an older database has not yet
    // received discount-rule infrastructure.
    if (error?.code === '42P01' || error?.code === '42703') return false
    throw error
  }
}

function annualMembershipFeeId(sourceId) {
  const feeId = Number(String(sourceId ?? '').split(':')[0])
  return Number.isFinite(feeId) ? feeId : null
}

function annualMembershipMemberId(sourceId) {
  const memberId = Number(String(sourceId ?? '').split(':')[1])
  return Number.isFinite(memberId) ? memberId : null
}

function annualMembershipRenewalDateFromCharge(sourceId) {
  const renewalDate = String(sourceId ?? '').split(':')[2] ?? ''
  return /^\d{4}-\d{2}-\d{2}$/.test(renewalDate) ? renewalDate : null
}

function isAnnualMembershipCharge(charge) {
  return (
    charge?.source_type === 'additional_fee' &&
    annualMembershipFeeId(charge.source_id) != null &&
    annualMembershipMemberId(charge.source_id) != null &&
    annualMembershipRenewalDateFromCharge(charge.source_id) != null
  )
}

function paidAnnualMembershipCharge(charge) {
  return (
    isAnnualMembershipCharge(charge) &&
    charge.has_refund_offset !== true &&
    (Boolean(charge.paid_at) || ['paid', 'settled', 'succeeded'].includes(String(charge.collection_status ?? '').toLowerCase()))
  )
}

function dateTimestamp(value) {
  if (!value) return 0
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function serializedDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  return String(value)
}

function activeAnnualSubscription(subscription, asOfKey) {
  return (
    ['active', 'paused', 'cancelled'].includes(subscription.status) &&
    billingDateKey(subscription.next_bill_date) != null &&
    billingDateKey(subscription.next_bill_date) > asOfKey
  )
}

function annualRedemptionPaidThrough(redemption) {
  const periodKey = billingDateKey(redemption?.period_key)
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(redemption?.period_key ?? '')) && periodKey) {
    return periodKey
  }
  return billingDateKey(
    membershipRenewsOnFromPurchase(redemption?.satisfied_at ?? redemption?.created_at),
  )
}

export function buildCustomerBillingAnnualMemberships({
  members = [],
  subscriptions = [],
  redemptions = [],
  charges = [],
  asOf = new Date(),
} = {}) {
  const asOfKey = billingDateKey(asOf) ?? new Date().toISOString().slice(0, 10)

  return members.map((member) => {
    const memberSubscriptions = subscriptions
      .filter((row) => Number(row.member_id) === Number(member.id))
      .sort((left, right) => (
        dateTimestamp(right.start_date ?? right.created_at ?? right.updated_at) -
        dateTimestamp(left.start_date ?? left.created_at ?? left.updated_at)
      ))
    const memberRedemptions = redemptions
      .filter((row) => Number(row.member_id) === Number(member.id))
      .sort((left, right) => dateTimestamp(right.created_at) - dateTimestamp(left.created_at))
    const memberCharges = charges
      .filter((row) => (
        Number(row.member_id) === Number(member.id) ||
        (isAnnualMembershipCharge(row) && annualMembershipMemberId(row.source_id) === Number(member.id))
      ))
      .sort((left, right) => dateTimestamp(right.created_at) - dateTimestamp(left.created_at))

    const activeSubscription = memberSubscriptions.find((row) => activeAnnualSubscription(row, asOfKey)) ?? null
    const activeRedemption = memberRedemptions.find((row) => (
      (!row.ended_at || billingDateKey(row.ended_at) > asOfKey) &&
      annualRedemptionPaidThrough(row) > asOfKey
    )) ?? null
    const activeCharge = memberCharges.find((row) => (
      paidAnnualMembershipCharge(row) &&
      billingDateKey(annualMembershipRenewalDateFromCharge(row.source_id)) > asOfKey
    )) ?? null
    const referenceSubscription = activeSubscription ?? memberSubscriptions[0] ?? null
    const referenceRedemption = activeRedemption ?? memberRedemptions[0] ?? null
    const referenceCharge = activeCharge ?? memberCharges.find(isAnnualMembershipCharge) ?? null
    const feeId = annualMembershipFeeId(referenceSubscription?.source_id) ?? annualMembershipFeeId(referenceCharge?.source_id) ?? (
      referenceRedemption?.fee_id == null ? null : Number(referenceRedemption.fee_id)
    )
    const membershipCharge = feeId == null
      ? referenceCharge
      : memberCharges.find((row) => isAnnualMembershipCharge(row) && annualMembershipFeeId(row.source_id) === feeId) ?? referenceCharge
    const outstandingCharge = memberCharges.find((row) => (
      isAnnualMembershipCharge(row) && Number(row.remaining_amount_cents ?? 0) > 0
    )) ?? null
    const renewalFromRedemption = referenceRedemption
      ? annualRedemptionPaidThrough(referenceRedemption)
      : null
    const renewalFromSubscriptionStart = referenceSubscription?.start_date
      ? membershipRenewsOnFromPurchase(referenceSubscription.start_date)
      : null
    const renewalDate =
      activeSubscription?.next_bill_date ??
      renewalFromRedemption ??
      annualMembershipRenewalDateFromCharge(activeCharge?.source_id) ??
      annualMembershipRenewalDateFromCharge(membershipCharge?.source_id) ??
      referenceSubscription?.next_bill_date ??
      renewalFromSubscriptionStart

    return {
      memberId: Number(member.id),
      memberName: member.name,
      billingSubscriptionId:
        referenceSubscription?.id == null ? null : Number(referenceSubscription.id),
      active: Boolean(activeRedemption || activeCharge),
      membershipDate: serializedDate(
        referenceRedemption?.satisfied_at ??
        referenceSubscription?.latest_renewal_paid_at ??
        membershipCharge?.paid_at ??
        referenceRedemption?.created_at ??
        referenceSubscription?.start_date,
      ),
      renewalDate: billingDateKey(renewalDate),
      autoRenewal: Boolean(
        activeSubscription &&
        activeSubscription.status !== 'cancelled' &&
        activeSubscription.auto_renewal !== false,
      ),
      canManageAutoRenewal: Boolean(
        referenceSubscription &&
        referenceSubscription.status !== 'cancelled',
      ),
      outstandingChargeId: outstandingCharge?.id == null ? null : Number(outstandingCharge.id),
      outstandingAmountCents: Math.max(0, Number(outstandingCharge?.remaining_amount_cents ?? 0)),
    }
  })
}

export async function loadCustomerBillingAnnualMemberships(pool, {
  accountId,
  members,
  asOf = new Date(),
}) {
  const memberIds = members.map((member) => Number(member.id)).filter(Number.isFinite)
  if (memberIds.length === 0) return []

  const [subscriptionResult, redemptionResult, chargeResult] = await Promise.all([
    pool.query(
      `SELECT bs.*,
              (
                SELECT p.paid_at
                FROM billing_payment p
                WHERE bs.stripe_subscription_id IS NOT NULL
                  AND p.stripe_subscription_id = bs.stripe_subscription_id
                  AND p.external_status IN ('settled', 'succeeded')
                ORDER BY p.paid_at DESC, p.id DESC
                LIMIT 1
              ) AS latest_renewal_paid_at
       FROM billing_subscription bs
       WHERE bs.family_billing_account_id = $1
         AND (bs.source_type = 'annual_membership' OR bs.pricing_option_key = 'annual_membership')
       ORDER BY bs.start_date DESC NULLS LAST, bs.created_at DESC, bs.id DESC`,
      [accountId],
    ),
    pool.query(
      `SELECT r.fee_id, r.member_id, r.created_at, r.period_key, r.amount_cents,
              r.satisfied_at, r.ended_at, r.end_reason, r.billing_charge_id
       FROM additional_fee_redemption r
       JOIN additional_fee f ON f.id = r.fee_id
       WHERE r.member_id = ANY($1::bigint[])
         AND r.amount_cents >= 0
         AND (
           f.trigger_type = 'once_per_year'
           OR f.apply_basis = 'per_year'
           OR lower(f.name) LIKE '%annual%'
           OR lower(f.name) LIKE '%membership%'
         )
       ORDER BY r.created_at DESC`,
      [memberIds],
    ),
    pool.query(
      `SELECT c.id, c.member_id, c.source_type, c.source_id, c.created_at,
              c.amount_cents, c.gross_amount_cents, c.discount_amount_cents,
              COALESCE(adjustment.has_refund_offset, FALSE) AS has_refund_offset,
              CASE
                WHEN COALESCE(adjustment.has_refund_offset, FALSE) THEN 'refunded'
                WHEN COALESCE(app.applied_cents, 0) >= GREATEST(0, c.amount_cents + COALESCE(adjustment.adjustment_cents, 0)) THEN 'paid'
                WHEN COALESCE(app.applied_cents, 0) > 0 THEN 'partially_paid'
                ELSE c.collection_status
              END AS collection_status,
              CASE WHEN COALESCE(adjustment.has_refund_offset, FALSE) THEN NULL ELSE app.paid_at END AS paid_at,
              GREATEST(0, c.amount_cents + COALESCE(adjustment.adjustment_cents, 0) - COALESCE(app.applied_cents, 0))::int AS remaining_amount_cents
       FROM billing_charge c
       LEFT JOIN LATERAL (
         SELECT
           SUM(CASE WHEN application.application_kind = 'reversal' THEN -application.amount_cents ELSE application.amount_cents END)::int AS applied_cents,
           MAX(payment.paid_at) FILTER (WHERE application.application_kind = 'application') AS paid_at
         FROM billing_payment_application application
         JOIN billing_payment payment ON payment.id = application.billing_payment_id
         WHERE application.billing_charge_id = c.id
           AND payment.external_status IN ('settled', 'succeeded')
       ) app ON TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(linked.amount_cents), 0)::int AS adjustment_cents,
                BOOL_OR(linked.source_type = 'refund_offset' AND linked.amount_cents < 0) AS has_refund_offset
         FROM billing_charge linked
         WHERE linked.related_charge_id = c.id
           AND linked.source_type IN ('charge_adjustment', 'refund_offset')
       ) adjustment ON TRUE
       WHERE c.family_billing_account_id = $1
         AND c.member_id = ANY($2::bigint[])
         AND c.source_type = 'additional_fee'
       ORDER BY c.created_at DESC, c.id DESC`,
      [accountId, memberIds],
    ),
  ])

  return buildCustomerBillingAnnualMemberships({
    members,
    subscriptions: subscriptionResult.rows,
    redemptions: redemptionResult.rows,
    charges: chargeResult.rows,
    asOf,
  })
}

export async function loadCustomerBillingAccount(pool, familyId, facilityId = null) {
  const result = await pool.query(
    `SELECT account.*, family.family_name, family.facility_id AS family_facility_id,
            facility.timezone AS facility_timezone,
            (
              SELECT COUNT(*)::integer
                FROM family_billing_account customer_owner
               WHERE customer_owner.stripe_customer_id = account.stripe_customer_id
            ) AS stripe_customer_owner_count
       FROM family
       JOIN family_billing_account account ON account.family_id = family.id
       LEFT JOIN facility ON facility.id = family.facility_id
      WHERE family.id = $1
        AND account.is_active = TRUE
        AND ($2::bigint IS NULL OR family.facility_id = $2)`,
    [Number(familyId), facilityId],
  )
  return result.rows[0] ?? null
}

/**
 * Compatibility name for callers being retired. Account reads are deliberately
 * fail-closed and never create an account or choose a payer heuristically.
 */
export const ensureCustomerBillingAccount = loadCustomerBillingAccount

export async function searchCustomerBilling(pool, { facilityId, query, limit = 50 }) {
  const value = String(query ?? '').trim()
  if (!value) return []
  const numericFamilyId = /^\d+$/.test(value) ? Number(value) : null
  const result = await pool.query(
    `SELECT DISTINCT
       f.id AS family_id,
       f.family_name,
       fba.id AS billing_account_id,
       m.id AS member_id,
       m.first_name,
       m.last_name,
       m.email,
       m.phone,
       m.is_active
     FROM family f
     JOIN member m ON ${canonicalActiveHouseholdMemberPredicate({
       memberAlias: 'm',
       familyIdReference: 'f.id',
       membershipAlias: 'search_membership',
       historyAlias: 'search_membership_history',
     })}
     LEFT JOIN family_billing_account fba ON fba.family_id = f.id AND fba.is_active = TRUE
     WHERE f.facility_id = $1
       AND (
         ($2::bigint IS NOT NULL AND f.id = $2)
         OR CONCAT_WS(' ', m.first_name, m.last_name) ILIKE $3
         OR COALESCE(m.email, '') ILIKE $3
         OR COALESCE(m.phone, '') ILIKE $3
         OR (
           regexp_replace($4, '\\D', '', 'g') <> ''
           AND regexp_replace(COALESCE(m.phone, ''), '\\D', '', 'g')
             LIKE '%' || regexp_replace($4, '\\D', '', 'g') || '%'
         )
       )
     ORDER BY m.is_active DESC, m.last_name, m.first_name, m.id
     LIMIT $5`,
    [facilityId, numericFamilyId, `%${value}%`, value, Math.min(100, Math.max(1, Number(limit) || 50))],
  )
  return result.rows.map((row) => ({
    familyId: Number(row.family_id),
    familyName: row.family_name,
    billingAccountId: row.billing_account_id == null ? null : Number(row.billing_account_id),
    memberId: Number(row.member_id),
    name: [row.first_name, row.last_name].filter(Boolean).join(' '),
    email: row.email ?? null,
    phone: row.phone ?? null,
    isActive: row.is_active !== false,
  }))
}

async function loadFamilyMembers(pool, familyId) {
  const result = await pool.query(
    `SELECT DISTINCT m.id, m.first_name, m.last_name, m.email, m.phone, m.is_active
     FROM member m
     WHERE ${canonicalActiveHouseholdMemberPredicate({
       memberAlias: 'm',
       familyIdReference: '$1',
       membershipAlias: 'member_household',
       historyAlias: 'member_household_history',
     })}
     ORDER BY m.is_active DESC, m.last_name, m.first_name, m.id`,
    [familyId],
  )
  return result.rows.map((row) => ({
    id: Number(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    name: [row.first_name, row.last_name].filter(Boolean).join(' '),
    email: row.email ?? null,
    phone: row.phone ?? null,
    isActive: row.is_active !== false,
  }))
}

export async function loadDefaultPaymentMethodSummary(account, {
  billingMonth = upcomingRecurringPricingMonth(new Date(), account?.facility_timezone),
} = {}) {
  const enabled = stripeEnabled()
  if (!account?.stripe_customer_id) {
    return { available: false, stripeEnabled: enabled, paymentMethod: null }
  }
  if (Number(account.stripe_customer_owner_count) !== 1) {
    return {
      available: false,
      stripeEnabled: enabled,
      paymentMethod: null,
      reconciliationRequired: true,
      error: 'The Stripe customer does not have one unique local billing-account owner.',
    }
  }
  if (!enabled) {
    return { available: false, stripeEnabled: false, paymentMethod: null }
  }
  try {
    const stripe = await getStripeClient()
    if (!stripe) return { available: false, stripeEnabled: true, paymentMethod: null }
    const customer = await stripe.customers.retrieve(account.stripe_customer_id, {
      expand: ['invoice_settings.default_payment_method'],
    })
    if (!customer || customer.deleted) return { available: false, stripeEnabled: true, paymentMethod: null }
    const selection = await selectStripeCustomerPaymentMethod(stripe, customer, {
      expectedCustomerId: account.stripe_customer_id,
      billingMonth,
    })
    const paymentMethod = selection.paymentMethod
    const card = paymentMethod?.card
    return {
      available: selection.readiness.ready,
      stripeEnabled: true,
      customerId: customer.id,
      readiness: selection.readiness,
      paymentMethod: paymentMethod?.id
        ? {
            id: paymentMethod.id,
            type: paymentMethod.type ?? null,
            customerId: selection.readiness.customerId ?? null,
            brand: card?.brand ?? paymentMethod.type ?? 'card',
            last4: card?.last4 ?? null,
            expMonth: card?.exp_month ?? null,
            expYear: card?.exp_year ?? null,
          }
        : null,
    }
  } catch (error) {
    return {
      available: false,
      stripeEnabled: true,
      paymentMethod: null,
      error: error?.message ?? 'Unable to load saved payment method.',
    }
  }
}

function mapAccount(account) {
  return {
    id: Number(account.id),
    familyId: Number(account.family_id),
    familyName: account.family_name ?? null,
    payerMemberId: account.payer_member_id == null ? null : Number(account.payer_member_id),
    billingEmail: account.billing_email ?? null,
    billingPhone: account.billing_phone ?? null,
    billingStreet: account.billing_street ?? null,
    billingCity: account.billing_city ?? null,
    billingState: account.billing_state ?? null,
    billingZip: account.billing_zip ?? null,
    stripeCustomerId: account.stripe_customer_id ?? null,
    householdMonthlyBillingEnabled: account.household_monthly_billing_enabled === true,
    isActive: account.is_active !== false,
  }
}

function relevantEnrollment(row) {
  // Customer Billing's enrollment workspace is a forward-looking tuition view.
  // Drop-ins and other one-time registrations belong solely in the immutable
  // financial audit, even while their registration record remains confirmed.
  if (row.source === 'drop_in') return false
  if (row.billing_type === 'one_time' || row.billingType === 'one_time') return false
  return ['confirmed', 'active', 'requested', 'paused', 'waitlisted'].includes(row.status)
}

function customerEnrollmentStatus(row) {
  if (row.status === 'requested') return 'pending_cancellation'
  const starts = billingDateKey(row.enrollment_start_date)
  const today = new Date().toISOString().slice(0, 10)
  const cancellation = billingDateKey(row.cancel_effective_date)
  if (['confirmed', 'active'].includes(row.status) && cancellation && cancellation > today) return 'pending_cancellation'
  if (['confirmed', 'active'].includes(row.status) && starts && starts > today) return 'scheduled'
  if (row.status === 'confirmed') return 'active'
  return row.status
}

function nextCalendarDate(value) {
  const key = billingDateKey(value)
  if (!key) return null
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

export function effectiveEnrollmentNextBillDate(subscription = {}) {
  let nextBillDate = billingDateKey(subscription.next_bill_date ?? subscription.nextBillDate)
  const paidThroughNextDate = nextCalendarDate(
    subscription.paid_through_date ?? subscription.paidThroughDate,
  )
  if (paidThroughNextDate && (!nextBillDate || paidThroughNextDate > nextBillDate)) {
    nextBillDate = paidThroughNextDate
  }
  const outstandingDueDate = billingDateKey(
    subscription.oldest_unpaid_service_period_start ?? subscription.oldestUnpaidServicePeriodStart,
  )
  if (outstandingDueDate && (!nextBillDate || outstandingDueDate < nextBillDate)) {
    return outstandingDueDate
  }
  return nextBillDate
}

export function earliestActiveNextBillDate(subscriptions = []) {
  return subscriptions
    .filter((subscription) => subscription.status === 'active')
    .map(effectiveEnrollmentNextBillDate)
    .filter(Boolean)
    .sort()[0] ?? null
}

/**
 * The recurring-fee card preserves the current month through the facility's
 * fourth day.  On the fifth it advances to the next calendar month, matching
 * the date on which that upcoming bill is posted to the household ledger.
 * Do not infer this from next_bill_date: a scheduled cancellation clears that
 * value even though the current-month enrollment remains visible.
 */
export function upcomingRecurringPricingMonth(asOf = new Date(), timeZone = 'America/New_York') {
  const currentMonth = billingMonthInTimeZone(asOf, timeZone) ?? billingMonthKey(asOf)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    day: '2-digit',
  }).formatToParts(asOf instanceof Date ? asOf : new Date(asOf))
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  return day >= 5 ? billingMonthKey(addBillingMonths(currentMonth, 1)) : billingMonthKey(currentMonth)
}

// UI due dates must be full calendar dates. Sending a bare YYYY-MM string
// makes JavaScript parse it as UTC midnight, which renders as the preceding
// calendar day for facilities west of UTC.
export function billingMonthDueDate(month) {
  if (month == null || String(month).trim() === '') return null
  const key = billingMonthKey(month)
  return key ? `${key}-01` : null
}

// The monthly card is a budget/tracking figure, not a collection remainder.
// Account Balance is the ledger's current financial position after payments,
// credits, and adjustments have been applied.
export function customerBillingCardPresentation(view = {}, displayPricing = {}) {
  return {
    monthlyRecurringCents: Number(displayPricing.netCents) || 0,
    monthlyRecurringDiscountCents: Number(displayPricing.discountCents) || 0,
    futureCreditsCents: Number(view.futureCreditsCents) || 0,
    balanceCents: Number(view.balanceCents) || 0,
  }
}

// A ledger container stays available for historical records and an unpaid
// balance, but that alone must not make a household appear active. Overall
// account status reflects what is actually active today: a valid membership
// or an enrolled (including scheduled) recurring class.
export function customerBillingAccountStatus({
  account = {},
  enrollments = [],
  annualMemberships = [],
} = {}) {
  if (account.is_active === false || account.isActive === false) return 'inactive'
  const hasCurrentMembership = annualMemberships.some((membership) => membership?.active === true)
  const hasCurrentOrUpcomingEnrollment = enrollments.some((enrollment) => (
    ['active', 'scheduled', 'pending_cancellation'].includes(String(enrollment?.status ?? '')) &&
    enrollment?.source !== 'drop_in'
  ))
  return hasCurrentMembership || hasCurrentOrUpcomingEnrollment ? 'active' : 'inactive'
}

// A household invoice is a Stripe collection artifact, whereas Account
// History is the ledger of record. A class may have been paid early, manually,
// or before this account was moved to household invoicing. In those cases no
// monthly-invoice row exists, but the billing card must still accurately show
// the posted class bill and the settled money allocated to it.
function billingMonthKeyOrNull(value) {
  try {
    return billingMonthKey(value)
  } catch {
    // Historical ledger rows can predate the date fields used by the current
    // billing model. They are not bill lines for an arbitrary month, but one
    // incomplete row must never prevent the account overview from loading.
    return null
  }
}

export function buildMonthlyLedgerBill({
  billingMonth,
  charges = [],
  members = [],
  classDisplays = new Map(),
} = {}) {
  const month = billingMonthKeyOrNull(billingMonth)
  if (!month) return null

  const memberNames = new Map(
    members.map((member) => [
      Number(member.id),
      member.name || [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || null,
    ]),
  )
  const lines = charges
    .filter((charge) => (
      (
        charge?.charge_type === 'recurring' &&
        billingMonthKeyOrNull(charge.service_period_start ?? charge.created_at) === month
      ) || (
        (charge?.is_annual_membership === true || charge?.isAnnualMembership === true) &&
        billingMonthKeyOrNull(charge.latest_paid_at ?? charge.latestPaidAt) === month
      )
    ) &&
      Number(charge.amount_cents) > 0
    )
    .map((charge) => {
      const id = Number(charge.id)
      const effectiveAmountCents = Math.max(
        0,
        Number(charge.amount_cents ?? 0) + Number(charge.linked_adjustment_cents ?? 0),
      )
      const appliedCents = Math.max(
        0,
        Number(charge.applied_amount_cents ?? 0) + Number(charge.credit_applied_amount_cents ?? 0),
      )
      const classDisplay = classDisplays.get(id)
      const annualMembership = charge.is_annual_membership === true || charge.isAnnualMembership === true
      return {
        id,
        memberName: memberNames.get(Number(charge.member_id)) ?? null,
        description: classDisplay?.description ?? charge.description ?? (annualMembership ? 'Annual membership' : 'Recurring class tuition'),
        lineType: annualMembership ? 'annual_membership' : 'charge',
        amountCents: effectiveAmountCents,
        paidCents: Math.min(effectiveAmountCents, appliedCents),
      }
    })
    // A canceled charge wholly offset by a linked correction remains in the
    // immutable audit, but is not a bill the household owes this month.
    .filter((line) => line.amountCents > 0)

  if (lines.length === 0) return null
  const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0)
  const paidCents = lines.reduce((sum, line) => sum + line.paidCents, 0)
  const remainingCents = Math.max(0, totalCents - paidCents)
  return {
    billingMonth: `${month}-01`,
    totalCents,
    paidCents,
    remainingCents,
    status: remainingCents === 0 ? 'paid' : paidCents > 0 ? 'partially_paid' : 'unpaid',
    lineCount: lines.length,
    lines: lines.map(({ paidCents: _paidCents, ...line }) => line),
  }
}

export function isRetiredAnnualMembershipStripeSetupAlert(alert = {}) {
  const type = String(alert.alert_type ?? alert.type ?? '').trim()
  const message = String(alert.message ?? '').trim()
  return (
    type === 'membership_autorenewal_setup_required' ||
    type === 'annual_membership_autorenewal_setup_required' ||
    /^Annual Fee is paid, but automatic yearly renewal is not connected to Stripe\.?$/i.test(message)
  )
}

export async function resolveAddressedBillingAlerts(pool, {
  accountId,
  paymentMethodAvailable,
  householdCardRequired,
  householdMonthlyBillingEnabled = false,
}) {
  try {
    // A household account intentionally retains a local schedule per
    // enrollment. Once household collection is enabled, an old per-enrollment
    // setup alert is no longer actionable — the single account-level card
    // status is the authoritative readiness signal.
    const resolvedAlertTypes = []
    if (
      householdMonthlyBillingEnabled === true ||
      paymentMethodAvailable === true ||
      householdCardRequired !== true
    ) {
      resolvedAlertTypes.push('enrollment_autopay_setup_required')
    }
    if (paymentMethodAvailable === true || householdCardRequired !== true) {
      resolvedAlertTypes.push('monthly_invoice_payment_method_required')
    }
    if (resolvedAlertTypes.length > 0) {
      await pool.query(
        `UPDATE stripe_billing_alert
            SET resolved_at = now(),
                action_status = 'resolved',
                resolution_note = CASE
                  WHEN $3::boolean THEN 'Automatically resolved after a reusable payment method was saved.'
                  WHEN $4::boolean THEN 'Automatically resolved because household billing now owns automatic collection readiness.'
                  ELSE 'Automatically resolved because the account no longer needs an automatic collection payment method.'
                END,
                updated_at = now()
          WHERE family_billing_account_id = $1
            AND alert_type = ANY($2::text[])
            AND resolved_at IS NULL`,
        [
          accountId,
          resolvedAlertTypes,
          paymentMethodAvailable === true,
          householdMonthlyBillingEnabled === true,
        ],
      )
    }
    // A duplicate-invoice repair can finish after the original webhook
    // capacity check. Close only this exact alert when the durable net
    // applications now match a settled Stripe payment's received amount.
    await pool.query(
      `UPDATE stripe_billing_alert alert
          SET resolved_at = now(),
              action_status = 'resolved',
              resolution_note = 'Automatically resolved after payment applications were reconciled to the Stripe amount received.',
              updated_at = now()
        WHERE alert.family_billing_account_id = $1
          AND alert.alert_type = 'webhook_failure'
          AND alert.resolved_at IS NULL
          AND alert.message ~ '^Stripe webhook delivery failed: billing payment [0-9]+ has [0-9]+ applied cents, received [0-9]+'
          AND EXISTS (
            SELECT 1
              FROM billing_payment payment
              LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(CASE
                  WHEN application.application_kind = 'reversal' THEN -application.amount_cents
                  ELSE application.amount_cents
                END), 0)::bigint AS applied_cents
                  FROM billing_payment_application application
                 WHERE application.billing_payment_id = payment.id
              ) allocation ON TRUE
             WHERE payment.id = NULLIF(substring(alert.message FROM 'billing payment ([0-9]+) has'), '')::bigint
               AND payment.external_status IN ('settled', 'succeeded')
               AND allocation.applied_cents = NULLIF(substring(alert.message FROM 'received ([0-9]+)'), '')::bigint
               AND payment.amount_cents = NULLIF(substring(alert.message FROM 'received ([0-9]+)'), '')::bigint
          )`,
      [accountId],
    )
    // Annual memberships now renew through the local household ledger. This
    // historic warning only described a retired Stripe-subscription path and
    // must not keep resurfacing for a paid membership.
    await pool.query(
      `UPDATE stripe_billing_alert alert
          SET resolved_at = now(),
              action_status = 'resolved',
              resolution_note = 'Automatically resolved: annual memberships renew through the household billing ledger, not a standalone Stripe subscription.',
              updated_at = now()
        WHERE alert.family_billing_account_id = $1
          AND alert.resolved_at IS NULL
          AND (
            alert.alert_type IN (
              'membership_autorenewal_setup_required',
              'annual_membership_autorenewal_setup_required'
            )
            OR alert.message ~* '^Annual Fee is paid, but automatic yearly renewal is not connected to Stripe\\.?$'
          )`,
      [accountId],
    )
  } catch (error) {
    // Alert reconciliation is never allowed to make the account page fail.
    if (error?.code !== '42P01' && error?.code !== '42703') throw error
  }
}

/**
 * Return the first period-aware recurring-pricing line for every enrollment.
 * Current enrollments appear in the current breakpoint; scheduled enrollments
 * first appear in their activation month.
 */
export function firstRecurringPricingLineBySignup(breakpoints = []) {
  const bySignup = new Map()
  for (const breakpoint of breakpoints) {
    for (const line of breakpoint?.lines ?? []) {
      const signupId = Number(line.signupId)
      if (!Number.isFinite(signupId) || bySignup.has(signupId)) continue
      bySignup.set(signupId, { ...line, pricingPeriodKey: breakpoint.periodKey })
    }
  }
  return bySignup
}

export function recurringPricingForPeriod(breakpoints = [], periodValue) {
  const periodKey = billingMonthKey(periodValue)
  return breakpoints
    .filter((breakpoint) => breakpoint.periodKey <= periodKey)
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey))
    .at(-1) ?? null
}

export async function buildCustomerBillingOverview(pool, {
  familyId,
  facilityId,
  selectedMemberId = null,
  readMode = 'admin',
}) {
  const startedAt = Date.now()
  const memberRead = readMode === 'member'
  const account = await ensureCustomerBillingAccount(pool, familyId, facilityId)
  if (!account) return null
  const members = await loadFamilyMembers(pool, familyId)
  if (selectedMemberId != null && !members.some((member) => member.id === Number(selectedMemberId))) {
    throw new Error('Selected member does not belong to this family.')
  }
  // Keep the ledger-card classification on the same upcoming month displayed
  // by the recurring-fee card. A charge posted for the current (or past)
  // month is already due and must remain in Outstanding balance.
  const pricingMonth = upcomingRecurringPricingMonth(new Date(), account.facility_timezone)

  const rawSubscriptionsPromise = pool.query(
    `SELECT bs.*, TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS member_name,
            coverage.oldest_unpaid_service_period_start,
            coverage.paid_through_date
     FROM billing_subscription bs
     LEFT JOIN member m ON m.id = bs.member_id
     LEFT JOIN LATERAL (
       SELECT
         MIN(charge.service_period_start) FILTER (
           WHERE charge.service_period_start IS NOT NULL
             AND charge.applied_cents < charge.amount_cents
             -- A late-start partial-month charge remains collectible and
             -- contributes to the account balance, but it is not the
             -- subscription's next full recurring billing period.
             AND charge.source_type <> 'initial_enrollment_proration'
         ) AS oldest_unpaid_service_period_start,
         MAX(charge.service_period_end) FILTER (
           WHERE charge.service_period_end IS NOT NULL
             AND charge.applied_cents >= charge.amount_cents
         ) AS paid_through_date
       FROM (
         SELECT c.amount_cents, c.source_type, c.service_period_start, c.service_period_end,
                (
                  COALESCE((
                  SELECT SUM(CASE
                    WHEN application.application_kind = 'reversal' THEN -application.amount_cents
                    ELSE application.amount_cents
                  END)
                  FROM billing_payment_application application
                  JOIN billing_payment settled_payment
                    ON settled_payment.id = application.billing_payment_id
                  WHERE application.billing_charge_id = c.id
                    AND settled_payment.external_status IN ('settled', 'succeeded')
                  ), 0)
                  + COALESCE((
                    SELECT SUM(credit_application.amount_cents)
                      FROM billing_charge_credit_application credit_application
                      JOIN billing_monthly_invoice_line target_line
                        ON target_line.id = credit_application.target_invoice_line_id
                     WHERE target_line.billing_charge_id = c.id
                  ), 0)
                )::int AS applied_cents
         FROM billing_charge c
         WHERE c.subscription_id = bs.id
           AND c.charge_type = 'recurring'
           AND c.amount_cents > 0
       ) charge
     ) coverage ON TRUE
     WHERE bs.family_billing_account_id = $1 AND bs.status <> 'cancelled'
     ORDER BY bs.status, bs.created_at, bs.id`,
    [account.id],
  )
  const financialSnapshotPromise = rawSubscriptionsPromise.then((result) => (
    loadCanonicalFinancialSnapshot(pool, {
      accountId: account.id,
      subscriptions: result.rows,
      recurringBillingMonth: pricingMonth,
    })
  ))

  const [
    view,
    enrollmentGroups,
    rawSubscriptions,
    adjustmentsResult,
    alertsResult,
    annualMembershipRows,
    hasLifetimeOwnerWaiver,
    paymentMethod,
    monthlyInvoices,
  ] =
    await Promise.all([
      financialSnapshotPromise,
      Promise.all(
        members.map(async (member) => ({
          member,
          ...(await buildAdminMemberEnrollments(pool, member.id, { readOnly: true })),
        })),
      ),
      rawSubscriptionsPromise,
      pool.query(
        `SELECT * FROM enrollment_price_adjustment
         WHERE family_billing_account_id = $1
         ORDER BY effective_from_month, created_at, id`,
        [account.id],
      ).catch((error) => {
        if (error?.code === '42P01') return { rows: [] }
        throw error
      }),
      memberRead
        ? Promise.resolve({ rows: [] })
        : pool.query(
            `SELECT * FROM stripe_billing_alert
             WHERE family_billing_account_id = $1 AND resolved_at IS NULL
             ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
                      created_at DESC`,
            [account.id],
          ).catch((error) => {
            if (error?.code === '42P01') return { rows: [] }
            throw error
          }),
      loadCustomerBillingAnnualMemberships(pool, {
        accountId: account.id,
        members,
      }),
      loadLifetimeOwnerWaiver(pool, {
        familyId: Number(familyId),
        facilityId: Number(account.family_facility_id),
      }),
      loadDefaultPaymentMethodSummary(account, { billingMonth: pricingMonth }),
      listHouseholdMonthlyInvoices(pool, account.id, {
        // Both Billing surfaces present the current household invoice. Line
        // descriptions and amounts are customer-facing ledger facts, while
        // the member DTO below continues to withhold processor identifiers.
        limit: memberRead ? 1 : 6,
        includeLines: true,
      }).catch((error) => {
        if (error?.code === '42P01') return []
        throw error
      }),
    ])

  const adjustments = adjustmentsResult.rows.map((row) => {
    const adjustment = mapPriceAdjustment(row)
    return {
      ...adjustment,
      stripeSyncError: customerFacingPriceSyncError(adjustment.stripeSyncError),
    }
  })
  const adjustmentsBySignup = new Map()
  for (const adjustment of adjustments) {
    const list = adjustmentsBySignup.get(adjustment.signupId) ?? []
    list.push(adjustment)
    adjustmentsBySignup.set(adjustment.signupId, list)
  }
  const nextBillDate = billingMonthDueDate(pricingMonth)
  const householdMonthlyBillingEnabled = account.household_monthly_billing_enabled === true
  const pricingStartedAt = Date.now()
  const displayPricing = await resolveFamilyEnrollmentPricing(pool, {
    familyId,
    periodKey: pricingMonth,
    subscriptions: rawSubscriptions.rows,
    ensureSchema: false,
  })
  console.info('[customer-billing] pricing resolved', {
    accountId: Number(account.id),
    periodKey: pricingMonth,
    durationMs: Date.now() - pricingStartedAt,
  })
  const displayPricingBySubscription = new Map(
    (displayPricing?.lines ?? []).map((line) => [Number(line.subscriptionId), line]),
  )
  const displayPricingBySignup = new Map(
    (displayPricing?.lines ?? [])
      .filter((line) => Number.isFinite(Number(line.signupId)))
      .map((line) => [Number(line.signupId), { ...line, pricingPeriodKey: displayPricing.periodKey }]),
  )
  const effectivePricingBySignup = new Map(
    (displayPricing.lines ?? []).map((line) => [
      Number(line.signupId),
      { ...line, pricingPeriodKey: displayPricing.periodKey },
    ]),
  )
  const rawSubscriptionBySignup = new Map(
    rawSubscriptions.rows
      .filter((row) => row.source_type === 'scheduling_signup' && Number.isFinite(Number(row.source_id)))
      .map((row) => [Number(row.source_id), row]),
  )
  const enrollments = []
  const waitlists = []
  for (const group of enrollmentGroups) {
    for (const row of group.rows ?? []) {
      if (!relevantEnrollment(row)) continue
      const isDropIn = row.source === 'drop_in'
      // Drop-in ids and scheduling-signup ids come from different sequences.
      // Never allow an id collision to attach recurring pricing or tuition
      // adjustments to a one-time attendance record.
      const rowAdjustments = isDropIn ? [] : adjustmentsBySignup.get(Number(row.id)) ?? []
      const pricingLine = isDropIn
        ? null
        : displayPricingBySignup.get(Number(row.id)) ??
          effectivePricingBySignup.get(Number(row.id))
      const enrollmentPricingMonth = pricingLine?.pricingPeriodKey ?? pricingMonth
      const activeAdjustments = rowAdjustments.filter(
        (adjustment) => adjustment.status === 'active' && adjustmentCoversPeriod(adjustment, enrollmentPricingMonth),
      )
      const activeAdjustment = activeAdjustments.find(
        (adjustment) => adjustment.kind === 'fixed_final_price',
      ) ?? activeAdjustments[0] ?? null
      const grossCents = Number(pricingLine?.grossCents ?? row.class_cost_cents ?? 0)
      const automaticNetCents = Number(
        pricingLine?.automaticNetCents ?? row.adjusted_cost_cents ?? grossCents,
      )
      const resolved = row.status === 'paused'
        ? {
            grossCents,
            automaticNetCents: 0,
            automaticDiscountCents: grossCents,
            manualAdjustmentCents: 0,
            discountCents: grossCents,
            netCents: 0,
            discountComponents: [{ name: 'Paused — no recurring charge', amountCents: grossCents, source: 'pause' }],
          }
        : pricingLine ?? applyEnrollmentPriceAdjustment(
            { grossCents, netCents: automaticNetCents },
            activeAdjustment
              ? {
                  ...activeAdjustment,
                  final_price_cents: activeAdjustment.finalPriceCents,
                  discount_rule_snapshot: activeAdjustment.discountRuleSnapshot,
                }
              : null,
          )
      const subscription = rawSubscriptionBySignup.get(Number(row.id))
      const fallbackDiscountName = row.manual_discount_reason || 'Automatic discount'
      const rowDiscountComponents = Array.isArray(row.discount_components)
        ? row.discount_components
        : []
      let automaticDiscountComponents = resolved.discountComponents ?? []
      if (automaticDiscountComponents.length === 0 && rowDiscountComponents.length > 0) {
        automaticDiscountComponents = rowDiscountComponents
      }
      if (
        automaticDiscountComponents.length === 0 &&
        grossCents > automaticNetCents
      ) {
        automaticDiscountComponents = [{
          name: fallbackDiscountName,
          amountCents: grossCents - automaticNetCents,
          source: null,
        }]
      }
      const mapped = {
        ...row,
        status: isDropIn ? 'drop_in' : customerEnrollmentStatus(row),
        memberId: group.member.id,
        memberName: group.member.name
          || [group.member.firstName, group.member.lastName].filter(Boolean).join(' ').trim()
          || null,
        classCostCents: grossCents,
        automaticDiscountCents: Number(resolved.automaticDiscountCents ?? Math.max(0, grossCents - automaticNetCents)),
        automaticDiscountComponents,
        automaticAdjustedCostCents: Number(resolved.automaticNetCents ?? automaticNetCents),
        manualAdjustmentCents: Number(resolved.manualAdjustmentCents ?? 0),
        adjustedCostCents: resolved.netCents,
        activePriceAdjustment: activeAdjustment,
        activePriceAdjustments: activeAdjustments,
        priceAdjustments: rowAdjustments,
        nextBillDate: effectiveEnrollmentNextBillDate(subscription),
        // The household invoice, not a per-class Stripe price, is the payment
        // authority in this collection mode. Historic per-class sync states
        // must not imply that Stripe has a different recurring amount.
        priceSyncStatus: householdMonthlyBillingEnabled
          ? 'not_required'
          : subscription?.price_sync_status ?? 'not_required',
        priceSyncError: householdMonthlyBillingEnabled
          ? null
          : customerFacingPriceSyncError(subscription?.price_sync_error),
        collectionMode: isDropIn || row.billing_type === 'one_time'
          ? 'not_applicable'
          : householdMonthlyBillingEnabled
            ? (paymentMethod.available ? 'household_monthly' : 'household_payment_method_required')
            : subscription?.stripe_subscription_id
              ? 'legacy_stripe_subscription'
              : 'autopay_setup_required',
        stripeSubscriptionScheduleId: subscription?.stripe_subscription_schedule_id ?? null,
        pricingMonth: enrollmentPricingMonth,
      }
      if (row.status === 'waitlisted') waitlists.push(mapped)
      else enrollments.push(mapped)
    }
  }

  const subscriptions = rawSubscriptions.rows.map((row) => {
    const signupId = row.source_type === 'scheduling_signup' ? Number(row.source_id) : null
    const rowAdjustments = Number.isFinite(signupId) ? adjustmentsBySignup.get(signupId) ?? [] : []
    const pricingLine = displayPricingBySubscription.get(Number(row.id))
    const subscriptionPricingMonth = pricingLine ? displayPricing?.periodKey ?? pricingMonth : pricingMonth
    const activeAdjustments = rowAdjustments.filter(
      (adjustment) => adjustment.status === 'active' && adjustmentCoversPeriod(adjustment, subscriptionPricingMonth),
    )
    const activeAdjustment = activeAdjustments.find(
      (adjustment) => adjustment.kind === 'fixed_final_price',
    ) ?? activeAdjustments[0] ?? null
    const fallbackResolved = applyEnrollmentPriceAdjustment(
      {
        grossCents: Number(row.monthly_amount_cents ?? 0),
        netCents: Number(row.net_monthly_cents ?? 0),
      },
      activeAdjustment
        ? {
            ...activeAdjustment,
            final_price_cents: activeAdjustment.finalPriceCents,
            discount_rule_snapshot: activeAdjustment.discountRuleSnapshot,
          }
          : null,
    )
    const resolved = row.status === 'active'
      ? pricingLine ?? fallbackResolved
      : { ...fallbackResolved, netCents: 0, discountCents: Number(row.monthly_amount_cents ?? 0) }
    return {
      id: Number(row.id),
      memberId: row.member_id == null ? null : Number(row.member_id),
      memberName: row.member_name ?? null,
      signupId: Number.isFinite(signupId) ? signupId : null,
      description: row.description,
      status: row.status,
      monthlyAmountCents: Number(resolved.grossCents ?? row.monthly_amount_cents ?? 0),
      automaticDiscountCents: Number(resolved.automaticDiscountCents ?? 0),
      automaticDiscountComponents: resolved.discountComponents ?? [],
      manualAdjustmentCents: Number(resolved.manualAdjustmentCents ?? 0),
      discountAmountCents: Number(resolved.discountCents ?? 0),
      netMonthlyCents: Number(resolved.netCents ?? 0),
      nextBillDate: effectiveEnrollmentNextBillDate(row),
      startDate: row.start_date ?? null,
      endDate: row.end_date ?? null,
      sourceType: row.source_type,
      sourceId: row.source_id,
      stripeSubscriptionId: row.stripe_subscription_id ?? null,
      stripeSubscriptionScheduleId: row.stripe_subscription_schedule_id ?? null,
      priceSyncStatus: householdMonthlyBillingEnabled
        ? 'not_required'
        : row.price_sync_status ?? 'not_required',
      priceSyncError: householdMonthlyBillingEnabled
        ? null
        : customerFacingPriceSyncError(row.price_sync_error),
      activePriceAdjustment: activeAdjustment,
      activePriceAdjustments: activeAdjustments,
      scheduledPriceAdjustments: rowAdjustments.filter((adjustment) => adjustment.status !== 'revoked'),
      pricingMonth: subscriptionPricingMonth,
    }
  })

  const syncFailures = householdMonthlyBillingEnabled
    ? []
    : subscriptions.filter((subscription) => subscription.priceSyncStatus === 'failed')
  const autopaySetupRequired = enrollments.some((enrollment) => enrollment.collectionMode === 'autopay_setup_required')
  const householdCardRequired = enrollments.some((enrollment) => enrollment.collectionMode === 'household_payment_method_required')
  await resolveAddressedBillingAlerts(pool, {
    accountId: account.id,
    paymentMethodAvailable: paymentMethod.available,
    householdCardRequired,
    householdMonthlyBillingEnabled,
  })
  const resolveEnrollmentAutopayAlerts =
    householdMonthlyBillingEnabled || paymentMethod.available || !householdCardRequired
  const resolveMonthlyInvoicePaymentMethodAlerts = paymentMethod.available || !householdCardRequired
  const resolvedAlertIds = new Set(
    alertsResult.rows
      .filter((row) => (
        isRetiredAnnualMembershipStripeSetupAlert(row) ||
        (resolveEnrollmentAutopayAlerts && row.alert_type === 'enrollment_autopay_setup_required') ||
        (resolveMonthlyInvoicePaymentMethodAlerts && row.alert_type === 'monthly_invoice_payment_method_required')
      ))
      .map((row) => Number(row.id)),
  )
  const annualMemberships = annualMembershipRows.map((membership) => ({
    ...membership,
    lifetimeMember: hasLifetimeOwnerWaiver === true,
  }))
  const cardPresentation = customerBillingCardPresentation(view, displayPricing)
  const monthlyLedgerClassDisplays = await loadTransactionClassDisplay(
    pool,
    (view.monthlyLedgerCharges ?? [])
      .filter((charge) => charge.charge_type === 'recurring')
      .map((charge) => Number(charge.id)),
  )
  const monthlyLedgerBill = buildMonthlyLedgerBill({
    billingMonth: pricingMonth,
    charges: view.monthlyLedgerCharges,
    members,
    classDisplays: monthlyLedgerClassDisplays,
  })
  const accountStatus = customerBillingAccountStatus({
    account,
    enrollments,
    annualMemberships,
  })

  const overview = {
    revision: view.revision,
    account: { ...mapAccount(account), accountStatus },
    selectedMemberId: selectedMemberId == null ? null : Number(selectedMemberId),
    members,
    summary: {
      chargesCents: view.chargesCents,
      paymentsCents: view.paymentsCents,
      refundsCents: view.refundsCents,
      balanceCents: cardPresentation.balanceCents,
      collectibleBalanceCents: view.collectibleBalanceCents,
      outstandingBalanceCents: view.outstandingBalanceCents,
      // The enrollment resolver evaluates the selected billing period's
      // lifecycle rules, including cancellations effective on its first day.
      // The older account snapshot is current-state data and would retain a
      // class until its cancellation date passes.
      monthlyRecurringCents: cardPresentation.monthlyRecurringCents,
      monthlyRecurringDiscountCents: cardPresentation.monthlyRecurringDiscountCents,
      monthlyRecurringPeriod: pricingMonth,
      futureCreditsCents: cardPresentation.futureCreditsCents,
      paidThisMonthCents: view.paidThisMonthCents,
      monthlyTotals: {
        grossCents: Number(displayPricing.grossCents) || 0,
        discountCents: Number(displayPricing.discountCents) || 0,
        netCents: Number(displayPricing.netCents) || 0,
      },
      monthlyLedgerBill,
      nextBillDate,
      latestPayment: view.latestPayment,
      stripeSync: syncFailures.length > 0
        ? {
            status: 'failed',
            message: `${syncFailures.length} Stripe recurring schedule${syncFailures.length === 1 ? ' is' : 's are'} not confirmed. Stripe may still have an older price until synchronization succeeds.`,
          }
        : autopaySetupRequired
          ? { status: 'warning', message: 'Recurring enrollment is not yet connected to automatic monthly collection.' }
          : householdCardRequired
            ? { status: 'warning', message: 'Household monthly billing is active but needs a saved card before it can collect automatically.' }
            : account.household_monthly_billing_enabled === true
              ? { status: 'healthy', message: 'Active classes are collected together through one household monthly Stripe invoice.' }
              : { status: 'healthy', message: 'Local recurring prices are synchronized.' },
    },
    paymentMethod,
    alerts: memberRead ? [] : alertsResult.rows
      .filter((row) => !resolvedAlertIds.has(Number(row.id)))
      .map((row) => ({
      id: Number(row.id),
      type: row.alert_type,
      severity: row.severity,
      message: row.message,
      stripeObjectId: row.stripe_object_id ?? null,
        createdAt: row.created_at,
      })),
    enrollments,
    waitlists,
    annualMemberships,
    subscriptions: memberRead ? [] : subscriptions,
    adjustments: memberRead ? [] : adjustments,
    monthlyInvoices,
    statements: [],
  }
  console.info('[customer-billing] overview loaded', {
    familyId: Number(familyId),
    accountId: Number(account.id),
    readMode,
    memberCount: members.length,
    enrollmentCount: enrollments.length,
    durationMs: Date.now() - startedAt,
  })
  return overview
}

function encodeCursor(row) {
  return Buffer.from(JSON.stringify({
    occurredAt: row.occurred_at,
    sortOrder: Number(row.sort_order),
    refId: Number(row.ref_id),
  })).toString('base64url')
}

async function loadTransactionClassDisplay(pool, chargeIds = []) {
  const ids = [...new Set(chargeIds.map(Number).filter(Number.isFinite))]
  const displayByChargeId = new Map()
  if (ids.length === 0) return displayByChargeId
  const result = await pool.query(
    `SELECT c.id AS charge_id,
            COALESCE(class_p.display_name, class_p.name, title_class.display_name, title_class.name, form.title) AS class_name,
            COALESCE(class_p.id, title_class.id) AS class_catalog_id,
            signup.slot_group_id, signup.time_slot_id,
            slot.week_letter, slot.schedule_mode, slot.specific_date,
            slot.day_of_week, slot.start_time, slot.end_time
       FROM billing_charge c
       JOIN billing_subscription subscription ON subscription.id = c.subscription_id
       JOIN scheduling_signup signup
         ON subscription.source_type = 'scheduling_signup'
        AND subscription.source_id = signup.id::text
       JOIN scheduling_form form ON form.id = signup.form_id
       LEFT JOIN program class_p ON class_p.id = form.program_id
       LEFT JOIN program title_class
         ON form.program_id IS NULL
        AND TRIM(LOWER(title_class.display_name)) = TRIM(LOWER(form.title))
       LEFT JOIN scheduling_time_slot slot ON slot.id = signup.time_slot_id
      WHERE c.id = ANY($1::bigint[])`,
    [ids],
  )
  const groupIds = result.rows
    .filter((row) => row.time_slot_id == null && row.slot_group_id != null)
    .map((row) => Number(row.slot_group_id))
  const { labels, rowsByGroupId } = await loadGroupDisplayLabels(pool, groupIds)
  for (const row of result.rows) {
    const className = String(row.class_name ?? '').trim()
    if (!className) continue
    const schedule = slotLabelForSignupRow(row, labels, rowsByGroupId)
    const catalogId = row.class_catalog_id == null ? null : Number(row.class_catalog_id)
    displayByChargeId.set(Number(row.charge_id), {
      classCatalogId: Number.isFinite(catalogId) ? catalogId : null,
      classSchedule: schedule === '—' ? null : schedule,
      description: `${className}${Number.isFinite(catalogId) ? ` #${catalogId}` : ''}${schedule && schedule !== '—' ? ` · ${schedule}` : ''}`,
    })
  }
  return displayByChargeId
}

function decodeCursor(value) {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'))
    if (!parsed.occurredAt || !Number.isFinite(Number(parsed.sortOrder)) || !Number.isFinite(Number(parsed.refId))) return null
    return parsed
  } catch {
    return null
  }
}

function encodeMemberTransactionCursor(row) {
  return Buffer.from(JSON.stringify({
    occurredAt: row.occurred_at,
    sortOrder: Number(row.sort_order),
    refId: Number(row.ref_id),
    // This is the balance immediately before the next (older) page. Carrying
    // it lets the next page preserve the historical running balance without
    // recalculating a window over the entire account audit.
    runningBalanceCents: Number(row.running_balance_cents) - Number(row.balance_amount_cents),
  })).toString('base64url')
}

function decodeMemberTransactionCursor(value) {
  const parsed = decodeCursor(value)
  if (!parsed || !Number.isFinite(Number(parsed.runningBalanceCents))) return null
  return parsed
}

// The duplicate-invoice repair keeps a canceled local payment as internal
// evidence, but that row never represented a second Stripe collection. Keep
// it out of customer-facing history (and exports) while preserving the repair
// activity and immutable ledger trail for staff audit.
function customerFacingPaymentPredicate(alias = 'p') {
  return `NOT (
    ${alias}.external_status = 'canceled'
    AND ${alias}.stripe_payment_intent_id IS NULL
    AND ${alias}.stripe_invoice_id IS NULL
    AND ${alias}.note LIKE 'Neutralized duplicate local record; remote Stripe payment belongs to billing_payment #%'
  )`
}

export async function listCustomerBillingTransactions(pool, {
  accountId,
  memberId = null,
  type = null,
  status = null,
  search = null,
  from = null,
  through = null,
  cursor = null,
  limit = 100,
}) {
  const decoded = decodeCursor(cursor)
  const pageSize = Math.min(500, Math.max(1, Number(limit) || 100))
  const result = await pool.query(
    `WITH account_members AS (
       SELECT member.id AS member_id
         FROM family_billing_account account
         JOIN member ON ${canonicalActiveHouseholdMemberPredicate({
           memberAlias: 'member',
           familyIdReference: 'account.family_id',
           membershipAlias: 'audit_membership',
           historyAlias: 'audit_membership_history',
         })}
        WHERE account.id = $1
          AND account.is_active = TRUE
     ), entries AS (
       SELECT
         'charge'::text AS entry_kind,
         c.charge_type::text AS entry_type,
         c.id::bigint AS ref_id,
         c.member_id::bigint AS member_id,
         c.description::text AS description,
         (c.amount_cents + COALESCE(charge_adjustments.adjustment_cents, 0))::int AS amount_cents,
         (c.amount_cents + COALESCE(charge_adjustments.adjustment_cents, 0))::int AS balance_amount_cents,
         c.created_at::timestamptz AS occurred_at,
         CASE
           WHEN c.amount_cents = 0
             AND COALESCE(c.gross_amount_cents, 0) > 0
             AND COALESCE(c.discount_amount_cents, 0) = COALESCE(c.gross_amount_cents, 0) THEN 'paid'
           WHEN COALESCE(charge_applications.applied_cents, 0) >= GREATEST(0, c.amount_cents + COALESCE(charge_adjustments.adjustment_cents, 0)) AND c.amount_cents > 0 THEN 'paid'
           WHEN COALESCE(charge_applications.applied_cents, 0) > 0 THEN 'partially_paid'
           ELSE COALESCE(c.collection_status, 'none')
         END::text AS status,
         3::int AS sort_order,
         jsonb_strip_nulls(jsonb_build_object(
           'grossAmountCents', c.gross_amount_cents,
           'originalAmountCents', c.amount_cents,
           'effectiveAmountCents', c.amount_cents + COALESCE(charge_adjustments.adjustment_cents, 0),
           'discountAmountCents', c.discount_amount_cents,
           'discountCode', COALESCE(
             NULLIF(c.metadata->>'discountCode', ''),
             NULLIF(c.metadata->>'promoCode', ''),
             NULLIF(direct_price_adjustment.promo_code, ''),
             NULLIF(charge_adjustments.discount_code, ''),
             one_time_discount.discount_code
           ),
           'discountAnnotations',
             (CASE
               WHEN jsonb_typeof(c.metadata->'discountAnnotations') = 'array'
                 THEN c.metadata->'discountAnnotations'
               WHEN c.discount_amount_cents <> 0 THEN jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
               'kind', CASE
                 WHEN direct_price_adjustment.kind = 'fixed_final_price' THEN 'manual'
                 WHEN COALESCE(NULLIF(c.metadata->>'discountCode', ''), NULLIF(c.metadata->>'promoCode', ''), NULLIF(direct_price_adjustment.promo_code, ''), NULLIF(charge_adjustments.discount_code, ''), one_time_discount.discount_code) IS NULL THEN 'automatic'
                 ELSE 'coupon'
               END,
               'label', CASE
                 WHEN direct_price_adjustment.kind = 'fixed_final_price' THEN 'Manual'
                 ELSE COALESCE(NULLIF(c.metadata->>'discountCode', ''), NULLIF(c.metadata->>'promoCode', ''), NULLIF(direct_price_adjustment.promo_code, ''), NULLIF(charge_adjustments.discount_code, ''), one_time_discount.discount_code, 'Automatic discount')
               END,
               'code', CASE WHEN direct_price_adjustment.kind = 'fixed_final_price' THEN NULL ELSE COALESCE(NULLIF(c.metadata->>'discountCode', ''), NULLIF(c.metadata->>'promoCode', ''), NULLIF(direct_price_adjustment.promo_code, ''), NULLIF(charge_adjustments.discount_code, ''), one_time_discount.discount_code) END,
               'amountCents', -c.discount_amount_cents
             ))) ELSE '[]'::jsonb END) || COALESCE(charge_adjustments.annotations, '[]'::jsonb),
           'servicePeriodStart', c.service_period_start,
           'servicePeriodEnd', c.service_period_end,
           'sourceType', c.source_type,
           'sourceId', c.source_id,
           'subscriptionId', c.subscription_id,
           'priceAdjustmentId', c.price_adjustment_id,
           'relatedChargeId', c.related_charge_id,
           'stripeCheckoutSessionId', c.stripe_checkout_session_id,
           'stripePaymentIntentId', c.stripe_payment_intent_id,
           'createdByUserId', c.created_by_user_id,
           'appliedAmountCents', COALESCE(charge_applications.applied_cents, 0),
           'remainingAmountCents', GREATEST(0, c.amount_cents + COALESCE(charge_adjustments.adjustment_cents, 0) - COALESCE(charge_applications.applied_cents, 0)),
           'paymentApplications', charge_applications.items,
           'metadata', c.metadata
         )) AS details
       FROM billing_charge c
       LEFT JOIN enrollment_price_adjustment direct_price_adjustment
         ON direct_price_adjustment.id = c.price_adjustment_id
       LEFT JOIN LATERAL (
         SELECT COALESCE(
           NULLIF(rule.config->>'code', ''),
           NULLIF(rule.config->>'promo_code', '')
         ) AS discount_code
         FROM discount_redemption redemption
         JOIN discount_rule rule ON rule.id = redemption.rule_id
         WHERE c.charge_type = 'one_time'
           AND c.discount_amount_cents > 0
           AND redemption.member_id = c.member_id
           AND redemption.amount_cents = c.discount_amount_cents
           AND redemption.created_at BETWEEN c.created_at - interval '10 minutes' AND c.created_at + interval '10 minutes'
         ORDER BY ABS(EXTRACT(EPOCH FROM redemption.created_at - c.created_at)), redemption.id DESC
         LIMIT 1
       ) one_time_discount ON TRUE
       LEFT JOIN LATERAL (
         SELECT
           COALESCE(SUM(effective.amount_cents), 0)::int AS applied_cents,
           jsonb_agg(jsonb_build_object(
             'paymentId', effective.payment_id,
             'amountCents', effective.amount_cents,
             'paymentDate', effective.paid_at,
             'paymentMethod', effective.method,
             'allocationReason', effective.allocation_reason
           ) ORDER BY effective.paid_at, effective.payment_id) AS items
         FROM (
           SELECT application.billing_payment_id AS payment_id,
                  payment.paid_at, payment.method,
                  MAX(application.allocation_reason) FILTER (WHERE application.application_kind = 'application') AS allocation_reason,
                  SUM(CASE WHEN application.application_kind = 'reversal' THEN -application.amount_cents ELSE application.amount_cents END)::int AS amount_cents
           FROM billing_payment_application application
           JOIN billing_payment payment ON payment.id = application.billing_payment_id
           WHERE (application.billing_charge_id = c.id OR application.billing_charge_id IN (
             SELECT linked.id
             FROM billing_charge linked
             WHERE (linked.related_charge_id = c.id AND linked.source_type IN ('charge_adjustment', 'refund_offset'))
                OR (
                  linked.source_type IN ('price_adjustment', 'price_adjustment_reversal')
                  AND linked.subscription_id = c.subscription_id
                  AND linked.service_period_start = c.service_period_start
                )
           ))
             AND payment.external_status IN ('settled', 'succeeded')
           GROUP BY application.billing_payment_id, payment.paid_at, payment.method
           HAVING SUM(CASE WHEN application.application_kind = 'reversal' THEN -application.amount_cents ELSE application.amount_cents END) <> 0
         ) effective
       ) charge_applications ON TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(adjustment.amount_cents), 0)::int AS adjustment_cents,
                MAX(COALESCE(NULLIF(adjustment.metadata->>'discountCode', ''), NULLIF(adjustment_price_adjustment.promo_code, ''))) AS discount_code,
                COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                  'kind', CASE WHEN COALESCE(NULLIF(adjustment.metadata->>'discountCode', ''), NULLIF(adjustment_price_adjustment.promo_code, '')) IS NULL THEN 'manual' ELSE 'coupon' END,
                  'label', CASE
                    WHEN c.metadata->'classTransfer'->>'direction' IN ('in', 'out') THEN 'Transfer adjustment'
                    WHEN adjustment.metadata->>'adjustmentKind' = 'class_swap_proration' THEN 'Transfer adjustment'
                    WHEN COALESCE(NULLIF(adjustment.metadata->>'discountCode', ''), NULLIF(adjustment_price_adjustment.promo_code, '')) IS NOT NULL THEN COALESCE(NULLIF(adjustment.metadata->>'discountCode', ''), NULLIF(adjustment_price_adjustment.promo_code, ''))
                    WHEN adjustment.source_type = 'refund_offset' THEN 'Refund adjustment'
                    WHEN adjustment.source_type = 'price_adjustment_reversal' THEN 'Manual adjustment reversal'
                    ELSE 'Manual adjustment'
                  END,
                  'code', COALESCE(NULLIF(adjustment.metadata->>'discountCode', ''), NULLIF(adjustment_price_adjustment.promo_code, '')),
                  'amountCents', adjustment.amount_cents,
                  'chargeId', adjustment.id
                )) ORDER BY adjustment.created_at, adjustment.id), '[]'::jsonb) AS annotations
         FROM billing_charge adjustment
         LEFT JOIN enrollment_price_adjustment adjustment_price_adjustment
           ON adjustment_price_adjustment.id = adjustment.price_adjustment_id
         WHERE (adjustment.related_charge_id = c.id AND adjustment.source_type IN ('charge_adjustment', 'refund_offset'))
            OR (
              adjustment.source_type IN ('price_adjustment', 'price_adjustment_reversal')
              AND adjustment.subscription_id = c.subscription_id
              AND adjustment.service_period_start = c.service_period_start
            )
       ) charge_adjustments ON TRUE
       WHERE c.family_billing_account_id = $1
         -- Keep erroneous system-generated correction rows available to the
         -- immutable internal ledger/activity trail, without surfacing them
         -- as customer-facing transaction lines.
         AND COALESCE(c.metadata->>'customerAuditVisibility', 'visible') <> 'suppressed'
         AND NOT (
           c.related_charge_id IS NOT NULL
           AND c.source_type IN ('charge_adjustment', 'refund_offset')
         )
         AND NOT (
           c.source_type IN ('price_adjustment', 'price_adjustment_reversal')
           AND EXISTS (
             SELECT 1
             FROM billing_charge base_charge
             WHERE base_charge.family_billing_account_id = c.family_billing_account_id
               AND base_charge.subscription_id = c.subscription_id
               AND base_charge.service_period_start = c.service_period_start
               AND base_charge.charge_type = 'recurring'
           )
         )
       UNION ALL
       -- A free/fully discounted drop-in does not have a ledger charge. Surface
       -- its immutable registration as a zero-net audit entry, but never create
       -- a second audit row for a paid drop-in that already has a billing charge.
       SELECT
         'drop_in'::text AS entry_kind,
         'one_time'::text AS entry_type,
         d.id::bigint AS ref_id,
         d.member_id::bigint AS member_id,
         CONCAT(COALESCE(NULLIF(TRIM(class_p.display_name), ''), NULLIF(TRIM(sf.title), ''), 'Drop-in'), ' · Drop-in')::text AS description,
         d.amount_cents::int AS amount_cents,
         0::int AS balance_amount_cents,
         d.class_date::timestamptz AS occurred_at,
         CASE WHEN d.amount_cents = 0 THEN 'settled' ELSE COALESCE(d.status, 'recorded') END::text AS status,
         4::int AS sort_order,
         jsonb_strip_nulls(jsonb_build_object(
           'grossAmountCents', d.base_price_cents,
           'discountAmountCents', GREATEST(0, d.base_price_cents - d.amount_cents),
           'discountCode', NULLIF(d.promo_code, ''),
           'discountBenefit', CASE d.benefit_type
             WHEN 'free_trial' THEN 'Free trial'
             WHEN 'annual_credit' THEN 'Annual membership drop-in credit'
             WHEN 'admin_credit' THEN 'Admin drop-in credit'
             ELSE CASE WHEN d.discount_percent > 0 THEN 'Drop-in member discount' ELSE NULL END
           END,
           'discountPercent', d.discount_percent,
           'servicePeriodStart', d.class_date,
           'servicePeriodEnd', d.class_date,
           'sourceType', 'drop_in_registration',
           'sourceId', d.id,
           'benefitType', d.benefit_type,
           'registrationStatus', d.status
         )) AS details
       FROM drop_in_registration d
       JOIN account_members drop_in_member ON drop_in_member.member_id = d.member_id
       JOIN scheduling_form sf ON sf.id = d.form_id
       LEFT JOIN program class_p ON class_p.id = sf.program_id
       WHERE d.status IN ('confirmed', 'attended')
         AND NOT EXISTS (
           SELECT 1
           FROM billing_charge charged_drop_in
           WHERE charged_drop_in.family_billing_account_id = $1
             AND charged_drop_in.source_type = 'drop_in'
             AND charged_drop_in.source_id = d.id::text
         )
       UNION ALL
       SELECT
         'payment', 'payment', p.id, NULL::bigint,
         CASE
           WHEN p.stripe_invoice_id IS NOT NULL AND EXISTS (
             SELECT 1
               FROM billing_monthly_invoice household_invoice
              WHERE household_invoice.family_billing_account_id = p.family_billing_account_id
                AND household_invoice.stripe_invoice_id = p.stripe_invoice_id
           ) THEN 'Household payment'
           ELSE COALESCE(NULLIF(p.method, ''), 'Payment')
         END,
         -p.amount_cents,
         CASE WHEN p.external_status IN ('settled', 'succeeded') THEN -p.amount_cents ELSE 0 END,
         p.paid_at,
         p.external_status, 2,
         jsonb_build_object(
           'note', p.note,
           'paymentMethod', p.method,
           'externalProcessor', p.external_processor,
           'externalReference', p.external_reference,
           'stripeCustomerId', p.stripe_customer_id,
           'stripePaymentIntentId', p.stripe_payment_intent_id,
           'stripeCheckoutSessionId', p.stripe_checkout_session_id,
           'stripeInvoiceId', p.stripe_invoice_id,
           'recordedByUserId', p.recorded_by_user_id,
           'appliedAmountCents', COALESCE(payment_applications.applied_cents, 0),
           'remainingAmountCents', GREATEST(0, p.amount_cents - COALESCE(payment_applications.applied_cents, 0) - COALESCE(payment_refunds.refunded_cents, 0)),
           'applications', payment_applications.items
         )
       FROM billing_payment p
       LEFT JOIN LATERAL (
         SELECT
           COALESCE(SUM(effective.amount_cents), 0)::int AS applied_cents,
           jsonb_agg(jsonb_build_object(
             'chargeId', effective.charge_id,
             'subscriptionId', effective.subscription_id,
             'description', effective.description,
             'memberId', effective.member_id,
             'memberName', effective.member_name,
             'billingMonth', effective.billing_month,
             'amountCents', effective.amount_cents,
             'allocationReason', effective.allocation_reason
           ) ORDER BY effective.charge_id) AS items
         FROM (
           SELECT application.billing_charge_id AS charge_id,
                  charge.description, charge.member_id, charge.subscription_id,
                  COALESCE(charge.service_period_start, charge.created_at::date) AS billing_month,
                  trim(concat_ws(' ', applied_member.first_name, applied_member.last_name)) AS member_name,
                  MAX(application.allocation_reason) FILTER (WHERE application.application_kind = 'application') AS allocation_reason,
                  SUM(CASE WHEN application.application_kind = 'reversal' THEN -application.amount_cents ELSE application.amount_cents END)::int AS amount_cents
           FROM billing_payment_application application
           JOIN billing_charge charge ON charge.id = application.billing_charge_id
           LEFT JOIN member applied_member ON applied_member.id = charge.member_id
           WHERE application.billing_payment_id = p.id
           GROUP BY application.billing_charge_id, charge.description, charge.member_id, charge.subscription_id,
                    charge.service_period_start, charge.created_at,
                    applied_member.first_name, applied_member.last_name
           HAVING SUM(CASE WHEN application.application_kind = 'reversal' THEN -application.amount_cents ELSE application.amount_cents END) <> 0
         ) effective
       ) payment_applications ON TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(refund.amount_cents), 0)::int AS refunded_cents
         FROM billing_refund refund
         WHERE refund.payment_id = p.id
           AND COALESCE(refund.external_status, 'succeeded') IN ('pending', 'succeeded')
       ) payment_refunds ON TRUE
       WHERE p.family_billing_account_id = $1
         AND ${customerFacingPaymentPredicate('p')}
       UNION ALL
       SELECT
         'refund', 'refund', r.id, NULL::bigint,
         COALESCE(NULLIF(r.reason, ''), 'Refund'),
         r.amount_cents,
         CASE WHEN COALESCE(r.external_status, 'succeeded') = 'succeeded' THEN r.amount_cents ELSE 0 END,
         r.created_at, COALESCE(r.external_status, 'succeeded'), 1,
         jsonb_build_object(
           'paymentId', r.payment_id,
           'stripeRefundId', r.stripe_refund_id,
           'externalReference', r.external_reference,
           'exceptionCategory', r.exception_category,
           'evidenceNote', r.evidence_note,
           'ledgerTreatment', r.ledger_treatment,
           'relatedChargeId', r.related_charge_id,
           'offsetCreditChargeId', r.offset_credit_charge_id,
           'approvedByUserId', r.approved_by_user_id,
           'errorMessage', r.error_message
         )
       FROM billing_refund r WHERE r.family_billing_account_id = $1
     ), with_balance AS (
       SELECT entries.*,
              SUM(balance_amount_cents) OVER (
                ORDER BY occurred_at, sort_order, ref_id
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) AS running_balance_cents
       FROM entries
     )
     SELECT wb.*, TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS member_name
     FROM with_balance wb
     LEFT JOIN member m ON m.id = wb.member_id
     WHERE ($2::bigint IS NULL OR wb.member_id = $2 OR wb.member_id IS NULL)
       AND ($3::text IS NULL OR wb.entry_kind = $3 OR wb.entry_type = $3)
       AND ($4::text IS NULL OR wb.status = $4)
       AND ($5::text IS NULL OR wb.description ILIKE '%' || $5 || '%' OR wb.ref_id::text = $5)
       AND ($6::date IS NULL OR wb.occurred_at >= $6::date)
       AND ($7::date IS NULL OR wb.occurred_at < $7::date + interval '1 day')
       AND (
         $8::timestamptz IS NULL
         OR (wb.occurred_at, wb.sort_order, wb.ref_id) < ($8::timestamptz, $9::int, $10::bigint)
       )
     ORDER BY wb.occurred_at DESC, wb.sort_order DESC, wb.ref_id DESC
     LIMIT $11`,
    [
      accountId,
      memberId == null ? null : Number(memberId),
      type || null,
      status || null,
      String(search ?? '').trim() || null,
      from || null,
      through || null,
      decoded?.occurredAt ?? null,
      decoded?.sortOrder ?? null,
      decoded?.refId ?? null,
      pageSize + 1,
    ],
  )
  const hasMore = result.rows.length > pageSize
  const rows = result.rows.slice(0, pageSize)
  const classDisplayByChargeId = await loadTransactionClassDisplay(pool, rows.flatMap((row) => {
    const details = row.details ?? {}
    const applications = details.applications ?? details.paymentApplications ?? []
    return [
      ...(row.entry_kind === 'charge' && Number.isFinite(Number(details.subscriptionId)) ? [Number(row.ref_id)] : []),
      ...(Array.isArray(applications)
        ? applications
          .filter((application) => Number.isFinite(Number(application?.subscriptionId)))
          .map((application) => Number(application?.chargeId))
        : []),
    ]
  }))
  return {
    rows: rows.map((row) => {
      const rawDetails = row.details ?? {}
      const rawApplications = rawDetails.applications ?? rawDetails.paymentApplications ?? []
      const applications = Array.isArray(rawApplications)
        ? rawApplications.map((application) => {
            const display = classDisplayByChargeId.get(Number(application?.chargeId))
            return display ? { ...application, description: display.description, ...display } : application
          })
        : []
      const chargeDisplay = row.entry_kind === 'charge'
        ? classDisplayByChargeId.get(Number(row.ref_id))
        : null
      const billingMonths = row.entry_kind === 'charge' && row.entry_type === 'recurring'
        ? [billingMonthKey(rawDetails.servicePeriodStart ?? row.occurred_at)]
        : row.entry_kind === 'payment'
          ? [...new Set(
              (Array.isArray(applications) ? applications : [])
                .map((application) => application?.billingMonth)
                .filter(Boolean)
                .map(billingMonthKey),
            )]
          : []
      if (row.entry_kind === 'payment' && billingMonths.length === 0) {
        billingMonths.push(billingMonthKey(row.occurred_at))
      }
      return {
        entryKind: row.entry_kind,
        entryType: row.entry_type,
        refId: Number(row.ref_id),
        memberId: row.member_id == null ? null : Number(row.member_id),
        memberName: row.member_name ?? null,
        description: chargeDisplay?.description ?? row.description,
        billingMonths,
        amountCents: Number(row.amount_cents),
        originalAmountCents: Number(rawDetails.originalAmountCents ?? row.amount_cents),
        effectiveAmountCents: Number(rawDetails.effectiveAmountCents ?? row.amount_cents),
        classCatalogId: chargeDisplay?.classCatalogId ?? null,
        classSchedule: chargeDisplay?.classSchedule ?? null,
        transferTag: classTransferTag(rawDetails.metadata),
        discountAnnotations: Array.isArray(rawDetails.discountAnnotations) ? rawDetails.discountAnnotations : [],
        occurredAt: row.occurred_at,
        status: row.status,
        runningBalanceCents: Number(row.running_balance_cents),
        appliedAmountCents: Number(rawDetails.appliedAmountCents ?? 0),
        remainingAmountCents: Number(rawDetails.remainingAmountCents ?? 0),
        applications,
        details: {
          referenceNumber: Number(row.ref_id),
          ...rawDetails,
          ...(chargeDisplay ?? {}),
          applications,
          paymentApplications: rawDetails.paymentApplications == null ? undefined : applications,
        },
      }
    }),
    nextCursor: hasMore && rows.length > 0 ? encodeCursor(rows.at(-1)) : null,
  }
}

/**
 * Member-facing audit page.
 *
 * The admin audit enriches every candidate row with applications, discount
 * attribution, and other operational metadata. The member portal renders only
 * the columns below, so this path first selects a small, ordered ledger page
 * and enriches the selected charge rows only. The cursor retains the balance
 * before the next page; no full-history window function is needed after page 1.
 */
export async function listMemberCustomerBillingTransactions(pool, {
  accountId,
  cursor = null,
  limit = 50,
}) {
  const decoded = decodeMemberTransactionCursor(cursor)
  const pageSize = Math.min(50, Math.max(1, Number(limit) || 50))
  let pageStartingBalanceCents = decoded ? Number(decoded.runningBalanceCents) : null

  if (pageStartingBalanceCents == null) {
    const balanceResult = await pool.query(
      `SELECT
         COALESCE((
           SELECT SUM(c.amount_cents)::bigint
           FROM billing_charge c
           WHERE c.family_billing_account_id = $1
             AND COALESCE(c.metadata->>'customerAuditVisibility', 'visible') <> 'suppressed'
         ), 0)
         - COALESCE((
           SELECT SUM(p.amount_cents)::bigint
           FROM billing_payment p
           WHERE p.family_billing_account_id = $1
             AND p.external_status IN ('settled', 'succeeded')
         ), 0)
         + COALESCE((
           SELECT SUM(r.amount_cents)::bigint
           FROM billing_refund r
           WHERE r.family_billing_account_id = $1
             AND COALESCE(r.external_status, 'succeeded') = 'succeeded'
         ), 0) AS balance_cents`,
      [accountId],
    )
    pageStartingBalanceCents = Number(balanceResult.rows[0]?.balance_cents ?? 0)
  }

  const result = await pool.query(
    `WITH account_members AS (
       SELECT member.id AS member_id
         FROM family_billing_account account
         JOIN member ON ${canonicalActiveHouseholdMemberPredicate({
           memberAlias: 'member',
           familyIdReference: 'account.family_id',
           membershipAlias: 'member_audit_membership',
           historyAlias: 'member_audit_membership_history',
         })}
        WHERE account.id = $1
          AND account.is_active = TRUE
     ), entries AS (
       SELECT
         'charge'::text AS entry_kind,
         c.charge_type::text AS entry_type,
         c.id::bigint AS ref_id,
         c.member_id::bigint AS member_id,
         c.subscription_id::bigint AS class_subscription_id,
         c.description::text AS description,
         c.metadata AS metadata,
         (c.amount_cents + COALESCE(charge_adjustments.adjustment_cents, 0))::int AS amount_cents,
         (c.amount_cents + COALESCE(charge_adjustments.adjustment_cents, 0))::int AS balance_amount_cents,
         c.created_at::timestamptz AS occurred_at,
         COALESCE(c.service_period_start, c.created_at::date)::date AS billing_month,
         CASE
           WHEN c.amount_cents = 0
             AND COALESCE(c.gross_amount_cents, 0) > 0
             AND COALESCE(c.discount_amount_cents, 0) = COALESCE(c.gross_amount_cents, 0) THEN 'paid'
           ELSE COALESCE(c.collection_status, 'none')
         END::text AS entry_status,
         3::int AS sort_order
       FROM billing_charge c
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(adjustment.amount_cents), 0)::int AS adjustment_cents
         FROM billing_charge adjustment
         WHERE (adjustment.related_charge_id = c.id AND adjustment.source_type IN ('charge_adjustment', 'refund_offset'))
            OR (
              adjustment.source_type IN ('price_adjustment', 'price_adjustment_reversal')
              AND adjustment.subscription_id = c.subscription_id
              AND adjustment.service_period_start = c.service_period_start
            )
       ) charge_adjustments ON TRUE
       WHERE c.family_billing_account_id = $1
         AND COALESCE(c.metadata->>'customerAuditVisibility', 'visible') <> 'suppressed'
         AND NOT (
           c.related_charge_id IS NOT NULL
           AND c.source_type IN ('charge_adjustment', 'refund_offset')
         )
         AND NOT (
           c.source_type IN ('price_adjustment', 'price_adjustment_reversal')
           AND EXISTS (
             SELECT 1
             FROM billing_charge base_charge
             WHERE base_charge.family_billing_account_id = c.family_billing_account_id
               AND base_charge.subscription_id = c.subscription_id
               AND base_charge.service_period_start = c.service_period_start
               AND base_charge.charge_type = 'recurring'
           )
         )

       UNION ALL

       SELECT
         'drop_in'::text AS entry_kind,
         'one_time'::text AS entry_type,
         d.id::bigint AS ref_id,
         d.member_id::bigint AS member_id,
         NULL::bigint AS class_subscription_id,
         CONCAT(COALESCE(NULLIF(TRIM(class_p.display_name), ''), NULLIF(TRIM(sf.title), ''), 'Drop-in'), ' · Drop-in')::text AS description,
         NULL::jsonb AS metadata,
         d.amount_cents::int AS amount_cents,
         0::int AS balance_amount_cents,
         d.class_date::timestamptz AS occurred_at,
         d.class_date::date AS billing_month,
         CASE WHEN d.amount_cents = 0 THEN 'settled' ELSE COALESCE(d.status, 'recorded') END::text AS entry_status,
         4::int AS sort_order
       FROM drop_in_registration d
       JOIN account_members drop_in_member ON drop_in_member.member_id = d.member_id
       JOIN scheduling_form sf ON sf.id = d.form_id
       LEFT JOIN program class_p ON class_p.id = sf.program_id
       WHERE d.status IN ('confirmed', 'attended')
         AND NOT EXISTS (
           SELECT 1
           FROM billing_charge charged_drop_in
           WHERE charged_drop_in.family_billing_account_id = $1
             AND charged_drop_in.source_type = 'drop_in'
             AND charged_drop_in.source_id = d.id::text
         )

       UNION ALL

       SELECT
         'payment'::text AS entry_kind,
         'payment'::text AS entry_type,
         p.id::bigint AS ref_id,
         NULL::bigint AS member_id,
         NULL::bigint AS class_subscription_id,
         COALESCE(NULLIF(p.method, ''), 'Payment')::text AS description,
         NULL::jsonb AS metadata,
         -p.amount_cents::int AS amount_cents,
         CASE WHEN p.external_status IN ('settled', 'succeeded') THEN -p.amount_cents ELSE 0 END::int AS balance_amount_cents,
         p.paid_at::timestamptz AS occurred_at,
         p.paid_at::date AS billing_month,
         p.external_status::text AS entry_status,
         2::int AS sort_order
       FROM billing_payment p
       WHERE p.family_billing_account_id = $1
         AND ${customerFacingPaymentPredicate('p')}

       UNION ALL

       SELECT
         'refund'::text AS entry_kind,
         'refund'::text AS entry_type,
         r.id::bigint AS ref_id,
         NULL::bigint AS member_id,
         NULL::bigint AS class_subscription_id,
         COALESCE(NULLIF(r.reason, ''), 'Refund')::text AS description,
         NULL::jsonb AS metadata,
         r.amount_cents::int AS amount_cents,
         CASE WHEN COALESCE(r.external_status, 'succeeded') = 'succeeded' THEN r.amount_cents ELSE 0 END::int AS balance_amount_cents,
         r.created_at::timestamptz AS occurred_at,
         r.created_at::date AS billing_month,
         COALESCE(r.external_status, 'succeeded')::text AS entry_status,
         1::int AS sort_order
       FROM billing_refund r
       WHERE r.family_billing_account_id = $1
     ), page AS (
       SELECT *
       FROM entries
       WHERE (
         $2::timestamptz IS NULL
         OR (occurred_at, sort_order, ref_id) < ($2::timestamptz, $3::int, $4::bigint)
       )
       ORDER BY occurred_at DESC, sort_order DESC, ref_id DESC
       LIMIT $5
     )
     SELECT page.*,
            COALESCE(
              $6::bigint - SUM(page.balance_amount_cents) OVER (
                ORDER BY page.occurred_at DESC, page.sort_order DESC, page.ref_id DESC
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              $6::bigint
            )::bigint AS running_balance_cents,
            TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS member_name,
            CASE
              WHEN page.entry_kind <> 'charge' THEN page.entry_status
              WHEN page.amount_cents <= 0 THEN 'paid'
              WHEN COALESCE(charge_applications.applied_cents, 0) >= GREATEST(
                0,
                page.amount_cents
              ) AND page.amount_cents > 0 THEN 'paid'
              WHEN COALESCE(charge_applications.applied_cents, 0) > 0 THEN 'partially_paid'
              ELSE page.entry_status
            END::text AS status
     FROM page
     LEFT JOIN member m ON m.id = page.member_id
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(CASE
         WHEN application.application_kind = 'reversal' THEN -application.amount_cents
         ELSE application.amount_cents
       END), 0)::int AS applied_cents
       FROM billing_payment_application application
       JOIN billing_payment settled_payment ON settled_payment.id = application.billing_payment_id
       WHERE page.entry_kind = 'charge'
         AND (application.billing_charge_id = page.ref_id OR application.billing_charge_id IN (
           SELECT linked.id
           FROM billing_charge linked
           WHERE (linked.related_charge_id = page.ref_id AND linked.source_type IN ('charge_adjustment', 'refund_offset'))
              OR (
                linked.source_type IN ('price_adjustment', 'price_adjustment_reversal')
                AND linked.subscription_id = (
                  SELECT base_charge.subscription_id FROM billing_charge base_charge WHERE base_charge.id = page.ref_id
                )
                AND linked.service_period_start = (
                  SELECT base_charge.service_period_start FROM billing_charge base_charge WHERE base_charge.id = page.ref_id
                )
              )
         ))
         AND settled_payment.external_status IN ('settled', 'succeeded')
     ) charge_applications ON TRUE
     LEFT JOIN LATERAL (
       SELECT ARRAY_AGG(
         DISTINCT COALESCE(charge.service_period_start, charge.created_at::date)
         ORDER BY COALESCE(charge.service_period_start, charge.created_at::date)
       ) AS billing_months
       FROM billing_payment_application application
       JOIN billing_charge charge ON charge.id = application.billing_charge_id
       WHERE page.entry_kind = 'payment'
         AND application.billing_payment_id = page.ref_id
         AND application.application_kind = 'application'
     ) payment_months ON TRUE
     ORDER BY page.occurred_at DESC, page.sort_order DESC, page.ref_id DESC`,
    [
      accountId,
      decoded?.occurredAt ?? null,
      decoded?.sortOrder ?? null,
      decoded?.refId ?? null,
      pageSize + 1,
      pageStartingBalanceCents,
    ],
  )

  const hasMore = result.rows.length > pageSize
  const pageRows = result.rows.slice(0, pageSize)
  const classDisplayByChargeId = await loadTransactionClassDisplay(
    pool,
    pageRows
      .filter((row) => row.entry_kind === 'charge' && Number.isFinite(Number(row.class_subscription_id)))
      .map((row) => Number(row.ref_id)),
  )
  const rows = pageRows.map((row) => {
    const chargeDisplay = row.entry_kind === 'charge'
      ? classDisplayByChargeId.get(Number(row.ref_id))
      : null
    return {
    entryKind: row.entry_kind,
    entryType: row.entry_type,
    refId: Number(row.ref_id),
    memberId: row.member_id == null ? null : Number(row.member_id),
    memberName: row.member_name ?? null,
    description: chargeDisplay?.description ?? row.description,
    billingMonths: row.entry_kind === 'charge' && row.entry_type === 'recurring'
      ? [billingMonthKey(row.billing_month ?? row.occurred_at)]
      : row.entry_kind === 'payment'
        ? (Array.isArray(row.billing_months) && row.billing_months.length > 0
            ? row.billing_months.map(billingMonthKey)
            : [billingMonthKey(row.billing_month ?? row.occurred_at)])
        : [],
    amountCents: Number(row.amount_cents),
    occurredAt: row.occurred_at,
    status: row.status,
    runningBalanceCents: Number(row.running_balance_cents),
    balanceAmountCents: Number(row.balance_amount_cents),
    sortOrder: Number(row.sort_order),
    classCatalogId: chargeDisplay?.classCatalogId ?? null,
    classSchedule: chargeDisplay?.classSchedule ?? null,
    transferTag: classTransferTag(row.metadata),
  }
  })

  return {
    rows,
    nextCursor: hasMore && rows.length > 0
      ? encodeMemberTransactionCursor({
          occurred_at: rows.at(-1).occurredAt,
          sort_order: rows.at(-1).sortOrder,
          ref_id: rows.at(-1).refId,
          running_balance_cents: rows.at(-1).runningBalanceCents,
          balance_amount_cents: rows.at(-1).balanceAmountCents,
        })
      : null,
  }
}

export async function listCustomerBillingActivity(pool, {
  accountId,
  memberId = null,
  cursor = null,
  limit = 100,
}) {
  const decoded = decodeCursor(cursor)
  const pageSize = Math.min(200, Math.max(1, Number(limit) || 100))
  const result = await pool.query(
    `SELECT a.*, u.full_name AS actor_name
     FROM billing_account_activity a
     LEFT JOIN app_user u ON u.id = a.actor_user_id
     WHERE a.family_billing_account_id = $1
       AND ($2::bigint IS NULL OR a.member_id = $2 OR a.member_id IS NULL)
       AND (
         $3::timestamptz IS NULL
         OR (a.occurred_at, a.id) < ($3::timestamptz, $4::bigint)
       )
     ORDER BY a.occurred_at DESC, a.id DESC
     LIMIT $5`,
    [
      accountId,
      memberId == null ? null : Number(memberId),
      decoded?.occurredAt ?? null,
      decoded?.refId ?? null,
      pageSize + 1,
    ],
  )
  const hasMore = result.rows.length > pageSize
  const rows = result.rows.slice(0, pageSize)
  return {
    rows: rows.map(mapBillingActivity),
    nextCursor: hasMore && rows.length > 0
      ? Buffer.from(JSON.stringify({
          occurredAt: rows.at(-1).occurred_at,
          sortOrder: 0,
          refId: Number(rows.at(-1).id),
        })).toString('base64url')
      : null,
  }
}

function csvCell(value) {
  const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

export async function exportCustomerBillingTransactionsCsv(pool, filters) {
  const allRows = []
  let cursor = null
  do {
    const page = await listCustomerBillingTransactions(pool, {
      ...filters,
      cursor,
      limit: 500,
    })
    allRows.push(...page.rows)
    cursor = page.nextCursor
  } while (cursor)
  const headers = [
    'Date', 'Member', 'Kind', 'Type', 'Reference', 'Description', 'Status',
    'Amount Cents', 'Running Balance Cents', 'Details',
  ]
  return [
    headers.map(csvCell).join(','),
    ...allRows.map((row) => [
      row.occurredAt,
      row.memberName ?? 'Household',
      row.entryKind,
      row.entryType,
      row.refId,
      row.description,
      row.status,
      row.amountCents,
      row.runningBalanceCents,
      row.details,
    ].map(csvCell).join(',')),
  ].join('\n')
}
