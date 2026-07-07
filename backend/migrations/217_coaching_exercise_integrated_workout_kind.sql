-- Reclassify integrated workout drills (skill + locomotor/lunge/stick) as exercises.
-- See docs/EXERCISE_DIFFICULTY_METHODOLOGY.md §2.

-- skipping-rhythm-drill
UPDATE coaching.exercise SET programming_kind = 'exercise', updated_at = now() WHERE slug = 'skipping-rhythm-drill';
INSERT INTO coaching.exercise_difficulty_profile (
  exercise_id, technical, load, overall,
  recommended_age_min, recommended_age_max, attention_demand, notes, source, updated_at
)
SELECT e.id, 4, 1, 4,
  7, NULL, 'low', 'Workout exercise — load 1/10, technical 4/10', 'reviewed', now()
FROM coaching.exercise e
WHERE e.slug = 'skipping-rhythm-drill'
ON CONFLICT (exercise_id) DO UPDATE SET
  technical = EXCLUDED.technical,
  load = EXCLUDED.load,
  overall = EXCLUDED.overall,
  recommended_age_min = EXCLUDED.recommended_age_min,
  recommended_age_max = EXCLUDED.recommended_age_max,
  attention_demand = EXCLUDED.attention_demand,
  notes = EXCLUDED.notes,
  source = EXCLUDED.source,
  updated_at = now();

-- cartwheel-finish-lunge
UPDATE coaching.exercise SET programming_kind = 'exercise', updated_at = now() WHERE slug = 'cartwheel-finish-lunge';
INSERT INTO coaching.exercise_difficulty_profile (
  exercise_id, technical, load, overall,
  recommended_age_min, recommended_age_max, attention_demand, notes, source, updated_at
)
SELECT e.id, 4, 2, 4,
  7, NULL, 'low', 'Workout exercise — load 2/10, technical 4/10', 'reviewed', now()
FROM coaching.exercise e
WHERE e.slug = 'cartwheel-finish-lunge'
ON CONFLICT (exercise_id) DO UPDATE SET
  technical = EXCLUDED.technical,
  load = EXCLUDED.load,
  overall = EXCLUDED.overall,
  recommended_age_min = EXCLUDED.recommended_age_min,
  recommended_age_max = EXCLUDED.recommended_age_max,
  attention_demand = EXCLUDED.attention_demand,
  notes = EXCLUDED.notes,
  source = EXCLUDED.source,
  updated_at = now();

-- round-off-rebound-snap-down-to-stick
UPDATE coaching.exercise SET programming_kind = 'exercise', updated_at = now() WHERE slug = 'round-off-rebound-snap-down-to-stick';
INSERT INTO coaching.exercise_difficulty_profile (
  exercise_id, technical, load, overall,
  recommended_age_min, recommended_age_max, attention_demand, notes, source, updated_at
)
SELECT e.id, 5, 1, 5,
  9, NULL, 'moderate', 'Workout exercise — load 1/10, technical 5/10', 'reviewed', now()
FROM coaching.exercise e
WHERE e.slug = 'round-off-rebound-snap-down-to-stick'
ON CONFLICT (exercise_id) DO UPDATE SET
  technical = EXCLUDED.technical,
  load = EXCLUDED.load,
  overall = EXCLUDED.overall,
  recommended_age_min = EXCLUDED.recommended_age_min,
  recommended_age_max = EXCLUDED.recommended_age_max,
  attention_demand = EXCLUDED.attention_demand,
  notes = EXCLUDED.notes,
  source = EXCLUDED.source,
  updated_at = now();
