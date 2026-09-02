import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import {
  queryGuardianMinorChildMemberIds,
  queryMinorChildGuardianContacts,
  queryMinorChildGuardianMemberIds,
} from '../coachRoster.js'

function guardianPool(rows) {
  const calls = []
  return {
    calls,
    pool: {
      async query(sql, params) {
        calls.push({ sql: String(sql), params })
        return { rows }
      },
    },
  }
}

test('coach guardian resolution uses canonical active login and household relationships', async () => {
  const fixture = guardianPool([{
    child_member_id: '41',
    guardian_member_id: '12',
    guardian_email: ' guardian@example.test ',
  }])

  assert.deepEqual(
    await queryMinorChildGuardianMemberIds(fixture.pool, 41, 7),
    [12],
  )
  assert.deepEqual(fixture.calls[0].params, [41, null, 7])

  assert.deepEqual(
    await queryMinorChildGuardianContacts(fixture.pool, 41, 7),
    [{ memberId: 12, email: 'guardian@example.test' }],
  )
  assert.deepEqual(fixture.calls[1].params, [41, null, 7])

  assert.deepEqual(
    await queryGuardianMinorChildMemberIds(fixture.pool, 12, 7),
    [41],
  )
  assert.deepEqual(fixture.calls[2].params, [null, 12, 7])

  const sql = fixture.calls[0].sql
  assert.match(sql, /JOIN parent_guardian_authority authority/)
  assert.match(sql, /authority\.has_legal_authority = TRUE/)
  assert.match(sql, /JOIN family_member child_household/)
  assert.match(sql, /JOIN family_member guardian_household/)
  assert.match(sql, /guardian_household\.family_id = child_household\.family_id/)
  assert.match(sql, /child_household\.is_active = TRUE/)
  assert.match(sql, /guardian_household\.is_active = TRUE/)
  assert.match(sql, /JOIN v_app_user_access_context guardian_access/)
  assert.match(sql, /guardian_access\.user_id = guardian\.app_user_id/)
  assert.match(sql, /guardian_access\.member_id = guardian\.id/)
  assert.match(sql, /guardian_access\.facility_id = \$3/)
  assert.match(sql, /guardian_access\.can_access_member_portal = TRUE/)
  assert.match(sql, /child\.facility_id = \$3/)
  assert.match(sql, /child\.is_active = TRUE/)
  assert.match(sql, /guardian\.is_active = TRUE/)
  assert.match(sql, /JOIN facility facility_row/)
  assert.match(sql, /child\.date_of_birth IS NOT NULL/)
  assert.match(sql, /child\.date_of_birth > \([\s\S]*CURRENT_TIMESTAMP AT TIME ZONE COALESCE\(facility_row\.timezone/)
  assert.match(sql, /guardian\.date_of_birth IS NOT NULL/)
  assert.match(sql, /guardian\.date_of_birth <= \([\s\S]*CURRENT_TIMESTAMP AT TIME ZONE COALESCE\(facility_row\.timezone/)
  assert.doesNotMatch(sql, /parent_guardian_ids/)
  assert.doesNotMatch(sql, /unnest\(/i)
})

test('invalid guardian relationship scope fails closed without querying', async () => {
  const fixture = guardianPool([])

  assert.deepEqual(await queryMinorChildGuardianMemberIds(fixture.pool, 41, null), [])
  assert.deepEqual(await queryMinorChildGuardianContacts(fixture.pool, -1, 7), [])
  assert.deepEqual(await queryGuardianMinorChildMemberIds(fixture.pool, 0, 7), [])
  assert.equal(fixture.calls.length, 0)
})

test('coach portal authorization and guardian notifications use the canonical helpers', async () => {
  const source = await fs.readFile(new URL('../coachPortalRoutes.js', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /parent_guardian_ids/)
  assert.doesNotMatch(source, /parent_guardian_authority/)
  assert.match(source, /queryMinorChildGuardianContacts\(pool, memberId, facilityId\)/)
  assert.match(source, /queryMinorChildGuardianMemberIds\(pool, threadMemberId, facilityId\)/)
  assert.match(source, /queryMinorChildGuardianMemberIds\([\s\S]*thread\.facility_id/)
  assert.match(source, /queryGuardianMinorChildMemberIds\(pool, memberId, facilityId\)/)
  assert.match(source, /memberCanAccessMessageThread\(memberId, thread\.member_id, facilityId\)/)
  assert.match(source, /t\.member_id = ANY\(\$3::bigint\[\]\)/)
  assert.match(source, /ge\.member_id = ANY\(\$3::bigint\[\]\)/)
})
