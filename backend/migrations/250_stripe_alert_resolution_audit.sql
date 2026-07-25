-- Preserve who resolved each financial operations alert and why.

ALTER TABLE stripe_billing_alert
  ADD COLUMN IF NOT EXISTS resolved_by_user_id BIGINT;

ALTER TABLE stripe_billing_alert
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;
