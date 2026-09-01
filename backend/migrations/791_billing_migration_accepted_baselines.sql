-- Preserve the immutable discovery snapshot while allowing an operator-driven,
-- fully re-audited deterministic repair to establish a newer accepted baseline.
-- Every accepted version is append-only evidence; the account row holds only
-- the current pointer used by prepare/boundary validation.

ALTER TABLE billing_account_migration
  ADD COLUMN IF NOT EXISTS accepted_baseline_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepted_snapshot_hash TEXT,
  ADD COLUMN IF NOT EXISTS accepted_account_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS accepted_pricing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS accepted_ledger_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS accepted_stripe_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS accepted_rollback_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

ALTER TABLE billing_account_migration
  DROP CONSTRAINT IF EXISTS billing_account_migration_accepted_version_check,
  DROP CONSTRAINT IF EXISTS billing_account_migration_accepted_hash_check,
  DROP CONSTRAINT IF EXISTS billing_account_migration_accepted_account_object_check,
  DROP CONSTRAINT IF EXISTS billing_account_migration_accepted_pricing_object_check,
  DROP CONSTRAINT IF EXISTS billing_account_migration_accepted_ledger_object_check,
  DROP CONSTRAINT IF EXISTS billing_account_migration_accepted_stripe_object_check,
  DROP CONSTRAINT IF EXISTS billing_account_migration_accepted_rollback_object_check,
  DROP CONSTRAINT IF EXISTS billing_account_migration_accepted_complete_check;
