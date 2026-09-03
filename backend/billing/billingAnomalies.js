/**
 * Cross-account billing anomaly read model.
 *
 * This deliberately reads the canonical ledger only. It does not mutate
 * payments, charges, subscriptions, or the audit trail, and every row is
 * constrained by the authenticated facility passed to the caller.
 */

export const BILLING_ANOMALY_TYPES = Object.freeze([
  'unpaid_account',
  'duplicate_payment',
  'excessive_discount',
  'failed_collection',
  'account_credit',
])

export function mapBillingAnomaly(row) {
  return {
    id: String(row.anomaly_id),
    type: String(row.anomaly_type),
    severity: String(row.severity ?? 'medium'),
    familyId: Number(row.family_id),
    billingAccountId: Number(row.billing_account_id),
    familyName: row.family_name ?? 'Unnamed family',
    payerName: row.payer_name ?? null,
    amountCents: Number(row.amount_cents ?? 0),
    itemCount: Number(row.item_count ?? 1),
    occurredAt: row.occurred_at ?? null,
    summary: row.summary ?? 'Billing anomaly needs review.',
    detail: row.detail ?? null,
  }
}

export function summarizeBillingAnomalies(anomalies = []) {
  const byType = Object.fromEntries(BILLING_ANOMALY_TYPES.map((type) => [type, 0]))
  const bySeverity = { high: 0, medium: 0, low: 0 }
  let totalAmountCents = 0

  for (const anomaly of anomalies) {
    if (Object.hasOwn(byType, anomaly.type)) byType[anomaly.type] += 1
    if (Object.hasOwn(bySeverity, anomaly.severity)) bySeverity[anomaly.severity] += 1
    totalAmountCents += Math.max(0, Number(anomaly.amountCents) || 0)
  }

  return {
    total: anomalies.length,
    totalAmountCents,
    byType,
    bySeverity,
  }
}

