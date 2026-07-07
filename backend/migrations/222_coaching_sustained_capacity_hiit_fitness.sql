-- Fitness-general HIIT sustained_capacity library (bar, med ball, cones, bodyweight).
-- IDEMPOTENT. Supports Needs Engine sustainedCapacityPolicy HIIT focus blocks.

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
  d.family, 'sustained_capacity', 'conditioning_intervals', d.slot,
  d.req::jsonb, d.exec::jsonb
FROM (VALUES
  (
    'Med Ball Squat to Press Interval', 'med-ball-squat-press-hiit-fitness',
    'Light med-ball squat to overhead press for repeatable HIIT intervals.',
    'INTERMEDIATE', 8, 14, 3, 8, 30, 30, 60,
    'HIIT med-ball interval for youth fitness sessions.',
    'Conditioning block — posture before speed.',
    'Crisp reps, full reset between sets.',
    'Med ball conditioning', 'conditioning_intervals',
    '{"primary_joint_actions":["squat","press"],"impact_level":1}'::jsonb,
    '{"movement_description":"Squat to press with light med ball.","setup":["Light med ball at chest"],"execution_steps":["Squat","Drive up and press","Reset"],"coach_cues":["Ribs down"],"common_faults":["Overloading ball"]}'::jsonb
  ),
  (
    'Cone Shuttle Touch Interval', 'cone-shuttle-touch-hiit-fitness',
    'Short cone shuttle with hand touch for repeatable conditioning.',
    'INTERMEDIATE', 8, 14, 4, 4, 20, 25, 45,
    'Cone shuttle HIIT for fitness-general sessions.',
    'Repeatable mechanics under fatigue — not max speed testing.',
    'Touch the cone, reset, go again.',
    'Agility conditioning', 'conditioning_intervals',
    '{"primary_joint_actions":["change_of_direction"],"impact_level":2}'::jsonb,
    '{"movement_description":"5-10m shuttle with cone touch.","setup":["2 cones 5-10m apart"],"execution_steps":["Sprint to cone","Touch and return"],"coach_cues":["Quiet decel"],"common_faults":["Sloppy cuts"]}'::jsonb
  ),
  (
    'Bar Hang to Squat Hold Circuit', 'bar-hang-squat-hold-hiit-fitness',
    'Alternate short bar hang with squat hold for bodyweight HIIT finisher.',
    'INTERMEDIATE', 8, 14, 3, 1, 25, 20, 45,
    'Bar + bodyweight HIIT circuit for sustained capacity.',
    'Low complexity, repeatable work/rest intervals.',
    'Hang, squat hold, breathe, repeat.',
    'Bodyweight conditioning', 'conditioning_intervals',
    '{"primary_joint_actions":["hang","squat_hold"],"impact_level":1}'::jsonb,
    '{"movement_description":"Hang then squat hold circuit.","setup":["Pull-up bar and open space"],"execution_steps":["Short hang","Squat hold","Rest"],"coach_cues":["Step down early from hang"],"common_faults":["Grip failure grinding"]}'::jsonb
  ),
  (
    'Med Ball Slam Reset Interval', 'med-ball-slam-reset-hiit-fitness',
    'Controlled med-ball slam with full reset for HIIT conditioning.',
    'INTERMEDIATE', 8, 14, 3, 6, 15, 30, 45,
    'Med-ball slam interval with stop rules for youth HIIT.',
    'Power ends when posture breaks — not max volume.',
    'Slam, reset, repeat with intent.',
    'Med ball conditioning', 'conditioning_intervals',
    '{"primary_joint_actions":["slam"],"impact_level":2}'::jsonb,
    '{"movement_description":"Overhead slam to reset.","setup":["Light slam ball"],"execution_steps":["Slam","Reset posture","Repeat"],"coach_cues":["Hinge before slam"],"common_faults":["Rounded back slams"]}'::jsonb
  ),
  (
    'Cone Lateral Shuffle Interval', 'cone-lateral-shuffle-hiit-fitness',
    'Lateral shuffle between cones for frontal-plane conditioning.',
    'INTERMEDIATE', 8, 14, 4, 6, 15, 20, 35,
    'Cone lateral shuffle HIIT for fitness sessions.',
    'Stay low, repeatable reps — not reactive agility testing.',
    'Shuffle, touch, shuffle back.',
    'Agility conditioning', 'conditioning_intervals',
    '{"primary_joint_actions":["lateral_shuffle"],"impact_level":1}'::jsonb,
    '{"movement_description":"Lateral shuffle between two cones.","setup":["Cones 3-5m apart"],"execution_steps":["Shuffle to cone","Touch and return"],"coach_cues":["Athletic stance"],"common_faults":["Crossing feet"]}'::jsonb
  ),
  (
    'Burpee to Target Interval', 'burpee-target-hiit-fitness',
    'Burpee with vertical target touch for bodyweight HIIT.',
    'INTERMEDIATE', 8, 14, 3, 6, 20, 30, 50,
    'Bodyweight burpee interval for sustained capacity blocks.',
    'Full reset between reps; stop before form collapse.',
    'Burpee, touch target, breathe.',
    'Bodyweight conditioning', 'conditioning_intervals',
    '{"primary_joint_actions":["burpee"],"impact_level":2}'::jsonb,
    '{"movement_description":"Burpee with target touch.","setup":["Wall target or line"],"execution_steps":["Burpee","Touch target","Stand and reset"],"coach_cues":["Plank first"],"common_faults":["Worming up"]}'::jsonb
  ),
  (
    'Med Ball Carry March Interval', 'med-ball-carry-march-hiit-fitness',
    'Chest-level med-ball carry march for low-impact HIIT.',
    'BEGINNER', 8, 14, 3, 20, 30, 20, 50,
    'Low-impact med-ball carry interval for youth HIIT.',
    'Posture and breathing under light load.',
    'March tall with the ball.',
    'Med ball conditioning', 'conditioning_intervals',
    '{"primary_joint_actions":["carry"],"impact_level":1}'::jsonb,
    '{"movement_description":"Chest carry march for time.","setup":["Light med ball at chest"],"execution_steps":["March 10-20 steps","Turn and return"],"coach_cues":["Ribs stacked"],"common_faults":["Sagging posture"]}'::jsonb
  ),
  (
    'Jump Rope Interval Burst', 'jump-rope-interval-hiit-fitness',
    'Short jump rope bursts with full rest for HIIT finisher.',
    'BEGINNER', 8, 14, 4, 1, 20, 25, 45,
    'Jump rope HIIT interval using bodyweight only.',
    'Quick feet, quiet landings, full rest.',
    'Fast rope, then recover.',
    'Elastic conditioning', 'conditioning_intervals',
    '{"primary_joint_actions":["jump_rope"],"impact_level":2}'::jsonb,
    '{"movement_description":"20s rope burst with rest.","setup":["Jump rope"],"execution_steps":["Fast bounce","Rest fully"],"coach_cues":["Soft landings"],"common_faults":["High jumps"]}'::jsonb
  )
) AS d(name, slug, description, skill, age_min, age_max, sets, reps, work, rest, est, summary, coach_lang, athlete_lang, family, slot, req, exec)
CROSS JOIN public.facility f
ON CONFLICT (facility_id, slug) DO UPDATE SET
  primary_phase_key = EXCLUDED.primary_phase_key,
  phase_subrole = EXCLUDED.phase_subrole,
  updated_at = now();

