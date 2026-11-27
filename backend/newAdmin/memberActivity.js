import { hasActiveAnnualMembershipSql } from '../scheduling/annualMembership.js'

export const memberHasActiveMembershipSql = hasActiveAnnualMembershipSql

export const memberIsActiveSql = (memberId, facilityId, asOfDate) => `EXISTS (
  SELECT 1 FROM member activity_member
  WHERE activity_member.id = ${memberId} AND activity_member.facility_id = ${facilityId}
    AND (${memberHasActiveMembershipSql('activity_member.id', asOfDate)}
      OR EXISTS (SELECT 1 FROM drop_in_registration activity_drop_in
        WHERE activity_drop_in.member_id = activity_member.id
          AND activity_drop_in.status IN ('confirmed', 'attended')
          AND activity_drop_in.benefit_type IS DISTINCT FROM 'free_trial'
          AND activity_drop_in.class_date BETWEEN (${asOfDate} - INTERVAL '2 months')::date AND ${asOfDate}))
)`

// Share the current-enrollment boundary across directories and account details.
// Future starts, paused/cancelled enrollments and history are not enrolled now.
export const currentEnrollmentSql = (asOfDate, alias = 's') => `NOT ${alias}.historical_only AND ${alias}.archived_at IS NULL AND ${alias}.orphaned_at IS NULL
  AND ${alias}.status = 'confirmed' AND ${alias}.enrollment_start_date <= ${asOfDate}
  AND (${alias}.cancel_effective_date IS NULL OR ${alias}.cancel_effective_date > ${asOfDate})
  AND (${alias}.pause_effective_date IS NULL OR ${alias}.pause_effective_date > ${asOfDate})
  AND COALESCE((
    SELECT (enrollment_window.starts_on IS NULL OR enrollment_window.starts_on <= ${asOfDate})
      AND (enrollment_window.ends_on IS NULL OR enrollment_window.ends_on >= ${asOfDate})
    FROM scheduling_form enrollment_form
    LEFT JOIN scheduling_slot_group enrollment_group ON enrollment_group.id = ${alias}.slot_group_id
      AND enrollment_group.form_id = enrollment_form.id
    LEFT JOIN scheduling_offering enrollment_offering ON enrollment_offering.id = enrollment_group.offering_id
      AND enrollment_offering.form_id = enrollment_form.id
    CROSS JOIN LATERAL (SELECT
      CASE WHEN enrollment_offering.id IS NOT NULL AND (enrollment_group.inherits_offering_dates
        OR (enrollment_group.active_start IS NULL AND enrollment_group.active_end IS NULL))
        THEN enrollment_offering.start_date ELSE COALESCE(enrollment_group.active_start,enrollment_form.start_date) END AS starts_on,
      CASE WHEN enrollment_offering.id IS NOT NULL AND (enrollment_group.inherits_offering_dates
        OR (enrollment_group.active_start IS NULL AND enrollment_group.active_end IS NULL))
        THEN enrollment_offering.end_date ELSE COALESCE(enrollment_group.active_end,enrollment_form.end_date) END AS ends_on
    ) enrollment_window
    WHERE enrollment_form.id = ${alias}.form_id
  ), (${alias}.record_program_end IS NULL OR ${alias}.record_program_end >= ${asOfDate}))`

export const memberIsEnrolledSql = (memberId, facilityId, asOfDate) => `EXISTS (
  SELECT 1 FROM account_enrollment_current s
  WHERE s.record_member_id = ${memberId} AND s.record_facility_id = ${facilityId}
    AND ${currentEnrollmentSql(asOfDate)}
)`
