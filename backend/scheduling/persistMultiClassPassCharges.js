/**
 * Persist multi-class pass purchases and pass-covered enrollment charges to billing_charge.
 */
import { loadOrCreateUnassignedBillingAccount } from '../billing/billingAccountProvisioning.js'

export async function persistMultiClassPassPurchaseCharge(pool, {
  memberId,
  passId,
  programsId,
  packageLabel,
  priceCents,
  programDisplayName,
  stripeCheckoutSessionId = null,
}) {
  if (!memberId || passId == null || priceCents == null) return null

  const memberRes = await pool.query('SELECT family_id, first_name, last_name FROM member WHERE id = $1', [
    memberId,
  ])
  const familyId = memberRes.rows[0]?.family_id
  if (!familyId) return null

  const account = await loadOrCreateUnassignedBillingAccount(pool, familyId)
  if (!account) return null

  const athleteName = [memberRes.rows[0]?.first_name, memberRes.rows[0]?.last_name]
    .filter(Boolean)
    .join(' ')
  const description = [
    'Multi-class pass purchase',
    programDisplayName || `Program #${programsId}`,
    packageLabel,
    athleteName ? `— ${athleteName}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  const result = await pool.query(
    `
      INSERT INTO billing_charge (
        family_billing_account_id, member_id, source_type, source_id,
        description, amount_cents, service_period_start, service_period_end,
        stripe_checkout_session_id
      )
      VALUES ($1, $2, 'multi_class_pass_purchase', $3, $4, $5, CURRENT_DATE, NULL, $6)
      ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
      DO UPDATE SET stripe_checkout_session_id = COALESCE(
        billing_charge.stripe_checkout_session_id,
        EXCLUDED.stripe_checkout_session_id
      )
      WHERE EXCLUDED.stripe_checkout_session_id IS NOT NULL
        AND (
          billing_charge.stripe_checkout_session_id IS NULL
          OR billing_charge.stripe_checkout_session_id = EXCLUDED.stripe_checkout_session_id
        )
      RETURNING id, family_billing_account_id, member_id, amount_cents,
                stripe_checkout_session_id
    `,
    [
      account.id,
      memberId,
      String(passId),
      description,
      Math.max(0, Math.round(priceCents)),
      stripeCheckoutSessionId,
    ],
  )

  const charge = result.rows[0] ?? null
  if (stripeCheckoutSessionId && (
    !charge
    || Number(charge.family_billing_account_id) !== Number(account.id)
    || Number(charge.member_id) !== Number(memberId)
    || Number(charge.amount_cents) !== Math.max(0, Math.round(priceCents))
    || String(charge.stripe_checkout_session_id ?? '') !== String(stripeCheckoutSessionId)
  )) {
    throw new Error(`Multi-class pass ${passId} conflicts with its paid Checkout Session.`)
  }
  const chargeId = charge?.id != null ? Number(charge.id) : null
  if (chargeId != null) {
    await pool.query(
      `UPDATE member_multi_class_pass SET billing_charge_id = $1 WHERE id = $2 AND billing_charge_id IS NULL`,
      [chargeId, passId],
    )
  }
  return chargeId
}

export async function persistPassRedemptionCharge(pool, {
  memberId,
  signupId,
  formTitle,
  slotLabel,
  packageLabel,
  classesRemainingAfter,
}) {
  if (!memberId || signupId == null) return null

  const memberRes = await pool.query('SELECT family_id, first_name, last_name FROM member WHERE id = $1', [
    memberId,
  ])
  const familyId = memberRes.rows[0]?.family_id
  if (!familyId) return null

  const account = await loadOrCreateUnassignedBillingAccount(pool, familyId)
  if (!account) return null

  const description = [
    'Class registration (multi-class pass)',
    formTitle,
    slotLabel,
    packageLabel ? `Pass: ${packageLabel}` : null,
    `Remaining after enrollment: ${classesRemainingAfter}`,
  ]
    .filter(Boolean)
    .join(' · ')

  await pool.query(
    `
      INSERT INTO billing_charge (
        family_billing_account_id, member_id, source_type, source_id,
        description, amount_cents, service_period_start, service_period_end
      )
      VALUES ($1, $2, 'scheduling_signup', $3, $4, 0, CURRENT_DATE, NULL)
      ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
      DO NOTHING
    `,
    [account.id, memberId, String(signupId), description],
  )
}
