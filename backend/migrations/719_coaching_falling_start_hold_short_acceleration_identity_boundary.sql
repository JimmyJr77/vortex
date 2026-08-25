-- A shared forward lean is not identity equivalence: this task ends in a hold,
-- while Short Acceleration Sprint continues through a measured acceleration.
DO $falling_start_hold_short_acceleration_boundary$
DECLARE
  migration_key CONSTANT TEXT := '719_coaching_falling_start_hold_short_acceleration_identity_boundary';
  acceleration_id UUID;
  hold_id UUID;
BEGIN
  SELECT id INTO acceleration_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='10-yard-sprint' AND status='review';
  SELECT id INTO hold_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='falling-start-hold' AND status='review';
  IF acceleration_id IS NULL OR hold_id IS NULL THEN
    RAISE EXCEPTION '% requires active review cards for Short Acceleration Sprint and Falling Start Position Hold', migration_key;
  END IF;
  IF EXISTS (
    SELECT 1 FROM coaching.exercise_identity_resolution_v1
    WHERE survivor_definition_id=acceleration_id AND resolved_definition_id=hold_id
      AND (resolution_source='human_review' OR reviewed_by IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refuses to overwrite a human identity decision', migration_key;
  END IF;
  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at
  ) VALUES (
    1,acceleration_id,hold_id,'distinct_exercises',
    'Short Acceleration Sprint begins from a static or falling start and continues through a prescribed short acceleration target and planned run-out. Falling Start Position Hold leans, takes exactly one recovery step, catches a split stance, holds, and resets without sprinting. Terminal action, distance, contact sequence, fatigue budget, quality gate, and safety contract are identity-bearing differences.',
    jsonb_build_object('identityBoundary','short_acceleration_through_target_and_run_out_vs_one_step_terminal_split_stance_hold_without_sprint','decisionScope','identity_only_not_human_approval','humanReviewRequired',TRUE,'approvalsCreated',FALSE,'migration',migration_key),
    'deterministic_identity_equivalence',NULL,now()
  )
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE
    SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,
        resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review'
    AND coaching.exercise_identity_resolution_v1.reviewed_by IS NULL;
  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_identity_resolution_v1
    WHERE survivor_definition_id=acceleration_id AND resolved_definition_id=hold_id
      AND decision='distinct_exercises' AND resolution_source='deterministic_identity_equivalence'
      AND reviewed_by IS NULL
  ) THEN RAISE EXCEPTION '% failed to persist identity boundary', migration_key; END IF;
END;
$falling_start_hold_short_acceleration_boundary$;
