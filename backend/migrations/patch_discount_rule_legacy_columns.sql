-- Backfill discount_rule / discount_rule_tier columns when tables exist from an older partial schema.
-- Lets add_discount_engine.sql index creation succeed on legacy databases.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'discount_rule'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE discount_rule
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS apply_to TEXT NOT NULL DEFAULT 'per_class',
    ADD COLUMN IF NOT EXISTS calc_base TEXT NOT NULL DEFAULT 'pre',
    ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS stackable BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS exclusivity_group TEXT,
    ADD COLUMN IF NOT EXISTS max_discount_cents INTEGER,
    ADD COLUMN IF NOT EXISTS scope_level TEXT NOT NULL DEFAULT 'global',
    ADD COLUMN IF NOT EXISTS scope_ref_id BIGINT,
    ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS max_redemptions INTEGER,
    ADD COLUMN IF NOT EXISTS redeemed_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'discount_rule_tier'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE discount_rule_tier
    ADD COLUMN IF NOT EXISTS amount_type TEXT NOT NULL DEFAULT 'percent',
    ADD COLUMN IF NOT EXISTS amount_value INTEGER NOT NULL DEFAULT 0;
END $$;
