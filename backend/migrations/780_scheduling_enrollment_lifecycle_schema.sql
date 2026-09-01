-- Move the enrollment lifecycle contract out of request handlers. Billing and
-- scheduling actions may assume these columns and canonical statuses exist
-- after deploy/boot migration readiness succeeds.

ALTER TABLE scheduling_signup
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manual_discount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS manual_discount_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS manual_discount_reason TEXT,
  ADD COLUMN IF NOT EXISTS manual_discount_rule_id BIGINT,
  ADD COLUMN IF NOT EXISTS cancel_effective_date DATE,
  ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pause_effective_date DATE,
  ADD COLUMN IF NOT EXISTS pause_mode VARCHAR(20),
  ADD COLUMN IF NOT EXISTS enrollment_start_date DATE DEFAULT CURRENT_DATE;

UPDATE scheduling_signup
SET enrollment_start_date = COALESCE(created_at::date, CURRENT_DATE)
WHERE enrollment_start_date IS NULL;

ALTER TABLE scheduling_signup
  ALTER COLUMN enrollment_start_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN enrollment_start_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduling_signup_enrollment_start_date
  ON scheduling_signup (enrollment_start_date);

-- Historical databases can carry unnamed inline status checks in addition to
-- scheduling_signup_status_check. Remove every status check before installing
-- the single canonical constraint.
DO $$
DECLARE
  status_constraint RECORD;
BEGIN
  FOR status_constraint IN
    SELECT constraint_row.conname
    FROM pg_constraint constraint_row
    JOIN pg_class table_row ON constraint_row.conrelid = table_row.oid
    JOIN pg_namespace namespace_row ON table_row.relnamespace = namespace_row.oid
    WHERE namespace_row.nspname = 'public'
      AND table_row.relname = 'scheduling_signup'
      AND constraint_row.contype = 'c'
      AND pg_get_constraintdef(constraint_row.oid) ILIKE '%status%'
  LOOP
    EXECUTE format(
      'ALTER TABLE scheduling_signup DROP CONSTRAINT IF EXISTS %I',
      status_constraint.conname
    );
  END LOOP;
END $$;

UPDATE scheduling_signup
SET status = 'confirmed'
WHERE status NOT IN ('confirmed', 'waitlisted', 'cancelled', 'paused', 'completed');

ALTER TABLE scheduling_signup
  ADD CONSTRAINT scheduling_signup_status_check
  CHECK (status IN ('confirmed', 'waitlisted', 'cancelled', 'paused', 'completed'));
