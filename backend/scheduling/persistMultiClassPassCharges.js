/**
 * Persist multi-class pass purchases and pass-covered enrollment charges to billing_charge.
 */

async function ensureBillingAccount(pool, familyId) {
  const existing = await pool.query(
    `SELECT * FROM family_billing_account WHERE family_id = $1`,
    [familyId],
  )
  if (existing.rows.length > 0) return existing.rows[0]

  const created = await pool.query(
    `
      INSERT INTO family_billing_account (
        family_id, payer_member_id, billing_email, billing_phone,
        billing_street, billing_city, billing_state, billing_zip
      )
      SELECT
        f.id, m.id, m.email, m.phone,
        m.billing_street, m.billing_city, m.billing_state, m.billing_zip
      FROM family f
      LEFT JOIN LATERAL (
        SELECT * FROM member
        WHERE family_id = f.id AND is_active = TRUE
        ORDER BY (email IS NULL), id
        LIMIT 1
      ) m ON TRUE
      WHERE f.id = $1
      ON CONFLICT (family_id) DO UPDATE SET updated_at = now()
      RETURNING *
    `,
    [familyId],
  )
  return created.rows[0] ?? null
}

export async function persistMultiClassPassPurchaseCharge(pool, {
  memberId,
  passId,
  programsId,
  packageLabel,
  priceCents,
  programDisplayName,
}) {
  if (!memberId || passId == null || priceCents == null) return null

  const memberRes = await pool.query('SELECT family_id, first_name, last_name FROM member WHERE id = $1', [
    memberId,
  ])
  const familyId = memberRes.rows[0]?.family_id
  if (!familyId) return null

  const account = await ensureBillingAccount(pool, familyId)
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
        description, amount_cents, service_period_start, service_period_end
      )
      VALUES ($1, $2, 'multi_class_pass_purchase', $3, $4, $5, CURRENT_DATE, NULL)
      ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
      DO NOTHING
      RETURNING id
    `,
    [account.id, memberId, String(passId), description, Math.max(0, Math.round(priceCents))],
  )

  const chargeId = result.rows[0]?.id != null ? Number(result.rows[0].id) : null
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

  const account = await ensureBillingAccount(pool, familyId)
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
