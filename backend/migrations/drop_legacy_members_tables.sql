-- Migration: Drop legacy members and member_children tables
-- These tables have been replaced by app_user, family, and athlete tables
-- Run this migration after ensuring all data has been migrated

-- Drop member_children table first (has foreign key to members)
DROP TABLE IF EXISTS member_children CASCADE;

-- Drop members table
DROP TABLE IF EXISTS members CASCADE;

-- Note: This migration is safe to run even if tables don't exist
-- The CASCADE will also drop any dependent objects (indexes, constraints, etc.)

