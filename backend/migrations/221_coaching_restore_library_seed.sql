-- Restore phase library: primary restore profiles for breathing/mobility downshift cards.
-- IDEMPOTENT. Supports Needs Engine restoreSelectionPolicy (no explosive/conditional-only picks).

-- Restore order slots (fitness-general)
INSERT INTO coaching.phase_order_slot (key, name, description, phase_id, order_index, freshness_sensitivity, subrole_key)
SELECT v.key, v.name, v.description, sp.id, v.order_index, v.freshness_sensitivity, v.subrole_key
FROM coaching.session_phase sp
CROSS JOIN (VALUES
  ('cooldown_breathing', 'Cooldown Breathing', 'Nasal breathing and downshift after high-output work.', 901, 2, 'breathing_downshift'),
  ('post_workout_flexibility', 'Post-Workout Flexibility', 'Static holds and gentle range after training.', 902, 2, 'mobilize'),
  ('slow_cone_walk_reset', 'Slow Cone Walk Reset', 'Low-intensity cone walking patterns for downshift.', 903, 2, 'locomotion_coordination')
) AS v(key, name, description, order_index, freshness_sensitivity, subrole_key)
WHERE sp.key = 'restore'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  phase_id = EXCLUDED.phase_id,
  order_index = EXCLUDED.order_index,
  freshness_sensitivity = EXCLUDED.freshness_sensitivity,
  subrole_key = EXCLUDED.subrole_key;

-- Promote existing breathing cards to restore-primary where appropriate
UPDATE coaching.exercise SET
  primary_phase_key = 'restore',
  phase_subrole = 'breathing_downshift',
  updated_at = now()
WHERE slug IN (
  '9090-breathing-with-reach',
  'crocodile-breathing',
  '9090-breathing-with-hip-reset'
)
AND primary_phase_key IN ('prepare_and_access', 'restore');

-- Restore primary phase profiles
INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, 5, 'primary', v.order_slot, pos.order_index,
  FALSE, 1, 1, 1, 0, 'low'
FROM coaching.exercise e
JOIN coaching.session_phase sp ON sp.key = 'restore'
JOIN (VALUES
  ('9090-breathing-with-reach', 'cooldown_breathing'),
  ('crocodile-breathing', 'cooldown_breathing'),
  ('9090-breathing-with-hip-reset', 'cooldown_breathing'),
  ('cat-cow', 'post_workout_flexibility'),
  ('side-lying-open-book', 'post_workout_flexibility'),
  ('dead-bug-heel-tap', 'cooldown_breathing')
) AS v(slug, order_slot) ON e.slug = v.slug
JOIN coaching.phase_order_slot pos ON pos.key = v.order_slot AND pos.phase_id = sp.id
ON CONFLICT (exercise_id, phase_id) DO UPDATE SET
  fit_weight = GREATEST(coaching.exercise_phase_profile.fit_weight, EXCLUDED.fit_weight),
  role = CASE
    WHEN coaching.exercise_phase_profile.role = 'avoid' THEN EXCLUDED.role
    WHEN EXCLUDED.role = 'primary' THEN 'primary'
    ELSE coaching.exercise_phase_profile.role
  END,
  order_slot = COALESCE(EXCLUDED.order_slot, coaching.exercise_phase_profile.order_slot),
  impact_level = LEAST(coaching.exercise_phase_profile.impact_level, EXCLUDED.impact_level),
  intensity_ceiling = 'low',
  fatigue_cost = LEAST(coaching.exercise_phase_profile.fatigue_cost, EXCLUDED.fatigue_cost);

-- New fitness-general restore cards
INSERT INTO coaching.exercise (
  facility_id, name, slug, description, sport_id, skill_level, age_min, age_max,
  default_sets, default_reps, default_work_seconds, default_rest_seconds, est_seconds_per_set,
  is_published, visibility, programming_kind,
  card_summary, coach_language, athlete_language,
  movement_family, primary_phase_key, phase_subrole, primary_order_slot,
  movement_requirements, coaching_execution
)
SELECT
  f.id, d.name, d.slug, d.description,
  (SELECT id FROM coaching.sport WHERE key = 'fitness'),
  d.skill::public.skill_level, d.age_min, d.age_max,
  d.sets, d.reps, d.work, d.rest, d.est,
  TRUE, 'facility', 'exercise',
  d.summary, d.coach_lang, d.athlete_lang,
  d.family, 'restore', d.subrole, d.slot,
  d.req::jsonb, d.exec::jsonb
