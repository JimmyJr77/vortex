import { recordBillingActivity } from './billingActivity.js'
import { resolveFamilyEnrollmentPricing } from './familyEnrollmentPricing.js'
import { loadCalendarRowsForSlotGroups } from '../scheduling/freePassEngine.js'
import { pauseCreditForLine, syncFamilyEnrollmentDiscounts } from '../scheduling/pauseEnrollmentBilling.js'
import { monthBounds, firstOfNextMonth, todayDateOnly } from '../scheduling/firstMonthProration.js'
import { cancelStripeSubscriptionNow, scheduleStripeSubscriptionEnd } from './stripeSubscriptionSync.js'

function dateOnly(value) {
  const match = String(value ?? '').match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : null
}

function dayBefore(date) {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() - 1)
  return value.toISOString().slice(0, 10)
}

export function normalizeCustomerBillingCancellationInput(input = {}, now = new Date()) {
  const mode = String(input.mode ?? '').trim()
  const reason = String(input.reason ?? '').trim()
  if (!['immediate', 'end_of_month', 'specific_date'].includes(mode)) {
    throw new Error('Choose immediate, end of month, or a specific cancellation date.')
  }
  if (!reason) throw new Error('An administrative reason is required to cancel an enrollment.')
  const today = todayDateOnly(now)
  const requested = dateOnly(input.effectiveDate)
  const effectiveDate = mode === 'immediate'
    ? today
    : mode === 'end_of_month'
      ? firstOfNextMonth(today)
      : requested
  if (!effectiveDate) throw new Error('A cancellation date is required.')
  if (effectiveDate < today) throw new Error('A cancellation date cannot be in the past.')
  return { mode, reason, effectiveDate, today }
}

async function loadContext(pool, { signupId, facilityId = null }) {
  const result = await pool.query(
    `SELECT signup.id AS signup_id, signup.member_id, signup.status AS signup_status,
            signup.cancel_effective_date, signup.enrollment_start_date,
            signup.slot_group_id, signup.time_slot_id,
            member.family_id, family.facility_id,
            form.title AS class_name,
            subscription.id AS subscription_id, subscription.family_billing_account_id,
            subscription.stripe_subscription_id, subscription.status AS subscription_status
       FROM scheduling_signup signup
       JOIN member ON member.id = signup.member_id
       JOIN family ON family.id = member.family_id
       JOIN scheduling_form form ON form.id = signup.form_id
       LEFT JOIN LATERAL (
         SELECT * FROM billing_subscription
          WHERE source_type = 'scheduling_signup'
            AND source_id = signup.id::text
            AND status <> 'cancelled'
          ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, id DESC
          LIMIT 1
       ) subscription ON TRUE
      WHERE signup.id = $1
        AND ($2::bigint IS NULL OR family.facility_id = $2)`,
    [Number(signupId), facilityId],
  )
  const context = result.rows[0]
  if (!context) throw new Error('Enrollment not found.')
  if (!context.subscription_id || !context.family_billing_account_id) {
    throw new Error('A billable recurring enrollment could not be found.')
  }
  if (context.signup_status !== 'confirmed') throw new Error('Only active recurring enrollments can be cancelled here.')
  if (context.cancel_effective_date) throw new Error('This enrollment already has a cancellation date.')
  return context
}

