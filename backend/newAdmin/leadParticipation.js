import { inputError } from './common.js'

export const LEAD_PARTICIPATION_FILTERS = ['', 'inquiry', 'free_trial', 'drop_in', 'recent_drop']

// Keep the lead directory anchored to saved inquiries. A parent's explicit
// account/household links can identify their children; matching athlete names
// or email addresses must never invent a relationship.
export const relatedAthletes = `WITH direct_ids AS MATERIALIZED (
    SELECT r.converted_member_id AS id UNION SELECT r.member_id UNION SELECT inquiry_contact.member_id
    UNION SELECT CASE WHEN COALESCE(to_jsonb(r)->>'trial_contact_member_id',to_jsonb(r)->>'dedup_trial_contact_member_id','') ~ '^[0-9]{1,18}$'
      THEN COALESCE(to_jsonb(r)->>'trial_contact_member_id',to_jsonb(r)->>'dedup_trial_contact_member_id')::bigint END
    UNION SELECT CASE WHEN COALESCE(child->>'memberId',child->>'member_id','') ~ '^[0-9]{1,18}$'
      THEN COALESCE(child->>'memberId',child->>'member_id')::bigint END
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.campers)='array' THEN r.campers ELSE '[]'::jsonb END) child
  ), direct_members AS MATERIALIZED (
    SELECT m.id,m.family_id,m.is_active FROM direct_ids linked JOIN member m ON m.id=linked.id
    WHERE m.facility_id=r.facility_id
  ), household_ids AS (
    SELECT fm.family_id FROM direct_members contact JOIN family_member fm ON fm.member_id=contact.id
      JOIN family f ON f.id=fm.family_id AND f.facility_id=r.facility_id
      WHERE contact.is_active=TRUE AND fm.is_active=TRUE
    UNION SELECT contact.family_id FROM direct_members contact JOIN family f ON f.id=contact.family_id
      AND f.facility_id=r.facility_id WHERE contact.is_active=TRUE
      AND NOT EXISTS(SELECT 1 FROM family_member history WHERE history.member_id=contact.id)
  ), athletes AS (
    SELECT id FROM direct_members
    UNION SELECT m.id FROM household_ids household JOIN family_member fm ON fm.family_id=household.family_id
      AND fm.is_active=TRUE JOIN member m ON m.id=fm.member_id AND m.facility_id=r.facility_id AND m.is_active=TRUE
    UNION SELECT m.id FROM household_ids household JOIN member m ON m.family_id=household.family_id
      AND m.facility_id=r.facility_id AND m.is_active=TRUE
      WHERE NOT EXISTS(SELECT 1 FROM family_member history WHERE history.member_id=m.id)
  )`

export function leadParticipationFilter(value) {
  const participation = String(value ?? '')
  if (!LEAD_PARTICIPATION_FILTERS.includes(participation)) throw inputError('Invalid lead participation filter.')
  return participation
}

export function leadParticipationSql(participation, today) {
  if (!participation) return null
  if (participation === 'inquiry') {
    // Public inquiries store the page path and ordinary program interests.
    // Only structured trial requests and linked records distinguish a trial
    // prospect from an inquiry; free-text messages cannot establish intent.
    return `(lower(btrim(COALESCE(r.inquiry_source,''),' /')) NOT IN ('free_trial','free-trial','free trial','trial')
      AND NOT EXISTS (SELECT 1 FROM account_invite trial_request
        WHERE trial_request.registration_id=r.id AND trial_request.facility_id=r.facility_id
          AND trial_request.invite_type='lead_registration' AND trial_request.pending_payload->>'purpose'='trial')
      AND NOT EXISTS (${relatedAthletes} SELECT 1 FROM athletes athlete
        WHERE EXISTS (SELECT 1 FROM drop_in_registration booking
          JOIN scheduling_form booking_form ON booking_form.id=booking.form_id
          JOIN program booking_class ON booking_class.id=booking_form.program_id AND booking_class.facility_id=r.facility_id
          WHERE booking.member_id=athlete.id)
        OR EXISTS (SELECT 1 FROM account_enrollment_current enrollment
          WHERE enrollment.record_member_id=athlete.id AND enrollment.record_facility_id=r.facility_id
            AND enrollment.status<>'pending_setup')))`
  }
  const booking = `EXISTS (SELECT 1 FROM drop_in_registration booking
    JOIN scheduling_form booking_form ON booking_form.id=booking.form_id
    JOIN program booking_class ON booking_class.id=booking_form.program_id AND booking_class.facility_id=r.facility_id
    WHERE booking.member_id=athlete.id AND booking.status IN ('confirmed','attended')
      AND booking.benefit_type ${participation === 'free_trial' ? "= 'free_trial'" : "IS DISTINCT FROM 'free_trial'"})`
  const recentDrop = `EXISTS (SELECT 1 FROM account_enrollment_current enrollment
    WHERE enrollment.record_member_id=athlete.id AND enrollment.record_facility_id=r.facility_id
      AND enrollment.status<>'pending_setup'
      AND NOT EXISTS (SELECT 1 FROM billing_account_activity swap
        WHERE enrollment.record_source='vortex' AND swap.signup_id=enrollment.id
          AND swap.member_id=enrollment.record_member_id
          AND swap.event_type='enrollment_class_swapped')
      AND (enrollment.cancel_effective_date BETWEEN (${today}-90) AND ${today}
        OR (enrollment.record_source='vortex' AND enrollment.status='cancelled' AND (
          EXISTS (SELECT 1 FROM enrollment_action action WHERE action.signup_id=enrollment.id
            AND action.requested_status='cancelled' AND action.status IN ('pending','applied')
            AND action.effective_date BETWEEN (${today}-90) AND ${today})
          OR EXISTS (SELECT 1 FROM billing_account_activity cancellation WHERE cancellation.signup_id=enrollment.id
            AND cancellation.member_id=enrollment.record_member_id
            AND cancellation.event_type IN ('enrollment_cancelled_immediately','enrollment_cancellation_scheduled')
            AND account_source_date(COALESCE(cancellation.after_value->>'cancelEffectiveDate',
              cancellation.details->'preview'->>'effectiveDate')) BETWEEN (${today}-90) AND ${today})
        ))))`
  return `EXISTS (${relatedAthletes} SELECT 1 FROM athletes athlete
    WHERE ${participation === 'recent_drop' ? recentDrop : booking})`
}
