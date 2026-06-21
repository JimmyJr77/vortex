-- ============================================================
-- Coaching Module: Goals & Achievements (Phase G)
-- Migration: 025_coaching_goals_achievements.sql
--
-- Athlete/coach goals and lightweight gamification badges.
-- IDEMPOTENT: safe to re-run on every boot.
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.goal (
  id            BIGSERIAL PRIMARY KEY,
  facility_id   BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  member_id     BIGINT NOT NULL REFERENCES public.member(id) ON DELETE CASCADE,
  coach_user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  target_date   DATE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_goal_member
  ON coaching.goal(member_id, status);

CREATE TABLE IF NOT EXISTS coaching.achievement (
  id            BIGSERIAL PRIMARY KEY,
  facility_id   BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  member_id     BIGINT NOT NULL REFERENCES public.member(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('badge', 'streak', 'xp', 'milestone')),
  label         TEXT NOT NULL,
  description   TEXT,
  value_numeric NUMERIC,
  achieved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_type   TEXT,
  source_id     BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_achievement_member
  ON coaching.achievement(member_id, achieved_at DESC);
