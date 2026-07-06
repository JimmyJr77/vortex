-- Games & Competitions Library: migrate movement_game exercises + starter seed + facility backfill.
-- IDEMPOTENT.

-- ============================================================
-- 1) Migrate exercises with primary_order_slot = movement_game
-- ============================================================

INSERT INTO coaching.game (
  facility_id, name, slug, description, card_summary, coach_summary, athlete_summary,
  game_kind, game_type, group_structure, min_players, max_players, ideal_players,
  age_brackets, age_variations, space_requirements, equipment,
  duration_typical_min, duration_typical_max, intensity_level, contact_level,
  supervision_level, rules, safety, coaching_notes,
  best_session_phase, compatible_phases,
  source_exercise_id, migrated_from_exercise, is_published, visibility, archived
)
SELECT
  e.facility_id,
  e.name,
  e.slug,
  e.description,
  e.card_summary,
  e.coach_language,
  e.athlete_language,
  'game',
  CASE e.slug
    WHEN 'partner-shadow-tag' THEN 'tag_and_chase'
    ELSE 'reaction_and_decision'
  END,
  CASE COALESCE(e.participant_structure, 'pairs')
    WHEN 'individual' THEN 'individual'
    WHEN 'pairs' THEN 'pairs'
    ELSE 'small_group'
  END,
  CASE e.slug WHEN 'partner-shadow-tag' THEN 2 ELSE 2 END,
  CASE e.slug WHEN 'partner-shadow-tag' THEN 2 ELSE NULL END,
  CASE e.slug WHEN 'partner-shadow-tag' THEN '2 per pair' ELSE NULL END,
  ARRAY['preschool', 'elementary_young', 'elementary_older', 'middle_school', 'high_school', 'adult']::TEXT[],
  COALESCE((
    SELECT jsonb_object_agg(sp.cohort_key, jsonb_build_object('guidance', sp.load_guidance))
    FROM coaching.exercise_scaling_profile sp
    WHERE sp.exercise_id = e.id
  ), '{}'::jsonb),
  jsonb_build_object('indoor', TRUE, 'outdoor', TRUE, 'min_sq_ft', 100, 'surface', 'any'),
  COALESCE((
    SELECT ARRAY_AGG(DISTINCT eq.key ORDER BY eq.key)
    FROM coaching.exercise_tag t
    JOIN coaching.equipment eq ON eq.id = t.facet_id AND t.facet_type = 'equipment'
    WHERE t.exercise_id = e.id
  ), ARRAY['cones']::TEXT[]),
  8,
  15,
  'moderate',
  CASE e.slug WHEN 'partner-shadow-tag' THEN 'light' ELSE 'none' END,
  'required',
  COALESCE(e.coaching_execution, '{}'::jsonb),
  jsonb_build_object(
    'stop_signs', COALESCE(e.coaching_execution->'stop_signs', '[]'::jsonb),
    'contact_rules', CASE e.slug WHEN 'partner-shadow-tag' THEN '["Light touch tag only or no-contact shadow","No pushing, grabbing, or diving"]'::jsonb ELSE '[]'::jsonb END
  ),
  'Migrated from Exercise Library (movement_game). Keep rounds short; stop on whistle.',
  COALESCE(e.primary_phase_key, 'movement_intelligence'),
  ARRAY[COALESCE(e.primary_phase_key, 'movement_intelligence')]::TEXT[],
  e.id,
  TRUE,
  e.is_published,
  e.visibility,
  FALSE
FROM coaching.exercise e
WHERE e.primary_order_slot = 'movement_game'
  AND e.archived = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM coaching.game g
    WHERE g.facility_id = e.facility_id AND g.slug = e.slug
  );

INSERT INTO coaching.game_tag (game_id, facet_type, facet_id, weight)
SELECT g.id, t.facet_type, t.facet_id, t.weight
FROM coaching.game g
JOIN coaching.exercise e ON e.id = g.source_exercise_id
JOIN coaching.exercise_tag t ON t.exercise_id = e.id AND t.facet_type = 'tenet'
ON CONFLICT (game_id, facet_type, facet_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO coaching.game_exercise_link (game_id, exercise_id, role)
SELECT g.id, g.source_exercise_id, 'source_exercise'
FROM coaching.game g
WHERE g.source_exercise_id IS NOT NULL
  AND g.migrated_from_exercise = TRUE
ON CONFLICT (game_id, exercise_id) DO NOTHING;

UPDATE coaching.exercise e SET
  archived = TRUE,
  updated_at = now()
WHERE e.primary_order_slot = 'movement_game'
  AND e.archived = FALSE
  AND EXISTS (
    SELECT 1 FROM coaching.game g
    WHERE g.source_exercise_id = e.id AND g.migrated_from_exercise = TRUE
  );

-- ============================================================
-- 2) Starter seed games (canonical facility only, skip if slug exists)
-- ============================================================

