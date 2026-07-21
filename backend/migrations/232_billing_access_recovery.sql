-- Staff-reviewed suspension/restoration after Stripe payment recovery is exhausted.

ALTER TABLE stripe_billing_alert
  ADD COLUMN IF NOT EXISTS action_status TEXT NOT NULL DEFAULT 'open';

ALTER TABLE stripe_billing_alert
  DROP CONSTRAINT IF EXISTS stripe_billing_alert_action_status_check;

ALTER TABLE stripe_billing_alert
  ADD CONSTRAINT stripe_billing_alert_action_status_check
  CHECK (action_status IN ('open', 'processing', 'suspended', 'resolved'));

CREATE TABLE IF NOT EXISTS billing_access_action (
  id BIGSERIAL PRIMARY KEY,
  stripe_billing_alert_id BIGINT NOT NULL REFERENCES stripe_billing_alert(id) ON DELETE CASCADE,
  family_billing_account_id BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('suspend', 'restore')),
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'succeeded', 'failed')),
  reason TEXT NOT NULL,
  acted_by_user_id BIGINT,
  affected_subscription_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  affected_signup_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  stripe_outcomes JSONB NOT NULL DEFAULT '[]'::jsonb,
  notification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (notification_status IN ('pending', 'sent', 'skipped', 'failed')),
  notification_error TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_billing_access_action_alert
  ON billing_access_action (stripe_billing_alert_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_access_action_account
  ON billing_access_action (family_billing_account_id, created_at DESC);
