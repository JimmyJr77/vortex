import { hasFamilyPayments, removeUnpaidHistory } from './unpaidHistoryDeletion.js'
import { deleteArchivedMemberInTransaction } from './memberDeletion.js'


function blocked(message, code = 'FAMILY_DELETE_BLOCKED') {
  return Object.assign(new Error(message), { statusCode: 409, code, blockers: [{ message }] })
}

/** Delete archived, unshared families unless actual payment history exists. */
export async function deleteArchivedFamily(pool, { familyId, facilityId }) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const { rows: [family] } = await db.query(
      'SELECT archived FROM family WHERE id = $1 AND facility_id = $2 FOR UPDATE',
      [familyId, facilityId],
    )
    if (!family) throw Object.assign(new Error('Family not found.'), { statusCode: 404 })
    if (family.archived !== true) throw blocked('Archive this family before permanently deleting it.', 'FAMILY_ARCHIVE_REQUIRED')

    // Lock members and the billing account before checking history, preventing
    // new foreign-key references while the deletion is in progress.
    const { rows: members } = await db.query(
      `SELECT m.id, m.facility_id, m.family_id, m.first_name, m.last_name,
         EXISTS (SELECT 1 FROM family_member fm WHERE fm.member_id = m.id AND fm.family_id <> $1) AS shared
       FROM member m
       WHERE m.family_id = $1 OR EXISTS (SELECT 1 FROM family_member fm WHERE fm.member_id = m.id AND fm.family_id = $1)
       ORDER BY m.id FOR UPDATE OF m`,
      [familyId],
    )
    if (members.some(m => String(m.facility_id) !== String(facilityId) || m.shared || (m.family_id != null && String(m.family_id) !== String(familyId)))) {
      throw blocked('A person is linked to another family. Resolve their family memberships before deleting this family.')
    }
    const { rows: accounts } = await db.query('SELECT id FROM family_billing_account WHERE family_id = $1 FOR UPDATE', [familyId])
    // Older production schemas retain the retired athlete table; fresh schemas
    // use member exclusively. Preserve legacy athletes where that table exists.
    const { rows: [legacy] } = await db.query("SELECT to_regclass('public.athlete') IS NOT NULL AS present")
    if (legacy.present && (await db.query('SELECT 1 FROM athlete WHERE family_id = $1 LIMIT 1', [familyId])).rowCount) {
      throw blocked('Legacy athlete records are linked to this family. Keep the family archived to preserve them.')
    }
    const accountIds = accounts.map(account => account.id)
    const memberIds = members.map(member => member.id)
    if (await hasFamilyPayments(db, { familyId, accountIds, memberIds })) {
      throw blocked('Payments have been made for this family. Keep the family archived to preserve its payment history.')
    }

    await removeUnpaidHistory(db, { familyId, accountIds, memberIds })

    for (const member of members) {
      try {
        await deleteArchivedMemberInTransaction(db, { memberId: member.id, facilityId })
      } catch (error) {
        if (error.statusCode === 409) {
          throw blocked(`${member.first_name} ${member.last_name}: ${error.blockers?.map(item => item.message).join(' ') || error.message}`)
        }
        throw error
      }
    }
    await db.query('DELETE FROM family WHERE id = $1 AND facility_id = $2', [familyId, facilityId])
    await db.query('COMMIT')
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    if (error.code === '23503') throw blocked('This family or one of its logins is linked to records that must be retained. Keep the family archived.')
    throw error
  } finally {
    db.release()
  }
}
