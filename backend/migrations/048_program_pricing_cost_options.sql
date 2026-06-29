-- Program-level pricing option catalog (checkbox + amount pairs stored as JSON).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'programs'
  ) THEN
    ALTER TABLE programs
      ADD COLUMN IF NOT EXISTS pricing_cost_options JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'program_categories'
  ) THEN
    ALTER TABLE program_categories
      ADD COLUMN IF NOT EXISTS pricing_cost_options JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;
