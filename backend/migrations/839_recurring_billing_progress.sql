-- Operational progress only; no charge, payment, or entitlement changes.
CREATE TABLE IF NOT EXISTS billing_recurring_run (
  id UUID PRIMARY KEY,
  as_of TIMESTAMPTZ NOT NULL,
  collect_payments BOOLEAN NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','completed','completed_with_review_holds','failed','interrupted')),
  phase TEXT NOT NULL DEFAULT 'starting',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS billing_recurring_account_progress (
  run_id UUID NOT NULL REFERENCES billing_recurring_run(id),
  family_billing_account_id BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('preparation','collection','enrollment_recovery')),
  status TEXT NOT NULL CHECK (status IN ('pending','running','retrying','completed','blocked','skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (run_id, family_billing_account_id, phase)
);
CREATE INDEX IF NOT EXISTS idx_billing_recurring_run_started ON billing_recurring_run(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_recurring_account_pending
  ON billing_recurring_account_progress(run_id, status, family_billing_account_id);
