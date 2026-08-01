-- Consolidate the static short-acceleration start cluster under one stable
-- canonical card. Start geometry and a simple go-signal are exact variants;
-- target distance, unit, cones, lead side, rest, and intent are delivery data.
-- Moving-entry and longer build-up variants remain nonselectable until their
-- exact ordered contracts are authored. All legacy sources remain traceable.
-- No media, graph, calibration, card, or publication approval is created.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '419_coaching_short_acceleration_identity_variant_consolidation';
  survivor_slug CONSTANT TEXT := '10-yard-sprint';
  source_slugs CONSTANT TEXT[] := ARRAY[
    '2-point-acceleration-start','2-point-start-10-20m',
    'split-stance-10-yard-acceleration','3-point-start-10-20m',
    'three-point-start-acceleration','falling-start-10m',
    'half-kneeling-start-sprint','auditory-start-sprint',
    'two-point-start-walk-in'
  ];
  scope_slugs CONSTANT TEXT[] := ARRAY[
    '10-yard-sprint','2-point-acceleration-start','2-point-start-10-20m',
    'split-stance-10-yard-acceleration','3-point-start-10-20m',
    'three-point-start-acceleration','falling-start-10m',
    'half-kneeling-start-sprint','auditory-start-sprint',
    'two-point-start-walk-in'
  ];
  survivor_id UUID;
  two_point_id UUID;
  three_point_id UUID;
  falling_id UUID;
  half_kneeling_id UUID;
  auditory_id UUID;
  walk_in_id UUID;
  three_point_build_id UUID;
  protected_count INTEGER;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE facility_id=1 AND slug=ANY(scope_slugs))<>cardinality(scope_slugs) THEN
    RAISE EXCEPTION '% requires all % traceable definitions',
      migration_key,cardinality(scope_slugs);
  END IF;

  SELECT id INTO survivor_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug=survivor_slug;
  SELECT variant.id INTO two_point_id
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=variant.definition_id
  WHERE (definition.slug='2-point-acceleration-start'
      AND variant.variant_key='baseline')
    OR (definition.id=survivor_id AND variant.variant_key='two-point-static');
  SELECT variant.id INTO three_point_id
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=variant.definition_id
  WHERE (definition.slug='3-point-start-10-20m'
      AND variant.variant_key='baseline')
    OR (definition.id=survivor_id AND variant.variant_key='three-point-static');
  SELECT variant.id INTO falling_id
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=variant.definition_id
  WHERE (definition.slug='falling-start-10m'
      AND variant.variant_key='baseline')
    OR (definition.id=survivor_id AND variant.variant_key='falling-start');
  SELECT variant.id INTO half_kneeling_id
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=variant.definition_id
  WHERE (definition.slug='half-kneeling-start-sprint'
      AND variant.variant_key='baseline')
    OR (definition.id=survivor_id AND variant.variant_key='half-kneeling-start');
  SELECT variant.id INTO auditory_id
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=variant.definition_id
  WHERE (definition.slug='auditory-start-sprint'
      AND variant.variant_key='baseline')
    OR (definition.id=survivor_id
      AND variant.variant_key='two-point-auditory-start');
  SELECT variant.id INTO walk_in_id
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=variant.definition_id
  WHERE (definition.slug='two-point-start-walk-in'
      AND variant.variant_key='baseline')
    OR (definition.id=survivor_id
      AND variant.variant_key='two-point-walk-in-provisional');
  SELECT variant.id INTO three_point_build_id
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=variant.definition_id
  WHERE (definition.slug='three-point-start-acceleration'
      AND variant.variant_key='legacy-source-1122-baseline')
    OR (definition.id=survivor_id
      AND variant.variant_key='three-point-build-up-provisional');

  IF survivor_id IS NULL OR two_point_id IS NULL OR three_point_id IS NULL
    OR falling_id IS NULL OR half_kneeling_id IS NULL OR auditory_id IS NULL
    OR walk_in_id IS NULL OR three_point_build_id IS NULL THEN
    RAISE EXCEPTION '% requires all eight exact source variants',migration_key;
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
      WHERE score.exercise_id IN(
          SELECT source.legacy_exercise_id
          FROM coaching.exercise_definition_source_v1 source
          JOIN coaching.exercise_definition_v1 definition
            ON definition.id=source.definition_id
          WHERE definition.slug=ANY(scope_slugs))
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

  -- Preserve the stable survivor baseline and remove the legacy conditioning
  -- interpretation. Maximal or near-maximal short acceleration belongs in
  -- Output; capacity sprinting requires a separate submaximal delivery.
  UPDATE coaching.exercise_variant_v1
  SET variant_key='standing-static',display_name='Standing Short Acceleration',
    requirements_json=coalesce(requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'startGeometry','standing_static_or_self_selected',
        'selectable',TRUE,'humanReviewRequired',TRUE,
        'migration',migration_key),updated_at=now()
  WHERE definition_id=survivor_id AND variant_key='baseline';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  WHERE profile.variant_id IN(
      SELECT id FROM coaching.exercise_variant_v1
      WHERE definition_id=survivor_id AND variant_key='standing-static')
    AND profile.profile_key='legacy-capacity';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET profile_key='output-standing-static',status='review',updated_at=now()
  WHERE profile.variant_id IN(
      SELECT id FROM coaching.exercise_variant_v1
      WHERE definition_id=survivor_id AND variant_key='standing-static')
    AND profile.profile_key='legacy-output';

  -- Move one traceable source baseline for each exact start contract.
  UPDATE coaching.exercise_variant_v1 SET definition_id=survivor_id,
    variant_key='two-point-static',display_name='Two-Point Static Start',
    status='review',updated_at=now() WHERE id=two_point_id;
  UPDATE coaching.exercise_variant_v1 SET definition_id=survivor_id,
    variant_key='three-point-static',display_name='Three-Point Static Start',
    status='review',updated_at=now() WHERE id=three_point_id;
  UPDATE coaching.exercise_variant_v1 SET definition_id=survivor_id,
    variant_key='falling-start',display_name='Falling Start',
    status='review',updated_at=now() WHERE id=falling_id;
  UPDATE coaching.exercise_variant_v1 SET definition_id=survivor_id,
    variant_key='half-kneeling-start',display_name='Half-Kneeling Start',
    status='review',updated_at=now() WHERE id=half_kneeling_id;
  UPDATE coaching.exercise_variant_v1 SET definition_id=survivor_id,
    variant_key='two-point-auditory-start',
    display_name='Two-Point Auditory Start',status='review',updated_at=now()
  WHERE id=auditory_id;
  UPDATE coaching.exercise_variant_v1 SET definition_id=survivor_id,
    variant_key='two-point-walk-in-provisional',
    display_name='Two-Point Walk-In (Identity Review)',status='review',
    requirements_json=coalesce(requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'selectable',FALSE,'identityQuarantine',TRUE,
        'identityBlocker','exact walking entry, settle step, acceleration trigger, distance, finish, and run-out require human authorship',
        'migration',migration_key),updated_at=now()
  WHERE id=walk_in_id;
  UPDATE coaching.exercise_variant_v1 SET definition_id=survivor_id,
    variant_key='three-point-build-up-provisional',
    display_name='Three-Point Build-Up (Identity Review)',status='review',
    requirements_json=coalesce(requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'selectable',FALSE,'identityQuarantine',TRUE,
        'identityBlocker','exact three-point setup, progressive rise, distance, speed intent, terminal action, and runway relationship require human authorship',
        'migration',migration_key),updated_at=now()
  WHERE id=three_point_build_id;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET profile_key=CASE profile.variant_id
      WHEN two_point_id THEN 'output-two-point-static'
      WHEN three_point_id THEN 'output-three-point-static'
      WHEN falling_id THEN 'output-falling-start'
      WHEN half_kneeling_id THEN 'output-half-kneeling-start'
      WHEN auditory_id THEN 'output-two-point-auditory-start'
      WHEN walk_in_id THEN 'output-two-point-walk-in-provisional'
      WHEN three_point_build_id THEN 'output-three-point-build-up-provisional'
    END,
    role=CASE WHEN profile.variant_id IN(walk_in_id,three_point_build_id)
      THEN 'avoid' ELSE 'primary' END,
    phase_suitability=CASE
      WHEN profile.variant_id IN(walk_in_id,three_point_build_id) THEN 1
      ELSE 50 END,
    status='review',updated_at=now()
  WHERE profile.variant_id IN(
    two_point_id,three_point_id,falling_id,half_kneeling_id,auditory_id,
    walk_in_id,three_point_build_id);

  -- Preserve every other historic variant/profile as archived lineage on the
  -- survivor. The UUID suffix prevents key collisions without changing IDs.
  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  WHERE profile.variant_id IN(
    SELECT variant.id FROM coaching.exercise_variant_v1 variant
    JOIN coaching.exercise_definition_v1 definition
      ON definition.id=variant.definition_id
    WHERE definition.slug=ANY(source_slugs));

  UPDATE coaching.exercise_variant_v1 variant
  SET definition_id=survivor_id,
    variant_key=left('archived-source-'
      ||regexp_replace(definition.slug,'[^a-z0-9]+','-','g')||'-'
      ||substr(md5(variant.id::TEXT),1,8),120),
    status='archived',
    requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'sourceIdentityDuplicate',TRUE,'selectable',FALSE,
        'survivorSlug',survivor_slug,'migration',migration_key),
    updated_at=now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=variant.definition_id
    AND definition.slug=ANY(source_slugs);

  UPDATE coaching.exercise_definition_source_v1 source
  SET definition_id=survivor_id,source_kind='duplicate_consolidation',
    provenance_json=source.provenance_json||jsonb_build_object(
      'shortAccelerationConsolidation',TRUE,
      'survivorSlug',survivor_slug,
      'variantDimensions',jsonb_build_array(
        'start_geometry','cue_mode','lead_side'),
      'deliveryDimensions',jsonb_build_array(
        'distance','unit','cones','intent','rest','run_out'),
      'migration',migration_key,'humanReviewRequired',TRUE)
  WHERE source.definition_id IN(
    SELECT id FROM coaching.exercise_definition_v1
    WHERE slug=ANY(source_slugs));

  UPDATE coaching.exercise_definition_v1 definition
  SET status='archived',
    provenance_json=definition.provenance_json||jsonb_build_object(
      'identityResolution','duplicate_consolidated',
      'survivorDefinitionId',survivor_id,
      'survivorSlug',survivor_slug,
      'migration',migration_key,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),updated_at=now()
  WHERE definition.slug=ANY(source_slugs) AND status<>'archived';

  DELETE FROM coaching.exercise_identity_resolution_v1 resolution
  WHERE resolution.survivor_definition_id IN(
      SELECT id FROM coaching.exercise_definition_v1
      WHERE slug=ANY(source_slugs))
    AND resolution.resolved_definition_id=survivor_id
    AND resolution.resolution_source<>'human_review'
    AND resolution.reviewed_by IS NULL;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,survivor_id,definition.id,'duplicate_consolidated',
    'All sources retain the same short linear acceleration and planned run-out. Static start geometry, lead side, and a simple go-signal are exact variants; target distance, measurement unit, cones, intent, and rest are delivery dimensions. Moving-entry and build-up sources remain nonselectable variants until their ordered contracts are resolved.',
    jsonb_build_object(
      'identityBoundary','short_linear_acceleration_with_controlled_start_variant',
      'sourceSlug',definition.slug,
      'researchArtifacts',jsonb_build_array(
        'acceleration-starts.v1.json','ten-yard-sprint-collision-cluster.v1.json',
        'two-point-start-collision-cluster.v1.json',
        'three-point-start-collision-cluster.v1.json',
        'falling-start-collision-cluster.v1.json',
        'reactive-cue-sprint-starts.v1.json'),
      'decisionScope','identity_and_traceability_only_not_human_approval',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'migration',migration_key),
    'deterministic_identity_equivalence',NULL,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.slug=ANY(source_slugs)
  ON CONFLICT(survivor_definition_id,resolved_definition_id)
  DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  UPDATE coaching.exercise_definition_v1 definition
  SET canonical_name='Short Acceleration Sprint',
    display_name='Short Acceleration Sprint',
    aliases=ARRAY(
      SELECT min(alias) FROM unnest(coalesce(definition.aliases,'{}'::TEXT[])
        ||ARRAY['10-Yard Sprint','10-Yard Sprint Start',
          '2-Point Acceleration Start','2-Point Start 10-20m',
          'Two-Point Start to 5-10 Yard Sprint',
          'Split-Stance 10-Yard Acceleration','3-Point Start 10-20m',
          'Three-Point Start Acceleration','Falling Start 10m',
          'Falling Start Sprint','Half-Kneeling Start Sprint',
          'Half-Kneeling Sprint Start','Auditory Start Sprint',
          'Split-Stance Auditory Sprint Start','Two-Point Start Walk-In']) alias
      WHERE nullif(btrim(alias),'') IS NOT NULL
        AND lower(btrim(alias)) NOT IN(
          'short acceleration sprint')
      GROUP BY lower(btrim(alias)) ORDER BY lower(btrim(alias))),
    family_key='short_linear_acceleration',
    provenance_json=definition.provenance_json||jsonb_build_object(
      'identityMigration',migration_key,
      'controlledStartVariants',jsonb_build_array(
        'standing-static','two-point-static','three-point-static',
        'falling-start','half-kneeling-start','two-point-auditory-start',
        'two-point-walk-in-provisional','three-point-build-up-provisional'),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'humanReviewRequired',TRUE,'publicationQuarantined',TRUE,
      'approvalsCreated',FALSE),updated_at=now()
  WHERE definition.id=survivor_id;

  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1 source
      WHERE source.legacy_exercise_id IN(
        6,99,117,118,119,120,325,326,327,706,707,708,744,937,957,
        1121,1122,1333,1591,1592)
        AND source.definition_id=survivor_id)<>20 THEN
    RAISE EXCEPTION '% expected all 20 audited sources on the survivor',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE definition_id=survivor_id AND status<>'archived')<>8
    OR (SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      WHERE variant.definition_id=survivor_id AND variant.status<>'archived'
        AND profile.status<>'archived')<>8
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug=ANY(source_slugs) AND status<>'archived')
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(source_slugs) AND variant.status<>'archived') THEN
    RAISE EXCEPTION '% expected one survivor, eight variants, eight profiles, and archived sources',
      migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.survivor_definition_id=survivor_id
        AND resolution.resolved_definition_id IN(
          SELECT id FROM coaching.exercise_definition_v1
          WHERE slug=ANY(source_slugs))
        AND resolution.decision='duplicate_consolidated')
      <>cardinality(source_slugs) THEN
    RAISE EXCEPTION '% failed to persist every identity consolidation',migration_key;
  END IF;
END
$$;
