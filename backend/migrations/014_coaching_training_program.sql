-- ============================================================
-- Coaching Module: Multi-Week Training Programs
-- Migration: 014_coaching_training_program.sql
--
-- Named `training_program` to avoid collision with the enrollment
-- `program` table (public schema, migration 002). A training program is
-- an ordered collection of weeks -> sessions -> workouts.
--
-- IDEMPOTENT.
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.training_program (
  id            BIGSERIAL PRIMARY KEY,
  facility_id   BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  sport_id      BIGINT REFERENCES coaching.sport(id) ON DELETE SET NULL,
  goal_phase    TEXT CHECK (goal_phase IN (
    'off_season', 'pre_season', 'in_season', 'pre_competition', 'return_to_play'
  )),
  skill_level   public.skill_level,
  weeks_count   INTEGER NOT NULL DEFAULT 0,
  created_by    BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  is_published  BOOLEAN NOT NULL DEFAULT TRUE,
  visibility    TEXT NOT NULL DEFAULT 'facility' CHECK (visibility IN ('facility', 'private')),
  archived      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_training_program_facility ON coaching.training_program(facility_id);
CREATE INDEX IF NOT EXISTS idx_coaching_training_program_sport ON coaching.training_program(sport_id);

CREATE TABLE IF NOT EXISTS coaching.training_program_week (
  id                  BIGSERIAL PRIMARY KEY,
  training_program_id BIGINT NOT NULL REFERENCES coaching.training_program(id) ON DELETE CASCADE,
  week_number         INTEGER NOT NULL,
  focus               TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (training_program_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_coaching_tp_week_program ON coaching.training_program_week(training_program_id);

CREATE TABLE IF NOT EXISTS coaching.training_program_session (
  id          BIGSERIAL PRIMARY KEY,
  week_id     BIGINT NOT NULL REFERENCES coaching.training_program_week(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  title       TEXT,
  workout_id  BIGINT REFERENCES coaching.workout(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_tp_session_week ON coaching.training_program_session(week_id);
CREATE INDEX IF NOT EXISTS idx_coaching_tp_session_workout ON coaching.training_program_session(workout_id);
