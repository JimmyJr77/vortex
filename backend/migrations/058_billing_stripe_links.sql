-- Stripe checkout/invoice links on ledger rows (enrollment subscription Checkout).

ALTER TABLE billing_payment
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

ALTER TABLE billing_payment
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;

ALTER TABLE billing_charge
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_payment_stripe_checkout
  ON billing_payment (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
