const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

const FACET_VALUES = Object.freeze({
  record: new Set(['active', 'archived']),
  portal: new Set(['active', 'suspended', 'setup_required', 'no_login']),
  role: new Set(['owner', 'administrator', 'admin', 'coach']),
  responsibility: new Set(['payer', 'guardian', 'dependent']),
  participation: new Set(['current', 'upcoming', 'paused', 'waitlisted', 'former', 'never']),
  waiver: new Set(['current', 'action_required', 'not_required']),
  ageGroup: new Set(['youth', 'adult', 'unknown']),
  review: new Set(['needed', 'clear']),
})

const SORT_COLUMNS = Object.freeze({
  id: 'directory.id',
  member: 'LOWER(directory.last_name)',
  firstName: 'LOWER(directory.first_name)',
  lastName: 'LOWER(directory.last_name)',
  family: 'LOWER(directory.family_name)',
  age: 'directory.age',
  participation: '(directory.current_count + directory.upcoming_count + directory.paused_count + directory.waitlisted_count)',
  household: '(directory.is_payer::int + directory.is_guardian::int + directory.is_dependent::int)',
  portalAccess: `CASE directory.portal_status
    WHEN 'active' THEN 0
    WHEN 'setup_required' THEN 1
    WHEN 'suspended' THEN 2
    ELSE 3
  END`,
  staffAccess: "ARRAY_TO_STRING(directory.staff_roles, ',')",
  waiver: `CASE directory.waiver_status
    WHEN 'action_required' THEN 0
    WHEN 'current' THEN 1
    ELSE 2
  END`,
  recordStatus: "CASE directory.record_status WHEN 'active' THEN 0 ELSE 1 END",
})

const STAFF_ROLE_LABELS = Object.freeze({
  OWNER: 'Owner',
  ADMINISTRATOR: 'Administrator',
  COACH: 'Coach',
})

