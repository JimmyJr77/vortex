import { activeLedgerChargePredicate, chargeCreditApplicationSql } from './billingLedgerSql.js'

/** Existing annual bills belong in enrollment checkout, not a second purchase. */
export async function loadEnrollmentMembershipBills(db, { memberId, feeId, accountId = null }) {
  if (!memberId) return []
  const result = await db.query(`/* enrollment-membership:existing-bills */
    SELECT charge.id, charge.family_billing_account_id, charge.member_id,
           charge.description,
           (charge.amount_cents + COALESCE(adjustments.amount,0) - COALESCE(payments.amount,0) - COALESCE(credits.amount,0))::int AS remaining_cents
    FROM billing_charge charge
    JOIN family_billing_account account ON account.id=charge.family_billing_account_id AND account.is_active=TRUE
    JOIN member ON member.id=charge.member_id AND member.family_id=account.family_id
    LEFT JOIN LATERAL (
      SELECT SUM(amount_cents) AS amount FROM billing_charge adjustment
      WHERE adjustment.related_charge_id=charge.id AND adjustment.source_type IN ('charge_adjustment','refund_offset')
    ) adjustments ON TRUE
    LEFT JOIN LATERAL (
      SELECT SUM(CASE WHEN application.application_kind='reversal' THEN -application.amount_cents ELSE application.amount_cents END) AS amount
      FROM billing_payment_application application JOIN billing_payment payment ON payment.id=application.billing_payment_id
      WHERE application.billing_charge_id=charge.id AND payment.external_status IN ('settled','succeeded')
    ) payments ON TRUE
    LEFT JOIN LATERAL (SELECT (${chargeCreditApplicationSql('charge.id')}) AS amount) credits ON TRUE
    WHERE charge.member_id=$1 AND charge.source_type='additional_fee'
      AND split_part(charge.source_id,':',1)=$2
      AND ($3::bigint IS NULL OR account.id=$3)
      AND ${activeLedgerChargePredicate('charge')}
      AND charge.amount_cents+COALESCE(adjustments.amount,0)>COALESCE(payments.amount,0)+COALESCE(credits.amount,0)
    ORDER BY charge.id`, [memberId, String(feeId), accountId])
  return result.rows.map(row => ({ chargeId: Number(row.id), accountId: Number(row.family_billing_account_id),
    memberId: Number(row.member_id), feeId: Number(feeId), amountCents: Number(row.remaining_cents),
    name: row.description || 'Annual membership' }))
}

export function includeMembershipBillsInBalance(carriedForward, bills = []) {
  if (!bills.length) return carriedForward
  const amount = bills.reduce((sum, bill) => sum + bill.amountCents, 0)
  return { ...carriedForward, enabled: true,
    items: [...(carriedForward.items ?? []), ...bills.map(bill => ({
      key: `annual-membership-bill-${bill.chargeId}`, kind: 'annual_membership_balance',
      label: `${bill.name} — existing bill`, detail: 'Included in this enrollment payment', amountCents: bill.amountCents,
    }))],
    debitsCents: (carriedForward.debitsCents ?? 0) + amount,
    // Future tuition credits do not waive today's unpaid membership.
    totalCents: Math.max(0, carriedForward.totalCents ?? 0) + amount }
}

export async function validateEnrollmentMembershipBills(db, { bills = [], accountId, memberId }) {
  for (const feeId of new Set(bills.map(bill => bill.feeId))) {
    const current = await loadEnrollmentMembershipBills(db, { memberId, feeId, accountId })
    const expected = bills.filter(bill => bill.feeId === feeId)
    if (JSON.stringify(current) !== JSON.stringify(expected)) {
      throw new Error('The membership bill changed. Refresh enrollment pricing before paying.')
    }
  }
}

/** Called under the household collection lock after exact new-purchase settlement.
 * Pin the carried membership payment to its athlete before general allocation. */
export async function applyEnrollmentMembershipBills(db, { bills = [], accountId, memberId, payment }) {
  for (const bill of bills) {
    if (bill.accountId !== Number(accountId) || bill.memberId !== Number(memberId) || !(bill.amountCents > 0)) {
      throw new Error('Enrollment membership bill ownership is inconsistent.')
    }
    const key = `enrollment-membership:${payment.id}:${bill.chargeId}`
    const prior = (await db.query('SELECT * FROM billing_payment_application WHERE idempotency_key=$1', [key])).rows[0]
    if (prior) {
      if (Number(prior.billing_payment_id)!==Number(payment.id) || Number(prior.billing_charge_id)!==bill.chargeId || Number(prior.amount_cents)!==bill.amountCents || prior.application_kind!=='application') throw new Error('Membership payment replay conflicts with its bill.')
      continue
    }
    const current = await loadEnrollmentMembershipBills(db, { memberId, feeId: bill.feeId, accountId })
    if (current.find(row => row.chargeId === bill.chargeId)?.amountCents !== bill.amountCents) throw new Error('Membership balance changed before payment fulfillment.')
    const available = (await db.query(`SELECT payment.amount_cents-COALESCE((
      SELECT SUM(CASE WHEN application_kind='reversal' THEN -amount_cents ELSE amount_cents END)
      FROM billing_payment_application WHERE billing_payment_id=payment.id),0) AS available
      FROM billing_payment payment WHERE payment.id=$1 AND payment.family_billing_account_id=$2
      AND payment.external_status IN ('settled','succeeded') FOR UPDATE`, [payment.id, accountId])).rows[0]
    if (Number(available?.available ?? 0)<bill.amountCents) throw new Error('Enrollment payment cannot cover its membership bill.')
    await db.query(`INSERT INTO billing_payment_application
      (billing_payment_id,billing_charge_id,amount_cents,application_kind,idempotency_key,allocation_reason)
      VALUES ($1,$2,$3,'application',$4,'enrollment_membership_exact')`, [payment.id,bill.chargeId,bill.amountCents,key])
  }
}
