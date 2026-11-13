// Submitted contact data is a staff triage hint, never an account authorization.
// Only a single active member in the inquiry's facility can be shown as a match.
export function inquiryMemberMatchJoin(facility, email) {
  const contactEmail = `NULLIF(lower(btrim(${email})), '')`
  return `LEFT JOIN LATERAL (
    SELECT CASE WHEN count(*) = 1 THEN min(matches.id) END AS member_id
    FROM (
      SELECT m.id
      FROM member m
      WHERE m.facility_id = ${facility} AND m.is_active IS TRUE
        AND m.email IS NOT NULL AND lower(btrim(m.email)) = ${contactEmail}
      UNION
      SELECT m.id
      FROM app_user u
      JOIN member m ON m.app_user_id = u.id AND m.facility_id = u.facility_id
      WHERE u.facility_id = ${facility} AND u.is_active IS TRUE AND m.is_active IS TRUE
        AND NULLIF(btrim(u.email), '') IS NOT NULL AND lower(btrim(u.email)) = ${contactEmail}
    ) matches
  ) inquiry_contact ON TRUE`
}