-- HIIT methodology + conditioning intent tags
INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'methodology', m.id, 5
FROM coaching.exercise e
JOIN coaching.methodology m ON m.key = 'hiit'
WHERE e.slug IN (
  'med-ball-squat-press-hiit-fitness', 'cone-shuttle-touch-hiit-fitness',
  'bar-hang-squat-hold-hiit-fitness', 'med-ball-slam-reset-hiit-fitness',
  'cone-lateral-shuffle-hiit-fitness', 'burpee-target-hiit-fitness',
  'med-ball-carry-march-hiit-fitness', 'jump-rope-interval-hiit-fitness'
)
ON CONFLICT (exercise_id, facet_type, facet_id) DO UPDATE SET weight = GREATEST(coaching.exercise_tag.weight, EXCLUDED.weight);

INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'equipment', eq.id, 5
FROM coaching.exercise e
JOIN coaching.equipment eq ON eq.key = v.equip_key
JOIN (VALUES
  ('med-ball-squat-press-hiit-fitness', 'medicine_ball'),
  ('med-ball-slam-reset-hiit-fitness', 'medicine_ball'),
  ('med-ball-carry-march-hiit-fitness', 'medicine_ball'),
  ('cone-shuttle-touch-hiit-fitness', 'cones'),
  ('cone-lateral-shuffle-hiit-fitness', 'cones'),
  ('bar-hang-squat-hold-hiit-fitness', 'bar')
) AS v(slug, equip_key) ON e.slug = v.slug
ON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;

-- Sustained capacity primary profiles
INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, 5, 'primary', 'conditioning_intervals', 500,
  FALSE, 4, 4, 3, 2, 'moderate'
FROM coaching.exercise e
JOIN coaching.session_phase sp ON sp.key = 'sustained_capacity'
WHERE e.slug IN (
  'med-ball-squat-press-hiit-fitness', 'cone-shuttle-touch-hiit-fitness',
  'bar-hang-squat-hold-hiit-fitness', 'med-ball-slam-reset-hiit-fitness',
  'cone-lateral-shuffle-hiit-fitness', 'burpee-target-hiit-fitness',
  'med-ball-carry-march-hiit-fitness', 'jump-rope-interval-hiit-fitness'
)
ON CONFLICT (exercise_id, phase_id) DO UPDATE SET
  role = 'primary',
  fit_weight = GREATEST(coaching.exercise_phase_profile.fit_weight, EXCLUDED.fit_weight);

-- Youth intermediate difficulty
INSERT INTO coaching.exercise_difficulty_profile (
  exercise_id, technical, load, overall, recommended_age_min, recommended_age_max, attention_demand, notes, source, updated_at
)
SELECT e.id, v.technical, v.load, v.overall, 8, 14, 'moderate', 'Fitness HIIT sustained_capacity seed', 'hiit_fitness_seed', now()
FROM coaching.exercise e
JOIN (VALUES
  ('med-ball-squat-press-hiit-fitness', 3, 3, 4),
  ('cone-shuttle-touch-hiit-fitness', 4, 2, 5),
  ('bar-hang-squat-hold-hiit-fitness', 3, 2, 4),
  ('med-ball-slam-reset-hiit-fitness', 3, 3, 5),
  ('cone-lateral-shuffle-hiit-fitness', 3, 2, 4),
  ('burpee-target-hiit-fitness', 4, 2, 5),
  ('med-ball-carry-march-hiit-fitness', 2, 2, 3),
  ('jump-rope-interval-hiit-fitness', 3, 2, 4)
) AS v(slug, technical, load, overall) ON e.slug = v.slug
ON CONFLICT (exercise_id) DO UPDATE SET
  overall = LEAST(coaching.exercise_difficulty_profile.overall, EXCLUDED.overall),
  updated_at = now();
