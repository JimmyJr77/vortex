/**
 * Resolve active member IDs for a family account in the member portal.
 * Active family_member rows are authoritative. member.family_id is accepted
 * only for records that have no family_member history yet.
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
        EXISTS (
          SELECT 1
          FROM family_member fm
          WHERE fm.family_id = $1
            AND fm.member_id = m.id
            AND fm.is_active = TRUE
        )
        OR (
          m.family_id = $1
          AND NOT EXISTS (
            SELECT 1 FROM family_member family_history
            WHERE family_history.member_id = m.id
          )
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

/** Backfill only unambiguous direct-family records with no membership history. */
export async function syncFamilyMemberLinks(client, familyId) {
  if (familyId == null) return
  await client.query(
    `
    INSERT INTO family_member (family_id, member_id, is_active)
    SELECT $1, m.id, TRUE
    FROM member m
    WHERE m.family_id = $1
      AND m.is_active = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM family_member family_history
        WHERE family_history.member_id = m.id
      )
    ON CONFLICT (family_id, member_id) DO UPDATE SET
      is_active = TRUE,
      updated_at = CURRENT_TIMESTAMP
    `,
    [familyId],
  )
}
