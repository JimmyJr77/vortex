-- One-time charge audit metadata. Kept on the immutable ledger row so the
-- specific promotional code that reduced a product is visible long after
-- checkout and discount-rule configuration have changed.
ALTER TABLE billing_charge
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
