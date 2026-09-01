import {
  assertBillingMigrationTransition,
  billingDateString,
  billingMigrationSnapshotHash,
  isValidTimeZone,
  normalizeBillingAccountIds,
  sanitizeBillingMigrationSnapshot,
} from './canonicalBillingMigrationState.js'

export const CANONICAL_BILLING_MIGRATION_KEY = 'canonical-household-billing-v1'
export const BILLING_MIGRATION_APPLY_MODES = new Set(['apply', 'rollback'])
const SHA256_CHECKSUM = /^[0-9a-f]{64}$/

function json(value) {
  return JSON.stringify(sanitizeBillingMigrationSnapshot(value ?? {}))
}

function positiveInteger(value, label) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${label} must be a positive integer.`)
  return number
}

function normalizeOptionalIds(values) {
  if (values == null || (Array.isArray(values) && values.length === 0)) return []
  return normalizeBillingAccountIds(values)
}

function parsedJson(value) {
  if (value == null) return {}
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
}

function comparableJson(value) {
  return JSON.stringify(stableValue(sanitizeBillingMigrationSnapshot(parsedJson(value))))
}

export function normalizeBillingMigrationRunConfiguration(configuration, {
  accountIds = null,
  familyIds = null,
  targetMonth = null,
  cohort = null,
} = {}) {
  const parsed = parsedJson(configuration)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Billing migration run configuration must be a JSON object.')
  }
  const normalizedTarget = targetMonth == null ? null : billingDateString(targetMonth)
  if (parsed.targetMonth != null && normalizedTarget != null && billingDateString(parsed.targetMonth) !== normalizedTarget) {
    throw new Error('Billing migration run configuration target month conflicts with the run contract.')
  }
  if (parsed.cohort != null && cohort != null && String(parsed.cohort) !== String(cohort)) {
    throw new Error('Billing migration run configuration cohort conflicts with the run contract.')
  }
  const configuredIds = normalizeBillingAccountIds(accountIds ?? parsed.accountIds)
  const configuredFamilyIds = normalizeOptionalIds(familyIds ?? parsed.familyIds)
  return sanitizeBillingMigrationSnapshot({
    ...parsed,
    accountIds: configuredIds,
    familyIds: configuredFamilyIds,
    ...(targetMonth == null ? {} : { targetMonth: normalizedTarget }),
    ...(cohort == null ? {} : { cohort: String(cohort) }),
  })
}

/**
 * Validate the frozen run provenance before any account or Stripe mutation.
 * `accountIds` may be a subset for a narrow resume command, but every requested
 * account must belong to the immutable configured scope.
 */
export function assertBillingMigrationRunContract(run, {
  accountIds = null,
  familyIds = null,
  requireRunning = true,
  migrationKey = CANONICAL_BILLING_MIGRATION_KEY,
  mode = 'apply',
  codeVersion = null,
  manifestChecksum = null,
  facilityId = null,
  targetMonth = null,
  facilityTimezone = null,
  cohort = null,
  configuration = null,
  requireExactAccountScope = false,
} = {}) {
  if (!run) throw new Error('A billing migration run is required.')
  if (String(run.migration_key ?? '') !== String(migrationKey)) {
    throw new Error(`Billing migration run ${run.id ?? '(unknown)'} uses an unsupported migration key.`)
  }
  if (mode != null && String(run.mode ?? '') !== String(mode)) {
    throw new Error(`Billing migration run ${run.id ?? '(unknown)'} is ${run.mode ?? 'missing a mode'}, not ${mode}.`)
  }
  if (requireRunning && String(run.status ?? '') !== 'running') {
    throw new Error(`Billing migration run ${run.id ?? '(unknown)'} is ${run.status ?? 'missing a status'} and cannot be mutated.`)
  }
  if (!String(run.code_version ?? '').trim()) {
    throw new Error(`Billing migration run ${run.id ?? '(unknown)'} is missing its release version.`)
  }
  if (!SHA256_CHECKSUM.test(String(run.manifest_checksum ?? ''))) {
    throw new Error(`Billing migration run ${run.id ?? '(unknown)'} is missing a valid deploy-manifest checksum.`)
  }
  const runFacilityId = positiveInteger(run.facility_id, 'Migration run facility ID')
  const runTargetMonth = billingDateString(run.target_month)
  if (!/^\d{4}-\d{2}-01$/.test(String(runTargetMonth ?? ''))) {
    throw new Error(`Billing migration run ${run.id ?? '(unknown)'} has an invalid target month.`)
  }
  if (!isValidTimeZone(run.facility_timezone)) {
    throw new Error(`Billing migration run ${run.id ?? '(unknown)'} has an invalid facility timezone.`)
  }
  if (!String(run.cohort ?? '').trim()) {
    throw new Error(`Billing migration run ${run.id ?? '(unknown)'} is missing its cohort.`)
  }
  const runConfiguration = normalizeBillingMigrationRunConfiguration(run.configuration, {
    targetMonth: runTargetMonth,
    cohort: run.cohort,
  })
  const configuredIds = runConfiguration.accountIds
  if (accountIds != null) {
    const requestedIds = normalizeBillingAccountIds(accountIds)
    const configured = new Set(configuredIds)
    const outsideScope = requestedIds.filter((id) => !configured.has(id))
    if (outsideScope.length > 0) {
      throw new Error(`Billing account IDs are outside migration run ${run.id ?? '(unknown)'} scope: ${outsideScope.join(', ')}.`)
    }
    if (requireExactAccountScope && comparableJson(requestedIds) !== comparableJson(configuredIds)) {
      throw new Error(`Billing migration run ${run.id ?? '(unknown)'} account scope does not match the requested contract.`)
    }
  }
  if (familyIds != null) {
    const requestedFamilyIds = normalizeOptionalIds(familyIds)
    const configuredFamilies = new Set(runConfiguration.familyIds)
    const outsideScope = requestedFamilyIds.filter((id) => !configuredFamilies.has(id))
    if (outsideScope.length > 0) {
      throw new Error(`Family IDs are outside migration run ${run.id ?? '(unknown)'} scope: ${outsideScope.join(', ')}.`)
    }
  }
  const mismatches = []
  if (codeVersion != null && String(run.code_version) !== String(codeVersion)) mismatches.push('release version')
  if (manifestChecksum != null && String(run.manifest_checksum) !== String(manifestChecksum).toLowerCase()) mismatches.push('manifest checksum')
  if (facilityId != null && runFacilityId !== positiveInteger(facilityId, 'Facility ID')) mismatches.push('facility')
  if (targetMonth != null && runTargetMonth !== billingDateString(targetMonth)) mismatches.push('target month')
  if (facilityTimezone != null && run.facility_timezone !== facilityTimezone) mismatches.push('facility timezone')
  if (cohort != null && run.cohort !== cohort) mismatches.push('cohort')
  if (configuration != null) {
    const expected = normalizeBillingMigrationRunConfiguration(configuration, {
      targetMonth: targetMonth ?? runTargetMonth,
      cohort: cohort ?? run.cohort,
    })
    if (comparableJson(runConfiguration) !== comparableJson(expected)) mismatches.push('configured account scope')
  }
  if (mismatches.length > 0) {
    throw new Error(`Billing migration run idempotency contract differs in: ${mismatches.join(', ')}.`)
  }
  return { ...run, configuration: runConfiguration }
}

export async function createBillingMigrationRun(db, {
  migrationKey = CANONICAL_BILLING_MIGRATION_KEY,
  idempotencyKey,
  mode = 'apply',
  codeVersion = null,
  manifestChecksum = null,
  requestedByUserId = null,
  requestedByType = 'system',
  facilityId = null,
  targetMonth = null,
  facilityTimezone = null,
  cohort = 'manual',
  configuration = {},
} = {}) {
  if (!idempotencyKey) throw new Error('A migration run idempotency key is required.')
  const normalizedMode = String(mode)
  const normalizedCodeVersion = codeVersion == null ? null : String(codeVersion).trim()
  const normalizedChecksum = manifestChecksum == null ? null : String(manifestChecksum).trim().toLowerCase()
  const normalizedFacilityId = facilityId == null ? null : positiveInteger(facilityId, 'Facility ID')
  const normalizedTargetMonth = billingDateString(targetMonth)
  const normalizedTimezone = facilityTimezone == null ? null : String(facilityTimezone)
  const normalizedCohort = String(cohort ?? '').trim()
  const normalizedConfiguration = normalizeBillingMigrationRunConfiguration(configuration, {
    targetMonth: normalizedTargetMonth,
    cohort: normalizedCohort,
  })
  if (BILLING_MIGRATION_APPLY_MODES.has(normalizedMode)) {
    if (!normalizedCodeVersion) throw new Error('An apply migration run requires a non-empty release version.')
    if (!SHA256_CHECKSUM.test(String(normalizedChecksum ?? ''))) {
      throw new Error('An apply migration run requires a 64-character SHA-256 deploy-manifest checksum.')
    }
    if (normalizedFacilityId == null) throw new Error('An apply migration run requires a facility ID.')
    if (!/^\d{4}-\d{2}-01$/.test(String(normalizedTargetMonth ?? ''))) {
      throw new Error('An apply migration run requires a first-of-month target date.')
    }
    if (!isValidTimeZone(normalizedTimezone)) throw new Error('An apply migration run requires a valid facility timezone.')
    if (!normalizedCohort) throw new Error('An apply migration run requires a cohort.')
  }
  const inserted = await db.query(
    `INSERT INTO billing_migration_run (
       migration_key, idempotency_key, mode, status, code_version, manifest_checksum,
       requested_by_user_id, requested_by_type, facility_id, target_month,
       facility_timezone, cohort, configuration, started_at
     ) VALUES ($1, $2, $3, 'running', $4, $5, $6, $7, $8, $9::date, $10, $11, $12::jsonb, now())
     ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
     RETURNING *`,
    [
      String(migrationKey),
      String(idempotencyKey),
      normalizedMode,
      normalizedCodeVersion,
      normalizedChecksum,
      requestedByUserId,
      requestedByType,
      normalizedFacilityId,
      normalizedTargetMonth,
      normalizedTimezone,
      normalizedCohort,
      json(normalizedConfiguration),
    ],
  )
  if (inserted.rows[0]) return inserted.rows[0]
  const existing = await db.query(
    `SELECT * FROM billing_migration_run WHERE idempotency_key = $1 LIMIT 1`,
    [String(idempotencyKey)],
  )
  if (!existing.rows[0]) throw new Error('Migration run idempotency conflict could not be resolved.')
  return assertBillingMigrationRunContract(existing.rows[0], {
    accountIds: normalizedConfiguration.accountIds,
    requireRunning: true,
    migrationKey,
    mode: normalizedMode,
    codeVersion: normalizedCodeVersion,
    manifestChecksum: normalizedChecksum,
    facilityId: normalizedFacilityId,
    targetMonth: normalizedTargetMonth,
    facilityTimezone: normalizedTimezone,
    cohort: normalizedCohort,
    configuration: normalizedConfiguration,
    requireExactAccountScope: true,
  })
}

export async function finishBillingMigrationRun(db, runId, {
  status,
  summary = {},
  errorMessage = null,
} = {}) {
  const id = positiveInteger(runId, 'Migration run ID')
  const terminalStatuses = new Set(['completed', 'completed_with_exceptions', 'failed', 'cancelled'])
  if (!terminalStatuses.has(status)) throw new Error('A valid terminal migration run status is required.')
  const result = await db.query(
    `UPDATE billing_migration_run
        SET status = $2, summary = $3::jsonb, error_message = $4,
            completed_at = CASE
              WHEN $2 IN ('completed', 'completed_with_exceptions', 'failed', 'cancelled') THEN now()
              ELSE NULL
            END,
            updated_at = now()
      WHERE id = $1 AND status = 'running'
      RETURNING *`,
    [id, status, json(summary), errorMessage == null ? null : String(errorMessage).slice(0, 2000)],
  )
  if (!result.rows[0]) {
    const existing = await getBillingMigrationRun(db, id)
    if (existing?.status === status) return existing
    throw new Error(`Billing migration run ${id} is missing, terminal, or changed concurrently.`)
  }
  return result.rows[0]
}

export async function getBillingMigrationRun(db, runId) {
  const result = await db.query(
    `SELECT * FROM billing_migration_run WHERE id = $1 LIMIT 1`,
    [positiveInteger(runId, 'Migration run ID')],
  )
  return result.rows[0] ?? null
}

export async function upsertBillingAccountMigration(db, {
  runId,
  accountId,
  state = 'discovered',
  payerValidationStatus = 'pending',
  parityStatus = 'pending',
  sourceCollectionMode = 'unknown',
  targetCollectionMode = 'household_monthly',
  cutoverMonth = null,
  paritySnapshot = {},
  stripeSnapshot = {},
  rollbackSnapshot = {},
  accountSnapshot = {},
  pricingSnapshot = {},
  ledgerSnapshot = {},
  initialStripeSnapshot = {},
  snapshotHash = null,
} = {}) {
  const normalizedRunId = positiveInteger(runId, 'Migration run ID')
  const normalizedAccountId = positiveInteger(accountId, 'Billing account ID')
  const normalizedCutoverMonth = billingDateString(cutoverMonth)
  if (snapshotHash != null) {
    const expectedHash = billingMigrationSnapshotHash({
      accountSnapshot,
      pricingSnapshot,
      ledgerSnapshot,
      initialStripeSnapshot,
      rollbackSnapshot,
    })
    if (String(snapshotHash) !== expectedHash) {
      throw new Error('Billing account migration snapshot hash does not match its frozen evidence.')
    }
  }
  const result = await db.query(
    `INSERT INTO billing_account_migration (
       billing_migration_run_id, family_billing_account_id, state,
       payer_validation_status, parity_status, source_collection_mode,
       target_collection_mode, cutover_month, parity_snapshot, stripe_snapshot,
       rollback_snapshot, account_snapshot, pricing_snapshot, ledger_snapshot,
       initial_stripe_snapshot, snapshot_hash
     ) SELECT
       $1, $2, $3, $4, $5, $6, $7, $8::date, $9::jsonb, $10::jsonb, $11::jsonb,
       $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16
       FROM billing_migration_run run
      WHERE run.id = $1
        AND run.status = 'running'
        AND run.mode = 'apply'
        AND run.migration_key = 'canonical-household-billing-v1'
        AND NULLIF(BTRIM(run.code_version), '') IS NOT NULL
        AND run.manifest_checksum ~ '^[0-9a-f]{64}$'
        AND run.target_month = $8::date
        AND COALESCE(run.configuration -> 'accountIds', '[]'::jsonb)
              @> to_jsonb(ARRAY[$2::bigint])
     ON CONFLICT (billing_migration_run_id, family_billing_account_id) DO UPDATE
       SET payer_validation_status = EXCLUDED.payer_validation_status,
           parity_status = EXCLUDED.parity_status,
           source_collection_mode = EXCLUDED.source_collection_mode,
           target_collection_mode = EXCLUDED.target_collection_mode,
           cutover_month = COALESCE(billing_account_migration.cutover_month, EXCLUDED.cutover_month),
           parity_snapshot = EXCLUDED.parity_snapshot,
           stripe_snapshot = EXCLUDED.stripe_snapshot,
           rollback_snapshot = CASE
             WHEN billing_account_migration.snapshot_hash IS NULL THEN EXCLUDED.rollback_snapshot
             ELSE billing_account_migration.rollback_snapshot
           END,
           account_snapshot = CASE
             WHEN billing_account_migration.snapshot_hash IS NULL THEN EXCLUDED.account_snapshot
             ELSE billing_account_migration.account_snapshot
           END,
           pricing_snapshot = CASE
             WHEN billing_account_migration.snapshot_hash IS NULL THEN EXCLUDED.pricing_snapshot
             ELSE billing_account_migration.pricing_snapshot
           END,
           ledger_snapshot = CASE
             WHEN billing_account_migration.snapshot_hash IS NULL THEN EXCLUDED.ledger_snapshot
             ELSE billing_account_migration.ledger_snapshot
           END,
           initial_stripe_snapshot = CASE
             WHEN billing_account_migration.snapshot_hash IS NULL THEN EXCLUDED.initial_stripe_snapshot
             ELSE billing_account_migration.initial_stripe_snapshot
           END,
           snapshot_hash = COALESCE(billing_account_migration.snapshot_hash, EXCLUDED.snapshot_hash),
           lock_version = billing_account_migration.lock_version + 1,
           updated_at = now()
     WHERE billing_account_migration.state IN ('discovered', 'repairing', 'blocked', 'shadow_verified')
       AND (
         billing_account_migration.cutover_month IS NULL
         OR billing_account_migration.cutover_month = EXCLUDED.cutover_month
       )
     RETURNING *`,
    [
      normalizedRunId,
      normalizedAccountId,
      state,
      payerValidationStatus,
      parityStatus,
      sourceCollectionMode,
      targetCollectionMode,
      normalizedCutoverMonth,
      json(paritySnapshot),
      json(stripeSnapshot),
      json(rollbackSnapshot),
      json(accountSnapshot),
      json(pricingSnapshot),
      json(ledgerSnapshot),
      json(initialStripeSnapshot),
      snapshotHash,
    ],
  )
  if (!result.rows[0]) {
    throw new Error(`Billing account ${normalizedAccountId} migration evidence is frozen or its run contract is not mutable.`)
  }
  return result.rows[0]
}

export async function getBillingAccountMigration(db, { runId, accountId, forUpdate = false } = {}) {
  const result = await db.query(
    `SELECT *
       FROM billing_account_migration
      WHERE billing_migration_run_id = $1 AND family_billing_account_id = $2
      LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [
      positiveInteger(runId, 'Migration run ID'),
      positiveInteger(accountId, 'Billing account ID'),
    ],
  )
  return result.rows[0] ?? null
}

