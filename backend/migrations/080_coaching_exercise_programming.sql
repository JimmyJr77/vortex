-- Exercise programming card extensions (phase profiles, dosage, scaling, safety, regimen).
-- IDEMPOTENT.

ALTER TABLE coaching.exercise
  ADD COLUMN IF NOT EXISTS card_summary TEXT;
ALTER TABLE coaching.exercise
  ADD COLUMN IF NOT EXISTS coach_language TEXT;
ALTER TABLE coaching.exercise
  ADD COLUMN IF NOT EXISTS athlete_language TEXT;
ALTER TABLE coaching.exercise
  ADD COLUMN IF NOT EXISTS programming_logic JSONB NOT NULL DEFAULT '{}';
ALTER TABLE coaching.exercise
  ADD COLUMN IF NOT EXISTS why_publish_ready BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE coaching.exercise
  ADD COLUMN IF NOT EXISTS scalable_variables TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS coaching.exercise_phase_profile (
  id                   BIGSERIAL PRIMARY KEY,
  exercise_id          BIGINT NOT NULL REFERENCES coaching.exercise(id) ON DELETE CASCADE,
  phase_id             BIGINT NOT NULL REFERENCES coaching.session_phase(id) ON DELETE CASCADE,
  fit_weight           SMALLINT NOT NULL DEFAULT 3 CHECK (fit_weight BETWEEN 1 AND 5),
  role                 TEXT NOT NULL DEFAULT 'secondary' CHECK (role IN ('primary', 'secondary', 'conditional', 'avoid')),
  order_slot           TEXT,
  order_index          INTEGER NOT NULL DEFAULT 0,
  freshness_required   BOOLEAN NOT NULL DEFAULT FALSE,
  fatigue_sensitivity  SMALLINT NOT NULL DEFAULT 3 CHECK (fatigue_sensitivity BETWEEN 1 AND 5),
  fatigue_cost         SMALLINT NOT NULL DEFAULT 3 CHECK (fatigue_cost BETWEEN 1 AND 5),
  technical_complexity SMALLINT NOT NULL DEFAULT 3 CHECK (technical_complexity BETWEEN 1 AND 5),
  impact_level         SMALLINT NOT NULL DEFAULT 1 CHECK (impact_level BETWEEN 0 AND 5),
  intensity_ceiling    TEXT CHECK (intensity_ceiling IN ('low', 'moderate', 'high', 'max')),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exercise_id, phase_id)
);

CREATE INDEX IF NOT EXISTS idx_coaching_exercise_phase_profile_exercise ON coaching.exercise_phase_profile(exercise_id);
CREATE INDEX IF NOT EXISTS idx_coaching_exercise_phase_profile_phase ON coaching.exercise_phase_profile(phase_id);

CREATE TABLE IF NOT EXISTS coaching.exercise_dosage_profile (
  id                   BIGSERIAL PRIMARY KEY,
  exercise_id          BIGINT NOT NULL REFERENCES coaching.exercise(id) ON DELETE CASCADE,
  profile_name         TEXT NOT NULL DEFAULT 'Default',
  is_default           BOOLEAN NOT NULL DEFAULT TRUE,
  volume_unit          TEXT NOT NULL DEFAULT 'reps' CHECK (volume_unit IN (
    'reps', 'seconds', 'distance', 'contacts', 'rounds', 'attempts', 'intervals'
  )),
  default_sets         INTEGER,
  default_reps         INTEGER,
  default_work_seconds INTEGER,
  default_distance     INTEGER,
  default_contacts     INTEGER,
  default_rounds       INTEGER,
  default_rest_seconds INTEGER,
  tempo                TEXT,
  load_type            TEXT,
  default_intensity    TEXT,
  default_rpe_min      SMALLINT CHECK (default_rpe_min BETWEEN 1 AND 10),
  default_rpe_max      SMALLINT CHECK (default_rpe_max BETWEEN 1 AND 10),
  default_load_note    TEXT,
  est_seconds_per_set  INTEGER,
  session_volume_min   INTEGER,
  session_volume_max   INTEGER,
  weekly_volume_min    INTEGER,
  weekly_volume_max    INTEGER,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exercise_id, profile_name)
);

