/**
 * Standalone annual membership purchase (access-only — no class signup).
 * Year 1 collected at Checkout; yearly renewal remains on the local ledger.
 * Supports one or many athletes in a single Checkout session.
 */

import {
  getStripeClient,
  stripeEnabled,
  ensureStripeBillingSchema,
  ensureStripeCustomer,
  applyAndSettlePaidCheckoutFulfillment,
  recordEnrollmentStripePayment,
  recordPaidCheckoutFulfillmentQuarantine,
} from './stripeBilling.js'
import { ensureStripeCatalogSchema } from './stripeCatalogSync.js'
import { ensureBillingChargeSchema } from './billingChargeSchema.js'
import {
  loadActiveAnnualMembership,
  memberHasActiveAnnualMembership,
} from '../scheduling/annualMembership.js'
import {
  membershipRenewsOnFromPurchase,
  toUtcDateString,
} from '../scheduling/membershipAnniversary.js'
import { mapFeeRow, loadActiveAdditionalFees } from '../scheduling/additionalFeesEngine.js'
import {
  createEnrollmentAnnualMembershipSubscriptions,
  preserveEnrollmentCheckoutPaymentMethod,
} from './stripeEnrollmentCheckout.js'
import {
  allocateHouseholdPayments,
  allocateHouseholdPaymentsLocked,
} from './paymentAllocation.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { canonicalActiveHouseholdMemberPredicate } from './householdMembership.js'
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
import { findActivePurchaseCheckoutOwner } from './purchaseCheckoutAdmission.js'
import { findCompletedPaidCheckoutFulfillmentGap } from './paidCheckoutCollectionGuard.js'

export const ANNUAL_MEMBERSHIP_SPORT_NAME = 'Membership'
export const ANNUAL_MEMBERSHIP_PROGRAM_NAME = 'Annual Membership'

function unavailableAnnualMembershipOffer() {
  return {
    available: false,
    fee: null,
    active: false,
    renewsOn: null,
    cycleStart: null,
    amountCents: 0,
    sportName: ANNUAL_MEMBERSHIP_SPORT_NAME,
    programName: ANNUAL_MEMBERSHIP_PROGRAM_NAME,
  }
}

function publicAppUrl() {
  return String(process.env.PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:5173').replace(
    /\/$/,
    '',
  )
}

function parseMemberIds({ athleteMemberId, memberIds }) {
  if (Array.isArray(memberIds) && memberIds.length > 0) {
    return [...new Set(memberIds.map(Number).filter((id) => Number.isFinite(id) && id > 0))]
  }
  const single = Number(athleteMemberId)
  return Number.isFinite(single) && single > 0 ? [single] : []
}

function annualMembershipAccountError(message, status = 403) {
  const error = new Error(message)
  error.status = status
  return error
}

function requireActiveAnnualMembershipAccount(account, payerMemberId) {
  const accountId = Number(account?.id)
  const familyId = Number(account?.family_id)
  const facilityId = Number(account?.family_facility_id ?? account?.facility_id)
  const payerId = Number(payerMemberId)
  if (
    account?.is_active !== true ||
    !Number.isInteger(accountId) || accountId <= 0 ||
    !Number.isInteger(familyId) || familyId <= 0 ||
    !Number.isInteger(facilityId) || facilityId <= 0
  ) {
    throw annualMembershipAccountError('The family billing account is not active.')
  }
  if (
    !Number.isInteger(payerId) || payerId <= 0 ||
    Number(account.payer_member_id) !== payerId
  ) {
    throw annualMembershipAccountError('Only the active family payer can purchase annual membership.')
  }
  return { accountId, familyId, facilityId, payerMemberId: payerId }
}

async function loadActiveAnnualMembershipAccount(pool, accountId) {
  const normalizedAccountId = Number(accountId)
  if (!Number.isInteger(normalizedAccountId) || normalizedAccountId <= 0) return null
  const result = await pool.query(
    `SELECT account.*, family.facility_id AS family_facility_id
       FROM family_billing_account account
       JOIN family ON family.id = account.family_id
      WHERE account.id = $1
        AND account.is_active = TRUE`,
    [normalizedAccountId],
  )
  return result.rows[0] ?? null
}

/** Pick the annual fee for one explicit facility. */
export async function loadAnnualMembershipFee(pool, facilityId) {
  const normalizedFacilityId = Number(facilityId)
  if (!Number.isInteger(normalizedFacilityId) || normalizedFacilityId <= 0) return null
  const fees = await loadActiveAdditionalFees(pool, normalizedFacilityId)
  const annual = fees.find(
    (fee) =>
      (fee.triggerType === 'once_per_year' || fee.applyBasis === 'per_year') &&
      fee.amountCents > 0,
  )
  return annual ?? null
}

/**
 * Offer + status for the Classes tab Membership card.
 * @returns {Promise<{
 *   available: boolean,
 *   fee: object|null,
 *   active: boolean,
 *   renewsOn: string|null,
 *   cycleStart: string|null,
 *   amountCents: number,
 *   sportName: string,
 *   programName: string,
 * }>}
 */
export async function getAnnualMembershipOffer(pool, memberId, facilityId = null) {
  const normalizedMemberId = Number(memberId)
  const requestedFacilityId = facilityId == null ? null : Number(facilityId)
  if (!Number.isInteger(normalizedMemberId) || normalizedMemberId <= 0) {
    return unavailableAnnualMembershipOffer()
  }
  if (
    requestedFacilityId != null &&
    (!Number.isInteger(requestedFacilityId) || requestedFacilityId <= 0)
  ) return unavailableAnnualMembershipOffer()
  const memberResult = await pool.query(
    `SELECT facility_id
       FROM member
      WHERE id = $1
        AND is_active = TRUE
        AND ($2::bigint IS NULL OR facility_id = $2)`,
    [normalizedMemberId, requestedFacilityId],
  )
  const memberFacilityId = Number(memberResult.rows[0]?.facility_id)
  if (!Number.isInteger(memberFacilityId) || memberFacilityId <= 0) {
    return unavailableAnnualMembershipOffer()
  }
  const fee = await loadAnnualMembershipFee(pool, memberFacilityId)
  const membership = await loadActiveAnnualMembership(pool, normalizedMemberId)
  return {
    available: Boolean(fee),
    fee: fee
      ? {
          feeId: fee.id,
          name: fee.name || ANNUAL_MEMBERSHIP_PROGRAM_NAME,
          amountCents: fee.amountCents,
          description: fee.description,
        }
      : null,
    active: Boolean(membership?.active),
    renewsOn: membership?.renewsOn ? toUtcDateString(membership.renewsOn) : null,
    cycleStart: membership?.cycleStart ? toUtcDateString(membership.cycleStart) : null,
    amountCents: fee?.amountCents ?? 0,
    sportName: ANNUAL_MEMBERSHIP_SPORT_NAME,
    programName: ANNUAL_MEMBERSHIP_PROGRAM_NAME,
  }
}

export async function ensureAnnualMembershipFamilyMemberAccess(pool, {
  familyId,
  memberId,
  facilityId,
}) {
  const normalizedFamilyId = Number(familyId)
  const normalizedMemberId = Number(memberId)
  const normalizedFacilityId = Number(facilityId)
  if (
    !Number.isInteger(normalizedFamilyId) || normalizedFamilyId <= 0 ||
    !Number.isInteger(normalizedMemberId) || normalizedMemberId <= 0 ||
    !Number.isInteger(normalizedFacilityId) || normalizedFacilityId <= 0
  ) return { ok: false, status: 404, message: 'Athlete not found.' }
  const memberRes = await pool.query(
    `SELECT member.id, member.family_id, member.facility_id,
            member.first_name, member.last_name
       FROM family
       JOIN member ON member.id = $2
      WHERE family.id = $1
        AND family.facility_id = $3
        AND member.facility_id = family.facility_id
        AND ${canonicalActiveHouseholdMemberPredicate({
          memberAlias: 'member',
          familyIdReference: 'family.id',
          membershipAlias: 'annual_membership_family',
          historyAlias: 'annual_membership_family_history',
        })}`,
    [normalizedFamilyId, normalizedMemberId, normalizedFacilityId],
  )
  const member = memberRes.rows[0]
  if (!member) return { ok: false, status: 404, message: 'Athlete not found.' }
  return { ok: true, member }
}

async function requireActiveAnnualMembershipPayer(pool, accountContext) {
  const access = await ensureAnnualMembershipFamilyMemberAccess(pool, {
    familyId: accountContext.familyId,
    memberId: accountContext.payerMemberId,
    facilityId: accountContext.facilityId,
  })
  if (!access.ok) {
    throw annualMembershipAccountError('The family billing payer is not an active household member.')
  }
  return access.member
}

