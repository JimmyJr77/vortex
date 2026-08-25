-- Preserve Source 40's no-impact standing ankle-rocker contract while mapping
-- score-like grip and impact fields to the canonical 1-100 scale floor.
-- Physical contact counts and cumulative planned-impact budget remain zero.
-- This machine correction creates no approval or participant skill level.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '513_coaching_knee_to_wall_normalized_score_floor_correction';
  prerequisite_migration CONSTANT TEXT :=
    '512_coaching_knee_to_wall_ankle_rocker_identity_and_family_audit_hardening.sql';
  canonical_definition UUID;
  exact_variant UUID;
BEGIN
  SELECT id INTO canonical_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=40;
  SELECT id INTO exact_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_definition
    AND variant_key='standing-knee-to-wall-forward-return-cycle';
  IF NOT EXISTS(
      SELECT 1 FROM schema_migrations
      WHERE filename=prerequisite_migration)
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND card_version=2
        AND schema_version='2.0.0' AND status='review')
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=exact_variant AND definition_id=canonical_definition
        AND status='review'
        AND (load_profile_json->>'gripDemand')::INTEGER=0
        AND (fatigue_profile_json->>'gripFatigue')::INTEGER=0
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=0
        AND load_profile_json->>'impactClass'='none'
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (load_profile_json->>'handImpactContactsPerRep')::INTEGER=0)
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION
      '% prerequisite migration or Source 40 machine-owned state is missing or drifted',
      migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL
          OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded')))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded')))
    OR EXISTS(SELECT 1 FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_definition
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded')))
    OR EXISTS(SELECT 1 FROM coaching.exercise_card_review_v1
      WHERE definition_id=canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_card_revision_v1
      WHERE definition_id=canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_review_v1
      WHERE definition_id=canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=exact_variant OR to_variant_id=exact_variant)
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status='approved'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=exact_variant
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL
          OR status='approved'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id=canonical_definition
          OR resolved_definition_id=canonical_definition)
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=40
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION
      '% refuses to alter human-reviewed or published Source 40 state',
      migration_key;
  END IF;

  UPDATE coaching.exercise_variant_v1 SET
    load_profile_json=jsonb_set(
      load_profile_json,'{gripDemand}','1'::JSONB,TRUE),
    fatigue_profile_json=jsonb_set(
      jsonb_set(fatigue_profile_json,'{gripFatigue}','1'::JSONB,TRUE),
      '{impactAccumulation}','1'::JSONB,TRUE),
    programming_profile_json=programming_profile_json||jsonb_build_object(
      'normalizedScoreFloorCorrection',migration_key,
      'scoreScaleFloor',1,
      'physicalImpactClass','none',
      'plannedImpactContacts',0,
      'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id=exact_variant AND definition_id=canonical_definition
    AND status='review';

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
  WHERE id=canonical_definition AND status='review'
    AND reviewed_by IS NULL AND approved_by IS NULL
    AND last_reviewed_at IS NULL AND approved_video_url IS NULL;

  UPDATE coaching.exercise_card_test_packet_v1 SET
    audit_version=migration_key,
    checks_json=checks_json||jsonb_build_object(
      'normalizedScoreFloorCorrection',jsonb_build_object(
        'gripDemand',1,
        'gripFatigue',1,
        'impactAccumulation',1,
        'scoreScaleFloor',1,
        'physicalImpactClass','none',
        'plannedImpactContacts',0,
        'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE)),
    status='quarantined',human_review_required=TRUE,checked_at=now()
  WHERE definition_id=canonical_definition AND card_version=2;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=exact_variant AND definition_id=canonical_definition
        AND status='review'
        AND (load_profile_json->>'gripDemand')::INTEGER=1
        AND (fatigue_profile_json->>'gripFatigue')::INTEGER=1
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND load_profile_json->>'impactClass'='none'
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (load_profile_json->>'handImpactContactsPerRep')::INTEGER=0
        AND (fatigue_profile_json#>>'{cumulativeBudget,impact}')::INTEGER=0
        AND programming_profile_json->>'normalizedScoreFloorCorrection'=
          migration_key
        AND programming_profile_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND status='review'
        AND provenance_json->>'normalizedScoreFloorCorrection'=migration_key
        AND provenance_json->>'physicalImpactClass'='none'
        AND provenance_json->>'approvalsCreated'='false'
        AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL AND approved_video_url IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND audit_version=migration_key AND status='quarantined'
        AND human_review_required
        AND checks_json#>>'{normalizedScoreFloorCorrection,scoreScaleFloor}'='1'
        AND checks_json#>>'{normalizedScoreFloorCorrection,physicalImpactClass}'='none'
        AND checks_json#>>'{normalizedScoreFloorCorrection,approvalsCreated}'='false'
        AND jsonb_array_length(blocking_issues_json)=4)
    OR coaching.exercise_json_has_level_classification(
      (SELECT programming_profile_json FROM coaching.exercise_variant_v1
       WHERE id=exact_variant)) THEN
    RAISE EXCEPTION
      '% failed normalized-score floor correction or quarantine preservation',
      migration_key;
  END IF;
END;
$$;
