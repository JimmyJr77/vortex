import { calendarDateParts } from '../members/dateOnlyAge.js'
import { hasActiveAnnualMembershipSql } from '../scheduling/annualMembership.js'
import { id, inputError, pagination, pageResult, searchValue } from './common.js'

const SORT_COLUMNS = Object.freeze({
  id: 'id', name: 'lower(name)', firstName: 'lower(first_name)', lastName: 'lower(last_name)',
  family: 'lower(family_name)', age: 'age', email: 'lower(email)', phone: 'phone',
  status: "CASE status WHEN 'active' THEN 0 WHEN 'inactive' THEN 1 ELSE 2 END",
  familyActive: 'family_active', recent: 'updated_at', children: 'child_count',
})

const values = (query, key, allowed) => {
  const selected = [...new Set(String(query[key] ?? '').split(',').map(value => value.trim()).filter(Boolean))]
  if (selected.some(value => !allowed.includes(value))) throw inputError(`Invalid ${key} filter.`)
  return selected
}

const boolean = (value, label) => {
  if (value == null || value === '') return null
  if (value === 'true' || value === true) return true
  if (value === 'false' || value === false) return false
  throw inputError(`Invalid ${label} filter.`)
}

const ageFilter = value => {
  if (value == null || value === '') return null
  if (!/^\d{1,3}$/.test(String(value)) || Number(value) > 130) throw inputError('Enter an age between 0 and 130.')
  return Number(value)
}

const facilityContext = `SELECT id, COALESCE(NULLIF(timezone, ''), 'America/New_York') AS timezone,
    (now() AT TIME ZONE COALESCE(NULLIF(timezone, ''), 'America/New_York'))::date AS today
  FROM facility WHERE id = $1`

const householdLinks = `SELECT fm.member_id, f.id AS family_id, fm.is_active
  FROM family f JOIN family_member fm ON fm.family_id = f.id
  JOIN member m ON m.id = fm.member_id AND m.facility_id = f.facility_id
  WHERE f.facility_id = $1
  UNION ALL
  SELECT m.id, f.id, TRUE
  FROM member m JOIN family f ON f.id = m.family_id AND f.facility_id = m.facility_id
  WHERE m.facility_id = $1 AND NOT EXISTS (SELECT 1 FROM family_member fm WHERE fm.member_id = m.id)`

// Only current enrollments count toward active status. A future start or a
// held invitation may be listed in class history but does not count as active.
const currentClass = `NOT s.historical_only AND s.archived_at IS NULL AND s.orphaned_at IS NULL
  AND s.status = 'confirmed' AND s.enrollment_start_date <= ctx.today
  AND (s.cancel_effective_date IS NULL OR s.cancel_effective_date > ctx.today)
  AND (s.pause_effective_date IS NULL OR s.pause_effective_date > ctx.today)
  AND (s.record_program_end IS NULL OR s.record_program_end >= ctx.today)`

const pastClass = `s.status <> 'pending_setup' AND (s.historical_only
  OR s.status IN ('cancelled', 'completed') OR s.archived_at IS NOT NULL OR s.orphaned_at IS NOT NULL
  OR s.cancel_effective_date <= ctx.today OR s.record_program_end < ctx.today)`

const hasClasses = (filter = 'TRUE', match = 'TRUE') => `EXISTS (
  SELECT 1 FROM account_enrollment_current s
  ${match === 'TRUE' ? '' : `LEFT JOIN scheduling_form form ON form.id = s.form_id
  LEFT JOIN program class ON class.id = form.program_id AND class.facility_id = $1
  LEFT JOIN programs top ON top.id = COALESCE(form.programs_id, class.programs_id) AND top.facility_id = $1`}
  WHERE s.record_member_id = m.id AND s.record_facility_id = $1 AND (${filter}) AND (${match})
)`

const hasDropIns = (filter = 'TRUE', match = 'TRUE') => `EXISTS (
  SELECT 1 FROM drop_in_registration d
  ${match === 'TRUE' ? '' : `LEFT JOIN scheduling_form form ON form.id = d.form_id
  LEFT JOIN program class ON class.id = form.program_id AND class.facility_id = $1
  LEFT JOIN programs top ON top.id = COALESCE(form.programs_id, class.programs_id) AND top.facility_id = $1`}
  WHERE d.member_id = m.id AND (${filter}) AND (${match})
)`