export function annualCheckoutSnapshot(fee, pricedMembers) {
  const members = [...pricedMembers]
    .map((row) => ({
      memberId: Number(row.memberId),
      memberName: [row.member?.first_name, row.member?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim(),
      feeId: Number(fee.id),
      feeName: String(fee.name || ANNUAL_MEMBERSHIP_PROGRAM_NAME),
      triggerType: fee.triggerType,
      applyBasis: fee.applyBasis,
      grossCents: Math.max(0, Math.round(Number(row.grossCents) || 0)),
      discountCents: Math.max(0, Math.round(Number(row.discountCents) || 0)),
      netCents: Math.max(0, Math.round(Number(row.netCents) || 0)),
      promo: row.promo
        ? {
            ruleId: Number(row.promo.rule.id),
            code: String(row.promo.code || ''),
          }
        : null,
    }))
    .sort((left, right) => left.memberId - right.memberId)
  return {
    version: 1,
    currency: 'usd',
    members,
    expectedAmountCents: members.reduce((sum, row) => sum + row.netCents, 0),
  }
}

function annualCheckoutIntentFingerprint({
  accountId,
  payerMemberId,
  athleteMemberId,
  memberIds,
  promoCode,
  promoCodesByMemberId,
  successUrl,
  cancelUrl,
}) {
  const selectedMemberIds = parseMemberIds({ athleteMemberId, memberIds }).sort((a, b) => a - b)
  const perMemberPromos = Object.fromEntries(
    Object.entries(promoCodesByMemberId || {})
      .map(([key, value]) => [String(Number(key)), String(value ?? '').trim().toUpperCase()])
      .filter(([key, value]) => Number(key) > 0 && value)
      .sort(([left], [right]) => Number(left) - Number(right)),
  )
  return checkoutFingerprint({
    accountId: Number(accountId),
    payerMemberId: Number(payerMemberId),
    memberIds: selectedMemberIds,
    promoCode: String(promoCode ?? '').trim().toUpperCase(),
    promoCodesByMemberId: perMemberPromos,
    successUrl: String(successUrl ?? ''),
    cancelUrl: String(cancelUrl ?? ''),
  })
}

export function parseAnnualCheckoutSnapshot(request) {
  const snapshot = request?.pricing_snapshot
  if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.members)) {
    throw checkoutIdempotencyConflict('Annual membership checkout is missing its immutable pricing snapshot.')
  }
  const hash = checkoutFingerprint(snapshot)
  if (hash !== String(request.pricing_snapshot_hash ?? '')) {
    throw checkoutIdempotencyConflict('Annual membership checkout pricing snapshot failed integrity validation.')
  }
  if (
    snapshot.currency !== request.currency ||
    Number(snapshot.expectedAmountCents) !== Number(request.expected_amount_cents)
  ) {
    throw checkoutIdempotencyConflict('Annual membership checkout totals no longer match the stored request.')
  }
  for (const row of snapshot.members) {
    const gross = Number(row.grossCents)
    const discount = Number(row.discountCents)
    const net = Number(row.netCents)
    if (
      !Number.isInteger(Number(row.memberId)) || Number(row.memberId) <= 0 ||
      !Number.isInteger(Number(row.feeId)) || Number(row.feeId) <= 0 ||
      !Number.isInteger(gross) || gross < 0 ||
      !Number.isInteger(discount) || discount < 0 || discount > gross ||
      !Number.isInteger(net) || net !== gross - discount
    ) {
      throw checkoutIdempotencyConflict('Annual membership checkout contains invalid per-member pricing terms.')
    }
  }
  return snapshot
}

export function validateAnnualMembershipCheckoutSettlement(session, request, {
  expectedCustomerId,
  allowForbiddenSubscriptionCollector = false,
} = {}) {
  const paid = allowForbiddenSubscriptionCollector
    ? session?.payment_status === 'paid'
    : annualMembershipCheckoutSessionIsPaid(session)
  if (!paid) return { ok: false, reason: 'unpaid' }
  if (session?.status !== 'complete') return { ok: false, reason: 'settlement_not_complete' }
  const allowedModes = allowForbiddenSubscriptionCollector
    ? new Set(['payment', 'subscription'])
    : new Set(['payment'])
  if (!allowedModes.has(String(session?.mode ?? 'payment'))) {
    return { ok: false, reason: 'settlement_mode_mismatch' }
  }
  if (String(session?.currency ?? '').toLowerCase() !== String(request?.currency ?? '')) {
    return { ok: false, reason: 'settlement_currency_mismatch' }
  }
  if (
    !Number.isInteger(Number(session?.amount_total)) ||
    Number(session.amount_total) !== Number(request?.expected_amount_cents)
  ) return { ok: false, reason: 'settlement_amount_mismatch' }
  if (expectedCustomerId !== undefined) {
    const expected = String(expectedCustomerId ?? '').trim()
    const observed = typeof session?.customer === 'string'
      ? session.customer
      : session?.customer?.id ?? null
    if (!expected || String(observed ?? '') !== expected) {
      return { ok: false, reason: 'settlement_customer_mismatch' }
    }
  }
  return { ok: true }
}

/** Verify an open or terminal Stripe Session against immutable annual terms. */
export function assertAnnualMembershipCheckoutSessionBinding(
  session,
  request,
  snapshot,
  { expectedCustomerId } = {},
) {
  const metadata = session?.metadata ?? {}
  const observedCustomerId = typeof session?.customer === 'string'
    ? session.customer
    : session?.customer?.id ?? null
  const paidMembers = (snapshot?.members ?? [])
    .filter((row) => Number(row.netCents) > 0)
    .map((row) => Number(row.memberId))
  const metadataMemberIds = String(metadata.memberIds ?? '')
    .split(',')
    .filter(Boolean)
    .map(Number)
  const expectedFeeId = Number(
    (snapshot?.members ?? []).find((row) => Number(row.netCents) > 0)?.feeId,
  )
  const problems = []
  if (!session?.id) problems.push('checkout_session_missing')
  if (!['open', 'complete', 'expired'].includes(String(session?.status ?? ''))) {
    problems.push('checkout_status_unsupported')
  }
  if (session?.mode !== 'payment') problems.push('checkout_mode_mismatch')
  if (String(session?.currency ?? '').toLowerCase() !== String(request?.currency ?? '')) {
    problems.push('checkout_currency_mismatch')
  }
  if (Number(session?.amount_total) !== Number(request?.expected_amount_cents)) {
    problems.push('checkout_amount_mismatch')
  }
  if (expectedCustomerId !== undefined) {
    if (!expectedCustomerId || String(observedCustomerId ?? '') !== String(expectedCustomerId)) {
      problems.push('checkout_customer_mismatch')
    }
  }
  if (metadata.checkoutType !== 'annual_membership') problems.push('checkout_type_mismatch')
  if (Number(metadata.annualMembershipCheckoutRequestId) !== Number(request?.id)) {
    problems.push('checkout_request_mismatch')
  }
  if (Number(metadata.familyBillingAccountId) !== Number(request?.family_billing_account_id)) {
    problems.push('billing_account_mismatch')
  }
  if (Number(metadata.payerMemberId) !== Number(request?.payer_member_id)) {
    problems.push('payer_mismatch')
  }
  if (String(metadata.pricingSnapshotHash ?? '') !== String(request?.pricing_snapshot_hash ?? '')) {
    problems.push('pricing_snapshot_mismatch')
  }
  if (Number(metadata.amountCents) !== Number(request?.expected_amount_cents)) {
    problems.push('metadata_amount_mismatch')
  }
  if (
    paidMembers.length === 0
    || metadataMemberIds.length !== paidMembers.length
    || metadataMemberIds.some((memberId, index) => memberId !== paidMembers[index])
    || Number(metadata.memberId) !== paidMembers[0]
  ) problems.push('member_snapshot_mismatch')
  if (!Number.isSafeInteger(expectedFeeId) || Number(metadata.feeId) !== expectedFeeId) {
    problems.push('fee_snapshot_mismatch')
  }
  if (session?.payment_status === 'paid' && session?.status !== 'complete') {
    problems.push('paid_checkout_not_complete')
  }
  if (problems.length > 0) {
    const error = checkoutIdempotencyConflict(
      'Stripe Checkout does not match the immutable annual membership request.',
    )
    error.problems = problems
    throw error
  }
  return true
}

/**
 * Prove paid cash against only the immutable annual Checkout request and its
 * exact bound Stripe Session. Current payer, customer ownership, and member
 * eligibility are intentionally checked later and can quarantine entitlement
 * creation without hiding the payment.
 */
export function validateAnnualMembershipPaidSettlementBinding(session, request, snapshot) {
  const settlement = validateAnnualMembershipCheckoutSettlement(session, request, {
    allowForbiddenSubscriptionCollector: true,
  })
  if (!settlement.ok) return settlement

  const requestId = Number(request?.id)
  const accountId = Number(request?.family_billing_account_id)
  const payerMemberId = Number(request?.payer_member_id)
  const metadata = session?.metadata ?? {}
  const customerId = typeof session?.customer === 'string'
    ? session.customer
    : session?.customer?.id ?? null
  const paidMembers = (snapshot?.members ?? [])
    .filter((row) => Number(row.netCents) > 0)
    .map((row) => Number(row.memberId))
  const metadataMemberIds = String(metadata.memberIds ?? '')
    .split(',')
    .filter(Boolean)
    .map(Number)
  const expectedFeeId = Number(
    (snapshot?.members ?? []).find((row) => Number(row.netCents) > 0)?.feeId,
  )
  const problems = []

  if (!Number.isSafeInteger(requestId) || requestId <= 0) problems.push('checkout_request_missing')
  if (!Number.isSafeInteger(accountId) || accountId <= 0) problems.push('billing_account_missing')
  if (!Number.isSafeInteger(payerMemberId) || payerMemberId <= 0) problems.push('payer_missing')
  if (!session?.id) problems.push('checkout_session_missing')
  if (
    !request?.stripe_checkout_session_id
    || String(request.stripe_checkout_session_id) !== String(session?.id ?? '')
  ) problems.push('checkout_session_mismatch')
  if (metadata.checkoutType !== 'annual_membership') problems.push('checkout_type_mismatch')
  if (Number(metadata.annualMembershipCheckoutRequestId) !== requestId) {
    problems.push('checkout_request_mismatch')
  }
  if (Number(metadata.familyBillingAccountId) !== accountId) problems.push('billing_account_mismatch')
  if (Number(metadata.payerMemberId) !== payerMemberId) problems.push('payer_mismatch')
  if (String(metadata.pricingSnapshotHash ?? '') !== String(request?.pricing_snapshot_hash ?? '')) {
    problems.push('pricing_snapshot_mismatch')
  }
  if (Number(metadata.amountCents) !== Number(request?.expected_amount_cents)) {
    problems.push('metadata_amount_mismatch')
  }
  if (
    paidMembers.length === 0
    || metadataMemberIds.length !== paidMembers.length
    || metadataMemberIds.some((memberId, index) => memberId !== paidMembers[index])
    || Number(metadata.memberId) !== paidMembers[0]
  ) problems.push('member_snapshot_mismatch')
  if (!Number.isSafeInteger(expectedFeeId) || Number(metadata.feeId) !== expectedFeeId) {
    problems.push('fee_snapshot_mismatch')
  }
  if (!customerId) problems.push('stripe_customer_missing')

  return problems.length > 0
    ? { ok: false, reason: 'immutable_settlement_binding_mismatch', problems }
    : { ok: true, requestId, accountId, payerMemberId, customerId, paidMembers }
}

