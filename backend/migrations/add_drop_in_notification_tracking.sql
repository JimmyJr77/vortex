-- Fresh databases create drop_in_registration in add_drop_in_entitlements.sql.
-- Keep the notification columns idempotent for both fresh and existing sites.
ALTER TABLE drop_in_registration
  ADD COLUMN IF NOT EXISTS member_confirmation_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS team_notification_email_sent_at TIMESTAMPTZ;
