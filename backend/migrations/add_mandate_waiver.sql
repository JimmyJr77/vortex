-- Mandate waiver option + email delivery tracking for scheduling signups

ALTER TABLE scheduling_form
  ADD COLUMN IF NOT EXISTS mandate_waiver BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE scheduling_signup
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ;

ALTER TABLE scheduling_signup
  ADD COLUMN IF NOT EXISTS waiver_email_sent_at TIMESTAMPTZ;
