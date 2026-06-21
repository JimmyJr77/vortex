-- ============================================================
-- Coaching Module: Starter Exercise/Drill Library Seed
-- Migration: 019_coaching_seed_starter_library.sql
--
-- A small, well-tagged starter set across fitness, gymnastics, and ninja so
-- the library, builders, and Needs Engine are immediately usable.
--
-- IDEMPOTENT: exercises keyed by (facility_id, slug); tags ON CONFLICT.
-- ============================================================

-- 1) Exercises -------------------------------------------------
INSERT INTO coaching.exercise
  (facility_id, name, slug, description, sport_id, skill_level, age_min, age_max,
   default_sets, default_reps, default_work_seconds, default_rest_seconds, est_seconds_per_set, is_published, visibility)
SELECT
  (SELECT id FROM public.facility ORDER BY id LIMIT 1),
  d.name, d.slug, d.description,
  (SELECT id FROM coaching.sport WHERE key = d.sport_key),
  NULLIF(d.skill_level, '')::public.skill_level,
  d.age_min::int, d.age_max::int, d.default_sets::int, d.default_reps::int,
  d.default_work_seconds::int, d.default_rest_seconds::int, d.est_seconds_per_set::int,
  TRUE, 'facility'
FROM (VALUES
  ('Back Squat',            'back-squat',            'Bilateral lower-body strength builder.',                 'fitness',    'BEGINNER',     8, NULL, 4, 6, NULL, 90, 50),
  ('Box Jump',              'box-jump',              'Explosive concentric jump onto a box.',                  'fitness',    'BEGINNER',     8, NULL, 4, 5, NULL, 60, 40),
  ('Depth Jump',           'depth-jump',            'Reactive plyometric for stretch-shortening cycle.',      'fitness',    'INTERMEDIATE', 12, NULL, 4, 4, NULL, 90, 45),
  ('Nordic Hamstring Curl', 'nordic-hamstring-curl', 'Eccentric posterior-chain strength and injury proofing.', 'fitness',    'INTERMEDIATE', 12, NULL, 3, 6, NULL, 90, 55),
  ('Plank Hold',            'plank-hold',            'Anti-extension isometric core brace.',                   'fitness',    'EARLY_STAGE',  6, NULL, 3, NULL, 30, 30, 40),
  ('10-Yard Sprint',        '10-yard-sprint',        'Maximal acceleration sprint.',                           'fitness',    'BEGINNER',     8, NULL, 6, 1, NULL, 60, 45),
  ('Lateral Bound',         'lateral-bound',         'Frontal-plane reactive bound for agility.',              'fitness',    'BEGINNER',     8, NULL, 3, 6, NULL, 45, 40),
  ('Single-Leg RDL',        'single-leg-rdl',        'Unilateral hinge for balance and posterior chain.',      'fitness',    'BEGINNER',     8, NULL, 3, 8, NULL, 45, 45),
  ('Dead Bug',              'dead-bug',              'Coordinated anti-rotation core activation.',             'fitness',    'EARLY_STAGE',  6, NULL, 3, 10, NULL, 30, 35),
  ('Worlds Greatest Stretch','worlds-greatest-stretch','Dynamic full-body mobility warmup.',                   'fitness',    'EARLY_STAGE',  6, NULL, 2, 6, NULL, 20, 35),
  ('Kettlebell Swing',      'kettlebell-swing',      'Ballistic hip hinge for power and conditioning.',        'fitness',    'BEGINNER',     10, NULL, 4, 15, 30, 45, 40),
  ('Pull-up',               'pull-up',               'Vertical pulling strength.',                             'fitness',    'INTERMEDIATE', 8, NULL, 4, 6, NULL, 90, 45),
  ('Hollow Body Hold',      'hollow-body-hold',      'Foundational gymnastics body-line isometric.',           'gymnastics', 'EARLY_STAGE',  6, NULL, 4, NULL, 20, 40, 35),
  ('Handstand Hold',        'handstand-hold',        'Inverted balance and shoulder stability.',               'gymnastics', 'BEGINNER',     6, NULL, 5, NULL, 15, 45, 35),
  ('Cartwheel',             'cartwheel',             'Foundational rotational locomotion skill.',              'gymnastics', 'BEGINNER',     6, NULL, 4, 4, NULL, 45, 40),
  ('Back Bridge',           'back-bridge',           'Spinal extension flexibility skill.',                    'gymnastics', 'BEGINNER',     6, NULL, 3, NULL, 20, 40, 35),
  ('Bar Cast',              'bar-cast',              'Support-position strength on bar.',                      'gymnastics', 'INTERMEDIATE', 7, NULL, 4, 6, NULL, 60, 45),
  ('Round-off',             'round-off',             'Power rotational entry skill.',                          'gymnastics', 'INTERMEDIATE', 7, NULL, 4, 4, NULL, 60, 45),
  ('Lache Swing',           'lache-swing',           'Swinging release-and-catch on bars.',                    'ninja',      'INTERMEDIATE', 8, NULL, 4, 3, NULL, 60, 45),
  ('Precision Jump',        'precision-jump',        'Controlled jump to a precise landing.',                  'ninja',      'BEGINNER',     8, NULL, 4, 5, NULL, 45, 40)
) AS d(name, slug, description, sport_key, skill_level, age_min, age_max, default_sets, default_reps, default_work_seconds, default_rest_seconds, est_seconds_per_set)
ON CONFLICT (facility_id, slug) DO NOTHING;

