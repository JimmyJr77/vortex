import { buildBillingAccountView } from './billingAccountView.js'
import { priceRecurringPeriod } from './recurringPeriodPricing.js'
import { syncEnrollmentStripePriceSchedule } from './stripePriceSchedules.js'
import { recordBillingActivity } from './billingActivity.js'
import {
  addBillingMonths,
  applyEnrollmentPriceAdjustment,
  billingMonthInTimeZone,
  billingMonthKey,
  enumerateBillingMonths,
  mapPriceAdjustment,
  normalizeBillingMonth,
  promoExpirationDate,
} from './customerBillingPricing.js'
import { normalizePromoCode } from '../scheduling/promoCodeRegistry.js'
import { promoTargetsMembershipFee } from '../scheduling/discountEngine.js'
import { resolveProgramsSchema } from '../programs/schema.js'

function parseJson(value, fallback = {}) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function maxMonth(a, b) {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

function minMonth(a, b) {
  if (!a) return b
  if (!b) return a
  return a < b ? a : b
}

async function loadEnrollmentPriceContext(pool, signupId, facilityId = null) {
  const schema = await resolveProgramsSchema(pool)
  const formProgram = schema.hasSchedulingProgramsLink
    ? `COALESCE(sf.programs_id, class_program.${schema.programFkColumn})`
    : `class_program.${schema.programFkColumn}`
  const result = await pool.query(
    `SELECT
       s.id AS signup_id, s.member_id, s.form_id, s.slot_group_id, s.responses,
       s.enrollment_start_date, s.created_at AS signup_created_at,
       m.first_name, m.last_name, m.billing_city, m.graduation_year, m.family_id,
       sf.title AS class_name,
       ${formProgram} AS program_id,
       sg.offering_id,
       program_record.primary_discipline_tag_id AS sport_id,
       program_record.pricing_promo_codes,
       bs.id AS billing_subscription_id,
       bs.family_billing_account_id,
       bs.monthly_amount_cents,
       bs.discount_amount_cents,
       bs.net_monthly_cents,
       bs.start_date AS subscription_start_date,
       bs.next_bill_date,
       bs.stripe_subscription_id,
       bs.stripe_subscription_schedule_id,
       f.facility_id,
       f.family_name
     FROM scheduling_signup s
     JOIN member m ON m.id = s.member_id
     JOIN family f ON f.id = m.family_id
     JOIN scheduling_form sf ON sf.id = s.form_id
     LEFT JOIN program class_program ON class_program.id = sf.program_id
     LEFT JOIN ${schema.programsTable} program_record ON program_record.id = ${formProgram}
     LEFT JOIN scheduling_slot_group sg ON sg.id = s.slot_group_id
     JOIN billing_subscription bs
       ON bs.source_type = 'scheduling_signup'
      AND bs.source_id = s.id::text
      AND bs.status <> 'cancelled'
     WHERE s.id = $1 AND ($2::bigint IS NULL OR f.facility_id = $2)
     ORDER BY CASE bs.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, bs.id DESC
     LIMIT 1`,
    [Number(signupId), facilityId],
  )
  if (!result.rows[0]) throw new Error('A recurring enrollment could not be found for this signup.')
  return result.rows[0]
}

function eligibilityValue(context, field) {
  const responses = parseJson(context.responses)
  if (field === 'school') return String(responses.current_school ?? '').trim().toLowerCase()
  if (field === 'graduation_year') return context.graduation_year == null ? null : Number(context.graduation_year)
  if (field === 'grade_level') {
    const graduationYear = Number(context.graduation_year)
    if (!Number.isFinite(graduationYear)) return null
    const now = new Date()
    const schoolYearEnd = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear()
    return 12 - (graduationYear - schoolYearEnd)
  }
  return null
}

function passesEligibility(context, config) {
  const rules = Array.isArray(config.eligibility_rules) ? config.eligibility_rules : []
  return rules.every((rule) => {
    const actual = eligibilityValue(context, rule.field)
    const values = Array.isArray(rule.value) ? rule.value : [rule.value]
    if (actual == null || actual === '') return false
    if (rule.field === 'school') {
      const normalized = values.map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean)
      const hit = normalized.some((value) => actual === value || actual.includes(value))
      return ['is_not', 'not_in'].includes(rule.operator) ? !hit : hit
    }
    const numbers = values.map(Number).filter(Number.isFinite)
    const hit = rule.operator === 'is' ? Number(actual) === numbers[0] : numbers.includes(Number(actual))
    return ['is_not', 'not_in'].includes(rule.operator) ? !hit : hit
  })
}

function scopeMatches(context, rule) {
  const ref = rule.scope_ref_id == null ? null : Number(rule.scope_ref_id)
  if (rule.scope_level === 'global') return true
  if (rule.scope_level === 'sport') return ref === Number(context.sport_id)
  if (rule.scope_level === 'program') return ref === Number(context.program_id)
  if (rule.scope_level === 'class') return ref === Number(context.form_id)
  if (rule.scope_level === 'offering') return ref === Number(context.offering_id)
  return false
}