async function quarantinePaidAnnualMembershipCheckout(pool, {
  request,
  session,
  payment,
  reason,
}) {
  const normalizedReason = String(reason ?? 'current_authorization_changed_after_payment')
  const message = `[paid-checkout-refund-required] ${normalizedReason}`.slice(0, 500)
  return withBillingAccountCollectionLock(pool, request.family_billing_account_id, async (db) => {
    let transactionOpen = false
    try {
      await db.query('BEGIN')
      transactionOpen = true
      const quarantined = await db.query(
        `UPDATE annual_membership_checkout_request
            SET status = 'quarantined', error_message = $2, updated_at = now()
          WHERE id = $1
            AND status <> 'completed'
          RETURNING status, error_message`,
        [Number(request.id), message],
      ).then((result) => result.rows[0] ?? null)
      if (!quarantined) {
        await db.query('COMMIT')
        transactionOpen = false
        return { status: 'completed' }
      }

      const quarantine = await recordPaidCheckoutFulfillmentQuarantine(db, {
        checkoutKind: 'annual_membership',
        ownerId: Number(request.id),
        accountId: Number(request.family_billing_account_id),
        session,
        payment,
        reason: message,
      })
      await db.query('COMMIT')
      transactionOpen = false
      return { status: 'quarantined', payment: quarantine.payment }
    } catch (error) {
      if (transactionOpen) await db.query('ROLLBACK').catch(() => {})
      throw error
    }
  })
}

function annualCheckoutReplayResult(request) {
  const snapshot = parseAnnualCheckoutSnapshot(request)
  const memberIds = snapshot.members.map((row) => Number(row.memberId))
  if (request.status === 'completed' && Number(request.expected_amount_cents) === 0) {
    return {
      free: true,
      memberIds,
      renewsOn: toUtcDateString(membershipRenewsOnFromPurchase(request.created_at)),
      replayed: true,
    }
  }
  return null
}

function promotionLimitError(message) {
  const error = new Error(message)
  error.code = 'ANNUAL_MEMBERSHIP_PROMO_LIMIT_REACHED'
  error.status = 409
  error.statusCode = 409
  return error
}

async function assertPromoCapacityLocked(db, {
  requestId,
  ruleId,
  memberId,
  familyId,
  requireActive = true,
  promoCode = null,
}) {
  const rule = await db.query(
    `SELECT * FROM discount_rule WHERE id = $1 FOR UPDATE`,
    [ruleId],
  ).then((result) => result.rows[0] ?? null)
  if (!rule) throw promotionLimitError('This annual membership promo no longer exists.')
  const now = Date.now()
  if (requireActive && (
    rule.active === false ||
    (rule.starts_at && new Date(rule.starts_at).getTime() > now) ||
    (rule.ends_at && new Date(rule.ends_at).getTime() < now)
  )) throw promotionLimitError('This annual membership promo is outside its valid redemption window.')
  const configuredCode = String(rule.config?.code ?? rule.config?.promo_code ?? '').trim().toUpperCase()
  if (requireActive && promoCode && configuredCode !== String(promoCode).trim().toUpperCase()) {
    throw promotionLimitError('This annual membership promo changed while checkout was being prepared.')
  }

  const counts = await db.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE redemption.member_id = $2)::int AS member_total,
       COUNT(*) FILTER (WHERE redemption_member.family_id = $3)::int AS family_total
     FROM discount_redemption redemption
     LEFT JOIN member redemption_member ON redemption_member.id = redemption.member_id
     WHERE redemption.rule_id = $1`,
    [ruleId, memberId, familyId],
  ).then((result) => result.rows[0] ?? {})
  const reservations = await db.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE member_id = $2)::int AS member_total,
       COUNT(*) FILTER (WHERE family_id = $3)::int AS family_total
     FROM annual_membership_checkout_promo_reservation
     WHERE rule_id = $1
       AND NOT (
         checkout_request_id = $4
         AND member_id = $2
       )
       AND consumed_at IS NULL
       AND released_at IS NULL
       AND expires_at > now()`,
    [ruleId, memberId, familyId, requestId],
  ).then((result) => result.rows[0] ?? {})
  const total = Math.max(Number(rule.redeemed_count ?? 0), Number(counts.total ?? 0)) + Number(reservations.total ?? 0)
  if (rule.max_redemptions != null && total >= Number(rule.max_redemptions)) {
    throw promotionLimitError('This annual membership promo has reached its redemption limit.')
  }
  const config = rule.config && typeof rule.config === 'object' ? rule.config : {}
  const memberLimit = Number(config.max_redemptions_per_member)
  if (
    Number.isFinite(memberLimit) && memberLimit > 0 &&
    Number(counts.member_total ?? 0) + Number(reservations.member_total ?? 0) >= memberLimit
  ) throw promotionLimitError('This athlete has reached the annual membership promo limit.')
  const familyLimit = Number(config.max_redemptions_per_family)
  if (
    Number.isFinite(familyLimit) && familyLimit > 0 &&
    Number(counts.family_total ?? 0) + Number(reservations.family_total ?? 0) >= familyLimit
  ) throw promotionLimitError('This household has reached the annual membership promo limit.')
  return rule
}

async function reserveAnnualMembershipPromos(db, { request, snapshot, familyId }) {
  const promoRows = snapshot.members
    .filter((row) => row.promo?.ruleId && Number(row.discountCents) > 0)
    .sort((left, right) => Number(left.promo.ruleId) - Number(right.promo.ruleId))
  if (promoRows.length > 0) {
    const settings = await db.query(
      `SELECT max_discount_redemptions_total
         FROM discount_global_settings
        WHERE facility_id = (
          SELECT facility_id FROM discount_rule WHERE id = $1
        )
        FOR UPDATE`,
      [promoRows[0].promo.ruleId],
    ).then((result) => result.rows[0] ?? null)
    if (settings?.max_discount_redemptions_total != null) {
      const capacity = await db.query(
        `SELECT
           (SELECT COUNT(*) FROM discount_redemption WHERE kind = 'discount')::int
           +
           (SELECT COUNT(*)
              FROM annual_membership_checkout_promo_reservation
             WHERE checkout_request_id <> $1
               AND consumed_at IS NULL AND released_at IS NULL AND expires_at > now())::int
           AS used`,
        [request.id],
      ).then((result) => Number(result.rows[0]?.used ?? 0))
      if (capacity + promoRows.length > Number(settings.max_discount_redemptions_total)) {
        throw promotionLimitError('The facility promotional redemption limit has been reached.')
      }
    }
  }
  for (const row of promoRows) {
    await assertPromoCapacityLocked(db, {
      requestId: request.id,
      ruleId: Number(row.promo.ruleId),
      memberId: Number(row.memberId),
      familyId,
      promoCode: row.promo.code,
    })
    await db.query(
      `INSERT INTO annual_membership_checkout_promo_reservation (
         checkout_request_id, rule_id, member_id, family_id, amount_cents, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (checkout_request_id, member_id, rule_id) DO NOTHING`,
      [request.id, row.promo.ruleId, row.memberId, familyId, row.discountCents, request.expires_at],
    )
  }
}

/** Atomically consume one reserved promo and increment its cached counter once. */
async function recordMembershipPromoRedemption(db, {
  requestId,
  ruleId,
  memberId,
  familyId,
  discountCents,
}) {
  const reservation = await db.query(
    `SELECT *
       FROM annual_membership_checkout_promo_reservation
      WHERE checkout_request_id = $1 AND member_id = $2 AND rule_id = $3
      FOR UPDATE`,
    [requestId, memberId, ruleId],
  ).then((result) => result.rows[0] ?? null)
  if (!reservation || Number(reservation.amount_cents) !== Number(discountCents) || reservation.released_at) {
    throw promotionLimitError('Annual membership promo reservation is missing or no longer valid.')
  }
  const existing = await db.query(
    `SELECT id FROM discount_redemption
      WHERE annual_membership_checkout_request_id = $1
        AND member_id = $2 AND rule_id = $3
      LIMIT 1`,
    [requestId, memberId, ruleId],
  ).then((result) => result.rows[0] ?? null)
  if (existing) return existing
  await assertPromoCapacityLocked(db, {
    requestId,
    ruleId,
    memberId,
    familyId,
    requireActive: false,
  })
  const result = await db.query(
    `WITH inserted AS (
       INSERT INTO discount_redemption (
         rule_id, member_id, signup_id, program_id, form_id, kind, units,
         amount_cents, annual_membership_checkout_request_id
       ) VALUES ($1, $2, NULL, NULL, NULL, 'discount', 0, $3, $4)
       ON CONFLICT (annual_membership_checkout_request_id, member_id, rule_id)
         WHERE annual_membership_checkout_request_id IS NOT NULL
       DO NOTHING
       RETURNING id, rule_id
     ), bumped AS (
       UPDATE discount_rule rule
          SET redeemed_count = rule.redeemed_count + 1, updated_at = now()
         FROM inserted
        WHERE rule.id = inserted.rule_id
       RETURNING inserted.id
     )
     UPDATE annual_membership_checkout_promo_reservation reservation
        SET consumed_at = now()
       FROM bumped
      WHERE reservation.checkout_request_id = $4
        AND reservation.member_id = $2
        AND reservation.rule_id = $1
      RETURNING bumped.id`,
    [ruleId, memberId, discountCents, requestId],
  )
  if (!result.rows[0]) throw promotionLimitError('Annual membership promo could not be recorded atomically.')
  return result.rows[0]
}

/** Normalize promoCodesByMemberId from request body into Map<number, string>. */
function normalizePromoCodesByMemberId(promoCodesByMemberId, fallbackPromoCode = null) {
  const map = new Map()
  if (promoCodesByMemberId && typeof promoCodesByMemberId === 'object' && !Array.isArray(promoCodesByMemberId)) {
    for (const [key, value] of Object.entries(promoCodesByMemberId)) {
      const memberId = Number(key)
      const code = typeof value === 'string' ? value.trim() : ''
      if (Number.isFinite(memberId) && memberId > 0 && code) map.set(memberId, code)
    }
  }
  return { map, fallbackPromoCode: typeof fallbackPromoCode === 'string' && fallbackPromoCode.trim() ? fallbackPromoCode.trim() : null }
}

