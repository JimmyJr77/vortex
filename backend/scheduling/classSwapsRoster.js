import { normalizePhoneNumber } from '../phoneNumbers.js'
import { enrollmentStatusOnDateSql } from './enrollmentStatusOnDate.js'

const CLASS_SWAP_SOURCE_JOINS = `
  LEFT JOIN scheduling_signup signup ON swap.source_type='scheduling' AND signup.id=swap.source_id
  LEFT JOIN drop_in_registration booking ON swap.source_type='drop_in' AND booking.id=swap.source_id
`
const CLASS_SWAP_ACTIVE_SOURCE_SQL = `
  ((swap.source_type='scheduling' AND ${enrollmentStatusOnDateSql('signup','swap.source_date')}='confirmed'
    AND ${enrollmentStatusOnDateSql('signup','swap.target_date')}='confirmed' AND signup.archived_at IS NULL AND signup.orphaned_at IS NULL
    AND signup.form_id=swap.source_form_id AND signup.slot_group_id=swap.source_slot_group_id
    AND (signup.time_slot_id IS NULL OR signup.time_slot_id=swap.source_time_slot_id)
    AND signup.enrollment_start_date<=swap.source_date
    AND (signup.cancel_effective_date IS NULL OR signup.cancel_effective_date>GREATEST(swap.source_date,swap.target_date)))
  OR (swap.source_type='drop_in' AND booking.status IN ('confirmed','attended') AND booking.form_id=swap.source_form_id
    AND booking.slot_group_id=swap.source_slot_group_id AND booking.class_date=swap.source_date))
`

export async function hasClassSwapSchema(db) {
  return (await db.query("SELECT to_regclass('public.scheduling_class_swap') IS NOT NULL AS exists")).rows[0]?.exists === true
}

export function applyClassSwapRows(classes, date, swaps) {
  // Remove all sources first, so same-day moves cannot depend on query order.
  for (const swap of swaps) {
    if (swap.source_date !== date) continue
    for (const item of classes) {
      if (Number(item.timeSlotId) !== Number(swap.source_time_slot_id)) continue
      item.athletes = item.athletes.filter(athlete => !(athlete.source === swap.source_type && Number(athlete.signupId) === Number(swap.source_id)))
    }
  }
  for (const swap of swaps) {
    if (swap.target_date !== date) continue
    const item = classes.find(klass => Number(klass.timeSlotId) === Number(swap.target_time_slot_id))
    if (!item) continue
    const athlete = typeof swap.athlete === 'string' ? JSON.parse(swap.athlete) : swap.athlete
    if (!item.athletes.some(row => (row.source === athlete.source && Number(row.signupId) === Number(athlete.signupId))
      || (athlete.memberId != null && Number(row.memberId) === Number(athlete.memberId)))) {
      item.athletes.push({ ...athlete, isNew: false, isClassSwap: true, classSwapId: Number(swap.id) })
    }
  }
  for (const item of classes) {
    item.athletes.sort((a,b) => a.name.localeCompare(b.name))
    item.athleteCount = item.athletes.length
  }
}

