/** A fully returned payment may satisfy a completed purchase only when every
 * original bill was independently waived, no cash remains allocated, and no
 * collector or escaped credit can still own the same money. */
export async function findFullyRefundedWaivedCheckout(db, { accountId, sessionId, paymentId, amountCents }) {
  return db.query(`WITH purchase AS (
      SELECT * FROM billing_charge WHERE family_billing_account_id=$1 AND stripe_checkout_session_id=$2
    ), waivers AS (
      SELECT adjustment.* FROM billing_charge adjustment JOIN purchase ON purchase.id=adjustment.related_charge_id
      WHERE adjustment.family_billing_account_id=$1 AND adjustment.source_type='charge_adjustment'
    )
    SELECT payment.* FROM billing_payment payment
    WHERE payment.id=$3 AND payment.family_billing_account_id=$1
      AND payment.stripe_checkout_session_id=$2 AND payment.amount_cents=$4
      AND payment.external_processor='stripe' AND payment.stripe_payment_intent_id IS NOT NULL
      AND payment.external_status IN ('settled','succeeded','reconciliation_required')
      AND $4::integer>0
      AND (SELECT COALESCE(SUM(amount_cents),0) FROM purchase)=$4
      AND EXISTS (SELECT 1 FROM purchase WHERE amount_cents>0)
      AND NOT EXISTS (SELECT 1 FROM purchase WHERE amount_cents<0)
      AND NOT EXISTS (SELECT 1 FROM purchase WHERE amount_cents + COALESCE(
        (SELECT SUM(amount_cents) FROM waivers WHERE related_charge_id=purchase.id),0) <> 0)
      AND (SELECT COALESCE(SUM(refund.amount_cents),0) FROM billing_refund refund
        WHERE refund.payment_id=payment.id AND refund.family_billing_account_id=$1
          AND refund.external_status='succeeded' AND refund.stripe_refund_id IS NOT NULL
          AND refund.ledger_treatment='return_overpayment')=$4
      AND NOT EXISTS (SELECT 1 FROM billing_refund WHERE payment_id=payment.id AND external_status='reconciliation_required')
      AND NOT EXISTS (SELECT 1 FROM billing_payment_application application
        WHERE application.billing_payment_id=payment.id OR application.billing_charge_id IN (SELECT id FROM purchase)
        GROUP BY application.billing_payment_id,application.billing_charge_id
        HAVING SUM(CASE WHEN application_kind='reversal' THEN -amount_cents ELSE amount_cents END)<>0)
      AND NOT EXISTS (SELECT 1 FROM billing_monthly_invoice_line line JOIN billing_monthly_invoice invoice ON invoice.id=line.billing_monthly_invoice_id
        WHERE line.billing_charge_id IN (SELECT id FROM purchase UNION SELECT id FROM waivers)
          AND invoice.status IN ('draft','open','failed','payment_method_required'))
      AND NOT EXISTS (SELECT 1 FROM billing_charge_credit_application application
        JOIN billing_monthly_invoice_line line ON line.id=application.credit_invoice_line_id
        WHERE line.billing_charge_id IN (SELECT id FROM waivers))
      AND NOT EXISTS (SELECT 1 FROM billing_payment_attempt WHERE family_billing_account_id=$1
        AND (status IN ('pending','processing','reconciliation_required') OR (status='reserved' AND expires_at>now())))`,
    [Number(accountId), String(sessionId), Number(paymentId), Number(amountCents)]).then(result=>result.rows[0]??null)
}
