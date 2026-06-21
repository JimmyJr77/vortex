-- ============================================================
-- Coaching Module: Messaging (Phase G)
-- Migration: 024_coaching_messaging.sql
--
-- Coach ↔ athlete/parent feedback threads.
-- IDEMPOTENT: safe to re-run on every boot.
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.message_thread (
  id              BIGSERIAL PRIMARY KEY,
  facility_id     BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  member_id       BIGINT NOT NULL REFERENCES public.member(id) ON DELETE CASCADE,
  coach_user_id   BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  subject         TEXT,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'archived')),
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_message_thread_facility_member
  ON coaching.message_thread(facility_id, member_id);

CREATE INDEX IF NOT EXISTS idx_coaching_message_thread_coach
  ON coaching.message_thread(coach_user_id, last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS coaching.message (
  id                BIGSERIAL PRIMARY KEY,
  thread_id         BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
  sender_user_id    BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  sender_member_id  BIGINT REFERENCES public.member(id) ON DELETE SET NULL,
  body              TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_user_id IS NOT NULL OR sender_member_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_coaching_message_thread_created
  ON coaching.message(thread_id, created_at);
