-- Map existing exact Push-Up candidate planning dimensions onto the standardized
-- load/fatigue keys. This uses candidate values already present on each variant.
DO $push_up_standard_profile_mapping$
DECLARE
  migration_key CONSTANT TEXT := '682_coaching_push_up_standard_profile_mapping';
  definition_id_value UUID;
  prior_version INTEGER;
BEGIN
  SELECT id, card_version INTO definition_id_value, prior_version
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1 AND slug = 'push-up' AND status = 'review';
  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION '% requires the review candidate', migration_key;
  END IF;
  IF EXISTS (
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE id = definition_id_value
      AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refuses to overwrite reviewed candidate', migration_key;
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET load_profile_json = COALESCE(load_profile_json, '{}'::jsonb) || jsonb_build_object(
        'gripDemand', (load_profile_json ->> 'wristAndHandDemand')::integer,
        'spinalLoading', (load_profile_json ->> 'trunkDemand')::integer
      ),
      fatigue_profile_json = COALESCE(fatigue_profile_json, '{}'::jsonb) || jsonb_build_object(
        'gripFatigue', (fatigue_profile_json ->> 'wristAndHandFatigue')::integer
      ),
      updated_at = now()
  WHERE definition_id = definition_id_value
    AND status = 'review'
    AND load_profile_json ? 'wristAndHandDemand'
    AND load_profile_json ? 'trunkDemand'
    AND fatigue_profile_json ? 'wristAndHandFatigue';
  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE definition_id = definition_id_value AND status = 'review'
        AND load_profile_json ?& ARRAY['gripDemand', 'spinalLoading', 'eccentricStress', 'landingContactsPerRep', 'externalLoadMethod']
        AND fatigue_profile_json ?& ARRAY['localMuscleFatigue', 'gripFatigue', 'technicalFatigueSensitivity', 'impactAccumulation', 'recoveryHours']) <> 11 THEN
    RAISE EXCEPTION '% failed standardized mapping', migration_key;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET card_version = prior_version + 1,
      provenance_json = COALESCE(provenance_json, '{}'::jsonb) || jsonb_build_object(
        'operationalProfileCompletion', migration_key,
        'operationalEstimateStatus', 'candidate_unapproved_planning_estimates',
        'standardizedFieldMapping', 'gripDemand<-wristAndHandDemand; spinalLoading<-trunkDemand; gripFatigue<-wristAndHandFatigue',
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
$push_up_standard_profile_mapping$;
