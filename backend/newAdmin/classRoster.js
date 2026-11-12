import { id, inputError, pagination, pageResult, searchValue, date } from './common.js'

const enrollmentStatus = `CASE
  WHEN s.status IN ('confirmed','active') THEN 'active'
  WHEN s.status='paused' THEN 'paused'
  WHEN s.status IN ('cancelled','canceled','completed','disenrolled') THEN 'disenrolled'
  WHEN s.status='waitlisted' THEN 'waitlisted'
  WHEN s.status='pending_setup' AND s.reserved_until<=now() THEN 'reservation_expired'
  ELSE s.status END`
const statuses = new Set(['all','active','paused','disenrolled','waitlisted'])

export async function classRosterForForm(db, facilityId, formId, query={}) {
  const paging=pagination({...query,page:query.rosterPage || query.page})
  const status=String(query.status || 'all')
  if (!statuses.has(status)) throw inputError('Invalid enrollment status filter.')
  const groupId=query.slotGroupId ? id(query.slotGroupId,'schedule') : null
  const slotId=query.timeSlotId ? id(query.timeSlotId,'time slot') : null
  if (slotId && !groupId) throw inputError('Choose a schedule for this time slot.')
  if (!formId) return pageResult([],0,paging)
  // Validate both IDs against the selected class before filtering. A group-wide
  // enrollment (NULL time_slot_id) attends every time in that group.
  if (groupId) {
    const group=await db.query(`SELECT g.id FROM scheduling_slot_group g WHERE g.id=$1 AND g.form_id=$2
      AND ($3::bigint IS NULL OR EXISTS (SELECT 1 FROM scheduling_time_slot ts WHERE ts.id=$3 AND ts.slot_group_id=g.id))`,[groupId,formId,slotId])
    if (!group.rows[0]) throw inputError('Schedule or time slot not found for this class.',404)
  }
  const from=`FROM scheduling_signup s
    LEFT JOIN member m ON m.id=s.member_id AND m.facility_id=$2
    LEFT JOIN account_invite ai ON ai.id=s.account_invite_id AND ai.facility_id=$2
    WHERE s.form_id=$1 AND (m.id IS NOT NULL OR ai.id IS NOT NULL)
      AND s.archived_at IS NULL AND s.orphaned_at IS NULL
      AND ($3::bigint IS NULL OR s.slot_group_id=$3)
      AND ($4::bigint IS NULL OR s.time_slot_id=$4 OR s.time_slot_id IS NULL)
      AND ($5::text='all' OR (${enrollmentStatus})=$5)
      AND concat_ws(' ',COALESCE(m.first_name,s.first_name),COALESCE(m.last_name,s.last_name)) ILIKE $6 ESCAPE '\\'`
  const values=[formId,facilityId,groupId,slotId,status,searchValue(query.search)]
  const [rows,count]=await Promise.all([
    db.query(`SELECT s.id,s.member_id,COALESCE(m.first_name,s.first_name) AS first_name,COALESCE(m.last_name,s.last_name) AS last_name,
      s.status,${enrollmentStatus} AS enrollment_status,s.enrollment_start_date,s.slot_group_id,s.time_slot_id,
      CASE WHEN s.status='waitlisted' THEN (SELECT COUNT(*)::int FROM scheduling_signup w
        WHERE w.form_id=s.form_id AND w.slot_group_id=s.slot_group_id AND w.status='waitlisted' AND w.archived_at IS NULL AND w.orphaned_at IS NULL
        AND (COALESCE(w.waitlisted_at,w.created_at),w.id)<=(COALESCE(s.waitlisted_at,s.created_at),s.id)) END AS waitlist_position
      ${from} ORDER BY COALESCE(m.last_name,s.last_name),COALESCE(m.first_name,s.first_name),s.id LIMIT $7 OFFSET $8`,[...values,paging.pageSize,paging.offset]),
    db.query(`SELECT COUNT(*)::int AS total ${from}`,values),
  ])
  return pageResult(rows.rows.map(row=>({id:Number(row.id),memberId:row.member_id == null ? null:Number(row.member_id),
    firstName:row.first_name,lastName:row.last_name,status:row.status,enrollmentStatus:row.enrollment_status,
    startDate:date(row.enrollment_start_date),slotGroupId:row.slot_group_id==null?null:Number(row.slot_group_id),timeSlotId:row.time_slot_id==null?null:Number(row.time_slot_id),
    waitlistPosition:row.waitlist_position==null?null:Number(row.waitlist_position)})),count.rows[0].total,paging)
}

export async function classRoster(db,facilityId,classId,query={}) {
  const selected=await db.query(`SELECT f.id AS form_id FROM program p
    LEFT JOIN LATERAL (SELECT id FROM scheduling_form WHERE program_id=p.id AND deleted_at IS NULL ORDER BY is_active DESC,id DESC LIMIT 1) f ON TRUE
    WHERE p.id=$1 AND p.facility_id=$2`,[id(classId,'class'),id(facilityId,'facility')])
  if (!selected.rows[0]) throw inputError('Class not found.',404)
  return classRosterForForm(db,facilityId,selected.rows[0].form_id,query)
}
