import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEPLOY_ACCESS_MIGRATIONS,
  REQUIRED_ACCESS_COLUMN_CONTRACTS,
  REQUIRED_ACCESS_CONSTRAINTS,
  REQUIRED_ACCESS_FUNCTIONS,
  REQUIRED_ACCESS_RELATIONS,
  REQUIRED_ACCESS_TRIGGERS,
  RETIRED_ACCESS_FUNCTIONS,
  RETIRED_ACCESS_TRIGGERS,
  assertRequiredAccessSchema,
  getRequiredAccessSchemaReadiness,
} from '../accessSchemaReadiness.js'

function readinessDb({
  missingMigration = false,
  missingTrigger = false,
  retiredTrigger = false,
  retiredFunction = false,
  invalidColumn = false,
  ownerlessFacilityId = null,
  invalidMasterAdminAssignment = null,
  crossFacilityMemberAppUserLink = null,
} = {}) {
  return {
    async query(sql) {
      const text = String(sql)
      if (text.includes('FROM schema_migrations')) {
        return { rows: missingMigration ? [] : DEPLOY_ACCESS_MIGRATIONS.map((filename) => ({ filename })) }
      }
      if (text.includes('LEFT JOIN pg_trigger')) {
        return { rows: missingTrigger ? [{ table_name: 'facility', trigger_name: 'trg_facility_owner_user_id_guard' }] : [] }
      }
      if (text.includes('JOIN pg_trigger')) {
        return { rows: retiredTrigger ? [{ table_name: 'member', trigger_name: 'trigger_update_athlete_status' }] : [] }
      }
      if (text.includes('WHERE EXISTS') && text.includes('pg_proc')) {
        return { rows: retiredFunction ? [{ function_name: 'update_member_athlete_status' }] : [] }
      }
      if (text.includes('column_default text')) {
        return {
          rows: invalidColumn
            ? [{ table_name: 'app_user', column_name: 'staff_access_active' }]
            : [],
        }
      }
      if (text.includes('FROM facility')) {
        return { rows: ownerlessFacilityId == null ? [] : [{ id: ownerlessFacilityId }] }
      }
      if (text.includes('FROM app_user au') && text.includes("au.role::text = 'MASTER_ADMIN'")) {
        return {
          rows: invalidMasterAdminAssignment == null ? [] : [{
            facility_id: invalidMasterAdminAssignment.facilityId,
            user_id: invalidMasterAdminAssignment.userId,
          }],
        }
      }
      if (text.includes('FROM member m') && text.includes('JOIN app_user au')) {
        return {
          rows: crossFacilityMemberAppUserLink == null ? [] : [{
            member_id: crossFacilityMemberAppUserLink.memberId,
            member_facility_id: crossFacilityMemberAppUserLink.memberFacilityId,
            app_user_id: crossFacilityMemberAppUserLink.appUserId,
            app_user_facility_id: crossFacilityMemberAppUserLink.appUserFacilityId,
          }],
        }
      }
      return { rows: [] }
    },
  }
}

test('identity/access readiness is separate from billing readiness and fails closed', async () => {
  assert.deepEqual(DEPLOY_ACCESS_MIGRATIONS, [
    '800_canonical_identity_access_context.sql',
    '801_canonical_member_relationships.sql',
    '802_retire_legacy_member_status_derivation.sql',
    '803_normalize_duplicate_legacy_usernames.sql',
  ])
  assert.equal((await getRequiredAccessSchemaReadiness(readinessDb())).ready, true)

  await assert.rejects(
    assertRequiredAccessSchema(readinessDb({ missingMigration: true })),
    (error) => {
      assert.equal(error.code, 'ACCESS_SCHEMA_NOT_READY')
      assert.deepEqual(error.readiness.missingMigrations, DEPLOY_ACCESS_MIGRATIONS)
      return true
    },
  )
  await assert.rejects(
    assertRequiredAccessSchema(readinessDb({ missingTrigger: true })),
    (error) => error.readiness.missingTriggers.includes('facility.trg_facility_owner_user_id_guard'),
  )
  await assert.rejects(
    assertRequiredAccessSchema(readinessDb({ ownerlessFacilityId: 7 })),
    (error) => {
      assert.deepEqual(error.readiness.ownerlessFacilityIds, [7])
      assert.match(error.message, /Resolve facility\.owner_user_id explicitly.*7/)
      return true
    },
  )
  await assert.rejects(
    assertRequiredAccessSchema(readinessDb({
      invalidMasterAdminAssignment: { facilityId: 7, userId: 12 },
    })),
    (error) => {
      assert.deepEqual(error.readiness.invalidMasterAdminAssignments, [{ facilityId: 7, userId: 12 }])
      assert.match(error.message, /Remove non-owner MASTER_ADMIN storage assignments/)
      return true
    },
  )
  await assert.rejects(
    assertRequiredAccessSchema(readinessDb({ retiredTrigger: true })),
    (error) => error.readiness.retiredTriggers.includes('member.trigger_update_athlete_status'),
  )
  await assert.rejects(
    assertRequiredAccessSchema(readinessDb({ retiredFunction: true })),
    (error) => error.readiness.retiredFunctions.includes('update_member_athlete_status'),
  )
  await assert.rejects(
    assertRequiredAccessSchema(readinessDb({ invalidColumn: true })),
    (error) => error.readiness.invalidColumns.includes('app_user.staff_access_active'),
  )
  await assert.rejects(
    assertRequiredAccessSchema(readinessDb({
      crossFacilityMemberAppUserLink: {
        memberId: 74,
        memberFacilityId: 7,
        appUserId: 99,
        appUserFacilityId: 8,
      },
    })),
    (error) => {
      assert.deepEqual(error.readiness.crossFacilityMemberAppUserLinks, [{
        memberId: 74,
        memberFacilityId: 7,
        appUserId: 99,
        appUserFacilityId: 8,
      }])
      assert.match(error.message, /Relink cross-facility member\/app_user identities/)
      return true
    },
  )
})

