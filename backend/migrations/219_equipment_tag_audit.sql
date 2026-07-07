-- Backfill equipment tags for common bar/box families where exercises lack equipment tags.
-- Idempotent: skips exercises that already have any equipment tag.

INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'equipment', eq.id, 3
FROM coaching.exercise e
JOIN coaching.equipment eq ON eq.key = 'pull_up_bar'
WHERE (
  e.slug ILIKE '%hang%'
  OR e.slug ILIKE '%pull-up%'
  OR e.slug ILIKE '%pull_up%'
  OR e.slug ILIKE '%chin-up%'
  OR e.name ILIKE '%hang%'
  OR e.name ILIKE '%pull-up%'
)
AND NOT EXISTS (
  SELECT 1 FROM coaching.exercise_tag t
  WHERE t.exercise_id = e.id AND t.facet_type = 'equipment'
)
ON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;

INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'equipment', eq.id, 3
FROM coaching.exercise e
JOIN coaching.equipment eq ON eq.key = 'box'
WHERE (
  e.slug ILIKE '%box%'
  OR e.slug ILIKE '%drop-landing%'
  OR e.slug ILIKE '%drop_landing%'
  OR e.slug ILIKE '%step-up%'
  OR e.slug ILIKE '%step_up%'
  OR e.name ILIKE '%box%'
  OR e.name ILIKE '%drop landing%'
)
AND NOT EXISTS (
  SELECT 1 FROM coaching.exercise_tag t
  WHERE t.exercise_id = e.id AND t.facet_type = 'equipment'
)
ON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;

INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'equipment', eq.id, 3
FROM coaching.exercise e
JOIN coaching.equipment eq ON eq.key = 'barbell'
WHERE (
  e.slug ILIKE '%barbell%'
  OR e.slug ILIKE '%squat%'
  OR e.slug ILIKE '%deadlift%'
  OR e.slug ILIKE '%bench-press%'
  OR e.name ILIKE '%barbell%'
)
AND NOT EXISTS (
  SELECT 1 FROM coaching.exercise_tag t
  WHERE t.exercise_id = e.id AND t.facet_type = 'equipment'
)
ON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;
