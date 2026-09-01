export async function ensureBillingAdminActionSchema() {
  // Compatibility hook. Startup billing readiness owns this schema contract.
}

export async function beginBillingAdminAction(pool, {
  accountId,
  actionType,
  amountCents = null,
  recipientEmail = null,
  stripeObjectId = null,
  paymentId = null,
  refundId = null,
  initiatedByUserId = null,
  details = {},
}) {
  await ensureBillingAdminActionSchema(pool)
  const result = await pool.query(
    `INSERT INTO billing_admin_action
       (family_billing_account_id, action_type, amount_cents, recipient_email,
        stripe_object_id, related_payment_id, related_refund_id, initiated_by_user_id, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      accountId,
      actionType,
      amountCents,
      recipientEmail,
      stripeObjectId,
      paymentId,
      refundId,
      initiatedByUserId,
      JSON.stringify(details),
    ],
  )
  return result.rows[0]
}

export async function finishBillingAdminAction(pool, actionId, {
  status,
  errorMessage = null,
  recipientEmail = null,
  details = null,
}) {
  const result = await pool.query(
    `UPDATE billing_admin_action
     SET status = $2,
         error_message = $3,
         recipient_email = COALESCE($4, recipient_email),
         details = CASE WHEN $5::jsonb IS NULL THEN details ELSE details || $5::jsonb END,
         completed_at = now()
     WHERE id = $1
     RETURNING *`,
    [actionId, status, errorMessage, recipientEmail, details == null ? null : JSON.stringify(details)],
  )
  return result.rows[0] ?? null
}

export async function listBillingAdminActions(pool, accountId, { limit = 50 } = {}) {
  await ensureBillingAdminActionSchema(pool)
  const result = await pool.query(
    `SELECT * FROM billing_admin_action
     WHERE family_billing_account_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [accountId, Math.min(100, Math.max(1, Number(limit) || 50))],
  )
  return result.rows
}
