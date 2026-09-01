import { normalizeHistoricalPaymentAllocations } from './paymentAllocation.js'
import { recordBillingActivity, recordBillingActivityBestEffort } from './billingActivity.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { canonicalActiveHouseholdMemberPredicate } from './householdMembership.js'
import {
  ANNUAL_MEMBERSHIP_PRICING_KEY,
  ANNUAL_MEMBERSHIP_SOURCE_TYPE,
  membershipRenewsOnFromPurchase,
  toUtcDateString,
} from '../scheduling/membershipAnniversary.js'

const WAIVED_MEMBERSHIP_REPAIR_CODE = 'fully_waived_annual_membership_repair_conflict'

export class FullyWaivedAnnualMembershipRepairError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'FullyWaivedAnnualMembershipRepairError'
    this.code = WAIVED_MEMBERSHIP_REPAIR_CODE
    this.details = details
  }
}

function positiveInteger(value) {
  const normalized = Number(value)
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null
}

function cents(value) {
  return Math.round(Number(value) || 0)
}

function dateKey(value) {
  if (value == null || value === '') return null
  return toUtcDateString(value)
}

function exactTimestamp(left, right) {
  const leftTime = new Date(left).getTime()
  const rightTime = new Date(right).getTime()
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime
}

function repairConflict(message, details = {}) {
  throw new FullyWaivedAnnualMembershipRepairError(message, details)
}

/** Parse only the immutable fee:member:paid-through identity written by annual fee checkout. */
export function parseFullyWaivedAnnualMembershipSource(sourceId) {
  const match = /^(\d+):(\d+):(\d{4}-\d{2}-\d{2})$/.exec(String(sourceId ?? ''))
  if (!match) return null
  const feeId = positiveInteger(match[1])
  const memberId = positiveInteger(match[2])
  const periodKey = match[3]
  if (
    feeId == null
    || memberId == null
    || toUtcDateString(`${periodKey}T00:00:00.000Z`) !== periodKey
  ) return null
  return { feeId, memberId, periodKey }
}

function checkoutRequestIdFromCharge(charge) {
  return positiveInteger(
    charge.metadata?.annualMembershipCheckoutRequestId
      ?? charge.metadata?.annual_membership_checkout_request_id,
  )
}

function promoCodeFromCharge(charge) {
  return String(charge.metadata?.discountCode ?? charge.metadata?.discount_code ?? '').trim()
}

function inspectFullyWaivedCharge(charge) {
  const source = parseFullyWaivedAnnualMembershipSource(charge.source_id)
  const chargeId = positiveInteger(charge.id)
  const accountId = positiveInteger(charge.family_billing_account_id)
  const memberId = positiveInteger(charge.member_id)
  const feeId = positiveInteger(charge.fee_id)
  const familyFacilityId = positiveInteger(charge.family_facility_id)
  const feeFacilityId = positiveInteger(charge.fee_facility_id)
  const purchasedAt = new Date(charge.created_at)
  const expectedPeriodKey = toUtcDateString(membershipRenewsOnFromPurchase(purchasedAt))
  const grossCents = cents(charge.gross_amount_cents)
  const discountCents = cents(charge.discount_amount_cents)

  if (chargeId == null || accountId == null || memberId == null || feeId == null) {
    repairConflict('The waived annual membership charge has incomplete immutable ownership.', {
      chargeId, accountId, memberId, feeId,
    })
  }
  if (!source || source.feeId !== feeId || source.memberId !== memberId) {
    repairConflict('The waived annual membership charge source does not exactly match its fee and member.', {
      chargeId, sourceId: charge.source_id, feeId, memberId,
    })
  }
  if (!expectedPeriodKey || source.periodKey !== expectedPeriodKey) {
    repairConflict('The waived annual membership charge period is not its purchase anniversary.', {
      chargeId, sourcePeriodKey: source?.periodKey ?? null, expectedPeriodKey,
    })
  }
  if (
    cents(charge.amount_cents) !== 0
    || grossCents <= 0
    || discountCents !== grossCents
  ) {
    repairConflict('The annual membership charge is not fully waived.', {
      chargeId,
      amountCents: cents(charge.amount_cents),
      grossCents,
      discountCents,
    })
  }
  if (charge.charge_type !== 'one_time' || charge.billing_interval !== 'one_time') {
    repairConflict('The waived annual membership charge is not an immutable one-time fee.', {
      chargeId, chargeType: charge.charge_type, billingInterval: charge.billing_interval,
    })
  }
  if (!['none', 'unpaid', 'paid'].includes(String(charge.collection_status ?? 'none'))) {
    repairConflict('The waived annual membership charge has an in-flight or failed collection state.', {
      chargeId, collectionStatus: charge.collection_status,
    })
  }
  if (
    charge.member_matches_household !== true
    || familyFacilityId == null
    || feeFacilityId !== familyFacilityId
  ) {
    repairConflict('The waived annual membership fee, athlete, and household do not share exact ownership.', {
      chargeId,
      memberMatchesHousehold: charge.member_matches_household === true,
      familyFacilityId,
      feeFacilityId,
    })
  }
  if (!(charge.fee_trigger_type === 'once_per_year' || charge.fee_apply_basis === 'per_year')) {
    repairConflict('The referenced additional fee is not an annual membership fee.', {
      chargeId, feeId, triggerType: charge.fee_trigger_type, applyBasis: charge.fee_apply_basis,
    })
  }
  return {
    charge,
    chargeId,
    accountId,
    familyId: positiveInteger(charge.family_id),
    familyFacilityId,
    memberId,
    feeId,
    periodKey: source.periodKey,
    purchasedAt,
    grossCents,
    discountCents,
    promoCode: promoCodeFromCharge(charge),
    checkoutRequestId: checkoutRequestIdFromCharge(charge),
    scheduleSourceId: `${feeId}:${memberId}`,
  }
}

