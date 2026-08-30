-- Restore canonical promo assignments that an administrator revoked only because
-- the pre-765 Customer Billing resolver displayed the code without applying it.
-- The original and revoked rows remain immutable audit history.

WITH repair_candidates AS (
  SELECT DISTINCT ON (legacy.signup_id)
    legacy.*,
    rule.name AS rule_name,
    rule.description AS rule_description,
    rule.type AS rule_type,
    rule.amount_type AS rule_amount_type,
    rule.amount_value AS rule_amount_value,
    rule.apply_to AS rule_apply_to,
    rule.calc_base AS rule_calc_base,
    rule.priority AS rule_priority,
    rule.stackable AS rule_stackable,
    rule.exclusivity_group AS rule_exclusivity_group,
    rule.max_discount_cents AS rule_max_discount_cents,
    rule.scope_level AS rule_scope_level,
    rule.scope_ref_id AS rule_scope_ref_id,
    rule.starts_at AS rule_starts_at,
    rule.ends_at AS rule_ends_at,
    rule.config AS rule_config
  FROM enrollment_price_adjustment legacy
  JOIN discount_rule rule ON rule.id = legacy.discount_rule_id
  JOIN scheduling_signup signup ON signup.id = legacy.signup_id
  JOIN billing_subscription subscription ON subscription.id = legacy.billing_subscription_id
  WHERE legacy.kind = 'legacy_discount'
    AND legacy.status = 'revoked'
    AND legacy.promo_code IS NOT NULL
    AND LOWER(TRIM(COALESCE(legacy.revoke_reason, ''))) = 'not being applied properly'
    AND rule.type = 'promo_code'
    AND rule.active = TRUE
    AND signup.manual_discount_rule_id = rule.id
    AND signup.status = 'confirmed'
    AND subscription.status = 'active'
    AND (rule.starts_at IS NULL OR rule.starts_at <= now())
    AND (rule.ends_at IS NULL OR rule.ends_at > now())
    AND NOT EXISTS (
      SELECT 1
      FROM enrollment_price_adjustment current_assignment
      WHERE current_assignment.signup_id = legacy.signup_id
        AND current_assignment.status <> 'revoked'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM enrollment_price_adjustment replacement
      WHERE replacement.supersedes_adjustment_id = legacy.id
    )
  ORDER BY legacy.signup_id, legacy.revoked_at DESC NULLS LAST, legacy.id DESC
)
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
  candidate.family_billing_account_id,
  candidate.member_id,
  candidate.signup_id,
  candidate.billing_subscription_id,
  'promo_code',
  candidate.promo_code,
  candidate.discount_rule_id,
  jsonb_build_object(
    'id', candidate.discount_rule_id,
    'name', candidate.rule_name,
    'description', candidate.rule_description,
    'type', candidate.rule_type,
    'amountType', candidate.rule_amount_type,
    'amountValue', candidate.rule_amount_value,
    'applyTo', candidate.rule_apply_to,
    'calcBase', candidate.rule_calc_base,
    'priority', candidate.rule_priority,
    'stackable', candidate.rule_stackable,
    'exclusivityGroup', candidate.rule_exclusivity_group,
    'maxDiscountCents', candidate.rule_max_discount_cents,
    'scopeLevel', candidate.rule_scope_level,
    'scopeRefId', candidate.rule_scope_ref_id,
    'startsAt', candidate.rule_starts_at,
    'endsAt', candidate.rule_ends_at,
    'expiresOn', CASE
      WHEN candidate.rule_ends_at IS NULL THEN NULL
      ELSE to_char(candidate.rule_ends_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    END,
    'config', candidate.rule_config
  ),
  GREATEST(
    candidate.effective_from_month,
    COALESCE(date_trunc('month', candidate.rule_starts_at AT TIME ZONE 'America/New_York')::date,
             candidate.effective_from_month)
  ),
  CASE
    WHEN candidate.rule_ends_at IS NULL THEN NULL
    ELSE date_trunc('month', candidate.rule_ends_at AT TIME ZONE 'America/New_York')::date
  END,
  candidate.standard_price_cents,
  jsonb_build_object(
    'source', 'restore_failed_customer_billing_promo_765',
    'repairedRevocationReason', candidate.revoke_reason
  ),
  'Restored after the Customer Billing promo application defect: ' || candidate.reason,
  'active',
  candidate.revoked_by_user_id,
  candidate.id
FROM repair_candidates candidate;

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
  'failed-customer-billing-promo-restored:' || replacement.id,
  replacement.family_billing_account_id,
  replacement.member_id,
  replacement.signup_id,
  'enrollment_promo_assignment_restored',
  'Tuition promo restored after the Customer Billing application defect',
  jsonb_build_object(
    'adjustmentId', revoked.id,
    'status', revoked.status,
    'revokeReason', revoked.revoke_reason
  ),
  jsonb_build_object(
    'adjustmentId', replacement.id,
    'kind', replacement.kind,
    'promoCode', replacement.promo_code,
    'effectiveFromMonth', replacement.effective_from_month,
    'effectiveThroughMonth', replacement.effective_through_month,
    'status', replacement.status
  ),
  jsonb_build_object('migration', 765),
  'system'
FROM enrollment_price_adjustment replacement
JOIN enrollment_price_adjustment revoked ON revoked.id = replacement.supersedes_adjustment_id
WHERE replacement.preview_snapshot->>'source' = 'restore_failed_customer_billing_promo_765'
ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING;

-- The current Stripe amount is retained, but finite restored promos need a
-- subscription schedule that returns to canonical tuition after expiration.
UPDATE billing_subscription subscription
SET price_sync_status = 'failed',
    price_sync_error = 'Restored promo assignment requires Stripe expiration-schedule synchronization.',
    updated_at = now()
FROM enrollment_price_adjustment replacement
WHERE subscription.id = replacement.billing_subscription_id
  AND replacement.preview_snapshot->>'source' = 'restore_failed_customer_billing_promo_765'
  AND replacement.kind = 'promo_code'
  AND replacement.status = 'active'
  AND subscription.stripe_subscription_id IS NOT NULL;
