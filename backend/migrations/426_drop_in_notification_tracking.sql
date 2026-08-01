ALTER TABLE drop_in_registration
  ADD COLUMN IF NOT EXISTS member_confirmation_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS team_notification_email_sent_at TIMESTAMPTZ;
