-- ============================================================
-- Coaching Module: Periodization & Training Load (Phase F)
-- Migration: 022_coaching_periodization_load.sql
--
-- Adds longitudinal athlete-development intelligence on top of the
-- single-workout / single-program loop:
--   * training_cycle           - macro/meso/micro periodization blocks
--   * training_program_week     - per-week periodization metadata (ALTER)
--   * wellness_checkin           - daily athlete readiness inputs
--   * personal_record            - auto-detected PRs from assessments/skills
--
-- Training load (acute:chronic workload ratio) is derived at query time
-- from coaching.completion_log (session-RPE = rpe x minutes), so no load
-- table is required here.
--
-- IDEMPOTENT: safe to re-run on every boot.
-- ============================================================

-- Macro/meso/micro periodization blocks, optionally tied to a program.
CREATE TABLE IF NOT EXISTS coaching.training_cycle (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  training_program_id BIGINT REFERENCES coaching.training_program(id) ON DELETE CASCADE,
  cycle_type          TEXT NOT NULL DEFAULT 'meso' CHECK (cycle_type IN ('macro', 'meso', 'micro')),
  name                TEXT NOT NULL,
  start_date          DATE,
  end_date            DATE,
  intensity_target    NUMERIC,           -- target intensity (% or 1-10, coach's convention)
  is_deload           BOOLEAN NOT NULL DEFAULT FALSE,
  notes               TEXT,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_by          BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_training_cycle_facility
  ON coaching.training_cycle(facility_id);
CREATE INDEX IF NOT EXISTS idx_coaching_training_cycle_program
  ON coaching.training_cycle(training_program_id);

-- Per-week periodization metadata for the program builder.
ALTER TABLE coaching.training_program_week
  ADD COLUMN IF NOT EXISTS phase_label     TEXT;
ALTER TABLE coaching.training_program_week
  ADD COLUMN IF NOT EXISTS target_load_pct NUMERIC;
ALTER TABLE coaching.training_program_week
  ADD COLUMN IF NOT EXISTS is_deload       BOOLEAN NOT NULL DEFAULT FALSE;

-- Daily athlete-submitted readiness inputs.
CREATE TABLE IF NOT EXISTS coaching.wellness_checkin (
  id           BIGSERIAL PRIMARY KEY,
  facility_id  BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  member_id    BIGINT NOT NULL REFERENCES public.member(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  sleep_hours  NUMERIC,
  soreness     SMALLINT CHECK (soreness BETWEEN 1 AND 10),
  rpe          SMALLINT CHECK (rpe BETWEEN 1 AND 10),
  mood         SMALLINT CHECK (mood BETWEEN 1 AND 10),
  energy       SMALLINT CHECK (energy BETWEEN 1 AND 10),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_coaching_wellness_member_date
  ON coaching.wellness_checkin(member_id, checkin_date);

-- Auto-detected personal records from assessments / skill grades.
CREATE TABLE IF NOT EXISTS coaching.personal_record (
  id               BIGSERIAL PRIMARY KEY,
  facility_id      BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  member_id        BIGINT NOT NULL REFERENCES public.member(id) ON DELETE CASCADE,
  source_type      TEXT NOT NULL CHECK (source_type IN ('assessment', 'skill')),
  assessment_id    BIGINT REFERENCES coaching.assessment(id) ON DELETE SET NULL,
  exercise_id      BIGINT REFERENCES coaching.exercise(id) ON DELETE SET NULL,
  metric_label     TEXT,
  value_numeric    NUMERIC,
  unit             TEXT,
  achieved_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_result_id BIGINT,             -- assessment_result.id / athlete_skill_progress.id (loose ref)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_personal_record_member
  ON coaching.personal_record(member_id);
CREATE INDEX IF NOT EXISTS idx_coaching_personal_record_member_exercise
  ON coaching.personal_record(member_id, exercise_id);