function contactPredicate(filters, bind) {
  if (!filters.length) return 'TRUE'
  const selected = bind(filters)
  return `(('email' = ANY(${selected}::text[]) AND NULLIF(btrim(directory.email), '') IS NOT NULL)
    OR ('phone' = ANY(${selected}::text[]) AND NULLIF(btrim(directory.phone), '') IS NOT NULL)
    OR ('missing' = ANY(${selected}::text[]) AND NULLIF(btrim(directory.email), '') IS NULL
      AND NULLIF(btrim(directory.phone), '') IS NULL))`
}

function parseQuery(query) {
  const minAge = ageFilter(query.minAge ?? query.ageMin)
  const maxAge = ageFilter(query.maxAge ?? query.ageMax)
  if (minAge != null && maxAge != null && minAge > maxAge) throw inputError('Minimum age must not exceed maximum age.')
  const sortBy = query.sortBy || 'name'
  const sortDir = String(query.sortDir || 'asc').toLowerCase()
  if (!Object.hasOwn(SORT_COLUMNS, sortBy)) throw inputError('Invalid CRM sort field.')
  if (!['asc', 'desc'].includes(sortDir)) throw inputError('Sort direction must be asc or desc.')
  return { ...pagination(query), minAge, maxAge, sortBy, sortDir,
    familiesOnly: boolean(query.familiesOnly, 'families only') === true,
    familyActive: boolean(query.familyActive, 'family activity'),
    hasChildren: boolean(query.hasChildren, 'has children'),
    sources: values(query, 'source', ['member', 'lead', 'staff']),
    statuses: values(query, 'status', ['active', 'inactive', 'lead']),
    record: values(query, 'record', ['active', 'archived']),
    leadStages: values(query, 'leadStatus', ['new', 'contacted', 'qualified', 'closed']),
    ageGroups: values(query, 'ageGroup', ['youth', 'adult', 'unknown']),
    contact: values(query, 'contact', ['email', 'phone', 'missing']),
    participation: values(query, 'participation', ['current', 'past', 'none']),
    search: String(query.search ?? '').trim(), classSearch: String(query.classSearch ?? '').trim() }
}

function rowDto(row) {
  return { id: Number(row.id), kind: row.kind, firstName: row.first_name ?? '', lastName: row.last_name ?? '',
    name: row.name || 'Unnamed', email: row.email ?? null, phone: row.phone ?? null,
    age: row.age ?? null, dateOfBirth: row.date_of_birth ?? null,
    familyId: row.family_id == null ? null : Number(row.family_id), familyName: row.family_name ?? null,
    status: row.status, familyActive: Boolean(row.family_active), archived: Boolean(row.archived), leadStatus: row.lead_status ?? null,
    childCount: Number(row.child_count || 0), memberCount: Number(row.member_count || 0), updatedAt: row.updated_at ?? null }
}

