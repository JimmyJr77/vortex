-- Prepare & Access subrole hierarchy: phase_subrole table, subrole_key on order slots, fine slots.
-- IDEMPOTENT.

-- Extend education_content entity_type for phase_subrole rows.
DO $$ BEGIN
  ALTER TABLE coaching.education_content DROP CONSTRAINT IF EXISTS education_content_entity_type_check;
  ALTER TABLE coaching.education_content ADD CONSTRAINT education_content_entity_type_check
    CHECK (entity_type IN (
      'session_phase', 'phase_order_slot', 'phase_subrole', 'tenet', 'methodology', 'physiology',
      'exercise', 'exercise_phase_profile', 'workout_block', 'validation_rule',
      'regimen_rule', 'template'
    ));
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS coaching.phase_subrole (
  id               BIGSERIAL PRIMARY KEY,
  phase_id         BIGINT NOT NULL REFERENCES coaching.session_phase(id) ON DELETE CASCADE,
  key              TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  order_index      INTEGER NOT NULL DEFAULT 0,
  why_it_exists    TEXT,
  what_belongs_here TEXT,
  what_to_avoid    TEXT,
  fatigue_guidance TEXT,
  coach_guidance   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (phase_id, key)
);

CREATE INDEX IF NOT EXISTS idx_coaching_phase_subrole_phase ON coaching.phase_subrole(phase_id);

ALTER TABLE coaching.phase_order_slot ADD COLUMN IF NOT EXISTS subrole_key TEXT;

-- Seed Prepare & Access subroles (RAMP-aligned sequence).
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
  ('raise', 'Raise', 'Raise temperature, blood flow, respiration, and general readiness.', 10,
   'Athletes need systemic warmth before joint-specific or high-intent work.',
   'Marching, skipping, light jog, side shuffle, rhythm games, low-intensity locomotion.',
   'High-intensity intervals, heavy strength, max plyometrics, long static stretching.',
   'Should create readiness, not fatigue. Athletes should feel warmer and more alert.',
   'Keep effort conversational. Progress from general to slightly more dynamic movement.'),
  ('mobilize', 'Mobilize', 'Open usable joint ranges needed later in the session.', 20,
   'Later skill, speed, and strength patterns require accessible ankles, hips, spine, shoulders, and wrists.',
   'Ankle rocks, hip switches, T-spine rotation, wrist prep, squat access, breathing reset, joint scans.',
   'Aggressive end-range forcing, long passive holds before power work, pain-inducing stretching.',
   'Low neural and metabolic cost. Quality of range matters more than volume.',
   'Match mobility to what the session will demand — tumbling days need different access than strength days.'),
  ('activate', 'Activate', 'Wake up key stabilizers and prime positions.', 30,
   'Stabilizers must be online before integrated patterns or high-load work.',
   'Glute bridge, scap push-up, dead bug, foot activation, rotator cuff prep, core bracing drills.',
   'Fatiguing core circuits, max-effort activation, heavy loading during prep.',
   'Light activation — athletes should feel muscles engage, not burn out.',
   'Target the stabilizers that support the primary session demands.'),
  ('integrate', 'Integrate', 'Connect joints into whole-body movement patterns.', 40,
   'The body must move as a system before skill or output intensity rises.',
   'Inchworm, lunge with rotation, bear crawl, squat-to-stand, full-body flows, crawling prep.',
   'Sport-specific max efforts, high-complexity skill, fatiguing combinations.',
   'Moderate complexity with controlled breathing. Build coordination without exhaustion.',
   'Use patterns that bridge isolated prep into session-relevant movement chains.'),
  ('potentiate_bridge', 'Potentiate Bridge', 'Gently bridge into Skill/Output without creating fatigue.', 50,
   'The nervous system needs a low-stress ramp toward higher intent without premature fatigue.',
   'Low pogo, marching mechanics, snap-down prep, landing prep, sprint posture drills.',
   'Max jumps, sprints, heavy lifts, HIIT, or anything that meaningfully fatigues before main work.',
   'Low volume, high quality, full recovery between reps. Stop before athletes feel taxed.',
   'This is the last step before Skill or Output — stiffness and intent without exhaustion.')
) AS v(key, name, description, order_index, why_it_exists, what_belongs_here, what_to_avoid, fatigue_guidance, coach_guidance)
WHERE sp.key = 'prepare_and_access'
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

