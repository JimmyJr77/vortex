import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEPLOY_BILLING_COLUMNS,
  DEPLOY_BILLING_CONSTRAINTS,
  DEPLOY_BILLING_DEFAULTS,
  DEPLOY_BILLING_FUNCTIONS,
  DEPLOY_BILLING_MIGRATIONS,
  DEPLOY_BILLING_RELATIONS,
  DEPLOY_BILLING_TRIGGERS,
  REQUIRED_BILLING_COLUMNS,
  REQUIRED_BILLING_CONSTRAINTS,
  REQUIRED_BILLING_DEFAULTS,
  REQUIRED_BILLING_FUNCTIONS,
  REQUIRED_BILLING_MIGRATIONS,
  REQUIRED_BILLING_RELATIONS,
  REQUIRED_BILLING_TRIGGERS,
  assertDeployBillingSchema,
  assertRequiredBillingSchema,
  getDeployBillingSchemaReadiness,
  getRequiredBillingSchemaReadiness,
} from '../billingSchemaReadiness.js'

function readinessPool({
  applied = REQUIRED_BILLING_MIGRATIONS,
  missingRelations = [],
  missingColumns = [],
  invalidDefaults = [],
  missingTriggers = [],
  missingFunctions = [],
  missingConstraints = [],
} = {}) {
  return {
    async query(sql) {
      const text = String(sql)
      if (text.includes('FROM schema_migrations')) {
        return { rows: applied.map((filename) => ({ filename })) }
      }
      if (text.includes('to_regclass')) {
        return { rows: missingRelations.map((object_name) => ({ object_name })) }
      }
      if (text.includes('pg_attrdef')) {
        return {
          rows: invalidDefaults.map(({ column, expected = 'false', actual = null }) => {
            const [table_name, column_name] = column.split('.')
            return {
              table_name,
              column_name,
              expected_expression: expected,
              actual_expression: actual,
            }
          }),
        }
      }
      if (text.includes('pg_trigger')) {
        return {
          rows: missingTriggers.map((value) => {
            const [table_name, trigger_name] = value.split('.')
            return { table_name, trigger_name }
          }),
        }
      }
      if (text.includes('pg_proc')) {
        return { rows: missingFunctions.map((function_name) => ({ function_name })) }
      }
      if (text.includes('pg_constraint')) {
        return {
          rows: missingConstraints.map((value) => {
            const [table_name, constraint_name] = value.split('.')
            return { table_name, constraint_name }
          }),
        }
      }
      if (text.includes('information_schema.columns')) {
        return {
          rows: missingColumns.map((value) => {
            const [table_name, column_name] = value.split('.')
            return { table_name, column_name }
          }),
        }
      }
      throw new Error(`Unexpected readiness query: ${text}`)
    },
  }
}

