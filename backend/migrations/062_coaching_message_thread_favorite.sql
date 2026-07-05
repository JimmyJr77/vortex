-- ============================================================
-- Coaching Module: Per-user thread favorites
-- Migration: 062_coaching_message_thread_favorite.sql
-- IDEMPOTENT: safe to re-run on every boot.
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.message_thread_favorite (
  id            BIGSERIAL PRIMARY KEY,
  thread_id     BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
  user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
  member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
  favorited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_favorite_user
  ON coaching.message_thread_favorite(thread_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_favorite_member
  ON coaching.message_thread_favorite(thread_id, member_id)
  WHERE member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_thread_favorite_user_at
  ON coaching.message_thread_favorite(user_id, favorited_at)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_thread_favorite_member_at
  ON coaching.message_thread_favorite(member_id, favorited_at)
  WHERE member_id IS NOT NULL;
