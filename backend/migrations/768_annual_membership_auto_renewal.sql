ALTER TABLE billing_subscription
  ADD COLUMN IF NOT EXISTS auto_renewal BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE billing_subscription
SET auto_renewal = FALSE,
    updated_at = now()
WHERE status = 'cancelled'
  AND auto_renewal IS DISTINCT FROM FALSE;

COMMENT ON COLUMN billing_subscription.auto_renewal IS
  'Whether the recurring subscription is expected to renew after its current paid-through period.';
