import { deleteEmptyArchivedAccounts } from './emptyAccountDeletion.js'


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
    await deleteEmptyArchivedAccounts(db, { facilityId, familyId, memberIds: members.map(member => member.id) })
    await db.query('COMMIT')
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    if (error.code === '23503') throw blocked('This family or one of its logins is linked to records that must be retained. Keep the family archived.')
    throw error
  } finally {
    db.release()
  }
}
