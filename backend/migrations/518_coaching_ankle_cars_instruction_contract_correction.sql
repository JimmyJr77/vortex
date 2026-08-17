-- Keep both Source 42 contextual athlete instructions within the canonical
-- 10-240 character rendering contract. No exercise semantics, score, review,
-- approval, relationship, calibration, media, or publication state changes.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '518_coaching_ankle_cars_instruction_contract_correction';
  prerequisite_filename CONSTANT TEXT := '517_coaching_ankle_cars_similarity_identity_closure.sql';
  ankle_definition UUID;
  ankle_variant UUID;
  concise_instruction CONSTANT TEXT := 'Sit securely with your thigh supported and foot clear. Keep the leg and trunk quiet. Pull up, turn in, point down, turn out, and finish at the start; reverse. Stop for pain, pinching, catching, tingling, weakness, dizziness, or instability.';
  protected_count INTEGER;
BEGIN
  SELECT id INTO ankle_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=42;
  SELECT id INTO ankle_variant FROM coaching.exercise_variant_v1 WHERE definition_id=ankle_definition AND variant_key='seated-thigh-supported-active-ankle-circuit';
  IF NOT EXISTS(SELECT 1 FROM schema_migrations
      WHERE filename=prerequisite_filename)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ankle_definition AND slug='ankle-cars' AND status='review')
    OR (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ankle_variant AND status='review')<>2 THEN
    RAISE EXCEPTION '% prerequisite migration or Source 42 profiles are missing or drifted',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=ankle_definition
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id=ankle_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id=ankle_definition
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to alter % human-reviewed or published Source 42 records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1 SET
    athlete_instructions=concise_instruction,updated_at=now()
  WHERE variant_id=ankle_variant AND status='review';

  UPDATE coaching.exercise_definition_v1 SET
    provenance_json=provenance_json||jsonb_build_object(
      'instructionContractCorrection',migration_key,
      'athleteInstructionMaximumCharacters',240,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id=ankle_definition;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ankle_variant AND status='review'
        AND athlete_instructions=concise_instruction
        AND length(athlete_instructions) BETWEEN 10 AND 240)<>2
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ankle_definition AND status='review'
        AND provenance_json->>'instructionContractCorrection'=migration_key
        AND reviewed_by IS NULL AND approved_by IS NULL AND last_reviewed_at IS NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ankle_definition
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR exact_variant_match IS NOT NULL OR demonstration_quality_score IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ankle_variant AND review_status='approved')
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ankle_variant AND status='approved') THEN
    RAISE EXCEPTION '% concise instruction or human-gate assertion failed',migration_key;
  END IF;
END
$migration$;