WITH canonical AS (
  SELECT id AS facility_id FROM public.facility ORDER BY id LIMIT 1
)
INSERT INTO coaching.game (
  facility_id, name, slug, description, card_summary, coach_summary, athlete_summary,
  game_kind, game_type, group_structure, min_players, max_players, ideal_players,
  age_brackets, age_variations, space_requirements, equipment,
  duration_typical_min, duration_typical_max, intensity_level, contact_level,
  supervision_level, rules, safety, coaching_notes, best_session_phase, compatible_phases
)
SELECT
  c.facility_id,
  v.name, v.slug, v.description, v.card_summary, v.coach_summary, v.athlete_summary,
  v.game_kind, v.game_type, v.group_structure, v.min_players, v.max_players, v.ideal_players,
  v.age_brackets, v.age_variations::jsonb, v.space_requirements::jsonb, v.equipment,
  v.duration_typical_min, v.duration_typical_max, v.intensity_level, v.contact_level,
  v.supervision_level, v.rules::jsonb, v.safety::jsonb, v.coaching_notes,
  v.best_session_phase, v.compatible_phases
FROM canonical c
CROSS JOIN (VALUES
  (
    'Sharks and Minnows',
    'sharks-and-minnows',
    'One or two sharks try to tag minnows crossing a defined space. Tagged minnows become sharks.',
    'Classic tag game that builds speed, evasion, and reactive movement in a bounded space.',
    'Use for high-energy play with clear boundaries. Rotate sharks frequently.',
    'Cross the space without getting tagged. If tagged, you become a shark.',
    'game', 'tag_and_chase', 'large_group', 6, NULL, '8–20',
    ARRAY['preschool','elementary_young','elementary_older','middle_school','high_school']::TEXT[],
    '{"preschool":{"rules":"Walking only; 10s rounds"},"elementary_young":{"rules":"Light jog; short crossing lane"},"high_school":{"rules":"Full speed with decel zones"}}',
    '{"indoor":true,"outdoor":true,"min_sq_ft":400}',
    ARRAY['cones']::TEXT[],
    10, 20, 'high', 'light', 'required',
    '{"setup":["Mark two end lines or cone gates","Choose 1–2 sharks to start","All others are minnows behind the start line"],"execution_steps":["Coach signals go","Minnows cross to the opposite line","Sharks tag minnows with light touch","Tagged athletes join sharks","Reset when all cross or time expires"],"scoring":"Last minnow wins the round","win_condition":"Be the last untagged minnow or complete the most clean crossings"}',
    '{"stop_signs":["Collision","Unsafe contact","Athletes leave boundaries"],"contact_rules":["Light touch tag only","No pushing or grabbing"]}',
    'Keep rounds short. Preschool uses walking only.',
    'movement_intelligence',
    ARRAY['movement_intelligence','sustained_capacity']::TEXT[]
  ),
  (
    'Capture the Cone',
    'capture-the-cone',
    'Two teams protect a home cone while trying to touch the opponent cone inside boundaries.',
    'Territory game developing agility, body control, and team spacing decisions.',
    'Control space and protect your cone. No full-contact tackling.',
    'Protect your cone and try to touch theirs without getting tagged out.',
    'game', 'territory_and_zone', 'teams', 8, NULL, '10–16',
    ARRAY['elementary_older','middle_school','high_school','adult']::TEXT[],
    '{"elementary_older":{"rules":"Walking or light jog; larger safe zone"},"high_school":{"rules":"Full rules with jail/respawn zone"}}',
    '{"indoor":true,"outdoor":true,"min_sq_ft":600}',
    ARRAY['cones']::TEXT[],
    12, 25, 'moderate', 'light', 'required',
    '{"setup":["Two teams, two home cones","Define center neutral zone","Set jail/respawn rules"],"execution_steps":["Teams start at home cones","Athletes move to tag opponent cone or tag opponents","Tagged players go to jail or respawn line","Round ends on cone touch or time"],"scoring":"Point per cone touch","win_condition":"First team to touch opponent cone or most touches in time"}',
    '{"stop_signs":["Collision","Unsafe contact"],"contact_rules":["Two-hand tag or flag only"]}',
    'Match teams by size and speed when possible.',
    'movement_intelligence',
    ARRAY['movement_intelligence','sustained_capacity']::TEXT[]
  ),
  (
    'Color Gate Relay',
    'color-gate-relay',
    'Athletes react to a called color and sprint through the matching cone gate, then tag the next teammate.',
    'Relay that trains reaction, color recognition, and acceleration in a team format.',
    'Final bridge from perception drills to team play. Clear gates and decel space.',
    'Listen for your color, sprint through the right gate, tag your teammate.',
    'both', 'relay_and_race', 'teams', 6, NULL, '8–16',
    ARRAY['elementary_young','elementary_older','middle_school','high_school']::TEXT[],
    '{"elementary_young":{"rules":"Jog through gate; two colors only"},"high_school":{"rules":"Sprint; fake cues allowed"}}',
    '{"indoor":true,"outdoor":true,"min_sq_ft":300}',
    ARRAY['cones']::TEXT[],
    8, 15, 'moderate', 'none', 'recommended',
    '{"setup":["Set 2–4 colored cone gates","Line teams at start","Assign one color per athlete or rotate"],"execution_steps":["Coach calls a color","Active athlete finds correct gate","Athlete moves through gate and decelerates","Tags next teammate","Next athlete goes"],"scoring":"First team to finish all athletes wins heat","win_condition":"Fastest clean relay"}',
    '{"stop_signs":["Wrong gate at full speed","No deceleration space"],"contact_rules":[]}',
    'Require safe run-out past each gate.',
    'movement_intelligence',
    ARRAY['movement_intelligence','output']::TEXT[]
  ),
  (
    'Statue Challenge',
    'statue-challenge',
    'Athletes move on music or coach cue and freeze in a strong shape when the music stops.',
    'Balance and body-control game combining movement with static shape holds.',
    'Use for shape recall and balance under mild fatigue. Judge quality of freeze.',
    'Move when you hear go; freeze in a strong shape when you hear stop.',
    'game', 'balance_body_control', 'large_group', 4, NULL, '6–20',
    ARRAY['preschool','elementary_young','elementary_older','middle_school']::TEXT[],
    '{"preschool":{"rules":"Walk only; simple shapes (star, tuck)"},"elementary_older":{"rules":"Add single-leg or reach shapes"}}',
    '{"indoor":true,"outdoor":false,"min_sq_ft":200}',
    ARRAY['none']::TEXT[],
    5, 12, 'low', 'none', 'recommended',
    '{"setup":["Clear floor space","Define allowed shapes","Coach controls start/stop"],"execution_steps":["Athletes locomote in space","Coach stops music or calls freeze","Athletes hold assigned or chosen shape","Coach evaluates balance","Resume movement"],"scoring":"Last balanced statue or best shape quality","win_condition":"Hold shape 3+ seconds without falling"}',
    '{"stop_signs":["Fall or loss of balance","Collision"],"contact_rules":[]}',
    'Preschool: walking only with simple shapes.',
    'movement_intelligence',
    ARRAY['movement_intelligence','prepare_and_access']::TEXT[]
  ),
  (
    'Island Hoppers',
    'island-hoppers',
    'Teams cross from start to finish using limited floor spots (islands) without falling into the lava.',
    'Cooperative locomotion game building balance, coordination, and teamwork.',
    'Place islands closer for younger groups. No shoving between islands.',
    'Get your whole team across using only the islands.',
    'game', 'cooperative_team', 'teams', 6, NULL, '8–14',
    ARRAY['preschool','elementary_young','elementary_older','middle_school']::TEXT[],
    '{"preschool":{"rules":"Many large islands; hand-holding allowed"},"middle_school":{"rules":"Fewer islands; no hand-holding"}}',
    '{"indoor":true,"outdoor":true,"min_sq_ft":300}',
    ARRAY['cones','spots']::TEXT[],
    8, 15, 'low', 'light', 'required',
    '{"setup":["Scatter cones or spot markers as islands","Define lava floor between","Teams start on one side"],"execution_steps":["Team plans route across islands","Athletes step island to island","Anyone touching lava resets or waits","Whole team must reach finish"],"scoring":"All teammates across","win_condition":"First team with everyone across"}',
    '{"stop_signs":["Pushing between islands","Fall with injury risk"],"contact_rules":["No shoving; assist only if rule allows"]}',
    'More islands for younger athletes.',
    'movement_intelligence',
    ARRAY['movement_intelligence','prepare_and_access']::TEXT[]
  ),
  (
    'Tug of War',
    'tug-of-war',
    'Two teams pull opposite ends of a rope until one team crosses the center line.',
    'Strength and teamwork game with clear team boundaries and coach supervision.',
    'Match teams by total mass when possible. Stop at whistle immediately.',
    'Pull together as a team when the coach says go.',
    'competition', 'strength_power_play', 'teams', 8, NULL, '10–16',
    ARRAY['elementary_older','middle_school','high_school','adult']::TEXT[],
    '{"elementary_older":{"rules":"Kneeling or seated variant"},"adult":{"rules":"Standing full pull with mat behind line"}}',
    '{"indoor":true,"outdoor":true,"min_sq_ft":200}',
    ARRAY['rope']::TEXT[],
    5, 10, 'moderate', 'moderate', 'required',
    '{"setup":["Center line on floor","Teams on opposite ends of rope","Safe footing behind each team"],"execution_steps":["Teams grip rope on coach signal","Pull until one team crosses center","Coach stops immediately on whistle","Switch ends and repeat"],"scoring":"Best of 3 pulls","win_condition":"Pull opponent across center line"}',
    '{"stop_signs":["Rope burn","Loss of footing","Athlete wraps rope around hands"],"contact_rules":["Team pull only; no kicking"]}',
    'Never wrap rope around hands. Use kneeling variant for younger athletes.',
    'capacity',
    ARRAY['capacity','movement_intelligence']::TEXT[]
  ),
  (
    'Knockdown Relay',
    'knockdown-relay',
    'Relay teams sprint to knock over a target cone and sprint back to tag the next player.',
    'Speed and accuracy relay developing acceleration and controlled deceleration.',
    'Emphasize decel before the turn. One hand knockdown only.',
    'Sprint, knock down your cone, sprint back, tag your teammate.',
    'both', 'relay_and_race', 'teams', 6, NULL, '8–16',
    ARRAY['elementary_young','elementary_older','middle_school','high_school']::TEXT[],
    '{"elementary_young":{"rules":"Jog version; closer cones"}}',
    '{"indoor":true,"outdoor":true,"min_sq_ft":250}',
    ARRAY['cones']::TEXT[],
    8, 15, 'moderate', 'none', 'recommended',
    '{"setup":["One cone per athlete in relay line","Teams in single file","Knockdown zone 10–20 yd away"],"execution_steps":["First athlete sprints to cone","Knocks cone with hand","Returns and tags next athlete","Continue until all finish"],"scoring":"First team done wins","win_condition":"Fastest full relay"}',
    '{"stop_signs":["Slip on turn","Collision at tag"],"contact_rules":[]}',
    'Place cones farther only when decel is clean.',
    'output',
    ARRAY['output','movement_intelligence']::TEXT[]
  ),
  (
    'Shape Freeze Game',
    'shape-freeze-game',
    'On cue, athletes snap into gymnastics shapes (hollow, arch, tuck, straddle) and hold for a count.',
    'Flexibility and body-control game reinforcing shape literacy through play.',
    'Call shapes athletes have already trained. Short holds only.',
    'Freeze in the shape the coach calls and hold it strong.',
    'game', 'flexibility_shape', 'large_group', 4, NULL, '6–16',
    ARRAY['preschool','elementary_young','elementary_older','middle_school']::TEXT[],
    '{"preschool":{"rules":"Tuck and star only; 2-count hold"},"middle_school":{"rules":"Add hollow/arch; 3-count hold"}}',
    '{"indoor":true,"outdoor":false,"min_sq_ft":200}',
    ARRAY['none']::TEXT[],
    5, 10, 'low', 'none', 'recommended',
    '{"setup":["Athletes spread in space","Review allowed shapes","Coach calls shape on whistle"],"execution_steps":["Athletes move lightly in place","Coach calls shape name","Athletes demonstrate shape","Hold for count","Resume movement"],"scoring":"Coach picks best shape of round","win_condition":"Quality shape hold on cue"}',
    '{"stop_signs":["Neck discomfort in arch","Loss of balance"],"contact_rules":[]}',
    'Only call shapes athletes know from skill work.',
    'movement_intelligence',
    ARRAY['movement_intelligence','prepare_and_access']::TEXT[]
  )
) AS v(
  name, slug, description, card_summary, coach_summary, athlete_summary,
  game_kind, game_type, group_structure, min_players, max_players, ideal_players,
  age_brackets, age_variations, space_requirements, equipment,
  duration_typical_min, duration_typical_max, intensity_level, contact_level,
  supervision_level, rules, safety, coaching_notes, best_session_phase, compatible_phases
)
WHERE NOT EXISTS (
  SELECT 1 FROM coaching.game g
  WHERE g.facility_id = c.facility_id AND g.slug = v.slug
);