const DIRECTORY_CTES = `
WITH facility_context AS (
  SELECT
    facility.id,
    (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(facility.timezone, ''), 'America/New_York'))::date AS today
  FROM facility
  WHERE facility.id = $1
),
active_household_authority AS (
  SELECT DISTINCT
    authority.parent_member_id,
    authority.child_member_id
  FROM parent_guardian_authority authority
  JOIN member parent
    ON parent.id = authority.parent_member_id
   AND parent.is_active = TRUE
   AND parent.date_of_birth IS NOT NULL
  JOIN facility_context context
    ON context.id = parent.facility_id
   AND parent.date_of_birth <= (context.today - INTERVAL '18 years')::date
  JOIN member child
    ON child.id = authority.child_member_id
   AND child.facility_id = parent.facility_id
   AND child.is_active = TRUE
   AND child.date_of_birth IS NOT NULL
   AND child.date_of_birth > (context.today - INTERVAL '18 years')::date
  JOIN family_member parent_membership
    ON parent_membership.member_id = parent.id
   AND parent_membership.is_active = TRUE
  JOIN family_member child_membership
    ON child_membership.member_id = child.id
   AND child_membership.family_id = parent_membership.family_id
   AND child_membership.is_active = TRUE
  WHERE authority.has_legal_authority = TRUE
),
guardian_summary AS (
  SELECT
    authority.parent_member_id AS member_id,
    COUNT(*)::int AS guardian_for_count
  FROM active_household_authority authority
  GROUP BY authority.parent_member_id
),
dependent_summary AS (
  SELECT
    authority.child_member_id AS member_id,
    COUNT(*)::int AS guardian_count
  FROM active_household_authority authority
  GROUP BY authority.child_member_id
),
waiver_requirement AS (
  SELECT
    context.id AS facility_id,
    COUNT(template.id)::int AS required_count
  FROM facility_context context
  LEFT JOIN waiver_template template
    ON template.facility_id = context.id
   AND template.active_from <= CURRENT_TIMESTAMP
   AND (template.active_to IS NULL OR template.active_to > CURRENT_TIMESTAMP)
   AND template.is_required = TRUE
  GROUP BY context.id
),
waiver_acceptance_summary AS (
  SELECT
    acceptance.member_id,
    COUNT(DISTINCT acceptance.waiver_template_id)::int AS accepted_count,
    MAX(acceptance.accepted_at) AS last_accepted_at
  FROM member_waiver_acceptance acceptance
  JOIN waiver_template template ON template.id = acceptance.waiver_template_id
  JOIN facility_context context ON context.id = template.facility_id
  WHERE template.active_from <= CURRENT_TIMESTAMP
    AND (template.active_to IS NULL OR template.active_to > CURRENT_TIMESTAMP)
    AND template.is_required = TRUE
  GROUP BY acceptance.member_id
),
signup_fact AS (
  SELECT
    signup.member_id,
    CASE
      WHEN signup.archived_at IS NOT NULL
        OR signup.orphaned_at IS NOT NULL
        OR signup.status IN ('cancelled', 'completed')
        OR (signup.cancel_effective_date IS NOT NULL AND signup.cancel_effective_date <= context.today)
        OR COALESCE(offering.end_date, slot_group.active_end, form.end_date) < context.today
        THEN 'former'
      WHEN signup.status = 'waitlisted' THEN 'waitlisted'
      WHEN signup.status = 'paused' THEN 'paused'
      WHEN signup.status IN ('confirmed', 'requested')
        AND GREATEST(
          signup.enrollment_start_date,
          COALESCE(offering.start_date, slot_group.active_start, form.start_date, signup.enrollment_start_date)
        ) > context.today
        THEN 'upcoming'
      WHEN signup.status IN ('confirmed', 'requested') THEN 'current'
      ELSE 'former'
    END AS participation_state
  FROM scheduling_signup signup
  JOIN member participant ON participant.id = signup.member_id
  JOIN facility_context context ON context.id = participant.facility_id
  LEFT JOIN scheduling_form form ON form.id = signup.form_id
  LEFT JOIN scheduling_slot_group slot_group ON slot_group.id = signup.slot_group_id
  LEFT JOIN scheduling_offering offering ON offering.id = slot_group.offering_id
  WHERE signup.member_id IS NOT NULL
),
participation_summary AS (
  SELECT
    fact.member_id,
    COUNT(*)::int AS total_count,
    COUNT(*) FILTER (WHERE fact.participation_state = 'current')::int AS current_count,
    COUNT(*) FILTER (WHERE fact.participation_state = 'upcoming')::int AS upcoming_count,
    COUNT(*) FILTER (WHERE fact.participation_state = 'paused')::int AS paused_count,
    COUNT(*) FILTER (WHERE fact.participation_state = 'waitlisted')::int AS waitlisted_count,
    COUNT(*) FILTER (WHERE fact.participation_state = 'former')::int AS former_count
  FROM signup_fact fact
  GROUP BY fact.member_id
),
directory AS (
  SELECT
    member.id,
    member.first_name,
    member.last_name,
    member.email,
    member.phone,
    member.date_of_birth,
    CASE
      WHEN member.date_of_birth IS NULL THEN NULL
      ELSE EXTRACT(YEAR FROM AGE(context.today, member.date_of_birth))::int
    END AS age,
    CASE
      WHEN member.date_of_birth IS NULL THEN 'unknown'
      WHEN member.date_of_birth > (context.today - INTERVAL '18 years')::date THEN 'youth'
      ELSE 'adult'
    END AS age_group,
    family.id AS family_id,
    family.family_name,
    CASE WHEN member.is_active = TRUE THEN 'active' ELSE 'archived' END AS record_status,
    access_context.user_id AS app_user_id,
    CASE
      WHEN member.app_user_id IS NULL OR access_context.user_id IS NULL THEN 'no_login'
      ELSE access_context.member_portal_status
    END AS portal_status,
    COALESCE(access_context.staff_roles, ARRAY[]::text[]) AS staff_roles,
    CASE
      WHEN CARDINALITY(COALESCE(access_context.staff_roles, ARRAY[]::text[])) = 0 THEN 'none'
      WHEN access_context.is_active = TRUE AND access_context.staff_access_active = TRUE THEN 'active'
      ELSE 'suspended'
    END AS staff_status,
    COALESCE(billing_account.payer_member_id = member.id, FALSE) AS is_payer,
    COALESCE(guardian.guardian_for_count, 0) > 0 AS is_guardian,
    (
    COALESCE(dependent.guardian_count, 0) > 0
      OR (
        member.date_of_birth IS NOT NULL
        AND member.date_of_birth > (context.today - INTERVAL '18 years')::date
        AND family.id IS NOT NULL
      )
    ) AS is_dependent,
    COALESCE(participation.total_count, 0)::int AS participation_total,
    COALESCE(participation.current_count, 0)::int AS current_count,
    COALESCE(participation.upcoming_count, 0)::int AS upcoming_count,
    COALESCE(participation.paused_count, 0)::int AS paused_count,
    COALESCE(participation.waitlisted_count, 0)::int AS waitlisted_count,
    COALESCE(participation.former_count, 0)::int AS former_count,
    requirement.required_count,
    LEAST(COALESCE(acceptance.accepted_count, 0), requirement.required_count)::int AS accepted_count,
    acceptance.last_accepted_at,
    CASE
      WHEN requirement.required_count = 0 THEN 'not_required'
      WHEN COALESCE(acceptance.accepted_count, 0) >= requirement.required_count THEN 'current'
      ELSE 'action_required'
    END AS waiver_status,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN family.id IS NULL THEN 'missing_family' END,
      CASE
        WHEN member.app_user_id IS NOT NULL AND access_context.user_id IS NULL
        THEN 'login_link_invalid_or_cross_facility'
      END,
      CASE
        WHEN access_context.member_portal_status = 'setup_required'
        THEN 'login_setup_required'
      END,
      CASE
        WHEN family.id IS NOT NULL
         AND (billing_account.id IS NULL OR billing_account.payer_member_id IS NULL)
        THEN 'missing_payer'
      END,
      CASE
        WHEN billing_account.payer_member_id IS NOT NULL
         AND (payer.id IS NULL OR payer.is_active IS NOT TRUE)
        THEN 'payer_inactive_or_invalid'
      END,
      CASE
        WHEN billing_account.payer_member_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM family_member payer_membership
           WHERE payer_membership.family_id = family.id
             AND payer_membership.member_id = billing_account.payer_member_id
             AND payer_membership.is_active = TRUE
         )
        THEN 'payer_outside_family'
      END,
      CASE
        WHEN billing_account.id IS NOT NULL
         AND NULLIF(BTRIM(COALESCE(billing_account.billing_email, payer.email)), '') IS NULL
         AND NULLIF(BTRIM(COALESCE(billing_account.billing_phone, payer.phone)), '') IS NULL
        THEN 'billing_contact_missing'
      END,
      CASE
        WHEN member.date_of_birth IS NOT NULL
         AND member.date_of_birth > (context.today - INTERVAL '18 years')::date
         AND COALESCE(dependent.guardian_count, 0) = 0
        THEN 'youth_without_guardian'
      END
    ]::text[], NULL) AS data_quality
  FROM member
  JOIN facility_context context ON context.id = member.facility_id
  LEFT JOIN family_member membership
    ON membership.member_id = member.id
   AND membership.is_active = TRUE
  LEFT JOIN family ON family.id = membership.family_id
    AND family.facility_id = member.facility_id
    AND family.archived = FALSE
  LEFT JOIN family_billing_account billing_account
    ON billing_account.family_id = family.id
   AND billing_account.is_active = TRUE
  LEFT JOIN member payer ON payer.id = billing_account.payer_member_id
    AND payer.facility_id = member.facility_id
  LEFT JOIN v_app_user_access_context access_context
    ON access_context.user_id = member.app_user_id
   AND access_context.facility_id = member.facility_id
   AND access_context.member_id = member.id
  LEFT JOIN guardian_summary guardian ON guardian.member_id = member.id
  LEFT JOIN dependent_summary dependent ON dependent.member_id = member.id
  LEFT JOIN participation_summary participation ON participation.member_id = member.id
  JOIN waiver_requirement requirement ON requirement.facility_id = member.facility_id
  LEFT JOIN waiver_acceptance_summary acceptance ON acceptance.member_id = member.id
)
`

