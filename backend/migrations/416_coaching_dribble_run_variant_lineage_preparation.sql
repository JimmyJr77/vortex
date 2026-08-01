-- Restore the consolidated low- and high-recovery Dribble Run sources as
-- controlled variants of one stable exercise identity. Keep the terminal
-- free-sprint transition as a distinct compound definition. No approval is
-- created and any later human decision causes this migration to fail closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '416_coaching_dribble_run_variant_lineage_preparation';
  active_slugs CONSTANT TEXT[] :=
    ARRAY['high-dribble-run','dribble-build-to-sprint'];
  scope_slugs CONSTANT TEXT[] :=
    ARRAY['low-dribble-run','high-dribble-run','dribble-build-to-sprint'];
  dribble_id UUID;
  build_id UUID;
  protected_count INTEGER;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE facility_id=1 AND slug=ANY(active_slugs)
        AND status<>'archived')<>2
    OR (SELECT status FROM coaching.exercise_definition_v1
        WHERE facility_id=1 AND slug='low-dribble-run')<>'archived' THEN
    RAISE EXCEPTION '% requires two active definitions and the archived low-dribble source',
      migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1 source
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=source.definition_id
      WHERE definition.slug=ANY(active_slugs)
        AND source.legacy_exercise_id IN(321,322,342))<>3 THEN
    RAISE EXCEPTION '% requires all three source mappings on the active survivors',
      migration_key;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.slug=ANY(scope_slugs)
        AND (definition.status='published' OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
          OR definition.approved_video_url IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(scope_slugs) AND variant.status='published')
    +(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(scope_slugs) AND profile.status='published')
    +(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 from_variant
        ON from_variant.id=relationship.from_variant_id
      JOIN coaching.exercise_variant_v1 to_variant
        ON to_variant.id=relationship.to_variant_id
      WHERE (from_variant.definition_id IN(
          SELECT id FROM coaching.exercise_definition_v1
          WHERE slug=ANY(scope_slugs))
        OR to_variant.definition_id IN(
          SELECT id FROM coaching.exercise_definition_v1
          WHERE slug=ANY(scope_slugs)))
        AND (relationship.review_status<>'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(scope_slugs)
        AND (calibration.status<>'review' OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id IN(321,322,342)
        AND (score.human_review_status<>'queued' OR score.reviewed_by IS NOT NULL
          OR score.reviewed_at IS NOT NULL))
  INTO protected_count;
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refused to overwrite % protected record(s)',
      migration_key,protected_count;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 left_definition
      ON left_definition.id=resolution.survivor_definition_id
    JOIN coaching.exercise_definition_v1 right_definition
      ON right_definition.id=resolution.resolved_definition_id
    WHERE (left_definition.slug=ANY(scope_slugs)
        OR right_definition.slug=ANY(scope_slugs))
      AND (resolution.resolution_source='human_review'
        OR resolution.reviewed_by IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refused to override a human identity decision',migration_key;
  END IF;

  SELECT id INTO dribble_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='high-dribble-run' AND status<>'archived';
  SELECT id INTO build_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='dribble-build-to-sprint' AND status<>'archived';

  UPDATE coaching.exercise_delivery_profile_v1
  SET profile_key='movement-intelligence-high-cycle',updated_at=now()
  WHERE variant_id IN(SELECT id FROM coaching.exercise_variant_v1
      WHERE definition_id=dribble_id AND variant_key='baseline')
    AND profile_key='legacy-movement_intelligence';

  UPDATE coaching.exercise_variant_v1
  SET variant_key='high-knee-recovery',updated_at=now()
  WHERE definition_id=dribble_id AND variant_key='baseline'
    AND status<>'archived';

  UPDATE coaching.exercise_delivery_profile_v1
  SET profile_key='movement-intelligence-low-cycle',status='review',updated_at=now()
  WHERE variant_id IN(SELECT id FROM coaching.exercise_variant_v1
      WHERE definition_id=dribble_id
        AND variant_key='legacy-source-321-baseline')
    AND profile_key='legacy-movement_intelligence';

  UPDATE coaching.exercise_variant_v1
  SET variant_key='low-ankle-shin-recovery',status='review',
    requirements_json=coalesce(requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'controlledVariant',TRUE,'cycleHeight','ankle_to_lower_shin',
        'sourceLineageRestored',TRUE,'selectable',TRUE,
        'humanReviewRequired',TRUE,'migration',migration_key),
    updated_at=now()
  WHERE definition_id=dribble_id
    AND variant_key='legacy-source-321-baseline';

  UPDATE coaching.exercise_definition_v1
  SET display_name='Dribble Run',canonical_name='Dribble Run',
    aliases=(SELECT ARRAY(SELECT DISTINCT alias FROM unnest(
      coalesce(aliases,'{}'::TEXT[])||ARRAY[
        'Low Dribble Run','Low Dribble Runs','Ankle Dribble','Shin Dribble',
        'High Dribble Run','High Dribble Runs','Knee Dribble']) alias
      ORDER BY alias)),
    provenance_json=provenance_json||jsonb_build_object(
      'variantLineageMigration',migration_key,
      'controlledCycleHeightVariants',jsonb_build_array(
        'low-ankle-shin-recovery','high-knee-recovery'),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=dribble_id;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES(1,dribble_id,build_id,'distinct_exercises',
    'Dribble Run ends within the declared cyclic drill lane. Dribble Build to Sprint adds a progressive transition into free sprinting, near-maximal speed exposure, a separate sprint segment, full recovery, and controlled deceleration.',
    jsonb_build_object(
      'identityBoundary','fixed_dribble_cycle_vs_terminal_free_sprint_transition',
      'researchBatch','dribble-run-progression-v1',
      'researchVersion','2026-07-25.8',
      'decisionScope','identity_only_not_human_approval',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'migration',migration_key),
    'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id)
  DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE definition_id=dribble_id AND status<>'archived')<>2
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE definition_id=build_id AND status<>'archived')<>1
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE definition_id=dribble_id AND status<>'archived'
        AND variant_key NOT IN(
          'low-ankle-shin-recovery','high-knee-recovery')) THEN
    RAISE EXCEPTION '% expected two controlled Dribble Run variants and one build-to-sprint baseline',
      migration_key;
  END IF;
END
$$;
