import { id, inputError } from './common.js'

const contactId = alias => `COALESCE(NULLIF(to_jsonb(${alias})->>'trial_contact_member_id','')::bigint,${alias}.converted_member_id,${alias}.member_id)`
const normalizedName = alias => `lower(regexp_replace(btrim(concat_ws(' ',${alias}.first_name,${alias}.last_name)),'[[:space:]]+',' ','g'))`
const normalizedEmail = alias => `NULLIF(lower(btrim(${alias}.email)),'')`
const childMemberId = child => `CASE WHEN COALESCE(${child}->>'memberId',${child}->>'member_id','') ~ '^[0-9]{1,18}$'
  THEN COALESCE(${child}->>'memberId',${child}->>'member_id')::bigint END`

// Explicit contact links are authoritative. An unlinked original can be paired
// only with one verified contact having both the same email and full name.
export const originalLeadContactMatchSql = (original, contact) => `(
  ${contactId(original)}=${contact}.id OR (${contactId(original)} IS NULL
    AND ${normalizedEmail(original)}=${normalizedEmail(contact)}
    AND ${normalizedName(original)}<>'' AND ${normalizedName(original)}=${normalizedName(contact)}
    AND NOT EXISTS (SELECT 1 FROM member conflicting_contact
      WHERE conflicting_contact.facility_id=${contact}.facility_id AND conflicting_contact.id<>${contact}.id
        AND ${normalizedEmail('conflicting_contact')}=${normalizedEmail(original)}
        AND ${normalizedName('conflicting_contact')}=${normalizedName(original)})))`

