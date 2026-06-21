-- ============================================================
-- Coaching Module: Engagement (Phase G — notifications slice)
-- Migration: 023_coaching_engagement.sql
--
-- In-app notifications for assignments, PRs, and future messaging.
-- Message threads, goals, and achievements land in follow-up migrations.
--
-- IDEMPOTENT: safe to re-run on every boot.
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.notification (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  recipient_member_id BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
  recipient_user_id   BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
  kind                TEXT NOT NULL CHECK (kind IN (
    'assignment', 'personal_record', 'message', 'achievement', 'system'
  )),
  title               TEXT NOT NULL,
  body                TEXT,
  payload             JSONB NOT NULL DEFAULT '{}',
  read_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (recipient_member_id IS NOT NULL OR recipient_user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_coaching_notification_member_unread
  ON coaching.notification(recipient_member_id, read_at)
  WHERE recipient_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coaching_notification_user_unread
  ON coaching.notification(recipient_user_id, read_at)
  WHERE recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coaching_notification_facility_created
  ON coaching.notification(facility_id, created_at DESC);
