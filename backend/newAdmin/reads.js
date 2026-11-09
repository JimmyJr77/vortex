import { id, inputError, pagination, pageResult, searchValue, memberRow, date } from './common.js'

const classSelect = `SELECT p.id,p.programs_id,p.display_name AS name,pr.display_name AS program_name,
  p.is_active AND NOT COALESCE(p.archived,FALSE) AS is_active,sf.id AS form_id,
  COALESCE(cap.capacity,0)::int AS capacity,COALESCE(en.enrolled_count,0)::int AS enrolled_count,
  COALESCE(en.waitlist_count,0)::int AS waitlist_count
  FROM program p JOIN facility facility_row ON facility_row.id=p.facility_id LEFT JOIN programs pr ON pr.id=p.programs_id AND pr.facility_id=p.facility_id
  LEFT JOIN LATERAL (SELECT f.id,f.end_date,f.is_active FROM scheduling_form f WHERE f.program_id=p.id AND f.deleted_at IS NULL ORDER BY f.is_active DESC,f.id DESC LIMIT 1) sf ON TRUE
  LEFT JOIN LATERAL (SELECT SUM(g.max_participants) AS capacity FROM scheduling_slot_group g
    LEFT JOIN scheduling_offering o ON o.id=g.offering_id
    WHERE g.form_id=sf.id AND sf.is_active=TRUE AND g.is_active=TRUE AND (g.offering_id IS NULL OR o.is_selected=TRUE)
      AND COALESCE(o.end_date,g.active_end,sf.end_date,'infinity'::date) >= (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(facility_row.timezone,''),'America/New_York'))::date) cap ON TRUE
  LEFT JOIN LATERAL (SELECT COUNT(*) FILTER (WHERE s.status='confirmed') AS enrolled_count,
    COUNT(*) FILTER (WHERE s.status='waitlisted') AS waitlist_count FROM scheduling_signup s
    JOIN member m ON m.id=s.member_id AND m.facility_id=p.facility_id
    JOIN scheduling_slot_group g ON g.id=s.slot_group_id AND g.form_id=sf.id
    LEFT JOIN scheduling_offering o ON o.id=g.offering_id
    WHERE s.form_id=sf.id AND s.archived_at IS NULL AND s.orphaned_at IS NULL
      AND sf.is_active=TRUE AND g.is_active=TRUE AND (g.offering_id IS NULL OR o.is_selected=TRUE)
      AND COALESCE(o.end_date,g.active_end,sf.end_date,'infinity'::date) >= (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(facility_row.timezone,''),'America/New_York'))::date) en ON TRUE`

const classRow = row => ({id:Number(row.id),programsId:row.programs_id==null?null:Number(row.programs_id),formId:row.form_id == null ? null:Number(row.form_id),name:row.name,
  programName:row.program_name || '',isActive:row.is_active,capacity:Number(row.capacity),enrolledCount:Number(row.enrolled_count),waitlistCount:Number(row.waitlist_count)})

export async function listClasses(db,facilityId,query={}) {
  const paging=pagination(query)
  const values=[id(facilityId),searchValue(query.search)]
  const where=`p.facility_id=$1 AND concat_ws(' ',p.display_name,pr.display_name) ILIKE $2 ESCAPE '\\'`
  const [rows,count]=await Promise.all([
    db.query(`${classSelect} WHERE ${where} ORDER BY LOWER(p.display_name),p.id LIMIT $3 OFFSET $4`,[...values,paging.pageSize,paging.offset]),
    db.query(`SELECT COUNT(*)::int AS total FROM program p LEFT JOIN programs pr ON pr.id=p.programs_id AND pr.facility_id=p.facility_id WHERE ${where}`,values),
  ])
  return pageResult(rows.rows.map(classRow),count.rows[0].total,paging)
}

