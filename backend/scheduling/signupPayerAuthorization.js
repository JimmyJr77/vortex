function positiveInteger(value) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

function normalizedIdArray(value) {
  if (!Array.isArray(value)) return []
  return value.map(positiveInteger).filter((id) => id != null)
}

export function signupPayerAuthorizationError(
  message = 'Only the active household payer can complete this enrollment.',
) {
  const error = new Error(message)
  error.code = 'SIGNUP_PAYER_REQUIRED'
  error.statusCode = 403
  return error
}

/**
 * Resolve a scheduling member only through the authenticated app_user link.
 * Numeric id collisions and matching email addresses are deliberately ignored.
 */
export async function findExplicitlyLinkedSchedulingMember(db, appUserId) {
  const normalizedAppUserId = positiveInteger(appUserId)
  if (normalizedAppUserId == null) return null

  const result = await db.query(
    `SELECT member.*
       FROM app_user app_identity
       JOIN member ON member.app_user_id = app_identity.id
      WHERE app_identity.id = $1
        AND app_identity.is_active = TRUE
        AND member.is_active = TRUE
      ORDER BY member.id
      LIMIT 2`,
    [normalizedAppUserId],
  )
  return result.rows.length === 1 ? result.rows[0] : null
}

/**
 * Canonical authorization for a public/member signup batch.
 *
 * family_member is authoritative once any membership history exists. The
 * member.family_id fallback is accepted only for a member that has never had a
 * family_member row, matching the canonical household read model. Existing
 * households require exactly one active billing account and its current payer.
 * A genuinely unhoused member may only enroll themself (new public accounts).
 */
