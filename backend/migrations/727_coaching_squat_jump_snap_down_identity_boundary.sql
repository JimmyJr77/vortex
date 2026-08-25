-- "Drop Squat" wording raises a lexical match with Squat Jump, but the
-- takeoff/rebound contract makes the exercises distinct.
DO $squat_jump_snap_down_identity_boundary$
DECLARE
  migration_key CONSTANT TEXT := '727_coaching_squat_jump_snap_down_identity_boundary';
  squat_jump_id UUID;
  snap_down_id UUID;
BEGIN
  SELECT id INTO squat_jump_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='squat-jump' AND status='review';
  SELECT id INTO snap_down_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='snap-down-to-stick' AND status='review';
  IF squat_jump_id IS NULL OR snap_down_id IS NULL THEN
    RAISE EXCEPTION '% requires active Squat Jump and Snap-Down review cards', migration_key;
  END IF;
  IF EXISTS (
    SELECT 1 FROM coaching.exercise_identity_resolution_v1
    WHERE survivor_definition_id=squat_jump_id AND resolved_definition_id=snap_down_id
      AND (resolution_source='human_review' OR reviewed_by IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refuses to overwrite a human identity decision', migration_key;
  END IF;
  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at
  ) VALUES (
    1,squat_jump_id,snap_down_id,'distinct_exercises',
    'Squat Jump includes a concentric takeoff and flight as its terminal power action. Snap-Down to Stick (including the Drop Squat alias) starts tall, rapidly lowers without a preparatory jump, arrives with both feet grounded, and prohibits rebound or takeoff. The contact sequence, impact, purpose, load, fatigue, and stop contracts are identity-bearing differences.',
    jsonb_build_object(
      'identityBoundary','squat_jump_takeoff_and_flight_vs_nonjump_grounded_drop_to_terminal_stick',
      'decisionScope','identity_only_not_human_approval',
      'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE,
      'migration',migration_key
    ),
    'deterministic_identity_equivalence',NULL,now()
  ) ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE
    SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,
        resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review'
    AND coaching.exercise_identity_resolution_v1.reviewed_by IS NULL;
  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_identity_resolution_v1
    WHERE survivor_definition_id=squat_jump_id AND resolved_definition_id=snap_down_id
      AND decision='distinct_exercises' AND reviewed_by IS NULL
  ) THEN
    RAISE EXCEPTION '% failed to persist the identity boundary', migration_key;
  END IF;
END;
$squat_jump_snap_down_identity_boundary$;
