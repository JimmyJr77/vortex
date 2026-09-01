-- Durable orchestration state for the legacy-to-canonical billing consolidation.
-- Financial records remain in the canonical billing ledger; these tables track
-- migration evidence, resumable external work, exceptions, and rollback state.

CREATE TABLE IF NOT EXISTS billing_migration_run (
  id                         BIGSERIAL PRIMARY KEY,
  migration_key              TEXT NOT NULL,
  idempotency_key            TEXT,
  mode                       TEXT NOT NULL CHECK (mode IN ('dry_run', 'shadow', 'apply', 'rollback')),
  status                     TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN (
                               'pending', 'running', 'completed',
                               'completed_with_exceptions', 'failed', 'cancelled'
                             )),
  code_version               TEXT,
  manifest_checksum          TEXT,
  requested_by_user_id       BIGINT,
  requested_by_type          TEXT NOT NULL DEFAULT 'system'
                             CHECK (requested_by_type IN ('admin', 'system')),
  configuration              JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at                 TIMESTAMPTZ,
  completed_at               TIMESTAMPTZ,
  error_message              TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(configuration) = 'object'),
  CHECK (jsonb_typeof(summary) = 'object'),
  CHECK (
    status NOT IN ('completed', 'completed_with_exceptions', 'failed', 'cancelled')
    OR completed_at IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_migration_run_idempotency
  ON billing_migration_run(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_migration_run_key_status
  ON billing_migration_run(migration_key, status, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS billing_account_migration (
  id                         BIGSERIAL PRIMARY KEY,
  billing_migration_run_id   BIGINT NOT NULL REFERENCES billing_migration_run(id) ON DELETE RESTRICT,
  family_billing_account_id  BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE RESTRICT,
  state                      TEXT NOT NULL DEFAULT 'discovered'
                             CHECK (state IN (
                               'discovered', 'repairing', 'blocked', 'shadow_verified', 'armed',
                               'cancellation_scheduled', 'detached', 'remote_retired',
                               'household_active', 'verified', 'rollback_pending',
                               'rolled_back', 'failed_forward_only'
                             )),
  payer_validation_status    TEXT NOT NULL DEFAULT 'pending'
                             CHECK (payer_validation_status IN (
                               'pending', 'verified', 'ambiguous', 'invalid', 'not_applicable'
                             )),
  parity_status              TEXT NOT NULL DEFAULT 'pending'
                             CHECK (parity_status IN ('pending', 'matched', 'mismatched', 'not_applicable')),
  source_collection_mode     TEXT NOT NULL DEFAULT 'unknown'
                             CHECK (source_collection_mode IN (
                               'legacy_per_class', 'household_monthly', 'manual', 'unknown'
                             )),
  target_collection_mode     TEXT NOT NULL DEFAULT 'household_monthly'
                             CHECK (target_collection_mode IN ('household_monthly', 'legacy_per_class', 'manual')),
  cutover_month              DATE,
  parity_snapshot            JSONB NOT NULL DEFAULT '{}'::jsonb,
  stripe_snapshot            JSONB NOT NULL DEFAULT '{}'::jsonb,
  rollback_snapshot          JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempt_count              INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at            TIMESTAMPTZ,
  lease_owner                TEXT,
  lease_expires_at           TIMESTAMPTZ,
  lock_version               INTEGER NOT NULL DEFAULT 0 CHECK (lock_version >= 0),
  last_error                 TEXT,
  armed_at                   TIMESTAMPTZ,
  cancellation_scheduled_at  TIMESTAMPTZ,
  detached_at                TIMESTAMPTZ,
  remote_retired_at          TIMESTAMPTZ,
  household_activated_at     TIMESTAMPTZ,
  verified_at                TIMESTAMPTZ,
  rollback_started_at        TIMESTAMPTZ,
  rolled_back_at             TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (billing_migration_run_id, family_billing_account_id),
  UNIQUE (id, billing_migration_run_id),
  CHECK (cutover_month IS NULL OR date_trunc('month', cutover_month)::date = cutover_month),
  CHECK (jsonb_typeof(parity_snapshot) = 'object'),
  CHECK (jsonb_typeof(stripe_snapshot) = 'object'),
  CHECK (jsonb_typeof(rollback_snapshot) = 'object'),
  CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_billing_account_migration_run_state
  ON billing_account_migration(billing_migration_run_id, state, id);
CREATE INDEX IF NOT EXISTS idx_billing_account_migration_account
  ON billing_account_migration(family_billing_account_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_billing_account_migration_claim
  ON billing_account_migration(state, next_attempt_at, lease_expires_at, id)
  WHERE state NOT IN ('blocked', 'verified', 'rolled_back', 'failed_forward_only');

CREATE TABLE IF NOT EXISTS billing_account_migration_item (
  id                            BIGSERIAL PRIMARY KEY,
  billing_account_migration_id  BIGINT NOT NULL REFERENCES billing_account_migration(id) ON DELETE RESTRICT,
  item_type                     TEXT NOT NULL CHECK (item_type IN (
                                  'billing_subscription', 'stripe_subscription', 'billing_charge',
                                  'billing_payment', 'billing_refund', 'annual_membership',
                                  'bundle_pass', 'bundle_usage', 'statement', 'other'
                                )),
  source_id                     TEXT NOT NULL,
  target_id                     TEXT,
  state                         TEXT NOT NULL DEFAULT 'discovered'
                                CHECK (state IN (
                                  'discovered', 'planned', 'skipped', 'migrated', 'verified',
                                  'rollback_required', 'rolled_back', 'failed'
                                )),
  idempotency_key               TEXT,
  source_snapshot               JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_snapshot               JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempt_count                 INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lock_version                  INTEGER NOT NULL DEFAULT 0 CHECK (lock_version >= 0),
  last_error                    TEXT,
  migrated_at                   TIMESTAMPTZ,
  verified_at                   TIMESTAMPTZ,
  rolled_back_at                TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (billing_account_migration_id, item_type, source_id),
  CHECK (jsonb_typeof(source_snapshot) = 'object'),
  CHECK (jsonb_typeof(target_snapshot) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_account_migration_item_idempotency
  ON billing_account_migration_item(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_account_migration_item_account_state
  ON billing_account_migration_item(billing_account_migration_id, state, id);

CREATE TABLE IF NOT EXISTS billing_migration_exception (
  id                            BIGSERIAL PRIMARY KEY,
  billing_migration_run_id      BIGINT NOT NULL REFERENCES billing_migration_run(id) ON DELETE RESTRICT,
  billing_account_migration_id  BIGINT,
  dedupe_key                    TEXT NOT NULL,
  exception_type                TEXT NOT NULL,
  severity                      TEXT NOT NULL DEFAULT 'blocking'
                                CHECK (severity IN ('info', 'warning', 'blocking', 'critical')),
  status                        TEXT NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open', 'acknowledged', 'resolved', 'waived')),
  message                       TEXT NOT NULL,
  details                       JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolution_note               TEXT,
  resolved_by_user_id           BIGINT,
  detected_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at                   TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (billing_migration_run_id, dedupe_key),
  FOREIGN KEY (billing_account_migration_id, billing_migration_run_id)
    REFERENCES billing_account_migration(id, billing_migration_run_id) ON DELETE RESTRICT,
  CHECK (jsonb_typeof(details) = 'object'),
  CHECK (
    status NOT IN ('resolved', 'waived')
    OR (resolved_at IS NOT NULL AND NULLIF(BTRIM(resolution_note), '') IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_billing_migration_exception_run_status
  ON billing_migration_exception(billing_migration_run_id, status, severity, detected_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_billing_migration_exception_account
  ON billing_migration_exception(billing_account_migration_id, status, detected_at DESC, id DESC)
  WHERE billing_account_migration_id IS NOT NULL;
