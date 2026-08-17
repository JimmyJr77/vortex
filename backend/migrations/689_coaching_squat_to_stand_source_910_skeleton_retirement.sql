-- Source 910 is an already-adjudicated duplicate of the exact selectable
-- Squat-to-Stand variant. Retire only its empty residual skeleton; do not
-- manufacture load, fatigue, media, or approval data for it.
DO $source_910_skeleton_retirement$
DECLARE
  migration_key CONSTANT TEXT := '689_coaching_squat_to_stand_source_910_skeleton_retirement';
  definition_id_value UUID;
  prior_version INTEGER;
BEGIN
  SELECT id, card_version INTO definition_id_value, prior_version
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1 AND slug = 'squat-to-stand-with-reach' AND status = 'review';
  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION '% requires the review candidate Squat-to-Stand with Reach card', migration_key;
  END IF;
  IF EXISTS (SELECT 1 FROM coaching.exercise_definition_v1 WHERE id = definition_id_value
             AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION '% refuses to alter a human-reviewed candidate', migration_key;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_definition_source_v1
    WHERE definition_id = definition_id_value AND legacy_exercise_id = 910
      AND source_kind = 'duplicate_consolidation'
  ) THEN
    RAISE EXCEPTION '% requires the recorded source-910 duplicate adjudication', migration_key;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_variant_v1
    WHERE definition_id = definition_id_value
      AND variant_key = 'sequential-bilateral-reach-squat-to-stand' AND status = 'review'
  ) THEN
    RAISE EXCEPTION '% requires the exact selectable source-62 variant', migration_key;
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET status = 'archived',
      requirements_json = COALESCE(requirements_json, '{}'::jsonb) || jsonb_build_object(
        'selectable', false,
        'source910Disposition', 'archived_duplicate_skeleton_represented_by_sequential_bilateral_reach_squat_to_stand',
        'humanReviewRequired', true,
        'publicationQuarantined', true
      ),
      updated_at = now()
  WHERE definition_id = definition_id_value
    AND variant_key = 'baseline-source-910' AND status = 'review';
  IF NOT FOUND THEN
    RAISE EXCEPTION '% requires the unreviewed source-910 skeleton', migration_key;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET card_version = prior_version + 1,
      provenance_json = COALESCE(provenance_json, '{}'::jsonb) || jsonb_build_object(
        'source910SkeletonRetirement', migration_key,
        'source910Disposition', 'archived_duplicate_skeleton_represented_by_sequential_bilateral_reach_squat_to_stand',
        'humanReviewRequired', true,
        'approvalsCreated', false,
        'publicationQuarantined', true
      ),
      updated_at = now()
  WHERE id = definition_id_value;
  UPDATE coaching.exercise_section_evidence_v1
  SET reviewed_card_version = prior_version + 1, updated_at = now()
  WHERE definition_id = definition_id_value AND reviewed_card_version = prior_version AND review_status = 'candidate';
  UPDATE coaching.exercise_media_candidate_v1
  SET reviewed_card_version = prior_version + 1, updated_at = now()
  WHERE definition_id = definition_id_value AND reviewed_card_version = prior_version AND review_status = 'candidate';
  UPDATE coaching.exercise_alternate_assessment_v1
  SET reviewed_card_version = prior_version + 1, updated_at = now()
  WHERE definition_id = definition_id_value AND reviewed_card_version = prior_version AND review_status = 'candidate';
END;
$source_910_skeleton_retirement$;
