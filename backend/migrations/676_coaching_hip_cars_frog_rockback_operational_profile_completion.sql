-- Complete standardized planning fields for exact Hip CAR and Frog Rockback
-- candidates only. Estimates remain unapproved and review-only.
DO $hip_cars_frog_rockback_operational_profile_completion$
DECLARE
  migration_key CONSTANT TEXT := '676_coaching_hip_cars_frog_rockback_operational_profile_completion';
  spec RECORD; definition_id_value UUID; prior_version INTEGER;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('hip-cars'::TEXT,ARRAY['quadruped-hip-car','standing-stable-support-hip-car']::TEXT[]),
    ('frog-rockback'::TEXT,ARRAY['bilateral-wide-kneeling-frog-rockback']::TEXT[])
  ) AS cards(slug,variant_keys)
  LOOP
    SELECT id,card_version INTO definition_id_value,prior_version FROM coaching.exercise_definition_v1
      WHERE facility_id=1 AND slug=spec.slug AND status='review';
    IF definition_id_value IS NULL THEN RAISE EXCEPTION '% requires review candidate %',migration_key,spec.slug; END IF;
    IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=definition_id_value AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)) THEN
      RAISE EXCEPTION '% refuses to overwrite reviewed candidate %',migration_key,spec.slug;
    END IF;
    UPDATE coaching.exercise_variant_v1 SET
      load_profile_json=COALESCE(load_profile_json,'{}'::jsonb)||
        CASE variant_key WHEN 'quadruped-hip-car' THEN jsonb_build_object('gripDemand',5,'spinalLoading',5,'eccentricStress',5,'landingContactsPerRep',0)
          WHEN 'standing-stable-support-hip-car' THEN jsonb_build_object('gripDemand',3,'spinalLoading',3,'eccentricStress',4,'landingContactsPerRep',0)
          ELSE jsonb_build_object('gripDemand',3,'spinalLoading',4,'eccentricStress',5,'landingContactsPerRep',0) END,
      fatigue_profile_json=COALESCE(fatigue_profile_json,'{}'::jsonb)||jsonb_build_object('gripFatigue',2,'recoveryHours',2),updated_at=now()
      WHERE definition_id=definition_id_value AND variant_key=ANY(spec.variant_keys) AND status='review';
    IF (SELECT count(*) FROM coaching.exercise_variant_v1 WHERE definition_id=definition_id_value AND variant_key=ANY(spec.variant_keys)
      AND load_profile_json ?& ARRAY['gripDemand','spinalLoading','eccentricStress','landingContactsPerRep','externalLoadMethod']
      AND fatigue_profile_json ?& ARRAY['localMuscleFatigue','gripFatigue','technicalFatigueSensitivity','impactAccumulation','recoveryHours'])<>cardinality(spec.variant_keys) THEN
      RAISE EXCEPTION '% failed operational completion for %',migration_key,spec.slug;
    END IF;
    UPDATE coaching.exercise_definition_v1 SET card_version=prior_version+1,provenance_json=COALESCE(provenance_json,'{}'::jsonb)||jsonb_build_object('operationalProfileCompletion',migration_key,'operationalEstimateStatus','candidate_unapproved_planning_estimates','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true),updated_at=now() WHERE id=definition_id_value;
    UPDATE coaching.exercise_section_evidence_v1 SET reviewed_card_version=prior_version+1,updated_at=now() WHERE definition_id=definition_id_value AND reviewed_card_version=prior_version AND review_status='candidate';
    UPDATE coaching.exercise_media_candidate_v1 SET reviewed_card_version=prior_version+1,updated_at=now() WHERE definition_id=definition_id_value AND reviewed_card_version=prior_version AND review_status='candidate';
    UPDATE coaching.exercise_alternate_assessment_v1 SET reviewed_card_version=prior_version+1,updated_at=now() WHERE definition_id=definition_id_value AND reviewed_card_version=prior_version AND review_status='candidate';
  END LOOP;
END;
$hip_cars_frog_rockback_operational_profile_completion$;