async function loadFullyWaivedAnnualMembershipCharges(db, accountId, { lockRows = false } = {}) {
  const result = await db.query(
    `SELECT charge.*,
            account.family_id,
            family.facility_id AS family_facility_id,
            fee.id AS fee_id,
            fee.facility_id AS fee_facility_id,
            fee.trigger_type AS fee_trigger_type,
            fee.apply_basis AS fee_apply_basis,
            ${canonicalActiveHouseholdMemberPredicate({
              memberAlias: 'charge_member',
              familyIdReference: 'account.family_id',
              membershipAlias: 'waived_membership',
              historyAlias: 'waived_membership_history',
            })} AS member_matches_household
       FROM billing_charge charge
       JOIN family_billing_account account
         ON account.id = charge.family_billing_account_id
       JOIN family ON family.id = account.family_id
       JOIN member charge_member ON charge_member.id = charge.member_id
       JOIN additional_fee fee
         ON split_part(charge.source_id, ':', 1) ~ '^[0-9]+$'
        AND fee.id = split_part(charge.source_id, ':', 1)::bigint
      WHERE charge.family_billing_account_id = $1
        AND charge.source_type = 'additional_fee'
        AND charge.amount_cents = 0
        AND COALESCE(charge.gross_amount_cents, 0) > 0
        AND charge.discount_amount_cents = charge.gross_amount_cents
        AND (fee.trigger_type = 'once_per_year' OR fee.apply_basis = 'per_year')
      ORDER BY charge.created_at, charge.id
      ${lockRows ? 'FOR UPDATE OF charge' : ''}`,
    [Number(accountId)],
  )
  return result.rows
}

async function loadExactPromoRedemptions(db, candidate, { lockRows = false } = {}) {
  const result = await db.query(
    `SELECT redemption.id, redemption.rule_id, redemption.member_id,
            redemption.signup_id, redemption.kind, redemption.amount_cents,
            redemption.annual_membership_checkout_request_id,
            redemption.created_at,
            rule.facility_id AS rule_facility_id,
            rule.type AS rule_type,
            COALESCE(NULLIF(rule.config->>'code', ''),
                     NULLIF(rule.config->>'promo_code', '')) AS rule_code,
            signup.member_id AS signup_member_id
       FROM discount_redemption redemption
       JOIN discount_rule rule ON rule.id = redemption.rule_id
       LEFT JOIN scheduling_signup signup ON signup.id = redemption.signup_id
      WHERE redemption.member_id = $1
        AND redemption.amount_cents = $2
        AND redemption.kind = 'discount'
        AND rule.type = 'promo_code'
        AND rule.facility_id = $3
        AND (rule.config->>'benefit_type' = 'annual_membership'
          OR rule.config->>'amount_applies_to' = 'annual_membership')
        AND (
          ($4::bigint IS NOT NULL
            AND redemption.annual_membership_checkout_request_id = $4)
          OR
          ($4::bigint IS NULL
            AND redemption.annual_membership_checkout_request_id IS NULL
            AND redemption.created_at BETWEEN $5::timestamptz - interval '15 minutes'
                                          AND $5::timestamptz + interval '15 minutes')
        )
        AND ($6::text = '' OR upper(COALESCE(rule.config->>'code', rule.config->>'promo_code', '')) = upper($6))
      ORDER BY redemption.id
      ${lockRows ? 'FOR UPDATE OF redemption' : ''}`,
    [
      candidate.memberId,
      candidate.discountCents,
      candidate.familyFacilityId,
      candidate.checkoutRequestId,
      candidate.charge.created_at,
      candidate.promoCode,
    ],
  )
  return result.rows
}

async function loadCandidateFeeRedemptions(db, candidate, { lockRows = false } = {}) {
  const result = await db.query(
    `SELECT redemption.*, signup.member_id AS signup_member_id
       FROM additional_fee_redemption redemption
       LEFT JOIN scheduling_signup signup ON signup.id = redemption.signup_id
      WHERE (redemption.fee_id = $1
         AND redemption.member_id = $2
         AND redemption.period_key = $3)
         OR redemption.billing_charge_id = $4
      ORDER BY redemption.id
      ${lockRows ? 'FOR UPDATE OF redemption' : ''}`,
    [candidate.feeId, candidate.memberId, candidate.periodKey, candidate.chargeId],
  )
  return result.rows
}

function inspectExactPromo(candidate, rows) {
  if (rows.length !== 1) {
    repairConflict('The waived annual membership charge does not have exactly one matching annual promo redemption.', {
      chargeId: candidate.chargeId,
      matchingPromoRedemptionIds: rows.map((row) => positiveInteger(row.id)),
    })
  }
  const promo = rows[0]
  if (
    positiveInteger(promo.member_id) !== candidate.memberId
    || cents(promo.amount_cents) !== candidate.discountCents
    || positiveInteger(promo.rule_facility_id) !== candidate.familyFacilityId
    || (promo.signup_id != null && positiveInteger(promo.signup_member_id) !== candidate.memberId)
  ) {
    repairConflict('The matching annual promo redemption has conflicting ownership.', {
      chargeId: candidate.chargeId,
      promoRedemptionId: positiveInteger(promo.id),
    })
  }
  return promo
}

