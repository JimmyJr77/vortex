-- Complete standardized planning fields for the exact Drop Jump review candidate.
-- The high-impact estimate is candidate-only and preserves all human gates.
DO $drop_jump_standard_profile_completion$
DECLARE
  migration_key CONSTANT TEXT := '687_coaching_drop_jump_standard_profile_completion';
  definition_id_value UUID;
  prior_version INTEGER;
BEGIN
  SELECT id, card_version INTO definition_id_value, prior_version
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1 AND slug = 'drop-jump' AND status = 'review';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION '% requires the review candidate', migration_key; END IF;
  IF EXISTS (SELECT 1 FROM coaching.exercise_definition_v1 WHERE id = definition_id_value
             AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION '% refuses to overwrite reviewed candidate', migration_key;
  END IF;
  UPDATE coaching.exercise_variant_v1
  SET load_profile_json = COALESCE(load_profile_json, '{}'::jsonb) || jsonb_build_object(
        'gripDemand', 1, 'spinalLoading', 22, 'eccentricStress', 65,
        'landingContactsPerRep', 2, 'externalLoadMethod', 'bodyweight'
      ), fatigue_profile_json = COALESCE(fatigue_profile_json, '{}'::jsonb) || jsonb_build_object(
        'gripFatigue', 1, 'recoveryHours', 48
      ), updated_at = now()
  WHERE definition_id = definition_id_value AND variant_key = 'baseline' AND status = 'review';
  IF NOT EXISTS (SELECT 1 FROM coaching.exercise_variant_v1 WHERE definition_id = definition_id_value
                 AND variant_key = 'baseline' AND status = 'review'
                 AND load_profile_json ?& ARRAY['gripDemand', 'spinalLoading', 'eccentricStress', 'landingContactsPerRep', 'externalLoadMethod']
                 AND fatigue_profile_json ?& ARRAY['localMuscleFatigue', 'gripFatigue', 'technicalFatigueSensitivity', 'impactAccumulation', 'recoveryHours']) THEN
    RAISE EXCEPTION '% failed standardized profile completion', migration_key;
  END IF;
  UPDATE coaching.exercise_definition_v1 SET card_version = prior_version + 1,
    provenance_json = COALESCE(provenance_json, '{}'::jsonb) || jsonb_build_object(
      'operationalProfileCompletion', migration_key, 'operationalEstimateStatus', 'candidate_unapproved_planning_estimates',
      'humanReviewRequired', true, 'approvalsCreated', false, 'publicationQuarantined', true
    ), updated_at = now() WHERE id = definition_id_value;
  UPDATE coaching.exercise_section_evidence_v1 SET reviewed_card_version = prior_version + 1, updated_at = now()
  WHERE definition_id = definition_id_value AND reviewed_card_version = prior_version AND review_status = 'candidate';
  UPDATE coaching.exercise_media_candidate_v1 SET reviewed_card_version = prior_version + 1, updated_at = now()
  WHERE definition_id = definition_id_value AND reviewed_card_version = prior_version AND review_status = 'candidate';
  UPDATE coaching.exercise_alternate_assessment_v1 SET reviewed_card_version = prior_version + 1, updated_at = now()
  WHERE definition_id = definition_id_value AND reviewed_card_version = prior_version AND review_status = 'candidate';
END;
$drop_jump_standard_profile_completion$;
