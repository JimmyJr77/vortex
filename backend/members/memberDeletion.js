import { deleteEmptyArchivedAccounts } from './emptyAccountDeletion.js'
import { tryDeleteMergedMember } from './mergedMemberDeletion.js'

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

  if (await tryDeleteMergedMember(db, { memberId, facilityId })) return
  await deleteEmptyArchivedAccounts(db, { facilityId, memberIds: [memberId] })
}
