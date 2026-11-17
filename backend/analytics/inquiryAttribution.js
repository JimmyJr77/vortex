import { describeAcquisitionSource } from './acquisitionSource.js'

// Match a consented, non-staff visit near an older inquiry when no snapshot
// exists. A saved touch or registration tags take priority as a set.
export const inquiryAttributionJoins = `
  LEFT JOIN business_acquisition touch ON touch.record_kind = 'inquiry' AND touch.record_id = r.id
  LEFT JOIN LATERAL (
    SELECT v.session_id, v.referrer, v.utm_source, v.utm_medium, v.utm_campaign
    FROM analytics_events e
    JOIN visitor_sessions v ON v.session_id = e.session_id AND v.visitor_id = e.visitor_id
    WHERE touch.record_id IS NULL AND r.inquiry_source IS DISTINCT FROM 'admin_portal'
      AND r.submitted_by_name IS NULL AND r.submitted_by_user_id IS NULL
      AND e.visitor_id = r.visitor_id AND e.event_name = 'page_view'
      AND e.consent_analytics IS TRUE AND e.is_staff IS NOT TRUE AND v.is_staff IS NOT TRUE
      AND v.started_at <= e.occurred_at
      AND e.occurred_at BETWEEN r.created_at - interval '30 minutes' AND r.created_at
    ORDER BY e.occurred_at DESC, e.id DESC LIMIT 1
  ) recent ON TRUE`

const hasRegistrationTags = '(r.utm_source IS NOT NULL OR r.utm_medium IS NOT NULL OR r.utm_campaign IS NOT NULL)'
const tag = key => `CASE WHEN touch.record_id IS NOT NULL THEN touch.${key}
                         WHEN ${hasRegistrationTags} THEN r.utm_${key}
                         ELSE recent.utm_${key} END AS ${key}`

export const inquiryAttributionFields = `
  ${tag('source')}, ${tag('medium')}, ${tag('campaign')},
  touch.referrer_host, recent.referrer AS legacy_referrer,
  (touch.landing_path IS NOT NULL OR recent.session_id IS NOT NULL) AS has_visit,
  (r.inquiry_source IS NOT DISTINCT FROM 'admin_portal' OR r.submitted_by_name IS NOT NULL
    OR r.submitted_by_user_id IS NOT NULL) AS staff_entry`

export async function getAnalyticsInquiries(pool, { from, to }, facilityId) {
  const { rows } = await pool.query(`
    SELECT r.id, r.first_name, r.last_name, r.email, r.phone, r.created_at, r.contacted, r.admin_notes,
      r.visitor_id, r.landing_page, r.utm_source, r.utm_medium, r.utm_campaign, r.lead_status,
      r.interests_array, r.interests, ${inquiryAttributionFields}
    FROM registrations r
    ${inquiryAttributionJoins}
    WHERE r.facility_id = $3 AND r.archived IS NOT TRUE AND r.created_at BETWEEN $1 AND $2
    ORDER BY r.created_at DESC, r.id DESC`,
  [from, to, facilityId])

  return rows.map(({ source, medium, campaign, referrer_host, legacy_referrer, has_visit, staff_entry, ...row }) => ({
    ...row,
    acquisition: describeAcquisitionSource({ source, medium, campaign, referrer_host, legacy_referrer, has_visit, staff_entry }),
  }))
}
