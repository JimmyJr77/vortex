-- Create event_edit_log table to track all changes to events
CREATE TABLE IF NOT EXISTS event_edit_log (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  admin_email VARCHAR(255) NOT NULL,
  admin_name VARCHAR(255),
  changes JSONB NOT NULL, -- Stores what fields were changed and their old/new values
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_edit_log_event_id ON event_edit_log(event_id);
CREATE INDEX IF NOT EXISTS idx_event_edit_log_created_at ON event_edit_log(created_at DESC);

