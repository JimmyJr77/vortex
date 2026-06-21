-- ============================================================
-- Coaching Module: Message thread visibility (Phase G)
-- Migration: 026_coaching_thread_scope.sql
--
-- assigned_coach  — only thread.coach_user_id (until opened to circle)
-- coaching_circle — any coach at the facility can view/reply
-- IDEMPOTENT: safe to re-run on every boot.
-- ============================================================

ALTER TABLE coaching.message_thread
  ADD COLUMN IF NOT EXISTS thread_scope TEXT NOT NULL DEFAULT 'coaching_circle';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'message_thread_thread_scope_check'
      AND conrelid = 'coaching.message_thread'::regclass
  ) THEN
    ALTER TABLE coaching.message_thread
      ADD CONSTRAINT message_thread_thread_scope_check
      CHECK (thread_scope IN ('assigned_coach', 'coaching_circle'));
  END IF;
END $$;