function buildListQuery(facilityId, filters, target = null) {
  const params = [id(facilityId, 'facility')]
  const bind = value => { params.push(value); return `$${params.length}` }
  const show = kind => !filters.sources.length || filters.sources.includes(kind)
  const classTerm = filters.classSearch ? bind(searchValue(filters.classSearch)) : null
  const search = filters.search ? bind(searchValue(filters.search)) : null
  const phoneSearch = filters.search.replace(/[^0-9]/g, '')
  const digits = phoneSearch.length >= 3 && /^[\d()+.\s-]+$/.test(filters.search) ? bind(`%${phoneSearch}%`) : null
  const ageClauses = []
  if (filters.minAge != null) ageClauses.push(`candidate.age >= ${bind(filters.minAge)}`)
  if (filters.maxAge != null) ageClauses.push(`candidate.age <= ${bind(filters.maxAge)}`)
  if (filters.ageGroups.length) ageClauses.push(`(CASE WHEN candidate.age IS NULL THEN 'unknown' WHEN candidate.age < 18 THEN 'youth' ELSE 'adult' END) = ANY(${bind(filters.ageGroups)}::text[])`)
  const participationClauses = []
  if (filters.participation.includes('current')) participationClauses.push('candidate.current_class')
  if (filters.participation.includes('past')) participationClauses.push('candidate.past_class')
  if (filters.participation.includes('none')) participationClauses.push('NOT candidate.has_class')
  const personFilters = [...ageClauses, ...(participationClauses.length ? [`(${participationClauses.join(' OR ')})`] : []), ...(classTerm ? ['candidate.class_match'] : [])]
  const memberFactsNeeded = filters.familiesOnly || show('member')
  const contactFilter = contactPredicate(filters.contact, bind)
  const matchesContact = search ? `(concat_ws(' ', directory.name, directory.email, directory.phone, directory.family_name) ILIKE ${search} ESCAPE '\\'
    ${digits ? `OR regexp_replace(COALESCE(directory.phone, ''), '[^0-9]', '', 'g') LIKE ${digits}` : ''})` : 'TRUE'
  const familySearch = search ? `${memberFactsNeeded ? `OR EXISTS (SELECT 1 FROM member_facts child JOIN links ON links.member_id = child.id
    WHERE links.family_id = directory.family_id AND links.is_active
      AND (concat_ws(' ', child.first_name, child.last_name, child.email, child.phone) ILIKE ${search} ESCAPE '\\'
      ${digits ? `OR regexp_replace(COALESCE(child.phone, ''), '[^0-9]', '', 'g') LIKE ${digits}` : ''}))` : ''}
    OR (directory.kind = 'lead' AND EXISTS (SELECT 1 FROM registrations r
      WHERE r.id = directory.id AND r.facility_id = $1 AND r.campers::text ILIKE ${search} ESCAPE '\\'))` : ''
  const where = [`(${matchesContact} ${familySearch})`, contactFilter]
  if (personFilters.length) where.push(filters.familiesOnly
    ? `EXISTS (SELECT 1 FROM member_facts candidate JOIN links ON links.member_id = candidate.id
      WHERE links.family_id = directory.family_id AND links.is_active AND ${personFilters.join(' AND ')})`
    : personFilters.join(' AND ').replaceAll('candidate.', 'directory.'))
  if (filters.statuses.length) where.push(`directory.status = ANY(${bind(filters.statuses)}::text[])`)
  if (filters.record.length) where.push(`(CASE WHEN directory.archived THEN 'archived' ELSE 'active' END) = ANY(${bind(filters.record)}::text[])`)
  if (filters.leadStages.length) where.push(`directory.lead_status = ANY(${bind(filters.leadStages)}::text[])`)
  if (filters.familyActive != null) where.push(`directory.family_active = ${bind(filters.familyActive)}`)
  if (filters.hasChildren != null) where.push(`(directory.child_count > 0) = ${bind(filters.hasChildren)}`)
  const targetId = target == null ? null : bind(target)

  const familyRows = `SELECT f.id, 'family'::text AS kind, ''::text AS first_name, ''::text AS last_name,
    COALESCE(NULLIF(f.family_name, ''), 'Unnamed family') AS name, contact.email, contact.phone,
    NULL::int AS age, NULL::text AS date_of_birth, f.id AS family_id, f.family_name,
    CASE WHEN COALESCE(h.family_active, FALSE) AND f.archived IS NOT TRUE THEN 'active' ELSE 'inactive' END AS status,
    COALESCE(h.family_active, FALSE) AND f.archived IS NOT TRUE AS family_active, f.archived IS TRUE AS archived,
    NULL::text AS lead_status, COALESCE(h.child_count, 0) AS child_count, COALESCE(h.member_count, 0) AS member_count,
    f.updated_at, FALSE AS current_class, FALSE AS past_class, FALSE AS has_class, FALSE AS class_match
    FROM family f LEFT JOIN household_summary h ON h.family_id = f.id
    LEFT JOIN LATERAL (SELECT COALESCE(b.billing_email, payer.email, person.email) AS email,
      COALESCE(b.billing_phone, payer.phone, person.phone) AS phone
      FROM (SELECT f.id) household LEFT JOIN family_billing_account b ON b.family_id = household.id AND b.is_active
      LEFT JOIN member payer ON payer.id = b.payer_member_id AND payer.facility_id = $1
      LEFT JOIN LATERAL (SELECT m.email, m.phone FROM links l JOIN member_facts m ON m.id = l.member_id
        WHERE l.family_id = f.id AND l.is_active AND NOT m.archived AND (m.email IS NOT NULL OR m.phone IS NOT NULL)
        ORDER BY (m.age >= 18) DESC NULLS LAST, m.id LIMIT 1) person ON TRUE
      ORDER BY b.id LIMIT 1) contact ON TRUE
    WHERE f.facility_id = $1 ${targetId ? `AND f.id = ${targetId}` : ''}`

  const personRows = [show('member') && `SELECT m.id, 'member'::text AS kind, m.first_name, m.last_name,
    concat_ws(' ', m.first_name, m.last_name) AS name, m.email, m.phone, m.age, m.date_of_birth,
    household.family_id, f.family_name, CASE WHEN m.person_active THEN 'active' ELSE 'inactive' END AS status,
    COALESCE(h.family_active, FALSE) AND f.archived IS NOT TRUE AS family_active, m.archived, NULL::text AS lead_status,
    COALESCE(h.child_count, 0) AS child_count, COALESCE(h.member_count, 0) AS member_count,
    m.updated_at, m.current_class, m.past_class, m.has_class, m.class_match
    FROM member_facts m
    LEFT JOIN LATERAL (SELECT l.family_id FROM links l WHERE l.member_id = m.id AND l.is_active
      ORDER BY (l.family_id = m.family_id) DESC NULLS LAST, l.family_id LIMIT 1) household ON TRUE
    LEFT JOIN family f ON f.id = household.family_id
    LEFT JOIN household_summary h ON h.family_id = f.id ${targetId ? `WHERE m.id = ${targetId}` : ''}`,
    show('lead') && `SELECT r.id, 'lead', r.first_name, r.last_name, concat_ws(' ', r.first_name, r.last_name),
      r.email, r.phone, CASE WHEN lower(r.submitter_role) = 'athlete' THEN r.athlete_age END, NULL::text,
      NULL::bigint, NULL::text, 'lead', FALSE, r.archived IS TRUE, COALESCE(r.lead_status, 'new'),
      GREATEST(jsonb_array_length(CASE WHEN jsonb_typeof(r.campers) = 'array' THEN r.campers ELSE '[]'::jsonb END),
        COALESCE(cardinality(r.child_ages), 0), CASE WHEN r.athlete_age BETWEEN 0 AND 17 AND lower(r.submitter_role) IS DISTINCT FROM 'athlete' THEN 1 ELSE 0 END), 0,
      COALESCE(r.updated_at, r.created_at) AT TIME ZONE 'UTC', FALSE, FALSE, FALSE, FALSE
    FROM registrations r WHERE r.facility_id = $1 AND COALESCE(r.converted_member_id, r.member_id) IS NULL ${targetId ? `AND r.id = ${targetId}` : ''}`,
    show('staff') && `SELECT u.id, 'staff', split_part(btrim(u.full_name), ' ', 1),
      regexp_replace(btrim(u.full_name), '^[^ ]+ *', ''), u.full_name, u.email, u.phone, NULL::int, NULL::text,
      NULL::bigint, NULL::text, 'inactive', FALSE, u.is_active IS NOT TRUE, NULL::text, 0, 0,
      u.updated_at, FALSE, FALSE, FALSE, FALSE
    FROM app_user u WHERE u.facility_id = $1 AND NOT EXISTS (SELECT 1 FROM member m WHERE m.facility_id = $1 AND m.app_user_id = u.id)
      ${targetId ? `AND u.id = ${targetId}` : ''}`].filter(Boolean)

  const select = filters.familiesOnly ? familyRows : `SELECT * FROM (${personRows.join('\nUNION ALL\n')})
    AS person(id, kind, first_name, last_name, name, email, phone, age, date_of_birth, family_id, family_name,
      status, family_active, archived, lead_status, child_count, member_count, updated_at,
      current_class, past_class, has_class, class_match)`

  const memberCtes = memberFactsNeeded ? `ctx AS (${facilityContext}), links AS (${householdLinks}),
    member_details AS (
      SELECT m.id, m.first_name, m.last_name, m.email, m.phone, m.family_id, m.updated_at,
        m.is_active IS NOT TRUE AS archived, m.date_of_birth::text,
        CASE WHEN m.date_of_birth <= ctx.today THEN EXTRACT(YEAR FROM age(ctx.today, m.date_of_birth))::int END AS age,
        ${hasClasses(currentClass)} AS current_class,
        ${filters.participation.includes('past') ? `(${hasClasses(pastClass)} OR ${hasDropIns("d.status IN ('confirmed', 'attended') AND d.class_date < ctx.today")})` : 'FALSE'} AS past_class,
        ${filters.participation.includes('none') ? `(${hasClasses("s.status <> 'pending_setup'")} OR ${hasDropIns("d.status IN ('confirmed', 'attended')")})` : 'FALSE'} AS has_class,
        ${classTerm ? `(${hasClasses('TRUE', `concat_ws(' ', s.record_class_name, form.title, top.display_name, top.name,
          s.record_source_data->>'Program') ILIKE ${classTerm} ESCAPE '\\'`)} OR ${hasDropIns('TRUE', `concat_ws(' ',
          form.title, class.display_name, top.display_name, top.name) ILIKE ${classTerm} ESCAPE '\\'`)})` : 'FALSE'} AS class_match,
        CASE WHEN m.is_active THEN (${hasActiveAnnualMembershipSql('m.id', 'ctx.today')}
          OR ${hasDropIns("d.status IN ('confirmed', 'attended') AND d.class_date BETWEEN (ctx.today - INTERVAL '2 months')::date AND ctx.today")})
          ELSE FALSE END AS membership_or_drop_in
      FROM member m JOIN ctx ON ctx.id = m.facility_id
    ), member_facts AS (
      SELECT m.*, NOT m.archived AND (m.current_class OR m.membership_or_drop_in) AS person_active FROM member_details m
    ), household_summary AS (
      SELECT l.family_id, count(*) FILTER (WHERE NOT m.archived)::int AS member_count,
        count(*) FILTER (WHERE NOT m.archived AND m.age < 18)::int AS child_count, bool_or(m.person_active) AS family_active
      FROM links l JOIN member_facts m ON m.id = l.member_id WHERE l.is_active GROUP BY l.family_id
    ),` : ''
  const sql = `/* CRM directory */ WITH ${memberCtes} directory AS (${select}),
    matches AS (SELECT * FROM directory WHERE ${where.join(' AND ')}),
    page AS (SELECT *, row_number() OVER (ORDER BY ${SORT_COLUMNS[filters.sortBy]} ${filters.sortDir.toUpperCase()} NULLS LAST,
      lower(name), kind, id) AS row_index FROM matches
      ORDER BY row_index LIMIT ${bind(filters.pageSize)} OFFSET ${bind(filters.offset)})
    SELECT (SELECT count(*)::int FROM matches) AS total,
      COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY row_index) FROM page), '[]'::jsonb) AS rows`
  return { text: sql, values: params }
}

