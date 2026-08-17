-- A-March already has a version-2 candidate packet and five unreviewed media
-- candidates. Restore its missing physical-difficulty dimension from the
-- existing A-series research packet; no approval is created.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '551_coaching_a_march_physical_difficulty_contract_correction';
  canonical_definition UUID;
  active_variant UUID;
BEGIN
  SELECT id INTO canonical_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=69 AND slug='a-march' AND status='review' AND card_version=2;
  SELECT id INTO active_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_definition AND variant_key='baseline' AND status='review';
  IF canonical_definition IS NULL OR active_variant IS NULL THEN
    RAISE EXCEPTION '% requires the active version-2 A-March candidate',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=canonical_definition AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1 WHERE definition_id=canonical_definition AND reviewed_card_version=2 AND (review_status='approved' OR reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION '% refuses to overwrite human-reviewed A-March state',migration_key;
  END IF;
  UPDATE coaching.exercise_variant_v1 SET
    difficulty_json=jsonb_set(jsonb_set(coalesce(difficulty_json,'{}'::JSONB),'{physicalDifficulty}','10'::JSONB,TRUE),'{baseOverallDifficulty}','36'::JSONB,TRUE),
    updated_at=now()
  WHERE id=active_variant;
  UPDATE coaching.exercise_definition_v1 SET
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'physicalDifficultyCorrection',migration_key,'difficultyEvidence','411_coaching_a_series_sprint_drills_research_completion',
      'exerciseScoresDescribeTaskOnly',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id=canonical_definition;
  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=active_variant
      AND difficulty_json->>'physicalDifficulty'='10'
      AND difficulty_json->>'baseOverallDifficulty'='36')
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1 WHERE definition_id=canonical_definition AND reviewed_card_version=2 AND review_status='candidate' AND video_id IN('am3v2I1LxaM','2FgmKuOvKFs','zeQ_vRyB35Q','bISzKMBflPM','Vu3eqv9lSZw') AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>5
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1 WHERE definition_id=canonical_definition AND reviewed_card_version=2 AND review_status='approved') THEN
    RAISE EXCEPTION '% physical-difficulty or candidate-media assertions failed',migration_key;
  END IF;
END
$migration$;
