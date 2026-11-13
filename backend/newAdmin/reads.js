import { sortClasses } from './classSorting.js'
import { classRosterForForm } from './classRoster.js'
import { resolveEffectiveFormPricing } from '../programs/pricingDefaults.js'
import { hydrateProgramPricingRow } from '../programs/programPricingOptions.js'
import { id, inputError, pagination, pageResult, searchValue, memberRow, date } from './common.js'

const classSelect = `SELECT p.id,p.programs_id,p.display_name AS name,pr.display_name AS program_name,
  p.abridged_name,p.skill_level,p.age_min,p.age_max,p.description,p.skill_requirements,p.is_active AS class_active,
  (p.archived IS TRUE OR pr.archived IS TRUE) AS archived,
  to_jsonb(pr) AS pricing_program,to_jsonb(sf) AS pricing_form,
  p.is_active AND NOT COALESCE(p.archived,FALSE) AS is_active,sf.id AS form_id,
  COALESCE(cap.capacity,0)::int AS capacity,COALESCE(en.enrolled_count,0)::int AS enrolled_count,
  COALESCE(en.waitlist_count,0)::int AS waitlist_count,
  (SELECT COUNT(*)::int FROM scheduling_signup hold WHERE hold.form_id=sf.id AND hold.status='pending_setup' AND hold.reserved_until>now()) AS reserved_count
  FROM program p JOIN facility facility_row ON facility_row.id=p.facility_id LEFT JOIN programs pr ON pr.id=p.programs_id AND pr.facility_id=p.facility_id
  LEFT JOIN LATERAL (SELECT f.* FROM scheduling_form f WHERE f.program_id=p.id AND f.deleted_at IS NULL ORDER BY f.is_active DESC,f.id DESC LIMIT 1) sf ON TRUE
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

const classRow = row => {
  const pricing = resolveEffectiveFormPricing(hydrateProgramPricingRow(row.pricing_program),row.pricing_form)
  return ({costAmountCents:pricing.costAmountCents,costUnit:pricing.costUnit,
  monthlyPriceCents:pricing.costUnit === 'per_month' ? pricing.costAmountCents : null,id:Number(row.id),programsId:row.programs_id==null?null:Number(row.programs_id),formId:row.form_id == null ? null:Number(row.form_id),name:row.name,
  programName:row.program_name || '',isActive:row.is_active,archived:row.archived,
  details:{displayName:row.name,abridgedName:row.abridged_name,skillLevel:row.skill_level,ageMin:row.age_min,ageMax:row.age_max,
    description:row.description,skillRequirements:row.skill_requirements,isActive:row.class_active},capacity:Number(row.capacity),enrolledCount:Number(row.enrolled_count),waitlistCount:Number(row.waitlist_count),reservedCount:Number(row.reserved_count || 0)})
}

export async function listClasses(db,facilityId,query={}, {includeArchived=false}={}) {
  const paging=pagination(query)
  const values=[id(facilityId),searchValue(query.search)]
  const archiveFilter=includeArchived ? '' : 'AND p.archived IS NOT TRUE AND pr.archived IS NOT TRUE'
  const where=`p.facility_id=$1 ${archiveFilter} AND concat_ws(' ',p.display_name,pr.display_name) ILIKE $2 ESCAPE '\\'`
  // Sort the full matching catalog using the canonical resolved class prices
  // and schedules, then paginate. This also avoids sorting formatted currency.
  sortClasses([],query.sort || 'class',query.direction || 'asc')
  const rows=await db.query(`${classSelect} WHERE ${where} ORDER BY LOWER(p.display_name),p.id`,values)
  const classRows=rows.rows.map(classRow)
  if (classRows.length) {
    const slots=await db.query(`SELECT f.program_id AS class_id,ts.id,ts.day_of_week,ts.week_letter,ts.specific_date,ts.start_time,ts.end_time,g.active_start,g.active_end,o.start_date AS offering_start,o.end_date AS offering_end
      FROM scheduling_form f JOIN program p ON p.id=f.program_id AND p.facility_id=$2
      JOIN facility facility_row ON facility_row.id=p.facility_id
      JOIN scheduling_slot_group g ON g.form_id=f.id JOIN scheduling_time_slot ts ON ts.slot_group_id=g.id
      LEFT JOIN scheduling_offering o ON o.id=g.offering_id
      WHERE f.program_id=ANY($1::bigint[]) AND f.deleted_at IS NULL AND f.is_active AND g.is_active AND ts.is_active
        AND (g.offering_id IS NULL OR o.is_selected)
        AND COALESCE(o.end_date,g.active_end,f.end_date,'infinity'::date)>=(CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(facility_row.timezone,''),'America/New_York'))::date
      ORDER BY ts.specific_date NULLS FIRST,ts.day_of_week,ts.start_time,ts.id`,[classRows.map(row=>row.id),facilityId])
    for (const row of classRows) row.schedules=slots.rows.filter(slot=>Number(slot.class_id)===row.id).map(slot=>({id:Number(slot.id),dayOfWeek:slot.day_of_week,weekLetter:slot.week_letter,specificDate:date(slot.specific_date),startTime:slot.start_time,endTime:slot.end_time,activeStart:date(slot.offering_start ?? slot.active_start),activeEnd:date(slot.offering_end ?? slot.active_end)}))
  }
  sortClasses(classRows,query.sort || 'class',query.direction || 'asc')
  return pageResult(classRows.slice(paging.offset,paging.offset+paging.pageSize),classRows.length,paging)
}

export async function classDetail(db,facilityId,classId,query={}) {
  const selected=await db.query(`${classSelect} WHERE p.id=$1 AND p.facility_id=$2`,[id(classId,'class'),id(facilityId)])
  if (!selected.rows[0]) throw inputError('Class not found.',404)
  const item=classRow(selected.rows[0])
  const paging=pagination({...query,page:query.rosterPage || query.page})
  if (!item.formId) return {class:item,groups:[],roster:pageResult([],0,paging)}
  const [groups,slots,roster]=await Promise.all([
    db.query(`SELECT g.id,g.max_participants,g.active_start,g.active_end,g.offering_id,g.is_active,COUNT(*) OVER()::int AS group_total,
      COUNT(s.id) FILTER (WHERE s.status='confirmed')::int AS enrolled_count,
      COUNT(s.id) FILTER (WHERE s.status='waitlisted')::int AS waitlist_count,pending_registration_holds(g.id) AS reserved_count
      FROM scheduling_slot_group g LEFT JOIN scheduling_signup s ON s.slot_group_id=g.id
       AND s.archived_at IS NULL AND s.orphaned_at IS NULL
       AND EXISTS (SELECT 1 FROM member m WHERE m.id=s.member_id AND m.facility_id=$2)
      WHERE g.form_id=$1 GROUP BY g.id ORDER BY g.id LIMIT 100`,[item.formId,facilityId]),
    db.query(`SELECT ts.id,ts.slot_group_id,ts.day_of_week,ts.week_letter,ts.specific_date,ts.start_time,ts.end_time,ts.schedule_mode,ts.is_active,COUNT(*) OVER()::int AS slot_total
      FROM scheduling_time_slot ts JOIN scheduling_slot_group g ON g.id=ts.slot_group_id
      WHERE g.form_id=$1 ORDER BY g.id,ts.day_of_week,ts.start_time,ts.id LIMIT 1000`,[item.formId]),
    classRosterForForm(db,facilityId,item.formId,query),
  ])
  return {class:item,scheduleTruncated:Number(groups.rows[0]?.group_total||0)>groups.rows.length||Number(slots.rows[0]?.slot_total||0)>slots.rows.length,
    groups:groups.rows.map(g=>({id:Number(g.id),isActive:g.is_active,capacity:Number(g.max_participants),enrolledCount:Number(g.enrolled_count),waitlistCount:Number(g.waitlist_count),reservedCount:Number(g.reserved_count || 0),activeStart:date(g.active_start),activeEnd:date(g.active_end),offeringId:g.offering_id==null?null:Number(g.offering_id),
    slots:slots.rows.filter(s=>Number(s.slot_group_id)===Number(g.id)).map(s=>({id:Number(s.id),dayOfWeek:s.day_of_week,weekLetter:s.week_letter,specificDate:date(s.specific_date),startTime:s.start_time,endTime:s.end_time,scheduleMode:s.schedule_mode,isActive:s.is_active}))})),
    roster}
}

export async function memberDetail(db,facilityId,memberId,query={}) {
  const selected=await db.query(`SELECT m.id,m.first_name,m.last_name,m.email,m.phone,m.date_of_birth,m.is_active,m.app_user_id,fm.family_id,
    EXISTS(SELECT 1 FROM facility f WHERE f.id=m.facility_id AND f.owner_user_id=m.app_user_id) AS is_owner
    FROM member m LEFT JOIN family_member fm ON fm.member_id=m.id AND fm.is_active=TRUE
    WHERE m.id=$1 AND m.facility_id=$2`,[id(memberId,'member'),id(facilityId)])
  if (!selected.rows[0]) throw inputError('Member not found.',404)
  const member={...memberRow(selected.rows[0]),isOwner:selected.rows[0].is_owner},paging=pagination(query)
  const [household,people,enrollments,count]=await Promise.all([
    db.query(`SELECT f.id,f.family_name,b.id AS billing_account_id,b.payer_member_id FROM family f
      LEFT JOIN family_billing_account b ON b.family_id=f.id AND b.is_active=TRUE WHERE f.id=$1 AND f.facility_id=$2`,[member.familyId,facilityId]),
    db.query(`SELECT m.id,m.first_name,m.last_name,m.email,m.phone,m.date_of_birth,m.is_active,m.app_user_id,fm.family_id
      FROM family_member fm JOIN member m ON m.id=fm.member_id AND m.facility_id=$2
      WHERE fm.family_id=$1 AND fm.is_active=TRUE ORDER BY m.last_name,m.first_name,m.id LIMIT 100`,[member.familyId,facilityId]),
    db.query(`SELECT s.id,s.form_id,s.record_class_name AS class_name,s.status,s.slot_group_id,
      s.enrollment_start_date,s.cancel_effective_date,s.created_at,s.historical_only AS historical,
      CASE WHEN s.historical_only THEN s.record_source_id END AS source_id,s.record_source AS source
      FROM account_enrollment_current s WHERE s.member_id=$1 AND s.record_facility_id=$2 AND s.orphaned_at IS NULL
      ORDER BY s.created_at DESC NULLS LAST,s.id DESC LIMIT $3 OFFSET $4`,[member.id,facilityId,paging.pageSize,paging.offset]),
    db.query(`SELECT count(*)::int AS total FROM account_enrollment_current s
      WHERE s.member_id=$1 AND s.record_facility_id=$2 AND s.orphaned_at IS NULL`,[member.id,facilityId]),
  ])
  const family=household.rows[0]
  return {member,household:family?{id:Number(family.id),name:family.family_name,payerMemberId:family.payer_member_id==null?null:Number(family.payer_member_id),members:people.rows.map(p=>({...memberRow(p),isPayer:Number(p.id)===Number(family.payer_member_id)}))}:null,
    billingAccountId:family?.billing_account_id==null?null:Number(family.billing_account_id),
    enrollments:enrollments.rows.map(s=>({id:Number(s.id),formId:s.form_id==null?null:Number(s.form_id),historical:s.historical,sourceId:s.source_id,className:s.class_name,status:s.status,slotGroupId:Number(s.slot_group_id),startDate:date(s.enrollment_start_date),cancelEffectiveDate:date(s.cancel_effective_date)})),
    enrollmentPagination:pageResult([],count.rows[0].total,paging)}
}
