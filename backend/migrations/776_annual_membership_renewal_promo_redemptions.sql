-- A membership promo can be carried into a future athlete-owned renewal only
-- while it remains eligible. Track each actual Stripe renewal redemption so
-- usage caps are enforced again before the following yearly invoice.
ALTER TABLE discount_redemption
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;

ALTER TABLE discount_redemption
  ADD COLUMN IF NOT EXISTS annual_membership_renewal_pricing_id BIGINT
    REFERENCES annual_membership_renewal_pricing(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_discount_redemption_membership_renewal_invoice
  ON discount_redemption (stripe_invoice_id, rule_id)
  WHERE stripe_invoice_id IS NOT NULL AND rule_id IS NOT NULL;
