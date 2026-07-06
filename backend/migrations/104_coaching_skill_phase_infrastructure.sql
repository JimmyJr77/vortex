-- Skill / Movement Intelligence phase infrastructure: subroles, fine order slots, validation education.
-- IDEMPOTENT.

-- Extend exercise.phase_subrole CHECK for Skill subroles.
ALTER TABLE coaching.exercise DROP CONSTRAINT IF EXISTS exercise_phase_subrole_check;
ALTER TABLE coaching.exercise ADD CONSTRAINT exercise_phase_subrole_check
  CHECK (phase_subrole IS NULL OR phase_subrole IN (
    'raise', 'mobilize', 'activate', 'integrate', 'potentiate_bridge',
    'shape_position_intelligence',
    'rotation_inversion_tumbling_foundations',
    'locomotion_sprint_mechanics',
    'balance_coordination_rhythm',
    'perception_action_reactive_movement'
  ));

-- Skill phase subroles.
INSERT INTO coaching.phase_subrole (
  phase_id, key, name, description, order_index,
  why_it_exists, what_belongs_here, what_to_avoid, fatigue_guidance, coach_guidance
)
SELECT
  sp.id,
  v.key,
  v.name,
  v.description,
  v.order_index,
  v.why_it_exists,
  v.what_belongs_here,
  v.what_to_avoid,
  v.fatigue_guidance,
  v.coach_guidance
