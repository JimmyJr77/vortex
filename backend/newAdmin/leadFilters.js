import { inputError, searchValue } from './common.js'
import { accountNotesSql } from './accountNotes.js'
import { phoneSearchPattern } from '../phoneNumbers.js'
import { inquiryMemberMatchJoin } from './inquiryMemberMatch.js'
import { memberIsActiveSql } from './memberActivity.js'
import { leadParticipationFilter, leadParticipationSql } from './leadParticipation.js'

const booleanFilter = (value, label) => {
  if (value == null || value === '') return null
  if (value === 'true' || value === true) return true
  if (value === 'false' || value === false) return false
  throw inputError(`Invalid ${label} filter.`)
}
const ageFilter = value => {
  if (value == null || value === '') return null
  if (!/^\d+$/.test(String(value)) || Number(value) > 120) throw inputError('Child ages must be whole numbers from 0 to 120.')
  return Number(value)
}

export function leadFilters(query, facilityId, statuses) {
  const values = [facilityId]
  const bind = value => { values.push(value); return `$${values.length}` }
  const archived = booleanFilter(query.archived, 'archived') === true
  const clauses = ['r.facility_id=$1', archived ? 'r.archived IS TRUE' : 'r.archived IS NOT TRUE']
  const participation = leadParticipationFilter(query.participation)
  const today = "(CURRENT_TIMESTAMP AT TIME ZONE COALESCE((SELECT NULLIF(timezone,'') FROM facility WHERE id=$1),'America/New_York'))::date"
  const participationClause = leadParticipationSql(participation, today)
  if (participationClause) clauses.push(participationClause)
  const search = String(query.search ?? '').trim().slice(0, 200)
  if (search) {
    const text = bind(searchValue(search))
    const nameTokens = bind([...new Set(search.split(/\s+/))].map(searchValue))
    const phoneSearch = phoneSearchPattern(search)
    clauses.push(`(concat_ws(' ',r.first_name,r.last_name,r.email,r.phone) ILIKE ${text} ESCAPE '\\'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.campers)='array' THEN r.campers ELSE '[]'::jsonb END) search_child
        LEFT JOIN member search_athlete ON search_athlete.facility_id=r.facility_id AND search_athlete.id=
          CASE WHEN COALESCE(search_child->>'memberId',search_child->>'member_id','') ~ '^[0-9]{1,18}$'
            THEN COALESCE(search_child->>'memberId',search_child->>'member_id')::bigint END
        WHERE NOT EXISTS (SELECT 1 FROM unnest(${nameTokens}::text[]) AS name_token(pattern)
          WHERE concat_ws(' ',search_child->>'firstName',search_child->>'lastName',
            search_child->>'first_name',search_child->>'last_name',search_child->>'name',
            search_child->>'fullName',search_child->>'full_name',search_athlete.first_name,search_athlete.last_name)
            NOT ILIKE name_token.pattern ESCAPE '\\'))
      ${phoneSearch ? ` OR regexp_replace(COALESCE(r.phone,''),'[^0-9]','','g') LIKE ${bind(phoneSearch)}` : ''})`)
  }
  const status = String(query.status || '')
  if (status && !statuses.includes(status)) throw inputError('Invalid lead status.')
  const convertedMember = "COALESCE(r.converted_member_id,CASE WHEN r.inquiry_source IS DISTINCT FROM 'free_trial' THEN r.member_id END)"
  const isConverted = `(${convertedMember} IS NOT NULL OR COALESCE(r.lead_status,'new')='converted')`
  if (status) clauses.push(`(CASE WHEN ${convertedMember} IS NOT NULL THEN 'converted' ELSE COALESCE(r.lead_status,'new') END)=${bind(status)}`)
  const converted = booleanFilter(query.converted, 'converted')
  const includeMembers = booleanFilter(query.includeMembers, 'include members') === true || Boolean(participation)
  if (!includeMembers && converted == null && status !== 'converted') clauses.push(`NOT ${isConverted}`)
  if (converted != null) clauses.push(`${isConverted}=${bind(converted)}`)
  if (!includeMembers && converted !== true && status !== 'converted') {
    // Check activity for the matched contact or explicitly linked athletes.
    // Portal accounts and enrollment alone do not make a person active.
    // Free trial drop-ins remain prospects without a membership or paid drop-in.
    clauses.push(`NOT EXISTS (
      SELECT 1 FROM member lead_member
      WHERE lead_member.facility_id=r.facility_id
        AND (lead_member.id=inquiry_contact.member_id OR lead_member.id=r.member_id OR lead_member.id=r.dedup_trial_contact_member_id
          OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.campers)='array' THEN r.campers ELSE '[]'::jsonb END) child
            WHERE child->>'memberId'=lead_member.id::text))
        AND ${memberIsActiveSql('lead_member.id', 'r.facility_id', today)})`)
  }
  for (const [key, expression] of [['contacted', 'COALESCE(r.contacted,FALSE)'], ['followUp', 'COALESCE(r.follow_up,FALSE)']]) {
    const value = booleanFilter(query[key], key)
    if (value != null) clauses.push(`${expression}=${bind(value)}`)
  }
  const adult = booleanFilter(query.adultClasses, 'adult classes')
  if (adult != null) clauses.push(`EXISTS (SELECT 1 FROM unnest(COALESCE(r.class_types,ARRAY[]::text[])) class_type WHERE lower(trim(class_type))='adult classes')=${bind(adult)}`)
  const min = ageFilter(query.ageMin), max = ageFilter(query.ageMax)
  if (min != null && max != null && min > max) throw inputError('Minimum child age must not exceed maximum child age.')
  const gender = String(query.gender || '')
  if (gender && !['male', 'female'].includes(gender)) throw inputError('Invalid child gender filter.')
  if (min != null || max != null || gender) {
    const childClauses = []
    if (min != null) childClauses.push(`child.age>=${bind(min)}`)
    if (max != null) childClauses.push(`child.age<=${bind(max)}`)
    if (gender) childClauses.push(`child.gender=${bind(gender)}`)
    // Combine age and gender on the same child. Historical forms may have ages only.
    clauses.push(`EXISTS (SELECT 1 FROM (
      SELECT CASE WHEN to_char(parsed.birthday,'YYYY-MM-DD')=camper->>'dateOfBirth' THEN
          EXTRACT(YEAR FROM age((CURRENT_TIMESTAMP AT TIME ZONE COALESCE((SELECT NULLIF(timezone,'') FROM facility WHERE id=$1),'America/New_York'))::date,parsed.birthday))::int END AS age,
        lower(camper->>'gender') AS gender
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.campers)='array' THEN r.campers ELSE '[]'::jsonb END) camper
      CROSS JOIN LATERAL (SELECT CASE WHEN camper->>'dateOfBirth' ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN
        CASE WHEN substring(camper->>'dateOfBirth',1,4)::int BETWEEN 1 AND 9999
          AND substring(camper->>'dateOfBirth',6,2)::int BETWEEN 1 AND 12 THEN
          make_date(substring(camper->>'dateOfBirth',1,4)::int,substring(camper->>'dateOfBirth',6,2)::int,1)
            + (substring(camper->>'dateOfBirth',9,2)::int-1) END END AS birthday) parsed
      UNION ALL SELECT reported_age,NULL FROM unnest(COALESCE(r.child_ages,ARRAY[]::int[])) reported_age
        WHERE COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(r.campers)='array' THEN r.campers ELSE '[]'::jsonb END),0)=0
      UNION ALL SELECT r.athlete_age,NULL WHERE r.athlete_age IS NOT NULL AND r.athlete_age<18
        AND COALESCE(cardinality(r.child_ages),0)=0 AND COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(r.campers)='array' THEN r.campers ELSE '[]'::jsonb END),0)=0
    ) child WHERE ${childClauses.join(' AND ')})`)
  }
  const keywords = [...new Set(String(query.keywords ?? '').trim().slice(0,200).split(/\s+/).filter(Boolean))]
  const join = `${inquiryMemberMatchJoin('r.facility_id', 'r.email')} ${keywords.length ? `LEFT JOIN LATERAL (
    SELECT string_agg(body,' ') AS body FROM (${accountNotesSql({ facilityId: 'r.facility_id', memberId: 'COALESCE(r.converted_member_id,r.dedup_trial_contact_member_id,r.member_id)', leadId: 'r.id', leadIds: 'r.related_registration_ids' })}) notes
  ) correspondence ON TRUE` : ''}`
  for (const word of keywords) clauses.push(`concat_ws(' ',r.message,r.admin_notes,r.interests,r.interest,r.inquiry_source,r.submitter_role,
    r.interests_array::text,r.class_types::text,r.campers::text,correspondence.body) ILIKE ${bind(searchValue(word))} ESCAPE '\\'`)
  return { where: clauses.join(' AND '), values, join }
}
