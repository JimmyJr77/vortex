import { activeLedgerChargePredicate, chargeCreditApplicationSql } from '../billing/billingLedgerSql.js'

function outstandingReason(row) {
  if (row.attempt_status === 'reconciliation_required') return 'Payment needs reconciliation'
  if (row.attempt_status === 'processing') return 'Payment processing'
  if (row.attempt_status === 'pending') return row.attempt_type?.endsWith('_checkout') ? 'Checkout pending' : 'Payment pending'
  if (!row.attempt_status && row.collection_status === 'processing') return 'Payment processing'
  if (!row.attempt_status && row.collection_status === 'checkout_pending') return 'Checkout pending'
  if (row.invoice_status === 'payment_method_required') return 'Invoice requires a payment method'
  if (row.failure_reason) return row.failure_reason
  if (row.invoice_status === 'failed' && row.invoice_failure) return row.invoice_failure
  if (row.attempt_status === 'failed' || row.attempt_status === 'expired' || row.attempt_status === 'canceled') {
    return row.attempt_reason || `Payment attempt ${row.attempt_status}`
  }
  if (row.invoice_status === 'failed' || row.collection_status === 'failed') return 'Payment failed; details unavailable'
  if (row.invoice_status === 'open') return 'Invoice open; payment outstanding'
  if (row.invoice_status === 'draft') return 'Invoice awaiting collection'
  return 'No payment reason recorded'
}

