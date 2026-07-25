-- Short labels for calendar chips (e.g. "T&T" for "Tramp and Tumble").
-- Backfill existing rows with the full display name.

DO $$
BEGIN
  IF to_regclass('public.programs') IS NOT NULL THEN
    ALTER TABLE programs ADD COLUMN IF NOT EXISTS abridged_name TEXT;
    UPDATE programs SET abridged_name = display_name WHERE abridged_name IS NULL;
  END IF;
  IF to_regclass('public.program_categories') IS NOT NULL THEN
    ALTER TABLE program_categories ADD COLUMN IF NOT EXISTS abridged_name TEXT;
    UPDATE program_categories SET abridged_name = display_name WHERE abridged_name IS NULL;
  END IF;
END $$;

ALTER TABLE program ADD COLUMN IF NOT EXISTS abridged_name TEXT;
UPDATE program SET abridged_name = display_name WHERE abridged_name IS NULL;
