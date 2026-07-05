-- Evergreen regimen templates.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.regimen_template (
  id                    BIGSERIAL PRIMARY KEY,
  facility_id           BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT,
  population            TEXT,
  age_min               INTEGER,
  age_max               INTEGER,
  skill_level           public.skill_level,
  sport_id              BIGINT REFERENCES coaching.sport(id) ON DELETE SET NULL,
  duration_type         TEXT NOT NULL DEFAULT '60',
  weeks                 INTEGER NOT NULL DEFAULT 4,
  sessions_per_week     INTEGER NOT NULL DEFAULT 3,
  primary_goal          TEXT,
  secondary_goals       TEXT[] NOT NULL DEFAULT '{}',
  tumbling_model        TEXT,
  specialization_model  TEXT,
  regimen_rationale_json JSONB NOT NULL DEFAULT '{}',
  weekly_rules_json     JSONB NOT NULL DEFAULT '{}',
  created_by            BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  is_published          BOOLEAN NOT NULL DEFAULT TRUE,
  visibility            TEXT NOT NULL DEFAULT 'facility' CHECK (visibility IN ('facility', 'private')),
  archived              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_regimen_template_facility ON coaching.regimen_template(facility_id);

CREATE TABLE IF NOT EXISTS coaching.regimen_phase_distribution (
  id                  BIGSERIAL PRIMARY KEY,
  regimen_template_id BIGINT NOT NULL REFERENCES coaching.regimen_template(id) ON DELETE CASCADE,
  phase_id            BIGINT NOT NULL REFERENCES coaching.session_phase(id) ON DELETE CASCADE,
  default_minutes     INTEGER,
  default_percent     NUMERIC,
  weekly_min_sessions INTEGER,
  weekly_max_sessions INTEGER,
  notes               TEXT,
  UNIQUE (regimen_template_id, phase_id)
);

CREATE TABLE IF NOT EXISTS coaching.regimen_session_template (
  id                  BIGSERIAL PRIMARY KEY,
  regimen_template_id BIGINT NOT NULL REFERENCES coaching.regimen_template(id) ON DELETE CASCADE,
  week_number         INTEGER NOT NULL DEFAULT 1,
  day_of_week         INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  session_objective   TEXT,
  duration_minutes    INTEGER NOT NULL DEFAULT 60,
  phase_plan_json     JSONB NOT NULL DEFAULT '[]',
  format_json         JSONB NOT NULL DEFAULT '{}',
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_regimen_session_template_regimen ON coaching.regimen_session_template(regimen_template_id);

CREATE TABLE IF NOT EXISTS coaching.regimen_progression_rule (
  id                  BIGSERIAL PRIMARY KEY,
  regimen_template_id BIGINT NOT NULL REFERENCES coaching.regimen_template(id) ON DELETE CASCADE,
  rule_key            TEXT NOT NULL,
  rule_json           JSONB NOT NULL DEFAULT '{}',
  notes               TEXT,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  UNIQUE (regimen_template_id, rule_key)
);

-- Seed default regimen rationale template
INSERT INTO coaching.education_content (entity_type, entity_key, entity_id, title, short_summary, why_this_order, programming_guidance, daily_or_weekly_guidance) VALUES
  ('regimen_rule', 'weekly_balance_default', NULL, 'Weekly Athleticism Balance',
   'Distribute neural, strength, skill, mobility, control, and conditioning across the week.',
   'Hard neural and high-impact sessions are spaced to protect quality and recovery.',
   'Mobility and low-level coordination can appear daily; hard output and HIIT are limited per week.',
   'Output 2-3x/week; HIIT 1-3x/week; heavy eccentrics 1-2x/week depending on population.')
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  short_summary = EXCLUDED.short_summary,
  updated_at = now();
