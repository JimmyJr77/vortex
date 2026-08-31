-- Supports the account-scoped ordering used by progressive member billing audit pages.
CREATE INDEX IF NOT EXISTS idx_billing_charge_account_created
  ON billing_charge(family_billing_account_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_billing_payment_account_paid
  ON billing_payment(family_billing_account_id, paid_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_billing_refund_account_created
  ON billing_refund(family_billing_account_id, created_at DESC, id DESC);
