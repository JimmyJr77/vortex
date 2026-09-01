-- Canonical reads count only payments whose processor lifecycle is complete.
-- Rows written before external_status existed, plus the former manual-payment
-- "recorded" label, are durable evidence of completed payments and can be
-- normalized deterministically without changing any amount or timestamp.

UPDATE billing_payment
   SET external_status = 'settled'
 WHERE external_status IS NULL
    OR lower(btrim(external_status)) IN ('', 'recorded', 'paid', 'complete', 'completed');

ALTER TABLE billing_payment
  ALTER COLUMN external_status SET DEFAULT 'settled',
  ALTER COLUMN external_status SET NOT NULL;

ALTER TABLE billing_payment
  DROP CONSTRAINT IF EXISTS billing_payment_external_status_check;

ALTER TABLE billing_payment
  ADD CONSTRAINT billing_payment_external_status_check CHECK (
    external_status IN (
      'settled',
      'succeeded',
      'pending',
      'processing',
      'reconciliation_required',
      'failed',
      'canceled',
      'cancelled'
    )
  ) NOT VALID;

-- A pass adjustment idempotency key is global by design, but a replay is
-- valid only for the exact account, pass and request payload that first used
-- it. The fingerprint is immutable request evidence; existing adjustment rows
-- remain readable but cannot be guessed into a replay.
ALTER TABLE multi_class_pass_redemption
  ADD COLUMN IF NOT EXISTS idempotency_fingerprint TEXT;

ALTER TABLE multi_class_pass_redemption
  DROP CONSTRAINT IF EXISTS multi_class_pass_redemption_idempotency_fingerprint_check;

ALTER TABLE multi_class_pass_redemption
  ADD CONSTRAINT multi_class_pass_redemption_idempotency_fingerprint_check CHECK (
    idempotency_fingerprint IS NULL
    OR idempotency_fingerprint ~ '^[0-9a-f]{64}$'
  );

