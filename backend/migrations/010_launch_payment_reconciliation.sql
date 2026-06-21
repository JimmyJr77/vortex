ALTER TABLE IF EXISTS billing_payment
  ADD COLUMN IF NOT EXISTS external_processor TEXT,
  ADD COLUMN IF NOT EXISTS external_reference TEXT,
  ADD COLUMN IF NOT EXISTS external_status TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_billing_payment_external_reference
  ON billing_payment(external_reference);