export async function classDetail(db,facilityId,classId,query={}) {
  const selected=await db.query(`${classSelect} WHERE p.id=$1 AND p.facility_id=$2`,[id(classId,'class'),id(facilityId)])
  if (!selected.rows[0]) throw inputError('Class not found.',404)
  const item=classRow(selected.rows[0])
  const paging=pagination({...query,page:query.rosterPage || query.page})
  if (!item.formId) return {class:item,groups:[],roster:pageResult([],0,paging)}
  const [groups,slots,roster,count]=await Promise.all([
    db.query(`SELECT g.id,g.max_participants,g.active_start,g.active_end,g.offering_id,g.is_active,COUNT(*) OVER()::int AS group_total,
      COUNT(s.id) FILTER (WHERE s.status='confirmed')::int AS enrolled_count,
      COUNT(s.id) FILTER (WHERE s.status='waitlisted')::int AS waitlist_count
      FROM scheduling_slot_group g LEFT JOIN scheduling_signup s ON s.slot_group_id=g.id
       AND s.archived_at IS NULL AND s.orphaned_at IS NULL
       AND EXISTS (SELECT 1 FROM member m WHERE m.id=s.member_id AND m.facility_id=$2)
      WHERE g.form_id=$1 GROUP BY g.id ORDER BY g.id LIMIT 100`,[item.formId,facilityId]),
    db.query(`SELECT ts.id,ts.slot_group_id,ts.day_of_week,ts.week_letter,ts.specific_date,ts.start_time,ts.end_time,ts.schedule_mode,ts.is_active,COUNT(*) OVER()::int AS slot_total
      FROM scheduling_time_slot ts JOIN scheduling_slot_group g ON g.id=ts.slot_group_id
      WHERE g.form_id=$1 ORDER BY g.id,ts.day_of_week,ts.start_time,ts.id LIMIT 1000`,[item.formId]),
    db.query(`SELECT s.id,s.member_id,m.first_name,m.last_name,s.status,s.enrollment_start_date,s.slot_group_id
      FROM scheduling_signup s JOIN member m ON m.id=s.member_id AND m.facility_id=$2
      WHERE s.form_id=$1 AND s.archived_at IS NULL AND s.orphaned_at IS NULL
      ORDER BY m.last_name,m.first_name,s.id LIMIT $3 OFFSET $4`,[item.formId,facilityId,paging.pageSize,paging.offset]),
    db.query(`SELECT COUNT(*)::int AS total FROM scheduling_signup s JOIN member m ON m.id=s.member_id AND m.facility_id=$2
      WHERE s.form_id=$1 AND s.archived_at IS NULL AND s.orphaned_at IS NULL`,[item.formId,facilityId]),
  ])
  return {class:item,scheduleTruncated:Number(groups.rows[0]?.group_total||0)>groups.rows.length||Number(slots.rows[0]?.slot_total||0)>slots.rows.length,
    groups:groups.rows.map(g=>({id:Number(g.id),isActive:g.is_active,capacity:Number(g.max_participants),enrolledCount:Number(g.enrolled_count),waitlistCount:Number(g.waitlist_count),activeStart:date(g.active_start),activeEnd:date(g.active_end),offeringId:g.offering_id==null?null:Number(g.offering_id),
    slots:slots.rows.filter(s=>Number(s.slot_group_id)===Number(g.id)).map(s=>({id:Number(s.id),dayOfWeek:s.day_of_week,weekLetter:s.week_letter,specificDate:date(s.specific_date),startTime:s.start_time,endTime:s.end_time,scheduleMode:s.schedule_mode,isActive:s.is_active}))})),
    roster:pageResult(roster.rows.map(s=>({id:Number(s.id),memberId:Number(s.member_id),firstName:s.first_name,lastName:s.last_name,status:s.status,startDate:date(s.enrollment_start_date),slotGroupId:Number(s.slot_group_id)})),count.rows[0].total,paging)}
}

