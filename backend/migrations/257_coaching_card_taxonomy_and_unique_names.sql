-- Complete Needs Engine taxonomy for the remaining published cards and make
-- contextual variants distinguishable in selectors and generated workouts.
-- Idempotent.

WITH assignments(slug, pattern_key) AS (
  VALUES
    ('bar-hang-squat-hold-hiit-fitness', 'hang'),
    ('bar-hang-squat-hold-hiit-fitness', 'squat'),
    ('box-breathing-hold-restore', 'brace'),
    ('burpee-target-hiit-fitness', 'locomote'),
    ('burpee-target-hiit-fitness', 'push'),
    ('cone-lateral-shuffle-hiit-fitness', 'locomote'),
    ('cone-shuttle-touch-hiit-fitness', 'locomote'),
    ('dead-hang-breathing-reset-restore', 'hang'),
    ('jump-rope-interval-hiit-fitness', 'jump'),
    ('jump-rope-interval-hiit-fitness', 'locomote'),
    ('med-ball-belly-breathing-restore', 'brace'),
    ('med-ball-carry-march-hiit-fitness', 'carry'),
    ('med-ball-carry-march-hiit-fitness', 'locomote'),
    ('med-ball-slam-reset-hiit-fitness', 'hinge'),
    ('med-ball-squat-press-hiit-fitness', 'squat'),
    ('med-ball-squat-press-hiit-fitness', 'push'),
    ('slow-cone-walk-reset-restore', 'locomote'),
    ('supine-hamstring-hold-restore', 'hinge'),
    ('wall-calf-hold-restore', 'brace')
)
INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'pattern', mp.id, 4
FROM assignments a
JOIN coaching.exercise e ON e.slug = a.slug
JOIN coaching.movement_pattern mp ON mp.key = a.pattern_key
WHERE NOT EXISTS (
  SELECT 1 FROM coaching.exercise_tag existing
  WHERE existing.exercise_id = e.id
    AND existing.facet_type = 'pattern'
    AND existing.facet_id = mp.id
);

WITH assignments(slug, body_region_key) AS (
  VALUES
    ('bar-hang-squat-hold-hiit-fitness', 'full_body'),
    ('bar-hang-squat-hold-hiit-fitness', 'shoulder'),
    ('bar-hang-squat-hold-hiit-fitness', 'hip'),
    ('box-breathing-hold-restore', 'core'),
    ('burpee-target-hiit-fitness', 'full_body'),
    ('cone-lateral-shuffle-hiit-fitness', 'hip'),
    ('cone-lateral-shuffle-hiit-fitness', 'knee'),
    ('cone-shuttle-touch-hiit-fitness', 'full_body'),
    ('dead-hang-breathing-reset-restore', 'shoulder'),
    ('dead-hang-breathing-reset-restore', 'spine'),
    ('goblet-squat-tempo-d6', 'hip'),
    ('goblet-squat-tempo-d6', 'knee'),
    ('goblet-squat-tempo-d6', 'core'),
    ('heavy-med-ball-chest-pass-d7', 'shoulder'),
    ('heavy-med-ball-chest-pass-d7', 'core'),
    ('jump-rope-interval-hiit-fitness', 'ankle'),
    ('jump-rope-interval-hiit-fitness', 'knee'),
    ('kettlebell-deadlift-heavy-d7', 'hip'),
    ('kettlebell-deadlift-heavy-d7', 'spine'),
    ('med-ball-belly-breathing-restore', 'core'),
    ('med-ball-carry-march-hiit-fitness', 'full_body'),
    ('med-ball-slam-reset-hiit-fitness', 'full_body'),
    ('med-ball-squat-press-hiit-fitness', 'full_body'),
    ('reactive-broad-jump-d7', 'hip'),
    ('reactive-broad-jump-d7', 'knee'),
    ('reactive-broad-jump-d7', 'ankle'),
    ('slow-cone-walk-reset-restore', 'full_body'),
    ('supine-hamstring-hold-restore', 'hip'),
    ('supine-hamstring-hold-restore', 'knee'),
    ('triple-broad-jump-d7', 'hip'),
    ('triple-broad-jump-d7', 'knee'),
    ('triple-broad-jump-d7', 'ankle'),
    ('wall-calf-hold-restore', 'ankle')
)
INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'body_region', br.id, 4
FROM assignments a
JOIN coaching.exercise e ON e.slug = a.slug
JOIN coaching.body_region br ON br.key = a.body_region_key
WHERE NOT EXISTS (
  SELECT 1 FROM coaching.exercise_tag existing
  WHERE existing.exercise_id = e.id
    AND existing.facet_type = 'body_region'
    AND existing.facet_id = br.id
);

UPDATE coaching.exercise
SET name = name || ' — Distance Jump',
    updated_at = now()
WHERE slug LIKE 'distance-jump-%'
  AND name NOT LIKE '% — Distance Jump';

UPDATE coaching.exercise
SET name = name || ' — Kicking',
    updated_at = now()
WHERE slug LIKE '%-kicking'
  AND name NOT LIKE '% — Kicking';

UPDATE coaching.exercise
SET name = name || ' — Throwing',
    updated_at = now()
WHERE slug LIKE 'throwing-athlete-%'
  AND name NOT LIKE '% — Throwing';

UPDATE coaching.exercise
SET name = name || ' — Alternate',
    updated_at = now()
WHERE slug LIKE '%-alt'
  AND name NOT LIKE '% — Alternate';

UPDATE coaching.exercise
SET name = name || ' — Balance',
    updated_at = now()
WHERE slug = 'balance-lateral-bound-to-stick'
  AND name NOT LIKE '% — Balance';

UPDATE coaching.exercise
SET name = name || ' — Strength',
    updated_at = now()
WHERE slug = 'heavy-sled-push-strength'
  AND name NOT LIKE '% — Strength';

UPDATE coaching.exercise
SET name = name || ' — Mobility',
    updated_at = now()
WHERE slug IN ('90-90-breathing-with-reach', '90-90-hip-switch', 'squat-to-stand-mobility-reach')
  AND name NOT LIKE '% — Mobility';

UPDATE coaching.exercise
SET name = name || ' — Reaction',
    updated_at = now()
WHERE slug = 'three-sixty-awareness-catch-with-safe-twist'
  AND name NOT LIKE '% — Reaction';
