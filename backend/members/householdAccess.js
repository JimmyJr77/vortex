function positiveId(value) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/**
 * Load household-management authority from canonical relationships only.
 *
 * Being an adult, having a Member Portal login, or sharing an email address
 * never grants authority. The payer may manage the household, a guardian may
 * manage only dependents for whom an active legal-authority row exists, and
 * every active household member may edit their own profile.
 */
export async function loadHouseholdAccess(db, {
  familyId,
  facilityId,
  viewerMemberId,
}) {
  const family = positiveId(familyId)
  const facility = positiveId(facilityId)
  const viewer = positiveId(viewerMemberId)
  if (!family || !facility || !viewer) return null

  const result = await db.query(
    `WITH viewer AS (
       SELECT
         member_row.id,
         member_row.date_of_birth,
         (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(facility_row.timezone, ''), 'America/New_York'))::date AS today
       FROM member member_row
       JOIN family_member membership
         ON membership.member_id = member_row.id
        AND membership.family_id = $1
        AND membership.is_active = TRUE
       JOIN family family_row
         ON family_row.id = membership.family_id
        AND family_row.facility_id = $2
        AND family_row.archived = FALSE
       JOIN facility facility_row ON facility_row.id = family_row.facility_id
       WHERE member_row.id = $3
         AND member_row.facility_id = $2
         AND member_row.is_active = TRUE
     ), managed AS (
       SELECT DISTINCT authority.child_member_id
       FROM viewer
       JOIN parent_guardian_authority authority
         ON authority.parent_member_id = viewer.id
        AND authority.has_legal_authority = TRUE
       JOIN member child
         ON child.id = authority.child_member_id
        AND child.facility_id = $2
        AND child.is_active = TRUE
       JOIN family_member child_membership
         ON child_membership.member_id = child.id
        AND child_membership.family_id = $1
       AND child_membership.is_active = TRUE
       WHERE viewer.date_of_birth IS NOT NULL
         AND viewer.date_of_birth <= (viewer.today - INTERVAL '18 years')::date
         AND child.date_of_birth IS NOT NULL
         AND child.date_of_birth > (viewer.today - INTERVAL '18 years')::date
     )
     SELECT
       EXISTS (SELECT 1 FROM viewer) AS is_household_member,
       EXISTS (
         SELECT 1
         FROM viewer
         JOIN family_billing_account billing
           ON billing.family_id = $1
          AND billing.payer_member_id = viewer.id
          AND billing.is_active = TRUE
       ) AS is_payer,
       EXISTS (SELECT 1 FROM managed) AS is_guardian,
       COALESCE(
         (SELECT ARRAY_AGG(child_member_id ORDER BY child_member_id) FROM managed),
         ARRAY[]::bigint[]
       ) AS managed_member_ids`,
    [family, facility, viewer],
  )

  const row = result.rows[0]
  if (!row?.is_household_member) return null
  const managedMemberIds = (row.managed_member_ids || [])
    .map(positiveId)
    .filter(Boolean)

  return {
    familyId: family,
    facilityId: facility,
    viewerMemberId: viewer,
    isPayer: row.is_payer === true,
    isGuardian: row.is_guardian === true,
    canAddFamilyMembers: row.is_payer === true || row.is_guardian === true,
    managedMemberIds,
  }
}

export function canEditHouseholdMember(access, targetMemberId) {
  const target = positiveId(targetMemberId)
  if (!access || !target) return false
  return target === access.viewerMemberId
    || access.isPayer === true
    || access.managedMemberIds.includes(target)
}

export function canRequestHouseholdMemberRemoval(access, targetMemberId) {
  return canEditHouseholdMember(access, targetMemberId)
}

export function serializeHouseholdAccess(access) {
  if (!access) {
    return {
      isPayer: false,
      isGuardian: false,
      canAddFamilyMembers: false,
    }
  }
  return {
    isPayer: access.isPayer,
    isGuardian: access.isGuardian,
    canAddFamilyMembers: access.canAddFamilyMembers,
  }
}
