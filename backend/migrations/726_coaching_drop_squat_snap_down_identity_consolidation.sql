-- The landing/braking packet establishes that a non-jump bilateral Drop Squat
-- to Stick and a Snap-Down to Stick share one movement identity. Preserve the
-- source-217 review work as provenance, move its source link to the survivor,
-- and quarantine the duplicate candidate. This is not human approval.
DO $drop_squat_snap_down_identity_consolidation$
DECLARE
  migration_key CONSTANT TEXT := '726_coaching_drop_squat_snap_down_identity_consolidation';
  survivor_id UUID;
  duplicate_id UUID;
BEGIN
  SELECT id INTO survivor_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='snap-down-to-stick' AND status='review';
  SELECT id INTO duplicate_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='drop-squat-to-stick' AND status='review';

  IF survivor_id IS NULL OR duplicate_id IS NULL OR survivor_id=duplicate_id THEN
    RAISE EXCEPTION '% requires separate active Snap-Down and Drop Squat review cards', migration_key;
  END IF;
  IF EXISTS (
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE id IN (survivor_id, duplicate_id)
      AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refuses to change a human-reviewed definition', migration_key;
  END IF;

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id=survivor_id
  WHERE definition_id=duplicate_id AND legacy_exercise_id=217;

  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_definition_source_v1
    WHERE definition_id=survivor_id AND legacy_exercise_id=217
  ) THEN
    RAISE EXCEPTION '% failed to preserve source 217 on the survivor', migration_key;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET aliases=(
        SELECT array_agg(DISTINCT alias ORDER BY alias)
        FROM unnest(coalesce(aliases,'{}'::TEXT[]) || ARRAY[
          'Drop Squat to Stick','Drop Squat and Stick','Bilateral Landing Position Drop'
        ]::TEXT[]) AS alias
      ),
      provenance_json=provenance_json || jsonb_build_object(
        'identityConsolidationLatest',migration_key,
        'consolidatedDefinitionIds',coalesce(provenance_json->'consolidatedDefinitionIds','[]'::JSONB) || to_jsonb(ARRAY[duplicate_id::TEXT]),
        'consolidatedLegacyExerciseIds',coalesce(provenance_json->'consolidatedLegacyExerciseIds','[]'::JSONB) || to_jsonb(ARRAY[217]),
        'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE,
        'publicationQuarantined',TRUE
      ),
      updated_at=now()
  WHERE id=survivor_id;

  UPDATE coaching.exercise_delivery_profile_v1
  SET status='archived', updated_at=now()
  WHERE variant_id IN (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=duplicate_id)
    AND status<>'archived';

  UPDATE coaching.exercise_variant_v1
  SET status='archived',
      requirements_json=requirements_json || jsonb_build_object(
        'selectable',FALSE,
        'identityConsolidatedInto','snap-down-to-stick',
        'identityConsolidation',migration_key,
        'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE
      ),
      programming_profile_json=programming_profile_json || jsonb_build_object(
        'selectionStatus','identity_consolidated',
        'selectable',FALSE,
        'publicationQuarantined',TRUE
      ),
      updated_at=now()
  WHERE definition_id=duplicate_id AND status<>'archived';

  UPDATE coaching.exercise_definition_v1
  SET status='archived',
      provenance_json=provenance_json || jsonb_build_object(
        'identityConsolidatedInto','snap-down-to-stick',
        'identityConsolidation',migration_key,
        'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE,
        'publicationQuarantined',TRUE
      ),
      updated_at=now()
  WHERE id=duplicate_id;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at
  ) VALUES (
    1,survivor_id,duplicate_id,'duplicate_consolidated',
    'The focused landing/braking packet defines both labels as a tall bilateral non-jump rapid lower to the same quiet bilateral athletic landing position and terminal stick. An overhead reach or forceful arm snap is an arm-action modifier, not a distinct primary movement. Support, unilateral stance, elevated step-off, rebound, or takeoff remain separately assessed changes.',
    jsonb_build_object(
      'identityBoundary','same_nonjump_bilateral_drop_to_terminal_stick; arm_action_modifier_only',
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
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE id=duplicate_id AND status='archived'
      AND provenance_json->>'identityConsolidatedInto'='snap-down-to-stick'
  ) OR NOT EXISTS (
    SELECT 1 FROM coaching.exercise_identity_resolution_v1
    WHERE survivor_definition_id=survivor_id AND resolved_definition_id=duplicate_id
      AND decision='duplicate_consolidated' AND reviewed_by IS NULL
  ) THEN
    RAISE EXCEPTION '% failed to persist consolidation', migration_key;
  END IF;
END;
$drop_squat_snap_down_identity_consolidation$;