export class AccountDirectoryQueryError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AccountDirectoryQueryError'
    this.statusCode = 400
  }
}

function scalar(value) {
  return Array.isArray(value) ? value[0] : value
}

function positiveInteger(value, fallback, { maximum = Number.MAX_SAFE_INTEGER } = {}) {
  if (value == null || value === '') return fallback
  const normalized = Number(scalar(value))
  if (!Number.isSafeInteger(normalized) || normalized < 1) {
    throw new AccountDirectoryQueryError('Pagination values must be positive integers.')
  }
  return Math.min(normalized, maximum)
}

function normalizedFacetValue(value) {
  return String(value ?? '').trim().toLowerCase().replaceAll('-', '_')
}

function parseFacet(query, key) {
  const raw = query?.[key]
  if (raw == null || raw === '') return []
  const parts = (Array.isArray(raw) ? raw : [raw])
    .flatMap((entry) => String(entry).split(','))
    .map(normalizedFacetValue)
    .filter(Boolean)
  const values = [...new Set(parts)]
  const invalid = values.filter((value) => !FACET_VALUES[key].has(value))
  if (invalid.length > 0) {
    throw new AccountDirectoryQueryError(`Unsupported ${key} filter: ${invalid.join(', ')}`)
  }
  if (key === 'role') {
    return [...new Set(values.map((value) => {
      if (value === 'owner') return 'OWNER'
      if (value === 'administrator' || value === 'admin') return 'ADMINISTRATOR'
      return 'COACH'
    }))]
  }
  return values
}