export async function applyClassSwapOverrides(db, classes, date, { facilityId = null } = {}) {
  if (!await hasClassSwapSchema(db)) return
  const swaps = await db.query(`SELECT swap.*,swap.source_date::text,swap.target_date::text,
      COALESCE(NULLIF(TRIM(m.first_name),''),signup.first_name,booking.first_name,'') AS current_first_name,
      COALESCE(NULLIF(TRIM(m.last_name),''),signup.last_name,booking.last_name,'') AS current_last_name,
      COALESCE(signup.member_id,booking.member_id) AS current_member_id,
      CASE WHEN m.date_of_birth IS NULL THEN NULL
        ELSE EXTRACT(YEAR FROM AGE($1::date,m.date_of_birth))::int END AS current_age,
      CASE WHEN payer_contact.account_id IS NOT NULL THEN COALESCE(payer_contact.email,'')
        ELSE COALESCE(NULLIF(TRIM(signup.email),''),NULLIF(TRIM(booking.email),''),'') END AS current_email,
      CASE WHEN payer_contact.account_id IS NOT NULL THEN COALESCE(payer_contact.phone,'')
        ELSE COALESCE(NULLIF(TRIM(signup.phone),''),NULLIF(TRIM(booking.phone),''),'') END AS current_phone
    FROM scheduling_class_swap swap
    ${CLASS_SWAP_SOURCE_JOINS}
    LEFT JOIN member m ON m.id=COALESCE(signup.member_id,booking.member_id)
    LEFT JOIN LATERAL (
      SELECT account.id AS account_id,
        COALESCE(NULLIF(TRIM(account.billing_email),''),NULLIF(TRIM(payer.email),''),NULLIF(TRIM(payer_user.email),'')) AS email,
        COALESCE(NULLIF(TRIM(account.billing_phone),''),NULLIF(TRIM(payer.phone),'')) AS phone
      FROM family_member membership
      JOIN family household ON household.id=membership.family_id AND household.facility_id=m.facility_id AND household.archived=FALSE
      JOIN family_billing_account account ON account.family_id=membership.family_id AND account.is_active=TRUE
      LEFT JOIN member payer ON payer.id=account.payer_member_id AND payer.facility_id=m.facility_id
      LEFT JOIN app_user payer_user ON payer_user.id=payer.app_user_id
      WHERE membership.member_id=m.id AND membership.is_active=TRUE ORDER BY account.id LIMIT 1
    ) payer_contact ON TRUE
    WHERE (swap.source_date=$1::date OR swap.target_date=$1::date) AND ($2::bigint IS NULL OR swap.facility_id=$2)
      AND ${CLASS_SWAP_ACTIVE_SOURCE_SQL}
    ORDER BY swap.id`, [date,facilityId])
  const hydrated=swaps.rows.map(swap=>{
    const snapshot=typeof swap.athlete==='string'?JSON.parse(swap.athlete):swap.athlete
    return {...swap,athlete:{...snapshot,
      memberId:swap.current_member_id==null?null:Number(swap.current_member_id),
      firstName:swap.current_first_name,lastName:swap.current_last_name,
      name:`${swap.current_first_name} ${swap.current_last_name}`.trim()||'Unnamed athlete',
      age:swap.current_age==null?null:Number(swap.current_age),email:swap.current_email,
      phone:normalizePhoneNumber(swap.current_phone)??swap.current_phone,
    }}
  })
  applyClassSwapRows(classes,date,hydrated)
}

// Public group bookings cover every sibling slot. Reserve against the busiest
// affected slot; a departure can free a seat when the group has one active slot.
export async function classSwapCapacityDeltas(db, { startDate = null, endDate = null, groupId = null } = {}) {
  if (!await hasClassSwapSchema(db)) return new Map()
  const result = await db.query(`WITH active_swaps AS (
    SELECT swap.* FROM scheduling_class_swap swap ${CLASS_SWAP_SOURCE_JOINS} WHERE ${CLASS_SWAP_ACTIVE_SOURCE_SQL}
  ), deltas AS (
    SELECT target_slot_group_id AS group_id,target_time_slot_id AS slot_id,target_date AS date,1 AS delta FROM active_swaps
    UNION ALL SELECT source_slot_group_id,source_time_slot_id,source_date,-1 FROM active_swaps
  ), per_slot AS (SELECT group_id,slot_id,date,SUM(delta)::int AS delta FROM deltas
    WHERE ($1::date IS NULL OR date >= $1) AND ($2::date IS NULL OR date <= $2) AND ($3::bigint IS NULL OR group_id=$3)
    GROUP BY group_id,slot_id,date)
    SELECT group_id,date::text,
      CASE WHEN (SELECT COUNT(*) FROM scheduling_time_slot slot WHERE slot.slot_group_id=per_slot.group_id AND slot.is_active=TRUE)=1
        THEN MAX(delta) ELSE GREATEST(0,MAX(delta)) END::int AS delta
    FROM per_slot GROUP BY group_id,date`, [startDate,endDate,groupId])
  return new Map(result.rows.map(row => [`${row.group_id}:${row.date}`,Number(row.delta)]))
}

export async function classSwapCapacityDelta(db, groupId, date) {
  return (await classSwapCapacityDeltas(db,{groupId,startDate:date,endDate:date})).get(`${groupId}:${date}`) ?? 0
}

export async function classSwapAssessmentConflict(db,facilityId,date,startTime,endTime) {
  if(!await hasClassSwapSchema(db))return false
  const result=await db.query(`SELECT swap.id FROM scheduling_class_swap swap ${CLASS_SWAP_SOURCE_JOINS}
    JOIN scheduling_form target_form ON target_form.id=swap.target_form_id JOIN program assessment ON assessment.id=target_form.program_id
    JOIN scheduling_time_slot target_time ON target_time.id=swap.target_time_slot_id
    WHERE swap.facility_id=$1 AND swap.target_date=$2::date AND assessment.is_trial_assessment=TRUE
      AND target_time.start_time<$4::time AND target_time.end_time>$3::time AND ${CLASS_SWAP_ACTIVE_SOURCE_SQL} LIMIT 1`,[facilityId,date,startTime,endTime])
  return result.rows.length>0
}