function inspectExactFeeRedemption(candidate, promo, rows) {
  if (rows.length > 1) {
    repairConflict('Multiple fee redemptions compete for the waived annual membership charge.', {
      chargeId: candidate.chargeId,
      feeRedemptionIds: rows.map((row) => positiveInteger(row.id)),
    })
  }
  const redemption = rows[0] ?? null
  if (!redemption) return { action: 'create', redemption: null, signupId: positiveInteger(promo.signup_id) }
  const redemptionChargeId = positiveInteger(redemption.billing_charge_id)
  const signupId = positiveInteger(redemption.signup_id)
  if (
    positiveInteger(redemption.fee_id) !== candidate.feeId
    || positiveInteger(redemption.member_id) !== candidate.memberId
    || String(redemption.period_key) !== candidate.periodKey
    || cents(redemption.amount_cents) !== 0
    || redemption.ended_at != null
    || redemption.end_reason != null
    || (redemptionChargeId != null && redemptionChargeId !== candidate.chargeId)
    || (redemption.satisfied_at != null && !exactTimestamp(redemption.satisfied_at, candidate.charge.created_at))
    || (signupId != null && positiveInteger(redemption.signup_member_id) !== candidate.memberId)
    || (signupId != null && promo.signup_id != null && signupId !== positiveInteger(promo.signup_id))
  ) {
    repairConflict('The existing fee redemption conflicts with the exact waived annual membership entitlement.', {
      chargeId: candidate.chargeId,
      feeRedemptionId: positiveInteger(redemption.id),
      existingBillingChargeId: redemptionChargeId,
      existingSignupId: signupId,
    })
  }
  const complete = redemptionChargeId === candidate.chargeId && redemption.satisfied_at != null
  return { action: complete ? 'none' : 'link', redemption, signupId }
}

async function inspectCandidateEntitlement(db, charge, { lockRows = false } = {}) {
  const candidate = inspectFullyWaivedCharge(charge)
  const promo = inspectExactPromo(
    candidate,
    await loadExactPromoRedemptions(db, candidate, { lockRows }),
  )
  const feeRedemption = inspectExactFeeRedemption(
    candidate,
    promo,
    await loadCandidateFeeRedemptions(db, candidate, { lockRows }),
  )
  return { ...candidate, promo, ...feeRedemption }
}

function maxDateKey(values) {
  return values.filter(Boolean).sort().at(-1) ?? null
}

