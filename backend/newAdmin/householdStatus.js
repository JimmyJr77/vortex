import { memberIsActiveSql, memberIsEnrolledSql } from './memberActivity.js'

// Current household links are relationships, independent of account access.
// A legacy family_id is used only before any family_member history exists.
// Arguments are trusted SQL references; request values must remain bound.
export const currentHouseholdLinkSql = (member, familyId) => `(EXISTS (
  SELECT 1 FROM family_member status_link WHERE status_link.member_id=${member}.id
    AND status_link.family_id=${familyId} AND status_link.is_active IS TRUE
) OR (${member}.family_id=${familyId} AND NOT EXISTS (
  SELECT 1 FROM family_member status_history WHERE status_history.member_id=${member}.id
)))`

export const familyIsActiveSql = (familyId, facilityId, today) => `EXISTS (
  SELECT 1 FROM member status_member WHERE status_member.facility_id=${facilityId}
    AND ${currentHouseholdLinkSql('status_member', familyId)}
    AND status_member.date_of_birth > (${today} - INTERVAL '18 years')::date
    AND status_member.date_of_birth <= ${today}
    AND ${memberIsActiveSql('status_member.id', facilityId, today)}
)`

export const familyIsEnrolledSql = (familyId, facilityId, today) => `EXISTS (
  SELECT 1 FROM member status_member WHERE status_member.facility_id=${facilityId}
    AND ${currentHouseholdLinkSql('status_member', familyId)}
    AND ${memberIsEnrolledSql('status_member.id', facilityId, today)}
)`
