-- Global scheduling categories shared across forms

ALTER TABLE scheduling_category ALTER COLUMN form_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS scheduling_form_category (
  form_id     BIGINT NOT NULL REFERENCES scheduling_form(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES scheduling_category(id) ON DELETE CASCADE,
  PRIMARY KEY (form_id, category_id)
);

-- Backfill form–category links from legacy per-form categories
INSERT INTO scheduling_form_category (form_id, category_id)
SELECT form_id, id
FROM scheduling_category
WHERE form_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Also link categories that already have slots on a form
INSERT INTO scheduling_form_category (form_id, category_id)
SELECT DISTINCT form_id, category_id
FROM scheduling_time_slot
WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;
