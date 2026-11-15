-- Preserve staff attribution independently of the prospect's relationship to athletes.
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS submitted_by_user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_by_name TEXT,
  ADD COLUMN IF NOT EXISTS newsletter_opt_in BOOLEAN;