/**
 * Accept a new post-repair audit baseline without mutating the immutable
 * discovery snapshot. The database trigger appends the corresponding history
 * row. This succeeds only while the explicitly scoped worker still owns the
 * lease and no blocking exception remains.
 */
export async function acceptBillingAccountMigrationBaseline(db, migration, {
  snapshotHash,
  accountSnapshot,
  pricingSnapshot,
  ledgerSnapshot,
  stripeSnapshot,
  rollbackSnapshot,
  leaseOwner,
} = {}) {
  if (!migration?.id || migration.lock_version == null) {
    throw new Error('A current account migration row is required to accept a billing baseline.')
  }
  if (!SHA256_CHECKSUM.test(String(snapshotHash ?? ''))) {
    throw new Error('An accepted billing baseline requires a SHA-256 snapshot hash.')
  }
  if (!leaseOwner) throw new Error('An accepted billing baseline requires the active lease owner.')
  const computedHash = billingMigrationSnapshotHash({
    accountSnapshot,
    pricingSnapshot,
    ledgerSnapshot,
    initialStripeSnapshot: stripeSnapshot,
    rollbackSnapshot,
  })
  if (computedHash !== String(snapshotHash)) {
    throw new Error('Accepted billing baseline snapshots do not match the supplied hash.')
  }
  if (String(migration.accepted_snapshot_hash ?? '') === String(snapshotHash)) {
    return { ...migration, baseline_changed: false }
  }
  const result = await db.query(
    `UPDATE billing_account_migration migration
        SET accepted_baseline_version = migration.accepted_baseline_version + 1,
            accepted_snapshot_hash = $3,
            accepted_account_snapshot = $4::jsonb,
            accepted_pricing_snapshot = $5::jsonb,
            accepted_ledger_snapshot = $6::jsonb,
            accepted_stripe_snapshot = $7::jsonb,
            accepted_rollback_snapshot = $8::jsonb,
            accepted_at = now(),
            lock_version = migration.lock_version + 1,
            updated_at = now()
       FROM billing_migration_run run
      WHERE migration.id = $1
        AND migration.lock_version = $2
        AND migration.state IN ('discovered', 'repairing', 'blocked', 'shadow_verified')
        AND migration.parity_status = 'matched'
        AND migration.lease_owner = $9
        AND migration.lease_expires_at > now()
        AND run.id = migration.billing_migration_run_id
        AND run.status = 'running'
        AND run.mode = 'apply'
        AND run.migration_key = 'canonical-household-billing-v1'
        AND NOT EXISTS (
          SELECT 1
            FROM billing_migration_exception exception
           WHERE exception.billing_account_migration_id = migration.id
             AND exception.status IN ('open', 'acknowledged', 'waived')
             AND exception.severity IN ('blocking', 'critical')
        )
      RETURNING migration.*, TRUE AS baseline_changed`,
    [
      positiveInteger(migration.id, 'Account migration ID'),
      Number(migration.lock_version),
      String(snapshotHash),
      json(accountSnapshot),
      json(pricingSnapshot),
      json(ledgerSnapshot),
      json(stripeSnapshot),
      json(rollbackSnapshot),
      String(leaseOwner),
    ],
  )
  if (!result.rows[0]) {
    throw new Error('Accepted billing baseline changed concurrently, has blocking exceptions, or its lease expired.')
  }
  return result.rows[0]
}

