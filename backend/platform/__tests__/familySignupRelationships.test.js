import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import { syncCanonicalGuardianAuthority } from '../familySignup.js'

test('family signup replaces canonical guardian authority deterministically', async () => {
  const calls = []
  const client = {
    async query(sql, values) {
      calls.push({ sql: String(sql), values })
      return { rows: [] }
    },
  }

  const guardianIds = await syncCanonicalGuardianAuthority(client, 41, [12, 12, 13])

  assert.deepEqual(guardianIds, [12, 13])
  assert.equal(calls.length, 3)
  assert.match(calls[0].sql, /UPDATE parent_guardian_authority/)
  assert.deepEqual(calls[0].values, [41])
  assert.match(calls[1].sql, /INSERT INTO parent_guardian_authority/)
  assert.deepEqual(calls[1].values, [12, 41])
  assert.deepEqual(calls[2].values, [13, 41])
})

test('family signup rejects invalid or self-referential guardian authority before writing', async () => {
  let calls = 0
  const client = {
    async query() {
      calls += 1
      return { rows: [] }
    },
  }

  await assert.rejects(
    syncCanonicalGuardianAuthority(client, 41, [41]),
    /valid, distinct member ids/,
  )
  await assert.rejects(
    syncCanonicalGuardianAuthority(client, 41, ['not-an-id']),
    /valid, distinct member ids/,
  )
  assert.equal(calls, 0)
})

test('all family-signup member creation paths sync canonical guardian authority', async () => {
  const source = await fs.readFile(
    new URL('../familySignup.js', import.meta.url),
    'utf8',
  )

  assert.match(source, /syncCanonicalGuardianAuthority\(client, member\.id, parentGuardianIds\)/)
  assert.match(
    source,
    /syncCanonicalGuardianAuthority\(client, minorMemberId, \[result\.payerMemberId\]\)/,
  )
})

test('portal family additions require DOB and explicit youth guardian authority', async () => {
  const source = await fs.readFile(
    new URL('../familySignup.js', import.meta.url),
    'utf8',
  )
  const start = source.indexOf('export async function createPortalFamilyMember')
  const end = source.indexOf('export async function finalizePendingDropIn', start)
  const portalAdd = source.slice(start, end)

  assert.match(portalAdd, /Date of birth is required/)
  assert.match(portalAdd, /legalGuardianMemberId/)
  assert.match(portalAdd, /parentGuardianIds: minor \? \[guardianId\] : \[\]/)
  assert.doesNotMatch(portalAdd, /parentGuardianIds: minor \? \[Number\(payerMember\.id\)\]/)
})

test('family signup creates generated login identities and never upserts by member id', async () => {
  const source = await fs.readFile(
    new URL('../familySignup.js', import.meta.url),
    'utf8',
  )

  assert.doesNotMatch(source, /INSERT INTO app_user \(\s*id,/)
  assert.doesNotMatch(source, /ON CONFLICT \(id\) DO UPDATE/)
  assert.doesNotMatch(source, /UPDATE member SET app_user_id = \$1 WHERE id = \$1/)
  assert.match(source, /RETURNING id/)
  assert.match(source, /UPDATE member SET app_user_id = \$2/)
  assert.doesNotMatch(source, /ensureMemberAthleteAccount/)
})

test('new family-signup member writes do not populate retired status or guardian caches', async () => {
  const source = await fs.readFile(
    new URL('../familySignup.js', import.meta.url),
    'utf8',
  )
  const createStart = source.indexOf('async function createMemberRecord')
  const createEnd = source.indexOf('export async function createPortalFamilyMember', createStart)
  const createMember = source.slice(createStart, createEnd)
  const minorStart = source.indexOf("app.post('/api/signup/minor-start'")
  const minorEnd = source.indexOf("app.post('/api/signup/invite/:token/complete'", minorStart)
  const minorSignup = source.slice(minorStart, minorEnd)
  const inviteStart = minorEnd
  const inviteEnd = source.indexOf("app.get('/api/signup/invite/:token'", inviteStart)
  const inviteCompletion = source.slice(inviteStart, inviteEnd)

  assert.doesNotMatch(createMember, /parent_guardian_ids|['"]legacy['"]|has_completed_waivers/)
  assert.doesNotMatch(minorSignup, /parent_guardian_ids|['"]legacy['"]|has_completed_waivers/)
  assert.doesNotMatch(inviteCompletion, /SET parent_guardian_ids/)
})

import { createPortalFamilyMember, requirePortalAdultGuardian } from '../familySignup.js'

for (const scenario of [
  { row: { id: 10, date_of_birth: null }, message: /Your own date of birth is missing/ },
  { row: { id: 10, date_of_birth: '2010-02-15' }, message: /must be at least 18/ },
  { row: null, message: /active adult in this family and facility/ },
]) {
  test(`portal blocks invalid guardian before creating child: ${scenario.message}`, async () => {
    const queries = []
    const client = { async query(sql, values) {
      queries.push(sql)
      if (sql.includes('AS facility_date')) return { rows: [{ facility_date: '2026-10-18' }] }
      if (sql.includes('SELECT member.id, member.date_of_birth')) {
        assert.deepEqual(values, [10, 1, 67])
        assert.match(sql, /membership.is_active=TRUE/)
        assert.match(sql, /member.facility_id=\$2/)
        return { rows: scenario.row ? [scenario.row] : [] }
      }
      throw new Error('Unexpected write or query')
    } }
    await assert.rejects(createPortalFamilyMember(client, {
      facilityId: 1, familyId: 67, responsibleMember: { id: 10 }, legalGuardianMemberId: 10,
      input: { firstName: 'Millie', lastName: 'Mills', dateOfBirth: '2019-02-15' },
    }), scenario.message)
    assert.equal(queries.some(sql => /INSERT|UPDATE/.test(sql)), false)
  })
}

test('guardian can add a youth on their eighteenth birthday', async () => {
  await requirePortalAdultGuardian({ async query() { return { rows: [{ id: 10, date_of_birth: new Date('2008-10-18T04:00:00Z') }] } } }, {
    guardianId: 10, familyId: 67, facilityId: 1, asOfDate: '2026-10-18',
  })
})

test('portal profile can fill a missing DOB without replacing an established birth date', async () => {
  const source = await fs.readFile(new URL('../../server.js', import.meta.url), 'utf8')
  const update = source.slice(source.indexOf("app.put('/api/members/me'"), source.indexOf("app.post('/api/members/family'"))
  assert.match(update, /isValidCalendarDate\(date_of_birth\)/)
  assert.match(update, /existingDob && existingDob !== date_of_birth/)
  assert.match(update, /date_of_birth = COALESCE\(date_of_birth, \$9::date\)/)
  assert.match(update, /AND app_user_id = \$2/)
  assert.match(update, /AND facility_id = \$8/)
})
