-- ============================================================
-- Add athlete_program table for enrollment tracking
-- Migration: add_athlete_program_table.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS athlete_program (
  id                  BIGSERIAL PRIMARY KEY,
  athlete_id          BIGINT NOT NULL REFERENCES athlete(id) ON DELETE CASCADE,
  program_id          BIGINT NOT NULL REFERENCES program(id) ON DELETE CASCADE,
  days_per_week       INTEGER NOT NULL,
  selected_days        JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_athlete_program_athlete ON athlete_program(athlete_id);
CREATE INDEX IF NOT EXISTS idx_athlete_program_program ON athlete_program(program_id);
CREATE INDEX IF NOT EXISTS idx_athlete_program_created_at ON athlete_program(created_at);

