-- Production Stripe operations: idempotent refunds, webhook audit, and billing alerts.

ALTER TABLE billing_refund ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;
ALTER TABLE billing_refund ADD COLUMN IF NOT EXISTS external_status TEXT NOT NULL DEFAULT 'succeeded';
ALTER TABLE billing_refund ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE billing_refund ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_refund_stripe_refund
  ON billing_refund (stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stripe_webhook_event (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_event_status
  ON stripe_webhook_event (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS stripe_billing_alert (
  id BIGSERIAL PRIMARY KEY,
  stripe_event_id TEXT UNIQUE,
  family_billing_account_id BIGINT REFERENCES family_billing_account(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  stripe_object_id TEXT,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_billing_alert_open
  ON stripe_billing_alert (created_at DESC)
  WHERE resolved_at IS NULL;
