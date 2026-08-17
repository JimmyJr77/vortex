-- A name-token false positive is not an identity merge. Both cards remain
-- quarantined for their independent human card/media/calibration reviews.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '759_coaching_overhead_slam_strict_press_identity_boundary';
  overhead_slam_id UUID;
  strict_press_id UUID;
BEGIN
  SELECT id INTO overhead_slam_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='medicine-ball-overhead-slam' AND status<>'archived';

  SELECT id INTO strict_press_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='strict-overhead-press' AND status<>'archived';

  IF overhead_slam_id IS NULL OR strict_press_id IS NULL THEN
    RAISE EXCEPTION '% requires the active Medicine Ball Overhead Slam and Standing Strict Overhead Press definitions', migration_key;
  END IF;

  IF EXISTS (
    SELECT 1 FROM coaching.exercise_identity_resolution_v1
    WHERE survivor_definition_id=overhead_slam_id
      AND resolved_definition_id=strict_press_id
      AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
  ) THEN
    RAISE EXCEPTION '% refuses to overwrite a human-reviewed identity decision', migration_key;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1 (
    facility_id, survivor_definition_id, resolved_definition_id, decision,
    rationale, evidence_json, resolution_source, reviewed_by, resolved_at
  ) VALUES (
    1, overhead_slam_id, strict_press_id, 'distinct_exercises',
    'Medicine Ball Overhead Slam is a ballistic, overhead-to-floor medicine-ball release with a floor-impact and retrieval rule. Standing Strict Overhead Press is a retained external-load vertical press without a ballistic release, floor target, impact, or retrieval. Implement behavior, terminal action, force path, loading, safety controls, and training intent are materially different.',
    jsonb_build_object(
      'migration', migration_key,
      'identityBoundary', 'ballistic_overhead_floor_release_vs_retained_load_vertical_press',
      'automaticSubstitution', FALSE,
      'humanReviewRequired', TRUE,
      'approvalsCreated', FALSE,
      'leftContract', 'standing_bilateral_overhead_to_floor_medicine_ball_release_with_safe_retrieval',
      'rightContract', 'standing_retained_external_load_vertical_press_without_ballistic_release'
    ),
    'deterministic_identity_equivalence', NULL, now()
  ) ON CONFLICT (survivor_definition_id, resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,
    rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,
    resolved_at=EXCLUDED.resolved_at;

  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_identity_resolution_v1
    WHERE survivor_definition_id=overhead_slam_id
      AND resolved_definition_id=strict_press_id
      AND decision='distinct_exercises'
      AND resolution_source='deterministic_identity_equivalence'
      AND reviewed_by IS NULL
      AND evidence_json->>'migration'=migration_key
      AND evidence_json->>'approvalsCreated'='false'
  ) THEN
    RAISE EXCEPTION '% identity-boundary assertion failed', migration_key;
  END IF;
END
$migration$;
