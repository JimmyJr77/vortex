ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS initial_waiver_checked_at TIMESTAMPTZ;

COMMENT ON COLUMN app_user.initial_waiver_checked_at IS
  'Records completion of the first sign-in waiver prompt. Waiver signatures are recorded separately in member_waiver_acceptance.';
