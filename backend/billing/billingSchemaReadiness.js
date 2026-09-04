export const DEPLOY_BILLING_MIGRATIONS = Object.freeze([
  '057_stripe_pending_enrollment.sql',
  '058_billing_stripe_links.sql',
  '100_stripe_pending_enrollment_client_confirmed.sql',
  '399_stripe_pending_enrollment_setup_mode.sql',
  '400_stripe_pending_enrollment_processing_status.sql',
  '774_household_monthly_invoicing.sql',
  '775_member_billing_audit_paging_indexes.sql',
  '778_billing_canonical_migration_state.sql',
  '779_billing_modern_admin_idempotency.sql',
  '780_scheduling_enrollment_lifecycle_schema.sql',
  '781_billing_canonical_migration_contract.sql',
  '782_billing_legacy_endpoint_traffic.sql',
  '783_member_billing_drop_in_paging_index.sql',
  '784_billing_household_default_off.sql',
  '785_billing_migration_durable_safety.sql',
  '786_billing_household_default_remediation.sql',
  '787_billing_pause_credit_schema.sql',
  '788_billing_retirement_evidence.sql',
  '789_billing_payment_attempt_reservations.sql',
  '790_billing_migration_subscription_claims.sql',
  '791_billing_migration_accepted_baselines.sql',
  '792_billing_monthly_invoice_charge_credits.sql',
  '793_billing_webhook_claim_leases.sql',
  '794_billing_payment_attempt_reconciliation_fairness.sql',
  '795_billing_household_invoice_credit_applications.sql',
  '796_billing_retirement_invoice_parity.sql',
  '797_billing_payment_settlement_and_pass_idempotency.sql',
  '798_checkout_fulfillment_idempotency.sql',
  '799_billing_payment_stripe_invoice_link.sql',
  '809_billing_migration_item_upsert_evidence.sql',
  '810_billing_payment_fact_audit_jobs.sql',
  '811_billing_monthly_invoice_automatic_attempts.sql',
])

// Every migration previously executed lazily by a billing request is part of
// the startup contract. A process must fail closed before serving traffic when
// any of these explicit boot/deploy migrations is absent.
export const REQUIRED_BILLING_MIGRATIONS = Object.freeze([
  '046_signup_billing_charges.sql',
  '047_stripe_billing_scaffold.sql',
  '053_billing_recurring_model.sql',
  '054_billing_anchor_first.sql',
  '055_enrollment_cancel_effective.sql',
  '056_stripe_catalog.sql',
  '057_stripe_pending_enrollment.sql',
  '058_billing_stripe_links.sql',
  '100_stripe_pending_enrollment_client_confirmed.sql',
  '230_stripe_operations.sql',
  '231_stripe_reconciliation.sql',
  '232_billing_access_recovery.sql',
  '249_billing_admin_action_log.sql',
  '250_stripe_alert_resolution_audit.sql',
  '399_stripe_pending_enrollment_setup_mode.sql',
  '400_stripe_pending_enrollment_processing_status.sql',
  '768_annual_membership_auto_renewal.sql',
  '769_annual_membership_renewal_tracking.sql',
  '770_billing_charge_promo_metadata.sql',
  '774_household_monthly_invoicing.sql',
  '775_annual_membership_renewal_pricing.sql',
  '775_member_billing_audit_paging_indexes.sql',
  '776_annual_membership_renewal_promo_redemptions.sql',
  '778_billing_canonical_migration_state.sql',
  '779_billing_modern_admin_idempotency.sql',
  '780_scheduling_enrollment_lifecycle_schema.sql',
  '781_billing_canonical_migration_contract.sql',
  '782_billing_legacy_endpoint_traffic.sql',
  '783_member_billing_drop_in_paging_index.sql',
  '784_billing_household_default_off.sql',
  '785_billing_migration_durable_safety.sql',
  '786_billing_household_default_remediation.sql',
  '787_billing_pause_credit_schema.sql',
  '788_billing_retirement_evidence.sql',
  '789_billing_payment_attempt_reservations.sql',
  '790_billing_migration_subscription_claims.sql',
  '791_billing_migration_accepted_baselines.sql',
  '792_billing_monthly_invoice_charge_credits.sql',
  '793_billing_webhook_claim_leases.sql',
  '794_billing_payment_attempt_reconciliation_fairness.sql',
  '795_billing_household_invoice_credit_applications.sql',
  '796_billing_retirement_invoice_parity.sql',
  '797_billing_payment_settlement_and_pass_idempotency.sql',
  '798_checkout_fulfillment_idempotency.sql',
  '799_billing_payment_stripe_invoice_link.sql',
  '809_billing_migration_item_upsert_evidence.sql',
  '810_billing_payment_fact_audit_jobs.sql',
  '811_billing_monthly_invoice_automatic_attempts.sql',
])

