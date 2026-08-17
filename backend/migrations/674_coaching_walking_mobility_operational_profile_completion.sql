-- Complete standardized operational fields for the exact Source 50–51 candidate
-- cards. Values are candidate planning estimates only; no media, relationship,
-- calibration, reviewer, or publication approval is created.
DO $walking_mobility_operational_profile_completion$
DECLARE
  migration_key CONSTANT TEXT := '674_coaching_walking_mobility_operational_profile_completion';
  spec RECORD;
  definition_id_value UUID;
  prior_version INTEGER;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('walking-knee-hug'::TEXT, ARRAY[
      'alternating-walking-hands-free-knee-hug-step-through',
      'alternating-walking-wall-touch-knee-hug-step-through']::TEXT[]),
    ('walking-quad-pull'::TEXT, ARRAY[
      'alternating-walking-hands-free-quad-pull-step-through',
      'alternating-walking-wall-touch-quad-pull-step-through']::TEXT[])
  ) AS cards(slug,variant_keys)
  LOOP
    SELECT id,card_version INTO definition_id_value,prior_version
      FROM coaching.exercise_definition_v1
     WHERE facility_id=1 AND slug=spec.slug AND status='review';
    IF definition_id_value IS NULL THEN
      RAISE EXCEPTION '% requires review candidate %',migration_key,spec.slug;
    END IF;
    IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=definition_id_value
      AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL))
      OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1 WHERE definition_id=definition_id_value
        AND (review_status IN ('approved','shortlisted') OR reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL)) THEN
      RAISE EXCEPTION '% refuses to overwrite reviewed candidate %',migration_key,spec.slug;
    END IF;
    UPDATE coaching.exercise_variant_v1
       SET load_profile_json=COALESCE(load_profile_json,'{}'::jsonb)||
             CASE variant_key
               WHEN spec.variant_keys[1] THEN jsonb_build_object('gripDemand',6,'spinalLoading',4,'eccentricStress',5,'landingContactsPerRep',0)
               WHEN spec.variant_keys[2] THEN jsonb_build_object('gripDemand',4,'spinalLoading',3,'eccentricStress',4,'landingContactsPerRep',0)
             END,
           fatigue_profile_json=COALESCE(fatigue_profile_json,'{}'::jsonb)||
             CASE variant_key
               WHEN spec.variant_keys[1] THEN jsonb_build_object('gripFatigue',4,'recoveryHours',4)
               WHEN spec.variant_keys[2] THEN jsonb_build_object('gripFatigue',3,'recoveryHours',4)
             END,
           updated_at=now()
     WHERE definition_id=definition_id_value AND variant_key=ANY(spec.variant_keys) AND status='review';
    IF (SELECT count(*) FROM coaching.exercise_variant_v1 WHERE definition_id=definition_id_value
      AND variant_key=ANY(spec.variant_keys)
      AND load_profile_json ?& ARRAY['gripDemand','spinalLoading','eccentricStress','landingContactsPerRep','externalLoadMethod']
      AND fatigue_profile_json ?& ARRAY['localMuscleFatigue','gripFatigue','technicalFatigueSensitivity','impactAccumulation','recoveryHours'])<>2 THEN
      RAISE EXCEPTION '% failed to complete % operational variants',migration_key,spec.slug;
    END IF;
    UPDATE coaching.exercise_definition_v1 SET card_version=prior_version+1,
      provenance_json=COALESCE(provenance_json,'{}'::jsonb)||jsonb_build_object(
        'operationalProfileCompletion',migration_key,'operationalEstimateStatus','candidate_unapproved_planning_estimates',
        'humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,
        'exerciseDifficultyDescribesTaskOnly',true),updated_at=now() WHERE id=definition_id_value;
    UPDATE coaching.exercise_section_evidence_v1 SET reviewed_card_version=prior_version+1,updated_at=now()
      WHERE definition_id=definition_id_value AND reviewed_card_version=prior_version AND review_status='candidate';
    UPDATE coaching.exercise_media_candidate_v1 SET reviewed_card_version=prior_version+1,updated_at=now()
      WHERE definition_id=definition_id_value AND reviewed_card_version=prior_version AND review_status='candidate';
    UPDATE coaching.exercise_alternate_assessment_v1 SET reviewed_card_version=prior_version+1,updated_at=now()
      WHERE definition_id=definition_id_value AND reviewed_card_version=prior_version AND review_status='candidate';
  END LOOP;
END;
$walking_mobility_operational_profile_completion$;