export function parseAccountDirectoryQuery(query = {}) {
  const search = String(scalar(query.search) ?? '').trim().slice(0, 200)
  const sortBy = String(scalar(query.sortBy) ?? 'member')
  if (!Object.hasOwn(SORT_COLUMNS, sortBy)) {
    throw new AccountDirectoryQueryError(`Unsupported sort field: ${sortBy}`)
  }
  const sortDir = String(scalar(query.sortDir) ?? 'asc').toLowerCase()
  if (!['asc', 'desc'].includes(sortDir)) {
    throw new AccountDirectoryQueryError('Sort direction must be asc or desc.')
  }
  return {
    search,
    page: positiveInteger(query.page, 1),
    pageSize: positiveInteger(query.pageSize, DEFAULT_PAGE_SIZE, { maximum: MAX_PAGE_SIZE }),
    sortBy,
    sortDir,
    filters: {
      record: parseFacet(query, 'record'),
      portal: parseFacet(query, 'portal'),
      role: parseFacet(query, 'role'),
      responsibility: parseFacet(query, 'responsibility'),
      participation: parseFacet(query, 'participation'),
      waiver: parseFacet(query, 'waiver'),
      ageGroup: parseFacet(query, 'ageGroup'),
      review: parseFacet(query, 'review'),
    },
  }
}

function escapeLike(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
}

function addValue(values, value) {
  values.push(value)
  return `$${values.length}`
}

function buildDirectoryPredicates(parsed, values) {
  const searchPredicates = []
  const predicates = []
  if (parsed.search) {
    const placeholder = addValue(values, `%${escapeLike(parsed.search)}%`)
    searchPredicates.push(`(
      directory.first_name ILIKE ${placeholder} ESCAPE '\\'
      OR directory.last_name ILIKE ${placeholder} ESCAPE '\\'
      OR CONCAT_WS(' ', directory.first_name, directory.last_name) ILIKE ${placeholder} ESCAPE '\\'
      OR COALESCE(directory.email, '') ILIKE ${placeholder} ESCAPE '\\'
      OR COALESCE(directory.phone, '') ILIKE ${placeholder} ESCAPE '\\'
      OR COALESCE(directory.family_name, '') ILIKE ${placeholder} ESCAPE '\\'
    )`)
  }
  predicates.push(...searchPredicates)

  const addArrayFilter = (valuesForFacet, expression) => {
    if (valuesForFacet.length === 0) return
    const placeholder = addValue(values, valuesForFacet)
    predicates.push(expression(placeholder))
  }

  addArrayFilter(parsed.filters.record, (p) => `directory.record_status = ANY(${p}::text[])`)
  addArrayFilter(parsed.filters.portal, (p) => `directory.portal_status = ANY(${p}::text[])`)
  addArrayFilter(parsed.filters.role, (p) => `directory.staff_roles && ${p}::text[]`)
  addArrayFilter(parsed.filters.responsibility, (p) => `(
    ('payer' = ANY(${p}::text[]) AND directory.is_payer)
    OR ('guardian' = ANY(${p}::text[]) AND directory.is_guardian)
    OR ('dependent' = ANY(${p}::text[]) AND directory.is_dependent)
  )`)
  addArrayFilter(parsed.filters.participation, (p) => `(
    ('current' = ANY(${p}::text[]) AND directory.current_count > 0)
    OR ('upcoming' = ANY(${p}::text[]) AND directory.upcoming_count > 0)
    OR ('paused' = ANY(${p}::text[]) AND directory.paused_count > 0)
    OR ('waitlisted' = ANY(${p}::text[]) AND directory.waitlisted_count > 0)
    OR ('former' = ANY(${p}::text[]) AND directory.former_count > 0)
    OR ('never' = ANY(${p}::text[]) AND directory.participation_total = 0)
  )`)
  addArrayFilter(parsed.filters.waiver, (p) => `directory.waiver_status = ANY(${p}::text[])`)
  addArrayFilter(parsed.filters.ageGroup, (p) => `directory.age_group = ANY(${p}::text[])`)
  addArrayFilter(parsed.filters.review, (p) => `(
    ('needed' = ANY(${p}::text[]) AND CARDINALITY(directory.data_quality) > 0)
    OR ('clear' = ANY(${p}::text[]) AND CARDINALITY(directory.data_quality) = 0)
  )`)

  return {
    searchWhere: searchPredicates.length > 0 ? searchPredicates.join(' AND ') : 'TRUE',
    filteredWhere: predicates.length > 0 ? predicates.join(' AND ') : 'TRUE',
  }
}