test('identity/access readiness requires canonical household and guardian guards', () => {
  assert.ok(REQUIRED_ACCESS_RELATIONS.includes('uq_app_user_login_email_normalized'))
  assert.ok(REQUIRED_ACCESS_RELATIONS.includes('uq_app_user_login_username_normalized'))
  assert.ok(REQUIRED_ACCESS_RELATIONS.includes('uq_family_member_one_active_per_member'))
  assert.ok(REQUIRED_ACCESS_RELATIONS.includes('idx_parent_guardian_authority_active_child'))
  assert.deepEqual(REQUIRED_ACCESS_COLUMN_CONTRACTS, [
    {
      tableName: 'app_user',
      columnName: 'staff_access_active',
      dataType: 'boolean',
      isNullable: 'NO',
      columnDefault: 'true',
    },
    {
      tableName: 'app_user',
      columnName: 'member_portal_access_active',
      dataType: 'boolean',
      isNullable: 'NO',
      columnDefault: 'true',
    },
  ])
  assert.ok(REQUIRED_ACCESS_FUNCTIONS.includes('guard_canonical_family_member'))
  assert.ok(REQUIRED_ACCESS_FUNCTIONS.includes('sync_member_family_pointer_from_family_member'))
  assert.ok(REQUIRED_ACCESS_FUNCTIONS.includes('guard_parent_guardian_authority_scope'))
  assert.ok(REQUIRED_ACCESS_FUNCTIONS.includes('guard_member_guardian_eligibility'))
  assert.ok(REQUIRED_ACCESS_FUNCTIONS.includes('guard_app_user_master_admin_owner'))
  assert.ok(REQUIRED_ACCESS_FUNCTIONS.includes('guard_app_user_role_master_admin_owner'))
  assert.ok(REQUIRED_ACCESS_FUNCTIONS.includes('guard_member_app_user_facility'))
  assert.ok(REQUIRED_ACCESS_FUNCTIONS.includes('guard_app_user_member_link_facility'))
  assert.ok(REQUIRED_ACCESS_TRIGGERS.some(({ tableName, triggerName }) => (
    tableName === 'app_user' && triggerName === 'trg_app_user_master_admin_owner_guard'
  )))
  assert.ok(REQUIRED_ACCESS_TRIGGERS.some(({ tableName, triggerName }) => (
    tableName === 'app_user_role' && triggerName === 'trg_app_user_role_master_admin_owner_guard'
  )))
  assert.ok(REQUIRED_ACCESS_TRIGGERS.some(({ tableName, triggerName }) => (
    tableName === 'member' && triggerName === 'trg_member_app_user_facility_guard'
  )))
  assert.ok(REQUIRED_ACCESS_TRIGGERS.some(({ tableName, triggerName }) => (
    tableName === 'app_user' && triggerName === 'trg_app_user_member_link_facility_guard'
  )))
  assert.ok(REQUIRED_ACCESS_TRIGGERS.some(({ tableName, triggerName }) => (
    tableName === 'family_member' && triggerName === 'trg_canonical_family_member_guard'
  )))
  assert.ok(REQUIRED_ACCESS_TRIGGERS.some(({ tableName, triggerName }) => (
    tableName === 'parent_guardian_authority'
      && triggerName === 'trg_parent_guardian_authority_scope_guard'
  )))
  assert.ok(REQUIRED_ACCESS_TRIGGERS.some(({ tableName, triggerName }) => (
    tableName === 'member' && triggerName === 'trg_member_guardian_eligibility_guard'
  )))
  assert.ok(REQUIRED_ACCESS_CONSTRAINTS.some(({ tableName, constraintName }) => (
    tableName === 'parent_guardian_authority'
      && constraintName === 'parent_guardian_authority_non_self_check'
  )))
  assert.ok(REQUIRED_ACCESS_CONSTRAINTS.some(({ tableName, constraintName }) => (
    tableName === 'app_user' && constraintName === 'app_user_email_identifier_shape_check'
  )))
  assert.ok(REQUIRED_ACCESS_CONSTRAINTS.some(({ tableName, constraintName }) => (
    tableName === 'app_user' && constraintName === 'app_user_username_identifier_shape_check'
  )))
  assert.deepEqual(RETIRED_ACCESS_TRIGGERS, [
    { tableName: 'member', triggerName: 'trigger_update_athlete_status' },
    { tableName: 'member_program', triggerName: 'trigger_update_status_on_enrollment' },
  ])
  assert.deepEqual(RETIRED_ACCESS_FUNCTIONS, [
    'update_member_athlete_status',
    'update_athlete_status_on_enrollment',
  ])
})
