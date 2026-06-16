ALTER TABLE scheduling_signup
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scheduling_signup_archived
  ON scheduling_signup(form_id, archived_at)
  WHERE archived_at IS NOT NULL;