export function buildAccountDirectoryQueries(facilityId, parsed) {
  const normalizedFacilityId = Number(facilityId)
  if (!Number.isSafeInteger(normalizedFacilityId) || normalizedFacilityId < 1) {
    throw new AccountDirectoryQueryError('A valid facility is required.')
  }
  const values = [normalizedFacilityId]
  const { searchWhere, filteredWhere } = buildDirectoryPredicates(parsed, values)
  const sharedValues = [...values]
  const limit = addValue(values, parsed.pageSize)
  const offset = addValue(values, (parsed.page - 1) * parsed.pageSize)
  const direction = parsed.sortDir === 'desc' ? 'DESC' : 'ASC'
  const sortColumn = SORT_COLUMNS[parsed.sortBy]
  const nulls = parsed.sortBy === 'age' || parsed.sortBy === 'family' ? ' NULLS LAST' : ''

  const pageText = `${DIRECTORY_CTES}
SELECT *
FROM directory
WHERE ${filteredWhere}
ORDER BY ${sortColumn} ${direction}${nulls}, LOWER(directory.last_name), LOWER(directory.first_name), directory.id
LIMIT ${limit}
OFFSET ${offset}`

  const statsText = `${DIRECTORY_CTES}
SELECT
  COUNT(*) FILTER (WHERE ${filteredWhere})::int AS total,
  JSONB_BUILD_OBJECT(
    'record', JSONB_BUILD_OBJECT(
      'active', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.record_status = 'active')::int,
      'archived', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.record_status = 'archived')::int
    ),
    'portal', JSONB_BUILD_OBJECT(
      'active', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.portal_status = 'active')::int,
      'setup_required', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.portal_status = 'setup_required')::int,
      'suspended', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.portal_status = 'suspended')::int,
      'no_login', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.portal_status = 'no_login')::int
    ),
    'role', JSONB_BUILD_OBJECT(
      'owner', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.staff_roles @> ARRAY['OWNER']::text[])::int,
      'administrator', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.staff_roles @> ARRAY['ADMINISTRATOR']::text[])::int,
      'coach', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.staff_roles @> ARRAY['COACH']::text[])::int
    ),
    'responsibility', JSONB_BUILD_OBJECT(
      'payer', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.is_payer)::int,
      'guardian', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.is_guardian)::int,
      'dependent', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.is_dependent)::int
    ),
    'participation', JSONB_BUILD_OBJECT(
      'current', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.current_count > 0)::int,
      'upcoming', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.upcoming_count > 0)::int,
      'paused', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.paused_count > 0)::int,
      'waitlisted', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.waitlisted_count > 0)::int,
      'former', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.former_count > 0)::int,
      'never', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.participation_total = 0)::int
    ),
    'waiver', JSONB_BUILD_OBJECT(
      'current', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.waiver_status = 'current')::int,
      'action_required', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.waiver_status = 'action_required')::int,
      'not_required', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.waiver_status = 'not_required')::int
    ),
    'ageGroup', JSONB_BUILD_OBJECT(
      'youth', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.age_group = 'youth')::int,
      'adult', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.age_group = 'adult')::int,
      'unknown', COUNT(*) FILTER (WHERE ${searchWhere} AND directory.age_group = 'unknown')::int
    ),
    'review', JSONB_BUILD_OBJECT(
      'needed', COUNT(*) FILTER (WHERE ${searchWhere} AND CARDINALITY(directory.data_quality) > 0)::int,
      'clear', COUNT(*) FILTER (WHERE ${searchWhere} AND CARDINALITY(directory.data_quality) = 0)::int
    )
  ) AS facets
FROM directory`

  return {
    page: { text: pageText, values },
    stats: { text: statsText, values: sharedValues },
  }
}