-- Fine-grained Prepare & Access order slots (legacy keys preserved; new slots added).
INSERT INTO coaching.phase_order_slot (key, name, description, phase_id, order_index, freshness_sensitivity, subrole_key)
SELECT v.key, v.name, v.description, sp.id, v.order_index, v.freshness_sensitivity, v.subrole_key
FROM coaching.session_phase sp
CROSS JOIN (VALUES
  ('general_warmup', 'General Warmup', 'Raise temperature and general movement.', 100, 1, 'raise'),
  ('locomotion_warmup', 'Locomotion Warmup', 'Skipping, shuffling, and dynamic locomotion patterns.', 101, 1, 'raise'),
  ('light_cardiovascular_raise', 'Light Cardiovascular Raise', 'Light jog, bike, or rope to elevate heart rate.', 102, 1, 'raise'),
  ('rhythm_warmup', 'Rhythm Warmup', 'Rhythm and coordination games at low intensity.', 103, 1, 'raise'),
  ('breathing_reset', 'Breathing Reset', 'Diaphragmatic breathing and down-regulation reset.', 110, 1, 'mobilize'),
  ('joint_scan', 'Joint Scan', 'Systematic joint-by-joint movement scan.', 111, 1, 'mobilize'),
  ('mobility_access', 'Mobility / Access', 'Dynamic mobility and joint access.', 112, 1, 'mobilize'),
  ('spinal_mobility', 'Spinal Mobility', 'Cat-cow, segmental spine, and spinal wave patterns.', 113, 1, 'mobilize'),
  ('thoracic_rotation', 'Thoracic Rotation', 'T-spine rotation and rib cage mobility.', 114, 1, 'mobilize'),
  ('wrist_prep', 'Wrist Prep', 'Wrist circles, rocks, and loaded prep for handstand/tumbling.', 115, 1, 'mobilize'),
  ('shoulder_mobility', 'Shoulder Mobility', 'Shoulder circles, wall slides, and overhead access.', 116, 1, 'mobilize'),
  ('ankle_mobility', 'Ankle Mobility', 'Ankle rocks, dorsiflexion, and calf prep.', 117, 1, 'mobilize'),
  ('hip_mobility', 'Hip Mobility', 'Hip switches, 90/90, and hip CARs.', 118, 1, 'mobilize'),
  ('squat_access', 'Squat Access', 'Squat patterning and depth access work.', 119, 1, 'mobilize'),
  ('activation', 'Activation', 'Light activation and tissue prep.', 120, 2, 'activate'),
  ('glute_activation', 'Glute Activation', 'Bridges, clams, and glute engagement drills.', 121, 2, 'activate'),
  ('scapular_activation', 'Scapular Activation', 'Scap push-ups, wall slides, and serratus work.', 122, 2, 'activate'),
  ('core_activation', 'Core Activation', 'Dead bug, bird dog, and anti-extension drills.', 123, 2, 'activate'),
  ('foot_activation', 'Foot Activation', 'Short foot, toe yoga, and arch activation.', 124, 2, 'activate'),
  ('rotator_cuff_activation', 'Rotator Cuff Activation', 'Band external rotation and shoulder stability.', 125, 2, 'activate'),
  ('integrated_mobility', 'Integrated Mobility', 'Multi-joint mobility flowing through ranges.', 130, 2, 'integrate'),
  ('lunge_pattern_prep', 'Lunge Pattern Prep', 'Lunge variations with rotation and reach.', 131, 2, 'integrate'),
  ('crawl_pattern_prep', 'Crawl Pattern Prep', 'Bear crawl, crab walk, and quadruped patterns.', 132, 2, 'integrate'),
  ('squat_to_stand', 'Squat to Stand', 'Squat-to-stand and pattern integration flows.', 133, 2, 'integrate'),
  ('full_body_flow', 'Full Body Flow', 'Connected whole-body movement sequences.', 134, 2, 'integrate'),
  ('landing_prep', 'Landing Prep', 'Landing mechanics and absorption prep.', 140, 2, 'potentiate_bridge'),
  ('marching_mechanics', 'Marching Mechanics', 'A-march, B-march, and sprint posture drills.', 141, 2, 'potentiate_bridge'),
  ('low_level_plyo_prep', 'Low-Level Plyo Prep', 'Low pogo, ankle hops, and stiffness prep.', 142, 2, 'potentiate_bridge'),
  ('sprint_posture_prep', 'Sprint Posture Prep', 'Wall drills and acceleration posture work.', 143, 2, 'potentiate_bridge'),
  ('elastic_prep_prepare', 'Elastic Prep (Prepare)', 'Prepare-phase elastic stiffness bridge — not main output plyos.', 144, 2, 'potentiate_bridge')
) AS v(key, name, description, order_index, freshness_sensitivity, subrole_key)
WHERE sp.key = 'prepare_and_access'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  phase_id = EXCLUDED.phase_id,
  order_index = EXCLUDED.order_index,
  freshness_sensitivity = EXCLUDED.freshness_sensitivity,
  subrole_key = EXCLUDED.subrole_key;

-- Backfill exercise phase_subrole from primary prepare_and_access order slot.
UPDATE coaching.exercise e SET phase_subrole = pos.subrole_key
FROM coaching.exercise_phase_profile p
JOIN coaching.phase_order_slot pos ON pos.key = p.order_slot
JOIN coaching.session_phase sp ON sp.id = pos.phase_id AND sp.key = 'prepare_and_access'
WHERE p.exercise_id = e.id
  AND p.role = 'primary'
  AND pos.subrole_key IS NOT NULL
  AND (e.phase_subrole IS NULL OR e.phase_subrole = '');

-- Also derive from primary_order_slot when set.
UPDATE coaching.exercise e SET phase_subrole = pos.subrole_key
FROM coaching.phase_order_slot pos
JOIN coaching.session_phase sp ON sp.id = pos.phase_id AND sp.key = 'prepare_and_access'
WHERE e.primary_order_slot = pos.key
  AND pos.subrole_key IS NOT NULL
  AND e.primary_phase_key = 'prepare_and_access'
  AND (e.phase_subrole IS NULL OR e.phase_subrole = '');

-- Mirror subrole teaching into education_content for Framework panel.
INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary, what_it_is, why_it_matters,
  programming_guidance, common_misuse, fatigue_logic, sort_order
)
SELECT
  'phase_subrole',
  ps.key,
  ps.id,
  ps.name,
  ps.description,
  ps.what_belongs_here,
  ps.why_it_exists,
  ps.coach_guidance,
  ps.what_to_avoid,
  ps.fatigue_guidance,
  ps.order_index
FROM coaching.phase_subrole ps
JOIN coaching.session_phase sp ON sp.id = ps.phase_id AND sp.key = 'prepare_and_access'
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is,
  why_it_matters = EXCLUDED.why_it_matters,
  programming_guidance = EXCLUDED.programming_guidance,
  common_misuse = EXCLUDED.common_misuse,
  fatigue_logic = EXCLUDED.fatigue_logic,
  sort_order = EXCLUDED.sort_order;
