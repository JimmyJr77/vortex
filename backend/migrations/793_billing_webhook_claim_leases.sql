-- Give Stripe webhook workers an explicit, compare-and-swap lease. A worker
-- that dies while an event is `processing` can then be replaced safely without
-- allowing the stale worker to complete or fail the replacement's claim.

ALTER TABLE stripe_webhook_event
  ADD COLUMN IF NOT EXISTS claim_token TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

-- Preserve the old fifteen-minute stale threshold for rows that were already
-- processing when this migration was deployed. They remain reclaimable; no
-- synthetic claim token is assigned to an unknown worker.
UPDATE stripe_webhook_event
   SET lease_expires_at = COALESCE(lease_expires_at, updated_at + interval '15 minutes')
 WHERE status = 'processing';

ALTER TABLE stripe_webhook_event
  DROP CONSTRAINT IF EXISTS stripe_webhook_event_terminal_claim_check;
ALTER TABLE stripe_webhook_event
  ADD CONSTRAINT stripe_webhook_event_terminal_claim_check CHECK (
    status = 'processing'
    OR (claim_token IS NULL AND lease_expires_at IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_event_processing_lease
  ON stripe_webhook_event (lease_expires_at, event_id)
  WHERE status = 'processing';