export const DEPLOY_BILLING_RELATIONS = Object.freeze([
  'billing_monthly_invoice',
  'billing_monthly_invoice_line',
  'idx_billing_charge_account_created',
  'idx_billing_payment_account_paid',
  'idx_billing_refund_account_created',
  'billing_migration_run',
  'billing_account_migration',
  'billing_account_migration_item',
  'billing_migration_exception',
  'uq_billing_payment_request_key',
  'uq_multi_class_pass_redemption_request_key',
  'idx_scheduling_signup_enrollment_start_date',
  'uq_billing_account_migration_one_active',
  'uq_billing_migration_item_local_subscription',
  'uq_billing_migration_item_remote_subscription',
  'billing_legacy_endpoint_monitor',
  'billing_legacy_endpoint_traffic',
  'idx_billing_legacy_endpoint_traffic_last_seen',
  'idx_drop_in_registration_member_class_date',
  'idx_billing_migration_item_remote_lookup',
  'billing_household_default_remediation_audit',
  'idx_billing_household_default_remediation_account',
  'billing_pause_credit',
  'idx_billing_pause_credit_apply',
  'billing_legacy_telemetry_heartbeat',
  'idx_billing_legacy_telemetry_heartbeat_status',
  'billing_cycle_verification_evidence',
  'idx_billing_cycle_verification_latest',
  'billing_payment_attempt',
  'billing_payment_attempt_charge',
  'uq_billing_payment_attempt_checkout_session',
  'uq_billing_payment_attempt_payment_intent',
  'idx_billing_payment_attempt_account_status',
  'idx_billing_payment_attempt_charge_charge',
  'billing_migration_subscription_claim',
  'idx_billing_migration_subscription_claim_account',
  'billing_account_migration_baseline',
  'idx_billing_account_migration_baseline_latest',
  'idx_stripe_webhook_event_processing_lease',
  'idx_billing_payment_attempt_reconcile_round_robin',
  'billing_charge_credit_application',
  'idx_billing_charge_credit_application_invoice',
  'idx_billing_charge_credit_application_credit_line',
  'idx_billing_charge_credit_application_target_line',
  'annual_membership_checkout_request',
  'annual_membership_checkout_promo_reservation',
  'idx_annual_membership_checkout_request_status',
  'idx_annual_membership_promo_reservation_active',
  'uq_stripe_pending_enrollment_request',
  'uq_discount_redemption_annual_checkout_member_rule',
  'billing_payment_fact_audit_job',
  'idx_billing_payment_fact_audit_job_due',
  'idx_billing_monthly_invoice_automatic_attempt',
])

export const REQUIRED_BILLING_RELATIONS = Object.freeze([
  'uq_billing_charge_source',
  'uq_billing_payment_stripe_pi',
  'billing_subscription',
  'uq_billing_subscription_source',
  'billing_refund',
  'drop_in_registration',
  'v_account_ledger',
  'stripe_catalog_item',
  'stripe_pending_enrollment',
  'uq_billing_payment_stripe_checkout',
  'uq_billing_payment_stripe_invoice',
  'stripe_webhook_event',
  'stripe_billing_alert',
  'stripe_reconciliation_run',
  'billing_access_action',
  'billing_admin_action',
  'annual_membership_renewal_pricing',
  'uq_discount_redemption_membership_renewal_invoice',
  ...DEPLOY_BILLING_RELATIONS,
])

