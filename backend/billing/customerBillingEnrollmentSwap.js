import { loadEnrollmentDiscountTransfer, persistEnrollmentDiscountTransfer } from './enrollmentDiscountTransfer.js'
import { billingDateKey, addBillingMonths, effectiveEnrollmentPriceAdjustments } from './customerBillingPricing.js'
import { persistedDiscountFromAdjustment,runtimeDiscountRuleFromAdjustment } from './recurringPeriodPricing.js'
import { billRegistrationMembership } from '../scheduling/registrationMembership.js'
import { loadCanonicalFinancialSnapshot } from './canonicalBillingAccount.js'
import { bindEqualValueClassTransferCheckout } from './classTransferCheckoutBinding.js'
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
import { buildSlotDisplayLabel } from '../scheduling/slotDisplayLabel.js'
import { classSwapCapacityDeltas } from '../scheduling/classSwapsRoster.js'
import { assertEnrollmentDateAvailable } from '../scheduling/enrollmentDateAvailability.js'
import { enrollmentStatusOnDateSql } from '../scheduling/enrollmentStatusOnDate.js'
import { completeClassSwapNotification, previewClassSwapNotification, publicClassSwapNotification,
  queueClassSwapNotification, validateClassSwapEmailBody, wakeClassSwapNotifier } from '../scheduling/classSwapNotifications.js'