async function inspectScheduleGroup(db, candidates, { lockRows = false } = {}) {
  const first = candidates[0]
  const history = await db.query(
    `SELECT id, period_key, billing_charge_id, satisfied_at, ended_at
       FROM additional_fee_redemption
      WHERE fee_id = $1 AND member_id = $2
      ORDER BY id
      ${lockRows ? 'FOR UPDATE' : ''}`,
    [first.feeId, first.memberId],
  )
  const validHistoryPeriods = []
  for (const row of history.rows) {
    if (row.satisfied_at == null || row.ended_at != null) continue
    if (toUtcDateString(`${row.period_key}T00:00:00.000Z`) !== row.period_key) {
      repairConflict('An existing annual membership entitlement has an invalid paid-through date.', {
        feeId: first.feeId,
        memberId: first.memberId,
        feeRedemptionId: positiveInteger(row.id),
        periodKey: row.period_key,
      })
    }
    validHistoryPeriods.push(row.period_key)
  }
  const expectedNextBillDate = maxDateKey([
    ...validHistoryPeriods,
    ...candidates.map((candidate) => candidate.periodKey),
  ])
  if (!expectedNextBillDate) {
    repairConflict('The annual membership schedule has no deterministic paid-through date.', {
      feeId: first.feeId, memberId: first.memberId,
    })
  }

  const schedules = await db.query(
    `SELECT *
       FROM billing_subscription
      WHERE source_id = $1
        AND (source_type = 'annual_membership'
          OR COALESCE(pricing_option_key, '') = 'annual_membership')
      ORDER BY id
      ${lockRows ? 'FOR UPDATE' : ''}`,
    [first.scheduleSourceId],
  )
  for (const schedule of schedules.rows) {
    if (
      positiveInteger(schedule.family_billing_account_id) !== first.accountId
      || positiveInteger(schedule.member_id) !== first.memberId
      || schedule.source_type !== ANNUAL_MEMBERSHIP_SOURCE_TYPE
      || ![null, '', ANNUAL_MEMBERSHIP_PRICING_KEY].includes(schedule.pricing_option_key ?? null)
    ) {
      repairConflict('An annual membership schedule source is owned by a different account, member, or schedule type.', {
        sourceId: first.scheduleSourceId,
        billingSubscriptionId: positiveInteger(schedule.id),
      })
    }
  }
  const current = schedules.rows.filter((row) => row.status !== 'cancelled')
  if (current.length > 1) {
    repairConflict('Multiple current annual membership schedules have the same exact source.', {
      sourceId: first.scheduleSourceId,
      billingSubscriptionIds: current.map((row) => positiveInteger(row.id)),
    })
  }
  if (current.length === 0 && schedules.rows.length > 0) {
    repairConflict('The exact annual membership schedule was explicitly cancelled and cannot be reactivated automatically.', {
      sourceId: first.scheduleSourceId,
      billingSubscriptionIds: schedules.rows.map((row) => positiveInteger(row.id)),
    })
  }

  const schedule = current[0] ?? null
  const expectedAnchorDay = Number(expectedNextBillDate.slice(-2))
  if (schedule) {
    const remoteIds = [
      schedule.stripe_subscription_id,
      schedule.stripe_subscription_item_id,
      schedule.stripe_subscription_schedule_id,
    ].filter((value) => String(value ?? '').trim())
    if (
      schedule.status !== 'active'
      || schedule.end_date != null
      || cents(schedule.monthly_amount_cents) !== 0
      || cents(schedule.discount_amount_cents) !== 0
      || cents(schedule.net_monthly_cents) !== 0
      || remoteIds.length > 0
    ) {
      repairConflict('The exact annual membership schedule is not a safe local-only renewal schedule.', {
        sourceId: first.scheduleSourceId,
        billingSubscriptionId: positiveInteger(schedule.id),
        status: schedule.status,
        remoteIds,
      })
    }
    const existingNextBillDate = dateKey(schedule.next_bill_date)
    if (existingNextBillDate && existingNextBillDate > expectedNextBillDate) {
      repairConflict('The annual membership schedule is ahead of every provable entitlement.', {
        sourceId: first.scheduleSourceId,
        billingSubscriptionId: positiveInteger(schedule.id),
        existingNextBillDate,
        expectedNextBillDate,
      })
    }
    const needsUpdate = existingNextBillDate !== expectedNextBillDate
      || Number(schedule.anchor_day) !== expectedAnchorDay
      || schedule.pricing_option_key !== ANNUAL_MEMBERSHIP_PRICING_KEY
    return {
      sourceId: first.scheduleSourceId,
      accountId: first.accountId,
      memberId: first.memberId,
      feeId: first.feeId,
      expectedNextBillDate,
      expectedAnchorDay,
      action: needsUpdate ? 'update' : 'none',
      schedule,
      candidates,
    }
  }
  const purchasedAt = candidates
    .map((candidate) => candidate.purchasedAt)
    .sort((left, right) => left.getTime() - right.getTime())[0]
  const descriptionCandidate = [...candidates]
    .sort((left, right) => right.purchasedAt.getTime() - left.purchasedAt.getTime())[0]
  return {
    sourceId: first.scheduleSourceId,
    accountId: first.accountId,
    memberId: first.memberId,
    feeId: first.feeId,
    expectedNextBillDate,
    expectedAnchorDay,
    action: 'create',
    schedule: null,
    candidates,
    startDate: dateKey(purchasedAt),
    description: String(descriptionCandidate.charge.description || 'Annual membership').slice(0, 200),
  }
}

async function buildFullyWaivedMembershipRepairPlan(db, accountId, { lockRows = false } = {}) {
  const charges = await loadFullyWaivedAnnualMembershipCharges(db, accountId, { lockRows })
  const candidates = []
  for (const charge of charges) {
    candidates.push(await inspectCandidateEntitlement(db, charge, { lockRows }))
  }
  const grouped = new Map()
  for (const candidate of candidates) {
    const current = grouped.get(candidate.scheduleSourceId) ?? []
    current.push(candidate)
    grouped.set(candidate.scheduleSourceId, current)
  }
  const schedules = []
  for (const group of grouped.values()) {
    schedules.push(await inspectScheduleGroup(db, group, { lockRows }))
  }
  return { scanned: charges.length, candidates, schedules }
}

async function persistExactFeeRedemption(db, candidate) {
  if (candidate.action === 'none') return candidate.redemption
  if (candidate.action === 'link') {
    const updated = await db.query(
      `UPDATE additional_fee_redemption
          SET billing_charge_id = COALESCE(billing_charge_id, $2),
              satisfied_at = COALESCE(satisfied_at, $3)
        WHERE id = $1
          AND fee_id = $4
          AND member_id = $5
          AND period_key = $6
          AND amount_cents = 0
          AND (billing_charge_id IS NULL OR billing_charge_id = $2)
          AND (satisfied_at IS NULL OR satisfied_at = $3::timestamptz)
          AND ended_at IS NULL
        RETURNING *`,
      [
        candidate.redemption.id,
        candidate.chargeId,
        candidate.charge.created_at,
        candidate.feeId,
        candidate.memberId,
        candidate.periodKey,
      ],
    ).then((result) => result.rows[0] ?? null)
    if (!updated) {
      repairConflict('The existing waived fee redemption changed before it could be linked.', {
        chargeId: candidate.chargeId,
        feeRedemptionId: positiveInteger(candidate.redemption.id),
      })
    }
    return updated
  }
  const inserted = await db.query(
    `INSERT INTO additional_fee_redemption (
       fee_id, member_id, signup_id, period_key, amount_cents,
       billing_charge_id, satisfied_at, created_at
     ) VALUES ($1, $2, $3, $4, 0, $5, $6, $6)
     ON CONFLICT (fee_id, member_id, period_key) DO NOTHING
     RETURNING *`,
    [
      candidate.feeId,
      candidate.memberId,
      candidate.signupId,
      candidate.periodKey,
      candidate.chargeId,
      candidate.charge.created_at,
    ],
  ).then((result) => result.rows[0] ?? null)
  if (!inserted) {
    repairConflict('The exact waived fee entitlement was claimed concurrently; re-run the audit.', {
      chargeId: candidate.chargeId,
      feeId: candidate.feeId,
      memberId: candidate.memberId,
      periodKey: candidate.periodKey,
    })
  }
  return inserted
}

