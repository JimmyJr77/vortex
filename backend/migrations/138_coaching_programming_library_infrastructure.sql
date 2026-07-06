-- Programming Library: reusable programming methods (HOW work is organized).
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.programming_method (
  id                          BIGSERIAL PRIMARY KEY,
  facility_id                 BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  name                        TEXT NOT NULL,
  slug                        TEXT NOT NULL,
  category                    TEXT NOT NULL,
  definition                  TEXT,
  coach_summary               TEXT,
  athlete_summary             TEXT,
  primary_development_goal    TEXT,
  secondary_development_goals TEXT[] NOT NULL DEFAULT '{}',
  programming_type            TEXT NOT NULL DEFAULT 'custom',
  best_session_phase          TEXT,
  compatible_session_phases   TEXT[] NOT NULL DEFAULT '{}',
  incompatible_phases         TEXT[] NOT NULL DEFAULT '{}',
  energy_system_focus           TEXT[] NOT NULL DEFAULT '{}',
  fatigue_profile               JSONB NOT NULL DEFAULT '{}'::jsonb,
  supervision_level             TEXT NOT NULL DEFAULT 'recommended',
  what_it_is                  TEXT,
  why_it_matters              TEXT,
  when_to_use                 TEXT,
  when_not_to_use             TEXT,
  common_misuse                 TEXT[] NOT NULL DEFAULT '{}',
  work_rest_structure           JSONB NOT NULL DEFAULT '{}'::jsonb,
  exercise_compatibility        JSONB NOT NULL DEFAULT '{}'::jsonb,
  scaling                       JSONB NOT NULL DEFAULT '{}'::jsonb,
  progression_logic             JSONB NOT NULL DEFAULT '{}'::jsonb,
  regression_logic              JSONB NOT NULL DEFAULT '{}'::jsonb,
  workout_builder_rules         JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_published                BOOLEAN NOT NULL DEFAULT TRUE,
  visibility                  TEXT NOT NULL DEFAULT 'facility' CHECK (visibility IN ('facility', 'private')),
  created_by                  BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  archived                    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_programming_method_facility ON coaching.programming_method(facility_id) WHERE archived = FALSE;

CREATE TABLE IF NOT EXISTS coaching.programming_method_phase_profile (
  id                    BIGSERIAL PRIMARY KEY,
  programming_method_id BIGINT NOT NULL REFERENCES coaching.programming_method(id) ON DELETE CASCADE,
  phase_key             TEXT NOT NULL,
  role                  TEXT NOT NULL DEFAULT 'conditional' CHECK (role IN ('primary', 'secondary', 'conditional', 'avoid')),
  fit_weight            SMALLINT NOT NULL DEFAULT 3 CHECK (fit_weight BETWEEN 1 AND 5),
  phase_rationale       TEXT,
  fatigue_rationale     TEXT,
  order_rationale       TEXT,
  risk_note             TEXT,
  UNIQUE (programming_method_id, phase_key)
);

CREATE TABLE IF NOT EXISTS coaching.programming_method_prescription_profile (
  id                              BIGSERIAL PRIMARY KEY,
  programming_method_id           BIGINT NOT NULL REFERENCES coaching.programming_method(id) ON DELETE CASCADE,
  profile_name                    TEXT NOT NULL,
  age_min                         INTEGER,
  age_max                         INTEGER,
  skill_level                     public.skill_level,
  default_total_minutes           INTEGER,
  default_rounds                  INTEGER,
  default_work_seconds            INTEGER,
  default_rest_seconds            INTEGER,
  default_rest_between_rounds_seconds INTEGER,
  default_station_seconds         INTEGER,
  default_cap_minutes             NUMERIC(6,2),
  default_rpe_min                 SMALLINT,
  default_rpe_max                 SMALLINT,
  default_heart_rate_zone         TEXT,
  notes                           TEXT,
  UNIQUE (programming_method_id, profile_name)
);

CREATE TABLE IF NOT EXISTS coaching.programming_method_exercise_compatibility (
  id                    BIGSERIAL PRIMARY KEY,
  programming_method_id BIGINT NOT NULL REFERENCES coaching.programming_method(id) ON DELETE CASCADE,
  compatibility_type  TEXT NOT NULL CHECK (compatibility_type IN ('compatible', 'avoid', 'conditional')),
  exercise_type         TEXT NOT NULL,
  facet_type            TEXT,
  facet_key             TEXT,
  weight                SMALLINT NOT NULL DEFAULT 3 CHECK (weight BETWEEN 1 AND 5),
  rationale             TEXT,
  constraints           TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pm_exercise_compat ON coaching.programming_method_exercise_compatibility(programming_method_id);

CREATE TABLE IF NOT EXISTS coaching.programming_method_quality_standard (
  id                    BIGSERIAL PRIMARY KEY,
  programming_method_id BIGINT NOT NULL REFERENCES coaching.programming_method(id) ON DELETE CASCADE,
  standard              TEXT NOT NULL,
  severity              TEXT NOT NULL DEFAULT 'required' CHECK (severity IN ('info', 'warning', 'required')),
  applies_to_exercise_type TEXT
);

CREATE TABLE IF NOT EXISTS coaching.programming_method_stop_rule (
  id                    BIGSERIAL PRIMARY KEY,
  programming_method_id BIGINT NOT NULL REFERENCES coaching.programming_method(id) ON DELETE CASCADE,
  stop_rule             TEXT NOT NULL,
  severity              TEXT NOT NULL DEFAULT 'stop' CHECK (severity IN ('warning', 'stop', 'error')),
  applies_to            TEXT
);

CREATE TABLE IF NOT EXISTS coaching.programming_method_validator_rule (
  id                    BIGSERIAL PRIMARY KEY,
  programming_method_id BIGINT NOT NULL REFERENCES coaching.programming_method(id) ON DELETE CASCADE,
  rule_key              TEXT NOT NULL,
  condition_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
  message               TEXT NOT NULL,
  severity              TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'strong_warning', 'error')),
  recommended_action    TEXT
);

CREATE TABLE IF NOT EXISTS coaching.programming_method_example (
  id                    BIGSERIAL PRIMARY KEY,
  programming_method_id BIGINT NOT NULL REFERENCES coaching.programming_method(id) ON DELETE CASCADE,
  label                 TEXT NOT NULL,
  audience              TEXT NOT NULL DEFAULT 'intermediate',
  example_json          JSONB NOT NULL DEFAULT '{}'::jsonb,
  coaching_notes        TEXT,
  disclaimer            TEXT NOT NULL DEFAULT 'Example only. Actual workout generated by Workout Builder.'
);
