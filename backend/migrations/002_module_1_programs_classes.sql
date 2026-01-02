-- ============================================================
-- Module 1: Programs & Classes
-- Migration: 002_module_1_programs_classes.sql
-- ============================================================

-- ============================================================
-- 1) ENUMS - Program Category
-- ============================================================

DO $$ BEGIN
  CREATE TYPE program_category AS ENUM (
    'EARLY_DEVELOPMENT',
    'GYMNASTICS',
    'VORTEX_NINJA',
    'ATHLETICISM_ACCELERATOR',
    'ADULT_FITNESS',
    'HOMESCHOOL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2) ENUMS - Skill Level
-- ============================================================

DO $$ BEGIN
  CREATE TYPE skill_level AS ENUM (
    'EARLY_STAGE',
    'BEGINNER',
    'INTERMEDIATE',
    'ADVANCED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 3) PROGRAM TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS program (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  category            program_category NOT NULL,
  name                TEXT NOT NULL,
  display_name        TEXT NOT NULL, -- e.g., "Dust Devils — Mommy & Me"
  skill_level         skill_level,
  age_min             INTEGER,
  age_max             INTEGER,
  description         TEXT,
  skill_requirements  TEXT, -- e.g., "No Experience Required" or "Skill Evaluation Required"
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, category, name)
);

CREATE INDEX IF NOT EXISTS idx_program_facility_category ON program(facility_id, category);
CREATE INDEX IF NOT EXISTS idx_program_skill_level ON program(skill_level);
CREATE INDEX IF NOT EXISTS idx_program_active ON program(is_active);

-- ============================================================
-- 4) CLASS TABLE (represents scheduled class instances)
-- ============================================================

CREATE TABLE IF NOT EXISTS class (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  program_id           BIGINT NOT NULL REFERENCES program(id) ON DELETE CASCADE,
  name                TEXT NOT NULL, -- e.g., "Monday 4-5pm Tornadoes"
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  day_of_week         INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  max_capacity        INTEGER,
  current_enrollment  INTEGER NOT NULL DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_program ON class(program_id);
CREATE INDEX IF NOT EXISTS idx_class_day_time ON class(day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_class_active ON class(is_active);

-- ============================================================
-- 5) SEED PROGRAMS
-- ============================================================

-- Early Development Gymnastics & Athleticism
INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'EARLY_DEVELOPMENT'::program_category,
  'dust_devils',
  'Dust Devils — Mommy & Me',
  'EARLY_STAGE'::skill_level,
  2,
  3,
  'Parent-assisted class focused on balance, coordination, rolling, jumping, and obstacle exploration in a safe, playful environment.',
  'No Experience Required'
WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'dust_devils');

INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'EARLY_DEVELOPMENT'::program_category,
  'little_twisters_preschool',
  'Little Twisters — Preschool',
  'EARLY_STAGE'::skill_level,
  4,
  5,
  'Introductory gymnastics and athletic movement. Athletes build coordination, body awareness, and confidence using basic skills and equipment stations.',
  'Potty Trained'
WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'little_twisters_preschool');

-- Gymnastics
INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'GYMNASTICS'::program_category,
  'tornadoes_gymnastics',
  'Tornadoes — Beginner',
  'BEGINNER'::skill_level,
  6,
  NULL,
  'Focus on foundational gymnastics skills including forward/backward rolls, cartwheels, handstands, bridges, round-offs, splits, and flexibility.',
  'No Experience Required'
WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'tornadoes_gymnastics');

INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'GYMNASTICS'::program_category,
  'cyclones_gymnastics',
  'Cyclones — Intermediate',
  'INTERMEDIATE'::skill_level,
  6,
  NULL,
  'Athletes refine fundamentals and progress to front/back walkovers, handsprings, strength development, and controlled power.',
  'Skill Evaluation Required'
WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'cyclones_gymnastics');

INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'GYMNASTICS'::program_category,
  'vortex_a4_elite',
  'Vortex A4 Elite — Advanced',
  'ADVANCED'::skill_level,
  6,
  NULL,
  'Advanced training in multiple handsprings, flips, layouts, twisting, strength, flexibility, and elite-level execution.',
  'Skill Evaluation Required'
WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'vortex_a4_elite');

-- Vortex Ninja Classes
INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'VORTEX_NINJA'::program_category,
  'tornadoes_ninja',
  'Tornadoes — Beginner Ninja',
  'BEGINNER'::skill_level,
  6,
  NULL,
  'Intro to ninja and parkour-style movement. Focus on agility, grip strength, coordination, and obstacle navigation.',
  'No Experience Required'
WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'tornadoes_ninja');

INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'VORTEX_NINJA'::program_category,
  'cyclones_ninja',
  'Cyclones — Intermediate Ninja',
  'INTERMEDIATE'::skill_level,
  6,
  NULL,
  'Develop speed, strength, endurance, and technique across more complex ninja obstacles and movement challenges.',
  'Skill Evaluation Required'
WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'cyclones_ninja');

INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'VORTEX_NINJA'::program_category,
  'vortex_elite_ninja',
  'Vortex Elite — Advanced Ninja',
  'ADVANCED'::skill_level,
  6,
  NULL,
  'High-level ninja training emphasizing advanced obstacle combinations, explosive power, precision, and competitive readiness.',
  'Skill Evaluation Required'
WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'vortex_elite_ninja');

-- Athleticism Accelerator
INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'ATHLETICISM_ACCELERATOR'::program_category,
  'little_twisters_athleticism',
  'Little Twisters — Early Stage',
  'EARLY_STAGE'::skill_level,
  4,
  5,
  'Foundational athletic development focusing on balance, coordination, running, jumping, and playful strength.',
  'No Experience Required'
WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'little_twisters_athleticism');

INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'ATHLETICISM_ACCELERATOR'::program_category,
  'tornadoes_athleticism',
  'Tornadoes — Beginner',
  'BEGINNER'::skill_level,
  6,
  NULL,
  'Athletic fundamentals including speed mechanics, jumping/landing, core strength, mobility, and coordination.',
  'No Experience Required'
WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'tornadoes_athleticism');

INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'ATHLETICISM_ACCELERATOR'::program_category,
  'cyclones_athleticism',
  'Cyclones — Intermediate',
  'INTERMEDIATE'::skill_level,
  6,
  NULL,
  'Strength, agility, power, and body control training to accelerate athletic performance across all sports.',
  'Skill Evaluation Required'
WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'cyclones_athleticism');

INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'ATHLETICISM_ACCELERATOR'::program_category,
  'vortex_elite_athleticism',
  'Vortex Elite — Advanced',
  'ADVANCED'::skill_level,
  6,
  NULL,
  'High-performance training combining strength, speed, explosiveness, and movement efficiency for competitive athletes.',
  'Skill Evaluation Required'
WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'vortex_elite_athleticism');

-- Adult Training Track – Fitness & Acrobatics
INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'ADULT_FITNESS'::program_category,
  'typhoons',
  'Typhoons — Adult Fitness',
  'BEGINNER'::skill_level,
  18,
  NULL,
  'Strength, conditioning, mobility, and introductory acrobatics in a progressive, supportive environment.',
  'No Experience Required'
WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'typhoons');

-- Hurricane Academy (Homeschool Program)
INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'HOMESCHOOL'::program_category,
  'hurricane_academy',
  'Hurricane Academy — All Levels',
  NULL, -- All levels
  6,
  NULL,
  'Development-based gymnastics and athletic training. Athletes progress by skill mastery rather than age or grade level.',
  'Daytime Program'
WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'hurricane_academy');

-- ============================================================
-- NOTES
-- ============================================================
-- 1. This migration creates the foundation for Module 1
-- 2. All programs are seeded with their descriptions and requirements
-- 3. The class table is ready for scheduling class instances
-- 4. Programs are linked to the facility via facility_id
-- 5. Classes reference programs and can be scheduled by day/time

