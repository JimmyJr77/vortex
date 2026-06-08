-- Link events to optional scheduling signup forms
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS scheduling_form_id BIGINT REFERENCES scheduling_form(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_scheduling_form_id ON events(scheduling_form_id);