function number(value) {
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : 0
}

function participationStates(row) {
  if (number(row.participation_total) === 0) return ['never']
  return [
    ['current', row.current_count],
    ['upcoming', row.upcoming_count],
    ['paused', row.paused_count],
    ['waitlisted', row.waitlisted_count],
    ['former', row.former_count],
  ].filter(([, count]) => number(count) > 0).map(([state]) => state)
}

export function mapAccountDirectoryRow(row) {
  const roles = Array.isArray(row.staff_roles) ? row.staff_roles : []
  const badges = [
    row.is_payer === true ? 'payer' : null,
    row.is_guardian === true ? 'guardian' : null,
    row.is_dependent === true ? 'dependent' : null,
  ].filter(Boolean)
  return {
    id: number(row.id),
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    email: row.email ?? null,
    phone: row.phone ?? null,
    dateOfBirth: row.date_of_birth ?? null,
    age: row.age == null ? null : number(row.age),
    ageGroup: row.age_group,
    family: {
      id: row.family_id == null ? null : number(row.family_id),
      name: row.family_name ?? null,
    },
    recordStatus: row.record_status,
    portalAccess: {
      status: row.portal_status,
      userId: row.app_user_id == null ? null : number(row.app_user_id),
    },
    staffAccess: {
      roles,
      labels: roles.map((role) => STAFF_ROLE_LABELS[role]).filter(Boolean),
      status: row.staff_status ?? (roles.length > 0 ? 'active' : 'none'),
    },
    household: {
      isPayer: row.is_payer === true,
      isGuardian: row.is_guardian === true,
      isDependent: row.is_dependent === true,
      badges,
    },
    participation: {
      total: number(row.participation_total),
      current: number(row.current_count),
      upcoming: number(row.upcoming_count),
      paused: number(row.paused_count),
      waitlisted: number(row.waitlisted_count),
      former: number(row.former_count),
      states: participationStates(row),
    },
    waiver: {
      status: row.waiver_status,
      requiredCount: number(row.required_count),
      acceptedCount: number(row.accepted_count),
      lastAcceptedAt: row.last_accepted_at ?? null,
    },
    dataQuality: Array.isArray(row.data_quality) ? row.data_quality : [],
  }
}

export async function listAccountDirectory(pool, { facilityId, query = {} }) {
  const parsed = parseAccountDirectoryQuery(query)
  const queries = buildAccountDirectoryQueries(facilityId, parsed)
  const [pageResult, statsResult] = await Promise.all([
    pool.query(queries.page),
    pool.query(queries.stats),
  ])
  const stats = statsResult.rows[0] ?? { total: 0, facets: {} }
  const total = number(stats.total)
  return {
    rows: pageResult.rows.map(mapAccountDirectoryRow),
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / parsed.pageSize),
    facets: stats.facets ?? {},
  }
}

export function requireAccountDirectoryAdmin(req, res, next) {
  const roles = new Set((req.platformAuth?.roles ?? []).map((role) => String(role).toUpperCase()))
  if (
    req.platformAuth?.isMasterAdmin === true
    || roles.has('OWNER')
    || roles.has('MASTER_ADMIN')
    || roles.has('ADMIN')
  ) {
    next()
    return
  }
  res.status(403).json({
    success: false,
    code: 'ADMIN_PORTAL_REQUIRED',
    message: 'Administrator access is required.',
  })
}

export function registerAccountDirectoryRoutes(app, pool, { jwtSecret, requirePermission }) {
  app.get(
    '/api/admin/account-directory',
    ...requirePermission(pool, jwtSecret, 'members.view'),
    requireAccountDirectoryAdmin,
    async (req, res) => {
      try {
        const facilityId = req.platformAuth?.user?.facility_id
        const data = await listAccountDirectory(pool, { facilityId, query: req.query })
        res.json({ success: true, data })
      } catch (error) {
        const status = Number(error?.statusCode) || 500
        if (status >= 500) console.error('[account-directory] list:', error)
        res.status(status).json({
          success: false,
          message: status === 500 ? 'Unable to load the account directory.' : error.message,
        })
      }
    },
  )
}