export async function claimBillingAccountMigration(db, {
  runId,
  accountId,
  leaseOwner,
  leaseSeconds = 300,
} = {}) {
  if (!leaseOwner) throw new Error('A non-empty lease owner is required.')
  const seconds = Math.max(30, Math.min(1800, Number(leaseSeconds) || 300))
  const result = await db.query(
    `UPDATE billing_account_migration migration
        SET lease_owner = $3,
            lease_expires_at = now() + ($4::text || ' seconds')::interval,
            attempt_count = migration.attempt_count + 1,
            lock_version = migration.lock_version + 1,
            updated_at = now()
       FROM billing_migration_run run
      WHERE migration.billing_migration_run_id = $1
        AND migration.family_billing_account_id = $2
        AND run.id = migration.billing_migration_run_id
        AND run.status = 'running'
        AND run.mode = 'apply'
        AND run.migration_key = 'canonical-household-billing-v1'
        AND NULLIF(BTRIM(run.code_version), '') IS NOT NULL
        AND run.manifest_checksum ~ '^[0-9a-f]{64}$'
        AND run.target_month = migration.cutover_month
        AND COALESCE(run.configuration -> 'accountIds', '[]'::jsonb)
              @> to_jsonb(ARRAY[migration.family_billing_account_id])
        AND migration.state NOT IN ('verified', 'rolled_back')
        AND (migration.lease_owner IS NULL OR migration.lease_expires_at <= now() OR migration.lease_owner = $3)
      RETURNING migration.*`,
    [
      positiveInteger(runId, 'Migration run ID'),
      positiveInteger(accountId, 'Billing account ID'),
      String(leaseOwner).slice(0, 200),
      String(seconds),
    ],
  )
  if (!result.rows[0]) {
    throw new Error(`Billing account ${accountId} could not be leased for migration.`)
  }
  return result.rows[0]
}

