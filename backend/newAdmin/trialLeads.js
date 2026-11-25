import { formatDateOnly } from '../scheduling/slotActiveDates.js'

// Membership is explicit: a child's saved ID, rather than a matching name or
// email, joins a trial to the child displayed in the adjacent column.
export const leadFreeTrialsJoin = `LEFT JOIN LATERAL (
  SELECT jsonb_agg(jsonb_build_object('id',booking.id,'memberId',athlete.id,
    'childIndex',camper.ordinality-1,'childName',concat_ws(' ',athlete.first_name,athlete.last_name),
    'date',booking.class_date::text,'className',COALESCE(NULLIF(p.display_name,''),p.name,sf.title),
    'status',booking.status) ORDER BY camper.ordinality,booking.class_date DESC,booking.id DESC) AS free_trials
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.campers)='array' THEN r.campers ELSE '[]'::jsonb END)
    WITH ORDINALITY camper(child,ordinality)
  JOIN member athlete ON athlete.id::text=camper.child->>'memberId' AND athlete.facility_id=r.facility_id
  JOIN drop_in_registration booking ON booking.member_id=athlete.id AND booking.benefit_type='free_trial'
  JOIN scheduling_form sf ON sf.id=booking.form_id
  JOIN program p ON p.id=sf.program_id AND p.facility_id=r.facility_id
) trial_history ON TRUE`

/** Caller owns the transaction and has authorized this guardian and child. */
export async function recordFreeTrialLead(db, { facilityId, payerMemberId, memberId }) {
  // Serialize siblings booked at the same time so one household has one lead.
  const payer = (await db.query(`SELECT id,first_name,last_name,email,phone FROM member
    WHERE id=$1 AND facility_id=$2 FOR UPDATE`, [payerMemberId, facilityId])).rows[0]
  const athlete = (await db.query(`SELECT id,first_name,last_name,date_of_birth,gender FROM member
    WHERE id=$1 AND facility_id=$2 AND EXISTS(SELECT 1 FROM parent_guardian_authority authority
      WHERE authority.child_member_id=member.id AND authority.parent_member_id=$3 AND authority.has_legal_authority=TRUE)`,
  [memberId, facilityId, payerMemberId])).rows[0]
  if (!payer || !athlete) throw new Error('The trial family could not be linked to its lead.')
  const family = (await db.query(`SELECT f.id FROM family f WHERE f.facility_id=$2 AND (
    f.id=(SELECT CASE WHEN count(*)=1 THEN min(family_id) END FROM family_member WHERE member_id=$1 AND is_active=TRUE)
    OR (NOT EXISTS(SELECT 1 FROM family_member WHERE member_id=$1)
      AND f.id=(SELECT family_id FROM member WHERE id=$1))) FOR UPDATE`, [payerMemberId, facilityId])).rows[0]
  const child = { memberId: Number(athlete.id), firstName: athlete.first_name, lastName: athlete.last_name,
    dateOfBirth: formatDateOnly(athlete.date_of_birth), gender: athlete.gender || '' }
  const lead = (await db.query(`SELECT id,campers FROM registrations
    WHERE facility_id=$1 AND (member_id=$2 OR ($3::bigint IS NOT NULL AND (
      EXISTS(SELECT 1 FROM family_member fm WHERE fm.member_id=registrations.member_id AND fm.family_id=$3 AND fm.is_active=TRUE)
      OR EXISTS(SELECT 1 FROM member contact WHERE contact.id=registrations.member_id AND contact.family_id=$3
        AND NOT EXISTS(SELECT 1 FROM family_member fm WHERE fm.member_id=contact.id))))) AND inquiry_source='free_trial'
      AND converted_member_id IS NULL AND archived IS NOT TRUE
    ORDER BY id DESC LIMIT 1 FOR UPDATE`, [facilityId, payerMemberId, family?.id ?? null])).rows[0]
  if (lead) {
    const children = Array.isArray(lead.campers) ? lead.campers : []
    const index = children.findIndex(stored => Number(stored.memberId) === Number(memberId))
    if (index < 0) children.push(child)
    else children[index] = { ...children[index], ...child }
    await db.query('UPDATE registrations SET campers=$2::jsonb,updated_at=now() WHERE id=$1', [lead.id, JSON.stringify(children)])
    return Number(lead.id)
  }
  const saved = await db.query(`INSERT INTO registrations
    (facility_id,member_id,first_name,last_name,email,phone,campers,inquiry_source,lead_status,contacted,follow_up)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'free_trial','qualified',FALSE,FALSE) RETURNING id`,
  [facilityId, payerMemberId, payer.first_name.slice(0,50), payer.last_name.slice(0,50), payer.email || '', payer.phone, JSON.stringify([child])])
  return Number(saved.rows[0].id)
}
