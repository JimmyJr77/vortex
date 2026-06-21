-- ============================================================
-- Coaching Module: AI Layer Traceability
-- Migration: 018_coaching_ai.sql
--
-- Records AI-assisted drafts/suggestions so coaches can audit and reuse
-- generated sessions, coverage nudges, narratives, and auto-tags.
--
-- IDEMPOTENT.
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.ai_draft_log (
  id            BIGSERIAL PRIMARY KEY,
  facility_id   BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  coach_user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL CHECK (kind IN (
    'session_draft', 'coverage_nudge', 'narrative', 'auto_tag'
  )),
  prompt        TEXT,
  response      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_ai_draft_facility ON coaching.ai_draft_log(facility_id);
CREATE INDEX IF NOT EXISTS idx_coaching_ai_draft_coach ON coaching.ai_draft_log(coach_user_id);
