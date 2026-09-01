-- Immutable follow-up to 058_billing_stripe_links.sql. Renewal and household
-- invoices can be delivered more than once, and newer Stripe API versions do
-- not always expose a PaymentIntent directly on the Invoice.

ALTER TABLE billing_payment
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_payment_stripe_invoice
  ON billing_payment (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;
