import os from 'node:os'
import crypto from 'node:crypto'
import { auditCanonicalBillingAccount } from './canonicalBillingMigrationAudit.js'
import {
  BILLING_MIGRATION_STATES as S,
  FORWARD_ONLY_STATES,
  PRE_CANCEL_ROLLBACK_STATES,
  billingDateString,
  billingCutoverTiming,
  billingMigrationSnapshotHash,
  isValidTimeZone,
  nextBillingMonth,
  normalizeBillingAccountIds,
  sanitizeBillingMigrationSnapshot,
  validateBillingTargetMonth,
  zonedDateStartUnix,
} from './canonicalBillingMigrationState.js'
import {
  CANONICAL_BILLING_MIGRATION_KEY,
  acceptBillingAccountMigrationBaseline,
  adoptBillingAccountMigrationHouseholdActive,
  assertBillingMigrationRunContract,
  claimBillingAccountMigration,
  createBillingMigrationRun,
  finishBillingMigrationRun,
  getBillingAccountMigration,
  getBillingMigrationRun,
  hasOpenBlockingMigrationExceptions,
  listBillingAccountMigrationItems,
  recordBillingMigrationException,
  releaseBillingAccountMigrationLease,
  renewBillingAccountMigrationLease,
  resolveClearedBillingMigrationExceptions,
  transitionBillingAccountMigration,
  updateBillingAccountMigrationEvidence,
  updateBillingAccountMigrationItem,
  upsertBillingAccountMigration,
  upsertBillingAccountMigrationItem,
  withBillingAccountMigrationLock,
} from './canonicalBillingMigrationRepository.js'
import {
  BillingMigrationSafetyError,
  clearStripeSubscriptionCutover,
  inspectStripeCustomerBillingMonthCollectors,
  inspectStripeCustomerSubscriptionInventory,
  inspectStripeCustomerSubscriptionScheduleInventory,
  inspectStripeHouseholdInvoice,
  listTargetMonthLegacyInvoices,
  retireStripeSubscription,
  retrieveStripeCustomerReadiness,
  retrieveStripeSubscriptionSnapshot,
  scheduleStripeSubscriptionForCutover,
  validateTargetMonthLegacyInvoices,
  voidUnpaidTargetMonthLegacyInvoice,
} from './canonicalBillingMigrationStripe.js'
import { reconcileEnrollmentLedger } from './enrollmentLedgerReconcile.js'
import { repairEnrollmentBillingCoverage } from './paymentAllocation.js'
import {
  repairFullyWaivedAnnualMembershipEntitlements,
  repairMembershipOwnershipAndAllocations,
} from './membershipPaymentRepair.js'
import { ensureLegacyEnrollmentAdjustmentRecords } from './enrollmentSubscriptionRepair.js'
import { resolveFamilyEnrollmentPricing } from './familyEnrollmentPricing.js'
import {
  createHouseholdMonthlyInvoice,
  withHouseholdMonthlyInvoiceAccountLock,
} from './householdMonthlyInvoice.js'
import { reconcileCanonicalRecurringChargesForMonth } from './canonicalRecurringChargePosting.js'
import { recordBillingActivity, recordBillingActivityBestEffort } from './billingActivity.js'
import { syncFamilyMemberLinks } from '../platform/familyMembers.js'
import { upsertSubscriptionForSource } from '../scheduling/billingSubscriptions.js'
import { canonicalActiveHouseholdMemberPredicate } from './householdMembership.js'
import { loadOrCreateUnassignedBillingAccount } from './billingAccountProvisioning.js'
import { billingClassSubscriptionCreationMode } from './billingFeatureFlags.js'
import { withLegacyClassSubscriptionCreationExclusiveLock } from './legacyClassSubscriptionCreationLock.js'
import { applyPendingPauseCredits } from '../scheduling/pauseEnrollmentBilling.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { loadCanonicalCollectibleBalanceCents } from './canonicalBillingAccount.js'
import {
  preparePaidStripeInvoiceRecord,
  upsertPaidStripeInvoicePayment,
} from './stripeWebhookLifecycle.js'

const MIGRATION_KEY = CANONICAL_BILLING_MIGRATION_KEY

function enabled(environment, name) {
  return String(environment?.[name] ?? '').toLowerCase() === 'true'
}

function requireFlag(environment, name, operation) {
  if (!enabled(environment, name)) {
    const error = new Error(`${operation} is disabled; set ${name}=true explicitly.`)
    error.code = 'feature_disabled'
    error.preserveMigrationState = true
    throw error
  }
}

function requireCanonicalReadShadow(environment, operation) {
  const mode = String(environment?.BILLING_CANONICAL_READ_MODE ?? 'off').toLowerCase()
  if (!['shadow', 'active'].includes(mode)) {
    throw new Error(`${operation} requires BILLING_CANONICAL_READ_MODE=shadow or active.`)
  }
}

function requireHouseholdOnlyClassSubscriptionCreation(environment, operation) {
  if (billingClassSubscriptionCreationMode(environment) !== 'household_only') {
    const error = new Error(
      `${operation} requires BILLING_CLASS_SUBSCRIPTION_CREATION_MODE=household_only `
      + 'before the first production account is armed.',
    )
    error.code = 'feature_disabled'
    error.preserveMigrationState = true
    throw error
  }
}

function legacyStripeSnapshotIsComplete(snapshot, subscriptions) {
  const customerId = snapshot?.customer?.customerId
  const expectedIds = new Set(
    subscriptions.map((subscription) => String(subscription?.id ?? '')).filter(Boolean),
  )
  const inventory = snapshot?.customerSubscriptionInventory?.subscriptions ?? []
  const inventoryIds = new Set(inventory
    .map((subscription) => String(subscription?.id ?? ''))
    .filter(Boolean))
  return Boolean(customerId)
    && snapshot?.customer?.hasDefaultPaymentMethod === true
    && subscriptions.length > 0
    && inventory.length === expectedIds.size
    && inventory.every((subscription) => (
      subscription?.classification !== 'annual_membership'
      && expectedIds.has(String(subscription?.id ?? ''))
    ))
    && subscriptions.every((subscription) => (
      Boolean(subscription?.id)
      && String(subscription.customerId ?? '') === String(customerId)
      && inventoryIds.has(String(subscription.id))
    ))
}

function legacyStripeCutoverEvidenceIsComplete(audit) {
  if (audit?.sourceCollectionMode !== 'legacy_per_class') return true
  const legacyItems = (audit?.items ?? []).filter((item) => item?.local?.stripeSubscriptionId)
  if (legacyItems.some((item) => !item?.remote)) return false
  return legacyStripeSnapshotIsComplete(
    audit?.initialStripeSnapshot,
    legacyItems.map((item) => item.remote),
  )
}

export function canonicalAuditCutoverGateFailures(audit) {
  const failures = []
  if (audit?.eligible !== true) failures.push('audit_not_eligible')
  if (!Array.isArray(audit?.exceptions) || audit.exceptions.some((issue) => (
    ['blocking', 'critical'].includes(String(issue?.severity ?? ''))
  ))) {
    failures.push('blocking_audit_exception')
  }
  if (audit?.parityStatus !== 'matched' || audit?.paritySnapshot?.matched !== true) {
    failures.push('parity_not_matched')
  }
  if (audit?.payerValidationStatus !== 'verified') failures.push('payer_not_verified')
  if ((audit?.initialStripeSnapshot?.customerSubscriptionInventory?.subscriptions ?? [])
    .some((subscription) => subscription?.classification === 'annual_membership')) {
    failures.push('active_annual_stripe_collector_present')
  }
  if (!legacyStripeCutoverEvidenceIsComplete(audit)) failures.push('stripe_evidence_not_verified')
  return failures
}

export function auditPassesCanonicalCutoverGates(audit) {
  return canonicalAuditCutoverGateFailures(audit).length === 0
}

export function storedMigrationPassesCanonicalCutoverGates(migration) {
  if (
    migration?.parity_status !== 'matched'
    || migration?.payer_validation_status !== 'verified'
  ) return false
  const snapshot = parseJson(
    migration?.accepted_stripe_snapshot ?? migration?.initial_stripe_snapshot,
  )
  if ((snapshot?.customerSubscriptionInventory?.subscriptions ?? [])
    .some((subscription) => subscription?.classification === 'annual_membership')) return false
  if (migration?.source_collection_mode !== 'legacy_per_class') return true
  return legacyStripeSnapshotIsComplete(snapshot, snapshot?.subscriptions ?? [])
}

export function assertFirstArmCreationBarrierAudit(beforeAudit, afterAudit) {
  if (afterAudit?.snapshotHash !== beforeAudit?.snapshotHash) {
    throw new BillingMigrationSafetyError(
      'first_arm_creation_barrier_drift',
      'Billing or Stripe state changed while first-arm waited for an in-flight class collector; re-audit before arming.',
      {
        beforeBarrierHash: beforeAudit?.snapshotHash ?? null,
        afterBarrierHash: afterAudit?.snapshotHash ?? null,
      },
    )
  }
  const gateFailures = canonicalAuditCutoverGateFailures(afterAudit)
  if (gateFailures.length > 0) {
    throw new BillingMigrationSafetyError(
      'first_arm_creation_barrier_blocked',
      'First-arm revalidation found blocking billing or Stripe inventory.',
      {
        gateFailures,
        exceptionCodes: (afterAudit?.exceptions ?? []).map((entry) => entry.code),
      },
    )
  }
  return afterAudit
}

/**
 * Freeze both collector-creation and account-level Stripe mutation while the
 * durable first-arm state is revalidated and written.
 *
 * Lock order is intentionally global creation barrier -> account collection
 * lock -> migration transaction lock (when the callback takes it). Legacy
 * creation paths use the global barrier as their outermost lock, while all
 * other collector mutations take only the account lock, so this order cannot
 * deadlock with an in-flight remote mutator.
 */
export function withCanonicalFirstArmCollectorFreeze(db, accountId, callback) {
  return withLegacyClassSubscriptionCreationExclusiveLock(db, (cutoffDb) => (
    withBillingAccountCollectionLock(cutoffDb, accountId, callback)
  ))
}

function workerName(value = null) {
  return String(value || `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`).slice(0, 200)
}

function normalizeOptionalIds(values) {
  if (values == null || (Array.isArray(values) && values.length === 0)) return []
  return normalizeBillingAccountIds(values)
}

function parseJson(value) {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return {}
    }
  }
  return value
}

function acceptedMigrationAccountSnapshot(migration) {
  const accepted = parseJson(migration?.accepted_account_snapshot)
  return Object.keys(accepted).length > 0 ? accepted : parseJson(migration?.account_snapshot)
}

function acceptedMigrationPricingSnapshot(migration) {
  const accepted = parseJson(migration?.accepted_pricing_snapshot)
  if (Object.keys(accepted).length > 0) return accepted
  const initial = parseJson(migration?.pricing_snapshot)
  return Object.keys(initial).length > 0 ? initial : parseJson(migration?.parity_snapshot)
}

function acceptedMigrationEvidence(migration, acceptedField, initialField) {
  const accepted = parseJson(migration?.[acceptedField])
  return Object.keys(accepted).length > 0 ? accepted : parseJson(migration?.[initialField])
}

function migrationInvariantPricingSnapshot(pricingSnapshot) {
  const normalized = sanitizeBillingMigrationSnapshot(parseJson(pricingSnapshot))
  if (normalized.boundary && typeof normalized.boundary === 'object') {
    // These are observations of when the audit ran, not frozen billing terms.
    // Keep only the immutable target and exact facility boundary.
    normalized.boundary = {
      targetMonth: normalized.boundary.targetMonth ?? normalized.targetMonth ?? null,
      boundaryUnix: normalized.boundary.boundaryUnix ?? null,
    }
  }
  return normalized
}

function normalizeMigrationOwnedStripeCancellation(stripeSnapshot, {
  boundaryUnix,
  acceptedStripeSnapshot = stripeSnapshot,
  acceptedBaseline = false,
} = {}) {
  const normalized = sanitizeBillingMigrationSnapshot(parseJson(stripeSnapshot))
  const accepted = sanitizeBillingMigrationSnapshot(parseJson(acceptedStripeSnapshot))
  const acceptedDirectById = new Map(
    (accepted.subscriptions ?? []).map((subscription) => [String(subscription.id), subscription]),
  )
  const migrationSubscriptionIds = new Set(acceptedDirectById.keys())
  const acceptedInventoryById = new Map(
    (accepted.customerSubscriptionInventory?.subscriptions ?? [])
      .map((subscription) => [String(subscription.id), subscription]),
  )

  const normalizeCollection = (rows, acceptedRowsById, { requireMigrationId = false } = {}) => (
    (rows ?? []).map((subscription) => {
      const copy = { ...subscription }
      const id = String(copy.id)
      const baseline = acceptedRowsById.get(id)
      const baselineIsUnscheduled = baseline != null &&
        baseline.cancelAt == null && baseline.cancelAtPeriodEnd !== true
      const belongsToMigration = !requireMigrationId || migrationSubscriptionIds.has(id)
      const currentIsExactMigrationSchedule =
        Number(copy.cancelAt) === Number(boundaryUnix)
      if (
        belongsToMigration && baselineIsUnscheduled &&
        (acceptedBaseline || currentIsExactMigrationSchedule)
      ) {
        delete copy.cancelAt
        delete copy.cancelAtPeriodEnd
      }
      return copy
    })
  )

  normalized.subscriptions = normalizeCollection(
    normalized.subscriptions,
    acceptedDirectById,
  )
  if (normalized.customerSubscriptionInventory?.subscriptions) {
    normalized.customerSubscriptionInventory = {
      ...normalized.customerSubscriptionInventory,
      subscriptions: normalizeCollection(
        normalized.customerSubscriptionInventory.subscriptions,
        acceptedInventoryById,
        { requireMigrationId: true },
      ),
    }
  }
  return normalized
}

/**
 * Prove that the final-day audit still represents the immutable accepted
 * account. The only normalized difference is the cancellation timestamp that
 * this migration itself scheduled at the exact facility-month boundary.
 */
export function assertBoundaryRevalidationInvariant({
  migration,
  audit,
  boundaryUnix,
} = {}) {
  const accepted = {
    accountSnapshot: acceptedMigrationEvidence(migration, 'accepted_account_snapshot', 'account_snapshot'),
    pricingSnapshot: acceptedMigrationEvidence(migration, 'accepted_pricing_snapshot', 'pricing_snapshot'),
    ledgerSnapshot: acceptedMigrationEvidence(migration, 'accepted_ledger_snapshot', 'ledger_snapshot'),
    initialStripeSnapshot: acceptedMigrationEvidence(migration, 'accepted_stripe_snapshot', 'initial_stripe_snapshot'),
    rollbackSnapshot: acceptedMigrationEvidence(migration, 'accepted_rollback_snapshot', 'rollback_snapshot'),
  }
  const acceptedSnapshotHash = String(
    migration?.accepted_snapshot_hash ?? migration?.snapshot_hash ?? '',
  )
  const acceptedEvidenceHash = billingMigrationSnapshotHash(accepted)
  if (!/^[0-9a-f]{64}$/.test(acceptedSnapshotHash) || acceptedEvidenceHash !== acceptedSnapshotHash) {
    const error = new BillingMigrationSafetyError(
      'boundary_revalidation_baseline_invalid',
      'The accepted billing migration baseline is missing or does not match its immutable evidence.',
      { acceptedSnapshotHash: acceptedSnapshotHash || null, acceptedEvidenceHash },
    )
    error.preserveMigrationState = true
    throw error
  }

  const acceptedProjection = {
    ...accepted,
    pricingSnapshot: migrationInvariantPricingSnapshot(accepted.pricingSnapshot),
    initialStripeSnapshot: normalizeMigrationOwnedStripeCancellation(
      accepted.initialStripeSnapshot,
      {
        boundaryUnix,
        acceptedStripeSnapshot: accepted.initialStripeSnapshot,
        acceptedBaseline: true,
      },
    ),
  }
  const currentProjection = {
    accountSnapshot: audit?.accountSnapshot ?? {},
    pricingSnapshot: migrationInvariantPricingSnapshot(audit?.pricingSnapshot ?? {}),
    ledgerSnapshot: audit?.ledgerSnapshot ?? {},
    initialStripeSnapshot: normalizeMigrationOwnedStripeCancellation(
      audit?.initialStripeSnapshot ?? audit?.stripeSnapshot ?? {},
      {
        boundaryUnix,
        acceptedStripeSnapshot: accepted.initialStripeSnapshot,
        acceptedBaseline: false,
      },
    ),
    rollbackSnapshot: audit?.rollbackSnapshot ?? {},
  }
  const acceptedInvariantHash = billingMigrationSnapshotHash(acceptedProjection)
  const currentInvariantHash = billingMigrationSnapshotHash(currentProjection)
  if (acceptedInvariantHash !== currentInvariantHash) {
    const error = new BillingMigrationSafetyError(
      'boundary_revalidation_snapshot_drift',
      'Billing, pricing, ledger, enrollment, or Stripe evidence changed after the accepted migration audit.',
      {
        accountId: migration?.family_billing_account_id ?? audit?.accountId ?? null,
        acceptedSnapshotHash,
        acceptedInvariantHash,
        currentInvariantHash,
      },
    )
    error.preserveMigrationState = true
    throw error
  }
  return { acceptedSnapshotHash, acceptedInvariantHash, currentInvariantHash }
}

function contractValue(value, kind = 'text') {
  if (value == null || value === '') return null
  if (kind === 'number') {
    const normalized = Number(value)
    return Number.isSafeInteger(normalized) ? normalized : null
  }
  return String(value)
}

export function assertBoundaryRevalidationContract({
  run,
  migration,
  audit,
  targetMonth,
} = {}) {
  const frozenAccount = acceptedMigrationAccountSnapshot(migration)
  const frozenParity = acceptedMigrationPricingSnapshot(migration)
  const currentAccount = audit?.accountSnapshot ?? audit?.account ?? {}
  const comparisons = [
    ['migration account', contractValue(migration?.family_billing_account_id, 'number'), contractValue(audit?.accountId, 'number')],
    ['account snapshot id', contractValue(frozenAccount.id, 'number'), contractValue(currentAccount.id, 'number')],
    ['family', contractValue(frozenAccount.familyId, 'number'), contractValue(currentAccount.familyId, 'number')],
    ['payer', contractValue(frozenAccount.payerMemberId, 'number'), contractValue(currentAccount.payerMemberId, 'number')],
    ['Stripe customer', contractValue(frozenAccount.stripeCustomerId), contractValue(currentAccount.stripeCustomerId)],
    ['run facility', contractValue(run?.facility_id, 'number'), contractValue(currentAccount.facilityId, 'number')],
    ['frozen facility', contractValue(frozenAccount.facilityId, 'number'), contractValue(currentAccount.facilityId, 'number')],
    ['run facility timezone', contractValue(run?.facility_timezone), contractValue(audit?.facilityTimezone)],
    ['frozen facility timezone', contractValue(frozenAccount.facilityTimezone), contractValue(audit?.facilityTimezone)],
    ['frozen boundary timezone', contractValue(frozenParity.timezone), contractValue(audit?.facilityTimezone)],
    ['run target month', billingDateString(run?.target_month), billingDateString(targetMonth)],
    ['frozen target month', billingDateString(frozenParity.targetMonth), billingDateString(targetMonth)],
    ['audit target month', billingDateString(audit?.targetMonth), billingDateString(targetMonth)],
  ]
  const mismatches = comparisons
    .filter(([, expected, actual]) => expected == null || actual == null || expected !== actual)
    .map(([field, expected, actual]) => ({ field, expected, actual }))
  if (mismatches.length === 0) return true

  const error = new BillingMigrationSafetyError(
    'boundary_revalidation_contract_drift',
    'Account, facility, timezone, or target-month identity changed after billing cutover was armed.',
    { accountId: migration?.family_billing_account_id ?? audit?.accountId ?? null, mismatches },
  )
  error.preserveMigrationState = true
  throw error
}

function unixIso(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? new Date(number * 1000).toISOString() : null
}

function collectionMigrationItems(items, { remoteOnly = false } = {}) {
  return (items ?? []).filter((item) => {
    if (item.item_type !== 'billing_subscription') return false
    const source = parseJson(item.source_snapshot)
    if (!source.local) return false
    if (!remoteOnly) return true
    return Boolean(item.former_stripe_subscription_id || source.local.stripeSubscriptionId)
  })
}

function runKey(targetMonth, accountIds, suffix = 'apply') {
  const hash = crypto.createHash('sha256').update(accountIds.join(',')).digest('hex').slice(0, 16)
  return `${MIGRATION_KEY}:${targetMonth}:${hash}:${suffix}`
}

function commandResult(command, apply, accounts, extra = {}) {
  return {
    command,
    mode: apply ? 'apply' : 'dry_run',
    accounts,
    ...extra,
  }
}

function billingAccountMissingException(familyId) {
  return {
    code: 'billing_account_missing',
    type: 'billing_account_missing',
    severity: 'blocking',
    repairable: true,
    message: 'Active family does not have a canonical billing account.',
    dedupeKey: 'billing_account_missing',
    details: { familyId: Number(familyId) },
  }
}

function familyUnavailableException(familyId) {
  return {
    code: 'active_family_not_found',
    type: 'active_family_not_found',
    severity: 'blocking',
    repairable: false,
    message: 'The explicitly scoped family is missing, archived, or has no active members.',
    dedupeKey: 'active_family_not_found',
    details: { familyId: Number(familyId) },
  }
}

function missingFamilyAuditResult(family, { unavailable = false } = {}) {
  const issue = unavailable
    ? familyUnavailableException(family.familyId)
    : billingAccountMissingException(family.familyId)
  return {
    familyId: Number(family.familyId),
    accountId: null,
    eligible: false,
    classification: unavailable ? 'blocked' : 'repairable',
    state: unavailable ? 'error' : 'missing',
    sourceCollectionMode: 'unknown',
    payerValidationStatus: 'not_applicable',
    parityStatus: 'not_applicable',
    snapshotHash: null,
    exceptions: [issue],
  }
}

/**
 * Inventory active families independently of family_billing_account so a
 * missing canonical container cannot disappear from an `audit --all` report.
 */
export async function inventoryCanonicalBillingFamilies(db, {
  familyIds = null,
} = {}) {
  const ids = familyIds == null ? null : normalizeOptionalIds(familyIds)
  if (familyIds != null && ids.length === 0) return []
  const result = await db.query(
    `SELECT family.id AS family_id, family.family_name, family.facility_id,
            facility.timezone AS facility_timezone,
            account.id AS account_id, account.is_active AS account_is_active,
            account.payer_member_id
       FROM family
       LEFT JOIN facility ON facility.id = family.facility_id
       LEFT JOIN family_billing_account account ON account.family_id = family.id
      WHERE COALESCE(family.archived, FALSE) = FALSE
        AND ($1::bigint[] IS NULL OR family.id = ANY($1::bigint[]))
        AND EXISTS (
          SELECT 1
            FROM member
           WHERE ${canonicalActiveHouseholdMemberPredicate({
             memberAlias: 'member',
             familyIdReference: 'family.id',
             membershipAlias: 'inventory_membership',
             historyAlias: 'inventory_membership_history',
           })}
        )
      ORDER BY family.id`,
    [ids],
  )
  return result.rows.map((row) => ({
    familyId: Number(row.family_id),
    familyName: row.family_name ?? null,
    facilityId: row.facility_id == null ? null : Number(row.facility_id),
    facilityTimezone: row.facility_timezone ?? null,
    accountId: row.account_id == null ? null : Number(row.account_id),
    accountActive: row.account_is_active === true,
    payerMemberId: row.payer_member_id == null ? null : Number(row.payer_member_id),
  }))
}

function cohortStopAfterFailure(accountIds, accountIndex, {
  accountId,
  code = 'migration_operation_failed',
  error,
}) {
  return {
    failedAccountId: Number(accountId),
    code,
    error,
    unprocessedAccountIds: accountIds.slice(accountIndex + 1),
  }
}

function validateFamilyProvisioningInventory(inventory, familyIds, {
  targetMonth,
  now,
} = {}) {
  const found = new Set(inventory.map((family) => family.familyId))
  const unavailable = familyIds.filter((familyId) => !found.has(familyId))
  if (unavailable.length > 0) {
    throw new Error(`Explicit family IDs are not active migration candidates: ${unavailable.join(', ')}.`)
  }
  const inactive = inventory.filter((family) => family.accountId != null && family.accountActive !== true)
  if (inactive.length > 0) {
    throw new Error(`Inactive billing accounts require administrator review and cannot be reactivated automatically: ${inactive.map((family) => family.familyId).join(', ')}.`)
  }
  const assigned = inventory.filter((family) => family.accountId != null && family.payerMemberId != null)
  if (assigned.length > 0) {
    throw new Error(`Families already assigned to a payer must use account-scoped audit/repair: ${assigned.map((family) => family.familyId).join(', ')}.`)
  }
  const missingFacilityScope = inventory.filter((family) => (
    !Number.isSafeInteger(family.facilityId)
    || family.facilityId <= 0
    || !isValidTimeZone(family.facilityTimezone)
  ))
  if (missingFacilityScope.length > 0) {
    throw new Error(`Every family account provisioning candidate requires a positive facility ID and valid timezone: ${missingFacilityScope.map((family) => family.familyId).join(', ')}.`)
  }
  const facilityIds = [...new Set(inventory.map((family) => family.facilityId))]
  const timezones = [...new Set(inventory.map((family) => family.facilityTimezone))]
  if (facilityIds.length !== 1 || timezones.length !== 1) {
    throw new Error('Family account provisioning must contain active families from exactly one facility and timezone.')
  }
  validateBillingTargetMonth(targetMonth, { timeZone: timezones[0], now })
  return { facilityId: facilityIds[0], facilityTimezone: timezones[0] }
}

function familyProvisioningAccountResult(family, accountId = family.accountId, provisioned = false) {
  return {
    familyId: family.familyId,
    accountId: accountId == null ? null : Number(accountId),
    eligible: false,
    classification: accountId == null ? 'repairable' : 'blocked',
    state: provisioned ? 'blocked' : (accountId == null ? 'missing' : 'blocked'),
    provisioned,
    payerValidationStatus: accountId == null ? 'not_applicable' : 'invalid',
    parityStatus: accountId == null ? 'not_applicable' : 'pending',
    exceptions: accountId == null
      ? [billingAccountMissingException(family.familyId)]
      : [{
          code: 'payer_missing',
          type: 'payer_missing',
          severity: 'blocking',
          repairable: false,
          message: 'Billing account does not have a valid payer member.',
          dedupeKey: 'payer_missing',
          details: { familyId: family.familyId, accountId: Number(accountId) },
        }],
  }
}

/**
 * Narrow, local-only bootstrap used by `repair --family-ids=... --apply`.
 * It creates payerless account containers and their immutable run scope in one
 * transaction. All financial, enrollment, and Stripe repair remains on the
 * ordinary explicit --run/--account-ids path.
 */
