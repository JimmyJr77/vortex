-- Durable, fail-closed evidence for retiring legacy billing code.
--
-- A day without a healthy telemetry heartbeat is not treated as a zero-traffic
-- day. Billing-cycle verification is append-only so a later failed check cannot
-- be hidden by an older successful result.

CREATE TABLE IF NOT EXISTS billing_legacy_telemetry_heartbeat (
  observed_on             DATE PRIMARY KEY,
  status                  TEXT NOT NULL CHECK (status IN ('healthy', 'error')),
  successful_check_count  BIGINT NOT NULL DEFAULT 0 CHECK (successful_check_count >= 0),
  error_count             BIGINT NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  expected_route_count    INTEGER NOT NULL CHECK (expected_route_count > 0),
  first_checked_at        TIMESTAMPTZ NOT NULL,
  last_checked_at         TIMESTAMPTZ NOT NULL,
  last_error_code         TEXT,
  checker_version         TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (last_checked_at >= first_checked_at),
  CHECK (last_error_code IS NULL OR last_error_code ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  CHECK (
    (status = 'healthy' AND successful_check_count > 0 AND error_count = 0 AND last_error_code IS NULL)
    OR
    (status = 'error' AND error_count > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_billing_legacy_telemetry_heartbeat_status
  ON billing_legacy_telemetry_heartbeat(observed_on DESC, status);

CREATE TABLE IF NOT EXISTS billing_cycle_verification_evidence (
  id                                BIGSERIAL PRIMARY KEY,
  family_billing_account_id         BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE RESTRICT,
  billing_account_migration_id      BIGINT REFERENCES billing_account_migration(id) ON DELETE RESTRICT,
  billing_month                     DATE NOT NULL,
  status                            TEXT NOT NULL CHECK (status IN ('verified', 'failed', 'error')),
  legacy_collector_count            INTEGER NOT NULL CHECK (legacy_collector_count >= 0),
  collector_count                   INTEGER NOT NULL CHECK (collector_count >= 0),
  household_invoice_count           INTEGER NOT NULL CHECK (household_invoice_count >= 0),
  remote_household_invoice_count    INTEGER NOT NULL CHECK (remote_household_invoice_count >= 0),
  unexpected_stripe_invoice_count   INTEGER NOT NULL CHECK (unexpected_stripe_invoice_count >= 0),
  local_invoice_line_total_cents    BIGINT NOT NULL,
  local_invoice_subtotal_cents      BIGINT NOT NULL,
  collector_unique                  BOOLEAN NOT NULL,
  household_invoice_unique          BOOLEAN NOT NULL,
  remote_household_invoice_unique   BOOLEAN NOT NULL,
  line_parity                       BOOLEAN NOT NULL,
  no_unexpected_stripe_invoice      BOOLEAN NOT NULL,
  issues                            JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence                          JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_hash                     TEXT NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  verifier_version                  TEXT NOT NULL,
  verified_at                       TIMESTAMPTZ NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (date_trunc('month', billing_month)::date = billing_month),
  CHECK (jsonb_typeof(issues) = 'array'),
  CHECK (jsonb_typeof(evidence) = 'object'),
  CHECK (
    status <> 'verified'
    OR (
      legacy_collector_count = 0
      AND collector_count <= 1
      AND household_invoice_count <= 1
      AND remote_household_invoice_count <= 1
      AND unexpected_stripe_invoice_count = 0
      AND collector_unique
      AND household_invoice_unique
      AND remote_household_invoice_unique
      AND line_parity
      AND no_unexpected_stripe_invoice
      AND jsonb_array_length(issues) = 0
    )
  ),
  UNIQUE (family_billing_account_id, billing_month, evidence_hash)
);

CREATE INDEX IF NOT EXISTS idx_billing_cycle_verification_latest
  ON billing_cycle_verification_evidence(
    family_billing_account_id,
    billing_month,
    created_at DESC,
    id DESC
  );

CREATE OR REPLACE FUNCTION reject_billing_cycle_verification_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'billing cycle verification evidence is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_cycle_verification_evidence_immutable
  ON billing_cycle_verification_evidence;
CREATE TRIGGER trg_billing_cycle_verification_evidence_immutable
BEFORE UPDATE OR DELETE ON billing_cycle_verification_evidence
FOR EACH ROW EXECUTE FUNCTION reject_billing_cycle_verification_evidence_mutation();
