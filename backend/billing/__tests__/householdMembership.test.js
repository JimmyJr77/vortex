import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canonicalActiveHouseholdMemberPredicate,
  resolveCanonicalActiveMemberFamilyId,
} from '../householdMembership.js'
import { buildFamilyExistingEnrollmentPreviewLines } from '../../scheduling/orderPricing.js'

test('canonical household predicate makes active links authoritative over legacy family_id', () => {
  const sql = canonicalActiveHouseholdMemberPredicate({
    memberAlias: 'athlete',
    familyIdReference: 'account.family_id',
    membershipAlias: 'current_link',
    historyAlias: 'any_link',
  })

  assert.match(sql, /athlete\.is_active = TRUE/)
  assert.match(sql, /current_link\.family_id = account\.family_id/)
  assert.match(sql, /current_link\.is_active = TRUE/)
  assert.match(sql, /athlete\.family_id = account\.family_id/)
  assert.match(sql, /NOT EXISTS/)
  assert.match(sql, /any_link\.member_id = athlete\.id/)
})

test('canonical household predicate rejects unsafe interpolated identifiers', () => {
  assert.throws(
    () => canonicalActiveHouseholdMemberPredicate({ memberAlias: 'member; DROP TABLE member' }),
    /Invalid member SQL alias/,
  )
  assert.throws(
    () => canonicalActiveHouseholdMemberPredicate({ familyIdReference: '$1 OR TRUE' }),
    /Invalid family-id SQL reference/,
  )
})

test('canonical member family resolution fails closed when household links are ambiguous', async () => {
  let captured
  const pool = {
    async query(sql, params) {
      captured = { sql: String(sql), params }
      return { rows: [{ family_id: '42' }, { family_id: '43' }] }
    },
  }

  assert.equal(
    await resolveCanonicalActiveMemberFamilyId(pool, { memberId: 74, facilityId: 9 }),
    null,
  )
  assert.deepEqual(captured.params, [74, 9])
  assert.match(captured.sql, /membership\.is_active = TRUE/)
  assert.match(captured.sql, /NOT EXISTS/)
  assert.match(captured.sql, /LIMIT 2/)
})

test('canonical member family resolution accepts one scoped active household', async () => {
  const pool = { query: async () => ({ rows: [{ family_id: '42' }] }) }
  assert.equal(await resolveCanonicalActiveMemberFamilyId(pool, { memberId: 74 }), 42)
  assert.equal(await resolveCanonicalActiveMemberFamilyId(pool, { memberId: 'bad' }), null)
})

test('household order pricing selects athletes through the canonical predicate', async () => {
  let captured
  const pool = {
    async query(sql, params) {
      captured = { sql: String(sql), params }
      return { rows: [] }
    },
  }

  assert.deepEqual(
    await buildFamilyExistingEnrollmentPreviewLines(pool, { familyId: 42 }),
    [],
  )
  assert.deepEqual(captured.params, [42])
  assert.match(captured.sql, /member\.is_active = TRUE/)
  assert.match(captured.sql, /pricing_membership\.is_active = TRUE/)
  assert.match(captured.sql, /FROM family_member pricing_membership_history/)
})