CREATE INDEX IF NOT EXISTS idx_coaching_exercise_dosage_profile_exercise ON coaching.exercise_dosage_profile(exercise_id);

CREATE TABLE IF NOT EXISTS coaching.exercise_scaling_profile (
  id                       BIGSERIAL PRIMARY KEY,
  exercise_id              BIGINT NOT NULL REFERENCES coaching.exercise(id) ON DELETE CASCADE,
  label                    TEXT NOT NULL,
  age_min                  INTEGER,
  age_max                  INTEGER,
  skill_level              public.skill_level,
  training_age_min_months  INTEGER,
  training_age_max_months  INTEGER,
  scale_direction          TEXT CHECK (scale_direction IN ('regression', 'baseline', 'progression')),
  sets_min                 INTEGER,
  sets_max                 INTEGER,
  reps_min                 INTEGER,
  reps_max                 INTEGER,
  work_seconds_min         INTEGER,
  work_seconds_max         INTEGER,
  rest_seconds_min         INTEGER,
  rest_seconds_max         INTEGER,
  load_guidance            TEXT,
  height_guidance          TEXT,
  distance_guidance        TEXT,
  tempo_guidance           TEXT,
  rom_guidance             TEXT,
  complexity_guidance      TEXT,
  impact_guidance          TEXT,
  coach_notes              TEXT,
  athlete_notes            TEXT,
  contraindication_notes   TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_exercise_scaling_profile_exercise ON coaching.exercise_scaling_profile(exercise_id);

CREATE TABLE IF NOT EXISTS coaching.exercise_safety_profile (
  id                         BIGSERIAL PRIMARY KEY,
  exercise_id                BIGINT NOT NULL UNIQUE REFERENCES coaching.exercise(id) ON DELETE CASCADE,
  risk_level                 SMALLINT NOT NULL DEFAULT 2 CHECK (risk_level BETWEEN 1 AND 5),
  impact_level               SMALLINT NOT NULL DEFAULT 1 CHECK (impact_level BETWEEN 0 AND 5),
  requires_spotting          BOOLEAN NOT NULL DEFAULT FALSE,
  requires_coach_supervision TEXT NOT NULL DEFAULT 'none' CHECK (requires_coach_supervision IN ('none', 'recommended', 'required')),
  minimum_age_recommended    INTEGER,
  minimum_skill_level        public.skill_level,
  minimum_prerequisite_notes TEXT,
  readiness_checks           TEXT[] NOT NULL DEFAULT '{}',
  stop_signs                 TEXT[] NOT NULL DEFAULT '{}',
  common_substitutions       TEXT[] NOT NULL DEFAULT '{}',
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coaching.exercise_regimen_rule (
  id                                  BIGSERIAL PRIMARY KEY,
  exercise_id                         BIGINT NOT NULL UNIQUE REFERENCES coaching.exercise(id) ON DELETE CASCADE,
  can_be_daily                        BOOLEAN NOT NULL DEFAULT FALSE,
  daily_min_dose                      TEXT,
  daily_max_dose                      TEXT,
  weekly_min_frequency                INTEGER,
  weekly_max_frequency                INTEGER NOT NULL DEFAULT 3,
  minimum_hours_between_hard_exposures INTEGER NOT NULL DEFAULT 24,
  counts_as_high_intensity            BOOLEAN NOT NULL DEFAULT FALSE,
  counts_as_high_impact                BOOLEAN NOT NULL DEFAULT FALSE,
  counts_as_neural                     BOOLEAN NOT NULL DEFAULT FALSE,
  counts_as_tissue_stress              BOOLEAN NOT NULL DEFAULT FALSE,
  counts_as_conditioning               BOOLEAN NOT NULL DEFAULT FALSE,
  recovery_notes                      TEXT,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT now()
);
