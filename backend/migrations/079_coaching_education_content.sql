-- Centralized coach education / "Why Layer" content.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.education_content (
  id                       BIGSERIAL PRIMARY KEY,
  entity_type              TEXT NOT NULL CHECK (entity_type IN (
    'session_phase', 'phase_order_slot', 'tenet', 'methodology', 'physiology',
    'exercise', 'exercise_phase_profile', 'workout_block', 'validation_rule',
    'regimen_rule', 'template'
  )),
  entity_key               TEXT NOT NULL DEFAULT '',
  entity_id                BIGINT,
  title                    TEXT,
  short_summary            TEXT,
  what_it_is               TEXT,
  why_it_matters           TEXT,
  why_it_goes_here         TEXT,
  why_this_order           TEXT,
  fatigue_logic            TEXT,
  programming_guidance     TEXT,
  common_misuse            TEXT,
  scaling_guidance         TEXT,
  age_skill_considerations TEXT,
  safety_considerations    TEXT,
  daily_or_weekly_guidance TEXT,
  coach_cues               TEXT,
  examples_json            JSONB NOT NULL DEFAULT '[]',
  related_entities_json    JSONB NOT NULL DEFAULT '[]',
  display_context          TEXT,
  sort_order               INTEGER NOT NULL DEFAULT 0,
  is_published             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_key, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_coaching_education_entity ON coaching.education_content(entity_type, entity_key);

-- Session phase education (condensed from Athleticism Accelerator spec)
INSERT INTO coaching.education_content (entity_type, entity_key, entity_id, title, short_summary, what_it_is, why_it_matters, why_it_goes_here, why_this_order, fatigue_logic, programming_guidance, common_misuse, daily_or_weekly_guidance) VALUES
  ('session_phase', 'prepare_access', NULL, 'Prepare / Access',
   'Warm-up and joint access without creating fatigue.',
   'Prepare / Access is the warm-up, joint access, mobility, activation, and tissue preparation phase.',
   'Athletes need access to the positions they will use later. Without ankle, hip, shoulder, spine, or wrist access, skill, speed, plyometrics, strength, and tumbling quality suffer.',
   'This phase raises readiness without creating meaningful fatigue. It prepares the body for higher-intent work.',
   'Access comes first because the athlete must be warm, mobile, and activated before skill or output work.',
   'This phase should create readiness, not exhaustion. Athletes should leave warmer, looser, sharper—not tired.',
   'Use dynamic mobility, activation, landing prep, and low-level balance. Avoid HIIT, heavy strength, or high-intensity plyometrics here.',
   'Long passive stretching before output, fatiguing core circuits, or conditioning in the warm-up.',
   'Can happen every session; many elements can be daily.'),
  ('session_phase', 'skill_movement_intelligence', NULL, 'Skill / Movement Intelligence',
   'Coordination, tumbling, reaction, and body control while fresh.',
   'Skill / Movement Intelligence trains coordination, reaction, orientation, balance, and body control in space—including tumbling and sprint mechanics.',
   'Athleticism is not just force. Athletes need timing, rhythm, body awareness, and technical control.',
   'Skill learning requires a fresh brain and nervous system. Fatigue lowers attention, timing, and safety.',
   'Comes after preparation but before output and capacity because technical learning is fatigue-sensitive.',
   'Low-intensity skill can be frequent; high-complexity skill should not follow fatiguing work.',
   'Place tumbling, coordination, sprint mechanics, and technical holds here. Keep reps technical, not exhaustive.',
   'HIIT-style skill drills, fatiguing tumbling after strength, or advanced skill buried after conditioning.',
   'Low-intensity skill can be near-daily; advanced skill needs recovery and oversight.'),
  ('session_phase', 'output', NULL, 'Output',
   'Speed, explosiveness, plyometrics, and high-intent power while fresh.',
   'Output is the high-intent performance phase: speed, explosiveness, plyometrics, elastic stiffness, reactivity, and agility.',
   'Athletes need to express force quickly—the gas pedal of athletic development.',
   'Output should happen after preparation and coordination, but before heavy or fatiguing work.',
   'High-speed and high-power drills are extremely fatigue-sensitive; tired reps train conditioning, not power.',
   'Keep reps crisp with full recovery. Place after elastic/landing prep, before strength and conditioning.',
   'Conditioning circuits, fatigue-based jump workouts, or plyometrics after HIIT or heavy eccentrics.',
   'Low-level elastic prep may appear often; hard output should not be daily for most athletes.'),
  ('session_phase', 'capacity', NULL, 'Capacity',
   'Strength and force development.',
   'Capacity is the strength and force-development phase—building the ability to produce and tolerate force.',
   'Speed and skill need a foundation. Athletes need muscle, tendon, and joint capacity to express power safely.',
   'Strength tolerates more fatigue than speed or skill; it usually follows high-quality output work.',
   'Follows output because heavy strength before output can reduce speed, jump quality, and elastic stiffness.',
   'Use squats, hinges, pushes, pulls, carries, and loaded calisthenics. Scale load and volume by age and skill.',
   'Max sprinting, main plyometric exposure, or advanced skill learning in this block.',
   'Heavy capacity is not daily; technical strength may appear more often.'),
  ('session_phase', 'control_resilience', NULL, 'Control / Resilience',
   'Brakes, stabilizers, eccentrics, and tissue tolerance.',
   'Control / Resilience trains isometrics, eccentrics, core, balance, stability, and joint integrity.',
   'Athletes need to control, absorb, stabilize, and recover positions—not just produce force.',
   'Hard isometrics and eccentrics can be locally fatiguing; they belong after main strength and output.',
   'Follows capacity because control work can impair speed and tumbling if placed too early.',
   'Use split-squat holds, eccentrics, dead bugs, balance reaches, landing sticks, and tissue work.',
   'Max speed, max plyometrics, or advanced tumbling after fatiguing control work in the wrong order.',
   'Low-level control can be frequent; hard eccentrics need more recovery.'),
  ('session_phase', 'fitness_repeatability', NULL, 'Fitness / Repeatability',
   'HIIT, conditioning, and repeatability under fatigue.',
   'Fitness / Repeatability trains the ability to repeat efforts, tolerate fatigue, and sustain work.',
   'Athletes need repeatability—a powerful athlete who cannot recover between efforts will fade.',
   'Fitness work creates fatigue on purpose; it belongs after sensitive qualities are trained.',
   'Comes late because conditioning harms skill, speed, power, and technical learning if placed early.',
   'Use HIIT, circuits, intervals, and tempo work intentionally late in the session.',
   'HIIT before skill, speed, plyometrics, or advanced tumbling.',
   'Hard HIIT is not daily; low-intensity aerobic work can be more frequent.'),
  ('session_phase', 'restore', NULL, 'Restore',
   'Cooldown, breathing, and post-workout flexibility.',
   'Restore is the cooldown, breath reset, recovery education, and flexibility phase.',
   'Training should downshift the athlete and reinforce recovery habits.',
   'Long static flexibility and downregulation belong after high-output work.',
   'Goes last because passive flexibility before speed or power can reduce readiness.',
   'Reduce intensity; do not add stress. Assign flexibility homework when appropriate.',
   'HIIT, new skill learning, max strength, or competitive burnout finishers in restore.',
   'Restore habits can happen every session.')
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is,
  why_it_matters = EXCLUDED.why_it_matters,
  why_it_goes_here = EXCLUDED.why_it_goes_here,
  why_this_order = EXCLUDED.why_this_order,
  fatigue_logic = EXCLUDED.fatigue_logic,
  programming_guidance = EXCLUDED.programming_guidance,
  common_misuse = EXCLUDED.common_misuse,
  daily_or_weekly_guidance = EXCLUDED.daily_or_weekly_guidance,
  updated_at = now();

-- Tenet education summaries
INSERT INTO coaching.education_content (entity_type, entity_key, entity_id, title, programming_guidance, why_it_matters) VALUES
  ('tenet', 'strength', NULL, 'Strength', 'Train mostly in Capacity. Do not place heavy strength before highest-quality speed/power unless strength is the day priority.', 'Ability to produce force and tolerate load; supports speed, jumping, landing, and resilience.'),
  ('tenet', 'explosiveness', NULL, 'Explosiveness', 'Train in Output while fresh. Use jumps, throws, bounds—low volume, high intent. Do not turn into conditioning.', 'Ability to express force quickly.'),
  ('tenet', 'speed', NULL, 'Speed', 'Train early with full recovery. Fatigue turns speed work into conditioning.', 'Rapid movement with coordination and efficient mechanics.'),
  ('tenet', 'agility', NULL, 'Agility', 'Train technical agility before fatigue; conditioning shuttles belong late.', 'Decelerate, redirect, react, and solve movement problems.'),
  ('tenet', 'flexibility', NULL, 'Flexibility/Mobility', 'Dynamic mobility early; longer flexibility after training or separately.', 'Access and use necessary ranges of motion.'),
  ('tenet', 'balance', NULL, 'Balance', 'Low-level balance can prepare; hard balance belongs later if fatiguing.', 'Manage posture, base of support, and center of mass.'),
  ('tenet', 'coordination', NULL, 'Coordination', 'Train early or in low-fatigue contexts with rhythm and tumbling drills.', 'Organize multiple body parts with timing and precision.'),
  ('tenet', 'body_control', NULL, 'Body Control', 'Technical body control in Skill; fatiguing control in Control/Resilience.', 'Own shapes, positions, transitions, and spatial orientation.')
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  programming_guidance = EXCLUDED.programming_guidance,
  why_it_matters = EXCLUDED.why_it_matters,
  updated_at = now();

-- Methodology education (primary phase homes)
INSERT INTO coaching.education_content (entity_type, entity_key, entity_id, title, what_it_is, programming_guidance, common_misuse, fatigue_logic) VALUES
  ('methodology', 'resistance_calisthenics', NULL, 'Resistance & Calisthenics', 'Bodyweight or external resistance for strength and force capacity.', 'Primary: Capacity. Secondary: Control, Skill (technical calisthenics).', 'Strength circuits before power work.', 'Creates moderate-high fatigue; usually after skill and output.'),
  ('methodology', 'plyometrics', NULL, 'Plyometrics', 'Fast SSC work for elastic force absorption and reapplication.', 'Primary: Output. Secondary: Prepare (low elastic prep), Skill (landing mechanics).', 'High box jumps as conditioning or after HIIT.', 'Requires freshness; fatigue reduces stiffness and landing quality.'),
  ('methodology', 'isometrics', NULL, 'Isometrics', 'Held positions without visible movement.', 'Light activation in Prepare; technical holds in Skill; max iso in Capacity; long yielding in Control.', 'Long fatiguing holds before speed or tumbling.', 'Light isos can prime; hard isos create local fatigue.'),
  ('methodology', 'eccentric_negative', NULL, 'Eccentric/Negative Training', 'Emphasis on lowering and force absorption.', 'Primary: Control/Resilience. Secondary: Capacity.', 'Hard eccentrics before sprinting, jumping, or tumbling.', 'Tissue-costly; usually after output and main strength.'),
  ('methodology', 'neural', NULL, 'Neural Training', 'Readiness, reaction, speed of coordination, and intent.', 'Primary: Prepare, Skill, Output.', 'Confusing fast fatigue drills with true neural output.', 'High-intent neural work requires freshness.'),
  ('methodology', 'balance_stability', NULL, 'Balance & Stability Work', 'Control over base of support and joint position.', 'Primary: Control, Skill. Secondary: Prepare (low level).', 'Unstable-surface novelty without transfer.', 'Hard balance can fatigue stabilizers.'),
  ('methodology', 'mobility_flexibility', NULL, 'Mobility & Flexibility Drills', 'Joint range and usable mobility.', 'Primary: Prepare (dynamic), Restore (long static).', 'Long static stretching before power or speed.', 'Dynamic mobility prepares; long static belongs late.'),
  ('methodology', 'core_body_control', NULL, 'Core & Body Control Work', 'Trunk control, bracing, hollow/arch, anti-rotation.', 'Primary: Control, Skill. Secondary: Prepare (activation).', 'Core burnout before tumbling, sprinting, or jumping.', 'Technical control early; burnout late.'),
  ('methodology', 'hiit', NULL, 'HIIT', 'High-intensity intervals for conditioning and repeatability.', 'Primary: Fitness/Repeatability.', 'HIIT before skill, speed, plyometrics, or advanced tumbling.', 'Creates fatigue on purpose; almost always late.')
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  what_it_is = EXCLUDED.what_it_is,
  programming_guidance = EXCLUDED.programming_guidance,
  common_misuse = EXCLUDED.common_misuse,
  fatigue_logic = EXCLUDED.fatigue_logic,
  updated_at = now();

-- Physiology education
INSERT INTO coaching.education_content (entity_type, entity_key, entity_id, title, what_it_is, programming_guidance) VALUES
  ('physiology', 'neural_output_readiness', NULL, 'Neural Output & Readiness', 'Nervous system ability to recruit and coordinate movement with speed and intent.', 'Place high-neural work early; keep reps crisp with adequate rest.'),
  ('physiology', 'force_tissue_capacity', NULL, 'Force Capacity & Tissue Capacity', 'Ability to produce force and tolerate load through muscle, tendon, and joint.', 'Progressive strength, calisthenics, isometrics, and eccentrics in Capacity and Control.'),
  ('physiology', 'ssc_stiffness', NULL, 'SSC & Stiffness', 'Stretch-shortening cycle and elastic energy use.', 'Train when fresh in Output; manage contact count and landing quality.'),
  ('physiology', 'control_stability', NULL, 'Control & Stability', 'Own positions and stabilize under load or speed.', 'Balance, core, isometrics, eccentrics, carries; low control early, fatiguing control later.'),
  ('physiology', 'perception_action_skill', NULL, 'Perception–Action Skill', 'Perceive, decide, and coordinate movement in response to environment.', 'Reaction drills, tumbling, rhythm while athlete can focus—usually Skill phase.'),
  ('physiology', 'energy_systems_repeatability', NULL, 'Energy Systems & Repeatability', 'Sustain effort and recover between bouts.', 'Hard conditioning late or in separate sessions; do not destroy speed/power quality.')
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  what_it_is = EXCLUDED.what_it_is,
  programming_guidance = EXCLUDED.programming_guidance,
  updated_at = now();

-- Master order template
INSERT INTO coaching.education_content (entity_type, entity_key, entity_id, title, short_summary, why_this_order, programming_guidance) VALUES
  ('template', 'master_session_order', NULL, 'Athleticism Accelerator Session Order',
   'Access → Intelligence → Output → Capacity → Control → Repeatability → Restore',
   'Sensitive qualities (skill, speed, power) must be trained before fatigue accumulates. Strength tolerates more fatigue than speed. Conditioning creates fatigue on purpose and belongs late.',
   'Coaches should progress through phases in order unless the session objective intentionally prioritizes one quality (e.g. strength day reduces output minutes).')
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  why_this_order = EXCLUDED.why_this_order,
  programming_guidance = EXCLUDED.programming_guidance,
  updated_at = now();
