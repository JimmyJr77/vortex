CREATE TABLE IF NOT EXISTS stripe_reconciliation_run (
  id BIGSERIAL PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  window_started_at TIMESTAMPTZ NOT NULL,
  window_ended_at TIMESTAMPTZ NOT NULL,
  stripe_payments_checked INTEGER NOT NULL DEFAULT 0,
  payments_inserted INTEGER NOT NULL DEFAULT 0,
  mismatches_found INTEGER NOT NULL DEFAULT 0,
  disputes_checked INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stripe_reconciliation_run_started
  ON stripe_reconciliation_run (started_at DESC);
