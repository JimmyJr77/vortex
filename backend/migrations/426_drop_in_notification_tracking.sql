-- The durable drop-in table is introduced by a later add-on migration on a
-- fresh database. Existing installations already have it at this point.
DO $drop_in_notification_tracking$
BEGIN
  IF to_regclass('public.drop_in_registration') IS NOT NULL THEN
    ALTER TABLE drop_in_registration
      ADD COLUMN IF NOT EXISTS member_confirmation_email_sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS team_notification_email_sent_at TIMESTAMPTZ;
  END IF;
END;
$drop_in_notification_tracking$;
