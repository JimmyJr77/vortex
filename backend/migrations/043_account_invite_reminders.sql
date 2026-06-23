-- Migration 043: account invite reminders (no expiry) + retrievable token for resend

ALTER TABLE account_invite ALTER COLUMN expires_at DROP NOT NULL;

ALTER TABLE account_invite
  ADD COLUMN IF NOT EXISTS reminder_count INT NOT NULL DEFAULT 0;

ALTER TABLE account_invite
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;

ALTER TABLE account_invite
  ADD COLUMN IF NOT EXISTS token_ciphertext TEXT;

COMMENT ON COLUMN account_invite.reminder_count IS
  'Weekly reminder emails sent after the initial invite (max 4).';

COMMENT ON COLUMN account_invite.token_ciphertext IS
  'AES-GCM encrypted invite token so reminder emails can reuse the same link.';