export async function repairMissingCanonicalBillingAccounts(db, {
  familyIds,
  targetMonth,
  now = new Date(),
  apply = false,
  idempotencyKey = null,
  codeVersion = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
  manifestChecksum = process.env.BILLING_MIGRATION_MANIFEST_CHECKSUM || null,
  requestedByUserId = null,
  requestedByType = 'system',
  cohort = 'family-account-bootstrap',
  environment = process.env,
} = {}) {
  const ids = normalizeOptionalIds(familyIds)
  if (ids.length === 0) throw new Error('At least one explicit family ID is required for account provisioning.')
  const month = billingDateString(targetMonth)
  if (!/^\d{4}-\d{2}-01$/.test(String(month ?? ''))) {
    throw new Error('Family account provisioning requires a target month on the first day of the month.')
  }
  if (apply) {
    requireCanonicalReadShadow(environment, 'Family billing-account provisioning')
    requireFlag(environment, 'BILLING_ENROLLMENT_AUTO_REPAIR_ENABLED', 'Family billing-account provisioning')
  }

  if (!apply) {
    const inventory = await inventoryCanonicalBillingFamilies(db, { familyIds: ids })
    validateFamilyProvisioningInventory(inventory, ids, { targetMonth: month, now })
    return commandResult('repair', false, inventory.map((family) => (
      familyProvisioningAccountResult(family)
    )), {
      operation: 'family_account_provisioning',
      runId: null,
      targetMonth: month,
    })
  }

  const ownsClient = typeof db.connect === 'function' && typeof db.release !== 'function'
  const client = ownsClient ? await db.connect() : db
  let transactionStarted = false
  try {
    await client.query('BEGIN')
    transactionStarted = true
    for (const familyId of ids) {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))`,
        [`canonical-billing-family:${familyId}`],
      )
    }
    const inventory = await inventoryCanonicalBillingFamilies(client, { familyIds: ids })
    const facility = validateFamilyProvisioningInventory(inventory, ids, { targetMonth: month, now })
    const bound = []
    for (const family of inventory) {
      let account = family.accountId == null
        ? await loadOrCreateUnassignedBillingAccount(client, family.familyId)
        : {
            id: family.accountId,
            family_id: family.familyId,
            payer_member_id: family.payerMemberId,
            is_active: family.accountActive,
          }
      if (!account?.id || account.is_active === false) {
        throw new Error(`Family ${family.familyId} could not be provisioned with an active canonical billing account.`)
      }
      const provisioned = family.accountId == null
      if (account.payer_member_id != null) {
        throw new Error(`Family ${family.familyId} billing account gained a payer concurrently; re-audit before repair.`)
      }
      if (provisioned && (
        account.billing_email != null
        || account.billing_phone != null
        || account.billing_street != null
        || account.billing_city != null
        || account.billing_state != null
        || account.billing_zip != null
        || account.stripe_customer_id != null
        || account.household_monthly_billing_enabled === true
      )) {
        throw new Error(`Family ${family.familyId} account provisioning attempted to infer billing identity or enable collection.`)
      }
      bound.push({ family, accountId: Number(account.id), provisioned })
    }
    const accountIds = normalizeBillingAccountIds(bound.map((item) => item.accountId))
    const run = await createBillingMigrationRun(client, {
      migrationKey: MIGRATION_KEY,
      idempotencyKey: idempotencyKey || runKey(month, accountIds, 'family-account-bootstrap'),
      mode: 'apply',
      codeVersion,
      manifestChecksum,
      requestedByUserId,
      requestedByType,
      facilityId: facility.facilityId,
      targetMonth: month,
      facilityTimezone: facility.facilityTimezone,
      cohort,
      configuration: {
        accountIds,
        familyIds: ids,
        targetMonth: month,
        cohort,
        operation: 'family_account_provisioning',
      },
    })
    const competing = await client.query(
      `SELECT family_billing_account_id, billing_migration_run_id
         FROM billing_account_migration
        WHERE family_billing_account_id = ANY($1::bigint[])
          AND billing_migration_run_id <> $2
          AND state NOT IN ('verified', 'rolled_back')
        ORDER BY family_billing_account_id
        LIMIT 1`,
      [accountIds, Number(run.id)],
    )
    if (competing.rows[0]) {
      throw new Error(`Billing account ${competing.rows[0].family_billing_account_id} already belongs to active migration run ${competing.rows[0].billing_migration_run_id}.`)
    }

    const accounts = []
    for (const item of bound) {
      let migration = await upsertBillingAccountMigration(client, {
        runId: run.id,
        accountId: item.accountId,
        state: S.DISCOVERED,
        payerValidationStatus: 'invalid',
        parityStatus: 'pending',
        sourceCollectionMode: 'unknown',
        targetCollectionMode: 'household_monthly',
        cutoverMonth: month,
        accountSnapshot: {
          id: item.accountId,
          familyId: item.family.familyId,
          facilityId: item.family.facilityId,
          facilityTimezone: item.family.facilityTimezone,
          payerMemberId: null,
          bootstrap: 'family_account_provisioning',
        },
      })
      if (migration.state === S.DISCOVERED) {
        await recordBillingMigrationException(client, {
          runId: run.id,
          accountMigrationId: migration.id,
          dedupeKey: accountExceptionKey(item.accountId, { code: 'payer_missing' }),
          exceptionType: 'payer_missing',
          severity: 'blocking',
          message: 'Billing account does not have a valid payer member.',
          details: {
            familyId: item.family.familyId,
            accountId: item.accountId,
            provisioned: item.provisioned,
          },
        })
        migration = await transitionBillingAccountMigration(client, migration, S.BLOCKED, {
          lastError: 'A payer must be assigned through the admin billing-account editor before migration can continue.',
        })
      } else if (migration.state !== S.BLOCKED) {
        throw new Error(`Family provisioning run ${run.id} account ${item.accountId} is unexpectedly in ${migration.state}.`)
      }
      accounts.push(familyProvisioningAccountResult(item.family, item.accountId, item.provisioned))
    }
    await client.query('COMMIT')
    transactionStarted = false
    return commandResult('repair', true, accounts, {
      operation: 'family_account_provisioning',
      runId: Number(run.id),
      targetMonth: month,
    })
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    if (ownsClient && typeof client.release === 'function') client.release()
  }
}

function accountExceptionKey(accountId, exception) {
  return `account:${accountId}:audit:${exception.dedupeKey ?? exception.code}`
}

async function recordAuditExceptions(db, runId, migrationId, audit) {
  const keys = []
  for (const issue of audit.exceptions) {
    const dedupeKey = accountExceptionKey(audit.accountId, issue)
    keys.push(dedupeKey)
    await recordBillingMigrationException(db, {
      runId,
      accountMigrationId: migrationId,
      dedupeKey,
      exceptionType: issue.type ?? issue.code,
      severity: issue.severity,
      message: issue.message,
      details: issue.details,
    })
  }
  await resolveClearedBillingMigrationExceptions(db, {
    runId,
    accountMigrationId: migrationId,
    activeDedupeKeys: keys,
    dedupePrefix: `account:${audit.accountId}:audit:`,
  })
}

async function persistAudit(db, {
  runId,
  audit,
  leaseOwner = null,
  transition = true,
} = {}) {
  const auditGateFailures = canonicalAuditCutoverGateFailures(audit)
  let migration = await getBillingAccountMigration(db, { runId, accountId: audit.accountId })
  const mutableEvidenceStates = new Set([S.DISCOVERED, S.REPAIRING, S.BLOCKED, S.SHADOW_VERIFIED])
  const canUpsertFrozenEvidence = !migration || mutableEvidenceStates.has(migration.state)
  // source_collection_mode is part of the immutable discovery evidence. A
  // repair or explicit forward adoption may legitimately observe a newer
  // current mode, but must record that in an accepted baseline instead of
  // rewriting how the account was first discovered.
  const persistedSourceCollectionMode = migration?.snapshot_hash
    ? migration.source_collection_mode
    : audit.sourceCollectionMode
  if (canUpsertFrozenEvidence) {
    migration = await upsertBillingAccountMigration(db, {
      runId,
      accountId: audit.accountId,
      state: S.DISCOVERED,
      payerValidationStatus: audit.payerValidationStatus,
      parityStatus: audit.parityStatus,
      sourceCollectionMode: persistedSourceCollectionMode,
      targetCollectionMode: audit.targetCollectionMode,
      cutoverMonth: audit.targetMonth,
      paritySnapshot: audit.paritySnapshot,
      stripeSnapshot: audit.stripeSnapshot,
      rollbackSnapshot: audit.rollbackSnapshot,
      accountSnapshot: audit.accountSnapshot,
      pricingSnapshot: audit.pricingSnapshot,
      ledgerSnapshot: audit.ledgerSnapshot,
      initialStripeSnapshot: audit.initialStripeSnapshot,
      snapshotHash: auditGateFailures.length === 0 ? audit.snapshotHash : null,
    })
    for (const item of audit.items) {
      const stripeId = item.local.stripeSubscriptionId
      await upsertBillingAccountMigrationItem(db, {
        accountMigrationId: migration.id,
        itemType: 'billing_subscription',
        sourceId: String(item.local.id),
        targetId: String(item.local.id),
        state: stripeId ? 'discovered' : 'verified',
        idempotencyKey: `billing-cutover:${audit.accountId}:${audit.targetMonth}:subscription:${item.local.id}`,
        sourceSnapshot: { local: item.local, remote: item.remote },
        targetSnapshot: {},
        billingSubscriptionId: item.local.id,
        signupId: /^\d+$/.test(String(item.local.sourceId ?? '')) ? Number(item.local.sourceId) : null,
        memberId: item.local.memberId,
        formerStripeSubscriptionId: item.local.stripeSubscriptionId,
        formerStripeItemId: item.local.stripeSubscriptionItemId,
        formerStripeScheduleId: item.local.stripeSubscriptionScheduleId,
        localStatus: item.local.status,
        localStartDate: item.local.startDate,
        localEndDate: item.local.endDate,
        localNextBillDate: item.local.nextBillDate,
        localNetMonthlyCents: item.local.netMonthlyCents,
        remoteStatus: item.remote?.status ?? null,
        remotePeriodStart: unixIso(item.remote?.currentPeriodStart),
        remotePeriodEnd: unixIso(item.remote?.currentPeriodEnd),
        remoteAmountCents: (item.remote?.items ?? []).reduce(
          (sum, remoteItem) => sum + cents(remoteItem.unitAmount) * Math.max(1, Number(remoteItem.quantity) || 1),
          0,
        ),
        remoteInvoiceStatus: item.remote?.latestInvoice?.status ?? null,
        remoteCancelAt: unixIso(item.remote?.cancelAt),
      })
    }
    for (const artifact of audit.artifacts ?? []) {
      await upsertBillingAccountMigrationItem(db, {
        accountMigrationId: migration.id,
        itemType: artifact.itemType,
        sourceId: artifact.sourceId,
        targetId: artifact.targetId,
        state: artifact.state,
        idempotencyKey: `billing-cutover:${audit.accountId}:${audit.targetMonth}:${artifact.itemType}:${artifact.sourceId}`,
        sourceSnapshot: artifact.sourceSnapshot,
        targetSnapshot: artifact.targetSnapshot,
        memberId: artifact.sourceSnapshot.member_id ?? null,
        billingSubscriptionId: artifact.itemType === 'annual_membership'
          ? Number(artifact.sourceId)
          : null,
        localStatus: artifact.itemType === 'annual_membership'
          ? artifact.sourceSnapshot.status ?? null
          : null,
        localStartDate: artifact.itemType === 'annual_membership'
          ? artifact.sourceSnapshot.start_date ?? null
          : null,
        localEndDate: artifact.itemType === 'annual_membership'
          ? artifact.sourceSnapshot.end_date ?? null
          : null,
        localNextBillDate: artifact.itemType === 'annual_membership'
          ? artifact.sourceSnapshot.next_bill_date ?? null
          : null,
        localNetMonthlyCents: artifact.itemType === 'annual_membership'
          ? artifact.sourceSnapshot.net_monthly_cents ?? null
          : null,
        formerStripeSubscriptionId: artifact.itemType === 'annual_membership'
          ? artifact.sourceSnapshot.stripe_subscription_id ?? null
          : null,
      })
    }
  }
  await recordAuditExceptions(db, runId, migration.id, audit)
  const blockingExceptionsOpen = await hasOpenBlockingMigrationExceptions(db, migration.id)
  const effectiveEligible = auditGateFailures.length === 0 && !blockingExceptionsOpen
  if (canUpsertFrozenEvidence && effectiveEligible && !migration.snapshot_hash) {
    migration = await upsertBillingAccountMigration(db, {
      runId,
      accountId: audit.accountId,
      state: migration.state,
      payerValidationStatus: audit.payerValidationStatus,
      parityStatus: audit.parityStatus,
      sourceCollectionMode: persistedSourceCollectionMode,
      targetCollectionMode: audit.targetCollectionMode,
      cutoverMonth: audit.targetMonth,
      paritySnapshot: audit.paritySnapshot,
      stripeSnapshot: audit.stripeSnapshot,
      rollbackSnapshot: audit.rollbackSnapshot,
      accountSnapshot: audit.accountSnapshot,
      pricingSnapshot: audit.pricingSnapshot,
      ledgerSnapshot: audit.ledgerSnapshot,
      initialStripeSnapshot: audit.initialStripeSnapshot,
      snapshotHash: audit.snapshotHash,
    })
  }
  migration = await getBillingAccountMigration(db, { runId, accountId: audit.accountId })
  migration = await updateBillingAccountMigrationEvidence(db, migration, {
    payerValidationStatus: audit.payerValidationStatus,
    parityStatus: audit.parityStatus,
    paritySnapshot: audit.paritySnapshot,
    stripeSnapshot: audit.stripeSnapshot,
    lastError: effectiveEligible
      ? null
      : `${auditGateFailures.join(', ') || 'blocking_migration_exception'}; migration remains ineligible.`,
    leaseOwner,
  })
  if (!transition) return migration
  if (migration.state === S.DISCOVERED) {
    migration = await transitionBillingAccountMigration(
      db,
      migration,
      effectiveEligible ? S.SHADOW_VERIFIED : S.BLOCKED,
      { leaseOwner },
    )
  } else if (migration.state === S.REPAIRING) {
    migration = await transitionBillingAccountMigration(
      db,
      migration,
      effectiveEligible ? S.SHADOW_VERIFIED : S.BLOCKED,
      { leaseOwner },
    )
  } else if (!effectiveEligible && migration.state === S.SHADOW_VERIFIED) {
    migration = await transitionBillingAccountMigration(db, migration, S.BLOCKED, { leaseOwner })
  }
  return migration
}

async function requireRunAndScope(db, runId, accountIds, {
  requireExactAccountScope = false,
} = {}) {
  const run = await getBillingMigrationRun(db, runId)
  if (!run) throw new Error(`Billing migration run ${runId} was not found.`)
  const ids = normalizeBillingAccountIds(accountIds)
  const validatedRun = assertBillingMigrationRunContract(run, {
    accountIds: ids,
    requireRunning: true,
    requireExactAccountScope,
  })
  const scoped = await db.query(
    `SELECT family_billing_account_id, cutover_month
       FROM billing_account_migration
      WHERE billing_migration_run_id = $1
        AND family_billing_account_id = ANY($2::bigint[])
      ORDER BY family_billing_account_id`,
    [Number(runId), ids],
  )
  const found = new Map(scoped.rows.map((row) => [Number(row.family_billing_account_id), row]))
  const missing = ids.filter((id) => !found.has(id))
  if (missing.length > 0) {
    throw new Error(`Billing accounts are not initialized in migration run ${runId}: ${missing.join(', ')}.`)
  }
  const targetMonth = billingDateString(validatedRun.target_month)
  const mismatched = ids.filter((id) => billingDateString(found.get(id)?.cutover_month) !== targetMonth)
  if (mismatched.length > 0) {
    throw new Error(`Billing accounts have a cutover month outside migration run ${runId}: ${mismatched.join(', ')}.`)
  }
  return { run: validatedRun, accountIds: ids }
}

function assertForwardAdoptionRunAuthorization(run) {
  if (run?.configuration?.forwardAdoption !== true) {
    throw new BillingMigrationSafetyError(
      'forward_adoption_run_not_authorized',
      `Billing migration run ${run?.id ?? '(unknown)'} was not created by the explicit forward-adoption audit bootstrap.`,
      { runId: run?.id == null ? null : Number(run.id) },
    )
  }
  return run
}

async function recordOperationFailure(db, {
  runId,
  accountId,
  migration,
  error,
  leaseOwner = null,
} = {}) {
  let current = await getBillingAccountMigration(db, { runId, accountId })
  if (!current) return null
  await recordBillingMigrationException(db, {
    runId,
    accountMigrationId: current.id,
    dedupeKey: `account:${accountId}:operation:${error.code ?? 'failed'}:${current.state}`,
    exceptionType: error.code ?? 'migration_operation_failed',
    severity: error.forwardOnly || FORWARD_ONLY_STATES.has(current.state) ? 'critical' : 'blocking',
    message: error.message ?? String(error),
    details: error.details ?? {},
  })
  if (error.preserveMigrationState === true) return current
  if (!error.forwardOnly && [
    S.ARMED,
    S.CANCELLATION_SCHEDULED,
    S.DETACHED,
    S.ROLLBACK_PENDING,
  ].includes(current.state)) {
    // These states may own live Stripe scheduling. Keep the explicit rollback
    // route visible instead of disguising the account as an ordinary blocker.
    return current
  }
  const toState = error.forwardOnly || FORWARD_ONLY_STATES.has(current.state)
    ? S.FAILED_FORWARD_ONLY
    : S.BLOCKED
  try {
    if (current.state !== toState) {
      current = await transitionBillingAccountMigration(db, current, toState, {
        leaseOwner,
        lastError: error.message ?? String(error),
      })
    }
  } catch (transitionError) {
    // Preserve the original operational error; a concurrent worker owns the newer state.
    if (!/concurrently|cannot transition|lease expired/.test(String(transitionError?.message ?? ''))) throw transitionError
  }
  return current
}

export async function auditCanonicalBillingMigration(db, {
  accountIds,
  includeAllActiveFamilies = false,
  targetMonth,
  stripe = null,
  now = new Date(),
  apply = false,
  runId = null,
  idempotencyKey = null,
  codeVersion = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
  manifestChecksum = process.env.BILLING_MIGRATION_MANIFEST_CHECKSUM || null,
  requestedByUserId = null,
  requestedByType = 'system',
  cohort = 'manual',
  forwardAdoption = false,
  environment = process.env,
} = {}) {
  const explicitIds = normalizeOptionalIds(accountIds)
  if (!includeAllActiveFamilies && explicitIds.length === 0) {
    throw new Error('At least one explicit billing account ID is required unless all active families are being audited read-only.')
  }
  if (apply && includeAllActiveFamilies) {
    throw new Error('Persisting an all-family audit is forbidden; rerun with explicit billing account IDs.')
  }
  const familyInventory = includeAllActiveFamilies
    ? await inventoryCanonicalBillingFamilies(db)
    : []
  const inventoryAccountIds = familyInventory
    .map((family) => family.accountId)
    .filter((accountId) => accountId != null)
  const ids = [...new Set([...explicitIds, ...inventoryAccountIds])].sort((a, b) => a - b)
  if (apply) requireCanonicalReadShadow(environment, 'Migration audit persistence')
  let run = null
  if (apply && runId != null) {
    run = assertBillingMigrationRunContract(await getBillingMigrationRun(db, runId), {
      accountIds: ids,
      requireRunning: true,
      codeVersion,
      manifestChecksum,
    })
    if (!run) throw new Error(`Billing migration run ${runId} was not found.`)
    if (forwardAdoption === true) assertForwardAdoptionRunAuthorization(run)
  }
  const audits = []
  for (const accountId of ids) {
    audits.push(await auditCanonicalBillingAccount(db, {
      accountId,
      targetMonth,
      stripe,
      now,
      runFacilityId: run?.facility_id ?? null,
    }))
  }
  if (apply) {
    const validAccounts = audits.filter((audit) => audit.account)
    if (validAccounts.length !== ids.length) {
      throw new Error('Every explicitly scoped billing account must exist before an audit can be persisted.')
    }
    const facilityIds = [...new Set(validAccounts.map((audit) => Number(audit.account.facilityId)).filter(Number.isFinite))]
    const timezones = [...new Set(validAccounts.map((audit) => audit.facilityTimezone).filter(Boolean))]
    if (facilityIds.length !== 1 || timezones.length !== 1) {
      throw new Error('A persisted migration run must contain accounts from exactly one facility and timezone.')
    }
    if (run == null) {
      run = await createBillingMigrationRun(db, {
        migrationKey: MIGRATION_KEY,
        idempotencyKey: idempotencyKey || runKey(targetMonth, ids),
        mode: 'apply',
        codeVersion,
        manifestChecksum,
        requestedByUserId,
        requestedByType,
        facilityId: facilityIds[0],
        targetMonth,
        facilityTimezone: timezones[0],
        cohort,
        configuration: {
          accountIds: ids,
          targetMonth,
          cohort,
          forwardAdoption: forwardAdoption === true,
        },
      })
    }
    if (!run) throw new Error(`Billing migration run ${runId} was not found.`)
  }
  const accounts = []
  for (const audit of audits) {
    const accountId = audit.accountId
    let migration = null
    if (apply && audit.account) {
      migration = await persistAudit(db, { runId: run.id, audit })
    }
    accounts.push({
      familyId: audit.familyId ?? null,
      accountId,
      eligible: audit.eligible,
      classification: audit.classification,
      state: migration?.state ?? null,
      sourceCollectionMode: audit.sourceCollectionMode,
      payerValidationStatus: audit.payerValidationStatus,
      parityStatus: audit.parityStatus,
      snapshotHash: audit.snapshotHash,
      exceptions: audit.exceptions,
    })
  }
  const missingFamilies = familyInventory.filter((family) => family.accountId == null)
  accounts.push(...missingFamilies.map((family) => missingFamilyAuditResult(family)))
  if (includeAllActiveFamilies) {
    accounts.sort((left, right) => (
      Number(left.familyId ?? Number.MAX_SAFE_INTEGER) - Number(right.familyId ?? Number.MAX_SAFE_INTEGER)
    ))
  }
  return commandResult('audit', apply, accounts, {
    runId: run?.id == null ? null : Number(run.id),
    targetMonth,
    inventory: includeAllActiveFamilies
      ? {
          activeFamilyCount: familyInventory.length,
          billingAccountCount: inventoryAccountIds.length,
          missingBillingAccountCount: missingFamilies.length,
        }
      : null,
  })
}

export async function repairCanonicalBillingMigration(db, {
  runId = null,
  accountIds,
  targetMonth,
  stripe = null,
  now = new Date(),
  apply = false,
  leaseOwner = null,
  environment = process.env,
} = {}) {
  const ids = normalizeBillingAccountIds(accountIds)
  if (apply && runId == null) throw new Error('--apply repair requires an existing migration run ID.')
  if (apply) requireFlag(environment, 'BILLING_ENROLLMENT_AUTO_REPAIR_ENABLED', 'Canonical billing repair')
  const scopedRun = apply ? (await requireRunAndScope(db, runId, ids)).run : null
  const owner = workerName(leaseOwner)
  const accounts = []
  let cohortStop = null
  for (let accountIndex = 0; accountIndex < ids.length; accountIndex += 1) {
    const accountId = ids[accountIndex]
    let migration = null
    try {
      if (apply) {
        migration = await claimBillingAccountMigration(db, { runId, accountId, leaseOwner: owner })
        if (![S.DISCOVERED, S.BLOCKED, S.REPAIRING].includes(migration.state)) {
          throw new Error(`Account ${accountId} cannot be repaired from ${migration.state}.`)
        }
        if (migration.state !== S.REPAIRING) {
          migration = await transitionBillingAccountMigration(db, migration, S.REPAIRING, { leaseOwner: owner })
        }
      }
      const familyMemberLinks = await repairProvableFamilyMemberLinks(db, { accountId, apply })
      const fullyWaivedMemberships = await repairFullyWaivedAnnualMembershipEntitlements(db, {
        accountId,
        apply,
      })
      const localSubscriptions = await repairCanonicalLocalEnrollmentSubscriptions(db, {
        accountId, targetMonth, now, apply,
      })
      const legacyAdjustments = await repairProvableLegacyEnrollmentAdjustments(db, { accountId, apply })
      const coverage = await repairEnrollmentBillingCoverage(db, { accountId, apply, actorType: 'system' })
      const membership = await repairMembershipOwnershipAndAllocations(db, stripe, {
        apply,
        accountIds: [accountId],
      })
      const bundles = await repairBundleEntitlementBalances(db, { accountId, apply })
      let enrollmentLedger = { repaired: false }
      if (apply) {
        const account = await db.query(
          `SELECT id, family_id FROM family_billing_account WHERE id = $1 LIMIT 1`,
          [accountId],
        ).then((result) => result.rows[0] ?? null)
        if (!account) throw new Error(`Billing account ${accountId} was not found.`)
        enrollmentLedger = await reconcileEnrollmentLedger(db, account)
      }
      const audit = await auditCanonicalBillingAccount(db, {
        accountId,
        targetMonth,
        stripe,
        now,
        runFacilityId: scopedRun?.facility_id ?? null,
      })
      if (apply) {
        migration = await persistAudit(db, { runId, audit, leaseOwner: owner })
        if (audit.eligible && audit.parityStatus === 'matched') {
          migration = await acceptBillingAccountMigrationBaseline(db, migration, {
            snapshotHash: audit.snapshotHash,
            accountSnapshot: audit.accountSnapshot,
            pricingSnapshot: audit.pricingSnapshot,
            ledgerSnapshot: audit.ledgerSnapshot,
            stripeSnapshot: audit.initialStripeSnapshot,
            rollbackSnapshot: audit.rollbackSnapshot,
            leaseOwner: owner,
          })
        }
      }
      const result = {
        accountId,
        state: migration?.state ?? null,
        eligible: audit.eligible,
        classification: audit.classification,
        familyMemberLinks,
        localSubscriptions,
        legacyAdjustments,
        bundles,
        coverage: {
          candidates: coverage.candidates?.length ?? 0,
          updatedCharges: coverage.updatedCharges?.length ?? 0,
          advancedSubscriptions: coverage.advancedSubscriptions?.length ?? 0,
        },
        membership: {
          repaired: membership.repaired?.length ?? 0,
          ambiguous: membership.ambiguous?.length ?? 0,
          failed: membership.failed?.length ?? 0,
          allocations: membership.allocations?.length ?? 0,
          fullyWaived: {
            scanned: fullyWaivedMemberships.scanned ?? 0,
            repaired: fullyWaivedMemberships.repaired ?? fullyWaivedMemberships.planned ?? 0,
            schedulesRepaired: fullyWaivedMemberships.schedulesRepaired ?? 0,
            correct: fullyWaivedMemberships.correct ?? 0,
            blocked: fullyWaivedMemberships.blocked?.length ?? 0,
          },
        },
        enrollmentLedger,
        exceptions: audit.exceptions,
      }
      accounts.push(result)
      if (apply && !audit.eligible) {
        cohortStop = cohortStopAfterFailure(ids, accountIndex, {
          accountId,
          code: 'migration_repair_incomplete',
          error: 'Deterministic repair left blocking exceptions; review and re-audit before continuing the cohort.',
        })
        break
      }
    } catch (error) {
      if (apply && migration) {
        await recordOperationFailure(db, { runId, accountId, migration, error, leaseOwner: owner })
      }
      accounts.push({ accountId, state: 'error', error: error.message, code: error.code ?? null })
      if (apply) {
        cohortStop = cohortStopAfterFailure(ids, accountIndex, {
          accountId,
          code: error.code ?? 'migration_repair_failed',
          error: error.message,
        })
        break
      }
    } finally {
      if (apply && migration?.id) {
        await releaseBillingAccountMigrationLease(db, { migrationId: migration.id, leaseOwner: owner }).catch(() => {})
      }
    }
  }
  return commandResult('repair', apply, accounts, {
    runId: runId == null ? null : Number(runId),
    targetMonth,
    cohortStopped: cohortStop != null,
    cohortStop,
  })
}

const WAIVED_MEMBERSHIP_REPAIR_STATES = new Set([S.DISCOVERED, S.BLOCKED, S.REPAIRING])
const WAIVED_MEMBERSHIP_REVIEWED_UNRELATED_AUDIT_CODES = new Set([
  'manual_collection_requires_review',
  'target_household_invoice_already_paid',
])

export function assertWaivedMembershipRepairState(accountId, state) {
  if (!WAIVED_MEMBERSHIP_REPAIR_STATES.has(state)) {
    const error = new Error(`Account ${accountId} cannot repair waived annual memberships from ${state}.`)
    error.code = 'waived_membership_repair_state_invalid'
    throw error
  }
  return state
}

function blockingAuditIssues(audit) {
  return (audit?.exceptions ?? []).filter((issue) => (
    ['blocking', 'critical'].includes(String(issue?.severity ?? ''))
  ))
}

/**
 * A narrow entitlement repair may leave an account blocked for an already-paid
 * target invoice or for reviewed manual collection. Those rollout blockers are
 * persisted and reported, but they must not prevent later explicitly scoped
 * accounts from receiving the same deterministic repair. Every other blocking
 * audit issue, and every locked-parity mismatch, remains fail-closed.
 */
export function waivedMembershipRepairAuditGate(audit) {
  const failures = []
  const membershipDimension = audit?.paritySnapshot?.dimensions
    ?.membershipsAndPaidThroughOwnership
  if (membershipDimension?.matched !== true) {
    failures.push('membership_ownership_parity_not_matched')
  }
  if (audit?.parityStatus !== 'matched' || audit?.paritySnapshot?.matched !== true) {
    failures.push('canonical_structural_parity_not_matched')
  }
  const blocking = blockingAuditIssues(audit)
  const reviewedUnrelatedBlockers = blocking.filter((issue) => (
    WAIVED_MEMBERSHIP_REVIEWED_UNRELATED_AUDIT_CODES.has(String(issue?.code ?? ''))
  ))
  const unexplainedBlockers = blocking.filter((issue) => (
    !WAIVED_MEMBERSHIP_REVIEWED_UNRELATED_AUDIT_CODES.has(String(issue?.code ?? ''))
  ))
  if (unexplainedBlockers.length > 0) failures.push('unexplained_blocking_audit_exception')
  return {
    passed: failures.length === 0,
    failures,
    reviewedUnrelatedBlockers,
    unexplainedBlockers,
  }
}

export function waivedMembershipRepairNeedsCohortStop({ fullyWaived, audit } = {}) {
  return (fullyWaived?.blocked?.length ?? 0) > 0
    || waivedMembershipRepairAuditGate(audit).passed !== true
}

/**
 * Narrow canonical migration repair for deterministic fully waived annual
 * membership entitlements. This command intentionally invokes no enrollment,
 * allocation, reconciliation, family-link, adjustment, or bundle repair path.
 */
export async function repairWaivedAnnualMembershipsCanonicalMigration(db, {
  runId = null,
  accountIds,
  targetMonth = null,
  stripe = null,
  now = new Date(),
  apply = false,
  leaseOwner = null,
  environment = process.env,
} = {}) {
  const ids = normalizeBillingAccountIds(accountIds)
  if (apply && runId == null) {
    throw new Error('--apply waived-membership repair requires an existing migration run ID.')
  }
  if (apply) {
    requireFlag(
      environment,
      'BILLING_ENROLLMENT_AUTO_REPAIR_ENABLED',
      'Fully waived annual membership repair',
    )
  }
  const scoped = apply
    ? await requireRunAndScope(db, runId, ids, { requireExactAccountScope: true })
    : null
  // Apply always derives its month from immutable run provenance. A caller's
  // targetMonth is used only by the read-only command.
  const month = billingDateString(apply ? scoped.run.target_month : targetMonth)
  if (!/^\d{4}-\d{2}-01$/.test(String(month ?? ''))) {
    throw new Error('Waived annual membership repair requires a target month on the first day of the month.')
  }

  const owner = workerName(leaseOwner)
  const accounts = []
  let cohortStop = null
  for (let accountIndex = 0; accountIndex < ids.length; accountIndex += 1) {
    const accountId = ids[accountIndex]
    let migration = null
    try {
      if (apply) {
        migration = await claimBillingAccountMigration(db, { runId, accountId, leaseOwner: owner })
        assertWaivedMembershipRepairState(accountId, migration.state)
        if (migration.state !== S.REPAIRING) {
          migration = await transitionBillingAccountMigration(db, migration, S.REPAIRING, {
            leaseOwner: owner,
          })
        }
      }

      const fullyWaived = await repairFullyWaivedAnnualMembershipEntitlements(db, {
        accountId,
        apply,
      })
      if (apply && (fullyWaived.blocked?.length ?? 0) > 0) {
        const error = new Error('The fully waived annual membership repair returned unresolved blockers.')
        error.code = 'fully_waived_annual_membership_repair_blocked'
        error.details = { blockers: fullyWaived.blocked }
        throw error
      }

      const audit = await auditCanonicalBillingAccount(db, {
        accountId,
        targetMonth: month,
        stripe,
        now,
        runFacilityId: scoped?.run.facility_id ?? null,
      })
      const repairGate = waivedMembershipRepairAuditGate(audit)
      if (apply) {
        migration = await persistAudit(db, { runId, audit, leaseOwner: owner })
        if (audit.eligible && audit.parityStatus === 'matched') {
          migration = await acceptBillingAccountMigrationBaseline(db, migration, {
            snapshotHash: audit.snapshotHash,
            accountSnapshot: audit.accountSnapshot,
            pricingSnapshot: audit.pricingSnapshot,
            ledgerSnapshot: audit.ledgerSnapshot,
            stripeSnapshot: audit.initialStripeSnapshot,
            rollbackSnapshot: audit.rollbackSnapshot,
            leaseOwner: owner,
          })
        }
      }

      accounts.push({
        accountId,
        state: migration?.state ?? null,
        eligible: audit.eligible,
        classification: audit.classification,
        payerValidationStatus: audit.payerValidationStatus,
        parityStatus: audit.parityStatus,
        fullyWaived,
        repairGate,
        exceptions: audit.exceptions,
      })
      const unresolved = waivedMembershipRepairNeedsCohortStop({ fullyWaived, audit })
      if (apply && unresolved) {
        cohortStop = cohortStopAfterFailure(ids, accountIndex, {
          accountId,
          code: 'waived_membership_repair_incomplete',
          error: 'Waived annual membership repair left unresolved canonical or Stripe parity blockers.',
        })
        break
      }
    } catch (error) {
      if (apply && migration) {
        await recordOperationFailure(db, { runId, accountId, migration, error, leaseOwner: owner })
      }
      accounts.push({
        accountId,
        state: 'error',
        error: error.message,
        code: error.code ?? null,
        details: error.details ?? null,
      })
      if (apply) {
        cohortStop = cohortStopAfterFailure(ids, accountIndex, {
          accountId,
          code: error.code ?? 'waived_membership_repair_failed',
          error: error.message,
        })
        break
      }
    } finally {
      if (apply && migration?.id) {
        await releaseBillingAccountMigrationLease(db, {
          migrationId: migration.id,
          leaseOwner: owner,
        }).catch(() => {})
      }
    }
  }
  return commandResult('repair-waived-memberships', apply, accounts, {
    runId: runId == null ? null : Number(runId),
    targetMonth: month,
    cohortStopped: cohortStop != null,
    cohortStop,
  })
}

/**
 * Normalize only membership links backed by an active legacy member.family_id
 * relationship. This deliberately never selects or changes the account payer;
 * an unprovable payer remains a blocking audit exception for manual review.
 */
export async function repairProvableFamilyMemberLinks(db, {
  accountId,
  apply = false,
} = {}) {
  const result = await db.query(
    `SELECT account.family_id, account.payer_member_id,
            member.id AS member_id,
            membership.is_active AS membership_is_active
       FROM family_billing_account account
       LEFT JOIN member
         ON member.family_id = account.family_id
        AND member.is_active = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM family_member member_history
           WHERE member_history.member_id = member.id
        )
       LEFT JOIN family_member membership
         ON membership.family_id = account.family_id
        AND membership.member_id = member.id
      WHERE account.id = $1
      ORDER BY member.id`,
    [Number(accountId)],
  )
  if (result.rows.length === 0) throw new Error(`Billing account ${accountId} was not found.`)
  const familyId = Number(result.rows[0].family_id)
  const payerMemberId = result.rows[0].payer_member_id == null
    ? null
    : Number(result.rows[0].payer_member_id)
  const candidateMemberIds = result.rows
    .filter((row) => row.member_id != null && row.membership_is_active !== true)
    .map((row) => Number(row.member_id))

  if (apply && candidateMemberIds.length > 0) {
    await syncFamilyMemberLinks(db, familyId)
  }
  return {
    familyId,
    candidateMemberIds,
    normalizedMemberIds: apply ? candidateMemberIds : [],
    payerLinkCandidate: payerMemberId != null && candidateMemberIds.includes(payerMemberId),
    payerChanged: false,
  }
}

export function buildCanonicalLocalEnrollmentRepairPlans(candidates, pricing, targetMonth) {
  const linesBySignup = new Map()
  for (const line of pricing?.lines ?? []) {
    const signupId = Number(line.signupId)
    if (!Number.isFinite(signupId)) continue
    const list = linesBySignup.get(signupId) ?? []
    list.push(line)
    linesBySignup.set(signupId, list)
  }
  const planned = []
  const skipped = []
  for (const candidate of candidates ?? []) {
    const signupId = Number(candidate.signup_id)
    if (candidate.slot_group_id == null) {
      skipped.push({ signupId, reason: 'class_link_ambiguous' })
      continue
    }
    const lines = linesBySignup.get(signupId) ?? []
    if (lines.length !== 1) {
      skipped.push({ signupId, reason: lines.length === 0 ? 'pricing_unresolved' : 'pricing_ambiguous' })
      continue
    }
    const line = lines[0]
    const grossCents = cents(line.grossCents)
    const discountCents = cents(line.discountCents)
    const netCents = cents(line.netCents)
    if (grossCents <= 0 || discountCents < 0 || netCents < 0 || grossCents - discountCents !== netCents) {
      skipped.push({ signupId, reason: 'pricing_invalid' })
      continue
    }
    planned.push({
      signupId,
      memberId: Number(candidate.member_id),
      description: candidate.form_title || 'Class enrollment',
      enrollmentStartDate: billingDateString(candidate.enrollment_start_date),
      pricingOptionKey: candidate.pricing_option_key ?? null,
      grossCents,
      discountCents,
      netCents,
      nextBillDate: billingDateString(targetMonth),
    })
  }
  return { planned, skipped }
}

export async function repairCanonicalLocalEnrollmentSubscriptions(db, {
  accountId,
  targetMonth,
  now = new Date(),
  apply = false,
} = {}) {
  const month = billingDateString(targetMonth)
  if (!/^\d{4}-\d{2}-01$/.test(String(month ?? ''))) {
    throw new Error('Canonical local subscription repair requires a target month on the first day of the month.')
  }
  const account = await db.query(
    `SELECT id, family_id FROM family_billing_account WHERE id = $1 LIMIT 1`,
    [Number(accountId)],
  ).then((result) => result.rows[0] ?? null)
  if (!account) throw new Error(`Billing account ${accountId} was not found.`)
  const candidates = await db.query(
    `WITH account_members AS (
       SELECT DISTINCT member.id AS member_id
         FROM member
        WHERE ${canonicalActiveHouseholdMemberPredicate({
          memberAlias: 'member',
          familyIdReference: '$1',
          membershipAlias: 'repair_membership',
          historyAlias: 'repair_membership_history',
        })}
     )
     SELECT signup.id AS signup_id, signup.member_id, signup.enrollment_start_date,
            signup.pricing_option_key, signup.slot_group_id, form.title AS form_title
       FROM scheduling_signup signup
       JOIN account_members ON account_members.member_id = signup.member_id
       JOIN scheduling_form form ON form.id = signup.form_id
       LEFT JOIN scheduling_slot_group slot_group ON slot_group.id = signup.slot_group_id
       LEFT JOIN scheduling_offering offering ON offering.id = slot_group.offering_id
      WHERE signup.status = 'confirmed'
        AND signup.orphaned_at IS NULL
        AND form.deleted_at IS NULL
        AND signup.enrollment_start_date IS NOT NULL
        AND (signup.cancel_effective_date IS NULL OR signup.cancel_effective_date > $2::date)
        AND (
          COALESCE(offering.end_date, slot_group.active_end, form.end_date) IS NULL
          OR COALESCE(offering.end_date, slot_group.active_end, form.end_date) >= $2::date
        )
        AND COALESCE(
          NULLIF(signup.pricing_breakdown ->> 'billingType', ''),
          NULLIF(signup.pricing_breakdown ->> 'billing_type', ''),
          NULLIF(signup.pricing_breakdown -> 'line' ->> 'billingType', ''),
          NULLIF(signup.pricing_breakdown -> 'line' ->> 'billing_type', ''),
          'recurring'
        ) <> 'one_time'
        AND NOT EXISTS (
          SELECT 1 FROM billing_subscription subscription
           WHERE subscription.source_type = 'scheduling_signup'
             AND subscription.source_id = signup.id::text
             AND subscription.status <> 'cancelled'
        )
      ORDER BY signup.id`,
    [Number(account.family_id), month],
  ).then((result) => result.rows)
  if (candidates.length === 0) {
    return { candidates: 0, planned: [], created: [], skipped: [] }
  }

  let pricing
  try {
    pricing = await resolveFamilyEnrollmentPricing(db, {
      familyId: Number(account.family_id),
      periodKey: month.slice(0, 7),
      ensureSchema: false,
      strictPricing: true,
    })
  } catch (error) {
    return {
      candidates: candidates.length,
      planned: [],
      created: [],
      skipped: candidates.map((row) => ({ signupId: Number(row.signup_id), reason: 'pricing_resolution_failed', error: error.message })),
    }
  }
  const { planned, skipped } = buildCanonicalLocalEnrollmentRepairPlans(candidates, pricing, month)
  if (!apply || planned.length === 0) {
    return { candidates: candidates.length, planned, created: [], skipped }
  }

  const ownsClient = typeof db.connect === 'function' && typeof db.release !== 'function'
  const client = ownsClient ? await db.connect() : db
  const created = []
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [Number(accountId)])
    for (const plan of planned) {
      const subscription = await upsertSubscriptionForSource(client, {
        familyBillingAccountId: Number(accountId),
        memberId: plan.memberId,
        sourceType: 'scheduling_signup',
        sourceId: plan.signupId,
        description: plan.description,
        monthlyAmountCents: plan.grossCents,
        discountAmountCents: plan.discountCents,
        pricingOptionKey: plan.pricingOptionKey,
        fromDate: now,
        firstBillDate: plan.nextBillDate,
        subscriptionStartDate: plan.enrollmentStartDate,
      })
      if (!subscription) throw new Error(`Could not restore billing subscription for signup ${plan.signupId}.`)
      if (subscription.created !== true) {
        skipped.push({ signupId: plan.signupId, reason: 'subscription_already_restored' })
        continue
      }
      await client.query(
        `UPDATE billing_subscription
            SET next_bill_date = $2::date,
                price_sync_status = 'not_required',
                price_sync_error = NULL,
                updated_at = now()
          WHERE id = $1`,
        [subscription.id, plan.nextBillDate],
      )
      await recordBillingActivityBestEffort(client, {
        eventKey: `canonical-enrollment-subscription-repair:${plan.signupId}:${subscription.id}`,
        accountId: Number(accountId),
        memberId: plan.memberId,
        signupId: plan.signupId,
        eventType: 'canonical_enrollment_subscription_repaired',
        summary: 'Missing canonical recurring enrollment schedule restored without creating legacy Stripe collection.',
        afterValue: { billingSubscriptionId: subscription.id, ...plan },
        details: { targetMonth: month, localOnly: true },
        actorType: 'system',
      })
      created.push({ ...plan, billingSubscriptionId: Number(subscription.id), inserted: subscription.created === true })
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    if (ownsClient && typeof client.release === 'function') client.release()
  }
  return { candidates: candidates.length, planned, created, skipped }
}

export function buildProvableLegacyAdjustmentGroups(rows = []) {
  const groups = new Map()
  const skipped = []
  for (const row of rows) {
    let config = row.rule_config ?? {}
    if (typeof config === 'string') {
      try { config = JSON.parse(config) } catch { config = {} }
    }
    const promoCode = String(config.code ?? config.promo_code ?? '').trim()
    const reason = String(row.manual_discount_reason ?? '').trim()
    if (row.manual_discount_rule_id == null || row.rule_type !== 'promo_code' || !promoCode || !reason) {
      skipped.push({ signupId: Number(row.id), reason: 'legacy_discount_attribution_ambiguous' })
      continue
    }
    const key = `${row.manual_discount_rule_id}:${reason}`
    const group = groups.get(key) ?? { ruleId: Number(row.manual_discount_rule_id), reason, signupIds: [] }
    group.signupIds.push(Number(row.id))
    groups.set(key, group)
  }
  return { planned: [...groups.values()], skipped }
}

export async function repairProvableLegacyEnrollmentAdjustments(db, {
  accountId,
  apply = false,
} = {}) {
  const rows = await db.query(
    `WITH account_scope AS (
       SELECT family_id FROM family_billing_account WHERE id = $1
     ), account_members AS (
       SELECT DISTINCT member.id AS member_id
         FROM account_scope
         JOIN member ON ${canonicalActiveHouseholdMemberPredicate({
           memberAlias: 'member',
           familyIdReference: 'account_scope.family_id',
           membershipAlias: 'adjustment_membership',
           historyAlias: 'adjustment_membership_history',
         })}
     )
     SELECT signup.id, signup.manual_discount_rule_id, signup.manual_discount_reason,
            rule.type AS rule_type, rule.config AS rule_config
       FROM scheduling_signup signup
       JOIN account_members ON account_members.member_id = signup.member_id
       LEFT JOIN discount_rule rule ON rule.id = signup.manual_discount_rule_id
      WHERE signup.status = 'confirmed'
        AND (
          signup.manual_discount_cents IS NOT NULL
          OR signup.manual_discount_pct IS NOT NULL
          OR signup.manual_discount_rule_id IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM enrollment_price_adjustment adjustment
           WHERE adjustment.signup_id = signup.id AND adjustment.status <> 'revoked'
        )
      ORDER BY signup.id`,
    [Number(accountId)],
  ).then((result) => result.rows)
  const { planned, skipped } = buildProvableLegacyAdjustmentGroups(rows)
  const repaired = []
  const failed = []
  if (apply) {
    for (const group of planned) {
      try {
        const outcome = await ensureLegacyEnrollmentAdjustmentRecords(db, {
          accountId: Number(accountId),
          signupIds: group.signupIds,
          ruleId: group.ruleId,
          reason: group.reason,
        })
        if (Number(outcome.inserted ?? 0) !== group.signupIds.length) {
          failed.push({
            ...group,
            error: `Only ${Number(outcome.inserted ?? 0)} of ${group.signupIds.length} promo adjustments were proven and inserted.`,
          })
        } else {
          repaired.push({ ...group, ...outcome })
        }
      } catch (error) {
        failed.push({ ...group, error: error.message })
      }
    }
  }
  return { candidates: rows.length, planned, repaired, skipped, failed }
}

export async function repairBundleEntitlementBalances(db, {
  accountId,
  apply = false,
} = {}) {
  const ownsClient = apply && typeof db.connect === 'function' && typeof db.release !== 'function'
  const client = ownsClient ? await db.connect() : db
  let transactionOpen = false
  try {
    if (apply) {
      await client.query('BEGIN')
      transactionOpen = true
      await client.query('SELECT pg_advisory_xact_lock($1)', [Number(accountId)])
    }
    const rows = await client.query(
      `SELECT pass.id, pass.member_id, pass.class_count_purchased,
              pass.classes_remaining,
              pass.class_count_purchased + COALESCE(usage.credit_delta, 0)::int AS recomputed_classes_remaining
         FROM member_multi_class_pass pass
         JOIN member ON member.id = pass.member_id AND member.is_active = TRUE
         JOIN family_billing_account account ON account.id = $1
         LEFT JOIN LATERAL (
           SELECT SUM(COALESCE(redemption.credit_delta, -COALESCE(redemption.classes_used, 0)))::int AS credit_delta
             FROM multi_class_pass_redemption redemption
            WHERE redemption.member_pass_id = pass.id
         ) usage ON TRUE
        WHERE ${canonicalActiveHouseholdMemberPredicate({
          memberAlias: 'member',
          familyIdReference: 'account.family_id',
          membershipAlias: 'pass_membership',
          historyAlias: 'pass_membership_history',
        })}
        ORDER BY pass.id
        ${apply ? 'FOR UPDATE OF pass' : ''}`,
      [Number(accountId)],
    ).then((result) => result.rows)
    const candidates = rows.filter((row) => Number(row.classes_remaining) !== Number(row.recomputed_classes_remaining))
    const invalid = candidates
      .filter((row) => Number(row.recomputed_classes_remaining) < 0)
      .map((row) => ({ passId: Number(row.id), recomputedClassesRemaining: Number(row.recomputed_classes_remaining) }))
    const repairable = candidates.filter((row) => Number(row.recomputed_classes_remaining) >= 0)
    const repaired = []
    if (apply) {
      for (const row of repairable) {
        const updated = await client.query(
          `UPDATE member_multi_class_pass
              SET classes_remaining = $2, updated_at = now()
            WHERE id = $1 AND classes_remaining = $3
            RETURNING id`,
          [Number(row.id), Number(row.recomputed_classes_remaining), Number(row.classes_remaining)],
        )
        if (!updated.rows[0]) throw new Error(`Bundle pass ${row.id} changed during balance repair.`)
        const evidence = {
          passId: Number(row.id),
          memberId: Number(row.member_id),
          beforeClassesRemaining: Number(row.classes_remaining),
          recomputedClassesRemaining: Number(row.recomputed_classes_remaining),
        }
        await recordBillingActivityBestEffort(client, {
          eventKey: `canonical-bundle-balance-repair:${row.id}:${row.recomputed_classes_remaining}`,
          accountId: Number(accountId),
          memberId: Number(row.member_id),
          eventType: 'canonical_bundle_balance_repaired',
          summary: 'Derived bundle balance recomputed from the signed entitlement ledger.',
          beforeValue: { classesRemaining: Number(row.classes_remaining) },
          afterValue: { classesRemaining: Number(row.recomputed_classes_remaining) },
          details: { passId: Number(row.id), source: 'signed_entitlement_ledger' },
          actorType: 'system',
        })
        repaired.push(evidence)
      }
      await client.query('COMMIT')
      transactionOpen = false
    }
    return {
      candidates: candidates.map((row) => ({
        passId: Number(row.id),
        beforeClassesRemaining: Number(row.classes_remaining),
        recomputedClassesRemaining: Number(row.recomputed_classes_remaining),
      })),
      repaired,
      invalid,
    }
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    if (ownsClient && typeof client.release === 'function') client.release()
  }
}

export async function prepareCanonicalBillingMigration(db, {
  runId,
  accountIds,
  stripe = null,
  now = new Date(),
  apply = false,
  leaseOwner = null,
  environment = process.env,
} = {}) {
  if (apply) {
    requireFlag(environment, 'BILLING_COLLECTION_CUTOVER_ENABLED', 'Canonical billing preparation')
    requireCanonicalReadShadow(environment, 'Canonical billing preparation')
    requireHouseholdOnlyClassSubscriptionCreation(environment, 'Canonical billing preparation')
  }
  const { run, accountIds: ids } = await requireRunAndScope(db, runId, accountIds)
  const owner = workerName(leaseOwner)
  const accounts = []
  let cohortStop = null
  for (let accountIndex = 0; accountIndex < ids.length; accountIndex += 1) {
    const accountId = ids[accountIndex]
    let migration = await getBillingAccountMigration(db, { runId, accountId })
    if (!migration) {
      const error = 'Run does not contain this billing account.'
      accounts.push({ accountId, state: 'missing', error })
      if (apply) {
        cohortStop = cohortStopAfterFailure(ids, accountIndex, {
          accountId,
          code: 'migration_account_missing',
          error,
        })
        break
      }
      continue
    }
    try {
      const storedCutoverGatesPassed = storedMigrationPassesCanonicalCutoverGates(migration)
      const targetMonth = billingDateString(migration.cutover_month)
      const priorHash = migration.accepted_snapshot_hash
        ?? migration.snapshot_hash
        ?? parseJson(migration.parity_snapshot).snapshotHash
        ?? null
      const audit = await auditCanonicalBillingAccount(db, {
        accountId,
        targetMonth,
        stripe,
        now,
        runFacilityId: run.facility_id,
      })
      const boundary = validateBillingTargetMonth(targetMonth, {
        timeZone: audit.facilityTimezone,
        now,
        requireFuture: true,
      })
      const timing = billingCutoverTiming(boundary.boundaryUnix, now)
      if (!timing.canPrepare) {
        const error = new BillingMigrationSafetyError(
          'cutover_prepare_lead_time_too_short',
          'Canonical billing must be prepared at least seven days before the facility billing boundary.',
          { targetMonth, secondsUntilBoundary: timing.secondsUntilBoundary, minimumSeconds: 7 * 24 * 60 * 60 },
        )
        error.preserveMigrationState = true
        throw error
      }
      const drifted = priorHash != null && priorHash !== audit.snapshotHash
      if (drifted) {
        audit.exceptions.push({
          code: 'migration_snapshot_drift',
          type: 'migration_snapshot_drift',
          severity: 'blocking',
          message: 'Billing or Stripe state changed after shadow verification; run audit/repair again.',
          dedupeKey: 'migration_snapshot_drift',
          details: { previousHash: priorHash, currentHash: audit.snapshotHash },
        })
        audit.eligible = false
      }
      if (!storedCutoverGatesPassed) {
        audit.exceptions.push({
          code: 'stored_cutover_gate_invalid',
          type: 'stored_cutover_gate_invalid',
          severity: 'blocking',
          message: 'Stored payer and parity verification must both pass before a separate prepare attempt can arm the account.',
          dedupeKey: 'stored_cutover_gate_invalid',
          details: {
            payerValidationStatus: migration.payer_validation_status ?? null,
            parityStatus: migration.parity_status ?? null,
          },
        })
        audit.eligible = false
      }
      audit.paritySnapshot = {
        ...audit.paritySnapshot,
        preparedValidationAt: new Date(now).toISOString(),
        preparedValidationHash: audit.snapshotHash,
      }
      if (!apply) {
        const blockersOpen = await hasOpenBlockingMigrationExceptions(db, migration.id)
        const gateFailures = canonicalAuditCutoverGateFailures(audit)
        accounts.push({
          accountId,
          state: migration.state,
          wouldArm: !drifted
            && storedCutoverGatesPassed
            && gateFailures.length === 0
            && !blockersOpen
            && migration.state === S.SHADOW_VERIFIED,
          drifted,
          gateFailures,
          exceptions: audit.exceptions,
        })
        continue
      }
      migration = await claimBillingAccountMigration(db, { runId, accountId, leaseOwner: owner })
      if (migration.state !== S.SHADOW_VERIFIED) {
        throw new Error(`Account ${accountId} cannot be armed from ${migration.state}.`)
      }
      migration = await persistAudit(db, { runId, audit, leaseOwner: owner, transition: false })
      const gateFailures = canonicalAuditCutoverGateFailures(audit)
      const blockersOpen = await hasOpenBlockingMigrationExceptions(db, migration.id)
      if (
        !storedCutoverGatesPassed
        || !storedMigrationPassesCanonicalCutoverGates(migration)
        || gateFailures.length > 0
        || blockersOpen
      ) {
        migration = await transitionBillingAccountMigration(db, migration, S.BLOCKED, { leaseOwner: owner })
        accounts.push({ accountId, state: migration.state, armed: false, drifted, gateFailures, exceptions: audit.exceptions })
        cohortStop = cohortStopAfterFailure(ids, accountIndex, {
          accountId,
          code: 'migration_prepare_blocked',
          error: 'Current audit, stored payer/parity evidence, or blocking exceptions failed the cutover gate; the cohort was not armed further.',
        })
        break
      }
      migration = await withCanonicalFirstArmCollectorFreeze(db, accountId, async (cutoffDb) => {
        // A legacy creator that entered before the deployment cutoff holds the
        // shared form of this lock through Stripe creation and its durable local
        // link. Re-audit after it drains so the frozen snapshot includes that
        // collector or refuses to arm as stale.
        const barrierAudit = await auditCanonicalBillingAccount(cutoffDb, {
          accountId,
          targetMonth,
          stripe,
          now,
          runFacilityId: run.facility_id,
        })
        assertFirstArmCreationBarrierAudit(audit, barrierAudit)
        barrierAudit.paritySnapshot = {
          ...barrierAudit.paritySnapshot,
          preparedValidationAt: new Date(now).toISOString(),
          preparedValidationHash: barrierAudit.snapshotHash,
          classCreationBarrierValidatedAt: new Date(now).toISOString(),
        }
        let barrierMigration = await persistAudit(cutoffDb, {
          runId,
          audit: barrierAudit,
          leaseOwner: owner,
          transition: false,
        })
        if (
          !storedMigrationPassesCanonicalCutoverGates(barrierMigration)
          || !auditPassesCanonicalCutoverGates(barrierAudit)
          || await hasOpenBlockingMigrationExceptions(cutoffDb, barrierMigration.id)
        ) {
          throw new BillingMigrationSafetyError(
            'first_arm_creation_barrier_blocked',
            'Blocking migration exceptions remain after first-arm revalidation.',
          )
        }
        barrierMigration = await withBillingAccountMigrationLock(cutoffDb, accountId, async (client) => {
          let current = await getBillingAccountMigration(client, { runId, accountId, forUpdate: true })
          if (
            current.state !== S.SHADOW_VERIFIED
            || current.lease_owner !== owner
            || !storedMigrationPassesCanonicalCutoverGates(current)
          ) {
            throw new Error('Migration state or lease changed before arming.')
          }
          current = await transitionBillingAccountMigration(client, current, S.ARMED, { leaseOwner: owner })
          await recordBillingActivityBestEffort(client, {
            eventKey: `canonical-billing-migration-armed:${current.id}`,
            accountId,
            eventType: 'canonical_billing_migration_armed',
            summary: `Household billing cutover was armed for ${targetMonth.slice(0, 7)}.`,
            details: { billingMigrationRunId: Number(runId), accountMigrationId: Number(current.id), targetMonth, snapshotHash: barrierAudit.snapshotHash },
            actorType: 'system',
          })
          return current
        })
        return barrierMigration
      })
      accounts.push({ accountId, state: migration.state, armed: true, drifted: false, exceptions: [] })
    } catch (error) {
      if (apply && migration) {
        await recordOperationFailure(db, { runId, accountId, migration, error, leaseOwner: owner })
      }
      accounts.push({ accountId, state: 'error', error: error.message })
      if (apply) {
        cohortStop = cohortStopAfterFailure(ids, accountIndex, {
          accountId,
          code: error.code ?? 'migration_prepare_failed',
          error: error.message,
        })
        break
      }
    } finally {
      if (apply && migration?.id) {
        await releaseBillingAccountMigrationLease(db, { migrationId: migration.id, leaseOwner: owner }).catch(() => {})
      }
    }
  }
  return commandResult('prepare', apply, accounts, {
    runId: Number(runId),
    cohortStopped: cohortStop != null,
    cohortStop,
  })
}

async function scheduleAccountCutoverLocked(db, stripe, migration, {
  runId,
  accountId,
  targetMonth,
  boundary,
  leaseOwner,
  apply,
} = {}) {
  const items = collectionMigrationItems(
    await listBillingAccountMigrationItems(db, migration.id),
    { remoteOnly: true },
  )
  if (boundary.boundaryReached) {
    const error = new BillingMigrationSafetyError(
      'cutover_schedule_window_missed',
      'Legacy Stripe cancellation cannot be scheduled at or after the target billing boundary.',
      { targetMonth, boundaryUnix: boundary.boundaryUnix },
    )
    error.preserveMigrationState = true
    throw error
  }
  if (!apply) {
    return { migration, scheduled: 0, wouldSchedule: items.length }
  }
  let current = migration
  let scheduled = 0
  const frozenAccount = acceptedMigrationAccountSnapshot(migration)
  try {
    current = await renewBillingAccountMigrationLease(db, {
      migrationId: current.id,
      leaseOwner,
    })
    if (current.state !== S.ARMED) {
      throw new BillingMigrationSafetyError(
        'cutover_schedule_state_changed',
        `Stripe cancellation scheduling requires armed state; account is ${current.state}.`,
        { accountId, state: current.state },
      )
    }
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      const source = parseJson(item.source_snapshot)
      const target = parseJson(item.target_snapshot)
      const stripeSubscriptionId = source.local?.stripeSubscriptionId ?? item.source_id
      if (target.cancellationScheduled === true) continue
      current = await renewBillingAccountMigrationLease(db, { migrationId: current.id, leaseOwner })
      const outcome = await scheduleStripeSubscriptionForCutover(stripe, {
        subscriptionId: stripeSubscriptionId,
        boundaryUnix: boundary.boundaryUnix,
        idempotencyKey: `billing-cutover:${accountId}:${targetMonth}:schedule:${stripeSubscriptionId}`,
        expectedCustomerId: frozenAccount.stripeCustomerId,
        expectedItemId: source.local?.stripeSubscriptionItemId ?? null,
        facilityTimezone: boundary.timeZone,
      })
      // The Stripe request may outlive a worker lease. Re-prove ownership
      // before persisting evidence or advancing state; a replacement worker
      // can safely replay the deterministic Stripe idempotency key.
      current = await renewBillingAccountMigrationLease(db, {
        migrationId: current.id,
        leaseOwner,
      })
      items[index] = await updateBillingAccountMigrationItem(db, item, {
        state: 'planned',
        targetSnapshot: {
          ...target,
          cancellationScheduled: true,
          cancellationOwnedByMigration: source.remote?.cancelAt == null,
          cancelAt: boundary.boundaryUnix,
          scheduleBefore: outcome.before,
          scheduleAfter: outcome.after,
          scheduledAt: new Date().toISOString(),
        },
      })
      scheduled += outcome.changed ? 1 : 0
    }
  } catch (cause) {
    const error = new BillingMigrationSafetyError(
      'stripe_schedule_partial_failure',
      `Stripe cancellation scheduling stopped after ${scheduled} completed change(s): ${cause.message}`,
      { scheduled, causeCode: cause.code ?? null, causeDetails: cause.details ?? {} },
    )
    error.preserveMigrationState = true
    throw error
  }
  current = await getBillingAccountMigration(db, { runId, accountId })
  current = await transitionBillingAccountMigration(db, current, S.CANCELLATION_SCHEDULED, { leaseOwner })
  await resolveClearedBillingMigrationExceptions(db, {
    runId,
    accountMigrationId: current.id,
    activeDedupeKeys: [],
    dedupePrefix: `account:${accountId}:operation:stripe_schedule_partial_failure:`,
  })
  return { migration: current, scheduled, wouldSchedule: 0 }
}

async function scheduleAccountCutover(db, stripe, migration, options = {}) {
  if (!options.apply) {
    return scheduleAccountCutoverLocked(db, stripe, migration, options)
  }
  return withBillingAccountCollectionLock(db, options.accountId, (lockedDb) => (
    scheduleAccountCutoverLocked(lockedDb, stripe, migration, options)
  ))
}

async function revalidateBeforeDetachment(db, stripe, migration, {
  run,
  runId,
  accountId,
  targetMonth,
  boundary,
  now,
  leaseOwner,
  apply,
} = {}) {
  const timing = billingCutoverTiming(boundary.boundaryUnix, now)
  if (timing.boundaryReached) {
    const error = new BillingMigrationSafetyError(
      'cutover_detachment_window_missed',
      'Local legacy collection was not detached before the facility billing boundary.',
      { targetMonth, boundaryUnix: boundary.boundaryUnix },
    )
    error.preserveMigrationState = true
    throw error
  }
  if (!timing.inRevalidationWindow) {
    return {
      migration,
      readyToDetach: false,
      secondsUntilBoundary: timing.secondsUntilBoundary,
    }
  }

  const audit = await auditCanonicalBillingAccount(db, {
    accountId,
    targetMonth,
    stripe,
    now,
    allowScheduledCancellation: true,
    runFacilityId: run?.facility_id ?? null,
  })
  assertBoundaryRevalidationContract({ run, migration, audit, targetMonth })
  const invariant = assertBoundaryRevalidationInvariant({
    migration,
    audit,
    boundaryUnix: boundary.boundaryUnix,
  })
  const revalidatedAt = new Date(now).toISOString()
  audit.paritySnapshot = {
    ...audit.paritySnapshot,
    boundaryRevalidatedAt: revalidatedAt,
    boundaryRevalidationHash: audit.snapshotHash,
    boundaryRevalidationInvariantHash: invariant.currentInvariantHash,
    acceptedBoundaryInvariantHash: invariant.acceptedInvariantHash,
  }
  let current = migration
  if (apply) {
    await recordAuditExceptions(db, runId, current.id, audit)
    current = await updateBillingAccountMigrationEvidence(db, current, {
      payerValidationStatus: audit.payerValidationStatus,
      parityStatus: audit.parityStatus,
      paritySnapshot: audit.paritySnapshot,
      stripeSnapshot: audit.stripeSnapshot,
      lastError: audit.eligible ? null : 'Boundary revalidation found blocking billing parity exceptions.',
      leaseOwner,
    })
  }
  if (!audit.eligible || audit.parityStatus !== 'matched') {
    const error = new BillingMigrationSafetyError(
      'boundary_revalidation_failed',
      'Billing parity did not pass revalidation within one day of the cutover boundary.',
      {
        targetMonth,
        snapshotHash: audit.snapshotHash,
        exceptions: audit.exceptions.filter((item) => ['blocking', 'critical'].includes(item.severity)),
      },
    )
    // Cancellation may already be scheduled. Keep the pre-cancel state so the
    // operator can retry the audit or explicitly roll the schedule back.
    error.preserveMigrationState = true
    throw error
  }
  return {
    migration: current,
    readyToDetach: true,
    revalidatedAt,
    revalidationHash: audit.snapshotHash,
    secondsUntilBoundary: timing.secondsUntilBoundary,
  }
}

/**
 * Prove that every positive canonical target-month enrollment line was already
 * collected by exactly one former per-class Stripe item. A paid invoice is not
 * migration evidence unless subscription, item, service period, price,
 * currency, quantity, and amount all agree with the immutable accepted audit.
 */
export function buildPaidLegacyInvoiceSettlementPlan({
  migration,
  items,
  invoices,
  targetMonth,
  boundary,
} = {}) {
  const acceptedAccount = acceptedMigrationAccountSnapshot(migration)
  const acceptedPricing = acceptedMigrationPricingSnapshot(migration)
  const expectedLines = (acceptedPricing.parity?.lines ?? [])
    .filter((line) => Number(line.netCents) > 0)
  const nextBoundaryUnix = zonedDateStartUnix(nextBillingMonth(targetMonth), boundary?.timeZone)
  const issues = []
  const plans = []
  const usedInvoiceIds = new Set()
  const itemsBySubscription = new Map(
    (items ?? []).map((item) => [Number(item.billing_subscription_id), item]),
  )

  for (const expected of expectedLines) {
    const billingSubscriptionId = Number(expected.subscriptionId)
    const item = itemsBySubscription.get(billingSubscriptionId)
    if (!item) {
      issues.push({ code: 'legacy_invoice_subscription_mapping_missing', billingSubscriptionId })
      continue
    }
    let mapping
    try {
      mapping = frozenCollectionMapping(item)
    } catch (error) {
      issues.push({ code: error.code ?? 'migration_item_mapping_drift', billingSubscriptionId })
      continue
    }
    const formerItemId = mapping.local.stripeSubscriptionItemId ?? item.former_stripe_item_id ?? null
    const frozenRemoteItems = mapping.source.remote?.items ?? []
    const frozenRemoteItem = frozenRemoteItems.find((remoteItem) => (
      String(remoteItem.id ?? '') === String(formerItemId ?? '')
    ))
    if (
      !formerItemId ||
      String(item.former_stripe_item_id ?? '') !== String(formerItemId) ||
      !frozenRemoteItem
    ) {
      issues.push({
        code: 'legacy_invoice_item_mapping_missing',
        billingSubscriptionId,
        stripeSubscriptionId: mapping.stripeSubscriptionId,
        stripeSubscriptionItemId: formerItemId,
      })
      continue
    }
    const candidates = (invoices ?? []).filter((invoice) => (
      invoice.status === 'paid' &&
      Number(invoice.amountPaid ?? 0) > 0 &&
      Number(invoice.amountRemaining ?? 0) === 0 &&
      String(invoice.subscriptionId ?? '') === mapping.stripeSubscriptionId
    ))
    if (candidates.length !== 1) {
      issues.push({
        code: 'legacy_invoice_paid_coverage_invalid',
        billingSubscriptionId,
        stripeSubscriptionId: mapping.stripeSubscriptionId,
        paidInvoiceIds: candidates.map((invoice) => invoice.id),
      })
      continue
    }
    const invoice = candidates[0]
    const targetLines = invoice.matchingLinePeriods ?? []
    const lineMatches = targetLines.filter((line) => (
      String(line.subscriptionId ?? '') === mapping.stripeSubscriptionId &&
      String(line.subscriptionItemId ?? '') === String(formerItemId)
    ))
    const line = lineMatches.length === 1 ? lineMatches[0] : null
    const expectedNetCents = Number(expected.netCents)
    const frozenQuantity = Math.max(1, Number(frozenRemoteItem.quantity) || 1)
    const frozenCurrency = String(frozenRemoteItem.currency ?? '').toLowerCase()
    const lineCurrency = String(line?.currency ?? '').toLowerCase()
    const invoiceCurrency = String(invoice.currency ?? '').toLowerCase()
    const exact = line != null &&
      targetLines.length === 1 &&
      Number(invoice.nonZeroLineCount) === 1 &&
      (invoice.nonZeroLineIds ?? []).map(String).includes(String(line.id)) &&
      Number(line.periodStart) === Number(boundary?.boundaryUnix) &&
      Number(line.periodEnd) === Number(nextBoundaryUnix) &&
      Number(line.amountCents) === expectedNetCents &&
      Number(invoice.amountDue) === expectedNetCents &&
      Number(invoice.amountPaid) === expectedNetCents &&
      Number(invoice.amountRemaining) === 0 &&
      Number(invoice.amountOverpaid ?? 0) === 0 &&
      Number(invoice.startingBalance ?? 0) === 0 &&
      Number(invoice.endingBalance ?? 0) === 0 &&
      Number(invoice.prePaymentCreditNotesAmount ?? 0) === 0 &&
      Number(invoice.postPaymentCreditNotesAmount ?? 0) === 0 &&
      invoice.collectionMethod === 'charge_automatically' &&
      Boolean(invoice.paymentIntentId) &&
      invoice.paymentIntentStatus === 'succeeded' &&
      Number(invoice.paymentIntentAmountReceived) === expectedNetCents &&
      line.proration !== true &&
      Boolean(frozenRemoteItem.priceId) &&
      String(line.priceId ?? '') === String(frozenRemoteItem.priceId) &&
      Boolean(frozenCurrency) &&
      lineCurrency === frozenCurrency &&
      invoiceCurrency === frozenCurrency &&
      Number(line.quantity ?? frozenQuantity) === frozenQuantity &&
      Boolean(acceptedAccount.stripeCustomerId) &&
      String(invoice.customerId ?? '') === String(acceptedAccount.stripeCustomerId)
    if (!exact) {
      issues.push({
        code: 'legacy_invoice_line_evidence_mismatch',
        billingSubscriptionId,
        stripeSubscriptionId: mapping.stripeSubscriptionId,
        stripeSubscriptionItemId: formerItemId,
        stripeInvoiceId: invoice.id,
        expected: {
          customerId: acceptedAccount.stripeCustomerId ?? null,
          priceId: frozenRemoteItem.priceId ?? null,
          currency: frozenCurrency || null,
          quantity: frozenQuantity,
          amountCents: expectedNetCents,
          periodStart: boundary?.boundaryUnix ?? null,
          periodEnd: nextBoundaryUnix,
        },
        actual: {
          customerId: invoice.customerId ?? null,
          amountDueCents: Number(invoice.amountDue ?? 0),
          amountPaidCents: Number(invoice.amountPaid ?? 0),
          amountRemainingCents: Number(invoice.amountRemaining ?? 0),
          amountOverpaidCents: Number(invoice.amountOverpaid ?? 0),
          startingBalanceCents: Number(invoice.startingBalance ?? 0),
          endingBalanceCents: Number(invoice.endingBalance ?? 0),
          prePaymentCreditNotesAmountCents: Number(invoice.prePaymentCreditNotesAmount ?? 0),
          postPaymentCreditNotesAmountCents: Number(invoice.postPaymentCreditNotesAmount ?? 0),
          collectionMethod: invoice.collectionMethod ?? null,
          paymentIntentId: invoice.paymentIntentId ?? null,
          paymentIntentStatus: invoice.paymentIntentStatus ?? null,
          paymentIntentAmountReceivedCents: Number(invoice.paymentIntentAmountReceived ?? 0),
          currency: invoiceCurrency || null,
          lineCount: Number(invoice.lineCount ?? 0),
          nonZeroLineCount: Number(invoice.nonZeroLineCount ?? 0),
          nonZeroLineIds: invoice.nonZeroLineIds ?? [],
          matchingLines: targetLines,
        },
      })
      continue
    }
    if (usedInvoiceIds.has(String(invoice.id))) {
      issues.push({ code: 'legacy_invoice_reused', stripeInvoiceId: invoice.id })
      continue
    }
    usedInvoiceIds.add(String(invoice.id))
    plans.push(sanitizeBillingMigrationSnapshot({
      billingSubscriptionId,
      signupId: expected.signupId == null ? null : Number(expected.signupId),
      stripeSubscriptionId: mapping.stripeSubscriptionId,
      stripeSubscriptionItemId: String(formerItemId),
      stripeInvoiceId: String(invoice.id),
      stripeInvoiceLineId: String(line.id),
      stripeCustomerId: String(acceptedAccount.stripeCustomerId),
      stripePaymentIntentId: String(invoice.paymentIntentId),
      amountCents: expectedNetCents,
      currency: frozenCurrency,
      priceId: String(frozenRemoteItem.priceId),
      servicePeriodStart: billingDateString(targetMonth),
      servicePeriodEndExclusive: billingDateString(nextBillingMonth(targetMonth)),
    }))
  }

  const paidInvoiceIds = [...new Set((invoices ?? [])
    .filter((invoice) => (
      invoice.status === 'paid' &&
      Number(invoice.amountPaid ?? 0) > 0 &&
      Number(invoice.amountRemaining ?? 0) === 0
    ))
    .map((invoice) => String(invoice.id)))]
  const unmappedPaidInvoiceIds = paidInvoiceIds.filter((invoiceId) => !usedInvoiceIds.has(invoiceId))
  if (unmappedPaidInvoiceIds.length > 0) {
    issues.push({ code: 'legacy_invoice_paid_unmapped', stripeInvoiceIds: unmappedPaidInvoiceIds })
  }
  if (plans.length !== expectedLines.length) {
    issues.push({
      code: 'legacy_invoice_paid_account_coverage_incomplete',
      expectedEnrollmentCount: expectedLines.length,
      matchedEnrollmentCount: plans.length,
    })
  }
  if (issues.length > 0) {
    throw new BillingMigrationSafetyError(
      'target_month_paid_legacy_invoice_parity_failed',
      'Paid legacy Stripe invoices do not exactly cover the canonical target-month enrollment charges.',
      { accountId: migration?.family_billing_account_id ?? null, targetMonth, issues },
      { forwardOnly: true },
    )
  }
  return plans
}

async function inspectAndVoidLegacyInvoices(db, stripe, migration, {
  accountId,
  targetMonth,
  boundary,
  apply,
} = {}) {
  const items = collectionMigrationItems(
    await listBillingAccountMigrationItems(db, migration.id),
    { remoteOnly: true },
  )
  const nextBoundaryUnix = zonedDateStartUnix(nextBillingMonth(targetMonth), boundary.timeZone)
  const invoices = []
  for (const item of items) {
    const source = parseJson(item.source_snapshot)
    const stripeSubscriptionId = source.local?.stripeSubscriptionId ?? item.source_id
    const found = await listTargetMonthLegacyInvoices(stripe, {
      subscriptionId: stripeSubscriptionId,
      boundaryUnix: boundary.boundaryUnix,
      nextBoundaryUnix,
    })
    for (const invoice of found) invoices.push({ ...invoice, subscriptionId: stripeSubscriptionId, item })
  }
  const problems = validateTargetMonthLegacyInvoices(invoices)
  const manualReview = problems.filter((problem) => problem.disposition === 'manual_review_required')
  if (manualReview.length > 0) {
    return {
      invoices,
      problems,
      disposition: 'manual_review_required',
      reviewRequired: true,
      wouldVoid: 0,
      voided: [],
    }
  }
  const openForReview = problems.filter((problem) => problem.disposition === 'review_and_void')
  if (!apply && openForReview.length > 0) {
    return {
      invoices,
      problems,
      disposition: 'review_and_void',
      reviewRequired: true,
      wouldVoid: openForReview.length,
      voided: [],
    }
  }
  if (apply && openForReview.length > 0) {
    const voided = []
    for (const problem of openForReview) {
      const candidate = problem.invoice
      const outcome = await voidUnpaidTargetMonthLegacyInvoice(stripe, candidate, {
        idempotencyKey: `billing-cutover:${accountId}:${targetMonth}:void:${candidate.id}`,
      })
      voided.push(outcome)
      const target = parseJson(candidate.item.target_snapshot)
      candidate.item = await updateBillingAccountMigrationItem(db, candidate.item, {
        targetSnapshot: {
          ...target,
          targetMonthLegacyInvoices: [
            ...(target.targetMonthLegacyInvoices ?? []).filter((row) => row.id !== outcome.id),
            outcome,
          ],
        },
      })
    }
    return {
      invoices,
      problems,
      voided,
      disposition: 'reviewed_and_voided',
      reviewRequired: true,
      wouldVoid: 0,
    }
  }
  const deferred = problems.filter((problem) => problem.disposition === 'defer_next_month')
  if (deferred.length > 0) {
    const processing = deferred.some((problem) => problem.code === 'target_month_legacy_invoice_processing')
    const paidSettlementPlan = processing
      ? null
      : buildPaidLegacyInvoiceSettlementPlan({
          migration,
          items,
          invoices,
          targetMonth,
          boundary,
        })
    return {
      invoices,
      problems,
      disposition: processing ? 'processing_defer_next_month' : 'paid_defer_next_month',
      deferToMonth: nextBillingMonth(targetMonth),
      wouldVoid: 0,
      voided: [],
      paidSettlementPlan,
    }
  }
  return {
    invoices,
    problems,
    voided: [],
    disposition: 'clear',
    reviewRequired: false,
  }
}

async function persistCollectionDeferral(db, migration, {
  runId,
  accountId,
  targetMonth,
  invoiceReview,
  leaseOwner,
} = {}) {
  const deferToMonth = billingDateString(invoiceReview?.deferToMonth)
  if (!deferToMonth) return migration
  await recordBillingMigrationException(db, {
    runId,
    accountMigrationId: migration.id,
    dedupeKey: `account:${accountId}:target-month-legacy-invoice-deferred:${targetMonth}`,
    exceptionType: 'target_month_legacy_invoice_deferred',
    severity: 'warning',
    message: `Household collection was deferred to ${deferToMonth.slice(0, 7)} because legacy target-month collection was paid or processing.`,
    details: {
      targetMonth,
      deferToMonth,
      disposition: invoiceReview.disposition,
      invoices: invoiceReview.invoices,
    },
  })
  return updateBillingAccountMigrationEvidence(db, migration, {
    paritySnapshot: {
      ...parseJson(migration.parity_snapshot),
      collectionDeferredFromMonth: targetMonth,
      collectionDeferredToMonth: deferToMonth,
      targetMonthLegacyInvoiceDisposition: invoiceReview.disposition,
      targetMonthLegacyInvoices: invoiceReview.invoices,
    },
    leaseOwner,
  })
}

export function canReleaseProcessingCollectionDeferral(migration, invoiceReview) {
  const parity = parseJson(migration?.parity_snapshot)
  return parity.targetMonthLegacyInvoiceDisposition === 'processing_defer_next_month' &&
    Boolean(billingDateString(parity.collectionDeferredToMonth)) &&
    invoiceReview?.disposition === 'clear' &&
    invoiceReview?.reviewRequired !== true &&
    !billingDateString(invoiceReview?.deferToMonth)
}

async function releaseProcessingCollectionDeferral(db, migration, {
  runId,
  accountId,
  targetMonth,
  invoiceReview,
  leaseOwner,
  apply,
} = {}) {
  if (!canReleaseProcessingCollectionDeferral(migration, invoiceReview)) {
    return { migration, released: false, wouldRelease: false }
  }
  if (!apply) return { migration, released: false, wouldRelease: true }
  const current = await withBillingAccountMigrationLock(db, accountId, async (client) => {
    const locked = await getBillingAccountMigration(client, { runId, accountId, forUpdate: true })
    if (
      !locked ||
      Number(locked.id) !== Number(migration.id) ||
      locked.lease_owner !== leaseOwner ||
      !canReleaseProcessingCollectionDeferral(locked, invoiceReview)
    ) {
      throw new Error('Migration deferral evidence or lease changed before processing collection could be released.')
    }
    const previous = parseJson(locked.parity_snapshot)
    const updated = await updateBillingAccountMigrationEvidence(client, locked, {
      paritySnapshot: {
        ...previous,
        collectionDeferredFromMonth: null,
        collectionDeferredToMonth: null,
        targetMonthLegacyInvoiceDisposition: 'processing_released_without_collection',
        targetMonthLegacyInvoiceProcessingRelease: {
          targetMonth,
          previouslyDeferredToMonth: billingDateString(previous.collectionDeferredToMonth),
          releasedAt: new Date().toISOString(),
          reason: 'The processing legacy invoice was reviewed and no paid or processing collector remains.',
        },
      },
      leaseOwner,
    })
    await resolveClearedBillingMigrationExceptions(client, {
      runId,
      accountMigrationId: updated.id,
      activeDedupeKeys: [],
      dedupePrefix: `account:${accountId}:target-month-legacy-invoice-deferred:${targetMonth}`,
      resolutionNote: 'The processing legacy invoice no longer has paid or processing collection; target-month household collection may proceed after collector verification.',
    })
    return updated
  })
  return { migration: current, released: true, wouldRelease: false }
}

function provableLegacyGeneralPaymentApplication(application, paymentId) {
  return application.idempotency_key === `allocation:${paymentId}:${application.billing_charge_id}` &&
    ['annual_membership_first', 'oldest_charge'].includes(String(application.allocation_reason ?? ''))
}

async function applyPaidLegacyInvoiceToExactCharge(db, {
  accountId,
  plan,
  prepared,
  payment,
  charge,
} = {}) {
  if (
    Number(prepared.accountId) !== Number(accountId) ||
    Number(payment.family_billing_account_id) !== Number(accountId) ||
    Number(charge.family_billing_account_id) !== Number(accountId) ||
    Number(charge.subscription_id) !== Number(plan.billingSubscriptionId) ||
    Number(charge.amount_cents) !== Number(plan.amountCents) ||
    Number(prepared.amountCents) !== Number(plan.amountCents)
  ) {
    throw new BillingMigrationSafetyError(
      'paid_legacy_invoice_charge_binding_conflict',
      'The paid legacy invoice does not match its exact canonical target-month charge.',
      {
        accountId,
        stripeInvoiceId: plan.stripeInvoiceId,
        billingPaymentId: payment?.id ?? null,
        billingChargeId: charge?.id ?? null,
      },
      { forwardOnly: true },
    )
  }
  await db.query(`SELECT id FROM billing_payment WHERE id = $1 FOR UPDATE`, [payment.id])
  const adjustments = await db.query(
    `SELECT COALESCE(SUM(amount_cents), 0)::int AS cents
       FROM billing_charge
      WHERE family_billing_account_id = $1
        AND related_charge_id = $2
        AND source_type = 'charge_adjustment'`,
    [Number(accountId), Number(charge.id)],
  )
  const effectiveChargeCents = Number(charge.amount_cents) + Number(adjustments.rows[0]?.cents ?? 0)
  if (effectiveChargeCents !== Number(plan.amountCents)) {
    throw new BillingMigrationSafetyError(
      'paid_legacy_invoice_adjusted_charge_mismatch',
      'The canonical charge has adjustments that are not represented by the paid legacy invoice.',
      { billingChargeId: Number(charge.id), effectiveChargeCents, paidAmountCents: Number(plan.amountCents) },
      { forwardOnly: true },
    )
  }
  const refunds = await db.query(
    `SELECT COALESCE(SUM(amount_cents), 0)::int AS cents
       FROM billing_refund
      WHERE payment_id = $1
        AND external_status IN ('pending', 'succeeded')`,
    [payment.id],
  )
  if (Number(refunds.rows[0]?.cents ?? 0) !== 0) {
    throw new BillingMigrationSafetyError(
      'paid_legacy_invoice_refunded',
      'A refunded legacy invoice payment requires reviewed forward-only recovery.',
      { billingPaymentId: Number(payment.id), stripeInvoiceId: plan.stripeInvoiceId },
      { forwardOnly: true },
    )
  }
  const applications = await db.query(
    `SELECT application.*,
            candidate.family_billing_account_id AS charge_account_id,
            COALESCE(SUM(reversal.amount_cents), 0)::int AS reversed_cents
       FROM billing_payment_application application
       JOIN billing_charge candidate ON candidate.id = application.billing_charge_id
       LEFT JOIN billing_payment_application reversal
         ON reversal.reverses_application_id = application.id
        AND reversal.application_kind = 'reversal'
      WHERE application.application_kind = 'application'
        AND (
          application.billing_payment_id = $1
          OR application.billing_charge_id = $2
        )
      GROUP BY application.id, candidate.family_billing_account_id
      ORDER BY application.id`,
    [payment.id, charge.id],
  )
  const exactKey = `legacy-class-invoice:${plan.stripeInvoiceId}:payment:${payment.id}:charge:${charge.id}`
  const legacyToReverse = []
  let exactAppliedCents = 0
  for (const application of applications.rows) {
    const effectiveCents = Math.max(0, Number(application.amount_cents) - Number(application.reversed_cents ?? 0))
    if (effectiveCents === 0) continue
    if (Number(application.charge_account_id) !== Number(accountId)) {
      throw new BillingMigrationSafetyError(
        'paid_legacy_invoice_cross_account_allocation',
        'The legacy invoice payment has an allocation outside its billing account.',
        { billingPaymentApplicationId: Number(application.id) },
        { forwardOnly: true },
      )
    }
    if (Number(application.billing_payment_id) !== Number(payment.id)) {
      throw new BillingMigrationSafetyError(
        'paid_legacy_invoice_charge_already_funded',
        'The canonical target-month charge is already funded by a different payment.',
        { billingPaymentApplicationId: Number(application.id), billingChargeId: Number(charge.id) },
        { forwardOnly: true },
      )
    }
    if (
      Number(application.billing_charge_id) === Number(charge.id) &&
      application.idempotency_key === exactKey &&
      application.allocation_reason === 'exact_legacy_class_invoice'
    ) {
      exactAppliedCents += effectiveCents
      continue
    }
    if (!provableLegacyGeneralPaymentApplication(application, payment.id)) {
      throw new BillingMigrationSafetyError(
        'paid_legacy_invoice_allocation_ambiguous',
        'The legacy invoice payment has an allocation that cannot be safely remapped.',
        {
          billingPaymentApplicationId: Number(application.id),
          allocationReason: application.allocation_reason ?? null,
          idempotencyKey: application.idempotency_key ?? null,
        },
        { forwardOnly: true },
      )
    }
    legacyToReverse.push({ ...application, effectiveCents })
  }
  if (exactAppliedCents !== 0 && exactAppliedCents !== Number(plan.amountCents)) {
    throw new BillingMigrationSafetyError(
      'paid_legacy_invoice_exact_allocation_partial',
      'The legacy invoice payment has a partial exact allocation and requires review.',
      { exactAppliedCents, paidAmountCents: Number(plan.amountCents) },
      { forwardOnly: true },
    )
  }
  if (exactAppliedCents > 0 && legacyToReverse.length > 0) {
    throw new BillingMigrationSafetyError(
      'paid_legacy_invoice_extra_allocations',
      'The legacy invoice payment has both exact and additional active allocations.',
      { billingPaymentId: Number(payment.id) },
      { forwardOnly: true },
    )
  }
  if (exactAppliedCents === 0) {
    for (const application of legacyToReverse) {
      await db.query(
        `INSERT INTO billing_payment_application (
           billing_payment_id, billing_charge_id, amount_cents, application_kind,
           reverses_application_id, idempotency_key, allocation_reason
         ) VALUES ($1, $2, $3, 'reversal', $4, $5, 'legacy_class_invoice_reconstruction')
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
        [
          payment.id,
          application.billing_charge_id,
          application.effectiveCents,
          application.id,
          `legacy-class-invoice-repair:${plan.stripeInvoiceId}:reverse:${application.id}`,
        ],
      )
    }
    await db.query(
      `INSERT INTO billing_payment_application (
         billing_payment_id, billing_charge_id, amount_cents, application_kind,
         idempotency_key, allocation_reason
       ) VALUES ($1, $2, $3, 'application', $4, 'exact_legacy_class_invoice')
       ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
      [payment.id, charge.id, plan.amountCents, exactKey],
    )
  }
  const verified = await db.query(
    `SELECT COALESCE(SUM(CASE
              WHEN application_kind = 'reversal' THEN -amount_cents
              ELSE amount_cents
            END), 0)::int AS cents
       FROM billing_payment_application
      WHERE billing_payment_id = $1
        AND billing_charge_id = $2`,
    [payment.id, charge.id],
  )
  if (Number(verified.rows[0]?.cents ?? 0) !== Number(plan.amountCents)) {
    throw new BillingMigrationSafetyError(
      'paid_legacy_invoice_exact_allocation_missing',
      'The exact legacy invoice payment application could not be verified.',
      { billingPaymentId: Number(payment.id), billingChargeId: Number(charge.id) },
      { forwardOnly: true },
    )
  }
  const affectedChargeIds = [...new Set([
    Number(charge.id),
    ...legacyToReverse.map((application) => Number(application.billing_charge_id)),
  ])]
  await db.query(
    `UPDATE billing_charge candidate
        SET collection_status = CASE
          WHEN COALESCE((
            SELECT SUM(CASE
              WHEN application_kind = 'reversal' THEN -amount_cents
              ELSE amount_cents
            END)
              FROM billing_payment_application
             WHERE billing_charge_id = candidate.id
          ), 0) >= GREATEST(0, candidate.amount_cents + COALESCE((
            SELECT SUM(amount_cents)
              FROM billing_charge adjustment
             WHERE adjustment.related_charge_id = candidate.id
               AND adjustment.source_type = 'charge_adjustment'
          ), 0)) THEN 'paid'
          WHEN COALESCE((
            SELECT SUM(CASE
              WHEN application_kind = 'reversal' THEN -amount_cents
              ELSE amount_cents
            END)
              FROM billing_payment_application
             WHERE billing_charge_id = candidate.id
          ), 0) > 0 THEN 'partially_paid'
          WHEN candidate.collection_status IN ('checkout_pending', 'processing', 'failed')
            THEN candidate.collection_status
          ELSE 'unpaid'
        END
      WHERE candidate.family_billing_account_id = $1
        AND candidate.id = ANY($2::bigint[])`,
    [Number(accountId), affectedChargeIds],
  )
  return { billingPaymentId: Number(payment.id), billingChargeId: Number(charge.id), amountCents: Number(plan.amountCents) }
}

function recurringPricingLineEvidence(line) {
  return {
    subscriptionId: Number(line?.subscriptionId),
    signupId: Number(line?.signupId),
    grossCents: Number(line?.grossCents ?? 0),
    discountCents: Number(line?.discountCents ?? 0),
    netCents: Number(line?.netCents ?? 0),
  }
}

function sortedRecurringPricingLineEvidence(lines) {
  return (lines ?? [])
    .map(recurringPricingLineEvidence)
    .sort((left, right) => (
      left.subscriptionId - right.subscriptionId || left.signupId - right.signupId
    ))
}

export function assertRecurringSummaryMatchesAcceptedPricing(migration, summary) {
  const pricing = acceptedMigrationPricingSnapshot(migration)
  const canonical = pricing.parity?.canonical ?? {}
  const acceptedLines = sortedRecurringPricingLineEvidence(pricing.parity?.lines)
  const currentLines = sortedRecurringPricingLineEvidence(summary.expectedLines)
  const expectedCount = acceptedLines.length
  const mismatch = Number(summary.expectedChargeCount) !== expectedCount ||
    Number(summary.expectedGrossCents) !== Number(canonical.grossCents ?? 0) ||
    Number(summary.expectedDiscountCents) !== Number(canonical.discountCents ?? 0) ||
    Number(summary.expectedNetCents) !== Number(canonical.netCents ?? 0) ||
    JSON.stringify(currentLines) !== JSON.stringify(acceptedLines)
  if (mismatch) {
    throw new BillingMigrationSafetyError(
      'paid_legacy_invoice_current_pricing_drift',
      'Current canonical pricing no longer matches the accepted target-month cutover pricing.',
      { accepted: { expectedCount, ...canonical, expectedLines: acceptedLines }, current: summary },
      { forwardOnly: true },
    )
  }
}

/**
 * Re-read and prove the exact paid Stripe identity immediately before the
 * canonical ledger write. Current Stripe API versions expose the durable
 * Invoice -> PaymentIntent relationship through Invoice Payments, so the
 * legacy invoice.payment_intent field is intentionally not consulted here.
 */
export async function preparePaidLegacyInvoiceSettlementEntry(db, stripe, entry, {
  accountId,
} = {}) {
  if (typeof stripe?.invoices?.retrieve !== 'function') {
    throw new BillingMigrationSafetyError(
      'stripe_invoice_retrieval_unavailable',
      'Stripe invoice retrieval is required for paid legacy invoice settlement.',
      { stripeInvoiceId: entry?.stripeInvoiceId ?? null },
      { forwardOnly: true },
    )
  }
  const remoteInvoice = await stripe.invoices.retrieve(String(entry.stripeInvoiceId))
  if (
    remoteInvoice.status !== 'paid' ||
    Number(remoteInvoice.amount_paid ?? 0) !== Number(entry.amountCents) ||
    Number(remoteInvoice.amount_remaining ?? 0) !== 0 ||
    Number(remoteInvoice.amount_overpaid ?? 0) !== 0 ||
    Number(remoteInvoice.starting_balance ?? 0) !== 0 ||
    Number(remoteInvoice.ending_balance ?? 0) !== 0 ||
    Number(remoteInvoice.pre_payment_credit_notes_amount ?? 0) !== 0 ||
    Number(remoteInvoice.post_payment_credit_notes_amount ?? 0) !== 0 ||
    remoteInvoice.collection_method !== 'charge_automatically'
  ) {
    throw new BillingMigrationSafetyError(
      'paid_legacy_invoice_settlement_drift',
      'A paid legacy invoice changed before canonical settlement could be recorded.',
      { stripeInvoiceId: entry.stripeInvoiceId, status: remoteInvoice.status ?? null },
      { forwardOnly: true },
    )
  }
  const prepared = await preparePaidStripeInvoiceRecord(db, remoteInvoice, {
    stripe,
    // This forward-only settlement path already proved the invoice against
    // the immutable migration item and remote snapshot above. It must not
    // be reclassified as an ordinary legacy collector after local links
    // have intentionally been detached.
    canonicalMigrationSettlement: {
      accountId,
      subscriptionId: entry.stripeSubscriptionId,
      customerId: entry.stripeCustomerId,
    },
  })
  if (
    !prepared ||
    prepared.annualBinding ||
    Number(prepared.accountId) !== Number(accountId) ||
    String(prepared.invoiceId) !== String(entry.stripeInvoiceId) ||
    String(prepared.subscriptionId ?? '') !== String(entry.stripeSubscriptionId) ||
    String(prepared.customerId ?? '') !== String(entry.stripeCustomerId) ||
    String(prepared.paymentIntentId ?? '') !== String(entry.stripePaymentIntentId) ||
    Number(prepared.amountCents) !== Number(entry.amountCents)
  ) {
    throw new BillingMigrationSafetyError(
      'paid_legacy_invoice_payment_binding_conflict',
      'The Stripe payment identity does not match the frozen legacy class invoice.',
      { accountId, entry, prepared: prepared ? {
        accountId: prepared.accountId,
        invoiceId: prepared.invoiceId,
        subscriptionId: prepared.subscriptionId,
        customerId: prepared.customerId,
        paymentIntentId: prepared.paymentIntentId,
        amountCents: prepared.amountCents,
        annualBinding: Boolean(prepared.annualBinding),
      } : null },
      { forwardOnly: true },
    )
  }
  return { entry, prepared }
}

async function settlePaidTargetMonthLegacyInvoices(db, stripe, migration, {
  accountId,
  targetMonth,
  boundary,
  now,
} = {}) {
  return withBillingAccountCollectionLock(db, accountId, async (lockedDb) => {
    const items = collectionMigrationItems(
      await listBillingAccountMigrationItems(lockedDb, migration.id),
      { remoteOnly: true },
    )
    const invoices = []
    for (const item of items) {
      const mapping = frozenCollectionMapping(item)
      const found = await listTargetMonthLegacyInvoices(stripe, {
        subscriptionId: mapping.stripeSubscriptionId,
        boundaryUnix: boundary.boundaryUnix,
        nextBoundaryUnix: zonedDateStartUnix(nextBillingMonth(targetMonth), boundary.timeZone),
      })
      for (const invoice of found) invoices.push({ ...invoice, item })
    }
    const plan = buildPaidLegacyInvoiceSettlementPlan({ migration, items, invoices, targetMonth, boundary })
    const preparedInvoices = []
    for (const entry of plan) {
      preparedInvoices.push(await preparePaidLegacyInvoiceSettlementEntry(
        lockedDb,
        stripe,
        entry,
        { accountId },
      ))
    }

    const dryRun = await reconcileCanonicalRecurringChargesForMonth(lockedDb, {
      accountId,
      billingMonth: targetMonth,
      facilityTimeZone: boundary.timeZone,
      now,
      apply: false,
    })
    assertRecurringSummaryMatchesAcceptedPricing(migration, dryRun)
    const recurringCharges = await reconcileCanonicalRecurringChargesForMonth(lockedDb, {
      accountId,
      billingMonth: targetMonth,
      facilityTimeZone: boundary.timeZone,
      now,
      apply: true,
    })
    assertRecurringSummaryMatchesAcceptedPricing(migration, recurringCharges)

    const applications = []
    let transactionOpen = false
    try {
      await lockedDb.query('BEGIN')
      transactionOpen = true
      for (const { entry, prepared } of preparedInvoices) {
        const charges = await lockedDb.query(
          `SELECT *
             FROM billing_charge
            WHERE family_billing_account_id = $1
              AND subscription_id = $2
              AND source_type = 'billing_subscription'
              AND source_id = $3
              AND service_period_start = $4::date
            ORDER BY id
            FOR UPDATE`,
          [
            Number(accountId),
            Number(entry.billingSubscriptionId),
            `${entry.billingSubscriptionId}:${String(targetMonth).slice(0, 7)}`,
            billingDateString(targetMonth),
          ],
        )
        if (charges.rows.length !== 1) {
          throw new BillingMigrationSafetyError(
            'paid_legacy_invoice_canonical_charge_missing',
            'The exact canonical charge for a paid legacy invoice was not found.',
            {
              stripeInvoiceId: entry.stripeInvoiceId,
              billingSubscriptionId: entry.billingSubscriptionId,
              chargeIds: charges.rows.map((row) => Number(row.id)),
            },
            { forwardOnly: true },
          )
        }
        const payment = await upsertPaidStripeInvoicePayment(lockedDb, prepared)
        if (!payment) {
          throw new BillingMigrationSafetyError(
            'paid_legacy_invoice_payment_missing',
            'The paid legacy Stripe invoice could not be recorded in the canonical ledger.',
            { stripeInvoiceId: entry.stripeInvoiceId },
            { forwardOnly: true },
          )
        }
        const application = await applyPaidLegacyInvoiceToExactCharge(lockedDb, {
          accountId,
          plan: entry,
          prepared,
          payment,
          charge: charges.rows[0],
        })
        applications.push({ ...entry, ...application })
      }
      await lockedDb.query('COMMIT')
      transactionOpen = false
    } catch (error) {
      if (transactionOpen) await lockedDb.query('ROLLBACK').catch(() => {})
      throw error
    }
    for (const application of applications) {
        await recordBillingActivity(lockedDb, {
        eventKey: `canonical-billing-migration-legacy-invoice:${application.stripeInvoiceId}`,
        accountId,
        chargeId: application.billingChargeId,
        paymentId: application.billingPaymentId,
        eventType: 'canonical_billing_migration_legacy_invoice_settled',
        summary: `Paid legacy class invoice was linked to its ${String(targetMonth).slice(0, 7)} canonical charge.`,
        afterValue: {
          billingPaymentId: application.billingPaymentId,
          billingChargeId: application.billingChargeId,
          amountCents: application.amountCents,
        },
        details: application,
        stripeObjectId: application.stripeInvoiceId,
        actorType: 'system',
      })
    }
    return sanitizeBillingMigrationSnapshot({ plan, applications, recurringCharges })
  })
}

async function persistPaidLegacyInvoiceSettlement(db, migration, settlement, { leaseOwner } = {}) {
  return updateBillingAccountMigrationEvidence(db, migration, {
    paritySnapshot: {
      ...parseJson(migration.parity_snapshot),
      targetMonthLegacyInvoiceSettlement: settlement,
    },
    leaseOwner,
  })
}

const REMOTE_RETIRED_STATUSES = new Set(['canceled', 'incomplete_expired', 'missing'])
const REMOTE_ROLLBACK_STATUSES = new Set(['active', 'trialing', 'paused'])
const REMOTE_RETIREMENT_INTENT = 'forward_only_remote_retirement'

function frozenCollectionMapping(item) {
  const source = parseJson(item.source_snapshot)
  const local = source.local ?? {}
  const localId = Number(local.id)
  const stripeSubscriptionId = local.stripeSubscriptionId ?? item.former_stripe_subscription_id ?? null
  const mappingValid = Number.isSafeInteger(localId) && localId > 0 &&
    Number(item.billing_subscription_id) === localId &&
    String(item.source_id) === String(localId) &&
    String(item.target_id) === String(localId) &&
    Boolean(stripeSubscriptionId) &&
    String(item.former_stripe_subscription_id ?? '') === String(stripeSubscriptionId)
  if (!mappingValid) {
    throw new BillingMigrationSafetyError(
      'migration_item_mapping_drift',
      `Frozen migration mapping is incomplete or inconsistent for item ${item.id}.`,
      {
        itemId: Number(item.id),
        sourceId: item.source_id,
        targetId: item.target_id,
        billingSubscriptionId: item.billing_subscription_id,
        localId: Number.isFinite(localId) ? localId : null,
        formerStripeSubscriptionId: item.former_stripe_subscription_id ?? null,
        sourceStripeSubscriptionId: local.stripeSubscriptionId ?? null,
      },
    )
  }
  return { source, local, localId, stripeSubscriptionId: String(stripeSubscriptionId) }
}

/** Stripe reads only: callers must finish this preflight before opening a DB transaction. */
export async function inspectRemoteCutoverReversibility(stripe, items, {
  boundaryUnix,
  forwardOnlyOnMappingFailure = false,
} = {}) {
  const subscriptions = []
  for (const item of items) {
    let mapping
    try {
      mapping = frozenCollectionMapping(item)
    } catch (error) {
      if (forwardOnlyOnMappingFailure && error instanceof BillingMigrationSafetyError) error.forwardOnly = true
      throw error
    }
    let snapshot
    try {
      snapshot = (await retrieveStripeSubscriptionSnapshot(stripe, mapping.stripeSubscriptionId)).snapshot
    } catch (error) {
      if (!(error instanceof BillingMigrationSafetyError && error.code === 'stripe_subscription_missing')) throw error
      snapshot = { id: mapping.stripeSubscriptionId, status: 'missing', cancelAt: null, items: [] }
    }
    const frozenRemote = mapping.source.remote ?? {}
    const remoteItemId = mapping.local.stripeSubscriptionItemId ?? item.former_stripe_item_id ?? null
    const remoteMissing = snapshot.status === 'missing'
    if (
      String(snapshot.id ?? '') !== mapping.stripeSubscriptionId ||
      (!remoteMissing && frozenRemote.customerId && String(snapshot.customerId ?? '') !== String(frozenRemote.customerId)) ||
      (!remoteMissing && remoteItemId && !snapshot.items?.some((remoteItem) => String(remoteItem.id) === String(remoteItemId)))
    ) {
      throw new BillingMigrationSafetyError(
        'migration_remote_mapping_drift',
        `Stripe subscription ${mapping.stripeSubscriptionId} no longer matches the frozen migration mapping.`,
        {
          itemId: Number(item.id),
          expectedCustomerId: frozenRemote.customerId ?? null,
          actualCustomerId: snapshot.customerId ?? null,
          expectedItemId: remoteItemId,
          remoteStatus: snapshot.status ?? null,
        },
        { forwardOnly: forwardOnlyOnMappingFailure || REMOTE_RETIRED_STATUSES.has(snapshot.status) },
      )
    }
    const retired = REMOTE_RETIRED_STATUSES.has(snapshot.status)
    const reversible = REMOTE_ROLLBACK_STATUSES.has(snapshot.status) && (
      snapshot.cancelAt == null || Number(snapshot.cancelAt) === Number(boundaryUnix)
    )
    subscriptions.push({ item, mapping, snapshot, retired, reversible })
  }
  return {
    subscriptions,
    hasIrreversibleRetirement: subscriptions.some((entry) => entry.retired),
    allReversible: subscriptions.every((entry) => entry.reversible),
  }
}

async function detachLocalCollection(db, migration, {
  runId,
  accountId,
  leaseOwner,
  apply,
  allowedStates = [S.CANCELLATION_SCHEDULED],
  recoveryAfterRemoteRetirement = false,
} = {}) {
  const items = collectionMigrationItems(
    await listBillingAccountMigrationItems(db, migration.id),
    { remoteOnly: true },
  )
  if (!apply) return { migration, wouldDetach: items.length, detached: 0 }
  const current = await withBillingAccountMigrationLock(db, accountId, async (client) => {
    let locked = await getBillingAccountMigration(client, { runId, accountId, forUpdate: true })
    if (!allowedStates.includes(locked.state) || locked.lease_owner !== leaseOwner) {
      throw new Error('Migration state or lease changed before local Stripe detachment.')
    }
    const lockedItems = collectionMigrationItems(
      await listBillingAccountMigrationItems(client, locked.id),
      { remoteOnly: true },
    )
    for (const item of lockedItems) {
      const source = parseJson(item.source_snapshot)
      const target = parseJson(item.target_snapshot)
      const { local, localId } = frozenCollectionMapping(item)
      const subscription = await client.query(
        `SELECT * FROM billing_subscription
          WHERE id = $1 AND family_billing_account_id = $2
          FOR UPDATE`,
        [localId, Number(accountId)],
      ).then((result) => result.rows[0] ?? null)
      if (!subscription) throw new Error(`Local billing subscription ${local.id ?? item.target_id} no longer exists.`)
      const alreadyDetached = !subscription.stripe_subscription_id && !subscription.stripe_subscription_item_id && !subscription.stripe_subscription_schedule_id
      if (!alreadyDetached) {
        if (
          (subscription.stripe_subscription_id ?? null) !== (local.stripeSubscriptionId ?? null) ||
          (subscription.stripe_subscription_item_id ?? null) !== (local.stripeSubscriptionItemId ?? null) ||
          (subscription.stripe_subscription_schedule_id ?? null) !== (local.stripeSubscriptionScheduleId ?? null)
        ) {
          throw new BillingMigrationSafetyError(
            'local_stripe_link_drift',
            `Local Stripe links changed for billing subscription ${subscription.id}.`,
            { subscriptionId: Number(subscription.id) },
            { forwardOnly: recoveryAfterRemoteRetirement },
          )
        }
        await client.query(
          `UPDATE billing_subscription
              SET stripe_subscription_id = NULL,
                  stripe_subscription_item_id = NULL,
                  stripe_subscription_schedule_id = NULL,
                  price_sync_status = 'not_required',
                  price_sync_error = NULL,
                  updated_at = now()
            WHERE id = $1`,
          [Number(subscription.id)],
        )
      }
      await updateBillingAccountMigrationItem(client, item, {
        state: 'planned',
        targetSnapshot: {
          ...target,
          localDetached: true,
          localDetachedAt: target.localDetachedAt ?? new Date().toISOString(),
          ...(recoveryAfterRemoteRetirement ? { recoveredAfterRemoteRetirement: true } : {}),
        },
      })
    }
    locked = await transitionBillingAccountMigration(client, locked, S.DETACHED, { leaseOwner })
    await recordBillingActivityBestEffort(client, {
      eventKey: `canonical-billing-migration-detached:${locked.id}`,
      accountId,
      eventType: 'canonical_billing_migration_detached',
      summary: recoveryAfterRemoteRetirement
        ? 'Legacy Stripe links were recovered and detached after Stripe retirement crossed the billing boundary.'
        : 'Legacy Stripe links were detached from local recurring schedules before remote retirement.',
      details: {
        billingMigrationRunId: Number(runId),
        accountMigrationId: Number(locked.id),
        itemCount: lockedItems.length,
        recoveryAfterRemoteRetirement,
      },
      actorType: 'system',
    })
    return locked
  })
  return { migration: current, wouldDetach: 0, detached: items.length }
}

export async function recoverBoundaryRetirementBeforeDetachment(db, stripe, migration, {
  runId,
  accountId,
  targetMonth,
  boundary,
  leaseOwner,
  apply,
} = {}) {
  const remoteItems = collectionMigrationItems(
    await listBillingAccountMigrationItems(db, migration.id),
    { remoteOnly: true },
  )
  const preflight = await inspectRemoteCutoverReversibility(stripe, remoteItems, {
    boundaryUnix: boundary.boundaryUnix,
    forwardOnlyOnMappingFailure: true,
  })
  if (!preflight.hasIrreversibleRetirement) {
    const error = new BillingMigrationSafetyError(
      'cutover_detachment_window_missed',
      'The billing boundary passed before local detachment, but Stripe has not irreversibly retired a subscription. Explicit rollback is required.',
      {
        targetMonth,
        boundaryUnix: boundary.boundaryUnix,
        remoteStatuses: preflight.subscriptions.map((entry) => ({
          id: entry.mapping.stripeSubscriptionId,
          status: entry.snapshot.status,
          cancelAt: entry.snapshot.cancelAt ?? null,
        })),
      },
    )
    error.preserveMigrationState = true
    throw error
  }
  const detached = await detachLocalCollection(db, migration, {
    runId,
    accountId,
    leaseOwner,
    apply,
    allowedStates: [S.CANCELLATION_SCHEDULED, S.FAILED_FORWARD_ONLY],
    recoveryAfterRemoteRetirement: true,
  })
  return { ...detached, preflight }
}

export async function retireRemoteCollection(db, stripe, migration, {
  runId,
  accountId,
  targetMonth,
  leaseOwner,
  apply,
} = {}) {
  const items = collectionMigrationItems(
    await listBillingAccountMigrationItems(db, migration.id),
    { remoteOnly: true },
  )
  if (!apply) return { migration, wouldRetire: items.length, retired: 0 }
  let current = migration
  let retired = 0
  if (items.length > 0 && current.state === S.DETACHED) {
    current = await updateBillingAccountMigrationEvidence(db, current, {
      paritySnapshot: {
        ...parseJson(current.parity_snapshot),
        remoteRetirementIntent: REMOTE_RETIREMENT_INTENT,
        remoteRetirementStartedAt: new Date().toISOString(),
      },
      leaseOwner,
    })
    current = await transitionBillingAccountMigration(db, current, S.FAILED_FORWARD_ONLY, {
      leaseOwner,
      lastError: 'Remote Stripe retirement has started; rollback is no longer permitted.',
    })
  }
  for (let index = 0; index < items.length; index += 1) {
    let item = items[index]
    const source = parseJson(item.source_snapshot)
    const target = parseJson(item.target_snapshot)
    const stripeSubscriptionId = source.local?.stripeSubscriptionId ?? item.source_id
    current = await renewBillingAccountMigrationLease(db, { migrationId: current.id, leaseOwner })
    const outcome = await retireStripeSubscription(stripe, {
      subscriptionId: stripeSubscriptionId,
      idempotencyKey: `billing-cutover:${accountId}:${targetMonth}:retire:${stripeSubscriptionId}`,
    })
    item = await updateBillingAccountMigrationItem(db, item, {
      state: 'migrated',
      targetSnapshot: {
        ...target,
        localDetached: true,
        remoteRetired: true,
        remoteRetiredAt: target.remoteRetiredAt ?? new Date().toISOString(),
        retirementBefore: outcome.before,
        retirementAfter: outcome.after,
      },
    })
    items[index] = item
    retired += outcome.changed ? 1 : 0
  }
  current = await getBillingAccountMigration(db, { runId, accountId })
  current = await transitionBillingAccountMigration(db, current, S.REMOTE_RETIRED, { leaseOwner })
  return { migration: current, wouldRetire: 0, retired }
}

export async function assertUniqueLocalStripeCustomerOwner(db, {
  accountId,
  stripeCustomerId,
} = {}) {
  const normalizedAccountId = Number(accountId)
  const normalizedCustomerId = String(stripeCustomerId ?? '').trim()
  if (!Number.isSafeInteger(normalizedAccountId) || normalizedAccountId <= 0 || !normalizedCustomerId) {
    throw new BillingMigrationSafetyError(
      'stripe_customer_owner_missing',
      'A canonical billing account and Stripe customer are required before changing household collection.',
      { accountId: Number.isSafeInteger(normalizedAccountId) ? normalizedAccountId : null },
      { forwardOnly: true },
    )
  }
  const owners = await db.query(
    `/* canonical-migration:stripe-customer-owner */
     SELECT id, is_active
       FROM family_billing_account
      WHERE stripe_customer_id = $1
      ORDER BY id
      LIMIT 3`,
    [normalizedCustomerId],
  ).then((result) => result.rows ?? [])
  if (
    owners.length !== 1
    || Number(owners[0]?.id) !== normalizedAccountId
    || owners[0]?.is_active !== true
  ) {
    throw new BillingMigrationSafetyError(
      owners.length > 1
        ? 'stripe_customer_shared_between_accounts'
        : 'stripe_customer_owner_missing',
      'The Stripe customer must have exactly one active local billing-account owner; inactive links remain ownership conflicts until explicitly reconciled.',
      {
        accountId: normalizedAccountId,
        stripeCustomerId: normalizedCustomerId,
        ownerAccountIds: owners.map((owner) => Number(owner.id)),
      },
      { forwardOnly: true },
    )
  }
  return { accountId: normalizedAccountId, stripeCustomerId: normalizedCustomerId }
}

export async function inspectCustomerCollectorsBeforeHouseholdActivation(db, stripe, {
  account,
  billingMonth,
  facilityTimezone,
} = {}) {
  if (!account?.stripe_customer_id) {
    throw new BillingMigrationSafetyError(
      'stripe_customer_missing',
      'A Stripe customer is required before household collection can be activated.',
      { accountId: account?.id == null ? null : Number(account.id), billingMonth },
      { forwardOnly: true },
    )
  }
  if (!facilityTimezone) {
    throw new BillingMigrationSafetyError(
      'facility_timezone_missing',
      'The frozen facility timezone is required before household collection can be activated.',
      { accountId: Number(account.id), billingMonth },
      { forwardOnly: true },
    )
  }
  await assertUniqueLocalStripeCustomerOwner(db, {
    accountId: account.id,
    stripeCustomerId: account.stripe_customer_id,
  })
  // Read schedules before subscriptions so a schedule that releases while the
  // inventory is being taken becomes visible in the subsequent subscription
  // scan. The surrounding collection lock prevents application-owned creation
  // paths from racing this final activation boundary.
  const scheduleInventory = await inspectStripeCustomerSubscriptionScheduleInventory(stripe, {
    stripeCustomerId: account.stripe_customer_id,
    accountId: Number(account.id),
  })
  if (
    !scheduleInventory.verified ||
    Number(scheduleInventory.snapshot?.liveScheduleCount ?? -1) !== 0
  ) {
    throw new BillingMigrationSafetyError(
      'stripe_customer_live_subscription_schedule_present',
      'Stripe still has a subscription schedule that could compete with household collection.',
      {
        billingMonth,
        issues: scheduleInventory.issues,
        inventory: scheduleInventory.snapshot,
      },
      { forwardOnly: true },
    )
  }
  const localSubscriptions = await db.query(
    `SELECT id, status, source_type, pricing_option_key, stripe_subscription_id
       FROM billing_subscription
      WHERE family_billing_account_id = $1
        AND status IN ('active', 'paused')
      ORDER BY id`,
    [Number(account.id)],
  ).then((result) => result.rows)
  const subscriptionInventory = await inspectStripeCustomerSubscriptionInventory(stripe, {
    stripeCustomerId: account.stripe_customer_id,
    accountId: Number(account.id),
    localSubscriptions,
  })
  if (
    !subscriptionInventory.verified ||
    Number(subscriptionInventory.snapshot?.liveSubscriptionCount ?? -1) !== 0
  ) {
    throw new BillingMigrationSafetyError(
      'stripe_customer_live_subscription_present',
      'Stripe still has a live subscription that could compete with household collection.',
      {
        billingMonth,
        issues: subscriptionInventory.issues,
        inventory: subscriptionInventory.snapshot,
      },
      { forwardOnly: true },
    )
  }
  const inventory = await inspectStripeCustomerBillingMonthCollectors(stripe, {
    stripeCustomerId: account.stripe_customer_id,
    billingMonth,
    facilityTimezone,
    expectedStripeInvoiceIds: [],
    excludedSubscriptionIds: [],
  })
  if (!inventory.verified) {
    throw new BillingMigrationSafetyError(
      'target_month_collector_inventory_failed',
      'Stripe still has a collector that could overlap household billing for the activation month.',
      { billingMonth, issues: inventory.issues, inventory: inventory.snapshot },
      { forwardOnly: true },
    )
  }
  return { billingMonthCollectors: inventory, subscriptionInventory, scheduleInventory }
}

async function activateHouseholdCollection(db, stripe, migration, {
  runId,
  accountId,
  targetMonth,
  leaseOwner,
  apply,
  collectionLockHeld = false,
  environment = process.env,
} = {}) {
  if (apply && !collectionLockHeld) {
    return withBillingAccountCollectionLock(db, accountId, (lockedDb) => (
      activateHouseholdCollection(lockedDb, stripe, migration, {
        runId,
        accountId,
        targetMonth,
        leaseOwner,
        apply,
        collectionLockHeld: true,
        environment,
      })
    ))
  }
  const account = await db.query(
    `SELECT * FROM family_billing_account WHERE id = $1 LIMIT 1`,
    [Number(accountId)],
  ).then((result) => result.rows[0] ?? null)
  if (!account) throw new Error(`Billing account ${accountId} was not found.`)
  const readiness = await retrieveStripeCustomerReadiness(stripe, account.stripe_customer_id, {
    billingMonth: targetMonth,
    expectedAccountId: account.id,
  })
  if (!readiness.ready) {
    throw new BillingMigrationSafetyError(readiness.reason, 'Stripe customer no longer has a reusable payment method.', readiness.snapshot, { forwardOnly: true })
  }
  const collectorInventory = await inspectCustomerCollectorsBeforeHouseholdActivation(db, stripe, {
    account,
    billingMonth: targetMonth,
    facilityTimezone: acceptedMigrationPricingSnapshot(migration).timezone,
  })
  if (!apply) return { migration, wouldActivate: true, readiness, collectorInventory }
  const current = await withBillingAccountMigrationLock(db, accountId, async (client) => {
    let locked = await getBillingAccountMigration(client, { runId, accountId, forUpdate: true })
    if (![S.REMOTE_RETIRED, S.FAILED_FORWARD_ONLY].includes(locked.state) || locked.lease_owner !== leaseOwner) {
      throw new Error('Migration state or lease changed before household activation.')
    }
    const legacy = await client.query(
      `SELECT id, stripe_subscription_id
         FROM billing_subscription subscription
        WHERE subscription.family_billing_account_id = $1
          AND subscription.status IN ('active', 'paused')
          AND (
            subscription.stripe_subscription_id IS NOT NULL
            OR subscription.stripe_subscription_item_id IS NOT NULL
            OR subscription.stripe_subscription_schedule_id IS NOT NULL
          )
        LIMIT 1`,
      [Number(accountId)],
    )
    if (legacy.rows[0]) throw new Error(`Local Stripe collection remains attached to billing subscription ${legacy.rows[0].id}.`)
    await assertUniqueLocalStripeCustomerOwner(client, {
      accountId,
      stripeCustomerId: account.stripe_customer_id,
    })
    await client.query(
      `UPDATE family_billing_account
          SET household_monthly_billing_enabled = TRUE, updated_at = now()
        WHERE id = $1`,
      [Number(accountId)],
    )
    locked = await transitionBillingAccountMigration(client, locked, S.HOUSEHOLD_ACTIVE, { leaseOwner })
    await recordBillingActivityBestEffort(client, {
      eventKey: `canonical-billing-migration-household-active:${locked.id}`,
      accountId,
      eventType: 'canonical_billing_migration_household_active',
      summary: `Household monthly collection became authoritative for ${targetMonth.slice(0, 7)}.`,
      beforeValue: { householdMonthlyBillingEnabled: false },
      afterValue: { householdMonthlyBillingEnabled: true },
      details: { billingMigrationRunId: Number(runId), accountMigrationId: Number(locked.id), targetMonth },
      actorType: 'system',
    })
    return locked
  })
  return { migration: current, wouldActivate: false, readiness, collectorInventory }
}

export async function ensureHouseholdCollectionInvoice(db, migration, {
  accountId,
  targetMonth,
  now = new Date(),
  apply,
  environment = process.env,
  recurringChargeReconciler = reconcileCanonicalRecurringChargesForMonth,
  pauseCreditProcessor = applyPendingPauseCredits,
  invoiceFactory = createHouseholdMonthlyInvoice,
  accountLock = withHouseholdMonthlyInvoiceAccountLock,
} = {}) {
  const account = await db.query(
    `SELECT account.*, family.facility_id
       FROM family_billing_account account
       JOIN family ON family.id = account.family_id
      WHERE account.id = $1
      LIMIT 1`,
    [Number(accountId)],
  ).then((result) => result.rows[0] ?? null)
  if (!account || account.household_monthly_billing_enabled !== true) {
    throw new BillingMigrationSafetyError(
      'household_collection_not_active',
      'Household collection must remain active while its first invoice is ensured.',
      { accountId },
      { forwardOnly: true },
    )
  }
  const facilityTimeZone = acceptedMigrationPricingSnapshot(migration).timezone
  if (!apply) {
    const recurringCharges = await recurringChargeReconciler(db, {
      accountId,
      billingMonth: targetMonth,
      facilityTimeZone,
      now,
      apply: false,
    })
    return { migration, wouldEnsureInvoice: true, invoice: null, recurringCharges }
  }
  return accountLock(db, accountId, async (lockedDb) => {
    // Credits due for the target month are part of the collectible account
    // state. A missing credit must quarantine this forward-only account before
    // canonical charges or any Stripe invoice can be created.
    const pauseCreditsPosted = await pauseCreditProcessor(lockedDb, {
      periodStart: targetMonth,
      facilityId: Number(account.facility_id),
      accountId: Number(accountId),
      strict: true,
    })
    // Commit exact target-month enrollment charges before the invoice service
    // performs any Stripe call. The session account lock stays held across both
    // phases, while no database transaction crosses the remote boundary.
    const recurringCharges = await recurringChargeReconciler(lockedDb, {
      accountId,
      billingMonth: targetMonth,
      facilityTimeZone,
      now,
      apply: true,
    })
    if (recurringCharges.verified !== true) {
      throw new BillingMigrationSafetyError(
        'target_month_recurring_charge_parity_failed',
        'Target-month recurring charges were not verified before household invoice creation.',
        { accountId, targetMonth, recurringCharges },
        { forwardOnly: true },
      )
    }
    const invoice = await invoiceFactory(lockedDb, {
      account,
      billingMonth: targetMonth,
      facilityTimeZone,
      environment,
      migrationAuthorization: {
        migrationId: Number(migration.id),
        runId: Number(migration.billing_migration_run_id),
        leaseOwner: migration.lease_owner,
        effectiveCollectionMonth: targetMonth,
      },
    })
    return {
      migration,
      wouldEnsureInvoice: false,
      invoice,
      recurringCharges,
      pauseCreditsPosted,
    }
  })
}

async function resumeForwardOnlyState(db, stripe, migration, options) {
  const accountId = options.accountId
  const account = await db.query(
    `SELECT household_monthly_billing_enabled FROM family_billing_account WHERE id = $1`,
    [Number(accountId)],
  ).then((result) => result.rows[0] ?? null)
  if (account?.household_monthly_billing_enabled === true) {
    const current = migration.state === S.FAILED_FORWARD_ONLY
      ? await transitionBillingAccountMigration(db, migration, S.HOUSEHOLD_ACTIVE, {
          leaseOwner: options.leaseOwner,
        })
      : migration
    return { migration: current, resumeAt: S.HOUSEHOLD_ACTIVE }
  }
  const localLinks = await db.query(
    `SELECT COUNT(*)::int AS count
       FROM billing_subscription subscription
      WHERE subscription.family_billing_account_id = $1
        AND subscription.source_type <> 'annual_membership'
        AND COALESCE(subscription.pricing_option_key, '') <> 'annual_membership'
        AND subscription.status IN ('active', 'paused')
        AND (
          subscription.stripe_subscription_id IS NOT NULL
          OR subscription.stripe_subscription_item_id IS NOT NULL
          OR subscription.stripe_subscription_schedule_id IS NOT NULL
        )`,
    [Number(accountId)],
  )
  const targetMonth = billingDateString(migration.cutover_month)
  const timezone = acceptedMigrationPricingSnapshot(migration).timezone
  const boundary = {
    boundaryUnix: zonedDateStartUnix(targetMonth, timezone),
    timeZone: timezone,
  }
  const remoteItems = collectionMigrationItems(
    await listBillingAccountMigrationItems(db, migration.id),
    { remoteOnly: true },
  )
  const preflight = await inspectRemoteCutoverReversibility(stripe, remoteItems, {
    boundaryUnix: boundary.boundaryUnix,
    forwardOnlyOnMappingFailure: true,
  })
  const retirementIntent = parseJson(migration.parity_snapshot).remoteRetirementIntent
  if (!preflight.hasIrreversibleRetirement && retirementIntent !== REMOTE_RETIREMENT_INTENT) {
    throw new BillingMigrationSafetyError(
      'forward_only_irreversibility_unproven',
      'Forward-only recovery refused because no frozen Stripe subscription is confirmed retired.',
      { remoteStatuses: preflight.subscriptions.map((entry) => entry.snapshot.status) },
      { forwardOnly: true },
    )
  }
  if (Number(localLinks.rows[0]?.count ?? 0) > 0) {
    const recovered = await recoverBoundaryRetirementBeforeDetachment(db, stripe, migration, {
      ...options,
      targetMonth,
      boundary,
      apply: true,
    })
    migration = recovered.migration
  }
  const result = await retireRemoteCollection(db, stripe, migration, options)
  return { migration: result.migration, resumeAt: S.REMOTE_RETIRED, retirement: result }
}

const FORWARD_ADOPTION_REVIEW_CODES = new Set([
  'manual_collection_requires_review',
  'target_household_invoice_exists',
  'target_household_invoice_already_paid',
])

function canonicalAdoptionBalanceVerified(audit) {
  const ledger = audit?.ledgerSnapshot?.ledger ?? {}
  const chargeCents = cents(ledger.charge_cents ?? ledger.chargeCents)
  const paymentCents = cents(ledger.payment_cents ?? ledger.paymentCents)
  const refundCents = cents(ledger.refund_cents ?? ledger.refundCents)
  const runningBalanceCents = cents(
    ledger.ledger_running_balance_cents ?? ledger.ledgerRunningBalanceCents,
  )
  const dimensions = audit?.ledgerSnapshot?.lockedDimensions
    ?? audit?.paritySnapshot?.dimensions
    ?? {}
  return runningBalanceCents === chargeCents - paymentCents + refundCents
    && dimensions.balance?.matched === true
    && dimensions.outstandingAmount?.matched === true
}

function forwardAdoptionIssueIsExplicitlyReviewed(issue, { audit, verification } = {}) {
  if (!FORWARD_ADOPTION_REVIEW_CODES.has(String(issue?.code ?? ''))) return false
  if (issue.code === 'manual_collection_requires_review') {
    return audit?.sourceCollectionMode === 'manual'
  }
  return verification?.verified === true
}

/** Pure, reportable fail-closed gate for the exceptional forward-adoption path. */
export function canonicalHouseholdForwardAdoptionGateFailures({
  audit,
  localCollectors = [],
  scheduleInventory = null,
  paymentMethodReadiness = null,
  activationEvidence = null,
  verification = null,
} = {}) {
  const failures = []
  if (!['manual', 'household_monthly'].includes(String(audit?.sourceCollectionMode ?? ''))) {
    failures.push('source_collection_mode_not_ledger_only')
  }
  if (audit?.payerValidationStatus !== 'verified') failures.push('payer_access_not_verified')
  if (audit?.parityStatus !== 'matched' || audit?.paritySnapshot?.matched !== true) {
    failures.push('canonical_parity_not_matched')
  }
  if (!canonicalAdoptionBalanceVerified(audit)) failures.push('canonical_balance_not_verified')
  const blockingIssues = (audit?.exceptions ?? []).filter((issue) => (
    ['blocking', 'critical'].includes(String(issue?.severity ?? ''))
    && !forwardAdoptionIssueIsExplicitlyReviewed(issue, { audit, verification })
  ))
  if (blockingIssues.length > 0) failures.push('unreviewed_blocking_audit_exception')
  if ((localCollectors ?? []).length > 0) failures.push('active_local_recurring_collector_present')

  const stripeCustomerId = audit?.accountSnapshot?.stripeCustomerId ?? null
  const remoteInventory = audit?.initialStripeSnapshot?.customerSubscriptionInventory ?? null
  if (stripeCustomerId) {
    if (
      !remoteInventory
      || Number(remoteInventory.liveSubscriptionCount ?? -1) !== 0
      || (remoteInventory.subscriptions ?? []).length !== 0
    ) {
      failures.push('active_remote_recurring_subscription_present')
    }
    if (
      paymentMethodReadiness?.reason === 'stripe_customer_deleted'
      || paymentMethodReadiness?.reason === 'stripe_customer_missing'
    ) {
      failures.push('stripe_customer_reference_invalid')
    }
  }
  if (
    scheduleInventory?.verified !== true
    || Number(scheduleInventory?.snapshot?.liveScheduleCount ?? -1) !== 0
  ) {
    failures.push('active_remote_subscription_schedule_present')
  }
  if (activationEvidence?.verified !== true) {
    failures.push('household_activation_evidence_missing')
  }
  if (verification?.verified !== true) failures.push('canonical_household_verification_failed')
  return [...new Set(failures)]
}

export async function inspectActiveLocalRecurringCollectors(db, accountId) {
  const result = await db.query(
    `SELECT id, status, source_type, pricing_option_key,
            stripe_subscription_id, stripe_subscription_item_id,
            stripe_subscription_schedule_id
       FROM billing_subscription
      WHERE family_billing_account_id = $1
        AND status IN ('active', 'paused')
        AND (
          NULLIF(BTRIM(stripe_subscription_id), '') IS NOT NULL
          OR NULLIF(BTRIM(stripe_subscription_item_id), '') IS NOT NULL
          OR NULLIF(BTRIM(stripe_subscription_schedule_id), '') IS NOT NULL
        )
      ORDER BY id`,
    [Number(accountId)],
  )
  return result.rows.map((row) => sanitizeBillingMigrationSnapshot({
    id: Number(row.id),
    status: row.status,
    sourceType: row.source_type,
    pricingOptionKey: row.pricing_option_key,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripeSubscriptionItemId: row.stripe_subscription_item_id,
    stripeSubscriptionScheduleId: row.stripe_subscription_schedule_id,
  }))
}

export async function loadCanonicalHouseholdActivationEvidence(db, {
  accountId,
  targetMonth,
} = {}) {
  const result = await db.query(
    `SELECT evidence_type, evidence_id, occurred_at, evidence
       FROM (
         SELECT 'activity'::text AS evidence_type,
                activity.id::text AS evidence_id,
                activity.occurred_at,
                jsonb_build_object(
                  'eventType', activity.event_type,
                  'eventKey', activity.event_key
                ) AS evidence
           FROM billing_account_activity activity
          WHERE activity.family_billing_account_id = $1
            AND activity.event_type IN (
              'canonical_billing_migration_household_active',
              'household_monthly_billing_migrated',
              'household_monthly_billing_enabled',
              'legacy_class_stripe_subscription_retired',
              'stripe_class_subscription_retired'
            )
         UNION ALL
         SELECT 'default_remediation'::text,
                remediation.id::text,
                remediation.examined_at,
                jsonb_build_object(
                  'outcome', remediation.outcome,
                  'reason', remediation.reason,
                  'remediationKey', remediation.remediation_key
                )
           FROM billing_household_default_remediation_audit remediation
          WHERE remediation.family_billing_account_id = $1
            AND remediation.outcome = 'preserved'
         UNION ALL
         SELECT 'household_invoice'::text,
                invoice.id::text,
                invoice.created_at,
                jsonb_build_object(
                  'billingMonth', invoice.billing_month,
                  'status', invoice.status,
                  'totalCents', invoice.total_cents,
                  'isTargetMonth', invoice.billing_month = $2::date
                )
           FROM billing_monthly_invoice invoice
          WHERE invoice.family_billing_account_id = $1
       ) durable_evidence
      ORDER BY occurred_at DESC, evidence_type, evidence_id
      LIMIT 50`,
    [Number(accountId), billingDateString(targetMonth)],
  )
  const records = result.rows.map((row) => sanitizeBillingMigrationSnapshot({
    type: row.evidence_type,
    id: row.evidence_id,
    occurredAt: row.occurred_at,
    evidence: row.evidence,
  }))
  return {
    verified: records.length > 0,
    source: 'durable_preexisting_evidence',
    records,
    evidenceHash: billingMigrationSnapshotHash(records),
  }
}

function explicitForwardAdoptionEvidence(accountId, targetMonth) {
  const evidence = sanitizeBillingMigrationSnapshot({
    type: 'explicit_forward_adoption',
    accountId: Number(accountId),
    targetMonth: billingDateString(targetMonth),
    confirmation: 'explicit_account_scope_and_apply_required',
  })
  return {
    verified: true,
    source: 'explicit_forward_adoption',
    records: [evidence],
    evidenceHash: billingMigrationSnapshotHash(evidence),
  }
}

function forwardAdoptionAudit(audit, evidence) {
  const exceptions = (audit.exceptions ?? []).filter((issue) => (
    !forwardAdoptionIssueIsExplicitlyReviewed(issue, {
      audit,
      verification: evidence.verification,
    })
  ))
  const blocking = exceptions.filter((issue) => (
    ['blocking', 'critical'].includes(String(issue?.severity ?? ''))
  ))
  return {
    ...audit,
    eligible: blocking.length === 0,
    classification: blocking.length === 0 ? 'ready' : audit.classification,
    exceptions,
    paritySnapshot: sanitizeBillingMigrationSnapshot({
      ...audit.paritySnapshot,
      forwardAdoptionPreflight: evidence,
    }),
  }
}

async function inspectForwardAdoptionAccount(db, stripe, {
  run,
  migration,
  accountId,
  targetMonth,
  now,
} = {}) {
  const accountIdentity = await db.query(
    `SELECT id, stripe_customer_id
       FROM family_billing_account
      WHERE id = $1
      LIMIT 1`,
    [Number(accountId)],
  ).then((result) => result.rows[0] ?? null)
  if (!accountIdentity) throw new Error(`Billing account ${accountId} was not found during forward adoption.`)
  // Schedule first, subscription inventory second. If a schedule releases
  // during this read, the audit's subsequent customer subscription scan sees
  // the new collector. The caller holds the account collection lock, which
  // prevents application-owned schedule/subscription creation from racing it.
  const scheduleInventory = await inspectStripeCustomerSubscriptionScheduleInventory(stripe, {
    stripeCustomerId: accountIdentity.stripe_customer_id ?? null,
    accountId,
  })
  const audit = await auditCanonicalBillingAccount(db, {
    accountId,
    targetMonth,
    stripe,
    now,
    runFacilityId: run.facility_id,
  })
  if (
    String(audit.accountSnapshot?.stripeCustomerId ?? '')
    !== String(accountIdentity.stripe_customer_id ?? '')
  ) {
    throw new BillingMigrationSafetyError(
      'forward_adoption_stripe_customer_changed',
      'The billing account Stripe customer changed during forward-adoption inventory.',
      {
        accountId: Number(accountId),
        scheduleInventoryCustomerId: accountIdentity.stripe_customer_id ?? null,
        auditCustomerId: audit.accountSnapshot?.stripeCustomerId ?? null,
      },
    )
  }
  const localCollectors = await inspectActiveLocalRecurringCollectors(db, accountId)
  const paymentMethodReadiness = await retrieveStripeCustomerReadiness(
    stripe,
    audit.accountSnapshot?.stripeCustomerId ?? null,
    { billingMonth: targetMonth, expectedAccountId: accountId },
  )
  const activationEvidence = audit.accountSnapshot?.householdMonthlyBillingEnabled === true
    ? await loadCanonicalHouseholdActivationEvidence(db, { accountId, targetMonth })
    : explicitForwardAdoptionEvidence(accountId, targetMonth)
  const verification = await verifyCanonicalBillingAccount(db, {
    migration: {
      ...migration,
      parity_snapshot: {
        ...parseJson(migration.parity_snapshot),
        timezone: audit.facilityTimezone,
      },
    },
    stripe,
    now,
    billingMonth: targetMonth,
    inspectCollectorInventory: false,
    requireHouseholdCollectionActive: false,
    allowPaymentMethodRequired: true,
    allowFutureRecurringChargeDeferral: true,
    paymentMethodReadiness,
  })
  const gateFailures = canonicalHouseholdForwardAdoptionGateFailures({
    audit,
    localCollectors,
    scheduleInventory,
    paymentMethodReadiness,
    activationEvidence,
    verification,
  })
  const evidence = sanitizeBillingMigrationSnapshot({
    accountId: Number(accountId),
    targetMonth,
    currentSourceCollectionMode: audit.sourceCollectionMode,
    stripeCustomerId: audit.accountSnapshot?.stripeCustomerId ?? null,
    currentHouseholdMonthlyBillingEnabled:
      audit.accountSnapshot?.householdMonthlyBillingEnabled === true,
    payerAccessVerified: audit.payerValidationStatus === 'verified',
    canonicalParityMatched:
      audit.parityStatus === 'matched' && audit.paritySnapshot?.matched === true,
    canonicalBalanceVerified: canonicalAdoptionBalanceVerified(audit),
    zeroActiveLocalRecurringCollectors: localCollectors.length === 0,
    zeroActiveRemoteRecurringCollectors:
      Number(audit.initialStripeSnapshot?.customerSubscriptionInventory?.liveSubscriptionCount ?? 0) === 0
      && Number(scheduleInventory.snapshot?.liveScheduleCount ?? 0) === 0,
    householdActivationEvidenceVerified: activationEvidence.verified === true,
    activationEvidence,
    paymentMethod: {
      ready: paymentMethodReadiness.ready === true,
      reason: paymentMethodReadiness.reason ?? null,
      status: paymentMethodReadiness.ready === true ? 'ready' : 'payment_method_required',
    },
    localCollectors,
    remoteSubscriptionInventory:
      audit.initialStripeSnapshot?.customerSubscriptionInventory ?? null,
    remoteScheduleInventory: scheduleInventory.snapshot,
    verification: verification.snapshot,
    verificationHash: billingMigrationSnapshotHash(verification.snapshot),
    explicitlyReviewedAuditCodes: (audit.exceptions ?? [])
      .filter((issue) => forwardAdoptionIssueIsExplicitlyReviewed(issue, { audit, verification }))
      .map((issue) => issue.code),
    gateFailures,
  })
  return {
    audit,
    adoptionAudit: forwardAdoptionAudit(audit, { ...evidence, verification }),
    localCollectors,
    paymentMethodReadiness,
    scheduleInventory,
    activationEvidence,
    verification,
    evidence,
    gateFailures,
  }
}

async function activateForwardAdoptedAccount(db, {
  runId,
  accountId,
  migration,
  targetMonth,
  leaseOwner,
  inspection,
} = {}) {
  return withBillingAccountMigrationLock(db, accountId, async (client) => {
    let locked = await getBillingAccountMigration(client, { runId, accountId, forUpdate: true })
    if (locked.state !== S.SHADOW_VERIFIED || locked.lease_owner !== leaseOwner) {
      throw new Error('Migration state or lease changed before forward adoption.')
    }
    const account = await client.query(
      `SELECT id, family_id, payer_member_id, stripe_customer_id,
              household_monthly_billing_enabled, is_active
         FROM family_billing_account
        WHERE id = $1
        LIMIT 1
        FOR UPDATE`,
      [Number(accountId)],
    ).then((result) => result.rows[0] ?? null)
    if (!account) throw new Error(`Billing account ${accountId} was not found during forward adoption.`)
    await assertUniqueLocalStripeCustomerOwner(client, {
      accountId,
      stripeCustomerId: account.stripe_customer_id,
    })
    const frozen = inspection.audit.accountSnapshot
    if (
      Number(account.family_id) !== Number(frozen.familyId)
      || Number(account.payer_member_id) !== Number(frozen.payerMemberId)
      || String(account.stripe_customer_id ?? '') !== String(frozen.stripeCustomerId ?? '')
      || account.household_monthly_billing_enabled !== frozen.householdMonthlyBillingEnabled
    ) {
      throw new Error('Billing account identity or collection mode changed after forward-adoption inspection.')
    }
    const localCollectors = await inspectActiveLocalRecurringCollectors(client, accountId)
    if (localCollectors.length > 0) {
      throw new Error('A local recurring Stripe collector appeared before forward adoption.')
    }
    let activationEvidence = inspection.activationEvidence
    if (account.household_monthly_billing_enabled === true) {
      activationEvidence = await loadCanonicalHouseholdActivationEvidence(client, {
        accountId,
        targetMonth,
      })
      if (!activationEvidence.verified) {
        throw new Error('Pre-existing household collection lacks durable activation evidence.')
      }
    } else {
      if (inspection.audit.sourceCollectionMode !== 'manual') {
        throw new Error('Only an explicitly selected manual ledger account may be activated by forward adoption.')
      }
      const activated = await client.query(
        `UPDATE family_billing_account
            SET household_monthly_billing_enabled = TRUE,
                updated_at = now()
          WHERE id = $1
            AND household_monthly_billing_enabled = FALSE
          RETURNING id`,
        [Number(accountId)],
      )
      if (!activated.rows[0]) throw new Error('Household collection changed before explicit activation.')
      activationEvidence = explicitForwardAdoptionEvidence(accountId, targetMonth)
    }
    const durableEvidence = sanitizeBillingMigrationSnapshot({
      ...inspection.evidence,
      activationEvidence,
      householdActivationEvidenceVerified: activationEvidence.verified === true,
    })
    locked = await adoptBillingAccountMigrationHouseholdActive(client, locked, {
      leaseOwner,
      evidence: durableEvidence,
    })
    const activity = await recordBillingActivity(client, {
      eventKey: `canonical-billing-migration-household-active:${locked.id}`,
      accountId,
      eventType: 'canonical_billing_migration_household_active',
      summary: `Ledger-only household collection was explicitly adopted for ${targetMonth.slice(0, 7)}.`,
      beforeValue: {
        householdMonthlyBillingEnabled:
          inspection.audit.accountSnapshot?.householdMonthlyBillingEnabled === true,
      },
      afterValue: {
        householdMonthlyBillingEnabled: true,
        collectionMode: inspection.paymentMethodReadiness.ready
          ? 'household_monthly'
          : 'payment_method_required',
      },
      details: {
        billingMigrationRunId: Number(runId),
        accountMigrationId: Number(locked.id),
        targetMonth,
        method: 'explicit_forward_adoption',
        evidenceHash: billingMigrationSnapshotHash(durableEvidence),
      },
      actorType: 'system',
    })
    if (!activity) throw new Error('Forward adoption activity evidence was not durably recorded.')
    return locked
  })
}

async function finalizeForwardAdoptionVerification(db, {
  runId,
  accountId,
  migration,
  leaseOwner,
  verification,
} = {}) {
  return withBillingAccountMigrationLock(db, accountId, async (client) => {
    let locked = await getBillingAccountMigration(client, { runId, accountId, forUpdate: true })
    if (![S.HOUSEHOLD_ACTIVE, S.FAILED_FORWARD_ONLY].includes(locked.state)) {
      throw new Error(`Forward-adopted account cannot be verified from ${locked.state}.`)
    }
    if (locked.lease_owner !== leaseOwner) throw new Error('Migration lease changed before adoption verification.')
    const localCollectors = await inspectActiveLocalRecurringCollectors(client, accountId)
    if (localCollectors.length > 0) {
      throw new Error('A local recurring Stripe collector appeared before adoption verification.')
    }
    const items = await listBillingAccountMigrationItems(client, locked.id)
    for (const item of items) {
      await updateBillingAccountMigrationItem(client, item, {
        state: 'verified',
        targetSnapshot: {
          ...parseJson(item.target_snapshot),
          forwardAdoptionVerification: verification.snapshot,
        },
      })
    }
    locked = await updateBillingAccountMigrationEvidence(client, locked, {
      parityStatus: 'matched',
      paritySnapshot: {
        ...parseJson(locked.parity_snapshot),
        verification: verification.snapshot,
        verificationHash: billingMigrationSnapshotHash(verification.snapshot),
        verificationMethod: 'explicit_forward_adoption',
      },
      leaseOwner,
    })
    locked = await transitionBillingAccountMigration(client, locked, S.VERIFIED, { leaseOwner })
    const activity = await recordBillingActivity(client, {
      eventKey: `canonical-billing-migration-verified:${locked.id}`,
      accountId,
      eventType: 'canonical_billing_migration_verified',
      summary: 'Canonical household billing forward adoption was verified.',
      details: {
        billingMigrationRunId: Number(runId),
        accountMigrationId: Number(locked.id),
        targetMonth: verification.targetMonth,
        method: 'explicit_forward_adoption',
      },
      actorType: 'system',
    })
    if (!activity) throw new Error('Forward-adoption verification activity was not durably recorded.')
    return locked
  })
}

/**
 * Explicitly adopt accounts already operating with ledger-only collection.
 * This command never creates, updates, or repairs a Stripe subscription.
 */
export async function adoptCanonicalHouseholdBillingMigration(db, {
  runId,
  accountIds,
  stripe,
  now = new Date(),
  apply = false,
  leaseOwner = null,
  environment = process.env,
} = {}) {
  if (!stripe) throw new Error('Stripe is required to prove zero remote recurring collectors before adoption.')
  if (apply) {
    requireFlag(environment, 'BILLING_COLLECTION_CUTOVER_ENABLED', 'Canonical billing forward adoption')
    requireFlag(environment, 'BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED', 'Canonical billing forward adoption')
    requireCanonicalReadShadow(environment, 'Canonical billing forward adoption')
    requireHouseholdOnlyClassSubscriptionCreation(environment, 'Canonical billing forward adoption')
  }
  const { run, accountIds: ids } = await requireRunAndScope(db, runId, accountIds)
  assertForwardAdoptionRunAuthorization(run)
  const owner = workerName(leaseOwner)
  const accounts = []
  let cohortStop = null
  for (let accountIndex = 0; accountIndex < ids.length; accountIndex += 1) {
    const accountId = ids[accountIndex]
    let migration = await getBillingAccountMigration(db, { runId, accountId })
    try {
      if (!migration) throw new Error(`Run does not contain billing account ${accountId}.`)
      if (apply) migration = await claimBillingAccountMigration(db, { runId, accountId, leaseOwner: owner })
      if (![S.DISCOVERED, S.REPAIRING, S.BLOCKED, S.SHADOW_VERIFIED].includes(migration.state)) {
        throw new Error(`Account ${accountId} cannot be forward-adopted from ${migration.state}.`)
      }
      const targetMonth = billingDateString(migration.cutover_month)
      const result = await withBillingAccountCollectionLock(db, accountId, async (lockedDb) => {
        const inspection = await inspectForwardAdoptionAccount(lockedDb, stripe, {
          run,
          migration,
          accountId,
          targetMonth,
          now,
        })
        const progress = {
          accountId,
          initialState: migration.state,
          targetMonth,
          sourceCollectionMode: inspection.audit.sourceCollectionMode,
          paymentMethodStatus: inspection.paymentMethodReadiness.ready
            ? 'ready'
            : 'payment_method_required',
          gateFailures: inspection.gateFailures,
          activationEvidence: inspection.activationEvidence,
          verification: inspection.verification,
          wouldActivate: inspection.audit.accountSnapshot?.householdMonthlyBillingEnabled !== true,
        }
        if (inspection.gateFailures.length > 0) {
          if (apply) {
            const error = new BillingMigrationSafetyError(
              'forward_adoption_preflight_failed',
              `Forward adoption failed ${inspection.gateFailures.length} safety gate(s).`,
              {
                gateFailures: inspection.gateFailures,
                auditExceptionCodes: (inspection.audit.exceptions ?? []).map((issue) => issue.code),
                verificationIssues: inspection.verification.issues,
              },
            )
            error.preserveMigrationState = true
            throw error
          }
          return { ...progress, eligible: false, state: migration.state }
        }
        if (!apply) return { ...progress, eligible: true, state: migration.state }

        await resolveClearedBillingMigrationExceptions(lockedDb, {
          runId,
          accountMigrationId: migration.id,
          activeDedupeKeys: [],
          dedupePrefix: `account:${accountId}:operation:forward_adoption_`,
        })
        migration = await persistAudit(lockedDb, {
          runId,
          audit: inspection.adoptionAudit,
          leaseOwner: owner,
        })
        if (migration.state !== S.SHADOW_VERIFIED) {
          throw new Error(`Forward adoption audit did not reach ${S.SHADOW_VERIFIED}.`)
        }
        if (String(migration.accepted_snapshot_hash ?? '') !== String(inspection.audit.snapshotHash)) {
          migration = await acceptBillingAccountMigrationBaseline(lockedDb, migration, {
            snapshotHash: inspection.audit.snapshotHash,
            accountSnapshot: inspection.audit.accountSnapshot,
            pricingSnapshot: inspection.audit.pricingSnapshot,
            ledgerSnapshot: inspection.audit.ledgerSnapshot,
            stripeSnapshot: inspection.audit.initialStripeSnapshot,
            rollbackSnapshot: inspection.audit.rollbackSnapshot,
            leaseOwner: owner,
          })
        }
        migration = await activateForwardAdoptedAccount(lockedDb, {
          runId,
          accountId,
          migration,
          targetMonth,
          leaseOwner: owner,
          inspection,
        })

        const postInspection = await inspectForwardAdoptionAccount(lockedDb, stripe, {
          run,
          migration,
          accountId,
          targetMonth,
          now,
        })
        if (postInspection.gateFailures.length > 0 || !postInspection.verification.verified) {
          throw new BillingMigrationSafetyError(
            'forward_adoption_verification_failed',
            'Forward adoption changed state but failed final canonical verification.',
            {
              gateFailures: postInspection.gateFailures,
              verificationIssues: postInspection.verification.issues,
            },
            { forwardOnly: true },
          )
        }
        migration = await finalizeForwardAdoptionVerification(lockedDb, {
          runId,
          accountId,
          migration,
          leaseOwner: owner,
          verification: postInspection.verification,
        })
        return {
          ...progress,
          eligible: true,
          activated: progress.wouldActivate,
          verified: true,
          verification: postInspection.verification,
          state: migration.state,
        }
      })
      accounts.push(result)
    } catch (error) {
      if (apply && migration) {
        await recordOperationFailure(db, { runId, accountId, migration, error, leaseOwner: owner })
      }
      accounts.push({
        accountId,
        state: 'error',
        eligible: false,
        error: error.message,
        code: error.code ?? null,
      })
      if (apply) {
        cohortStop = cohortStopAfterFailure(ids, accountIndex, {
          accountId,
          code: error.code ?? 'forward_adoption_failed',
          error: error.message,
        })
        break
      }
    } finally {
      if (apply && migration?.id) {
        await releaseBillingAccountMigrationLease(db, {
          migrationId: migration.id,
          leaseOwner: owner,
        }).catch(() => {})
      }
    }
  }
  const completedRun = apply && !cohortStop ? await finishRunWhenTerminal(db, runId) : null
  return commandResult('adopt', apply, accounts, {
    runId: Number(runId),
    runStatus: completedRun?.status ?? null,
    cohortStopped: cohortStop != null,
    cohortStop,
  })
}

export async function advanceCanonicalBillingMigration(db, {
  runId,
  accountIds,
  stripe,
  now = new Date(),
  apply = false,
  leaseOwner = null,
  environment = process.env,
} = {}) {
  if (!stripe) throw new Error('Stripe is required to advance a canonical billing migration.')
  if (apply) {
    requireFlag(environment, 'BILLING_COLLECTION_CUTOVER_ENABLED', 'Canonical billing cutover')
    requireCanonicalReadShadow(environment, 'Canonical billing cutover')
    requireHouseholdOnlyClassSubscriptionCreation(environment, 'Canonical billing cutover')
  }
  const { run, accountIds: ids } = await requireRunAndScope(db, runId, accountIds)
  const owner = workerName(leaseOwner)
  const accounts = []
  let cohortStop = null
  for (let accountIndex = 0; accountIndex < ids.length; accountIndex += 1) {
    const accountId = ids[accountIndex]
    let migration = await getBillingAccountMigration(db, { runId, accountId })
    if (!migration) {
      const failure = { accountId, state: 'missing', error: 'Run does not contain this billing account.' }
      accounts.push(failure)
      cohortStop = {
        failedAccountId: accountId,
        code: 'migration_account_missing',
        error: failure.error,
        unprocessedAccountIds: ids.slice(accountIndex + 1),
      }
      break
    }
    try {
      if (apply) migration = await claimBillingAccountMigration(db, { runId, accountId, leaseOwner: owner })
      const targetMonth = billingDateString(migration.cutover_month)
      const timezone = acceptedMigrationPricingSnapshot(migration).timezone
      let collectionMonth = billingDateString(
        parseJson(migration.parity_snapshot).collectionDeferredToMonth,
      ) ?? targetMonth
      const boundary = {
        ...validateBillingTargetMonth(targetMonth, { timeZone: timezone, now }),
        timeZone: timezone,
      }
      const progress = {
        accountId,
        initialState: migration.state,
        targetMonth,
        collectionMonth,
        boundaryReached: boundary.boundaryReached,
      }
      let guard = 0
      while (guard < 8) {
        guard += 1
        if (migration.state === S.ARMED) {
          const scheduled = await scheduleAccountCutover(db, stripe, migration, {
            runId, accountId, targetMonth, boundary, leaseOwner: owner, apply,
          })
          Object.assign(progress, { scheduled: scheduled.scheduled, wouldSchedule: scheduled.wouldSchedule })
          migration = scheduled.migration
          if (!apply) break
          continue
        }
        if (migration.state === S.CANCELLATION_SCHEDULED) {
          if (boundary.boundaryReached) {
            const recovered = await recoverBoundaryRetirementBeforeDetachment(db, stripe, migration, {
              runId, accountId, targetMonth, boundary, leaseOwner: owner, apply,
            })
            progress.recoveredBoundaryDetachment = recovered.detached
            progress.wouldRecoverBoundaryDetachment = recovered.wouldDetach
            progress.remoteStatusesAtRecovery = recovered.preflight.subscriptions.map((entry) => ({
              id: entry.mapping.stripeSubscriptionId,
              status: entry.snapshot.status,
            }))
            migration = recovered.migration
            if (!apply) break
            continue
          }
          const revalidation = await revalidateBeforeDetachment(db, stripe, migration, {
            run, runId, accountId, targetMonth, boundary, now, leaseOwner: owner, apply,
          })
          Object.assign(progress, {
            secondsUntilBoundary: revalidation.secondsUntilBoundary,
            boundaryRevalidatedAt: revalidation.revalidatedAt ?? null,
            boundaryRevalidationHash: revalidation.revalidationHash ?? null,
          })
          migration = revalidation.migration
          if (!revalidation.readyToDetach) {
            progress.waitingForRevalidationWindow = true
            break
          }
          const detached = await detachLocalCollection(db, migration, {
            runId, accountId, leaseOwner: owner, apply,
          })
          progress.detached = detached.detached
          progress.wouldDetach = detached.wouldDetach
          migration = detached.migration
          if (!apply) break
          continue
        }
        if (migration.state === S.DETACHED) {
          if (!boundary.boundaryReached) {
            progress.waitingForBoundary = true
            break
          }
          const invoiceReview = await inspectAndVoidLegacyInvoices(db, stripe, migration, {
            accountId, targetMonth, boundary, apply,
          })
          progress.legacyInvoices = invoiceReview
          if (invoiceReview.reviewRequired) {
            // Voiding is an explicit, separately observable operator step. A
            // later advance re-reads the remote invoice before retirement.
            progress.waitingForReviewedInvoiceAdvance = true
            break
          }
          const releasedDeferral = await releaseProcessingCollectionDeferral(db, migration, {
            runId,
            accountId,
            targetMonth,
            invoiceReview,
            leaseOwner: owner,
            apply,
          })
          if (releasedDeferral.released || releasedDeferral.wouldRelease) {
            migration = releasedDeferral.migration
            collectionMonth = targetMonth
            progress.collectionMonth = collectionMonth
            progress.processingCollectionDeferralReleased = releasedDeferral.released
            progress.wouldReleaseProcessingCollectionDeferral = releasedDeferral.wouldRelease
          }
          if (invoiceReview.deferToMonth) {
            collectionMonth = billingDateString(invoiceReview.deferToMonth)
            progress.collectionMonth = collectionMonth
            progress.collectionDeferred = true
            if (apply) {
              migration = await persistCollectionDeferral(db, migration, {
                runId,
                accountId,
                targetMonth,
                invoiceReview,
                leaseOwner: owner,
              })
            }
            if (invoiceReview.disposition === 'processing_defer_next_month') {
              progress.waitingForLegacyInvoiceSettlement = true
              break
            }
            if (invoiceReview.disposition === 'paid_defer_next_month') {
              if (!apply) {
                progress.wouldSettlePaidLegacyInvoices = true
                break
              }
              const settlement = await settlePaidTargetMonthLegacyInvoices(db, stripe, migration, {
                accountId,
                targetMonth,
                boundary,
                now,
              })
              progress.paidLegacyInvoiceSettlement = settlement
              migration = await persistPaidLegacyInvoiceSettlement(db, migration, settlement, {
                leaseOwner: owner,
              })
            }
          }
          const retired = await retireRemoteCollection(db, stripe, migration, {
            runId, accountId, targetMonth, leaseOwner: owner, apply,
          })
          progress.retired = retired.retired
          progress.wouldRetire = retired.wouldRetire
          migration = retired.migration
          if (!apply) break
          continue
        }
        if (migration.state === S.FAILED_FORWARD_ONLY) {
          if (!apply) {
            progress.forwardOnlyResumeRequired = true
            break
          }
          const resumed = await resumeForwardOnlyState(db, stripe, migration, {
            runId, accountId, targetMonth, leaseOwner: owner, apply,
          })
          migration = resumed.migration
          progress.resumedAt = resumed.resumeAt
          continue
        }
        if (migration.state === S.REMOTE_RETIRED) {
          const invoiceReview = await inspectAndVoidLegacyInvoices(db, stripe, migration, {
            accountId, targetMonth, boundary, apply,
          })
          progress.legacyInvoicesAfterRetirement = invoiceReview
          if (invoiceReview.reviewRequired) {
            progress.waitingForReviewedInvoiceAdvance = true
            break
          }
          const releasedDeferral = await releaseProcessingCollectionDeferral(db, migration, {
            runId,
            accountId,
            targetMonth,
            invoiceReview,
            leaseOwner: owner,
            apply,
          })
          if (releasedDeferral.released || releasedDeferral.wouldRelease) {
            migration = releasedDeferral.migration
            collectionMonth = targetMonth
            progress.collectionMonth = collectionMonth
            progress.processingCollectionDeferralReleased = releasedDeferral.released
            progress.wouldReleaseProcessingCollectionDeferral = releasedDeferral.wouldRelease
          }
          if (invoiceReview.deferToMonth) {
            collectionMonth = billingDateString(invoiceReview.deferToMonth)
            progress.collectionMonth = collectionMonth
            if (apply && parseJson(migration.parity_snapshot).collectionDeferredToMonth !== collectionMonth) {
              migration = await persistCollectionDeferral(db, migration, {
                runId,
                accountId,
                targetMonth,
                invoiceReview,
                leaseOwner: owner,
              })
            }
            if (invoiceReview.disposition === 'processing_defer_next_month') {
              progress.waitingForLegacyInvoiceSettlement = true
              break
            }
            if (invoiceReview.disposition === 'paid_defer_next_month') {
              if (!apply) {
                progress.wouldSettlePaidLegacyInvoices = true
                break
              }
              const settlement = await settlePaidTargetMonthLegacyInvoices(db, stripe, migration, {
                accountId,
                targetMonth,
                boundary,
                now,
              })
              progress.paidLegacyInvoiceSettlement = settlement
              migration = await persistPaidLegacyInvoiceSettlement(db, migration, settlement, {
                leaseOwner: owner,
              })
            }
          }
          const collectionBoundary = validateBillingTargetMonth(collectionMonth, {
            timeZone: timezone,
            now,
          })
          if (!collectionBoundary.boundaryReached) {
            progress.waitingForDeferredCollectionMonth = true
            progress.collectionBoundaryUnix = collectionBoundary.boundaryUnix
            break
          }
          if (apply) {
            requireFlag(environment, 'BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED', 'Household billing activation')
            requireFlag(environment, 'BILLING_HOUSEHOLD_INVOICE_ENABLED', 'Household invoice creation')
          }
          const activated = await activateHouseholdCollection(db, stripe, migration, {
            runId, accountId, targetMonth: collectionMonth, leaseOwner: owner, apply, environment,
          })
          progress.invoice = activated.invoice ?? null
          progress.wouldActivate = activated.wouldActivate
          migration = activated.migration
          if (!apply) break
          continue
        }
        if (migration.state === S.HOUSEHOLD_ACTIVE) {
          if (apply) requireFlag(environment, 'BILLING_HOUSEHOLD_INVOICE_ENABLED', 'Household invoice creation')
          const ensured = await ensureHouseholdCollectionInvoice(db, migration, {
            accountId, targetMonth: collectionMonth, now, apply, environment,
          })
          progress.invoice = ensured.invoice ?? null
          progress.recurringCharges = ensured.recurringCharges ?? null
          progress.wouldEnsureInvoice = ensured.wouldEnsureInvoice
          break
        }
        break
      }
      progress.state = migration.state
      accounts.push(progress)
    } catch (error) {
      if (apply && migration) {
        await recordOperationFailure(db, { runId, accountId, migration, error, leaseOwner: owner })
      }
      // The cohort is the rollout safety unit. Once one account fails, later
      // accounts must remain untouched until the operator reviews and re-audits.
      const failure = { accountId, state: 'error', error: error.message, code: error.code ?? null, forwardOnly: error.forwardOnly === true }
      accounts.push(failure)
      cohortStop = {
        failedAccountId: accountId,
        code: failure.code ?? 'migration_operation_failed',
        error: failure.error,
        unprocessedAccountIds: ids.slice(accountIndex + 1),
      }
      break
    } finally {
      if (apply && migration?.id) {
        await releaseBillingAccountMigrationLease(db, { migrationId: migration.id, leaseOwner: owner }).catch(() => {})
      }
    }
  }
  return commandResult('advance', apply, accounts, {
    runId: Number(runId),
    cohortStopped: cohortStop != null,
    cohortStop,
  })
}

export async function verifyCanonicalBillingAccount(db, {
  migration,
  stripe,
  now = new Date(),
  billingMonth = null,
  inspectCollectorInventory = true,
  requireHouseholdCollectionActive = true,
  allowPaymentMethodRequired = false,
  allowFutureRecurringChargeDeferral = false,
  paymentMethodReadiness = null,
  recurringChargeInspector = reconcileCanonicalRecurringChargesForMonth,
} = {}) {
  const accountId = Number(migration.family_billing_account_id)
  const paritySnapshot = parseJson(migration.parity_snapshot)
  const targetMonth = billingDateString(billingMonth) ??
    billingDateString(paritySnapshot.collectionDeferredToMonth) ??
    billingDateString(migration.cutover_month)
  const timezone = paritySnapshot.timezone
  const boundary = validateBillingTargetMonth(targetMonth, { timeZone: timezone, now })
  const [account, localSubscriptions, invoiceRows, collectibleBalanceCents, items] = await Promise.all([
    db.query(`SELECT * FROM family_billing_account WHERE id = $1 LIMIT 1`, [accountId]).then((result) => result.rows[0] ?? null),
    db.query(
      `SELECT id, status, next_bill_date, stripe_subscription_id,
              stripe_subscription_item_id, stripe_subscription_schedule_id
         FROM billing_subscription subscription
        WHERE subscription.family_billing_account_id = $1
        ORDER BY id`,
      [accountId],
    ).then((result) => result.rows),
    db.query(
	      `SELECT invoice.*,
	              COALESCE(lines.line_total_cents, 0)::bigint AS line_total_cents,
	              COALESCE(lines.line_subtotal_cents, 0)::bigint AS line_subtotal_cents,
	              COALESCE(lines.line_credit_cents, 0)::bigint AS line_credit_cents,
	              COALESCE(lines.line_count, 0)::int AS line_count,
                  COALESCE(lines.invalid_source_count, 0)::int AS invalid_source_count,
                  COALESCE(credit_applications.applied_cents, 0)::bigint AS credit_applied_cents,
                  COALESCE(credit_applications.application_count, 0)::int AS credit_application_count,
              COALESCE(lines.invoice_lines, '[]'::jsonb) AS invoice_lines
         FROM billing_monthly_invoice invoice
         LEFT JOIN LATERAL (
           SELECT SUM(line.amount_cents)::bigint AS line_total_cents,
                  SUM(line.amount_cents) FILTER (WHERE line.line_type = 'charge')::bigint AS line_subtotal_cents,
                  SUM(ABS(line.amount_cents)) FILTER (WHERE line.line_type = 'credit')::bigint AS line_credit_cents,
                  COUNT(*)::int AS line_count,
                  COUNT(*) FILTER (WHERE
                    (
                      (line.billing_charge_id IS NULL AND line.billing_payment_id IS NULL)
                      OR
                      (line.billing_charge_id IS NOT NULL AND line.billing_payment_id IS NOT NULL)
                    )
                    OR
                    (
                      line.billing_charge_id IS NOT NULL
                      AND NOT EXISTS (
                        SELECT 1
                          FROM billing_charge source_charge
                         WHERE source_charge.id = line.billing_charge_id
                           AND source_charge.family_billing_account_id = invoice.family_billing_account_id
                           AND (
                             (line.line_type = 'charge'
                               AND source_charge.amount_cents > 0
                               AND line.amount_cents > 0
                               AND line.amount_cents <= source_charge.amount_cents)
                             OR
                             (line.line_type = 'credit'
                               AND source_charge.amount_cents < 0
                               AND line.amount_cents < 0
                               AND ABS(line.amount_cents) <= ABS(source_charge.amount_cents))
                           )
                      )
                    )
                    OR
                    (
                      line.billing_payment_id IS NOT NULL
                      AND NOT EXISTS (
                        SELECT 1
                          FROM billing_payment source_payment
                         WHERE source_payment.id = line.billing_payment_id
                           AND source_payment.family_billing_account_id = invoice.family_billing_account_id
                           AND source_payment.external_status IN ('settled', 'succeeded')
                           AND line.line_type = 'credit'
                           AND line.amount_cents < 0
                           AND ABS(line.amount_cents) <= source_payment.amount_cents
                      )
                    )
                  )::int AS invalid_source_count,
                  jsonb_agg(jsonb_build_object(
                    'id', line.id,
                    'billingChargeId', line.billing_charge_id,
                    'amountCents', line.amount_cents,
                    'stripeInvoiceItemId', line.stripe_invoice_item_id
                  ) ORDER BY line.id) AS invoice_lines
             FROM billing_monthly_invoice_line line
            WHERE line.billing_monthly_invoice_id = invoice.id
         ) lines ON TRUE
         LEFT JOIN LATERAL (
           SELECT SUM(application.amount_cents)::bigint AS applied_cents,
                  COUNT(*)::int AS application_count
             FROM billing_charge_credit_application application
            WHERE application.billing_monthly_invoice_id = invoice.id
         ) credit_applications ON TRUE
        WHERE invoice.family_billing_account_id = $1 AND invoice.billing_month = $2::date
        ORDER BY invoice.id`,
      [accountId, targetMonth],
    ).then((result) => result.rows),
    loadCanonicalCollectibleBalanceCents(db, accountId),
    listBillingAccountMigrationItems(db, migration.id),
  ])
  const issues = []
  let recurringChargeParity = null
  if (allowFutureRecurringChargeDeferral && !boundary.boundaryReached) {
    // Forward adoption can be verified before the target billing month. The
    // immutable audit already freezes target-month parity; recurring charges
    // are still reconciled and posted by the boundary-time worker.
    recurringChargeParity = {
      verified: true,
      issues: [],
      deferredUntil: targetMonth,
      reason: 'target_month_not_reached',
    }
  } else {
    try {
      recurringChargeParity = await recurringChargeInspector(db, {
        accountId,
        billingMonth: targetMonth,
        facilityTimeZone: timezone,
        now,
        apply: false,
      })
      issues.push(...(recurringChargeParity.issues ?? []))
    } catch (error) {
      const parityIssues = error instanceof BillingMigrationSafetyError
        ? error.details?.issues ?? []
        : []
      if (parityIssues.length > 0) {
        issues.push(...parityIssues)
      } else {
        issues.push({
          code: error.code ?? 'target_month_recurring_charge_parity_failed',
          message: error.message,
          details: error.details ?? {},
        })
      }
    }
  }
  if (!account || (
    requireHouseholdCollectionActive && account.household_monthly_billing_enabled !== true
  )) {
    issues.push({ code: 'household_collection_not_active', message: 'Household monthly billing is not enabled.' })
  }
  const attached = localSubscriptions.filter((row) =>
    row.stripe_subscription_id || row.stripe_subscription_item_id || row.stripe_subscription_schedule_id,
  )
  if (attached.length) {
    issues.push({ code: 'local_legacy_collection_attached', message: 'One or more local legacy Stripe links remain.', subscriptionIds: attached.map((row) => Number(row.id)) })
  }
  for (const item of collectionMigrationItems(items, { remoteOnly: true })) {
    const source = parseJson(item.source_snapshot)
    const stripeSubscriptionId = source.local?.stripeSubscriptionId ?? item.source_id
    try {
      const remote = await retrieveStripeSubscriptionSnapshot(stripe, stripeSubscriptionId)
      if (!['canceled', 'incomplete_expired'].includes(remote.snapshot.status)) {
        issues.push({ code: 'remote_legacy_subscription_active', message: `Stripe subscription ${stripeSubscriptionId} is still ${remote.snapshot.status}.`, stripeSubscriptionId })
      }
    } catch (error) {
      if (!(error instanceof BillingMigrationSafetyError && error.code === 'stripe_subscription_missing')) throw error
    }
  }
  if (invoiceRows.length > 1) {
    issues.push({ code: 'duplicate_household_invoice', message: 'More than one household invoice exists for the target month.' })
  }
  const remoteInvoiceSnapshots = []
  const paymentMethodMayRemainRequired = allowPaymentMethodRequired === true
    && paymentMethodReadiness?.ready !== true
    && ['payment_method_required', 'stripe_customer_missing'].includes(
      String(paymentMethodReadiness?.reason ?? ''),
    )
  for (const invoice of invoiceRows) {
    if (
      cents(invoice.subtotal_cents) !== cents(invoice.line_subtotal_cents)
      || cents(invoice.credit_cents) !== cents(invoice.line_credit_cents)
      || cents(invoice.total_cents) !== cents(invoice.line_total_cents)
    ) {
      issues.push({ code: 'household_invoice_line_mismatch', message: `Household invoice ${invoice.id} does not equal its immutable charge and credit lines.`, invoiceId: Number(invoice.id) })
    }
    if (cents(invoice.total_cents) !== Math.max(0, cents(invoice.subtotal_cents) - cents(invoice.credit_cents))) {
      issues.push({ code: 'household_invoice_total_mismatch', message: `Household invoice ${invoice.id} total is inconsistent.`, invoiceId: Number(invoice.id) })
    }
    if (
      invoice.status === 'paid'
      && cents(invoice.credit_applied_cents) !== cents(invoice.credit_cents)
    ) {
      issues.push({
        code: 'household_invoice_credit_allocation_mismatch',
        message: `Paid household invoice ${invoice.id} does not have exact durable credit allocations.`,
        invoiceId: Number(invoice.id),
        expectedCreditCents: cents(invoice.credit_cents),
        allocatedCreditCents: cents(invoice.credit_applied_cents),
      })
    }
    if (Number(invoice.invalid_source_count ?? 0) > 0) {
      issues.push({
        code: 'household_invoice_line_ownership_mismatch',
        message: `Household invoice ${invoice.id} contains a line not exactly owned by its canonical account source.`,
        invoiceId: Number(invoice.id),
        invalidSourceCount: Number(invoice.invalid_source_count),
      })
    }
    const localPaymentMethodRequired = paymentMethodMayRemainRequired
      && invoice.status === 'payment_method_required'
      && !invoice.stripe_invoice_id
    const remoteVerification = localPaymentMethodRequired
      ? {
          verified: true,
          issues: [],
          snapshot: {
            stripeInvoiceId: null,
            itemCount: 0,
            status: 'payment_method_required',
            localOnly: true,
          },
        }
      : await inspectStripeHouseholdInvoice(stripe, {
          accountId,
          stripeCustomerId: account?.stripe_customer_id ?? null,
          billingMonth: targetMonth,
          invoice: {
            id: Number(invoice.id),
            status: invoice.status,
            stripeInvoiceId: invoice.stripe_invoice_id ?? null,
            subtotalCents: cents(invoice.subtotal_cents),
            totalCents: cents(invoice.total_cents),
          },
          lines: (invoice.invoice_lines ?? []).map((line) => ({
            id: Number(line.id),
            billingChargeId: line.billingChargeId == null ? null : Number(line.billingChargeId),
            amountCents: cents(line.amountCents),
            stripeInvoiceItemId: line.stripeInvoiceItemId ?? null,
          })),
        })
    issues.push(...remoteVerification.issues)
    remoteInvoiceSnapshots.push(remoteVerification.snapshot)
  }
  if (boundary.boundaryReached && invoiceRows.length === 0) {
    // Positive tuition can legitimately need no Stripe invoice when credits or
    // prior payments fully allocate it. Missing recurring charges are already
    // rejected by recurringChargeParity; only a positive collectible remainder
    // requires a household invoice here.
    if (Number(collectibleBalanceCents) > 0 && !paymentMethodMayRemainRequired) {
      issues.push({ code: 'household_invoice_missing', message: 'A collectible balance exists but no target-month household invoice was created.', openChargeCents: cents(collectibleBalanceCents) })
    }
  }
  let collectorInventory = null
  if (inspectCollectorInventory) {
    const inventory = await inspectStripeCustomerBillingMonthCollectors(stripe, {
      stripeCustomerId: account?.stripe_customer_id ?? null,
      billingMonth: targetMonth,
      facilityTimezone: timezone,
      expectedStripeInvoiceIds: invoiceRows.map((invoice) => invoice.stripe_invoice_id).filter(Boolean),
      excludedSubscriptionIds: [],
    })
    issues.push(...inventory.issues)
    collectorInventory = inventory.snapshot
  }
  return {
    verified: issues.length === 0,
    accountId,
    targetMonth,
    boundaryReached: boundary.boundaryReached,
    issues,
    snapshot: sanitizeBillingMigrationSnapshot({
      householdMonthlyBillingEnabled: account?.household_monthly_billing_enabled === true,
      localSubscriptionCount: localSubscriptions.length,
      attachedLocalSubscriptionIds: attached.map((row) => Number(row.id)),
      targetInvoices: invoiceRows.map((row) => ({
        id: Number(row.id), status: row.status, subtotalCents: cents(row.subtotal_cents),
        creditCents: cents(row.credit_cents), totalCents: cents(row.total_cents),
        lineSubtotalCents: cents(row.line_subtotal_cents),
        lineCreditCents: cents(row.line_credit_cents),
        lineTotalCents: cents(row.line_total_cents), lineCount: Number(row.line_count),
        stripeInvoiceId: row.stripe_invoice_id ?? null,
      })),
      remoteTargetInvoices: remoteInvoiceSnapshots,
      paymentMethod: {
        ready: paymentMethodReadiness?.ready === true,
        status: paymentMethodReadiness == null
          ? 'not_inspected'
          : paymentMethodMayRemainRequired ? 'payment_method_required' : 'ready',
        reason: paymentMethodReadiness?.reason ?? null,
      },
      collectorInventory,
      recurringChargeParity,
      openUninvoicedCharges: {
        count: Number(collectibleBalanceCents) > 0 ? 1 : 0,
        cents: cents(collectibleBalanceCents),
      },
    }),
  }
}

function cents(value) {
  return Math.round(Number(value) || 0)
}

export async function supersedeShadowVerifiedBillingMigrationAudit(db, {
  runId,
  accountIds,
  apply = false,
  leaseOwner = null,
  environment = process.env,
} = {}) {
  if (apply) requireFlag(environment, 'BILLING_COLLECTION_CUTOVER_ENABLED', 'Shadow-audit supersession')
  const { run, accountIds: ids } = await requireRunAndScope(db, runId, accountIds, {
    requireExactAccountScope: true,
  })
  if (run.configuration?.forwardAdoption !== true) {
    throw new Error('Only an explicit forward-adoption audit run may be superseded.')
  }
  const owner = workerName(leaseOwner)
  const accounts = []
  for (const accountId of ids) {
    let migration = await getBillingAccountMigration(db, { runId, accountId })
    if (!migration) {
      accounts.push({ accountId, state: 'missing' })
      continue
    }
    try {
      const eligible = migration.state === S.SHADOW_VERIFIED && [
        migration.armed_at,
        migration.cancellation_scheduled_at,
        migration.detached_at,
        migration.remote_retired_at,
        migration.household_activated_at,
      ].every((value) => value == null)
      if (!eligible) {
        throw new BillingMigrationSafetyError(
          'shadow_audit_supersession_forbidden',
          `Account ${accountId} is not an untouched shadow-verified audit record.`,
          { state: migration.state },
          { preserveMigrationState: true },
        )
      }
      if (!apply) {
        accounts.push({ accountId, state: migration.state, wouldSupersede: true })
        continue
      }
      migration = await withBillingAccountCollectionLock(db, accountId, async (lockedDb) => {
        let locked = await claimBillingAccountMigration(lockedDb, {
          runId,
          accountId,
          leaseOwner: owner,
        })
        const untouched = locked.state === S.SHADOW_VERIFIED && [
          locked.armed_at,
          locked.cancellation_scheduled_at,
          locked.detached_at,
          locked.remote_retired_at,
          locked.household_activated_at,
        ].every((value) => value == null)
        if (!untouched) {
          throw new BillingMigrationSafetyError(
            'shadow_audit_supersession_concurrent_change',
            `Account ${accountId} changed while its shadow audit was being superseded.`,
            { state: locked.state },
            { preserveMigrationState: true },
          )
        }
        locked = await transitionBillingAccountMigration(lockedDb, locked, S.ROLLED_BACK, {
          leaseOwner: owner,
          lastError: 'Superseded before activation because the immutable release contract changed.',
        })
        await recordBillingActivityBestEffort(lockedDb, {
          eventKey: `canonical-billing-migration-shadow-audit-superseded:${locked.id}`,
          accountId,
          eventType: 'canonical_billing_migration_shadow_audit_superseded',
          summary: 'Shadow-only canonical billing audit was superseded before activation.',
          details: { billingMigrationRunId: Number(runId), accountMigrationId: Number(locked.id) },
          actorType: 'system',
        })
        return locked
      })
      accounts.push({ accountId, state: migration.state, superseded: true })
    } catch (error) {
      accounts.push({ accountId, state: 'error', error: error.message, code: error.code ?? null })
      if (apply) break
    } finally {
      if (apply && migration?.id) {
        await releaseBillingAccountMigrationLease(db, { migrationId: migration.id, leaseOwner: owner }).catch(() => {})
      }
    }
  }
  const completedRun = apply ? await finishRunWhenTerminal(db, runId) : null
  return commandResult('supersede-audit', apply, accounts, {
    runId: Number(runId),
    runStatus: completedRun?.status ?? null,
  })
}

async function finishRunWhenTerminal(db, runId) {
  const result = await db.query(
    `SELECT COUNT(*) FILTER (WHERE state NOT IN ('verified', 'rolled_back'))::int AS non_terminal,
            COUNT(*) FILTER (WHERE state = 'failed_forward_only')::int AS failed_forward,
            COUNT(*)::int AS total
       FROM billing_account_migration
      WHERE billing_migration_run_id = $1`,
    [Number(runId)],
  )
  const summary = result.rows[0] ?? { non_terminal: 0, failed_forward: 0, total: 0 }
  if (Number(summary.total) === 0 || Number(summary.non_terminal) > 0) return null
  const exceptions = await db.query(
    `SELECT COUNT(*)::int AS count FROM billing_migration_exception
      WHERE billing_migration_run_id = $1 AND status IN ('open', 'acknowledged')`,
    [Number(runId)],
  )
  return finishBillingMigrationRun(db, runId, {
    status: Number(exceptions.rows[0]?.count ?? 0) > 0 ? 'completed_with_exceptions' : 'completed',
    summary: {
      accounts: Number(summary.total),
      failedForwardOnly: Number(summary.failed_forward),
      openExceptions: Number(exceptions.rows[0]?.count ?? 0),
    },
  })
}

export async function verifyCanonicalBillingMigration(db, {
  runId,
  accountIds,
  stripe,
  now = new Date(),
  apply = false,
  leaseOwner = null,
  environment = process.env,
} = {}) {
  if (!stripe) throw new Error('Stripe is required to verify a canonical billing migration.')
  if (apply) requireFlag(environment, 'BILLING_COLLECTION_CUTOVER_ENABLED', 'Canonical billing verification')
  const { accountIds: ids } = await requireRunAndScope(db, runId, accountIds)
  const owner = workerName(leaseOwner)
  const accounts = []
  let cohortStop = null
  for (let accountIndex = 0; accountIndex < ids.length; accountIndex += 1) {
    const accountId = ids[accountIndex]
    let migration = await getBillingAccountMigration(db, { runId, accountId })
    if (!migration) {
      accounts.push({ accountId, state: 'missing' })
      if (apply) {
        cohortStop = cohortStopAfterFailure(ids, accountIndex, {
          accountId,
          code: 'migration_account_missing',
          error: 'Run does not contain this billing account.',
        })
        break
      }
      continue
    }
    try {
      if (apply) migration = await claimBillingAccountMigration(db, { runId, accountId, leaseOwner: owner })
      if (![S.HOUSEHOLD_ACTIVE, S.FAILED_FORWARD_ONLY, S.VERIFIED].includes(migration.state)) {
        throw new Error(`Account ${accountId} cannot be verified from ${migration.state}.`)
      }
      const performVerification = async (verificationDb) => {
        const verification = await verifyCanonicalBillingAccount(verificationDb, {
          migration,
          stripe,
          now,
          inspectCollectorInventory: true,
        })
        if (apply && verification.verified && migration.state !== S.VERIFIED) {
          const items = await listBillingAccountMigrationItems(verificationDb, migration.id)
          for (const item of items) {
            await updateBillingAccountMigrationItem(verificationDb, item, {
              state: 'verified',
              targetSnapshot: { ...parseJson(item.target_snapshot), verification: verification.snapshot },
            })
          }
          // The surrounding session lock spans remote inspection and this
          // short local transaction. Stripe calls never run inside the xact.
          migration = await withBillingAccountMigrationLock(verificationDb, accountId, async (client) => {
            let locked = await getBillingAccountMigration(client, { runId, accountId, forUpdate: true })
            locked = await updateBillingAccountMigrationEvidence(client, locked, {
              parityStatus: 'matched',
              paritySnapshot: {
                ...parseJson(locked.parity_snapshot),
                verification: verification.snapshot,
                verificationHash: billingMigrationSnapshotHash(verification.snapshot),
              },
              leaseOwner: owner,
            })
            locked = await transitionBillingAccountMigration(client, locked, S.VERIFIED, { leaseOwner: owner })
            await recordBillingActivityBestEffort(client, {
              eventKey: `canonical-billing-migration-verified:${locked.id}`,
              accountId,
              eventType: 'canonical_billing_migration_verified',
              summary: 'Canonical household billing cutover was verified.',
              details: { billingMigrationRunId: Number(runId), accountMigrationId: Number(locked.id), targetMonth: verification.targetMonth },
              actorType: 'system',
            })
            return locked
          })
        } else if (apply && !verification.verified) {
          throw new BillingMigrationSafetyError(
            'migration_verification_failed',
            `Canonical billing verification failed with ${verification.issues.length} issue(s).`,
            { issues: verification.issues },
            { forwardOnly: true },
          )
        }
        return verification
      }
      const verification = apply
        ? await withHouseholdMonthlyInvoiceAccountLock(db, accountId, performVerification)
        : await performVerification(db)
      accounts.push({ accountId, state: migration.state, ...verification })
    } catch (error) {
      if (apply && migration) {
        await recordOperationFailure(db, { runId, accountId, migration, error, leaseOwner: owner })
      }
      accounts.push({ accountId, state: 'error', error: error.message, code: error.code ?? null })
      if (apply) {
        cohortStop = cohortStopAfterFailure(ids, accountIndex, {
          accountId,
          code: error.code ?? 'migration_verification_failed',
          error: error.message,
        })
        break
      }
    } finally {
      if (apply && migration?.id) {
        await releaseBillingAccountMigrationLease(db, { migrationId: migration.id, leaseOwner: owner }).catch(() => {})
      }
    }
  }
  const completedRun = apply ? await finishRunWhenTerminal(db, runId) : null
  return commandResult('verify', apply, accounts, {
    runId: Number(runId),
    runStatus: completedRun?.status ?? null,
    cohortStopped: cohortStop != null,
    cohortStop,
  })
}

export async function clearRemoteCollectionForRollback(db, stripe, migration, {
  accountId,
  targetMonth,
  boundaryUnix,
  leaseOwner = null,
} = {}) {
  const items = collectionMigrationItems(
    await listBillingAccountMigrationItems(db, migration.id),
    { remoteOnly: true },
  )
  const preflight = await inspectRemoteCutoverReversibility(stripe, items, {
    boundaryUnix,
    forwardOnlyOnMappingFailure: migration.state === S.DETACHED || migration.state === S.ROLLBACK_PENDING,
  })
  if (preflight.hasIrreversibleRetirement) {
    throw new BillingMigrationSafetyError(
      'rollback_after_remote_retirement_forbidden',
      'At least one Stripe subscription is already retired; recovery must continue forward.',
      {
        subscriptions: preflight.subscriptions.map((entry) => ({
          id: entry.mapping.stripeSubscriptionId,
          status: entry.snapshot.status,
        })),
      },
      { forwardOnly: true },
    )
  }
  if (!preflight.allReversible) {
    const error = new BillingMigrationSafetyError(
      'rollback_remote_preflight_failed',
      'Every Stripe subscription must be active and have no cancellation other than the frozen cutover boundary.',
      {
        subscriptions: preflight.subscriptions.map((entry) => ({
          id: entry.mapping.stripeSubscriptionId,
          status: entry.snapshot.status,
          cancelAt: entry.snapshot.cancelAt ?? null,
        })),
      },
    )
    error.preserveMigrationState = true
    throw error
  }

  let cleared = 0
  let current = migration
  for (const entry of preflight.subscriptions) {
    const { item, mapping, snapshot } = entry
    const target = parseJson(item.target_snapshot)
    const cancellationOwnedByMigration = target.cancellationOwnedByMigration === true || (
      mapping.source.remote?.cancelAt == null && target.cancellationOwnedByMigration !== false
    )
    if (snapshot.cancelAt != null && !cancellationOwnedByMigration) {
      const error = new BillingMigrationSafetyError(
        'rollback_cancellation_not_owned',
        `Rollback refused to clear a cancellation it did not create for ${mapping.stripeSubscriptionId}.`,
        { subscriptionId: mapping.stripeSubscriptionId, cancelAt: snapshot.cancelAt },
      )
      error.preserveMigrationState = true
      throw error
    }
    if (leaseOwner) {
      current = await renewBillingAccountMigrationLease(db, {
        migrationId: current.id,
        leaseOwner,
      })
    }
    const outcome = await clearStripeSubscriptionCutover(stripe, {
      subscriptionId: mapping.stripeSubscriptionId,
      boundaryUnix,
      idempotencyKey: `billing-cutover:${accountId}:${targetMonth}:rollback:${mapping.stripeSubscriptionId}`,
    })
    if (leaseOwner) {
      current = await renewBillingAccountMigrationLease(db, {
        migrationId: current.id,
        leaseOwner,
      })
    }
    await updateBillingAccountMigrationItem(db, item, {
      state: 'rollback_required',
      targetSnapshot: {
        ...target,
        rollbackBefore: outcome.before,
        rollbackAfter: outcome.after,
        rollbackRemoteClearedAt: target.rollbackRemoteClearedAt ?? new Date().toISOString(),
      },
    })
    cleared += outcome.changed ? 1 : 0
  }

  const refreshedItems = collectionMigrationItems(
    await listBillingAccountMigrationItems(db, migration.id),
    { remoteOnly: true },
  )
  const postflight = await inspectRemoteCutoverReversibility(stripe, refreshedItems, {
    boundaryUnix,
    forwardOnlyOnMappingFailure: migration.state === S.DETACHED || migration.state === S.ROLLBACK_PENDING,
  })
  if (postflight.hasIrreversibleRetirement) {
    throw new BillingMigrationSafetyError(
      'rollback_remote_retired_during_clear',
      'A Stripe subscription retired while rollback cancellations were being cleared; recovery must continue forward.',
      {},
      { forwardOnly: true },
    )
  }
  if (!postflight.allReversible || postflight.subscriptions.some((entry) => entry.snapshot.cancelAt != null)) {
    const error = new BillingMigrationSafetyError(
      'rollback_remote_clear_unconfirmed',
      'Stripe rollback was not confirmed for every frozen subscription.',
      {},
    )
    error.preserveMigrationState = true
    throw error
  }
  return { cleared, preflight, postflight }
}

export async function restoreFrozenLocalCollectionAfterRollback(db, migration, {
  runId,
  accountId,
  targetMonth,
  leaseOwner,
} = {}) {
  return withBillingAccountMigrationLock(db, accountId, async (client) => {
    let locked = await getBillingAccountMigration(client, { runId, accountId, forUpdate: true })
    if (!PRE_CANCEL_ROLLBACK_STATES.has(locked.state) || locked.lease_owner !== leaseOwner) {
      throw new Error('Migration state or lease changed before local rollback restoration.')
    }
    const account = await client.query(
      `SELECT household_monthly_billing_enabled FROM family_billing_account WHERE id = $1 FOR UPDATE`,
      [accountId],
    ).then((result) => result.rows[0] ?? null)
    if (account?.household_monthly_billing_enabled === true) {
      throw new BillingMigrationSafetyError(
        'rollback_after_household_activation_forbidden',
        'Household collection is already active; rollback would risk duplicate or missing collection.',
        {},
        { forwardOnly: true },
      )
    }
    if (locked.state !== S.ROLLBACK_PENDING) {
      locked = await transitionBillingAccountMigration(client, locked, S.ROLLBACK_PENDING, { leaseOwner })
    }
    const items = collectionMigrationItems(
      await listBillingAccountMigrationItems(client, locked.id),
      { remoteOnly: true },
    )
    for (const item of items) {
      const { local, localId } = frozenCollectionMapping(item)
      const subscription = await client.query(
        `SELECT stripe_subscription_id, stripe_subscription_item_id,
                stripe_subscription_schedule_id, price_sync_status
           FROM billing_subscription
          WHERE id = $1 AND family_billing_account_id = $2
          FOR UPDATE`,
        [localId, Number(accountId)],
      ).then((result) => result.rows[0] ?? null)
      const expected = [
        local.stripeSubscriptionId ?? null,
        local.stripeSubscriptionItemId ?? null,
        local.stripeSubscriptionScheduleId ?? null,
      ]
      const actual = subscription ? [
        subscription.stripe_subscription_id ?? null,
        subscription.stripe_subscription_item_id ?? null,
        subscription.stripe_subscription_schedule_id ?? null,
      ] : []
      const exact = subscription && actual.every((value, index) => value === expected[index])
      const fullyDetached = subscription && actual.every((value) => value == null)
      if (!exact && !fullyDetached) {
        const error = new BillingMigrationSafetyError(
          'rollback_local_links_changed',
          'Local Stripe links differ from both the detached state and the exact frozen mapping.',
          { billingSubscriptionId: localId, expected, actual },
        )
        error.preserveMigrationState = true
        throw error
      }
      if (fullyDetached) {
        const restored = await client.query(
          `UPDATE billing_subscription
              SET stripe_subscription_id = $2,
                  stripe_subscription_item_id = $3,
                  stripe_subscription_schedule_id = $4,
                  price_sync_status = $5,
                  price_sync_error = NULL,
                  updated_at = now()
            WHERE id = $1
              AND stripe_subscription_id IS NULL
              AND stripe_subscription_item_id IS NULL
              AND stripe_subscription_schedule_id IS NULL
            RETURNING id`,
          [
            localId,
            expected[0],
            expected[1],
            expected[2],
            local.priceSyncStatus ?? 'not_required',
          ],
        )
        if (!restored.rows[0]) throw new Error(`Local billing subscription ${localId} changed during rollback restoration.`)
      }
      const currentItem = await listBillingAccountMigrationItems(client, locked.id)
        .then((rows) => rows.find((row) => Number(row.id) === Number(item.id)))
      await updateBillingAccountMigrationItem(client, currentItem, {
        state: 'rolled_back',
        targetSnapshot: {
          ...parseJson(currentItem.target_snapshot),
          localLinksRestored: true,
          rolledBackAt: parseJson(currentItem.target_snapshot).rolledBackAt ?? new Date().toISOString(),
        },
      })
    }
    locked = await getBillingAccountMigration(client, { runId, accountId, forUpdate: true })
    locked = await transitionBillingAccountMigration(client, locked, S.ROLLED_BACK, { leaseOwner })
    await recordBillingActivityBestEffort(client, {
      eventKey: `canonical-billing-migration-rolled-back:${locked.id}`,
      accountId,
      eventType: 'canonical_billing_migration_rolled_back',
      summary: 'Scheduled canonical billing cutover was rolled back before remote cancellation.',
      details: { billingMigrationRunId: Number(runId), accountMigrationId: Number(locked.id), targetMonth },
      actorType: 'system',
    })
    return locked
  })
}

export async function rollbackCanonicalBillingMigration(db, {
  runId,
  accountIds,
  stripe,
  apply = false,
  leaseOwner = null,
  environment = process.env,
} = {}) {
  if (!stripe) throw new Error('Stripe is required to rollback a scheduled billing cutover.')
  if (apply) requireFlag(environment, 'BILLING_COLLECTION_CUTOVER_ENABLED', 'Canonical billing rollback')
  const { accountIds: ids } = await requireRunAndScope(db, runId, accountIds)
  const owner = workerName(leaseOwner)
  const accounts = []
  for (const accountId of ids) {
    let migration = await getBillingAccountMigration(db, { runId, accountId })
    if (!migration) {
      accounts.push({ accountId, state: 'missing' })
      continue
    }
    try {
      if (!PRE_CANCEL_ROLLBACK_STATES.has(migration.state)) {
        throw new Error(`Rollback is allowed only while every frozen Stripe subscription remains reversible; account ${accountId} is ${migration.state}.`)
      }
      const targetMonth = billingDateString(migration.cutover_month)
      const timezone = acceptedMigrationPricingSnapshot(migration).timezone
      const boundaryUnix = zonedDateStartUnix(targetMonth, timezone)
      if (!apply) {
        const items = collectionMigrationItems(
          await listBillingAccountMigrationItems(db, migration.id),
          { remoteOnly: true },
        )
        const preflight = await inspectRemoteCutoverReversibility(stripe, items, { boundaryUnix })
        accounts.push({
          accountId,
          state: migration.state,
          wouldRollback: preflight.allReversible && !preflight.hasIrreversibleRetirement,
          stripeSubscriptions: items.length,
          remoteStatuses: preflight.subscriptions.map((entry) => ({
            id: entry.mapping.stripeSubscriptionId,
            status: entry.snapshot.status,
            cancelAt: entry.snapshot.cancelAt ?? null,
          })),
        })
        continue
      }
      const rollback = await withBillingAccountCollectionLock(db, accountId, async (lockedDb) => {
        let locked = await claimBillingAccountMigration(lockedDb, {
          runId,
          accountId,
          leaseOwner: owner,
        })
        if (!PRE_CANCEL_ROLLBACK_STATES.has(locked.state)) {
          throw new Error(
            `Rollback is allowed only while every frozen Stripe subscription remains reversible; account ${accountId} is ${locked.state}.`,
          )
        }
        // Publish rollback intent before the first remote mutation. Because
        // scheduling uses this same session lock, a stale scheduler can no
        // longer add a cancellation after rollback preflight/clear completes.
        if (locked.state !== S.ROLLBACK_PENDING) {
          locked = await transitionBillingAccountMigration(
            lockedDb,
            locked,
            S.ROLLBACK_PENDING,
            { leaseOwner: owner },
          )
        }
        const remoteRollback = await clearRemoteCollectionForRollback(lockedDb, stripe, locked, {
          accountId,
          targetMonth,
          boundaryUnix,
          leaseOwner: owner,
        })
        locked = await getBillingAccountMigration(lockedDb, { runId, accountId })
        locked = await restoreFrozenLocalCollectionAfterRollback(lockedDb, locked, {
          runId,
          accountId,
          targetMonth,
          leaseOwner: owner,
        })
        return { migration: locked, remoteRollback }
      })
      migration = rollback.migration
      accounts.push({
        accountId,
        state: migration.state,
        rolledBack: true,
        stripeCancellationsCleared: rollback.remoteRollback.cleared,
      })
    } catch (error) {
      if (apply && migration) {
        await recordOperationFailure(db, { runId, accountId, migration, error, leaseOwner: owner })
      }
      accounts.push({ accountId, state: 'error', error: error.message, code: error.code ?? null })
    } finally {
      if (apply && migration?.id) {
        await releaseBillingAccountMigrationLease(db, { migrationId: migration.id, leaseOwner: owner }).catch(() => {})
      }
    }
  }
  const completedRun = apply ? await finishRunWhenTerminal(db, runId) : null
  return commandResult('rollback', apply, accounts, { runId: Number(runId), runStatus: completedRun?.status ?? null })
}
