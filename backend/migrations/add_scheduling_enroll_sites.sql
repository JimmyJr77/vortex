-- Per-site enroll page visibility for scheduling programs, forms, and categories.

ALTER TABLE scheduling_form
  ADD COLUMN IF NOT EXISTS enroll_sites TEXT[];

ALTER TABLE scheduling_category
  ADD COLUMN IF NOT EXISTS enroll_sites TEXT[];

DO $$
DECLARE
  programs_table TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'programs'
  ) THEN
    programs_table := 'programs';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'program_categories'
  ) THEN
    programs_table := 'program_categories';
  ELSE
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE %I ADD COLUMN IF NOT EXISTS scheduling_enroll_sites TEXT[]',
    programs_table
  );

  EXECUTE format(
    'UPDATE %I
     SET scheduling_enroll_sites = ARRAY[''athletics'', ''gymnastics'', ''basketball'']::text[]
     WHERE scheduling_active = TRUE
       AND (scheduling_enroll_sites IS NULL OR cardinality(scheduling_enroll_sites) = 0)',
    programs_table
  );
END $$;

UPDATE scheduling_form
SET enroll_sites = ARRAY['athletics', 'gymnastics', 'basketball']::text[]
WHERE is_active = TRUE
  AND (enroll_sites IS NULL OR cardinality(enroll_sites) = 0);

UPDATE scheduling_category
SET enroll_sites = ARRAY['athletics', 'gymnastics', 'basketball']::text[]
WHERE is_active = TRUE
  AND (enroll_sites IS NULL OR cardinality(enroll_sites) = 0);
