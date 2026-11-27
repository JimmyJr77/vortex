import { leadParticipationSql, relatedAthletes } from './leadParticipation.js'
import { memberHasActiveMembershipSql } from './memberActivity.js'

const trialSources = new Set(['free_trial', 'free-trial', 'free trial', 'trial'])
const isTrialSource = source => trialSources.has(String(source ?? '').trim().replace(/^\/+|\/+$/g, '').toLowerCase())
const trialSourceSql = "lower(btrim(COALESCE(r.inquiry_source,''),' /')) IN ('free_trial','free-trial','free trial','trial')"

// Effective lead groups provide these saved source IDs. Raw write responses can
// use the same helper without fabricating source records or conversion dates.
export const leadRegistrationIdsSql = `ARRAY(SELECT value::bigint FROM jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(to_jsonb(r)->'related_registration_ids')='array'
    THEN to_jsonb(r)->'related_registration_ids' ELSE jsonb_build_array(r.id) END
) source_id(value) WHERE value ~ '^[0-9]{1,18}$')`

export function leadMetadataJoin(today) {
  const converted = `COALESCE((to_jsonb(r)->>'is_converted')::boolean,
    r.converted_member_id IS NOT NULL OR (r.member_id IS NOT NULL AND NOT (${trialSourceSql}))
      OR r.lead_status='converted',FALSE)`
  const freeTrial = `(COALESCE((to_jsonb(r)->>'has_trial_provenance')::boolean,FALSE)
    OR ${trialSourceSql} OR COALESCE(lead_invitation_evidence.has_trial,FALSE)
    OR ${leadParticipationSql('free_trial', today)})`
  const inquiry = `(COALESCE((to_jsonb(r)->>'has_inquiry_provenance')::boolean,FALSE)
    OR NOT (${trialSourceSql}) OR COALESCE(lead_invitation_evidence.has_inquiry,FALSE))`
  const nonMemberDropIn = `EXISTS (${relatedAthletes} SELECT 1 FROM athletes athlete
    JOIN drop_in_registration booking ON booking.member_id=athlete.id
    JOIN scheduling_form booking_form ON booking_form.id=booking.form_id
    JOIN program booking_class ON booking_class.id=booking_form.program_id AND booking_class.facility_id=r.facility_id
    WHERE booking.status IN ('confirmed','attended') AND booking.benefit_type IS DISTINCT FROM 'free_trial'
      AND NOT ${memberHasActiveMembershipSql('athlete.id', 'booking.class_date')})`
  return `LEFT JOIN LATERAL (
    SELECT COUNT(*)>0 AS has_inquiry,
      bool_or(invite.pending_payload->>'purpose'='trial' OR invite.pending_payload->'result'->>'trialRegistration'='true') AS has_trial,
      MIN(invite.used_at) FILTER (WHERE invite.used_at IS NOT NULL
        AND COALESCE(invite.pending_payload->>'purpose','registration')<>'trial'
        AND COALESCE(invite.pending_payload->'result'->>'trialRegistration','false')<>'true') AS registration_completed_at
    FROM account_invite invite WHERE invite.facility_id=r.facility_id
      AND invite.registration_id=ANY(${leadRegistrationIdsSql}) AND invite.invite_type='lead_registration'
  ) lead_invitation_evidence ON TRUE
  LEFT JOIN LATERAL (
    SELECT CASE WHEN ${converted} THEN 'converted' ELSE 'lead' END AS display_status,
      CASE WHEN ${converted} THEN COALESCE((to_jsonb(r)->>'converted_at')::timestamptz,
        lead_invitation_evidence.registration_completed_at) END AS converted_at,
      array_remove(ARRAY[
        CASE WHEN ${inquiry} THEN 'inquiry' END,
        CASE WHEN ${freeTrial} THEN 'free_trial' END,
        CASE WHEN ${nonMemberDropIn} THEN 'drop_in' END,
        CASE WHEN ${leadParticipationSql('recent_drop', today)} THEN 'recent_drop' END
      ],NULL)::text[] AS participation_tags
  ) lead_metadata ON TRUE`
}

function timestamp(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function leadStatusMetadata(row) {
  const converted = row.is_converted ?? (row.converted_member_id != null
    || (row.member_id != null && !isTrialSource(row.inquiry_source)) || row.lead_status === 'converted')
  const displayStatus = row.display_status === 'converted' || (row.display_status == null && converted) ? 'converted' : 'lead'
  const trial = row.has_trial_provenance === true || isTrialSource(row.inquiry_source)
    || row.invitation?.purpose === 'trial' || (row.free_trials?.length ?? 0) > 0
  const tags = Array.isArray(row.participation_tags) ? row.participation_tags : [
    ...(row.has_inquiry_provenance === true || !isTrialSource(row.inquiry_source) || row.invitation ? ['inquiry'] : []),
    ...(trial ? ['free_trial'] : []),
  ]
  return {
    displayStatus,
    participationTags: [...new Set(tags.filter(tag => ['inquiry', 'free_trial', 'drop_in', 'recent_drop'].includes(tag)))],
    convertedAt: displayStatus === 'converted' ? timestamp(row.metadata_converted_at ?? row.converted_at) : null,
  }
}
