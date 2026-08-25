-- Complete standardized planning fields for four exact candidate variants.
-- All values remain unapproved planning estimates and do not publish cards.
DO $floor_mobility_bridge_operational_profile_completion$
DECLARE
  migration_key CONSTANT TEXT := '677_coaching_floor_mobility_bridge_operational_profile_completion';
  spec RECORD; definition_id_value UUID; prior_version INTEGER;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('deep-squat-pry'::TEXT,'bodyweight-deep-squat-gentle-pry'::TEXT,3,5,6,2),
    ('squat-to-stand-with-reach'::TEXT,'sequential-bilateral-reach-squat-to-stand'::TEXT,2,5,6,2),
    ('glute-bridge'::TEXT,'bodyweight-bilateral-floor-glute-bridge'::TEXT,2,4,5,2),
    ('glute-bridge-march'::TEXT,'bodyweight-alternating-elevated-floor-glute-bridge-march'::TEXT,2,6,8,6)
  ) AS cards(slug,variant_key,grip,spinal,eccentric,recovery_hours)
  LOOP
    SELECT id,card_version INTO definition_id_value,prior_version FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND slug=spec.slug AND status='review';
    IF definition_id_value IS NULL THEN RAISE EXCEPTION '% requires review candidate %',migration_key,spec.slug; END IF;
    IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=definition_id_value AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)) THEN RAISE EXCEPTION '% refuses reviewed candidate %',migration_key,spec.slug; END IF;
    UPDATE coaching.exercise_variant_v1 SET load_profile_json=COALESCE(load_profile_json,'{}'::jsonb)||jsonb_build_object('gripDemand',spec.grip,'spinalLoading',spec.spinal,'eccentricStress',spec.eccentric,'landingContactsPerRep',0),fatigue_profile_json=COALESCE(fatigue_profile_json,'{}'::jsonb)||jsonb_build_object('gripFatigue',2,'recoveryHours',spec.recovery_hours),updated_at=now() WHERE definition_id=definition_id_value AND variant_key=spec.variant_key AND status='review';
    IF NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE definition_id=definition_id_value AND variant_key=spec.variant_key AND load_profile_json ?& ARRAY['gripDemand','spinalLoading','eccentricStress','landingContactsPerRep','externalLoadMethod'] AND fatigue_profile_json ?& ARRAY['localMuscleFatigue','gripFatigue','technicalFatigueSensitivity','impactAccumulation','recoveryHours']) THEN RAISE EXCEPTION '% failed for %',migration_key,spec.slug; END IF;
    UPDATE coaching.exercise_definition_v1 SET card_version=prior_version+1,provenance_json=COALESCE(provenance_json,'{}'::jsonb)||jsonb_build_object('operationalProfileCompletion',migration_key,'operationalEstimateStatus','candidate_unapproved_planning_estimates','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true),updated_at=now() WHERE id=definition_id_value;
    UPDATE coaching.exercise_section_evidence_v1 SET reviewed_card_version=prior_version+1,updated_at=now() WHERE definition_id=definition_id_value AND reviewed_card_version=prior_version AND review_status='candidate';
    UPDATE coaching.exercise_media_candidate_v1 SET reviewed_card_version=prior_version+1,updated_at=now() WHERE definition_id=definition_id_value AND reviewed_card_version=prior_version AND review_status='candidate';
    UPDATE coaching.exercise_alternate_assessment_v1 SET reviewed_card_version=prior_version+1,updated_at=now() WHERE definition_id=definition_id_value AND reviewed_card_version=prior_version AND review_status='candidate';
  END LOOP;
END;
$floor_mobility_bridge_operational_profile_completion$;
