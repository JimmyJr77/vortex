-- ============================================================
-- Module 2: Family Accounts & Athlete Profiles
-- Migration: 003_module_2_families_athletes.sql
-- ============================================================

-- ============================================================
-- 1) FAMILY TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS family (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  primary_user_id     BIGINT REFERENCES app_user(id) ON DELETE SET NULL, -- primary guardian user
  family_name         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_facility ON family(facility_id);
CREATE INDEX IF NOT EXISTS idx_family_primary_user ON family(primary_user_id);

-- ============================================================
-- 2) FAMILY_GUARDIAN (Many-to-many: guardians linked to family)
-- ============================================================

CREATE TABLE IF NOT EXISTS family_guardian (
  family_id           BIGINT NOT NULL REFERENCES family(id) ON DELETE CASCADE,
  user_id             BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_guardian_user ON family_guardian(user_id);
CREATE INDEX IF NOT EXISTS idx_family_guardian_family ON family_guardian(family_id);

-- ============================================================
-- 3) ATHLETE TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS athlete (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  family_id           BIGINT NOT NULL REFERENCES family(id) ON DELETE CASCADE,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  date_of_birth       DATE NOT NULL,
  medical_notes       TEXT,
  internal_flags      TEXT, -- lightweight flags; can normalize later
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_athlete_family ON athlete(family_id);
CREATE INDEX IF NOT EXISTS idx_athlete_facility ON athlete(facility_id);
CREATE INDEX IF NOT EXISTS idx_athlete_name ON athlete(last_name, first_name);

-- ============================================================
-- 4) EMERGENCY_CONTACT TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS emergency_contact (
  id                  BIGSERIAL PRIMARY KEY,
  athlete_id          BIGINT NOT NULL REFERENCES athlete(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  relationship        TEXT,
  phone               TEXT NOT NULL,
  email               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emergency_contact_athlete ON emergency_contact(athlete_id);

-- ============================================================
-- 5) HELPER FUNCTION: Calculate age from date_of_birth
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_age(birth_date DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM AGE(birth_date));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 6) HELPER VIEW: Athlete with computed age
-- ============================================================

CREATE OR REPLACE VIEW athlete_with_age AS
SELECT 
  a.*,
  calculate_age(a.date_of_birth) as age
FROM athlete a;

-- ============================================================
-- 7) MIGRATE EXISTING MEMBERS TO FAMILIES (Optional)
-- ============================================================

-- This migration assumes existing members table exists
-- It creates families and athletes from existing members and member_children
-- Note: This is a one-time migration, so we check if families already exist

DO $$
DECLARE
  facility_record RECORD;
  member_record RECORD;
  child_record RECORD;
  new_family_id BIGINT;
  new_user_id BIGINT;
  new_athlete_id BIGINT;
BEGIN
  -- Get the facility
  SELECT id INTO facility_record FROM facility LIMIT 1;
  
  IF facility_record.id IS NULL THEN
    RAISE NOTICE 'No facility found, skipping member migration';
    RETURN;
  END IF;

  -- Only migrate if families table is empty
  IF EXISTS (SELECT 1 FROM family LIMIT 1) THEN
    RAISE NOTICE 'Families already exist, skipping member migration';
    RETURN;
  END IF;

  -- Migrate each member to a family
  FOR member_record IN 
    SELECT * FROM members WHERE NOT EXISTS (
      SELECT 1 FROM app_user WHERE email = members.email
    )
  LOOP
    -- Create app_user for the parent/guardian if doesn't exist
    INSERT INTO app_user (
      facility_id,
      role,
      email,
      phone,
      full_name,
      password_hash,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      facility_record.id,
      'PARENT_GUARDIAN'::user_role,
      member_record.email,
      member_record.phone,
      member_record.first_name || ' ' || member_record.last_name,
      member_record.password_hash,
      CASE WHEN member_record.account_status = 'active' THEN TRUE ELSE FALSE END,
      member_record.created_at,
      member_record.updated_at
    )
    ON CONFLICT (facility_id, email) DO UPDATE SET
      phone = EXCLUDED.phone,
      full_name = EXCLUDED.full_name
    RETURNING id INTO new_user_id;

    -- Get the user_id if it already existed
    IF new_user_id IS NULL THEN
      SELECT id INTO new_user_id FROM app_user WHERE email = member_record.email AND facility_id = facility_record.id;
    END IF;

    -- Create family
    INSERT INTO family (
      facility_id,
      primary_user_id,
      family_name,
      created_at,
      updated_at
    )
    VALUES (
      facility_record.id,
      new_user_id,
      member_record.first_name || ' ' || member_record.last_name || ' Family',
      member_record.created_at,
      member_record.updated_at
    )
    RETURNING id INTO new_family_id;

    -- Link guardian to family
    INSERT INTO family_guardian (family_id, user_id, is_primary, created_at)
    VALUES (new_family_id, new_user_id, TRUE, member_record.created_at)
    ON CONFLICT (family_id, user_id) DO NOTHING;

    -- Migrate children to athletes
    FOR child_record IN 
      SELECT * FROM member_children WHERE member_id = member_record.id
    LOOP
      INSERT INTO athlete (
        facility_id,
        family_id,
        first_name,
        last_name,
        date_of_birth,
        created_at,
        updated_at
      )
      VALUES (
        facility_record.id,
        new_family_id,
        child_record.first_name,
        child_record.last_name,
        child_record.date_of_birth,
        child_record.created_at,
        child_record.updated_at
      )
      RETURNING id INTO new_athlete_id;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Member migration completed';
END $$;