-- Tenet tags for starter games
INSERT INTO coaching.game_tag (game_id, facet_type, facet_id, weight)
SELECT g.id, 'tenet', t.id, v.weight
FROM (VALUES
  ('sharks-and-minnows', 'speed', 5),
  ('sharks-and-minnows', 'agility', 5),
  ('sharks-and-minnows', 'coordination', 4),
  ('capture-the-cone', 'agility', 5),
  ('capture-the-cone', 'body_control', 4),
  ('capture-the-cone', 'coordination', 4),
  ('color-gate-relay', 'speed', 4),
  ('color-gate-relay', 'agility', 4),
  ('color-gate-relay', 'coordination', 5),
  ('statue-challenge', 'balance', 5),
  ('statue-challenge', 'body_control', 5),
  ('statue-challenge', 'flexibility', 3),
  ('island-hoppers', 'balance', 4),
  ('island-hoppers', 'coordination', 5),
  ('island-hoppers', 'body_control', 4),
  ('tug-of-war', 'strength', 5),
  ('tug-of-war', 'coordination', 3),
  ('knockdown-relay', 'speed', 5),
  ('knockdown-relay', 'explosiveness', 4),
  ('knockdown-relay', 'agility', 3),
  ('shape-freeze-game', 'flexibility', 4),
  ('shape-freeze-game', 'body_control', 5),
  ('shape-freeze-game', 'balance', 3)
) AS v(slug, tenet_key, weight)
JOIN coaching.game g ON g.slug = v.slug
JOIN coaching.tenet t ON t.key = v.tenet_key
ON CONFLICT (game_id, facet_type, facet_id) DO UPDATE SET weight = EXCLUDED.weight;

