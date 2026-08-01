-- Gymnastics evaluation forms and immutable athlete-facing focus reports.
CREATE TABLE IF NOT EXISTS coaching.gymnastics_evaluation (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES public.member(id) ON DELETE CASCADE,
  coach_user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  evaluated_at DATE NOT NULL DEFAULT CURRENT_DATE,
  coach_note TEXT,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gymnastics_evaluation_member ON coaching.gymnastics_evaluation(member_id, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS coaching.gymnastics_evaluation_movement (
  id BIGSERIAL PRIMARY KEY,
  evaluation_id BIGINT NOT NULL REFERENCES coaching.gymnastics_evaluation(id) ON DELETE CASCADE,
  movement_key TEXT NOT NULL,
  movement_label TEXT NOT NULL,
  variant_label TEXT,
  overall_score SMALLINT CHECK (overall_score BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS coaching.gymnastics_evaluation_component (
  id BIGSERIAL PRIMARY KEY,
  movement_evaluation_id BIGINT NOT NULL REFERENCES coaching.gymnastics_evaluation_movement(id) ON DELETE CASCADE,
  component_key TEXT NOT NULL,
  component_label TEXT NOT NULL,
  score SMALLINT CHECK (score BETWEEN 1 AND 5)
);
CREATE TABLE IF NOT EXISTS coaching.gymnastics_issue_tag (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  movement_key TEXT NOT NULL,
  component_key TEXT NOT NULL,
  label TEXT NOT NULL,
  created_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(facility_id, movement_key, component_key, label)
);
CREATE TABLE IF NOT EXISTS coaching.gymnastics_evaluation_issue (
  id BIGSERIAL PRIMARY KEY,
  component_evaluation_id BIGINT NOT NULL REFERENCES coaching.gymnastics_evaluation_component(id) ON DELETE CASCADE,
  issue_tag_id BIGINT REFERENCES coaching.gymnastics_issue_tag(id) ON DELETE SET NULL,
  issue_label TEXT NOT NULL
);
