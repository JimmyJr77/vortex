-- Fail-closed provenance and append-only evidence for canonical billing cutovers.
-- This migration is intentionally additive so existing historical runs remain
-- readable while every new apply/rollback run is held to the durable contract.

ALTER TABLE billing_migration_run
  DROP CONSTRAINT IF EXISTS billing_migration_run_apply_provenance_check;
ALTER TABLE billing_migration_run
  ADD CONSTRAINT billing_migration_run_apply_provenance_check
  CHECK (
    mode NOT IN ('apply', 'rollback')
    OR (
      migration_key = 'canonical-household-billing-v1'
      AND NULLIF(BTRIM(code_version), '') IS NOT NULL
      AND manifest_checksum ~ '^[0-9a-f]{64}$'
      AND facility_id IS NOT NULL
      AND target_month IS NOT NULL
      AND NULLIF(BTRIM(facility_timezone), '') IS NOT NULL
      AND NULLIF(BTRIM(cohort), '') IS NOT NULL
      AND CASE
        WHEN jsonb_typeof(configuration -> 'accountIds') = 'array'
          THEN jsonb_array_length(configuration -> 'accountIds') > 0
        ELSE FALSE
      END
    )
  ) NOT VALID;

CREATE OR REPLACE FUNCTION reject_billing_migration_run_contract_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'canonical billing migration runs are append-only';
  END IF;
  IF NEW.migration_key IS DISTINCT FROM OLD.migration_key
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    OR NEW.mode IS DISTINCT FROM OLD.mode
    OR NEW.code_version IS DISTINCT FROM OLD.code_version
    OR NEW.manifest_checksum IS DISTINCT FROM OLD.manifest_checksum
    OR NEW.requested_by_user_id IS DISTINCT FROM OLD.requested_by_user_id
    OR NEW.requested_by_type IS DISTINCT FROM OLD.requested_by_type
    OR NEW.facility_id IS DISTINCT FROM OLD.facility_id
    OR NEW.target_month IS DISTINCT FROM OLD.target_month
    OR NEW.facility_timezone IS DISTINCT FROM OLD.facility_timezone
    OR NEW.cohort IS DISTINCT FROM OLD.cohort
    OR NEW.configuration IS DISTINCT FROM OLD.configuration
    OR NEW.started_at IS DISTINCT FROM OLD.started_at
  THEN
    RAISE EXCEPTION 'canonical billing migration run provenance is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_migration_run_contract_immutable
  ON billing_migration_run;
CREATE TRIGGER trg_billing_migration_run_contract_immutable
BEFORE UPDATE OR DELETE ON billing_migration_run
FOR EACH ROW EXECUTE FUNCTION reject_billing_migration_run_contract_mutation();

CREATE OR REPLACE FUNCTION reject_billing_migration_initial_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'canonical billing account migration evidence is append-only';
  END IF;
  IF OLD.snapshot_hash IS NOT NULL AND (
    NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash
    OR NEW.account_snapshot IS DISTINCT FROM OLD.account_snapshot
    OR NEW.pricing_snapshot IS DISTINCT FROM OLD.pricing_snapshot
    OR NEW.ledger_snapshot IS DISTINCT FROM OLD.ledger_snapshot
    OR NEW.initial_stripe_snapshot IS DISTINCT FROM OLD.initial_stripe_snapshot
    OR NEW.rollback_snapshot IS DISTINCT FROM OLD.rollback_snapshot
    OR NEW.source_collection_mode IS DISTINCT FROM OLD.source_collection_mode
    OR NEW.target_collection_mode IS DISTINCT FROM OLD.target_collection_mode
    OR NEW.cutover_month IS DISTINCT FROM OLD.cutover_month
  ) THEN
    RAISE EXCEPTION 'canonical billing initial migration snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_migration_initial_snapshot_immutable
  ON billing_account_migration;
CREATE TRIGGER trg_billing_migration_initial_snapshot_immutable
BEFORE UPDATE OR DELETE ON billing_account_migration
FOR EACH ROW EXECUTE FUNCTION reject_billing_migration_initial_snapshot_mutation();

