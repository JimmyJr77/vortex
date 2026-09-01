-- Pending enrollment payloads awaiting Stripe Checkout completion.
-- Idempotent; applied on boot via initPlatformTables.

CREATE TABLE IF NOT EXISTS stripe_pending_enrollment (
  id                          BIGSERIAL PRIMARY KEY,
  family_billing_account_id   BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE CASCADE,
  member_id                   BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  payload                     JSONB NOT NULL,
  preview_snapshot            JSONB,
  due_now_cents               INTEGER NOT NULL DEFAULT 0,
  checkout_mode               TEXT NOT NULL DEFAULT 'payment'
                              CHECK (checkout_mode IN ('payment', 'subscription')),
  stripe_checkout_session_id  TEXT UNIQUE,
  status                      TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'completed', 'expired', 'failed')),
  error_message               TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at                  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_stripe_pending_enrollment_status
  ON stripe_pending_enrollment (status, expires_at);

CREATE INDEX IF NOT EXISTS idx_stripe_pending_enrollment_member
  ON stripe_pending_enrollment (member_id, status);