export async function renewBillingAccountMigrationLease(db, {
  migrationId,
  leaseOwner,
  leaseSeconds = 300,
} = {}) {
  const seconds = Math.max(30, Math.min(1800, Number(leaseSeconds) || 300))
  const result = await db.query(
    `UPDATE billing_account_migration migration
        SET lease_expires_at = now() + ($3::text || ' seconds')::interval,
            lock_version = migration.lock_version + 1,
            updated_at = now()
       FROM billing_migration_run run
      WHERE migration.id = $1
        AND migration.lease_owner = $2
        AND migration.lease_expires_at > now()
        AND run.id = migration.billing_migration_run_id
        AND run.status = 'running'
        AND run.mode = 'apply'
        AND run.migration_key = 'canonical-household-billing-v1'
        AND NULLIF(BTRIM(run.code_version), '') IS NOT NULL
        AND run.manifest_checksum ~ '^[0-9a-f]{64}$'
        AND run.target_month = migration.cutover_month
        AND COALESCE(run.configuration -> 'accountIds', '[]'::jsonb)
              @> to_jsonb(ARRAY[migration.family_billing_account_id])
      RETURNING migration.*`,
    [positiveInteger(migrationId, 'Account migration ID'), String(leaseOwner), String(seconds)],
  )
  if (!result.rows[0]) throw new Error('Billing migration lease was lost before it could be renewed.')
  return result.rows[0]
}

export async function releaseBillingAccountMigrationLease(db, { migrationId, leaseOwner } = {}) {
  const result = await db.query(
    `UPDATE billing_account_migration
        SET lease_owner = NULL, lease_expires_at = NULL,
            lock_version = lock_version + 1, updated_at = now()
      WHERE id = $1 AND lease_owner = $2
      RETURNING *`,
    [positiveInteger(migrationId, 'Account migration ID'), String(leaseOwner)],
  )
  return result.rows[0] ?? null
}

const STATE_TIMESTAMP_COLUMN = Object.freeze({
  armed: 'armed_at',
  cancellation_scheduled: 'cancellation_scheduled_at',
  detached: 'detached_at',
  remote_retired: 'remote_retired_at',
  household_active: 'household_activated_at',
  verified: 'verified_at',
  rollback_pending: 'rollback_started_at',
  rolled_back: 'rolled_back_at',
})

