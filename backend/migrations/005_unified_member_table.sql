-- ============================================================
-- Migration: Unified Member Table
-- Merges app_user and athlete tables into a single member table
-- ============================================================

-- Step 1: Create unified member table
CREATE TABLE IF NOT EXISTS member (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  family_id           BIGINT REFERENCES family(id) ON DELETE SET NULL,
  
  -- Identity
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  date_of_birth       DATE,  -- NULL for adults who don't need it
  email               TEXT,   -- NULL for children
  phone               TEXT,
  address             TEXT,   -- General address field
  
  -- Billing Address (from enrollment form)
  billing_street      TEXT,
  billing_city        TEXT,
  billing_state       TEXT,
  billing_zip         TEXT,
  
  -- Authentication (optional - children don't need login)
  password_hash       TEXT,   -- NULL if no login access
  username            TEXT,
  
  -- Status & Activity
  status              VARCHAR(20) DEFAULT 'legacy' 
                      CHECK (status IN ('enrolled', 'legacy', 'archived', 'family_active')),
  is_active           BOOLEAN DEFAULT TRUE,
  family_is_active    BOOLEAN DEFAULT FALSE,  -- True if member or their family is active
  
  -- Athlete-specific (nullable for non-athletes)
  medical_notes       TEXT,
  internal_flags      TEXT,
  
  -- Metadata
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE (facility_id, email) WHERE email IS NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_member_facility ON member(facility_id);
CREATE INDEX IF NOT EXISTS idx_member_family ON member(family_id);
CREATE INDEX IF NOT EXISTS idx_member_email ON member(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_member_status ON member(status);
CREATE INDEX IF NOT EXISTS idx_member_active ON member(is_active);
CREATE INDEX IF NOT EXISTS idx_member_family_active ON member(family_is_active);
CREATE INDEX IF NOT EXISTS idx_member_name ON member(last_name, first_name);

-- Step 2: Create parent_guardian_authority table for legal authority
CREATE TABLE IF NOT EXISTS parent_guardian_authority (
  id                  BIGSERIAL PRIMARY KEY,
  parent_member_id    BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  child_member_id     BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  has_legal_authority BOOLEAN NOT NULL DEFAULT TRUE,
  relationship        TEXT,  -- e.g., 'Parent', 'Guardian', 'Legal Guardian'
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure unique parent-child relationship
  UNIQUE (parent_member_id, child_member_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_guardian_parent ON parent_guardian_authority(parent_member_id);
CREATE INDEX IF NOT EXISTS idx_parent_guardian_child ON parent_guardian_authority(child_member_id);
CREATE INDEX IF NOT EXISTS idx_parent_guardian_legal ON parent_guardian_authority(has_legal_authority);

-- Step 3: Migrate data from app_user to member
-- First, insert all app_user records as members
INSERT INTO member (
  id,
  facility_id,
  first_name,
  last_name,
  email,
  phone,
  address,
  password_hash,
  username,
  is_active,
  status,
  created_at,
  updated_at
)
SELECT 
  id,
  facility_id,
  -- Split full_name into first_name and last_name
  SPLIT_PART(full_name, ' ', 1) as first_name,
  SUBSTRING(full_name FROM LENGTH(SPLIT_PART(full_name, ' ', 1)) + 2) as last_name,
  email,
  phone,
  address,
  password_hash,
  username,
  is_active,
  CASE 
    WHEN is_active = FALSE THEN 'archived'
    ELSE 'legacy'
  END as status,
  created_at,
  updated_at
FROM app_user
ON CONFLICT DO NOTHING;

-- Step 4: Migrate data from athlete to member
-- For athletes that don't have a corresponding app_user record
INSERT INTO member (
  facility_id,
  family_id,
  first_name,
  last_name,
  date_of_birth,
  medical_notes,
  internal_flags,
  status,
  is_active,
  created_at,
  updated_at
)
SELECT 
  a.facility_id,
  a.family_id,
  a.first_name,
  a.last_name,
  a.date_of_birth,
  a.medical_notes,
  a.internal_flags,
  CASE 
    WHEN a.status = 'stand-bye' THEN 'legacy'
    WHEN a.status = 'archived' THEN 'archived'
    WHEN a.status = 'enrolled' THEN 'enrolled'
    ELSE 'legacy'
  END as status,
  CASE WHEN a.status = 'archived' THEN FALSE ELSE TRUE END as is_active,
  a.created_at,
  a.updated_at
FROM athlete a
WHERE a.user_id IS NULL  -- Only athletes without user_id (children)
ON CONFLICT DO NOTHING;

-- Step 5: Update existing member records with athlete data where user_id exists
-- This merges app_user and athlete data for adults who train
UPDATE member m
SET 
  family_id = a.family_id,
  date_of_birth = a.date_of_birth,
  medical_notes = a.medical_notes,
  internal_flags = a.internal_flags,
  status = CASE 
    WHEN a.status = 'stand-bye' THEN 'legacy'
    WHEN a.status = 'archived' THEN 'archived'
    WHEN a.status = 'enrolled' THEN 'enrolled'
    ELSE m.status
  END,
  updated_at = GREATEST(m.updated_at, a.updated_at)
FROM athlete a
WHERE a.user_id = m.id;

-- Step 6: Create member_program table (replaces athlete_program)
CREATE TABLE IF NOT EXISTS member_program (
  id                  BIGSERIAL PRIMARY KEY,
  member_id           BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  program_id          BIGINT NOT NULL REFERENCES program(id) ON DELETE CASCADE,
  iteration_id        BIGINT REFERENCES class_iteration(id) ON DELETE CASCADE,
  days_per_week       INTEGER NOT NULL,
  selected_days       JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, program_id, iteration_id)
);

CREATE INDEX IF NOT EXISTS idx_member_program_member ON member_program(member_id);
CREATE INDEX IF NOT EXISTS idx_member_program_program ON member_program(program_id);
CREATE INDEX IF NOT EXISTS idx_member_program_iteration ON member_program(iteration_id);

-- Step 7: Migrate athlete_program to member_program
-- Map athlete_id to member_id
INSERT INTO member_program (
  member_id,
  program_id,
  iteration_id,
  days_per_week,
  selected_days,
  created_at,
  updated_at
)
SELECT 
  -- Find member_id: either from athlete.user_id or from athlete.id if no user_id
  COALESCE(
    (SELECT id FROM member WHERE id = a.user_id LIMIT 1),
    (SELECT id FROM member WHERE first_name = a.first_name 
     AND last_name = a.last_name 
     AND date_of_birth = a.date_of_birth 
     AND family_id = a.family_id
     LIMIT 1)
  ) as member_id,
  ap.program_id,
  ap.iteration_id,
  ap.days_per_week,
  ap.selected_days,
  ap.created_at,
  ap.updated_at
FROM athlete_program ap
JOIN athlete a ON ap.athlete_id = a.id
WHERE COALESCE(
  (SELECT id FROM member WHERE id = a.user_id LIMIT 1),
  (SELECT id FROM member WHERE first_name = a.first_name 
   AND last_name = a.last_name 
   AND date_of_birth = a.date_of_birth 
   AND family_id = a.family_id
   LIMIT 1)
) IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 8: Update family_guardian to reference member instead of app_user
-- First, add new column
ALTER TABLE family_guardian ADD COLUMN IF NOT EXISTS member_id BIGINT REFERENCES member(id) ON DELETE CASCADE;

-- Migrate user_id to member_id
UPDATE family_guardian fg
SET member_id = fg.user_id
WHERE fg.user_id IS NOT NULL;

-- Step 9: Update family.primary_user_id to primary_member_id
ALTER TABLE family ADD COLUMN IF NOT EXISTS primary_member_id BIGINT REFERENCES member(id) ON DELETE SET NULL;

UPDATE family f
SET primary_member_id = f.primary_user_id
WHERE f.primary_user_id IS NOT NULL;

-- Step 10: Update emergency_contact to reference member
ALTER TABLE emergency_contact ADD COLUMN IF NOT EXISTS member_id BIGINT REFERENCES member(id) ON DELETE CASCADE;

-- Migrate athlete_id to member_id
UPDATE emergency_contact ec
SET member_id = (
  SELECT m.id 
  FROM member m
  JOIN athlete a ON m.first_name = a.first_name 
    AND m.last_name = a.last_name 
    AND m.date_of_birth = a.date_of_birth
    AND COALESCE(m.family_id, 0) = COALESCE(a.family_id, 0)
  WHERE a.id = ec.athlete_id
  LIMIT 1
)
WHERE ec.athlete_id IS NOT NULL;

-- Step 11: Update user_role to reference member
ALTER TABLE user_role ADD COLUMN IF NOT EXISTS member_id BIGINT REFERENCES member(id) ON DELETE CASCADE;

UPDATE user_role ur
SET member_id = ur.user_id
WHERE ur.user_id IS NOT NULL;

-- Step 12: Function to update family_is_active status
CREATE OR REPLACE FUNCTION update_family_active_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all members in the same family
  UPDATE member
  SET family_is_active = TRUE,
      status = CASE 
        WHEN status = 'archived' THEN 'archived'
        WHEN status = 'enrolled' THEN 'enrolled'
        ELSE 'family_active'
      END
  WHERE family_id = NEW.family_id
    AND (NEW.family_is_active = TRUE OR NEW.is_active = TRUE);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update family_is_active when member is updated
CREATE TRIGGER trigger_update_family_active
AFTER UPDATE OF is_active, family_is_active ON member
FOR EACH ROW
WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active OR OLD.family_is_active IS DISTINCT FROM NEW.family_is_active)
EXECUTE FUNCTION update_family_active_status();

-- Step 13: Function to calculate and set family_is_active based on family status
CREATE OR REPLACE FUNCTION calculate_family_active_status()
RETURNS void AS $$
BEGIN
  -- Set family_is_active = TRUE for all members in families where at least one member is active
  UPDATE member m1
  SET family_is_active = TRUE,
      status = CASE 
        WHEN m1.status = 'archived' THEN 'archived'
        WHEN m1.status = 'enrolled' THEN 'enrolled'
        WHEN EXISTS (
          SELECT 1 FROM member m2 
          WHERE m2.family_id = m1.family_id 
          AND m2.is_active = TRUE
          AND m2.id != m1.id
        ) THEN 'family_active'
        ELSE m1.status
      END
  WHERE EXISTS (
    SELECT 1 FROM member m2 
    WHERE m2.family_id = m1.family_id 
    AND m2.is_active = TRUE
    AND m2.id != m1.id
  );
END;
$$ LANGUAGE plpgsql;

-- Run the function to set initial family_is_active status
SELECT calculate_family_active_status();

-- Note: The old tables (app_user, athlete, athlete_program) will be kept for now
-- They can be dropped in a separate migration after verification
-- DROP TABLE IF EXISTS athlete_program CASCADE;
-- DROP TABLE IF EXISTS athlete CASCADE;
-- DROP TABLE IF EXISTS app_user CASCADE;