// Only generated history rows fold into an original inquiry. Repeated public
// submissions remain separate records, as required by migration 855.
export function leadDirectoryCtes(facility = '$1') {
  return `lead_base AS MATERIALIZED (
    SELECT source.*, ${contactId('source')} AS dedup_contact_id,
      source.inquiry_source='free_trial' AND NOT EXISTS (SELECT 1 FROM account_invite original_invite
        WHERE original_invite.registration_id=source.id AND original_invite.facility_id=source.facility_id
          AND original_invite.invite_type='lead_registration') AS generated_trial
    FROM registrations source WHERE source.facility_id=${facility}
  ), lead_assignments AS MATERIALIZED (
    SELECT trial.id,COALESCE(CASE WHEN trial.generated_trial AND payer.id IS NOT NULL THEN
      (SELECT original.id FROM lead_base original
        WHERE original.generated_trial IS NOT TRUE AND COALESCE(original.archived,FALSE)=COALESCE(trial.archived,FALSE)
          AND ${originalLeadContactMatchSql('original', 'payer')}
        ORDER BY (${contactId('original')} IS NOT NULL) DESC,original.created_at NULLS LAST,original.id LIMIT 1) END,
      CASE WHEN trial.generated_trial AND payer.id IS NOT NULL THEN
        (SELECT min(sibling.id) FROM lead_base sibling WHERE sibling.generated_trial
          AND sibling.dedup_contact_id=payer.id AND COALESCE(sibling.archived,FALSE)=COALESCE(trial.archived,FALSE)) END,
      trial.id) AS canonical_id
    FROM lead_base trial LEFT JOIN member payer ON payer.id=trial.dedup_contact_id AND payer.facility_id=trial.facility_id
  ), lead_group_summary AS MATERIALIZED (
    SELECT links.canonical_id,array_agg(source.id ORDER BY source.created_at NULLS LAST,source.id)::bigint[] AS related_registration_ids,
      bool_or(source.generated_trial IS NOT TRUE) AS has_inquiry_provenance,
      bool_or(source.inquiry_source='free_trial' OR NULLIF(to_jsonb(source)->>'trial_contact_member_id','') IS NOT NULL) AS has_trial_provenance,
      bool_or(source.converted_member_id IS NOT NULL OR source.lead_status='converted'
        OR (source.inquiry_source IS DISTINCT FROM 'free_trial' AND source.member_id IS NOT NULL)) AS is_converted,
      min(NULLIF(to_jsonb(source)->>'converted_at','')::timestamptz) AS converted_at,
      (array_agg(source.converted_member_id ORDER BY source.created_at NULLS LAST,source.id)
        FILTER (WHERE source.converted_member_id IS NOT NULL))[1] AS converted_member_id,
      (array_agg(source.dedup_contact_id ORDER BY source.created_at NULLS LAST,source.id)
        FILTER (WHERE source.generated_trial OR NULLIF(to_jsonb(source)->>'trial_contact_member_id','') IS NOT NULL))[1] AS trial_contact_member_id,
      bool_or(COALESCE(source.contacted,FALSE)) AS contacted,bool_or(COALESCE(source.follow_up,FALSE)) AS follow_up,
      min(source.first_contacted_at) AS first_contacted_at
    FROM lead_assignments links JOIN lead_base source ON source.id=links.id GROUP BY links.canonical_id
  ), lead_child_rows AS MATERIALIZED (
    SELECT links.canonical_id,source.id AS source_id,source.id=links.canonical_id AS original_child,
      child.ordinality,child.value AS child,${childMemberId('child.value')} AS member_id
    FROM lead_assignments links JOIN lead_base source ON source.id=links.id
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(source.campers)='array' THEN source.campers ELSE '[]'::jsonb END)
      WITH ORDINALITY child(value,ordinality)
  ), lead_resolved_children AS (
    SELECT child.*,COALESCE(child.member_id,(SELECT CASE WHEN count(DISTINCT linked.member_id)=1 THEN min(linked.member_id) END
      FROM lead_child_rows linked WHERE linked.canonical_id=child.canonical_id AND linked.member_id IS NOT NULL
        AND NULLIF(child.child->>'dateOfBirth','') IS NOT NULL AND child.child->>'dateOfBirth'=linked.child->>'dateOfBirth'
        AND NULLIF(btrim(child.child->>'firstName'),'') IS NOT NULL
        AND lower(btrim(COALESCE(child.child->>'firstName','')))=lower(btrim(COALESCE(linked.child->>'firstName','')))
        AND (NULLIF(btrim(child.child->>'lastName'),'') IS NULL
          OR lower(btrim(child.child->>'lastName'))=lower(btrim(COALESCE(linked.child->>'lastName','')))))) AS resolved_id
    FROM lead_child_rows child
  ), lead_unique_children AS (
    SELECT DISTINCT ON (canonical_id,COALESCE('member:'||resolved_id::text,'snapshot:'||child::text)) canonical_id,
      child||CASE WHEN resolved_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('memberId',resolved_id) END AS child,
      original_child,source_id,ordinality
    FROM lead_resolved_children
    ORDER BY canonical_id,COALESCE('member:'||resolved_id::text,'snapshot:'||child::text),original_child DESC,source_id,ordinality
  ), effective_leads AS (
    SELECT populated.*,summary.related_registration_ids,summary.has_inquiry_provenance,summary.has_trial_provenance,summary.is_converted,
      summary.trial_contact_member_id AS dedup_trial_contact_member_id
    FROM lead_group_summary summary JOIN lead_base original ON original.id=summary.canonical_id
    CROSS JOIN LATERAL jsonb_populate_record(NULL::registrations,to_jsonb(original)||jsonb_build_object(
      'converted_member_id',summary.converted_member_id,'converted_at',summary.converted_at,
      'trial_contact_member_id',summary.trial_contact_member_id,
      'lead_status',CASE WHEN summary.is_converted THEN 'converted' ELSE original.lead_status END,
      'contacted',summary.contacted,'follow_up',summary.follow_up,'first_contacted_at',summary.first_contacted_at,
      'campers',(SELECT COALESCE(jsonb_agg(child.child ORDER BY child.original_child DESC,child.source_id,child.ordinality),'[]'::jsonb)
        FROM lead_unique_children child WHERE child.canonical_id=summary.canonical_id))) populated
  )`
}

export async function loadCanonicalLeadGroup(db, facilityId, leadId) {
  const result=await db.query(`WITH ${leadDirectoryCtes('$1')}
    SELECT r.id,r.related_registration_ids,COALESCE(r.converted_member_id,r.dedup_trial_contact_member_id,r.member_id) AS contact_member_id
    FROM effective_leads r WHERE $2::bigint=ANY(r.related_registration_ids)`,[id(facilityId,'facility'),id(leadId,'lead')])
  const row=result.rows[0]
  if(!row)throw inputError('Lead not found.',404)
  return {canonicalId:Number(row.id),registrationIds:row.related_registration_ids.map(Number),memberId:row.contact_member_id==null?null:Number(row.contact_member_id)}
}