/**
 * Resolve per-athlete membership pricing (promos applied). Throws on invalid promo.
 * @returns {Promise<{
 *   fee: object,
 *   pricedMembers: Array<{
 *     member: object,
 *     memberId: number,
 *     promo: { rule: object, code: string, discountCents: number }|null,
 *     discountCents: number,
 *     netCents: number,
 *     grossCents: number,
 *   }>,
 * }>}
 */
export async function priceAnnualMembershipSelections(
  pool,
  {
    account,
    athleteMemberId,
    memberIds,
    payerMemberId,
    promoCode = null,
    promoCodesByMemberId = null,
  },
) {
  const accountContext = requireActiveAnnualMembershipAccount(account, payerMemberId)
  const requestedIds = parseMemberIds({ athleteMemberId, memberIds })
  if (requestedIds.length === 0) {
    const err = new Error('Select at least one athlete for membership.')
    err.status = 400
    throw err
  }
  await requireActiveAnnualMembershipPayer(pool, accountContext)

  const eligibleMembers = []
  for (const memberId of requestedIds) {
    const access = await ensureAnnualMembershipFamilyMemberAccess(pool, {
      familyId: accountContext.familyId,
      memberId,
      facilityId: accountContext.facilityId,
    })
    if (!access.ok) {
      const err = new Error(access.message)
      err.status = access.status
      throw err
    }
    if (await memberHasActiveAnnualMembership(pool, memberId)) continue
    eligibleMembers.push(access.member)
  }

  if (eligibleMembers.length === 0) {
    const err = new Error('All selected athletes already have an active annual membership.')
    err.status = 409
    throw err
  }

  const fee = await loadAnnualMembershipFee(pool, accountContext.facilityId)
  if (!fee) {
    const err = new Error('Annual membership is not available right now.')
    err.status = 404
    throw err
  }

  const { map: perMemberCodes, fallbackPromoCode } = normalizePromoCodesByMemberId(
    promoCodesByMemberId,
    promoCode,
  )
  const { resolveMembershipFeePromo, membershipPromoDiscountCents } = await import(
    '../scheduling/discountEngine.js'
  )
  const pricedMembers = []
  for (const member of eligibleMembers) {
    const memberId = Number(member.id)
    const code = perMemberCodes.get(memberId) || fallbackPromoCode || null
    let promo = null
    if (code) {
      const resolved = await resolveMembershipFeePromo(pool, {
        facilityId: accountContext.facilityId,
        promoCodes: [code],
        memberId,
        familyId: accountContext.familyId,
      })
      if (!resolved) {
        const err = new Error(
          `Promo code "${code}" is not valid for annual membership` +
            (eligibleMembers.length > 1
              ? ` (${[member.first_name, member.last_name].filter(Boolean).join(' ') || 'athlete'}).`
              : '.'),
        )
        err.status = 400
        err.memberId = memberId
        err.promoCode = code
        throw err
      }
      const discountCents = membershipPromoDiscountCents(resolved.rule, fee.amountCents)
      promo = {
        rule: resolved.rule,
        code: resolved.code,
        discountCents,
      }
    }
    const discountCents = promo?.discountCents ?? 0
    const grossCents = fee.amountCents
    const netCents = Math.max(0, grossCents - discountCents)
    pricedMembers.push({
      member,
      memberId,
      promo,
      discountCents,
      netCents,
      grossCents,
    })
  }

  return { fee, pricedMembers }
}

/**
 * Soft preview of membership checkout totals with per-child promo codes.
 * Invalid codes are reported per athlete instead of failing the whole preview.
 */
export async function previewAnnualMembershipCheckout(
  pool,
  {
    account,
    athleteMemberId,
    memberIds,
    payerMemberId,
    promoCode = null,
    promoCodesByMemberId = null,
  },
) {
  const accountContext = requireActiveAnnualMembershipAccount(account, payerMemberId)
  const requestedIds = parseMemberIds({ athleteMemberId, memberIds })
  if (requestedIds.length === 0) {
    return {
      feeAmountCents: 0,
      athletes: [],
      totalGrossCents: 0,
      totalDiscountCents: 0,
      totalNetCents: 0,
      allWaived: false,
    }
  }
  await requireActiveAnnualMembershipPayer(pool, accountContext)

  const fee = await loadAnnualMembershipFee(pool, accountContext.facilityId)
  if (!fee) {
    const err = new Error('Annual membership is not available right now.')
    err.status = 404
    throw err
  }

  const { map: perMemberCodes, fallbackPromoCode } = normalizePromoCodesByMemberId(
    promoCodesByMemberId,
    promoCode,
  )
  const { resolveMembershipFeePromo, membershipPromoDiscountCents } = await import(
    '../scheduling/discountEngine.js'
  )
  const athletes = []
  for (const memberId of requestedIds) {
    const access = await ensureAnnualMembershipFamilyMemberAccess(pool, {
      familyId: accountContext.familyId,
      memberId,
      facilityId: accountContext.facilityId,
    })
    if (!access.ok) {
      athletes.push({
        memberId,
        name: '',
        active: false,
        available: false,
        grossCents: fee.amountCents,
        discountCents: 0,
        netCents: fee.amountCents,
        promoCode: null,
        promoValid: false,
        promoError: access.message,
        waived: false,
      })
      continue
    }
    const name = [access.member.first_name, access.member.last_name].filter(Boolean).join(' ').trim()
    const active = await memberHasActiveAnnualMembership(pool, memberId)
    if (active) {
      athletes.push({
        memberId,
        name,
        active: true,
        available: true,
        grossCents: 0,
        discountCents: 0,
        netCents: 0,
        promoCode: null,
        promoValid: true,
        promoError: null,
        waived: false,
      })
      continue
    }

    const code = perMemberCodes.get(memberId) || fallbackPromoCode || null
    let discountCents = 0
    let promoValid = true
    let promoError = null
    if (code) {
      const resolved = await resolveMembershipFeePromo(pool, {
        facilityId: accountContext.facilityId,
        promoCodes: [code],
        memberId,
        familyId: accountContext.familyId,
      })
      if (!resolved) {
        promoValid = false
        promoError = `Promo code "${code}" is not valid for annual membership.`
      } else {
        discountCents = membershipPromoDiscountCents(resolved.rule, fee.amountCents)
      }
    }
    const grossCents = fee.amountCents
    const netCents = promoValid ? Math.max(0, grossCents - discountCents) : grossCents
    athletes.push({
      memberId,
      name,
      active: false,
      available: true,
      grossCents,
      discountCents: promoValid ? discountCents : 0,
      netCents,
      promoCode: code,
      promoValid,
      promoError,
      waived: promoValid && discountCents > 0 && netCents === 0,
    })
  }

  const billable = athletes.filter((a) => !a.active && a.available)
  const totalGrossCents = billable.reduce((sum, a) => sum + a.grossCents, 0)
  const totalDiscountCents = billable.reduce((sum, a) => sum + a.discountCents, 0)
  const totalNetCents = billable.reduce((sum, a) => sum + a.netCents, 0)

  return {
    feeAmountCents: fee.amountCents,
    athletes,
    totalGrossCents,
    totalDiscountCents,
    totalNetCents,
    allWaived: billable.length > 0 && billable.every((a) => a.waived),
  }
}

async function loadAnnualCheckoutRequest(pool, accountId, requestKey) {
  return pool.query(
    `SELECT *
       FROM annual_membership_checkout_request
      WHERE family_billing_account_id = $1 AND request_key = $2
      LIMIT 1`,
    [accountId, requestKey],
  ).then((result) => result.rows[0] ?? null)
}

function assertAnnualRequestBinding(request, { requestFingerprint, payerMemberId }) {
  if (
    String(request?.request_fingerprint ?? '') !== requestFingerprint ||
    Number(request?.payer_member_id) !== Number(payerMemberId)
  ) throw checkoutIdempotencyConflict()
  parseAnnualCheckoutSnapshot(request)
}

