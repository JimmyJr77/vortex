-- ============================================================
-- Coaching Module: Messaging enhancements
-- Migration: 060_coaching_message_enhancements.sql
--
-- subject_locked — coaches/admins can prevent members renaming threads
-- message_thread_participant — multi-recipient group threads
-- member_id nullable — staff-only threads (coach/admin recipients)
-- IDEMPOTENT: safe to re-run on every boot.
-- ============================================================

ALTER TABLE coaching.message_thread
  ADD COLUMN IF NOT EXISTS subject_locked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE coaching.message_thread
  ALTER COLUMN member_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS coaching.message_thread_participant (
  id          BIGSERIAL PRIMARY KEY,
  thread_id   BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
  user_id     BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
  member_id   BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_message_thread_participant_thread
  ON coaching.message_thread_participant(thread_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_participant_user
  ON coaching.message_thread_participant(thread_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_participant_member
  ON coaching.message_thread_participant(thread_id, member_id)
  WHERE member_id IS NOT NULL;

-- Backfill participants from legacy thread columns
INSERT INTO coaching.message_thread_participant (thread_id, member_id)
SELECT t.id, t.member_id
FROM coaching.message_thread t
WHERE t.member_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM coaching.message_thread_participant p
    WHERE p.thread_id = t.id AND p.member_id = t.member_id
  );

INSERT INTO coaching.message_thread_participant (thread_id, user_id)
SELECT t.id, t.coach_user_id
FROM coaching.message_thread t
WHERE t.coach_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM coaching.message_thread_participant p
    WHERE p.thread_id = t.id AND p.user_id = t.coach_user_id
  );
