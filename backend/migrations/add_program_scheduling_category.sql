-- ============================================================
-- Migration: explicit class -> scheduling category mapping
-- Each `program` row (a class) maps to at most ONE scheduling
-- category. This column is the stable "coding system" that lets
-- the system differentiate classes with the same display name but
-- different categories, and keeps the Classes <-> Scheduling sync
-- idempotent.
-- ============================================================

ALTER TABLE program
  ADD COLUMN IF NOT EXISTS scheduling_category_id BIGINT
  REFERENCES scheduling_category(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_program_scheduling_category
  ON program(scheduling_category_id);

-- Backfill only when optional scheduling association tables exist (fresh DBs skip).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'scheduling_form_category'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'scheduling_offering'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'scheduling_slot_group'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'scheduling_form' AND column_name = 'deleted_at'
    ) THEN
      WITH form_cats AS (
        SELECT
          sf.program_id,
          COUNT(DISTINCT assoc.category_id) AS cnt,
          MIN(assoc.category_id) AS only_cat
        FROM scheduling_form sf
        JOIN (
          SELECT form_id, category_id FROM scheduling_form_category
          UNION
          SELECT form_id, category_id FROM scheduling_offering WHERE category_id IS NOT NULL
          UNION
          SELECT form_id, category_id FROM scheduling_slot_group WHERE category_id IS NOT NULL
          UNION
          SELECT form_id, category_id FROM scheduling_time_slot WHERE category_id IS NOT NULL
        ) assoc ON assoc.form_id = sf.id
        WHERE sf.deleted_at IS NULL AND sf.program_id IS NOT NULL
        GROUP BY sf.program_id
      )
      UPDATE program p
      SET scheduling_category_id = fc.only_cat
      FROM form_cats fc
      WHERE fc.program_id = p.id
        AND fc.cnt = 1
        AND p.scheduling_category_id IS NULL;
    END IF;
  END IF;
END $$;
