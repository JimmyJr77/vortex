-- Correct ankling, pogo, and straight-leg source lineage before completing the
-- family's research packets.
--
-- The source audit distinguishes stationary bilateral low pogos from traveling
-- ankling, treats walk/dribble cadence as delivery of the traveling Ankling
-- Drill, and restores Wall Ankling Pogo because its support, posture,
-- laterality, contact sequence, and displacement contract is not yet exact.
-- Ambiguous hybrids remain active only in explicit selection quarantine.
--
-- Exercise cards contain exercise complexity and physical difficulty only.
-- Athlete skill/proficiency is exclusive to coaching.skill. This migration is
-- idempotent, fail-closed, and creates no review or publication approval.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '412_coaching_ankling_straight_leg_identity_lineage_correction';
  scope_slugs CONSTANT TEXT[] := ARRAY[
    'ankle-pogo-in-place','low-pogos','ankling-pogo-hop',
    'wall-ankling-pogo','ankling-dribble-march','ankling-drill',
    'ankling-walk','fast-ankling-pogo-march',
    'distance-jump-straight-leg-bound-march',
    'distance-jump-straight-leg-bound','straight-leg-ankling-ladder',
    'straight-leg-bounds-to-sprint'
  ];
  row_data RECORD;
  survivor_id UUID;
  duplicate_id UUID;
  ankle_id UUID;
  pogo_id UUID;
  wall_id UUID;
  drill_id UUID;
  march_id UUID;
  duplicate_legacy_id BIGINT;
  protected_count INTEGER;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE facility_id=1 AND slug=ANY(scope_slugs))<>cardinality(scope_slugs) THEN
    RAISE EXCEPTION '% requires all % traceable source definitions',
      migration_key,cardinality(scope_slugs);
  END IF;

  SELECT id INTO ankle_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='ankle-pogo-in-place';
  SELECT id INTO pogo_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='ankling-pogo-hop';
  SELECT id INTO wall_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='wall-ankling-pogo';
  SELECT id INTO drill_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='ankling-drill';
  SELECT id INTO march_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='distance-jump-straight-leg-bound-march';

  -- Every deterministic lineage repair refuses protected human or published
  -- state. Candidate/review-only packets remain safe to reproduce.
  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
     WHERE definition.slug=ANY(scope_slugs)
       AND (definition.status='published' OR definition.reviewed_by IS NOT NULL
         OR definition.approved_by IS NOT NULL
         OR definition.last_reviewed_at IS NOT NULL
         OR definition.approved_video_url IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=evidence.definition_id
      WHERE definition.slug=ANY(scope_slugs)
        AND evidence.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=media.definition_id
      WHERE definition.slug=ANY(scope_slugs)
        AND media.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=alternate.definition_id
      WHERE definition.slug=ANY(scope_slugs)
        AND alternate.review_status NOT IN('candidate','superseded'))
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
          SELECT id FROM coaching.exercise_definition_v1 WHERE slug=ANY(scope_slugs))
        OR to_variant.definition_id IN(
          SELECT id FROM coaching.exercise_definition_v1 WHERE slug=ANY(scope_slugs)))
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
    RAISE EXCEPTION '% refused to override % protected record(s)',
      migration_key,protected_count;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 survivor
      ON survivor.id=resolution.survivor_definition_id
    JOIN coaching.exercise_definition_v1 resolved
      ON resolved.id=resolution.resolved_definition_id
    WHERE (survivor.slug=ANY(scope_slugs) OR resolved.slug=ANY(scope_slugs))
      AND (resolution.resolution_source='human_review'
        OR resolution.reviewed_by IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refused to override a human identity decision',migration_key;
  END IF;

  -- Low Pogos is the low-amplitude preparation delivery of the stationary
  -- bilateral Ankle Pogo, not of the unresolved Ankling Pogo label.
  UPDATE coaching.exercise_definition_source_v1 source
  SET definition_id=ankle_id,source_kind='duplicate_consolidation',
    provenance_json=source.provenance_json||jsonb_build_object(
      'correctedFromDefinitionId',pogo_id,
      'resolution','stationary_bilateral_low_pogo_identity',
      'researchArtifact','low-pogos.v1.json',
      'researchVersion','2026-07-25.7','migration',migration_key)
  WHERE source.legacy_exercise_id=48 AND source.definition_id<>ankle_id;

  UPDATE coaching.exercise_variant_v1 variant
  SET definition_id=ankle_id,status='archived',
    requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'sourceIdentityDuplicate',TRUE,'selectable',FALSE,
        'identityQuarantine',TRUE,
        'correctedIdentity','stationary_bilateral_low_pogo',
        'migration',migration_key),updated_at=now()
  WHERE variant.definition_id=pogo_id
    AND variant.variant_key='legacy-source-48-baseline';

  DELETE FROM coaching.exercise_identity_resolution_v1 resolution
  WHERE resolution.survivor_definition_id=pogo_id
    AND resolution.resolved_definition_id=(
      SELECT id FROM coaching.exercise_definition_v1 WHERE slug='low-pogos')
    AND resolution.resolution_source<>'human_review'
    AND resolution.reviewed_by IS NULL;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,ankle_id,definition.id,'duplicate_consolidated',
    'Low Pogos declares the same stationary bilateral low-amplitude repeated ankle-pogo contract. Contact cap, amplitude, cadence, seconds, repetitions, rest, and phase intent are delivery dimensions.',
    jsonb_build_object(
      'match','same_stationary_bilateral_low_amplitude_ankle_pogo',
      'variantDimensions',jsonb_build_array(
        'contact_cap','amplitude','cadence','seconds','repetitions','rest','phase_intent'),
      'researchArtifact','low-pogos.v1.json',
      'researchVersion','2026-07-25.7',
      'decisionScope','identity_and_traceability_only_not_human_approval',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'migration',migration_key),
    'deterministic_identity_equivalence',NULL,now()
  FROM coaching.exercise_definition_v1 definition WHERE definition.slug='low-pogos'
  ON CONFLICT(survivor_definition_id,resolved_definition_id)
  DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  UPDATE coaching.exercise_definition_v1 definition
  SET aliases=ARRAY(
      SELECT min(alias) FROM unnest(coalesce(definition.aliases,'{}')
        ||ARRAY['Low Pogos','Low Pogos / Ankling Bounce']) alias
      WHERE nullif(btrim(alias),'') IS NOT NULL
        AND lower(btrim(alias)) NOT IN(
          lower(definition.canonical_name),lower(definition.display_name))
      GROUP BY lower(btrim(alias)) ORDER BY lower(btrim(alias))),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'lowPogoIdentityCorrection','stationary_bilateral_ankle_pogo',
      'identityMigration',migration_key,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE definition.id=ankle_id;

  UPDATE coaching.exercise_definition_v1 definition
  SET aliases=ARRAY(
      SELECT min(alias) FROM unnest(coalesce(definition.aliases,'{}')) alias
      WHERE lower(btrim(alias)) NOT IN(
        'low pogos','low pogos / ankling bounce','low pogos / ankling bounces',
        'wall ankling pogo','wall ankling pogos')
      GROUP BY lower(btrim(alias)) ORDER BY lower(btrim(alias))),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'priorOverbroadConsolidationsCorrected',TRUE,
      'identityMigration',migration_key,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE definition.id=pogo_id;

  -- The exact-name source variant added by migration 252 has no changed
  -- movement contract and must not remain a second selectable baseline.
  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  WHERE profile.variant_id IN(
    SELECT id FROM coaching.exercise_variant_v1
    WHERE definition_id=ankle_id AND variant_key='baseline-source-1109'
      AND status<>'archived');

  UPDATE coaching.exercise_variant_v1 variant
  SET status='archived',requirements_json=coalesce(requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'sourceIdentityDuplicate',TRUE,'selectable',FALSE,
        'identityQuarantine',TRUE,'exactIdentitySource',TRUE,
        'migration',migration_key),updated_at=now()
  WHERE definition_id=ankle_id AND variant_key='baseline-source-1109'
    AND status<>'archived';

  -- Restore Wall Ankling Pogo. Research cannot yet prove whether it is
  -- bilateral, alternating, stationary, traveling, marching, or hopping.
  UPDATE coaching.exercise_definition_source_v1 source
  SET definition_id=wall_id,source_kind='legacy_migration',
    provenance_json=source.provenance_json||jsonb_build_object(
      'restoredFromDefinitionId',pogo_id,
      'resolution','unresolved_wall_supported_ankling_contract',
      'researchArtifact','wall-ankling-pogo.v1.json',
      'researchVersion','2026-07-25.8','migration',migration_key)
  WHERE source.legacy_exercise_id=1085 AND source.definition_id<>wall_id;

  UPDATE coaching.exercise_variant_v1 variant
  SET definition_id=wall_id,variant_key='baseline',status='review',
    requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'selectable',FALSE,'identityQuarantine',TRUE,
        'identityBlocker','exact body angle, support, laterality, ordered contact sequence, displacement, dose unit, and finish require human authorship',
        'researchArtifact','wall-ankling-pogo.v1.json',
        'researchVersion','2026-07-25.8','migration',migration_key),
    updated_at=now()
  WHERE variant.definition_id=pogo_id
    AND variant.variant_key='legacy-source-1085-baseline';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET role='avoid',phase_suitability=1,status='review',
    purpose='Identity quarantine: do not prescribe until the exact wall-supported body angle, laterality, contact sequence, displacement, dose unit, and finish are authored and approved.',
    quality_gate='Blocked: exact wall-supported movement and dosage contract requires human review.',
    stop_rules=ARRAY[
      'Do not select or perform from this candidate card.',
      'Stop if the wall or support is unsecured.',
      'Stop on pain, protective mechanics, balance loss, or uncontrolled contact.'
    ],updated_at=now()
  WHERE profile.variant_id IN(
    SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=wall_id)
    AND profile.status='archived';

  UPDATE coaching.exercise_definition_v1 definition
  SET status='review',reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    approved_video_url=NULL,
    provenance_json=definition.provenance_json||jsonb_build_object(
      'restoredAfterIdentityAudit',TRUE,
      'identityBlocker','wall support, body angle, laterality, ordered contacts, displacement, dose unit, and finish',
      'researchArtifact','wall-ankling-pogo.v1.json',
      'researchVersion','2026-07-25.8','identityMigration',migration_key,
      'humanReviewRequired',TRUE,'publicationQuarantined',TRUE,
      'approvalsCreated',FALSE),updated_at=now()
  WHERE definition.id=wall_id;

  UPDATE coaching.exercise_identity_resolution_v1 resolution
  SET decision='needs_human_review',
    rationale='Wall support and the ankling/pogo label do not establish an exact movement identity. Body angle, external support, laterality, ordered contacts, flight, displacement, dose unit, and finish must be authored before merge or distinction.',
    evidence_json=jsonb_build_object(
      'identityBoundary','unresolved_wall_supported_ankling_contract',
      'missingIdentityFacts',jsonb_build_array(
        'body_angle','support_rules','laterality','ordered_contact_sequence',
        'flight','displacement','dose_unit','finish'),
      'researchArtifact','wall-ankling-pogo.v1.json',
      'researchVersion','2026-07-25.8',
      'decisionScope','identity_only_not_human_approval',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'migration',migration_key),
    resolution_source='deterministic_identity_equivalence',reviewed_by=NULL,
    resolved_at=now()
  WHERE resolution.survivor_definition_id=pogo_id
    AND resolution.resolved_definition_id=wall_id
    AND resolution.resolution_source<>'human_review';

  IF NOT FOUND THEN
    INSERT INTO coaching.exercise_identity_resolution_v1(
      facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
      evidence_json,resolution_source,reviewed_by,resolved_at)
    VALUES(1,pogo_id,wall_id,'needs_human_review',
      'Wall support and the ankling/pogo label do not establish an exact movement identity. Body angle, external support, laterality, ordered contacts, flight, displacement, dose unit, and finish must be authored before merge or distinction.',
      jsonb_build_object(
        'identityBoundary','unresolved_wall_supported_ankling_contract',
        'missingIdentityFacts',jsonb_build_array(
          'body_angle','support_rules','laterality','ordered_contact_sequence',
          'flight','displacement','dose_unit','finish'),
        'researchArtifact','wall-ankling-pogo.v1.json',
        'researchVersion','2026-07-25.8','humanReviewRequired',TRUE,
        'approvalsCreated',FALSE,'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now());
  END IF;

  -- Ankling Walk and Ankling / Dribble March preserve the traveling,
  -- alternating, no-flight ankling contract and become learning profiles.
  FOR row_data IN
    SELECT * FROM (VALUES
      ('ankling-dribble-march','Ankling / Dribble March',
       'same_traveling_ankling_with_dribble_learning_cadence',
       '["learning_cadence","step_length","distance","contacts","rest","dose"]'::JSONB),
      ('ankling-walk','Ankling Walk',
       'same_traveling_ankling_with_walk_learning_cadence',
       '["learning_cadence","step_length","distance","contacts","rest","dose"]'::JSONB)
    ) values_row(duplicate_slug,retained_alias,identity_match,variant_dimensions)
  LOOP
    SELECT id,legacy_exercise_id INTO duplicate_id,duplicate_legacy_id
    FROM coaching.exercise_definition_v1 WHERE slug=row_data.duplicate_slug;

    IF (SELECT status FROM coaching.exercise_definition_v1 WHERE id=duplicate_id)<>'archived' THEN
      INSERT INTO coaching.exercise_identity_resolution_v1(
        facility_id,survivor_definition_id,resolved_definition_id,decision,
        rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
      VALUES(1,drill_id,duplicate_id,'duplicate_consolidated',
        'The source retains the traveling alternating short-step Ankling Drill. Walk or dribble wording changes learning cadence, step length, distance, contacts, recovery, and dose without adding flight or a new ordered movement contract.',
        jsonb_build_object(
          'match',row_data.identity_match,
          'variantDimensions',row_data.variant_dimensions,
          'researchArtifact',row_data.duplicate_slug||'.v1.json',
          'researchVersion','2026-07-25.7',
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

      UPDATE coaching.exercise_definition_source_v1 source
      SET definition_id=drill_id,source_kind='duplicate_consolidation',
        provenance_json=source.provenance_json||jsonb_build_object(
          'resolvedFromDefinitionId',duplicate_id,
          'resolution',row_data.identity_match,
          'variantDimensions',row_data.variant_dimensions,
          'researchArtifact',row_data.duplicate_slug||'.v1.json',
          'researchVersion','2026-07-25.7','migration',migration_key)
      WHERE source.definition_id=duplicate_id;

      UPDATE coaching.exercise_delivery_profile_v1 profile
      SET status='archived',updated_at=now()
      WHERE profile.variant_id IN(
        SELECT id FROM coaching.exercise_variant_v1
        WHERE definition_id=duplicate_id);

      UPDATE coaching.exercise_variant_v1 variant
      SET definition_id=drill_id,
        variant_key='legacy-source-'||duplicate_legacy_id::TEXT||'-'||variant.variant_key,
        status='archived',
        requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
          ||jsonb_build_object(
            'sourceIdentityDuplicate',TRUE,'sourceDefinitionId',duplicate_id,
            'selectable',FALSE,'identityQuarantine',TRUE,
            'variantDimensions',row_data.variant_dimensions,
            'migration',migration_key),updated_at=now()
      WHERE variant.definition_id=duplicate_id;

      UPDATE coaching.exercise_definition_v1 definition
      SET status='archived',reviewed_by=NULL,approved_by=NULL,
        last_reviewed_at=NULL,approved_video_url=NULL,
        provenance_json=definition.provenance_json||jsonb_build_object(
          'archivedReason','duplicate_identity_consolidated',
          'survivorDefinitionId',drill_id,
          'identityMatch',row_data.identity_match,
          'variantDimensions',row_data.variant_dimensions,
          'identityMigration',migration_key,'approvalsCreated',FALSE),
        updated_at=now()
      WHERE definition.id=duplicate_id;
    ELSIF NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_source_v1 source
      WHERE source.definition_id=drill_id
        AND source.legacy_exercise_id=duplicate_legacy_id
        AND source.source_kind='duplicate_consolidation')
      OR NOT EXISTS(
        SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
        WHERE resolution.survivor_definition_id=drill_id
          AND resolution.resolved_definition_id=duplicate_id
          AND resolution.decision='duplicate_consolidated'
          AND resolution.reviewed_by IS NULL) THEN
      RAISE EXCEPTION '% found archived % without complete survivor lineage',
        migration_key,row_data.duplicate_slug;
    END IF;

    UPDATE coaching.exercise_definition_v1 definition
    SET aliases=ARRAY(
        SELECT min(alias) FROM unnest(coalesce(definition.aliases,'{}')
          ||ARRAY[row_data.retained_alias]) alias
        WHERE nullif(btrim(alias),'') IS NOT NULL
          AND lower(btrim(alias)) NOT IN(
            lower(definition.canonical_name),lower(definition.display_name))
        GROUP BY lower(btrim(alias)) ORDER BY lower(btrim(alias))),
      provenance_json=definition.provenance_json||jsonb_build_object(
        'identityMigration',migration_key,'humanReviewRequired',TRUE,
        'publicationQuarantined',TRUE),updated_at=now()
    WHERE definition.id=drill_id;
  END LOOP;

  -- The former Ankling Pogo versus Ankling Walk decision was made before the
  -- pogo label's missing contact contract was discovered. Retain traceability
  -- but correctly return both the archived-source and active-family boundary
  -- to human review.
  UPDATE coaching.exercise_identity_resolution_v1 resolution
  SET decision='needs_human_review',
    rationale='Ankling Pogo does not declare stationary versus traveling, bilateral versus alternating, flight, or its ordered contact sequence. It cannot yet be deterministically separated from or merged with the traveling Ankling Drill.',
    evidence_json=resolution.evidence_json||jsonb_build_object(
      'priorDecisionCorrected',TRUE,
      'missingIdentityFacts',jsonb_build_array(
        'stationary_or_traveling','laterality','flight','ordered_contact_sequence'),
      'researchArtifact','ankling-pogo-hop.v1.json',
      'researchVersion','2026-07-25.7','humanReviewRequired',TRUE,
      'approvalsCreated',FALSE,'migration',migration_key),
    resolution_source='deterministic_identity_equivalence',reviewed_by=NULL,
    resolved_at=now()
  WHERE resolution.survivor_definition_id=pogo_id
    AND resolution.resolved_definition_id=(
      SELECT id FROM coaching.exercise_definition_v1 WHERE slug='ankling-walk')
    AND resolution.resolution_source<>'human_review';

  -- The no-flight learning card is named Straight-Leg March. Preserve all
  -- historic search labels; do not misrepresent it as a bound.
  UPDATE coaching.exercise_definition_v1 definition
  SET canonical_name='Straight-Leg March',display_name='Straight-Leg March',
    aliases=ARRAY(
      SELECT min(alias) FROM unnest(coalesce(definition.aliases,'{}')
        ||ARRAY['Straight-Leg Bound March','Straight-Leg Run Prep',
          'Straight-Leg Bound March — Distance Jump']) alias
      WHERE nullif(btrim(alias),'') IS NOT NULL
        AND lower(btrim(alias))<>'straight-leg march'
      GROUP BY lower(btrim(alias)) ORDER BY lower(btrim(alias))),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'identityNameCorrection','straight_leg_march_no_flight',
      'identityMigration',migration_key,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE definition.id=march_id;

  UPDATE coaching.exercise_definition_v1 definition
  SET aliases=ARRAY(
      SELECT min(alias) FROM unnest(coalesce(definition.aliases,'{}')
        ||ARRAY['Straight-Leg Bound — Distance Jump']) alias
      WHERE nullif(btrim(alias),'') IS NOT NULL
        AND lower(btrim(alias)) NOT IN(
          lower(definition.canonical_name),lower(definition.display_name))
      GROUP BY lower(btrim(alias)) ORDER BY lower(btrim(alias))),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'identityNameCorrection','straight_leg_bound_not_distance_jump_exclusive',
      'identityMigration',migration_key,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE definition.slug='distance-jump-straight-leg-bound';

  -- Close the active identity surface. A distinct decision is made only where
  -- stationary bilateral versus traveling alternating no-flight is explicit;
  -- underspecified hybrids remain human-review boundaries.
  FOR row_data IN
    SELECT * FROM (VALUES
      ('ankle-pogo-in-place','ankling-drill','distinct_exercises',
       'stationary_bilateral_airborne_pogo_vs_traveling_alternating_no_flight_ankling',
       '[]'::JSONB),
      ('ankling-pogo-hop','ankle-pogo-in-place','needs_human_review',
       'unresolved_ankling_pogo_vs_stationary_bilateral_pogo',
       '["stationary_or_traveling","laterality","ordered_contact_sequence","flight"]'::JSONB),
      ('ankling-pogo-hop','ankling-drill','needs_human_review',
       'unresolved_ankling_pogo_vs_traveling_ankling',
       '["stationary_or_traveling","laterality","ordered_contact_sequence","flight"]'::JSONB),
      ('fast-ankling-pogo-march','ankle-pogo-in-place','needs_human_review',
       'unresolved_fast_ankling_pogo_march_hybrid_vs_ankle_pogo',
       '["ordered_contact_sequence","laterality","flight","displacement","finish"]'::JSONB),
      ('fast-ankling-pogo-march','ankling-drill','needs_human_review',
       'unresolved_fast_ankling_pogo_march_hybrid_vs_ankling',
       '["ordered_contact_sequence","laterality","flight","displacement","finish"]'::JSONB),
      ('straight-leg-ankling-ladder','distance-jump-straight-leg-bound-march','needs_human_review',
       'unresolved_ladder_contact_pattern_vs_straight_leg_march',
       '["cell_pattern","contacts_per_cell","laterality","entry","exit","finish"]'::JSONB),
      ('wall-ankling-pogo','ankle-pogo-in-place','needs_human_review',
       'unresolved_wall_ankling_contract_vs_stationary_ankle_pogo',
       '["body_angle","support_rules","laterality","ordered_contact_sequence","flight"]'::JSONB),
      ('wall-ankling-pogo','ankling-drill','needs_human_review',
       'unresolved_wall_ankling_contract_vs_traveling_ankling',
       '["body_angle","support_rules","laterality","ordered_contact_sequence","flight"]'::JSONB)
    ) boundary(left_slug,right_slug,decision,identity_boundary,missing_facts)
  LOOP
    SELECT id INTO survivor_id FROM coaching.exercise_definition_v1
    WHERE slug=row_data.left_slug;
    SELECT id INTO duplicate_id FROM coaching.exercise_definition_v1
    WHERE slug=row_data.right_slug;

    IF EXISTS(
      SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE ((resolution.survivor_definition_id=survivor_id
          AND resolution.resolved_definition_id=duplicate_id)
        OR (resolution.survivor_definition_id=duplicate_id
          AND resolution.resolved_definition_id=survivor_id))
        AND (resolution.resolution_source='human_review'
          OR resolution.reviewed_by IS NOT NULL)
    ) THEN
      RAISE EXCEPTION '% conflicts with protected identity boundary % / %',
        migration_key,row_data.left_slug,row_data.right_slug;
    END IF;

    INSERT INTO coaching.exercise_identity_resolution_v1(
      facility_id,survivor_definition_id,resolved_definition_id,decision,
      rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
    VALUES(1,survivor_id,duplicate_id,row_data.decision,
      CASE WHEN row_data.decision='distinct_exercises'
        THEN 'Ankle Pogo is stationary, bilateral, and airborne; Ankling Drill is traveling, alternating, and no-flight. Cadence or dose cannot remove that identity boundary.'
        ELSE 'The source label does not declare enough ordered movement facts to merge or separate these cards safely; the missing contract requires human authorship and review.' END,
      jsonb_build_object(
        'identityBoundary',row_data.identity_boundary,
        'missingIdentityFacts',row_data.missing_facts,
        'researchBatch','ankling-straight-leg-drills-v1',
        'researchVersion','2026-07-25.7',
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

  -- Quarantine every unresolved definition immediately, before the completion
  -- migration adds richer operational profiles and test packets.
  UPDATE coaching.exercise_variant_v1 variant
  SET requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'selectable',FALSE,'identityQuarantine',TRUE,
        'humanReviewRequired',TRUE,'migration',migration_key),
    updated_at=now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=variant.definition_id AND variant.status<>'archived'
    AND coalesce(definition.provenance_json->>'researchCompletionMigration','')
      <>'413_coaching_ankling_straight_leg_research_completion'
    AND definition.slug IN(
      'ankling-pogo-hop','fast-ankling-pogo-march',
      'straight-leg-ankling-ladder','wall-ankling-pogo');

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET role='avoid',phase_suitability=1,
    purpose='Identity quarantine: do not prescribe until the exact ordered movement, dosage, setup, and finish contract is authored and approved.',
    quality_gate='Blocked: exact exercise identity and dosage contract requires human review.',
    stop_rules=ARRAY['Do not select or perform from this candidate card.'],
    updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=variant.definition_id
  WHERE profile.variant_id=variant.id AND profile.status<>'archived'
    AND coalesce(definition.provenance_json->>'researchCompletionMigration','')
      <>'413_coaching_ankling_straight_leg_research_completion'
    AND definition.slug IN(
      'ankling-pogo-hop','fast-ankling-pogo-march',
      'straight-leg-ankling-ladder','wall-ankling-pogo');

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_source_v1 source
    JOIN coaching.exercise_definition_v1 definition
      ON definition.id=source.definition_id
    WHERE (source.legacy_exercise_id=48 AND definition.id<>ankle_id)
       OR (source.legacy_exercise_id=1085 AND definition.id<>wall_id)
       OR (source.legacy_exercise_id IN(96,1112) AND definition.id<>drill_id)
  ) THEN
    RAISE EXCEPTION '% left corrected source lineage on the wrong definition',
      migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE status<>'archived' AND slug=ANY(scope_slugs))<>9 THEN
    RAISE EXCEPTION '% expected nine surviving active family definitions',
      migration_key;
  END IF;
END
$$;