export async function listCrm(pool, facilityId, query = {}) {
  const filters = parseQuery(query)
  const result = (await pool.query(buildListQuery(facilityId, filters))).rows[0]
  return pageResult((result?.rows ?? []).map(rowDto), result?.total ?? 0, filters)
}

function ageAt(birthday, today) {
  if (!birthday || !today || birthday > today) return null
  const birth = calendarDateParts(birthday)
  const asOf = calendarDateParts(today)
  if (!birth || !asOf) return null
  return asOf.year - birth.year - Number(asOf.month < birth.month || (asOf.month === birth.month && asOf.day < birth.day))
}

const cleanAge = value => Number.isInteger(value) && value >= 0 && value <= 130 ? value : null

function leadChildren(inquiry) {
  if (!inquiry) return []
  const campers = Array.isArray(inquiry.campers) ? inquiry.campers : []
  const ages = Array.isArray(inquiry.child_ages) ? inquiry.child_ages : []
  const reportedAthleteAge = cleanAge(inquiry.athlete_age)
  const count = Math.max(campers.length, ages.length, reportedAthleteAge != null && reportedAthleteAge < 18
    && inquiry.submitter_role?.toLowerCase() !== 'athlete' ? 1 : 0)
  return Array.from({ length: count }, (_, index) => {
    const camper = campers[index]
    const firstName = String(camper?.firstName ?? '').trim()
    const lastName = String(camper?.lastName ?? '').trim()
    const birthday = camper?.dateOfBirth
    const dateOfBirth = calendarDateParts(birthday) ? String(birthday).slice(0, 10) : null
    return { id: null, firstName, lastName, name: `${firstName} ${lastName}`.trim() || `Child ${index + 1}`,
      age: ageAt(dateOfBirth, inquiry.today) ?? cleanAge(ages[index]) ?? (index === 0 ? cleanAge(inquiry.athlete_age) : null),
      dateOfBirth, gender: camper?.gender ?? null }
  })
}