export async function listBillingAnomalies(pool, { facilityId }) {
  const result = await pool.query(
    `/* canonical-billing:anomalies */
     WITH scoped_account AS (
       SELECT
         account.id AS billing_account_id,
         family.id AS family_id,
         family.family_name,
         COALESCE(
           NULLIF(TRIM(CONCAT_WS(' ', payer.first_name, payer.last_name)), ''),
           NULLIF(account.billing_email, ''),
           family.family_name
         ) AS payer_name
       FROM family_billing_account account
       JOIN family ON family.id = account.family_id
       LEFT JOIN member payer ON payer.id = account.payer_member_id
       WHERE account.is_active = TRUE
         AND family.facility_id = $1
     ),
     charge_adjustment AS (
       SELECT related_charge_id AS charge_id, SUM(amount_cents)::bigint AS adjustment_cents
       FROM billing_charge
       WHERE source_type IN ('charge_adjustment', 'refund_offset')
         AND related_charge_id IS NOT NULL
       GROUP BY related_charge_id
     ),
     payment_application AS (
       SELECT
         application.billing_charge_id AS charge_id,
         SUM(CASE WHEN application.application_kind = 'reversal'
           THEN -application.amount_cents ELSE application.amount_cents END)::bigint AS applied_cents
       FROM billing_payment_application application
       JOIN billing_payment payment ON payment.id = application.billing_payment_id
       WHERE payment.external_status IN ('settled', 'succeeded')
       GROUP BY application.billing_charge_id
     ),
     credit_application AS (
       SELECT target_line.billing_charge_id AS charge_id, SUM(application.amount_cents)::bigint AS applied_cents
       FROM billing_charge_credit_application application
       JOIN billing_monthly_invoice invoice ON invoice.id = application.billing_monthly_invoice_id
       JOIN billing_monthly_invoice_line target_line ON target_line.id = application.target_invoice_line_id
       JOIN billing_monthly_invoice_line credit_line ON credit_line.id = application.credit_invoice_line_id
       JOIN billing_charge credit_source ON credit_source.id = credit_line.billing_charge_id
       WHERE invoice.status = 'paid'
         AND NOT (
           credit_source.related_charge_id = target_line.billing_charge_id
           AND credit_source.source_type IN ('charge_adjustment', 'refund_offset')
         )
       GROUP BY target_line.billing_charge_id
     ),
     collectible_charge AS (
       SELECT
         charge.id,
         charge.family_billing_account_id AS billing_account_id,
         charge.created_at,
         charge.collection_status,
         charge.amount_cents,
         COALESCE(charge.gross_amount_cents, charge.amount_cents + charge.discount_amount_cents) AS gross_amount_cents,
         COALESCE(charge.discount_amount_cents, 0) AS discount_amount_cents,
         GREATEST(0,
           charge.amount_cents
           + COALESCE(charge_adjustment.adjustment_cents, 0)
           - COALESCE(payment_application.applied_cents, 0)
           - COALESCE(credit_application.applied_cents, 0)
         )::bigint AS remaining_cents
       FROM billing_charge charge
       LEFT JOIN charge_adjustment ON charge_adjustment.charge_id = charge.id
       LEFT JOIN payment_application ON payment_application.charge_id = charge.id
       LEFT JOIN credit_application ON credit_application.charge_id = charge.id
       WHERE charge.source_type NOT IN ('charge_adjustment', 'refund_offset')
         AND charge.amount_cents > 0
     ),
     unpaid AS (
       SELECT
         account.billing_account_id,
         SUM(charge.remaining_cents)::bigint AS amount_cents,
         COUNT(*) FILTER (WHERE charge.remaining_cents > 0)::int AS item_count,
         MIN(charge.created_at) FILTER (WHERE charge.remaining_cents > 0) AS occurred_at
       FROM scoped_account account
       JOIN collectible_charge charge ON charge.billing_account_id = account.billing_account_id
       GROUP BY account.billing_account_id
       HAVING SUM(charge.remaining_cents) > 0
     ),
     failed_collection AS (
       SELECT
         account.billing_account_id,
         SUM(charge.remaining_cents)::bigint AS amount_cents,
         COUNT(*)::int AS item_count,
         MAX(charge.created_at) AS occurred_at
       FROM scoped_account account
       JOIN collectible_charge charge ON charge.billing_account_id = account.billing_account_id
       WHERE charge.collection_status = 'failed'
       GROUP BY account.billing_account_id
       HAVING SUM(charge.remaining_cents) > 0
     ),
     duplicate_reference_payment AS (
       SELECT
         account.billing_account_id,
         COALESCE(NULLIF(payment.stripe_payment_intent_id, ''), NULLIF(payment.external_reference, '')) AS reference,
         SUM(payment.amount_cents)::bigint AS amount_cents,
         COUNT(*)::int AS item_count,
         MAX(payment.paid_at) AS occurred_at
       FROM scoped_account account
       JOIN billing_payment payment ON payment.family_billing_account_id = account.billing_account_id
       WHERE payment.external_status IN ('settled', 'succeeded')
         AND COALESCE(NULLIF(payment.stripe_payment_intent_id, ''), NULLIF(payment.external_reference, '')) IS NOT NULL
       GROUP BY account.billing_account_id, COALESCE(NULLIF(payment.stripe_payment_intent_id, ''), NULLIF(payment.external_reference, ''))
       HAVING COUNT(*) > 1
     ),
     same_day_payment AS (
       SELECT
         account.billing_account_id,
         payment.amount_cents,
         COALESCE(NULLIF(payment.method, ''), 'unknown') AS method,
         (payment.paid_at AT TIME ZONE 'America/New_York')::date AS payment_date,
         SUM(payment.amount_cents)::bigint AS total_cents,
         COUNT(*)::int AS item_count,
         MAX(payment.paid_at) AS occurred_at
       FROM scoped_account account
       JOIN billing_payment payment ON payment.family_billing_account_id = account.billing_account_id
       WHERE payment.external_status IN ('settled', 'succeeded')
       GROUP BY account.billing_account_id, payment.amount_cents, COALESCE(NULLIF(payment.method, ''), 'unknown'), (payment.paid_at AT TIME ZONE 'America/New_York')::date
       HAVING COUNT(*) > 1
     ),
     adjacent_day_stripe_split_payment AS (
       SELECT
         account.billing_account_id,
         invoice_payment.id AS invoice_payment_id,
         intent_payment.id AS intent_payment_id,
         invoice_payment.stripe_invoice_id,
         intent_payment.stripe_payment_intent_id,
         invoice_payment.amount_cents,
         COALESCE(NULLIF(invoice_payment.method, ''), 'unknown') AS invoice_method,
         COALESCE(NULLIF(intent_payment.method, ''), 'unknown') AS intent_method,
         GREATEST(invoice_payment.paid_at, intent_payment.paid_at) AS occurred_at
       FROM scoped_account account
       JOIN billing_payment invoice_payment
         ON invoice_payment.family_billing_account_id = account.billing_account_id
       JOIN billing_payment intent_payment
         ON intent_payment.family_billing_account_id = account.billing_account_id
        AND intent_payment.id <> invoice_payment.id
        AND intent_payment.amount_cents = invoice_payment.amount_cents
        AND intent_payment.stripe_customer_id = invoice_payment.stripe_customer_id
       WHERE invoice_payment.external_processor = 'stripe'
         AND intent_payment.external_processor = 'stripe'
         AND invoice_payment.external_status IN ('settled', 'succeeded')
         AND intent_payment.external_status IN ('settled', 'succeeded')
         AND invoice_payment.stripe_customer_id IS NOT NULL
         -- This is deliberately a candidate signal, not identity proof. The
         -- repair path must still verify Stripe's Invoice Payment binding.
         AND invoice_payment.stripe_invoice_id IS NOT NULL
         AND invoice_payment.stripe_payment_intent_id IS NULL
         AND intent_payment.stripe_invoice_id IS NULL
         AND intent_payment.stripe_payment_intent_id IS NOT NULL
         AND ABS(
           (invoice_payment.paid_at AT TIME ZONE 'America/New_York')::date
           - (intent_payment.paid_at AT TIME ZONE 'America/New_York')::date
         ) <= 1
         AND ABS(EXTRACT(EPOCH FROM (invoice_payment.paid_at - intent_payment.paid_at))) <= 172800
         AND (
           (invoice_payment.paid_at AT TIME ZONE 'America/New_York')::date
             <> (intent_payment.paid_at AT TIME ZONE 'America/New_York')::date
           OR COALESCE(NULLIF(invoice_payment.method, ''), 'unknown')
             <> COALESCE(NULLIF(intent_payment.method, ''), 'unknown')
         )
     ),
     excessive_discount AS (
       SELECT
         account.billing_account_id,
         charge.id AS charge_id,
         charge.discount_amount_cents AS amount_cents,
         charge.created_at AS occurred_at,
         charge.gross_amount_cents,
         charge.discount_amount_cents
       FROM scoped_account account
       JOIN collectible_charge charge ON charge.billing_account_id = account.billing_account_id
       WHERE charge.gross_amount_cents > 0
         AND charge.discount_amount_cents >= 2500
         AND charge.discount_amount_cents * 100 >= charge.gross_amount_cents * 50
     ),
     unapplied_credit AS (
       SELECT
         account.billing_account_id,
         SUM(payment.amount_cents - COALESCE(application.applied_cents, 0))::bigint AS amount_cents,
         COUNT(*) FILTER (WHERE payment.amount_cents > COALESCE(application.applied_cents, 0))::int AS item_count,
         MAX(payment.paid_at) FILTER (WHERE payment.amount_cents > COALESCE(application.applied_cents, 0)) AS occurred_at
       FROM scoped_account account
       JOIN billing_payment payment ON payment.family_billing_account_id = account.billing_account_id
       LEFT JOIN (
         SELECT
           application.billing_payment_id,
           SUM(CASE WHEN application.application_kind = 'reversal'
             THEN -application.amount_cents ELSE application.amount_cents END)::bigint AS applied_cents
         FROM billing_payment_application application
         GROUP BY application.billing_payment_id
       ) application ON application.billing_payment_id = payment.id
       WHERE payment.external_status IN ('settled', 'succeeded')
       GROUP BY account.billing_account_id
       HAVING SUM(payment.amount_cents - COALESCE(application.applied_cents, 0)) > 0
     )
     SELECT * FROM (
     SELECT
       CONCAT('unpaid:', unpaid.billing_account_id) AS anomaly_id,
       'unpaid_account'::text AS anomaly_type,
       CASE WHEN unpaid.amount_cents >= 20000 THEN 'high' ELSE 'medium' END AS severity,
       account.family_id, account.billing_account_id, account.family_name, account.payer_name,
       unpaid.amount_cents, unpaid.item_count, unpaid.occurred_at,
       'Unpaid account balance'::text AS summary,
       CONCAT(unpaid.item_count, ' charge', CASE WHEN unpaid.item_count = 1 THEN '' ELSE 's' END, ' still ha', CASE WHEN unpaid.item_count = 1 THEN 's' ELSE 've' END, ' an outstanding balance.') AS detail
     FROM unpaid
     JOIN scoped_account account ON account.billing_account_id = unpaid.billing_account_id
     UNION ALL
     SELECT
       CONCAT('duplicate-reference:', duplicate_reference_payment.billing_account_id, ':', duplicate_reference_payment.reference),
       'duplicate_payment'::text,
       'high'::text,
       account.family_id, account.billing_account_id, account.family_name, account.payer_name,
       duplicate_reference_payment.amount_cents, duplicate_reference_payment.item_count, duplicate_reference_payment.occurred_at,
       'Repeated settled payment reference'::text,
       CONCAT('Reference ', duplicate_reference_payment.reference, ' appears on ', duplicate_reference_payment.item_count, ' settled payments.')
     FROM duplicate_reference_payment
     JOIN scoped_account account ON account.billing_account_id = duplicate_reference_payment.billing_account_id
     UNION ALL
     SELECT
       CONCAT('duplicate-same-day:', same_day_payment.billing_account_id, ':', same_day_payment.payment_date, ':', same_day_payment.amount_cents, ':', same_day_payment.method),
       'duplicate_payment'::text,
       'medium'::text,
       account.family_id, account.billing_account_id, account.family_name, account.payer_name,
       same_day_payment.total_cents, same_day_payment.item_count, same_day_payment.occurred_at,
       'Potential same-day duplicate payment'::text,
       CONCAT(same_day_payment.item_count, ' ', same_day_payment.method, ' payments of the same amount posted on ', same_day_payment.payment_date, '.')
     FROM same_day_payment
     JOIN scoped_account account ON account.billing_account_id = same_day_payment.billing_account_id
     UNION ALL
     SELECT
       CONCAT(
         'duplicate-stripe-split:', adjacent.billing_account_id, ':',
         adjacent.invoice_payment_id, ':', adjacent.intent_payment_id
       ),
       'duplicate_payment'::text,
       'medium'::text,
       account.family_id, account.billing_account_id, account.family_name, account.payer_name,
       adjacent.amount_cents, 2::int, adjacent.occurred_at,
       'Potential split Stripe payment representation'::text,
       CONCAT(
         'Payments #', adjacent.invoice_payment_id, ' (', adjacent.invoice_method,
         ', invoice ', adjacent.stripe_invoice_id, ') and #', adjacent.intent_payment_id,
         ' (', adjacent.intent_method, ', PaymentIntent ', adjacent.stripe_payment_intent_id,
         ') have the same Stripe customer and amount on the same or adjacent day. ',
         'Review Stripe Invoice Payment evidence before treating them as one payment.'
       )
     FROM adjacent_day_stripe_split_payment adjacent
     JOIN scoped_account account ON account.billing_account_id = adjacent.billing_account_id
     UNION ALL
     SELECT
       CONCAT('discount:', excessive_discount.charge_id),
       'excessive_discount'::text,
       CASE WHEN excessive_discount.discount_amount_cents * 100 >= excessive_discount.gross_amount_cents * 75 THEN 'high' ELSE 'medium' END,
       account.family_id, account.billing_account_id, account.family_name, account.payer_name,
       excessive_discount.amount_cents, 1, excessive_discount.occurred_at,
       'Large discount applied'::text,
       CONCAT('Discount is ', ROUND(excessive_discount.discount_amount_cents * 100.0 / excessive_discount.gross_amount_cents), '% of the ', excessive_discount.gross_amount_cents, '-cent listed charge.')
     FROM excessive_discount
     JOIN scoped_account account ON account.billing_account_id = excessive_discount.billing_account_id
     UNION ALL
     SELECT
       CONCAT('failed-collection:', failed_collection.billing_account_id),
       'failed_collection'::text,
       'high'::text,
       account.family_id, account.billing_account_id, account.family_name, account.payer_name,
       failed_collection.amount_cents, failed_collection.item_count, failed_collection.occurred_at,
       'Collection failed'::text,
       CONCAT(failed_collection.item_count, ' failed charge', CASE WHEN failed_collection.item_count = 1 THEN '' ELSE 's' END, ' still need', CASE WHEN failed_collection.item_count = 1 THEN 's' ELSE '' END, ' collection.')
     FROM failed_collection
     JOIN scoped_account account ON account.billing_account_id = failed_collection.billing_account_id
     UNION ALL
     SELECT
       CONCAT('credit:', unapplied_credit.billing_account_id),
       'account_credit'::text,
       'low'::text,
       account.family_id, account.billing_account_id, account.family_name, account.payer_name,
       unapplied_credit.amount_cents, unapplied_credit.item_count, unapplied_credit.occurred_at,
       'Unapplied account credit'::text,
       CONCAT(unapplied_credit.item_count, ' settled payment', CASE WHEN unapplied_credit.item_count = 1 THEN ' has' ELSE 's have' END, ' remaining credit to review or apply.')
     FROM unapplied_credit
     JOIN scoped_account account ON account.billing_account_id = unapplied_credit.billing_account_id
     ) anomaly_rows
     ORDER BY
       CASE severity WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
       amount_cents DESC,
       occurred_at DESC NULLS LAST`,
    [facilityId],
  )

  const anomalies = result.rows.map(mapBillingAnomaly)
  return { anomalies, summary: summarizeBillingAnomalies(anomalies) }
}
