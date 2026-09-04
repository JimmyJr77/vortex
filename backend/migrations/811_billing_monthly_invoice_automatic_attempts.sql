-- Durable automatic-collection generations. A household invoice may receive
-- exactly one initial automated attempt and one fifth-day retry after Stripe
-- confirms the initial failure. These counters make that policy survive worker
-- restarts and concurrent scheduler invocations.

ALTER TABLE billing_monthly_invoice
  ADD COLUMN IF NOT EXISTS automatic_attempt_count SMALLINT NOT NULL DEFAULT 0
    CHECK (automatic_attempt_count BETWEEN 0 AND 2),
  ADD COLUMN IF NOT EXISTS last_automatic_attempt_at TIMESTAMPTZ;

UPDATE billing_monthly_invoice
   SET automatic_attempt_count = 1,
       last_automatic_attempt_at = COALESCE(last_automatic_attempt_at, payment_attempted_at)
 WHERE automatic_attempt_count = 0
   AND payment_attempted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_monthly_invoice_automatic_attempt
  ON billing_monthly_invoice(family_billing_account_id, billing_month, automatic_attempt_count);
