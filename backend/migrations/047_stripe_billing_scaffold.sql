-- Stripe scaffolding (flag-gated; not live until STRIPE_ENABLED=true).
ALTER TABLE family_billing_account
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Idempotent payment recording from Stripe webhooks.
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_payment_stripe_pi
  ON billing_payment (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