-- 2) Tag helper inserts ---------------------------------------
-- TENET tags
INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'tenet', t.id, v.weight
FROM (VALUES
  ('back-squat','strength',5),('back-squat','explosiveness',2),
  ('box-jump','explosiveness',5),('box-jump','strength',2),
  ('depth-jump','explosiveness',5),('depth-jump','speed',3),
  ('nordic-hamstring-curl','strength',5),
  ('plank-hold','body_control',4),('plank-hold','strength',3),
  ('10-yard-sprint','speed',5),('10-yard-sprint','explosiveness',4),
  ('lateral-bound','agility',5),('lateral-bound','explosiveness',3),
  ('single-leg-rdl','balance',4),('single-leg-rdl','strength',3),
  ('dead-bug','coordination',4),('dead-bug','body_control',4),
  ('worlds-greatest-stretch','flexibility',5),
  ('kettlebell-swing','explosiveness',4),('kettlebell-swing','strength',3),
  ('pull-up','strength',5),
  ('hollow-body-hold','body_control',5),('hollow-body-hold','strength',3),
  ('handstand-hold','balance',5),('handstand-hold','body_control',4),
  ('cartwheel','coordination',5),('cartwheel','body_control',4),
  ('back-bridge','flexibility',5),
  ('bar-cast','strength',4),('bar-cast','body_control',3),
  ('round-off','explosiveness',4),('round-off','coordination',4),
  ('lache-swing','explosiveness',4),('lache-swing','coordination',3),
  ('precision-jump','balance',5),('precision-jump','body_control',4)
) AS v(slug, tenet_key, weight)
JOIN coaching.exercise e ON e.slug = v.slug
JOIN coaching.tenet t ON t.key = v.tenet_key
ON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;

-- METHODOLOGY tags
INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'methodology', m.id, v.weight
FROM (VALUES
  ('back-squat','resistance_calisthenics',5),
  ('box-jump','plyometrics',5),
  ('depth-jump','plyometrics',5),
  ('nordic-hamstring-curl','eccentric_negative',5),
  ('plank-hold','isometrics',5),
  ('10-yard-sprint','neural',5),
  ('lateral-bound','plyometrics',5),
  ('single-leg-rdl','balance_stability',4),
  ('dead-bug','core_body_control',5),
  ('worlds-greatest-stretch','mobility_flexibility',5),
  ('kettlebell-swing','resistance_calisthenics',4),
  ('pull-up','resistance_calisthenics',5),
  ('hollow-body-hold','core_body_control',5),
  ('handstand-hold','isometrics',5),
  ('cartwheel','neural',4),
  ('back-bridge','mobility_flexibility',5),
  ('bar-cast','resistance_calisthenics',4),
  ('round-off','plyometrics',4),
  ('lache-swing','plyometrics',4),
  ('precision-jump','balance_stability',4)
) AS v(slug, methodology_key, weight)
JOIN coaching.exercise e ON e.slug = v.slug
JOIN coaching.methodology m ON m.key = v.methodology_key
ON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;

-- PHYSIOLOGY tags
INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'physiology', p.id, v.weight
FROM (VALUES
  ('back-squat','force_tissue_capacity',5),
  ('box-jump','ssc_stiffness',4),('box-jump','neural_output_readiness',4),
  ('depth-jump','ssc_stiffness',5),
  ('nordic-hamstring-curl','force_tissue_capacity',5),
  ('plank-hold','control_stability',5),
  ('10-yard-sprint','neural_output_readiness',5),
  ('lateral-bound','ssc_stiffness',4),
  ('single-leg-rdl','control_stability',4),
  ('dead-bug','control_stability',4),
  ('worlds-greatest-stretch','force_tissue_capacity',2),
  ('kettlebell-swing','energy_systems_repeatability',3),
  ('pull-up','force_tissue_capacity',5),
  ('hollow-body-hold','control_stability',5),
  ('handstand-hold','control_stability',5),
  ('cartwheel','perception_action_skill',5),
  ('back-bridge','force_tissue_capacity',3),
  ('bar-cast','force_tissue_capacity',4),
  ('round-off','ssc_stiffness',4),('round-off','perception_action_skill',4),
  ('lache-swing','ssc_stiffness',4),
  ('precision-jump','control_stability',5)
) AS v(slug, physiology_key, weight)
JOIN coaching.exercise e ON e.slug = v.slug
JOIN coaching.physiological_emphasis p ON p.key = v.physiology_key
ON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;

