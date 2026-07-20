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

-- Renewal invoices can be delivered more than once and newer Stripe API
-- versions do not always expose a PaymentIntent directly on the Invoice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_payment_stripe_invoice
  ON billing_payment (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;
