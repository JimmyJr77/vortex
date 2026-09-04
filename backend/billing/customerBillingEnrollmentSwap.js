import { loadCanonicalFinancialSnapshot } from './canonicalBillingAccount.js'
import { recordBillingActivity } from './billingActivity.js'
import { allocateHouseholdPayments } from './paymentAllocation.js'
import { resolveFamilyEnrollmentPricing } from './familyEnrollmentPricing.js'
import { buildSignupOrderPreview } from '../scheduling/orderPricing.js'
import { upsertSubscriptionForSource } from '../scheduling/billingSubscriptions.js'
import { cancelStripeSubscriptionNow, scheduleStripeSubscriptionEnd } from './stripeSubscriptionSync.js'
import { loadCalendarRowsForSlotGroups } from '../scheduling/freePassEngine.js'
import { pauseCreditForLine, recordPrepaidFirstMonthCredit, syncFamilyEnrollmentDiscounts } from '../scheduling/pauseEnrollmentBilling.js'
import { monthBounds, todayDateOnly } from '../scheduling/firstMonthProration.js'
import { reconcileUpcomingProvisionalChargesForAccount } from './canonicalRecurringChargePosting.js'

function dateOnly(value) {
  const match = String(value ?? '').match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : null
}

function dayBefore(date) {
  const value = new Date(`${date}T12:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() - 1)
  return value.toISOString().slice(0, 10)
}

function json(value, fallback = {}) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function cents(value) {
  return Math.max(0, Math.round(Number(value) || 0))
}

function targetSlotKey({ targetFormId, targetSlotGroupId, targetTimeSlotId }) {
  return `${targetFormId}:${targetSlotGroupId}:${targetTimeSlotId ?? 'none'}`
}

export function normalizeCustomerBillingClassSwapInput(input = {}, now = new Date()) {
  const targetFormId = Number(input.targetFormId)
  const targetSlotGroupId = Number(input.targetSlotGroupId)
  const rawTimeSlotId = input.targetTimeSlotId == null || input.targetTimeSlotId === ''
    ? null
    : Number(input.targetTimeSlotId)
  const effectiveDate = dateOnly(input.effectiveDate) ?? todayDateOnly(now)
  const reason = String(input.reason ?? '').trim()
  const today = todayDateOnly(now)
  if (!Number.isInteger(targetFormId) || targetFormId <= 0) throw new Error('Choose the replacement class.')
  if (!Number.isInteger(targetSlotGroupId) || targetSlotGroupId <= 0) throw new Error('Choose a replacement class schedule.')
  if (rawTimeSlotId != null && (!Number.isInteger(rawTimeSlotId) || rawTimeSlotId <= 0)) {
    throw new Error('Choose a valid replacement class schedule.')
  }
  if (!effectiveDate || effectiveDate < today) throw new Error('A class move cannot take effect in the past.')
  if (!reason) throw new Error('An administrative reason is required for a class move.')
  return { targetFormId, targetSlotGroupId, targetTimeSlotId: rawTimeSlotId, effectiveDate, reason, today }
}

export function classSwapSettlement({ targetProratedCents = 0, unusedSourceCreditCents = 0 } = {}) {
  const targetChargeCents = cents(targetProratedCents)
  const sourceCreditCents = cents(unusedSourceCreditCents)
  const ledgerDeltaCents = targetChargeCents - sourceCreditCents
  return {
    targetChargeCents,
    sourceCreditCents,
    ledgerDeltaCents,
    settlementKind: ledgerDeltaCents > 0 ? 'one_time_charge' : ledgerDeltaCents < 0 ? 'account_credit' : 'no_change',
    settlementAmountCents: Math.abs(ledgerDeltaCents),
  }
}

async function loadSwapSourceContext(db, { signupId, facilityId = null, forUpdate = false }) {
  const result = await db.query(
    `SELECT signup.id AS signup_id, signup.member_id, signup.status AS signup_status,
            signup.cancel_effective_date, signup.enrollment_start_date,
            signup.slot_group_id, signup.time_slot_id, signup.first_name,
            signup.last_name, signup.email, signup.phone, signup.field_responses,
            signup.responses, signup.admin_stub, signup.pricing_option_key,
            member.family_id, family.facility_id,
            form.title AS class_name,
            subscription.id AS billing_subscription_id,
            subscription.family_billing_account_id, subscription.stripe_subscription_id,
            subscription.status AS subscription_status
       FROM scheduling_signup signup
       JOIN member ON member.id = signup.member_id
       JOIN family ON family.id = member.family_id
       JOIN scheduling_form form ON form.id = signup.form_id
       JOIN billing_subscription subscription
         ON subscription.source_type = 'scheduling_signup'
        AND subscription.source_id = signup.id::text
        AND subscription.status <> 'cancelled'
       JOIN family_billing_account account
         ON account.id = subscription.family_billing_account_id
        AND account.is_active = TRUE
      WHERE signup.id = $1
        AND ($2::bigint IS NULL OR family.facility_id = $2)
      ORDER BY CASE subscription.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, subscription.id DESC
      LIMIT 1${forUpdate ? ' FOR UPDATE OF signup, subscription' : ''}`,
    [Number(signupId), facilityId],
  )
  const context = result.rows[0]
  if (!context) throw new Error('A current recurring enrollment could not be found.')
  if (context.signup_status !== 'confirmed') throw new Error('Only current confirmed enrollments can be moved.')
  if (context.cancel_effective_date) throw new Error('This enrollment already has a scheduled cancellation or class move.')
  if (context.subscription_status !== 'active') throw new Error('Only active recurring enrollments can be moved.')
  return context
}

async function loadSwapTarget(db, request, { forUpdate = false } = {}) {
  const result = await db.query(
    `SELECT form.id AS form_id, form.title AS class_name,
            slot_group.id AS slot_group_id, slot_group.max_participants,
            slot_group.display_label AS group_display_label,
            time_slot.id AS time_slot_id, time_slot.display_label AS time_slot_display_label,
            time_slot.schedule_mode, time_slot.day_of_week, time_slot.specific_date,
            time_slot.start_time, time_slot.end_time,
            (
              SELECT COUNT(*)::int
                FROM scheduling_signup existing
               WHERE existing.slot_group_id = slot_group.id
                 AND existing.status = 'confirmed'
                 AND (existing.cancel_effective_date IS NULL OR existing.cancel_effective_date > $4::date)
                 AND COALESCE(existing.enrollment_start_date, existing.created_at::date) <= $4::date
            ) AS confirmed_count
       FROM scheduling_form form
       JOIN scheduling_slot_group slot_group
         ON slot_group.id = $2
        AND slot_group.form_id = form.id
        AND slot_group.is_active = TRUE
       JOIN scheduling_time_slot time_slot
         ON time_slot.slot_group_id = slot_group.id
        AND time_slot.is_active = TRUE
        AND ($3::bigint IS NULL OR time_slot.id = $3)
      WHERE form.id = $1
        AND form.is_active = TRUE
        AND form.deleted_at IS NULL
      ORDER BY time_slot.id
      LIMIT 1${forUpdate ? ' FOR UPDATE OF slot_group' : ''}`,
    [request.targetFormId, request.targetSlotGroupId, request.targetTimeSlotId, request.effectiveDate],
  )
  const target = result.rows[0]
  if (!target) throw new Error('The replacement class schedule is no longer available.')
  const capacity = Number(target.max_participants)
  if (Number.isFinite(capacity) && capacity > 0 && Number(target.confirmed_count) >= capacity) {
    throw new Error('The replacement class is full. Choose a schedule with an available spot before moving this athlete.')
  }
  return target
}

async function loadPostedSourceAmount(db, context, periodKey) {
  const result = await db.query(
    `SELECT COALESCE(SUM(amount_cents), 0)::int AS amount_cents,
            MIN(id)::bigint AS related_charge_id
       FROM billing_charge
      WHERE family_billing_account_id = $1
        AND amount_cents > 0
        AND charge_type IN ('recurring', 'one_time', 'adjustment')
        AND ((source_type = 'scheduling_signup' AND source_id = $2) OR subscription_id = $3)
        AND to_char(COALESCE(service_period_start, created_at::date), 'YYYY-MM') = $4`,
    [context.family_billing_account_id, String(context.signup_id), context.billing_subscription_id, periodKey],
  )
  return {
    amountCents: cents(result.rows[0]?.amount_cents),
    relatedChargeId: result.rows[0]?.related_charge_id == null ? null : Number(result.rows[0].related_charge_id),
  }
}

function priceTargetFromPreview(orderPreview, request) {
  const slotKey = targetSlotKey(request)
  const item = (orderPreview.newSignups ?? []).find((line) => line.slotKey === slotKey)
  if (!item) throw new Error('The replacement class could not be priced.')
  if (item.billingType === 'one_time') {
    throw new Error('Only recurring classes can replace a current recurring enrollment.')
  }
  const discountLine = (orderPreview.discounts?.lines ?? []).find((line) => line.key === slotKey)
  const grossCents = cents(discountLine?.baseCents ?? Math.round(Number(item.incrementalMonthly ?? 0) * 100))
  const discountCents = Math.min(
    grossCents,
    (discountLine?.applied ?? []).reduce((sum, entry) => sum + cents(entry.amountCents), 0),
  )
  const netCents = Math.max(0, grossCents - discountCents)
  const firstMonth = (orderPreview.firstMonth?.items ?? []).find((line) => line.slotKey === slotKey) ?? null
  const firstChargeCents = firstMonth
    ? cents(firstMonth.proratedCents) + cents(firstMonth.prepaidFirstMonthCents)
    : 0
  return { item, grossCents, discountCents, netCents, firstMonth, firstChargeCents }
}

/**
 * Build the same pricing projection used for a normal enrollment, but omit the
 * source signup. That makes class-tier and family-spend discounts reflect the
 * household after the move, not a temporary two-class household.
 */
export async function previewCustomerBillingEnrollmentClassSwap(db, {
  signupId,
  facilityId = null,
  input = {},
  now = new Date(),
  forUpdate = false,
}) {
  const request = normalizeCustomerBillingClassSwapInput(input, now)
  const [context, target] = await Promise.all([
    loadSwapSourceContext(db, { signupId, facilityId, forUpdate }),
    loadSwapTarget(db, request, { forUpdate }),
  ])
  if (
    Number(context.slot_group_id) === Number(target.slot_group_id) &&
    Number(context.time_slot_id ?? 0) === Number(target.time_slot_id ?? 0)
  ) {
    throw new Error('Choose a different class or schedule for this move.')
  }

  const orderPreview = await buildSignupOrderPreview(db, {
    memberId: Number(context.member_id),
    newSignups: [{
      formId: request.targetFormId,
      slotGroupId: request.targetSlotGroupId,
      timeSlotId: request.targetTimeSlotId,
      formTitle: target.class_name,
      enrollmentStartDate: request.effectiveDate,
    }],
    promoCodes: [],
    memberContext: { familyId: Number(context.family_id) },
    excludeSignupIds: [Number(context.signup_id)],
  })
  const replacement = priceTargetFromPreview(orderPreview, request)
  const periodKey = request.effectiveDate.slice(0, 7)
  const [sourcePricing, posted, calendarRowsByGroup, financialSnapshot] = await Promise.all([
    resolveFamilyEnrollmentPricing(db, {
      familyId: Number(context.family_id),
      periodKey,
      ensureSchema: false,
    }),
    loadPostedSourceAmount(db, context, periodKey),
    loadCalendarRowsForSlotGroups(db, [Number(context.slot_group_id)]),
    loadCanonicalFinancialSnapshot(db, { accountId: Number(context.family_billing_account_id) }),
  ])
  const sourceLine = (sourcePricing.lines ?? []).find((line) => Number(line.signupId) === Number(context.signup_id))
  const sourceMonthlyCents = cents(sourceLine?.netCents)
  const sourceRows = [...calendarRowsByGroup.values()].flat()
  const sourceCredit = posted.amountCents > 0
    ? pauseCreditForLine(sourceRows, {
        slotGroupId: Number(context.slot_group_id),
        timeSlotId: context.time_slot_id == null ? null : Number(context.time_slot_id),
        pauseDate: request.effectiveDate,
        netMonthlyCents: sourceMonthlyCents || posted.amountCents,
      })
    : { creditCents: 0, ratio: 0, remainingClasses: 0 }
  const unusedSourceCreditCents = Math.min(posted.amountCents, cents(sourceCredit.creditCents))
  const settlement = classSwapSettlement({
    targetProratedCents: replacement.firstChargeCents,
    unusedSourceCreditCents,
  })

  return {
    sourceSignupId: Number(context.signup_id),
    sourceClassName: context.class_name,
    replacementClassName: target.class_name,
    replacementSchedule: target.time_slot_display_label ?? target.group_display_label ?? null,
    effectiveDate: request.effectiveDate,
    reason: request.reason,
    sourceMonthlyCents,
    replacementMonthlyCents: replacement.netCents,
    replacementStandardMonthlyCents: replacement.grossCents,
    replacementDiscountCents: replacement.discountCents,
    sourcePostedAmountCents: posted.amountCents,
    sourceRelatedChargeId: posted.relatedChargeId,
    sourceRemainingClasses: Number(sourceCredit.remainingClasses ?? 0),
    sourceCreditRatio: Number(sourceCredit.ratio ?? 0),
    unusedSourceCreditCents,
    replacementFirstMonthCents: replacement.firstChargeCents,
    replacementFirstMonthRatio: Number(replacement.firstMonth?.ratio ?? 0),
    replacementRemainingClasses: replacement.firstMonth?.remainingClasses ?? null,
    replacementFirstServicePeriodStart: replacement.firstMonth?.firstServicePeriodStart ?? request.effectiveDate,
    replacementFirstServicePeriodEnd: replacement.firstMonth?.firstServicePeriodEnd ?? monthBounds(request.effectiveDate).monthEnd,
    replacementPrepaidFirstMonthCents: cents(replacement.firstMonth?.prepaidFirstMonthCents),
    replacementFirstBillDate: replacement.firstMonth?.firstBillDate ?? null,
    currentBalanceCents: financialSnapshot.balanceCents,
    resultingBalanceCents: financialSnapshot.balanceCents + settlement.ledgerDeltaCents,
    ...settlement,
  }
}

function replayedSwap(activity) {
  const after = json(activity?.after_value, {})
  const details = json(activity?.details, {})
  return {
    replayed: true,
    sourceSignupId: Number(after.sourceSignupId ?? details.sourceSignupId),
    replacementSignupId: Number(after.replacementSignupId ?? details.replacementSignupId),
    settlementKind: after.settlementKind ?? details.settlementKind ?? 'no_change',
    settlementAmountCents: cents(after.settlementAmountCents ?? details.settlementAmountCents),
    ledgerDeltaCents: Number(after.ledgerDeltaCents ?? details.ledgerDeltaCents ?? 0),
    sourceCreditChargeId: after.sourceCreditChargeId ?? details.sourceCreditChargeId ?? null,
    replacementChargeId: after.replacementChargeId ?? details.replacementChargeId ?? null,
  }
}

/**
 * Atomically replace one confirmed recurring enrollment with another. The
 * original signup remains in history, the replacement gets its own signup and
 * subscription, and the current-period difference is represented by immutable
 * charge and credit rows instead of rewriting a paid bill.
 */
export async function moveCustomerBillingEnrollmentClass(pool, {
  signupId,
  facilityId = null,
  actorUserId = null,
  requestKey,
  input = {},
}) {
  if (actorUserId == null) throw new Error('Authenticated administrator identity is required.')
  if (!requestKey) throw new Error('An Idempotency-Key header is required.')
  const client = await pool.connect()
  let preview = null
  let priorStripeSubscriptionId = null
  let committed = null
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [Number(signupId)])
    const eventKey = `customer-billing-class-swap:${requestKey}`
    const existing = await client.query(
      `SELECT after_value, details FROM billing_account_activity WHERE event_key = $1 FOR UPDATE`,
      [eventKey],
    )
    if (existing.rows[0]) {
      await client.query('COMMIT')
      return replayedSwap(existing.rows[0])
    }

    preview = await previewCustomerBillingEnrollmentClassSwap(client, {
      signupId,
      facilityId,
      input,
      forUpdate: true,
    })
    const request = normalizeCustomerBillingClassSwapInput(input)
    const context = await loadSwapSourceContext(client, { signupId, facilityId, forUpdate: true })
    const target = await loadSwapTarget(client, request, { forUpdate: true })
    priorStripeSubscriptionId = context.stripe_subscription_id ?? null
    const effectiveImmediately = request.effectiveDate <= request.today

    const insertedSignup = await client.query(
      `INSERT INTO scheduling_signup (
         form_id, time_slot_id, slot_group_id, member_id,
         first_name, last_name, email, phone, field_responses, responses,
         status, admin_stub, pricing_option_key, enrollment_start_date
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb,
         'confirmed', $11, NULL, $12::date
       ) RETURNING *`,
      [
        target.form_id,
        target.time_slot_id,
        target.slot_group_id,
        context.member_id,
        context.first_name,
        context.last_name,
        context.email,
        context.phone,
        JSON.stringify(json(context.field_responses)),
        JSON.stringify(json(context.responses)),
        Boolean(context.admin_stub),
        request.effectiveDate,
      ],
    ).then((result) => result.rows[0])
    if (!insertedSignup) throw new Error('The replacement enrollment could not be created.')

    await client.query(
      `UPDATE scheduling_signup
          SET status = CASE WHEN $2::boolean THEN 'cancelled' ELSE status END,
              cancel_effective_date = $3::date,
              cancel_requested_at = COALESCE(cancel_requested_at, now())
        WHERE id = $1 AND status = 'confirmed'`,
      [context.signup_id, effectiveImmediately, request.effectiveDate],
    )
    await client.query(
      `UPDATE billing_subscription
          SET status = 'cancelled', end_date = $2::date, next_bill_date = NULL, updated_at = now()
        WHERE id = $1 AND status = 'active'`,
      [context.billing_subscription_id, dayBefore(request.effectiveDate)],
    )

    const replacementSubscription = await upsertSubscriptionForSource(client, {
      familyBillingAccountId: Number(context.family_billing_account_id),
      memberId: Number(context.member_id),
      sourceType: 'scheduling_signup',
      sourceId: insertedSignup.id,
      description: [target.class_name, target.time_slot_display_label ?? target.group_display_label].filter(Boolean).join(' — '),
      monthlyAmountCents: preview.replacementStandardMonthlyCents,
      discountAmountCents: preview.replacementDiscountCents,
      fromDate: new Date(`${request.effectiveDate}T12:00:00.000Z`),
      firstBillDate: preview.replacementPrepaidFirstMonthCents > 0 ? preview.replacementFirstBillDate : null,
    })
    if (!replacementSubscription) throw new Error('The replacement billing subscription could not be created.')

    let replacementChargeId = null
    if (preview.replacementFirstMonthCents > 0) {
      const ratio = Math.max(0, Math.min(1, Number(preview.replacementFirstMonthRatio) || 0))
      const chargeGrossCents = ratio > 0
        ? Math.round(preview.replacementStandardMonthlyCents * ratio)
        : preview.replacementFirstMonthCents
      const insertedCharge = await client.query(
        `INSERT INTO billing_charge (
           family_billing_account_id, member_id, source_type, source_id, description,
           amount_cents, gross_amount_cents, discount_amount_cents,
           charge_type, billing_interval, subscription_id,
           service_period_start, service_period_end, collection_status,
           created_by_user_id, metadata
         ) VALUES (
           $1, $2, 'scheduling_signup', $3, $4,
           $5, $6, $7, 'recurring', 'month', $8,
           $9::date, $10::date, 'none', $11, $12::jsonb
         ) ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
         DO NOTHING RETURNING id`,
        [
          context.family_billing_account_id,
          context.member_id,
          String(insertedSignup.id),
          `Class move — ${target.class_name}`,
          preview.replacementFirstMonthCents,
          chargeGrossCents,
          Math.max(0, chargeGrossCents - preview.replacementFirstMonthCents),
          replacementSubscription.id,
          preview.replacementFirstServicePeriodStart,
          preview.replacementFirstServicePeriodEnd,
          actorUserId,
          JSON.stringify({
            classMoveFromSignupId: Number(context.signup_id),
            effectiveDate: request.effectiveDate,
            replacementMonthlyCents: preview.replacementMonthlyCents,
            replacementFirstMonthRatio: preview.replacementFirstMonthRatio,
            reason: request.reason,
          }),
        ],
      )
      replacementChargeId = insertedCharge.rows[0]?.id == null ? null : Number(insertedCharge.rows[0].id)
    }

    if (preview.replacementPrepaidFirstMonthCents > 0) {
      await recordPrepaidFirstMonthCredit(client, {
        signupId: Number(insertedSignup.id),
        memberId: Number(context.member_id),
        familyBillingAccountId: Number(context.family_billing_account_id),
        firstMonthItem: {
          prepaidFirstMonthCents: preview.replacementPrepaidFirstMonthCents,
          firstServicePeriodStart: preview.replacementFirstServicePeriodStart,
          firstBillDate: preview.replacementFirstBillDate,
        },
        signupDate: request.effectiveDate,
      })
    }

    let sourceCreditChargeId = null
    if (preview.unusedSourceCreditCents > 0) {
      const credit = await client.query(
        `INSERT INTO billing_charge (
           family_billing_account_id, member_id, source_type, source_id, description,
           amount_cents, gross_amount_cents, discount_amount_cents,
           charge_type, billing_interval, subscription_id, related_charge_id,
           service_period_start, service_period_end, collection_status,
           created_by_user_id, metadata
         ) VALUES (
           $1, $2, 'enrollment_class_swap_credit', $3, $4,
           $5, $5, 0, 'credit', 'one_time', $6, $7,
           $8::date, $9::date, 'none', $10, $11::jsonb
         ) ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
         DO NOTHING RETURNING id`,
        [
          context.family_billing_account_id,
          context.member_id,
          `${context.signup_id}:${insertedSignup.id}:${request.effectiveDate}`,
          `Prorated class move credit — ${context.class_name} (${request.effectiveDate.slice(0, 7)})`,
          -preview.unusedSourceCreditCents,
          context.billing_subscription_id,
          preview.sourceRelatedChargeId,
          request.effectiveDate,
          monthBounds(request.effectiveDate).monthEnd,
          actorUserId,
          JSON.stringify({
            replacementSignupId: Number(insertedSignup.id),
            effectiveDate: request.effectiveDate,
            sourceRemainingClasses: preview.sourceRemainingClasses,
            sourceCreditRatio: preview.sourceCreditRatio,
            reason: request.reason,
          }),
        ],
      )
      sourceCreditChargeId = credit.rows[0]?.id == null ? null : Number(credit.rows[0].id)
    }

    committed = {
      accountId: Number(context.family_billing_account_id),
      familyId: Number(context.family_id),
      sourceSignupId: Number(context.signup_id),
      replacementSignupId: Number(insertedSignup.id),
      settlementKind: preview.settlementKind,
      settlementAmountCents: preview.settlementAmountCents,
      ledgerDeltaCents: preview.ledgerDeltaCents,
      sourceCreditChargeId,
      replacementChargeId,
    }
    await recordBillingActivity(client, {
      eventKey: `customer-billing-class-swap:${requestKey}`,
      accountId: Number(context.family_billing_account_id),
      memberId: Number(context.member_id),
      signupId: Number(context.signup_id),
      chargeId: sourceCreditChargeId ?? replacementChargeId,
      eventType: 'enrollment_class_swapped',
      summary: `${context.class_name} was replaced with ${target.class_name}.`,
      beforeValue: {
        sourceSignupId: Number(context.signup_id),
        className: context.class_name,
        subscriptionId: Number(context.billing_subscription_id),
      },
      afterValue: committed,
      details: { ...preview, targetFormId: Number(target.form_id), targetSlotGroupId: Number(target.slot_group_id), targetTimeSlotId: Number(target.time_slot_id) },
      actorUserId,
    })
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }

  // Legacy Stripe subscriptions are retired only after the ledger and class
  // move are committed. New classes use the household billing ledger; this
  // avoids a second automatic card charge during a move.
  if (priorStripeSubscriptionId) {
    try {
      if (preview.effectiveDate <= todayDateOnly()) await cancelStripeSubscriptionNow(priorStripeSubscriptionId)
      else await scheduleStripeSubscriptionEnd(priorStripeSubscriptionId, preview.effectiveDate)
    } catch (error) {
      console.warn('[customer-billing] class swap Stripe retirement:', error?.message ?? error)
    }
  }
  await allocateHouseholdPayments(pool, {
    accountId: committed.accountId,
    actorType: 'system',
  }).catch((error) => console.warn('[customer-billing] class swap allocation:', error?.message ?? error))
  // The old source is no longer active, so recalculate every remaining family
  // enrollment's automatic household discount before the next bill.
  try {
    await syncFamilyEnrollmentDiscounts(pool, committed.familyId)
  } catch (error) {
    console.warn('[customer-billing] class swap family pricing sync:', error?.message ?? error)
  }
  await reconcileUpcomingProvisionalChargesForAccount(pool, {
    accountId: committed.accountId,
  }).catch((error) => console.warn('[customer-billing] upcoming bill reconciliation after class swap:', error?.message ?? error))

  const balance = await loadCanonicalFinancialSnapshot(pool, { accountId: committed.accountId }).catch(() => null)
  return {
    ...committed,
    replayed: false,
    preview,
    resultingBalanceCents: balance?.balanceCents ?? preview.resultingBalanceCents,
  }
}
