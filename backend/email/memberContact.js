export function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim())
}

export function dedupeEmails(addresses) {
  const seen = new Set()
  const out = []
  for (const raw of addresses) {
    const email = String(raw || '').trim()
    if (!isValidEmail(email)) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(email)
  }
  return out
}

/**
 * Resolve contact email for a member (own email, else guardian, else family adult).
 * @returns {{ email: string, guardianName: string | null, memberId: number | null } | null}
 */
export async function resolveMemberContactEmail(db, memberRow) {
  if (!memberRow) return null

  if (isValidEmail(memberRow.email)) {
    return {
      email: String(memberRow.email).trim(),
      guardianName: null,
      memberId: memberRow.id != null ? Number(memberRow.id) : null,
    }
  }

  const guardianIds = Array.isArray(memberRow.parent_guardian_ids) ? memberRow.parent_guardian_ids : []
  if (guardianIds.length > 0) {
    const guardians = await db.query(
      `SELECT id, email, first_name FROM member
       WHERE id = ANY($1::bigint[]) AND email IS NOT NULL AND email <> ''
       ORDER BY id ASC`,
      [guardianIds],
    )
    const guardian = guardians.rows.find((row) => isValidEmail(row.email))
    if (guardian) {
      return {
        email: String(guardian.email).trim(),
        guardianName: guardian.first_name || null,
        memberId: Number(guardian.id),
      }
    }
  }

  const familyId = memberRow.family_id ?? memberRow.familyId
  if (familyId) {
    const adults = await db.query(
      `SELECT id, email, first_name FROM member
       WHERE family_id = $1 AND email IS NOT NULL AND email <> ''
         AND is_active = TRUE
         AND (parent_guardian_ids IS NULL OR array_length(parent_guardian_ids, 1) IS NULL)
       ORDER BY id ASC`,
      [familyId],
    )
    const adult = adults.rows.find((row) => isValidEmail(row.email))
    if (adult) {
      return {
        email: String(adult.email).trim(),
        guardianName: adult.first_name || null,
        memberId: Number(adult.id),
      }
    }
  }

  return null
}

/**
 * List distinct guardian/parent emails for a family (adults + billing payer).
 */
export async function listFamilyGuardianEmails(db, familyId, { excludeMemberId = null } = {}) {
  if (!familyId) return []

  const emails = []

  const payer = await db.query(
    `SELECT m.id, m.email, m.first_name
     FROM family_billing_account fba
     JOIN member m ON m.id = fba.payer_member_id
     WHERE fba.family_id = $1 AND fba.is_active = TRUE
     LIMIT 1`,
    [familyId],
  )
  if (payer.rows[0] && isValidEmail(payer.rows[0].email)) {
    emails.push(String(payer.rows[0].email).trim())
  }

  const adults = await db.query(
    `SELECT DISTINCT m.id, m.email
     FROM family_member fm
     JOIN member m ON m.id = fm.member_id
     WHERE fm.family_id = $1
       AND fm.is_active = TRUE
       AND m.is_active = TRUE
       AND m.email IS NOT NULL AND m.email <> ''
       AND (m.parent_guardian_ids IS NULL OR array_length(m.parent_guardian_ids, 1) IS NULL)
       AND ($2::bigint IS NULL OR m.id <> $2)`,
    [familyId, excludeMemberId ?? null],
  )
  for (const row of adults.rows) {
    if (isValidEmail(row.email)) emails.push(String(row.email).trim())
  }

  return dedupeEmails(emails)
}

export async function loadMemberRow(db, memberId) {
  const res = await db.query(
    `SELECT id, first_name, last_name, email, family_id, parent_guardian_ids, username
     FROM member WHERE id = $1`,
    [memberId],
  )
  return res.rows[0] || null
}

export async function countActiveFamilyMembers(db, familyId, { beforeMemberId = null } = {}) {
  const res = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM family_member fm
     JOIN member m ON m.id = fm.member_id
     WHERE fm.family_id = $1
       AND fm.is_active = TRUE
       AND m.is_active = TRUE
       AND ($2::bigint IS NULL OR m.id <> $2)`,
    [familyId, beforeMemberId ?? null],
  )
  return Number(res.rows[0]?.count ?? 0)
}