function dateOnly(value) {
  return billingDateKey(value)
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

// Legacy standalone class-swap credits store their correction as a negative
// ledger amount. The repair needs its magnitude to determine how much of the
// settled source payment belongs on the replacement class.
export function legacyClassSwapAdjustmentCents(value) {
  return Math.max(0, Math.round(Math.abs(Number(value) || 0)))
}

function targetSlotKey({ targetFormId, targetSlotGroupId, targetTimeSlotId }) {
  return `${targetFormId}:${targetSlotGroupId}:${targetTimeSlotId ?? 'none'}`
}

// A package's fixed-dollar discount is one budget, even when its replacement
// times belong to different classes. Preserve percentages and discount windows.
export function allocateClassSwapDiscountTransfer(transfer,index,count,effectiveDate) {
  if(count===1)return transfer
  const transfers=transfer.transfers.map(prior=>{
    const rule=runtimeDiscountRuleFromAdjustment(prior)
    if(!rule)return prior
    const amount=Number(rule.amountValue)||0
    const share=value=>Math.floor(value/count)+(index<value%count?1:0)
    const amountValue=rule.amountType==='fixed'&&rule.config?.discountKind!=='free_access'?share(amount):amount
    const snapshot={...json(prior.discount_rule_snapshot),...rule,id:-(Math.abs(Number(rule.id))*100+index+1),amountValue,
      ...(rule.maxDiscountCents==null?{}:{maxDiscountCents:share(Number(rule.maxDiscountCents))})}
    return {...prior,discount_rule_id:snapshot.id,discount_rule_snapshot:snapshot}
  })
  const current=effectiveEnrollmentPriceAdjustments(transfers,effectiveDate)
  return {transfers,assignments:current.map(persistedDiscountFromAdjustment).filter(Boolean),rules:current.map(runtimeDiscountRuleFromAdjustment).filter(Boolean)}
}

export function normalizeCustomerBillingClassSwapInput(input = {}, now = new Date()) {
  const selections = input.targetSelections == null ? [input] : input.targetSelections
  if (!Array.isArray(selections) || selections.length < 1 || selections.length > 32) throw new Error('Choose between one and 32 replacement class times.')
  const targets = selections.map(selection => ({
    targetFormId: selection.formId ?? selection.targetFormId,
    targetSlotGroupId: selection.slotGroupId ?? selection.targetSlotGroupId,
    targetTimeSlotId: selection.timeSlotId ?? selection.targetTimeSlotId,
  }))
  const targetFormId = Number(targets[0].targetFormId)
  const targetSlotGroupId = Number(targets[0].targetSlotGroupId)
  const rawTimeSlotId = targets[0].targetTimeSlotId == null || targets[0].targetTimeSlotId === ''
    ? null
    : Number(targets[0].targetTimeSlotId)
  const effectiveDate = input.effectiveDate == null || input.effectiveDate === '' ? todayDateOnly(now) : dateOnly(input.effectiveDate)
  const reason = String(input.reason ?? '').trim()
  const emailBody = validateClassSwapEmailBody(input.emailBody)
  const today = todayDateOnly(now)
  if (!Number.isInteger(targetFormId) || targetFormId <= 0) throw new Error('Choose the replacement class.')
  if (!Number.isInteger(targetSlotGroupId) || targetSlotGroupId <= 0) throw new Error('Choose a replacement class schedule.')
  if (rawTimeSlotId != null && (!Number.isInteger(rawTimeSlotId) || rawTimeSlotId <= 0)) {
    throw new Error('Choose a valid replacement class schedule.')
  }
  if (!effectiveDate) throw new Error('Choose an effective date for the class move.')
  if (!reason) throw new Error('An administrative reason is required for a class move.')
  const targetSelections = targets.map(target => {
    const formId = Number(target.targetFormId), groupId = Number(target.targetSlotGroupId)
    const slotId = target.targetTimeSlotId == null || target.targetTimeSlotId === '' ? null : Number(target.targetTimeSlotId)
    if (!Number.isSafeInteger(formId) || formId <= 0 || !Number.isSafeInteger(groupId) || groupId <= 0
      || (slotId != null && (!Number.isSafeInteger(slotId) || slotId <= 0))) throw new Error('Choose valid replacement class schedules.')
    return { targetFormId: formId, targetSlotGroupId: groupId, targetTimeSlotId: slotId }
  })
  if (new Set(targetSelections.map(targetSlotKey)).size !== targetSelections.length) throw new Error('Choose each replacement class time only once.')
  return { targetFormId, targetSlotGroupId, targetTimeSlotId: rawTimeSlotId, targetSelections, effectiveDate, reason, today,
    ...(emailBody === undefined ? {} : { emailBody }) }
}

/**
 * Staff corrections may be backdated, but never before the enrollment they
 * replace. The move still creates a distinct replacement signup, preserving
 * the original enrollment record and its audit history.
 */
export function validateCustomerBillingClassSwapEffectiveDate(request, sourceEnrollmentStartDate) {
  const sourceStartDate = dateOnly(sourceEnrollmentStartDate)
  if (sourceStartDate && request.effectiveDate < sourceStartDate) {
    throw new Error('A class move cannot take effect before the original enrollment started.')
  }
}

export function classSwapSettlement({ targetProratedCents = 0, unusedSourceCreditCents = 0 } = {}) {
  const targetChargeCents = cents(targetProratedCents)
  const sourceCreditCents = Math.round(Number(unusedSourceCreditCents) || 0)
  const ledgerDeltaCents = targetChargeCents - sourceCreditCents
  return {
    targetChargeCents,
    sourceCreditCents,
    ledgerDeltaCents,
    settlementKind: ledgerDeltaCents > 0 ? 'one_time_charge' : ledgerDeltaCents < 0 ? 'account_credit' : 'no_change',
    settlementAmountCents: Math.abs(ledgerDeltaCents),
  }
}

/**
 * A class move changes service delivered in the active month, not the amount
 * that was paid.  Keep the regular class price as the gross amount and express
 * the unused portion as a durable, customer-facing proration annotation.
 */
export function classSwapTargetChargeValues({
  grossCents = 0,
  automaticDiscountCents = 0,
  firstPeriodCents = 0,
} = {}) {
  const grossAmountCents = cents(grossCents)
  const amountCents = cents(firstPeriodCents)
  const totalAdjustmentCents = grossAmountCents - amountCents
  const automaticCents = Math.min(
    Math.max(0, totalAdjustmentCents),
    cents(automaticDiscountCents),
  )
  const swapProrationCents = totalAdjustmentCents - automaticCents
  const discountAnnotations = []
  if (automaticCents > 0) {
    discountAnnotations.push({
      kind: 'automatic',
      label: 'Automatic discount',
      amountCents: -automaticCents,
    })
  }
  if (swapProrationCents !== 0) {
    discountAnnotations.push({
      kind: 'manual',
      label: 'Transfer adjustment',
      amountCents: -swapProrationCents,
    })
  }
  return {
    amountCents,
    grossAmountCents,
    discountAmountCents: totalAdjustmentCents,
    automaticDiscountCents: automaticCents,
    swapProrationCents,
    discountAnnotations,
  }
}

export function classSwapPaymentTransferCents({
  sourceAppliedCents = 0,
  sourceRetainedCents = 0,
  replacementChargeCents = 0,
  replacementAppliedCents = 0,
} = {}) {
  return Math.min(
    Math.max(0, cents(sourceAppliedCents) - cents(sourceRetainedCents)),
    Math.max(0, cents(replacementChargeCents) - cents(replacementAppliedCents)),
  )
}

function positiveIntegerOrNull(value) {
  const normalized = Number(value)
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null
}

export function classSwapTransferMetadata({
  direction,
  sourceSignupId,
  replacementSignupId,
  sourceChargeId = null,
  replacementChargeId = null,
  effectiveDate,
  reason,
} = {}) {
  if (!['in', 'out'].includes(direction)) throw new Error('A class transfer must be marked as incoming or outgoing.')
  return {
    direction,
    sourceSignupId: positiveIntegerOrNull(sourceSignupId),
    replacementSignupId: positiveIntegerOrNull(replacementSignupId),
    sourceChargeId: positiveIntegerOrNull(sourceChargeId),
    replacementChargeId: positiveIntegerOrNull(replacementChargeId),
    effectiveDate: dateOnly(effectiveDate),
    reason: String(reason ?? '').trim() || null,
  }
}

async function annotateClassSwapCharges(client, {
  accountId,
  sourceSignupId,
  replacementSignupId,
  sourceChargeId,
  replacementChargeId,
  effectiveDate,
  reason,
}) {
  const annotations = [
    [sourceChargeId, 'out'],
    [replacementChargeId, 'in'],
  ].filter(([chargeId]) => positiveIntegerOrNull(chargeId) != null)

  for (const [chargeId, direction] of annotations) {
    const transfer = classSwapTransferMetadata({
      direction,
      sourceSignupId,
      replacementSignupId,
      sourceChargeId,
      replacementChargeId,
      effectiveDate,
      reason,
    })
    const updated = await client.query(
      `UPDATE billing_charge
          SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('classTransfer', $3::jsonb)
        WHERE id = $1
          AND family_billing_account_id = $2
        RETURNING id`,
      [Number(chargeId), Number(accountId), JSON.stringify(transfer)],
    )
    if (!updated.rows[0]) throw new Error(`Class transfer marker could not be saved for charge #${chargeId}.`)
  }
}

export async function reallocateSettledClassSwapPayments(client, {
  accountId,
  sourceChargeId,
  replacementChargeId,
  sourceRetainedCents,
  requestKey,
}) {
  if (!sourceChargeId || !replacementChargeId) return { transferredCents: 0, applications: [] }

  const [sourceApplications, targetApplications, reversalTotals] = await Promise.all([
    client.query(
      `SELECT application.id, application.billing_payment_id, application.amount_cents,
              payment.paid_at
         FROM billing_payment_application application
         JOIN billing_payment payment ON payment.id = application.billing_payment_id
        WHERE application.billing_charge_id = $1
          AND application.application_kind = 'application'
          AND payment.family_billing_account_id = $2
          AND payment.external_status IN ('settled', 'succeeded')
        ORDER BY payment.paid_at, application.id
        FOR UPDATE OF application, payment`,
      [Number(sourceChargeId), Number(accountId)],
    ),
    client.query(
      `SELECT COALESCE(SUM(CASE WHEN application_kind = 'reversal' THEN -amount_cents ELSE amount_cents END), 0)::int AS applied_cents
         FROM billing_payment_application
        WHERE billing_charge_id = $1`,
      [Number(replacementChargeId)],
    ),
    client.query(
      `SELECT reverses_application_id, amount_cents
         FROM billing_payment_application
        WHERE application_kind = 'reversal'
          AND reverses_application_id IN (
            SELECT id
              FROM billing_payment_application
             WHERE billing_charge_id = $1
               AND application_kind = 'application'
          )
        FOR UPDATE`,
      [Number(sourceChargeId)],
    ),
  ])

  const replacementCharge = await client.query(
    `SELECT amount_cents
       FROM billing_charge
      WHERE id = $1 AND family_billing_account_id = $2
      FOR UPDATE`,
    [Number(replacementChargeId), Number(accountId)],
  ).then((result) => result.rows[0] ?? null)
  if (!replacementCharge) throw new Error('The replacement class charge could not be locked for payment reassignment.')

  const reversedByApplicationId = new Map()
  for (const reversal of reversalTotals.rows) {
    const applicationId = Number(reversal.reverses_application_id)
    reversedByApplicationId.set(
      applicationId,
      (reversedByApplicationId.get(applicationId) ?? 0) + cents(reversal.amount_cents),
    )
  }
  const sourceAppliedCents = sourceApplications.rows.reduce((sum, application) => (
    sum + Math.max(0, cents(application.amount_cents) - (reversedByApplicationId.get(Number(application.id)) ?? 0))
  ), 0)
  const targetAppliedCents = cents(targetApplications.rows[0]?.applied_cents)
  let remainingCents = classSwapPaymentTransferCents({
    sourceAppliedCents,
    sourceRetainedCents,
    replacementChargeCents: replacementCharge.amount_cents,
    replacementAppliedCents: targetAppliedCents,
  })
  const applications = []

  for (const sourceApplication of sourceApplications.rows) {
    if (remainingCents <= 0) break
    const sourceApplicationId = Number(sourceApplication.id)
    const availableCents = Math.max(
      0,
      cents(sourceApplication.amount_cents) - (reversedByApplicationId.get(sourceApplicationId) ?? 0),
    )
    const amountCents = Math.min(availableCents, remainingCents)
    if (amountCents <= 0) continue
    const reversalKey = `class-swap-reallocation:${requestKey}:reverse:${sourceApplicationId}`
    const applicationKey = `class-swap-reallocation:${requestKey}:apply:${sourceApplicationId}:${replacementChargeId}`
    const reversal = await client.query(
      `INSERT INTO billing_payment_application (
         billing_payment_id, billing_charge_id, amount_cents, application_kind,
         reverses_application_id, idempotency_key, allocation_reason
       ) VALUES ($1, $2, $3, 'reversal', $4, $5, 'class_swap_reallocation')
       ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
       RETURNING id`,
      [sourceApplication.billing_payment_id, Number(sourceChargeId), amountCents, sourceApplicationId, reversalKey],
    )
    const applied = await client.query(
      `INSERT INTO billing_payment_application (
         billing_payment_id, billing_charge_id, amount_cents, application_kind,
         idempotency_key, allocation_reason
       ) VALUES ($1, $2, $3, 'application', $4, 'class_swap_reallocation')
       ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
       RETURNING id`,
      [sourceApplication.billing_payment_id, Number(replacementChargeId), amountCents, applicationKey],
    )
    if (reversal.rows[0] || applied.rows[0]) {
      applications.push({
        paymentId: Number(sourceApplication.billing_payment_id),
        amountCents,
        reversalApplicationId: reversal.rows[0]?.id == null ? null : Number(reversal.rows[0].id),
        replacementApplicationId: applied.rows[0]?.id == null ? null : Number(applied.rows[0].id),
      })
    }
    remainingCents -= amountCents
  }

  return {
    transferredCents: applications.reduce((sum, application) => sum + application.amountCents, 0),
    applications,
  }
}

async function loadSwapSourceContext(db, { signupId, facilityId = null, forUpdate = false }) {
  const result = await db.query(
    `SELECT signup.id AS signup_id, signup.member_id, signup.status AS signup_status,
            signup.cancel_effective_date, signup.enrollment_start_date,
            signup.slot_group_id, signup.time_slot_id, signup.first_name,
            signup.last_name, signup.email, signup.phone, signup.field_responses,
            signup.responses, signup.admin_stub, signup.pricing_option_key,
            EXISTS(SELECT 1 FROM enrollment_action a WHERE a.signup_id=signup.id AND a.status='pending') AS has_pending_action,
            (SELECT MAX(a.effective_date)::text FROM enrollment_action a WHERE a.signup_id=signup.id AND a.status='applied') AS latest_action_date,
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
  if (context.has_pending_action) throw new Error('Cancel the scheduled enrollment action before switching classes.')
  if (context.cancel_effective_date) throw new Error('This enrollment already has a scheduled cancellation or class move.')
  if (context.subscription_status !== 'active') throw new Error('Only active recurring enrollments can be moved.')
  return context
}

async function loadSwapTarget(db, request, { forUpdate = false } = {}) {
  await assertEnrollmentDateAvailable(db, {
    formId: request.targetFormId, slotGroupId: request.targetSlotGroupId,
    timeSlotId: request.targetTimeSlotId, enrollmentStartDate: request.effectiveDate,
    facilityId: request.facilityId ?? null, lock: forUpdate,
  })
  const result = await db.query(
    `SELECT form.id AS form_id, form.title AS class_name,
            slot_group.id AS slot_group_id, slot_group.max_participants,
            time_slot.id AS time_slot_id, time_slot.week_letter,
            time_slot.schedule_mode, time_slot.day_of_week, time_slot.specific_date,
            time_slot.start_time, time_slot.end_time,
            (
              SELECT COUNT(*)::int
                FROM scheduling_signup existing
               WHERE existing.slot_group_id = slot_group.id
                 AND ${enrollmentStatusOnDateSql('existing','$4::date')} = 'confirmed'
                 AND existing.archived_at IS NULL AND existing.orphaned_at IS NULL
                 AND (existing.time_slot_id IS NULL OR existing.time_slot_id=time_slot.id)
                 AND (existing.cancel_effective_date IS NULL OR existing.cancel_effective_date > $4::date)
                 AND COALESCE(existing.enrollment_start_date, existing.created_at::date) <= $4::date
            ) AS confirmed_count,
            pending_registration_holds(slot_group.id) AS reserved_count
       FROM scheduling_form form
       JOIN program class_program ON class_program.id=form.program_id
       JOIN scheduling_slot_group slot_group
         ON slot_group.id = $2
        AND slot_group.form_id = form.id
        AND slot_group.is_active = TRUE
       JOIN scheduling_time_slot time_slot
         ON time_slot.slot_group_id = slot_group.id
        AND time_slot.is_active = TRUE
        AND ($3::bigint IS NULL OR time_slot.id = $3)
      WHERE form.id = $1
        AND ($5::bigint IS NULL OR class_program.facility_id=$5)
        AND class_program.is_active=TRUE AND class_program.archived=FALSE
        AND form.is_active = TRUE
        AND form.deleted_at IS NULL
      ORDER BY time_slot.id
      LIMIT 1${forUpdate ? ' FOR UPDATE OF slot_group' : ''}`,
    [request.targetFormId, request.targetSlotGroupId, request.targetTimeSlotId, request.effectiveDate,request.facilityId??null],
  )
  const target = result.rows[0]
  if (!target) throw new Error('The replacement class schedule is no longer available.')
  const capacity = Number(target.max_participants)
  const swapDeltas=await classSwapCapacityDeltas(db,{groupId:request.targetSlotGroupId,startDate:request.effectiveDate})
  const swapReservations=Math.max(0,...swapDeltas.values())
  if (Number.isFinite(capacity) && capacity > 0 && Number(target.confirmed_count)+Number(target.reserved_count??0)+swapReservations >= capacity) {
    throw new Error('The replacement class is full. Choose a schedule with an available spot before moving this athlete.')
  }
  return {
    ...target,
    time_slot_display_label: buildSlotDisplayLabel(target) || null,
  }
}

async function loadPostedSourceAmount(db, context, periodKey) {
  const result = await db.query(
    `SELECT COALESCE(SUM(amount_cents), 0)::int AS amount_cents,
            MIN(id)::bigint AS related_charge_id
       FROM billing_charge
      WHERE family_billing_account_id = $1
        AND charge_type IN ('recurring', 'one_time', 'adjustment', 'credit')
        AND ((source_type = 'scheduling_signup' AND source_id = $2) OR subscription_id = $3)
        AND to_char(COALESCE(service_period_start, created_at::date), 'YYYY-MM') = $4`,
    [context.family_billing_account_id, String(context.signup_id), context.billing_subscription_id, periodKey],
  )
  return {
    amountCents: cents(result.rows[0]?.amount_cents),
    relatedChargeId: result.rows[0]?.related_charge_id == null ? null : Number(result.rows[0].related_charge_id),
  }
}

async function loadLaterSourceBills(db, context, effectiveDate, today) {
  if (effectiveDate.slice(0,7) >= today.slice(0,7)) return []
  return (await db.query(`SELECT date_trunc('month',COALESCE(c.service_period_start,c.created_at::date))::date::text AS month,
      c.amount_cents+COALESCE((SELECT SUM(a.amount_cents) FROM billing_charge a WHERE a.related_charge_id=c.id
        AND a.family_billing_account_id=c.family_billing_account_id AND a.source_type IN ('charge_adjustment','refund_offset')),0) AS amount_cents,c.id AS charge_id
    FROM billing_charge c WHERE c.family_billing_account_id=$1 AND c.subscription_id=$2
      AND NOT(c.related_charge_id IS NOT NULL AND c.source_type IN ('charge_adjustment','refund_offset'))
      AND COALESCE(c.service_period_start,c.created_at::date) >= (date_trunc('month',$3::date)+interval '1 month')::date
      AND COALESCE(c.service_period_start,c.created_at::date) < (date_trunc('month',$4::date)+interval '1 month')::date
    ORDER BY 1,c.id`,
  [context.family_billing_account_id,context.billing_subscription_id,effectiveDate,today])).rows.map(row => ({month:row.month,amountCents:Number(row.amount_cents),chargeId:Number(row.charge_id)})).filter(row=>row.amountCents!==0)
}

export function priceCustomerBillingClassSwapTargetFromOrderPreview(orderPreview, request) {
  const slotKey = targetSlotKey(request)
  const item = (orderPreview.newSignups ?? []).find((line) => line.slotKey === slotKey)
  if (!item) throw new Error('The replacement class could not be priced.')
  if (item.billingType === 'one_time') {
    throw new Error('Only recurring classes can replace a current recurring enrollment.')
  }
  const discountLine = (orderPreview.discounts?.lines ?? []).find((line) => line.key === slotKey)
  const grossCents = cents(discountLine?.baseCents ?? Math.round(Number(item.incrementalMonthly ?? 0) * 100))
  const directDiscountCents = Math.min(
    grossCents,
    (discountLine?.applied ?? []).reduce((sum, entry) => sum + cents(entry.amountCents), 0),
  )
  const firstMonth = (orderPreview.firstMonth?.items ?? []).find((line) => line.slotKey === slotKey) ?? null
  // First-month pricing already allocates household-tier discounts to the
  // replacement line.  A direct discount line alone omits those account-wide
  // allocations, which made a one-for-one move display and persist a higher
  // monthly price than the quoted first-period amount.
  const netCents = firstMonth?.monthlyNetCents != null
    ? Math.min(grossCents, cents(firstMonth.monthlyNetCents))
    : Math.max(0, grossCents - directDiscountCents)
  const discountCents = Math.max(0, grossCents - netCents)
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
  signupId, facilityId = null, input = {}, now = new Date(), forUpdate = false,
}) {
  const request = normalizeCustomerBillingClassSwapInput(input, now)
  const context = await loadSwapSourceContext(db, { signupId, facilityId, forUpdate })
  const requiredReplacementCount = context.time_slot_id == null
    ? Number((await db.query('SELECT COUNT(*)::int AS count FROM scheduling_time_slot WHERE slot_group_id=$1 AND is_active=TRUE',[context.slot_group_id])).rows[0]?.count??0)
    : 1
  if (request.targetSelections.length!==requiredReplacementCount) throw new Error(`This enrollment has ${requiredReplacementCount} class times. Choose exactly ${requiredReplacementCount} replacement class times in Class Swaps.`)
  const selections = request.targetSelections.map(selection => ({ ...request, ...selection, facilityId }))
  const targets = []
  // Stable lock order also covers clients of the original billing workspace.
  for (const selection of [...selections].sort((a,b) => a.targetSlotGroupId-b.targetSlotGroupId || (a.targetTimeSlotId??0)-(b.targetTimeSlotId??0))) {
    const target = await loadSwapTarget(db, selection, { forUpdate })
    targets.push({ selection, target })
  }
  validateCustomerBillingClassSwapEffectiveDate(request, context.enrollment_start_date)
  if (context.latest_action_date && request.effectiveDate < context.latest_action_date) throw new Error('A class move cannot precede the last recorded enrollment action.')
  if (targets.some(({target}) => Number(context.slot_group_id) === Number(target.slot_group_id)
    && (context.time_slot_id == null || Number(context.time_slot_id) === Number(target.time_slot_id)))) {
    throw new Error('Choose different class schedules for this move.')
  }
  const discountTransfer = await loadEnrollmentDiscountTransfer(db, signupId, request.effectiveDate)
  const discountTransfers=targets.map((_,index)=>allocateClassSwapDiscountTransfer(discountTransfer,index,targets.length,request.effectiveDate))
  const newSignups = targets.map(({ selection, target }) => ({
    formId: selection.targetFormId, slotGroupId: selection.targetSlotGroupId, timeSlotId: selection.targetTimeSlotId,
    formTitle: target.class_name, enrollmentStartDate: request.effectiveDate,
  }))
  const discountAssignmentsBySlotKey = Object.fromEntries(targets.map(({selection},index) => [targetSlotKey(selection),discountTransfers[index].assignments]))
  const orderPreview = await buildSignupOrderPreview(db, {
    discountAssignmentsBySlotKey, ruleSnapshots: discountTransfers.flatMap(transfer=>transfer.rules),
    pricingDate: new Date(`${request.effectiveDate}T12:00:00Z`), memberId: Number(context.member_id),
    newSignups, promoCodes: [], memberContext: { familyId: Number(context.family_id) },
    ensureSchema:false,
    excludeSignupIds: [Number(context.signup_id)],
  })
  const replacements = targets.map(({selection,target},index) => {
    const replacement = priceCustomerBillingClassSwapTargetFromOrderPreview(orderPreview,selection)
    return {
      targetFormId: selection.targetFormId, targetSlotGroupId: selection.targetSlotGroupId, targetTimeSlotId: selection.targetTimeSlotId,
      replacementClassName: target.class_name,
      discountTargetIndex:index,
      replacementSchedule: target.time_slot_display_label ?? target.group_display_label ?? null,
      replacementMonthlyCents: replacement.netCents, replacementStandardMonthlyCents: replacement.grossCents,
      replacementDiscountCents: replacement.discountCents, replacementFirstMonthCents: replacement.firstChargeCents,
      replacementFirstMonthRatio: Number(replacement.firstMonth?.ratio ?? 0),
      replacementRemainingClasses: replacement.firstMonth?.remainingClasses ?? null,
      replacementFirstServicePeriodStart: replacement.firstMonth?.firstServicePeriodStart ?? request.effectiveDate,
      replacementFirstServicePeriodEnd: replacement.firstMonth?.firstServicePeriodEnd ?? monthBounds(request.effectiveDate).monthEnd,
      replacementPrepaidFirstMonthCents: cents(replacement.firstMonth?.prepaidFirstMonthCents),
      replacementFirstBillDate: replacement.firstMonth?.firstBillDate ?? null,
      catchupMonths: [],
    }
  })
  const periodKey = request.effectiveDate.slice(0,7)
  const [sourcePricing, posted, calendarRowsByGroup, financialSnapshot] = await Promise.all([
    resolveFamilyEnrollmentPricing(db,{familyId:Number(context.family_id),periodKey,ensureSchema:false}),
    loadPostedSourceAmount(db,context,periodKey),
    loadCalendarRowsForSlotGroups(db,[Number(context.slot_group_id)]),
    loadCanonicalFinancialSnapshot(db,{accountId:Number(context.family_billing_account_id)}),
  ])
  const sourceLine = (sourcePricing.lines??[]).find(line => Number(line.signupId)===Number(context.signup_id))
  const sourceMonthlyCents = cents(sourceLine?.netCents)
  const sourceRows = [...calendarRowsByGroup.values()].flat()
  const sourceCredit = posted.amountCents>0 ? pauseCreditForLine(sourceRows,{
    slotGroupId:Number(context.slot_group_id),timeSlotId:context.time_slot_id==null?null:Number(context.time_slot_id),
    pauseDate:request.effectiveDate,netMonthlyCents:sourceMonthlyCents||posted.amountCents,
  }) : {creditCents:0,ratio:0,remainingClasses:0}
  const unusedSourceCreditCents = Math.min(posted.amountCents,cents(sourceCredit.creditCents))
  const laterSourceBills = await loadLaterSourceBills(db,context,request.effectiveDate,request.today)
  const laterSourceCreditCents = laterSourceBills.reduce((sum,row)=>sum+row.amountCents,0)
  let catchupCount=0
  for(let month=addBillingMonths(request.effectiveDate,1);month.slice(0,7)<=request.today.slice(0,7);month=addBillingMonths(month,1)) {
    if(++catchupCount>120)throw new Error('A class move cannot require more than 120 months of billing corrections.')
    const discounts=await loadEnrollmentDiscountTransfer(db,signupId,month)
    const allocated=targets.map((_,index)=>allocateClassSwapDiscountTransfer(discounts,index,targets.length,month))
    const order=await buildSignupOrderPreview(db,{
      memberId:Number(context.member_id),memberContext:{familyId:Number(context.family_id)},excludeSignupIds:[Number(context.signup_id)],
      ensureSchema:false,
      newSignups:newSignups.map(signup=>({...signup,enrollmentStartDate:month})),
      pricingDate:new Date(`${month}T12:00:00Z`),
      discountAssignmentsBySlotKey:Object.fromEntries(targets.map(({selection},index)=>[targetSlotKey(selection),allocated[index].assignments])),ruleSnapshots:allocated.flatMap(transfer=>transfer.rules),
    })
    for(const replacement of replacements){
      const priced=priceCustomerBillingClassSwapTargetFromOrderPreview(order,replacement)
      replacement.catchupMonths.push({month,netCents:priced.netCents})
    }
  }
  const sum = key => replacements.reduce((total,row)=>total+Number(row[key]??0),0)
  const catchupMonths = replacements.flatMap(row=>row.catchupMonths)
  const replacementCatchupCents=catchupMonths.reduce((total,row)=>total+row.netCents,0)
  const settlement=classSwapSettlement({targetProratedCents:sum('replacementFirstMonthCents')+replacementCatchupCents,
    unusedSourceCreditCents:unusedSourceCreditCents+laterSourceCreditCents})
  const notificationEmail=publicClassSwapNotification(await previewClassSwapNotification(db,{
    ...request,facilityId:Number(context.facility_id),mode:'permanent',source:'scheduling',signupId,billingAccountId:Number(context.family_billing_account_id),
  }))
  return {
    notificationEmail,
    ...replacements[0], replacements,
    sourceSignupId:Number(context.signup_id),sourceClassName:context.class_name,
    replacementClassName:replacements.map(row=>row.replacementClassName).join(' + '),
    effectiveDate:request.effectiveDate,reason:request.reason,sourceMonthlyCents,
    replacementMonthlyCents:sum('replacementMonthlyCents'),replacementStandardMonthlyCents:sum('replacementStandardMonthlyCents'),
    replacementDiscountCents:sum('replacementDiscountCents'),replacementFirstMonthCents:sum('replacementFirstMonthCents'),
    replacementRemainingClasses:sum('replacementRemainingClasses'),replacementPrepaidFirstMonthCents:sum('replacementPrepaidFirstMonthCents'),
    sourcePostedAmountCents:posted.amountCents,sourceRelatedChargeId:posted.relatedChargeId,
    sourceRemainingClasses:Number(sourceCredit.remainingClasses??0),sourceCreditRatio:Number(sourceCredit.ratio??0),
    unusedSourceCreditCents,laterSourceBills,laterSourceCreditCents,catchupMonths,replacementCatchupCents,
    sourceFirstPeriodCents:Math.max(0,posted.amountCents-unusedSourceCreditCents),
    currentBalanceCents:financialSnapshot.balanceCents,resultingBalanceCents:financialSnapshot.balanceCents+settlement.ledgerDeltaCents,
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
    replacementSignupIds: after.replacementSignupIds ?? [Number(after.replacementSignupId ?? details.replacementSignupId)],
    settlementKind: after.settlementKind ?? details.settlementKind ?? 'no_change',
    settlementAmountCents: cents(after.settlementAmountCents ?? details.settlementAmountCents),
    ledgerDeltaCents: Number(after.ledgerDeltaCents ?? details.ledgerDeltaCents ?? 0),
    sourceAdjustmentChargeId: after.sourceAdjustmentChargeId ?? details.sourceAdjustmentChargeId ?? null,
    sourceCreditChargeId: after.sourceCreditChargeId ?? details.sourceCreditChargeId ?? null,
    replacementChargeId: after.replacementChargeId ?? details.replacementChargeId ?? null,
    reallocatedPaymentCents: cents(after.reallocatedPaymentCents ?? details.reallocatedPaymentCents),
  }
}

/**
 * Atomically replace one confirmed recurring enrollment with another. The
 * original signup remains in history, the replacement gets its own signup and
 * subscription, and the current-period difference is represented by a linked
 * internal adjustment. Customer-facing history remains one clear bill line per
 * class rather than introducing a separate class-swap credit.
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
  const request = normalizeCustomerBillingClassSwapInput(input)
  const client = await pool.connect()
  let preview = null
  let priorStripeSubscriptionId = null
  let committed = null
  try {
    await client.query('BEGIN')
    const lockedAccount = (await client.query(`SELECT a.id FROM scheduling_signup s JOIN member m ON m.id=s.member_id
      JOIN family_billing_account a ON a.family_id=m.family_id AND a.is_active=TRUE WHERE s.id=$1`,[signupId])).rows[0]
    if (lockedAccount) await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [`household-monthly-invoice:${lockedAccount.id}`])
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [Number(signupId)])
    const eventKey = `customer-billing-class-swap:${requestKey}`
    const existing = await client.query(
      `SELECT activity.after_value,activity.details FROM billing_account_activity activity
        JOIN family_billing_account account ON account.id=activity.family_billing_account_id JOIN family ON family.id=account.family_id
        WHERE activity.event_key=$1 AND ($2::bigint IS NULL OR family.facility_id=$2) FOR UPDATE OF activity`,
      [eventKey,facilityId],
    )
    if (existing.rows[0]) {
      const details=json(existing.rows[0].details)
      const priorTargets=details.targetSelections??[{targetFormId:details.targetFormId,targetSlotGroupId:details.targetSlotGroupId,targetTimeSlotId:details.targetTimeSlotId}]
      const keys=targets=>targets.map(targetSlotKey).sort().join('|')
      if(Number(details.sourceSignupId)!==Number(signupId)||details.effectiveDate!==request.effectiveDate||keys(priorTargets)!==keys(request.targetSelections))throw new Error('This request key belongs to a different class move.')
      await client.query('COMMIT')
      const notification=await completeClassSwapNotification(client,{facilityId,eventKey:`permanent:${requestKey}`})
      wakeClassSwapNotifier(pool)
      return {...replayedSwap(existing.rows[0]),...notification}
    }

    preview = await previewCustomerBillingEnrollmentClassSwap(client, {
      signupId,
      facilityId,
      input,
      forUpdate: true,
    })
    const context = await loadSwapSourceContext(client, { signupId, facilityId, forUpdate: true })
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [Number(context.family_billing_account_id)])
    validateCustomerBillingClassSwapEffectiveDate(request, context.enrollment_start_date)
    const target = await loadSwapTarget(client, {...request,facilityId}, { forUpdate: true })
    priorStripeSubscriptionId = context.stripe_subscription_id ?? null
    const effectiveImmediately = request.effectiveDate <= request.today

    if (preview.replacementFirstMonthCents > 0) {
      await billRegistrationMembership(client, Number(context.member_id))
    }

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
          SET status = CASE WHEN $3::boolean THEN 'cancelled' ELSE status END, end_date = $2::date,
              next_bill_date = CASE WHEN $3::boolean THEN NULL ELSE next_bill_date END, updated_at = now()
        WHERE id = $1 AND status = 'active'`,
      [context.billing_subscription_id, dayBefore(request.effectiveDate), effectiveImmediately],
    )

    const replacementRecords = []
    for (const replacement of preview.replacements) {
      const target = await loadSwapTarget(client,{...request,...replacement,facilityId},{forUpdate:true})
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


      const replacementSubscription = await upsertSubscriptionForSource(client, {
        familyBillingAccountId: Number(context.family_billing_account_id),
        memberId: Number(context.member_id),
        sourceType: 'scheduling_signup',
        sourceId: insertedSignup.id,
        description: [target.class_name, target.time_slot_display_label ?? target.group_display_label].filter(Boolean).join(' — '),
        monthlyAmountCents: replacement.replacementStandardMonthlyCents,
        discountAmountCents: replacement.replacementDiscountCents,
        fromDate: new Date(`${request.effectiveDate}T12:00:00.000Z`),
        firstBillDate: replacement.replacementPrepaidFirstMonthCents > 0 ? replacement.replacementFirstBillDate : null,
      })
      if (!replacementSubscription) throw new Error('The replacement billing subscription could not be created.')
      const discountTransfer = allocateClassSwapDiscountTransfer(await loadEnrollmentDiscountTransfer(client, signupId, request.effectiveDate),replacement.discountTargetIndex,preview.replacements.length,request.effectiveDate)
      await persistEnrollmentDiscountTransfer(client, { transfers: discountTransfer.transfers,
        signupId: insertedSignup.id, subscriptionId: replacementSubscription.id, accountId: context.family_billing_account_id,
        memberId: context.member_id, effectiveMonth: request.effectiveDate, actorUserId })


      let replacementChargeId = null
      if (replacement.replacementFirstMonthCents > 0) {
        const chargeValues = classSwapTargetChargeValues({
          grossCents: replacement.replacementStandardMonthlyCents,
          automaticDiscountCents: replacement.replacementDiscountCents,
          firstPeriodCents: replacement.replacementFirstMonthCents,
        })
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
            chargeValues.amountCents,
            chargeValues.grossAmountCents,
            chargeValues.discountAmountCents,
            replacementSubscription.id,
            replacement.replacementFirstServicePeriodStart,
            replacement.replacementFirstServicePeriodEnd,
            actorUserId,
            JSON.stringify({
              classMoveFromSignupId: Number(context.signup_id),
              effectiveDate: request.effectiveDate,
              replacementMonthlyCents: replacement.replacementMonthlyCents,
              replacementFirstMonthRatio: replacement.replacementFirstMonthRatio,
              discountAnnotations: chargeValues.discountAnnotations,
              reason: request.reason,
            }),
          ],
        )
        replacementChargeId = insertedCharge.rows[0]?.id == null ? null : Number(insertedCharge.rows[0].id)
      }

      if (replacement.replacementPrepaidFirstMonthCents > 0) {
        await recordPrepaidFirstMonthCredit(client, {
          signupId: Number(insertedSignup.id),
          memberId: Number(context.member_id),
          familyBillingAccountId: Number(context.family_billing_account_id),
          firstMonthItem: {
            prepaidFirstMonthCents: replacement.replacementPrepaidFirstMonthCents,
            firstServicePeriodStart: replacement.replacementFirstServicePeriodStart,
            firstBillDate: replacement.replacementFirstBillDate,
          },
          signupDate: request.effectiveDate,
        })
      }

      replacementRecords.push({ insertedSignup,replacementSubscription,replacementChargeId,target,preview:replacement })
    }
    const {insertedSignup,replacementChargeId} = replacementRecords[0]

    let sourceAdjustmentChargeId = null
    if (preview.unusedSourceCreditCents > 0) {
      const adjustment = await client.query(
        `INSERT INTO billing_charge (
           family_billing_account_id, member_id, source_type, source_id, description,
           amount_cents, gross_amount_cents, discount_amount_cents,
           charge_type, billing_interval, subscription_id, related_charge_id,
           service_period_start, service_period_end, collection_status,
           created_by_user_id, metadata
         ) VALUES (
           $1, $2, 'charge_adjustment', $3, $4,
           $5, 0, 0, 'adjustment', 'one_time', $6, $7,
           $8::date, $9::date, 'none', $10, $11::jsonb
         ) ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
         DO NOTHING RETURNING id`,
        [
          context.family_billing_account_id,
          context.member_id,
          `${context.signup_id}:${insertedSignup.id}:${request.effectiveDate}`,
          `Transfer adjustment — ${context.class_name} (${request.effectiveDate.slice(0, 7)})`,
          -preview.unusedSourceCreditCents,
          context.billing_subscription_id,
          preview.sourceRelatedChargeId,
          request.effectiveDate,
          monthBounds(request.effectiveDate).monthEnd,
          actorUserId,
          JSON.stringify({
            replacementSignupId: Number(insertedSignup.id),
            effectiveDate: request.effectiveDate,
            adjustmentKind: 'class_swap_proration',
            adjustmentLabel: 'Transfer adjustment',
            customerAuditVisibility: 'suppressed',
            sourceRemainingClasses: preview.sourceRemainingClasses,
            sourceCreditRatio: preview.sourceCreditRatio,
            reason: request.reason,
          }),
        ],
      )
      sourceAdjustmentChargeId = adjustment.rows[0]?.id == null ? null : Number(adjustment.rows[0].id)
    }

    for (const prior of preview.laterSourceBills ?? []) {
      await client.query(`INSERT INTO billing_charge
        (family_billing_account_id,member_id,subscription_id,related_charge_id,source_type,source_id,description,
         amount_cents,gross_amount_cents,discount_amount_cents,charge_type,billing_interval,service_period_start,service_period_end,collection_status,created_by_user_id)
        VALUES($1,$2,$3,$4,'charge_adjustment',$5,$6,$7,0,0,'adjustment','one_time',$8::date,($8::date+interval '1 month - 1 day')::date,'none',$9)
        ON CONFLICT(source_type,source_id) WHERE source_id IS NOT NULL DO NOTHING`,
      [context.family_billing_account_id,context.member_id,context.billing_subscription_id,prior.chargeId,
        `class-swap:${context.signup_id}:${insertedSignup.id}:${prior.chargeId}:${prior.month}`,`Transfer adjustment — ${context.class_name} (${prior.month.slice(0,7)})`,
        -prior.amountCents,prior.month,actorUserId])
    }
    // Staff-authorized backdating posts each replacement period locally in this
    // same transaction. Existing monthly invoices/payments remain untouched; the
    // canonical subscription+month key makes worker retries reuse these bills.
    for (const record of replacementRecords) {
      const { insertedSignup,replacementSubscription,target,preview:replacement }=record
      for (const period of replacement.catchupMonths ?? []) {
        const priced=await resolveFamilyEnrollmentPricing(client,{familyId:Number(context.family_id),periodKey:period.month,strictPricing:true,ensureSchema:false})
        const line=priced.lines.find(row=>Number(row.signupId)===Number(insertedSignup.id))
        if (!line || Number(line.netCents)!==period.netCents) throw new Error('Replacement tuition changed during the move. Review the class move again.')
        if (line.netCents>0) await billRegistrationMembership(client,Number(context.member_id))
        await client.query(`INSERT INTO billing_charge
          (family_billing_account_id,member_id,subscription_id,source_type,source_id,description,amount_cents,gross_amount_cents,
           discount_amount_cents,charge_type,billing_interval,service_period_start,service_period_end,price_adjustment_id,collection_status,created_by_user_id)
          VALUES($1,$2,$3,'billing_subscription',$4,$5,$6,$7,$8,'recurring','month',$9::date,($9::date+interval '1 month - 1 day')::date,$10,'unpaid',$11)
          ON CONFLICT(source_type,source_id) WHERE source_id IS NOT NULL DO NOTHING`,
        [context.family_billing_account_id,context.member_id,replacementSubscription.id,`${replacementSubscription.id}:${period.month.slice(0,7)}`,
          target.class_name,line.netCents,line.grossCents,line.discountCents,period.month,line.priceAdjustmentId ?? null,actorUserId])
        await client.query('UPDATE billing_subscription SET next_bill_date=$2::date WHERE id=$1',[replacementSubscription.id,addBillingMonths(period.month,1)])
      }
    }
    const paymentReallocation = {transferredCents:0,applications:[]}
    for (const record of replacementRecords) {
      const {insertedSignup,replacementChargeId}=record
      const allocation = await reallocateSettledClassSwapPayments(client, {
        accountId: Number(context.family_billing_account_id),
        sourceChargeId: preview.sourceRelatedChargeId,
        replacementChargeId,
        sourceRetainedCents: Math.max(0, preview.sourcePostedAmountCents - preview.unusedSourceCreditCents),
        requestKey: `${requestKey}:${insertedSignup.id}`,
      })
      await annotateClassSwapCharges(client, {
        accountId: Number(context.family_billing_account_id),
        sourceSignupId: Number(context.signup_id),
        replacementSignupId: Number(insertedSignup.id),
        sourceChargeId: preview.sourceRelatedChargeId,
        replacementChargeId,
        effectiveDate: request.effectiveDate,
        reason: request.reason,
      })
      if (replacementRecords.length===1) await bindEqualValueClassTransferCheckout(client, {
        accountId: Number(context.family_billing_account_id),
        sourceChargeId: preview.sourceRelatedChargeId,
        replacementChargeId,
        adjustmentChargeId: sourceAdjustmentChargeId,
      })
      paymentReallocation.transferredCents += allocation.transferredCents
      paymentReallocation.applications.push(...allocation.applications)
    }
    if (preview.sourceRelatedChargeId && replacementRecords.length>1) {
      await client.query(`UPDATE billing_charge SET metadata=COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('classTransferReplacements',$2::jsonb) WHERE id=$1`,
        [preview.sourceRelatedChargeId,JSON.stringify(replacementRecords.map(record=>({signupId:Number(record.insertedSignup.id),chargeId:record.replacementChargeId})))])
    }

    committed = {
      accountId: Number(context.family_billing_account_id),
      familyId: Number(context.family_id),
      sourceSignupId: Number(context.signup_id),
      replacementSignupId: Number(insertedSignup.id),
      replacementSignupIds: replacementRecords.map(record=>Number(record.insertedSignup.id)),
      replacementChargeIds: replacementRecords.map(record=>record.replacementChargeId),
      settlementKind: preview.settlementKind,
      settlementAmountCents: preview.settlementAmountCents,
      ledgerDeltaCents: preview.ledgerDeltaCents,
      sourceAdjustmentChargeId,
      // Kept for callers that recorded the prior response contract. The
      // linked row is now an internal adjustment, never a standalone credit.
      sourceCreditChargeId: sourceAdjustmentChargeId,
      replacementChargeId,
      reallocatedPaymentCents: paymentReallocation.transferredCents,
    }
    await recordBillingActivity(client, {
      eventKey: `customer-billing-class-swap:${requestKey}`,
      accountId: Number(context.family_billing_account_id),
      memberId: Number(context.member_id),
      signupId: Number(context.signup_id),
      chargeId: sourceAdjustmentChargeId ?? replacementChargeId,
      eventType: 'enrollment_class_swapped',
      summary: `${context.class_name} was replaced with ${preview.replacementClassName}.`,
      beforeValue: {
        sourceSignupId: Number(context.signup_id),
        className: context.class_name,
        subscriptionId: Number(context.billing_subscription_id),
      },
      afterValue: committed,
      details: {
        ...preview,
        targetFormId: Number(target.form_id),
        targetSlotGroupId: Number(target.slot_group_id),
        targetTimeSlotId: Number(target.time_slot_id),
        targetSelections: request.targetSelections,
        paymentReallocation,
      },
      actorUserId,
    })
    const notificationPreview=await previewClassSwapNotification(client,{
      ...request,facilityId:Number(context.facility_id),mode:'permanent',source:'scheduling',signupId,billingAccountId:Number(context.family_billing_account_id),
    })
    await queueClassSwapNotification(client,{facilityId:Number(context.facility_id),eventKey:`permanent:${requestKey}`,
      mode:'permanent',preview:notificationPreview,emailBody:request.emailBody})
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
    ...await completeClassSwapNotification(pool,{facilityId,eventKey:`permanent:${requestKey}`}),
    replayed: false,
    preview,
    resultingBalanceCents: balance?.balanceCents ?? preview.resultingBalanceCents,
  }
}

