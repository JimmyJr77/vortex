import { getStripeClient } from './stripeBilling.js'

/** Called inside the transfer transaction and household collection lock. */
export async function cancelDuplicateMembershipBills(db, {
  account, sourceMemberId, targetMemberId, membershipDate, renewalDate,
  actorUserId, eventKey, stripeClient = null,
}) {
  const candidates = await db.query(
    `SELECT charge.*,
            COALESCE((SELECT SUM(adjustment.amount_cents) FROM billing_charge adjustment
                      WHERE adjustment.related_charge_id = charge.id
                        AND adjustment.source_type IN ('charge_adjustment', 'refund_offset')), 0)::int AS adjustment_cents
       FROM billing_charge charge
      WHERE charge.family_billing_account_id = $1 AND charge.member_id = $2
        AND charge.source_type = 'additional_fee'
        AND charge.source_id ~ '^[0-9]+:[0-9]+:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        AND split_part(charge.source_id, ':', 3) > $4::text
        AND CASE WHEN charge.source_id ~ '^[0-9]+:[0-9]+:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                 THEN (split_part(charge.source_id, ':', 3)::date - INTERVAL '1 year')::date < $5::date
                 ELSE FALSE END
        AND (
          EXISTS (SELECT 1 FROM billing_charge source
                  WHERE source.family_billing_account_id = $1 AND source.member_id = $3
                    AND source.source_type = 'additional_fee'
                    AND split_part(source.source_id, ':', 1) = split_part(charge.source_id, ':', 1))
          OR EXISTS (SELECT 1 FROM additional_fee_redemption source
                     WHERE source.member_id = $3 AND source.fee_id::text = split_part(charge.source_id, ':', 1))
        )
      ORDER BY charge.id FOR UPDATE OF charge`,
    [account.id, targetMemberId, sourceMemberId, membershipDate.slice(0, 10), renewalDate],
  )
  const cancelled = []
  let stripe = stripeClient
  for (const charge of candidates.rows) {
    const effectiveCents = Number(charge.amount_cents) + Number(charge.adjustment_cents)
    if (effectiveCents <= 0) throw new Error('The recipient’s membership fee has already been credited. Refresh and review its membership status before transferring.')
    const paid = await db.query(
      `SELECT 1 FROM billing_payment_application application
        JOIN billing_payment payment ON payment.id = application.billing_payment_id
       WHERE application.billing_charge_id = $1
         AND payment.external_status IN ('settled', 'succeeded', 'pending', 'processing', 'reconciliation_required')
       LIMIT 1`, [charge.id],
    )
    if (paid.rows[0] || ['paid', 'settled', 'succeeded', 'processing'].includes(charge.collection_status)) {
      throw new Error('The recipient’s membership bill has a payment. Reconcile that payment before transferring the membership.')
    }
    const invoiced = await db.query(
      `SELECT 1 FROM billing_monthly_invoice_line line
        JOIN billing_monthly_invoice invoice ON invoice.id = line.billing_monthly_invoice_id
       WHERE line.billing_charge_id = $1 AND invoice.status NOT IN ('void', 'cancelled') LIMIT 1`, [charge.id],
    )
    if (invoiced.rows[0]) throw new Error('The recipient’s membership bill is on an invoice. Resolve that invoice before transferring the membership.')
    const attempts = await db.query(
      `SELECT attempt.* FROM billing_payment_attempt attempt
       WHERE attempt.family_billing_account_id = $1
         AND (attempt.status IN ('pending', 'processing', 'reconciliation_required')
              OR (attempt.status = 'reserved' AND attempt.expires_at > now()))
         AND (attempt.target_charge_id = $2 OR EXISTS (
           SELECT 1 FROM billing_payment_attempt_charge reservation
           WHERE reservation.billing_payment_attempt_id = attempt.id AND reservation.billing_charge_id = $2))
       ORDER BY attempt.id FOR UPDATE`, [account.id, charge.id],
    )
    for (const attempt of attempts.rows) {
      if (!attempt.stripe_payment_intent_id || attempt.stripe_checkout_session_id) {
        throw new Error('The recipient’s membership bill has an active payment attempt. Resolve it before transferring.')
      }
      stripe ??= await getStripeClient()
      if (!stripe) throw new Error('Stripe is unavailable; the pending membership payment could not be verified.')
      const intent = await stripe.paymentIntents.retrieve(attempt.stripe_payment_intent_id)
      if (String(intent.customer?.id ?? intent.customer) !== String(account.stripe_customer_id)
        || Number(intent.metadata?.billingPaymentAttemptId) !== Number(attempt.id)
        || Number(intent.metadata?.familyBillingAccountId) !== Number(account.id)
        || Number(intent.amount) !== Number(attempt.amount_cents)
        || Number(intent.amount_received ?? 0) !== 0
        || !['requires_payment_method', 'canceled'].includes(intent.status)) {
        throw new Error('The recipient’s payment may be processing or completed. Reconcile it before transferring the membership.')
      }
      if (intent.status !== 'canceled') {
        const stopped = await stripe.paymentIntents.cancel(intent.id, {}, {
          idempotencyKey: `membership-transfer-cancel-attempt:${attempt.id}`,
        })
        if (stopped.status !== 'canceled') throw new Error('The failed membership payment could not be canceled.')
      }
      await db.query(
        `UPDATE billing_payment_attempt SET status = 'canceled', released_at = now(), updated_at = now(),
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('membershipTransferCancellation', $2::text)
         WHERE id = $1`, [attempt.id, eventKey],
      )
    }
    // Preserve the original charge and its amount. A linked credit cancels the
    // duplicate fee. Retire its annual-fee identity to free the recipient's term
    // key and prevent payment reconciliation from granting a second entitlement.
    await db.query(
      `INSERT INTO billing_charge (
         family_billing_account_id, member_id, source_type, source_id, related_charge_id,
         description, amount_cents, gross_amount_cents, discount_amount_cents, charge_type,
         billing_interval, service_period_start, service_period_end, collection_status, created_by_user_id, metadata
       ) VALUES ($1,$2,'charge_adjustment',$3,$4,$5,$6,$6,0,'credit','one_time',$7,$8,'none',$9,$10::jsonb)`,
      [account.id, targetMemberId, `membership-transfer-cancel:${charge.id}:${eventKey}`, charge.id,
        `Credit for ${charge.description}: replaced by transferred membership`, -effectiveCents,
        charge.service_period_start, charge.service_period_end, actorUserId,
        JSON.stringify({ originalChargeId: Number(charge.id), reason: 'Unpaid fee replaced by transferred membership', finalAmountCents: 0, membershipTransferEventKey: eventKey })],
    )
    await db.query(
      `UPDATE billing_charge SET source_type = 'membership_transfer_cancelled', collection_status = 'cancelled',
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'membershipTransferCancellation', $2::text, 'originalSourceType', 'additional_fee')
       WHERE id = $1`, [charge.id, eventKey],
    )
    cancelled.push({ chargeId: Number(charge.id), creditedAmountCents: effectiveCents, cancelledAttemptIds: attempts.rows.map((row) => Number(row.id)) })
  }
  return cancelled
}