export async function createAnnualRequestAndActivateWaived(pool, {
  account,
  payerMemberId,
  requestKey,
  requestFingerprint,
  snapshot,
}) {
  const snapshotHash = checkoutFingerprint(snapshot)
  return withBillingAccountCollectionLock(pool, account.id, async (db) => {
    let transactionOpen = false
    try {
      await db.query('BEGIN')
      transactionOpen = true
      let request = await db.query(
        `SELECT *
           FROM annual_membership_checkout_request
          WHERE family_billing_account_id = $1 AND request_key = $2
          FOR UPDATE`,
        [account.id, requestKey],
      ).then((result) => result.rows[0] ?? null)
      if (request) {
        assertAnnualRequestBinding(request, { requestFingerprint, payerMemberId })
        await db.query('COMMIT')
        transactionOpen = false
        return request
      }

      const activePurchaseCheckout = await findActivePurchaseCheckoutOwner(db, account.id)
      if (activePurchaseCheckout) {
        throw checkoutIdempotencyConflict(
          'This household already has a payable enrollment or annual-membership Checkout. Resume or reconcile it before opening another purchase Checkout.',
        )
      }
      const completedCheckoutGap = await findCompletedPaidCheckoutFulfillmentGap(db, account.id)
      if (completedCheckoutGap) {
        throw checkoutIdempotencyConflict(
          'This household has a completed paid Checkout without exact local fulfillment. Reconcile it before opening another purchase Checkout.',
        )
      }
      for (const member of snapshot.members) {
        const activeMembership = await loadActiveAnnualMembership(db, Number(member.memberId), {
          strict: true,
        })
        if (activeMembership) {
          throw checkoutIdempotencyConflict(
            'One of these athletes already has an active annual membership. Refresh before starting another checkout.',
          )
        }
      }
      const overlappingRequest = await db.query(
        `SELECT request.id
           FROM annual_membership_checkout_request request
          WHERE request.family_billing_account_id = $1
            AND request.request_key <> $2
            AND request.status IN ('pending', 'fulfilling')
            AND EXISTS (
              SELECT 1
                FROM jsonb_array_elements(request.pricing_snapshot->'members') member_price
               WHERE (member_price->>'memberId')::bigint = ANY($3::bigint[])
            )
          LIMIT 1
          FOR UPDATE`,
        [account.id, requestKey, snapshot.members.map((row) => row.memberId)],
      ).then((result) => result.rows[0] ?? null)
      if (overlappingRequest) {
        throw checkoutIdempotencyConflict(
          'An annual membership checkout is already open for one of these athletes. Resume that checkout or wait for it to expire.',
        )
      }
      request = await db.query(
        `INSERT INTO annual_membership_checkout_request (
           family_billing_account_id, payer_member_id, request_key, request_fingerprint,
           pricing_snapshot, pricing_snapshot_hash, currency, expected_amount_cents
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
         ON CONFLICT (family_billing_account_id, request_key) DO NOTHING
         RETURNING *`,
        [
          account.id,
          payerMemberId,
          requestKey,
          requestFingerprint,
          JSON.stringify(snapshot),
          snapshotHash,
          snapshot.currency,
          snapshot.expectedAmountCents,
        ],
      ).then((result) => result.rows[0] ?? null)
      const inserted = Boolean(request)
      if (!request) {
        request = await db.query(
          `SELECT *
             FROM annual_membership_checkout_request
            WHERE family_billing_account_id = $1 AND request_key = $2
            FOR UPDATE`,
          [account.id, requestKey],
        ).then((result) => result.rows[0] ?? null)
      }
      if (!request) throw checkoutIdempotencyConflict('Annual membership checkout request could not be created.')
      assertAnnualRequestBinding(request, { requestFingerprint, payerMemberId })
      if (!inserted) {
        await db.query('COMMIT')
        transactionOpen = false
        return request
      }

      await reserveAnnualMembershipPromos(db, {
        request,
        snapshot,
        familyId: Number(account.family_id),
      })
      const purchasedAt = new Date(request.created_at)
      const renewsOn = toUtcDateString(membershipRenewsOnFromPurchase(purchasedAt))
      for (const row of snapshot.members.filter((member) => member.netCents === 0)) {
        const charge = await persistAnnualMembershipLedger(db, {
          accountId: account.id,
          memberId: row.memberId,
          fee: {
            id: row.feeId,
            name: row.feeName,
            triggerType: row.triggerType,
            applyBasis: row.applyBasis,
            amountCents: row.grossCents,
          },
          checkoutSessionId: null,
          checkoutRequestId: request.id,
          purchasedAt,
          grossCents: row.grossCents,
          discountCents: row.discountCents,
          promoCode: row.promo?.code ?? null,
        })
        if (row.promo?.ruleId && row.discountCents > 0) {
          await recordMembershipPromoRedemption(db, {
            requestId: request.id,
            ruleId: row.promo.ruleId,
            memberId: row.memberId,
            familyId: Number(account.family_id),
            discountCents: row.discountCents,
          })
        }
        await db.query(
          `INSERT INTO additional_fee_redemption (
             fee_id, member_id, signup_id, period_key, amount_cents,
             billing_charge_id, satisfied_at, created_at
           ) VALUES ($1, $2, NULL, $3, 0, $4, $5, $5)
           ON CONFLICT (fee_id, member_id, period_key) DO UPDATE
           SET billing_charge_id = COALESCE(additional_fee_redemption.billing_charge_id, EXCLUDED.billing_charge_id),
               satisfied_at = COALESCE(additional_fee_redemption.satisfied_at, EXCLUDED.satisfied_at)
           WHERE additional_fee_redemption.billing_charge_id IS NULL
              OR additional_fee_redemption.billing_charge_id = EXCLUDED.billing_charge_id`,
          [row.feeId, row.memberId, renewsOn, charge.id, purchasedAt],
        )
        await createEnrollmentAnnualMembershipSubscriptions(db, null, {
          preview: {
            additionalFees: {
              items: [{
                feeId: row.feeId,
                name: row.feeName,
                amountCents: row.grossCents,
                grossAmountCents: row.grossCents,
                triggerType: row.triggerType,
                applyBasis: row.applyBasis,
              }],
            },
          },
          stripeSession: null,
          familyBillingAccountId: account.id,
          memberId: row.memberId,
          purchasedAt,
        })
      }
      if (snapshot.expectedAmountCents === 0) {
        request = await db.query(
          `UPDATE annual_membership_checkout_request
              SET status = 'completed', completed_at = now(), updated_at = now()
            WHERE id = $1
            RETURNING *`,
          [request.id],
        ).then((result) => result.rows[0] ?? request)
      }
      await db.query('COMMIT')
      transactionOpen = false
      return request
    } catch (error) {
      if (transactionOpen) await db.query('ROLLBACK').catch(() => {})
      throw error
    }
  })
}

export async function persistAnnualMembershipCheckoutSessionState(pool, {
  request,
  session,
  requestFingerprint,
  payerMemberId,
  expectedCustomerId,
}) {
  const accountId = Number(request?.family_billing_account_id)
  const requestId = Number(request?.id)
  const sessionExpiresAt = Number(session?.expires_at)
  if (
    !Number.isSafeInteger(accountId) || accountId <= 0
    || !Number.isSafeInteger(requestId) || requestId <= 0
    || !Number.isSafeInteger(sessionExpiresAt) || sessionExpiresAt <= 0
  ) {
    throw checkoutIdempotencyConflict(
      'Stripe did not return an exact annual-membership Checkout expiration. The pending request remains reserved for reconciliation.',
    )
  }
  if (session?.status === 'open' && !session?.url) {
    throw checkoutIdempotencyConflict(
      'Stripe did not return a payable annual-membership Checkout URL. The pending request remains reserved for reconciliation.',
    )
  }

  return withBillingAccountCollectionLock(pool, accountId, async (db) => {
    let transactionOpen = false
    try {
      await db.query('BEGIN')
      transactionOpen = true
      const locked = await db.query(
        `SELECT request.*, account.stripe_customer_id, account.is_active,
                (
                  SELECT COUNT(*)::integer
                    FROM family_billing_account customer_owner
                   WHERE customer_owner.stripe_customer_id = account.stripe_customer_id
                ) AS stripe_customer_owner_count
           FROM annual_membership_checkout_request request
           JOIN family_billing_account account
             ON account.id = request.family_billing_account_id
          WHERE request.id = $1
            AND request.request_fingerprint = $2
          LIMIT 1
          FOR UPDATE OF request, account`,
        [requestId, requestFingerprint],
      ).then((result) => result.rows[0] ?? null)
      if (!locked) {
        throw checkoutIdempotencyConflict('Annual membership checkout reservation changed during creation.')
      }
      if (
        expectedCustomerId !== undefined
        && (
          locked.is_active !== true
          || String(locked.stripe_customer_id ?? '') !== String(expectedCustomerId)
          || Number(locked.stripe_customer_owner_count) !== 1
        )
      ) {
        throw checkoutIdempotencyConflict(
          'The annual-membership payer or canonical Stripe customer changed before Checkout binding.',
        )
      }
      assertAnnualRequestBinding(locked, { requestFingerprint, payerMemberId })
      const lockedSnapshot = parseAnnualCheckoutSnapshot(locked)
      assertAnnualMembershipCheckoutSessionBinding(session, locked, lockedSnapshot, {
        ...(expectedCustomerId !== undefined ? { expectedCustomerId } : {}),
      })
      const linked = await db.query(
        `UPDATE annual_membership_checkout_request
            SET stripe_checkout_session_id = $2,
                stripe_checkout_session_url = CASE WHEN $6 = 'open' THEN $3 ELSE NULL END,
                expires_at = to_timestamp($5::double precision),
                status = CASE
                  WHEN $6 = 'expired' THEN 'expired'
                  WHEN $6 = 'open' AND status = 'expired' THEN 'pending'
                  ELSE status
                END,
                error_message = CASE
                  WHEN $6 = 'expired' THEN 'Stripe Checkout Session expired.'
                  WHEN $6 = 'open' AND status IN ('pending', 'fulfilling', 'expired') THEN NULL
                  ELSE error_message
                END,
                updated_at = now()
          WHERE id = $1
            AND request_fingerprint = $4
            AND (stripe_checkout_session_id IS NULL OR stripe_checkout_session_id = $2)
            AND status IN ('pending', 'fulfilling', 'failed', 'expired')
          RETURNING *`,
        [
          requestId,
          String(session.id),
          session.url ?? null,
          requestFingerprint,
          sessionExpiresAt,
          String(session.status),
        ],
      ).then((result) => result.rows[0] ?? null)
      if (!linked) {
        throw checkoutIdempotencyConflict('Annual membership checkout session binding changed during creation.')
      }
      await db.query(
        `UPDATE annual_membership_checkout_promo_reservation
            SET expires_at = to_timestamp($2::double precision)
          WHERE checkout_request_id = $1
            AND consumed_at IS NULL
            AND released_at IS NULL`,
        [requestId, sessionExpiresAt],
      )
      await db.query('COMMIT')
      transactionOpen = false
      return linked
    } catch (error) {
      if (transactionOpen) await db.query('ROLLBACK').catch(() => {})
      throw error
    }
  })
}

/**
 * Create Stripe Checkout for annual membership only (no class enrollment).
 * Accepts a single athleteMemberId or memberIds[] — one Checkout, one line item per athlete.
 * Optional promoCode (legacy, applies to every athlete) or promoCodesByMemberId
 * (per-child codes). When every selected athlete is 100% waived, memberships activate
 * immediately with `{ free: true, memberIds }`. Mixed carts activate waived athletes
 * immediately and open Stripe Checkout for the rest.
 */
