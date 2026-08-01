-- Prepare the ordinary-skip, constrained-skip, power-skip, dual-task skip,
-- and fast-leg family for research completion.
--
-- Ordinary cadence changes remain delivery of the same step-hop skip. The
-- exact-name distance-jump Power Skip source is lineage, not a second active
-- baseline. Cone spacing, toss timing, and Fast-Leg Cycle remain nonselectable
-- until their ordered contracts are authored. No approval is created.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '414_coaching_skipping_fast_leg_identity_preparation';
  scope_slugs CONSTANT TEXT[] := ARRAY[
    'skipping-rhythm-drill','skipping-rhythm-change',
    'cone-skip-rhythm-build','skipping-rhythm-change-with-ball-toss',
    'power-skip-for-distance','fast-leg-cycle-drill'
  ];
  active_slugs CONSTANT TEXT[] := ARRAY[
    'skipping-rhythm-drill','cone-skip-rhythm-build',
    'skipping-rhythm-change-with-ball-toss','power-skip-for-distance',
    'fast-leg-cycle-drill'
  ];
  row_data RECORD;
  left_id UUID;
  right_id UUID;
  protected_count INTEGER;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE facility_id=1 AND slug=ANY(scope_slugs))<>6 THEN
    RAISE EXCEPTION '% requires all six traceable source definitions',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE facility_id=1 AND slug=ANY(active_slugs)
        AND status<>'archived')<>5
    OR (SELECT status FROM coaching.exercise_definition_v1
        WHERE slug='skipping-rhythm-change')<>'archived' THEN
    RAISE EXCEPTION '% requires five active definitions and one archived cadence source',
      migration_key;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.slug=ANY(scope_slugs)
        AND (definition.status='published' OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
          OR definition.approved_video_url IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
      JOIN coaching.exercise_definition_v1 definition ON definition.id=evidence.definition_id
      WHERE definition.slug=ANY(scope_slugs)
        AND evidence.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      JOIN coaching.exercise_definition_v1 definition ON definition.id=media.definition_id
      WHERE definition.slug=ANY(scope_slugs)
        AND media.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      JOIN coaching.exercise_definition_v1 definition ON definition.id=alternate.definition_id
      WHERE definition.slug=ANY(scope_slugs)
        AND alternate.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_card_review_v1 review
      JOIN coaching.exercise_definition_v1 definition ON definition.id=review.definition_id
      WHERE definition.slug=ANY(scope_slugs))
    +(SELECT count(*) FROM coaching.exercise_card_revision_v1 revision
      JOIN coaching.exercise_definition_v1 definition ON definition.id=revision.definition_id
      WHERE definition.slug=ANY(scope_slugs))
    +(SELECT count(*) FROM coaching.exercise_media_review_v1 review
      JOIN coaching.exercise_definition_v1 definition ON definition.id=review.definition_id
      WHERE definition.slug=ANY(scope_slugs))
    +(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(scope_slugs) AND variant.status='published')
    +(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(scope_slugs) AND profile.status='published')
    +(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 from_variant ON from_variant.id=relationship.from_variant_id
      JOIN coaching.exercise_variant_v1 to_variant ON to_variant.id=relationship.to_variant_id
      WHERE (from_variant.definition_id IN(
          SELECT id FROM coaching.exercise_definition_v1 WHERE slug=ANY(scope_slugs))
        OR to_variant.definition_id IN(
          SELECT id FROM coaching.exercise_definition_v1 WHERE slug=ANY(scope_slugs)))
        AND (relationship.review_status<>'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(scope_slugs)
        AND (calibration.status<>'review' OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id IN(104,339,639,926,993,1137,1589)
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

  -- The exact normalized Power Skip source has no changed movement contract.
  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  WHERE profile.variant_id IN(
    SELECT variant.id FROM coaching.exercise_variant_v1 variant
    JOIN coaching.exercise_definition_v1 definition
      ON definition.id=variant.definition_id
    WHERE definition.slug='power-skip-for-distance'
      AND variant.variant_key='baseline-source-1137'
      AND variant.status<>'archived');

  UPDATE coaching.exercise_variant_v1 variant
  SET status='archived',
    requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'sourceIdentityDuplicate',TRUE,'exactIdentitySource',TRUE,
        'selectable',FALSE,'identityQuarantine',TRUE,'migration',migration_key),
    updated_at=now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=variant.definition_id
    AND definition.slug='power-skip-for-distance'
    AND variant.variant_key='baseline-source-1137'
    AND variant.status<>'archived';

  CREATE TEMP TABLE family_identity_seed(
    left_slug TEXT NOT NULL,right_slug TEXT NOT NULL,decision TEXT NOT NULL,
    boundary_key TEXT NOT NULL,missing_facts JSONB NOT NULL,rationale TEXT NOT NULL,
    PRIMARY KEY(left_slug,right_slug)
  ) ON COMMIT DROP;
  INSERT INTO family_identity_seed VALUES
    ('skipping-rhythm-drill','cone-skip-rhythm-build','needs_human_review',
      'ordinary_skip_vs_unresolved_marker_spacing_contract',
      '["marker_to_contact_rule","individualized_spacing","entry","error_rule","finish"]',
      'Flat markers may constrain ordinary skipping, but the source does not define the contact unit assigned to each gap, individualized spacing, entry, error handling, or finish.'),
    ('skipping-rhythm-drill','power-skip-for-distance','distinct_exercises',
      'ordinary_submaximal_skip_vs_horizontal_high_intent_power_skip',
      '[]',
      'Ordinary skipping uses relaxed submaximal step-hop rhythm. Power Skip maximizes safe horizontal displacement and adds higher projection, force, impact, recovery, and quality requirements.'),
    ('skipping-rhythm-drill','fast-leg-cycle-drill','distinct_exercises',
      'alternating_two_sided_step_hop_skip_vs_single_designated_leg_cycle',
      '[]',
      'Ordinary skipping alternates complete left and right step-hop cycles. Fast-Leg Cycle repeatedly cycles one designated leg while the support-side contract is separately controlled.'),
    ('power-skip-for-distance','fast-leg-cycle-drill','distinct_exercises',
      'alternating_horizontal_power_step_hops_vs_single_leg_sprint_cycle',
      '[]',
      'Power Skip alternates high-intent projected step-hops with repeated landings. Fast-Leg Cycle is a unilateral sprint-mechanics cycle and does not declare maximal horizontal projection.'),
    ('cone-skip-rhythm-build','skipping-rhythm-change-with-ball-toss','distinct_exercises',
      'external_spacing_skip_vs_timed_object_dual_task_skip',
      '[]',
      'Cone Skip uses external visual spacing without an object-handling task. Ball-Toss Skip adds a timed toss and catch, object specification, drop handling, and dual-task success criteria.');

  FOR row_data IN SELECT * FROM family_identity_seed LOOP
    SELECT id INTO left_id FROM coaching.exercise_definition_v1
    WHERE facility_id=1 AND slug=row_data.left_slug AND status<>'archived';
    SELECT id INTO right_id FROM coaching.exercise_definition_v1
    WHERE facility_id=1 AND slug=row_data.right_slug AND status<>'archived';

    IF EXISTS(
      SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE ((resolution.survivor_definition_id=left_id
          AND resolution.resolved_definition_id=right_id)
        OR (resolution.survivor_definition_id=right_id
          AND resolution.resolved_definition_id=left_id))
        AND (resolution.survivor_definition_id<>left_id
          OR resolution.resolved_definition_id<>right_id
          OR resolution.decision<>row_data.decision
          OR resolution.resolution_source='human_review'
          OR resolution.reviewed_by IS NOT NULL)
    ) THEN
      RAISE EXCEPTION '% conflicts with identity boundary % / %',
        migration_key,row_data.left_slug,row_data.right_slug;
    END IF;

    INSERT INTO coaching.exercise_identity_resolution_v1(
      facility_id,survivor_definition_id,resolved_definition_id,decision,
      rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
    VALUES(1,left_id,right_id,row_data.decision,row_data.rationale,
      jsonb_build_object(
        'identityBoundary',row_data.boundary_key,
        'missingIdentityFacts',row_data.missing_facts,
        'researchBatch','skipping-fast-leg-drills-v1',
        'researchVersion','2026-07-25.10',
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
  END LOOP;

  UPDATE coaching.exercise_variant_v1 variant
  SET requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'selectable',FALSE,'identityQuarantine',TRUE,
        'humanReviewRequired',TRUE,'migration',migration_key),updated_at=now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=variant.definition_id AND variant.status<>'archived'
    AND coalesce(definition.provenance_json->>'researchCompletionMigration','')
      <>'415_coaching_skipping_fast_leg_research_completion'
    AND definition.slug IN('cone-skip-rhythm-build',
      'skipping-rhythm-change-with-ball-toss','fast-leg-cycle-drill');

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET role='avoid',phase_suitability=1,
    purpose='Identity quarantine: do not prescribe until the exact ordered movement, constraint, dose, and finish contract is authored and approved.',
    quality_gate='Blocked: exact movement and dosage contract requires human review.',
    stop_rules=ARRAY['Do not select or perform from this candidate card.'],
    updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  WHERE profile.variant_id=variant.id AND profile.status<>'archived'
    AND coalesce(definition.provenance_json->>'researchCompletionMigration','')
      <>'415_coaching_skipping_fast_leg_research_completion'
    AND definition.slug IN('cone-skip-rhythm-build',
      'skipping-rhythm-change-with-ball-toss','fast-leg-cycle-drill');

  IF (SELECT count(*) FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(active_slugs)
        AND definition.status<>'archived' AND variant.status<>'archived')<>5 THEN
    RAISE EXCEPTION '% expected one active baseline variant per active definition',
      migration_key;
  END IF;
END
$$;
