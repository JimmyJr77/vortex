ALTER TABLE billing_payment
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_billing_payment_stripe_subscription
  ON billing_payment (stripe_subscription_id, paid_at DESC)
  WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON COLUMN billing_payment.stripe_subscription_id IS
  'Stripe subscription that produced this payment, used to attribute recurring renewals.';