async function postedAmountForPeriod(pool, context, periodKey) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(amount_cents), 0)::int AS amount_cents,
            MIN(id)::bigint AS related_charge_id
       FROM billing_charge
      WHERE family_billing_account_id = $1
        AND amount_cents > 0
        AND charge_type IN ('recurring', 'one_time', 'adjustment')
        AND (
          (source_type = 'scheduling_signup' AND source_id = $2)
          OR (subscription_id = $3)
        )
        AND to_char(COALESCE(service_period_start, created_at::date), 'YYYY-MM') = $4`,
    [context.family_billing_account_id, String(context.signup_id), context.subscription_id, periodKey],
  )
  return {
    amountCents: Math.max(0, Number(result.rows[0]?.amount_cents ?? 0)),
    relatedChargeId: result.rows[0]?.related_charge_id == null ? null : Number(result.rows[0].related_charge_id),
  }
}

export async function previewCustomerBillingEnrollmentCancellation(pool, {
  signupId,
  facilityId = null,
  input = {},
  now = new Date(),
}) {
  const request = normalizeCustomerBillingCancellationInput(input, now)
  const context = await loadContext(pool, { signupId, facilityId })
  const periodKey = request.effectiveDate.slice(0, 7)
  const pricing = await resolveFamilyEnrollmentPricing(pool, {
    familyId: Number(context.family_id),
    periodKey,
  })
  const line = pricing.lines?.find((item) => Number(item.signupId) === Number(context.signup_id))
  const resolvedNetCents = Math.max(0, Math.round(Number(line?.netCents ?? 0)))
  const posted = await postedAmountForPeriod(pool, context, periodKey)
  const { monthStart, monthEnd } = monthBounds(request.effectiveDate)
  let creditCents = 0
  let remainingClasses = 0
  let creditRatio = 0
  if (request.mode !== 'end_of_month' && posted.amountCents > 0 && request.effectiveDate >= monthStart) {
    const rowsByGroup = await loadCalendarRowsForSlotGroups(pool, [Number(context.slot_group_id)])
    const calendarRows = [...rowsByGroup.values()].flat()
    const calculated = pauseCreditForLine(calendarRows, {
      slotGroupId: Number(context.slot_group_id),
      timeSlotId: context.time_slot_id == null ? null : Number(context.time_slot_id),
      pauseDate: request.effectiveDate,
      netMonthlyCents: resolvedNetCents || posted.amountCents,
    })
    remainingClasses = calculated.remainingClasses
    creditRatio = calculated.ratio
    creditCents = Math.min(posted.amountCents, calculated.creditCents)
  }
  return {
    signupId: Number(context.signup_id),
    memberId: Number(context.member_id),
    className: context.class_name,
    mode: request.mode,
    effectiveDate: request.effectiveDate,
    lastActiveDate: dayBefore(request.effectiveDate),
    currentResolvedPriceCents: resolvedNetCents,
    postedAmountCents: posted.amountCents,
    creditCents,
    remainingClasses,
    creditRatio,
    servicePeriodStart: request.effectiveDate,
    servicePeriodEnd: monthEnd,
    relatedChargeId: posted.relatedChargeId,
    reason: request.reason,
    stripeMode: context.stripe_subscription_id ? 'legacy_subscription' : 'household_monthly_or_local',
  }
}

/**
 * Cancels the enrollment without erasing its history. Posted tuition remains immutable;
 * unused sessions are represented by an idempotent linked account credit.
 */
export async function cancelCustomerBillingEnrollment(pool, {
  signupId,
  facilityId = null,
  actorUserId = null,
  input = {},
}) {
  const preview = await previewCustomerBillingEnrollmentCancellation(pool, { signupId, facilityId, input })
  const immediate = preview.mode === 'immediate' || preview.effectiveDate <= todayDateOnly()
  const client = await pool.connect()
  let stripeSubscriptionId = null
  let creditChargeId = null
  let familyId = null
  try {
    await client.query('BEGIN')
    const context = await loadContext(client, { signupId, facilityId })
    stripeSubscriptionId = context.stripe_subscription_id ?? null
    familyId = Number(context.family_id)
    if (immediate) {
      await client.query(
        `UPDATE scheduling_signup
            SET status = 'cancelled', cancel_effective_date = $2,
                cancel_requested_at = COALESCE(cancel_requested_at, now())
          WHERE id = $1`,
        [context.signup_id, preview.effectiveDate],
      )
      await client.query(
        `UPDATE billing_subscription
            SET status = 'cancelled', end_date = $2, next_bill_date = NULL, updated_at = now()
          WHERE id = $1`,
        [context.subscription_id, dayBefore(preview.effectiveDate)],
      )
    } else {
      await client.query(
        `UPDATE scheduling_signup
            SET cancel_effective_date = $2, cancel_requested_at = COALESCE(cancel_requested_at, now())
          WHERE id = $1`,
        [context.signup_id, preview.effectiveDate],
      )
      await client.query(
        `UPDATE billing_subscription
            SET end_date = $2, next_bill_date = NULL, updated_at = now()
          WHERE id = $1`,
        [context.subscription_id, dayBefore(preview.effectiveDate)],
      )
    }

    let credit = null
    if (preview.creditCents > 0) {
      const inserted = await client.query(
        `INSERT INTO billing_charge (
           family_billing_account_id, member_id, source_type, source_id,
           description, amount_cents, gross_amount_cents, discount_amount_cents,
           charge_type, billing_interval, subscription_id, related_charge_id,
           service_period_start, service_period_end, collection_status,
           created_by_user_id, metadata
         ) VALUES (
           $1, $2, 'enrollment_cancellation_credit', $3,
           $4, $5, $5, 0, 'credit', 'one_time', $6, $7,
           $8::date, $9::date, 'none', $10, $11::jsonb
         ) ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
         DO NOTHING RETURNING *`,
        [
          context.family_billing_account_id,
          context.member_id,
          `${context.signup_id}:${preview.effectiveDate}`,
          `Prorated cancellation credit — ${context.class_name} (${preview.effectiveDate.slice(0, 7)})`,
          -preview.creditCents,
          context.subscription_id,
          preview.relatedChargeId,
          preview.servicePeriodStart,
          preview.servicePeriodEnd,
          actorUserId,
          JSON.stringify({
            cancellationMode: preview.mode,
            effectiveDate: preview.effectiveDate,
            remainingClasses: preview.remainingClasses,
            creditRatio: preview.creditRatio,
            relatedChargeId: preview.relatedChargeId,
            reason: preview.reason,
          }),
        ],
      )
      credit = inserted.rows[0] ?? await client.query(
        `SELECT * FROM billing_charge WHERE source_type = 'enrollment_cancellation_credit' AND source_id = $1`,
        [`${context.signup_id}:${preview.effectiveDate}`],
      ).then((result) => result.rows[0] ?? null)
      creditChargeId = credit?.id == null ? null : Number(credit.id)
    }
    await recordBillingActivity(client, {
      eventKey: `customer-billing-enrollment-cancelled:${context.signup_id}:${preview.effectiveDate}`,
      accountId: context.family_billing_account_id,
      memberId: context.member_id,
      signupId: context.signup_id,
      chargeId: credit?.id ?? null,
      eventType: immediate ? 'enrollment_cancelled_immediately' : 'enrollment_cancellation_scheduled',
      summary: immediate
        ? 'Enrollment was cancelled immediately through Customer Billing.'
        : `Enrollment cancellation was scheduled for ${preview.effectiveDate}.`,
      beforeValue: { status: context.signup_status, cancelEffectiveDate: context.cancel_effective_date ?? null },
      afterValue: {
        status: immediate ? 'cancelled' : context.signup_status,
        cancelEffectiveDate: preview.effectiveDate,
        creditCents: preview.creditCents,
      },
      details: { preview, reason: preview.reason },
      actorUserId,
    })
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }

  // Household invoices have no per-class Stripe subscription. Legacy subscriptions
  // are changed only after local state and its immutable activity record commit.
  if (stripeSubscriptionId) {
    if (immediate) await cancelStripeSubscriptionNow(stripeSubscriptionId)
    else await scheduleStripeSubscriptionEnd(stripeSubscriptionId, preview.effectiveDate)
  }
  // The cancelled class no longer qualifies for the household tier in its next
  // effective period. Recompute the remaining enrollments' persisted snapshots;
  // their Stripe synchronization remains best-effort and never rolls back this
  // locally committed, audited cancellation.
  if (familyId) {
    void syncFamilyEnrollmentDiscounts(pool, familyId)
      .catch((error) => console.warn('[customer-billing] cancellation family pricing sync:', error?.message ?? error))
  }
  return {
    ...preview,
    immediate,
    creditChargeId,
  }
}
