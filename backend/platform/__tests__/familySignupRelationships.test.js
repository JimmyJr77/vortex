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
