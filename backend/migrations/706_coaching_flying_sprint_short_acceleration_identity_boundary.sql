-- The short acceleration and Flying Sprint cards share sprint vocabulary but
-- differ in entry, primary velocity quality, zone geometry, and fatigue model.
-- Record that deterministic boundary without creating a human approval.
DO $flying_sprint_short_acceleration_boundary$
DECLARE
  migration_key CONSTANT TEXT := '706_coaching_flying_sprint_short_acceleration_identity_boundary';
  acceleration_id UUID;
  flying_id UUID;
BEGIN
  SELECT id INTO acceleration_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='10-yard-sprint' AND status='review';
  SELECT id INTO flying_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='flying-10' AND status='review';
  IF acceleration_id IS NULL OR flying_id IS NULL THEN
    RAISE EXCEPTION '% requires active review cards for short acceleration and Flying Sprint', migration_key;
  END IF;
  IF EXISTS (
    SELECT 1 FROM coaching.exercise_identity_resolution_v1
    WHERE survivor_definition_id=acceleration_id
      AND resolved_definition_id=flying_id
      AND (resolution_source='human_review' OR reviewed_by IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refuses to overwrite a human identity decision', migration_key;
  END IF;
  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at
  ) VALUES (
    1,acceleration_id,flying_id,'distinct_exercises',
    'Short Acceleration Sprint begins from an explicit static or falling start and trains early projection through a short target. Flying Sprint uses a progressive build-in to enter a marked upright maximal-velocity zone and planned run-out. Start condition, primary velocity quality, zone geometry, high-speed exposure, and recovery contract are identity-bearing differences.',
    jsonb_build_object(
      'identityBoundary','static_or_falling_acceleration_start_vs_progressive_build_in_upright_fly_zone',
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
      AND resolved_definition_id=flying_id
      AND decision='distinct_exercises'
      AND resolution_source='deterministic_identity_equivalence'
      AND reviewed_by IS NULL
  ) THEN
    RAISE EXCEPTION '% failed to persist the identity boundary', migration_key;
  END IF;
END;
$flying_sprint_short_acceleration_boundary$;
