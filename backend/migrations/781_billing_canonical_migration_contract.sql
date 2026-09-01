-- Safety-critical selectors and immutable evidence for canonical billing cutovers.
-- Migration 778 remains the generic orchestration foundation; these explicit
-- columns make cohort scope and Stripe/local mappings constraintable in SQL.

ALTER TABLE billing_migration_run
  ADD COLUMN IF NOT EXISTS facility_id BIGINT REFERENCES facility(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS target_month DATE,
  ADD COLUMN IF NOT EXISTS facility_timezone TEXT,
  ADD COLUMN IF NOT EXISTS cohort TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE billing_migration_run
  DROP CONSTRAINT IF EXISTS billing_migration_run_target_month_first_check;
ALTER TABLE billing_migration_run
  ADD CONSTRAINT billing_migration_run_target_month_first_check
  CHECK (target_month IS NULL OR date_trunc('month', target_month)::date = target_month);

CREATE INDEX IF NOT EXISTS idx_billing_migration_run_facility_target
  ON billing_migration_run(facility_id, target_month, cohort, created_at DESC, id DESC);

ALTER TABLE billing_account_migration
  ADD COLUMN IF NOT EXISTS account_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ledger_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS initial_stripe_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS snapshot_hash TEXT;

ALTER TABLE billing_account_migration
  DROP CONSTRAINT IF EXISTS billing_account_migration_account_snapshot_object_check,
  DROP CONSTRAINT IF EXISTS billing_account_migration_pricing_snapshot_object_check,
  DROP CONSTRAINT IF EXISTS billing_account_migration_ledger_snapshot_object_check,
  DROP CONSTRAINT IF EXISTS billing_account_migration_initial_stripe_snapshot_object_check,
  DROP CONSTRAINT IF EXISTS billing_account_migration_snapshot_hash_check;
ALTER TABLE billing_account_migration
  ADD CONSTRAINT billing_account_migration_account_snapshot_object_check
    CHECK (jsonb_typeof(account_snapshot) = 'object'),
  ADD CONSTRAINT billing_account_migration_pricing_snapshot_object_check
    CHECK (jsonb_typeof(pricing_snapshot) = 'object'),
  ADD CONSTRAINT billing_account_migration_ledger_snapshot_object_check
    CHECK (jsonb_typeof(ledger_snapshot) = 'object'),
  ADD CONSTRAINT billing_account_migration_initial_stripe_snapshot_object_check
    CHECK (jsonb_typeof(initial_stripe_snapshot) = 'object'),
  ADD CONSTRAINT billing_account_migration_snapshot_hash_check
    CHECK (snapshot_hash IS NULL OR snapshot_hash ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION reject_billing_migration_initial_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.snapshot_hash IS NOT NULL AND (
    NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash
    OR NEW.account_snapshot IS DISTINCT FROM OLD.account_snapshot
    OR NEW.pricing_snapshot IS DISTINCT FROM OLD.pricing_snapshot
    OR NEW.ledger_snapshot IS DISTINCT FROM OLD.ledger_snapshot
    OR NEW.initial_stripe_snapshot IS DISTINCT FROM OLD.initial_stripe_snapshot
    OR NEW.rollback_snapshot IS DISTINCT FROM OLD.rollback_snapshot
  ) THEN
    RAISE EXCEPTION 'canonical billing initial migration snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_migration_initial_snapshot_immutable
  ON billing_account_migration;
CREATE TRIGGER trg_billing_migration_initial_snapshot_immutable
BEFORE UPDATE ON billing_account_migration
FOR EACH ROW EXECUTE FUNCTION reject_billing_migration_initial_snapshot_mutation();

-- A failed-forward-only account remains the active recovery record. A new run
-- may begin only after the prior account reaches verified or rolled_back.
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_account_migration_one_active
  ON billing_account_migration(family_billing_account_id)
  WHERE state NOT IN ('verified', 'rolled_back');

ALTER TABLE billing_account_migration_item
  ADD COLUMN IF NOT EXISTS billing_subscription_id BIGINT REFERENCES billing_subscription(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS signup_id BIGINT REFERENCES scheduling_signup(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS member_id BIGINT REFERENCES member(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS former_stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS former_stripe_item_id TEXT,
  ADD COLUMN IF NOT EXISTS former_stripe_schedule_id TEXT,
  ADD COLUMN IF NOT EXISTS local_status TEXT,
  ADD COLUMN IF NOT EXISTS local_start_date DATE,
  ADD COLUMN IF NOT EXISTS local_end_date DATE,
  ADD COLUMN IF NOT EXISTS local_next_bill_date DATE,
  ADD COLUMN IF NOT EXISTS local_net_monthly_cents INTEGER,
  ADD COLUMN IF NOT EXISTS remote_status TEXT,
  ADD COLUMN IF NOT EXISTS remote_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS remote_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS remote_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS remote_invoice_status TEXT,
  ADD COLUMN IF NOT EXISTS remote_cancel_at TIMESTAMPTZ;

ALTER TABLE billing_account_migration_item
  DROP CONSTRAINT IF EXISTS billing_account_migration_item_local_amount_check,
  DROP CONSTRAINT IF EXISTS billing_account_migration_item_remote_amount_check,
  DROP CONSTRAINT IF EXISTS billing_account_migration_item_local_dates_check;
ALTER TABLE billing_account_migration_item
  ADD CONSTRAINT billing_account_migration_item_local_amount_check
    CHECK (local_net_monthly_cents IS NULL OR local_net_monthly_cents >= 0),
  ADD CONSTRAINT billing_account_migration_item_remote_amount_check
    CHECK (remote_amount_cents IS NULL OR remote_amount_cents >= 0),
  ADD CONSTRAINT billing_account_migration_item_local_dates_check
    CHECK (local_end_date IS NULL OR local_start_date IS NULL OR local_end_date >= local_start_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_migration_item_local_subscription
  ON billing_account_migration_item(billing_account_migration_id, billing_subscription_id)
  WHERE billing_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_migration_item_remote_subscription
  ON billing_account_migration_item(billing_account_migration_id, former_stripe_subscription_id)
  WHERE former_stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_migration_item_signup
  ON billing_account_migration_item(signup_id)
  WHERE signup_id IS NOT NULL;