test('required billing schema reports ready only when every request dependency exists', async () => {
  const readiness = await getRequiredBillingSchemaReadiness(readinessPool())
  assert.deepEqual(readiness, {
    ready: true,
    missingMigrations: [],
    missingRelations: [],
    missingColumns: [],
    invalidDefaults: [],
    missingTriggers: [],
    missingFunctions: [],
    missingConstraints: [],
  })
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('billing_account_migration_item'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('100_stripe_pending_enrollment_client_confirmed.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('780_scheduling_enrollment_lifecycle_schema.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('781_billing_canonical_migration_contract.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('782_billing_legacy_endpoint_traffic.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('783_member_billing_drop_in_paging_index.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('784_billing_household_default_off.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('785_billing_migration_durable_safety.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('786_billing_household_default_remediation.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('787_billing_pause_credit_schema.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('788_billing_retirement_evidence.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('789_billing_payment_attempt_reservations.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('790_billing_migration_subscription_claims.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('791_billing_migration_accepted_baselines.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('792_billing_monthly_invoice_charge_credits.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('793_billing_webhook_claim_leases.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('794_billing_payment_attempt_reconciliation_fairness.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('795_billing_household_invoice_credit_applications.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('796_billing_retirement_invoice_parity.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('797_billing_payment_settlement_and_pass_idempotency.sql'))
  assert.ok(REQUIRED_BILLING_MIGRATIONS.includes('798_checkout_fulfillment_idempotency.sql'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('billing_legacy_endpoint_monitor'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('billing_legacy_endpoint_traffic'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('drop_in_registration'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('billing_household_default_remediation_audit'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('billing_pause_credit'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('billing_legacy_telemetry_heartbeat'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('billing_cycle_verification_evidence'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('billing_payment_attempt'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('billing_payment_attempt_charge'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('billing_migration_subscription_claim'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('idx_billing_migration_subscription_claim_account'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('billing_account_migration_baseline'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('idx_billing_account_migration_baseline_latest'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('idx_stripe_webhook_event_processing_lease'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('idx_billing_payment_attempt_reconcile_round_robin'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('billing_charge_credit_application'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('idx_billing_charge_credit_application_target_line'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('annual_membership_checkout_request'))
  assert.ok(REQUIRED_BILLING_RELATIONS.includes('annual_membership_checkout_promo_reservation'))
  assert.ok(REQUIRED_BILLING_TRIGGERS.some(({ triggerName }) => (
    triggerName === 'trg_billing_migration_initial_snapshot_immutable'
  )))
  assert.ok(REQUIRED_BILLING_TRIGGERS.some(({ triggerName }) => (
    triggerName === 'trg_billing_payment_application_capacity'
  )))
  assert.ok(REQUIRED_BILLING_TRIGGERS.some(({ triggerName }) => (
    triggerName === 'trg_billing_migration_subscription_claim'
  )))
  assert.ok(REQUIRED_BILLING_TRIGGERS.some(({ triggerName }) => (
    triggerName === 'trg_billing_migration_accepted_baseline_capture'
  )))
  assert.ok(REQUIRED_BILLING_TRIGGERS.some(({ triggerName }) => (
    triggerName === 'trg_billing_monthly_invoice_line_ownership'
  )))
  assert.ok(REQUIRED_BILLING_TRIGGERS.some(({ triggerName }) => (
    triggerName === 'trg_billing_charge_credit_application_capacity'
  )))
  assert.ok(REQUIRED_BILLING_TRIGGERS.some(({ triggerName }) => (
    triggerName === 'trg_annual_membership_checkout_request_terms'
  )))
  assert.ok(REQUIRED_BILLING_FUNCTIONS.includes('reject_billing_payment_attempt_charge_mutation'))
  assert.ok(REQUIRED_BILLING_FUNCTIONS.includes('guard_annual_membership_checkout_request_terms'))
  assert.ok(REQUIRED_BILLING_FUNCTIONS.includes('validate_billing_payment_attempt_reservation_total'))
  assert.ok(REQUIRED_BILLING_FUNCTIONS.includes('validate_billing_payment_application_capacity'))
  assert.ok(REQUIRED_BILLING_FUNCTIONS.includes('claim_billing_migration_subscription_mapping'))
  assert.ok(REQUIRED_BILLING_FUNCTIONS.includes('reject_billing_migration_subscription_claim_mutation'))
  assert.ok(REQUIRED_BILLING_FUNCTIONS.includes('initialize_billing_migration_accepted_baseline'))
  assert.ok(REQUIRED_BILLING_FUNCTIONS.includes('validate_billing_migration_accepted_baseline'))
  assert.ok(REQUIRED_BILLING_FUNCTIONS.includes('capture_billing_migration_accepted_baseline'))
  assert.ok(REQUIRED_BILLING_FUNCTIONS.includes('reject_billing_migration_baseline_mutation'))
  assert.ok(REQUIRED_BILLING_FUNCTIONS.includes('validate_billing_monthly_invoice_line_ownership'))
  assert.ok(REQUIRED_BILLING_FUNCTIONS.includes('validate_billing_charge_credit_application_capacity'))
  assert.ok(REQUIRED_BILLING_CONSTRAINTS.some(({ constraintName }) => (
    constraintName === 'billing_migration_run_apply_provenance_check'
  )))
  assert.ok(REQUIRED_BILLING_CONSTRAINTS.some(({ constraintName }) => (
    constraintName === 'billing_monthly_invoice_line_source_check'
  )))
  assert.ok(REQUIRED_BILLING_CONSTRAINTS.some(({ constraintName }) => (
    constraintName === 'uq_billing_charge_credit_application_idempotency'
  )))
  assert.ok(REQUIRED_BILLING_CONSTRAINTS.some(({ constraintName }) => (
    constraintName === 'billing_cycle_verification_three_way_invoice_parity_check'
  )))
  assert.ok(REQUIRED_BILLING_COLUMNS.some(({ tableName, columnName }) => (
    tableName === 'billing_cycle_verification_evidence' && columnName === 'local_invoice_line_credit_cents'
  )))
  assert.ok(REQUIRED_BILLING_COLUMNS.some(({ tableName, columnName }) => (
    tableName === 'billing_account_migration' && columnName === 'accepted_snapshot_hash'
  )))
  assert.ok(REQUIRED_BILLING_COLUMNS.some(({ tableName, columnName }) => (
    tableName === 'billing_account_migration' && columnName === 'accepted_rollback_snapshot'
  )))
  assert.ok(REQUIRED_BILLING_COLUMNS.some(({ tableName, columnName }) => (
    tableName === 'billing_account_migration_baseline' && columnName === 'rollback_snapshot'
  )))
  assert.ok(REQUIRED_BILLING_COLUMNS.some(({ tableName, columnName }) => (
    tableName === 'stripe_webhook_event' && columnName === 'claim_token'
  )))
  assert.ok(REQUIRED_BILLING_COLUMNS.some(({ tableName, columnName }) => (
    tableName === 'billing_payment_attempt' && columnName === 'last_reconciled_at'
  )))
  assert.ok(REQUIRED_BILLING_COLUMNS.some(({ tableName, columnName }) => (
    tableName === 'stripe_pending_enrollment' && columnName === 'client_confirmed_at'
  )))
  assert.deepEqual(REQUIRED_BILLING_DEFAULTS, [
    {
      tableName: 'family_billing_account',
      columnName: 'household_monthly_billing_enabled',
      expectedExpression: 'false',
    },
    {
      tableName: 'billing_payment',
      columnName: 'external_status',
      expectedExpression: "'settled'::text",
    },
  ])
})

test('deploy readiness remains scoped to the explicit fail-closed allowlist', async () => {
  const pool = readinessPool({ applied: DEPLOY_BILLING_MIGRATIONS })
  const readiness = await getDeployBillingSchemaReadiness(pool)
  assert.equal(readiness.ready, true)
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('780_scheduling_enrollment_lifecycle_schema.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('781_billing_canonical_migration_contract.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('782_billing_legacy_endpoint_traffic.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('783_member_billing_drop_in_paging_index.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('784_billing_household_default_off.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('785_billing_migration_durable_safety.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('786_billing_household_default_remediation.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('787_billing_pause_credit_schema.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('788_billing_retirement_evidence.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('789_billing_payment_attempt_reservations.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('790_billing_migration_subscription_claims.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('791_billing_migration_accepted_baselines.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('792_billing_monthly_invoice_charge_credits.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('793_billing_webhook_claim_leases.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('794_billing_payment_attempt_reconciliation_fairness.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('795_billing_household_invoice_credit_applications.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('796_billing_retirement_invoice_parity.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('797_billing_payment_settlement_and_pass_idempotency.sql'))
  assert.ok(DEPLOY_BILLING_MIGRATIONS.includes('798_checkout_fulfillment_idempotency.sql'))
  assert.ok(DEPLOY_BILLING_RELATIONS.includes('idx_drop_in_registration_member_class_date'))
  assert.ok(DEPLOY_BILLING_RELATIONS.includes('idx_billing_household_default_remediation_account'))
  assert.ok(DEPLOY_BILLING_RELATIONS.includes('idx_billing_pause_credit_apply'))
  assert.ok(DEPLOY_BILLING_RELATIONS.includes('idx_billing_cycle_verification_latest'))
  assert.ok(DEPLOY_BILLING_RELATIONS.includes('idx_billing_payment_attempt_account_status'))
  assert.ok(DEPLOY_BILLING_RELATIONS.includes('uq_stripe_pending_enrollment_request'))
  assert.ok(DEPLOY_BILLING_RELATIONS.includes('annual_membership_checkout_request'))
  assert.deepEqual(DEPLOY_BILLING_TRIGGERS, REQUIRED_BILLING_TRIGGERS)
  assert.deepEqual(DEPLOY_BILLING_FUNCTIONS, REQUIRED_BILLING_FUNCTIONS)
  assert.deepEqual(DEPLOY_BILLING_CONSTRAINTS, REQUIRED_BILLING_CONSTRAINTS)
  assert.ok(DEPLOY_BILLING_COLUMNS.some(({ tableName, columnName }) => (
    tableName === 'scheduling_signup' && columnName === 'pause_effective_date'
  )))
  assert.ok(DEPLOY_BILLING_COLUMNS.some(({ tableName, columnName }) => (
    tableName === 'billing_cycle_verification_evidence' && columnName === 'facility_timezone'
  )))
  assert.deepEqual(DEPLOY_BILLING_DEFAULTS, REQUIRED_BILLING_DEFAULTS)
  assert.deepEqual(await assertDeployBillingSchema(pool), readiness)
})

test('required billing schema fails closed with exact missing contracts', async () => {
  const pool = readinessPool({
    applied: REQUIRED_BILLING_MIGRATIONS.slice(0, 1),
    missingRelations: ['billing_account_migration'],
    missingColumns: ['family_billing_account.household_monthly_billing_enabled'],
    invalidDefaults: [{
      column: 'family_billing_account.household_monthly_billing_enabled',
      actual: 'true',
    }],
    missingTriggers: ['billing_account_migration.trg_billing_migration_initial_snapshot_immutable'],
    missingFunctions: ['validate_billing_payment_attempt_reservation_total'],
    missingConstraints: ['billing_migration_run.billing_migration_run_apply_provenance_check'],
  })
  const readiness = await getRequiredBillingSchemaReadiness(pool)
  assert.equal(readiness.ready, false)
  assert.deepEqual(readiness.missingMigrations, REQUIRED_BILLING_MIGRATIONS.slice(1))
  await assert.rejects(
    assertRequiredBillingSchema(pool),
    (error) => {
      assert.equal(error.code, 'BILLING_SCHEMA_NOT_READY')
      assert.match(error.message, /billing_account_migration/)
      assert.match(error.message, /household_monthly_billing_enabled/)
      assert.match(error.message, /expected false, found true/)
      assert.match(error.message, /trg_billing_migration_initial_snapshot_immutable/)
      assert.match(error.message, /validate_billing_payment_attempt_reservation_total/)
      assert.match(error.message, /billing_migration_run_apply_provenance_check/)
      return true
    },
  )
})

test('required billing readiness fails closed when a critical trigger or constraint is dropped', async () => {
  for (const missing of [
    { missingTriggers: ['billing_payment_application.trg_billing_payment_application_capacity'] },
    { missingFunctions: ['validate_billing_payment_application_capacity'] },
    { missingConstraints: ['billing_migration_run.billing_migration_run_apply_provenance_check'] },
  ]) {
    const readiness = await getRequiredBillingSchemaReadiness(readinessPool(missing))
    assert.equal(readiness.ready, false)
    assert.deepEqual(readiness.missingTriggers, missing.missingTriggers ?? [])
    assert.deepEqual(readiness.missingFunctions, missing.missingFunctions ?? [])
    assert.deepEqual(readiness.missingConstraints, missing.missingConstraints ?? [])
  }
})

test('a missing schema_migrations table is treated as not ready', async () => {
  const pool = readinessPool()
  const originalQuery = pool.query
  pool.query = async (sql, params) => {
    if (String(sql).includes('FROM schema_migrations')) {
      const error = new Error('relation does not exist')
      error.code = '42P01'
      throw error
    }
    return originalQuery(sql, params)
  }
  const readiness = await getRequiredBillingSchemaReadiness(pool)
  assert.deepEqual(readiness.missingMigrations, REQUIRED_BILLING_MIGRATIONS)
  assert.equal(readiness.ready, false)
})
