/**
 * Resolve active member IDs for a family account in the member portal.
 * Uses both family_member junction rows and member.family_id (legacy / partial sync).
 */
export async function listActiveFamilyMemberIds(pool, familyId, { fallbackMemberId = null } = {}) {
  if (familyId == null) {
    return fallbackMemberId != null ? [Number(fallbackMemberId)] : []
  }

  const result = await pool.query(
    `
    SELECT DISTINCT m.id
    FROM member m
    WHERE m.is_active = TRUE
      AND (
        m.family_id = $1
        OR m.id IN (
          SELECT fm.member_id
          FROM family_member fm
          WHERE fm.family_id = $1 AND fm.is_active = TRUE
        )
      )
    ORDER BY m.id
    `,
    [familyId],
  )

  const ids = result.rows.map((row) => Number(row.id))
  const fallback = fallbackMemberId != null ? Number(fallbackMemberId) : null
  if (fallback != null && !ids.includes(fallback)) {
    ids.push(fallback)
  }
  return ids
}

/** Backfill family_member rows for every active member on this family_id. */
export async function syncFamilyMemberLinks(client, familyId) {
  if (familyId == null) return
  await client.query(
    `
    INSERT INTO family_member (family_id, member_id, is_active)
    SELECT $1, m.id, TRUE
    FROM member m
    WHERE m.family_id = $1
      AND m.is_active = TRUE
    ON CONFLICT (family_id, member_id) DO UPDATE SET
      is_active = TRUE,
      updated_at = CURRENT_TIMESTAMP
    `,
    [familyId],
  )
}
