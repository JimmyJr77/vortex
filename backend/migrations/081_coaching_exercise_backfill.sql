-- Backfill seed exercises (019) with phase profiles, dosage, safety, regimen, and education why stubs.
-- IDEMPOTENT.

-- Default dosage profiles from exercise defaults
INSERT INTO coaching.exercise_dosage_profile (
  exercise_id, profile_name, is_default, volume_unit,
  default_sets, default_reps, default_work_seconds, default_rest_seconds,
  est_seconds_per_set, session_volume_min, session_volume_max, weekly_volume_max
)
SELECT
  e.id, 'Default', TRUE, 'reps',
  e.default_sets, e.default_reps, e.default_work_seconds, e.default_rest_seconds,
  e.est_seconds_per_set,
  COALESCE(e.default_sets, 3) * COALESCE(e.default_reps, 1),
  COALESCE(e.default_sets, 3) * COALESCE(e.default_reps, 1) * 3,
  COALESCE(e.default_sets, 3) * COALESCE(e.default_reps, 1) * 9
FROM coaching.exercise e
WHERE NOT EXISTS (
  SELECT 1 FROM coaching.exercise_dosage_profile d WHERE d.exercise_id = e.id AND d.profile_name = 'Default'
);

-- Default safety + regimen for all exercises
INSERT INTO coaching.exercise_safety_profile (exercise_id, risk_level, impact_level, requires_coach_supervision)
SELECT e.id, 2, 1, 'recommended'
FROM coaching.exercise e
WHERE NOT EXISTS (SELECT 1 FROM coaching.exercise_safety_profile s WHERE s.exercise_id = e.id);

INSERT INTO coaching.exercise_regimen_rule (exercise_id, can_be_daily, weekly_max_frequency, minimum_hours_between_hard_exposures)
SELECT e.id, FALSE, 3, 24
FROM coaching.exercise e
WHERE NOT EXISTS (SELECT 1 FROM coaching.exercise_regimen_rule r WHERE r.exercise_id = e.id);

-- Phase profiles from intent tags + methodology heuristics
INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, freshness_required,
  fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT DISTINCT ON (e.id, sp.id)
  e.id,
  sp.id,
  CASE
    WHEN sp.key = 'output' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t
      JOIN coaching.methodology m ON m.id = t.facet_id AND t.facet_type = 'methodology'
      WHERE t.exercise_id = e.id AND m.key IN ('plyometrics', 'neural')
    ) THEN 5
    WHEN sp.key = 'sustained_capacity' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t
      JOIN coaching.methodology m ON m.id = t.facet_id AND t.facet_type = 'methodology'
      WHERE t.exercise_id = e.id AND m.key = 'hiit'
    ) THEN 5
    WHEN sp.key = 'capacity' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t
      JOIN coaching.exercise_intent i ON i.id = t.facet_id AND t.facet_type = 'intent'
      WHERE t.exercise_id = e.id AND i.key = 'main'
    ) THEN 4
    WHEN sp.key = 'movement_intelligence' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t
      JOIN coaching.exercise_intent i ON i.id = t.facet_id AND t.facet_type = 'intent'
      WHERE t.exercise_id = e.id AND i.key = 'skill'
    ) THEN 5
    WHEN sp.key = 'prepare_and_access' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t
      JOIN coaching.exercise_intent i ON i.id = t.facet_id AND t.facet_type = 'intent'
      WHERE t.exercise_id = e.id AND i.key IN ('warmup', 'activation')
    ) THEN 4
    WHEN sp.key = 'resilience' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t
      JOIN coaching.methodology m ON m.id = t.facet_id AND t.facet_type = 'methodology'
      WHERE t.exercise_id = e.id AND m.key IN ('isometrics', 'eccentric_negative', 'core_body_control', 'balance_stability')
    ) THEN 4
    WHEN sp.key = 'restore' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t
      JOIN coaching.exercise_intent i ON i.id = t.facet_id AND t.facet_type = 'intent'
      WHERE t.exercise_id = e.id AND i.key = 'cooldown'
    ) THEN 4
    ELSE 2
  END AS fit_weight,
  CASE
    WHEN sp.key = 'output' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t JOIN coaching.methodology m ON m.id = t.facet_id AND t.facet_type = 'methodology'
      WHERE t.exercise_id = e.id AND m.key = 'plyometrics'
    ) THEN 'primary'
    WHEN sp.key = 'sustained_capacity' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t JOIN coaching.methodology m ON m.id = t.facet_id AND t.facet_type = 'methodology'
      WHERE t.exercise_id = e.id AND m.key = 'hiit'
    ) THEN 'primary'
    WHEN sp.key = 'movement_intelligence' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t JOIN coaching.exercise_intent i ON i.id = t.facet_id AND t.facet_type = 'intent'
      WHERE t.exercise_id = e.id AND i.key = 'skill'
    ) THEN 'primary'
    WHEN sp.key = 'capacity' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t JOIN coaching.exercise_intent i ON i.id = t.facet_id AND t.facet_type = 'intent'
      WHERE t.exercise_id = e.id AND i.key = 'main'
    ) THEN 'primary'
    WHEN sp.key = 'prepare_and_access' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t JOIN coaching.exercise_intent i ON i.id = t.facet_id AND t.facet_type = 'intent'
      WHERE t.exercise_id = e.id AND i.key = 'warmup'
    ) THEN 'primary'
    WHEN sp.key = 'resilience' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t JOIN coaching.exercise_intent i ON i.id = t.facet_id AND t.facet_type = 'intent'
      WHERE t.exercise_id = e.id AND i.key = 'accessory'
    ) THEN 'secondary'
    ELSE 'conditional'
  END AS role,
  CASE
    WHEN sp.key = 'output' AND e.slug = 'box-jump' THEN 'main_plyometric'
    WHEN sp.key = 'output' AND e.slug IN ('10-yard-sprint', 'lateral-bound', 'depth-jump') THEN 'speed_acceleration'
    WHEN sp.key = 'movement_intelligence' AND e.slug IN ('cartwheel', 'round-off', 'handstand-hold', 'hollow-body-hold') THEN 'tumbling'
    WHEN sp.key = 'capacity' AND e.slug IN ('back-squat', 'pull-up', 'kettlebell-swing') THEN 'primary_strength'
    WHEN sp.key = 'prepare_and_access' AND e.slug = 'worlds-greatest-stretch' THEN 'mobility_access'
    WHEN sp.key = 'resilience' AND e.slug IN ('plank-hold', 'dead-bug', 'nordic-hamstring-curl') THEN 'core_body_control'
    ELSE NULL
  END AS order_slot,
  sp.freshness_required,
  CASE WHEN sp.key IN ('output', 'movement_intelligence') THEN 4 ELSE 3 END,
  CASE WHEN sp.key = 'sustained_capacity' THEN 4 WHEN sp.key = 'output' THEN 3 ELSE 2 END,
  CASE WHEN e.slug IN ('cartwheel', 'round-off', 'lache-swing', 'depth-jump') THEN 4 ELSE 2 END,
  CASE WHEN e.slug IN ('box-jump', 'depth-jump', 'lateral-bound', 'precision-jump') THEN 4 ELSE 1 END,
  CASE WHEN sp.key = 'output' THEN 'high' WHEN sp.key = 'capacity' THEN 'high' ELSE 'moderate' END
