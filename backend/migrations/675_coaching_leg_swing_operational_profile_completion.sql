-- Complete standardized planning fields on two exact supported leg-swing
-- candidates. The estimates remain candidate-only and do not create approval.
DO $leg_swing_operational_profile_completion$
DECLARE
  migration_key CONSTANT TEXT := '675_coaching_leg_swing_operational_profile_completion';
  spec RECORD;
  definition_id_value UUID;
  prior_version INTEGER;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('leg-swings-front-back'::TEXT,'supported-stationary-front-back-leg-swing'::TEXT,3,3,4,2),
    ('leg-swings-lateral'::TEXT,'supported-stationary-lateral-leg-swing'::TEXT,3,3,4,2)
  ) AS cards(slug,variant_key,grip,spinal,eccentric,recovery_hours)
  LOOP
    SELECT id,card_version INTO definition_id_value,prior_version
      FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND slug=spec.slug AND status='review';
    IF definition_id_value IS NULL THEN RAISE EXCEPTION '% requires review candidate %',migration_key,spec.slug; END IF;
    IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=definition_id_value
      AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL))
      OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1 WHERE definition_id=definition_id_value
        AND (review_status IN ('approved','shortlisted') OR reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL)) THEN
      RAISE EXCEPTION '% refuses to overwrite reviewed candidate %',migration_key,spec.slug;
    END IF;
    UPDATE coaching.exercise_variant_v1 SET
      load_profile_json=COALESCE(load_profile_json,'{}'::jsonb)||jsonb_build_object(
        'gripDemand',spec.grip,'spinalLoading',spec.spinal,'eccentricStress',spec.eccentric,'landingContactsPerRep',0),
      fatigue_profile_json=COALESCE(fatigue_profile_json,'{}'::jsonb)||jsonb_build_object('gripFatigue',2,'recoveryHours',spec.recovery_hours),updated_at=now()
      WHERE definition_id=definition_id_value AND variant_key=spec.variant_key AND status='review';
    IF NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE definition_id=definition_id_value AND variant_key=spec.variant_key
      AND load_profile_json ?& ARRAY['gripDemand','spinalLoading','eccentricStress','landingContactsPerRep','externalLoadMethod']
      AND fatigue_profile_json ?& ARRAY['localMuscleFatigue','gripFatigue','technicalFatigueSensitivity','impactAccumulation','recoveryHours']) THEN
      RAISE EXCEPTION '% failed operational completion for %',migration_key,spec.slug;
    END IF;
    UPDATE coaching.exercise_definition_v1 SET card_version=prior_version+1,
      provenance_json=COALESCE(provenance_json,'{}'::jsonb)||jsonb_build_object(
        'operationalProfileCompletion',migration_key,'operationalEstimateStatus','candidate_unapproved_planning_estimates',
        'humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true),updated_at=now() WHERE id=definition_id_value;
    UPDATE coaching.exercise_section_evidence_v1 SET reviewed_card_version=prior_version+1,updated_at=now()
      WHERE definition_id=definition_id_value AND reviewed_card_version=prior_version AND review_status='candidate';
    UPDATE coaching.exercise_media_candidate_v1 SET reviewed_card_version=prior_version+1,updated_at=now()
      WHERE definition_id=definition_id_value AND reviewed_card_version=prior_version AND review_status='candidate';
    UPDATE coaching.exercise_alternate_assessment_v1 SET reviewed_card_version=prior_version+1,updated_at=now()
      WHERE definition_id=definition_id_value AND reviewed_card_version=prior_version AND review_status='candidate';
  END LOOP;
END;
$leg_swing_operational_profile_completion$;
