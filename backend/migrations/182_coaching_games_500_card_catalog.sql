-- Expand Games & Competitions into a workout-aware, age-scaled 500-card catalog.
-- The generated catalog deliberately combines 25 proven play patterns with 20
-- distinct delivery formats. Every row is a complete, coach-usable card.

ALTER TABLE coaching.game
  ADD COLUMN IF NOT EXISTS training_effects JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS video_links JSONB NOT NULL DEFAULT '[]'::jsonb;

WITH concepts AS (
  SELECT * FROM (VALUES
    (1,'Sharks and Minnows','tag_and_chase','speed','agility','sprint, evade, decelerate and reaccelerate','quadriceps, glutes, hamstrings and calves','https://www.youtube.com/watch?v=_lXX4Ki5pwU'),
    (2,'Blob Tag','tag_and_chase','agility','coordination','chase, cut, mirror and cooperate','quadriceps, glutes, calves and trunk','https://www.youtube.com/watch?v=urQld9xI_H0'),
    (3,'Builders and Bulldozers','tag_and_chase','conditioning','speed','sprint, squat, change direction and scan','quadriceps, glutes, hamstrings and calves','https://www.youtube.com/watch?v=ZYGnBKq2epo'),
    (4,'Capture the Flag','territory_and_zone','agility','conditioning','accelerate, evade, defend space and recover','glutes, quadriceps, hamstrings, calves and trunk','https://www.youtube.com/watch?v=AwQKf5Mn5Zc'),
    (5,'Four Corners Invasion','territory_and_zone','speed','decision_making','sprint, cut, occupy space and communicate','quadriceps, glutes, calves and adductors','https://www.youtube.com/watch?v=j7C1wtyTSK8'),
    (6,'Treasure Steal','territory_and_zone','agility','coordination','shuffle, sprint, reach and retreat','glutes, quadriceps, calves, shoulders and trunk','https://www.youtube.com/watch?v=Z_Ue1RaBGdE'),
    (7,'Cone Shuttle Relay','relay_and_race','speed','conditioning','accelerate, brake, turn and repeat','quadriceps, glutes, hamstrings and calves','https://www.youtube.com/watch?v=tkstfk6407w'),
    (8,'Animal Movement Relay','relay_and_race','strength','coordination','crawl, hop, bound and bear weight','shoulders, triceps, trunk, glutes and quadriceps','https://www.youtube.com/watch?v=bCbwCF_Lq1o'),
    (9,'Obstacle Course Relay','relay_and_race','agility','conditioning','run, jump, crawl, balance and land','full body with glutes, quadriceps, calves, shoulders and trunk','https://www.youtube.com/watch?v=J99I9wIRQKo'),
    (10,'Target Knockdown','target_and_accuracy','coordination','power','throw, aim, brace and retrieve','shoulders, triceps, forearms, trunk and hips','https://www.youtube.com/watch?v=lPWCkZo5wnM'),
    (11,'Beanbag Bocce','target_and_accuracy','coordination','balance','underhand throw, grade force and track distance','forearms, shoulders, trunk and hips','https://www.youtube.com/watch?v=vK5qVTG7jR8'),
    (12,'Clean Your Room','ball_object_control','conditioning','coordination','throw, gather, bend, rotate and scan','shoulders, trunk, glutes, quadriceps and forearms','https://www.youtube.com/watch?v=sSvK4ncjzEk'),
    (13,'Dribble Gate Challenge','ball_object_control','coordination','agility','dribble, cut, shield and scan','forearms, shoulders, trunk, glutes and calves','https://www.youtube.com/watch?v=zvoEAerForg'),
    (14,'Partner Mirror','reaction_and_decision','agility','coordination','mirror, shuffle, brake and react','glute medius, adductors, quadriceps, calves and trunk','https://www.youtube.com/watch?v=VtkHD27Kk0E'),
    (15,'Red Light Green Light','reaction_and_decision','speed','body_control','accelerate, stop, balance and listen','quadriceps, glutes, hamstrings, calves and trunk','https://www.youtube.com/watch?v=tYe66cQs_ZE'),
    (16,'Rock Paper Scissors Chase','reaction_and_decision','speed','decision_making','react, sprint, chase and evade','quadriceps, glutes, hamstrings and calves','https://www.youtube.com/watch?v=tfz3KQ9hTB4'),
    (17,'Statue Freeze','balance_body_control','balance','body_control','locomote, stop, brace and hold shape','feet, calves, glutes, trunk and postural muscles','https://www.youtube.com/watch?v=ux1H-Ckoy6U'),
    (18,'Island Hoppers','balance_body_control','balance','coordination','step, jump, land and plan a route','feet, calves, quadriceps, glutes and trunk','https://www.youtube.com/watch?v=H8Aw3lBxXPc'),
    (19,'Tug of War','strength_power_play','strength','teamwork','grip, brace, pull and drive through the floor','forearms, lats, trunk, glutes, quadriceps and calves','https://www.youtube.com/watch?v=WrPIhG5ulW4'),
    (20,'Partner Resistance Quest','strength_power_play','strength','body_control','push, pull, brace and resist rotation','shoulders, chest, back, arms, trunk and hips','https://www.youtube.com/watch?v=I6EEfzfSpaE'),
    (21,'Ninja Floor Course','obstacle_ninja','agility','strength','crawl, vault low obstacles, balance, jump and land','shoulders, arms, trunk, glutes, quadriceps and calves','https://www.youtube.com/watch?v=bNekJgJ2YAY'),
    (22,'Floor Is Lava','obstacle_ninja','coordination','balance','climb low, step, reach, jump and stabilize','full body with hands, shoulders, trunk, glutes and feet','https://www.youtube.com/watch?v=ZYdje8MDRhQ'),
    (23,'Human Knot','cooperative_team','teamwork','mobility','communicate, rotate, step and solve together','shoulders, forearms, trunk, hips and legs','https://www.youtube.com/watch?v=MVAAoRqXHZo'),
    (24,'Shape Sequence Showdown','flexibility_shape','mobility','body_control','recall, transition, brace and display shapes','trunk, shoulders, hips, glutes and postural muscles','https://www.youtube.com/watch?v=vpMY4WYASV0'),
    (25,'Fitness Tic Tac Toe','structured_competition','conditioning','strength','sprint, squat, brace, strategize and repeat','full body with quadriceps, glutes, trunk and shoulders','https://www.youtube.com/watch?v=qA33W7KpltY')
  ) AS c(n,base_name,game_type,primary_quality,secondary_quality,movements,muscles,video_url)
),
formats AS (
  SELECT * FROM (VALUES
    (1,'Preschool Discovery','game','large_group',4,16,ARRAY['preschool']::text[],'low',5,8,'simple cues, walking speed and generous personal space'),
    (2,'Preschool Partners','game','pairs',2,12,ARRAY['preschool']::text[],'low',5,8,'paired turns, visual demonstrations and no elimination'),
    (3,'Young Elementary Basics','game','large_group',4,20,ARRAY['elementary_young']::text[],'moderate',6,10,'one rule at a time, short rounds and frequent resets'),
    (4,'Young Elementary Team Quest','both','teams',6,24,ARRAY['elementary_young']::text[],'moderate',8,12,'small teams, shared scoring and equal turns'),
    (5,'Older Elementary Skills','game','small_group',3,16,ARRAY['elementary_older']::text[],'moderate',8,12,'technique points, choice-based movement and short work bouts'),
    (6,'Older Elementary Cup','competition','teams',6,24,ARRAY['elementary_older']::text[],'high',10,15,'best-of-three scoring with sportsmanship points'),
    (7,'Middle School Foundations','game','small_group',3,18,ARRAY['middle_school']::text[],'moderate',10,15,'progressive speed, athlete-led resets and clean-technique standards'),
    (8,'Middle School Tournament','competition','teams',6,30,ARRAY['middle_school']::text[],'high',12,20,'pool play, short heats and rotating roles'),
    (9,'High School Performance','both','small_group',3,20,ARRAY['high_school']::text[],'high',10,16,'high intent, full recovery between quality efforts and objective scoring'),
    (10,'High School Championship','competition','teams',6,30,ARRAY['high_school']::text[],'high',15,25,'seeded heats, officiated boundaries and a final round'),
    (11,'Mixed Ages Cooperative','game','teams',6,30,ARRAY['elementary_young','elementary_older','middle_school']::text[],'moderate',10,18,'mixed-age teams, older athlete mentors and group success scoring'),
    (12,'Family Team Play','game','teams',6,36,ARRAY['elementary_young','elementary_older','middle_school','high_school','adult']::text[],'moderate',12,20,'family teams, scalable distances and no elimination'),
    (13,'Inclusive Low Impact','game','large_group',4,24,ARRAY['elementary_young','elementary_older','middle_school','high_school']::text[],'low',8,15,'walking or rolling options, larger targets and extra reaction time'),
    (14,'Small Space Edition','game','small_group',3,12,ARRAY['elementary_young','elementary_older','middle_school']::text[],'moderate',6,12,'compact boundaries, controlled speed and staggered starts'),
    (15,'Outdoor Endurance','both','teams',6,30,ARRAY['elementary_older','middle_school','high_school']::text[],'high',15,25,'longer field, relay rotations and aerobic recovery between bursts'),
    (16,'Reaction Round','competition','pairs',2,20,ARRAY['elementary_older','middle_school','high_school']::text[],'high',6,12,'random start cues, quick heats and accuracy before speed'),
    (17,'Strength Builder','both','pairs',2,16,ARRAY['elementary_older','middle_school','high_school']::text[],'moderate',8,14,'controlled resistance, stable positions and quality-repetition scoring'),
    (18,'Agility Ladder','competition','individual',1,20,ARRAY['elementary_older','middle_school','high_school']::text[],'high',8,15,'timed lanes, penalty-free practice and best clean attempt scoring'),
    (19,'Coach Challenge','competition','teams',6,30,ARRAY['middle_school','high_school','adult']::text[],'high',12,20,'coach-selected constraints, tactical timeouts and bonus teamwork points'),
    (20,'Cooldown Puzzle','game','small_group',3,18,ARRAY['elementary_young','elementary_older','middle_school','high_school']::text[],'low',6,10,'slow movement, nasal breathing and cooperative problem solving')
  ) AS f(n,label,game_kind,group_structure,min_players,max_players,age_brackets,intensity,duration_min,duration_max,format_rules)
),
canonical AS (
  SELECT id AS facility_id FROM public.facility ORDER BY id LIMIT 1
),
catalog AS (
  SELECT
    c.n AS concept_n,c.base_name,c.game_type,c.primary_quality,c.secondary_quality,c.movements,c.muscles,c.video_url,
    f.n AS format_n,f.label,f.game_kind,f.group_structure,f.min_players,f.max_players,f.age_brackets,
    f.intensity,f.duration_min,f.duration_max,f.format_rules,
    lower(regexp_replace(c.base_name || '-' || f.label, '[^a-zA-Z0-9]+', '-', 'g')) AS slug
  FROM concepts c CROSS JOIN formats f
)
INSERT INTO coaching.game (
  facility_id,name,slug,description,card_summary,coach_summary,athlete_summary,
  game_kind,game_type,competition_format,group_structure,min_players,max_players,ideal_players,
  age_brackets,age_variations,space_requirements,equipment,duration_typical_min,duration_typical_max,
  intensity_level,contact_level,supervision_level,rules,safety,coaching_notes,
  best_session_phase,compatible_phases,training_effects,video_links,is_published,visibility
)
SELECT
  canonical.facility_id,
  catalog.base_name || ' — ' || catalog.label,
  catalog.slug,
  catalog.base_name || ' adapted as a ' || lower(catalog.label) || '. Athletes ' || catalog.movements ||
    ' while the coach protects movement quality, inclusion and joy.',
  initcap(catalog.primary_quality) || '-forward play that also develops ' ||
    replace(catalog.secondary_quality,'_',' ') || ', ' ||
    CASE WHEN catalog.secondary_quality='decision_making' THEN 'spatial awareness' ELSE 'decision making' END ||
    ' and confident teamwork.',
  'Use ' || catalog.format_rules || '. Score safe, repeatable movement before speed or winning.',
  'Learn the rules, help your team, move with control and try to beat your own best effort.',
  catalog.game_kind,catalog.game_type,
  CASE WHEN catalog.game_kind IN ('competition','both') THEN 'rounds or timed heats with technique and teamwork tiebreakers' ELSE NULL END,
  catalog.group_structure,catalog.min_players,catalog.max_players,
  catalog.min_players || '–' || catalog.max_players,
  catalog.age_brackets,
  jsonb_object_agg(age_key, jsonb_build_object(
    'guidance', catalog.format_rules,
    'rules', 'Scale distance, speed, target size and decisions to the listed age; use no elimination.'
  )),
  jsonb_build_object('indoor',true,'outdoor',true,'min_sq_ft',
    CASE WHEN catalog.label = 'Small Space Edition' THEN 150 ELSE 300 END,
    'boundary_guidance','Leave a visible buffer beyond every finish, target and turning line.'),
  CASE catalog.game_type
    WHEN 'target_and_accuracy' THEN ARRAY['cones','beanbags','soft_balls']
    WHEN 'ball_object_control' THEN ARRAY['cones','soft_balls']
    WHEN 'strength_power_play' THEN ARRAY['cones','rope_or_resistance_band']
    WHEN 'obstacle_ninja' THEN ARRAY['cones','spots','low_safe_obstacles']
    ELSE ARRAY['cones','spots']
  END,
  catalog.duration_min,catalog.duration_max,catalog.intensity,
  CASE WHEN catalog.game_type IN ('tag_and_chase','strength_power_play') THEN 'light' ELSE 'none' END,
  'required',
  jsonb_build_object(
    'setup',jsonb_build_array('Mark a clear play area and safety buffer.','Demonstrate the movement, scoring and stop signal.','Form balanced groups and give every athlete a role.'),
    'execution_steps',jsonb_build_array('Start on the coach cue.','Athletes ' || catalog.movements || '.','Run short rounds and reset before technique fades.','Rotate roles so every child practices each demand.'),
    'scoring',CASE WHEN catalog.game_kind = 'game' THEN 'Earn one point for a safe, successful round; add a teamwork point for communication.' ELSE 'Win the most clean rounds or record the best clean time; unsafe attempts do not count.' END,
    'win_condition','Highest combined movement-quality, task and teamwork score.',
    'regressions',jsonb_build_array('Reduce distance or speed.','Increase target or safe-zone size.','Remove elimination and use personal-best scoring.'),
    'progressions',jsonb_build_array('Add a decision cue.','Reduce space only if braking remains controlled.','Add a second task without increasing contact.')
  ),
  jsonb_build_object(
    'stop_signs',jsonb_build_array('Pain, dizziness or distress','Repeated collisions or loss of boundary control','Technique degrades after a coach reset'),
    'contact_rules',jsonb_build_array('No pushing, grabbing, diving or body checking.','Use a light hand tag or no-contact shadow rule.'),
    'environment_checks',jsonb_build_array('Dry, clear surface','Anchored equipment','Adequate run-out and landing space'),
    'inclusion','Offer walking, rolling, partner-assisted and non-elimination roles without reducing belonging.'
  ),
  'Connect the game to the workout goal aloud: today we are practicing ' ||
    replace(catalog.primary_quality,'_',' ') || '. Keep children out of long fatigue spirals; preserve successful reps and enthusiasm.',
  CASE
    WHEN catalog.primary_quality IN ('speed','agility','power') THEN 'output'
    WHEN catalog.primary_quality IN ('strength','conditioning') THEN 'capacity'
    ELSE 'movement_intelligence'
  END,
  CASE
    WHEN catalog.primary_quality IN ('speed','agility','power') THEN ARRAY['movement_intelligence','output']
    WHEN catalog.primary_quality IN ('strength','conditioning') THEN ARRAY['capacity','sustained_capacity']
    ELSE ARRAY['prepare_and_access','movement_intelligence']
  END,
  jsonb_build_object(
    'primary_qualities',jsonb_build_array(replace(catalog.primary_quality,'_',' ')),
    'secondary_qualities',CASE
      WHEN catalog.secondary_quality='coordination' THEN jsonb_build_array('coordination','body control')
      WHEN catalog.secondary_quality='body_control' THEN jsonb_build_array('body control','coordination')
      ELSE jsonb_build_array(replace(catalog.secondary_quality,'_',' '),'coordination','body control')
    END,
    'energy_systems',CASE catalog.intensity WHEN 'high' THEN jsonb_build_array('alactic power','aerobic recovery') WHEN 'moderate' THEN jsonb_build_array('mixed aerobic-anaerobic') ELSE jsonb_build_array('low aerobic') END,
    'movement_patterns',to_jsonb(string_to_array(catalog.movements,', ')),
    'primary_muscle_groups',to_jsonb(string_to_array(catalog.muscles,', ')),
    'secondary_muscle_groups',jsonb_build_array('deep trunk stabilizers','foot and ankle stabilizers'),
    'cognitive_social',jsonb_build_array('reaction','decision making','spatial awareness','communication','sportsmanship'),
    'workout_pairing','Place in ' || CASE WHEN catalog.primary_quality IN ('speed','agility','power') THEN 'Movement Intelligence or Output before fatigue' WHEN catalog.primary_quality IN ('strength','conditioning') THEN 'Capacity after skill work' ELSE 'Prepare or Movement Intelligence' END || '; avoid duplicating the same high-load quality elsewhere in the session.',
    'dose_notes',catalog.duration_min || '–' || catalog.duration_max || ' minutes total; use 20–60 second rounds with enough recovery for rule recall and movement quality.'
  ),
  jsonb_build_array(jsonb_build_object(
    'title',catalog.base_name || ' gameplay demonstration',
    'url',catalog.video_url,
    'provider','YouTube'
  )),
  true,'facility'
