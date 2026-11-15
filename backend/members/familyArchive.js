import { getMemberArchivePreflight } from './memberArchive.js'

/** Archive a household only after checking every member, in one transaction. */
export async function setFamilyArchived(pool, familyId, archived, { facilityId }) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const { rows: [family] } = await db.query(
      'SELECT id FROM family WHERE id=$1 AND facility_id=$2 FOR UPDATE', [familyId, facilityId],
    )
    if (!family) {
      await db.query('ROLLBACK')
      return { found: false, canArchive: false, blockers: [] }
    }
    const { rows: members } = await db.query(
      `SELECT m.id, m.first_name, m.last_name,
         EXISTS (SELECT 1 FROM facility WHERE owner_user_id=m.app_user_id) AS is_owner,
         EXISTS (
           SELECT 1 FROM family other WHERE other.id<>$1 AND other.archived IS NOT TRUE
             AND (other.id=m.family_id OR EXISTS (
               SELECT 1 FROM family_member fm WHERE fm.member_id=m.id AND fm.family_id=other.id AND fm.is_active=TRUE
             ))
         ) AS shared
       FROM member m WHERE m.facility_id=$2 AND (
         EXISTS (SELECT 1 FROM family_member fm WHERE fm.member_id=m.id AND fm.family_id=$1 AND fm.is_active=TRUE)
         OR (m.family_id=$1 AND NOT EXISTS (SELECT 1 FROM family_member fm WHERE fm.member_id=m.id))
       ) ORDER BY m.id FOR UPDATE OF m`, [familyId, facilityId],
    )
    const blockers = []
    if (archived) {
      for (const member of members) {
        const name = [member.first_name, member.last_name].filter(Boolean).join(' ')
        if (member.is_owner) {
          blockers.push({ type: 'owner', memberId: Number(member.id), message: 'The facility Owner account cannot be archived.' })
        }
        if (member.shared) {
          blockers.push({ type: 'shared_member', memberId: Number(member.id), message: `${name} belongs to another active family. Resolve their family memberships before archiving this family.` })
        }
        const preflight = await getMemberArchivePreflight(db, member.id, { facilityId })
        for (const blocker of preflight.blockers) {
          // The whole household is being archived. Payment responsibility for
          // another household still blocks; this household's payer is preserved.
          if (blocker.type === 'payment_responsibility') {
            const otherAccounts = blocker.details.filter(account => String(account.familyId) !== String(familyId))
            if (!otherAccounts.length) continue
            blockers.push({ ...blocker, memberId: Number(member.id), details: otherAccounts })
          } else {
            blockers.push({ ...blocker, memberId: Number(member.id) })
          }
        }
      }
    }
    if (blockers.length) {
      await db.query('ROLLBACK')
      return { found: true, canArchive: false, blockers }
    }
    await db.query('UPDATE family SET archived=$1, updated_at=now() WHERE id=$2 AND facility_id=$3', [archived, familyId, facilityId])
    // Restoration changes only lifecycle flags; enrollments and account history
    // stay attached to the same person records.
    await db.query('UPDATE member SET is_active=$1, updated_at=now() WHERE id=ANY($2::bigint[]) AND facility_id=$3', [!archived, members.map(member => member.id), facilityId])
    await db.query('COMMIT')
    return { found: true, canArchive: true, blockers: [] }
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    db.release()
  }
}
