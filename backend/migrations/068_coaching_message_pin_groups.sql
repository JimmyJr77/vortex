-- Per-user message pin groups (supersedes thread-global coaching.message_pin for UI)

CREATE TABLE IF NOT EXISTS coaching.message_pin_group (
  id          BIGSERIAL PRIMARY KEY,
  thread_id   BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
  user_id     BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
  member_id   BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_message_pin_group_thread_user
  ON coaching.message_pin_group(thread_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_pin_group_thread_member
  ON coaching.message_pin_group(thread_id, member_id)
  WHERE member_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS coaching.message_pin_group_item (
  group_id    BIGINT NOT NULL REFERENCES coaching.message_pin_group(id) ON DELETE CASCADE,
  message_id  BIGINT NOT NULL REFERENCES coaching.message(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_pin_group_item_message
  ON coaching.message_pin_group_item(message_id);
