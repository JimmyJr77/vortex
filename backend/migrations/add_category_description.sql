-- Add description column to program category table (supports legacy rename to programs).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'program_categories'
  ) THEN
    ALTER TABLE program_categories ADD COLUMN IF NOT EXISTS description TEXT;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'programs'
  ) THEN
    ALTER TABLE programs ADD COLUMN IF NOT EXISTS description TEXT;
  END IF;
END $$;
