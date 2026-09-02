import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import {
  canonicalStaffRoles,
  loadCanonicalAccessContext,
  mapCanonicalAccessContext,
  resolveCanonicalTokenUserId,
} from '../accessContext.js'

test('canonical staff roles expose Owner/Administrator/Coach without changing storage keys', () => {
  assert.deepEqual(canonicalStaffRoles(['MASTER_ADMIN'], { isOwner: true }), ['OWNER'])
  assert.deepEqual(canonicalStaffRoles(['MASTER_ADMIN'], { isOwner: false }), ['ADMINISTRATOR'])
  assert.deepEqual(canonicalStaffRoles(['ADMIN', 'COACH']), ['ADMINISTRATOR', 'COACH'])
  assert.deepEqual(canonicalStaffRoles(['MEMBER_ATHLETE']), [])
})

test('member portal capability requires an active explicit link and usable credentials', () => {
  const base = {
    user_id: '9',
    facility_id: '2',
    primary_storage_role: 'ADMIN',
    storage_roles: ['ADMIN'],
    staff_roles: ['ADMINISTRATOR'],
    is_active: true,
    staff_access_active: true,
    member_portal_access_active: true,
    is_owner: false,
    can_access_admin_portal: true,
    can_access_coach_portal: false,
  }

  const active = mapCanonicalAccessContext({
    ...base,
    member_id: '74',
    family_id: '42',
    member_portal_status: 'active',
    can_access_member_portal: true,
  })
  assert.equal(active.portalAccess.member, true)
  assert.equal(active.staffAccessActive, true)
  assert.equal(active.memberPortalAccessActive, true)
  assert.equal(active.memberId, 74)

  for (const memberPortalStatus of ['no_login', 'setup_required', 'suspended']) {
    const unavailable = mapCanonicalAccessContext({
      ...base,
      member_id: memberPortalStatus === 'no_login' ? null : '74',
      member_portal_status: memberPortalStatus,
      can_access_member_portal: false,
    })
    assert.equal(unavailable.portalAccess.member, false, memberPortalStatus)
  }
})

test('access context resolves only from stable user id and never trusts email or admin_profile', async () => {
  let captured
  const db = {
    async query(sql, params) {
      captured = { sql, params }
      return {
        rows: [{
          user_id: '9',
          facility_id: '2',
          owner_user_id: '9',
          email: 'changed@example.test',
          full_name: 'Facility Owner',
          primary_storage_role: 'MASTER_ADMIN',
          storage_roles: ['MASTER_ADMIN'],
          staff_roles: ['OWNER'],
          is_active: true,
          staff_access_active: true,
          member_portal_access_active: true,
          is_owner: true,
          member_portal_status: 'no_login',
          can_access_admin_portal: true,
          can_access_coach_portal: false,
          can_access_member_portal: false,
        }],
      }
    },
  }

  const access = await loadCanonicalAccessContext(db, 9)
  assert.deepEqual(captured.params, [9])
  assert.match(captured.sql, /v_app_user_access_context/)
  assert.match(captured.sql, /WHERE user_id = \$1/)
  assert.doesNotMatch(captured.sql, /admin_profile/i)
  assert.doesNotMatch(captured.sql, /WHERE[^;]*email\s*=/i)
  assert.equal(access.isOwner, true)
  assert.deepEqual(access.staffRoles, ['OWNER'])
})

test('legacy member token claims resolve only through the explicit login link', async () => {
  const db = {
    async query(_sql, params) {
      if (Number(params[0]) === 74) return { rows: [{ app_user_id: '9' }] }
      return { rows: [] }
    },
  }

  assert.equal(await resolveCanonicalTokenUserId(db, { userId: 9 }), 9)
  assert.equal(await resolveCanonicalTokenUserId(db, { memberId: 74 }), 9)
  assert.equal(await resolveCanonicalTokenUserId(db, { userId: 9, memberId: 74 }), 9)
  assert.equal(await resolveCanonicalTokenUserId(db, { userId: 74, memberId: 74 }), null)
  assert.equal(await resolveCanonicalTokenUserId(db, { memberId: 999 }), null)
})

test('identity migration backfills only one role-derived candidate and guards canonical ownership', async () => {
  const sql = await fs.readFile(
    new URL('../../migrations/800_canonical_identity_access_context.sql', import.meta.url),
    'utf8',
  )

  assert.match(sql, /HAVING COUNT\(\*\) = 1/)
  assert.match(sql, /OLD\.owner_user_id IS NOT NULL/)
  assert.match(sql, /owner_user_id is immutable once assigned/)
  assert.match(sql, /au\.facility_id = NEW\.id/)
  assert.match(sql, /facility owner app_user cannot be deactivated, staff-suspended, or moved/)
  assert.match(sql, /ADD COLUMN IF NOT EXISTS staff_access_active BOOLEAN/)
  assert.match(sql, /ADD COLUMN IF NOT EXISTS member_portal_access_active BOOLEAN/)
  assert.match(sql, /WHEN email IS NULL THEN username/)
  assert.match(sql, /username = NULL/)
  assert.match(sql, /AND POSITION\('@' IN username\) > 0/)
  assert.match(sql, /staff_access_active = COALESCE\(staff_access_active, COALESCE\(is_active, FALSE\)\)/)
  assert.match(sql, /member_portal_access_active = COALESCE\(member_portal_access_active, COALESCE\(is_active, FALSE\)\)/)
  assert.match(sql, /is_active = TRUE/)
  assert.match(sql, /WHERE staff_access_active IS NULL\s+OR member_portal_access_active IS NULL/)
  assert.match(sql, /ALTER COLUMN staff_access_active SET DEFAULT TRUE/)
  assert.match(sql, /ALTER COLUMN staff_access_active SET NOT NULL/)
  assert.match(sql, /ALTER COLUMN member_portal_access_active SET DEFAULT TRUE/)
  assert.match(sql, /ALTER COLUMN member_portal_access_active SET NOT NULL/)
  assert.match(sql, /LEFT JOIN family_member active_family/)
  assert.match(sql, /active_family\.is_active = TRUE/)
  assert.match(sql, /active_family\.family_id/)
  assert.match(sql, /au\.staff_access_active = TRUE/)
  assert.match(sql, /CREATE TRIGGER trg_app_user_master_admin_owner_guard/)
  assert.match(sql, /CREATE TRIGGER trg_app_user_role_master_admin_owner_guard/)
  assert.match(sql, /CREATE TRIGGER trg_member_app_user_facility_guard/)
  assert.match(sql, /CREATE TRIGGER trg_app_user_member_link_facility_guard/)
  assert.match(sql, /m\.facility_id IS DISTINCT FROM au\.facility_id/)
  assert.match(sql, /linked\.facility_id = au\.facility_id/)
  assert.match(sql, /MASTER_ADMIN is reserved for facility\.owner_user_id/)
  assert.match(sql, /facility_owner_user_id IS NOT NULL\s+AND facility_owner_user_id <> NEW\.id/)
  assert.match(sql, /IF TG_OP = 'DELETE' THEN\s+RETURN OLD;/)
  assert.doesNotMatch(sql, /BEFORE INSERT OR UPDATE OF/)
  assert.doesNotMatch(sql, /JOIN\s+admin_profile/i)
  const ownerBackfill = sql.slice(
    sql.indexOf('WITH owner_candidates AS'),
    sql.indexOf('-- MASTER_ADMIN is now an owner-only compatibility storage key'),
  )
  assert.doesNotMatch(ownerBackfill, /LOWER\([^)]*email/)
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_login_email_normalized/)
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_login_username_normalized/)
})