export async function transitionBillingAccountMigration(db, migration, toState, {
  leaseOwner = null,
  lastError = null,
  nextAttemptAt = null,
} = {}) {
  if (!migration?.id || !migration?.state || migration.lock_version == null) {
    throw new Error('A current account migration row is required for a CAS transition.')
  }
  assertBillingMigrationTransition(migration.state, toState)
  const timestampColumn = STATE_TIMESTAMP_COLUMN[toState]
  const timestampSql = timestampColumn ? `, ${timestampColumn} = COALESCE(migration.${timestampColumn}, now())` : ''
  const leaseSql = leaseOwner == null ? '' : ' AND lease_owner = $7 AND lease_expires_at > now()'
  const params = [
    Number(migration.id),
    Number(migration.lock_version),
    migration.state,
    toState,
    nextAttemptAt,
    lastError == null ? null : String(lastError).slice(0, 2000),
  ]
  if (leaseOwner != null) params.push(String(leaseOwner))
  const result = await db.query(
    `UPDATE billing_account_migration migration
        SET state = $4, next_attempt_at = $5, last_error = $6,
            lock_version = migration.lock_version + 1, updated_at = now()
            ${timestampSql}
       FROM billing_migration_run run
      WHERE migration.id = $1
        AND migration.lock_version = $2
        AND migration.state = $3${leaseSql.replaceAll('lease_owner', 'migration.lease_owner').replaceAll('lease_expires_at', 'migration.lease_expires_at')}
        AND run.id = migration.billing_migration_run_id
        AND run.status = 'running'
        AND run.mode = 'apply'
        AND run.migration_key = 'canonical-household-billing-v1'
        AND NULLIF(BTRIM(run.code_version), '') IS NOT NULL
        AND run.manifest_checksum ~ '^[0-9a-f]{64}$'
        AND run.target_month = migration.cutover_month
        AND COALESCE(run.configuration -> 'accountIds', '[]'::jsonb)
              @> to_jsonb(ARRAY[migration.family_billing_account_id])
      RETURNING migration.*`,
    params,
  )
  if (!result.rows[0]) throw new Error('Billing migration state changed concurrently or its lease expired.')
  return result.rows[0]
}

/**
 * Adopt an account whose recurring collectors were retired outside the normal
 * cutover saga. This deliberately does not widen the generic state graph: the
 * one exceptional shadow_verified -> household_active transition is available
 * only when a leased, immutable, parity-matched migration carries the complete
 * forward-adoption proof assembled by canonicalBillingMigration.js.
 */
export async function adoptBillingAccountMigrationHouseholdActive(db, migration, {
  leaseOwner,
  evidence,
} = {}) {
  if (!migration?.id || migration.lock_version == null || migration.state !== 'shadow_verified') {
    throw new Error('A current shadow-verified account migration row is required for forward adoption.')
  }
  if (!leaseOwner) throw new Error('Forward adoption requires the active migration lease owner.')
  const normalizedEvidence = sanitizeBillingMigrationSnapshot(evidence ?? {})
  for (const field of [
    'payerAccessVerified',
    'canonicalParityMatched',
    'canonicalBalanceVerified',
    'zeroActiveLocalRecurringCollectors',
    'zeroActiveRemoteRecurringCollectors',
    'householdActivationEvidenceVerified',
  ]) {
    if (normalizedEvidence[field] !== true) {
      throw new Error(`Forward adoption evidence is missing ${field}.`)
    }
  }
  if (!Array.isArray(normalizedEvidence.localCollectors) || normalizedEvidence.localCollectors.length !== 0) {
    throw new Error('Forward adoption evidence must contain an empty local collector inventory.')
  }
  if (
    normalizedEvidence.stripeCustomerId
    && (
      !normalizedEvidence.remoteSubscriptionInventory
      || Number(normalizedEvidence.remoteSubscriptionInventory.liveSubscriptionCount ?? -1) !== 0
      || (normalizedEvidence.remoteSubscriptionInventory.subscriptions ?? []).length !== 0
    )
  ) {
    throw new Error('Forward adoption evidence must contain an empty remote subscription inventory.')
  }
  if (
    Number(normalizedEvidence.remoteScheduleInventory?.liveScheduleCount ?? -1) !== 0
    || (normalizedEvidence.remoteScheduleInventory?.schedules ?? []).length !== 0
  ) {
    throw new Error('Forward adoption evidence must contain an empty remote schedule inventory.')
  }
  if (!SHA256_CHECKSUM.test(String(normalizedEvidence.verificationHash ?? ''))) {
    throw new Error('Forward adoption evidence requires a canonical verification hash.')
  }
  if (!SHA256_CHECKSUM.test(String(normalizedEvidence.activationEvidence?.evidenceHash ?? ''))) {
    throw new Error('Forward adoption evidence requires a durable activation-evidence hash.')
  }
  const evidenceHash = billingMigrationSnapshotHash(normalizedEvidence)
  const durableEvidence = { ...normalizedEvidence, evidenceHash }
  const result = await db.query(
    `UPDATE billing_account_migration migration
        SET state = 'household_active',
            parity_snapshot = jsonb_set(
              COALESCE(migration.parity_snapshot, '{}'::jsonb),
              '{forwardAdoption}',
              $5::jsonb,
              TRUE
            ),
            household_activated_at = COALESCE(migration.household_activated_at, now()),
            last_error = NULL,
            next_attempt_at = NULL,
            lock_version = migration.lock_version + 1,
            updated_at = now()
       FROM billing_migration_run run
      WHERE migration.id = $1
        AND migration.lock_version = $2
        AND migration.state = 'shadow_verified'
        AND migration.lease_owner = $3
        AND migration.lease_expires_at > now()
        AND migration.payer_validation_status = 'verified'
        AND migration.parity_status = 'matched'
        AND migration.target_collection_mode = 'household_monthly'
        AND migration.snapshot_hash ~ '^[0-9a-f]{64}$'
        AND migration.accepted_snapshot_hash ~ '^[0-9a-f]{64}$'
        AND migration.accepted_baseline_version > 0
        AND run.id = migration.billing_migration_run_id
        AND run.id = $4
        AND run.status = 'running'
        AND run.mode = 'apply'
        AND run.migration_key = 'canonical-household-billing-v1'
        AND NULLIF(BTRIM(run.code_version), '') IS NOT NULL
        AND run.manifest_checksum ~ '^[0-9a-f]{64}$'
        AND run.target_month = migration.cutover_month
        AND COALESCE(run.configuration -> 'accountIds', '[]'::jsonb)
              @> to_jsonb(ARRAY[migration.family_billing_account_id])
        AND EXISTS (
          SELECT 1
            FROM family_billing_account account
            JOIN family ON family.id = account.family_id
            JOIN member payer ON payer.id = account.payer_member_id
            JOIN family_member payer_access
              ON payer_access.family_id = account.family_id
             AND payer_access.member_id = payer.id
             AND payer_access.is_active = TRUE
           WHERE account.id = migration.family_billing_account_id
             AND account.is_active = TRUE
             AND account.household_monthly_billing_enabled = TRUE
             AND payer.is_active = TRUE
             AND payer.family_id = account.family_id
             AND family.facility_id = run.facility_id
             AND payer.facility_id = run.facility_id
             AND COALESCE(NULLIF(BTRIM(account.billing_email), ''), NULLIF(BTRIM(payer.email), ''))
                   ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'
        )
        AND NOT EXISTS (
          SELECT 1
            FROM billing_subscription subscription
           WHERE subscription.family_billing_account_id = migration.family_billing_account_id
             AND subscription.status IN ('active', 'paused')
             AND (
               NULLIF(BTRIM(subscription.stripe_subscription_id), '') IS NOT NULL
               OR NULLIF(BTRIM(subscription.stripe_subscription_item_id), '') IS NOT NULL
               OR NULLIF(BTRIM(subscription.stripe_subscription_schedule_id), '') IS NOT NULL
             )
        )
        AND NOT EXISTS (
          SELECT 1
            FROM billing_migration_exception exception
           WHERE exception.billing_account_migration_id = migration.id
             AND exception.status IN ('open', 'acknowledged', 'waived')
             AND exception.severity IN ('blocking', 'critical')
        )
      RETURNING migration.*`,
    [
      positiveInteger(migration.id, 'Account migration ID'),
      Number(migration.lock_version),
      String(leaseOwner),
      positiveInteger(migration.billing_migration_run_id, 'Migration run ID'),
      json(durableEvidence),
    ],
  )
  if (!result.rows[0]) {
    throw new Error('Forward adoption evidence changed concurrently, its lease expired, or a safety invariant failed.')
  }
  return result.rows[0]
}

