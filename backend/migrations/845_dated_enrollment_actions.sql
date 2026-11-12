-- Staff action dates and their execution history share the canonical enrollment.
ALTER TABLE scheduling_signup ADD COLUMN IF NOT EXISTS waitlisted_at timestamptz;
CREATE TABLE IF NOT EXISTS enrollment_action (
  id bigserial PRIMARY KEY,
  signup_id bigint NOT NULL REFERENCES scheduling_signup(id) ON DELETE RESTRICT,
  facility_id bigint NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
  requested_status text NOT NULL CHECK (requested_status IN ('confirmed','waitlisted','paused','cancelled')),
  previous_status text NOT NULL,
  effective_date date NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_by_user_id bigint,
  request_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','cancelled')),
  applied_at timestamptz,
  cancelled_at timestamptz,
  last_error text,
  UNIQUE (signup_id,request_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS enrollment_action_one_pending
  ON enrollment_action(signup_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS enrollment_action_due
  ON enrollment_action(effective_date,id) WHERE status='pending';

-- A resumed student only keeps credits for sessions actually missed. Original credit rows remain.
ALTER TABLE billing_pause_credit ADD COLUMN IF NOT EXISTS revoked_cents integer NOT NULL DEFAULT 0
  CHECK (revoked_cents >= 0 AND revoked_cents <= credit_cents);
