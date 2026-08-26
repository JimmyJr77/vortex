const ACTIVE_ENROLLMENT_STATUSES = ['confirmed', 'paused']

function memberName(member) {
  return [member?.first_name, member?.last_name].filter(Boolean).join(' ').trim() || 'This member'
}

function enrollmentLabel(enrollment) {
  const statusLabel = enrollment.status === 'paused' ? 'paused' : 'enrolled'
  return `${enrollment.class_name || 'Unnamed class'} (${statusLabel})`
}

/**
 * Convert the database rows into stable, user-facing archive blockers.
 * Exported separately so the wording and detail payload can be unit tested.
 */
export function buildMemberArchiveBlockers(member, enrollments, paymentAccounts) {
  const blockers = []
  const name = memberName(member)

  if (enrollments.length > 0) {
    const classList = enrollments.map(enrollmentLabel).join(', ')
    blockers.push({
      type: 'active_enrollments',
      message: `${name} is actively enrolled in: ${classList}. Cancel or complete the enrollment before archiving this account.`,
      details: enrollments.map((enrollment) => ({
        signupId: Number(enrollment.id),
        className: enrollment.class_name || 'Unnamed class',
        status: enrollment.status,
      })),
    })
  }

  if (paymentAccounts.length > 0) {
    const accountList = paymentAccounts.map((account) => {
      const dependents = Array.isArray(account.dependent_names)
        ? account.dependent_names.filter(Boolean)
        : []
      const dependentText = dependents.length > 0 ? ` (covers ${dependents.join(', ')})` : ''
      return `${account.family_name || `Family #${account.family_id}`}${dependentText}`
    }).join('; ')

    blockers.push({
      type: 'payment_responsibility',
      message: `${name} is the payment contact for ${accountList}. Assign another family payer before archiving this account.`,
      details: paymentAccounts.map((account) => ({
        billingAccountId: Number(account.id),
        familyId: Number(account.family_id),
        familyName: account.family_name || `Family #${account.family_id}`,
        dependentNames: Array.isArray(account.dependent_names)
          ? account.dependent_names.filter(Boolean)
          : [],
      })),
    })
  }

  return blockers
}

async function loadMember(db, memberId, lockMember) {
  const result = await db.query(
    `SELECT id, first_name, last_name, family_id, app_user_id, is_active, status
     FROM member
     WHERE id = $1
     ${lockMember ? 'FOR UPDATE' : ''}`,
    [memberId],
  )
  return result.rows[0] || null
}

async function loadActiveEnrollments(db, memberId) {
  const result = await db.query(
    `SELECT
       s.id,
       s.status,
       COALESCE(p.display_name, p.name, sf.title, 'Unnamed class') AS class_name
     FROM scheduling_signup s
     JOIN scheduling_form sf ON sf.id = s.form_id
     LEFT JOIN program p ON p.id = sf.program_id
     WHERE s.member_id = $1
       AND s.status = ANY($2::text[])
       AND s.orphaned_at IS NULL
       AND s.archived_at IS NULL
       AND (s.cancel_effective_date IS NULL OR s.cancel_effective_date > CURRENT_DATE)
       AND sf.deleted_at IS NULL
       AND sf.is_active = TRUE
       AND (sf.end_date IS NULL OR sf.end_date >= CURRENT_DATE)
     ORDER BY class_name, s.id`,
    [memberId, ACTIVE_ENROLLMENT_STATUSES],
  )
  return result.rows
}

async function loadPaymentAccountsForOtherMembers(db, memberId) {
  const result = await db.query(
    `SELECT
       fba.id,
       fba.family_id,
       COALESCE(NULLIF(TRIM(f.family_name), ''), 'Family #' || fba.family_id::text) AS family_name,
       COALESCE(
         ARRAY_AGG(DISTINCT TRIM(dependent.first_name || ' ' || dependent.last_name))
           FILTER (WHERE dependent.id IS NOT NULL),
         ARRAY[]::text[]
       ) AS dependent_names
     FROM family_billing_account fba
     JOIN family f ON f.id = fba.family_id
     LEFT JOIN LATERAL (
       SELECT DISTINCT other.id, other.first_name, other.last_name
       FROM member other
       LEFT JOIN family_member other_link
         ON other_link.member_id = other.id
        AND other_link.family_id = fba.family_id
        AND other_link.is_active = TRUE
       WHERE other.id <> $1
         AND other.is_active = TRUE
         AND (other.family_id = fba.family_id OR other_link.member_id IS NOT NULL)
     ) dependent ON TRUE
     WHERE fba.payer_member_id = $1
       AND fba.is_active = TRUE
       AND COALESCE(f.archived, FALSE) = FALSE
     GROUP BY fba.id, fba.family_id, f.family_name
     HAVING COUNT(dependent.id) > 0
     ORDER BY family_name, fba.id`,
    [memberId],
  )
  return result.rows
}

/** Load the reasons that currently prevent a member from being archived. */
export async function getMemberArchivePreflight(db, memberId, { lockMember = false } = {}) {
  const member = await loadMember(db, memberId, lockMember)
  if (!member) {
    return { found: false, canArchive: false, member: null, blockers: [] }
  }

  const [enrollments, paymentAccounts] = await Promise.all([
    loadActiveEnrollments(db, memberId),
    loadPaymentAccountsForOtherMembers(db, memberId),
  ])
  const blockers = buildMemberArchiveBlockers(member, enrollments, paymentAccounts)

  return {
    found: true,
    canArchive: blockers.length === 0,
    member,
    blockers,
  }
}

/**
 * Archive/unarchive a member and its linked login atomically. Archive blockers
 * are rechecked inside the transaction to protect the write endpoint itself.
 */
export async function setMemberArchived(pool, memberId, archived) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    let preflight
    if (archived) {
      preflight = await getMemberArchivePreflight(client, memberId, { lockMember: true })
    } else {
      const member = await loadMember(client, memberId, true)
      preflight = {
        found: Boolean(member),
        canArchive: Boolean(member),
        member,
        blockers: [],
      }
    }

    if (!preflight.found) {
      await client.query('ROLLBACK')
      return preflight
    }
    if (archived && !preflight.canArchive) {
      await client.query('ROLLBACK')
      return preflight
    }

    // A payer for a family with other active members is blocked above. If this
    // is a single-person billing account, safely remove the now-stale payer link.
    if (archived) {
      await client.query(
        `UPDATE family_billing_account
         SET payer_member_id = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE payer_member_id = $1
           AND is_active = TRUE`,
        [memberId],
      )
    }

    const memberResult = await client.query(
      `UPDATE member
       SET is_active = $1,
           status = CASE
             WHEN $1 = FALSE THEN 'archived'
             WHEN EXISTS (
               SELECT 1
               FROM scheduling_signup s
               WHERE s.member_id = member.id
                 AND s.status = ANY($3::text[])
                 AND s.orphaned_at IS NULL
                 AND s.archived_at IS NULL
                 AND (s.cancel_effective_date IS NULL OR s.cancel_effective_date > CURRENT_DATE)
             ) THEN 'enrolled'
             ELSE 'legacy'
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [!archived, memberId, ACTIVE_ENROLLMENT_STATUSES],
    )

    const updatedMember = memberResult.rows[0]
    if (updatedMember?.app_user_id) {
      await client.query(
        `UPDATE app_user
         SET is_active = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [!archived, updatedMember.app_user_id],
      )
    }

    await client.query('COMMIT')
    return {
      found: true,
      canArchive: true,
      member: updatedMember,
      blockers: [],
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