export async function updateBillingAccountMigrationEvidence(db, migration, {
  payerValidationStatus = migration.payer_validation_status,
  parityStatus = migration.parity_status,
  paritySnapshot = migration.parity_snapshot ?? {},
  stripeSnapshot = migration.stripe_snapshot ?? {},
  lastError = migration.last_error ?? null,
  leaseOwner = null,
} = {}) {
  const leaseSql = leaseOwner == null ? '' : ' AND lease_owner = $9 AND lease_expires_at > now()'
  const params = [
    Number(migration.id),
    Number(migration.lock_version),
    payerValidationStatus,
    parityStatus,
    json(paritySnapshot),
    json(stripeSnapshot),
    lastError == null ? null : String(lastError).slice(0, 2000),
    migration.state,
  ]
  if (leaseOwner != null) params.push(String(leaseOwner))
  const result = await db.query(
    `UPDATE billing_account_migration migration
        SET payer_validation_status = $3, parity_status = $4,
            parity_snapshot = $5::jsonb, stripe_snapshot = $6::jsonb,
            last_error = $7,
            lock_version = migration.lock_version + 1, updated_at = now()
       FROM billing_migration_run run
      WHERE migration.id = $1
        AND migration.lock_version = $2
        AND migration.state = $8${leaseSql.replaceAll('lease_owner', 'migration.lease_owner').replaceAll('lease_expires_at', 'migration.lease_expires_at')}
        AND run.id = migration.billing_migration_run_id
        AND run.status = 'running'
        AND run.mode = 'apply'
        AND run.migration_key = 'canonical-household-billing-v1'
        AND NULLIF(BTRIM(run.code_version), '') IS NOT NULL
        AND run.manifest_checksum ~ '^[0-9a-f]{64}$'
        AND run.target_month = migration.cutover_month
        AND COALESCE(run.configuration -> 'accountIds', '[]'::jsonb)
              @> to_jsonb(ARRAY[migration.family_billing_account_id])
      RETURNING migration.*`,
    params,
  )
  if (!result.rows[0]) throw new Error('Billing migration evidence changed concurrently or its lease expired.')
  return result.rows[0]
}

