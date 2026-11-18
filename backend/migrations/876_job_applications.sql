CREATE TABLE IF NOT EXISTS job_application (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('gymnastics', 'youth_fitness', 'both')),
  details JSONB NOT NULL CHECK (jsonb_typeof(details) = 'object'),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'interview', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_job_application_facility_created
  ON job_application (facility_id, created_at DESC, id DESC);
