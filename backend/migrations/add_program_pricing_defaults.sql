-- Program-level default pricing + per-form override flag for class inheritance.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'programs'
  ) THEN
    ALTER TABLE programs
      ADD COLUMN IF NOT EXISTS pricing_max_slots_per_user INTEGER,
      ADD COLUMN IF NOT EXISTS pricing_slot_cost_monthly_cents INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pricing_free_slots_per_user INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pricing_max_free_slots_total INTEGER;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'program_categories'
  ) THEN
    ALTER TABLE program_categories
      ADD COLUMN IF NOT EXISTS pricing_max_slots_per_user INTEGER,
      ADD COLUMN IF NOT EXISTS pricing_slot_cost_monthly_cents INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pricing_free_slots_per_user INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pricing_max_free_slots_total INTEGER;
  END IF;
END $$;

ALTER TABLE scheduling_form
  ADD COLUMN IF NOT EXISTS pricing_overrides_program BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_free_slots_total INTEGER;

-- Preserve existing per-form billing: treat all current forms as custom overrides.
UPDATE scheduling_form
SET pricing_overrides_program = TRUE
WHERE pricing_overrides_program = FALSE;
