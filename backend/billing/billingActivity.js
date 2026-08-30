function json(value) {
  return value == null ? null : JSON.stringify(value)
}

export async function recordBillingActivity(db, {
  eventKey = null,
  accountId,
  memberId = null,
  signupId = null,
  chargeId = null,
  paymentId = null,
  refundId = null,
  eventType,
  summary,
  beforeValue = null,
  afterValue = null,
  details = {},
  stripeObjectId = null,
  actorUserId = null,
  actorType = 'admin',
  occurredAt = null,
}) {
  if (!accountId || !eventType || !summary) return null
  const result = await db.query(
    `INSERT INTO billing_account_activity (
       event_key, family_billing_account_id, member_id, signup_id,
       related_charge_id, related_payment_id, related_refund_id,
       event_type, summary, before_value, after_value, details,
       stripe_object_id, actor_user_id, actor_type, occurred_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9,
       $10::jsonb, $11::jsonb, COALESCE($12::jsonb, '{}'::jsonb),
       $13, $14, $15, COALESCE($16::timestamptz, now())
     )
     ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING
     RETURNING *`,
    [
      eventKey,
      accountId,
      memberId,
      signupId,
      chargeId,
      paymentId,
      refundId,
      eventType,
      summary,
      json(beforeValue),
      json(afterValue),
      json(details),
      stripeObjectId,
      actorUserId,
      actorType,
      occurredAt,
    ],
  )
  return result.rows[0] ?? null
}

export async function recordBillingActivityBestEffort(db, input) {
  try {
    return await recordBillingActivity(db, input)
  } catch (error) {
    if (error?.code === '42P01' || error?.code === '42703') return null
    console.warn('[customer-billing] activity write failed:', error?.message ?? error)
    return null
  }
}

export function mapBillingActivity(row) {
  return {
    id: Number(row.id),
    eventKey: row.event_key ?? null,
    familyBillingAccountId: Number(row.family_billing_account_id),
    memberId: row.member_id == null ? null : Number(row.member_id),
    signupId: row.signup_id == null ? null : Number(row.signup_id),
    relatedChargeId: row.related_charge_id == null ? null : Number(row.related_charge_id),
    relatedPaymentId: row.related_payment_id == null ? null : Number(row.related_payment_id),
    relatedRefundId: row.related_refund_id == null ? null : Number(row.related_refund_id),
    eventType: row.event_type,
    summary: row.summary,
    beforeValue: row.before_value ?? null,
    afterValue: row.after_value ?? null,
    details: row.details ?? {},
    stripeObjectId: row.stripe_object_id ?? null,
    actorUserId: row.actor_user_id == null ? null : Number(row.actor_user_id),
    actorName: row.actor_name ?? null,
    actorType: row.actor_type,
    occurredAt: row.occurred_at,
  }
}
