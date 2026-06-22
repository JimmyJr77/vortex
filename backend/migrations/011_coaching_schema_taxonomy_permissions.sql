-- ============================================================
-- Coaching Module: Schema, Taxonomy Reference Tables, Permissions
-- Migration: 011_coaching_schema_taxonomy_permissions.sql
--
-- This is the foundation for the Vortex Coach Portal. It creates a
-- dedicated `coaching` schema, seeds the canonical training taxonomy
-- (previously hardcoded in src/components/AthleticismAccelerator.tsx),
-- and registers the coach-portal permission keys.
--
-- IDEMPOTENT: safe to run repeatedly (re-run on every boot by
-- backend/platform/initTables.js).
-- ============================================================

CREATE SCHEMA IF NOT EXISTS coaching;

-- ============================================================
-- 1) TENETS OF ATHLETICISM (8)
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.tenet (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  detail      TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO coaching.tenet (key, name, description, detail, sort_order) VALUES
  ('strength', 'Strength', 'Ability to exert force against resistance.', 'Building foundational power through resistance training, calisthenics, and bodyweight movements to create a robust athletic base.', 1),
  ('explosiveness', 'Explosiveness', 'Exert maximal force in minimal time.', 'Developing explosive movement capability through plyometrics, jumping drills, and fast-twitch muscle activation for superior athletic performance.', 2),
  ('speed', 'Speed', 'Rapid execution of movement and reaction.', 'Enhancing neuromuscular response times and quickness through sprint work, agility drills, and reaction training.', 3),
  ('agility', 'Agility', 'Rapid direction changes with control.', 'Mastering multi-directional movement with precision and balance through ladder drills, cones, and spatial awareness exercises.', 4),
  ('flexibility', 'Flexibility', 'Range of motion and muscular elasticity.', 'Improving functional mobility and movement efficiency through targeted stretching, dynamic warm-ups, and range-of-motion exercises.', 5),
  ('balance', 'Balance', 'Maintain stability in static or dynamic movement.', 'Building proprioceptive awareness through beam work, stability challenges, and single-leg exercises for superior body control.', 6),
  ('coordination', 'Coordination', 'Integrate multiple body parts for fluid motion.', 'Developing seamless movement patterns through complex drills, multi-plane exercises, and neural synchronization training.', 7),
  ('body_control', 'Body Control', 'Kinematic awareness - Precise understanding of where the body is in space.', 'Achieving exceptional spatial awareness through gymnastics-based training, air sense development, and proprioceptive exercises that translate to any sport.', 8)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  detail = EXCLUDED.detail,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- ============================================================
-- 2) TRAINING METHODOLOGIES (8)
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.methodology (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO coaching.methodology (key, name, description, sort_order) VALUES
  ('resistance_calisthenics', 'Resistance & Calisthenics', 'Foundational strength and endurance building', 1),
  ('plyometrics', 'Plyometrics', 'Explosive power and fast-twitch activation', 2),
  ('isometrics', 'Isometrics', 'Tendon loading and joint stability', 3),
  ('eccentric_negative', 'Eccentric/Negative Training', 'Controlled force development and injury prevention', 4),
  ('neural', 'Neural Training', 'Speed, coordination, and reaction time enhancement', 5),
  ('balance_stability', 'Balance & Stability Work', 'Proprioception and spatial control', 6),
  ('mobility_flexibility', 'Mobility & Flexibility Drills', 'Full-range functional movement', 7),
  ('core_body_control', 'Core & Body Control Work', 'Control, posture, and spatial awareness', 8)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- ============================================================
-- 3) PHYSIOLOGICAL EMPHASIS (6)
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.physiological_emphasis (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  systems     TEXT,
  purpose     TEXT,
  outcomes    TEXT[] NOT NULL DEFAULT '{}',
  is_optional BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO coaching.physiological_emphasis (key, name, systems, purpose, outcomes, is_optional, sort_order) VALUES
  ('neural_output_readiness', 'Neural Output & Readiness', 'Central Nervous System, Reflex Arc', 'Maximize motor unit recruitment and firing speed', ARRAY['Faster reaction time', 'Improved rate of force development', 'Enhanced movement intent and explosiveness'], FALSE, 1),
  ('force_tissue_capacity', 'Force Capacity & Tissue Capacity', 'Muscle, Tendon, Joint', 'Build structural tolerance and force production capability', ARRAY['Strength and hypertrophy', 'Joint integrity and durability', 'Improved force absorption and expression'], FALSE, 2),
  ('ssc_stiffness', 'SSC & Stiffness (Elastic Energy)', 'Tendons, Fascia, Muscle-Tendon Unit', 'Optimize stretch-shortening cycle efficiency', ARRAY['Reactive power', 'Shorter ground contact times', 'Improved elastic resilience'], FALSE, 3),
  ('control_stability', 'Control & Stability', 'Core, Proprioceptors, Stabilizing Musculature', 'Maintain positional integrity under load and speed', ARRAY['Balance and postural control', 'Precision in deceleration and landing', 'Reduced injury risk'], FALSE, 4),
  ('perception_action_skill', 'Perception-Action Skill (Movement Intelligence)', 'Brain-Body Integration', 'Improve movement patterning and adaptability', ARRAY['Better timing and coordination', 'Enhanced spatial awareness', 'Transferable athletic skill across sports'], FALSE, 5),
  ('energy_systems_repeatability', 'Energy Systems & Repeatability', 'Aerobic and Anaerobic Energy Pathways', 'Sustain movement quality over repeated efforts', ARRAY['Improved work capacity', 'Faster recovery between actions', 'Consistent performance under fatigue'], TRUE, 6)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  systems = EXCLUDED.systems,
  purpose = EXCLUDED.purpose,
  outcomes = EXCLUDED.outcomes,
  is_optional = EXCLUDED.is_optional,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- ============================================================
-- 4) MOVEMENT PATTERNS
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.movement_pattern (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO coaching.movement_pattern (key, name, sort_order) VALUES
  ('squat', 'Squat', 1),
  ('hinge', 'Hinge', 2),
  ('push', 'Push', 3),
  ('pull', 'Pull', 4),
  ('brace', 'Brace / Anti-Rotation', 5),
  ('jump', 'Jump', 6),
  ('land', 'Land', 7),
  ('rotate', 'Rotate', 8),
  ('locomote', 'Locomote', 9),
  ('carry', 'Carry', 10),
  ('hang', 'Hang / Support', 11),
  ('invert', 'Invert', 12)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- ============================================================
-- 5) EQUIPMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.equipment (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO coaching.equipment (key, name, sort_order) VALUES
  ('none', 'None / Bodyweight', 1),
  ('bands', 'Resistance Bands', 2),
  ('box', 'Box / Plyo Box', 3),
  ('beam', 'Balance Beam', 4),
  ('bar', 'Bar', 5),
  ('rings', 'Rings', 6),
  ('kettlebell', 'Kettlebell', 7),
  ('dumbbell', 'Dumbbell', 8),
  ('sled', 'Sled', 9),
  ('medicine_ball', 'Medicine Ball', 10),
  ('mat', 'Mat', 11),
  ('cones', 'Cones / Ladder', 12)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- ============================================================
-- 6) SPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.sport (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO coaching.sport (key, name, sort_order) VALUES
  ('fitness', 'Fitness (General)', 1),
  ('gymnastics', 'Gymnastics', 2),
  ('ninja', 'Ninja', 3)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- ============================================================
-- 7) EXERCISE INTENT (session phase)
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.exercise_intent (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO coaching.exercise_intent (key, name, sort_order) VALUES
  ('warmup', 'Warmup', 1),
  ('activation', 'Activation', 2),
  ('main', 'Main Work', 3),
  ('accessory', 'Accessory', 4),
  ('skill', 'Skill', 5),
  ('conditioning', 'Conditioning', 6),
  ('cooldown', 'Cooldown', 7)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- ============================================================
-- 8) PERMISSIONS (granted to COACH role)
-- ============================================================

