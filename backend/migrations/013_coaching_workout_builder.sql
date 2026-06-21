-- ============================================================
-- Coaching Module: Workout Builder
-- Migration: 013_coaching_workout_builder.sql
--
-- A workout is a session template made of ordered blocks, each holding
-- ordered exercise items with prescribed dosage. Warmups, cooldowns,
-- conditioning, and team practices are all workout `type`s.
--
-- IDEMPOTENT.
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.workout (
  id              BIGSERIAL PRIMARY KEY,
  facility_id     BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'workout' CHECK (type IN (
    'workout', 'warmup', 'cooldown', 'conditioning', 'practice'
  )),
  sport_id        BIGINT REFERENCES coaching.sport(id) ON DELETE SET NULL,
  description     TEXT,
  target_minutes  INTEGER,
  notes           TEXT,
  is_template     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  is_published    BOOLEAN NOT NULL DEFAULT TRUE,
  visibility      TEXT NOT NULL DEFAULT 'facility' CHECK (visibility IN ('facility', 'private')),
  archived        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_workout_facility ON coaching.workout(facility_id);
CREATE INDEX IF NOT EXISTS idx_coaching_workout_type ON coaching.workout(type);
CREATE INDEX IF NOT EXISTS idx_coaching_workout_sport ON coaching.workout(sport_id);

CREATE TABLE IF NOT EXISTS coaching.workout_block (
  id                          BIGSERIAL PRIMARY KEY,
  workout_id                  BIGINT NOT NULL REFERENCES coaching.workout(id) ON DELETE CASCADE,
  sort_order                  INTEGER NOT NULL DEFAULT 0,
  label                       TEXT,
  block_format                TEXT NOT NULL DEFAULT 'straight_sets' CHECK (block_format IN (
    'straight_sets', 'circuit', 'amrap', 'emom', 'for_time', 'stations'
  )),
  rounds                      INTEGER NOT NULL DEFAULT 1,
  rest_between_rounds_seconds INTEGER NOT NULL DEFAULT 0,
  cap_minutes                 INTEGER,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_workout_block_workout ON coaching.workout_block(workout_id);

CREATE TABLE IF NOT EXISTS coaching.workout_item (
  id            BIGSERIAL PRIMARY KEY,
  block_id      BIGINT NOT NULL REFERENCES coaching.workout_block(id) ON DELETE CASCADE,
  exercise_id   BIGINT REFERENCES coaching.exercise(id) ON DELETE SET NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  sets          INTEGER,
  reps          INTEGER,
  work_seconds  INTEGER,
  rest_seconds  INTEGER,
  load          TEXT,
  tempo         TEXT,
  coaching_note TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_workout_item_block ON coaching.workout_item(block_id);
CREATE INDEX IF NOT EXISTS idx_coaching_workout_item_exercise ON coaching.workout_item(exercise_id);