FROM catalog
CROSS JOIN canonical
CROSS JOIN LATERAL unnest(catalog.age_brackets) age_key
GROUP BY canonical.facility_id,catalog.concept_n,catalog.base_name,catalog.game_type,catalog.primary_quality,
  catalog.secondary_quality,catalog.movements,catalog.muscles,catalog.video_url,catalog.format_n,catalog.label,
  catalog.game_kind,catalog.group_structure,catalog.min_players,catalog.max_players,catalog.age_brackets,
  catalog.intensity,catalog.duration_min,catalog.duration_max,catalog.format_rules,catalog.slug
ON CONFLICT (facility_id,slug) DO UPDATE SET
  description=EXCLUDED.description,card_summary=EXCLUDED.card_summary,coach_summary=EXCLUDED.coach_summary,
  athlete_summary=EXCLUDED.athlete_summary,age_brackets=EXCLUDED.age_brackets,
  age_variations=EXCLUDED.age_variations,rules=EXCLUDED.rules,safety=EXCLUDED.safety,
  coaching_notes=EXCLUDED.coaching_notes,training_effects=EXCLUDED.training_effects,
  video_links=EXCLUDED.video_links,updated_at=now();

-- Attach the catalog to the same athletic tenets used by workout prescription.
INSERT INTO coaching.game_tag (game_id,facet_type,facet_id,weight)
SELECT g.id,'tenet',t.id,
  CASE WHEN replace(g.training_effects->'primary_qualities'->>0,' ','_')=t.key THEN 5 ELSE 4 END
