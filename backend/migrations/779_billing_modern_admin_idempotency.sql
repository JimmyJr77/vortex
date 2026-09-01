-- Idempotency contracts for modern administrative billing and entitlement writes.
-- Existing financial rows remain untouched; only newly migrated endpoints write keys.

ALTER TABLE billing_payment
  ADD COLUMN IF NOT EXISTS request_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_payment_request_key
  ON billing_payment(request_key)
  WHERE request_key IS NOT NULL;

ALTER TABLE multi_class_pass_redemption
  ADD COLUMN IF NOT EXISTS request_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_multi_class_pass_redemption_request_key
  ON multi_class_pass_redemption(request_key)
  WHERE request_key IS NOT NULL;

