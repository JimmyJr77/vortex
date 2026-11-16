-- Display-only projection. Collection continues to verify Stripe directly.
-- Existing customer/payment references and financial records remain untouched.
CREATE TABLE IF NOT EXISTS stripe_customer_projection (
  family_billing_account_id BIGINT PRIMARY KEY REFERENCES family_billing_account(id) ON DELETE RESTRICT,
  stripe_customer_id TEXT NOT NULL,
  customer_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_payment_method_id TEXT,
  payment_method_type TEXT,
  payment_method_brand TEXT,
  payment_method_last4 TEXT CHECK (payment_method_last4 IS NULL OR payment_method_last4 ~ '^[0-9]{4}$'),
  payment_method_exp_month INTEGER CHECK (payment_method_exp_month BETWEEN 1 AND 12),
  payment_method_exp_year INTEGER CHECK (payment_method_exp_year > 0),
  payment_method_blocked_reason TEXT CHECK (payment_method_blocked_reason IS NULL OR payment_method_blocked_reason = 'link_account_closed'),
  sync_status TEXT NOT NULL CHECK (sync_status IN ('synced', 'failed')),
  synced_at TIMESTAMPTZ,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_stripe_customer_projection_method
  ON stripe_customer_projection(stripe_payment_method_id)
  WHERE stripe_payment_method_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stripe_customer_projection_attempt
  ON stripe_customer_projection(attempted_at, family_billing_account_id);
