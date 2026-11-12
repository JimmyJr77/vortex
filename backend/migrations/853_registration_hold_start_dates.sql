-- The family may supply the start date after staff place the class hold.
ALTER TABLE scheduling_signup
  ALTER COLUMN enrollment_start_date DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS scheduling_signup_enrollment_start_date_required;

ALTER TABLE scheduling_signup
  ADD CONSTRAINT scheduling_signup_enrollment_start_date_required
    CHECK (enrollment_start_date IS NOT NULL OR (account_invite_id IS NOT NULL AND status IN ('pending_setup','cancelled')));
