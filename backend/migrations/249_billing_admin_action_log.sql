-- Auditable customer-service actions initiated from the billing admin.

CREATE TABLE IF NOT EXISTS billing_admin_action (
  id BIGSERIAL PRIMARY KEY,
  family_billing_account_id BIGINT NOT NULL
    REFERENCES family_billing_account(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (
    action_type IN ('payment_link_sent', 'payment_receipt_resent', 'refund_receipt_resent')
  ),
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'succeeded', 'failed')),
  amount_cents INTEGER,
  recipient_email TEXT,
  stripe_object_id TEXT,
  related_payment_id BIGINT REFERENCES billing_payment(id) ON DELETE SET NULL,
  related_refund_id BIGINT REFERENCES billing_refund(id) ON DELETE SET NULL,
  initiated_by_user_id BIGINT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_billing_admin_action_account
  ON billing_admin_action (family_billing_account_id, created_at DESC);
