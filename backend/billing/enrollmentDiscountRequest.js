import { addBillingMonths, billingMonthInTimeZone, normalizeBillingMonth } from './customerBillingPricing.js'

/** Normalize the manage-enrollment editor into the shared immutable price history. */
export async function normalizeEnrollmentDiscountRequest(db, context, input, now = new Date()) {
  const currentMonth = billingMonthInTimeZone(now)
  const effectiveFrom = normalizeBillingMonth(input.effectiveFromMonth ?? currentMonth)
  if (effectiveFrom < currentMonth) throw new Error('Enrollment discounts cannot change previous billing months.')
  if (['paused','waitlisted'].includes(context.signup_status) && effectiveFrom <= currentMonth) throw new Error('For a paused or waitlisted enrollment, choose next billing month or later. Discounts apply when the student is active.')
  const enrollmentMonth = normalizeBillingMonth(context.subscription_start_date ?? context.enrollment_start_date ?? context.signup_created_at)
  if (effectiveFrom < enrollmentMonth) throw new Error('The discount cannot start before the enrollment.')
  const duration = input.duration ?? 'monthly'
  if (!['once', 'monthly', 'months'].includes(duration)) throw new Error('Select a valid discount duration.')
  const months = duration === 'once' ? 1 : duration === 'monthly' ? null : Number(input.durationMonths)
  if (months !== null && (!Number.isInteger(months) || months < 1 || months > 120)) {
    throw new Error('Discount duration must be between 1 and 120 months.')
  }
  let amountType = 'fixed'
  let amountValue = 0
  let name = String(input.reason ?? '').trim().slice(0, 500)
  let selectedRuleId = null
  if (input.mode === 'rule') {
    const id = Number(input.ruleId)
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Select a discount rule.')
    const rule = (await db.query(
      'SELECT * FROM discount_rule WHERE id = $1 AND (facility_id = $2 OR facility_id IS NULL) AND active = TRUE',
      [id, context.facility_id],
    )).rows[0]
    if (!rule) throw new Error('The selected discount rule is unavailable.')
    if (!['fixed', 'percent'].includes(rule.amount_type) || !(Number(rule.amount_value) > 0)) {
      throw new Error('Select a rule with a percentage or dollar discount.')
    }
    selectedRuleId = id
    amountType = rule.amount_type
    amountValue = Number(rule.amount_value)
    name ||= rule.name
  } else if (input.mode === 'manual') {
    if ((input.amountCents != null) === (input.percent != null)) throw new Error('Enter either a dollar discount or a percentage.')
    if (input.amountCents != null) {
      amountValue = Number(input.amountCents)
      if (!Number.isSafeInteger(amountValue) || amountValue <= 0) throw new Error('Discount amount must be positive whole cents.')
    } else {
      const percent = Number(input.percent)
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) throw new Error('Discount percentage must be greater than 0 and at most 100.')
      amountType = 'percent'
      amountValue = Math.round(percent * 100)
    }
  } else if (input.mode !== 'clear') throw new Error('Invalid discount mode.')
  name ||= input.mode === 'clear' ? 'Enrollment discount cleared' : 'Manual enrollment discount'
  // A zero-value replacement clears the discount prospectively without revoking past prices.
  return {
    kind: 'legacy_discount', reason: name, effectiveFrom,
    effectiveThrough: input.mode === 'clear' || months === null ? null : addBillingMonths(effectiveFrom, months - 1),
    finalPriceCents: null,
    promo: { code: null, snapshot: {
      id: -Number(context.signup_id), name, type: 'manual', amountType, amountValue,
      applyTo: 'class', calcBase: 'pre', priority: 100, stackable: true, scopeLevel: 'global',
      assignmentSource: 'enrollment_actions', selectedRuleId, duration, durationMonths: months,
      config: { assignmentOnly: true },
    } },
  }
}
