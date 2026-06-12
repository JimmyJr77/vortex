-- Orphan metadata when a slot group is deleted but signup history is preserved.
ALTER TABLE scheduling_signup
  ADD COLUMN IF NOT EXISTS orphaned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_at_orphaning VARCHAR(50),
  ADD COLUMN IF NOT EXISTS orphaned_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS re_enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS re_enrolled_signup_id BIGINT REFERENCES scheduling_signup(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scheduling_signup_orphaned
  ON scheduling_signup(form_id, orphaned_at)
  WHERE orphaned_at IS NOT NULL AND re_enrolled_at IS NULL;