ALTER TABLE billing_account_migration
  ADD CONSTRAINT billing_account_migration_accepted_version_check
    CHECK (accepted_baseline_version >= 0),
  ADD CONSTRAINT billing_account_migration_accepted_hash_check
    CHECK (accepted_snapshot_hash IS NULL OR accepted_snapshot_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT billing_account_migration_accepted_account_object_check
    CHECK (jsonb_typeof(accepted_account_snapshot) = 'object'),
  ADD CONSTRAINT billing_account_migration_accepted_pricing_object_check
    CHECK (jsonb_typeof(accepted_pricing_snapshot) = 'object'),
  ADD CONSTRAINT billing_account_migration_accepted_ledger_object_check
    CHECK (jsonb_typeof(accepted_ledger_snapshot) = 'object'),
  ADD CONSTRAINT billing_account_migration_accepted_stripe_object_check
    CHECK (jsonb_typeof(accepted_stripe_snapshot) = 'object'),
  ADD CONSTRAINT billing_account_migration_accepted_rollback_object_check
    CHECK (jsonb_typeof(accepted_rollback_snapshot) = 'object'),
  ADD CONSTRAINT billing_account_migration_accepted_complete_check
    CHECK (
      (accepted_baseline_version = 0 AND accepted_snapshot_hash IS NULL AND accepted_at IS NULL)
      OR
      (accepted_baseline_version > 0 AND accepted_snapshot_hash IS NOT NULL AND accepted_at IS NOT NULL)
    );

CREATE TABLE IF NOT EXISTS billing_account_migration_baseline (
  id                            BIGSERIAL PRIMARY KEY,
  billing_account_migration_id  BIGINT NOT NULL
    REFERENCES billing_account_migration(id) ON DELETE RESTRICT,
  baseline_version              INTEGER NOT NULL CHECK (baseline_version > 0),
  snapshot_hash                 TEXT NOT NULL CHECK (snapshot_hash ~ '^[0-9a-f]{64}$'),
  account_snapshot              JSONB NOT NULL CHECK (jsonb_typeof(account_snapshot) = 'object'),
  pricing_snapshot              JSONB NOT NULL CHECK (jsonb_typeof(pricing_snapshot) = 'object'),
  ledger_snapshot               JSONB NOT NULL CHECK (jsonb_typeof(ledger_snapshot) = 'object'),
  stripe_snapshot               JSONB NOT NULL CHECK (jsonb_typeof(stripe_snapshot) = 'object'),
  rollback_snapshot             JSONB NOT NULL CHECK (jsonb_typeof(rollback_snapshot) = 'object'),
  acceptance_reason             TEXT NOT NULL,
  lease_owner                   TEXT,
  accepted_at                   TIMESTAMPTZ NOT NULL,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (billing_account_migration_id, baseline_version),
  UNIQUE (billing_account_migration_id, snapshot_hash)
);

CREATE INDEX IF NOT EXISTS idx_billing_account_migration_baseline_latest
  ON billing_account_migration_baseline(billing_account_migration_id, baseline_version DESC);

CREATE OR REPLACE FUNCTION initialize_billing_migration_accepted_baseline()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.snapshot_hash IS NOT NULL AND NEW.accepted_snapshot_hash IS NULL THEN
    NEW.accepted_baseline_version := 1;
    NEW.accepted_snapshot_hash := NEW.snapshot_hash;
    NEW.accepted_account_snapshot := NEW.account_snapshot;
    NEW.accepted_pricing_snapshot := NEW.pricing_snapshot;
    NEW.accepted_ledger_snapshot := NEW.ledger_snapshot;
    NEW.accepted_stripe_snapshot := NEW.initial_stripe_snapshot;
    NEW.accepted_rollback_snapshot := NEW.rollback_snapshot;
    NEW.accepted_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_migration_accepted_baseline_initialize
  ON billing_account_migration;
CREATE TRIGGER trg_billing_migration_accepted_baseline_initialize
BEFORE INSERT OR UPDATE ON billing_account_migration
FOR EACH ROW EXECUTE FUNCTION initialize_billing_migration_accepted_baseline();

CREATE OR REPLACE FUNCTION validate_billing_migration_accepted_baseline()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.accepted_snapshot_hash IS NOT DISTINCT FROM OLD.accepted_snapshot_hash
    AND NEW.accepted_baseline_version IS NOT DISTINCT FROM OLD.accepted_baseline_version
  THEN
    IF NEW.accepted_account_snapshot IS DISTINCT FROM OLD.accepted_account_snapshot
      OR NEW.accepted_pricing_snapshot IS DISTINCT FROM OLD.accepted_pricing_snapshot
      OR NEW.accepted_ledger_snapshot IS DISTINCT FROM OLD.accepted_ledger_snapshot
      OR NEW.accepted_stripe_snapshot IS DISTINCT FROM OLD.accepted_stripe_snapshot
      OR NEW.accepted_rollback_snapshot IS DISTINCT FROM OLD.accepted_rollback_snapshot
      OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
    THEN
      RAISE EXCEPTION 'canonical billing accepted baseline fields must change as one version';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.accepted_baseline_version = 0 AND NEW.accepted_baseline_version = 1
    AND NEW.accepted_snapshot_hash = NEW.snapshot_hash
  THEN
    RETURN NEW;
  END IF;

  IF NEW.accepted_baseline_version <> OLD.accepted_baseline_version + 1 THEN
    RAISE EXCEPTION 'canonical billing accepted baseline versions must advance by exactly one';
  END IF;
  IF NEW.state NOT IN ('discovered', 'repairing', 'blocked', 'shadow_verified') THEN
    RAISE EXCEPTION 'canonical billing accepted baseline cannot change after cutover is armed';
  END IF;
  IF NEW.lease_owner IS NULL OR NEW.lease_expires_at IS NULL OR NEW.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'canonical billing accepted baseline requires the active account migration lease';
  END IF;
  IF NEW.accepted_snapshot_hash IS NULL OR NEW.accepted_at IS NULL THEN
    RAISE EXCEPTION 'canonical billing accepted baseline evidence is incomplete';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_migration_accepted_baseline_validate
  ON billing_account_migration;
CREATE TRIGGER trg_billing_migration_accepted_baseline_validate
BEFORE UPDATE ON billing_account_migration
FOR EACH ROW EXECUTE FUNCTION validate_billing_migration_accepted_baseline();

CREATE OR REPLACE FUNCTION capture_billing_migration_accepted_baseline()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.accepted_snapshot_hash IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO billing_account_migration_baseline (
    billing_account_migration_id,
    baseline_version,
    snapshot_hash,
    account_snapshot,
    pricing_snapshot,
    ledger_snapshot,
    stripe_snapshot,
    rollback_snapshot,
    acceptance_reason,
    lease_owner,
    accepted_at
  ) VALUES (
    NEW.id,
    NEW.accepted_baseline_version,
    NEW.accepted_snapshot_hash,
    NEW.accepted_account_snapshot,
    NEW.accepted_pricing_snapshot,
    NEW.accepted_ledger_snapshot,
    NEW.accepted_stripe_snapshot,
    NEW.accepted_rollback_snapshot,
    CASE WHEN NEW.accepted_baseline_version = 1
      THEN 'initial_shadow_verification'
      ELSE 'deterministic_repair_reaudit'
    END,
    NEW.lease_owner,
    NEW.accepted_at
  )
  ON CONFLICT (billing_account_migration_id, baseline_version) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_migration_accepted_baseline_capture
  ON billing_account_migration;
CREATE TRIGGER trg_billing_migration_accepted_baseline_capture
AFTER INSERT OR UPDATE ON billing_account_migration
FOR EACH ROW EXECUTE FUNCTION capture_billing_migration_accepted_baseline();

CREATE OR REPLACE FUNCTION reject_billing_migration_baseline_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'canonical billing accepted baseline history is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_migration_baseline_immutable
  ON billing_account_migration_baseline;
CREATE TRIGGER trg_billing_migration_baseline_immutable
BEFORE UPDATE OR DELETE ON billing_account_migration_baseline
FOR EACH ROW EXECUTE FUNCTION reject_billing_migration_baseline_mutation();

-- Upgrade any run snapshotted before this additive migration. The initializer
-- trigger fills the current pointer, and the capture trigger writes version 1.
UPDATE billing_account_migration
   SET snapshot_hash = snapshot_hash
 WHERE snapshot_hash IS NOT NULL
   AND accepted_snapshot_hash IS NULL;
