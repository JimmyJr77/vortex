-- Per-tier eligibility floors for multi-family (and other tiered) discounts.
ALTER TABLE discount_rule_tier
  ADD COLUMN IF NOT EXISTS min_monthly_cents INTEGER,
  ADD COLUMN IF NOT EXISTS min_paid_enrollments INTEGER,
  ADD COLUMN IF NOT EXISTS min_per_class_cents INTEGER,
  ADD COLUMN IF NOT EXISTS max_discount_cents INTEGER;
