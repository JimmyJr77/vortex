-- Discount and promo rules engine: cost cadence, sport defaults, discount rules,
-- tiers, redemption ledger, and layered caps. Estimate-only pricing (no charges).

-- 1. Cost cadence on classes (scheduling_form) and per-class discount cap.
ALTER TABLE scheduling_form
  ADD COLUMN IF NOT EXISTS cost_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS cost_unit TEXT,
  ADD COLUMN IF NOT EXISTS max_discount_redemptions INTEGER;

-- Seed cadence from the legacy monthly-per-slot field so nothing changes pre-migration.
UPDATE scheduling_form
SET cost_amount_cents = COALESCE(cost_amount_cents, slot_cost_monthly_cents),
    cost_unit = COALESCE(cost_unit, 'per_month')
WHERE cost_unit IS NULL;

-- 2. Cost cadence + discount caps on program-level defaults (table name varies).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'programs'
  ) THEN
    ALTER TABLE programs
      ADD COLUMN IF NOT EXISTS pricing_cost_amount_cents INTEGER,
      ADD COLUMN IF NOT EXISTS pricing_cost_unit TEXT,
      ADD COLUMN IF NOT EXISTS pricing_max_discount_redemptions INTEGER;
    UPDATE programs
    SET pricing_cost_amount_cents = COALESCE(pricing_cost_amount_cents, pricing_slot_cost_monthly_cents),
        pricing_cost_unit = COALESCE(pricing_cost_unit, 'per_month')
    WHERE pricing_cost_unit IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'program_categories'
  ) THEN
    ALTER TABLE program_categories
      ADD COLUMN IF NOT EXISTS pricing_cost_amount_cents INTEGER,
      ADD COLUMN IF NOT EXISTS pricing_cost_unit TEXT,
      ADD COLUMN IF NOT EXISTS pricing_max_discount_redemptions INTEGER;
    UPDATE program_categories
    SET pricing_cost_amount_cents = COALESCE(pricing_cost_amount_cents, pricing_slot_cost_monthly_cents),
        pricing_cost_unit = COALESCE(pricing_cost_unit, 'per_month')
    WHERE pricing_cost_unit IS NULL;
  END IF;
END $$;

-- 3. Primary-sport level defaults.
CREATE TABLE IF NOT EXISTS sport_pricing_default (
  discipline_tag_id          BIGINT PRIMARY KEY REFERENCES discipline_tag(id) ON DELETE CASCADE,
  cost_amount_cents          INTEGER NOT NULL DEFAULT 0,
  cost_unit                  TEXT NOT NULL DEFAULT 'per_month',
  free_slots_per_user        INTEGER NOT NULL DEFAULT 0,
  max_free_slots_total       INTEGER,
  max_discount_redemptions   INTEGER,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Facility-wide caps (single row per facility).
CREATE TABLE IF NOT EXISTS discount_global_settings (
  facility_id                    BIGINT PRIMARY KEY REFERENCES facility(id) ON DELETE CASCADE,
  max_free_units_total           INTEGER,
  max_discount_redemptions_total INTEGER,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Discount rules. scope_ref_id points at a sport/program/class/offering depending on scope_level.
CREATE TABLE IF NOT EXISTS discount_rule (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT REFERENCES facility(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  type                TEXT NOT NULL
                      CHECK (type IN ('promo_code','school','city','multi_class','multi_child','free_classes','spend_volume')),
  amount_type         TEXT NOT NULL DEFAULT 'percent'
                      CHECK (amount_type IN ('percent','fixed')),
  amount_value        INTEGER NOT NULL DEFAULT 0,
  apply_to            TEXT NOT NULL DEFAULT 'per_class'
                      CHECK (apply_to IN ('per_class','order_total')),
  calc_base           TEXT NOT NULL DEFAULT 'pre'
                      CHECK (calc_base IN ('pre','post')),
  priority            INTEGER NOT NULL DEFAULT 100,
  stackable           BOOLEAN NOT NULL DEFAULT TRUE,
  exclusivity_group   TEXT,
  max_discount_cents  INTEGER,
  scope_level         TEXT NOT NULL DEFAULT 'global'
                      CHECK (scope_level IN ('global','sport','program','class','offering')),
  scope_ref_id        BIGINT,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at           TIMESTAMPTZ,
  ends_at             TIMESTAMPTZ,
  max_redemptions     INTEGER,
  redeemed_count      INTEGER NOT NULL DEFAULT 0,
  config              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discount_rule_facility_active ON discount_rule(facility_id, active);
CREATE INDEX IF NOT EXISTS idx_discount_rule_type ON discount_rule(type);

-- 6. Tiers for multi_class / multi_child ("admin keeps adding").
CREATE TABLE IF NOT EXISTS discount_rule_tier (
  id            BIGSERIAL PRIMARY KEY,
  rule_id       BIGINT NOT NULL REFERENCES discount_rule(id) ON DELETE CASCADE,
  threshold     INTEGER NOT NULL,
  amount_type   TEXT NOT NULL DEFAULT 'percent' CHECK (amount_type IN ('percent','fixed')),
  amount_value  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (rule_id, threshold)
);
CREATE INDEX IF NOT EXISTS idx_discount_rule_tier_rule ON discount_rule_tier(rule_id);

-- 7. Redemption ledger - source of truth for caps spanning classes and programs.
CREATE TABLE IF NOT EXISTS discount_redemption (
  id            BIGSERIAL PRIMARY KEY,
  rule_id       BIGINT REFERENCES discount_rule(id) ON DELETE SET NULL,
  member_id     BIGINT REFERENCES member(id) ON DELETE SET NULL,
  signup_id     BIGINT REFERENCES scheduling_signup(id) ON DELETE CASCADE,
  program_id    BIGINT,
  form_id       BIGINT,
  kind          TEXT NOT NULL DEFAULT 'discount' CHECK (kind IN ('discount','free')),
  units         INTEGER NOT NULL DEFAULT 0,
  amount_cents  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discount_redemption_rule ON discount_redemption(rule_id);
CREATE INDEX IF NOT EXISTS idx_discount_redemption_member ON discount_redemption(member_id);
CREATE INDEX IF NOT EXISTS idx_discount_redemption_signup ON discount_redemption(signup_id);
CREATE INDEX IF NOT EXISTS idx_discount_redemption_kind ON discount_redemption(kind);

-- 8. Snapshot the computed pricing breakdown onto signups for audit + display.
ALTER TABLE scheduling_signup
  ADD COLUMN IF NOT EXISTS pricing_breakdown JSONB;

-- 9. Promo code uniqueness per facility (case-insensitive) for promo_code rules.
CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_rule_promo_code
  ON discount_rule (facility_id, LOWER(config->>'code'))
  WHERE type = 'promo_code' AND config->>'code' IS NOT NULL;
