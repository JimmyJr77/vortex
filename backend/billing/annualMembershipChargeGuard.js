import { activeLedgerChargePredicate } from './billingLedgerSql.js'

/** An unpaid annual bill is the collection owner, regardless of its posting date. */
export async function assertNoOutstandingAnnualMembershipCharge(db, { accountId, memberId, feeId }) {
  const existing = (await db.query(
    `/* annual-membership:outstanding-charge */
     SELECT charge.id FROM billing_charge charge
     WHERE charge.family_billing_account_id=$1 AND charge.member_id=$2
       AND charge.source_type='additional_fee' AND split_part(charge.source_id, ':', 1)=$3
       AND ${activeLedgerChargePredicate('charge')}
       AND charge.amount_cents + COALESCE((
         SELECT SUM(adjustment.amount_cents) FROM billing_charge adjustment
         WHERE adjustment.related_charge_id=charge.id
           AND adjustment.source_type IN ('charge_adjustment','refund_offset')
       ),0) > COALESCE((
         SELECT SUM(CASE WHEN application.application_kind='reversal'
           THEN -application.amount_cents ELSE application.amount_cents END)
         FROM billing_payment_application application
         JOIN billing_payment payment ON payment.id=application.billing_payment_id
         WHERE application.billing_charge_id=charge.id AND payment.external_status IN ('settled','succeeded')
       ),0)
     ORDER BY charge.id LIMIT 1`, [accountId, memberId, String(feeId)],
  )).rows[0]
  if (existing) {
    const error = new Error('This athlete already has an unpaid annual membership bill. Pay the existing bill from the family billing account instead of purchasing another membership.')
    error.code = 'ANNUAL_MEMBERSHIP_ALREADY_BILLED'
    error.status = 409
    throw error
  }
}
