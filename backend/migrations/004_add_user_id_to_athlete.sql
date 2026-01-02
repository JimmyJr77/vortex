-- ============================================================
-- Migration: 004_add_user_id_to_athlete.sql
-- Purpose: Allow adults (parents/guardians) to also be athletes
-- ============================================================

-- Add optional user_id to athlete table to link athlete records to app_user
-- This allows a parent/guardian (app_user with PARENT_GUARDIAN role) 
-- to also have an athlete record if they decide to train
ALTER TABLE athlete 
ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_athlete_user_id ON athlete(user_id);

-- Add comment explaining the relationship
COMMENT ON COLUMN athlete.user_id IS 'Optional link to app_user. If set, this athlete is also a user (e.g., parent/guardian who trains). If NULL, athlete is a child.';

