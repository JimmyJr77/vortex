-- Single-use links for view-only enrollment registration receipts.

CREATE TABLE IF NOT EXISTS enrollment_receipt_token (
  id                    BIGSERIAL PRIMARY KEY,
  member_id             BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  scheduling_signup_id    BIGINT REFERENCES scheduling_signup(id) ON DELETE SET NULL,
  member_program_id     BIGINT REFERENCES member_program(id) ON DELETE SET NULL,
  recipient_email       TEXT NOT NULL,
  token_hash            TEXT NOT NULL,
  payload               JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at            TIMESTAMPTZ NOT NULL,
  viewed_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_receipt_token_member
  ON enrollment_receipt_token(member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrollment_receipt_token_signup
  ON enrollment_receipt_token(scheduling_signup_id)
  WHERE scheduling_signup_id IS NOT NULL;

COMMENT ON TABLE enrollment_receipt_token IS
  'View-only enrollment receipt magic links emailed after class/program registration.';
