-- Beginner explosiveness capacity coverage: capacity phase profiles, tenet tags, youth difficulty tuning.
-- IDEMPOTENT. Supports Needs Engine "explosiveness + capacity + beginner 8-14" prescription gaps.

-- Capacity secondary profiles for output-primary explosiveness exercises
INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, 5, 'secondary', v.order_slot, pos.order_index,
  FALSE, 3, 2, v.technical_complexity, v.impact_level, 'moderate'
FROM coaching.exercise e
JOIN coaching.session_phase sp ON sp.key = 'capacity'
JOIN (VALUES
  ('med-ball-chest-pass', 'horizontal_push_strength', 3, 1),
  ('med-ball-scoop-toss', 'squat_strength', 3, 2),
  ('squat-jump', 'squat_strength', 3, 2),
  ('standing-broad-jump', 'loaded_drive_strength', 3, 2),
  ('lateral-bound', 'frontal_plane_strength', 3, 2),
  ('step-up', 'step_up_strength', 2, 1)
) AS v(slug, order_slot, technical_complexity, impact_level) ON e.slug = v.slug
JOIN coaching.phase_order_slot pos ON pos.key = v.order_slot AND pos.phase_id = sp.id
ON CONFLICT (exercise_id, phase_id) DO UPDATE SET
  fit_weight = GREATEST(coaching.exercise_phase_profile.fit_weight, EXCLUDED.fit_weight),
  role = CASE
    WHEN coaching.exercise_phase_profile.role = 'primary' THEN coaching.exercise_phase_profile.role
    ELSE EXCLUDED.role
  END,
  order_slot = COALESCE(coaching.exercise_phase_profile.order_slot, EXCLUDED.order_slot),
  order_index = COALESCE(coaching.exercise_phase_profile.order_index, EXCLUDED.order_index),
  technical_complexity = LEAST(coaching.exercise_phase_profile.technical_complexity, EXCLUDED.technical_complexity);

-- Explosiveness tenet tags (weight 5) for capacity cluster
INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'tenet', t.id, 5
FROM coaching.exercise e
JOIN coaching.tenet t ON t.key = 'explosiveness'
WHERE e.slug IN (
  'med-ball-chest-pass', 'med-ball-scoop-toss', 'squat-jump', 'standing-broad-jump',
  'lateral-bound', 'goblet-squat', 'kettlebell-deadlift-trap-bar-deadlift', 'step-up'
)
ON CONFLICT (exercise_id, facet_type, facet_id) DO UPDATE SET weight = GREATEST(coaching.exercise_tag.weight, EXCLUDED.weight);

-- Equipment tags aligned with common avoid lists (trap_bar distinct from bar)
INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'equipment', eq.id, 3
FROM coaching.exercise e
JOIN coaching.equipment eq ON eq.key = v.equip_key
JOIN (VALUES
  ('med-ball-chest-pass', 'medicine_ball'),
  ('med-ball-scoop-toss', 'medicine_ball'),
  ('goblet-squat', 'kettlebell'),
  ('kettlebell-deadlift-trap-bar-deadlift', 'kettlebell'),
  ('kettlebell-deadlift-trap-bar-deadlift', 'trap_bar'),
  ('step-up', 'box')
) AS v(slug, equip_key) ON e.slug = v.slug
ON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;

-- Youth beginner difficulty tuning (D3–6 band for ages 8–14)
INSERT INTO coaching.exercise_difficulty_profile (
  exercise_id, technical, load, overall,
  recommended_age_min, recommended_age_max, attention_demand, notes, source, updated_at
)
SELECT e.id, v.technical, v.load, v.overall,
  8, 14, v.attention, v.notes, 'beginner_explosiveness_capacity', now()
FROM coaching.exercise e
JOIN (VALUES
  ('med-ball-chest-pass', 3, 3, 4, 'moderate', 'Youth explosiveness capacity — light med-ball, crisp intent'),
  ('med-ball-scoop-toss', 3, 3, 4, 'moderate', 'Youth explosiveness capacity — scoop toss with full reset'),
  ('goblet-squat', 3, 4, 4, 'moderate', 'Youth capacity strength supporting explosiveness'),
  ('kettlebell-deadlift-trap-bar-deadlift', 3, 4, 5, 'moderate', 'Youth hinge capacity — trap bar or KB, not barbell')
) AS v(slug, technical, load, overall, attention, notes) ON e.slug = v.slug
ON CONFLICT (exercise_id) DO UPDATE SET
  technical = LEAST(coaching.exercise_difficulty_profile.technical, EXCLUDED.technical),
  load = LEAST(coaching.exercise_difficulty_profile.load, EXCLUDED.load),
  overall = LEAST(coaching.exercise_difficulty_profile.overall, EXCLUDED.overall),
  recommended_age_min = COALESCE(coaching.exercise_difficulty_profile.recommended_age_min, EXCLUDED.recommended_age_min),
  recommended_age_max = COALESCE(EXCLUDED.recommended_age_max, coaching.exercise_difficulty_profile.recommended_age_max),
  attention_demand = EXCLUDED.attention_demand,
  notes = EXCLUDED.notes,
  source = EXCLUDED.source,
  updated_at = now();

-- Skill level for youth-friendly capacity picks
UPDATE coaching.exercise SET skill_level = 'BEGINNER', updated_at = now()
WHERE slug IN ('med-ball-chest-pass', 'med-ball-scoop-toss', 'lateral-bound', 'step-up', 'goblet-squat')
  AND (skill_level IS NULL OR skill_level IN ('INTERMEDIATE', 'ADVANCED'));
