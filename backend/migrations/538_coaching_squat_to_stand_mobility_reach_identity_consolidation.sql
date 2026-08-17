-- The two legacy names describe one ordered bodyweight cycle: standing hinge
-- to toe/ankle contact, squat entry, overhead reach, stand, and reset.  Reach
-- arm count/order is delivery metadata, not a second selectable definition.
-- Candidate provenance stays traceable; any human-reviewed state fails closed.

DO $squat_to_stand_mobility_reach_identity_consolidation$
DECLARE
  survivor_id UUID;
  duplicate_id UUID;
  survivor_version INTEGER;
  duplicate_legacy_id BIGINT;
  protected_count INTEGER;
BEGIN
  SELECT id, card_version INTO survivor_id, survivor_version
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1 AND slug = 'squat-to-stand-with-reach'
    AND status <> 'archived';

  SELECT id, legacy_exercise_id INTO duplicate_id, duplicate_legacy_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1 AND slug = 'squat-to-stand-mobility-reach'
    AND status <> 'archived';

  IF survivor_id IS NULL OR duplicate_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id IN (survivor_id, duplicate_id)
        AND (status = 'published' OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL
          OR approved_video_url IS NOT NULL))
    + (SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id IN (survivor_id, duplicate_id)
        AND (review_status NOT IN ('candidate', 'superseded') OR reviewer_user_id IS NOT NULL))
    + (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id IN (survivor_id, duplicate_id)
        AND (review_status NOT IN ('candidate', 'superseded') OR reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL))
    + (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id IN (survivor_id, duplicate_id)
        AND (review_status NOT IN ('candidate', 'superseded') OR reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL))
    + (SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id IN (survivor_id, duplicate_id))
    + (SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id IN (survivor_id, duplicate_id))
    + (SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id IN (survivor_id, duplicate_id))
    + (SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 variant ON variant.id = relationship.from_variant_id
      WHERE variant.definition_id IN (survivor_id, duplicate_id)
        AND (relationship.reviewed_by IS NOT NULL OR relationship.reviewed_at IS NOT NULL
          OR relationship.review_status = 'approved'))
    + (SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id = calibration.variant_id
      WHERE variant.definition_id IN (survivor_id, duplicate_id)
        AND (calibration.reviewed_by IS NOT NULL OR calibration.reviewed_at IS NOT NULL
          OR calibration.status = 'approved'))
  INTO protected_count;

  IF protected_count <> 0 THEN
    RAISE EXCEPTION
      '538_coaching_squat_to_stand_mobility_reach_identity_consolidation requires human review: % protected records',
      protected_count;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1 (
    facility_id, survivor_definition_id, resolved_definition_id, decision,
    rationale, evidence_json, resolution_source
  ) VALUES (
    1, survivor_id, duplicate_id, 'duplicate_consolidated',
    'Both sources define the ordered standing hinge/toe-or-ankle contact, comfortable squat entry, overhead reach, stand, and reset cycle. One-arm versus sequential bilateral reach changes delivery and side accounting, not the base exercise identity.',
    jsonb_build_object(
      'match', 'same_ordered_hinge_squat_reach_stand_cycle',
      'survivorSlug', 'squat-to-stand-with-reach',
      'resolvedSlug', 'squat-to-stand-mobility-reach',
      'variantDimensions', jsonb_build_array('reach_side', 'reach_order', 'range', 'support', 'tempo', 'dose'),
      'humanReviewRequired', TRUE,
      'approvalsCreated', FALSE,
      'publicationQuarantined', TRUE
    ),
    'deterministic_identity_equivalence'
  ) ON CONFLICT (survivor_definition_id, resolved_definition_id)
  DO UPDATE SET decision = EXCLUDED.decision, rationale = EXCLUDED.rationale,
    evidence_json = EXCLUDED.evidence_json, resolution_source = EXCLUDED.resolution_source,
    reviewed_by = NULL, resolved_at = now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source <> 'human_review';

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id = survivor_id,
      source_kind = 'duplicate_consolidation',
      provenance_json = provenance_json || jsonb_build_object(
        'resolvedFromDefinitionId', duplicate_id,
        'resolution', 'same_ordered_hinge_squat_reach_stand_cycle',
        'variantDimensions', jsonb_build_array('reach_side', 'reach_order', 'range', 'support', 'tempo', 'dose'),
        'migration', '538_coaching_squat_to_stand_mobility_reach_identity_consolidation',
        'humanReviewRequired', TRUE,
        'approvalsCreated', FALSE
      )
  WHERE definition_id = duplicate_id;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived', updated_at = now()
  WHERE profile.variant_id IN (
    SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id = duplicate_id
  ) AND profile.status IN ('draft', 'review');

  UPDATE coaching.exercise_variant_v1
  SET status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'selectable', FALSE,
        'representation', 'duplicate_source_variant',
        'representedByDefinitionId', survivor_id,
        'archiveReason', 'Same ordered hinge-squat-reach-stand identity; reach side/order is a delivery variant.',
        'humanReviewRequired', TRUE,
        'approvalsCreated', FALSE
      ),
      programming_profile_json = programming_profile_json || jsonb_build_object(
        'selectionStatus', 'duplicate_source_variant',
        'selectable', FALSE,
        'publicationQuarantined', TRUE
      ),
      updated_at = now()
  WHERE definition_id = duplicate_id;

  UPDATE coaching.exercise_definition_v1 survivor
  SET aliases = ARRAY(
        SELECT min(alias)
        FROM unnest(COALESCE(survivor.aliases, '{}')
          || COALESCE(duplicate.aliases, '{}')
          || ARRAY[duplicate.canonical_name, duplicate.display_name,
            'Squat-to-Stand Mobility Reach']) alias
        WHERE nullif(btrim(alias), '') IS NOT NULL
          AND lower(alias) NOT IN (lower(survivor.canonical_name), lower(survivor.display_name))
        GROUP BY lower(alias) ORDER BY lower(alias)
      ),
      provenance_json = survivor.provenance_json || jsonb_build_object(
        'identityResolution', 'duplicate_consolidation',
        'consolidatedDefinitionIds', COALESCE(survivor.provenance_json->'consolidatedDefinitionIds', '[]'::jsonb) || to_jsonb(duplicate_id::text),
        'consolidatedLegacyExerciseIds', COALESCE(survivor.provenance_json->'consolidatedLegacyExerciseIds', '[]'::jsonb) || to_jsonb(duplicate_legacy_id),
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE
      ),
      updated_at = now()
  FROM coaching.exercise_definition_v1 duplicate
  WHERE survivor.id = survivor_id AND duplicate.id = duplicate_id;

  UPDATE coaching.exercise_card_test_packet_v1
  SET status = 'quarantined', human_review_required = TRUE,
      blocking_issues_json = blocking_issues_json || jsonb_build_array(
        jsonb_build_object('code', 'CARD-IDENTITY-REVIEW-01', 'severity', 'P1',
          'message', 'Duplicate identity consolidation requires human graph review.')
      ),
      checked_at = now()
  WHERE definition_id = survivor_id;

  UPDATE coaching.exercise_definition_v1
  SET status = 'archived',
      provenance_json = provenance_json || jsonb_build_object(
        'canonicalSurvivorDefinitionId', survivor_id,
        'identityResolution', 'duplicate_consolidation',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE
      ),
      updated_at = now()
  WHERE id = duplicate_id;

  UPDATE coaching.exercise
  SET is_published = FALSE, archived = TRUE, skill_level = NULL,
      age_min = NULL, age_max = NULL, linked_skill_id = NULL,
      why_publish_ready = FALSE, updated_at = now()
  WHERE id = duplicate_legacy_id;
END;
$squat_to_stand_mobility_reach_identity_consolidation$;
