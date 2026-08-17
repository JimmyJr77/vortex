-- Complete machine-readable operational fields for the existing exact Source 47
-- candidate. These are unapproved planning estimates, not clinical claims or
-- publication approval; candidate evidence and media remain review-gated.
DO $foot_tripod_operational_profile_completion$
DECLARE
  migration_key CONSTANT TEXT := '673_coaching_foot_tripod_operational_profile_completion';
  definition_id_value UUID;
  prior_version INTEGER;
BEGIN
  SELECT id,card_version INTO definition_id_value,prior_version
    FROM coaching.exercise_definition_v1
   WHERE facility_id=1
     AND slug='foot-tripod-weight-shifts'
     AND status='review';

  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION '% requires the Source 47 review candidate', migration_key;
  END IF;
  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1
     WHERE id=definition_id_value
       AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
  ) OR EXISTS(
    SELECT 1 FROM coaching.exercise_media_candidate_v1
     WHERE definition_id=definition_id_value
       AND (review_status IN ('approved','shortlisted') OR reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refuses to overwrite reviewed candidate state', migration_key;
  END IF;

  UPDATE coaching.exercise_variant_v1
     SET load_profile_json=COALESCE(load_profile_json,'{}'::jsonb)||
           CASE variant_key
             WHEN 'bilateral-standing-hands-free-four-direction-tripod-weight-shift-circuit'
               THEN jsonb_build_object('gripDemand',1,'spinalLoading',3,'eccentricStress',4)
             WHEN 'bilateral-standing-wall-touch-four-direction-tripod-weight-shift-circuit'
               THEN jsonb_build_object('gripDemand',2,'spinalLoading',2,'eccentricStress',3)
           END,
         fatigue_profile_json=COALESCE(fatigue_profile_json,'{}'::jsonb)||
           CASE variant_key
             WHEN 'bilateral-standing-hands-free-four-direction-tripod-weight-shift-circuit'
               THEN jsonb_build_object('gripFatigue',1,'recoveryHours',6)
             WHEN 'bilateral-standing-wall-touch-four-direction-tripod-weight-shift-circuit'
               THEN jsonb_build_object('gripFatigue',2,'recoveryHours',6)
           END,
         updated_at=now()
   WHERE definition_id=definition_id_value
     AND variant_key IN (
       'bilateral-standing-hands-free-four-direction-tripod-weight-shift-circuit',
       'bilateral-standing-wall-touch-four-direction-tripod-weight-shift-circuit'
     )
     AND status='review';

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE definition_id=definition_id_value
        AND variant_key IN (
          'bilateral-standing-hands-free-four-direction-tripod-weight-shift-circuit',
          'bilateral-standing-wall-touch-four-direction-tripod-weight-shift-circuit'
        )
        AND load_profile_json ?& ARRAY['gripDemand','spinalLoading','eccentricStress','landingContactsPerRep','externalLoadMethod']
        AND fatigue_profile_json ?& ARRAY['localMuscleFatigue','gripFatigue','technicalFatigueSensitivity','impactAccumulation','recoveryHours'])<>2 THEN
    RAISE EXCEPTION '% failed to complete both operational profiles', migration_key;
  END IF;

  UPDATE coaching.exercise_definition_v1
     SET card_version=prior_version+1,
         provenance_json=COALESCE(provenance_json,'{}'::jsonb)||jsonb_build_object(
           'operationalProfileCompletion',migration_key,
           'operationalEstimateStatus','candidate_unapproved_planning_estimates',
           'humanReviewRequired',true,
           'approvalsCreated',false,
           'publicationQuarantined',true,
           'exerciseDifficultyDescribesTaskOnly',true
         ),
         updated_at=now()
   WHERE id=definition_id_value;

  UPDATE coaching.exercise_section_evidence_v1
     SET reviewed_card_version=prior_version+1,updated_at=now()
   WHERE definition_id=definition_id_value
     AND reviewed_card_version=prior_version
     AND review_status='candidate';
  UPDATE coaching.exercise_media_candidate_v1
     SET reviewed_card_version=prior_version+1,updated_at=now()
   WHERE definition_id=definition_id_value
     AND reviewed_card_version=prior_version
     AND review_status='candidate';
  UPDATE coaching.exercise_alternate_assessment_v1
     SET reviewed_card_version=prior_version+1,updated_at=now()
   WHERE definition_id=definition_id_value
     AND reviewed_card_version=prior_version
     AND review_status='candidate';
END;
$foot_tripod_operational_profile_completion$;
