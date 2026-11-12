import { billRegistrationMembership } from './registrationMembership.js'
import { buildSignupOrderPreview } from './orderPricing.js'
import { persistSignupCharges } from './persistSignupCharges.js'
import { billingDateKey } from '../billing/customerBillingPricing.js'

/** Must run in the transaction that admits the athlete. Never leave a
 * confirmed registration behind if either tuition or membership pricing fails. */
export async function billConfirmedRegistration(db, signup, {
  previewBuilder = buildSignupOrderPreview,
  persist = persistSignupCharges,
} = {}) {
  if (signup.status !== 'confirmed') return
  if (!signup.member_id) throw new Error('A class registration requires an athlete account.')
  const existing = (await db.query(`SELECT subscription.net_monthly_cents, charge.billing_interval
    FROM billing_charge charge
    LEFT JOIN billing_subscription subscription ON subscription.source_type = 'scheduling_signup'
      AND subscription.source_id = charge.source_id
    WHERE charge.source_type = 'scheduling_signup' AND charge.source_id = $1
      AND charge.member_id = $2
      AND (charge.billing_interval = 'one_time' OR subscription.id IS NOT NULL)
    UNION ALL
    SELECT subscription.net_monthly_cents, 'month' AS billing_interval
    FROM billing_subscription subscription
    WHERE subscription.source_type='scheduling_signup' AND subscription.source_id=$1
      AND subscription.member_id=$2 AND subscription.status IN ('active','paused')
    LIMIT 1`, [String(signup.id), Number(signup.member_id)])).rows[0]
  if (existing) {
    if (Number(existing.net_monthly_cents) > 0) await billRegistrationMembership(db, Number(signup.member_id))
    return
  }
  const selection = {
    signupId: Number(signup.id),
    formId: Number(signup.form_id),
    slotGroupId: Number(signup.slot_group_id),
    timeSlotId: signup.time_slot_id == null ? null : Number(signup.time_slot_id),
    enrollmentStartDate: billingDateKey(signup.enrollment_start_date),
    selectedPricingOptionKey: signup.pricing_option_key ?? null,
  }
  const preview = await previewBuilder(db, {
    memberId: Number(signup.member_id), newSignups: [selection],
    excludeSignupIds: [Number(signup.id)], ensureSchema: false,
  })
  await persist(db, { memberId: Number(signup.member_id), signups: [selection], preview })
}
