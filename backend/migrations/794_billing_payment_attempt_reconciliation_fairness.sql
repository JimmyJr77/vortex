-- A permanently ambiguous attempt must not starve newer attempts behind a
-- fixed LIMIT.  Reconciliation advances this cursor even when the remote
-- outcome remains inconclusive, producing a durable round-robin scan.

ALTER TABLE billing_payment_attempt
  ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_billing_payment_attempt_reconcile_round_robin
  ON billing_payment_attempt(last_reconciled_at NULLS FIRST, id)
  WHERE status IN ('pending', 'processing', 'reconciliation_required');
