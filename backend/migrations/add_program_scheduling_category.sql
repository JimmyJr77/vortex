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

-- Backfill the easy case: a class whose scheduling form is linked to
-- exactly ONE distinct named category gets that category set now.
-- Forms with multiple categories (legacy "merged" rows) are left for
-- the reconcile/split engine. Forms with zero named categories stay
-- NULL ("No Category").
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
