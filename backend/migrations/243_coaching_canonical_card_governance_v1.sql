-- Canonical exercise-card authoring, review, publication, and media governance.
-- Adds immutable audit history without changing legacy exercise rows.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.exercise_card_revision_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES coaching.exercise_definition_v1(id) ON DELETE CASCADE,
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number >= 1),
  action TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'submitted_for_review', 'returned_to_draft',
    'published', 'deprecated', 'archived'
  )),
  from_status TEXT,
  to_status TEXT NOT NULL,
  snapshot_json JSONB NOT NULL,
  change_summary TEXT,
  actor_user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (definition_id, revision_number)
);

CREATE INDEX IF NOT EXISTS exercise_card_revision_definition_idx
  ON coaching.exercise_card_revision_v1 (definition_id, revision_number DESC);

ALTER TABLE coaching.exercise_relationship_v1
  ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS coaching.exercise_media_review_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES coaching.exercise_definition_v1(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  exact_variant_match BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_card_version INTEGER NOT NULL DEFAULT 1 CHECK (reviewed_card_version >= 1),
  demonstration_quality_score SMALLINT CHECK (demonstration_quality_score BETWEEN 1 AND 100),
  link_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (link_status IN ('pending', 'healthy', 'broken', 'mismatched')),
  reviewer_user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (definition_id, url)
);

CREATE INDEX IF NOT EXISTS exercise_media_review_due_idx
  ON coaching.exercise_media_review_v1 (next_review_at)
  WHERE link_status = 'healthy';

CREATE TABLE IF NOT EXISTS coaching.exercise_card_review_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES coaching.exercise_definition_v1(id) ON DELETE CASCADE,
  reviewer_user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  reviewed_card_version INTEGER NOT NULL DEFAULT 1 CHECK (reviewed_card_version >= 1),
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'request_changes')),
  rubric_json JSONB NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exercise_card_review_definition_idx
  ON coaching.exercise_card_review_v1 (definition_id, created_at DESC);

ALTER TABLE coaching.exercise_media_review_v1
  ADD COLUMN IF NOT EXISTS reviewed_card_version INTEGER NOT NULL DEFAULT 1
    CHECK (reviewed_card_version >= 1);

ALTER TABLE coaching.exercise_card_review_v1
  ADD COLUMN IF NOT EXISTS reviewed_card_version INTEGER NOT NULL DEFAULT 1
    CHECK (reviewed_card_version >= 1);

CREATE TABLE IF NOT EXISTS coaching.exercise_card_ai_draft_audit_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  request_hash TEXT NOT NULL,
  model_version TEXT,
  status TEXT NOT NULL CHECK (status IN ('validated', 'invalid', 'service_unavailable')),
  draft_json JSONB,
  validation_errors_json JSONB NOT NULL DEFAULT '[]',
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exercise_card_ai_draft_audit_facility_idx
  ON coaching.exercise_card_ai_draft_audit_v1 (facility_id, created_at DESC);
