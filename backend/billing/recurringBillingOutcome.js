// These are explicit accounting review holds, not worker/infrastructure errors.
// Keep the allowlist narrow: unknown failures must still fail the scheduled job.
const REVIEW_CODES = new Set([
  'target_month_recurring_charge_parity_failed',
  'initial_enrollment_charge_requires_review',
  'target_month_invoice_precedes_recurring_charges',
  'payment_method_required',
  'migration_review_required',
])

export function isRecurringBillingReviewHold(code) {
  return REVIEW_CODES.has(code)
}

export function recurringBillingOutcome({ preparation = [], enrollmentRecovery = [], result, review, operationalFailure = false }) {
  const blocked = [...preparation.filter((row) => row.status === 'blocked'), ...enrollmentRecovery]
  const failures = [...blocked, ...(result.blockedAccounts ?? [])]
    .filter((row) => !isRecurringBillingReviewHold(row.code))
  const reviewFailed = review.accounts.some((row) => row.operationalFailure
    || row.issues.some((issue) => issue.code === 'billing_review_failed'))
  const attentionAccountIds = [...new Set([
    ...blocked.map((row) => row.accountId),
    ...(result.blockedAccounts ?? []).map((row) => row.accountId),
    ...review.accounts.filter((row) => !row.verified).map((row) => row.accountId),
  ])]
  const failed = operationalFailure || failures.length > 0 || reviewFailed
  return {
    status: failed ? 'failed' : attentionAccountIds.length ? 'completed_with_review_holds' : 'completed',
    exitCode: failed ? 1 : 0,
    attentionAccountIds,
    failures,
  }
}

// Persist exceptions before reporting a successful sweep. An alert-write failure
// is intentionally fatal; the worker must not silently lose an accounting hold.
export async function recordRecurringBillingExceptions(db, result) {
  for (const entry of result.blockedAccounts ?? []) {
    await db.query(`INSERT INTO stripe_billing_alert
      (stripe_event_id,family_billing_account_id,alert_type,severity,message,details)
      VALUES ($1,$2,'recurring_billing_account_blocked','critical',$3,$4::jsonb)
      ON CONFLICT (stripe_event_id) DO UPDATE SET message=EXCLUDED.message,
        details=EXCLUDED.details,resolved_at=NULL,action_status='open',updated_at=now()`,
    [`recurring-billing:${entry.accountId}`, entry.accountId,
      entry.message ?? `Recurring billing requires review: ${entry.code}`, JSON.stringify(entry)])
  }
  if (result.completedAccountIds?.length) {
    await db.query(`UPDATE stripe_billing_alert SET resolved_at=now(),action_status='resolved',
      resolution_note='Recurring billing account completed successfully.',updated_at=now()
      WHERE alert_type='recurring_billing_account_blocked'
        AND family_billing_account_id=ANY($1::bigint[]) AND resolved_at IS NULL`,
    [result.completedAccountIds])
  }
}
