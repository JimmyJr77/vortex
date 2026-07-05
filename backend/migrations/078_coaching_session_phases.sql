-- Session phases + order slots for Athleticism Accelerator phasing.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.session_phase (
  id                   BIGSERIAL PRIMARY KEY,
  key                  TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  description          TEXT,
  order_index          INTEGER NOT NULL DEFAULT 0,
  freshness_required   BOOLEAN NOT NULL DEFAULT FALSE,
  can_be_daily         BOOLEAN NOT NULL DEFAULT FALSE,
  default_min_percent  INTEGER,
  default_max_percent  INTEGER,
  fatigue_sensitivity  SMALLINT NOT NULL DEFAULT 3 CHECK (fatigue_sensitivity BETWEEN 1 AND 5),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO coaching.session_phase (key, name, description, order_index, freshness_required, can_be_daily, fatigue_sensitivity) VALUES
  ('prepare_access', 'Prepare / Access', 'Warm-up, joint access, mobility, activation, and tissue preparation.', 10, FALSE, TRUE, 1),
  ('skill_movement_intelligence', 'Skill / Movement Intelligence', 'Tumbling, coordination, reaction, sprint mechanics, balance skill, body control.', 20, TRUE, TRUE, 4),
  ('output', 'Output', 'Speed, explosiveness, plyometrics, agility, high-intent power.', 30, TRUE, FALSE, 5),
  ('capacity', 'Capacity', 'Strength, resistance, calisthenics, loaded force development.', 40, FALSE, FALSE, 3),
  ('control_resilience', 'Control / Resilience', 'Isometrics, eccentrics, stability, balance, trunk control, tissue capacity.', 50, FALSE, TRUE, 3),
  ('fitness_repeatability', 'Fitness / Repeatability', 'HIIT, conditioning, intervals, work capacity.', 60, FALSE, FALSE, 2),
  ('restore', 'Restore', 'Cooldown, breathing, post-workout flexibility, recovery.', 70, FALSE, TRUE, 1)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  order_index = EXCLUDED.order_index,
  freshness_required = EXCLUDED.freshness_required,
  can_be_daily = EXCLUDED.can_be_daily,
  fatigue_sensitivity = EXCLUDED.fatigue_sensitivity,
  updated_at = now();

CREATE TABLE IF NOT EXISTS coaching.phase_order_slot (
  id                   BIGSERIAL PRIMARY KEY,
  key                  TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  description          TEXT,
  phase_id             BIGINT NOT NULL REFERENCES coaching.session_phase(id) ON DELETE CASCADE,
  order_index          INTEGER NOT NULL DEFAULT 0,
  freshness_sensitivity SMALLINT NOT NULL DEFAULT 3 CHECK (freshness_sensitivity BETWEEN 1 AND 5),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_phase_order_slot_phase ON coaching.phase_order_slot(phase_id);

INSERT INTO coaching.phase_order_slot (key, name, description, phase_id, order_index, freshness_sensitivity)
SELECT v.key, v.name, v.description, sp.id, v.order_index, v.freshness_sensitivity
FROM (VALUES
  ('general_warmup', 'General Warmup', 'Raise temperature and general movement.', 'prepare_access', 100, 1),
  ('mobility_access', 'Mobility / Access', 'Dynamic mobility and joint access.', 'prepare_access', 110, 1),
  ('activation', 'Activation', 'Light activation and tissue prep.', 'prepare_access', 120, 2),
  ('landing_prep', 'Landing Prep', 'Landing mechanics and absorption prep.', 'prepare_access', 130, 2),
  ('technical_skill', 'Technical Skill', 'Low-intensity technical skill work.', 'skill_movement_intelligence', 200, 4),
  ('tumbling', 'Tumbling', 'Tumbling and rotational skill.', 'skill_movement_intelligence', 210, 5),
  ('sprint_mechanics', 'Sprint Mechanics', 'Sprint posture and mechanics drills.', 'skill_movement_intelligence', 220, 4),
  ('reaction_coordination', 'Reaction / Coordination', 'Reaction and coordination drills.', 'skill_movement_intelligence', 230, 4),
  ('speed_acceleration', 'Speed / Acceleration', 'Short accelerations and max-speed work.', 'output', 300, 5),
  ('elastic_prep', 'Elastic Prep', 'Pogo, stiffness, and spring drills.', 'output', 310, 4),
  ('main_plyometric', 'Main Plyometric', 'Primary plyometric exposure.', 'output', 320, 5),
  ('agility_deceleration', 'Agility / Deceleration', 'Cuts, deceleration, and direction changes.', 'output', 330, 4),
  ('agility_reactive', 'Reactive Agility', 'Reactive agility and game-speed work.', 'output', 340, 5),
  ('primary_strength', 'Primary Strength', 'Main strength lift or pattern.', 'capacity', 400, 3),
  ('secondary_strength', 'Secondary Strength', 'Secondary strength work.', 'capacity', 410, 3),
  ('calisthenics_strength', 'Calisthenics Strength', 'Bodyweight strength emphasis.', 'capacity', 420, 3),
  ('accessory_strength', 'Accessory Strength', 'Accessory strength patterns.', 'capacity', 430, 2),
  ('loaded_carry', 'Loaded Carry', 'Carries and loaded locomotion.', 'capacity', 440, 3),
  ('isometric_control', 'Isometric Control', 'Isometric holds and position ownership.', 'control_resilience', 500, 3),
  ('eccentric_control', 'Eccentric Control', 'Eccentric and negative emphasis.', 'control_resilience', 510, 4),
  ('balance_stability', 'Balance / Stability', 'Balance and stability challenges.', 'control_resilience', 520, 3),
  ('core_body_control', 'Core / Body Control', 'Trunk and body-line control.', 'control_resilience', 530, 3),
  ('tissue_capacity', 'Tissue Capacity', 'Tendon and tissue tolerance work.', 'control_resilience', 540, 4),
  ('conditioning_intervals', 'Conditioning Intervals', 'Interval-based conditioning.', 'fitness_repeatability', 600, 2),
  ('conditioning_circuit', 'Conditioning Circuit', 'Fatigue-producing circuits.', 'fitness_repeatability', 610, 1),
  ('cooldown_breathing', 'Cooldown / Breathing', 'Downshift and breathing reset.', 'restore', 700, 1),
  ('post_workout_flexibility', 'Post-Workout Flexibility', 'Longer static flexibility work.', 'restore', 710, 1)
) AS v(key, name, description, phase_key, order_index, freshness_sensitivity)
JOIN coaching.session_phase sp ON sp.key = v.phase_key
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  phase_id = EXCLUDED.phase_id,
  order_index = EXCLUDED.order_index,
  freshness_sensitivity = EXCLUDED.freshness_sensitivity;
