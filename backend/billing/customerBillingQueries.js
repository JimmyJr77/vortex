import { buildBillingAccountView } from './billingAccountView.js'
import { getStripeClient, stripeEnabled } from './stripeBilling.js'
import { buildAdminMemberEnrollments } from '../scheduling/adminEnrollmentsView.js'
import {
  adjustmentCoversPeriod,
  applyEnrollmentPriceAdjustment,
  billingDateKey,
  billingMonthKey,
  mapPriceAdjustment,
} from './customerBillingPricing.js'
import { mapBillingActivity } from './billingActivity.js'
import {
  isMembershipValidThrough,
  membershipRenewsOnFromPurchase,
} from '../scheduling/membershipAnniversary.js'
import { resolveFamilyEnrollmentPricing } from './familyEnrollmentPricing.js'

const INTERNAL_PRICE_SYNC_MESSAGES = new Set([
  'Restored promo assignment requires Stripe expiration-schedule synchronization.',
])

export function customerFacingPriceSyncError(value) {
  const message = String(value ?? '').trim()
  if (!message || INTERNAL_PRICE_SYNC_MESSAGES.has(message)) return null
  return message
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
      isMembershipValidThrough(row.satisfied_at ?? row.created_at, asOf)
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
    const renewalFromRedemption = referenceRedemption
      ? membershipRenewsOnFromPurchase(referenceRedemption.satisfied_at ?? referenceRedemption.created_at)
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
        activeSubscription?.stripe_subscription_id &&
        activeSubscription.status !== 'cancelled' &&
        activeSubscription.auto_renewal !== false,
      ),
      canManageAutoRenewal: Boolean(
        referenceSubscription?.stripe_subscription_id &&
        referenceSubscription.status !== 'cancelled',
      ),
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
      `SELECT c.member_id, c.source_type, c.source_id, c.created_at,
              CASE
                WHEN COALESCE(app.applied_cents, 0) >= c.amount_cents THEN 'paid'
                WHEN COALESCE(app.applied_cents, 0) > 0 THEN 'partially_paid'
                ELSE c.collection_status
              END AS collection_status,
              app.paid_at
       FROM billing_charge c
       LEFT JOIN LATERAL (
         SELECT
           SUM(CASE WHEN application.application_kind = 'reversal' THEN -application.amount_cents ELSE application.amount_cents END)::int AS applied_cents,
           MAX(payment.paid_at) FILTER (WHERE application.application_kind = 'application') AS paid_at
         FROM billing_payment_application application
         JOIN billing_payment payment ON payment.id = application.billing_payment_id
         WHERE application.billing_charge_id = c.id
       ) app ON TRUE
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

export async function ensureCustomerBillingAccount(pool, familyId, facilityId = null) {
  const family = await pool.query(
    `SELECT * FROM family
     WHERE id = $1 AND ($2::bigint IS NULL OR facility_id = $2)`,
    [Number(familyId), facilityId],
  )
  if (!family.rows[0]) return null
  const existing = await pool.query(
    `SELECT * FROM family_billing_account WHERE family_id = $1`,
    [Number(familyId)],
  )
  if (existing.rows[0]) return { ...existing.rows[0], family_name: family.rows[0].family_name }
  const created = await pool.query(
    `INSERT INTO family_billing_account (
       family_id, payer_member_id, billing_email, billing_phone,
       billing_street, billing_city, billing_state, billing_zip
     )
     SELECT f.id, m.id, m.email, m.phone, m.billing_street,
            m.billing_city, m.billing_state, m.billing_zip
     FROM family f
     LEFT JOIN LATERAL (
       SELECT * FROM member
       WHERE family_id = f.id AND is_active = TRUE
       ORDER BY (email IS NULL), id LIMIT 1
     ) m ON TRUE
     WHERE f.id = $1
     ON CONFLICT (family_id) DO UPDATE SET updated_at = family_billing_account.updated_at
     RETURNING *`,
    [Number(familyId)],
  )
  return created.rows[0] ? { ...created.rows[0], family_name: family.rows[0].family_name } : null
}

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
     JOIN member m ON (
       m.family_id = f.id OR EXISTS (
         SELECT 1 FROM family_member fm
         WHERE fm.family_id = f.id AND fm.member_id = m.id AND fm.is_active = TRUE
       )
     )
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
     WHERE m.family_id = $1 OR EXISTS (
       SELECT 1 FROM family_member fm
       WHERE fm.family_id = $1 AND fm.member_id = m.id AND fm.is_active = TRUE
     )
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

export async function loadDefaultPaymentMethodSummary(account) {
  if (!account?.stripe_customer_id || !stripeEnabled()) {
    return { available: false, stripeEnabled: stripeEnabled(), paymentMethod: null }
  }
  try {
    const stripe = await getStripeClient()
    if (!stripe) return { available: false, stripeEnabled: true, paymentMethod: null }
    const customer = await stripe.customers.retrieve(account.stripe_customer_id, {
      expand: ['invoice_settings.default_payment_method'],
    })
    if (!customer || customer.deleted) return { available: false, stripeEnabled: true, paymentMethod: null }
    let paymentMethod = customer.invoice_settings?.default_payment_method ?? null
    if (typeof paymentMethod === 'string') paymentMethod = await stripe.paymentMethods.retrieve(paymentMethod)
    if (!paymentMethod) {
      const methods = await stripe.paymentMethods.list({ customer: customer.id, type: 'card', limit: 1 })
      paymentMethod = methods.data?.[0] ?? null
    }
    const card = paymentMethod?.card
    return {
      available: Boolean(paymentMethod?.id),
      stripeEnabled: true,
      paymentMethod: paymentMethod?.id
        ? {
            id: paymentMethod.id,
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
    isActive: account.is_active !== false,
  }
}

function relevantEnrollment(row) {
  return ['confirmed', 'active', 'requested', 'paused', 'waitlisted'].includes(row.status)
}

function customerEnrollmentStatus(row) {
  if (row.status === 'requested') return 'pending_cancellation'
  const starts = billingDateKey(row.enrollment_start_date)
  const today = new Date().toISOString().slice(0, 10)
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
}) {
  const account = await ensureCustomerBillingAccount(pool, familyId, facilityId)
  if (!account) return null
  const members = await loadFamilyMembers(pool, familyId)
  if (selectedMemberId != null && !members.some((member) => member.id === Number(selectedMemberId))) {
    throw new Error('Selected member does not belong to this family.')
  }

  const [
    view,
    enrollmentGroups,
    rawSubscriptions,
    adjustmentsResult,
    alertsResult,
    annualMemberships,
    paymentMethod,
  ] =
    await Promise.all([
      buildBillingAccountView(pool, account, { memberScopeId: null }),
      Promise.all(
        members.map(async (member) => ({
          member,
          ...(await buildAdminMemberEnrollments(pool, member.id)),
        })),
      ),
      pool.query(
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
             ) AS oldest_unpaid_service_period_start,
             MAX(charge.service_period_end) FILTER (
               WHERE charge.service_period_end IS NOT NULL
                 AND charge.applied_cents >= charge.amount_cents
             ) AS paid_through_date
           FROM (
             SELECT c.amount_cents, c.service_period_start, c.service_period_end,
                    COALESCE((
                      SELECT SUM(CASE
                        WHEN application.application_kind = 'reversal' THEN -application.amount_cents
                        ELSE application.amount_cents
                      END)
                      FROM billing_payment_application application
                      WHERE application.billing_charge_id = c.id
                    ), 0)::int AS applied_cents
             FROM billing_charge c
             WHERE c.subscription_id = bs.id
               AND c.charge_type = 'recurring'
               AND c.amount_cents > 0
           ) charge
         ) coverage ON TRUE
         WHERE bs.family_billing_account_id = $1 AND bs.status <> 'cancelled'
         ORDER BY bs.status, bs.created_at, bs.id`,
        [account.id],
      ),
      pool.query(
        `SELECT * FROM enrollment_price_adjustment
         WHERE family_billing_account_id = $1
         ORDER BY effective_from_month, created_at, id`,
        [account.id],
      ).catch((error) => {
        if (error?.code === '42P01') return { rows: [] }
        throw error
      }),
      pool.query(
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
      loadDefaultPaymentMethodSummary(account),
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
  const currentMonth = billingMonthKey(new Date())
  const nextBillDate = earliestActiveNextBillDate(rawSubscriptions.rows)
  const pricingMonth = nextBillDate ? billingMonthKey(nextBillDate) : currentMonth
  const displayPricing = await resolveFamilyEnrollmentPricing(pool, {
    familyId,
    periodKey: pricingMonth,
    subscriptions: rawSubscriptions.rows,
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
        memberName: group.member.name,
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
        priceSyncStatus: subscription?.price_sync_status ?? 'not_required',
        priceSyncError: customerFacingPriceSyncError(subscription?.price_sync_error),
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
      priceSyncStatus: row.price_sync_status ?? 'not_required',
      priceSyncError: customerFacingPriceSyncError(row.price_sync_error),
      activePriceAdjustment: activeAdjustment,
      activePriceAdjustments: activeAdjustments,
      scheduledPriceAdjustments: rowAdjustments.filter((adjustment) => adjustment.status !== 'revoked'),
      pricingMonth: subscriptionPricingMonth,
    }
  })

  const latestPayment = view.payments?.[0] ?? null
  const syncFailures = subscriptions.filter((subscription) => subscription.priceSyncStatus === 'failed')

  return {
    account: mapAccount(account),
    selectedMemberId: selectedMemberId == null ? null : Number(selectedMemberId),
    members,
    summary: {
      chargesCents: view.chargesCents,
      paymentsCents: view.paymentsCents,
      refundsCents: view.refundsCents,
      balanceCents: view.balanceCents,
      outstandingBalanceCents: view.outstandingBalanceCents,
      futureCreditsCents: view.futureCreditsCents,
      paidThisMonthCents: view.paidThisMonthCents,
      monthlyTotals: {
        grossCents: Number(displayPricing.grossCents) || 0,
        discountCents: Number(displayPricing.discountCents) || 0,
        netCents: Number(displayPricing.netCents) || 0,
      },
      nextBillDate,
      latestPayment: latestPayment
        ? {
            id: Number(latestPayment.id),
            amountCents: Number(latestPayment.amount_cents ?? 0),
            paidAt: latestPayment.paid_at,
            method: latestPayment.method ?? null,
          }
        : null,
      stripeSync: syncFailures.length > 0
        ? {
            status: 'failed',
            message: `${syncFailures.length} Stripe recurring schedule${syncFailures.length === 1 ? ' is' : 's are'} not confirmed. Stripe may still have an older price until synchronization succeeds.`,
          }
        : { status: 'healthy', message: 'Local recurring prices are synchronized.' },
    },
    paymentMethod,
    alerts: alertsResult.rows.map((row) => ({
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
    subscriptions,
    adjustments,
    statements: [],
  }
}

function encodeCursor(row) {
  return Buffer.from(JSON.stringify({
    occurredAt: row.occurred_at,
    sortOrder: Number(row.sort_order),
    refId: Number(row.ref_id),
  })).toString('base64url')
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
    `WITH entries AS (
       SELECT
         'charge'::text AS entry_kind,
         c.charge_type::text AS entry_type,
         c.id::bigint AS ref_id,
         c.member_id::bigint AS member_id,
         c.description::text AS description,
         c.amount_cents::int AS amount_cents,
         c.amount_cents::int AS balance_amount_cents,
         c.created_at::timestamptz AS occurred_at,
         CASE
           WHEN COALESCE(charge_applications.applied_cents, 0) >= GREATEST(c.amount_cents, 0) AND c.amount_cents > 0 THEN 'paid'
           WHEN COALESCE(charge_applications.applied_cents, 0) > 0 THEN 'partially_paid'
           ELSE COALESCE(c.collection_status, 'none')
         END::text AS status,
         3::int AS sort_order,
         jsonb_strip_nulls(jsonb_build_object(
           'grossAmountCents', c.gross_amount_cents,
           'discountAmountCents', c.discount_amount_cents,
           'discountCode', CASE
             WHEN c.charge_type = 'one_time' THEN COALESCE(
               NULLIF(c.metadata->>'discountCode', ''),
               NULLIF(c.metadata->>'promoCode', ''),
               one_time_discount.discount_code
             )
             ELSE NULL
           END,
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
           'remainingAmountCents', GREATEST(0, c.amount_cents - COALESCE(charge_applications.applied_cents, 0)),
           'paymentApplications', charge_applications.items,
           'metadata', c.metadata
         )) AS details
       FROM billing_charge c
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
           WHERE application.billing_charge_id = c.id
           GROUP BY application.billing_payment_id, payment.paid_at, payment.method
           HAVING SUM(CASE WHEN application.application_kind = 'reversal' THEN -application.amount_cents ELSE application.amount_cents END) <> 0
         ) effective
       ) charge_applications ON TRUE
       WHERE c.family_billing_account_id = $1
       UNION ALL
       -- Free and discounted drop-ins do not create a billing_charge because their
       -- net amount can be zero. Surface the immutable registration as a zero-net
       -- one-time audit entry instead of making the benefit disappear from the
       -- household's financial history.
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
       JOIN member drop_in_member ON drop_in_member.id = d.member_id
       JOIN family_billing_account drop_in_account
         ON drop_in_account.family_id = drop_in_member.family_id
        AND drop_in_account.id = $1
       JOIN scheduling_form sf ON sf.id = d.form_id
       LEFT JOIN program class_p ON class_p.id = sf.program_id
       WHERE d.status IN ('confirmed', 'attended')
       UNION ALL
       SELECT
         'payment', 'payment', p.id, NULL::bigint,
         COALESCE(NULLIF(p.method, ''), 'Payment'),
         -p.amount_cents, -p.amount_cents, p.paid_at,
         COALESCE(p.external_status, 'recorded'), 2,
         jsonb_build_object(
           'note', p.note,
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
             'description', effective.description,
             'memberId', effective.member_id,
             'memberName', effective.member_name,
             'billingMonth', effective.billing_month,
             'amountCents', effective.amount_cents,
             'allocationReason', effective.allocation_reason
           ) ORDER BY effective.charge_id) AS items
         FROM (
           SELECT application.billing_charge_id AS charge_id,
                  charge.description, charge.member_id,
                  COALESCE(charge.service_period_start, charge.created_at::date) AS billing_month,
                  trim(concat_ws(' ', applied_member.first_name, applied_member.last_name)) AS member_name,
                  MAX(application.allocation_reason) FILTER (WHERE application.application_kind = 'application') AS allocation_reason,
                  SUM(CASE WHEN application.application_kind = 'reversal' THEN -application.amount_cents ELSE application.amount_cents END)::int AS amount_cents
           FROM billing_payment_application application
           JOIN billing_charge charge ON charge.id = application.billing_charge_id
           LEFT JOIN member applied_member ON applied_member.id = charge.member_id
           WHERE application.billing_payment_id = p.id
           GROUP BY application.billing_charge_id, charge.description, charge.member_id,
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
  return {
    rows: rows.map((row) => {
      const rawDetails = row.details ?? {}
      const applications = rawDetails.applications ?? rawDetails.paymentApplications ?? []
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
        description: row.description,
        billingMonths,
        amountCents: Number(row.amount_cents),
        occurredAt: row.occurred_at,
        status: row.status,
        runningBalanceCents: Number(row.running_balance_cents),
        appliedAmountCents: Number(rawDetails.appliedAmountCents ?? 0),
        remainingAmountCents: Number(rawDetails.remainingAmountCents ?? 0),
        applications,
        details: { referenceNumber: Number(row.ref_id), ...rawDetails },
      }
    }),
    nextCursor: hasMore && rows.length > 0 ? encodeCursor(rows.at(-1)) : null,
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
