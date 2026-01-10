-- ============================================================
-- Migration: Drop All Legacy Member Tables
-- Drops old members, member_children, and athlete tables
-- These have been replaced by the unified member table
-- ============================================================
-- 
-- PREREQUISITES:
-- 1. Migration 005_unified_member_table.sql must be completed
-- 2. All data must be migrated to the unified member table
-- 3. Verify with: node verify-member-migration.js
--
-- SAFETY NOTES:
-- - This uses CASCADE to drop dependent objects (indexes, constraints, etc.)
-- - The app_user table is NOT dropped (still needed for admin authentication)
-- - Run verify-member-migration.js first to confirm data is migrated
-- ============================================================

-- Step 1: Drop member_children table (legacy - replaced by parent_guardian_authority)
-- This table had a foreign key to members, so drop it first
DROP TABLE IF EXISTS member_children CASCADE;

-- Step 2: Drop old members table (legacy - replaced by unified member table)
-- This was the original members table before the unified member system
DROP TABLE IF EXISTS members CASCADE;

-- Step 3: Drop athlete table (legacy - data migrated to unified member table)
-- All athlete records should have been migrated to the member table
-- Note: athlete_program was already migrated to member_program in migration 005
DROP TABLE IF EXISTS athlete CASCADE;

-- Step 4: Drop athlete_program table if it still exists (should have been migrated to member_program)
-- This was already handled in migration 005, but including for safety
DROP TABLE IF EXISTS athlete_program CASCADE;

-- Verification queries (run these after the migration to verify):
-- 
-- Check that legacy tables are gone:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('members', 'member_children', 'athlete', 'athlete_program');
-- (Should return 0 rows)
--
-- Check that unified member table still exists:
-- SELECT EXISTS (
--   SELECT FROM information_schema.tables 
--   WHERE table_schema = 'public' 
--   AND table_name = 'member'
-- );
-- (Should return true)
--
-- Check that app_user table still exists (needed for auth):
-- SELECT EXISTS (
--   SELECT FROM information_schema.tables 
--   WHERE table_schema = 'public' 
--   AND table_name = 'app_user'
-- );
-- (Should return true)


