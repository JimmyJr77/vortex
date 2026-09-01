import { recordBillingActivityBestEffort } from './billingActivity.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { canonicalActiveHouseholdMemberPredicate } from './householdMembership.js'
import { facilityDate } from './canonicalBillingMigrationState.js'
import {
  ANNUAL_MEMBERSHIP_PRICING_KEY,
  ANNUAL_MEMBERSHIP_SOURCE_TYPE,
  membershipRenewsOnFromPurchase,
  toUtcDateString,
} from '../scheduling/membershipAnniversary.js'
import {
  membershipPromoDiscountCents,
  resolveMembershipFeePromo,
} from '../scheduling/discountEngine.js'

function positiveId(value, label) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new Error(`${label} is required.`)
  return id
}

function boundedCatchUp(value) {
  const count = Number(value)
  if (!Number.isInteger(count) || count <= 0 || count > 100) {
    throw new Error('Annual membership catch-up limit must be between 1 and 100.')
  }
  return count
}

function dateOnly(value, label) {
  let normalized = null
  if (value instanceof Date) {
    normalized = toUtcDateString(value)
  } else {
    const match = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})/)
    normalized = match?.[1] ?? null
  }
  if (!normalized) throw new Error(`${label} must be a valid calendar date.`)
  const parsed = new Date(`${normalized}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error(`${label} must be a valid calendar date.`)
  }
  return normalized
}

function annualDateAfter(value) {
  const date = dateOnly(value, 'Annual membership renewal date')
  const next = membershipRenewsOnFromPurchase(`${date}T00:00:00.000Z`)
  const result = toUtcDateString(next)
  if (!result || result <= date) throw new Error('Annual membership renewal schedule could not advance.')
  return result
}

function dayBefore(value) {
  const date = new Date(`${dateOnly(value, 'Annual membership paid-through date')}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

function renewalError(code, message, details = {}) {
  const error = new Error(message)
  error.code = code
  error.details = details
  return error
}

function trueDbValue(value) {
  return value === true || value === 't' || value === 1 || value === '1'
}

function remoteAnnualCollectorIds(subscription) {
  return [
    subscription.stripe_subscription_id,
    subscription.stripe_subscription_item_id,
    subscription.stripe_subscription_schedule_id,
  ].map((value) => String(value ?? '').trim()).filter(Boolean)
}

function feeIsEffective(row, asOfDate) {
  if (!trueDbValue(row.fee_active)) return false
  const timeZone = row.facility_timezone
  const startsOn = row.fee_starts_at == null
    ? null
    : facilityDate(new Date(row.fee_starts_at), timeZone)
  const endsOn = row.fee_ends_at == null
    ? null
    : facilityDate(new Date(row.fee_ends_at), timeZone)
  return (!startsOn || startsOn <= asOfDate) && (!endsOn || endsOn >= asOfDate)
}

function manualRenewalPrice(row, standardAmountCents) {
  if (row.renewal_pricing_id == null) {
    return {
      kind: 'standard_price',
      netAmountCents: standardAmountCents,
      discountAmountCents: 0,
      promoCode: null,
      rule: null,
      invalidatedPromo: null,
    }
  }
  if (row.renewal_pricing_kind !== 'manual_final_price') return null
  const finalAmountCents = Number(row.renewal_final_amount_cents)
  if (!Number.isInteger(finalAmountCents) || finalAmountCents < 0) {
    throw renewalError(
      'annual_membership_renewal_pricing_invalid',
      `Annual membership renewal pricing ${row.renewal_pricing_id} has an invalid final amount.`,
      { renewalPricingId: Number(row.renewal_pricing_id) },
    )
  }
  return {
    kind: 'manual_final_price',
    netAmountCents: finalAmountCents,
    discountAmountCents: Math.max(0, standardAmountCents - finalAmountCents),
    promoCode: null,
    rule: null,
    invalidatedPromo: null,
  }
}

async function effectiveRenewalPrice(db, row, { asOfTimestamp, standardAmountCents }) {
  const manual = manualRenewalPrice(row, standardAmountCents)
  if (manual) return manual
  if (row.renewal_pricing_kind !== 'promo_code') {
    throw renewalError(
      'annual_membership_renewal_pricing_invalid',
      `Annual membership renewal pricing ${row.renewal_pricing_id} has an unsupported pricing kind.`,
      { renewalPricingId: Number(row.renewal_pricing_id), pricingKind: row.renewal_pricing_kind },
    )
  }

  const promoCode = String(row.renewal_promo_code ?? '').trim()
  const ruleId = Number(row.renewal_discount_rule_id)
  let resolved = null
  if (promoCode && Number.isInteger(ruleId) && ruleId > 0) {
    // Promo caps span households. Lock the shared rule before re-reading its
    // redemption counts so two account workers cannot both consume the final
    // allowed redemption.
    const lockedRule = await db.query(
      `SELECT id FROM discount_rule WHERE id = $1 FOR UPDATE`,
      [ruleId],
    )
    if (lockedRule.rows[0]) {
      resolved = await resolveMembershipFeePromo(db, {
        facilityId: Number(row.facility_id),
        promoCodes: [promoCode],
        memberId: Number(row.member_id),
        familyId: Number(row.family_id),
        now: asOfTimestamp,
      })
    }
  }

  if (resolved?.rule?.id === ruleId) {
    const discountAmountCents = membershipPromoDiscountCents(resolved.rule, standardAmountCents)
    return {
      kind: 'promo_code',
      netAmountCents: Math.max(0, standardAmountCents - discountAmountCents),
      discountAmountCents,
      promoCode: resolved.code,
      rule: resolved.rule,
      invalidatedPromo: null,
    }
  }

  const invalidated = await db.query(
    `UPDATE annual_membership_renewal_pricing
        SET pricing_kind = 'manual_final_price',
            final_amount_cents = $2,
            promo_code = NULL,
            discount_rule_id = NULL,
            discount_rule_snapshot = NULL,
            sync_status = 'not_required',
            sync_error = NULL,
            updated_at = now()
      WHERE id = $1
        AND pricing_kind = 'promo_code'
      RETURNING *`,
    [Number(row.renewal_pricing_id), standardAmountCents],
  ).then((result) => result.rows[0] ?? null)
  if (!invalidated) {
    throw renewalError(
      'annual_membership_renewal_pricing_changed',
      `Annual membership renewal pricing ${row.renewal_pricing_id} changed while it was being applied.`,
      { renewalPricingId: Number(row.renewal_pricing_id) },
    )
  }
  row.renewal_pricing_kind = 'manual_final_price'
  row.renewal_final_amount_cents = standardAmountCents
  row.renewal_promo_code = null
  row.renewal_discount_rule_id = null
  return {
    kind: 'standard_price',
    netAmountCents: standardAmountCents,
    discountAmountCents: 0,
    promoCode: null,
    rule: null,
    invalidatedPromo: {
      pricingId: Number(row.renewal_pricing_id),
      promoCode,
      before: {
        pricingKind: 'promo_code',
        promoCode,
        discountRuleId: Number.isInteger(ruleId) && ruleId > 0 ? ruleId : null,
      },
      after: invalidated,
    },
  }
}

function assertExistingChargeMatches(charge, expected) {
  const mismatches = []
  if (Number(charge.family_billing_account_id) !== expected.accountId) mismatches.push('account')
  if (Number(charge.member_id) !== expected.memberId) mismatches.push('member')
  if (Number(charge.amount_cents) !== expected.amountCents) mismatches.push('amount')
  if (
    charge.gross_amount_cents != null
    && Number(charge.gross_amount_cents) !== expected.grossAmountCents
  ) mismatches.push('gross amount')
  if (Number(charge.discount_amount_cents ?? 0) !== expected.discountAmountCents) {
    mismatches.push('discount amount')
  }
  if (charge.subscription_id != null && Number(charge.subscription_id) !== expected.subscriptionId) {
    mismatches.push('subscription')
  }
  if (
    charge.service_period_start != null
    && dateOnly(charge.service_period_start, 'Existing annual membership service start') !== expected.servicePeriodStart
  ) mismatches.push('service-period start')
  if (
    charge.service_period_end != null
    && ![
      expected.servicePeriodEnd,
      // The existing admin Bill-now path historically marked a one-day annual
      // fee service period. Its deterministic paid-through source ID still
      // proves this is the same renewal, so accept that compatible legacy form.
      expected.servicePeriodStart,
    ].includes(dateOnly(charge.service_period_end, 'Existing annual membership service end'))
  ) mismatches.push('service-period end')
  if (mismatches.length > 0) {
    throw renewalError(
      'annual_membership_renewal_charge_conflict',
      `Existing annual membership renewal charge ${charge.id} conflicts on ${mismatches.join(', ')}.`,
      { chargeId: Number(charge.id), sourceId: expected.sourceId, mismatches },
    )
  }
}

async function insertRenewalCharge(db, { row, dueDate, nextBillDate, price }) {
  const standardAmountCents = Math.max(0, Number(row.fee_amount_cents))
  const grossAmountCents = Math.max(standardAmountCents, price.netAmountCents)
  const discountAmountCents = Math.max(0, grossAmountCents - price.netAmountCents)
  const sourceId = `${Number(row.fee_id)}:${Number(row.member_id)}:${nextBillDate}`
  const servicePeriodEnd = dayBefore(nextBillDate)
  const metadata = {
    createdBy: 'annual_membership_renewal_job',
    renewal: true,
    renewalDueDate: dueDate,
    renewalNextBillDate: nextBillDate,
    standardAmountCents,
    pricingKind: price.kind,
    annualMembershipRenewalPricingId: row.renewal_pricing_id == null
      ? null
      : Number(row.renewal_pricing_id),
    promoCode: price.promoCode,
    discountRuleId: price.rule?.id == null ? null : Number(price.rule.id),
  }
  const inserted = await db.query(
    `INSERT INTO billing_charge (
       family_billing_account_id, member_id, source_type, source_id, description,
       amount_cents, gross_amount_cents, discount_amount_cents,
       charge_type, billing_interval, subscription_id,
       service_period_start, service_period_end, collection_status, metadata
     ) VALUES (
       $1, $2, 'additional_fee', $3, $4,
       $5, $6, $7,
       'one_time', 'one_time', $8,
       $9::date, $10::date, $11, $12::jsonb
     )
     ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
     RETURNING *`,
    [
      Number(row.family_billing_account_id),
      Number(row.member_id),
      sourceId,
      row.fee_name || row.description || 'Annual membership',
      price.netAmountCents,
      grossAmountCents,
      discountAmountCents,
      Number(row.id),
      dueDate,
      servicePeriodEnd,
      price.netAmountCents === 0 ? 'paid' : 'unpaid',
      JSON.stringify(metadata),
    ],
  )
  let charge = inserted.rows[0] ?? null
  const created = Boolean(charge)
  if (!charge) {
    charge = await db.query(
      `SELECT *
         FROM billing_charge
        WHERE source_type = 'additional_fee'
          AND source_id = $1
        LIMIT 1
        FOR SHARE`,
      [sourceId],
    ).then((result) => result.rows[0] ?? null)
    if (!charge) {
      throw renewalError(
        'annual_membership_renewal_charge_missing',
        `Annual membership renewal charge ${sourceId} could not be created or replayed.`,
        { sourceId },
      )
    }
  }
  assertExistingChargeMatches(charge, {
    accountId: Number(row.family_billing_account_id),
    memberId: Number(row.member_id),
    amountCents: price.netAmountCents,
    grossAmountCents,
    discountAmountCents,
    subscriptionId: Number(row.id),
    sourceId,
    servicePeriodStart: dueDate,
    servicePeriodEnd,
  })
  return { charge, created, sourceId, metadata }
}

async function recordPromoRedemption(db, { row, charge, price }) {
  if (!price.rule?.id || price.discountAmountCents <= 0) return null
  const result = await db.query(
    `WITH inserted AS (
       INSERT INTO discount_redemption (
         rule_id, member_id, signup_id, program_id, form_id, kind, units,
         amount_cents, annual_membership_renewal_pricing_id
       ) VALUES ($1, $2, NULL, NULL, NULL, 'discount', 0, $3, $4)
       RETURNING id, rule_id
     )
     UPDATE discount_rule rule
        SET redeemed_count = rule.redeemed_count + 1,
            updated_at = now()
       FROM inserted
      WHERE rule.id = inserted.rule_id
      RETURNING inserted.id`,
    [
      Number(price.rule.id),
      Number(row.member_id),
      price.discountAmountCents,
      Number(row.renewal_pricing_id),
    ],
  )
  if (!result.rows[0]) {
    throw renewalError(
      'annual_membership_renewal_promo_redemption_failed',
      `Annual membership promo could not be recorded for renewal charge ${charge.id}.`,
      { chargeId: Number(charge.id), discountRuleId: Number(price.rule.id) },
    )
  }
  return Number(result.rows[0].id)
}

async function recordZeroDollarEntitlement(db, { row, charge, nextBillDate, asOfTimestamp }) {
  const inserted = await db.query(
    `INSERT INTO additional_fee_redemption (
       fee_id, member_id, signup_id, period_key, amount_cents,
       billing_charge_id, satisfied_at, created_at
     ) VALUES ($1, $2, NULL, $3, 0, $4, $5, $5)
     ON CONFLICT (fee_id, member_id, period_key) DO NOTHING
     RETURNING *`,
    [Number(row.fee_id), Number(row.member_id), nextBillDate, Number(charge.id), asOfTimestamp],
  )
  if (inserted.rows[0]) return inserted.rows[0]
  const existing = await db.query(
    `SELECT *
       FROM additional_fee_redemption
      WHERE fee_id = $1 AND member_id = $2 AND period_key = $3
      LIMIT 1
      FOR SHARE`,
    [Number(row.fee_id), Number(row.member_id), nextBillDate],
  ).then((result) => result.rows[0] ?? null)
  if (!existing || Number(existing.billing_charge_id) !== Number(charge.id)) {
    throw renewalError(
      'annual_membership_zero_dollar_entitlement_conflict',
      `Zero-dollar annual membership entitlement conflicts for member ${row.member_id}.`,
      {
        memberId: Number(row.member_id),
        feeId: Number(row.fee_id),
        nextBillDate,
        chargeId: Number(charge.id),
      },
    )
  }
  return existing
}

async function loadLockedAccount(db, accountId) {
  return db.query(
    `SELECT account.id, account.family_id, account.is_active,
            family.facility_id, facility.timezone AS facility_timezone
       FROM family_billing_account account
       JOIN family ON family.id = account.family_id
       JOIN facility ON facility.id = family.facility_id
      WHERE account.id = $1
        AND account.is_active = TRUE
      LIMIT 1
      FOR UPDATE OF account`,
    [accountId],
  ).then((result) => result.rows[0] ?? null)
}

async function loadDueAnnualMemberships(db, account, billingThroughDate) {
  const activeHouseholdMember = canonicalActiveHouseholdMemberPredicate({
    memberAlias: 'member',
    familyIdReference: '$2',
    membershipAlias: 'annual_renewal_household',
    historyAlias: 'annual_renewal_household_history',
  })
  return db.query(
    `SELECT subscription.*,
            $2::bigint AS family_id,
            $4::bigint AS facility_id,
            $5::text AS facility_timezone,
            member.id AS resolved_member_id,
            member.facility_id AS member_facility_id,
            COALESCE((${activeHouseholdMember}), FALSE) AS member_is_owned,
            fee.id AS fee_id,
            fee.name AS fee_name,
            fee.amount_cents AS fee_amount_cents,
            fee.active AS fee_active,
            fee.starts_at AS fee_starts_at,
            fee.ends_at AS fee_ends_at,
            fee.facility_id AS fee_facility_id,
            fee.trigger_type AS fee_trigger_type,
            fee.apply_basis AS fee_apply_basis,
            pricing.id AS renewal_pricing_id,
            pricing.pricing_kind AS renewal_pricing_kind,
            pricing.final_amount_cents AS renewal_final_amount_cents,
            pricing.promo_code AS renewal_promo_code,
            pricing.discount_rule_id AS renewal_discount_rule_id
       FROM billing_subscription subscription
       LEFT JOIN member ON member.id = subscription.member_id
       LEFT JOIN additional_fee fee
         ON subscription.source_id = CONCAT(fee.id, ':', subscription.member_id)
       LEFT JOIN annual_membership_renewal_pricing pricing
         ON pricing.family_billing_account_id = subscription.family_billing_account_id
        AND pricing.member_id = subscription.member_id
        AND pricing.additional_fee_id = fee.id
      WHERE subscription.family_billing_account_id = $1
        AND subscription.status = 'active'
        AND subscription.auto_renewal = TRUE
        AND subscription.next_bill_date IS NOT NULL
        AND subscription.next_bill_date <= $3::date
        AND (
          subscription.source_type = '${ANNUAL_MEMBERSHIP_SOURCE_TYPE}'
          OR COALESCE(subscription.pricing_option_key, '') = '${ANNUAL_MEMBERSHIP_PRICING_KEY}'
        )
      ORDER BY subscription.next_bill_date, subscription.id
      FOR UPDATE OF subscription`,
    [
      Number(account.id),
      Number(account.family_id),
      billingThroughDate,
      Number(account.facility_id),
      account.facility_timezone,
    ],
  ).then((result) => result.rows)
}

async function refreshLockedAnnualFee(db, row) {
  if (row.fee_id == null) return
  const fee = await db.query(
    `SELECT id, facility_id, name, amount_cents, active, starts_at, ends_at,
            trigger_type, apply_basis
       FROM additional_fee
      WHERE id = $1
      LIMIT 1
      FOR SHARE`,
    [Number(row.fee_id)],
  ).then((result) => result.rows[0] ?? null)
  if (!fee) {
    row.fee_id = null
    return
  }
  row.fee_id = fee.id
  row.fee_facility_id = fee.facility_id
  row.fee_name = fee.name
  row.fee_amount_cents = fee.amount_cents
  row.fee_active = fee.active
  row.fee_starts_at = fee.starts_at
  row.fee_ends_at = fee.ends_at
  row.fee_trigger_type = fee.trigger_type
  row.fee_apply_basis = fee.apply_basis
}

function validateDueAnnualMembership(row, account, asOfDate) {
  const subscriptionId = Number(row.id)
  if (
    row.resolved_member_id == null
    || !trueDbValue(row.member_is_owned)
    || Number(row.member_facility_id) !== Number(account.facility_id)
  ) {
    throw renewalError(
      'annual_membership_renewal_member_scope_invalid',
      `Annual membership subscription ${subscriptionId} is not owned by an active member of this household.`,
      { accountId: Number(account.id), subscriptionId, memberId: row.member_id == null ? null : Number(row.member_id) },
    )
  }
  if (
    row.fee_id == null
    || (row.fee_trigger_type !== 'once_per_year' && row.fee_apply_basis !== 'per_year')
    || (row.fee_facility_id != null && Number(row.fee_facility_id) !== Number(account.facility_id))
  ) {
    throw renewalError(
      'annual_membership_renewal_fee_binding_invalid',
      `Annual membership subscription ${subscriptionId} is not bound to this facility's annual fee.`,
      { accountId: Number(account.id), subscriptionId, memberId: Number(row.member_id) },
    )
  }
  const standardAmountCents = Number(row.fee_amount_cents)
  if (!Number.isInteger(standardAmountCents) || standardAmountCents < 0 || !feeIsEffective(row, asOfDate)) {
    throw renewalError(
      'annual_membership_renewal_fee_not_effective',
      `Annual membership fee ${row.fee_id} is not effective for this renewal.`,
      { accountId: Number(account.id), subscriptionId, feeId: Number(row.fee_id), asOfDate },
    )
  }
  const remoteIds = remoteAnnualCollectorIds(row)
  if (remoteIds.length > 0) {
    throw renewalError(
      'annual_membership_remote_collector_attached',
      `Annual membership subscription ${subscriptionId} still has a Stripe collector attached.`,
      { accountId: Number(account.id), subscriptionId, memberId: Number(row.member_id) },
    )
  }
  return standardAmountCents
}

/**
 * Post due annual membership renewals while the caller owns the household
 * collection lock. All charge, promo-redemption, entitlement, and schedule
 * writes for an account commit together.
 */
export async function postDueAnnualMembershipRenewalsLocked(db, {
  accountId,
  asOfDate,
  billingThroughDate = asOfDate,
  asOfTimestamp = new Date(),
  maxCatchUpPerSubscription = 12,
} = {}) {
  const normalizedAccountId = positiveId(accountId, 'Billing account ID')
  const normalizedAsOfDate = dateOnly(asOfDate, 'Annual membership as-of date')
  const normalizedBillingThroughDate = dateOnly(
    billingThroughDate,
    'Annual membership billing-through date',
  )
  if (normalizedBillingThroughDate < normalizedAsOfDate) {
    throw new Error('Annual membership billing-through date cannot precede the as-of date.')
  }
  const normalizedAsOfTimestamp = asOfTimestamp instanceof Date
    ? asOfTimestamp
    : new Date(asOfTimestamp)
  if (Number.isNaN(normalizedAsOfTimestamp.getTime())) {
    throw new Error('Annual membership as-of timestamp must be valid.')
  }
  const catchUpLimit = boundedCatchUp(maxCatchUpPerSubscription)
  let transactionOpen = false
  const activity = []
  try {
    await db.query('BEGIN')
    transactionOpen = true
    const account = await loadLockedAccount(db, normalizedAccountId)
    if (!account) {
      await db.query('COMMIT')
      transactionOpen = false
      return {
        accountId: normalizedAccountId,
        subscriptionsProcessed: 0,
        chargesPosted: 0,
        periodsAdvanced: 0,
        postedChargeIds: [],
        replayedChargeIds: [],
        skipped: 'inactive_account',
      }
    }
    const due = await loadDueAnnualMemberships(db, account, normalizedBillingThroughDate)
    const processedSubscriptionIds = new Set()
    const postedChargeIds = []
    const replayedChargeIds = []
    let periodsAdvanced = 0

    for (const row of due) {
      // Fee configuration is facility-wide rather than account-owned. Re-read
      // it under a shared row lock so a concurrent price/configuration change
      // cannot split one renewal between two effective fee versions.
      await refreshLockedAnnualFee(db, row)
      let dueDate = dateOnly(row.next_bill_date, 'Annual membership next bill date')
      let rounds = 0
      while (dueDate <= normalizedBillingThroughDate && rounds < catchUpLimit) {
        const standardAmountCents = validateDueAnnualMembership(row, account, dueDate)
        const nextBillDate = annualDateAfter(dueDate)
        const price = await effectiveRenewalPrice(db, row, {
          asOfTimestamp: normalizedAsOfTimestamp,
          standardAmountCents,
        })
        if (price.invalidatedPromo) {
          activity.push({
            eventKey: `annual-membership-renewal-promo-invalidated:${row.renewal_pricing_id}:${dueDate}`,
            accountId: normalizedAccountId,
            memberId: Number(row.member_id),
            eventType: 'annual_membership_renewal_promo_invalidated',
            summary: `Annual membership discount code ${price.invalidatedPromo.promoCode || '(unknown)'} is no longer valid; the standard renewal price was restored.`,
            beforeValue: price.invalidatedPromo.before,
            afterValue: price.invalidatedPromo.after,
            actorType: 'system',
          })
        }
        const posted = await insertRenewalCharge(db, { row, dueDate, nextBillDate, price })
        if (posted.created) {
          postedChargeIds.push(Number(posted.charge.id))
          const promoRedemptionId = await recordPromoRedemption(db, {
            row,
            charge: posted.charge,
            price,
          })
          if (price.netAmountCents === 0) {
            await recordZeroDollarEntitlement(db, {
              row,
              charge: posted.charge,
              nextBillDate,
              asOfTimestamp: normalizedAsOfTimestamp,
            })
          }
          activity.push({
            eventKey: `annual-membership-renewal-posted:${posted.charge.id}`,
            accountId: normalizedAccountId,
            memberId: Number(row.member_id),
            chargeId: Number(posted.charge.id),
            eventType: 'annual_membership_renewal_posted',
            summary: `${row.fee_name || row.description || 'Annual membership'} renewal was added to the household ledger.`,
            afterValue: {
              billingSubscriptionId: Number(row.id),
              chargeId: Number(posted.charge.id),
              dueDate,
              nextBillDate,
              amountCents: price.netAmountCents,
              grossAmountCents: Math.max(standardAmountCents, price.netAmountCents),
              discountAmountCents: Math.max(0, standardAmountCents - price.netAmountCents),
              pricingKind: price.kind,
              promoCode: price.promoCode,
              promoRedemptionId,
            },
            actorType: 'system',
            occurredAt: normalizedAsOfTimestamp,
          })
        } else {
          replayedChargeIds.push(Number(posted.charge.id))
        }

        const advanced = await db.query(
          `UPDATE billing_subscription
              SET next_bill_date = $3::date,
                  updated_at = now()
            WHERE id = $1
              AND family_billing_account_id = $2
              AND status = 'active'
              AND auto_renewal = TRUE
              AND next_bill_date = $4::date
              AND NULLIF(BTRIM(COALESCE(stripe_subscription_id, '')), '') IS NULL
              AND NULLIF(BTRIM(COALESCE(stripe_subscription_item_id, '')), '') IS NULL
              AND NULLIF(BTRIM(COALESCE(stripe_subscription_schedule_id, '')), '') IS NULL
            RETURNING id, next_bill_date`,
          [Number(row.id), normalizedAccountId, nextBillDate, dueDate],
        )
        if (!advanced.rows[0]) {
          throw renewalError(
            'annual_membership_renewal_schedule_no_progress',
            `Annual membership subscription ${row.id} did not advance from ${dueDate}.`,
            { accountId: normalizedAccountId, subscriptionId: Number(row.id), dueDate, nextBillDate },
          )
        }
        dueDate = dateOnly(advanced.rows[0].next_bill_date, 'Advanced annual membership next bill date')
        row.next_bill_date = dueDate
        processedSubscriptionIds.add(Number(row.id))
        periodsAdvanced += 1
        rounds += 1
      }
      if (dueDate <= normalizedBillingThroughDate) {
        throw renewalError(
          'annual_membership_renewal_catchup_limit_exceeded',
          `Annual membership catch-up limit was reached for subscription ${row.id}.`,
          {
            accountId: normalizedAccountId,
            subscriptionId: Number(row.id),
            nextBillDate: dueDate,
            asOfDate: normalizedAsOfDate,
            billingThroughDate: normalizedBillingThroughDate,
          },
        )
      }
    }

    await db.query('COMMIT')
    transactionOpen = false
    for (const entry of activity) await recordBillingActivityBestEffort(db, entry)
    return {
      accountId: normalizedAccountId,
      subscriptionsProcessed: processedSubscriptionIds.size,
      chargesPosted: postedChargeIds.length,
      periodsAdvanced,
      postedChargeIds,
      replayedChargeIds,
    }
  } catch (error) {
    if (transactionOpen) await db.query('ROLLBACK').catch(() => {})
    throw error
  }
}

/**
 * Standalone safe entry point. The recurring account worker already owns this
 * lock; PostgreSQL session advisory locks are re-entrant, so the same primitive
 * remains safe when called there or by an operational repair command.
 */
export async function postDueAnnualMembershipRenewals(pool, options = {}) {
  const accountId = positiveId(options.accountId, 'Billing account ID')
  return withBillingAccountCollectionLock(pool, accountId, (db) => (
    postDueAnnualMembershipRenewalsLocked(db, { ...options, accountId })
  ))
}