export async function createAnnualMembershipCheckoutSession(
  pool,
  {
    account,
    athleteMemberId,
    memberIds,
    payerMemberId,
    promoCode = null,
    promoCodesByMemberId = null,
    successUrl,
    cancelUrl,
    idempotencyKey,
  },
) {
  // Reject stale/deactivated accounts before schema or Stripe operations.
  requireActiveAnnualMembershipAccount(account, payerMemberId)
  if (!stripeEnabled()) return null
  await ensureStripeBillingSchema(pool)
  await ensureStripeCatalogSchema(pool)
  const resolvedSuccessUrl = successUrl || `${publicAppUrl()}/?billing=membership-paid&session_id={CHECKOUT_SESSION_ID}`
  const resolvedCancelUrl = cancelUrl || `${publicAppUrl()}/?billing=membership-cancelled`
  const requestKey = normalizeCheckoutRequestKey(
    idempotencyKey,
    'member-annual-membership-checkout',
  )
  const requestFingerprint = annualCheckoutIntentFingerprint({
    accountId: account.id,
    payerMemberId,
    athleteMemberId,
    memberIds,
    promoCode,
    promoCodesByMemberId,
    successUrl: resolvedSuccessUrl,
    cancelUrl: resolvedCancelUrl,
  })
  let request = await loadAnnualCheckoutRequest(pool, account.id, requestKey)
  if (request) {
    assertAnnualRequestBinding(request, { requestFingerprint, payerMemberId })
    const completed = !request.stripe_checkout_session_id
      ? annualCheckoutReplayResult(request)
      : null
    if (completed) return completed
    if (
      !request.stripe_checkout_session_id
      && ['failed', 'expired', 'quarantined'].includes(String(request.status))
    ) {
      throw checkoutIdempotencyConflict(
        'This annual membership checkout can no longer be resumed. Start it again with a new Idempotency-Key.',
      )
    }
  } else {
    const { fee, pricedMembers } = await priceAnnualMembershipSelections(pool, {
      account,
      athleteMemberId,
      memberIds,
      payerMemberId,
      promoCode,
      promoCodesByMemberId,
    })
    const snapshot = annualCheckoutSnapshot(fee, pricedMembers)
    request = await createAnnualRequestAndActivateWaived(pool, {
      account,
      payerMemberId,
      requestKey,
      requestFingerprint,
      snapshot,
    })
    const completed = annualCheckoutReplayResult(request)
    if (completed) return completed
  }

  const stripe = await getStripeClient()
  if (!stripe) return null

  if (request.stripe_checkout_session_id) {
    const replay = await stripe.checkout.sessions.retrieve(request.stripe_checkout_session_id)
    if (replay?.status === 'complete' && replay?.payment_status === 'paid') {
      const commitResult = await commitAnnualMembershipCheckout(pool, {
        stripeSession: replay,
        accountId: Number(account.id),
      })
      const terminalStatus = String(commitResult?.status ?? '')
      if (!['completed', 'already_active', 'quarantined'].includes(terminalStatus)) {
        throw checkoutIdempotencyConflict(
          `The paid annual membership Checkout could not be finalized (${terminalStatus || 'unknown'}). Do not start another payment; contact support.`,
        )
      }
      return {
        ...commitResult,
        skipCheckout: true,
        alreadyCompleted: ['completed', 'already_active'].includes(terminalStatus),
        requiresReview: terminalStatus === 'quarantined',
        replayed: true,
      }
    }
    if (checkoutSessionHasForbiddenSubscriptionCollector(replay)) {
      await rejectForbiddenSubscriptionCheckoutCompletion(pool, {
        session: replay,
        checkoutKind: 'annual_membership',
        accountId: account.id,
      })
    }
    const storedSnapshot = parseAnnualCheckoutSnapshot(request)
    if (replay?.status === 'expired' && replay?.payment_status !== 'paid') {
      request = await persistAnnualMembershipCheckoutSessionState(pool, {
        request,
        session: replay,
        requestFingerprint,
        payerMemberId,
      })
      throw checkoutIdempotencyConflict(
        'This annual membership Checkout expired. Start it again with a new Idempotency-Key.',
      )
    }
    const completed = annualCheckoutReplayResult(request)
    if (completed) return completed
    if (request.status === 'completed') {
      throw checkoutIdempotencyConflict(
        'The completed annual-membership request does not match a completed Stripe Checkout. Reconcile it before starting another payment.',
      )
    }
    if (replay?.status !== 'open' || !replay?.url) {
      throw checkoutIdempotencyConflict(
        'This annual membership Checkout is no longer payable. Do not start another payment until its status is reconciled.',
      )
    }
    const currentAccount = await loadActiveAnnualMembershipAccount(pool, account.id)
    const accountContext = requireActiveAnnualMembershipAccount(currentAccount, payerMemberId)
    await requireActiveAnnualMembershipPayer(pool, accountContext)
    for (const member of storedSnapshot.members) {
      const access = await ensureAnnualMembershipFamilyMemberAccess(pool, {
        familyId: accountContext.familyId,
        memberId: Number(member.memberId),
        facilityId: accountContext.facilityId,
      })
      if (!access.ok) {
        throw annualMembershipAccountError(access.message, access.status)
      }
    }
    const customerId = await ensureStripeCustomer(pool, stripe, currentAccount)
    request = await persistAnnualMembershipCheckoutSessionState(pool, {
      request,
      session: replay,
      requestFingerprint,
      payerMemberId,
      expectedCustomerId: customerId,
    })
    if (['failed', 'expired', 'quarantined'].includes(String(request.status))) {
      throw checkoutIdempotencyConflict(
        'This annual membership checkout can no longer be resumed. Start it again with a new Idempotency-Key.',
      )
    }
    return {
      url: replay.url,
      checkoutSessionId: replay.id,
      replayed: true,
    }
  }

  const storedSnapshot = parseAnnualCheckoutSnapshot(request)
  const paidMembers = storedSnapshot.members.filter((row) => row.netCents > 0)
  if (paidMembers.length === 0) {
    throw checkoutIdempotencyConflict('Annual membership checkout has no payable members but is not complete.')
  }

  const customerId = await ensureStripeCustomer(pool, stripe, account)
  const missingSnapshotNames = paidMembers
    .filter((row) => !String(row.memberName ?? '').trim())
    .map((row) => Number(row.memberId))
  const memberNames = missingSnapshotNames.length > 0
    ? await pool.query(
      `SELECT id, first_name, last_name FROM member WHERE id = ANY($1::bigint[])`,
      [missingSnapshotNames],
    ).then((result) => new Map(result.rows.map((row) => [Number(row.id), row])))
    : new Map()
  const lineItems = paidMembers.map((row) => {
    const member = memberNames.get(Number(row.memberId)) ?? {}
    const athleteName = String(row.memberName ?? '').trim()
      || [member.first_name, member.last_name].filter(Boolean).join(' ').trim()
      || `Athlete #${Number(row.memberId)}`
    const promoSuffix = row.promo ? ` (promo ${String(row.promo.code).toUpperCase()})` : ''
    const productName = `${row.feeName || ANNUAL_MEMBERSHIP_PROGRAM_NAME}${
      athleteName ? ` · ${athleteName}` : ''
    }${promoSuffix}`.slice(0, 200)

    return {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: row.netCents,
        product_data: {
          name: productName,
          description: 'Valid for 1 year from purchase. Renews annually.',
        },
      },
    }
  })

  const paidIds = paidMembers.map((row) => Number(row.memberId))

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: lineItems,
    success_url: resolvedSuccessUrl,
    cancel_url: resolvedCancelUrl,
    payment_intent_data: { setup_future_usage: 'off_session' },
    metadata: {
      checkoutType: 'annual_membership',
      familyBillingAccountId: String(account.id),
      memberId: String(paidIds[0]),
      memberIds: paidIds.join(','),
      payerMemberId: String(payerMemberId),
      feeId: String(paidMembers[0].feeId),
      amountCents: String(request.expected_amount_cents),
      feeName: String(paidMembers[0].feeName || ANNUAL_MEMBERSHIP_PROGRAM_NAME).slice(0, 100),
      annualMembershipCheckoutRequestId: String(request.id),
      pricingSnapshotHash: String(request.pricing_snapshot_hash),
    },
  }, {
    idempotencyKey: stripeCheckoutIdempotencyKey(
      'member-annual-membership-checkout',
      account.id,
      requestKey,
    ),
  })
  request = await persistAnnualMembershipCheckoutSessionState(pool, {
    request,
    session,
    requestFingerprint,
    payerMemberId,
    expectedCustomerId: customerId,
  })

  if (session.status === 'complete' && session.payment_status === 'paid') {
    const commitResult = await commitAnnualMembershipCheckout(pool, {
      stripeSession: session,
      accountId: Number(account.id),
    })
    const terminalStatus = String(commitResult?.status ?? '')
    if (!['completed', 'already_active', 'quarantined'].includes(terminalStatus)) {
      throw checkoutIdempotencyConflict(
        `The paid annual membership Checkout could not be finalized (${terminalStatus || 'unknown'}). Do not start another payment; contact support.`,
      )
    }
    return {
      ...commitResult,
      skipCheckout: true,
      alreadyCompleted: ['completed', 'already_active'].includes(terminalStatus),
      requiresReview: terminalStatus === 'quarantined',
      replayed: true,
    }
  }
  if (session.status === 'expired') {
    throw checkoutIdempotencyConflict(
      'This annual membership Checkout expired. Start it again with a new Idempotency-Key.',
    )
  }
  if (session.status !== 'open') {
    throw checkoutIdempotencyConflict(
      'This annual membership Checkout is no longer payable. Do not start another payment until it is reconciled.',
    )
  }
  return { url: session.url, checkoutSessionId: session.id }
}