async function readPeople(pool, facilityId, familyId, memberId) {
  const result = await pool.query(`/* CRM people */ WITH ctx AS (${facilityContext}), links AS (${householdLinks})
    SELECT m.id, m.first_name, m.last_name, m.email, m.phone, m.date_of_birth::text, m.gender, m.address, m.username,
      m.is_active, CASE WHEN m.date_of_birth <= ctx.today THEN EXTRACT(YEAR FROM age(ctx.today, m.date_of_birth))::int END AS age,
      EXISTS (SELECT 1 FROM parent_guardian_authority authority
        JOIN member guardian ON guardian.id = authority.parent_member_id AND guardian.facility_id = $1
        JOIN links guardian_household ON guardian_household.member_id = guardian.id AND guardian_household.family_id = $2 AND guardian_household.is_active
        WHERE authority.child_member_id = m.id AND authority.has_legal_authority AND guardian.is_active) AS dependent,
      COALESCE(l.is_active, m.id = $3) AS current_household
    FROM member m JOIN ctx ON ctx.id = m.facility_id
    LEFT JOIN links l ON l.member_id = m.id AND l.family_id = $2
    WHERE l.member_id IS NOT NULL OR m.id = $3
    ORDER BY current_household DESC, lower(m.last_name), lower(m.first_name), m.id`, [facilityId, familyId, memberId])
  return result.rows
}