export async function upsertBillingAccountMigrationItem(db, {
  accountMigrationId,
  itemType,
  sourceId,
  targetId = null,
  state = 'discovered',
  idempotencyKey = null,
  sourceSnapshot = {},
  targetSnapshot = {},
  billingSubscriptionId = null,
  signupId = null,
  memberId = null,
  formerStripeSubscriptionId = null,
  formerStripeItemId = null,
  formerStripeScheduleId = null,
  localStatus = null,
  localStartDate = null,
  localEndDate = null,
  localNextBillDate = null,
  localNetMonthlyCents = null,
  remoteStatus = null,
  remotePeriodStart = null,
  remotePeriodEnd = null,
  remoteAmountCents = null,
  remoteInvoiceStatus = null,
  remoteCancelAt = null,
} = {}) {
  const normalizedAccountMigrationId = positiveInteger(accountMigrationId, 'Account migration ID')
  const result = await db.query(
    `INSERT INTO billing_account_migration_item (
       billing_account_migration_id, item_type, source_id, target_id, state,
       idempotency_key, source_snapshot, target_snapshot,
       billing_subscription_id, signup_id, member_id,
       former_stripe_subscription_id, former_stripe_item_id, former_stripe_schedule_id,
       local_status, local_start_date, local_end_date, local_next_bill_date,
       local_net_monthly_cents, remote_status, remote_period_start, remote_period_end,
       remote_amount_cents, remote_invoice_status, remote_cancel_at
     ) SELECT
       $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb,
       $9, $10, $11, $12, $13, $14, $15, $16::date, $17::date, $18::date,
       $19, $20, $21::timestamptz, $22::timestamptz, $23, $24, $25::timestamptz
       FROM billing_account_migration migration
       JOIN billing_migration_run run ON run.id = migration.billing_migration_run_id
      WHERE migration.id = $1
        AND migration.state IN ('discovered', 'repairing', 'blocked', 'shadow_verified')
        AND run.status = 'running'
        AND run.mode = 'apply'
        AND run.migration_key = 'canonical-household-billing-v1'
        AND NULLIF(BTRIM(run.code_version), '') IS NOT NULL
        AND run.manifest_checksum ~ '^[0-9a-f]{64}$'
        AND run.target_month = migration.cutover_month
        AND COALESCE(run.configuration -> 'accountIds', '[]'::jsonb)
              @> to_jsonb(ARRAY[migration.family_billing_account_id])
     ON CONFLICT (billing_account_migration_id, item_type, source_id) DO UPDATE
       SET target_id = COALESCE(billing_account_migration_item.target_id, EXCLUDED.target_id),
           idempotency_key = COALESCE(billing_account_migration_item.idempotency_key, EXCLUDED.idempotency_key),
           source_snapshot = CASE
             WHEN billing_account_migration_item.source_snapshot = '{}'::jsonb
               THEN EXCLUDED.source_snapshot
             ELSE billing_account_migration_item.source_snapshot
           END,
           billing_subscription_id = COALESCE(billing_account_migration_item.billing_subscription_id, EXCLUDED.billing_subscription_id),
           signup_id = COALESCE(billing_account_migration_item.signup_id, EXCLUDED.signup_id),
           member_id = COALESCE(billing_account_migration_item.member_id, EXCLUDED.member_id),
           former_stripe_subscription_id = COALESCE(billing_account_migration_item.former_stripe_subscription_id, EXCLUDED.former_stripe_subscription_id),
           former_stripe_item_id = COALESCE(billing_account_migration_item.former_stripe_item_id, EXCLUDED.former_stripe_item_id),
           former_stripe_schedule_id = COALESCE(billing_account_migration_item.former_stripe_schedule_id, EXCLUDED.former_stripe_schedule_id),
           local_status = COALESCE(billing_account_migration_item.local_status, EXCLUDED.local_status),
           local_start_date = COALESCE(billing_account_migration_item.local_start_date, EXCLUDED.local_start_date),
           local_end_date = COALESCE(billing_account_migration_item.local_end_date, EXCLUDED.local_end_date),
           local_next_bill_date = COALESCE(billing_account_migration_item.local_next_bill_date, EXCLUDED.local_next_bill_date),
           local_net_monthly_cents = COALESCE(billing_account_migration_item.local_net_monthly_cents, EXCLUDED.local_net_monthly_cents),
           target_snapshot = CASE
             WHEN billing_account_migration_item.target_snapshot = '{}'::jsonb
               THEN EXCLUDED.target_snapshot
             ELSE billing_account_migration_item.target_snapshot
           END,
           remote_status = EXCLUDED.remote_status,
           remote_period_start = EXCLUDED.remote_period_start,
           remote_period_end = EXCLUDED.remote_period_end,
           remote_amount_cents = EXCLUDED.remote_amount_cents,
           remote_invoice_status = EXCLUDED.remote_invoice_status,
           remote_cancel_at = EXCLUDED.remote_cancel_at,
           lock_version = billing_account_migration_item.lock_version + 1,
           updated_at = now()
     WHERE billing_account_migration_item.target_id IS NULL
        OR EXCLUDED.target_id IS NULL
        OR billing_account_migration_item.target_id = EXCLUDED.target_id
     RETURNING *`,
    [
      normalizedAccountMigrationId,
      itemType,
      String(sourceId),
      targetId == null ? null : String(targetId),
      state,
      idempotencyKey == null ? null : String(idempotencyKey),
      json(sourceSnapshot),
      json(targetSnapshot),
      billingSubscriptionId,
      signupId,
      memberId,
      formerStripeSubscriptionId,
      formerStripeItemId,
      formerStripeScheduleId,
      localStatus,
      localStartDate,
      localEndDate,
      localNextBillDate,
      localNetMonthlyCents,
      remoteStatus,
      remotePeriodStart,
      remotePeriodEnd,
      remoteAmountCents,
      remoteInvoiceStatus,
      remoteCancelAt,
    ],
  )
  if (!result.rows[0]) {
    throw new Error(`Billing account migration item ${itemType}:${sourceId} is frozen or its run contract is not mutable.`)
  }
  return result.rows[0]
}

export async function listBillingAccountMigrationItems(db, accountMigrationId) {
  const result = await db.query(
    `SELECT * FROM billing_account_migration_item
      WHERE billing_account_migration_id = $1
      ORDER BY id`,
    [positiveInteger(accountMigrationId, 'Account migration ID')],
  )
  return result.rows
}

export async function updateBillingAccountMigrationItem(db, item, {
  state = item.state,
  targetId = item.target_id ?? null,
  targetSnapshot = item.target_snapshot ?? {},
  lastError = null,
} = {}) {
  const result = await db.query(
    `UPDATE billing_account_migration_item item
        SET state = $3, target_id = $4, target_snapshot = $5::jsonb,
            last_error = $6, attempt_count = item.attempt_count + 1,
            migrated_at = CASE WHEN $3 = 'migrated' THEN COALESCE(item.migrated_at, now()) ELSE item.migrated_at END,
            verified_at = CASE WHEN $3 = 'verified' THEN COALESCE(item.verified_at, now()) ELSE item.verified_at END,
            rolled_back_at = CASE WHEN $3 = 'rolled_back' THEN COALESCE(item.rolled_back_at, now()) ELSE item.rolled_back_at END,
            lock_version = item.lock_version + 1, updated_at = now()
       FROM billing_account_migration migration
       JOIN billing_migration_run run ON run.id = migration.billing_migration_run_id
      WHERE item.id = $1
        AND item.lock_version = $2
        AND migration.id = item.billing_account_migration_id
        AND run.status = 'running'
        AND run.mode = 'apply'
        AND run.migration_key = 'canonical-household-billing-v1'
        AND NULLIF(BTRIM(run.code_version), '') IS NOT NULL
        AND run.manifest_checksum ~ '^[0-9a-f]{64}$'
        AND run.target_month = migration.cutover_month
        AND COALESCE(run.configuration -> 'accountIds', '[]'::jsonb)
              @> to_jsonb(ARRAY[migration.family_billing_account_id])
      RETURNING item.*`,
    [
      positiveInteger(item.id, 'Migration item ID'),
      Number(item.lock_version),
      state,
      targetId,
      json(targetSnapshot),
      lastError == null ? null : String(lastError).slice(0, 2000),
    ],
  )
  if (!result.rows[0]) throw new Error('Billing migration item changed concurrently.')
  return result.rows[0]
}

