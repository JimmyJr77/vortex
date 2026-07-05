-- Poll/signup FAQ-style panel lifecycle: expiry, dismiss, event dates

ALTER TABLE coaching.message_poll
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE coaching.message_poll
SET expires_at = COALESCE(closes_at, created_at) + interval '1 month'
WHERE expires_at IS NULL;

ALTER TABLE coaching.message_checklist
  ADD COLUMN IF NOT EXISTS event_date DATE;

ALTER TABLE coaching.message_checklist
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE coaching.message_checklist
SET event_date = created_at::date
WHERE event_date IS NULL;

UPDATE coaching.message_checklist
SET expires_at = (event_date + interval '30 days')::timestamptz
WHERE expires_at IS NULL;

ALTER TABLE coaching.message_checklist
  ALTER COLUMN event_date SET NOT NULL;

CREATE TABLE IF NOT EXISTS coaching.message_collaboration_dismiss (
  id            BIGSERIAL PRIMARY KEY,
  poll_id       BIGINT REFERENCES coaching.message_poll(id) ON DELETE CASCADE,
  checklist_id  BIGINT REFERENCES coaching.message_checklist(id) ON DELETE CASCADE,
  user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
  member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
  dismissed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR member_id IS NOT NULL),
  CHECK (
    (poll_id IS NOT NULL AND checklist_id IS NULL)
    OR (poll_id IS NULL AND checklist_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_collaboration_dismiss_poll_user
  ON coaching.message_collaboration_dismiss(poll_id, user_id)
  WHERE poll_id IS NOT NULL AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_collaboration_dismiss_poll_member
  ON coaching.message_collaboration_dismiss(poll_id, member_id)
  WHERE poll_id IS NOT NULL AND member_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_collaboration_dismiss_checklist_user
  ON coaching.message_collaboration_dismiss(checklist_id, user_id)
  WHERE checklist_id IS NOT NULL AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_collaboration_dismiss_checklist_member
  ON coaching.message_collaboration_dismiss(checklist_id, member_id)
  WHERE checklist_id IS NOT NULL AND member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_poll_expires
  ON coaching.message_poll(expires_at);

CREATE INDEX IF NOT EXISTS idx_message_checklist_expires
  ON coaching.message_checklist(expires_at);
