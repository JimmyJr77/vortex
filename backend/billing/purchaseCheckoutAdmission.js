/**
 * Return another nonterminal payable purchase Checkout for the household.
 *
 * Enrollment and annual-membership Checkout can both contain an annual fee,
 * and two enrollment intents can target the same signup. Neither entitlement
 * exists until payment, so creation is conservatively serialized to one
 * payable purchase Checkout per account. Local clocks never release an owner;
 * only an exact Stripe/reconciliation terminal status does.
 */
export async function findActivePurchaseCheckoutOwner(db, accountId, {
  excludePendingEnrollmentId = null,
  excludeAnnualMembershipRequestId = null,
} = {}) {
  const enrollmentId = Number(excludePendingEnrollmentId)
  const annualId = Number(excludeAnnualMembershipRequestId)
  const excludedEnrollmentId = Number.isSafeInteger(enrollmentId) && enrollmentId > 0
    ? enrollmentId
    : null
  const excludedAnnualId = Number.isSafeInteger(annualId) && annualId > 0
    ? annualId
    : null
  return db.query(
    `SELECT owner_kind, owner_id, owner_status
       FROM (
         SELECT 'enrollment'::text AS owner_kind,
                pending.id AS owner_id,
                pending.status AS owner_status
           FROM stripe_pending_enrollment pending
          WHERE pending.family_billing_account_id = $1
            AND ($2::bigint IS NULL OR pending.id <> $2)
            AND pending.status IN ('pending', 'processing', 'failed')
            AND pending.checkout_mode IN ('payment', 'subscription')
            AND pending.due_now_cents > 0
         UNION ALL
         SELECT 'annual_membership'::text AS owner_kind,
                request.id AS owner_id,
                request.status AS owner_status
           FROM annual_membership_checkout_request request
          WHERE request.family_billing_account_id = $1
            AND ($3::bigint IS NULL OR request.id <> $3)
            AND request.status IN ('pending', 'fulfilling', 'failed', 'quarantined')
            AND request.expected_amount_cents > 0
       ) owner
      ORDER BY owner_kind, owner_id
      LIMIT 1`,
    [Number(accountId), excludedEnrollmentId, excludedAnnualId],
  ).then((result) => result.rows[0] ?? null)
}
