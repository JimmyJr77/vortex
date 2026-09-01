import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const migration = fs.readFileSync(
  path.join(testDirectory, '../../migrations/778_billing_canonical_migration_state.sql'),
  'utf8',
)
const lifecycleMigration = fs.readFileSync(
  path.join(testDirectory, '../../migrations/780_scheduling_enrollment_lifecycle_schema.sql'),
  'utf8',
)
const canonicalContractMigration = fs.readFileSync(
  path.join(testDirectory, '../../migrations/781_billing_canonical_migration_contract.sql'),
  'utf8',
)
const dropInPagingMigration = fs.readFileSync(
  path.join(testDirectory, '../../migrations/783_member_billing_drop_in_paging_index.sql'),
  'utf8',
)
const householdDefaultRemediationMigration = fs.readFileSync(
  path.join(testDirectory, '../../migrations/786_billing_household_default_remediation.sql'),
  'utf8',
)
const durableSafetyMigration = fs.readFileSync(
  path.join(testDirectory, '../../migrations/785_billing_migration_durable_safety.sql'),
  'utf8',
)
const paymentAttemptReservationMigration = fs.readFileSync(
  path.join(testDirectory, '../../migrations/789_billing_payment_attempt_reservations.sql'),
  'utf8',
)
const subscriptionClaimMigration = fs.readFileSync(
  path.join(testDirectory, '../../migrations/790_billing_migration_subscription_claims.sql'),
  'utf8',
)
const acceptedBaselineMigration = fs.readFileSync(
  path.join(testDirectory, '../../migrations/791_billing_migration_accepted_baselines.sql'),
  'utf8',
)
const paymentSettlementMigration = fs.readFileSync(
  path.join(testDirectory, '../../migrations/797_billing_payment_settlement_and_pass_idempotency.sql'),
  'utf8',
)

test('canonical billing migration state owns the required durable records', () => {
  for (const table of [
    'billing_migration_run',
    'billing_account_migration',
    'billing_account_migration_item',
    'billing_migration_exception',
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`))
  }
  for (const state of [
    'discovered', 'repairing', 'blocked', 'shadow_verified', 'armed',
    'cancellation_scheduled', 'detached', 'remote_retired', 'household_active',
    'verified', 'rollback_pending', 'rolled_back', 'failed_forward_only',
  ]) {
    assert.match(migration, new RegExp(`'${state}'`))
  }
  assert.match(migration, /lease_owner\s+TEXT/)
  assert.match(migration, /lease_expires_at\s+TIMESTAMPTZ/)
  assert.match(migration, /lock_version\s+INTEGER NOT NULL DEFAULT 0/)
  assert.match(migration, /UNIQUE \(billing_migration_run_id, dedupe_key\)/)
  assert.match(migration, /FOREIGN KEY \(billing_account_migration_id, billing_migration_run_id\)/)
})

test('payment allocation no longer executes billing migrations during requests', () => {
  const source = fs.readFileSync(path.join(testDirectory, '../paymentAllocation.js'), 'utf8')
  assert.doesNotMatch(source, /readFileSync/)
  assert.doesNotMatch(source, /774_household_monthly_invoicing/)
})

test('enrollment lifecycle migration owns every column formerly added by requests', () => {
  for (const column of [
    'completed_at',
    'paused_at',
    'manual_discount_cents',
    'manual_discount_pct',
    'manual_discount_reason',
    'manual_discount_rule_id',
    'cancel_effective_date',
    'cancel_requested_at',
    'pause_effective_date',
    'pause_mode',
    'enrollment_start_date',
  ]) {
    assert.match(lifecycleMigration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`))
  }
  for (const status of ['confirmed', 'waitlisted', 'cancelled', 'paused', 'completed']) {
    assert.match(lifecycleMigration, new RegExp(`'${status}'`))
  }
  assert.match(lifecycleMigration, /scheduling_signup_status_check/)
})

