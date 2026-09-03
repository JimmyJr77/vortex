/**
 * Return an active enrollment Checkout reservation whose immutable total
 * includes an existing household balance in addition to its new purchase. A
 * pending row is the durable reservation before Stripe Session creation/link;
 * after that boundary the same row represents the payable Checkout surface.
 * No other account collector or general allocator may act until signed Stripe
 * evidence or exact reconciliation records an expired or fulfilled terminal
 * state; the local clock alone is not terminal proof.
 */
export async function findActiveEnrollmentCheckoutBalanceCollector(db, accountId, {
  excludePendingEnrollmentId = null,
} = {}) {
  const excludedId = Number(excludePendingEnrollmentId)
  const normalizedExcludedId = Number.isSafeInteger(excludedId) && excludedId > 0
    ? excludedId
    : null
  return db.query(
    `WITH active_enrollment_checkout AS (
       SELECT pending.id AS owner_id,
              pending.stripe_checkout_session_id,
              pending.status AS owner_status,
              pending.due_now_cents,
              GREATEST(
                0,
                COALESCE(CASE
                  WHEN jsonb_typeof(pending.preview_snapshot->'additionalFeesOneTime') = 'number'
                  THEN ROUND((pending.preview_snapshot->>'additionalFeesOneTime')::numeric * 100)
                END, 0)
                + COALESCE(CASE
                  WHEN jsonb_typeof(pending.preview_snapshot#>'{firstMonth,totalCents}') = 'number'
                  THEN ROUND((pending.preview_snapshot#>>'{firstMonth,totalCents}')::numeric)
                END, 0)
                + COALESCE(CASE
                  WHEN jsonb_typeof(pending.preview_snapshot->'passPurchaseTotalCents') = 'number'
                  THEN ROUND((pending.preview_snapshot->>'passPurchaseTotalCents')::numeric)
                END, 0)
              )::int AS purchase_target_cents
         FROM stripe_pending_enrollment pending
        WHERE pending.family_billing_account_id = $1
          AND ($2::bigint IS NULL OR pending.id <> $2)
          AND pending.status IN ('pending', 'processing', 'failed')
          AND pending.checkout_mode IN ('payment', 'subscription')
     )
     SELECT 'enrollment'::text AS owner_kind,
            owner_id,
            stripe_checkout_session_id,
            owner_status,
            due_now_cents,
            purchase_target_cents,
            (due_now_cents - purchase_target_cents)::int AS carried_balance_cents
       FROM active_enrollment_checkout
      WHERE due_now_cents > purchase_target_cents
      ORDER BY owner_id
      LIMIT 1`,
    [Number(accountId), normalizedExcludedId],
  ).then((result) => result.rows[0] ?? null)
}

export function completedPaidCheckoutFulfillmentIsExact(proof) {
  const expectedPaymentCents = Number(proof?.expected_payment_cents)
  const purchaseTargetCents = Number(proof?.purchase_target_cents)
  const taggedChargeCents = Number(proof?.tagged_charge_cents)
  const taggedApplicationCents = Number(proof?.tagged_application_cents)
  const allApplicationCents = Number(proof?.all_application_cents)
  const refundedPurchaseCents = Number(proof?.refunded_purchase_cents)
  const taggedUnfundedCents = Number(proof?.tagged_unfunded_cents)
  const cents = [
    expectedPaymentCents,
    purchaseTargetCents,
    taggedChargeCents,
    taggedApplicationCents,
    allApplicationCents,
    refundedPurchaseCents,
    taggedUnfundedCents,
  ]
  if (
    !Number.isSafeInteger(Number(proof?.payment_id))
    || Number(proof.payment_id) <= 0
    || cents.some((value) => !Number.isSafeInteger(value) || value < 0)
    || purchaseTargetCents <= 0
    || expectedPaymentCents < purchaseTargetCents
    || refundedPurchaseCents > purchaseTargetCents
  ) return false
  if (proof.has_active_invoice_reservation === true) return false
  if (proof.has_active_payment_attempt === true) return false
  if (proof.has_escaped_session_credit === true) return false
  return (
    taggedChargeCents === purchaseTargetCents
    && taggedUnfundedCents === 0
    && taggedApplicationCents + refundedPurchaseCents === purchaseTargetCents
    && allApplicationCents + refundedPurchaseCents >= purchaseTargetCents
    && allApplicationCents + refundedPurchaseCents <= expectedPaymentCents
  )
}

