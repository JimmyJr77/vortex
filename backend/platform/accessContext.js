const STAFF_ROLE_ORDER = Object.freeze(['OWNER', 'ADMINISTRATOR', 'COACH'])

function normalizeBoolean(value) {
  return value === true || value === 'true'
}

function normalizePositiveId(value) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

function normalizeRoleList(value) {
  const values = Array.isArray(value) ? value : []
  return [...new Set(values.map((role) => String(role ?? '').trim().toUpperCase()).filter(Boolean))]
}

export function canonicalStaffRoles(storageRoles, { isOwner = false } = {}) {
  const stored = new Set(normalizeRoleList(storageRoles))
  const roles = []
  if (isOwner) roles.push('OWNER')
  if (!isOwner && (stored.has('MASTER_ADMIN') || stored.has('ADMIN'))) roles.push('ADMINISTRATOR')
  if (stored.has('COACH')) roles.push('COACH')
  return STAFF_ROLE_ORDER.filter((role) => roles.includes(role))
}

export function mapCanonicalAccessContext(row) {
  if (!row) return null
  const storageRoles = normalizeRoleList(row.storage_roles)
  const isOwner = normalizeBoolean(row.is_owner)
  const staffRoles = normalizeRoleList(row.staff_roles)
  const memberPortalStatus = String(row.member_portal_status || 'no_login')

  return {
    userId: normalizePositiveId(row.user_id),
    facilityId: normalizePositiveId(row.facility_id),
    ownerUserId: normalizePositiveId(row.owner_user_id),
    email: row.email ?? null,
    fullName: row.full_name ?? '',
    phone: row.phone ?? null,
    username: row.username ?? null,
    primaryStorageRole: row.primary_storage_role ?? storageRoles[0] ?? null,
    storageRoles,
    staffRoles: staffRoles.length > 0
      ? STAFF_ROLE_ORDER.filter((role) => staffRoles.includes(role))
      : canonicalStaffRoles(storageRoles, { isOwner }),
    isActive: normalizeBoolean(row.is_active),
    staffAccessActive: row.staff_access_active !== false,
    memberPortalAccessActive: row.member_portal_access_active !== false,
    isOwner,
    memberId: normalizePositiveId(row.member_id),
    familyId: normalizePositiveId(row.family_id),
    memberPortalStatus,
    portalAccess: {
      admin: normalizeBoolean(row.can_access_admin_portal),
      coach: normalizeBoolean(row.can_access_coach_portal),
      member: normalizeBoolean(row.can_access_member_portal) && memberPortalStatus === 'active',
    },
  }
}

/**
 * Resolve authorization from a stable app_user id and canonical database
 * relationships. JWT email/role claims and admin_profile are intentionally not
 * accepted as authority.
 */
export async function loadCanonicalAccessContext(db, userId) {
  const normalizedUserId = normalizePositiveId(userId)
  if (normalizedUserId == null) return null

  const result = await db.query(
    `SELECT
       user_id,
       facility_id,
       owner_user_id,
       email,
       full_name,
       phone,
       username,
       primary_storage_role,
       storage_roles,
       staff_roles,
       is_active,
       staff_access_active,
       member_portal_access_active,
       is_owner,
       member_id,
       family_id,
       member_portal_status,
       can_access_admin_portal,
       can_access_coach_portal,
       can_access_member_portal
     FROM v_app_user_access_context
     WHERE user_id = $1
     LIMIT 1`,
    [normalizedUserId],
  )
  return mapCanonicalAccessContext(result.rows[0] ?? null)
}

/**
 * Resolve current and legacy JWT identity claims without treating a historical
 * member id as an app_user id. When both claims exist they must identify the
 * same explicit member.app_user_id link.
 */
export async function resolveCanonicalTokenUserId(db, decoded) {
  if (!decoded || typeof decoded !== 'object') return null
  const claimedUserId = normalizePositiveId(decoded.userId ?? decoded.adminId)
  const claimedMemberId = normalizePositiveId(decoded.memberId)
  if (claimedMemberId == null) return claimedUserId

  const linked = await db.query(
    `SELECT app_user_id
       FROM member
      WHERE id = $1
        AND app_user_id IS NOT NULL
      LIMIT 1`,
    [claimedMemberId],
  )
  const linkedUserId = normalizePositiveId(linked.rows[0]?.app_user_id)
  if (linkedUserId == null) return null
  if (claimedUserId != null && claimedUserId !== linkedUserId) return null
  return linkedUserId
}

export function platformUserFromAccessContext(access) {
  if (!access) return null
  return {
    id: access.userId,
    facility_id: access.facilityId,
    email: access.email,
    full_name: access.fullName,
    phone: access.phone,
    username: access.username,
    role: access.primaryStorageRole,
    is_active: access.isActive,
    staff_access_active: access.staffAccessActive,
    member_portal_access_active: access.memberPortalAccessActive,
    is_master_admin: access.isOwner,
    is_owner: access.isOwner,
    member_id: access.memberId,
    family_id: access.familyId,
  }
}
