-- ============================================================
-- Migration: explicit "No Category" for all class rows
-- Every program (class) row gets a concrete scheduling_category_id
-- instead of NULL. NULL on program.scheduling_category_id should
-- never appear after this migration.
-- ============================================================

INSERT INTO scheduling_category (form_id, name, sort_order, is_active)
SELECT NULL, 'No Category', -1, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM scheduling_category
  WHERE form_id IS NULL AND name = 'No Category'
);

UPDATE program p
SET scheduling_category_id = nc.id
FROM (
  SELECT id FROM scheduling_category
  WHERE form_id IS NULL AND name = 'No Category'
  ORDER BY sort_order, id
  LIMIT 1
) nc
WHERE p.scheduling_category_id IS NULL;
