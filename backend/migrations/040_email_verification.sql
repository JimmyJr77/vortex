-- Migration 040: email address verification for app accounts

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS email_verification_token (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_token_user
  ON email_verification_token(user_id)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_verification_token_email
  ON email_verification_token(LOWER(email));

COMMENT ON TABLE email_verification_token IS
  'Single-use links emailed to confirm an app_user email address.';
