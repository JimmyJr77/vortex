ALTER TABLE coaching.gymnastics_evaluation
  ALTER COLUMN member_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS evaluation_name TEXT NOT NULL DEFAULT 'Foundational Floor',
  ADD COLUMN IF NOT EXISTS recipient_email TEXT;

CREATE INDEX IF NOT EXISTS idx_gymnastics_evaluation_facility_date
  ON coaching.gymnastics_evaluation(facility_id, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS coaching.gymnastics_evaluation_template (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  created_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(facility_id, name)
);
CREATE INDEX IF NOT EXISTS idx_gymnastics_evaluation_template_facility
  ON coaching.gymnastics_evaluation_template(facility_id, archived, name);
