export async function hasFamilyPayments(db, { familyId, accountIds, memberIds }) {
  const { rows: [history] } = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM account_payment
       WHERE (record_family_id=$1 OR record_member_id=ANY($3::bigint[]) OR family_billing_account_id=ANY($2::bigint[]))
         AND amount_cents > 0
         AND COALESCE(NULLIF(lower(external_status), ''), 'settled') IN ('settled','succeeded','paid','complete','completed','recorded')
     ) OR EXISTS (
       SELECT 1 FROM account_refund
       WHERE (record_family_id=$1 OR record_member_id=ANY($3::bigint[]) OR family_billing_account_id=ANY($2::bigint[]))
         AND amount_cents > 0 AND COALESCE(external_status, 'succeeded') IN ('succeeded','settled','paid','completed')
     ) OR EXISTS (
       SELECT 1 FROM billing_payment_attempt WHERE family_billing_account_id=ANY($2::bigint[]) AND status='succeeded'
     ) OR EXISTS (
       SELECT 1 FROM store_order WHERE (family_billing_account_id=ANY($2::bigint[]) OR member_id=ANY($3::bigint[])) AND payment_status IN ('paid','external')
     ) OR EXISTS (
       SELECT 1 FROM billing_charge WHERE family_billing_account_id=ANY($2::bigint[]) AND amount_cents > 0 AND collection_status IN ('paid','partially_paid')
     ) OR EXISTS (
       SELECT 1 FROM billing_monthly_invoice WHERE family_billing_account_id=ANY($2::bigint[]) AND total_cents > 0 AND paid_at IS NOT NULL
     ) AS retained`, [familyId, accountIds, memberIds],
  )
  return history.retained
}
