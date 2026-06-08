-- Soft-delete scheduling forms (retain signups, slots, and related data)

ALTER TABLE scheduling_form
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
