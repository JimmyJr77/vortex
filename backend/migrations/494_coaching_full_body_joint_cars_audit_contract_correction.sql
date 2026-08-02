-- Correct two machine-contract mismatches found by the independent canonical
-- evaluator after migration 493: athlete instructions exceeded 240 characters,
-- and four regression edges used descriptive rather than controlled
-- progression dimensions. Migration 493 is registered and remains immutable.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '494_coaching_full_body_joint_cars_audit_contract_correction';
  canonical_definition CONSTANT UUID := 'c6e2b1c7-e42f-47b6-ac34-2549b32f8dd3';
  independent_variant CONSTANT UUID := 'c3eea4b0-3dfd-420c-b7ca-dcdf6a96b21c';
  wall_variant CONSTANT UUID := '627e9509-da11-4e18-8e6a-e67eea115dad';
  active_variant_ids CONSTANT UUID[] := ARRAY[independent_variant,wall_variant];
  protected_count INTEGER;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND card_version=2 AND status='review'
        AND provenance_json->>'migration'='493_coaching_full_body_joint_cars_flow_audit_hardening')
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_definition
        AND status='review')<>2 THEN
    RAISE EXCEPTION '% prerequisite migration 493 state is missing',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL
        OR last_reviewed_at IS NOT NULL OR status IN('published','deprecated'))
    UNION ALL SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids)
        AND status IN('published','deprecated')
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=independent_variant AND relationship='regression'
        AND (reviewed_by IS NOT NULL OR review_status='approved')
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to alter % human-reviewed records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1 SET
    athlete_instructions='Use the support shown. Move the announced joint slowly in a comfortable range without momentum, complete both directions and required sides, then return to neutral. Stop for pain, pinching, dizziness, neurologic symptoms, or lost balance.',
    updated_at=now()
  WHERE variant_id=ANY(active_variant_ids) AND status='review';

  UPDATE coaching.exercise_relationship_v1 SET
    dimensions=ARRAY['range','stability','complexity']::TEXT[],
    conditions_json=coalesce(conditions_json,'{}'::JSONB)||jsonb_build_object(
      'contractCorrection',migration_key,
      'controlledProgressionDimensions',jsonb_build_array('range','stability','complexity'),
      'descriptiveMobilityAndDurationFactsRetainedInReason',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    updated_at=now()
  WHERE from_variant_id=independent_variant AND relationship='regression'
    AND review_status='review' AND reviewed_by IS NULL;

  UPDATE coaching.exercise_definition_v1 SET
    provenance_json=provenance_json||jsonb_build_object(
      'canonicalAuditContractCorrection',migration_key,
      'athleteInstructionMaximumCharacters',240,
      'graphDimensionsUseControlledProgressionVocabulary',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id=canonical_definition;

  UPDATE coaching.exercise_card_test_packet_v1 SET
    audit_version=migration_key,
    checks_json=checks_json||jsonb_build_object(
      'contractCorrection',jsonb_build_object(
        'passed',TRUE,'athleteInstructionsAtMost240Characters',TRUE,
        'controlledRegressionDimensions',jsonb_build_array('range','stability','complexity'),
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)),
    blocking_issues_json=jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','Qualified full-video playback, exactness, captions, accessibility, cue quality, safety, conflicts, reviewer, version, and approval review remains required.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','Qualified review of all support-equivalent and joint-specific regression proposals remains required; no automatic partial-flow substitution is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','Independent calibration of exercise complexity and physical difficulty remains required for both variants.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','Qualified content review and separate publication approval remain required.')),
    status='quarantined',human_review_required=TRUE,checked_at=now()
  WHERE definition_id=canonical_definition;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND length(athlete_instructions) BETWEEN 10 AND 240)<>4
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=independent_variant AND relationship='regression'
        AND review_status='review' AND reviewed_by IS NULL
        AND dimensions=ARRAY['range','stability','complexity']::TEXT[])<>4
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND status='quarantined'
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% correction assertions failed',migration_key;
  END IF;
END
$migration$;
