-- Source 710's fully prone pop-up-to-sprint sequence is already the exact
-- fully-prone variant of Source 121 Ground-Start Sprint. Consolidate the
-- legacy lineage without treating this deterministic identity action as human
-- content, media, relationship, calibration, or publication approval.
DO $prone_pop_up_source_710_identity_consolidation$
DECLARE
  migration_key CONSTANT TEXT := '744_coaching_prone_pop_up_source_710_identity_consolidation';
  survivor_id UUID;
  duplicate_id UUID;
BEGIN
  SELECT id INTO survivor_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='push-up-prone-start-sprint' AND status='review';
  SELECT id INTO duplicate_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='prone-pop-up-to-sprint';
  IF survivor_id IS NULL OR duplicate_id IS NULL OR survivor_id=duplicate_id THEN
    RAISE EXCEPTION '% requires Ground-Start Sprint and Source 710 definitions', migration_key;
  END IF;
  IF EXISTS (SELECT 1 FROM coaching.exercise_definition_v1 WHERE id IN (survivor_id,duplicate_id)
    AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION '% refuses to alter human-reviewed definitions', migration_key;
  END IF;
  IF EXISTS (SELECT 1 FROM coaching.exercise_identity_resolution_v1
    WHERE survivor_definition_id=survivor_id AND resolved_definition_id=duplicate_id
      AND (reviewed_by IS NOT NULL OR resolution_source='human_review')) THEN
    RAISE EXCEPTION '% refuses to overwrite a human identity decision', migration_key;
  END IF;

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id=survivor_id,
      provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
        'identityConsolidation',migration_key,'identityConsolidatedInto','push-up-prone-start-sprint',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=710 AND definition_id=duplicate_id;
  IF NOT EXISTS (SELECT 1 FROM coaching.exercise_definition_source_v1
    WHERE legacy_exercise_id=710 AND definition_id=survivor_id) THEN
    RAISE EXCEPTION '% failed to preserve Source 710 on Ground-Start Sprint', migration_key;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET aliases=(SELECT array_agg(DISTINCT alias ORDER BY alias)
               FROM unnest(coalesce(aliases,'{}'::TEXT[])||ARRAY['Prone Pop-Up to Sprint']::TEXT[]) alias),
      provenance_json=provenance_json||jsonb_build_object(
        'identityConsolidationLatest',migration_key,
        'consolidatedDefinitionIds',coalesce(provenance_json->'consolidatedDefinitionIds','[]'::JSONB)||to_jsonb(ARRAY[duplicate_id::TEXT]),
        'consolidatedLegacyExerciseIds',coalesce(provenance_json->'consolidatedLegacyExerciseIds','[]'::JSONB)||to_jsonb(ARRAY[710]),
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
      updated_at=now()
  WHERE id=survivor_id;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id IN (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=duplicate_id)
    AND status<>'archived';
  UPDATE coaching.exercise_variant_v1
  SET status='archived',requirements_json=requirements_json||jsonb_build_object(
        'selectable',FALSE,'identityConsolidatedInto','push-up-prone-start-sprint',
        'identityConsolidation',migration_key,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      programming_profile_json=programming_profile_json||jsonb_build_object(
        'selectionStatus','identity_consolidated','selectable',FALSE,'publicationQuarantined',TRUE),updated_at=now()
  WHERE definition_id=duplicate_id;
  UPDATE coaching.exercise_definition_v1
  SET status='archived',provenance_json=provenance_json||jsonb_build_object(
        'identityConsolidatedInto','push-up-prone-start-sprint','identityConsolidation',migration_key,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=duplicate_id;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,evidence_json,resolution_source,reviewed_by,resolved_at
  ) VALUES (
    1,survivor_id,duplicate_id,'duplicate_consolidated',
    'Source 710 specifies the fully prone start-contact state already represented by Ground-Start Sprint''s Fully Prone Ground-Start Sprint variant. Both require floor push, one-foot recovery, hand clearance, short acceleration through a declared target, and a planned run-out. Push-up-bottom versus fully prone remain controlled variants; burpee, reaction, contact, and standing starts remain distinct.',
    jsonb_build_object('identityBoundary','fully_prone_ground_start_is_exact_variant_of_ground_start_sprint_not_new_definition','decisionScope','identity_only_not_human_approval','humanReviewRequired',TRUE,'approvalsCreated',FALSE,'migration',migration_key),
    'deterministic_identity_equivalence',NULL,now()
  ) ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE
    SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,
        resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review'
    AND coaching.exercise_identity_resolution_v1.reviewed_by IS NULL;
  IF NOT EXISTS (SELECT 1 FROM coaching.exercise_identity_resolution_v1
    WHERE survivor_definition_id=survivor_id AND resolved_definition_id=duplicate_id
      AND decision='duplicate_consolidated' AND resolution_source='deterministic_identity_equivalence' AND reviewed_by IS NULL) THEN
    RAISE EXCEPTION '% failed to persist deterministic duplicate resolution', migration_key;
  END IF;
END;
$prone_pop_up_source_710_identity_consolidation$;