-- MOVEMENT PATTERN tags
INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'pattern', mp.id, 4
FROM (VALUES
  ('back-squat','squat'),('box-jump','jump'),('depth-jump','land'),
  ('nordic-hamstring-curl','hinge'),('plank-hold','brace'),('10-yard-sprint','locomote'),
  ('lateral-bound','jump'),('single-leg-rdl','hinge'),('dead-bug','brace'),
  ('worlds-greatest-stretch','locomote'),('kettlebell-swing','hinge'),('pull-up','pull'),
  ('hollow-body-hold','brace'),('handstand-hold','invert'),('cartwheel','rotate'),
  ('back-bridge','invert'),('bar-cast','hang'),('round-off','rotate'),
  ('lache-swing','hang'),('precision-jump','land')
) AS v(slug, pattern_key)
JOIN coaching.exercise e ON e.slug = v.slug
JOIN coaching.movement_pattern mp ON mp.key = v.pattern_key
ON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;

-- EQUIPMENT tags
INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'equipment', eq.id, 3
FROM (VALUES
  ('back-squat','none'),('box-jump','box'),('depth-jump','box'),
  ('nordic-hamstring-curl','mat'),('plank-hold','none'),('10-yard-sprint','none'),
  ('lateral-bound','none'),('single-leg-rdl','dumbbell'),('dead-bug','mat'),
  ('worlds-greatest-stretch','none'),('kettlebell-swing','kettlebell'),('pull-up','bar'),
  ('hollow-body-hold','mat'),('handstand-hold','none'),('cartwheel','mat'),
  ('back-bridge','mat'),('bar-cast','bar'),('round-off','mat'),
  ('lache-swing','bar'),('precision-jump','none')
) AS v(slug, equipment_key)
JOIN coaching.exercise e ON e.slug = v.slug
JOIN coaching.equipment eq ON eq.key = v.equipment_key
ON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;

-- INTENT tags
INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'intent', i.id, 3
FROM (VALUES
  ('back-squat','main'),('box-jump','main'),('depth-jump','main'),
  ('nordic-hamstring-curl','accessory'),('plank-hold','main'),('10-yard-sprint','main'),
  ('lateral-bound','main'),('single-leg-rdl','accessory'),('dead-bug','activation'),
  ('worlds-greatest-stretch','warmup'),('kettlebell-swing','conditioning'),('pull-up','main'),
  ('hollow-body-hold','skill'),('handstand-hold','skill'),('cartwheel','skill'),
  ('back-bridge','skill'),('bar-cast','skill'),('round-off','skill'),
  ('lache-swing','skill'),('precision-jump','skill')
) AS v(slug, intent_key)
JOIN coaching.exercise e ON e.slug = v.slug
JOIN coaching.exercise_intent i ON i.key = v.intent_key
ON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;

-- 3) Progression graph example: round-off requires cartwheel
INSERT INTO coaching.exercise_prerequisite (exercise_id, prerequisite_exercise_id, note)
SELECT ro.id, cw.id, 'Master the cartwheel before progressing to a round-off.'
FROM coaching.exercise ro, coaching.exercise cw
WHERE ro.slug = 'round-off' AND cw.slug = 'cartwheel'
ON CONFLICT DO NOTHING;

-- 4) Sample coaching cues
INSERT INTO coaching.exercise_cue (exercise_id, cue_type, body, sort_order)
SELECT e.id, v.cue_type, v.body, v.sort_order
FROM (VALUES
  ('back-squat','cue','Brace the core and drive the knees out.',0),
  ('back-squat','fault','Knees collapsing inward.',1),
  ('box-jump','cue','Land softly with hips back, absorb the impact.',0),
  ('hollow-body-hold','cue','Press the lower back into the floor.',0),
  ('handstand-hold','cue','Stack shoulders over wrists, squeeze the midline.',0)
) AS v(slug, cue_type, body, sort_order)
JOIN coaching.exercise e ON e.slug = v.slug
ON CONFLICT DO NOTHING;