export async function authorizeSignupBatchPayer(db, {
  actorMemberId,
  targetMemberId,
  expectedFamilyBillingAccountId = null,
} = {}) {
  const actorId = positiveInteger(actorMemberId)
  const targetId = positiveInteger(targetMemberId)
  const expectedAccountId =
    expectedFamilyBillingAccountId == null
      ? null
      : positiveInteger(expectedFamilyBillingAccountId)

  if (actorId == null || targetId == null) {
    throw signupPayerAuthorizationError('Enrollment authority is missing or invalid.')
  }
  if (expectedFamilyBillingAccountId != null && expectedAccountId == null) {
    throw signupPayerAuthorizationError('Enrollment account authority is invalid.')
  }

  const result = await db.query(
    `WITH target_member AS (
       SELECT member.id, member.family_id
         FROM member
        WHERE member.id = $1
          AND member.is_active = TRUE
     ), target_families AS (
       SELECT membership.family_id
         FROM target_member target
         JOIN family_member membership ON membership.member_id = target.id
        WHERE membership.is_active = TRUE

       UNION

       SELECT target.family_id
         FROM target_member target
        WHERE target.family_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
              FROM family_member membership_history
             WHERE membership_history.member_id = target.id
          )
     ), actor_member AS (
       SELECT member.id, member.family_id
         FROM member
        WHERE member.id = $2
          AND member.is_active = TRUE
     ), actor_families AS (
       SELECT membership.family_id
         FROM actor_member actor
         JOIN family_member membership ON membership.member_id = actor.id
        WHERE membership.is_active = TRUE

       UNION

       SELECT actor.family_id
         FROM actor_member actor
        WHERE actor.family_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
              FROM family_member membership_history
             WHERE membership_history.member_id = actor.id
          )
     ), active_accounts AS (
       SELECT account.id, account.family_id, account.payer_member_id
         FROM family_billing_account account
         JOIN target_families target_family ON target_family.family_id = account.family_id
        WHERE account.is_active = TRUE
     )
     SELECT target.id AS target_member_id,
            target.family_id AS target_legacy_family_id,
            (SELECT id FROM actor_member LIMIT 1) AS actor_member_id,
            (SELECT family_id FROM actor_member LIMIT 1) AS actor_legacy_family_id,
            (
              SELECT COUNT(*)::int
                FROM family_member membership_history
               WHERE membership_history.member_id = target.id
            ) AS target_membership_history_count,
            (
              SELECT COUNT(*)::int
                FROM family_member membership_history
                JOIN actor_member actor ON actor.id = membership_history.member_id
            ) AS actor_membership_history_count,
            ARRAY(
              SELECT DISTINCT family_id FROM target_families ORDER BY family_id
            )::bigint[] AS target_family_ids,
            ARRAY(
              SELECT DISTINCT family_id FROM actor_families ORDER BY family_id
            )::bigint[] AS actor_family_ids,
            ARRAY(
              SELECT id FROM active_accounts ORDER BY id
            )::bigint[] AS active_account_ids,
            ARRAY(
              SELECT payer_member_id FROM active_accounts ORDER BY id
            )::bigint[] AS active_account_payer_ids
       FROM target_member target`,
    [targetId, actorId],
  )

  const row = result.rows[0]
  if (!row) {
    throw signupPayerAuthorizationError('Selected member is not available for enrollment.')
  }

  const targetFamilyIds = normalizedIdArray(row.target_family_ids)
  const actorFamilyIds = normalizedIdArray(row.actor_family_ids)
  const accountIds = normalizedIdArray(row.active_account_ids)
  const payerIds = normalizedIdArray(row.active_account_payer_ids)
  const actorRowId = positiveInteger(row.actor_member_id)
  const targetLegacyFamilyId = positiveInteger(row.target_legacy_family_id)
  const actorLegacyFamilyId = positiveInteger(row.actor_legacy_family_id)
  const targetMembershipHistoryCount = Number(row.target_membership_history_count ?? 0)
  const actorMembershipHistoryCount = Number(row.actor_membership_history_count ?? 0)

  if (targetFamilyIds.length === 0) {
    const isGenuinelyUnhousedSelf =
      actorId === targetId &&
      actorRowId === actorId &&
      targetLegacyFamilyId == null &&
      actorLegacyFamilyId == null &&
      targetMembershipHistoryCount === 0 &&
      actorMembershipHistoryCount === 0 &&
      actorFamilyIds.length === 0 &&
      expectedAccountId == null
    if (!isGenuinelyUnhousedSelf) {
      throw signupPayerAuthorizationError(
        'This member is not part of the household authorized for enrollment.',
      )
    }
    return {
      kind: 'unhoused_self',
      actorMemberId: actorId,
      targetMemberId: targetId,
      familyId: null,
      familyBillingAccountId: null,
    }
  }

  if (targetFamilyIds.length !== 1 || actorFamilyIds.length !== 1) {
    throw signupPayerAuthorizationError(
      'Household membership is ambiguous. An administrator must correct the account before enrollment.',
    )
  }
  const familyId = targetFamilyIds[0]
  if (actorFamilyIds[0] !== familyId) {
    throw signupPayerAuthorizationError(
      'This member is not part of the household authorized for enrollment.',
    )
  }
  if (accountIds.length !== 1 || payerIds.length !== 1) {
    throw signupPayerAuthorizationError(
      'This household does not have one active billing account. An administrator must correct it before enrollment.',
    )
  }

  const familyBillingAccountId = accountIds[0]
  if (expectedAccountId != null && expectedAccountId !== familyBillingAccountId) {
    throw signupPayerAuthorizationError('Enrollment account authority is no longer current.')
  }
  if (payerIds[0] !== actorId) {
    throw signupPayerAuthorizationError()
  }

  // Hold the payer row stable through the caller's transaction. When db is a
  // pool this lock lasts only for this statement; the batch path passes its
  // transaction client so payer changes cannot race the enrollment mutations.
  const locked = await db.query(
    `SELECT id, family_id, payer_member_id
       FROM family_billing_account
      WHERE id = $1
        AND family_id = $2
        AND is_active = TRUE
      FOR SHARE`,
    [familyBillingAccountId, familyId],
  )
  const lockedAccount = locked.rows[0]
  if (
    locked.rows.length !== 1 ||
    Number(lockedAccount.payer_member_id) !== actorId
  ) {
    throw signupPayerAuthorizationError('Enrollment payer authority is no longer current.')
  }

  return {
    kind: 'household_payer',
    actorMemberId: actorId,
    targetMemberId: targetId,
    familyId,
    familyBillingAccountId,
  }
}