async function persistLocalAnnualSchedule(db, group) {
  if (group.action === 'none') return group.schedule
  if (group.action === 'update') {
    const updated = await db.query(
      `UPDATE billing_subscription
          SET next_bill_date = $2::date,
              anchor_day = $3,
              pricing_option_key = 'annual_membership',
              updated_at = now()
        WHERE id = $1
          AND family_billing_account_id = $4
          AND member_id = $5
          AND source_type = 'annual_membership'
          AND source_id = $6
          AND status = 'active'
          AND end_date IS NULL
          AND NULLIF(BTRIM(COALESCE(stripe_subscription_id, '')), '') IS NULL
          AND NULLIF(BTRIM(COALESCE(stripe_subscription_item_id, '')), '') IS NULL
          AND NULLIF(BTRIM(COALESCE(stripe_subscription_schedule_id, '')), '') IS NULL
        RETURNING *`,
      [
        group.schedule.id,
        group.expectedNextBillDate,
        group.expectedAnchorDay,
        group.accountId,
        group.memberId,
        group.sourceId,
      ],
    ).then((result) => result.rows[0] ?? null)
    if (!updated) {
      repairConflict('The local annual membership schedule changed before it could be repaired.', {
        sourceId: group.sourceId,
        billingSubscriptionId: positiveInteger(group.schedule.id),
      })
    }
    return updated
  }
  const inserted = await db.query(
    `INSERT INTO billing_subscription (
       family_billing_account_id, member_id, source_type, source_id, description,
       monthly_amount_cents, discount_amount_cents, net_monthly_cents,
       status, start_date, anchor_day, next_bill_date, pricing_option_key, auto_renewal
     ) VALUES (
       $1, $2, 'annual_membership', $3, $4,
       0, 0, 0, 'active', $5::date, $6, $7::date, 'annual_membership', TRUE
     )
     ON CONFLICT (source_type, source_id)
       WHERE source_id IS NOT NULL AND status <> 'cancelled'
     DO NOTHING
     RETURNING *`,
    [
      group.accountId,
      group.memberId,
      group.sourceId,
      group.description,
      group.startDate,
      group.expectedAnchorDay,
      group.expectedNextBillDate,
    ],
  ).then((result) => result.rows[0] ?? null)
  if (!inserted) {
    repairConflict('The local annual membership schedule was claimed concurrently; re-run the audit.', {
      sourceId: group.sourceId,
    })
  }
  return inserted
}

async function applyFullyWaivedMembershipRepairPlan(db, plan) {
  const redemptions = new Map()
  for (const candidate of plan.candidates) {
    redemptions.set(candidate.chargeId, await persistExactFeeRedemption(db, candidate))
  }
  const schedules = new Map()
  for (const group of plan.schedules) {
    schedules.set(group.sourceId, await persistLocalAnnualSchedule(db, group))
  }
  for (const candidate of plan.candidates) {
    const redemption = redemptions.get(candidate.chargeId)
    const schedule = schedules.get(candidate.scheduleSourceId)
    const activity = await recordBillingActivity(db, {
      eventKey: `fully-waived-annual-membership-repaired:${candidate.chargeId}`,
      accountId: candidate.accountId,
      memberId: candidate.memberId,
      signupId: redemption.signup_id == null ? null : positiveInteger(redemption.signup_id),
      chargeId: candidate.chargeId,
      eventType: 'fully_waived_annual_membership_repaired',
      summary: 'Linked the fully waived annual membership charge to its exact athlete entitlement and local renewal schedule.',
      beforeValue: {
        feeRedemptionId: candidate.redemption?.id == null ? null : positiveInteger(candidate.redemption.id),
        billingChargeId: candidate.redemption?.billing_charge_id == null
          ? null
          : positiveInteger(candidate.redemption.billing_charge_id),
        satisfiedAt: candidate.redemption?.satisfied_at ?? null,
      },
      afterValue: {
        feeRedemptionId: positiveInteger(redemption.id),
        billingChargeId: candidate.chargeId,
        satisfiedAt: candidate.charge.created_at,
        periodKey: candidate.periodKey,
        billingSubscriptionId: positiveInteger(schedule.id),
        nextBillDate: dateKey(schedule.next_bill_date),
      },
      details: {
        repair: true,
        feeId: candidate.feeId,
        promoRedemptionId: positiveInteger(candidate.promo.id),
        promoRuleId: positiveInteger(candidate.promo.rule_id),
        preservedSignupId: redemption.signup_id == null ? null : positiveInteger(redemption.signup_id),
        stripeSubscriptionCreated: false,
      },
      actorType: 'system',
    })
    if (!activity) {
      const existingActivity = await db.query(
        `SELECT family_billing_account_id, member_id, related_charge_id, event_type
           FROM billing_account_activity
          WHERE event_key = $1
          LIMIT 1`,
        [`fully-waived-annual-membership-repaired:${candidate.chargeId}`],
      ).then((result) => result.rows[0] ?? null)
      if (
        positiveInteger(existingActivity?.family_billing_account_id) !== candidate.accountId
        || positiveInteger(existingActivity?.member_id) !== candidate.memberId
        || positiveInteger(existingActivity?.related_charge_id) !== candidate.chargeId
        || existingActivity?.event_type !== 'fully_waived_annual_membership_repaired'
      ) {
        repairConflict('The deterministic waived-membership activity key is owned by conflicting evidence.', {
          chargeId: candidate.chargeId,
          eventKey: `fully-waived-annual-membership-repaired:${candidate.chargeId}`,
        })
      }
    }
    await db.query(
      `UPDATE stripe_billing_alert
          SET resolved_at = COALESCE(resolved_at, now()), updated_at = now()
        WHERE stripe_event_id = $1
          AND family_billing_account_id = $2
          AND alert_type = 'membership_owner_review'
          AND resolved_at IS NULL`,
      [`membership-owner-review:${candidate.chargeId}`, candidate.accountId],
    )
  }
  return { redemptions, schedules }
}

