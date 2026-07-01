-- Multi-class pass packages (program-level catalog) and member balance ledger.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'programs'
  ) THEN
    ALTER TABLE programs
      ADD COLUMN IF NOT EXISTS multi_class_pass_packages JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'program_categories'
  ) THEN
    ALTER TABLE program_categories
      ADD COLUMN IF NOT EXISTS multi_class_pass_packages JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS member_multi_class_pass (
  id                      BIGSERIAL PRIMARY KEY,
  member_id               BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  programs_id             BIGINT NOT NULL,
  package_id              TEXT NOT NULL,
  class_count_purchased   INTEGER NOT NULL CHECK (class_count_purchased > 0),
  classes_remaining       INTEGER NOT NULL CHECK (classes_remaining >= 0),
  price_cents             INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  package_label           TEXT,
  billing_charge_id       BIGINT REFERENCES billing_charge(id) ON DELETE SET NULL,
  purchased_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_multi_class_pass_member
  ON member_multi_class_pass(member_id);
CREATE INDEX IF NOT EXISTS idx_member_multi_class_pass_program
  ON member_multi_class_pass(programs_id);
CREATE INDEX IF NOT EXISTS idx_member_multi_class_pass_member_program
  ON member_multi_class_pass(member_id, programs_id)
  WHERE classes_remaining > 0;

CREATE TABLE IF NOT EXISTS multi_class_pass_redemption (
  id                BIGSERIAL PRIMARY KEY,
  member_pass_id    BIGINT NOT NULL REFERENCES member_multi_class_pass(id) ON DELETE CASCADE,
  signup_id         BIGINT REFERENCES scheduling_signup(id) ON DELETE SET NULL,
  member_id         BIGINT REFERENCES member(id) ON DELETE SET NULL,
  programs_id       BIGINT NOT NULL,
  classes_used      INTEGER NOT NULL DEFAULT 1 CHECK (classes_used > 0),
  classes_remaining_after INTEGER NOT NULL DEFAULT 0,
  context           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_multi_class_pass_redemption_pass
  ON multi_class_pass_redemption(member_pass_id);
CREATE INDEX IF NOT EXISTS idx_multi_class_pass_redemption_signup
  ON multi_class_pass_redemption(signup_id);
CREATE INDEX IF NOT EXISTS idx_multi_class_pass_redemption_member
  ON multi_class_pass_redemption(member_id);

ALTER TABLE scheduling_signup
  ADD COLUMN IF NOT EXISTS pricing_option_key TEXT;

-- Bundle ledger hardening (Billing Overhaul Phase 1; mirrored in 053 boot path).
ALTER TABLE member_multi_class_pass ADD COLUMN IF NOT EXISTS expires_at DATE;
ALTER TABLE member_multi_class_pass ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
DO $$
BEGIN
  ALTER TABLE member_multi_class_pass
    ADD CONSTRAINT member_multi_class_pass_status_check
    CHECK (status IN ('active', 'expired', 'refunded'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE multi_class_pass_redemption ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'use';
ALTER TABLE multi_class_pass_redemption ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE multi_class_pass_redemption ADD COLUMN IF NOT EXISTS credit_delta INTEGER;
DO $$
BEGIN
  ALTER TABLE multi_class_pass_redemption
    ADD CONSTRAINT multi_class_pass_redemption_entry_type_check
    CHECK (entry_type IN ('use', 'restore', 'expire', 'refund', 'adjust'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
UPDATE multi_class_pass_redemption SET credit_delta = -classes_used WHERE credit_delta IS NULL;