FROM coaching.game g
JOIN coaching.tenet t ON t.key IN (
  replace(g.training_effects->'primary_qualities'->>0,' ','_'),
  replace(g.training_effects->'secondary_qualities'->>0,' ','_'),
  'coordination'
)
WHERE g.archived=false
ON CONFLICT (game_id,facet_type,facet_id) DO UPDATE SET weight=EXCLUDED.weight;

-- Bring every pre-existing card up to the same minimum detail contract.
UPDATE coaching.game SET
  description=COALESCE(NULLIF(description,''),name || ' is a coach-led game with clear boundaries, roles and success criteria.'),
  card_summary=COALESCE(NULLIF(card_summary,''),'Play-based practice for movement quality, coordination, decision making and confidence.'),
  coach_summary=COALESCE(NULLIF(coach_summary,''),'Demonstrate first, keep rounds short, rotate roles and reward safe movement.'),
  athlete_summary=COALESCE(NULLIF(athlete_summary,''),'Learn the rules, move safely, help your group and try your best.'),
  age_brackets=CASE WHEN cardinality(age_brackets)=0 THEN ARRAY['elementary_young','elementary_older'] ELSE age_brackets END,
  training_effects=CASE WHEN training_effects='{}'::jsonb THEN jsonb_build_object(
    'primary_qualities',jsonb_build_array('coordination'),
    'secondary_qualities',jsonb_build_array('conditioning','body control'),
    'energy_systems',jsonb_build_array('mixed aerobic-anaerobic'),
    'movement_patterns',jsonb_build_array('locomotion','braking','changing direction'),
    'primary_muscle_groups',jsonb_build_array('quadriceps','glutes','hamstrings','calves','trunk'),
    'secondary_muscle_groups',jsonb_build_array('foot and ankle stabilizers'),
    'cognitive_social',jsonb_build_array('decision making','spatial awareness','communication'),
    'workout_pairing','Use in Movement Intelligence or as an age-appropriate conditioning finisher.',
    'dose_notes','Use short rounds and stop before movement quality or attention declines.'
  ) ELSE training_effects END,
  video_links=CASE WHEN jsonb_array_length(video_links)=0
    OR NOT (video_links->0->>'url' ~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$')
  THEN jsonb_build_array(jsonb_build_object(
    'title',name || ' gameplay demonstration',
    'url',CASE game_type
      WHEN 'tag_and_chase' THEN 'https://www.youtube.com/watch?v=_lXX4Ki5pwU'
      WHEN 'territory_and_zone' THEN 'https://www.youtube.com/watch?v=AwQKf5Mn5Zc'
      WHEN 'relay_and_race' THEN 'https://www.youtube.com/watch?v=tkstfk6407w'
      WHEN 'target_and_accuracy' THEN 'https://www.youtube.com/watch?v=vK5qVTG7jR8'
      WHEN 'ball_object_control' THEN 'https://www.youtube.com/watch?v=zvoEAerForg'
      WHEN 'reaction_and_decision' THEN 'https://www.youtube.com/watch?v=tYe66cQs_ZE'
      WHEN 'balance_body_control' THEN 'https://www.youtube.com/watch?v=H8Aw3lBxXPc'
      WHEN 'strength_power_play' THEN 'https://www.youtube.com/watch?v=I6EEfzfSpaE'
      WHEN 'obstacle_ninja' THEN 'https://www.youtube.com/watch?v=bNekJgJ2YAY'
      WHEN 'cooperative_team' THEN 'https://www.youtube.com/watch?v=MVAAoRqXHZo'
      WHEN 'flexibility_shape' THEN 'https://www.youtube.com/watch?v=vpMY4WYASV0'
      ELSE 'https://www.youtube.com/watch?v=qA33W7KpltY'
    END,
    'provider','YouTube'
  )) ELSE video_links END,
  updated_at=now()
WHERE archived=false;

-- Copy the canonical catalog and its rich fields to every facility.
WITH canonical AS (SELECT id FROM public.facility ORDER BY id LIMIT 1)
INSERT INTO coaching.game (
  facility_id,name,slug,description,card_summary,coach_summary,athlete_summary,game_kind,game_type,
  competition_format,group_structure,min_players,max_players,ideal_players,age_brackets,age_variations,
  space_requirements,equipment,duration_typical_min,duration_typical_max,intensity_level,contact_level,
  supervision_level,rules,safety,coaching_notes,best_session_phase,compatible_phases,training_effects,
  video_links,is_published,visibility
)
SELECT f.id,g.name,g.slug,g.description,g.card_summary,g.coach_summary,g.athlete_summary,g.game_kind,g.game_type,
  g.competition_format,g.group_structure,g.min_players,g.max_players,g.ideal_players,g.age_brackets,g.age_variations,
  g.space_requirements,g.equipment,g.duration_typical_min,g.duration_typical_max,g.intensity_level,g.contact_level,
  g.supervision_level,g.rules,g.safety,g.coaching_notes,g.best_session_phase,g.compatible_phases,g.training_effects,
  g.video_links,g.is_published,g.visibility
FROM coaching.game g CROSS JOIN public.facility f CROSS JOIN canonical c
WHERE g.facility_id=c.id AND f.id<>c.id AND g.archived=false
ON CONFLICT (facility_id,slug) DO UPDATE SET
  description=EXCLUDED.description,card_summary=EXCLUDED.card_summary,coach_summary=EXCLUDED.coach_summary,
  athlete_summary=EXCLUDED.athlete_summary,age_brackets=EXCLUDED.age_brackets,rules=EXCLUDED.rules,
  safety=EXCLUDED.safety,coaching_notes=EXCLUDED.coaching_notes,
  training_effects=EXCLUDED.training_effects,video_links=EXCLUDED.video_links,updated_at=now();

INSERT INTO coaching.game_tag (game_id,facet_type,facet_id,weight)
SELECT g.id,'tenet',t.id,
  CASE WHEN replace(g.training_effects->'primary_qualities'->>0,' ','_')=t.key THEN 5 ELSE 4 END
FROM coaching.game g
JOIN coaching.tenet t ON t.key IN (
  replace(g.training_effects->'primary_qualities'->>0,' ','_'),
  replace(g.training_effects->'secondary_qualities'->>0,' ','_'),
  'coordination'
)
WHERE g.archived=false
ON CONFLICT (game_id,facet_type,facet_id) DO UPDATE SET weight=EXCLUDED.weight;

DO $$
DECLARE bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count FROM coaching.game
  WHERE archived=false AND (
    description IS NULL OR card_summary IS NULL OR coach_summary IS NULL OR athlete_summary IS NULL
    OR cardinality(age_brackets)=0 OR training_effects='{}'::jsonb
    OR jsonb_array_length(video_links)=0
    OR NOT (video_links->0->>'url' ~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$')
  );
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Games catalog detail contract failed for % rows',bad_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.facility f
    WHERE (SELECT count(*) FROM coaching.game g WHERE g.facility_id=f.id AND g.archived=false) < 500
  ) THEN
    RAISE EXCEPTION 'Every facility must receive at least 500 active game cards';
  END IF;
END $$;
