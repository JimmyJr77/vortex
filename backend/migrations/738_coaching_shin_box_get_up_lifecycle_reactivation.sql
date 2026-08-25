-- The exact source-56 candidate was materialized by migration 531, but later
-- duplicate-lineage variants left the definition archived. Retire only those
-- non-selectable historical skeletons and reactivate the explicit full-sequence
-- candidate. This creates no approval or publication state.
DO $reactivate_shin_box_get_up_candidate$
DECLARE
  migration_key CONSTANT TEXT := '738_coaching_shin_box_get_up_lifecycle_reactivation';
  definition_id_value UUID;
  card_version_value INTEGER;
BEGIN
  SELECT id INTO definition_id_value
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='shin-box-get-up';
  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION '% requires the source-56 Shin Box Get-Up definition', migration_key;
  END IF;
  IF EXISTS (
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE id=definition_id_value
      AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refuses to alter a human-reviewed card', migration_key;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_variant_v1
    WHERE definition_id=definition_id_value
      AND variant_key='bodyweight-full-sequence-shin-box-get-up'
      AND status='review'
      AND requirements_json->>'selectable'='true'
  ) THEN
    RAISE EXCEPTION '% requires the exact selectable full-sequence candidate', migration_key;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_definition_source_v1
    WHERE definition_id=definition_id_value AND legacy_exercise_id=56
  ) OR NOT EXISTS (
    SELECT 1 FROM coaching.exercise_definition_source_v1
    WHERE definition_id=definition_id_value AND legacy_exercise_id=881 AND source_kind='duplicate_consolidation'
  ) OR NOT EXISTS (
    SELECT 1 FROM coaching.exercise_definition_source_v1
    WHERE definition_id=definition_id_value AND legacy_exercise_id=1361 AND source_kind='duplicate_consolidation'
  ) THEN
    RAISE EXCEPTION '% requires preserved source-56/881/1361 lineage', migration_key;
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET status='archived',
      requirements_json=COALESCE(requirements_json,'{}'::jsonb) || jsonb_build_object(
        'selectable',FALSE,
        'representation','legacy_duplicate_source_skeleton',
        'archiveReason','Duplicate-source lineage is represented by the exact bodyweight full-sequence Shin Box Get-Up candidate; this skeleton is not independently selectable.',
        'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE,
        'publicationQuarantined',TRUE
      ),
      load_profile_json=COALESCE(load_profile_json,'{}'::jsonb) || jsonb_build_object('selectable',FALSE),
      fatigue_profile_json=COALESCE(fatigue_profile_json,'{}'::jsonb) || jsonb_build_object('selectable',FALSE),
      programming_profile_json=COALESCE(programming_profile_json,'{}'::jsonb) || jsonb_build_object(
        'selectionStatus','legacy_duplicate_source_skeleton',
        'selectable',FALSE,
        'publicationQuarantined',TRUE
      ),
      updated_at=now()
  WHERE definition_id=definition_id_value
    AND variant_key IN ('baseline-source-881','baseline-source-1361')
    AND status='review';
  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE definition_id=definition_id_value
        AND variant_key IN ('baseline-source-881','baseline-source-1361')
        AND status='archived'
        AND requirements_json->>'selectable'='false'
        AND programming_profile_json->>'selectionStatus'='legacy_duplicate_source_skeleton') <> 2 THEN
    RAISE EXCEPTION '% failed to archive all duplicate-source skeletons', migration_key;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET status='review',
      card_version=GREATEST(card_version,4),
      provenance_json=COALESCE(provenance_json,'{}'::jsonb) || jsonb_build_object(
        'lifecycleReactivationMigration',migration_key,
        'lifecycleDisposition','exact_source_56_candidate_reactivated_duplicate_source_skeletons_archived',
        'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE,
        'publicationQuarantined',TRUE,
        'externalPlaybackVerificationPerformed',FALSE
      ),
      updated_at=now()
  WHERE id=definition_id_value;
  SELECT card_version INTO card_version_value
  FROM coaching.exercise_definition_v1 WHERE id=definition_id_value AND status='review';
  IF card_version_value IS NULL THEN
    RAISE EXCEPTION '% failed to reactivate the candidate definition', migration_key;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET reviewed_card_version=card_version_value, updated_at=now()
  WHERE definition_id=definition_id_value AND review_status='candidate'
    AND reviewed_card_version<card_version_value;
  UPDATE coaching.exercise_media_candidate_v1
  SET reviewed_card_version=card_version_value, updated_at=now()
  WHERE definition_id=definition_id_value AND review_status='candidate'
    AND reviewed_card_version<card_version_value;
  UPDATE coaching.exercise_alternate_assessment_v1
  SET reviewed_card_version=card_version_value, updated_at=now()
  WHERE definition_id=definition_id_value AND review_status='candidate'
    AND reviewed_card_version<card_version_value;

  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE id=definition_id_value AND status='review'
      AND provenance_json->>'lifecycleReactivationMigration'=migration_key
      AND provenance_json->>'approvalsCreated'='false'
      AND provenance_json->>'publicationQuarantined'='true'
  ) THEN
    RAISE EXCEPTION '% failed candidate-only provenance validation', migration_key;
  END IF;
END;
$reactivate_shin_box_get_up_candidate$;