FROM coaching.exercise e
CROSS JOIN coaching.session_phase sp
WHERE e.archived = FALSE
  AND (
    (sp.key = 'output' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t
      JOIN coaching.methodology m ON m.id = t.facet_id AND t.facet_type = 'methodology'
      WHERE t.exercise_id = e.id AND m.key IN ('plyometrics', 'neural')
    ))
    OR (sp.key = 'capacity' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t
      JOIN coaching.exercise_intent i ON i.id = t.facet_id AND t.facet_type = 'intent'
      WHERE t.exercise_id = e.id AND i.key IN ('main', 'accessory')
    ))
    OR (sp.key = 'movement_intelligence' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t
      JOIN coaching.exercise_intent i ON i.id = t.facet_id AND t.facet_type = 'intent'
      WHERE t.exercise_id = e.id AND i.key = 'skill'
    ))
    OR (sp.key = 'prepare_and_access' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t
      JOIN coaching.exercise_intent i ON i.id = t.facet_id AND t.facet_type = 'intent'
      WHERE t.exercise_id = e.id AND i.key IN ('warmup', 'activation')
    ))
    OR (sp.key = 'resilience' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t
      JOIN coaching.methodology m ON m.id = t.facet_id AND t.facet_type = 'methodology'
      WHERE t.exercise_id = e.id AND m.key IN ('isometrics', 'eccentric_negative', 'core_body_control', 'balance_stability')
    ))
    OR (sp.key = 'sustained_capacity' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t
      JOIN coaching.exercise_intent i ON i.id = t.facet_id AND t.facet_type = 'intent'
      WHERE t.exercise_id = e.id AND i.key = 'conditioning'
    ))
    OR (sp.key = 'restore' AND EXISTS (
      SELECT 1 FROM coaching.exercise_tag t
      JOIN coaching.methodology m ON m.id = t.facet_id AND t.facet_type = 'methodology'
      WHERE t.exercise_id = e.id AND m.key = 'mobility_flexibility'
    ))
  )
ON CONFLICT (exercise_id, phase_id) DO NOTHING;

