-- Add archived column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Create index for better performance when filtering archived events
CREATE INDEX IF NOT EXISTS idx_events_archived ON events(archived);