async function persistAnnualMembershipLedger(pool, {
  accountId,
  memberId,
  fee,
  checkoutSessionId,
  checkoutRequestId = null,
  purchasedAt,
  grossCents = null,
  discountCents = 0,
  promoCode = null,
}) {
  await ensureBillingChargeSchema(pool)
  const renewsOnKey =
    toUtcDateString(membershipRenewsOnFromPurchase(purchasedAt)) || toUtcDateString(purchasedAt)
  const sourceId = `${fee.id}:${memberId}:${renewsOnKey}`
  const gross = Math.max(0, Math.round(Number(grossCents ?? fee.amountCents) || 0))
  const discount = Math.max(0, Math.round(Number(discountCents) || 0))
  const net = Math.max(0, gross - discount)

  const inserted = await pool.query(
    `
      INSERT INTO billing_charge
        (family_billing_account_id, member_id, source_type, source_id, description,
         amount_cents, gross_amount_cents, discount_amount_cents,
         charge_type, billing_interval, stripe_checkout_session_id, collection_status,
         metadata, created_at)
      VALUES ($1, $2, 'additional_fee', $3, $4, $5, $6, $7, 'one_time', 'one_time', $8,
        $9, jsonb_strip_nulls(jsonb_build_object(
          'discountCode', NULLIF($10, ''),
          'annualMembershipCheckoutRequestId', $11::bigint,
          'grossAmountCents', $6::int,
          'discountAmountCents', $7::int,
          'netAmountCents', $5::int
        )), $12)
      ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
      DO UPDATE SET stripe_checkout_session_id = COALESCE(
        billing_charge.stripe_checkout_session_id,
        EXCLUDED.stripe_checkout_session_id
      )
      WHERE billing_charge.stripe_checkout_session_id IS NULL
         OR billing_charge.stripe_checkout_session_id = EXCLUDED.stripe_checkout_session_id
      RETURNING *
    `,
    [
      accountId,
      memberId,
      sourceId,
      fee.name || ANNUAL_MEMBERSHIP_PROGRAM_NAME,
      net,
      gross,
      discount,
      checkoutSessionId,
      net === 0 ? 'paid' : 'unpaid',
      promoCode,
      checkoutRequestId,
      purchasedAt,
    ],
  )
  const charge = inserted.rows[0] ?? await pool.query(
    `SELECT * FROM billing_charge WHERE source_type = 'additional_fee' AND source_id = $1 LIMIT 1`,
    [sourceId],
  ).then((result) => result.rows[0] ?? null)
  if (
    !charge ||
    Number(charge.family_billing_account_id) !== Number(accountId) ||
    Number(charge.member_id) !== Number(memberId) ||
    Number(charge.amount_cents) !== net ||
    Number(charge.gross_amount_cents ?? gross) !== gross ||
    Number(charge.discount_amount_cents ?? 0) !== discount
    || String(charge.stripe_checkout_session_id ?? '') !== String(checkoutSessionId ?? '')
    || Number(charge.metadata?.annualMembershipCheckoutRequestId)
      !== Number(checkoutRequestId)
  ) {
    throw checkoutIdempotencyConflict('Existing annual membership charge conflicts with the checkout price snapshot.')
  }

  // Membership activation is derived from payment applications below. This
  // charge intentionally does not create an entitlement by itself.
  return charge
}

async function settleCompletedAnnualMembershipCheckout(pool, {
  request,
  snapshot,
  session,
  payment,
  purchasedAt,
}) {
  const accountId = Number(request.family_billing_account_id)
  const requestId = Number(request.id)
  return withBillingAccountCollectionLock(pool, accountId, async (db) => {
    let transactionOpen = false
    try {
      await db.query('BEGIN')
      transactionOpen = true
      for (const row of snapshot.members.filter((member) => Number(member.netCents) > 0)) {
        await persistAnnualMembershipLedger(db, {
          accountId,
          memberId: row.memberId,
          fee: {
            id: row.feeId,
            name: row.feeName,
            triggerType: row.triggerType,
            applyBasis: row.applyBasis,
            amountCents: row.grossCents,
          },
          checkoutSessionId: session.id,
          checkoutRequestId: requestId,
          purchasedAt,
          grossCents: row.grossCents,
          discountCents: row.discountCents,
          promoCode: row.promo?.code ?? null,
        })
      }
      const settled = await applyAndSettlePaidCheckoutFulfillment(db, {
        session,
        accountId,
        payment,
        targetAmountCents: Number(session.amount_total),
        applicationNamespace: `annual-checkout:${requestId}`,
        allocationReason: 'annual_membership_checkout_exact',
        manageTransaction: false,
      })
      await db.query('COMMIT')
      transactionOpen = false
      await allocateHouseholdPaymentsLocked(db, {
        accountId,
        actorType: 'stripe',
        idempotencyNamespace: `annual-checkout-remainder:${requestId}`,
      })
      return settled
    } catch (error) {
      if (transactionOpen) await db.query('ROLLBACK').catch(() => {})
      throw error
    }
  })
}

/**
 * Finalize standalone annual membership after Stripe Checkout payment.
 * The durable request snapshot, not mutable fee configuration or Stripe
 * metadata price fragments, is authoritative for every per-athlete charge.
 */