-- Box Jump reference education + programming logic
UPDATE coaching.exercise SET
  card_summary = 'Explosive bilateral jump emphasizing takeoff intent and controlled landing.',
  coach_language = 'Use as an Output phase plyometric when the athlete is fresh.',
  athlete_language = 'Jump high, land quietly, reset every rep.',
  programming_logic = '{
    "training_effect": "Elastic lower-body power and landing control.",
    "best_used_for": ["Output phase", "Power-focused day"],
    "avoid_when": ["After HIIT", "After heavy eccentric lower-body work", "When landing mechanics are poor"],
    "recommended_preceded_by": ["landing_prep", "elastic_prep"],
    "recommended_followed_by": ["primary_strength", "agility_deceleration"]
  }'::jsonb,
  scalable_variables = ARRAY['sets', 'reps', 'rest_seconds', 'height', 'complexity']
WHERE slug = 'box-jump';

INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary,
  what_it_is, why_it_matters, why_it_goes_here, fatigue_logic,
  programming_guidance, common_misuse, scaling_guidance
)
SELECT
  'exercise', e.slug, e.id, e.name,
  COALESCE(e.card_summary, e.description),
  COALESCE(e.description, e.name),
  'Develops tagged tenets and physiological qualities for athletic development.',
  CASE e.slug
    WHEN 'box-jump' THEN 'Belongs in Output because high-quality plyometric reps require freshness, intent, and clean mechanics.'
    WHEN '10-yard-sprint' THEN 'Belongs in Output because max acceleration requires neural freshness and full intent.'
    WHEN 'worlds-greatest-stretch' THEN 'Belongs in Prepare/Access as dynamic mobility before higher-intent work.'
    WHEN 'kettlebell-swing' THEN 'Can appear in Output (ballistic) or Fitness depending on dose; default Capacity/conditioning hybrid.'
    ELSE 'Place in the phase matching primary methodology and intent tags.'
  END,
  CASE e.slug
    WHEN 'box-jump' THEN 'Fatigue reduces jump height, stiffness, and landing quality. Avoid after HIIT or heavy eccentrics.'
    WHEN '10-yard-sprint' THEN 'Fatigue turns sprint work into conditioning; keep early with full rest.'
    ELSE 'Consider freshness requirements for high-intent drills.'
  END,
  'Scale by age, skill, and movement quality before adding intensity or volume.',
  CASE e.slug
    WHEN 'box-jump' THEN 'Do not use high box jumps as a conditioning circuit.'
    ELSE 'Avoid placing fatigue-sensitive drills late in the session.'
  END,
  'Reduce height, reps, or complexity for youth and beginners; prioritize quality over load.'
FROM coaching.exercise e
WHERE e.archived = FALSE
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is,
  why_it_goes_here = EXCLUDED.why_it_goes_here,
  fatigue_logic = EXCLUDED.fatigue_logic,
  common_misuse = EXCLUDED.common_misuse,
  updated_at = now();

-- Override Box Jump safety/regimen
UPDATE coaching.exercise_safety_profile s SET
  impact_level = 4,
  requires_coach_supervision = 'recommended',
  minimum_age_recommended = 8,
  readiness_checks = ARRAY['Can perform controlled landing stick', 'Can maintain knee alignment'],
  stop_signs = ARRAY['Knee cave', 'Loud uncontrolled landing', 'Loss of posture on landing']
FROM coaching.exercise e
WHERE s.exercise_id = e.id AND e.slug = 'box-jump';

UPDATE coaching.exercise_regimen_rule r SET
  counts_as_high_intensity = TRUE,
  counts_as_high_impact = TRUE,
  counts_as_neural = TRUE,
  weekly_max_frequency = 3,
  recovery_notes = 'High-quality plyometric exposure 1-3x/week depending on age and impact tolerance.'
FROM coaching.exercise e
WHERE r.exercise_id = e.id AND e.slug = 'box-jump';

UPDATE coaching.exercise_regimen_rule r SET can_be_daily = TRUE, weekly_max_frequency = 7, minimum_hours_between_hard_exposures = 0
FROM coaching.exercise e
WHERE r.exercise_id = e.id AND e.slug = 'worlds-greatest-stretch';

-- Default scaling profile for all active exercises (publish gate requirement)
INSERT INTO coaching.exercise_scaling_profile (
  exercise_id, label, scale_direction, load_guidance, complexity_guidance, coach_notes
)
SELECT e.id, 'Baseline', 'baseline', 'Reduce load before reducing quality.', 'Use simpler variation when skill is limited.', 'Scale by age and skill before adding intensity.'
FROM coaching.exercise e
WHERE e.archived = FALSE
  AND NOT EXISTS (SELECT 1 FROM coaching.exercise_scaling_profile sp WHERE sp.exercise_id = e.id);