INSERT INTO permission (key, description) VALUES
  ('library.view', 'View the coaching exercise/drill library.'),
  ('library.manage', 'Create and manage exercises/drills in the library.'),
  ('workouts.manage', 'Create and manage workouts and warmups.'),
  ('training_programs.manage', 'Create and manage multi-week training programs.'),
  ('challenges.manage', 'Create and manage challenges.'),
  ('assessments.manage', 'Create and manage assessments and rubrics.'),
  ('athlete_grading.manage', 'Grade athletes and record skill progress.'),
  ('plans.assign', 'Assign plans to athletes, classes, and families.'),
  ('coach_insights.view', 'View coach analytics and athlete insights.')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

-- Master / owner admins automatically receive every permission.
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
CROSS JOIN permission p
WHERE r.key = 'MASTER_ADMIN'
ON CONFLICT DO NOTHING;

-- Grant the full coaching toolset to the COACH role.
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key IN (
  'library.view', 'library.manage', 'workouts.manage',
  'training_programs.manage', 'challenges.manage', 'assessments.manage',
  'athlete_grading.manage', 'plans.assign', 'coach_insights.view'
)
WHERE r.key = 'COACH'
ON CONFLICT DO NOTHING;

-- Admins can view the library and insights without full coaching management.
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key IN (
  'library.view', 'library.manage', 'workouts.manage',
  'training_programs.manage', 'challenges.manage', 'assessments.manage',
  'athlete_grading.manage', 'plans.assign', 'coach_insights.view'
)
WHERE r.key = 'ADMIN'
ON CONFLICT DO NOTHING;