/**
 * Repair only historical $0 annual fees whose immutable charge, promo, athlete,
 * fee, paid-through period, entitlement, and local schedule all agree exactly.
 * Apply mode serializes the household and commits the entire account at once.
 */
export async function repairFullyWaivedAnnualMembershipEntitlements(pool, {
  accountId,
  apply = false,
} = {}) {
  const normalizedAccountId = positiveInteger(accountId)
  if (normalizedAccountId == null) throw new Error('A billing account ID is required.')
  if (!apply) {
    try {
      const plan = await buildFullyWaivedMembershipRepairPlan(pool, normalizedAccountId)
      return {
        mode: 'dry_run',
        scanned: plan.scanned,
        planned: plan.candidates.filter((candidate) => candidate.action !== 'none').length
          + plan.schedules.filter((schedule) => schedule.action !== 'none').length,
        correct: plan.candidates.filter((candidate) => candidate.action === 'none').length,
        blocked: [],
      }
    } catch (error) {
      if (!(error instanceof FullyWaivedAnnualMembershipRepairError)) throw error
      return {
        mode: 'dry_run', scanned: 0, planned: 0, correct: 0,
        blocked: [{ code: error.code, message: error.message, details: error.details }],
      }
    }
  }

  return withBillingAccountCollectionLock(pool, normalizedAccountId, async (db) => {
    let transactionOpen = false
    try {
      await db.query('BEGIN')
      transactionOpen = true
      const plan = await buildFullyWaivedMembershipRepairPlan(db, normalizedAccountId, { lockRows: true })
      await applyFullyWaivedMembershipRepairPlan(db, plan)
      await db.query('COMMIT')
      transactionOpen = false
      return {
        mode: 'apply',
        scanned: plan.scanned,
        repaired: plan.candidates.filter((candidate) => candidate.action !== 'none').length,
        schedulesRepaired: plan.schedules.filter((schedule) => schedule.action !== 'none').length,
        correct: plan.candidates.filter((candidate) => candidate.action === 'none').length,
        blocked: [],
      }
    } catch (error) {
      if (transactionOpen) await db.query('ROLLBACK').catch(() => {})
      throw error
    }
  })
}

function uniqueIds(rows) {
  return [...new Set(rows.map((row) => Number(row.member_id)).filter((id) => Number.isFinite(id) && id > 0))]
}

function periodFromCharge(charge) {
  const sourcePeriod = String(charge.source_id || '').split(':')[2]
  if (/^\d{4}-\d{2}-\d{2}$/.test(sourcePeriod || '')) return sourcePeriod
  const created = new Date(charge.created_at)
  created.setUTCFullYear(created.getUTCFullYear() + 1)
  return created.toISOString().slice(0, 10)
}

async function candidatesAtPriority(pool, charge) {
  const feeId = Number(String(charge.source_id || '').split(':')[0])
  const periodKey = periodFromCharge(charge)
  const linkedSignup = await pool.query(
    `SELECT DISTINCT signup.member_id
     FROM additional_fee_redemption redemption
     JOIN scheduling_signup signup ON signup.id = redemption.signup_id
     WHERE redemption.fee_id = $1
       AND (redemption.billing_charge_id = $2 OR redemption.period_key = $3)
       AND signup.member_id IS NOT NULL`,
    [feeId, charge.id, periodKey],
  )
  let candidates = uniqueIds(linkedSignup.rows)
  if (candidates.length) return { candidates, evidence: 'linked_signup_redemption' }

  if (charge.stripe_checkout_session_id) {
    const pending = await pool.query(
      `SELECT DISTINCT member_id
       FROM stripe_pending_enrollment
       WHERE family_billing_account_id = $1
         AND stripe_checkout_session_id = $2
         AND member_id IS NOT NULL`,
      [charge.family_billing_account_id, charge.stripe_checkout_session_id],
    )
    candidates = uniqueIds(pending.rows)
    if (candidates.length) return { candidates, evidence: 'pending_enrollment' }

    const sameCheckout = await pool.query(
      `SELECT DISTINCT member_id
       FROM billing_charge
       WHERE family_billing_account_id = $1
         AND stripe_checkout_session_id = $2
         AND source_type = 'scheduling_signup'
         AND member_id IS NOT NULL`,
      [charge.family_billing_account_id, charge.stripe_checkout_session_id],
    )
    candidates = uniqueIds(sameCheckout.rows)
    if (candidates.length) return { candidates, evidence: 'same_checkout_class_charge' }
  }

  const recurring = await pool.query(
    `SELECT DISTINCT member_id FROM (
       SELECT subscription.member_id
       FROM billing_subscription subscription
       WHERE subscription.family_billing_account_id = $1
         AND subscription.source_type = 'scheduling_signup'
         AND subscription.status IN ('active', 'paused')
       UNION ALL
       SELECT signup.member_id
       FROM scheduling_signup signup
       JOIN member ON member.id = signup.member_id
       WHERE member.family_id = $2
         AND signup.status = 'confirmed'
         AND EXISTS (
           SELECT 1 FROM billing_charge class_charge
           WHERE class_charge.source_type = 'scheduling_signup'
             AND class_charge.source_id = signup.id::text
         )
     ) candidates WHERE member_id IS NOT NULL`,
    [charge.family_billing_account_id, charge.family_id],
  )
  return { candidates: uniqueIds(recurring.rows), evidence: 'unique_qualifying_recurring_athlete' }
}