/**
 * Convert the short-lived standalone credit pattern used by an earlier class
 * move implementation into the same linked, in-place proration model used by
 * new moves. The original immutable row is retained as an internal adjustment
 * and settled money is reassigned without changing its payment record.
 */
export async function repairLegacyClassSwapLedger(pool, {
  accountIds = [],
  apply = false,
} = {}) {
  const normalizedAccountIds = [...new Set(accountIds.map(Number).filter((value) => Number.isInteger(value) && value > 0))]
  const candidates = await pool.query(
    `SELECT adjustment.id AS adjustment_charge_id,
            adjustment.family_billing_account_id AS account_id,
            adjustment.member_id,
            adjustment.source_id AS legacy_source_id,
            adjustment.description AS adjustment_description,
            adjustment.amount_cents AS adjustment_amount_cents,
            adjustment.service_period_start,
            adjustment.service_period_end,
            adjustment.metadata AS adjustment_metadata,
            source.id AS source_charge_id,
            source.amount_cents AS source_amount_cents,
            replacement.id AS replacement_charge_id,
            replacement.amount_cents AS replacement_amount_cents
       FROM billing_charge adjustment
       JOIN billing_charge source ON source.id = adjustment.related_charge_id
       JOIN LATERAL (
         SELECT candidate.id, candidate.amount_cents
           FROM billing_charge candidate
          WHERE candidate.family_billing_account_id = adjustment.family_billing_account_id
            AND candidate.source_type = 'scheduling_signup'
            AND candidate.source_id = COALESCE(
              NULLIF(adjustment.metadata->>'replacementSignupId', ''),
              NULLIF(split_part(adjustment.source_id, ':', 2), '')
            )
            AND to_char(COALESCE(candidate.service_period_start, candidate.created_at::date), 'YYYY-MM')
                  = to_char(COALESCE(adjustment.service_period_start, adjustment.created_at::date), 'YYYY-MM')
          ORDER BY candidate.created_at, candidate.id
          LIMIT 1
       ) replacement ON TRUE
      WHERE adjustment.source_type = 'enrollment_class_swap_credit'
        AND adjustment.amount_cents < 0
        AND ($1::bigint[] = '{}'::bigint[] OR adjustment.family_billing_account_id = ANY($1::bigint[]))
      ORDER BY adjustment.family_billing_account_id, adjustment.id`,
    [normalizedAccountIds],
  )
  const repairs = candidates.rows.map((row) => ({
    adjustmentChargeId: Number(row.adjustment_charge_id),
    accountId: Number(row.account_id),
    memberId: row.member_id == null ? null : Number(row.member_id),
    sourceChargeId: Number(row.source_charge_id),
    sourceAmountCents: cents(row.source_amount_cents),
    replacementChargeId: Number(row.replacement_charge_id),
    replacementAmountCents: cents(row.replacement_amount_cents),
    adjustmentAmountCents: legacyClassSwapAdjustmentCents(row.adjustment_amount_cents),
    servicePeriodStart: dateOnly(row.service_period_start),
    servicePeriodEnd: dateOnly(row.service_period_end),
  }))
  const applied = []
  if (!apply) return { repairs, applied }

  for (const repair of repairs) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [repair.accountId])
      const adjustment = await client.query(
        `SELECT *
           FROM billing_charge
          WHERE id = $1
            AND family_billing_account_id = $2
            AND source_type = 'enrollment_class_swap_credit'
          FOR UPDATE`,
        [repair.adjustmentChargeId, repair.accountId],
      ).then((result) => result.rows[0] ?? null)
      if (!adjustment) {
        await client.query('COMMIT')
        continue
      }
      const updated = await client.query(
        `UPDATE billing_charge
            SET source_type = 'charge_adjustment',
                source_id = $2,
                description = $3,
                charge_type = 'adjustment',
                billing_interval = 'one_time',
                collection_status = 'none',
                metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb
          WHERE id = $1
          RETURNING id`,
        [
          repair.adjustmentChargeId,
          `class-swap-proration:${repair.adjustmentChargeId}`,
          `Transfer adjustment — ${String(adjustment.description ?? '').replace(/^Prorated class move credit\s*[—-]?\s*/i, '')}`.trim(),
          JSON.stringify({
            adjustmentKind: 'class_swap_proration',
            adjustmentLabel: 'Transfer adjustment',
            customerAuditVisibility: 'suppressed',
            repairedFromSourceType: 'enrollment_class_swap_credit',
          }),
        ],
      )
      if (!updated.rows[0]) throw new Error(`Class-swap adjustment #${repair.adjustmentChargeId} could not be updated.`)
      const paymentReallocation = await reallocateSettledClassSwapPayments(client, {
        accountId: repair.accountId,
        sourceChargeId: repair.sourceChargeId,
        replacementChargeId: repair.replacementChargeId,
        sourceRetainedCents: Math.max(0, repair.sourceAmountCents - repair.adjustmentAmountCents),
        requestKey: `legacy-${repair.adjustmentChargeId}`,
      })
      await recordBillingActivity(client, {
        eventKey: `legacy-class-swap-ledger-repair:${repair.adjustmentChargeId}`,
        accountId: repair.accountId,
        memberId: repair.memberId,
        chargeId: repair.adjustmentChargeId,
        eventType: 'class_swap_ledger_repaired',
        summary: 'A class move was reconciled into its original and replacement class bill lines.',
        beforeValue: {
          sourceType: 'enrollment_class_swap_credit',
          amountCents: -repair.adjustmentAmountCents,
        },
        afterValue: {
          sourceType: 'charge_adjustment',
          sourceChargeId: repair.sourceChargeId,
          replacementChargeId: repair.replacementChargeId,
          reallocatedPaymentCents: paymentReallocation.transferredCents,
        },
        details: { paymentReallocation },
        actorType: 'system',
      })
      await client.query('COMMIT')
      applied.push({ ...repair, reallocatedPaymentCents: paymentReallocation.transferredCents })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }
  return { repairs, applied }
}
