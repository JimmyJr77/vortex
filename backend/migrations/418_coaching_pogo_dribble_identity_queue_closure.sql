-- Close the two similarity pairs exposed by the ankling and dribble lineage
-- corrections. Fast Low Pogos is a high-cadence delivery label for the same
-- stationary bilateral Ankle Pogo identity; cadence and contact cap do not
-- create another exercise. Traveling no-flight Ankling Drill remains distinct
-- from the cyclic Dribble Run because its ordered foot path and recovery
-- action differ. No review, approval, or publication state is created.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '418_coaching_pogo_dribble_identity_queue_closure';
  scope_slugs CONSTANT TEXT[] := ARRAY[
    'ankle-pogo-in-place','fast-low-pogos','ankling-drill','high-dribble-run'
  ];
  ankle_id UUID;
  fast_pogo_id UUID;
  ankling_id UUID;
  dribble_id UUID;
  protected_count INTEGER;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE facility_id=1 AND slug=ANY(scope_slugs))<>cardinality(scope_slugs) THEN
    RAISE EXCEPTION '% requires all four traceable definitions',migration_key;
  END IF;

  SELECT id INTO ankle_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='ankle-pogo-in-place';
  SELECT id INTO fast_pogo_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='fast-low-pogos';
  SELECT id INTO ankling_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='ankling-drill';
  SELECT id INTO dribble_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='high-dribble-run';

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
    +(SELECT count(*) FROM coaching.exercise_card_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=review.definition_id
      WHERE definition.slug=ANY(scope_slugs))
    +(SELECT count(*) FROM coaching.exercise_card_revision_v1 revision
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=revision.definition_id
      WHERE definition.slug=ANY(scope_slugs))
    +(SELECT count(*) FROM coaching.exercise_media_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=review.definition_id
      WHERE definition.slug=ANY(scope_slugs))
    +(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 from_variant
        ON from_variant.id=relationship.from_variant_id
      JOIN coaching.exercise_variant_v1 to_variant
        ON to_variant.id=relationship.to_variant_id
      WHERE (from_variant.definition_id=fast_pogo_id
          OR to_variant.definition_id=fast_pogo_id)
        AND (relationship.review_status<>'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      WHERE variant.definition_id=fast_pogo_id
        AND (calibration.status<>'review' OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id=135
        AND (score.human_review_status<>'queued' OR score.reviewed_by IS NOT NULL
          OR score.reviewed_at IS NOT NULL))
  INTO protected_count;
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refused to overwrite % protected record(s)',
      migration_key,protected_count;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE ((resolution.survivor_definition_id=ankle_id
          AND resolution.resolved_definition_id=fast_pogo_id)
        OR (resolution.survivor_definition_id=fast_pogo_id
          AND resolution.resolved_definition_id=ankle_id)
        OR (resolution.survivor_definition_id=ankling_id
          AND resolution.resolved_definition_id=dribble_id)
        OR (resolution.survivor_definition_id=dribble_id
          AND resolution.resolved_definition_id=ankling_id))
      AND (resolution.resolution_source='human_review'
        OR resolution.reviewed_by IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refused to override a human identity decision',migration_key;
  END IF;

  -- Preserve source 135 and its historic profile, but remove the second active
  -- baseline. The active Ankle Pogo Output profile carries the fast-low cadence
  -- context without manufacturing another card or exercise-level proficiency.
  UPDATE coaching.exercise_definition_source_v1 source
  SET definition_id=ankle_id,source_kind='duplicate_consolidation',
    provenance_json=source.provenance_json||jsonb_build_object(
      'consolidatedFromDefinitionId',fast_pogo_id,
      'identity','stationary_bilateral_ankle_pogo',
      'contextModifiers',jsonb_build_array(
        'cadence','contact_cap','amplitude','duration','rest','phase_intent'),
      'migration',migration_key,'humanReviewRequired',TRUE)
  WHERE source.legacy_exercise_id=135 AND source.definition_id<>ankle_id;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  WHERE profile.variant_id IN(
    SELECT id FROM coaching.exercise_variant_v1
    WHERE definition_id=fast_pogo_id AND status<>'archived');

  UPDATE coaching.exercise_variant_v1 variant
  SET status='archived',
    requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'sourceIdentityDuplicate',TRUE,'selectable',FALSE,
        'identityQuarantine',TRUE,
        'survivorSlug','ankle-pogo-in-place',
        'contextOnly','fast_low_cadence',
        'migration',migration_key),updated_at=now()
  WHERE variant.definition_id=fast_pogo_id AND status<>'archived';

  UPDATE coaching.exercise_definition_v1 definition
  SET status='archived',
    provenance_json=definition.provenance_json||jsonb_build_object(
      'identityResolution','duplicate_consolidated',
      'survivorDefinitionId',ankle_id,
      'survivorSlug','ankle-pogo-in-place',
      'migration',migration_key,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),updated_at=now()
  WHERE definition.id=fast_pogo_id AND status<>'archived';

  UPDATE coaching.exercise_definition_v1 definition
  SET aliases=ARRAY(
      SELECT min(alias) FROM unnest(coalesce(definition.aliases,'{}')
        ||ARRAY['Fast Low Pogo','Fast Low Pogos']) alias
      WHERE nullif(btrim(alias),'') IS NOT NULL
        AND lower(btrim(alias)) NOT IN(
          lower(definition.canonical_name),lower(definition.display_name))
      GROUP BY lower(btrim(alias)) ORDER BY lower(btrim(alias))),
    coach_support_json=coalesce(definition.coach_support_json,'{}'::JSONB)
      ||jsonb_build_object(
        'fastLowPogoIdentity','Use the active Ankle Pogo baseline. Fast and low are cadence and amplitude constraints; prescribe them in the Output dosage, not as another exercise.'),
    athlete_support_json=coalesce(definition.athlete_support_json,'{}'::JSONB)
      ||jsonb_build_object(
        'fastLowPogoCue','Keep the same small vertical bilateral bounce and use only the fastest cadence that stays quiet, symmetric, and springy.'),
    support_operations_json=coalesce(definition.support_operations_json,'{}'::JSONB)
      ||jsonb_build_object(
        'historicFastLowPogoSource',jsonb_build_object(
          'legacyExerciseId',135,'context','output_fast_low_cadence',
          'identityUnchanged',TRUE)),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'fastLowPogoSourceConsolidated',TRUE,
      'identityMigration',migration_key,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE definition.id=ankle_id;

  UPDATE coaching.exercise_variant_v1 variant
  SET requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'recognizedContextModifiers',jsonb_build_array(
          'cadence','contact_cap','amplitude','duration','rest','phase_intent'),
        'historicFastLowPogoSource',135,
        'difficultyModel','max_exercise_complexity_physical_difficulty'),
    updated_at=now()
  WHERE variant.definition_id=ankle_id AND variant.status<>'archived'
    AND variant.variant_key='baseline';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET dosage_json=coalesce(profile.dosage_json,'{}'::JSONB)
      ||jsonb_build_object(
        'fastLowCadenceContext','Use the highest repeatable cadence only while contacts remain low, vertical, quiet, symmetric, and springy.',
        'historicSourceSlug','fast-low-pogos'),
    support_prompts_json=coalesce(profile.support_prompts_json,'{}'::JSONB)
      ||jsonb_build_object(
        'fastLowContext','Fast Low Pogos selects this Output delivery; stop on contact noise, asymmetry, height drift, cadence loss, or symptoms.'),
    updated_at=now()
  WHERE profile.variant_id IN(
      SELECT id FROM coaching.exercise_variant_v1
      WHERE definition_id=ankle_id AND variant_key='baseline'
        AND status<>'archived')
    AND profile.profile_key='legacy-output' AND profile.status<>'archived';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES(1,ankle_id,fast_pogo_id,'duplicate_consolidated',
    'Both labels declare a stationary bilateral low-amplitude repeated ankle-pogo. Fast cadence, low amplitude, contact cap, duration, rest, and phase intent are dosage or delivery modifiers, not stable exercise-identity boundaries.',
    jsonb_build_object(
      'identityBoundary','same_stationary_bilateral_ankle_pogo',
      'historicSourceSlug','fast-low-pogos',
      'variantDimensions',jsonb_build_array(
        'cadence','contact_cap','amplitude','duration','rest','phase_intent'),
      'decisionScope','identity_and_traceability_only_not_human_approval',
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

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES(1,ankling_id,dribble_id,'distinct_exercises',
    'Ankling Drill uses traveling alternating no-flight short steps with small ankle-dominant contacts. Dribble Run uses a cyclic recovery path with an explicit ankle-to-shin or knee-height recovery landmark before the foot steps down. Cadence does not remove that ordered movement-contract difference.',
    jsonb_build_object(
      'identityBoundary','no_flight_short_ankling_step_vs_cyclic_dribble_recovery',
      'anklingContract',jsonb_build_array(
        'traveling','alternating_short_steps','no_flight','ankle_dominant'),
      'dribbleContract',jsonb_build_array(
        'traveling','alternating_cycle','explicit_recovery_height','step_down'),
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

  IF (SELECT definition_id FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=135)<>ankle_id
    OR (SELECT status FROM coaching.exercise_definition_v1
      WHERE id=fast_pogo_id)<>'archived'
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE definition_id=fast_pogo_id AND status<>'archived')
    OR EXISTS(SELECT 1 FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      WHERE variant.definition_id=fast_pogo_id AND profile.status<>'archived') THEN
    RAISE EXCEPTION '% failed to consolidate the Fast Low Pogos source',migration_key;
  END IF;

  IF NOT EXISTS(
      SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=ankle_id
        AND resolved_definition_id=fast_pogo_id
        AND decision='duplicate_consolidated')
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=ankling_id
        AND resolved_definition_id=dribble_id
        AND decision='distinct_exercises') THEN
    RAISE EXCEPTION '% failed to persist both identity dispositions',migration_key;
  END IF;
END
$$;