FROM coaching.session_phase sp
CROSS JOIN (VALUES
  ('shape_position_intelligence', 'Shape & Position Intelligence', 'Body lines, shapes, posture, and trunk control before dynamic skill.', 210,
   'Teaches athletes to own body lines, shapes, posture, trunk control, and position awareness before more complex movement.',
   'Hollow, arch, tuck, pike, straddle, support shapes, wall line drills, shape recall games.',
   'Long isometric burnouts, weighted holds, max-effort strength work.',
   'Low neural and metabolic cost. Athletes should feel sharper shapes, not tired trunks.',
   'If the athlete cannot hold a clean static shape, do not rush the dynamic skill that depends on it.'),
  ('rotation_inversion_tumbling_foundations', 'Rotation / Inversion / Tumbling Foundations', 'Rolling, inversion, hand support, and tumbling prerequisites.', 220,
   'Builds rolling, inversion, hand-support, spatial orientation, and tumbling prerequisites while the athlete is fresh.',
   'Log rolls, forward/backward rolls, shoulder rolls, donkey kicks, wall walks, cartwheel progressions, hurdle entries.',
   'High-volume tumbling fatigue, advanced skills without prerequisites, unsupervised high-risk inversion.',
   'Fresh coordination and spatial awareness. Stop before wrist or trunk fatigue.',
   'Require mats, spotting, and prerequisite shapes before progressing.'),
  ('locomotion_sprint_mechanics', 'Locomotion & Sprint Mechanics', 'Posture, rhythm, foot strike, and acceleration shapes.', 230,
   'Teaches posture, limb timing, rhythm, foot strike, arm action, and acceleration shapes before speed output.',
   'Wall drills, A-march technical, A-skip rhythm, ankling, bound prep, falling start, arm action.',
   'Max-speed sprinting, fatiguing sprint intervals, conditioning disguised as mechanics.',
   'Technical and low fatigue. Quality of posture beats speed of reps.',
   'Move to Output when intent shifts to stiffness, speed, and max neural expression.'),
  ('balance_coordination_rhythm', 'Balance / Coordination / Rhythm', 'Timing, foot placement, balance, and movement sequencing.', 240,
   'Develops timing, rhythm, foot placement, balance, and cross-body coordination in low-fatigue contexts.',
   'Line walks, balance reaches, cross-crawl, skipping, carioca, shuffle/backpedal mechanics, ladder rhythm, hurdle step-overs.',
   'Nonstop ladder circuits, fatiguing footwork conditioning, sloppy contacts at speed.',
   'Crisp rhythm with full recovery. Coordination quality over rep count.',
   'If rest is short and heart rate rises, this is Fitness / Repeatability, not Skill.'),
  ('perception_action_reactive_movement', 'Perception-Action / Reactive Movement', 'Decision-making coupled with movement execution.', 250,
   'Teaches athletes to perceive cues, make decisions, and execute movement in response to changing information.',
   'Mirror drills, point-and-go, color call-outs, ball drops, tag games, gate reactions.',
   'Pre-planned cone running with no decision cue, conditioning agility circuits.',
   'Fresh reaction quality. Cognitive load is part of the drill — not exhaustion.',
   'Add visual, auditory, partner, ball, or environmental cues for true reactive agility.')
) AS v(key, name, description, order_index, why_it_exists, what_belongs_here, what_to_avoid, fatigue_guidance, coach_guidance)
WHERE sp.key = 'skill_movement_intelligence'
ON CONFLICT (phase_id, key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  order_index = EXCLUDED.order_index,
  why_it_exists = EXCLUDED.why_it_exists,
  what_belongs_here = EXCLUDED.what_belongs_here,
  what_to_avoid = EXCLUDED.what_to_avoid,
  fatigue_guidance = EXCLUDED.fatigue_guidance,
  coach_guidance = EXCLUDED.coach_guidance,
  updated_at = now();

-- Backfill subrole_key on legacy coarse skill slots (078).
UPDATE coaching.phase_order_slot pos SET
  subrole_key = v.subrole_key
FROM coaching.session_phase sp,
(VALUES
  ('technical_skill', 'shape_position_intelligence'),
  ('tumbling', 'rotation_inversion_tumbling_foundations'),
  ('sprint_mechanics', 'locomotion_sprint_mechanics'),
  ('reaction_coordination', 'perception_action_reactive_movement')
) AS v(slot_key, subrole_key)
WHERE sp.key = 'skill_movement_intelligence'
  AND pos.phase_id = sp.id
  AND pos.key = v.slot_key;

-- Fine-grained Skill order slots (211–259 bands).
INSERT INTO coaching.phase_order_slot (key, name, description, phase_id, order_index, freshness_sensitivity, subrole_key)
SELECT v.key, v.name, v.description, sp.id, v.order_index, v.freshness_sensitivity, v.subrole_key
FROM coaching.session_phase sp
CROSS JOIN (VALUES
  ('hollow_shape', 'Hollow Shape', 'Hollow body hold and hollow rock prep.', 211, 4, 'shape_position_intelligence'),
  ('arch_shape', 'Arch Shape', 'Arch/superman shape and extension awareness.', 212, 4, 'shape_position_intelligence'),
  ('shape_transition', 'Shape Transition', 'Hollow-to-arch rolling and shape contrast.', 213, 4, 'shape_position_intelligence'),
  ('tuck_shape', 'Tuck Shape', 'Tuck hold and tuck rock compression shapes.', 214, 4, 'shape_position_intelligence'),
  ('pike_shape', 'Pike Shape', 'Pike fold and tall-sit compression drills.', 215, 4, 'shape_position_intelligence'),
  ('straddle_shape', 'Straddle Shape', 'Straddle sit reach and lift shapes.', 216, 4, 'shape_position_intelligence'),
  ('support_shape', 'Support Shape', 'Front and rear support shape holds.', 217, 4, 'shape_position_intelligence'),
  ('line_drill', 'Line Drill', 'Wall body-line and posture line drills.', 218, 4, 'shape_position_intelligence'),
  ('shape_reaction', 'Shape Reaction', 'Shape recall and freeze games under cue.', 219, 4, 'shape_position_intelligence'),
  ('rolling_foundation', 'Rolling Foundation', 'Log rolls, egg rolls, and axis awareness.', 221, 5, 'rotation_inversion_tumbling_foundations'),
  ('roll_to_stand', 'Roll to Stand', 'Rock-and-roll to stand transitions.', 222, 5, 'rotation_inversion_tumbling_foundations'),
  ('forward_roll', 'Forward Roll', 'Forward roll progressions.', 223, 5, 'rotation_inversion_tumbling_foundations'),
  ('backward_roll', 'Backward Roll', 'Backward roll rocker and progressions.', 224, 5, 'rotation_inversion_tumbling_foundations'),
  ('shoulder_roll', 'Shoulder Roll', 'Shoulder/safety roll progressions.', 225, 5, 'rotation_inversion_tumbling_foundations'),
  ('hand_support_inversion', 'Hand Support Inversion', 'Donkey kick and hand-support inversion prep.', 226, 5, 'rotation_inversion_tumbling_foundations'),
  ('handstand_line', 'Handstand Line', 'Wall walk-up and handstand line drills.', 227, 5, 'rotation_inversion_tumbling_foundations'),
  ('handstand_entry', 'Handstand Entry', 'Kick-up to wall or spot entries.', 228, 5, 'rotation_inversion_tumbling_foundations'),
  ('cartwheel_foundation', 'Cartwheel Foundation', 'Cartwheel hand placement and step-over progressions.', 229, 5, 'rotation_inversion_tumbling_foundations'),
  ('cartwheel_finish', 'Cartwheel Finish', 'Cartwheel finish lunge and directional control.', 230, 5, 'rotation_inversion_tumbling_foundations'),
  ('roundoff_foundation', 'Round-Off Foundation', 'Round-off snap-down shape drills.', 231, 5, 'rotation_inversion_tumbling_foundations'),
  ('hurdle_entry', 'Hurdle Entry', 'Hurdle step to lunge tumbling entries.', 232, 5, 'rotation_inversion_tumbling_foundations'),
  ('sprint_iso', 'Sprint ISO', 'Wall drill split shin-angle holds.', 233, 4, 'locomotion_sprint_mechanics'),
  ('technical_march', 'Technical March', 'A-march technical sprint-mechanics version.', 234, 4, 'locomotion_sprint_mechanics'),
  ('sprint_rhythm', 'Sprint Rhythm', 'A-skip and rhythmic sprint prep.', 235, 4, 'locomotion_sprint_mechanics'),
  ('foot_strike_skill', 'Foot Strike Skill', 'Ankling and dribble march foot strike drills.', 236, 4, 'locomotion_sprint_mechanics'),
  ('frontside_mechanics', 'Frontside Mechanics', 'Straight-leg bound and frontside rhythm prep.', 237, 4, 'locomotion_sprint_mechanics'),
  ('acceleration_position', 'Acceleration Position', 'Falling start and acceleration posture holds.', 238, 4, 'locomotion_sprint_mechanics'),
  ('acceleration_entry', 'Acceleration Entry', 'Two-point start walk-in entries.', 239, 4, 'locomotion_sprint_mechanics'),
  ('arm_action', 'Arm Action', 'Seated or standing arm action drills.', 240, 4, 'locomotion_sprint_mechanics'),
  ('narrow_base_balance', 'Narrow Base Balance', 'Beam/line walk balance drills.', 241, 4, 'balance_coordination_rhythm'),
  ('single_leg_balance_skill', 'Single-Leg Balance Skill', 'Single-leg reach clock balance.', 242, 4, 'balance_coordination_rhythm'),
  ('cross_body_coordination', 'Cross-Body Coordination', 'Cross-crawl and contralateral rhythm.', 243, 4, 'balance_coordination_rhythm'),
  ('rhythm_locomotion', 'Rhythm Locomotion', 'Skipping and elastic rhythm drills.', 244, 4, 'balance_coordination_rhythm'),
  ('transverse_coordination', 'Transverse Coordination', 'Carioca and grapevine walkthroughs.', 245, 4, 'balance_coordination_rhythm'),
  ('lateral_movement_skill', 'Lateral Movement Skill', 'Lateral shuffle mechanics walkthrough.', 246, 4, 'balance_coordination_rhythm'),
  ('backward_locomotion', 'Backward Locomotion', 'Backpedal mechanics walkthrough.', 247, 4, 'balance_coordination_rhythm'),
  ('footwork_rhythm', 'Footwork Rhythm', 'Ladder rhythm patterns at skill dose.', 248, 4, 'balance_coordination_rhythm'),
  ('step_over_coordination', 'Step-Over Coordination', 'Low hurdle step-over series.', 249, 4, 'balance_coordination_rhythm'),
  ('mirror_reaction', 'Mirror Reaction', 'Partner mirror shuffle reactions.', 251, 4, 'perception_action_reactive_movement'),
  ('visual_reaction', 'Visual Reaction', 'Coach point-and-go visual reactions.', 252, 4, 'perception_action_reactive_movement'),
  ('visual_decision', 'Visual Decision', 'Colored cone call-out decisions.', 253, 4, 'perception_action_reactive_movement'),
  ('object_reaction', 'Object Reaction', 'Ball drop and object-tracking reactions.', 254, 4, 'perception_action_reactive_movement'),
  ('movement_game', 'Movement Game', 'Partner tag and shadow tag games.', 255, 4, 'perception_action_reactive_movement'),
  ('reactive_start', 'Reactive Start', 'Gate reaction and start-decision drills.', 256, 4, 'perception_action_reactive_movement')
) AS v(key, name, description, order_index, freshness_sensitivity, subrole_key)
WHERE sp.key = 'skill_movement_intelligence'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  phase_id = EXCLUDED.phase_id,
  order_index = EXCLUDED.order_index,
  freshness_sensitivity = EXCLUDED.freshness_sensitivity,
  subrole_key = EXCLUDED.subrole_key;

-- Re-sequence legacy sprint_mechanics coarse slot after fine locomotion band.
UPDATE coaching.phase_order_slot pos SET order_index = 234, subrole_key = 'locomotion_sprint_mechanics'
FROM coaching.session_phase sp
WHERE sp.key = 'skill_movement_intelligence' AND pos.phase_id = sp.id AND pos.key = 'sprint_mechanics';

-- Subrole education rows.
INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary, what_it_is, why_it_matters, programming_guidance, common_misuse
)
SELECT
  'phase_subrole', ps.key, ps.id, ps.name, ps.description,
  ps.what_belongs_here, ps.why_it_exists, ps.coach_guidance, ps.what_to_avoid
