-- Immutable evidence for independent relationship-graph decisions. This is
-- additive: it does not reinterpret or certify existing relationship rows.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.exercise_relationship_review_v2 (
  id BIGSERIAL PRIMARY KEY,
  relationship_id UUID NOT NULL REFERENCES coaching.exercise_relationship_v1(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('approved', 'rejected')),
  notes TEXT NOT NULL CHECK (length(btrim(notes)) >= 20),
  reviewer_user_id BIGINT NOT NULL REFERENCES public.app_user(id) ON DELETE RESTRICT,
  snapshot_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exercise_relationship_review_v2_relationship_idx
  ON coaching.exercise_relationship_review_v2 (relationship_id, created_at DESC);