async function createAmbiguityAlert(pool, charge, candidates, evidence) {
  await pool.query(
    `INSERT INTO stripe_billing_alert (
       stripe_event_id, family_billing_account_id, alert_type, severity,
       stripe_object_id, message, details
     ) VALUES ($1, $2, 'membership_owner_review', 'warning', $3, $4, $5::jsonb)
     ON CONFLICT (stripe_event_id) DO UPDATE
     SET message = EXCLUDED.message, details = EXCLUDED.details,
         resolved_at = NULL, updated_at = now()`,
    [
      `membership-owner-review:${charge.id}`,
      charge.family_billing_account_id,
      charge.stripe_checkout_session_id,
      `Annual membership charge #${charge.id} needs athlete ownership review.`,
      JSON.stringify({ chargeId: Number(charge.id), currentMemberId: Number(charge.member_id), candidates, evidence }),
    ],
  )
}

async function repairChargeOwner(pool, stripe, charge, targetMemberId, evidence) {
  const feeId = Number(String(charge.source_id || '').split(':')[0])
  const periodKey = periodFromCharge(charge)
  const client = typeof pool.connect === 'function' ? await pool.connect() : pool
  let subscriptions = []
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE billing_charge
       SET member_id = $2,
           source_id = $3,
           metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb
       WHERE id = $1`,
      [
        charge.id,
        targetMemberId,
        `${feeId}:${targetMemberId}:${periodKey}`,
        JSON.stringify({ membershipOwnerRepair: { fromMemberId: Number(charge.member_id), toMemberId: targetMemberId, evidence } }),
      ],
    )
    await client.query(
      `UPDATE additional_fee_redemption
       SET member_id = $2, billing_charge_id = $3
       WHERE fee_id = $1
         AND (billing_charge_id = $3 OR (member_id = $4 AND period_key = $5))`,
      [feeId, targetMemberId, charge.id, charge.member_id, periodKey],
    )
    subscriptions = await client.query(
      `UPDATE billing_subscription
       SET member_id = $2,
           source_id = $3,
           description = regexp_replace(description, '\\s+·\\s+.*$', '') || ' · ' ||
             (SELECT trim(concat_ws(' ', first_name, last_name)) FROM member WHERE id = $2),
           updated_at = now()
       WHERE family_billing_account_id = $1
         AND source_type = 'annual_membership'
         AND member_id = $4
         AND source_id = $5
         AND ABS(start_date - $6::timestamptz::date) <= 2
       RETURNING id, stripe_subscription_id`,
      [
        charge.family_billing_account_id,
        targetMemberId,
        `${feeId}:${targetMemberId}`,
        charge.member_id,
        `${feeId}:${charge.member_id}`,
        charge.created_at,
      ],
    ).then((result) => result.rows)
    const promoCode = String(charge.metadata?.discountCode || '').trim()
    if (promoCode && Number(charge.discount_amount_cents) > 0) {
      await client.query(
        `UPDATE discount_redemption redemption
         SET member_id = $2
         FROM discount_rule rule
         WHERE redemption.rule_id = rule.id
           AND redemption.member_id = $1
           AND redemption.amount_cents = $3
           AND upper(COALESCE(rule.config->>'code', rule.config->>'promo_code', '')) = upper($4)
           AND redemption.created_at BETWEEN $5::timestamptz - interval '15 minutes'
                                         AND $5::timestamptz + interval '15 minutes'`,
        [charge.member_id, targetMemberId, charge.discount_amount_cents, promoCode, charge.created_at],
      )
    }
    await recordBillingActivityBestEffort(client, {
      eventKey: `membership-owner-repaired:${charge.id}:${targetMemberId}`,
      accountId: charge.family_billing_account_id,
      memberId: targetMemberId,
      chargeId: charge.id,
      eventType: 'annual_membership_owner_repaired',
      summary: `Annual membership ownership moved to the qualifying athlete.`,
      beforeValue: { memberId: Number(charge.member_id), sourceId: charge.source_id },
      afterValue: { memberId: targetMemberId, sourceId: `${feeId}:${targetMemberId}:${periodKey}` },
      actorType: 'system',
      details: { evidence, repair: true },
    })
    await client.query(
      `UPDATE stripe_billing_alert
       SET resolved_at = now(), updated_at = now()
       WHERE stripe_event_id = $1`,
      [`membership-owner-review:${charge.id}`],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    if (client !== pool && typeof client.release === 'function') client.release()
  }

  if (stripe) {
    for (const subscription of subscriptions) {
      if (!subscription.stripe_subscription_id) continue
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        metadata: { memberId: String(targetMemberId), feeId: String(feeId) },
      })
    }
  }
}

/** Dry-run by default. Applies only evidence-backed, single-athlete repairs. */
export async function repairMembershipOwnershipAndAllocations(pool, stripe = null, {
  apply = false,
  accountIds = [],
  familyIds = [],
  from = null,
  through = null,
} = {}) {
  const charges = await pool.query(
    `SELECT charge.*, account.family_id, account.payer_member_id,
            trim(concat_ws(' ', owner.first_name, owner.last_name)) AS current_member_name
     FROM billing_charge charge
     JOIN family_billing_account account ON account.id = charge.family_billing_account_id
     LEFT JOIN member owner ON owner.id = charge.member_id
     JOIN additional_fee fee
       ON charge.source_type = 'additional_fee'
      AND split_part(charge.source_id, ':', 1) ~ '^[0-9]+$'
      AND fee.id = split_part(charge.source_id, ':', 1)::bigint
      AND (fee.trigger_type = 'once_per_year' OR fee.apply_basis = 'per_year')
     WHERE ($1::bigint[] = '{}'::bigint[] OR charge.family_billing_account_id = ANY($1::bigint[]))
       AND ($2::bigint[] = '{}'::bigint[] OR account.family_id = ANY($2::bigint[]))
       AND ($3::date IS NULL OR charge.created_at::date >= $3::date)
       AND ($4::date IS NULL OR charge.created_at::date <= $4::date)
       -- Fully waived annual charges have immutable fee/member/period and promo
       -- evidence; they are handled by the strict entitlement repair above,
       -- never by this heuristic owner-selection path.
       AND NOT (
         charge.amount_cents = 0
         AND COALESCE(charge.gross_amount_cents, 0) > 0
         AND charge.discount_amount_cents = charge.gross_amount_cents
       )
     ORDER BY charge.family_billing_account_id, charge.created_at, charge.id`,
    [accountIds, familyIds, from, through],
  )
  const report = {
    mode: apply ? 'apply' : 'dry_run',
    scanned: charges.rowCount,
    repaired: [],
    correct: [],
    ambiguous: [],
    allocations: [],
    failed: [],
  }
  const touchedAccounts = new Set()
  for (const charge of charges.rows) {
    try {
      const resolution = await candidatesAtPriority(pool, charge)
      if (resolution.candidates.includes(Number(charge.member_id))) {
        report.correct.push({
          chargeId: Number(charge.id),
          accountId: Number(charge.family_billing_account_id),
          memberId: Number(charge.member_id),
          evidence: `${resolution.evidence}:existing_owner_is_qualifying`,
        })
        touchedAccounts.add(Number(charge.family_billing_account_id))
        continue
      }
      if (resolution.candidates.length !== 1) {
        const item = { chargeId: Number(charge.id), accountId: Number(charge.family_billing_account_id), currentMemberId: Number(charge.member_id), ...resolution }
        report.ambiguous.push(item)
        if (apply) await createAmbiguityAlert(pool, charge, resolution.candidates, resolution.evidence)
        continue
      }
      const targetMemberId = resolution.candidates[0]
      if (targetMemberId === Number(charge.member_id)) {
        report.correct.push({ chargeId: Number(charge.id), accountId: Number(charge.family_billing_account_id), memberId: targetMemberId, evidence: resolution.evidence })
      } else {
        const item = {
          chargeId: Number(charge.id),
          accountId: Number(charge.family_billing_account_id),
          fromMemberId: Number(charge.member_id),
          toMemberId: targetMemberId,
          evidence: resolution.evidence,
        }
        report.repaired.push(item)
        if (apply) await repairChargeOwner(pool, stripe, charge, targetMemberId, resolution.evidence)
      }
      touchedAccounts.add(Number(charge.family_billing_account_id))
    } catch (error) {
      report.failed.push({ chargeId: Number(charge.id), accountId: Number(charge.family_billing_account_id), error: error.message })
    }
  }
  if (apply) {
    const accountScope = accountIds.length
      ? accountIds
      : await pool.query(
          `SELECT id FROM family_billing_account
           WHERE ($1::bigint[] = '{}'::bigint[] OR family_id = ANY($1::bigint[]))`,
          [familyIds],
        ).then((result) => result.rows.map((row) => Number(row.id)))
    for (const accountId of new Set([...accountScope, ...touchedAccounts])) {
      try {
        const allocation = await normalizeHistoricalPaymentAllocations(pool, { accountId })
        report.allocations.push({
          accountId,
          allocationApplications: allocation.applications.length,
          activatedMemberships: allocation.activatedMemberships.length,
        })
      } catch (error) {
        report.failed.push({ accountId, stage: 'allocation', error: error.message })
      }
    }
  }
  return report
}