export async function recordBillingMigrationException(db, {
  runId,
  accountMigrationId = null,
  dedupeKey,
  exceptionType,
  severity = 'blocking',
  message,
  details = {},
} = {}) {
  const result = await db.query(
    `INSERT INTO billing_migration_exception (
       billing_migration_run_id, billing_account_migration_id, dedupe_key,
       exception_type, severity, status, message, details
     ) VALUES ($1, $2, $3, $4, $5, 'open', $6, $7::jsonb)
     ON CONFLICT (billing_migration_run_id, dedupe_key) DO UPDATE
       SET billing_account_migration_id = CASE
             WHEN billing_migration_exception.status = 'waived'
              AND billing_migration_exception.severity NOT IN ('blocking', 'critical')
              AND EXCLUDED.severity NOT IN ('blocking', 'critical')
               THEN billing_migration_exception.billing_account_migration_id
             ELSE EXCLUDED.billing_account_migration_id
           END,
           exception_type = CASE
             WHEN billing_migration_exception.status = 'waived'
              AND billing_migration_exception.severity NOT IN ('blocking', 'critical')
              AND EXCLUDED.severity NOT IN ('blocking', 'critical')
               THEN billing_migration_exception.exception_type
             ELSE EXCLUDED.exception_type
           END,
           severity = CASE
             WHEN billing_migration_exception.status = 'waived'
              AND billing_migration_exception.severity NOT IN ('blocking', 'critical')
              AND EXCLUDED.severity NOT IN ('blocking', 'critical')
               THEN billing_migration_exception.severity
             ELSE EXCLUDED.severity
           END,
           status = CASE
             WHEN billing_migration_exception.status = 'waived'
              AND billing_migration_exception.severity NOT IN ('blocking', 'critical')
              AND EXCLUDED.severity NOT IN ('blocking', 'critical')
               THEN 'waived'
             ELSE 'open'
           END,
           message = CASE
             WHEN billing_migration_exception.status = 'waived'
              AND billing_migration_exception.severity NOT IN ('blocking', 'critical')
              AND EXCLUDED.severity NOT IN ('blocking', 'critical')
               THEN billing_migration_exception.message
             ELSE EXCLUDED.message
           END,
           details = CASE
             WHEN billing_migration_exception.status = 'waived'
              AND billing_migration_exception.severity NOT IN ('blocking', 'critical')
              AND EXCLUDED.severity NOT IN ('blocking', 'critical')
               THEN billing_migration_exception.details
             ELSE EXCLUDED.details
           END,
           resolution_note = CASE
             WHEN billing_migration_exception.status = 'waived'
              AND billing_migration_exception.severity NOT IN ('blocking', 'critical')
              AND EXCLUDED.severity NOT IN ('blocking', 'critical')
               THEN billing_migration_exception.resolution_note
             ELSE NULL
           END,
           resolved_by_user_id = CASE
             WHEN billing_migration_exception.status = 'waived'
              AND billing_migration_exception.severity NOT IN ('blocking', 'critical')
              AND EXCLUDED.severity NOT IN ('blocking', 'critical')
               THEN billing_migration_exception.resolved_by_user_id
             ELSE NULL
           END,
           resolved_at = CASE
             WHEN billing_migration_exception.status = 'waived'
              AND billing_migration_exception.severity NOT IN ('blocking', 'critical')
              AND EXCLUDED.severity NOT IN ('blocking', 'critical')
               THEN billing_migration_exception.resolved_at
             ELSE NULL
           END,
           detected_at = CASE
             WHEN billing_migration_exception.status = 'waived'
              AND billing_migration_exception.severity NOT IN ('blocking', 'critical')
              AND EXCLUDED.severity NOT IN ('blocking', 'critical')
               THEN billing_migration_exception.detected_at
             ELSE now()
           END,
           updated_at = now()
     RETURNING *`,
    [
      positiveInteger(runId, 'Migration run ID'),
      accountMigrationId == null ? null : positiveInteger(accountMigrationId, 'Account migration ID'),
      String(dedupeKey),
      String(exceptionType),
      severity,
      String(message),
      json(details),
    ],
  )
  return result.rows[0]
}

export async function resolveBillingMigrationException(db, {
  runId,
  dedupeKey,
  resolutionNote,
  resolvedByUserId = null,
} = {}) {
  if (!String(resolutionNote ?? '').trim()) throw new Error('An exception resolution note is required.')
  const result = await db.query(
    `UPDATE billing_migration_exception
        SET status = 'resolved', resolution_note = $3,
            resolved_by_user_id = $4, resolved_at = now(), updated_at = now()
      WHERE billing_migration_run_id = $1 AND dedupe_key = $2
        AND status NOT IN ('resolved', 'waived')
      RETURNING *`,
    [positiveInteger(runId, 'Migration run ID'), String(dedupeKey), String(resolutionNote), resolvedByUserId],
  )
  return result.rows[0] ?? null
}

export async function resolveClearedBillingMigrationExceptions(db, {
  runId,
  accountMigrationId,
  activeDedupeKeys = [],
  dedupePrefix = null,
  resolutionNote = 'Resolved by a subsequent deterministic migration audit.',
} = {}) {
  const result = await db.query(
    `UPDATE billing_migration_exception
        SET status = 'resolved', resolution_note = $4,
            resolved_at = now(), updated_at = now()
      WHERE billing_migration_run_id = $1
        AND billing_account_migration_id = $2
        AND (
          status IN ('open', 'acknowledged')
          OR (status = 'waived' AND severity IN ('blocking', 'critical'))
        )
        AND NOT (dedupe_key = ANY($3::text[]))
        AND ($5::text IS NULL OR dedupe_key LIKE $5 || '%')
      RETURNING *`,
    [
      positiveInteger(runId, 'Migration run ID'),
      positiveInteger(accountMigrationId, 'Account migration ID'),
      activeDedupeKeys.map(String),
      String(resolutionNote),
      dedupePrefix == null ? null : String(dedupePrefix),
    ],
  )
  return result.rows
}

export async function hasOpenBlockingMigrationExceptions(db, accountMigrationId) {
  const result = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM billing_migration_exception
        WHERE billing_account_migration_id = $1
          AND status IN ('open', 'acknowledged', 'waived')
          AND severity IN ('blocking', 'critical')
     ) AS blocked`,
    [positiveInteger(accountMigrationId, 'Account migration ID')],
  )
  return result.rows[0]?.blocked === true
}

/** Transaction-scoped account lock. Never invoke this around Stripe network calls. */
export async function withBillingAccountMigrationLock(pool, accountId, callback) {
  // node-postgres PoolClients inherit Client.connect(). Reconnecting one that
  // was passed through a surrounding session lock fails, so only a Pool (which
  // has no release method) owns a newly checked-out client here.
  const ownsClient = typeof pool.connect === 'function' && typeof pool.release !== 'function'
  const client = ownsClient ? await pool.connect() : pool
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [positiveInteger(accountId, 'Billing account ID')])
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    if (ownsClient && typeof client.release === 'function') client.release()
  }
}
