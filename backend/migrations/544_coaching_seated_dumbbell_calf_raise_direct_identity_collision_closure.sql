-- Source 432 is already represented by the Bent-Knee Soleus Raise canonical
-- definition (migration 460). This closes the residual active legacy shell so
-- it cannot surface as an exact-name duplicate. It creates no approvals.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '544_coaching_seated_dumbbell_calf_raise_direct_identity_collision_closure';
  canonical_definition UUID;
  duplicate_definition UUID;
  duplicate_variant_count INTEGER;
BEGIN
  SELECT definition_id INTO canonical_definition
  FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=578;

  SELECT id INTO duplicate_definition
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=432;

  IF canonical_definition IS NULL OR duplicate_definition IS NULL THEN
    RAISE EXCEPTION '% requires canonical Source 578 and residual Source 432 definitions', migration_key;
  END IF;

  IF canonical_definition=duplicate_definition
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=432 AND definition_id=canonical_definition
        AND source_kind='duplicate_consolidation'
    ) THEN
    RAISE EXCEPTION '% requires Source 432 to be represented by the canonical Bent-Knee Soleus Raise', migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE id IN(canonical_definition,duplicate_definition)
      AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refuses to overwrite human-reviewed Source 432 content', migration_key;
  END IF;

  SELECT count(*) INTO duplicate_variant_count
  FROM coaching.exercise_variant_v1
  WHERE definition_id=duplicate_definition AND status<>'archived';

  UPDATE coaching.exercise_variant_v1
  SET status='archived',
      variant_key=CASE WHEN variant_key='baseline'
        THEN 'identity-quarantine-source-432-residual-shell'
        ELSE variant_key END,
      requirements_json=coalesce(requirements_json,'{}'::JSONB)||jsonb_build_object(
        'selectable',FALSE,'representation','identity_quarantine',
        'sourceLegacyExerciseId',432,'archiveReason','direct_identity_collision_consolidated_under_bent_knee_soleus_raise',
        'humanReviewRequired',TRUE),
      programming_profile_json=coalesce(programming_profile_json,'{}'::JSONB)||jsonb_build_object(
        'selectionStatus','identity_quarantine','publicationQuarantined',TRUE,
        'neverRestoreFromLabelOrMediaMetadata',TRUE),
      updated_at=now()
  WHERE definition_id=duplicate_definition AND status<>'archived';

  UPDATE coaching.exercise_definition_v1
  SET status='archived',legacy_exercise_id=NULL,
      provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
        'migration',migration_key,'sourceDisposition','duplicate_consolidated',
        'resolvedCanonicalDefinitionId',canonical_definition,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
      approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,updated_at=now()
  WHERE id=duplicate_definition;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES(
    1,canonical_definition,duplicate_definition,'duplicate_consolidated',
    'Source 432 Seated Dumbbell Calf Raise is an explicitly represented working specification of the canonical seated knee-flexed plantarflexion identity; retaining a separate active definition creates an exact alias collision.',
    jsonb_build_object('migration',migration_key,'legacySource',432,
      'canonicalLegacySource',578,'existingSourceMappingVerified',TRUE,
      'archivedResidualVariants',duplicate_variant_count,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT (survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=EXCLUDED.resolved_at;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=duplicate_definition AND status<>'archived')
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE definition_id=duplicate_definition AND status<>'archived') THEN
    RAISE EXCEPTION '% failed to archive residual Source 432 shell', migration_key;
  END IF;
END $$;