/** Current-month posted class tuition with a positive balance after ledger applications. */
export async function loadDailyReportUnpaid(pool, { date }) {
  const result = await pool.query(
    `WITH tuition AS (
       SELECT charge.*
       FROM billing_charge charge
       LEFT JOIN billing_subscription subscription ON subscription.id = charge.subscription_id
       WHERE charge.charge_type = 'recurring'
         AND charge.billing_interval = 'month'
         AND (charge.source_type = 'scheduling_signup' OR (
           charge.source_type = 'billing_subscription' AND subscription.source_type = 'scheduling_signup'
         ))
         AND charge.amount_cents > 0
         AND ${activeLedgerChargePredicate('charge')}
         AND COALESCE(charge.metadata->>'provisionalBillingVoided', 'false') <> 'true'
         AND COALESCE(charge.service_period_start, (charge.created_at AT TIME ZONE 'America/New_York')::date)
             BETWEEN date_trunc('month', $1::date)::date AND $1::date
     ), unpaid AS (
       SELECT charge.*,
              GREATEST(0, charge.amount_cents + adjustments.amount_cents
                - applications.applied_cents - credits.applied_cents) AS remaining_cents
       FROM tuition charge
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(adjustment.amount_cents), 0) AS amount_cents,
                COALESCE(array_agg(adjustment.id), ARRAY[]::bigint[]) AS ids
         FROM billing_charge adjustment
         WHERE adjustment.family_billing_account_id = charge.family_billing_account_id
           AND (
             (adjustment.related_charge_id = charge.id AND adjustment.source_type IN ('charge_adjustment', 'refund_offset'))
             OR (adjustment.source_type IN ('price_adjustment', 'price_adjustment_reversal')
               AND adjustment.subscription_id = charge.subscription_id
               AND adjustment.service_period_start = charge.service_period_start)
           )
       ) adjustments ON TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(CASE WHEN application.application_kind = 'reversal'
             THEN -application.amount_cents ELSE application.amount_cents END), 0) AS applied_cents
         FROM billing_payment_application application
         JOIN billing_payment payment ON payment.id = application.billing_payment_id
         WHERE (application.billing_charge_id = charge.id OR application.billing_charge_id = ANY(adjustments.ids))
           AND payment.external_status IN ('settled', 'succeeded')
       ) applications ON TRUE
       LEFT JOIN LATERAL (${chargeCreditApplicationSql('charge.id')}) credits ON TRUE
     )
     SELECT charge.id AS charge_id, account.id AS account_id, charge.description, charge.remaining_cents,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', payer.first_name, payer.last_name)), ''),
              NULLIF(TRIM(family.family_name), ''), 'Family #' || family.id::text) AS payer_name,
            COALESCE(NULLIF(TRIM(account.billing_email), ''), NULLIF(TRIM(payer.email), '')) AS payer_email,
            NULLIF(TRIM(CONCAT_WS(' ', athlete.first_name, athlete.last_name)), '') AS member_name,
            charge.collection_status, invoice.status AS invoice_status,
            NULLIF(TRIM(invoice.failure_message), '') AS invoice_failure,
            attempt.status AS attempt_status, attempt.attempt_type,
            NULLIF(TRIM(attempt.metadata->>'releaseReason'), '') AS attempt_reason,
            failure.reason AS failure_reason
     FROM unpaid charge
     JOIN family_billing_account account ON account.id = charge.family_billing_account_id
     JOIN family ON family.id = account.family_id
     LEFT JOIN member payer ON payer.id = account.payer_member_id
     LEFT JOIN member athlete ON athlete.id = charge.member_id
     LEFT JOIN LATERAL (
       SELECT invoice.status, invoice.failure_message, invoice.stripe_invoice_id, invoice.stripe_payment_intent_id
       FROM billing_monthly_invoice_line line
       JOIN billing_monthly_invoice invoice ON invoice.id = line.billing_monthly_invoice_id
       WHERE line.billing_charge_id = charge.id AND invoice.status NOT IN ('void', 'paid')
       ORDER BY invoice.billing_month DESC, invoice.id DESC
       LIMIT 1
     ) invoice ON TRUE
     LEFT JOIN LATERAL (
       SELECT attempt.status, attempt.attempt_type, attempt.metadata, attempt.stripe_payment_intent_id
       FROM billing_payment_attempt attempt
       WHERE attempt.family_billing_account_id = account.id
         AND (attempt.target_charge_id = charge.id OR EXISTS (
           SELECT 1 FROM billing_payment_attempt_charge reservation
           WHERE reservation.billing_charge_id = charge.id AND reservation.billing_payment_attempt_id = attempt.id
         ))
       ORDER BY attempt.updated_at DESC, attempt.id DESC
       LIMIT 1
     ) attempt ON TRUE
     LEFT JOIN LATERAL (
       SELECT NULLIF(TRIM(alert.details->>'reason'), '') AS reason
       FROM stripe_billing_alert alert
       WHERE alert.family_billing_account_id = account.id
         AND alert.resolved_at IS NULL
         AND alert.alert_type IN ('payment_failed', 'payment_recovery_exhausted')
         AND alert.stripe_object_id IN (
           charge.stripe_payment_intent_id, invoice.stripe_invoice_id,
           invoice.stripe_payment_intent_id, attempt.stripe_payment_intent_id
         )
         AND NULLIF(TRIM(alert.details->>'reason'), '') IS NOT NULL
       ORDER BY alert.created_at DESC, alert.id DESC
       LIMIT 1
     ) failure ON TRUE
     WHERE charge.remaining_cents > 0
     ORDER BY payer_name, member_name, charge.id`,
    [date],
  )

  const households = new Map()
  for (const row of result.rows) {
    const accountId = Number(row.account_id)
    let household = households.get(accountId)
    if (!household) {
      household = { accountId, payerName: row.payer_name, payerEmail: row.payer_email, remainingCents: 0, charges: [] }
      households.set(accountId, household)
    }
    const remainingCents = Number(row.remaining_cents)
    household.remainingCents += remainingCents
    household.charges.push({
      chargeId: Number(row.charge_id),
      memberName: row.member_name,
      description: row.description,
      remainingCents,
      reason: outstandingReason(row),
    })
  }
  return [...households.values()].sort((a, b) => b.remainingCents - a.remainingCents)
}