export async function commitAnnualMembershipCheckout(pool, { stripeSession, accountId }) {
  const session =
    typeof stripeSession === 'string'
      ? await (await getStripeClient()).checkout.sessions.retrieve(stripeSession)
      : stripeSession
  if (!session?.id) return { status: 'none' }
  if (session.metadata?.checkoutType !== 'annual_membership') return { status: 'none' }

  if (session?.payment_status !== 'paid') {
    await rejectForbiddenSubscriptionCheckoutCompletion(pool, {
      session,
      checkoutKind: 'annual_membership',
      accountId: accountId ?? session.metadata?.familyBillingAccountId,
    })
    return { status: 'unpaid' }
  }

  const requestId = Number(session.metadata?.annualMembershipCheckoutRequestId)
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return { status: 'error', reason: 'missing_pricing_snapshot' }
  }
  let request = await pool.query(
    `SELECT * FROM annual_membership_checkout_request WHERE id = $1 LIMIT 1`,
    [requestId],
  ).then((result) => result.rows[0] ?? null)
  if (!request) return { status: 'error', reason: 'missing_pricing_snapshot' }
  let snapshot
  try {
    snapshot = parseAnnualCheckoutSnapshot(request)
  } catch {
    return { status: 'error', reason: 'pricing_snapshot_invalid' }
  }

  const memberIds = snapshot.members.map((row) => Number(row.memberId))
  const resolvedAccountId = Number(request.family_billing_account_id)
  if (memberIds.length === 0 || !resolvedAccountId) {
    return { status: 'error', reason: 'missing_metadata' }
  }
  const durableSettlement = validateAnnualMembershipPaidSettlementBinding(
    session,
    request,
    snapshot,
  )
  if (!durableSettlement.ok) {
    return { status: 'error', reason: durableSettlement.reason }
  }
  const purchasedAt = session.created ? new Date(session.created * 1000) : new Date()
  const stripe = await getStripeClient()
  let payment = await recordEnrollmentStripePayment(pool, stripe, {
    session,
    accountId: resolvedAccountId,
    paidAt: purchasedAt,
    fulfillmentPending: true,
  })

  if (request.status === 'quarantined') {
    const quarantine = await quarantinePaidAnnualMembershipCheckout(pool, {
      request,
      session,
      payment,
      reason: request.error_message ?? 'paid_checkout_refund_required',
    })
    payment = quarantine.payment
    return {
      status: 'quarantined',
      reason: 'paid_checkout_refund_required',
      memberIds,
      payment,
    }
  }

  try {
    await rejectForbiddenSubscriptionCheckoutCompletion(pool, {
      session,
      checkoutKind: 'annual_membership',
      accountId: resolvedAccountId,
    })
  } catch (error) {
    if (error?.code !== FORBIDDEN_SUBSCRIPTION_CHECKOUT_CODE) throw error
    const quarantinedPayment = await quarantinePaidAnnualMembershipCheckout(pool, {
      request,
      session,
      payment,
      reason: error.message,
    })
    if (quarantinedPayment.status === 'completed') {
      payment = await settleCompletedAnnualMembershipCheckout(pool, {
        request,
        snapshot,
        session,
        payment,
        purchasedAt,
      })
      return { status: 'already_active', memberIds, payment }
    }
    return {
      status: 'quarantined',
      reason: 'forbidden_subscription_checkout',
      memberIds,
      payment: quarantinedPayment.payment,
    }
  }

  if (request.status === 'completed') {
    payment = await settleCompletedAnnualMembershipCheckout(pool, {
      request,
      snapshot,
      session,
      payment,
      purchasedAt,
    })
    return { status: 'already_active', memberIds, payment }
  }

  let authorizationFailure = null
  if (accountId != null && Number(accountId) !== resolvedAccountId) {
    authorizationFailure = 'account_mismatch'
  }

  const account = authorizationFailure
    ? null
    : await loadActiveAnnualMembershipAccount(pool, resolvedAccountId)
  if (!authorizationFailure && !account) authorizationFailure = 'account_inactive'

  const metadataPayerMemberId = Number(session.metadata.payerMemberId)
  let accountContext = null
  if (!authorizationFailure) {
    try {
      accountContext = requireActiveAnnualMembershipAccount(account, metadataPayerMemberId)
      await requireActiveAnnualMembershipPayer(pool, accountContext)
    } catch {
      authorizationFailure = 'payer_mismatch'
    }
  }
  if (
    !authorizationFailure
    && (
      Number(request.payer_member_id) !== metadataPayerMemberId
      || Number(request.payer_member_id) !== Number(accountContext?.payerMemberId)
    )
  ) authorizationFailure = 'payer_mismatch'

  if (!authorizationFailure) {
    const currentCustomerSettlement = validateAnnualMembershipCheckoutSettlement(session, request, {
      expectedCustomerId: account.stripe_customer_id,
    })
    if (!currentCustomerSettlement.ok) authorizationFailure = currentCustomerSettlement.reason
  }

  if (!authorizationFailure) {
    for (const memberId of memberIds) {
      const access = await ensureAnnualMembershipFamilyMemberAccess(pool, {
        familyId: accountContext.familyId,
        memberId,
        facilityId: accountContext.facilityId,
      })
      if (!access.ok) {
        authorizationFailure = 'member_scope_invalid'
        break
      }
    }
  }

  if (authorizationFailure) {
    const quarantinedPayment = await quarantinePaidAnnualMembershipCheckout(pool, {
      request,
      session,
      payment,
      reason: authorizationFailure,
    })
    if (quarantinedPayment.status === 'completed') {
      payment = await settleCompletedAnnualMembershipCheckout(pool, {
        request,
        snapshot,
        session,
        payment,
        purchasedAt,
      })
      return { status: 'already_active', memberIds, payment }
    }
    return {
      status: 'quarantined',
      reason: authorizationFailure,
      memberIds,
      payment: quarantinedPayment.payment,
    }
  }

  await preserveEnrollmentCheckoutPaymentMethod(pool, stripe, {
    stripeSession: session,
    familyBillingAccountId: resolvedAccountId,
  })

  const fulfillment = await withBillingAccountCollectionLock(
    pool,
    resolvedAccountId,
    async (db) => {
      let transactionOpen = false
      try {
        await db.query('BEGIN')
        transactionOpen = true
        // Membership authorization is partly defined by the presence or
        // absence of family_member history. Existing row locks alone cannot
        // stop a concurrent INSERT from changing that result, so freeze
        // membership DML until entitlement and exact payment settlement commit.
        await db.query('LOCK TABLE family_member IN SHARE MODE')
        request = await db.query(
          `SELECT request.*,
                  account.payer_member_id AS locked_account_payer_member_id
             FROM annual_membership_checkout_request request
             JOIN family_billing_account account
               ON account.id = request.family_billing_account_id
             JOIN family household_family
               ON household_family.id = account.family_id
            WHERE request.id = $1
            FOR UPDATE OF request
            FOR SHARE OF account, household_family`,
          [requestId],
        ).then((result) => result.rows[0] ?? null)
        if (!request) {
          throw checkoutIdempotencyConflict(
            'Annual membership checkout request disappeared during fulfillment.',
          )
        }
        assertAnnualRequestBinding(request, {
          requestFingerprint: request.request_fingerprint,
          payerMemberId: accountContext.payerMemberId,
        })
        // Use only the freshly locked immutable snapshot for every entitlement
        // and exact-charge mutation below.
        snapshot = parseAnnualCheckoutSnapshot(request)
        assertAnnualMembershipCheckoutSessionBinding(session, request, snapshot, {
          expectedCustomerId: durableSettlement.customerId,
        })
        const lockedMemberIds = [...new Set(
          snapshot.members.map((member) => Number(member.memberId)),
        )].filter((memberId) => Number.isSafeInteger(memberId) && memberId > 0)
        const authorizationMemberIds = [...new Set([
          ...lockedMemberIds,
          Number(request.locked_account_payer_member_id),
        ])].filter((memberId) => Number.isSafeInteger(memberId) && memberId > 0)
        const lockedMembers = await db.query(
          `SELECT member.id
             FROM member
            WHERE member.id = ANY($1::bigint[])
            ORDER BY member.id
            FOR SHARE`,
          [authorizationMemberIds],
        )
        const lockedMemberSet = new Set(lockedMembers.rows.map((row) => Number(row.id)))
        if (lockedMemberIds.some((memberId) => !lockedMemberSet.has(memberId))) {
          throw annualMembershipAccountError(
            'One or more annual membership athletes are no longer active.',
          )
        }

        if (request.status === 'completed') {
          await db.query('COMMIT')
          transactionOpen = false
          return { status: 'already_active', payment }
        }
        if (request.status === 'quarantined') {
          const quarantine = await recordPaidCheckoutFulfillmentQuarantine(db, {
            checkoutKind: 'annual_membership',
            ownerId: Number(request.id),
            accountId: resolvedAccountId,
            session,
            payment,
            reason: request.error_message ?? 'paid_checkout_refund_required',
          })
          await db.query('COMMIT')
          transactionOpen = false
          return { status: 'quarantined', payment: quarantine.payment }
        }
        if (!['pending', 'fulfilling'].includes(String(request.status))) {
          const message = `[paid-checkout-refund-required] invalid_request_status:${String(request.status)}`
          await db.query(
            `UPDATE annual_membership_checkout_request
                SET status = 'quarantined', error_message = $2, updated_at = now()
              WHERE id = $1 AND status <> 'completed'`,
            [requestId, message],
          )
          const quarantine = await recordPaidCheckoutFulfillmentQuarantine(db, {
            checkoutKind: 'annual_membership',
            ownerId: Number(request.id),
            accountId: resolvedAccountId,
            session,
            payment,
            reason: message,
          })
          await db.query('COMMIT')
          transactionOpen = false
          return { status: 'quarantined', payment: quarantine.payment }
        }

        // Recheck mutable authorization while holding the same account lock that
        // serializes monthly invoice creation. A payer/customer/member change
        // cannot race the final entitlement transaction unnoticed.
        const lockedAccount = await loadActiveAnnualMembershipAccount(db, resolvedAccountId)
        let lockedContext = null
        let lockedFailure = null
        try {
          lockedContext = requireActiveAnnualMembershipAccount(
            lockedAccount,
            Number(session.metadata.payerMemberId),
          )
          await requireActiveAnnualMembershipPayer(db, lockedContext)
          if (
            Number(request.payer_member_id) !== Number(lockedContext.payerMemberId)
            || String(lockedAccount.stripe_customer_id ?? '')
              !== String(durableSettlement.customerId)
          ) {
            lockedFailure = 'locked_account_binding_changed'
          }
          if (!lockedFailure) {
            for (const memberId of memberIds) {
              const access = await ensureAnnualMembershipFamilyMemberAccess(db, {
                familyId: lockedContext.familyId,
                memberId,
                facilityId: lockedContext.facilityId,
              })
              if (!access.ok) {
                lockedFailure = 'locked_member_scope_invalid'
                break
              }
            }
          }
        } catch {
          lockedFailure = 'locked_payer_invalid'
        }
        if (lockedFailure) {
          const message = `[paid-checkout-refund-required] ${lockedFailure}`
          await db.query(
            `UPDATE annual_membership_checkout_request
                SET status = 'quarantined', error_message = $2, updated_at = now()
              WHERE id = $1 AND status IN ('pending', 'fulfilling')`,
            [requestId, message],
          )
          const quarantine = await recordPaidCheckoutFulfillmentQuarantine(db, {
            checkoutKind: 'annual_membership',
            ownerId: Number(request.id),
            accountId: resolvedAccountId,
            session,
            payment,
            reason: message,
          })
          await db.query('COMMIT')
          transactionOpen = false
          return { status: 'quarantined', payment: quarantine.payment }
        }

        const claimed = await db.query(
          `UPDATE annual_membership_checkout_request
              SET status = 'fulfilling', updated_at = now(), error_message = NULL
            WHERE id = $1 AND status IN ('pending', 'fulfilling')
            RETURNING id`,
          [requestId],
        )
        if (!claimed.rows[0]) {
          throw checkoutIdempotencyConflict(
            'Annual membership checkout changed before fulfillment could be claimed.',
          )
        }
        for (const row of snapshot.members.filter((member) => Number(member.netCents) > 0)) {
          await persistAnnualMembershipLedger(db, {
            accountId: resolvedAccountId,
            memberId: row.memberId,
            fee: {
              id: row.feeId,
              name: row.feeName,
              triggerType: row.triggerType,
              applyBasis: row.applyBasis,
              amountCents: row.grossCents,
            },
            checkoutSessionId: session.id,
            checkoutRequestId: requestId,
            purchasedAt,
            grossCents: row.grossCents,
            discountCents: row.discountCents,
            promoCode: row.promo?.code ?? null,
          })
          if (row.promo?.ruleId && row.discountCents > 0) {
            await recordMembershipPromoRedemption(db, {
              requestId,
              ruleId: row.promo.ruleId,
              memberId: row.memberId,
              familyId: lockedContext.familyId,
              discountCents: row.discountCents,
            })
          }
          await createEnrollmentAnnualMembershipSubscriptions(db, null, {
            preview: {
              additionalFees: {
                items: [{
                  feeId: row.feeId,
                  name: row.feeName,
                  amountCents: row.grossCents,
                  grossAmountCents: row.grossCents,
                  triggerType: row.triggerType,
                  applyBasis: row.applyBasis,
                }],
              },
            },
            stripeSession: null,
            familyBillingAccountId: resolvedAccountId,
            memberId: row.memberId,
            purchasedAt,
          })
        }
        payment = await applyAndSettlePaidCheckoutFulfillment(db, {
          session,
          accountId: resolvedAccountId,
          payment,
          targetAmountCents: Number(session.amount_total),
          applicationNamespace: `annual-checkout:${requestId}`,
          allocationReason: 'annual_membership_checkout_exact',
          manageTransaction: false,
        })
        const completed = await db.query(
          `UPDATE annual_membership_checkout_request
              SET status = 'completed',
                  completed_at = COALESCE(completed_at, now()),
                  updated_at = now()
            WHERE id = $1 AND status = 'fulfilling'
            RETURNING id`,
          [requestId],
        )
        if (!completed.rows[0]) {
          throw checkoutIdempotencyConflict(
            'Annual membership checkout could not be marked completed.',
          )
        }
        await db.query('COMMIT')
        transactionOpen = false
        await allocateHouseholdPaymentsLocked(db, {
          accountId: resolvedAccountId,
          actorType: 'stripe',
          idempotencyNamespace: `annual-checkout-remainder:${requestId}`,
        })
        return { status: 'completed', payment }
      } catch (error) {
        if (transactionOpen) await db.query('ROLLBACK').catch(() => {})
        throw error
      }
    },
  )

  if (fulfillment.status === 'quarantined') {
    return {
      status: 'quarantined',
      reason: 'locked_authorization_or_request_conflict',
      memberIds,
      payment: fulfillment.payment,
    }
  }
  payment = fulfillment.payment
  if (fulfillment.status === 'already_active') {
    payment = await settleCompletedAnnualMembershipCheckout(pool, {
      request,
      snapshot,
      session,
      payment,
      purchasedAt,
    })
    return { status: 'already_active', memberIds, payment }
  }

  return {
    status: 'completed',
    payment,
    memberId: memberIds[0],
    memberIds,
    renewsOn: toUtcDateString(membershipRenewsOnFromPurchase(purchasedAt)),
  }
}

/** Annual membership Checkout always collects money; `complete` alone is not settlement. */
export function annualMembershipCheckoutSessionIsPaid(session) {
  return !checkoutSessionHasForbiddenSubscriptionCollector(session)
    && session?.payment_status === 'paid'
}
