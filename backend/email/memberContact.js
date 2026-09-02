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

/** Prefer member.email, then linked app_user.email. */
export const MEMBER_CONTACT_EMAIL_SQL = `
  COALESCE(
    NULLIF(TRIM(m.email), ''),
    NULLIF(TRIM(au.email), '')
  )
`

/**
 * Resolve a login user's contact email (app_user row + linked member).
 * @returns {string | null}
 */
export async function resolveAppUserEmail(db, userId) {
  if (!userId) return null
  const res = await db.query(
    `
      SELECT COALESCE(
        NULLIF(TRIM(m.email), ''),
        NULLIF(TRIM(au.email), '')
      ) AS email
      FROM app_user au
      LEFT JOIN member m ON m.app_user_id = au.id
      WHERE au.id = $1
      ORDER BY m.id
      LIMIT 1
    `,
    [userId],
  )
  const email = res.rows[0]?.email
  return isValidEmail(email) ? String(email).trim() : null
}

function positiveId(value) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function mapContact(row, contactRole) {
  if (!row || !isValidEmail(row.email)) return null
  return {
    email: String(row.email).trim(),
    contactName: row.first_name || null,
    memberId: positiveId(row.id),
    contactRole,
  }
}

/** Resolve only the member's own address or explicitly linked login address. */
export async function resolveMemberOwnContactEmail(db, memberRow) {
  if (!memberRow) return null

  if (isValidEmail(memberRow.email)) {
    return {
      email: String(memberRow.email).trim(),
      contactName: memberRow.first_name || null,
      memberId: positiveId(memberRow.id),
      contactRole: 'member',
    }
  }

  const memberId = positiveId(memberRow.id)
  if (memberId == null) return null
  const result = await db.query(
    `SELECT m.id, m.first_name, ${MEMBER_CONTACT_EMAIL_SQL} AS email
       FROM member m
       LEFT JOIN app_user au ON au.id = m.app_user_id
      WHERE m.id = $1
        AND m.is_active = TRUE
      LIMIT 1`,
    [memberId],
  )
  return mapContact(result.rows[0], 'member')
}

/**
 * List active legal guardians who share the member's active household.
 * parent_guardian_authority and family_member are the only authority sources.
 */
export async function listMemberGuardianContacts(db, memberId) {
  const normalizedMemberId = positiveId(memberId)
  if (normalizedMemberId == null) return []

  const result = await db.query(
    `SELECT DISTINCT guardian.id, guardian.first_name,
            COALESCE(
              NULLIF(TRIM(guardian.email), ''),
              NULLIF(TRIM(guardian_user.email), '')
            ) AS email
       FROM parent_guardian_authority authority
       JOIN member child
         ON child.id = authority.child_member_id
        AND child.is_active = TRUE
       JOIN facility facility_row ON facility_row.id = child.facility_id
       JOIN family_member child_membership
         ON child_membership.member_id = child.id
        AND child_membership.is_active = TRUE
       JOIN member guardian
         ON guardian.id = authority.parent_member_id
        AND guardian.facility_id = child.facility_id
        AND guardian.is_active = TRUE
        AND guardian.date_of_birth IS NOT NULL
        AND guardian.date_of_birth <= (
          (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(facility_row.timezone, ''), 'America/New_York'))::date
          - INTERVAL '18 years'
        )::date
       JOIN family_member guardian_membership
         ON guardian_membership.member_id = guardian.id
        AND guardian_membership.family_id = child_membership.family_id
        AND guardian_membership.is_active = TRUE
       LEFT JOIN app_user guardian_user ON guardian_user.id = guardian.app_user_id
      WHERE authority.child_member_id = $1
        AND authority.has_legal_authority = TRUE
      ORDER BY guardian.id`,
    [normalizedMemberId],
  )
  return result.rows
    .map((row) => mapContact(row, 'guardian'))
    .filter(Boolean)
}

/**
 * Resolve the active household payer for a non-legal, billing-responsibility
 * fallback. This is deliberately separate from guardian authority.
 */
export async function resolveMemberHouseholdPayerContact(db, memberId, {
  excludeMemberId = null,
} = {}) {
  const normalizedMemberId = positiveId(memberId)
  if (normalizedMemberId == null) return null

  const result = await db.query(
    `SELECT payer.id, payer.first_name,
            COALESCE(
              NULLIF(TRIM(payer.email), ''),
              NULLIF(TRIM(payer_user.email), ''),
              NULLIF(TRIM(account.billing_email), '')
            ) AS email
       FROM member subject
       JOIN family_member subject_membership
         ON subject_membership.member_id = subject.id
        AND subject_membership.is_active = TRUE
       JOIN family_billing_account account
         ON account.family_id = subject_membership.family_id
        AND account.is_active = TRUE
       JOIN member payer
         ON payer.id = account.payer_member_id
        AND payer.facility_id = subject.facility_id
        AND payer.is_active = TRUE
       JOIN family_member payer_membership
         ON payer_membership.member_id = payer.id
        AND payer_membership.family_id = subject_membership.family_id
        AND payer_membership.is_active = TRUE
       LEFT JOIN app_user payer_user ON payer_user.id = payer.app_user_id
      WHERE subject.id = $1
        AND subject.is_active = TRUE
        AND ($2::bigint IS NULL OR payer.id <> $2)
      ORDER BY account.id
      LIMIT 1`,
    [normalizedMemberId, positiveId(excludeMemberId)],
  )
  return mapContact(result.rows[0], 'payer')
}

/**
 * Resolve a member notification contact. Billing payer fallback is opt-in and
 * never implies guardian or legal authority.
 * @returns {{ email: string, contactName: string|null, memberId: number|null, contactRole: 'member'|'guardian'|'payer' } | null}
 */
export async function resolveMemberContactEmail(db, memberRow, {
  includeBillingPayer = false,
} = {}) {
  if (!memberRow) return null

  const ownContact = await resolveMemberOwnContactEmail(db, memberRow)
  if (ownContact) return ownContact

  const guardians = await listMemberGuardianContacts(db, memberRow.id)
  if (guardians.length > 0) return guardians[0]

  if (includeBillingPayer) {
    return resolveMemberHouseholdPayerContact(db, memberRow.id)
  }

  return null
}

export async function loadMemberRow(db, memberId) {
  const res = await db.query(
    `SELECT id, app_user_id, first_name, last_name, email, username
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
