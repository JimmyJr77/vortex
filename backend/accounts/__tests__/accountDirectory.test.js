import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AccountDirectoryQueryError,
  buildAccountDirectoryQueries,
  listAccountDirectory,
  mapAccountDirectoryRow,
  parseAccountDirectoryQuery,
  requireAccountDirectoryAdmin,
} from '../accountDirectory.js'

test('account directory query defaults are bounded and stable', () => {
  assert.deepEqual(parseAccountDirectoryQuery(), {
    search: '',
    page: 1,
    pageSize: 25,
    sortBy: 'member',
    sortDir: 'asc',
    filters: {
      record: [],
      portal: [],
      role: [],
      responsibility: [],
      participation: [],
      waiver: [],
      ageGroup: [],
      review: [],
    },
  })
})

test('account directory query normalizes composable filters and caps page size', () => {
  const parsed = parseAccountDirectoryQuery({
    search: '  O_Brien%  ',
    page: '2',
    pageSize: '500',
    sortBy: 'participation',
    sortDir: 'DESC',
    record: 'active,archived',
    portal: ['active', 'setup-required'],
    role: 'owner,admin,coach,owner',
    responsibility: 'payer,guardian',
    participation: 'current,waitlisted',
    waiver: 'action-required',
    ageGroup: 'youth,unknown',
    review: 'needed',
  })

  assert.equal(parsed.search, 'O_Brien%')
  assert.equal(parsed.page, 2)
  assert.equal(parsed.pageSize, 100)
  assert.equal(parsed.sortDir, 'desc')
  assert.deepEqual(parsed.filters.role, ['OWNER', 'ADMINISTRATOR', 'COACH'])
  assert.deepEqual(parsed.filters.portal, ['active', 'setup_required'])
  assert.deepEqual(parsed.filters.waiver, ['action_required'])
  assert.deepEqual(parsed.filters.review, ['needed'])
})

test('account directory rejects unknown facets and sort fields', () => {
  assert.throws(
    () => parseAccountDirectoryQuery({ participation: 'athlete' }),
    AccountDirectoryQueryError,
  )
  assert.throws(
    () => parseAccountDirectoryQuery({ sortBy: 'email' }),
    /Unsupported sort field/,
  )
  assert.throws(
    () => parseAccountDirectoryQuery({ responsibility: 'billing_contact' }),
    /Unsupported responsibility filter/,
  )
})

test('account directory SQL is facility scoped, composable, and parameterized', () => {
  const parsed = parseAccountDirectoryQuery({
    search: '100%_safe',
    record: 'active',
    role: 'coach',
    responsibility: 'guardian,payer',
    participation: 'current,upcoming',
    review: 'needed',
    page: 3,
    pageSize: 10,
  })
  const queries = buildAccountDirectoryQueries(7, parsed)

  assert.match(queries.page.text, /WHERE facility\.id = \$1/)
  assert.match(queries.page.text, /directory\.staff_roles && \$\d+::text\[\]/)
  assert.match(queries.page.text, /signup\.status IN \('confirmed', 'requested'\)/)
  assert.match(queries.page.text, /'guardian' = ANY\(\$\d+::text\[\]\)/)
  assert.match(queries.page.text, /directory\.current_count > 0/)
  assert.match(queries.page.text, /CARDINALITY\(directory\.data_quality\) > 0/)
  assert.match(queries.page.text, /OR signup\.orphaned_at IS NOT NULL/)
  assert.match(queries.page.text, /LEFT JOIN v_app_user_access_context access_context/)
  assert.match(queries.page.text, /access_context\.member_id = member\.id/)
  assert.match(queries.page.text, /template\.is_required = TRUE/)
  assert.match(queries.page.text, /child\.date_of_birth > \(context\.today - INTERVAL '18 years'\)::date/)
  assert.match(queries.page.text, /LEFT JOIN family_member membership/)
  assert.match(queries.page.text, /family\.archived = FALSE/)
  assert.match(queries.stats.text, /ARRAY\['ADMINISTRATOR'\]::text\[\]/)
  assert.doesNotMatch(queries.page.text, /member\.family_id|legacy_family_link|chosen_family/)
  assert.doesNotMatch(queries.page.text, /100%_safe/)
  assert.equal(queries.page.values[0], 7)
  assert.equal(queries.page.values.at(-2), 10)
  assert.equal(queries.page.values.at(-1), 20)
  assert.ok(queries.page.values.includes('%100\\%\\_safe%'))
  assert.equal(queries.stats.values.length, queries.page.values.length - 2)
})

test('family sorting keeps members without a canonical family at the end', () => {
  const parsed = parseAccountDirectoryQuery({ sortBy: 'family', sortDir: 'asc' })
  const queries = buildAccountDirectoryQueries(2, parsed)

  assert.match(queries.page.text, /ORDER BY LOWER\(directory\.family_name\) ASC NULLS LAST/)
})

