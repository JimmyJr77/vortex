-- Multi-day training block templates.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.training_block_template (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  duration_days       INTEGER NOT NULL DEFAULT 7,
  sessions_per_week   INTEGER NOT NULL DEFAULT 3,
  target_population   TEXT,
  sport_id            BIGINT REFERENCES coaching.sport(id) ON DELETE SET NULL,
  primary_goal        TEXT,
  secondary_goals     TEXT[] NOT NULL DEFAULT '{}',
  weekly_rules_json   JSONB NOT NULL DEFAULT '{}',
  regimen_rationale_json JSONB NOT NULL DEFAULT '{}',
  created_by          BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  is_published        BOOLEAN NOT NULL DEFAULT TRUE,
  visibility          TEXT NOT NULL DEFAULT 'facility' CHECK (visibility IN ('facility', 'private')),
  archived            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_training_block_template_facility ON coaching.training_block_template(facility_id);

CREATE TABLE IF NOT EXISTS coaching.training_block_session (
  id                  BIGSERIAL PRIMARY KEY,
  block_template_id   BIGINT NOT NULL REFERENCES coaching.training_block_template(id) ON DELETE CASCADE,
  day_index           INTEGER NOT NULL,
  session_name        TEXT,
  session_objective   TEXT,
  duration_minutes    INTEGER,
  format_json         JSONB NOT NULL DEFAULT '{}',
  intensity_class     TEXT,
  neural_load         SMALLINT DEFAULT 0,
  impact_load         SMALLINT DEFAULT 0,
  strength_load       SMALLINT DEFAULT 0,
  conditioning_load   SMALLINT DEFAULT 0,
  mobility_load       SMALLINT DEFAULT 0,
  workout_id          BIGINT REFERENCES coaching.workout(id) ON DELETE SET NULL,
  day_rationale       TEXT,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (block_template_id, day_index)
);

CREATE INDEX IF NOT EXISTS idx_coaching_training_block_session_block ON coaching.training_block_session(block_template_id);

CREATE TABLE IF NOT EXISTS coaching.training_block_rule (
  id                                      BIGSERIAL PRIMARY KEY,
  block_template_id                       BIGINT NOT NULL REFERENCES coaching.training_block_template(id) ON DELETE CASCADE,
  minimum_hours_between_hard_neural       INTEGER DEFAULT 48,
  minimum_hours_between_high_impact       INTEGER DEFAULT 48,
  max_hiit_sessions_per_week                INTEGER DEFAULT 3,
  max_high_plyo_sessions_per_week         INTEGER DEFAULT 3,
  max_heavy_eccentric_sessions_per_week   INTEGER DEFAULT 2,
  weekly_tenet_coverage_json              JSONB NOT NULL DEFAULT '{}',
  weekly_methodology_coverage_json        JSONB NOT NULL DEFAULT '{}',
  weekly_physiology_coverage_json         JSONB NOT NULL DEFAULT '{}',
  daily_mobility_required                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (block_template_id)
);
