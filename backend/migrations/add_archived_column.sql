-- Add archived column to registrations table
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

