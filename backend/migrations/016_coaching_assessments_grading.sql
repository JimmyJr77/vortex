-- ============================================================
-- Coaching Module: Assessments, Rubrics & Athlete Grading
-- Migration: 016_coaching_assessments_grading.sql
--
-- Rubrics define scored criteria. Assessments are testable benchmarks or
-- rubric-based skill evaluations tied to tenets. Results and skill
-- progress are recorded per member over time for development tracking.
--
-- IDEMPOTENT.
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.rubric (
  id          BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  sport_id    BIGINT REFERENCES coaching.sport(id) ON DELETE SET NULL,
  scale_min   INTEGER NOT NULL DEFAULT 1,
  scale_max   INTEGER NOT NULL DEFAULT 5,
  created_by  BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  archived    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_rubric_facility ON coaching.rubric(facility_id);

CREATE TABLE IF NOT EXISTS coaching.rubric_criterion (
  id          BIGSERIAL PRIMARY KEY,
  rubric_id   BIGINT NOT NULL REFERENCES coaching.rubric(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  tenet_id    BIGINT REFERENCES coaching.tenet(id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_rubric_criterion_rubric ON coaching.rubric_criterion(rubric_id);

CREATE TABLE IF NOT EXISTS coaching.assessment (
  id              BIGSERIAL PRIMARY KEY,
  facility_id     BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  sport_id        BIGINT REFERENCES coaching.sport(id) ON DELETE SET NULL,
  assessment_type TEXT NOT NULL DEFAULT 'benchmark' CHECK (assessment_type IN (
    'benchmark', 'rubric', 'skill'
  )),
  unit            TEXT,
  higher_is_better BOOLEAN NOT NULL DEFAULT TRUE,
  tenet_id        BIGINT REFERENCES coaching.tenet(id) ON DELETE SET NULL,
  rubric_id       BIGINT REFERENCES coaching.rubric(id) ON DELETE SET NULL,
  created_by      BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  archived        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_assessment_facility ON coaching.assessment(facility_id);
CREATE INDEX IF NOT EXISTS idx_coaching_assessment_tenet ON coaching.assessment(tenet_id);

CREATE TABLE IF NOT EXISTS coaching.assessment_result (
  id            BIGSERIAL PRIMARY KEY,
  assessment_id BIGINT NOT NULL REFERENCES coaching.assessment(id) ON DELETE CASCADE,
  member_id     BIGINT NOT NULL REFERENCES public.member(id) ON DELETE CASCADE,
  value_numeric NUMERIC,
  value_text    TEXT,
  unit          TEXT,
  tested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  coach_user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  note          TEXT,
  media_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_assessment_result_assessment ON coaching.assessment_result(assessment_id);
CREATE INDEX IF NOT EXISTS idx_coaching_assessment_result_member ON coaching.assessment_result(member_id);

CREATE TABLE IF NOT EXISTS coaching.athlete_skill_progress (
  id                  BIGSERIAL PRIMARY KEY,
  member_id           BIGINT NOT NULL REFERENCES public.member(id) ON DELETE CASCADE,
  exercise_id         BIGINT REFERENCES coaching.exercise(id) ON DELETE SET NULL,
  rubric_criterion_id BIGINT REFERENCES coaching.rubric_criterion(id) ON DELETE SET NULL,
  skill_label         TEXT,
  score               NUMERIC,
  max_score           NUMERIC,
  graded_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  coach_user_id       BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  note                TEXT,
  media_url           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_skill_progress_member ON coaching.athlete_skill_progress(member_id);
CREATE INDEX IF NOT EXISTS idx_coaching_skill_progress_exercise ON coaching.athlete_skill_progress(exercise_id);
