-- ============================================================
-- Coaching Module: Plan Assignment & Completion Logging
-- Migration: 017_coaching_assignments_sharing.sql
--
-- The bridge between the coach portal and the athlete (member) portal.
-- A coach assigns a workout / training_program / challenge to a member,
-- class, or family. Athletes log completion back per assignment.
--
-- IDEMPOTENT.
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.plan_assignment (
  id              BIGSERIAL PRIMARY KEY,
  facility_id     BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  coach_user_id   BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  target_type     TEXT NOT NULL CHECK (target_type IN ('member', 'class', 'family')),
  target_id       BIGINT NOT NULL,
  assignable_type TEXT NOT NULL CHECK (assignable_type IN ('workout', 'training_program', 'challenge')),
  assignable_id   BIGINT NOT NULL,
  title           TEXT,
  start_date      DATE,
  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN (
    'assigned', 'in_progress', 'completed', 'cancelled'
  )),
  visibility      TEXT NOT NULL DEFAULT 'athlete' CHECK (visibility IN ('athlete', 'coach_only')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_assignment_facility ON coaching.plan_assignment(facility_id);
CREATE INDEX IF NOT EXISTS idx_coaching_assignment_target ON coaching.plan_assignment(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_coaching_assignment_assignable ON coaching.plan_assignment(assignable_type, assignable_id);
CREATE INDEX IF NOT EXISTS idx_coaching_assignment_coach ON coaching.plan_assignment(coach_user_id);

CREATE TABLE IF NOT EXISTS coaching.completion_log (
  id            BIGSERIAL PRIMARY KEY,
  assignment_id BIGINT REFERENCES coaching.plan_assignment(id) ON DELETE CASCADE,
  member_id     BIGINT NOT NULL REFERENCES public.member(id) ON DELETE CASCADE,
  workout_id    BIGINT REFERENCES coaching.workout(id) ON DELETE SET NULL,
  exercise_id   BIGINT REFERENCES coaching.exercise(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'completed' CHECK (status IN (
    'completed', 'partial', 'skipped'
  )),
  reps          INTEGER,
  load          TEXT,
  time_seconds  INTEGER,
  rpe           SMALLINT CHECK (rpe BETWEEN 1 AND 10),
  coach_grade   NUMERIC,
  athlete_note  TEXT,
  coach_note    TEXT,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_completion_assignment ON coaching.completion_log(assignment_id);
CREATE INDEX IF NOT EXISTS idx_coaching_completion_member ON coaching.completion_log(member_id);
