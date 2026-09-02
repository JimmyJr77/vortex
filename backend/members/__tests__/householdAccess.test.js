import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

import {
  canEditHouseholdMember,
  canRequestHouseholdMemberRemoval,
  loadHouseholdAccess,
  serializeHouseholdAccess,
} from '../householdAccess.js'

function dbWith(row) {
  return {
    async query(sql, params) {
      assert.match(sql, /parent_guardian_authority/)
      assert.deepEqual(params, [12, 3, 45])
      return { rows: [row] }
    },
  }
}

test('payer can manage every member in the active household', async () => {
  const access = await loadHouseholdAccess(dbWith({
    is_household_member: true,
    is_payer: true,
    is_guardian: false,
    managed_member_ids: [],
  }), { familyId: 12, facilityId: 3, viewerMemberId: 45 })

  assert.equal(access.canAddFamilyMembers, true)
  assert.equal(canEditHouseholdMember(access, 99), true)
  assert.equal(canRequestHouseholdMemberRemoval(access, 99), true)
})

test('guardian authority is limited to self and explicitly linked dependents', async () => {
  const access = await loadHouseholdAccess(dbWith({
    is_household_member: true,
    is_payer: false,
    is_guardian: true,
    managed_member_ids: ['61', '62'],
  }), { familyId: 12, facilityId: 3, viewerMemberId: 45 })

  assert.equal(canEditHouseholdMember(access, 45), true)
  assert.equal(canEditHouseholdMember(access, 61), true)
  assert.equal(canEditHouseholdMember(access, 99), false)
  assert.equal(canRequestHouseholdMemberRemoval(access, 99), false)
  assert.deepEqual(serializeHouseholdAccess(access), {
    isPayer: false,
    isGuardian: true,
    canAddFamilyMembers: true,
  })
})

test('guardian authority includes only minors as of the facility-local calendar date', async () => {
  const access = await loadHouseholdAccess({
    async query(sql, params) {
      assert.deepEqual(params, [12, 3, 45])
      assert.match(
        sql,
        /CURRENT_TIMESTAMP AT TIME ZONE COALESCE\(NULLIF\(facility_row\.timezone, ''\), 'America\/New_York'\)/,
      )
      assert.match(sql, /child\.date_of_birth IS NOT NULL/)
      assert.match(
        sql,
        /child\.date_of_birth > \(viewer\.today - INTERVAL '18 years'\)::date/,
      )
      return {
        rows: [{
          is_household_member: true,
          is_payer: false,
          is_guardian: false,
          managed_member_ids: [],
        }],
      }
    },
  }, { familyId: 12, facilityId: 3, viewerMemberId: 45 })

  assert.deepEqual(access.managedMemberIds, [])
  assert.equal(access.isGuardian, false)
})

test('missing active household membership fails closed', async () => {
  const access = await loadHouseholdAccess(dbWith({
    is_household_member: false,
    is_payer: true,
    is_guardian: true,
    managed_member_ids: [61],
  }), { familyId: 12, facilityId: 3, viewerMemberId: 45 })

  assert.equal(access, null)
  assert.equal(canEditHouseholdMember(access, 45), false)
  assert.deepEqual(serializeHouseholdAccess(access), {
    isPayer: false,
    isGuardian: false,
    canAddFamilyMembers: false,
  })
})

test('invalid identifiers fail closed without querying', async () => {
  let queried = false
  const access = await loadHouseholdAccess({
    async query() {
      queried = true
      return { rows: [] }
    },
  }, { familyId: null, facilityId: 3, viewerMemberId: 45 })

  assert.equal(access, null)
  assert.equal(queried, false)
})

test('billing responsibility does not grant waiver-signing authority', async () => {
  const source = await fs.readFile(
    new URL('../../platform/registerRoutes.js', import.meta.url),
    'utf8',
  )
  const start = source.indexOf('async function canSignWaiversForMembers')
  const end = source.indexOf('function mapBillingAccount', start)
  const authorization = source.slice(start, end)

  assert.match(authorization, /authority\.has_legal_authority = TRUE/)
  assert.match(authorization, /Only an authorized parent or guardian may sign/)
  assert.doesNotMatch(authorization, /payer_member_id|isPayer|family_billing_account/)
})
