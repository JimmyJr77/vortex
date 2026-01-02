-- ============================================================
-- Migration: Convert categories and levels from enums to tables
-- This allows dynamic management of categories and levels
-- Note: Using plural table names to avoid conflict with enum types
-- ============================================================

-- ============================================================
-- 1) Create program_categories table
-- ============================================================

CREATE TABLE IF NOT EXISTS program_categories (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  name                TEXT NOT NULL, -- e.g., 'GYMNASTICS', 'VORTEX_NINJA'
  display_name        TEXT NOT NULL, -- e.g., 'Gymnastics', 'Vortex Ninja Classes'
  archived            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, name)
);

CREATE INDEX IF NOT EXISTS idx_program_categories_facility ON program_categories(facility_id);
CREATE INDEX IF NOT EXISTS idx_program_categories_archived ON program_categories(archived);

-- ============================================================
-- 2) Create skill_levels table
-- ============================================================

CREATE TABLE IF NOT EXISTS skill_levels (
      id                  BIGSERIAL PRIMARY KEY,
      facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
      category_id         BIGINT NOT NULL REFERENCES program_categories(id) ON DELETE CASCADE,
      name                TEXT NOT NULL, -- e.g., 'BEGINNER', 'INTERMEDIATE'
      display_name        TEXT NOT NULL, -- e.g., 'Beginner', 'Intermediate'
      archived            BOOLEAN NOT NULL DEFAULT FALSE,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (facility_id, category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_skill_levels_facility ON skill_levels(facility_id);
CREATE INDEX IF NOT EXISTS idx_skill_levels_category ON skill_levels(category_id);
CREATE INDEX IF NOT EXISTS idx_skill_levels_archived ON skill_levels(archived);

-- ============================================================
-- 3) Migrate existing enum values to tables
-- ============================================================

-- Migrate categories
INSERT INTO program_categories (facility_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'EARLY_DEVELOPMENT',
  'Early Development Gymnastics & Athleticism'
WHERE NOT EXISTS (SELECT 1 FROM program_categories WHERE name = 'EARLY_DEVELOPMENT');

INSERT INTO program_categories (facility_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'GYMNASTICS',
  'Gymnastics'
WHERE NOT EXISTS (SELECT 1 FROM program_categories WHERE name = 'GYMNASTICS');

INSERT INTO program_categories (facility_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'VORTEX_NINJA',
  'Vortex Ninja Classes'
WHERE NOT EXISTS (SELECT 1 FROM program_categories WHERE name = 'VORTEX_NINJA');

INSERT INTO program_categories (facility_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'ATHLETICISM_ACCELERATOR',
  'Athleticism Accelerator'
WHERE NOT EXISTS (SELECT 1 FROM program_categories WHERE name = 'ATHLETICISM_ACCELERATOR');

INSERT INTO program_categories (facility_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'ADULT_FITNESS',
  'Adult Training Track – Fitness & Acrobatics'
WHERE NOT EXISTS (SELECT 1 FROM program_categories WHERE name = 'ADULT_FITNESS');

INSERT INTO program_categories (facility_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  'HOMESCHOOL',
  'Hurricane Academy (Homeschool Program)'
WHERE NOT EXISTS (SELECT 1 FROM program_categories WHERE name = 'HOMESCHOOL');

-- Migrate skill levels for each category
-- Note: We'll create levels for each category that uses them

-- EARLY_STAGE for EARLY_DEVELOPMENT
INSERT INTO skill_levels (facility_id, category_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  (SELECT id FROM program_categories WHERE name = 'EARLY_DEVELOPMENT' LIMIT 1),
  'EARLY_STAGE',
  'Early Stage'
WHERE NOT EXISTS (
  SELECT 1 FROM skill_levels 
  WHERE category_id = (SELECT id FROM program_categories WHERE name = 'EARLY_DEVELOPMENT' LIMIT 1)
  AND name = 'EARLY_STAGE'
);

-- BEGINNER, INTERMEDIATE, ADVANCED for GYMNASTICS
INSERT INTO skill_levels (facility_id, category_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  (SELECT id FROM program_categories WHERE name = 'GYMNASTICS' LIMIT 1),
  'BEGINNER',
  'Beginner'
WHERE NOT EXISTS (
  SELECT 1 FROM skill_levels 
  WHERE category_id = (SELECT id FROM program_categories WHERE name = 'GYMNASTICS' LIMIT 1)
  AND name = 'BEGINNER'
);

INSERT INTO skill_levels (facility_id, category_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  (SELECT id FROM program_categories WHERE name = 'GYMNASTICS' LIMIT 1),
  'INTERMEDIATE',
  'Intermediate'
WHERE NOT EXISTS (
  SELECT 1 FROM skill_levels 
  WHERE category_id = (SELECT id FROM program_categories WHERE name = 'GYMNASTICS' LIMIT 1)
  AND name = 'INTERMEDIATE'
);

INSERT INTO skill_levels (facility_id, category_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  (SELECT id FROM program_categories WHERE name = 'GYMNASTICS' LIMIT 1),
  'ADVANCED',
  'Advanced'
WHERE NOT EXISTS (
  SELECT 1 FROM skill_levels 
  WHERE category_id = (SELECT id FROM program_categories WHERE name = 'GYMNASTICS' LIMIT 1)
  AND name = 'ADVANCED'
);

-- BEGINNER, INTERMEDIATE, ADVANCED for VORTEX_NINJA
INSERT INTO skill_levels (facility_id, category_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  (SELECT id FROM program_categories WHERE name = 'VORTEX_NINJA' LIMIT 1),
  'BEGINNER',
  'Beginner'
WHERE NOT EXISTS (
  SELECT 1 FROM skill_levels 
  WHERE category_id = (SELECT id FROM program_categories WHERE name = 'VORTEX_NINJA' LIMIT 1)
  AND name = 'BEGINNER'
);

INSERT INTO skill_levels (facility_id, category_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  (SELECT id FROM program_categories WHERE name = 'VORTEX_NINJA' LIMIT 1),
  'INTERMEDIATE',
  'Intermediate'
WHERE NOT EXISTS (
  SELECT 1 FROM skill_levels 
  WHERE category_id = (SELECT id FROM program_categories WHERE name = 'VORTEX_NINJA' LIMIT 1)
  AND name = 'INTERMEDIATE'
);

INSERT INTO skill_levels (facility_id, category_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  (SELECT id FROM program_categories WHERE name = 'VORTEX_NINJA' LIMIT 1),
  'ADVANCED',
  'Advanced'
WHERE NOT EXISTS (
  SELECT 1 FROM skill_levels 
  WHERE category_id = (SELECT id FROM program_categories WHERE name = 'VORTEX_NINJA' LIMIT 1)
  AND name = 'ADVANCED'
);

-- EARLY_STAGE, BEGINNER, INTERMEDIATE, ADVANCED for ATHLETICISM_ACCELERATOR
INSERT INTO skill_levels (facility_id, category_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  (SELECT id FROM program_categories WHERE name = 'ATHLETICISM_ACCELERATOR' LIMIT 1),
  'EARLY_STAGE',
  'Early Stage'
WHERE NOT EXISTS (
  SELECT 1 FROM skill_levels 
  WHERE category_id = (SELECT id FROM program_categories WHERE name = 'ATHLETICISM_ACCELERATOR' LIMIT 1)
  AND name = 'EARLY_STAGE'
);

INSERT INTO skill_levels (facility_id, category_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  (SELECT id FROM program_categories WHERE name = 'ATHLETICISM_ACCELERATOR' LIMIT 1),
  'BEGINNER',
  'Beginner'
WHERE NOT EXISTS (
  SELECT 1 FROM skill_levels 
  WHERE category_id = (SELECT id FROM program_categories WHERE name = 'ATHLETICISM_ACCELERATOR' LIMIT 1)
  AND name = 'BEGINNER'
);

INSERT INTO skill_levels (facility_id, category_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  (SELECT id FROM program_categories WHERE name = 'ATHLETICISM_ACCELERATOR' LIMIT 1),
  'INTERMEDIATE',
  'Intermediate'
WHERE NOT EXISTS (
  SELECT 1 FROM skill_levels 
  WHERE category_id = (SELECT id FROM program_categories WHERE name = 'ATHLETICISM_ACCELERATOR' LIMIT 1)
  AND name = 'INTERMEDIATE'
);

INSERT INTO skill_levels (facility_id, category_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  (SELECT id FROM program_categories WHERE name = 'ATHLETICISM_ACCELERATOR' LIMIT 1),
  'ADVANCED',
  'Advanced'
WHERE NOT EXISTS (
  SELECT 1 FROM skill_levels 
  WHERE category_id = (SELECT id FROM program_categories WHERE name = 'ATHLETICISM_ACCELERATOR' LIMIT 1)
  AND name = 'ADVANCED'
);

-- BEGINNER for ADULT_FITNESS
INSERT INTO skill_levels (facility_id, category_id, name, display_name)
SELECT 
  (SELECT id FROM facility LIMIT 1),
  (SELECT id FROM program_categories WHERE name = 'ADULT_FITNESS' LIMIT 1),
  'BEGINNER',
  'Beginner'
WHERE NOT EXISTS (
  SELECT 1 FROM skill_levels 
  WHERE category_id = (SELECT id FROM program_categories WHERE name = 'ADULT_FITNESS' LIMIT 1)
  AND name = 'BEGINNER'
);

-- ============================================================
-- 4) Add archived column to program table if it doesn't exist
-- ============================================================

ALTER TABLE program ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_program_archived ON program(archived);

-- ============================================================
-- 5) Add category_id and level_id columns to program table
-- ============================================================

-- Add category_id column (will reference program_categories table)
ALTER TABLE program ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES program_categories(id) ON DELETE RESTRICT;

-- Add level_id column (will reference skill_levels table, nullable)
ALTER TABLE program ADD COLUMN IF NOT EXISTS level_id BIGINT REFERENCES skill_levels(id) ON DELETE SET NULL;

-- Migrate existing data: map enum values to new table IDs
UPDATE program p
SET category_id = (
  SELECT id FROM program_categories pc 
  WHERE pc.name = p.category::TEXT
  LIMIT 1
)
WHERE category_id IS NULL;

UPDATE program p
SET level_id = (
  SELECT id FROM skill_levels sl 
  WHERE sl.name = p.skill_level::TEXT
  AND sl.category_id = p.category_id
  LIMIT 1
)
WHERE level_id IS NULL AND skill_level IS NOT NULL;

-- ============================================================
-- NOTES
-- ============================================================
-- 1. The old enum columns (category, skill_levels) are kept for now
--    to maintain backward compatibility during migration
-- 2. New code should use category_id and level_id
-- 3. The enums can be dropped in a future migration once all code is updated
-- 4. Categories and levels can now be dynamically added/archived

