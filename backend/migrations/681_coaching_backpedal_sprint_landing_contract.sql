-- Supply explicit lower-body contact planning units for exact review variants.
-- These contact estimates are candidate-only and do not approve or publish media/card content.
DO $backpedal_sprint_landing_contract$
DECLARE
  migration_key CONSTANT TEXT := '681_coaching_backpedal_sprint_landing_contract';
  definition_id_value UUID;
  prior_version INTEGER;
BEGIN
  SELECT id, card_version INTO definition_id_value, prior_version
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1 AND slug = 'backpedal-to-sprint-turn' AND status = 'review';
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
  SET load_profile_json = COALESCE(load_profile_json, '{}'::jsonb) || jsonb_build_object('landingContactsPerRep', 8),
      updated_at = now()
  WHERE definition_id = definition_id_value
    AND variant_key = ANY (ARRAY['preplanned-90', 'preplanned-180', 'reactive-90', 'reactive-180'])
    AND status = 'review';
  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE definition_id = definition_id_value
        AND variant_key = ANY (ARRAY['preplanned-90', 'preplanned-180', 'reactive-90', 'reactive-180'])
        AND status = 'review'
        AND load_profile_json ?& ARRAY['gripDemand', 'spinalLoading', 'eccentricStress', 'landingContactsPerRep', 'externalLoadMethod']) <> 4 THEN
    RAISE EXCEPTION '% failed operational completion', migration_key;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET card_version = prior_version + 1,
      provenance_json = COALESCE(provenance_json, '{}'::jsonb) || jsonb_build_object(
        'operationalProfileCompletion', migration_key,
        'operationalEstimateStatus', 'candidate_unapproved_planning_estimates',
        'landingContactEstimateBasis', 'one backward travel, turn plant, and forward sprint repetition',
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
$backpedal_sprint_landing_contract$;
