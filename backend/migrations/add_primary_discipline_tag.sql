-- Primary sport for top-level programs (single discipline_tag FK).
-- Additional sport tags remain in program_discipline_tag.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'programs'
  ) THEN
    ALTER TABLE programs
      ADD COLUMN IF NOT EXISTS primary_discipline_tag_id BIGINT
      REFERENCES discipline_tag(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'program_categories'
  ) THEN
    ALTER TABLE program_categories
      ADD COLUMN IF NOT EXISTS primary_discipline_tag_id BIGINT
      REFERENCES discipline_tag(id) ON DELETE SET NULL;
  END IF;
END $$;
