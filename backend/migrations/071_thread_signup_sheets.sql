-- Thread-level poll/signup list UX

ALTER TABLE coaching.message_poll
  ADD COLUMN IF NOT EXISTS is_closed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE coaching.message_checklist
  ADD COLUMN IF NOT EXISTS title TEXT;

ALTER TABLE coaching.message_checklist
  ADD COLUMN IF NOT EXISTS sheet_type TEXT NOT NULL DEFAULT 'items';

ALTER TABLE coaching.message_checklist
  ADD COLUMN IF NOT EXISTS config_json JSONB NOT NULL DEFAULT '{}';

ALTER TABLE coaching.message_checklist
  ADD COLUMN IF NOT EXISTS closes_at TIMESTAMPTZ;

ALTER TABLE coaching.message_checklist
  ADD COLUMN IF NOT EXISTS is_closed BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_checklist_sheet_type_check'
      AND conrelid = 'coaching.message_checklist'::regclass
  ) THEN
    ALTER TABLE coaching.message_checklist
      ADD CONSTRAINT message_checklist_sheet_type_check
      CHECK (sheet_type IN ('rsvp', 'items', 'support'));
  END IF;
END $$;

UPDATE coaching.message_checklist
SET title = 'Signup list'
WHERE title IS NULL;

ALTER TABLE coaching.message_checklist
  ALTER COLUMN title SET NOT NULL;

CREATE TABLE IF NOT EXISTS coaching.message_signup_response (
  id            BIGSERIAL PRIMARY KEY,
  checklist_id  BIGINT NOT NULL REFERENCES coaching.message_checklist(id) ON DELETE CASCADE,
  user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
  member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
  response_json JSONB NOT NULL DEFAULT '{}',
  responded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_signup_response_user
  ON coaching.message_signup_response(checklist_id, user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_signup_response_member
  ON coaching.message_signup_response(checklist_id, member_id) WHERE member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_checklist_closed
  ON coaching.message_checklist(is_closed, closes_at);

CREATE INDEX IF NOT EXISTS idx_message_poll_closed
  ON coaching.message_poll(is_closed, closes_at);