CREATE OR REPLACE FUNCTION enforce_billing_migration_item_evidence()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  conflicting_item_id BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'canonical billing migration items are append-only';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (OLD.source_snapshot <> '{}'::jsonb AND NEW.source_snapshot IS DISTINCT FROM OLD.source_snapshot)
      OR (OLD.idempotency_key IS NOT NULL AND NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key)
      OR (OLD.billing_subscription_id IS NOT NULL AND NEW.billing_subscription_id IS DISTINCT FROM OLD.billing_subscription_id)
      OR (OLD.signup_id IS NOT NULL AND NEW.signup_id IS DISTINCT FROM OLD.signup_id)
      OR (OLD.member_id IS NOT NULL AND NEW.member_id IS DISTINCT FROM OLD.member_id)
      OR (OLD.former_stripe_subscription_id IS NOT NULL AND NEW.former_stripe_subscription_id IS DISTINCT FROM OLD.former_stripe_subscription_id)
      OR (OLD.former_stripe_item_id IS NOT NULL AND NEW.former_stripe_item_id IS DISTINCT FROM OLD.former_stripe_item_id)
      OR (OLD.former_stripe_schedule_id IS NOT NULL AND NEW.former_stripe_schedule_id IS DISTINCT FROM OLD.former_stripe_schedule_id)
      OR (OLD.local_status IS NOT NULL AND NEW.local_status IS DISTINCT FROM OLD.local_status)
      OR (OLD.local_start_date IS NOT NULL AND NEW.local_start_date IS DISTINCT FROM OLD.local_start_date)
      OR (OLD.local_end_date IS NOT NULL AND NEW.local_end_date IS DISTINCT FROM OLD.local_end_date)
      OR (OLD.local_next_bill_date IS NOT NULL AND NEW.local_next_bill_date IS DISTINCT FROM OLD.local_next_bill_date)
      OR (OLD.local_net_monthly_cents IS NOT NULL AND NEW.local_net_monthly_cents IS DISTINCT FROM OLD.local_net_monthly_cents)
      OR (OLD.target_id IS NOT NULL AND NEW.target_id IS DISTINCT FROM OLD.target_id)
    THEN
      RAISE EXCEPTION 'canonical billing migration item source mapping is immutable';
    END IF;
    IF NOT (NEW.target_snapshot @> OLD.target_snapshot) THEN
      RAISE EXCEPTION 'canonical billing migration item target evidence cannot be removed';
    END IF;
  END IF;

  IF NEW.billing_subscription_id IS NOT NULL OR NEW.former_stripe_subscription_id IS NOT NULL THEN
    SELECT other_item.id
      INTO conflicting_item_id
      FROM billing_account_migration_item other_item
      JOIN billing_account_migration other_account
        ON other_account.id = other_item.billing_account_migration_id
     WHERE other_item.id <> COALESCE(NEW.id, 0)
       AND other_account.state NOT IN ('verified', 'rolled_back')
       AND (
         (NEW.billing_subscription_id IS NOT NULL
           AND other_item.billing_subscription_id = NEW.billing_subscription_id)
         OR
         (NEW.former_stripe_subscription_id IS NOT NULL
           AND other_item.former_stripe_subscription_id = NEW.former_stripe_subscription_id)
       )
     LIMIT 1;
    IF conflicting_item_id IS NOT NULL THEN
      RAISE EXCEPTION 'canonical billing subscription mapping already belongs to active migration item %', conflicting_item_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_migration_item_evidence
  ON billing_account_migration_item;
CREATE TRIGGER trg_billing_migration_item_evidence
BEFORE INSERT OR UPDATE OR DELETE ON billing_account_migration_item
FOR EACH ROW EXECUTE FUNCTION enforce_billing_migration_item_evidence();

CREATE INDEX IF NOT EXISTS idx_billing_migration_item_remote_lookup
  ON billing_account_migration_item(former_stripe_subscription_id, billing_account_migration_id)
  WHERE former_stripe_subscription_id IS NOT NULL;
