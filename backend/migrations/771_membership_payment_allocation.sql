-- Allow a settled payment to fund several charges and a charge to be funded by
-- several payments. Rows remain append-only; refunds use linked reversal rows.
ALTER TABLE billing_payment_application
  ADD COLUMN IF NOT EXISTS application_kind TEXT NOT NULL DEFAULT 'application',
  ADD COLUMN IF NOT EXISTS reverses_application_id BIGINT REFERENCES billing_payment_application(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS allocation_reason TEXT NOT NULL DEFAULT 'general';

ALTER TABLE billing_payment_application
  DROP CONSTRAINT IF EXISTS billing_payment_application_billing_payment_id_billing_charge_id_key;
ALTER TABLE billing_payment_application
  DROP CONSTRAINT IF EXISTS billing_payment_application_billing_charge_id_key;

ALTER TABLE billing_payment_application
  DROP CONSTRAINT IF EXISTS billing_payment_application_application_kind_check;
ALTER TABLE billing_payment_application
  ADD CONSTRAINT billing_payment_application_application_kind_check
  CHECK (application_kind IN ('application', 'reversal'));

ALTER TABLE billing_payment_application
  DROP CONSTRAINT IF EXISTS billing_payment_application_reversal_shape_check;
ALTER TABLE billing_payment_application
  ADD CONSTRAINT billing_payment_application_reversal_shape_check CHECK (
    (application_kind = 'application' AND reverses_application_id IS NULL) OR
    (application_kind = 'reversal' AND reverses_application_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_payment_application_idempotency
  ON billing_payment_application(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_payment_application_payment
  ON billing_payment_application(billing_payment_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_billing_payment_application_charge
  ON billing_payment_application(billing_charge_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_billing_payment_application_reversal
  ON billing_payment_application(reverses_application_id)
  WHERE reverses_application_id IS NOT NULL;

ALTER TABLE billing_charge DROP CONSTRAINT IF EXISTS billing_charge_collection_status_check;
ALTER TABLE billing_charge ADD CONSTRAINT billing_charge_collection_status_check
  CHECK (collection_status IN (
    'none', 'unpaid', 'partially_paid', 'checkout_pending', 'processing', 'paid', 'failed'
  ));

-- A fee charge points at the entitlement created only after the net fee is
-- fully satisfied. This avoids deriving membership state from a payer row.
ALTER TABLE additional_fee_redemption
  ADD COLUMN IF NOT EXISTS billing_charge_id BIGINT REFERENCES billing_charge(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS satisfied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_reason TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_additional_fee_redemption_charge
  ON additional_fee_redemption(billing_charge_id)
  WHERE billing_charge_id IS NOT NULL;
