-- Extend scheduling signup status to support waitlist
ALTER TABLE scheduling_signup DROP CONSTRAINT IF EXISTS scheduling_signup_status_check;

ALTER TABLE scheduling_signup
  ADD CONSTRAINT scheduling_signup_status_check
  CHECK (status IN ('confirmed', 'waitlisted', 'cancelled'));

ALTER TABLE scheduling_signup
  ADD COLUMN IF NOT EXISTS promotion_email_sent_at TIMESTAMPTZ;

ALTER TABLE scheduling_signup
  ADD COLUMN IF NOT EXISTS demotion_email_sent_at TIMESTAMPTZ;
