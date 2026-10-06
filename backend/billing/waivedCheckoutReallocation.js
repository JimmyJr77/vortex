/** A paid purchase that was subsequently fully waived may release its cash to
 * the household. Require historical exact fulfillment and only allocator-owned
 * reversals; a missing fulfillment must never masquerade as a waiver. */
export async function findFulfilledThenWaivedCheckout(db, { accountId, sessionId, paymentId, amountCents }) {
  return db.query(`WITH purchase AS (
      SELECT * FROM billing_charge WHERE family_billing_account_id=$1 AND stripe_checkout_session_id=$2
    ), waivers AS (
      SELECT adjustment.* FROM billing_charge adjustment JOIN purchase ON purchase.id=adjustment.related_charge_id
      WHERE adjustment.family_billing_account_id=$1 AND adjustment.source_type='charge_adjustment'
    )
    SELECT payment.id FROM billing_payment payment
    WHERE payment.id=$3 AND payment.family_billing_account_id=$1
      AND payment.stripe_checkout_session_id=$2 AND payment.amount_cents=$4
      AND payment.external_processor='stripe' AND payment.stripe_payment_intent_id IS NOT NULL
      AND payment.external_status IN ('settled','succeeded') AND $4::integer>0
      AND (SELECT COALESCE(SUM(amount_cents),0) FROM purchase)=$4
      AND EXISTS (SELECT 1 FROM purchase)
      AND NOT EXISTS (SELECT 1 FROM purchase WHERE amount_cents<=0)
      AND NOT EXISTS (SELECT 1 FROM purchase WHERE amount_cents + COALESCE(
        (SELECT SUM(amount_cents) FROM waivers WHERE related_charge_id=purchase.id),0) <> 0)
      AND NOT EXISTS (SELECT 1 FROM purchase WHERE COALESCE((
        SELECT SUM(app.amount_cents) FROM billing_payment_application app
        WHERE app.billing_payment_id=payment.id AND app.billing_charge_id=purchase.id
          AND app.application_kind='application'
          AND app.allocation_reason IN ('annual_membership_checkout_exact','enrollment_checkout_exact')
      ),0) <> purchase.amount_cents)
      AND NOT EXISTS (SELECT 1 FROM billing_payment_application app
        WHERE app.billing_charge_id IN (SELECT id FROM purchase)
          AND (app.billing_payment_id<>payment.id OR
            (app.application_kind='application' AND COALESCE(app.allocation_reason,'') NOT IN ('annual_membership_checkout_exact','enrollment_checkout_exact')) OR
            (app.application_kind='reversal' AND (app.allocation_reason IS DISTINCT FROM 'effective_charge_reallocation'
              OR NOT EXISTS (SELECT 1 FROM billing_payment_application original
                WHERE original.id=app.reverses_application_id AND original.application_kind='application'
                  AND original.billing_payment_id=payment.id AND original.billing_charge_id=app.billing_charge_id)))))
      AND NOT EXISTS (SELECT 1 FROM billing_payment_application app
        WHERE app.billing_charge_id IN (SELECT id FROM purchase)
        GROUP BY app.billing_charge_id
        HAVING SUM(CASE WHEN app.application_kind='reversal' THEN -app.amount_cents ELSE app.amount_cents END)<>0)
      AND NOT EXISTS (SELECT 1 FROM billing_refund WHERE payment_id=payment.id AND external_status NOT IN ('failed','canceled','cancelled'))
      AND (SELECT COALESCE(SUM(CASE WHEN app.application_kind='reversal' THEN -app.amount_cents ELSE app.amount_cents END),0)
        FROM billing_payment_application app WHERE app.billing_payment_id=payment.id) BETWEEN 0 AND $4
      AND NOT EXISTS (SELECT 1 FROM billing_monthly_invoice_line line JOIN billing_monthly_invoice invoice ON invoice.id=line.billing_monthly_invoice_id
        WHERE line.billing_charge_id IN (SELECT id FROM purchase UNION SELECT id FROM waivers)
          AND invoice.status IN ('draft','open','failed','payment_method_required'))
      AND NOT EXISTS (SELECT 1 FROM billing_charge_credit_application app
        JOIN billing_monthly_invoice_line line ON line.id=app.credit_invoice_line_id
        WHERE line.billing_charge_id IN (SELECT id FROM purchase UNION SELECT id FROM waivers))
      AND NOT EXISTS (SELECT 1 FROM billing_payment_attempt WHERE family_billing_account_id=$1
        AND (status IN ('pending','processing','reconciliation_required') OR (status='reserved' AND expires_at>now())))`,
    [Number(accountId),String(sessionId),Number(paymentId),Number(amountCents)]).then(result=>result.rows[0]??null)
}