test('account directory maps independent access, household, and participation facts', () => {
  const mapped = mapAccountDirectoryRow({
    id: '19',
    first_name: 'Alex',
    last_name: 'Rivera',
    date_of_birth: '2012-06-04',
    age: '14',
    age_group: 'youth',
    family_id: '8',
    family_name: 'Rivera Family',
    record_status: 'active',
    app_user_id: null,
    portal_status: 'no_login',
    staff_roles: ['COACH'],
    is_payer: false,
    is_guardian: false,
    is_dependent: true,
    participation_total: '3',
    current_count: '1',
    upcoming_count: '1',
    paused_count: '0',
    waitlisted_count: '1',
    former_count: '0',
    required_count: '2',
    accepted_count: '1',
    last_accepted_at: '2026-08-18T19:25:00.000Z',
    waiver_status: 'action_required',
    data_quality: ['youth_without_guardian'],
  })

  assert.equal(mapped.recordStatus, 'active')
  assert.deepEqual(mapped.portalAccess, { status: 'no_login', userId: null })
  assert.deepEqual(mapped.staffAccess, { roles: ['COACH'], labels: ['Coach'], status: 'active' })
  assert.deepEqual(mapped.household.badges, ['dependent'])
  assert.equal(Object.hasOwn(mapped.household, 'isBillingContact'), false)
  assert.deepEqual(mapped.participation.states, ['current', 'upcoming', 'waitlisted'])
  assert.deepEqual(mapped.waiver, {
    status: 'action_required',
    requiredCount: 2,
    acceptedCount: 1,
    lastAcceptedAt: '2026-08-18T19:25:00.000Z',
  })
})

test('members with no signup history receive only the never participation state', () => {
  const mapped = mapAccountDirectoryRow({
    id: 1,
    first_name: 'Sam',
    last_name: 'Lee',
    age_group: 'unknown',
    record_status: 'active',
    portal_status: 'setup_required',
    staff_roles: [],
    participation_total: 0,
    current_count: 0,
    upcoming_count: 0,
    paused_count: 0,
    waitlisted_count: 0,
    former_count: 0,
    required_count: 0,
    accepted_count: 0,
    waiver_status: 'not_required',
  })

  assert.deepEqual(mapped.participation.states, ['never'])
})

test('canonical staff roles are returned with product labels', () => {
  const mapped = mapAccountDirectoryRow({
    id: 1,
    first_name: 'Owner',
    last_name: 'Account',
    age_group: 'adult',
    record_status: 'active',
    portal_status: 'active',
    staff_roles: ['OWNER', 'ADMINISTRATOR', 'COACH'],
    participation_total: 0,
    required_count: 0,
    accepted_count: 0,
    waiver_status: 'not_required',
  })
  assert.deepEqual(mapped.staffAccess, {
    roles: ['OWNER', 'ADMINISTRATOR', 'COACH'],
    labels: ['Owner', 'Administrator', 'Coach'],
    status: 'active',
  })
})

test('account directory admin gate rejects member and coach-only contexts', () => {
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
  let continued = false
  requireAccountDirectoryAdmin(
    { platformAuth: { roles: ['MEMBER_ATHLETE'], isMasterAdmin: false } },
    response,
    () => { continued = true },
  )
  assert.equal(continued, false)
  assert.equal(response.statusCode, 403)
  assert.equal(response.body.code, 'ADMIN_PORTAL_REQUIRED')

  requireAccountDirectoryAdmin(
    { platformAuth: { roles: ['ADMIN'], isMasterAdmin: false } },
    response,
    () => { continued = true },
  )
  assert.equal(continued, true)
})

test('listAccountDirectory returns pagination and facets without leaking raw fields', async () => {
  const calls = []
  const pool = {
    async query(config) {
      calls.push(config)
      if (calls.length === 1) {
        return { rows: [{
          id: 2,
          first_name: 'Kim',
          last_name: 'Bryant',
          age_group: 'adult',
          record_status: 'active',
          portal_status: 'active',
          staff_roles: [],
          participation_total: 1,
          current_count: 1,
          upcoming_count: 0,
          paused_count: 0,
          waitlisted_count: 0,
          former_count: 0,
          required_count: 1,
          accepted_count: 1,
          waiver_status: 'current',
          password_hash: 'must-not-leak',
        }] }
      }
      return { rows: [{ total: 26, facets: { record: { active: 25, archived: 1 } } }] }
    },
  }

  const result = await listAccountDirectory(pool, {
    facilityId: 1,
    query: { page: 2, pageSize: 25 },
  })
  assert.equal(result.total, 26)
  assert.equal(result.totalPages, 2)
  assert.equal(result.rows[0].password_hash, undefined)
  assert.deepEqual(result.facets.record, { active: 25, archived: 1 })
})