async function readClasses(pool, facilityId, familyId, memberId, paging) {
  const result = (await pool.query(`/* CRM class history */ WITH ctx AS (${facilityContext}), classes AS (
    SELECT 'class:' || s.id AS key, s.record_member_id AS member_id,
      COALESCE(NULLIF(concat_ws(' ', m.first_name, m.last_name), ''), NULLIF(concat_ws(' ', s.first_name, s.last_name), '')) AS member_name,
      COALESCE(NULLIF(s.record_class_name, ''), sf.title, 'Archived class') AS class_name,
      COALESCE(NULLIF(top.display_name, ''), top.name, s.record_source_data->>'Program') AS program_name,
      CASE WHEN s.historical_only THEN 'historical' WHEN s.status = 'pending_setup' THEN 'pending_setup'
        WHEN ${currentClass} THEN 'confirmed'
        WHEN ${pastClass} THEN CASE WHEN s.status IN ('cancelled', 'completed') THEN s.status ELSE 'ended' END
        WHEN s.status = 'confirmed' AND s.enrollment_start_date > ctx.today THEN 'upcoming'
        WHEN s.status = 'confirmed' AND s.pause_effective_date <= ctx.today THEN 'paused'
        ELSE s.status END AS status,
      s.enrollment_start_date AS start_date, LEAST(s.cancel_effective_date, s.record_program_end) AS end_date,
      CASE WHEN s.record_source = 'jackrabbit' THEN 'Jackrabbit' ELSE 'Vortex' END AS source,
      COALESCE(s.enrollment_start_date, s.record_occurred_on) AS sort_date
    FROM account_enrollment_current s JOIN ctx ON ctx.id = s.record_facility_id
    LEFT JOIN member m ON m.id = s.record_member_id AND m.facility_id = $1
    LEFT JOIN scheduling_form sf ON sf.id = s.form_id
    LEFT JOIN program class ON class.id = sf.program_id AND class.facility_id = $1
    LEFT JOIN programs top ON top.id = COALESCE(sf.programs_id, class.programs_id) AND top.facility_id = $1
    WHERE (s.record_family_id = $2 OR s.record_member_id = $3)
    UNION ALL
    SELECT 'drop-in:' || d.id, d.member_id, concat_ws(' ', m.first_name, m.last_name),
      COALESCE(NULLIF(class.display_name, ''), class.name, sf.title, 'Archived class'),
      COALESCE(NULLIF(top.display_name, ''), top.name), d.status, d.class_date, d.class_date, 'Vortex', d.class_date
    FROM drop_in_registration d JOIN member m ON m.id = d.member_id AND m.facility_id = $1
    LEFT JOIN scheduling_form sf ON sf.id = d.form_id
    LEFT JOIN program class ON class.id = sf.program_id AND class.facility_id = $1
    LEFT JOIN programs top ON top.id = COALESCE(sf.programs_id, class.programs_id) AND top.facility_id = $1
    WHERE d.member_id = $3 OR d.member_id = ANY($4::bigint[])
  ), page AS (SELECT * FROM classes ORDER BY sort_date DESC NULLS LAST, key LIMIT $5 OFFSET $6)
  SELECT (SELECT count(*)::int FROM classes) AS total,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('key',key,'memberId',member_id,'memberName',member_name,
      'className',class_name,'programName',program_name,'status',status,'startDate',start_date,'endDate',end_date,'source',source)
      ORDER BY sort_date DESC NULLS LAST, key) FROM page), '[]'::jsonb) AS rows`,
  [facilityId, familyId, memberId, paging.householdIds, paging.pageSize, paging.offset])).rows[0]
  return pageResult(result?.rows ?? [], result?.total ?? 0, paging)
}

