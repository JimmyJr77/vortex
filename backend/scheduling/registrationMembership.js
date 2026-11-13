import { loadActiveAnnualMembership } from './annualMembership.js'
import { isAnnualMembershipFeeItem, loadActiveAdditionalFees, computeOrderAdditionalFees } from './additionalFeesEngine.js'
import { assertNoOutstandingAnnualMembershipCharge } from '../billing/annualMembershipChargeGuard.js'

export function registrationRequiresMembership({ newSignupItems = [], discounts = null, firstMonth = null, oneTimeTuition = null }) {
  if (Number(oneTimeTuition?.totalCents) > 0) return true
  if (firstMonth?.enabled) return (firstMonth.items ?? []).some((item) =>
    Number(item.proratedCents) > 0 || Number(item.prepaidFirstMonthCents) > 0)
  if (discounts?.enabled && Number(discounts.totalCents) === 0) return false
  return newSignupItems.some((item) => {
    if (item.billingType !== 'recurring' || item.multiClassPassApplied) return false
    const line = discounts?.lines?.find((line) => line.key === item.slotKey)
    const net = line ? Number(line.baseCents) - (line.applied ?? []).reduce(
      (sum, discount) => sum + Number(discount.amountCents || 0), 0)
      : Number(item.incrementalMonthly) * 100
    return net > 0
  })
}

/** Membership belongs to the participant, never implicitly to their payer. */
export async function requiredRegistrationFees(db, { fees, memberId, required = true, now = new Date() }) {
  const otherFees = fees.filter((fee) => !isAnnualMembershipFeeItem(fee))
  if (!required) return otherFees
  if (await loadActiveAnnualMembership(db, memberId, { asOf: now, strict: true })) return otherFees
  const annual = fees.find((fee) => isAnnualMembershipFeeItem(fee) && fee.active !== false
    && Number(fee.amountCents) > 0
    && (!fee.startsAt || new Date(fee.startsAt) <= now)
    && (!fee.endsAt || new Date(fee.endsAt) >= now))
  if (!annual) throw new Error('Annual membership pricing is unavailable. Contact staff before registering.')
  // A facility membership is required for every class, even if an old fee was
  // configured with a class-specific scope or a new-member trigger.
  return [...otherFees, { ...annual, scopeLevel: 'global', scopeRefId: null,
    triggerType: 'once_per_year', applyBasis: 'per_year' }]
}

/** Non-checkout admissions use the household ledger for collection. An existing
 * unpaid membership bill remains the collection owner; do not bill it twice. */
export async function billRegistrationMembership(db, memberId) {
  if (await loadActiveAnnualMembership(db, memberId, { strict: true })) return
  const context = (await db.query(`SELECT member.family_id, family.facility_id, account.id AS account_id
    FROM member JOIN family ON family.id = member.family_id
    JOIN family_billing_account account ON account.family_id = family.id AND account.is_active = TRUE
    WHERE member.id = $1`, [memberId])).rows[0]
  if (!context) throw new Error('An active athlete billing account is required.')
  await db.query('SELECT pg_advisory_xact_lock($1::bigint)', [Number(context.account_id)])
  const fees = await requiredRegistrationFees(db, {
    memberId, fees: await loadActiveAdditionalFees(db, context.facility_id),
  })
  const annual = fees.find(isAnnualMembershipFeeItem)
  if (!annual) return
  try {
    await assertNoOutstandingAnnualMembershipCharge(db, {
      accountId: context.account_id, memberId, feeId: annual.id,
    })
  } catch (error) {
    if (error.code === 'ANNUAL_MEMBERSHIP_ALREADY_BILLED') return
    throw error
  }
  const additionalFees = computeOrderAdditionalFees({ fees: [annual], lines: [{}] })
  const { persistSignupCharges } = await import('./persistSignupCharges.js')
  await persistSignupCharges(db, { memberId, membershipOnly: true,
    signups: [{ signupId: null }], preview: { newSignups: [], additionalFees } })
}
