-- Facility-scoped member/coach portal sidebar visibility (hidden tab keys in JSONB).
ALTER TABLE facility
  ADD COLUMN IF NOT EXISTS portal_config JSONB NOT NULL DEFAULT '{}'::jsonb;
