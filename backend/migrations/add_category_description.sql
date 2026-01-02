-- Add description column to program_categories table
ALTER TABLE program_categories ADD COLUMN IF NOT EXISTS description TEXT;