async function readInquiries(pool, facilityId, leadId, memberIds) {
  return (await pool.query(`/* CRM inquiries */ WITH ctx AS (${facilityContext})
    SELECT r.id, r.first_name, r.last_name, r.lead_status, r.message, r.admin_notes, r.created_at,
      r.campers, r.child_ages, r.athlete_age, r.interest, r.interests_array, r.class_types, r.submitter_role,
      r.inquiry_source, r.contacted, r.follow_up, ctx.today::text
    FROM registrations r JOIN ctx ON ctx.id = r.facility_id
    WHERE r.id = $2 OR COALESCE(r.converted_member_id, r.member_id) = ANY($3::bigint[])
    ORDER BY r.created_at DESC NULLS LAST, r.id DESC LIMIT 25`, [facilityId, leadId, memberIds])).rows
}

function personDetails(row) {
  return { id: Number(row.id), firstName: row.first_name, lastName: row.last_name,
    name: `${row.first_name} ${row.last_name}`.trim(), email: row.email, phone: row.phone,
    age: row.age, dateOfBirth: row.date_of_birth, gender: row.gender, isActive: row.is_active === true }
}

export async function loadCrmDetail(pool, facilityId, kind, recordId, query = {}) {
  if (!['member', 'lead', 'staff', 'family'].includes(kind)) throw inputError('Invalid CRM record type.')
  const target = id(recordId, 'CRM record')
  const filters = parseQuery(kind === 'family' ? { familiesOnly: true } : { source: kind })
  const result = (await pool.query(buildListQuery(facilityId, filters, target))).rows[0]
  if (!result?.rows.length) throw inputError('CRM record not found.', 404)
  const person = rowDto(result.rows[0])
  const memberId = kind === 'member' ? target : null
  const leadId = kind === 'lead' ? target : null
  const people = memberId || person.familyId ? await readPeople(pool, facilityId, person.familyId, memberId) : []
  const currentHousehold = people.filter(row => row.is_active && row.current_household)
  const householdIds = kind === 'family' ? currentHousehold.map(row => Number(row.id)) : []
  const inquiryMemberIds = memberId ? [memberId] : people.map(row => Number(row.id))
  const paging = pagination(query)
  const [classes, inquiries, staff] = await Promise.all([
    kind === 'family' || memberId ? readClasses(pool, facilityId, kind === 'family' ? target : null, memberId,
      { ...paging, householdIds }) : pageResult([], 0, paging),
    kind === 'staff' ? [] : readInquiries(pool, facilityId, leadId, inquiryMemberIds),
    kind === 'staff' ? pool.query('SELECT username FROM app_user WHERE id = $1 AND facility_id = $2', [target, facilityId]) : null,
  ])
  const individual = people.find(row => Number(row.id) === memberId)
  return { person, people: people.map(personDetails), classes,
    children: leadId ? leadChildren(inquiries[0]) : currentHousehold
      .filter(row => row.age == null ? row.dependent : row.age < 18).map(personDetails),
    inquiries: inquiries.map(row => ({ id: Number(row.id), firstName: row.first_name, lastName: row.last_name,
      status: row.lead_status ?? 'new', message: row.message, notes: row.admin_notes, createdAt: row.created_at,
      source: row.inquiry_source, submitterRole: row.submitter_role, interest: row.interest, interests: row.interests_array,
      classTypes: row.class_types, contacted: row.contacted, followUp: row.follow_up, children: leadChildren(row) })),
    address: individual?.address ?? null, gender: individual?.gender ?? null, username: individual?.username ?? staff?.rows[0]?.username ?? null }
}
