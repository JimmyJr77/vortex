export const DEPLOY_ACCESS_MIGRATIONS = Object.freeze([
  '800_canonical_identity_access_context.sql',
  '801_canonical_member_relationships.sql',
  '802_retire_legacy_member_status_derivation.sql',
  '803_normalize_duplicate_legacy_usernames.sql',
])

export const REQUIRED_ACCESS_MIGRATIONS = DEPLOY_ACCESS_MIGRATIONS

export const REQUIRED_ACCESS_RELATIONS = Object.freeze([
  'uq_facility_owner_user_id',
  'uq_app_user_login_email_normalized',
  'uq_app_user_login_username_normalized',
  'uq_family_member_one_active_per_member',
  'idx_parent_guardian_authority_active_child',
  'v_app_user_access_context',
])

export const REQUIRED_ACCESS_COLUMNS = Object.freeze([
  { tableName: 'facility', columnName: 'owner_user_id' },
  { tableName: 'app_user', columnName: 'staff_access_active' },
  { tableName: 'app_user', columnName: 'member_portal_access_active' },
])

export const REQUIRED_ACCESS_COLUMN_CONTRACTS = Object.freeze([
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

export const REQUIRED_ACCESS_TRIGGERS = Object.freeze([
  { tableName: 'facility', triggerName: 'trg_facility_owner_user_id_guard' },
  { tableName: 'facility', triggerName: 'trg_facility_owner_role_canonicalization' },
  { tableName: 'app_user', triggerName: 'trg_facility_owner_app_user_guard' },
  { tableName: 'app_user', triggerName: 'trg_app_user_member_link_facility_guard' },
  { tableName: 'app_user', triggerName: 'trg_app_user_master_admin_owner_guard' },
  { tableName: 'app_user_role', triggerName: 'trg_app_user_role_master_admin_owner_guard' },
  { tableName: 'family_member', triggerName: 'trg_canonical_family_member_guard' },
  { tableName: 'family_member', triggerName: 'trg_sync_member_family_pointer' },
  { tableName: 'parent_guardian_authority', triggerName: 'trg_parent_guardian_authority_scope_guard' },
  { tableName: 'member', triggerName: 'trg_member_app_user_facility_guard' },
  { tableName: 'member', triggerName: 'trg_member_guardian_eligibility_guard' },
])

export const REQUIRED_ACCESS_FUNCTIONS = Object.freeze([
  'guard_facility_owner_user_id',
  'canonicalize_facility_owner_roles',
  'guard_facility_owner_app_user',
  'guard_app_user_member_link_facility',
  'guard_app_user_master_admin_owner',
  'guard_app_user_role_master_admin_owner',
  'guard_member_app_user_facility',
  'guard_canonical_family_member',
  'sync_member_family_pointer_from_family_member',
  'guard_parent_guardian_authority_scope',
  'guard_member_guardian_eligibility',
])

export const RETIRED_ACCESS_TRIGGERS = Object.freeze([
  { tableName: 'member', triggerName: 'trigger_update_athlete_status' },
  { tableName: 'member_program', triggerName: 'trigger_update_status_on_enrollment' },
])

export const RETIRED_ACCESS_FUNCTIONS = Object.freeze([
  'update_member_athlete_status',
  'update_athlete_status_on_enrollment',
])

export const REQUIRED_ACCESS_CONSTRAINTS = Object.freeze([
  { tableName: 'facility', constraintName: 'facility_owner_user_id_fkey', constraintType: 'f' },
  { tableName: 'app_user', constraintName: 'app_user_email_identifier_shape_check', constraintType: 'c' },
  { tableName: 'app_user', constraintName: 'app_user_username_identifier_shape_check', constraintType: 'c' },
  {
    tableName: 'parent_guardian_authority',
    constraintName: 'parent_guardian_authority_non_self_check',
    constraintType: 'c',
  },
])

async function missingMigrations(db) {
  let result
  try {
    result = await db.query(
      `SELECT filename
         FROM schema_migrations
        WHERE filename = ANY($1::text[])`,
      [REQUIRED_ACCESS_MIGRATIONS],
    )
  } catch (error) {
    if (error?.code === '42P01') return [...REQUIRED_ACCESS_MIGRATIONS]
    throw error
  }
  const present = new Set(result.rows.map((row) => String(row.filename)))
  return REQUIRED_ACCESS_MIGRATIONS.filter((filename) => !present.has(filename))
}

async function missingRelations(db) {
  const result = await db.query(
    `SELECT expected.object_name
       FROM unnest($1::text[]) AS expected(object_name)
      WHERE to_regclass('public.' || expected.object_name) IS NULL
      ORDER BY expected.object_name`,
    [REQUIRED_ACCESS_RELATIONS],
  )
  return result.rows.map((row) => String(row.object_name))
}

async function missingColumns(db) {
  const result = await db.query(
    `SELECT expected.table_name, expected.column_name
       FROM jsonb_to_recordset($1::jsonb) AS expected(table_name text, column_name text)
       LEFT JOIN information_schema.columns actual
         ON actual.table_schema = 'public'
        AND actual.table_name = expected.table_name
        AND actual.column_name = expected.column_name
      WHERE actual.column_name IS NULL
      ORDER BY expected.table_name, expected.column_name`,
    [JSON.stringify(REQUIRED_ACCESS_COLUMNS.map(({ tableName, columnName }) => ({
      table_name: tableName,
      column_name: columnName,
    })))],
  )
  return result.rows.map((row) => `${row.table_name}.${row.column_name}`)
}

async function invalidColumnContracts(db) {
  const result = await db.query(
    `SELECT expected.table_name, expected.column_name
       FROM jsonb_to_recordset($1::jsonb) AS expected(
         table_name text,
         column_name text,
         data_type text,
         is_nullable text,
         column_default text
       )
       JOIN information_schema.columns actual
         ON actual.table_schema = 'public'
        AND actual.table_name = expected.table_name
        AND actual.column_name = expected.column_name
      WHERE actual.data_type IS DISTINCT FROM expected.data_type
         OR actual.is_nullable IS DISTINCT FROM expected.is_nullable
         OR LOWER(COALESCE(actual.column_default, '')) IS DISTINCT FROM expected.column_default
      ORDER BY expected.table_name, expected.column_name`,
    [JSON.stringify(REQUIRED_ACCESS_COLUMN_CONTRACTS.map((contract) => ({
      table_name: contract.tableName,
      column_name: contract.columnName,
      data_type: contract.dataType,
      is_nullable: contract.isNullable,
      column_default: contract.columnDefault,
    })))],
  )
  return result.rows.map((row) => `${row.table_name}.${row.column_name}`)
}

async function missingTriggers(db) {
  const result = await db.query(
    `SELECT expected.table_name, expected.trigger_name
       FROM jsonb_to_recordset($1::jsonb) AS expected(table_name text, trigger_name text)
      LEFT JOIN pg_trigger trigger_row
         ON trigger_row.tgrelid = to_regclass('public.' || expected.table_name)
        AND trigger_row.tgname = expected.trigger_name
        AND trigger_row.tgisinternal = FALSE
        AND trigger_row.tgenabled IN ('O', 'A')
      WHERE trigger_row.oid IS NULL
      ORDER BY expected.table_name, expected.trigger_name`,
    [JSON.stringify(REQUIRED_ACCESS_TRIGGERS.map(({ tableName, triggerName }) => ({
      table_name: tableName,
      trigger_name: triggerName,
    })))],
  )
  return result.rows.map((row) => `${row.table_name}.${row.trigger_name}`)
}

async function missingFunctions(db) {
  const result = await db.query(
    `SELECT expected.function_name
       FROM unnest($1::text[]) AS expected(function_name)
      WHERE NOT EXISTS (
        SELECT 1
          FROM pg_proc procedure
          JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
         WHERE namespace.nspname = 'public'
           AND procedure.proname = expected.function_name
      )
      ORDER BY expected.function_name`,
    [REQUIRED_ACCESS_FUNCTIONS],
  )
  return result.rows.map((row) => String(row.function_name))
}

async function retiredTriggersStillPresent(db) {
  const result = await db.query(
    `SELECT expected.table_name, expected.trigger_name
       FROM jsonb_to_recordset($1::jsonb) AS expected(table_name text, trigger_name text)
       JOIN pg_trigger trigger_row
         ON trigger_row.tgrelid = to_regclass('public.' || expected.table_name)
        AND trigger_row.tgname = expected.trigger_name
        AND trigger_row.tgisinternal = FALSE
      ORDER BY expected.table_name, expected.trigger_name`,
    [JSON.stringify(RETIRED_ACCESS_TRIGGERS.map(({ tableName, triggerName }) => ({
      table_name: tableName,
      trigger_name: triggerName,
    })))],
  )
  return result.rows.map((row) => `${row.table_name}.${row.trigger_name}`)
}

async function retiredFunctionsStillPresent(db) {
  const result = await db.query(
    `SELECT expected.function_name
       FROM unnest($1::text[]) AS expected(function_name)
      WHERE EXISTS (
        SELECT 1
          FROM pg_proc procedure
          JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
         WHERE namespace.nspname = 'public'
           AND procedure.proname = expected.function_name
      )
      ORDER BY expected.function_name`,
    [RETIRED_ACCESS_FUNCTIONS],
  )
  return result.rows.map((row) => String(row.function_name))
}

async function missingConstraints(db) {
  const result = await db.query(
    `SELECT expected.table_name, expected.constraint_name
       FROM jsonb_to_recordset($1::jsonb) AS expected(
         table_name text,
         constraint_name text,
         constraint_type text
       )
       LEFT JOIN pg_constraint constraint_row
         ON constraint_row.conrelid = to_regclass('public.' || expected.table_name)
        AND constraint_row.conname = expected.constraint_name
        AND constraint_row.contype::text = expected.constraint_type
      WHERE constraint_row.oid IS NULL
      ORDER BY expected.table_name, expected.constraint_name`,
    [JSON.stringify(REQUIRED_ACCESS_CONSTRAINTS.map(({ tableName, constraintName, constraintType }) => ({
      table_name: tableName,
      constraint_name: constraintName,
      constraint_type: constraintType,
    })))],
  )
  return result.rows.map((row) => `${row.table_name}.${row.constraint_name}`)
}

async function facilitiesMissingOwner(db) {
  const result = await db.query(
    `SELECT id
       FROM facility
      WHERE owner_user_id IS NULL
      ORDER BY id`,
  )
  return result.rows.map((row) => Number(row.id)).filter(Number.isSafeInteger)
}

async function invalidMasterAdminAssignments(db) {
  const result = await db.query(
    `SELECT f.id AS facility_id, au.id AS user_id
       FROM app_user au
       JOIN facility f ON f.id = au.facility_id
      WHERE f.owner_user_id IS NOT NULL
        AND au.id <> f.owner_user_id
        AND (
          au.role::text = 'MASTER_ADMIN'
          OR EXISTS (
            SELECT 1
              FROM app_user_role aur
             WHERE aur.user_id = au.id
               AND aur.role::text = 'MASTER_ADMIN'
          )
        )
      ORDER BY f.id, au.id`,
  )
  return result.rows.map((row) => ({
    facilityId: Number(row.facility_id),
    userId: Number(row.user_id),
  })).filter(({ facilityId, userId }) => Number.isSafeInteger(facilityId) && Number.isSafeInteger(userId))
}

async function crossFacilityMemberAppUserLinks(db) {
  const result = await db.query(
    `SELECT
       m.id AS member_id,
       m.facility_id AS member_facility_id,
       au.id AS app_user_id,
       au.facility_id AS app_user_facility_id
       FROM member m
       JOIN app_user au ON au.id = m.app_user_id
      WHERE m.app_user_id IS NOT NULL
        AND m.facility_id IS DISTINCT FROM au.facility_id
      ORDER BY m.id`,
  )
  return result.rows.map((row) => ({
    memberId: Number(row.member_id),
    memberFacilityId: Number(row.member_facility_id),
    appUserId: Number(row.app_user_id),
    appUserFacilityId: Number(row.app_user_facility_id),
  })).filter(({ memberId, memberFacilityId, appUserId, appUserFacilityId }) => (
    Number.isSafeInteger(memberId)
      && Number.isSafeInteger(memberFacilityId)
      && Number.isSafeInteger(appUserId)
      && Number.isSafeInteger(appUserFacilityId)
  ))
}

export async function getRequiredAccessSchemaReadiness(db) {
  const [
    missingMigrationFiles,
    missingRelationNames,
    missingColumnNames,
    invalidColumnNames,
    missingTriggerNames,
    missingFunctionNames,
    retiredTriggerNames,
    retiredFunctionNames,
    missingConstraintNames,
    ownerlessFacilityIds,
    invalidMasterAdminUsers,
    invalidMemberAppUserLinks,
  ] = await Promise.all([
    missingMigrations(db),
    missingRelations(db),
    missingColumns(db),
    invalidColumnContracts(db),
    missingTriggers(db),
    missingFunctions(db),
    retiredTriggersStillPresent(db),
    retiredFunctionsStillPresent(db),
    missingConstraints(db),
    facilitiesMissingOwner(db),
    invalidMasterAdminAssignments(db),
    crossFacilityMemberAppUserLinks(db),
  ])

  return {
    ready: missingMigrationFiles.length === 0
      && missingRelationNames.length === 0
      && missingColumnNames.length === 0
      && invalidColumnNames.length === 0
      && missingTriggerNames.length === 0
      && missingFunctionNames.length === 0
      && retiredTriggerNames.length === 0
      && retiredFunctionNames.length === 0
      && missingConstraintNames.length === 0
      && ownerlessFacilityIds.length === 0
      && invalidMasterAdminUsers.length === 0
      && invalidMemberAppUserLinks.length === 0,
    missingMigrations: missingMigrationFiles,
    missingRelations: missingRelationNames,
    missingColumns: missingColumnNames,
    invalidColumns: invalidColumnNames,
    missingTriggers: missingTriggerNames,
    missingFunctions: missingFunctionNames,
    retiredTriggers: retiredTriggerNames,
    retiredFunctions: retiredFunctionNames,
    missingConstraints: missingConstraintNames,
    ownerlessFacilityIds,
    invalidMasterAdminAssignments: invalidMasterAdminUsers,
    crossFacilityMemberAppUserLinks: invalidMemberAppUserLinks,
  }
}

export async function assertRequiredAccessSchema(db) {
  const readiness = await getRequiredAccessSchemaReadiness(db)
  if (readiness.ready) return readiness

  const ownerRepair = readiness.ownerlessFacilityIds.length > 0
    ? ` Resolve facility.owner_user_id explicitly for facility id(s): ${readiness.ownerlessFacilityIds.join(', ')}.`
    : ''
  const roleRepair = readiness.invalidMasterAdminAssignments.length > 0
    ? ' Remove non-owner MASTER_ADMIN storage assignments before startup.'
    : ''
  const memberLoginRepair = readiness.crossFacilityMemberAppUserLinks.length > 0
    ? ' Relink cross-facility member/app_user identities within one facility before startup.'
    : ''
  const error = new Error(`Required identity/access schema is not ready. Run npm run migrate:deploy before startup.${ownerRepair}${roleRepair}${memberLoginRepair}`)
  error.code = 'ACCESS_SCHEMA_NOT_READY'
  error.readiness = readiness
  throw error
}

export const assertDeployAccessSchema = assertRequiredAccessSchema
