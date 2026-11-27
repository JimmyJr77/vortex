import { relatedAthletes } from './leadParticipation.js'

// Trial tags describe requests as well as attendance. Action availability uses
// actual reservations: every noncancelled trial booking consumes that credit.
export function leadActionEligibilityJoin() {
  return `LEFT JOIN LATERAL (
    SELECT EXISTS (${relatedAthletes} SELECT 1 FROM athletes athlete
      JOIN drop_in_registration booking ON booking.member_id=athlete.id
      JOIN scheduling_form booking_form ON booking_form.id=booking.form_id
      JOIN program booking_class ON booking_class.id=booking_form.program_id AND booking_class.facility_id=r.facility_id
      WHERE booking.benefit_type='free_trial' AND booking.status<>'cancelled'
        AND (booking.status<>'account_required'
          OR COALESCE(NULLIF(to_jsonb(booking)->>'expires_at','')::timestamptz>now(),TRUE))) AS has_free_trial_used,
      (SELECT linked.id FROM member linked WHERE linked.facility_id=r.facility_id
        AND linked.id=COALESCE(r.converted_member_id,
          NULLIF(to_jsonb(r)->>'trial_contact_member_id','')::bigint,
          NULLIF(to_jsonb(r)->>'dedup_trial_contact_member_id','')::bigint,r.member_id)) AS linked_member_id
  ) lead_actions ON TRUE`
}
