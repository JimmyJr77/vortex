ALTER TABLE scheduling_signup
  ADD COLUMN IF NOT EXISTS enrollment_start_date DATE;

UPDATE scheduling_signup
SET enrollment_start_date = COALESCE(created_at::date, CURRENT_DATE)
WHERE enrollment_start_date IS NULL;

ALTER TABLE scheduling_signup
  ALTER COLUMN enrollment_start_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN enrollment_start_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduling_signup_enrollment_start_date
  ON scheduling_signup(enrollment_start_date);