-- ============================================================
-- 3) Multi-facility backfill
-- ============================================================

WITH canonical AS (
  SELECT id AS facility_id FROM public.facility ORDER BY id LIMIT 1
)
INSERT INTO coaching.game (
  facility_id, name, slug, description, card_summary, coach_summary, athlete_summary,
  game_kind, game_type, competition_format, group_structure, min_players, max_players, ideal_players,
  age_brackets, age_variations, space_requirements, equipment,
  duration_typical_min, duration_typical_max, intensity_level, contact_level,
  supervision_level, rules, safety, coaching_notes,
  best_session_phase, compatible_phases,
  migrated_from_exercise, is_published, visibility, archived
)
SELECT
  f.id,
  src.name, src.slug, src.description, src.card_summary, src.coach_summary, src.athlete_summary,
  src.game_kind, src.game_type, src.competition_format, src.group_structure, src.min_players, src.max_players, src.ideal_players,
  src.age_brackets, src.age_variations, src.space_requirements, src.equipment,
  src.duration_typical_min, src.duration_typical_max, src.intensity_level, src.contact_level,
  src.supervision_level, src.rules, src.safety, src.coaching_notes,
  src.best_session_phase, src.compatible_phases,
  src.migrated_from_exercise, src.is_published, src.visibility, FALSE
FROM coaching.game src
CROSS JOIN public.facility f
CROSS JOIN canonical c
WHERE src.facility_id = c.facility_id
  AND src.archived = FALSE
  AND f.id <> c.facility_id
  AND NOT EXISTS (
    SELECT 1 FROM coaching.game tgt
    WHERE tgt.facility_id = f.id AND tgt.slug = src.slug
  );

WITH canonical AS (
  SELECT id AS facility_id FROM public.facility ORDER BY id LIMIT 1
),
pairs AS (
  SELECT src.id AS src_id, tgt.id AS tgt_id
  FROM coaching.game src
  JOIN coaching.game tgt ON tgt.slug = src.slug AND tgt.facility_id <> src.facility_id
  JOIN canonical c ON src.facility_id = c.facility_id
  WHERE src.archived = FALSE
)
INSERT INTO coaching.game_tag (game_id, facet_type, facet_id, weight)
SELECT p.tgt_id, gt.facet_type, gt.facet_id, gt.weight
FROM pairs p
JOIN coaching.game_tag gt ON gt.game_id = p.src_id
ON CONFLICT (game_id, facet_type, facet_id) DO NOTHING;
