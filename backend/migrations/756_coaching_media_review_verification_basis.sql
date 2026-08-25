-- Media review evidence must identify the human verification basis. This is
-- additive and does not convert existing candidate or legacy review rows into
-- verified evidence. New exact-match review writes are validated by the API.
-- IDEMPOTENT.

ALTER TABLE coaching.exercise_media_review_v1
  ADD COLUMN IF NOT EXISTS review_basis_json JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE coaching.exercise_media_review_v1
  DROP CONSTRAINT IF EXISTS exercise_media_review_v1_review_basis_object_check;
ALTER TABLE coaching.exercise_media_review_v1
  ADD CONSTRAINT exercise_media_review_v1_review_basis_object_check
  CHECK (jsonb_typeof(review_basis_json) = 'object');
