import { inputError, searchValue } from './common.js'
import { accountNotesSql } from './accountNotes.js'

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
  const clauses = ['r.facility_id=$1', 'r.archived IS NOT TRUE']
  const search = String(query.search ?? '').trim()
  if (search) {
    const text = bind(searchValue(search))
    const digits = search.replace(/\D/g, '')
    clauses.push(`(concat_ws(' ',r.first_name,r.last_name,r.email,r.phone) ILIKE ${text} ESCAPE '\\'${digits.length >= 3 && /^[\d\s()+.-]+$/.test(search) ? ` OR regexp_replace(COALESCE(r.phone,''),'[^0-9]','','g') LIKE ${bind(`%${digits}%`)}` : ''})`)
  }
  const status = String(query.status || '')
  if (status && !statuses.includes(status)) throw inputError('Invalid lead status.')
  if (status) clauses.push(`(CASE WHEN COALESCE(r.converted_member_id,r.member_id) IS NOT NULL THEN 'converted' ELSE COALESCE(r.lead_status,'new') END)=${bind(status)}`)
  const converted = booleanFilter(query.converted, 'converted')
  if (converted == null && status !== 'converted') clauses.push('COALESCE(r.converted_member_id,r.member_id) IS NULL')
  if (converted != null) clauses.push(`(COALESCE(r.converted_member_id,r.member_id) IS NOT NULL)=${bind(converted)}`)
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
  const join = keywords.length ? `LEFT JOIN LATERAL (
    SELECT string_agg(body,' ') AS body FROM (${accountNotesSql({ facilityId: 'r.facility_id', memberId: 'COALESCE(r.converted_member_id,r.member_id)', leadId: 'r.id' })}) notes
  ) correspondence ON TRUE` : ''
  for (const word of keywords) clauses.push(`concat_ws(' ',r.message,r.admin_notes,r.interests,r.interest,r.inquiry_source,r.submitter_role,
    r.interests_array::text,r.class_types::text,r.campers::text,correspondence.body) ILIKE ${bind(searchValue(word))} ESCAPE '\\'`)
  return { where: clauses.join(' AND '), values, join }
}
