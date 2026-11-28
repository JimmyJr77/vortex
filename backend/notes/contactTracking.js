import { accountNotesScopeCtes } from '../newAdmin/accountNotes.js'
import { loadCanonicalLeadGroup } from '../newAdmin/leadDeduplication.js'

// Save the note and its contact date together: neither change can survive a
// failure of the other. Use the same household links as the shared note history.
export async function saveAdminNote(db, { subjectType, subjectId, noteType, body, author, nonContact, facilityId }) {
  let memberId = subjectType === 'member' ? Number(subjectId) : null
  let leadIds = subjectType === 'registration' ? [Number(subjectId)] : []
  if (subjectType === 'registration' && !nonContact) {
    try {
      const group = await loadCanonicalLeadGroup(db, facilityId, subjectId)
      leadIds = group.registrationIds
      memberId = group.memberId
    } catch (error) {
      // Authorized legacy inquiries may predate facility-scoped lead groups.
      if (error.statusCode !== 404) throw error
    }
  }
  const values = [subjectType, subjectId, noteType, body, author.authorKind, author.authorId,
    author.authorEmail, author.authorName, nonContact, facilityId,
    subjectType === 'family' ? Number(subjectId) : null, memberId, leadIds]
  const scope = accountNotesScopeCtes({ facilityId: '$10::bigint', familyId: '$11::bigint', memberId: '$12::bigint', currentOnly: true,
    leadId: "CASE WHEN $1::text='registration' THEN $2::bigint END", leadIds: '$13::bigint[]' })
  const result = await db.query(`WITH ${scope}, saved_note AS (
    INSERT INTO note(subject_type,subject_id,note_type,body,author_kind,author_id,author_email,author_name,source,non_contact)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'admin_ui',$9)
    RETURNING *
  ), contact_date AS (
    SELECT (saved_note.created_at AT TIME ZONE COALESCE(
      (SELECT NULLIF(timezone,'') FROM facility WHERE id=$10),'America/New_York'))::date AS date
    FROM saved_note WHERE NOT saved_note.non_contact
  ), updated_contacts AS (
    UPDATE registrations r SET last_contacted_date=contact_date.date
    FROM contact_date WHERE r.id IN (SELECT id FROM inquiries)
      OR (r.id=CASE WHEN $1::text='registration' THEN $2::bigint END AND r.facility_id IS NULL
        AND ((r.member_id IS NULL AND (SELECT count(*) FROM facility)=1 AND EXISTS(SELECT 1 FROM facility WHERE id=$10))
          OR EXISTS(SELECT 1 FROM member m WHERE m.id=r.member_id AND m.facility_id=$10)))
    RETURNING r.id
  ) SELECT saved_note.*,(SELECT date::text FROM contact_date) AS contact_date FROM saved_note`, values)
  return result.rows[0]
}
