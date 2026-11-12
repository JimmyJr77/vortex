import { effectiveEnrollmentPriceAdjustments, normalizeBillingMonth } from './customerBillingPricing.js'
import { runtimeDiscountRuleFromAdjustment, persistedDiscountFromAdjustment } from './recurringPeriodPricing.js'

export function transferableEnrollmentDiscounts(history, effectiveMonth) {
  const month = normalizeBillingMonth(effectiveMonth)
  const manual = history.filter(row => row.kind === 'legacy_discount' && !row.promo_code && row.status === 'active')
  const current = effectiveEnrollmentPriceAdjustments(manual, month)
  return [...current, ...manual.filter(row => normalizeBillingMonth(row.effective_from_month) > month && effectiveEnrollmentPriceAdjustments(manual, row.effective_from_month).includes(row))]
    .sort((a, b) => Number(a.id) - Number(b.id))
}

export async function loadEnrollmentDiscountTransfer(db, signupId, effectiveMonth) {
  const history = (await db.query('SELECT * FROM enrollment_price_adjustment WHERE signup_id=$1 ORDER BY id', [signupId])).rows
  if (!history.some(row => ['legacy_discount','promo_code'].includes(row.kind))) {
    const signup = (await db.query('SELECT manual_discount_cents,manual_discount_pct,manual_discount_reason,enrollment_start_date FROM scheduling_signup WHERE id=$1',[signupId])).rows[0]
    if (Number(signup?.manual_discount_cents)>0 || Number(signup?.manual_discount_pct)>0) history.push({
      id:0,kind:'legacy_discount',status:'active',reason:signup.manual_discount_reason || 'Existing enrollment discount',
      effective_from_month:signup.enrollment_start_date ?? effectiveMonth,effective_through_month:null,
      discount_rule_snapshot:{id:-Number(signupId),name:signup.manual_discount_reason || 'Existing enrollment discount',type:'manual',
        amountType:Number(signup.manual_discount_cents)>0?'fixed':'percent',
        amountValue:Number(signup.manual_discount_cents)>0?Number(signup.manual_discount_cents):Math.round(Number(signup.manual_discount_pct)*100),
        applyTo:'class',calcBase:'pre',stackable:true,config:{assignmentOnly:true}},
    })
  }
  const transfers = transferableEnrollmentDiscounts(history, effectiveMonth)
  const current = effectiveEnrollmentPriceAdjustments(transfers, effectiveMonth)
  return { transfers, assignments: current.map(persistedDiscountFromAdjustment).filter(Boolean), rules: current.map(runtimeDiscountRuleFromAdjustment).filter(Boolean) }
}

/** Copy the remaining window, never restart a discount's duration or alter its source history. */
export async function persistEnrollmentDiscountTransfer(db, { transfers, signupId, subscriptionId, accountId, memberId, effectiveMonth, actorUserId }) {
  const month = normalizeBillingMonth(effectiveMonth)
  for (const prior of transfers) {
    const from = normalizeBillingMonth(prior.effective_from_month)
    const rule = runtimeDiscountRuleFromAdjustment(prior)
    if (!rule) continue
    const original = typeof prior.discount_rule_snapshot === 'string' ? JSON.parse(prior.discount_rule_snapshot) : prior.discount_rule_snapshot ?? {}
    const snapshot = { ...original, ...rule, id: -Number(signupId), type: 'manual', applyTo: 'class', calcBase: 'pre', stackable: true,
      assignmentSource: 'enrollment_actions', transferredFromAdjustmentId: Number(prior.id),
      config: { assignmentOnly: true } }
    await db.query(`INSERT INTO enrollment_price_adjustment
      (family_billing_account_id,member_id,signup_id,billing_subscription_id,kind,discount_rule_snapshot,
       effective_from_month,effective_through_month,reason,status,created_by_user_id)
      VALUES($1,$2,$3,$4,'legacy_discount',$5::jsonb,$6::date,$7::date,$8,'active',$9)`,
    [accountId,memberId,signupId,subscriptionId,JSON.stringify(snapshot),from > month ? from : month,prior.effective_through_month,`Class transfer: ${prior.reason}`,actorUserId])
  }
}
