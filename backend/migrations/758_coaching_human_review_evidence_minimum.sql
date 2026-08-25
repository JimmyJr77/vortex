-- Human approval evidence must be substantive. These NOT VALID constraints do
-- not reinterpret historical rows; they enforce the minimum for every future
-- insert or update while runtime admission continues to quarantine old rows.
-- IDEMPOTENT.

ALTER TABLE coaching.exercise_card_review_v1
  DROP CONSTRAINT IF EXISTS exercise_card_review_v1_observed_evidence_check;
ALTER TABLE coaching.exercise_card_review_v1
  ADD CONSTRAINT exercise_card_review_v1_observed_evidence_check
  CHECK (COALESCE(length(btrim(notes)), 0) >= 20) NOT VALID;

ALTER TABLE coaching.exercise_media_review_v1
  DROP CONSTRAINT IF EXISTS exercise_media_review_v1_observed_evidence_check;
ALTER TABLE coaching.exercise_media_review_v1
  ADD CONSTRAINT exercise_media_review_v1_observed_evidence_check
  CHECK (COALESCE(length(btrim(notes)), 0) >= 20) NOT VALID;

ALTER TABLE coaching.exercise_taxonomy_review_v2
  DROP CONSTRAINT IF EXISTS exercise_taxonomy_review_v2_observed_evidence_check;
ALTER TABLE coaching.exercise_taxonomy_review_v2
  ADD CONSTRAINT exercise_taxonomy_review_v2_observed_evidence_check
  CHECK (COALESCE(length(btrim(notes)), 0) >= 20) NOT VALID;

ALTER TABLE coaching.exercise_structured_profile_review_v2
  DROP CONSTRAINT IF EXISTS exercise_structured_profile_review_v2_observed_evidence_check;
ALTER TABLE coaching.exercise_structured_profile_review_v2
  ADD CONSTRAINT exercise_structured_profile_review_v2_observed_evidence_check
  CHECK (COALESCE(length(btrim(notes)), 0) >= 20) NOT VALID;

ALTER TABLE coaching.exercise_score_calibration_v1
  DROP CONSTRAINT IF EXISTS exercise_score_calibration_v1_review_evidence_check;
ALTER TABLE coaching.exercise_score_calibration_v1
  ADD CONSTRAINT exercise_score_calibration_v1_review_evidence_check
  CHECK (
    status NOT IN ('approved', 'rejected')
    OR (
      reviewed_by IS NOT NULL
      AND COALESCE(length(btrim(review_notes)), 0) >= 20
    )
  ) NOT VALID;