FROM (VALUES
  (
    'Box Breathing Hold', 'box-breathing-hold-restore',
    'Four-count inhale, hold, exhale, hold for nervous-system downshift.',
    'BEGINNER', 8, 14, 2, 4, 60, 15, 75,
    'Structured nasal breathing to downshift after high-output work.',
    'Use at session end only. Long exhales, no strain.',
    'Breathe slow and let your body calm down.',
    'Breathing reset', 'breathing_downshift', 'cooldown_breathing',
    '{"primary_joint_actions":["diaphragmatic_breathing"],"impact_level":0}'::jsonb,
    '{"movement_description":"Seated or supine box breathing.","setup":["Comfortable seated or supine"],"execution_steps":["Inhale 4s","Hold 4s","Exhale 4s","Hold 4s"],"coach_cues":["Quiet nose breathing"],"common_faults":["Breath holding strain"]}'::jsonb
  ),
  (
    'Supine Hamstring Hold', 'supine-hamstring-hold-restore',
    'Gentle supine hamstring stretch hold for post-session range.',
    'BEGINNER', 8, 14, 2, 1, 45, 10, 55,
    'Static hamstring hold without aggressive stretching.',
    'Restore only — no bouncing or strain.',
    'Hold easy tension and breathe.',
    'Static flexibility', 'mobilize', 'post_workout_flexibility',
    '{"primary_joint_actions":["hip_flexion"],"impact_level":0}'::jsonb,
    '{"movement_description":"Supine hamstring hold with strap or hands behind thigh.","setup":["Supine, one leg extended or supported"],"execution_steps":["Hold gentle stretch","Breathe slowly"],"coach_cues":["Keep ribs down"],"common_faults":["Aggressive pulling"]}'::jsonb
  ),
  (
    'Wall Calf Hold', 'wall-calf-hold-restore',
    'Standing wall calf stretch hold for ankle tissue recovery.',
    'BEGINNER', 8, 14, 2, 1, 40, 10, 50,
    'Static calf hold after jumping and running sessions.',
    'Restore phase static hold only.',
    'Hold and breathe at the wall.',
    'Static flexibility', 'mobilize', 'post_workout_flexibility',
    '{"primary_joint_actions":["ankle_dorsiflexion"],"impact_level":0}'::jsonb,
    '{"movement_description":"Standing calf stretch at wall.","setup":["Hands on wall, staggered stance"],"execution_steps":["Drive heel down","Hold without bouncing"],"coach_cues":["Straight back leg"],"common_faults":["Bouncing"]}'::jsonb
  ),
  (
    'Med Ball Belly Breathing', 'med-ball-belly-breathing-restore',
    'Light medicine ball on belly for tactile breathing feedback.',
    'BEGINNER', 8, 14, 2, 5, 60, 15, 75,
    'Downshift breathing with light med-ball tactile cue — not a throw.',
    'Restore only. Light ball, long exhales.',
    'Feel your belly rise and fall.',
    'Breathing reset', 'breathing_downshift', 'cooldown_breathing',
    '{"primary_joint_actions":["diaphragmatic_breathing"],"impact_level":0}'::jsonb,
    '{"movement_description":"Supine breathing with light med ball on abdomen.","setup":["Supine, light med ball on belly"],"execution_steps":["Inhale into belly","Long exhale"],"coach_cues":["Ball rises on inhale"],"common_faults":["Chest-only breathing"]}'::jsonb
  ),
  (
    'Slow Cone Walk Reset', 'slow-cone-walk-reset-restore',
    'Slow cone walking patterns for locomotion downshift.',
    'BEGINNER', 8, 14, 2, 1, 30, 10, 40,
    'Low-intensity cone walk to transition out of training.',
    'Walking tempo only — not agility or speed work.',
    'Walk smooth and quiet around the cones.',
    'Locomotion reset', 'locomotion_coordination', 'slow_cone_walk_reset',
    '{"primary_joint_actions":["walking"],"impact_level":0}'::jsonb,
    '{"movement_description":"Slow figure-8 or box walk around cones.","setup":["2-4 cones in short pattern"],"execution_steps":["Walk the pattern slowly","Reset posture each lap"],"coach_cues":["Quiet feet"],"common_faults":["Rushing"]}'::jsonb
  ),
  (
    'Dead Hang Breathing Reset', 'dead-hang-breathing-reset-restore',
    'Short dead hang with nasal breathing for shoulder and grip downshift.',
    'INTERMEDIATE', 8, 14, 2, 3, 20, 30, 50,
    'Supported hang with breathing — not max grip or fatigue.',
    'Use box assist if needed. Short holds only.',
    'Hang, breathe, step down before grip fails.',
    'Breathing reset', 'breathing_downshift', 'cooldown_breathing',
    '{"primary_joint_actions":["shoulder_depression"],"impact_level":0}'::jsonb,
    '{"movement_description":"Short dead hang with nasal breathing.","setup":["Secure bar, feet assist optional"],"execution_steps":["Hang with straight arms","Breathe slowly","Step down early"],"coach_cues":["Relax shoulders"],"common_faults":["Max grip to failure"]}'::jsonb
  )
) AS d(name, slug, description, skill, age_min, age_max, sets, reps, work, rest, est, summary, coach_lang, athlete_lang, family, subrole, slot, req, exec)
CROSS JOIN public.facility f
ON CONFLICT (facility_id, slug) DO UPDATE SET
  primary_phase_key = EXCLUDED.primary_phase_key,
  phase_subrole = EXCLUDED.phase_subrole,
  primary_order_slot = EXCLUDED.primary_order_slot,
  updated_at = now();

