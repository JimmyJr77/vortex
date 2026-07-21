CREATE TABLE IF NOT EXISTS enrollment_cancellation_request (
  id BIGSERIAL PRIMARY KEY,
  signup_id BIGINT NOT NULL REFERENCES scheduling_signup(id),
  family_billing_account_id BIGINT REFERENCES family_billing_account(id),
  requested_by_user_id BIGINT,
  request_reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined', 'withdrawn')),
  recommended_effective_date DATE,
  approved_effective_date DATE,
  is_fixed_term BOOLEAN NOT NULL DEFAULT FALSE,
  program_end_date DATE,
  review_note TEXT,
  reviewed_by_user_id BIGINT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS enrollment_cancellation_request_one_pending
  ON enrollment_cancellation_request(signup_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS enrollment_cancellation_request_review_queue
  ON enrollment_cancellation_request(status, created_at DESC);