export const DEPLOY_BILLING_COLUMNS = Object.freeze([
  { tableName: 'family_billing_account', columnName: 'household_monthly_billing_enabled' },
  { tableName: 'billing_payment', columnName: 'request_key' },
  { tableName: 'multi_class_pass_redemption', columnName: 'request_key' },
  { tableName: 'multi_class_pass_redemption', columnName: 'idempotency_fingerprint' },
  { tableName: 'scheduling_signup', columnName: 'completed_at' },
  { tableName: 'scheduling_signup', columnName: 'paused_at' },
  { tableName: 'scheduling_signup', columnName: 'pause_effective_date' },
  { tableName: 'scheduling_signup', columnName: 'pause_mode' },
  { tableName: 'scheduling_signup', columnName: 'enrollment_start_date' },
  { tableName: 'billing_migration_run', columnName: 'facility_id' },
  { tableName: 'billing_migration_run', columnName: 'target_month' },
  { tableName: 'billing_migration_run', columnName: 'facility_timezone' },
  { tableName: 'billing_migration_run', columnName: 'cohort' },
  { tableName: 'billing_account_migration', columnName: 'account_snapshot' },
  { tableName: 'billing_account_migration', columnName: 'pricing_snapshot' },
  { tableName: 'billing_account_migration', columnName: 'ledger_snapshot' },
  { tableName: 'billing_account_migration', columnName: 'initial_stripe_snapshot' },
  { tableName: 'billing_account_migration', columnName: 'snapshot_hash' },
  { tableName: 'billing_account_migration_item', columnName: 'billing_subscription_id' },
  { tableName: 'billing_account_migration_item', columnName: 'signup_id' },
  { tableName: 'billing_account_migration_item', columnName: 'member_id' },
  { tableName: 'billing_account_migration_item', columnName: 'former_stripe_subscription_id' },
  { tableName: 'billing_account_migration_item', columnName: 'former_stripe_item_id' },
  { tableName: 'billing_account_migration_item', columnName: 'former_stripe_schedule_id' },
  { tableName: 'billing_account_migration_item', columnName: 'local_status' },
  { tableName: 'billing_account_migration_item', columnName: 'local_start_date' },
  { tableName: 'billing_account_migration_item', columnName: 'local_end_date' },
  { tableName: 'billing_account_migration_item', columnName: 'local_next_bill_date' },
  { tableName: 'billing_account_migration_item', columnName: 'local_net_monthly_cents' },
  { tableName: 'billing_account_migration_item', columnName: 'remote_status' },
  { tableName: 'billing_account_migration_item', columnName: 'remote_period_start' },
  { tableName: 'billing_account_migration_item', columnName: 'remote_period_end' },
  { tableName: 'billing_account_migration_item', columnName: 'remote_amount_cents' },
  { tableName: 'billing_account_migration_item', columnName: 'remote_invoice_status' },
  { tableName: 'billing_account_migration_item', columnName: 'remote_cancel_at' },
  { tableName: 'billing_pause_credit', columnName: 'credit_kind' },
  { tableName: 'billing_payment_attempt', columnName: 'request_key' },
  { tableName: 'billing_payment_attempt', columnName: 'status' },
  { tableName: 'billing_payment_attempt', columnName: 'amount_cents' },
  { tableName: 'billing_payment_attempt', columnName: 'expires_at' },
  { tableName: 'billing_payment_attempt_charge', columnName: 'amount_cents' },
  { tableName: 'billing_monthly_invoice', columnName: 'automatic_attempt_count' },
  { tableName: 'billing_monthly_invoice', columnName: 'last_automatic_attempt_at' },
  { tableName: 'billing_migration_subscription_claim', columnName: 'claim_kind' },
  { tableName: 'billing_migration_subscription_claim', columnName: 'claim_value' },
  { tableName: 'billing_migration_subscription_claim', columnName: 'family_billing_account_id' },
  { tableName: 'billing_migration_subscription_claim', columnName: 'first_migration_item_id' },
  { tableName: 'billing_account_migration', columnName: 'accepted_baseline_version' },
  { tableName: 'billing_account_migration', columnName: 'accepted_snapshot_hash' },
  { tableName: 'billing_account_migration', columnName: 'accepted_account_snapshot' },
  { tableName: 'billing_account_migration', columnName: 'accepted_pricing_snapshot' },
  { tableName: 'billing_account_migration', columnName: 'accepted_ledger_snapshot' },
  { tableName: 'billing_account_migration', columnName: 'accepted_stripe_snapshot' },
  { tableName: 'billing_account_migration', columnName: 'accepted_rollback_snapshot' },
  { tableName: 'billing_account_migration', columnName: 'accepted_at' },
  { tableName: 'billing_account_migration_baseline', columnName: 'billing_account_migration_id' },
  { tableName: 'billing_account_migration_baseline', columnName: 'baseline_version' },
  { tableName: 'billing_account_migration_baseline', columnName: 'snapshot_hash' },
  { tableName: 'billing_account_migration_baseline', columnName: 'account_snapshot' },
  { tableName: 'billing_account_migration_baseline', columnName: 'pricing_snapshot' },
  { tableName: 'billing_account_migration_baseline', columnName: 'ledger_snapshot' },
  { tableName: 'billing_account_migration_baseline', columnName: 'stripe_snapshot' },
  { tableName: 'billing_account_migration_baseline', columnName: 'rollback_snapshot' },
  { tableName: 'billing_account_migration_baseline', columnName: 'acceptance_reason' },
  { tableName: 'billing_account_migration_baseline', columnName: 'lease_owner' },
  { tableName: 'billing_account_migration_baseline', columnName: 'accepted_at' },
  { tableName: 'stripe_webhook_event', columnName: 'claim_token' },
  { tableName: 'stripe_webhook_event', columnName: 'lease_expires_at' },
  { tableName: 'billing_payment_attempt', columnName: 'last_reconciled_at' },
  { tableName: 'billing_cycle_verification_evidence', columnName: 'local_invoice_line_subtotal_cents' },
  { tableName: 'billing_cycle_verification_evidence', columnName: 'local_invoice_line_credit_cents' },
  { tableName: 'billing_cycle_verification_evidence', columnName: 'local_invoice_credit_cents' },
  { tableName: 'billing_cycle_verification_evidence', columnName: 'local_invoice_total_cents' },
  { tableName: 'billing_cycle_verification_evidence', columnName: 'facility_timezone' },
  { tableName: 'stripe_pending_enrollment', columnName: 'request_key' },
  { tableName: 'stripe_pending_enrollment', columnName: 'request_fingerprint' },
  { tableName: 'stripe_pending_enrollment', columnName: 'stripe_checkout_session_url' },
  { tableName: 'annual_membership_checkout_request', columnName: 'pricing_snapshot' },
  { tableName: 'annual_membership_checkout_request', columnName: 'pricing_snapshot_hash' },
  { tableName: 'discount_redemption', columnName: 'annual_membership_checkout_request_id' },
])

