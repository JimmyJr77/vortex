/** An equal-value class move is still the original Checkout purchase. Carry
 * its ownership onto both sides of the zero-net transfer so reconciliation
 * does not misclassify the moved payment as unrelated household spending.
 * Unequal-value moves need separate settlement and are deliberately excluded. */
export async function bindEqualValueClassTransferCheckout(db, {
  accountId, sourceChargeId, replacementChargeId, adjustmentChargeId,
}) {
  if (!sourceChargeId || !replacementChargeId || !adjustmentChargeId) return { bound: false }
  const rows = (await db.query(`SELECT id, family_billing_account_id, member_id,
    source_type, source_id, amount_cents, related_charge_id, service_period_end,
    stripe_checkout_session_id, metadata FROM billing_charge
    WHERE family_billing_account_id = $1 AND id = ANY($2::bigint[]) FOR UPDATE`,
  [accountId, [sourceChargeId, replacementChargeId, adjustmentChargeId]])).rows
  const source = rows.find((r) => Number(r.id) === Number(sourceChargeId))
  const replacement = rows.find((r) => Number(r.id) === Number(replacementChargeId))
  const adjustment = rows.find((r) => Number(r.id) === Number(adjustmentChargeId))
  if (!source?.stripe_checkout_session_id || !replacement || !adjustment) return { bound: false }
  if (Number(replacement.amount_cents) <= 0
    || Number(replacement.amount_cents) !== -Number(adjustment.amount_cents)) return { bound: false }
  const session = source.stripe_checkout_session_id
  if (Number(source.member_id) !== Number(replacement.member_id)
    || Number(source.member_id) !== Number(adjustment.member_id)
    || Number(adjustment.related_charge_id) !== Number(source.id)
    || adjustment.metadata?.adjustmentKind !== 'class_swap_proration'
    || String(adjustment.metadata?.replacementSignupId) !== String(replacement.source_id)
    || Number(replacement.metadata?.classTransfer?.sourceChargeId) !== Number(source.id)
    || Number(source.metadata?.classTransfer?.replacementChargeId) !== Number(replacement.id)
    || String(source.service_period_end) !== String(replacement.service_period_end)
    || String(source.service_period_end) !== String(adjustment.service_period_end)
    || [replacement, adjustment].some((r) => r.stripe_checkout_session_id != null
      && r.stripe_checkout_session_id !== session)) {
    throw new Error('Equal-value class transfer Checkout ownership is inconsistent.')
  }
  await db.query(`UPDATE billing_charge SET stripe_checkout_session_id = $3
    WHERE family_billing_account_id = $1 AND id = ANY($2::bigint[])
      AND stripe_checkout_session_id IS NULL`, [accountId, [replacementChargeId, adjustmentChargeId], session])
  return { bound: true, stripeCheckoutSessionId: session }
}
