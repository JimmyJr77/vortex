-- Preserve the no-impact Crocodile Breathing contract while mapping score-like
-- impact and fatigue fields to the canonical 1-100 scale floor. Physical
-- contacts remain zero and impactClass remains none. No approval is created.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '492_coaching_crocodile_breathing_normalized_score_floor_correction';
  canonical_definition UUID;
  variant_ids UUID[];
BEGIN
  SELECT definition_id INTO canonical_definition FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=22;
  SELECT array_agg(id ORDER BY variant_key) INTO variant_ids
  FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_definition AND variant_key IN(
    'flat-prone-stacked-hands','lower-leg-bolster-support',
    'light-elastic-band-lateral-feedback');

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND card_version=2 AND status='review')
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id=ANY(variant_ids) AND definition_id=canonical_definition
          AND status='review')<>3 THEN
    RAISE EXCEPTION '% prerequisite Crocodile card drifted',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(variant_ids) OR to_variant_id=ANY(variant_ids))
        AND (review_status='approved' OR reviewed_by IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(variant_ids)
        AND (status='approved' OR reviewed_by IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition
        AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL OR status<>'review')) THEN
    RAISE EXCEPTION '% refuses to alter human-reviewed Crocodile state',migration_key;
  END IF;

  UPDATE coaching.exercise_variant_v1 SET
    difficulty_json=jsonb_set(difficulty_json,'{impact}','1'::JSONB,TRUE),
    fatigue_profile_json=jsonb_set(
      fatigue_profile_json,'{impactAccumulation}','1'::JSONB,TRUE),
    updated_at=now()
  WHERE id=ANY(variant_ids);

  UPDATE coaching.exercise_definition_v1 SET
    provenance_json=provenance_json||jsonb_build_object(
      'normalizedScoreFloorCorrection',migration_key,
      'scoreScaleFloor',1,
      'physicalImpactClass','none',
      'landingContactsPerRep',0,
      'handImpactContactsPerRep',0,
      'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id=canonical_definition;

  UPDATE coaching.exercise_card_test_packet_v1 SET
    audit_version=migration_key,
    checks_json=jsonb_set(checks_json,'{loadFatigueRecovery,scoreScaleFloor}',
      '1'::JSONB,TRUE),
    status='quarantined',human_review_required=TRUE,checked_at=now()
  WHERE definition_id=canonical_definition;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(variant_ids)
        AND (difficulty_json->>'impact')::INTEGER=1
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND load_profile_json->>'impactClass'='none'
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (load_profile_json->>'handImpactContactsPerRep')::INTEGER=0)<>3
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition
        AND provenance_json->>'normalizedScoreFloorCorrection'=migration_key
        AND provenance_json->>'physicalImpactClass'='none'
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND audit_version=migration_key
        AND status='quarantined' AND human_review_required
        AND checks_json#>>'{loadFatigueRecovery,scoreScaleFloor}'='1'
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% failed normalized-score floor correction',migration_key;
  END IF;
END;
$$;
