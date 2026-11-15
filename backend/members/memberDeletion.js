import { hasFamilyPayments, removeUnpaidHistory } from './unpaidHistoryDeletion.js'

function blocked(message, code = 'MEMBER_DELETE_BLOCKED', blockers = [{ message }]) {
  return Object.assign(new Error(message), { statusCode: 409, code, blockers })
}

/** Permanently remove an archived member and their unused, member-only login. */
export async function deleteArchivedMember(pool, { memberId, facilityId }) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    await deleteArchivedMemberInTransaction(db, { memberId, facilityId })
    await db.query('COMMIT')
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    if (error.code === '23503') {
      throw blocked('This member or login is still linked to records that must be retained. Keep the member archived.')
    }
    throw error
  } finally {
    db.release()
  }
}

/** The caller owns the transaction, including rollback on any failure. */
export async function deleteArchivedMemberInTransaction(db, { memberId, facilityId }) {
  const { rows: [member] } = await db.query(
    `SELECT is_active, app_user_id, EXISTS (
       SELECT 1 FROM facility WHERE owner_user_id = member.app_user_id
     ) AS is_owner
     FROM member
     WHERE id = $1 AND facility_id = $2
     FOR UPDATE`,
    [memberId, facilityId],
  )
  if (!member) throw Object.assign(new Error('Member not found.'), { statusCode: 404 })
  if (member.is_owner) throw blocked('The facility Owner account cannot be deleted.', 'OWNER_ACCOUNT_PROTECTED')
  if (member.is_active === true) {
    throw blocked('Archive this member before permanently deleting the record.', 'MEMBER_ARCHIVE_REQUIRED')
  }

  const { rows: accounts } = await db.query(
    `SELECT id FROM family_billing_account WHERE family_id IN (
       SELECT family_id FROM member WHERE id=$1
       UNION SELECT family_id FROM family_member WHERE member_id=$1
     ) OR payer_member_id=$1 ORDER BY id FOR UPDATE`, [memberId],
  )
  if (await hasFamilyPayments(db, { familyId: -1, accountIds: accounts.map(row => row.id), memberIds: [memberId] })) {
    throw blocked('Payments have been made for this member or their family. Keep the member archived to preserve payment history.')
  }
  const { rows: [guardian] } = await db.query(
    `SELECT EXISTS (SELECT 1 FROM parent_guardian_authority authority
       JOIN member child ON child.id=authority.child_member_id AND child.is_active=TRUE
       WHERE authority.parent_member_id=$1 AND authority.has_legal_authority=TRUE) AS protected`, [memberId],
  )
  if (guardian.protected) throw blocked('This member has legal authority for an active child. Update the child’s guardian records before deleting this member.')
  // Remove only this person's unpaid records, never their family's or siblings'.
  await removeUnpaidHistory(db, { familyId: -1, accountIds: [], memberIds: [memberId] })
  // Waivers signed for another person remain attached to that person; the
  // accepted_by FK becomes NULL when the archived signer is removed.

  if (member.app_user_id != null) {
    await db.query('SELECT id FROM app_user WHERE id = $1 AND facility_id = $2 FOR UPDATE', [member.app_user_id, facilityId])
  }

  await db.query('DELETE FROM member WHERE id = $1 AND facility_id = $2', [memberId, facilityId])
  if (member.app_user_id != null) {
    await db.query(
      `DELETE FROM app_user login
        WHERE login.id = $1 AND login.facility_id = $2
          AND login.role::text = 'MEMBER_ATHLETE'
          AND NOT EXISTS (
            SELECT 1 FROM app_user_role WHERE user_id = login.id AND role::text <> 'MEMBER_ATHLETE'
          )
          AND NOT EXISTS (SELECT 1 FROM member WHERE app_user_id = login.id)
          AND NOT EXISTS (SELECT 1 FROM facility WHERE owner_user_id = login.id)`,
      [member.app_user_id, facilityId],
    )
  }
}