export async function memberDetail(db,facilityId,memberId,query={}) {
  const selected=await db.query(`SELECT m.id,m.first_name,m.last_name,m.email,m.phone,m.date_of_birth,m.is_active,m.app_user_id,fm.family_id
    FROM member m LEFT JOIN family_member fm ON fm.member_id=m.id AND fm.is_active=TRUE
    WHERE m.id=$1 AND m.facility_id=$2`,[id(memberId,'member'),id(facilityId)])
  if (!selected.rows[0]) throw inputError('Member not found.',404)
  const member=memberRow(selected.rows[0]),paging=pagination(query)
  const [household,people,enrollments,count]=await Promise.all([
    db.query(`SELECT f.id,f.family_name,b.id AS billing_account_id,b.payer_member_id FROM family f
      LEFT JOIN family_billing_account b ON b.family_id=f.id AND b.is_active=TRUE WHERE f.id=$1 AND f.facility_id=$2`,[member.familyId,facilityId]),
    db.query(`SELECT m.id,m.first_name,m.last_name,m.email,m.phone,m.date_of_birth,m.is_active,m.app_user_id,fm.family_id
      FROM family_member fm JOIN member m ON m.id=fm.member_id AND m.facility_id=$2
      WHERE fm.family_id=$1 AND fm.is_active=TRUE ORDER BY m.last_name,m.first_name,m.id LIMIT 100`,[member.familyId,facilityId]),
    db.query(`WITH history AS (
      SELECT s.id,s.form_id,p.display_name AS class_name,s.status,s.slot_group_id,s.enrollment_start_date,s.cancel_effective_date,s.created_at,FALSE AS historical,NULL::text AS source_id
      FROM scheduling_signup s JOIN scheduling_form f ON f.id=s.form_id
      JOIN program p ON p.id=f.program_id AND p.facility_id=$2
      WHERE s.member_id=$1 AND s.orphaned_at IS NULL
      UNION ALL
      SELECT -h.id,NULL::bigint,h.source_data->>'Class','historical',NULL::bigint,
        NULLIF(h.source_data->>'Enroll Date','')::timestamp::date,NULLIF(h.source_data->>'Drop Date','')::timestamp::date,
        h.occurred_on::timestamp,TRUE,h.source_id
      FROM jackrabbit_history_record h WHERE h.member_id=$1 AND h.facility_id=$2 AND h.record_kind='enrollment'
    ) SELECT * FROM history ORDER BY created_at DESC NULLS LAST,id DESC LIMIT $3 OFFSET $4`,[member.id,facilityId,paging.pageSize,paging.offset]),
    db.query(`WITH history AS (
      SELECT s.id,s.form_id,p.display_name AS class_name,s.status,s.slot_group_id,s.enrollment_start_date,s.cancel_effective_date,s.created_at,FALSE AS historical,NULL::text AS source_id
      FROM scheduling_signup s JOIN scheduling_form f ON f.id=s.form_id
      JOIN program p ON p.id=f.program_id AND p.facility_id=$2
      WHERE s.member_id=$1 AND s.orphaned_at IS NULL
      UNION ALL
      SELECT -h.id,NULL::bigint,h.source_data->>'Class','historical',NULL::bigint,
        NULLIF(h.source_data->>'Enroll Date','')::timestamp::date,NULLIF(h.source_data->>'Drop Date','')::timestamp::date,
        h.occurred_on::timestamp,TRUE,h.source_id
      FROM jackrabbit_history_record h WHERE h.member_id=$1 AND h.facility_id=$2 AND h.record_kind='enrollment'
    ) SELECT COUNT(*)::int AS total FROM history`,[member.id,facilityId]),
  ])
  const family=household.rows[0]
  return {member,household:family?{id:Number(family.id),name:family.family_name,payerMemberId:family.payer_member_id==null?null:Number(family.payer_member_id),members:people.rows.map(p=>({...memberRow(p),isPayer:Number(p.id)===Number(family.payer_member_id)}))}:null,
    billingAccountId:family?.billing_account_id==null?null:Number(family.billing_account_id),
    enrollments:enrollments.rows.map(s=>({id:Number(s.id),formId:s.form_id==null?null:Number(s.form_id),historical:s.historical,sourceId:s.source_id,className:s.class_name,status:s.status,slotGroupId:Number(s.slot_group_id),startDate:date(s.enrollment_start_date),cancelEffectiveDate:date(s.cancel_effective_date)})),
    enrollmentPagination:pageResult([],count.rows[0].total,paging)}
}
