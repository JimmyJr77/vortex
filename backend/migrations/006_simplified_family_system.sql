-- ============================================================
-- Migration: Simplified Family System
-- Removes primary_user_id/primary_member_id concept
-- Adds family username/password for joining families
-- Adds parent_guardian_ids array to member table
-- Makes all members equal - no distinction between users/athletes
-- ============================================================

-- Step 1: Update family table to remove primary member concept
-- Add family_username and family_password_hash
ALTER TABLE family ADD COLUMN IF NOT EXISTS family_username TEXT UNIQUE;
ALTER TABLE family ADD COLUMN IF NOT EXISTS family_password_hash TEXT;
ALTER TABLE family ADD COLUMN IF NOT EXISTS family_name TEXT;

-- Make primary_user_id and primary_member_id nullable (will remove later)
-- Note: These columns may be removed in future migration after data cleanup

-- Step 2: Add parent_guardian_ids array to member table
ALTER TABLE member ADD COLUMN IF NOT EXISTS parent_guardian_ids BIGINT[] DEFAULT '{}';
ALTER TABLE member ADD COLUMN IF NOT EXISTS has_completed_waivers BOOLEAN DEFAULT FALSE;
ALTER TABLE member ADD COLUMN IF NOT EXISTS waiver_completion_date TIMESTAMPTZ;

-- Create index for parent_guardian_ids (using GIN for array searches)
CREATE INDEX IF NOT EXISTS idx_member_parent_guardian_ids ON member USING GIN(parent_guardian_ids);

-- Create index for waiver status (to quickly find athletes)
CREATE INDEX IF NOT EXISTS idx_member_waivers ON member(has_completed_waivers);

-- Step 3: Update member status enum to reflect new athlete logic
-- Status: 'legacy' (default), 'enrolled' (has enrollment), 'athlete' (enrolled + waivers), 'archived'
-- We'll use status = 'athlete' for members who have completed waivers AND have enrollments
-- This replaces the old distinction between users and athletes

-- Step 4: Create function to calculate athlete status based on enrollments + waivers
CREATE OR REPLACE FUNCTION update_member_athlete_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If member has enrollments AND has completed waivers, set status to 'athlete'
  -- If member has enrollments but no waivers, set status to 'enrolled'
  -- Otherwise keep as 'legacy'
  IF EXISTS (
    SELECT 1 FROM member_program WHERE member_id = NEW.id
  ) AND NEW.has_completed_waivers = TRUE THEN
    NEW.status = 'athlete';
  ELSIF EXISTS (
    SELECT 1 FROM member_program WHERE member_id = NEW.id
  ) THEN
    NEW.status = 'enrolled';
  ELSE
    -- Keep existing status or set to 'legacy' if not set
    IF NEW.status IS NULL OR NEW.status = '' THEN
      NEW.status = 'legacy';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update athlete status
DROP TRIGGER IF EXISTS trigger_update_athlete_status ON member;
CREATE TRIGGER trigger_update_athlete_status
BEFORE INSERT OR UPDATE ON member
FOR EACH ROW
EXECUTE FUNCTION update_member_athlete_status();

-- Step 5: Create function to update athlete status when enrollments change
CREATE OR REPLACE FUNCTION update_athlete_status_on_enrollment()
RETURNS TRIGGER AS $$
BEGIN
  -- Update member status when enrollment is added/removed
  UPDATE member 
  SET status = CASE
    WHEN has_completed_waivers = TRUE THEN 'athlete'
    ELSE 'enrolled'
  END
  WHERE id = COALESCE(NEW.member_id, OLD.member_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on member_program table
DROP TRIGGER IF EXISTS trigger_update_status_on_enrollment ON member_program;
CREATE TRIGGER trigger_update_status_on_enrollment
AFTER INSERT OR DELETE ON member_program
FOR EACH ROW
EXECUTE FUNCTION update_athlete_status_on_enrollment();

-- Step 6: Create view to easily query members with their children (for adults)
CREATE OR REPLACE VIEW member_children_view AS
SELECT 
  m.id as parent_id,
  m.first_name as parent_first_name,
  m.last_name as parent_last_name,
  m.email as parent_email,
  array_agg(child.id) as child_ids,
  array_agg(child.first_name || ' ' || child.last_name) as child_names
FROM member m
LEFT JOIN member child ON child.parent_guardian_ids @> ARRAY[m.id]::bigint[]
WHERE child.id IS NOT NULL
GROUP BY m.id, m.first_name, m.last_name, m.email;

-- Step 7: Ensure family_username is unique per facility (if facility_id exists)
-- Note: This will be handled in application code to allow same username across facilities
-- But within a facility, username should be unique

-- Step 8: Create index for family_username for faster searches
CREATE INDEX IF NOT EXISTS idx_family_username ON family(family_username) WHERE family_username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_family_name ON family(family_name);

-- Step 9: Migrate existing data
-- Set family_name from family_name if exists, or generate from first member's name
UPDATE family f
SET family_name = COALESCE(
  f.family_name,
  (SELECT first_name || ' ' || last_name || ' Family' 
   FROM member m 
   WHERE m.family_id = f.id 
   ORDER BY m.created_at 
   LIMIT 1),
  'Family ' || f.id::TEXT
)
WHERE f.family_name IS NULL OR f.family_name = '';

-- Step 10: Populate parent_guardian_ids from existing parent_guardian_authority table
-- This migrates existing relationships
UPDATE member child
SET parent_guardian_ids = (
  SELECT array_agg(parent_member_id)
  FROM parent_guardian_authority
  WHERE child_member_id = child.id
  AND has_legal_authority = TRUE
)
WHERE EXISTS (
  SELECT 1 FROM parent_guardian_authority
  WHERE child_member_id = child.id
);

-- Note: The parent_guardian_authority table will be kept for relationship metadata
-- but the primary relationship is now stored in member.parent_guardian_ids

-- Step 11: Add comments for documentation
COMMENT ON COLUMN member.parent_guardian_ids IS 'Array of member IDs who are legal guardians/parents of this member (for children under 18)';
COMMENT ON COLUMN member.has_completed_waivers IS 'TRUE if member has completed required waivers/participation forms';
COMMENT ON COLUMN member.waiver_completion_date IS 'Date when waivers were completed';
COMMENT ON COLUMN family.family_username IS 'Unique username for family - used for family joining/search';
COMMENT ON COLUMN family.family_password_hash IS 'Hashed password for family - required to join existing family';
COMMENT ON COLUMN member.status IS 'Member status: legacy (default), enrolled (has enrollment), athlete (enrolled + waivers), archived';

