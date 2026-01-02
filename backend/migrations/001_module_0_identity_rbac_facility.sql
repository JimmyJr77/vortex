-- ============================================================
-- Module 0: Identity, Roles, Facility Settings
-- Migration: 001_module_0_identity_rbac_facility.sql
-- ============================================================

-- ============================================================
-- 0) ENUMS - User Role
-- ============================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('OWNER_ADMIN', 'COACH', 'PARENT_GUARDIAN', 'ATHLETE_VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 1) FACILITY (single instance; enforced by app logic)
-- ============================================================

CREATE TABLE IF NOT EXISTS facility (
  id                  BIGSERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  timezone            TEXT NOT NULL DEFAULT 'America/New_York',
  logo_url            TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for facility lookups (though we'll only have one)
CREATE INDEX IF NOT EXISTS idx_facility_id ON facility(id);

-- Seed default facility if none exists
INSERT INTO facility (name, timezone)
SELECT 'Vortex Athletics', 'America/New_York'
WHERE NOT EXISTS (SELECT 1 FROM facility);

-- ============================================================
-- 2) APP_USER (replaces/extends existing admins table)
-- ============================================================

CREATE TABLE IF NOT EXISTS app_user (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  role                user_role NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT,
  full_name           TEXT NOT NULL,
  password_hash       TEXT, -- if using internal auth; otherwise external provider id
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, email)
);

CREATE INDEX IF NOT EXISTS idx_app_user_facility_role ON app_user(facility_id, role);
CREATE INDEX IF NOT EXISTS idx_app_user_email ON app_user(email);
CREATE INDEX IF NOT EXISTS idx_app_user_active ON app_user(is_active);

-- ============================================================
-- 3) MIGRATE EXISTING ADMINS TO APP_USER
-- ============================================================

-- Migrate existing admins to app_user as OWNER_ADMIN
-- This preserves existing admin accounts
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
SELECT 
  (SELECT id FROM facility LIMIT 1) as facility_id,
  'OWNER_ADMIN'::user_role as role,
  email,
  phone,
  COALESCE(first_name || ' ' || last_name, 'Admin User') as full_name,
  password_hash,
  TRUE as is_active,
  created_at,
  updated_at
FROM admins
WHERE NOT EXISTS (
  SELECT 1 FROM app_user 
  WHERE app_user.email = admins.email
);

-- ============================================================
-- 4) MIGRATE EXISTING MEMBERS TO APP_USER (as PARENT_GUARDIAN)
-- ============================================================

-- Migrate existing members to app_user as PARENT_GUARDIAN
-- Note: This assumes members are parents/guardians
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
SELECT 
  (SELECT id FROM facility LIMIT 1) as facility_id,
  'PARENT_GUARDIAN'::user_role as role,
  email,
  phone,
  COALESCE(first_name || ' ' || last_name, 'Member') as full_name,
  password_hash,
  CASE 
    WHEN account_status = 'active' THEN TRUE 
    ELSE FALSE 
  END as is_active,
  created_at,
  updated_at
FROM members
WHERE NOT EXISTS (
  SELECT 1 FROM app_user 
  WHERE app_user.email = members.email
);

-- ============================================================
-- NOTES
-- ============================================================
-- 1. This migration creates the foundation for Module 0
-- 2. Existing admins are migrated to OWNER_ADMIN role
-- 3. Existing members are migrated to PARENT_GUARDIAN role
-- 4. A default facility is created if none exists
-- 5. The old 'admins' and 'members' tables remain for backward compatibility
--    You can drop them later after verifying the migration worked correctly