-- Tags for new restore cards
INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'methodology', m.id, 5
FROM coaching.exercise e
JOIN coaching.methodology m ON m.key = 'mobility_flexibility'
WHERE e.slug IN (
  'box-breathing-hold-restore', 'supine-hamstring-hold-restore', 'wall-calf-hold-restore',
  'med-ball-belly-breathing-restore', 'slow-cone-walk-reset-restore', 'dead-hang-breathing-reset-restore'
)
ON CONFLICT (exercise_id, facet_type, facet_id) DO UPDATE SET weight = GREATEST(coaching.exercise_tag.weight, EXCLUDED.weight);

INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'equipment', eq.id, 5
FROM coaching.exercise e
JOIN coaching.equipment eq ON eq.key = v.equip_key
JOIN (VALUES
  ('med-ball-belly-breathing-restore', 'medicine_ball'),
  ('slow-cone-walk-reset-restore', 'cones'),
  ('dead-hang-breathing-reset-restore', 'bar')
) AS v(slug, equip_key) ON e.slug = v.slug
ON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;

-- Restore profiles for new cards
INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, 5, 'primary', e.primary_order_slot, COALESCE(pos.order_index, 900),
  FALSE, 1, 1, 1, 0, 'low'
FROM coaching.exercise e
JOIN coaching.session_phase sp ON sp.key = 'restore'
LEFT JOIN coaching.phase_order_slot pos ON pos.key = e.primary_order_slot AND pos.phase_id = sp.id
WHERE e.slug IN (
  'box-breathing-hold-restore', 'supine-hamstring-hold-restore', 'wall-calf-hold-restore',
  'med-ball-belly-breathing-restore', 'slow-cone-walk-reset-restore', 'dead-hang-breathing-reset-restore'
)
ON CONFLICT (exercise_id, phase_id) DO UPDATE SET
  role = 'primary',
  fit_weight = GREATEST(coaching.exercise_phase_profile.fit_weight, EXCLUDED.fit_weight),
  intensity_ceiling = 'low',
  impact_level = 0,
  fatigue_cost = 1;

-- Youth-friendly difficulty for restore cards
INSERT INTO coaching.exercise_difficulty_profile (
  exercise_id, technical, load, overall, recommended_age_min, recommended_age_max, attention_demand, notes, source, updated_at
)
SELECT e.id, 2, 1, 2, 8, 14, 'low', 'Restore downshift card', 'restore_library_seed', now()
FROM coaching.exercise e
WHERE e.slug IN (
  'box-breathing-hold-restore', 'supine-hamstring-hold-restore', 'wall-calf-hold-restore',
  'med-ball-belly-breathing-restore', 'slow-cone-walk-reset-restore', 'dead-hang-breathing-reset-restore',
  '9090-breathing-with-reach', 'crocodile-breathing', '9090-breathing-with-hip-reset'
)
ON CONFLICT (exercise_id) DO UPDATE SET
  overall = LEAST(coaching.exercise_difficulty_profile.overall, EXCLUDED.overall),
  technical = LEAST(coaching.exercise_difficulty_profile.technical, EXCLUDED.technical),
  load = LEAST(coaching.exercise_difficulty_profile.load, EXCLUDED.load),
  updated_at = now();
