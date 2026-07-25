-- Actor attribution for manual financial ledger mutations.

ALTER TABLE billing_charge
  ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT;

ALTER TABLE billing_payment
  ADD COLUMN IF NOT EXISTS recorded_by_user_id BIGINT;
