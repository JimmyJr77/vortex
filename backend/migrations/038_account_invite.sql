-- Migration 038: parent/guardian invite tokens for minor-initiated signup

CREATE TABLE IF NOT EXISTS account_invite (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  inviter_member_id BIGINT REFERENCES member(id) ON DELETE SET NULL,
  invitee_email TEXT NOT NULL,
  pending_family_id BIGINT REFERENCES family(id) ON DELETE CASCADE,
  pending_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_invite_email
  ON account_invite(LOWER(invitee_email));

CREATE INDEX IF NOT EXISTS idx_account_invite_pending_family
  ON account_invite(pending_family_id)
  WHERE used_at IS NULL;

COMMENT ON TABLE account_invite IS
  'Single-use magic links for parent/guardian completion of minor-initiated signup.';
