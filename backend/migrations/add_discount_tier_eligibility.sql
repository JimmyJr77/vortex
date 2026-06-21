-- Per-tier eligibility floors for multi-family (and other tiered) discounts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'discount_rule_tier'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE discount_rule_tier
    ADD COLUMN IF NOT EXISTS min_monthly_cents INTEGER,
    ADD COLUMN IF NOT EXISTS min_paid_enrollments INTEGER,
    ADD COLUMN IF NOT EXISTS min_per_class_cents INTEGER,
    ADD COLUMN IF NOT EXISTS max_discount_cents INTEGER;
END $$;
