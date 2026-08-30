-- Promote attributed legacy enrollment discounts into first-class, effective-dated
-- tuition promo assignments. The superseded row remains immutable audit history.

UPDATE enrollment_price_adjustment adjustment
SET status = 'revoked',
    revoked_at = now(),
    revoke_reason = 'Migrated to canonical effective-dated promo assignment by 764'
FROM discount_rule rule
WHERE adjustment.kind = 'legacy_discount'
  AND adjustment.status = 'active'
  AND adjustment.discount_rule_id = rule.id
  AND rule.type = 'promo_code'
  AND COALESCE(
        NULLIF(adjustment.promo_code, ''),
        NULLIF(rule.config->>'code', ''),
        NULLIF(rule.config->>'promo_code', '')
      ) IS NOT NULL
  AND (
    rule.ends_at IS NULL OR
    date_trunc('month', rule.ends_at AT TIME ZONE 'America/New_York')::date >= adjustment.effective_from_month
  );

INSERT INTO enrollment_price_adjustment (
  family_billing_account_id,
  member_id,
  signup_id,
  billing_subscription_id,
  kind,
  promo_code,
  discount_rule_id,
  discount_rule_snapshot,
  effective_from_month,
  effective_through_month,
  standard_price_cents,
  preview_snapshot,
  reason,
  status,
  created_by_user_id,
  supersedes_adjustment_id
)
SELECT
  legacy.family_billing_account_id,
  legacy.member_id,
  legacy.signup_id,
  legacy.billing_subscription_id,
  'promo_code',
  COALESCE(
    NULLIF(legacy.promo_code, ''),
    NULLIF(rule.config->>'code', ''),
    NULLIF(rule.config->>'promo_code', '')
  ),
  rule.id,
  COALESCE(legacy.discount_rule_snapshot, '{}'::jsonb) || jsonb_build_object(
    'id', rule.id,
    'name', rule.name,
    'description', rule.description,
    'type', rule.type,
    'amountType', rule.amount_type,
    'amountValue', rule.amount_value,
    'applyTo', rule.apply_to,
    'calcBase', rule.calc_base,
    'priority', rule.priority,
    'stackable', rule.stackable,
    'exclusivityGroup', rule.exclusivity_group,
    'maxDiscountCents', rule.max_discount_cents,
    'scopeLevel', rule.scope_level,
    'scopeRefId', rule.scope_ref_id,
    'startsAt', rule.starts_at,
    'endsAt', rule.ends_at,
    'expiresOn', CASE
      WHEN rule.ends_at IS NULL THEN NULL
      ELSE to_char(rule.ends_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    END,
    'config', rule.config
  ),
  legacy.effective_from_month,
  CASE
    WHEN rule.ends_at IS NULL THEN NULL
    ELSE date_trunc('month', rule.ends_at AT TIME ZONE 'America/New_York')::date
  END,
  legacy.standard_price_cents,
  COALESCE(legacy.preview_snapshot, '{}'::jsonb) || jsonb_build_object(
    'source', 'canonical_promo_assignment_migration_764'
  ),
  legacy.reason,
  'active',
  legacy.created_by_user_id,
  legacy.id
FROM enrollment_price_adjustment legacy
JOIN discount_rule rule ON rule.id = legacy.discount_rule_id
WHERE legacy.kind = 'legacy_discount'
  AND legacy.status = 'revoked'
  AND legacy.revoke_reason = 'Migrated to canonical effective-dated promo assignment by 764'
  AND NOT EXISTS (
    SELECT 1
    FROM enrollment_price_adjustment replacement
    WHERE replacement.supersedes_adjustment_id = legacy.id
  );

INSERT INTO billing_account_activity (
  event_key,
  family_billing_account_id,
  member_id,
  signup_id,
  event_type,
  summary,
  before_value,
  after_value,
  details,
  actor_type
)
SELECT
  'canonical-promo-assignment-migrated:' || replacement.id,
  replacement.family_billing_account_id,
  replacement.member_id,
  replacement.signup_id,
  'enrollment_promo_assignment_migrated',
  'Enrollment discount code migrated to canonical effective-dated pricing',
  jsonb_build_object('adjustmentId', legacy.id, 'kind', legacy.kind),
  jsonb_build_object(
    'adjustmentId', replacement.id,
    'kind', replacement.kind,
    'promoCode', replacement.promo_code,
    'effectiveFromMonth', replacement.effective_from_month,
    'effectiveThroughMonth', replacement.effective_through_month
  ),
  jsonb_build_object('migration', 764),
  'system'
FROM enrollment_price_adjustment replacement
JOIN enrollment_price_adjustment legacy ON legacy.id = replacement.supersedes_adjustment_id
WHERE legacy.revoke_reason = 'Migrated to canonical effective-dated promo assignment by 764'
ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING;

-- Existing direct Stripe prices remain unchanged, but a finite promo now needs a
-- schedule phase that restores canonical tuition after its expiration.
UPDATE billing_subscription subscription
SET price_sync_status = 'failed',
    price_sync_error = 'Promo assignment was migrated; retry synchronization to create its expiration schedule.',
    updated_at = now()
FROM enrollment_price_adjustment replacement
JOIN enrollment_price_adjustment legacy ON legacy.id = replacement.supersedes_adjustment_id
WHERE subscription.id = replacement.billing_subscription_id
  AND subscription.stripe_subscription_id IS NOT NULL
  AND replacement.kind = 'promo_code'
  AND replacement.status = 'active'
  AND legacy.revoke_reason = 'Migrated to canonical effective-dated promo assignment by 764';