export async function resolvePromoAdjustment(pool, context, rawCode, requestedFrom, requestedThrough) {
  const code = normalizePromoCode(rawCode)
  if (!code) throw new Error('A valid promotional code is required.')
  const result = await pool.query(
    `SELECT * FROM discount_rule
     WHERE (facility_id = $1 OR facility_id IS NULL)
       AND type = 'promo_code'
       AND LOWER(COALESCE(config->>'code', config->>'promo_code', '')) = LOWER($2)
     ORDER BY (facility_id = $1) DESC, id DESC LIMIT 1`,
    [context.facility_id, code],
  )
  const rule = result.rows[0]
  if (!rule || rule.active === false) throw new Error('This promotional code is not active.')
  const config = parseJson(rule.config)
  const runtimeRule = {
    type: rule.type,
    config,
  }
  if (promoTargetsMembershipFee(runtimeRule)) {
    throw new Error('Membership-fee promotional codes cannot be assigned to class tuition.')
  }
  if (!scopeMatches(context, rule)) throw new Error('This promotional code does not apply to the selected class.')
  if (!passesEligibility(context, config)) throw new Error('The member does not meet this promotional code’s eligibility rules.')

  // Customer Billing is an authorized administrative assignment surface. The
  // public checkout allow-list controls which codes a customer may discover and
  // enter themselves; it must not override the rule's canonical tuition scope,
  // eligibility, validity window, or redemption limits for a billing manager.

  const counts = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE member_id = $2)::int AS member_total,
       COUNT(*) FILTER (
         WHERE member_id IN (SELECT id FROM member WHERE family_id = $3)
       )::int AS family_total
     FROM discount_redemption WHERE rule_id = $1`,
    [rule.id, context.member_id, context.family_id],
  )
  const total = Math.max(Number(rule.redeemed_count ?? 0), Number(counts.rows[0]?.total ?? 0))
  if (rule.max_redemptions != null && total >= Number(rule.max_redemptions)) {
    throw new Error('This promotional code has reached its redemption limit.')
  }
  const memberLimit = Number(config.max_redemptions_per_member)
  if (Number.isFinite(memberLimit) && memberLimit > 0 && Number(counts.rows[0]?.member_total ?? 0) >= memberLimit) {
    throw new Error('This member has reached the promotional code redemption limit.')
  }
  const familyLimit = Number(config.max_redemptions_per_family)
  if (Number.isFinite(familyLimit) && familyLimit > 0 && Number(counts.rows[0]?.family_total ?? 0) >= familyLimit) {
    throw new Error('This household has reached the promotional code redemption limit.')
  }

  const ruleFrom = rule.starts_at ? billingMonthInTimeZone(rule.starts_at) : null
  const ruleThrough = rule.ends_at ? billingMonthInTimeZone(rule.ends_at) : null
  const effectiveFrom = maxMonth(requestedFrom, ruleFrom)
  const effectiveThrough = minMonth(requestedThrough, ruleThrough)
  if (effectiveThrough && effectiveThrough < effectiveFrom) {
    throw new Error('The requested billing window does not overlap the promotional code’s active dates.')
  }
  return {
    code,
    rule,
    effectiveFrom,
    effectiveThrough,
    snapshot: {
      id: Number(rule.id),
      name: rule.name,
      description: rule.description ?? null,
      type: rule.type,
      amountType: rule.amount_type,
      amountValue: Number(rule.amount_value),
      applyTo: rule.apply_to,
      calcBase: rule.calc_base,
      priority: Number(rule.priority ?? 100),
      stackable: rule.stackable !== false,
      exclusivityGroup: rule.exclusivity_group ?? null,
      maxDiscountCents: rule.max_discount_cents == null ? null : Number(rule.max_discount_cents),
      scopeLevel: rule.scope_level,
      scopeRefId: rule.scope_ref_id == null ? null : Number(rule.scope_ref_id),
      startsAt: rule.starts_at ?? null,
      endsAt: rule.ends_at ?? null,
      expiresOn: promoExpirationDate(rule.ends_at),
      config,
    },
  }
}

async function normalizeAdjustmentRequest(pool, context, input) {
  const kind = input?.kind
  if (!['fixed_final_price', 'promo_code'].includes(kind)) {
    throw new Error('Adjustment kind must be fixed_final_price or promo_code.')
  }
  const reason = String(input?.reason ?? '').trim()
  if (!reason) throw new Error('A reason is required for every enrollment price change.')
  let effectiveFrom = normalizeBillingMonth(input?.effectiveFromMonth)
  let effectiveThrough = input?.effectiveThroughMonth
    ? normalizeBillingMonth(input.effectiveThroughMonth)
    : null
  if (effectiveThrough && effectiveThrough < effectiveFrom) {
    throw new Error('Ending billing month cannot be before the starting month.')
  }
  const enrollmentMonth = normalizeBillingMonth(
    context.subscription_start_date ?? context.enrollment_start_date ?? context.signup_created_at,
  )
  if (effectiveFrom < enrollmentMonth) {
    throw new Error(`Price changes cannot begin before the enrollment billing start (${enrollmentMonth.slice(0, 7)}).`)
  }

  if (kind === 'fixed_final_price') {
    const finalPriceCents = Number(input?.finalPriceCents)
    if (!Number.isInteger(finalPriceCents) || finalPriceCents < 0) {
      throw new Error('Final monthly price must be a nonnegative whole-cent amount.')
    }
    if (finalPriceCents > Number(context.monthly_amount_cents) && input?.confirmSurcharge !== true) {
      throw new Error('Above-list pricing requires surcharge confirmation.')
    }
    return { kind, reason, effectiveFrom, effectiveThrough, finalPriceCents, promo: null }
  }

  const promo = await resolvePromoAdjustment(
    pool,
    context,
    input?.promoCode,
    effectiveFrom,
    effectiveThrough,
  )
  effectiveFrom = promo.effectiveFrom
  effectiveThrough = promo.effectiveThrough
  return { kind, reason, effectiveFrom, effectiveThrough, finalPriceCents: null, promo }
}

function adjustmentField(adjustment, snakeCase, camelCase) {
  return adjustment?.[snakeCase] ?? adjustment?.[camelCase]
}

function isPromoAdjustment(adjustment) {
  return ['promo_code', 'legacy_discount'].includes(adjustment?.kind)
}

function promoAdjustmentIsStackable(adjustment) {
  const snapshot = parseJson(
    adjustmentField(adjustment, 'discount_rule_snapshot', 'discountRuleSnapshot'),
  )
  return snapshot.stackable !== false
}

function promoAdjustmentExclusivityGroup(adjustment) {
  const snapshot = parseJson(
    adjustmentField(adjustment, 'discount_rule_snapshot', 'discountRuleSnapshot'),
  )
  return String(snapshot.exclusivityGroup ?? snapshot.exclusivity_group ?? '').trim() || null
}

export function adjustmentOverlapConflict(existing, proposed) {
  if (!isPromoAdjustment(existing) || !isPromoAdjustment(proposed)) {
    return 'A fixed final price cannot overlap another enrollment price change.'
  }

  const existingRuleValue = adjustmentField(existing, 'discount_rule_id', 'discountRuleId')
  const proposedRuleValue = adjustmentField(proposed, 'discount_rule_id', 'discountRuleId')
  const existingRuleId = existingRuleValue == null ? null : Number(existingRuleValue)
  const proposedRuleId = proposedRuleValue == null ? null : Number(proposedRuleValue)
  const existingCode = normalizePromoCode(
    adjustmentField(existing, 'promo_code', 'promoCode'),
  )
  const proposedCode = normalizePromoCode(
    adjustmentField(proposed, 'promo_code', 'promoCode'),
  )
  if (
    (Number.isFinite(existingRuleId) && Number.isFinite(proposedRuleId) && existingRuleId === proposedRuleId) ||
    (existingCode && proposedCode && existingCode === proposedCode)
  ) {
    return 'This promotional code is already assigned during the selected billing window.'
  }
  if (!promoAdjustmentIsStackable(existing) || !promoAdjustmentIsStackable(proposed)) {
    return 'One of the promotional codes is configured as non-stackable for the selected billing window.'
  }
  const existingGroup = promoAdjustmentExclusivityGroup(existing)
  const proposedGroup = promoAdjustmentExclusivityGroup(proposed)
  if (existingGroup && proposedGroup && existingGroup === proposedGroup) {
    return 'These promotional codes belong to the same exclusive discount group and cannot stack.'
  }
  return null
}

async function assertAdjustmentWindowAvailable(
  db,
  signupId,
  from,
  through,
  proposed,
  excludeId = null,
) {
  const result = await db.query(
    `SELECT id, kind, promo_code, discount_rule_id, discount_rule_snapshot
     FROM enrollment_price_adjustment
     WHERE signup_id = $1
       AND status <> 'revoked'
       AND ($4::bigint IS NULL OR id <> $4)
       AND daterange(
         effective_from_month,
         COALESCE(effective_through_month + 1, 'infinity'::date), '[)'
       ) && daterange($2::date, COALESCE($3::date + 1, 'infinity'::date), '[)')
     ORDER BY created_at, id`,
    [signupId, from, through, excludeId],
  )
  for (const existing of result.rows) {
    const conflict = adjustmentOverlapConflict(existing, proposed)
    if (conflict) throw new Error(conflict)
  }
}

async function loadPeriodInputs(pool, context) {
  const [subscriptions, charges] = await Promise.all([
    pool.query(
      `SELECT * FROM billing_subscription
       WHERE family_billing_account_id = $1 AND status = 'active'`,
      [context.family_billing_account_id],
    ),
    pool.query(
      `SELECT * FROM billing_charge
       WHERE family_billing_account_id = $1 AND subscription_id IS NOT NULL`,
      [context.family_billing_account_id],
    ),
  ])
  return { subscriptions: subscriptions.rows, charges: charges.rows }
}

export async function loadPostedSubscriptionAmountsByPeriod(pool, {
  billingSubscriptionId,
  effectiveFrom,
  effectiveThrough,
}) {
  const result = await pool.query(
    `SELECT to_char(COALESCE(service_period_start, created_at::date), 'YYYY-MM') AS period_key,
            SUM(amount_cents)::int AS amount_cents
     FROM billing_charge
     WHERE subscription_id = $1
       AND COALESCE(service_period_start, created_at::date) >= $2::date
       AND (
         $3::date IS NULL OR
         COALESCE(service_period_start, created_at::date) <
           (date_trunc('month', $3::date) + interval '1 month')::date
       )
     GROUP BY to_char(COALESCE(service_period_start, created_at::date), 'YYYY-MM')
     ORDER BY period_key`,
    [billingSubscriptionId, effectiveFrom, effectiveThrough],
  )
  return new Map(result.rows.map((row) => [row.period_key, Number(row.amount_cents)]))
}

export function postedPriceDifferenceCents(adjustedNetCents, postedAmountCents) {
  if (postedAmountCents == null) return 0
  return Number(adjustedNetCents) - Number(postedAmountCents)
}

export async function previewEnrollmentPriceAdjustment(pool, {
  signupId,
  facilityId = null,
  input,
}) {
  const context = await loadEnrollmentPriceContext(pool, signupId, facilityId)
  const normalized = await normalizeAdjustmentRequest(pool, context, input)
  await assertAdjustmentWindowAvailable(
    pool,
    context.signup_id,
    normalized.effectiveFrom,
    normalized.effectiveThrough,
    {
      kind: normalized.kind,
      promoCode: normalized.promo?.code ?? null,
      discountRuleId: normalized.promo?.snapshot?.id ?? null,
      discountRuleSnapshot: normalized.promo?.snapshot ?? null,
    },
  )

  const currentMonth = billingMonthKey(new Date())
  const previewThrough = normalized.effectiveThrough ?? maxMonth(
    addBillingMonths(normalized.effectiveFrom, 11),
    addBillingMonths(currentMonth, 5),
  )
  const periodKeys = enumerateBillingMonths(normalized.effectiveFrom, previewThrough, { maxMonths: 120 })
  const periodInputs = await loadPeriodInputs(pool, context)
  const postedByPeriod = await loadPostedSubscriptionAmountsByPeriod(pool, {
    billingSubscriptionId: context.billing_subscription_id,
    effectiveFrom: normalized.effectiveFrom,
    effectiveThrough: previewThrough,
  })
  const hypothetical = {
    id: -1,
    signup_id: Number(context.signup_id),
    kind: normalized.kind,
    final_price_cents: normalized.finalPriceCents,
    promo_code: normalized.promo?.code ?? null,
    discount_rule_id: normalized.promo?.snapshot?.id ?? null,
    discount_rule_snapshot: normalized.promo?.snapshot ?? null,
    effective_from_month: normalized.effectiveFrom,
    effective_through_month: normalized.effectiveThrough,
    status: 'pending_sync',
  }

  const months = []
  for (const periodKey of periodKeys) {
    const baselinePricing = await priceRecurringPeriod(pool, {
      familyId: context.family_id,
      subscriptions: periodInputs.subscriptions,
      charges: periodInputs.charges,
      periodKey,
    })
    const adjustedPricing = await priceRecurringPeriod(pool, {
      familyId: context.family_id,
      subscriptions: periodInputs.subscriptions,
      charges: periodInputs.charges,
      periodKey,
      proposedAdjustments: [hypothetical],
    })
    const baseline = baselinePricing.lines.find(
      (line) => Number(line.subscriptionId) === Number(context.billing_subscription_id),
    ) ?? {
      subscriptionId: Number(context.billing_subscription_id),
      signupId: Number(context.signup_id),
      grossCents: Number(context.monthly_amount_cents),
      discountCents: Number(context.discount_amount_cents),
      netCents: Number(context.net_monthly_cents),
    }
    const adjusted = adjustedPricing.lines.find(
      (line) => Number(line.subscriptionId) === Number(context.billing_subscription_id),
    ) ?? applyEnrollmentPriceAdjustment(baseline, hypothetical)
    const postedAmount = postedByPeriod.get(periodKey)
    const alreadyPosted = postedAmount != null
    const retroactiveDifferenceCents = postedPriceDifferenceCents(adjusted.netCents, postedAmount)
    months.push({
      periodKey,
      standardPriceCents: adjusted.grossCents,
      automaticDiscountCents: adjusted.automaticDiscountCents,
      automaticNetCents: adjusted.automaticNetCents,
      manualAdjustmentCents: adjusted.manualAdjustmentCents,
      adjustedCostCents: adjusted.netCents,
      discountComponents: adjusted.discountComponents ?? [],
      householdNetCents: adjustedPricing.netCents,
      postedAmountCents: postedAmount ?? null,
      retroactive: alreadyPosted,
      retroactiveDifferenceCents,
    })
  }

  const account = await pool.query(
    `SELECT * FROM family_billing_account WHERE id = $1`,
    [context.family_billing_account_id],
  )
  const accountView = await buildBillingAccountView(pool, account.rows[0], { memberScopeId: null })
  const retroactiveDifferenceCents = months.reduce(
    (total, month) => total + Number(month.retroactiveDifferenceCents || 0),
    0,
  )
  return {
    signupId: Number(context.signup_id),
    billingSubscriptionId: Number(context.billing_subscription_id),
    memberId: Number(context.member_id),
    memberName: [context.first_name, context.last_name].filter(Boolean).join(' '),
    className: context.class_name,
    kind: normalized.kind,
    finalPriceCents: normalized.finalPriceCents,
    promoCode: normalized.promo?.code ?? null,
    promoRule: normalized.promo?.snapshot ?? null,
    effectiveFromMonth: normalized.effectiveFrom,
    effectiveThroughMonth: normalized.effectiveThrough,
    reason: normalized.reason,
    standardPriceCents: Number(context.monthly_amount_cents),
    aboveList: normalized.finalPriceCents != null && normalized.finalPriceCents > Number(context.monthly_amount_cents),
    months,
    retroactiveDifferenceCents,
    currentBalanceCents: accountView.balanceCents,
    resultingBalanceCents: accountView.balanceCents + retroactiveDifferenceCents,
    stripePlan: context.stripe_subscription_id
      ? {
          mode: 'subscription_schedule',
          stripeSubscriptionId: context.stripe_subscription_id,
          existingScheduleId: context.stripe_subscription_schedule_id ?? null,
          prorationBehavior: 'none',
          revertsAfter: normalized.effectiveThrough
            ? addBillingMonths(normalized.effectiveThrough, 1)
            : null,
        }
      : { mode: 'local_only', prorationBehavior: 'none', revertsAfter: null },
  }
}

async function postRetroactiveDifferences(pool, adjustment, preview, actorUserId) {
  const created = []
  for (const month of preview.months) {
    const amount = Number(month.retroactiveDifferenceCents || 0)
    if (!month.retroactive || amount === 0 || month.postedAmountCents == null) continue
    const chargeType = amount < 0 ? 'credit' : 'adjustment'
    const result = await pool.query(
      `INSERT INTO billing_charge (
         family_billing_account_id, member_id, source_type, source_id,
         description, amount_cents, gross_amount_cents, discount_amount_cents,
         charge_type, billing_interval, subscription_id,
         service_period_start, service_period_end, price_adjustment_id,
         collection_status, created_by_user_id, metadata
       ) VALUES (
         $1, $2, 'price_adjustment', $3, $4, $5, $5, 0,
         $6, 'one_time', $7, $8::date,
         (date_trunc('month', $8::date) + interval '1 month - 1 day')::date,
         $9, 'none', $10, $11::jsonb
       )
       ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
       RETURNING *`,
      [
        adjustment.family_billing_account_id,
        adjustment.member_id,
        `${adjustment.id}:${month.periodKey}`,
        `${amount < 0 ? 'Credit' : 'Debit'} for ${preview.className} price change (${month.periodKey})`,
        amount,
        chargeType,
        adjustment.billing_subscription_id,
        `${month.periodKey}-01`,
        adjustment.id,
        actorUserId,
        JSON.stringify({
          postedAmountCents: month.postedAmountCents,
          adjustedCostCents: month.adjustedCostCents,
          reason: adjustment.reason,
        }),
      ],
    )
    if (result.rows[0]) created.push(result.rows[0])
  }
  return created
}

function adjustmentActivity({ context, preview, adjustment, retroactiveEntries, actorUserId, eventType, summary, eventKey = null }) {
  return {
    eventKey,
    accountId: context.family_billing_account_id,
    memberId: context.member_id,
    signupId: context.signup_id,
    eventType,
    summary,
    afterValue: mapPriceAdjustment(adjustment),
    details: {
      preview,
      retroactiveChargeIds: retroactiveEntries.map((entry) => Number(entry.id)),
    },
    actorUserId,
  }
}

async function activateAdjustmentAtomically(pool, {
  adjustment,
  context,
  preview,
  actorUserId,
  eventType,
  summary,
  eventKey = null,
}) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const active = await client.query(
      `UPDATE enrollment_price_adjustment
       SET status = 'active', stripe_synced_at = now(), stripe_sync_error = NULL
       WHERE id = $1 AND status = 'pending_sync'
       RETURNING *`,
      [adjustment.id],
    ).then((result) => result.rows[0])
    if (!active) throw new Error('The price change is no longer pending activation.')
    const retroactiveEntries = await postRetroactiveDifferences(client, active, preview, actorUserId)
    await recordBillingActivity(client, adjustmentActivity({
      context,
      preview,
      adjustment: active,
      retroactiveEntries,
      actorUserId,
      eventType,
      summary,
      eventKey,
    }))
    await client.query('COMMIT')
    return { adjustment: active, retroactiveEntries }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function failAdjustmentSyncAtomically(pool, {
  adjustment,
  context,
  actorUserId,
  reason,
  eventType,
  summary,
  eventKey = null,
}) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const failed = await client.query(
      `UPDATE enrollment_price_adjustment
       SET status = 'sync_failed', stripe_sync_error = $2
       WHERE id = $1 AND status <> 'revoked'
       RETURNING *`,
      [adjustment.id, String(reason).slice(0, 1000)],
    ).then((result) => result.rows[0])
    if (!failed) throw new Error('The price change is no longer available for retry.')
    await recordBillingActivity(client, {
      eventKey,
      accountId: context.family_billing_account_id,
      memberId: context.member_id,
      signupId: context.signup_id,
      eventType,
      summary,
      afterValue: mapPriceAdjustment(failed),
      details: { reason },
      actorUserId,
    })
    await client.query('COMMIT')
    return failed
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function createEnrollmentPriceAdjustment(pool, {
  signupId,
  facilityId = null,
  actorUserId,
  input,
}) {
  if (actorUserId == null) throw new Error('Authenticated administrator identity is required.')
  const preview = await previewEnrollmentPriceAdjustment(pool, { signupId, facilityId, input })
  const context = await loadEnrollmentPriceContext(pool, signupId, facilityId)
  const client = await pool.connect()
  let adjustment
  let retroactiveEntries = []
  const createdSummary = `${preview.kind === 'fixed_final_price' ? 'Final monthly price' : `Promo ${preview.promoCode}`} applied to ${context.class_name}.`
  try {
    await client.query('BEGIN')
    await client.query(`SELECT pg_advisory_xact_lock($1::bigint)`, [Number(signupId)])
    await assertAdjustmentWindowAvailable(
      client,
      signupId,
      preview.effectiveFromMonth,
      preview.effectiveThroughMonth,
      {
        kind: preview.kind,
        promoCode: preview.promoCode,
        discountRuleId: preview.promoRule?.id ?? null,
        discountRuleSnapshot: preview.promoRule,
      },
    )
    const supersedesAdjustmentId = input?.supersedesAdjustmentId == null
      ? null
      : Number(input.supersedesAdjustmentId)
    if (supersedesAdjustmentId != null) {
      const superseded = await client.query(
        `SELECT signup_id, status FROM enrollment_price_adjustment WHERE id = $1 FOR SHARE`,
        [supersedesAdjustmentId],
      ).then((result) => result.rows[0])
      if (!superseded || Number(superseded.signup_id) !== Number(signupId) || superseded.status !== 'revoked') {
        throw new Error('A superseded price change must be a revoked adjustment for this enrollment.')
      }
    }
    const initialStatus = context.stripe_subscription_id ? 'pending_sync' : 'active'
    const inserted = await client.query(
      `INSERT INTO enrollment_price_adjustment (
         family_billing_account_id, member_id, signup_id, billing_subscription_id,
         kind, final_price_cents, promo_code, discount_rule_id, discount_rule_snapshot,
         effective_from_month, effective_through_month, standard_price_cents,
         preview_snapshot, reason, status, created_by_user_id, supersedes_adjustment_id
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb,
         $10, $11, $12, $13::jsonb, $14, $15, $16, $17
       ) RETURNING *`,
      [
        context.family_billing_account_id,
        context.member_id,
        context.signup_id,
        context.billing_subscription_id,
        preview.kind,
        preview.finalPriceCents,
        preview.promoCode,
        preview.promoRule?.id ?? null,
        preview.promoRule ? JSON.stringify(preview.promoRule) : null,
        preview.effectiveFromMonth,
        preview.effectiveThroughMonth,
        preview.standardPriceCents,
        JSON.stringify(preview),
        preview.reason,
        initialStatus,
        actorUserId,
        supersedesAdjustmentId,
      ],
    )
    adjustment = inserted.rows[0]
    if (preview.kind === 'promo_code' && preview.promoRule?.id) {
      const firstMonth = preview.months[0]
      await client.query(
        `INSERT INTO discount_redemption (
           rule_id, member_id, signup_id, program_id, form_id,
           kind, units, amount_cents, price_adjustment_id
         ) VALUES ($1, $2, $3, $4, $5, 'discount', 0, $6, $7)
         ON CONFLICT (price_adjustment_id) WHERE price_adjustment_id IS NOT NULL DO NOTHING`,
        [
          preview.promoRule.id,
          context.member_id,
          context.signup_id,
          context.program_id,
          context.form_id,
          Math.max(0, Number(firstMonth?.automaticNetCents ?? 0) - Number(firstMonth?.adjustedCostCents ?? 0)),
          adjustment.id,
        ],
      )
      await client.query(
        `UPDATE discount_rule SET redeemed_count = redeemed_count + 1, updated_at = now() WHERE id = $1`,
        [preview.promoRule.id],
      )
    }
    if (!context.stripe_subscription_id) {
      retroactiveEntries = await postRetroactiveDifferences(client, adjustment, preview, actorUserId)
      await recordBillingActivity(client, adjustmentActivity({
        context,
        preview,
        adjustment,
        retroactiveEntries,
        actorUserId,
        eventType: 'enrollment_price_adjustment_created',
        summary: createdSummary,
        eventKey: `price-adjustment-created:${adjustment.id}`,
      }))
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  if (context.stripe_subscription_id) {
    const synced = await syncEnrollmentStripePriceSchedule(pool, context.billing_subscription_id)
    if (synced.status !== 'synced') {
      const reason = synced.reason ?? 'Stripe price schedule was not synchronized.'
      const failed = await failAdjustmentSyncAtomically(pool, {
        adjustment,
        context,
        actorUserId,
        reason,
        eventType: 'enrollment_price_sync_failed',
        summary: `Price change for ${context.class_name} could not be synchronized to Stripe.`,
        eventKey: `price-adjustment-sync-failed:${adjustment.id}`,
      })
      return { adjustment: mapPriceAdjustment(failed), preview, retroactiveEntries: [] }
    }
    try {
      const activated = await activateAdjustmentAtomically(pool, {
        adjustment,
        context,
        preview,
        actorUserId,
        eventType: 'enrollment_price_adjustment_created',
        summary: createdSummary,
        eventKey: `price-adjustment-created:${adjustment.id}`,
      })
      adjustment = activated.adjustment
      retroactiveEntries = activated.retroactiveEntries
    } catch (error) {
      const reason = `Stripe synchronized, but local activation failed: ${error?.message ?? error}`
      const failed = await failAdjustmentSyncAtomically(pool, {
        adjustment,
        context,
        actorUserId,
        reason,
        eventType: 'enrollment_price_activation_failed',
        summary: `Price change for ${context.class_name} synchronized remotely but needs local retry.`,
        eventKey: `price-adjustment-activation-failed:${adjustment.id}`,
      })
      return { adjustment: mapPriceAdjustment(failed), preview, retroactiveEntries: [] }
    }
  }
  return { adjustment: mapPriceAdjustment(adjustment), preview, retroactiveEntries }
}

export async function retryEnrollmentPriceAdjustmentSync(pool, {
  adjustmentId,
  facilityId = null,
  actorUserId,
}) {
  if (actorUserId == null) throw new Error('Authenticated administrator identity is required.')
  const existing = await pool.query(
    `SELECT adjustment.*
     FROM enrollment_price_adjustment adjustment
     JOIN family_billing_account fba ON fba.id = adjustment.family_billing_account_id
     JOIN family f ON f.id = fba.family_id
     WHERE adjustment.id = $1 AND ($2::bigint IS NULL OR f.facility_id = $2)`,
    [Number(adjustmentId), facilityId],
  )
  let adjustment = existing.rows[0]
  if (!adjustment) throw new Error('Price adjustment was not found.')
  if (adjustment.status === 'active') {
    if (!adjustment.billing_subscription_id) {
      throw new Error('This price change is not connected to a recurring billing subscription.')
    }
    const subscription = await pool.query(
      `SELECT price_sync_status FROM billing_subscription WHERE id = $1`,
      [adjustment.billing_subscription_id],
    ).then((result) => result.rows[0])
    if (subscription?.price_sync_status !== 'failed') {
      throw new Error('This active price change does not need Stripe synchronization.')
    }
    const context = await loadEnrollmentPriceContext(pool, adjustment.signup_id, facilityId)
    const synced = await syncEnrollmentStripePriceSchedule(pool, adjustment.billing_subscription_id)
    if (synced.status !== 'synced') {
      const reason = String(synced.reason ?? 'Stripe price schedule was not synchronized.').slice(0, 1000)
      adjustment = await pool.query(
        `UPDATE enrollment_price_adjustment
         SET stripe_sync_error = $2 WHERE id = $1 RETURNING *`,
        [adjustment.id, reason],
      ).then((result) => result.rows[0])
      await recordBillingActivity(pool, {
        accountId: context.family_billing_account_id,
        memberId: context.member_id,
        signupId: context.signup_id,
        eventType: 'enrollment_price_sync_retry_failed',
        summary: `Stripe synchronization was retried for ${context.class_name}, but it still failed.`,
        afterValue: mapPriceAdjustment(adjustment),
        details: { reason },
        actorUserId,
      })
      return {
        adjustment: mapPriceAdjustment(adjustment),
        preview: parseJson(adjustment.preview_snapshot),
        retroactiveEntries: [],
      }
    }
    adjustment = await pool.query(
      `UPDATE enrollment_price_adjustment
       SET stripe_synced_at = now(), stripe_sync_error = NULL
       WHERE id = $1 RETURNING *`,
      [adjustment.id],
    ).then((result) => result.rows[0])
    await recordBillingActivity(pool, {
      accountId: context.family_billing_account_id,
      memberId: context.member_id,
      signupId: context.signup_id,
      eventType: 'enrollment_price_sync_retry_succeeded',
      summary: `Stripe synchronization succeeded for ${context.class_name}.`,
      afterValue: mapPriceAdjustment(adjustment),
      actorUserId,
    })
    return {
      adjustment: mapPriceAdjustment(adjustment),
      preview: parseJson(adjustment.preview_snapshot),
      retroactiveEntries: [],
    }
  }
  if (adjustment.status !== 'sync_failed') {
    throw new Error('Only a failed price synchronization can be retried.')
  }
  if (!adjustment.billing_subscription_id) {
    throw new Error('This price change is not connected to a recurring billing subscription.')
  }

  const context = await loadEnrollmentPriceContext(pool, adjustment.signup_id, facilityId)
  adjustment = await pool.query(
    `UPDATE enrollment_price_adjustment
     SET status = 'pending_sync', stripe_sync_error = NULL
     WHERE id = $1 AND status = 'sync_failed'
     RETURNING *`,
    [adjustment.id],
  ).then((result) => result.rows[0])
  if (!adjustment) throw new Error('The price change is already being retried.')

  const synced = await syncEnrollmentStripePriceSchedule(pool, adjustment.billing_subscription_id)
  if (synced.status !== 'synced') {
    const reason = String(synced.reason ?? 'Stripe price schedule was not synchronized.').slice(0, 1000)
    adjustment = await failAdjustmentSyncAtomically(pool, {
      adjustment,
      context,
      actorUserId,
      reason,
      eventType: 'enrollment_price_sync_retry_failed',
      summary: `Stripe synchronization was retried for ${context.class_name}, but it still failed.`,
    })
    return {
      adjustment: mapPriceAdjustment(adjustment),
      preview: parseJson(adjustment.preview_snapshot),
      retroactiveEntries: [],
    }
  }

  const preview = parseJson(adjustment.preview_snapshot)
  try {
    const activated = await activateAdjustmentAtomically(pool, {
      adjustment,
      context,
      preview,
      actorUserId,
      eventType: 'enrollment_price_sync_retry_succeeded',
      summary: `Stripe synchronization succeeded for ${context.class_name}.`,
    })
    return {
      adjustment: mapPriceAdjustment(activated.adjustment),
      preview,
      retroactiveEntries: activated.retroactiveEntries,
    }
  } catch (error) {
    const reason = `Stripe synchronized, but local activation failed: ${error?.message ?? error}`
    adjustment = await failAdjustmentSyncAtomically(pool, {
      adjustment,
      context,
      actorUserId,
      reason,
      eventType: 'enrollment_price_activation_retry_failed',
      summary: `Stripe synchronized for ${context.class_name}, but local activation still needs attention.`,
    })
    return { adjustment: mapPriceAdjustment(adjustment), preview, retroactiveEntries: [] }
  }
}

async function buildRevocationCorrections(pool, adjustment) {
  const context = await loadEnrollmentPriceContext(pool, adjustment.signup_id)
  const postedByPeriod = await loadPostedSubscriptionAmountsByPeriod(pool, {
    billingSubscriptionId: adjustment.billing_subscription_id,
    effectiveFrom: adjustment.effective_from_month,
    effectiveThrough: adjustment.effective_through_month,
  })
  const periodInputs = await loadPeriodInputs(pool, context)
  const corrections = []
  for (const periodKey of postedByPeriod.keys()) {
    const priced = await priceRecurringPeriod(pool, {
      familyId: context.family_id,
      subscriptions: periodInputs.subscriptions,
      charges: periodInputs.charges,
      periodKey,
    })
    const withoutAdjustment = await priceRecurringPeriod(pool, {
      familyId: context.family_id,
      subscriptions: periodInputs.subscriptions,
      charges: periodInputs.charges,
      periodKey,
      excludedAdjustmentIds: [adjustment.id],
    })
    const line = priced.lines.find(
      (candidate) => Number(candidate.subscriptionId) === Number(adjustment.billing_subscription_id),
    )
    if (!line) continue
    const replacement = withoutAdjustment.lines.find(
      (candidate) => Number(candidate.subscriptionId) === Number(adjustment.billing_subscription_id),
    )
    const amountCents = Number(replacement?.netCents ?? line.grossCents) - Number(line.netCents)
    if (amountCents !== 0) corrections.push({ periodKey, amountCents })
  }
  return { context, corrections }
}

export async function revokeEnrollmentPriceAdjustment(pool, {
  adjustmentId,
  facilityId = null,
  actorUserId,
  reason,
}) {
  if (actorUserId == null) throw new Error('Authenticated administrator identity is required.')
  const revokeReason = String(reason ?? '').trim()
  if (!revokeReason) throw new Error('A revocation reason is required.')
  const existing = await pool.query(
    `SELECT adjustment.*
     FROM enrollment_price_adjustment adjustment
     JOIN family_billing_account fba ON fba.id = adjustment.family_billing_account_id
     JOIN family f ON f.id = fba.family_id
     WHERE adjustment.id = $1 AND ($2::bigint IS NULL OR f.facility_id = $2)`,
    [Number(adjustmentId), facilityId],
  )
  const adjustment = existing.rows[0]
  if (!adjustment) throw new Error('Price adjustment was not found.')
  if (adjustment.status === 'revoked') throw new Error('Price adjustment is already revoked.')
  const { context, corrections } = adjustment.status === 'active'
    ? await buildRevocationCorrections(pool, adjustment)
    : { context: await loadEnrollmentPriceContext(pool, adjustment.signup_id, facilityId), corrections: [] }

  const client = await pool.connect()
  let revoked
  try {
    await client.query('BEGIN')
    revoked = await client.query(
      `UPDATE enrollment_price_adjustment
       SET status = 'revoked', revoked_by_user_id = $2, revoked_at = now(), revoke_reason = $3
       WHERE id = $1 AND status <> 'revoked' RETURNING *`,
      [adjustment.id, actorUserId, revokeReason],
    ).then((result) => result.rows[0])
    for (const correction of corrections) {
      const amount = correction.amountCents
      await client.query(
        `INSERT INTO billing_charge (
           family_billing_account_id, member_id, source_type, source_id,
           description, amount_cents, gross_amount_cents, discount_amount_cents,
           charge_type, billing_interval, subscription_id,
           service_period_start, service_period_end, price_adjustment_id,
           collection_status, created_by_user_id, metadata
         ) VALUES (
           $1, $2, 'price_adjustment_reversal', $3, $4, $5, $5, 0,
           $6, 'one_time', $7, $8::date,
           (date_trunc('month', $8::date) + interval '1 month - 1 day')::date,
           $9, 'none', $10, $11::jsonb
         )
         ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING`,
        [
          adjustment.family_billing_account_id,
          adjustment.member_id,
          `${adjustment.id}:${correction.periodKey}`,
          `${amount < 0 ? 'Credit' : 'Debit'} reversing ${context.class_name} price change (${correction.periodKey})`,
          amount,
          amount < 0 ? 'credit' : 'adjustment',
          adjustment.billing_subscription_id,
          `${correction.periodKey}-01`,
          adjustment.id,
          actorUserId,
          JSON.stringify({ revokeReason }),
        ],
      )
    }
    await recordBillingActivity(client, {
      eventKey: `price-adjustment-revoked:${adjustment.id}`,
      accountId: adjustment.family_billing_account_id,
      memberId: adjustment.member_id,
      signupId: adjustment.signup_id,
      eventType: 'enrollment_price_adjustment_revoked',
      summary: `Price change for ${context.class_name} was revoked.`,
      beforeValue: mapPriceAdjustment(adjustment),
      afterValue: mapPriceAdjustment(revoked),
      details: { revokeReason, corrections },
      actorUserId,
    })
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  if (context.stripe_subscription_id) {
    const synced = await syncEnrollmentStripePriceSchedule(pool, context.billing_subscription_id)
    if (synced.status === 'error') {
      await pool.query(
        `UPDATE billing_subscription SET price_sync_status = 'failed', price_sync_error = $2 WHERE id = $1`,
        [context.billing_subscription_id, String(synced.reason).slice(0, 1000)],
      )
    }
  }
  return { adjustment: mapPriceAdjustment(revoked), corrections }
}
