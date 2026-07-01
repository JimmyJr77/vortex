/**
 * Bridge created scheduling signups into the persisted family billing ledger.
 *
 * For each signup we write one `billing_charge` row (idempotent on
 * source_type/source_id) using the per-line net monthly price from the order
 * preview (after free passes and per-line discounts). once-per-year additional
 * fees are recorded in `additional_fee_redemption` so they are not re-charged.
 *
 * Limitations (documented in docs/DATABASE_ARCHITECTURE.md §billing):
 * - Order-level discounts and recurring/per-order fees are not yet split into
 *   billing_charge rows; only per-line class pricing is persisted today.
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

function netCentsForSlot(preview, slotKey) {
  if (!preview) return null
  // Prefer the discount engine's per-line result (post free pass + per-line discounts).
  if (preview.discounts?.enabled && Array.isArray(preview.discounts.lines)) {
    const line = preview.discounts.lines.find((l) => l.key === slotKey)
    if (line) {
      const base = Math.round(Number(line.baseCents) || 0)
      const discount = (line.applied || []).reduce(
        (sum, a) => sum + (Math.round(Number(a.amountCents) || 0)),
        0,
      )
      return Math.max(0, base - discount)
    }
  }
  // Fall back to the free-pass-adjusted incremental monthly from the preview.
  const item = (preview.newSignups || []).find((s) => s.slotKey === slotKey)
  if (item) return Math.max(0, Math.round((Number(item.incrementalMonthly) || 0) * 100))
  return null
}

/**
 * @param {import('pg').Pool} pool
 * @param {object} args
 * @param {number} args.memberId enrolled athlete
 * @param {Array<{signupId:number, formId:number, slotGroupId:number, timeSlotId:number, formTitle:string, slotLabel:string}>} args.signups
 * @param {object|null} args.preview full order preview built at batch time
 */
function chargeDescription(preview, signup) {
  const summary = preview?.formSummaries?.find((s) => s.formId === signup.formId)
  if (summary?.usesWeeklyTierPricing && summary.weeklyTierLabel) {
    const slotPart = signup.slotLabel ? ` · ${signup.slotLabel}` : ''
    return `${summary.formTitle} — ${summary.weeklyTierLabel}${slotPart}`
  }
  return [signup.formTitle, signup.slotLabel].filter(Boolean).join(' — ') || 'Class enrollment'
}

export async function persistSignupCharges(pool, { memberId, signups = [], preview = null }) {
  if (!memberId || signups.length === 0) return { charges: 0 }

  let familyId = null
  try {
    const res = await pool.query('SELECT family_id FROM member WHERE id = $1', [memberId])
    familyId = res.rows[0]?.family_id != null ? Number(res.rows[0].family_id) : null
  } catch {
    familyId = null
  }
  if (familyId == null) return { charges: 0 }

  const account = await ensureBillingAccount(pool, familyId)
  if (!account) return { charges: 0 }

  let charges = 0
  for (const signup of signups) {
    const slotKey = `${signup.formId}:${signup.slotGroupId}:${signup.timeSlotId ?? 'none'}`
    const amountCents = netCentsForSlot(preview, slotKey)
    if (amountCents == null) continue

    const description = chargeDescription(preview, signup)
    const result = await pool.query(
      `
        INSERT INTO billing_charge
          (family_billing_account_id, member_id, source_type, source_id, description, amount_cents)
        VALUES ($1, $2, 'scheduling_signup', $3, $4, $5)
        ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
        DO NOTHING
        RETURNING id
      `,
      [account.id, memberId, String(signup.signupId), description, amountCents],
    )
    if (result.rows.length > 0) charges += 1
  }

  // Record once-per-year additional fees so they are not charged again.
  const feeItems = preview?.additionalFees?.enabled ? preview.additionalFees.items || [] : []
  const firstSignupId = signups[0]?.signupId ?? null
  const year = new Date().getUTCFullYear()
  for (const fee of feeItems) {
    if (fee.triggerType !== 'once_per_year') continue
    if (fee.feeId == null) continue
    try {
      await pool.query(
        `
          INSERT INTO additional_fee_redemption
            (fee_id, member_id, signup_id, period_key, amount_cents)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (fee_id, member_id, period_key) DO NOTHING
        `,
        [fee.feeId, memberId, firstSignupId, `${fee.feeId}:${year}`, Math.round(Number(fee.amountCents) || 0)],
      )
    } catch (err) {
      console.warn('[scheduling] persistSignupCharges fee redemption:', err.message)
    }
  }

  return { charges }
}