FROM coaching.phase_subrole ps
JOIN coaching.session_phase sp ON sp.id = ps.phase_id AND sp.key = 'skill_movement_intelligence'
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is,
  why_it_matters = EXCLUDED.why_it_matters,
  programming_guidance = EXCLUDED.programming_guidance,
  common_misuse = EXCLUDED.common_misuse,
  updated_at = now();

-- Skill phase validation education.
INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary, what_it_is, why_it_matters,
  programming_guidance, common_misuse
)
VALUES (
  'validation_rule',
  'skill_movement_intelligence_readiness',
  NULL,
  'Skill / Movement Intelligence without fatigue',
  'Skill training teaches coordination and decision-making while fresh — not conditioning or max output.',
  'Skill / Movement Intelligence is where athletes learn to organize movement, process information, coordinate timing, and solve movement problems before fatigue degrades learning quality.',
  'Learning quality, reaction quality, posture, timing, and technical precision all degrade under fatigue. This phase should usually precede heavy strength, hard plyometrics, HIIT, and fatigue-based work.',
  'Keep block RPE ≤6, place technical tumbling before Fitness, use crisp ladder rhythm with rest, add perception cues to agility drills, and move max-speed sprint work to Output.',
  'Do not let skill blocks become HIIT, max sprinting, high-volume tumbling fatigue, ladder conditioning circuits, or core burnouts.'
)
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is,
  why_it_matters = EXCLUDED.why_it_matters,
  programming_guidance = EXCLUDED.programming_guidance,
  common_misuse = EXCLUDED.common_misuse,
  updated_at = now();
