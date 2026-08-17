-- These cards share a short sprint finish but the ground-entry sequence is
-- identity-bearing and must never be silently substituted for a standard start.
DO $ground_start_short_acceleration_boundary$
DECLARE
  migration_key CONSTANT TEXT := '711_coaching_ground_start_short_acceleration_identity_boundary';
  acceleration_id UUID;
  ground_start_id UUID;
BEGIN
  SELECT id INTO acceleration_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='10-yard-sprint' AND status='review';
  SELECT id INTO ground_start_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='push-up-prone-start-sprint' AND status='review';
  IF acceleration_id IS NULL OR ground_start_id IS NULL THEN
    RAISE EXCEPTION '% requires active review cards for Short Acceleration Sprint and Ground-Start Sprint', migration_key;
  END IF;
  IF EXISTS (
    SELECT 1 FROM coaching.exercise_identity_resolution_v1
    WHERE survivor_definition_id=acceleration_id
      AND resolved_definition_id=ground_start_id
      AND (resolution_source='human_review' OR reviewed_by IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refuses to overwrite a human identity decision', migration_key;
  END IF;
  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at
  ) VALUES (
    1,acceleration_id,ground_start_id,'distinct_exercises',
    'Short Acceleration Sprint begins from an explicit standing, static, or falling start and trains early projection. Ground-Start Sprint begins from either a fully prone or exact push-up-bottom floor contact, requires a floor push, single-foot recovery, and hand clearance before acceleration. The entry contact state, upper-body support exposure, transition sequence, safety checks, and fatigue budget are identity-bearing differences.',
    jsonb_build_object(
      'identityBoundary','standing_static_or_falling_start_vs_defined_floor_contact_push_recovery_and_hand_clearance',
      'decisionScope','identity_only_not_human_approval',
      'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE,
      'migration',migration_key
    ),
    'deterministic_identity_equivalence',NULL,now()
  )
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE
    SET decision=EXCLUDED.decision,
        rationale=EXCLUDED.rationale,
        evidence_json=EXCLUDED.evidence_json,
        resolution_source=EXCLUDED.resolution_source,
        reviewed_by=NULL,
        resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review'
    AND coaching.exercise_identity_resolution_v1.reviewed_by IS NULL;
  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_identity_resolution_v1
    WHERE survivor_definition_id=acceleration_id
      AND resolved_definition_id=ground_start_id
      AND decision='distinct_exercises'
      AND resolution_source='deterministic_identity_equivalence'
      AND reviewed_by IS NULL
  ) THEN
    RAISE EXCEPTION '% failed to persist the identity boundary', migration_key;
  END IF;
END;
$ground_start_short_acceleration_boundary$;
