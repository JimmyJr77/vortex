-- Annual membership renewal price instructions are athlete-specific. They are
-- intentionally separate from the household ledger and annual-fee charge so
-- changing a future renewal never rewrites posted financial history.
CREATE TABLE IF NOT EXISTS annual_membership_renewal_pricing (
  id BIGSERIAL PRIMARY KEY,
  family_billing_account_id BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  additional_fee_id BIGINT NOT NULL REFERENCES additional_fee(id) ON DELETE RESTRICT,
  pricing_kind TEXT NOT NULL CHECK (pricing_kind IN ('manual_final_price', 'promo_code')),
  final_amount_cents INTEGER NOT NULL CHECK (final_amount_cents >= 0),
  promo_code TEXT,
  discount_rule_id BIGINT REFERENCES discount_rule(id) ON DELETE SET NULL,
  discount_rule_snapshot JSONB,
  reason TEXT NOT NULL,
  stripe_subscription_id TEXT,
  stripe_subscription_item_id TEXT,
  stripe_price_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'sync_failed', 'not_required')),
  sync_error TEXT,
  created_by_user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_annual_membership_renewal_pricing_member_fee
  ON annual_membership_renewal_pricing (family_billing_account_id, member_id, additional_fee_id);
