-- Permit distinct, stackable tuition promo assignments to overlap on one
-- enrollment. Fixed final prices remain exclusive, duplicate promo assignments
-- remain invalid, and the immutable adjustment rows continue to be revoked
-- rather than edited or deleted.

CREATE OR REPLACE FUNCTION reject_overlapping_enrollment_price_adjustment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'revoked' AND EXISTS (
    SELECT 1
    FROM enrollment_price_adjustment existing
    WHERE existing.signup_id = NEW.signup_id
      AND existing.id <> COALESCE(NEW.id, 0)
      AND existing.status <> 'revoked'
      AND daterange(
        existing.effective_from_month,
        COALESCE(existing.effective_through_month + 1, 'infinity'::date),
        '[)'
      ) && daterange(
        NEW.effective_from_month,
        COALESCE(NEW.effective_through_month + 1, 'infinity'::date),
        '[)'
      )
      AND NOT (
        existing.kind IN ('promo_code', 'legacy_discount')
        AND NEW.kind IN ('promo_code', 'legacy_discount')
        AND (
          existing.discount_rule_id IS NULL
          OR NEW.discount_rule_id IS NULL
          OR existing.discount_rule_id <> NEW.discount_rule_id
        )
        AND (
          NULLIF(UPPER(TRIM(existing.promo_code)), '') IS NULL
          OR NULLIF(UPPER(TRIM(NEW.promo_code)), '') IS NULL
          OR UPPER(TRIM(existing.promo_code)) <> UPPER(TRIM(NEW.promo_code))
        )
        AND COALESCE(existing.discount_rule_snapshot->'stackable', 'true'::jsonb) <> 'false'::jsonb
        AND COALESCE(NEW.discount_rule_snapshot->'stackable', 'true'::jsonb) <> 'false'::jsonb
        AND (
          NULLIF(COALESCE(
            existing.discount_rule_snapshot->>'exclusivityGroup',
            existing.discount_rule_snapshot->>'exclusivity_group'
          ), '') IS NULL
          OR NULLIF(COALESCE(
            NEW.discount_rule_snapshot->>'exclusivityGroup',
            NEW.discount_rule_snapshot->>'exclusivity_group'
          ), '') IS NULL
          OR COALESCE(
            existing.discount_rule_snapshot->>'exclusivityGroup',
            existing.discount_rule_snapshot->>'exclusivity_group'
          ) <> COALESCE(
            NEW.discount_rule_snapshot->>'exclusivityGroup',
            NEW.discount_rule_snapshot->>'exclusivity_group'
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Enrollment price adjustment conflicts with an existing adjustment'
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;

-- Preserve the failed/retryable state for restored schedules, but remove the
-- one-off migration explanation from the customer account surface.
UPDATE billing_subscription
SET price_sync_error = NULL,
    updated_at = now()
WHERE price_sync_error = 'Restored promo assignment requires Stripe expiration-schedule synchronization.';
