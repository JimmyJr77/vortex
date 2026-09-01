/**
 * Deterministically provision the ledger container for a known family.
 *
 * This primitive never chooses a payer or copies contact details from an
 * arbitrary household member. A missing payer remains visible to the canonical
 * audit and must be assigned through the billing-account editor (or an explicit
 * family-signup workflow that already knows the payer).
 */
export async function loadOrCreateUnassignedBillingAccount(pool, familyId) {
  const normalizedFamilyId = Number(familyId)
  if (!Number.isSafeInteger(normalizedFamilyId) || normalizedFamilyId <= 0) return null

  const existing = await pool.query(
    `SELECT * FROM family_billing_account WHERE family_id = $1 AND is_active = TRUE LIMIT 1`,
    [normalizedFamilyId],
  )
  if (existing.rows[0]) return existing.rows[0]

  const result = await pool.query(
    `WITH inserted AS (
       INSERT INTO family_billing_account (
         family_id, payer_member_id, is_active, household_monthly_billing_enabled
       )
       SELECT family.id, NULL, TRUE, FALSE
         FROM family
        WHERE family.id = $1
          AND family.archived = FALSE
       ON CONFLICT (family_id) DO NOTHING
       RETURNING *
     )
     SELECT * FROM inserted
     UNION ALL
     SELECT account.*
       FROM family_billing_account account
      WHERE account.family_id = $1
        AND account.is_active = TRUE
        AND NOT EXISTS (SELECT 1 FROM inserted)
     LIMIT 1`,
    [normalizedFamilyId],
  )
  return result.rows[0] ?? null
}
