const SQL_IDENTIFIER = /^[a-z_][a-z0-9_]*$/i
const SQL_REFERENCE = /^(?:\$\d+|[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)$/i

function checkedSqlIdentifier(value, label) {
  const normalized = String(value ?? '')
  if (!SQL_IDENTIFIER.test(normalized)) {
    throw new TypeError(`Invalid ${label}.`)
  }
  return normalized
}

function checkedSqlReference(value, label) {
  const normalized = String(value ?? '')
  if (!SQL_REFERENCE.test(normalized)) {
    throw new TypeError(`Invalid ${label}.`)
  }
  return normalized
}

/**
 * Canonical active household membership SQL.
 *
 * Once a member has any family_member history, only an active row in that
 * table establishes their current household. member.family_id remains a
 * compatibility fallback solely for records that have never been normalized.
 * Arguments are internal SQL identifiers/references and are validated before
 * interpolation; values still belong in query parameters.
 */
export function canonicalActiveHouseholdMemberPredicate({
  memberAlias = 'member',
  familyIdReference = '$1',
  membershipAlias = 'household_membership',
  historyAlias = 'household_membership_history',
} = {}) {
  const member = checkedSqlIdentifier(memberAlias, 'member SQL alias')
  const familyId = checkedSqlReference(familyIdReference, 'family-id SQL reference')
  const membership = checkedSqlIdentifier(membershipAlias, 'membership SQL alias')
  const history = checkedSqlIdentifier(historyAlias, 'membership-history SQL alias')

  return `(
    ${member}.is_active = TRUE
    AND (
      EXISTS (
        SELECT 1
          FROM family_member ${membership}
         WHERE ${membership}.member_id = ${member}.id
           AND ${membership}.family_id = ${familyId}
           AND ${membership}.is_active = TRUE
      )
      OR (
        ${member}.family_id = ${familyId}
        AND NOT EXISTS (
          SELECT 1
            FROM family_member ${history}
           WHERE ${history}.member_id = ${member}.id
        )
      )
    )
  )`
}

/** Resolve one unambiguous active household for an active member. */
export async function resolveCanonicalActiveMemberFamilyId(pool, {
  memberId,
  facilityId = null,
} = {}) {
  const normalizedMemberId = Number(memberId)
  const normalizedFacilityId = facilityId == null ? null : Number(facilityId)
  if (!Number.isInteger(normalizedMemberId) || normalizedMemberId <= 0) return null
  if (
    normalizedFacilityId != null &&
    (!Number.isInteger(normalizedFacilityId) || normalizedFacilityId <= 0)
  ) return null

  const result = await pool.query(
    `WITH viewer AS (
       SELECT member.id, member.family_id
         FROM member
        WHERE member.id = $1
          AND member.is_active = TRUE
          AND ($2::bigint IS NULL OR member.facility_id = $2)
     ), candidate_families AS (
       SELECT membership.family_id
         FROM viewer
         JOIN family_member membership ON membership.member_id = viewer.id
        WHERE membership.is_active = TRUE

       UNION

       SELECT viewer.family_id
         FROM viewer
        WHERE viewer.family_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
              FROM family_member membership_history
             WHERE membership_history.member_id = viewer.id
          )
     )
     SELECT DISTINCT family.id AS family_id
       FROM candidate_families candidate
       JOIN family ON family.id = candidate.family_id
      WHERE ($2::bigint IS NULL OR family.facility_id = $2)
      ORDER BY family.id
      LIMIT 2`,
    [normalizedMemberId, normalizedFacilityId],
  )
  return result.rows.length === 1 ? Number(result.rows[0].family_id) : null
}
