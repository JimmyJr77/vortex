-- Follow-up for databases that applied the first released 802 migration
-- before retired compatibility fields were made optional. Canonical writes no
-- longer populate these fields, so retaining NOT NULL would force them to
-- invent obsolete values. The columns and their historical contents remain.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'member' AND column_name = 'status'
  ) THEN
    ALTER TABLE member ALTER COLUMN status DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'member' AND column_name = 'parent_guardian_ids'
  ) THEN
    ALTER TABLE member ALTER COLUMN parent_guardian_ids DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'member' AND column_name = 'has_completed_waivers'
  ) THEN
    ALTER TABLE member ALTER COLUMN has_completed_waivers DROP NOT NULL;
  END IF;
END $$;
