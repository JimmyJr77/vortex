-- PostgreSQL truncated this generated name to 63 bytes on the existing
-- production table. It is specifically the legacy UNIQUE(payment, charge)
-- constraint; the charge-only constraint was removed by migration 771.
ALTER TABLE billing_payment_application
  DROP CONSTRAINT IF EXISTS billing_payment_application_billing_payment_id_billing_char_key;
