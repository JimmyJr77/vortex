import { id, inputError } from './common.js'

// SQL expressions are supplied only by callers in this module and leadFilters.
// Both screens use the same explicit household links, including historical notes.
export function accountNotesSql({ facilityId, familyId = 'NULL::bigint', memberId = 'NULL::bigint', leadId = 'NULL::bigint' }) {
  return `WITH linked_families AS (
    SELECT f.id FROM family f WHERE f.facility_id=${facilityId} AND (
      f.id=${familyId} OR (${familyId} IS NULL AND (
        EXISTS (SELECT 1 FROM family_member fm WHERE fm.family_id=f.id AND fm.member_id=${memberId} AND fm.is_active=TRUE)
        OR EXISTS (SELECT 1 FROM member owner WHERE owner.id=${memberId} AND owner.facility_id=${facilityId}
          AND owner.family_id=f.id AND NOT EXISTS (SELECT 1 FROM family_member fm WHERE fm.member_id=owner.id)))))
  ), account_family AS (
    SELECT id FROM linked_families WHERE (SELECT count(*) FROM linked_families)=1
  ), account_members AS (
    SELECT m.id FROM member m WHERE m.facility_id=${facilityId} AND (m.id=${memberId}
      OR EXISTS (SELECT 1 FROM family_member fm JOIN account_family f ON f.id=fm.family_id WHERE fm.member_id=m.id)
      OR (m.family_id IN (SELECT id FROM account_family) AND NOT EXISTS (SELECT 1 FROM family_member fm WHERE fm.member_id=m.id))
      OR EXISTS (SELECT 1 FROM account_record_source h JOIN account_family f ON f.id=h.family_id
        WHERE h.member_id=m.id AND h.facility_id=${facilityId} AND NOT h.deleted))
  ), inquiries AS (
    SELECT inquiry.* FROM registrations inquiry WHERE
      (inquiry.facility_id=${facilityId} OR (inquiry.facility_id IS NULL AND EXISTS (
        SELECT 1 FROM member linked WHERE linked.id=inquiry.member_id AND linked.facility_id=${facilityId})))
      AND (inquiry.id=${leadId} OR COALESCE(inquiry.converted_member_id,inquiry.member_id) IN (SELECT id FROM account_members))
  )
  SELECT n.id,n.subject_type,n.subject_id,n.note_type,n.body,n.author_name,n.created_at,n.source
    FROM note n WHERE n.is_deleted=FALSE AND (
      (n.subject_type='registration' AND n.subject_id IN (SELECT id FROM inquiries))
      OR (n.subject_type='member' AND n.subject_id IN (SELECT id FROM account_members)))
  UNION ALL
  SELECT -inquiry.id::bigint*2,'registration',inquiry.id,'staff_note',inquiry.admin_notes,NULL,inquiry.updated_at,'legacy_inquiry_note'
    FROM inquiries inquiry WHERE NULLIF(TRIM(inquiry.admin_notes),'') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM note n WHERE n.subject_type='registration' AND n.subject_id=inquiry.id AND n.is_deleted=FALSE AND TRIM(n.body)=TRIM(inquiry.admin_notes))
  UNION ALL
  SELECT -inquiry.id::bigint*2-1,'registration',inquiry.id,'user_comment',inquiry.message,
    concat_ws(' ',inquiry.first_name,inquiry.last_name),inquiry.created_at,'inquiry_message'
    FROM inquiries inquiry WHERE NULLIF(TRIM(inquiry.message),'') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM note n WHERE n.subject_type='registration' AND n.subject_id=inquiry.id AND n.is_deleted=FALSE AND TRIM(n.body)=TRIM(inquiry.message))`
}

export async function loadAccountNotes(db, { facilityId, familyId = null, memberId = null, leadId = null }) {
  const result = await db.query(`${accountNotesSql({ facilityId: '$1', familyId: '$2::bigint', memberId: '$3::bigint', leadId: '$4::bigint' })}
    ORDER BY created_at DESC,id DESC`, [id(facilityId), familyId, memberId, leadId])
  return result.rows.map(row => ({ id: Number(row.id), subjectType: row.subject_type, subjectId: Number(row.subject_id), noteType: row.note_type,
    body: row.body, authorName: row.author_name, createdAt: row.created_at, source: row.source }))
}

export async function familyNotes(db, facilityId, familyId) {
  const family = await db.query('SELECT id FROM family WHERE id=$1 AND facility_id=$2', [id(familyId), id(facilityId)])
  if (!family.rows.length) throw inputError('Family not found.', 404)
  return loadAccountNotes(db, { facilityId, familyId: id(familyId) })
}
