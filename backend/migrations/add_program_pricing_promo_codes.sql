-- Promo codes allowed per program (classes inherit unless overridden later).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'programs'
  ) THEN
    ALTER TABLE programs
      ADD COLUMN IF NOT EXISTS pricing_promo_codes JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'program_categories'
  ) THEN
    ALTER TABLE program_categories
      ADD COLUMN IF NOT EXISTS pricing_promo_codes JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;
