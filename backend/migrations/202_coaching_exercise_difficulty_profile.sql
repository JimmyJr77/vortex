-- Exercise difficulty profile: canonical 1–10 sub-scores for age-aware programming.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.exercise_difficulty_profile (
  exercise_id           BIGINT PRIMARY KEY REFERENCES coaching.exercise(id) ON DELETE CASCADE,
  technical             SMALLINT NOT NULL CHECK (technical BETWEEN 1 AND 10),
  load                  SMALLINT NOT NULL CHECK (load BETWEEN 1 AND 10),
  complexity            SMALLINT NOT NULL CHECK (complexity BETWEEN 1 AND 10),
  overall               SMALLINT NOT NULL CHECK (overall BETWEEN 1 AND 10),
  recommended_age_min   INTEGER,
  recommended_age_max   INTEGER,
  attention_demand      TEXT CHECK (attention_demand IN ('low', 'moderate', 'high')),
  notes                 TEXT,
  source                TEXT NOT NULL DEFAULT 'derived',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_difficulty_overall
  ON coaching.exercise_difficulty_profile(overall);

CREATE INDEX IF NOT EXISTS idx_exercise_difficulty_technical
  ON coaching.exercise_difficulty_profile(technical);

CREATE INDEX IF NOT EXISTS idx_exercise_difficulty_load
  ON coaching.exercise_difficulty_profile(load);

CREATE INDEX IF NOT EXISTS idx_exercise_difficulty_complexity
  ON coaching.exercise_difficulty_profile(complexity);