test('canonical migration contract adds explicit immutable cutover evidence', () => {
  for (const column of [
    'facility_id',
    'target_month',
    'account_snapshot',
    'pricing_snapshot',
    'ledger_snapshot',
    'initial_stripe_snapshot',
    'snapshot_hash',
    'billing_subscription_id',
    'former_stripe_subscription_id',
    'local_next_bill_date',
    'remote_cancel_at',
  ]) {
    assert.match(canonicalContractMigration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`))
  }
  assert.match(canonicalContractMigration, /reject_billing_migration_initial_snapshot_mutation/)
  assert.match(canonicalContractMigration, /uq_billing_account_migration_one_active/)
})

test('member audit paging has a targeted drop-in date index', () => {
  assert.match(dropInPagingMigration, /idx_drop_in_registration_member_class_date/)
  assert.match(dropInPagingMigration, /member_id, class_date DESC, id DESC/)
  assert.match(dropInPagingMigration, /status IN \('confirmed', 'attended'\)/)
})

test('household default remediation audits every decision and preserves only durable evidence', () => {
  assert.match(householdDefaultRemediationMigration, /SET DEFAULT FALSE/)
  assert.match(householdDefaultRemediationMigration, /CREATE TABLE IF NOT EXISTS billing_household_default_remediation_audit/)
  assert.match(householdDefaultRemediationMigration, /WHERE account\.household_monthly_billing_enabled = TRUE/)
  assert.match(householdDefaultRemediationMigration, /household_activated_at IS NOT NULL/)
  assert.match(householdDefaultRemediationMigration, /'canonical_billing_migration_household_active'/)
  assert.match(householdDefaultRemediationMigration, /'legacy_class_stripe_subscription_retired'/)
  assert.match(householdDefaultRemediationMigration, /'stripe_class_subscription_retired'/)
  assert.match(householdDefaultRemediationMigration, /class_subscription\.stripe_subscription_id/)
  assert.match(householdDefaultRemediationMigration, /FROM billing_monthly_invoice monthly_invoice/)
  assert.match(householdDefaultRemediationMigration, /'implicit_default_without_cutover_evidence'/)
  assert.match(householdDefaultRemediationMigration, /SET household_monthly_billing_enabled = FALSE/)
  assert.doesNotMatch(householdDefaultRemediationMigration, /DELETE FROM/)
})

test('durable migration safety freezes provenance and item mappings', () => {
  assert.match(durableSafetyMigration, /billing_migration_run_apply_provenance_check/)
  assert.match(durableSafetyMigration, /manifest_checksum ~ '\^\[0-9a-f\]\{64\}\$'/)
  assert.match(durableSafetyMigration, /reject_billing_migration_run_contract_mutation/)
  assert.match(durableSafetyMigration, /canonical billing migration items are append-only/)
  assert.match(durableSafetyMigration, /target evidence cannot be removed/)
  assert.match(durableSafetyMigration, /idx_billing_migration_item_remote_lookup/)
})

test('payment attempt reservations are durable, exact, and immutable', () => {
  assert.match(paymentAttemptReservationMigration, /CREATE TABLE IF NOT EXISTS billing_payment_attempt \(/)
  assert.match(paymentAttemptReservationMigration, /CREATE TABLE IF NOT EXISTS billing_payment_attempt_charge \(/)
  assert.match(paymentAttemptReservationMigration, /UNIQUE \(family_billing_account_id, attempt_type, request_key\)/)
  assert.match(paymentAttemptReservationMigration, /UNIQUE INDEX IF NOT EXISTS uq_billing_payment_attempt_checkout_session/)
  assert.match(paymentAttemptReservationMigration, /UNIQUE INDEX IF NOT EXISTS uq_billing_payment_attempt_payment_intent/)
  assert.match(paymentAttemptReservationMigration, /reject_billing_payment_attempt_charge_mutation/)
  assert.match(paymentAttemptReservationMigration, /validate_billing_payment_application_capacity/)
  assert.match(paymentAttemptReservationMigration, /applied_cents > received_cents/)
  assert.match(paymentAttemptReservationMigration, /DEFERRABLE INITIALLY DEFERRED/)
  assert.doesNotMatch(paymentAttemptReservationMigration, /ON DELETE CASCADE/)
})

test('subscription migration identifiers use atomic durable account ownership claims', () => {
  assert.match(subscriptionClaimMigration, /CREATE TABLE IF NOT EXISTS billing_migration_subscription_claim/)
  assert.match(subscriptionClaimMigration, /PRIMARY KEY \(claim_kind, claim_value\)/)
  assert.match(subscriptionClaimMigration, /AFTER INSERT OR UPDATE OF billing_subscription_id, former_stripe_subscription_id/)
  assert.match(subscriptionClaimMigration, /ON CONFLICT \(claim_kind, claim_value\) DO NOTHING/)
  assert.match(subscriptionClaimMigration, /claimed_account_id <> owner_account_id/)
  assert.match(subscriptionClaimMigration, /subscription ownership claims are immutable/)
})

test('accepted repair baselines preserve initial evidence in append-only versions', () => {
  assert.match(acceptedBaselineMigration, /accepted_baseline_version/)
  assert.match(acceptedBaselineMigration, /CREATE TABLE IF NOT EXISTS billing_account_migration_baseline/)
  assert.match(acceptedBaselineMigration, /UNIQUE \(billing_account_migration_id, baseline_version\)/)
  assert.match(acceptedBaselineMigration, /accepted baseline versions must advance by exactly one/)
  assert.match(acceptedBaselineMigration, /accepted baseline cannot change after cutover is armed/)
  assert.match(acceptedBaselineMigration, /accepted baseline requires the active account migration lease/)
  assert.match(acceptedBaselineMigration, /accepted baseline history is append-only/)
  assert.doesNotMatch(acceptedBaselineMigration, /DELETE FROM/)
})

test('payment settlement and pass replay evidence are fail closed', () => {
  assert.match(paymentSettlementMigration, /SET external_status = 'settled'/)
  assert.match(paymentSettlementMigration, /lower\(btrim\(external_status\)\) IN \(''[^)]*'recorded'/)
  assert.match(paymentSettlementMigration, /ALTER COLUMN external_status SET DEFAULT 'settled'/)
  assert.match(paymentSettlementMigration, /billing_payment_external_status_check/)
  assert.match(paymentSettlementMigration, /'settled'/)
  assert.match(paymentSettlementMigration, /'succeeded'/)
  assert.match(paymentSettlementMigration, /ADD COLUMN IF NOT EXISTS idempotency_fingerprint TEXT/)
  assert.match(paymentSettlementMigration, /idempotency_fingerprint ~ '\^\[0-9a-f\]\{64\}\$'/)
  assert.doesNotMatch(paymentSettlementMigration, /DELETE FROM/)
})