/**
 * Return a completed enrollment/annual Checkout owner whose paid purchase is
 * not durably fulfilled by the exact Stripe payment and exact Session-tagged
 * charges. Generic allocation and household collection must stop while this
 * invariant is broken; otherwise another payment can satisfy the purchased
 * charges before reconciliation and make them collectible again.
 */
export async function findCompletedPaidCheckoutFulfillmentGap(db, accountId) {
  return db.query(
    `WITH completed_owner AS (
       SELECT 'enrollment'::text AS owner_kind,
              pending.id AS owner_id,
              pending.family_billing_account_id,
              pending.stripe_checkout_session_id,
              pending.due_now_cents AS expected_payment_cents,
              GREATEST(
                0,
                COALESCE(CASE
                  WHEN jsonb_typeof(pending.preview_snapshot->'additionalFeesOneTime') = 'number'
                  THEN ROUND((pending.preview_snapshot->>'additionalFeesOneTime')::numeric * 100)
                END, 0)
                + COALESCE(CASE
                  WHEN jsonb_typeof(pending.preview_snapshot#>'{firstMonth,totalCents}') = 'number'
                  THEN ROUND((pending.preview_snapshot#>>'{firstMonth,totalCents}')::numeric)
                END, 0)
                + COALESCE(CASE
                  WHEN jsonb_typeof(pending.preview_snapshot->'passPurchaseTotalCents') = 'number'
                  THEN ROUND((pending.preview_snapshot->>'passPurchaseTotalCents')::numeric)
                END, 0)
              )::int AS purchase_target_cents
         FROM stripe_pending_enrollment pending
        WHERE pending.family_billing_account_id = $1
          AND pending.status = 'completed'
          AND pending.due_now_cents > 0
          AND pending.stripe_checkout_session_id IS NOT NULL
       UNION ALL
       SELECT 'annual_membership'::text AS owner_kind,
              request.id AS owner_id,
              request.family_billing_account_id,
              request.stripe_checkout_session_id,
              request.expected_amount_cents AS expected_payment_cents,
              request.expected_amount_cents AS purchase_target_cents
         FROM annual_membership_checkout_request request
       WHERE request.family_billing_account_id = $1
          AND request.status = 'completed'
          AND request.expected_amount_cents > 0
          AND request.stripe_checkout_session_id IS NOT NULL
     ), exact_refunded_charge AS (
       SELECT refund.family_billing_account_id,
              refund.payment_id,
              related_charge.stripe_checkout_session_id,
              related_charge.id AS related_charge_id,
              SUM(refund.amount_cents)::int AS refunded_cents
         FROM billing_refund refund
         JOIN billing_charge related_charge
           ON related_charge.id = refund.related_charge_id
          AND related_charge.family_billing_account_id = refund.family_billing_account_id
         JOIN billing_charge refund_offset
           ON refund_offset.id = refund.offset_credit_charge_id
          AND refund_offset.family_billing_account_id = refund.family_billing_account_id
          AND refund_offset.related_charge_id = related_charge.id
          AND refund_offset.source_type = 'refund_offset'
          AND refund_offset.source_id = 'refund:' || refund.id::text
          AND refund_offset.amount_cents = -refund.amount_cents
        WHERE refund.external_status = 'succeeded'
          AND refund.ledger_treatment = 'reverse_charge'
          AND refund.stripe_refund_id IS NOT NULL
          AND refund.amount_cents > 0
          AND related_charge.stripe_checkout_session_id IS NOT NULL
          AND COALESCE((
            SELECT SUM(reversal.amount_cents)::int
              FROM billing_payment_application reversal
              JOIN billing_payment_application original
                ON original.id = reversal.reverses_application_id
               AND original.application_kind = 'application'
             WHERE reversal.application_kind = 'reversal'
               AND reversal.billing_payment_id = refund.payment_id
               AND reversal.billing_charge_id = refund.related_charge_id
               AND original.billing_payment_id = refund.payment_id
               AND original.billing_charge_id = refund.related_charge_id
               AND reversal.idempotency_key =
                     'refund:' || refund.id::text || ':application:' || original.id::text
          ), 0) = refund.amount_cents
        GROUP BY refund.family_billing_account_id,
                 refund.payment_id,
                 related_charge.stripe_checkout_session_id,
                 related_charge.id
     ), exact_refunded_purchase AS (
       SELECT family_billing_account_id,
              payment_id,
              stripe_checkout_session_id,
              SUM(refunded_cents)::int AS refunded_cents
         FROM exact_refunded_charge
        GROUP BY family_billing_account_id,
                 payment_id,
                 stripe_checkout_session_id
     )
     SELECT owner.owner_kind,
            owner.owner_id,
            owner.expected_payment_cents,
            owner.purchase_target_cents,
            payment.id AS payment_id,
            COALESCE(tagged_charge.total_cents, 0)::int AS tagged_charge_cents,
            COALESCE(tagged_application.total_cents, 0)::int AS tagged_application_cents,
            COALESCE(all_application.total_cents, 0)::int AS all_application_cents,
            COALESCE(refunded_purchase.refunded_cents, 0)::int AS refunded_purchase_cents,
            COALESCE(tagged_unfunded.total_cents, 0)::int AS tagged_unfunded_cents,
            EXISTS (
              SELECT 1
                FROM billing_charge reserved_charge
                JOIN billing_monthly_invoice_line reserved_line
                  ON reserved_line.billing_charge_id = reserved_charge.id
                JOIN billing_monthly_invoice reserved_invoice
                  ON reserved_invoice.id = reserved_line.billing_monthly_invoice_id
               WHERE reserved_charge.family_billing_account_id = owner.family_billing_account_id
                 AND reserved_charge.stripe_checkout_session_id = owner.stripe_checkout_session_id
                 AND reserved_invoice.status IN ('draft', 'open', 'failed', 'payment_method_required')
            ) AS has_active_invoice_reservation,
            EXISTS (
              SELECT 1
                FROM billing_charge reserved_charge
                JOIN billing_payment_attempt attempt
                  ON attempt.family_billing_account_id = reserved_charge.family_billing_account_id
                LEFT JOIN billing_payment_attempt_charge reservation
                  ON reservation.billing_payment_attempt_id = attempt.id
               WHERE reserved_charge.family_billing_account_id = owner.family_billing_account_id
                 AND reserved_charge.stripe_checkout_session_id = owner.stripe_checkout_session_id
                 AND (
                   attempt.status IN ('pending', 'processing', 'reconciliation_required')
                   OR (attempt.status = 'reserved' AND attempt.expires_at > now())
                 )
                 AND (
                   reservation.billing_charge_id = reserved_charge.id
                   OR attempt.target_charge_id = reserved_charge.id
                   OR attempt.target_charge_id = reserved_charge.related_charge_id
                 )
            ) AS has_active_payment_attempt,
            EXISTS (
              SELECT 1
                FROM billing_charge credit
                JOIN billing_monthly_invoice_line credit_line
                  ON credit_line.billing_charge_id = credit.id
                JOIN billing_charge_credit_application credit_application
                  ON credit_application.credit_invoice_line_id = credit_line.id
                JOIN billing_monthly_invoice_line target_line
                  ON target_line.id = credit_application.target_invoice_line_id
                LEFT JOIN billing_charge target_charge
                  ON target_charge.id = target_line.billing_charge_id
               WHERE credit.family_billing_account_id = owner.family_billing_account_id
                 AND credit.stripe_checkout_session_id = owner.stripe_checkout_session_id
                 AND credit.amount_cents < 0
                 AND target_charge.stripe_checkout_session_id
                       IS DISTINCT FROM owner.stripe_checkout_session_id
            ) AS has_escaped_session_credit
       FROM completed_owner owner
       LEFT JOIN billing_payment payment
         ON payment.family_billing_account_id = owner.family_billing_account_id
        AND payment.amount_cents = owner.expected_payment_cents
        AND payment.external_processor = 'stripe'
        AND payment.external_status IN ('settled', 'succeeded')
        AND payment.stripe_checkout_session_id = owner.stripe_checkout_session_id
       LEFT JOIN exact_refunded_purchase refunded_purchase
         ON refunded_purchase.family_billing_account_id = payment.family_billing_account_id
        AND refunded_purchase.payment_id = payment.id
        AND refunded_purchase.stripe_checkout_session_id = owner.stripe_checkout_session_id
       LEFT JOIN LATERAL (
         SELECT SUM(tagged_charge.amount_cents)::int AS total_cents
           FROM billing_charge tagged_charge
          WHERE tagged_charge.family_billing_account_id = owner.family_billing_account_id
            AND tagged_charge.stripe_checkout_session_id = owner.stripe_checkout_session_id
       ) tagged_charge ON TRUE
       LEFT JOIN LATERAL (
         SELECT SUM(CASE
                  WHEN application.application_kind = 'reversal'
                  THEN -application.amount_cents
                  ELSE application.amount_cents
                END)::int AS total_cents
           FROM billing_payment_application application
           JOIN billing_charge charged ON charged.id = application.billing_charge_id
          WHERE application.billing_payment_id = payment.id
            AND charged.family_billing_account_id = owner.family_billing_account_id
            AND charged.stripe_checkout_session_id = owner.stripe_checkout_session_id
       ) tagged_application ON TRUE
       LEFT JOIN LATERAL (
         SELECT SUM(CASE
                  WHEN application.application_kind = 'reversal'
                  THEN -application.amount_cents
                  ELSE application.amount_cents
                END)::int AS total_cents
           FROM billing_payment_application application
          WHERE application.billing_payment_id = payment.id
       ) all_application ON TRUE
       LEFT JOIN LATERAL (
         SELECT GREATEST(
                  0,
                  COALESCE(SUM(positive.unfunded_cents), 0)
                    + COALESCE((
                      SELECT SUM(credit.amount_cents)
                        FROM billing_charge credit
                       WHERE credit.family_billing_account_id = owner.family_billing_account_id
                         AND credit.stripe_checkout_session_id = owner.stripe_checkout_session_id
                         AND credit.amount_cents < 0
                    ), 0)
                )::int AS total_cents
           FROM (
             SELECT GREATEST(
                      0,
                      charge.amount_cents
                        - COALESCE(exact_application.applied_cents, 0)
                        - COALESCE(exact_refund.refunded_cents, 0)
                    )::int AS unfunded_cents
               FROM billing_charge charge
               LEFT JOIN LATERAL (
                 SELECT COALESCE(SUM(CASE
                          WHEN application.application_kind = 'reversal'
                          THEN -application.amount_cents
                          ELSE application.amount_cents
                        END), 0)::int AS applied_cents
                   FROM billing_payment_application application
                  WHERE application.billing_payment_id = payment.id
                    AND application.billing_charge_id = charge.id
               ) exact_application ON TRUE
               LEFT JOIN exact_refunded_charge exact_refund
                 ON exact_refund.family_billing_account_id = owner.family_billing_account_id
                AND exact_refund.payment_id = payment.id
                AND exact_refund.stripe_checkout_session_id = owner.stripe_checkout_session_id
                AND exact_refund.related_charge_id = charge.id
              WHERE charge.family_billing_account_id = owner.family_billing_account_id
                AND charge.stripe_checkout_session_id = owner.stripe_checkout_session_id
                AND charge.amount_cents > 0
           ) positive
       ) tagged_unfunded ON TRUE
      ORDER BY owner.owner_kind, owner.owner_id`,
    [Number(accountId)],
  ).then((result) => result.rows.find((row) => (
    !completedPaidCheckoutFulfillmentIsExact(row)
  )) ?? null)
}
