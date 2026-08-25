-- Correct migration 485's machine-audit contract without changing exercise
-- identity, authored difficulty, human-review state, or publication state.
-- The canonical audit requires an explicit landingContactsPerRep load key on
-- every selectable variant and an HTTPS primary identity source on canonical
-- definitions that do not originate from a legacy exercise row.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '486_coaching_lache_family_canonical_audit_contract_correction';
  prerequisite_migration CONSTANT TEXT := '485_coaching_lache_transfer_tap_swing_precision_family_audit_hardening.sql';
  prerequisite_key CONSTANT TEXT := '485_coaching_lache_transfer_tap_swing_precision_family_audit_hardening';
  lache_definition UUID;
  tap_definition UUID;
  precision_definition UUID;
  definition_ids UUID[];
  same_height_variant UUID;
  higher_target_variant UUID;
  lower_target_variant UUID;
  assisted_variant UUID;
  tap_variant UUID;
  precision_variant UUID;
  active_variant_ids UUID[];
  primary_identity_source CONSTANT TEXT :=
    'https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf';
  corrected_count INTEGER;
BEGIN
  SELECT definition_id INTO lache_definition FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=19;
  SELECT id INTO tap_definition FROM coaching.exercise_definition_v1
  WHERE slug='bar-hollow-arch-tap-swing';
  SELECT id INTO precision_definition FROM coaching.exercise_definition_v1
  WHERE slug='lache-precision-two-foot-stick';
  SELECT id INTO same_height_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=lache_definition AND variant_key='same-height-independent-retained-catch';
  SELECT id INTO higher_target_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=lache_definition AND variant_key='higher-target-independent-retained-catch';
  SELECT id INTO lower_target_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=lache_definition AND variant_key='lower-target-independent-retained-catch';
  SELECT id INTO assisted_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=lache_definition AND variant_key='same-height-coach-secured-catch';
  SELECT id INTO tap_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=tap_definition AND variant_key='bilateral-overgrip-full-cycle';
  SELECT id INTO precision_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=precision_definition AND variant_key='low-target-bilateral-two-second-stick';
  definition_ids := ARRAY[lache_definition,tap_definition,precision_definition];
  active_variant_ids := ARRAY[same_height_variant,higher_target_variant,
    lower_target_variant,assisted_variant,tap_variant,precision_variant];

  IF NOT EXISTS(
      SELECT 1 FROM schema_migrations
      WHERE filename=prerequisite_migration)
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
        WHERE id=ANY(definition_ids) AND status='review'
          AND schema_version='2.0.0')<>3
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id=ANY(active_variant_ids) AND status='review'
          AND requirements_json->>'selectable'='true')<>6 THEN
    RAISE EXCEPTION '% prerequisite migration or Lache family state is missing or drifted',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL
          OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=ANY(definition_ids)
        AND ((definition_id=lache_definition AND reviewed_card_version=2)
          OR (definition_id IN(tap_definition,precision_definition)
            AND reviewed_card_version=1))
        AND (review_status<>'candidate' OR reviewer_user_id IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(definition_ids)
        AND ((definition_id=lache_definition AND reviewed_card_version=2)
          OR (definition_id IN(tap_definition,precision_definition)
            AND reviewed_card_version=1))
        AND (review_status<>'candidate' OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE conditions_json->>'migration'=prerequisite_key
        AND (review_status='approved' OR reviewed_by IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids)
        AND (status='approved' OR reviewed_by IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=19
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION '% refuses to overwrite human-reviewed or published state',migration_key;
  END IF;

  UPDATE coaching.exercise_variant_v1 variant SET
    load_profile_json=variant.load_profile_json||jsonb_build_object(
      'landingContactsPerRep',correction.landing_contacts,
      'canonicalAuditLoadContractCorrection',migration_key),
    updated_at=now()
  FROM (VALUES
    (same_height_variant,0),
    (higher_target_variant,0),
    (lower_target_variant,0),
    (assisted_variant,0),
    (tap_variant,0),
    (precision_variant,2)
  ) correction(id,landing_contacts)
  WHERE variant.id=correction.id AND variant.status='review';
  GET DIAGNOSTICS corrected_count = ROW_COUNT;
  IF corrected_count<>6 THEN
    RAISE EXCEPTION '% corrected % variants instead of 6',migration_key,corrected_count;
  END IF;

  UPDATE coaching.exercise_definition_v1 SET
    provenance_json=provenance_json||jsonb_build_object(
      'primaryIdentitySource',primary_identity_source,
      'canonicalAuditProvenanceContractCorrection',migration_key),
    updated_at=now()
  WHERE id IN(tap_definition,precision_definition) AND status='review'
    AND reviewed_by IS NULL AND approved_by IS NULL
    AND last_reviewed_at IS NULL AND approved_video_url IS NULL;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND status='review'
        AND load_profile_json ?& ARRAY[
          'gripDemand','spinalLoading','eccentricStress',
          'landingContactsPerRep','externalLoadMethod']
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=
          CASE WHEN id=precision_variant THEN 2 ELSE 0 END
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'physicalDifficulty')::INTEGER))<>6
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id IN(tap_definition,precision_definition) AND status='review'
        AND legacy_exercise_id IS NULL
        AND provenance_json->>'canonicalAuthoredFromResearch'='true'
        AND provenance_json->>'primaryIdentitySource'=primary_identity_source
        AND provenance_json->>'approvalsCreated'='false'
        AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL AND approved_video_url IS NULL)<>2
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=lache_definition AND legacy_exercise_id=19 AND status='review'
        AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL AND approved_video_url IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=19 AND technical_complexity=82
        AND absolute_load_demand=78 AND base_overall_difficulty=82
        AND human_review_status='queued' AND reviewed_by IS NULL
        AND reviewed_at IS NULL) THEN
    RAISE EXCEPTION '% did not restore canonical audit contracts or preserve quarantine',migration_key;
  END IF;
END;
$$;
