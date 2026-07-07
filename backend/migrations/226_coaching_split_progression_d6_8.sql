-- Split progression library: D6–8 capacity/output variants sharing patterns with youth base cards.
-- IDEMPOTENT. Supports Needs Engine pickSplitProgression for high-cap audience splits.

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
  d.family, d.phase_key, d.subrole, d.slot,
  d.req::jsonb, d.exec::jsonb
FROM public.facility f
CROSS JOIN (VALUES
  (
    'Heavy Med Ball Chest Pass', 'heavy-med-ball-chest-pass-d7',
    'Heavier medicine ball chest pass with full reset between reps — progression from light chest pass.',
    'INTERMEDIATE', 8, 14, 4, 5, 15, 45, 60,
    'Higher-load horizontal push for intermediate youth splits.',
    'Use only when light chest pass is crisp. Full reset, no fatigue chasing.',
    'Push hard, reset, repeat.',
    'Medicine Ball Quick Release', 'output', 'jump_throw_explosive_power', 'jump_throw_explosive_power',
    '{"primary_joint_actions":["horizontal_push"],"impact_level":1}'::jsonb,
    '{"movement_description":"Standing chest pass with heavier med ball.","setup":["Athletic stance, ball at chest"],"execution_steps":["Brace trunk","Explosive pass","Walk to reset"],"coach_cues":["Crisp intent"],"common_faults":["Slow grind reps"]}'::jsonb
  ),
  (
    'Goblet Squat Tempo 3-1', 'goblet-squat-tempo-d6',
    'Tempo goblet squat (3s down, 1s pause) for capacity strength under control.',
    'INTERMEDIATE', 8, 14, 3, 6, 45, 45, 90,
    'Controlled squat capacity progression for higher difficulty splits.',
    'Tempo before load. Stop when posture breaks.',
    'Slow down, pause, stand strong.',
    'Squat strength', 'capacity', 'squat_knee_dominant_strength', 'squat_strength',
    '{"primary_joint_actions":["squat"],"impact_level":0}'::jsonb,
    '{"movement_description":"Goblet squat with 3-1 tempo.","setup":["Goblet hold at chest"],"execution_steps":["3s descent","1s pause","Drive up"],"coach_cues":["Ribs down"],"common_faults":["Rushing the bottom"]}'::jsonb
  ),
  (
    'Kettlebell Deadlift Heavy', 'kettlebell-deadlift-heavy-d7',
    'Heavier kettlebell deadlift with strict hinge — progression from trap-bar/KB intro hinge.',
    'INTERMEDIATE', 8, 14, 4, 5, 45, 60, 105,
    'Load progression for hinge capacity on older youth splits.',
    'Load only when hinge pattern is consistent.',
    'Hinge, grip, stand tall.',
    'Hinge strength', 'capacity', 'hinge_posterior_chain_strength', 'deadlift_strength',
    '{"primary_joint_actions":["hip_hinge"],"impact_level":0}'::jsonb,
    '{"movement_description":"Double KB or heavy single KB deadlift.","setup":["Hinge setup, lats engaged"],"execution_steps":["Push floor away","Lock hips","Control down"],"coach_cues":["Long spine"],"common_faults":["Rounded back"]}'::jsonb
  ),
  (
    'Reactive Broad Jump', 'reactive-broad-jump-d7',
    'Two-step approach broad jump emphasizing elastic rebound — progression from standing broad jump.',
    'INTERMEDIATE', 8, 14, 4, 3, 20, 60, 80,
    'Elastic horizontal output for high-cap splits.',
    'Low rep, full recovery. Stop when distance drops.',
    'Quick steps, big jump, stick.',
    'Horizontal jump', 'output', 'jump_throw_explosive_power', 'horizontal_power',
    '{"primary_joint_actions":["horizontal_projection"],"impact_level":2}'::jsonb,
    '{"movement_description":"Approach broad jump with stick landing.","setup":["Marked lane"],"execution_steps":["Two quick steps","Project forward","Stick landing"],"coach_cues":["Quiet feet on landing"],"common_faults":["Collapsed landing"]}'::jsonb
  ),
  (
    'Triple Broad Jump — Loaded Intent', 'triple-broad-jump-d7',
    'Three-contact broad jump with longer rest and higher intent — progression from triple broad jump.',
    'INTERMEDIATE', 8, 14, 4, 3, 25, 75, 100,
    'Higher-intent horizontal reactive output for older youth splits.',
    'Full recovery between reps. Stop when contact quality drops.',
    'Three big jumps, stick the finish.',
    'Horizontal reactive jump', 'output', 'elastic_stiffness_plyometric_rudiments', 'horizontal_reactive_power',
    '{"primary_joint_actions":["horizontal_projection"],"impact_level":2}'::jsonb,
    '{"movement_description":"Three continuous broad jumps with stick finish.","setup":["Marked lane"],"execution_steps":["Jump 1","Jump 2","Jump 3 and stick"],"coach_cues":["Quiet landings"],"common_faults":["Collapsed posture between contacts"]}'::jsonb
  )
) AS d(name, slug, description, skill, age_min, age_max, sets, reps, work, rest, est, summary, coach_lang, athlete_lang, family, phase_key, subrole, slot, req, exec)
ON CONFLICT (facility_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  skill_level = EXCLUDED.skill_level,
  age_min = EXCLUDED.age_min,
  age_max = EXCLUDED.age_max,
  default_sets = EXCLUDED.default_sets,
  default_reps = EXCLUDED.default_reps,
  default_work_seconds = EXCLUDED.default_work_seconds,
  default_rest_seconds = EXCLUDED.default_rest_seconds,
  est_seconds_per_set = EXCLUDED.est_seconds_per_set,
  is_published = EXCLUDED.is_published,
  primary_phase_key = EXCLUDED.primary_phase_key,
  phase_subrole = EXCLUDED.phase_subrole,
  primary_order_slot = EXCLUDED.primary_order_slot,
  updated_at = now();

-- Difficulty D6–8 for progression picks
INSERT INTO coaching.exercise_difficulty_profile (
  exercise_id, technical, load, overall,
  recommended_age_min, recommended_age_max, attention_demand, notes, source, updated_at
)
SELECT e.id, v.technical, v.load, v.overall,
  v.age_min, v.age_max, 'moderate', v.notes, 'split_progression_d6_8', now()
FROM coaching.exercise e
JOIN (VALUES
  ('heavy-med-ball-chest-pass-d7', 5, 6, 7, 8, 14, 'Progression from med-ball-chest-pass'),
  ('goblet-squat-tempo-d6', 5, 5, 6, 8, 14, 'Progression from goblet-squat'),
  ('kettlebell-deadlift-heavy-d7', 5, 6, 7, 8, 14, 'Progression from kettlebell-deadlift-trap-bar-deadlift'),
  ('reactive-broad-jump-d7', 6, 5, 7, 8, 14, 'Progression from standing-broad-jump'),
  ('triple-broad-jump-d7', 6, 6, 7, 8, 14, 'Progression from triple-broad-jump')
) AS v(slug, technical, load, overall, age_min, age_max, notes) ON e.slug = v.slug
ON CONFLICT (exercise_id) DO UPDATE SET
  technical = GREATEST(coaching.exercise_difficulty_profile.technical, EXCLUDED.technical),
  load = GREATEST(coaching.exercise_difficulty_profile.load, EXCLUDED.load),
  overall = GREATEST(coaching.exercise_difficulty_profile.overall, EXCLUDED.overall),
  recommended_age_min = COALESCE(coaching.exercise_difficulty_profile.recommended_age_min, EXCLUDED.recommended_age_min),
  recommended_age_max = COALESCE(EXCLUDED.recommended_age_max, coaching.exercise_difficulty_profile.recommended_age_max),
  notes = EXCLUDED.notes,
  source = EXCLUDED.source,
  updated_at = now();

-- Share pattern tags with base exercises (same movement pattern facet)
INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT prog.id, 'pattern', base_pat.facet_id, 5
FROM coaching.exercise prog
JOIN (VALUES
  ('heavy-med-ball-chest-pass-d7', 'med-ball-chest-pass'),
  ('goblet-squat-tempo-d6', 'goblet-squat'),
  ('kettlebell-deadlift-heavy-d7', 'kettlebell-deadlift-trap-bar-deadlift'),
  ('reactive-broad-jump-d7', 'standing-broad-jump'),
  ('triple-broad-jump-d7', 'triple-broad-jump')
) AS v(prog_slug, base_slug) ON prog.slug = v.prog_slug
JOIN coaching.exercise base ON base.slug = v.base_slug
JOIN coaching.exercise_tag base_pat ON base_pat.exercise_id = base.id AND base_pat.facet_type = 'pattern'
ON CONFLICT (exercise_id, facet_type, facet_id) DO UPDATE SET weight = GREATEST(coaching.exercise_tag.weight, EXCLUDED.weight);

-- Phase profiles
INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, 5, 'secondary', v.order_slot, pos.order_index,
  FALSE, 3, 2, v.technical, v.impact, 'moderate'
FROM coaching.exercise e
JOIN (VALUES
  ('heavy-med-ball-chest-pass-d7', 'output', 'jump_throw_explosive_power', 4, 1),
  ('goblet-squat-tempo-d6', 'capacity', 'squat_strength', 3, 0),
  ('kettlebell-deadlift-heavy-d7', 'capacity', 'deadlift_strength', 4, 0),
  ('reactive-broad-jump-d7', 'output', 'horizontal_power', 4, 2),
  ('triple-broad-jump-d7', 'output', 'horizontal_reactive_power', 4, 2)
) AS v(slug, phase_key, order_slot, technical, impact) ON e.slug = v.slug
JOIN coaching.session_phase sp ON sp.key = v.phase_key
JOIN coaching.phase_order_slot pos ON pos.key = v.order_slot AND pos.phase_id = sp.id
ON CONFLICT (exercise_id, phase_id) DO UPDATE SET
  fit_weight = GREATEST(coaching.exercise_phase_profile.fit_weight, EXCLUDED.fit_weight),
  role = CASE
    WHEN coaching.exercise_phase_profile.role = 'primary' THEN coaching.exercise_phase_profile.role
    ELSE EXCLUDED.role
  END,
  order_slot = COALESCE(EXCLUDED.order_slot, coaching.exercise_phase_profile.order_slot);

-- Explosiveness tenet tags
INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'tenet', t.id, 5
FROM coaching.exercise e
JOIN coaching.tenet t ON t.key = 'explosiveness'
WHERE e.slug IN ('heavy-med-ball-chest-pass-d7', 'reactive-broad-jump-d7', 'triple-broad-jump-d7')
ON CONFLICT (exercise_id, facet_type, facet_id) DO UPDATE SET weight = GREATEST(coaching.exercise_tag.weight, EXCLUDED.weight);

-- Kettlebell equipment tags for capacity progressions
INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'equipment', eq.id, 5
FROM coaching.exercise e
JOIN (VALUES
  ('goblet-squat-tempo-d6', 'kettlebell'),
  ('kettlebell-deadlift-heavy-d7', 'kettlebell')
) AS v(slug, equip_key) ON e.slug = v.slug
JOIN coaching.equipment eq ON eq.key = v.equip_key
ON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;
