-- Unify top-level program_categories → programs; link class/events to scheduling forms.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'program_categories'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'programs'
  ) THEN
    ALTER TABLE program_categories RENAME TO programs;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'program' AND column_name = 'category_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'program' AND column_name = 'programs_id'
  ) THEN
    ALTER TABLE program RENAME COLUMN category_id TO programs_id;
  END IF;
END $$;

ALTER TABLE scheduling_form
  ADD COLUMN IF NOT EXISTS programs_id BIGINT,
  ADD COLUMN IF NOT EXISTS program_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scheduling_form_programs_id_fkey'
  ) THEN
    ALTER TABLE scheduling_form
      ADD CONSTRAINT scheduling_form_programs_id_fkey
      FOREIGN KEY (programs_id) REFERENCES programs(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scheduling_form_program_id_fkey'
  ) THEN
    ALTER TABLE scheduling_form
      ADD CONSTRAINT scheduling_form_program_id_fkey
      FOREIGN KEY (program_id) REFERENCES program(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduling_form_program_id
  ON scheduling_form(program_id) WHERE program_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduling_form_programs_id
  ON scheduling_form(programs_id);

-- Backfill scheduling forms for existing class/event rows
INSERT INTO scheduling_form (title, description, is_active, programs_id, program_id)
SELECT
  p.display_name,
  p.description,
  COALESCE(p.is_active, TRUE),
  p.programs_id,
  p.id
FROM program p
WHERE NOT EXISTS (
  SELECT 1 FROM scheduling_form sf WHERE sf.program_id = p.id
);

UPDATE scheduling_form sf
SET programs_id = p.programs_id
FROM program p
WHERE sf.program_id = p.id AND sf.programs_id IS NULL;
