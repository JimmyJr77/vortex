-- ============================================================
-- Coaching Module: Per-user inbox hide (personal archive)
-- Migration: 063_coaching_message_thread_inbox_hide.sql
-- IDEMPOTENT: safe to re-run on every boot.
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.message_thread_inbox_hide (
  id          BIGSERIAL PRIMARY KEY,
  thread_id   BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
  user_id     BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
  member_id   BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
  hidden_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_inbox_hide_user
  ON coaching.message_thread_inbox_hide(thread_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_inbox_hide_member
  ON coaching.message_thread_inbox_hide(thread_id, member_id)
  WHERE member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_thread_inbox_hide_thread
  ON coaching.message_thread_inbox_hide(thread_id);