export const DEPLOY_BILLING_DEFAULTS = Object.freeze([
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

// These database-enforced guards are part of the billing safety boundary. A
// migration filename alone is insufficient readiness evidence because a
// trigger or constraint can be dropped after the migration was recorded.
export const DEPLOY_BILLING_TRIGGERS = Object.freeze([
  { tableName: 'billing_migration_run', triggerName: 'trg_billing_migration_run_contract_immutable' },
  { tableName: 'billing_account_migration', triggerName: 'trg_billing_migration_initial_snapshot_immutable' },
  { tableName: 'billing_account_migration_item', triggerName: 'trg_billing_migration_item_evidence' },
  { tableName: 'billing_payment_attempt_charge', triggerName: 'trg_billing_payment_attempt_charge_immutable' },
  { tableName: 'billing_payment_attempt', triggerName: 'trg_billing_payment_attempt_total' },
  { tableName: 'billing_payment_attempt_charge', triggerName: 'trg_billing_payment_attempt_charge_total' },
  { tableName: 'billing_payment_application', triggerName: 'trg_billing_payment_application_capacity' },
  { tableName: 'billing_cycle_verification_evidence', triggerName: 'trg_billing_cycle_verification_evidence_immutable' },
  { tableName: 'billing_account_migration_item', triggerName: 'trg_billing_migration_subscription_claim' },
  { tableName: 'billing_migration_subscription_claim', triggerName: 'trg_billing_migration_subscription_claim_immutable' },
  { tableName: 'billing_account_migration', triggerName: 'trg_billing_migration_accepted_baseline_initialize' },
  { tableName: 'billing_account_migration', triggerName: 'trg_billing_migration_accepted_baseline_validate' },
  { tableName: 'billing_account_migration', triggerName: 'trg_billing_migration_accepted_baseline_capture' },
  { tableName: 'billing_account_migration_baseline', triggerName: 'trg_billing_migration_baseline_immutable' },
  { tableName: 'billing_monthly_invoice_line', triggerName: 'trg_billing_monthly_invoice_line_ownership' },
  { tableName: 'billing_charge_credit_application', triggerName: 'trg_billing_charge_credit_application_immutable' },
  { tableName: 'billing_charge_credit_application', triggerName: 'trg_billing_charge_credit_application_capacity' },
  { tableName: 'annual_membership_checkout_request', triggerName: 'trg_annual_membership_checkout_request_terms' },
])

export const DEPLOY_BILLING_FUNCTIONS = Object.freeze([
  'reject_billing_migration_run_contract_mutation',
  'reject_billing_migration_initial_snapshot_mutation',
  'enforce_billing_migration_item_evidence',
  'reject_billing_payment_attempt_charge_mutation',
  'validate_billing_payment_attempt_reservation_total',
  'validate_billing_payment_application_capacity',
  'reject_billing_cycle_verification_evidence_mutation',
  'claim_billing_migration_subscription_mapping',
  'reject_billing_migration_subscription_claim_mutation',
  'initialize_billing_migration_accepted_baseline',
  'validate_billing_migration_accepted_baseline',
  'capture_billing_migration_accepted_baseline',
  'reject_billing_migration_baseline_mutation',
  'validate_billing_monthly_invoice_line_ownership',
  'reject_billing_charge_credit_application_mutation',
  'validate_billing_charge_credit_application_capacity',
  'guard_annual_membership_checkout_request_terms',
])

export const DEPLOY_BILLING_CONSTRAINTS = Object.freeze([
  { tableName: 'stripe_pending_enrollment', constraintName: 'stripe_pending_enrollment_checkout_mode_check', constraintType: 'c' },
  { tableName: 'stripe_pending_enrollment', constraintName: 'stripe_pending_enrollment_status_check', constraintType: 'c' },
  { tableName: 'billing_migration_run', constraintName: 'billing_migration_run_target_month_first_check', constraintType: 'c' },
  { tableName: 'billing_migration_run', constraintName: 'billing_migration_run_apply_provenance_check', constraintType: 'c' },
  { tableName: 'billing_account_migration', constraintName: 'billing_account_migration_account_snapshot_object_check', constraintType: 'c' },
  { tableName: 'billing_account_migration', constraintName: 'billing_account_migration_pricing_snapshot_object_check', constraintType: 'c' },
  { tableName: 'billing_account_migration', constraintName: 'billing_account_migration_ledger_snapshot_object_check', constraintType: 'c' },
  { tableName: 'billing_account_migration', constraintName: 'billing_account_migration_initial_stripe_snapshot_object_check', constraintType: 'c' },
  { tableName: 'billing_account_migration', constraintName: 'billing_account_migration_snapshot_hash_check', constraintType: 'c' },
  { tableName: 'billing_account_migration_item', constraintName: 'billing_account_migration_item_local_amount_check', constraintType: 'c' },
  { tableName: 'billing_account_migration_item', constraintName: 'billing_account_migration_item_remote_amount_check', constraintType: 'c' },
  { tableName: 'billing_account_migration_item', constraintName: 'billing_account_migration_item_local_dates_check', constraintType: 'c' },
  { tableName: 'billing_migration_subscription_claim', constraintName: 'billing_migration_subscription_claim_pkey', constraintType: 'p' },
  { tableName: 'billing_account_migration', constraintName: 'billing_account_migration_accepted_version_check', constraintType: 'c' },
  { tableName: 'billing_account_migration', constraintName: 'billing_account_migration_accepted_hash_check', constraintType: 'c' },
  { tableName: 'billing_account_migration', constraintName: 'billing_account_migration_accepted_account_object_check', constraintType: 'c' },
  { tableName: 'billing_account_migration', constraintName: 'billing_account_migration_accepted_pricing_object_check', constraintType: 'c' },
  { tableName: 'billing_account_migration', constraintName: 'billing_account_migration_accepted_ledger_object_check', constraintType: 'c' },
  { tableName: 'billing_account_migration', constraintName: 'billing_account_migration_accepted_stripe_object_check', constraintType: 'c' },
  { tableName: 'billing_account_migration', constraintName: 'billing_account_migration_accepted_rollback_object_check', constraintType: 'c' },
  { tableName: 'billing_account_migration', constraintName: 'billing_account_migration_accepted_complete_check', constraintType: 'c' },
  { tableName: 'billing_monthly_invoice_line', constraintName: 'billing_monthly_invoice_line_source_check', constraintType: 'c' },
  { tableName: 'stripe_webhook_event', constraintName: 'stripe_webhook_event_terminal_claim_check', constraintType: 'c' },
  { tableName: 'billing_charge_credit_application', constraintName: 'billing_charge_credit_application_distinct_lines_check', constraintType: 'c' },
  { tableName: 'billing_charge_credit_application', constraintName: 'uq_billing_charge_credit_application_pair', constraintType: 'u' },
  { tableName: 'billing_charge_credit_application', constraintName: 'uq_billing_charge_credit_application_idempotency', constraintType: 'u' },
  { tableName: 'billing_cycle_verification_evidence', constraintName: 'billing_cycle_verification_three_way_invoice_parity_check', constraintType: 'c' },
  { tableName: 'billing_payment', constraintName: 'billing_payment_external_status_check', constraintType: 'c' },
  { tableName: 'multi_class_pass_redemption', constraintName: 'multi_class_pass_redemption_idempotency_fingerprint_check', constraintType: 'c' },
  { tableName: 'stripe_pending_enrollment', constraintName: 'stripe_pending_enrollment_request_fingerprint_check', constraintType: 'c' },
])

export const REQUIRED_BILLING_COLUMNS = Object.freeze([
  { tableName: 'family_billing_account', columnName: 'stripe_customer_id' },
  { tableName: 'billing_charge', columnName: 'charge_type' },
  { tableName: 'billing_charge', columnName: 'billing_interval' },
  { tableName: 'billing_charge', columnName: 'gross_amount_cents' },
  { tableName: 'billing_charge', columnName: 'discount_amount_cents' },
  { tableName: 'billing_charge', columnName: 'subscription_id' },
  { tableName: 'billing_charge', columnName: 'stripe_price_id' },
  { tableName: 'billing_charge', columnName: 'stripe_invoice_item_id' },
  { tableName: 'billing_charge', columnName: 'stripe_checkout_session_id' },
  { tableName: 'billing_charge', columnName: 'metadata' },
  { tableName: 'billing_payment', columnName: 'stripe_checkout_session_id' },
  { tableName: 'billing_payment', columnName: 'stripe_invoice_id' },
  { tableName: 'billing_payment', columnName: 'stripe_subscription_id' },
  { tableName: 'billing_subscription', columnName: 'stripe_subscription_id' },
  { tableName: 'billing_subscription', columnName: 'stripe_subscription_item_id' },
  { tableName: 'billing_subscription', columnName: 'auto_renewal' },
  { tableName: 'billing_refund', columnName: 'stripe_refund_id' },
  { tableName: 'billing_refund', columnName: 'external_status' },
  { tableName: 'billing_refund', columnName: 'error_message' },
  { tableName: 'billing_refund', columnName: 'updated_at' },
  { tableName: 'member_multi_class_pass', columnName: 'expires_at' },
  { tableName: 'member_multi_class_pass', columnName: 'status' },
  { tableName: 'multi_class_pass_redemption', columnName: 'entry_type' },
  { tableName: 'multi_class_pass_redemption', columnName: 'reason' },
  { tableName: 'multi_class_pass_redemption', columnName: 'credit_delta' },
  { tableName: 'scheduling_signup', columnName: 'cancel_effective_date' },
  { tableName: 'scheduling_signup', columnName: 'cancel_requested_at' },
  { tableName: 'scheduling_signup', columnName: 'manual_discount_cents' },
  { tableName: 'scheduling_signup', columnName: 'manual_discount_pct' },
  { tableName: 'scheduling_signup', columnName: 'manual_discount_reason' },
  { tableName: 'scheduling_signup', columnName: 'manual_discount_rule_id' },
  { tableName: 'stripe_pending_enrollment', columnName: 'client_confirmed_at' },
  { tableName: 'stripe_billing_alert', columnName: 'action_status' },
  { tableName: 'stripe_billing_alert', columnName: 'resolved_by_user_id' },
  { tableName: 'stripe_billing_alert', columnName: 'resolution_note' },
  { tableName: 'discount_redemption', columnName: 'stripe_invoice_id' },
  { tableName: 'discount_redemption', columnName: 'annual_membership_renewal_pricing_id' },
  ...DEPLOY_BILLING_COLUMNS,
])

export const REQUIRED_BILLING_DEFAULTS = Object.freeze([
  ...DEPLOY_BILLING_DEFAULTS,
])

export const REQUIRED_BILLING_TRIGGERS = Object.freeze([
  ...DEPLOY_BILLING_TRIGGERS,
])

export const REQUIRED_BILLING_FUNCTIONS = Object.freeze([
  ...DEPLOY_BILLING_FUNCTIONS,
])

export const REQUIRED_BILLING_CONSTRAINTS = Object.freeze([
  ...DEPLOY_BILLING_CONSTRAINTS,
])

async function missingMigrationFiles(pool, migrationFiles) {
  try {
    const result = await pool.query(
      `SELECT filename
         FROM schema_migrations
        WHERE filename = ANY($1::text[])`,
      [migrationFiles],
    )
    const applied = new Set(result.rows.map((row) => String(row.filename)))
    return migrationFiles.filter((filename) => !applied.has(filename))
  } catch (error) {
    if (error?.code === '42P01') return [...migrationFiles]
    throw error
  }
}

async function missingRelations(pool, relations) {
  const result = await pool.query(
    `SELECT expected.object_name
       FROM unnest($1::text[]) AS expected(object_name)
      WHERE to_regclass('public.' || expected.object_name) IS NULL
      ORDER BY expected.object_name`,
    [relations],
  )
  return result.rows.map((row) => String(row.object_name))
}

async function missingColumns(pool, columns) {
  const result = await pool.query(
    `SELECT expected.table_name, expected.column_name
       FROM jsonb_to_recordset($1::jsonb) AS expected(table_name text, column_name text)
       LEFT JOIN information_schema.columns actual
         ON actual.table_schema = 'public'
        AND actual.table_name = expected.table_name
        AND actual.column_name = expected.column_name
      WHERE actual.column_name IS NULL
      ORDER BY expected.table_name, expected.column_name`,
    [JSON.stringify(columns.map(({ tableName, columnName }) => ({
      table_name: tableName,
      column_name: columnName,
    })))],
  )
  return result.rows.map((row) => `${row.table_name}.${row.column_name}`)
}

async function invalidColumnDefaults(pool, defaults) {
  if (defaults.length === 0) return []
  const result = await pool.query(
    `SELECT expected.table_name,
            expected.column_name,
            expected.expected_expression,
            pg_get_expr(attribute_default.adbin, attribute_default.adrelid) AS actual_expression
       FROM jsonb_to_recordset($1::jsonb)
         AS expected(table_name text, column_name text, expected_expression text)
       LEFT JOIN pg_namespace namespace
         ON namespace.nspname = 'public'
       LEFT JOIN pg_class relation
         ON relation.relnamespace = namespace.oid
        AND relation.relname = expected.table_name
       LEFT JOIN pg_attribute attribute
         ON attribute.attrelid = relation.oid
        AND attribute.attname = expected.column_name
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
       LEFT JOIN pg_attrdef attribute_default
         ON attribute_default.adrelid = relation.oid
        AND attribute_default.adnum = attribute.attnum
      WHERE attribute_default.oid IS NULL
         OR pg_get_expr(attribute_default.adbin, attribute_default.adrelid)
              IS DISTINCT FROM expected.expected_expression
      ORDER BY expected.table_name, expected.column_name`,
    [JSON.stringify(defaults.map(({ tableName, columnName, expectedExpression }) => ({
      table_name: tableName,
      column_name: columnName,
      expected_expression: expectedExpression,
    })))],
  )
  return result.rows.map((row) => ({
    column: `${row.table_name}.${row.column_name}`,
    expected: row.expected_expression,
    actual: row.actual_expression ?? null,
  }))
}

async function missingTriggers(pool, triggers) {
  if (triggers.length === 0) return []
  const result = await pool.query(
    `SELECT expected.table_name, expected.trigger_name
       FROM jsonb_to_recordset($1::jsonb)
         AS expected(table_name text, trigger_name text)
       LEFT JOIN pg_namespace namespace
         ON namespace.nspname = 'public'
       LEFT JOIN pg_class relation
         ON relation.relnamespace = namespace.oid
        AND relation.relname = expected.table_name
       LEFT JOIN pg_trigger actual_trigger
         ON actual_trigger.tgrelid = relation.oid
        AND actual_trigger.tgname = expected.trigger_name
        AND NOT actual_trigger.tgisinternal
        AND actual_trigger.tgenabled IN ('O', 'A')
      WHERE actual_trigger.oid IS NULL
      ORDER BY expected.table_name, expected.trigger_name`,
    [JSON.stringify(triggers.map(({ tableName, triggerName }) => ({
      table_name: tableName,
      trigger_name: triggerName,
    })))],
  )
  return result.rows.map((row) => `${row.table_name}.${row.trigger_name}`)
}

async function missingFunctions(pool, functions) {
  if (functions.length === 0) return []
  const result = await pool.query(
    `SELECT expected.function_name
       FROM unnest($1::text[]) AS expected(function_name)
       LEFT JOIN pg_namespace namespace
         ON namespace.nspname = 'public'
       LEFT JOIN pg_proc actual_function
         ON actual_function.pronamespace = namespace.oid
        AND actual_function.proname = expected.function_name
        AND actual_function.pronargs = 0
        AND actual_function.prorettype = 'trigger'::regtype
      WHERE actual_function.oid IS NULL
      ORDER BY expected.function_name`,
    [functions],
  )
  return result.rows.map((row) => String(row.function_name))
}

async function missingConstraints(pool, constraints) {
  if (constraints.length === 0) return []
  const result = await pool.query(
    `SELECT expected.table_name, expected.constraint_name
       FROM jsonb_to_recordset($1::jsonb)
         AS expected(table_name text, constraint_name text, constraint_type text)
       LEFT JOIN pg_namespace namespace
         ON namespace.nspname = 'public'
       LEFT JOIN pg_class relation
         ON relation.relnamespace = namespace.oid
        AND relation.relname = expected.table_name
       LEFT JOIN pg_constraint actual_constraint
        ON actual_constraint.conrelid = relation.oid
        AND actual_constraint.conname = expected.constraint_name
        AND actual_constraint.contype = expected.constraint_type::"char"
      WHERE actual_constraint.oid IS NULL
      ORDER BY expected.table_name, expected.constraint_name`,
    [JSON.stringify(constraints.map(({ tableName, constraintName, constraintType }) => ({
      table_name: tableName,
      constraint_name: constraintName,
      constraint_type: constraintType,
    })))],
  )
  return result.rows.map((row) => `${row.table_name}.${row.constraint_name}`)
}

async function getSchemaReadiness(pool, {
  migrations,
  relations,
  columns,
  defaults,
  triggers,
  functions,
  constraints,
}) {
  const [
    missingMigrations,
    missingSchemaRelations,
    missingSchemaColumns,
    invalidDefaults,
    missingSchemaTriggers,
    missingSchemaFunctions,
    missingSchemaConstraints,
  ] = await Promise.all([
    missingMigrationFiles(pool, migrations),
    missingRelations(pool, relations),
    missingColumns(pool, columns),
    invalidColumnDefaults(pool, defaults),
    missingTriggers(pool, triggers),
    missingFunctions(pool, functions),
    missingConstraints(pool, constraints),
  ])
  return {
    ready: missingMigrations.length === 0
      && missingSchemaRelations.length === 0
      && missingSchemaColumns.length === 0
      && invalidDefaults.length === 0
      && missingSchemaTriggers.length === 0
      && missingSchemaFunctions.length === 0
      && missingSchemaConstraints.length === 0,
    missingMigrations,
    missingRelations: missingSchemaRelations,
    missingColumns: missingSchemaColumns,
    invalidDefaults,
    missingTriggers: missingSchemaTriggers,
    missingFunctions: missingSchemaFunctions,
    missingConstraints: missingSchemaConstraints,
  }
}

function readinessError(readiness) {
  const details = [
    readiness.missingMigrations.length > 0
      ? `migrations: ${readiness.missingMigrations.join(', ')}`
      : null,
    readiness.missingRelations.length > 0
      ? `relations: ${readiness.missingRelations.join(', ')}`
      : null,
    readiness.missingColumns.length > 0
      ? `columns: ${readiness.missingColumns.join(', ')}`
      : null,
    readiness.invalidDefaults.length > 0
      ? `defaults: ${readiness.invalidDefaults.map((item) => (
        `${item.column} expected ${item.expected}, found ${item.actual ?? 'none'}`
      )).join(', ')}`
      : null,
    readiness.missingTriggers.length > 0
      ? `triggers: ${readiness.missingTriggers.join(', ')}`
      : null,
    readiness.missingFunctions.length > 0
      ? `functions: ${readiness.missingFunctions.join(', ')}`
      : null,
    readiness.missingConstraints.length > 0
      ? `constraints: ${readiness.missingConstraints.join(', ')}`
      : null,
  ].filter(Boolean).join('; ')
  const error = new Error(`Required billing schema is not ready (${details}).`)
  error.code = 'BILLING_SCHEMA_NOT_READY'
  error.readiness = readiness
  return error
}

export function getDeployBillingSchemaReadiness(pool) {
  return getSchemaReadiness(pool, {
    migrations: DEPLOY_BILLING_MIGRATIONS,
    relations: DEPLOY_BILLING_RELATIONS,
    columns: DEPLOY_BILLING_COLUMNS,
    defaults: DEPLOY_BILLING_DEFAULTS,
    triggers: DEPLOY_BILLING_TRIGGERS,
    functions: DEPLOY_BILLING_FUNCTIONS,
    constraints: DEPLOY_BILLING_CONSTRAINTS,
  })
}

export async function assertDeployBillingSchema(pool) {
  const readiness = await getDeployBillingSchemaReadiness(pool)
  if (!readiness.ready) throw readinessError(readiness)
  return readiness
}

export function getRequiredBillingSchemaReadiness(pool) {
  return getSchemaReadiness(pool, {
    migrations: REQUIRED_BILLING_MIGRATIONS,
    relations: REQUIRED_BILLING_RELATIONS,
    columns: REQUIRED_BILLING_COLUMNS,
    defaults: REQUIRED_BILLING_DEFAULTS,
    triggers: REQUIRED_BILLING_TRIGGERS,
    functions: REQUIRED_BILLING_FUNCTIONS,
    constraints: REQUIRED_BILLING_CONSTRAINTS,
  })
}

export async function assertRequiredBillingSchema(pool) {
  const readiness = await getRequiredBillingSchemaReadiness(pool)
  if (!readiness.ready) throw readinessError(readiness)
  return readiness
}
