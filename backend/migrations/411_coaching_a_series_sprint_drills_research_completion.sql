-- Resolve direct A-series sprint-drill identity collisions and complete the
-- candidate research packets for the surviving canonical cards.
--
-- A-March Linear was already consolidated by migration 394. This migration
-- also consolidates arm-sweep A-March and three A-Skip cue/context labels into
-- aliases plus delivery profiles. Projection, pogo-contact, cone-gate, ladder,
-- and high-knee-ladder labels remain separate but non-prescribable until a
-- human reviewer declares their exact ordered contact and finish contracts.
--
-- Exercise cards store exercise complexity and physical difficulty only;
-- overall difficulty is their maximum. Athlete proficiency belongs only to
-- coaching.skill. Evidence, media, graph, calibration, and test packets remain
-- candidate/review-only, and this migration creates no approval.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '411_coaching_a_series_sprint_drills_research_completion';
  pair RECORD;
  survivor_id UUID;
  duplicate_id UUID;
  duplicate_legacy_id BIGINT;
  duplicate_status TEXT;
  protected_count INTEGER;
BEGIN
  FOR pair IN
    SELECT *
    FROM (VALUES
      (
        'a-march',
        'a-march-mobility-with-arm-sweep',
        'A-March Mobility with Arm Sweep',
        'same_a_march_with_low_cadence_arm_action_emphasis',
        'The source card declares no repeatable shoulder or thoracic sequence beyond reciprocal arm action during the same traveling, alternating, no-flight A-march. Cadence, arm-action emphasis, distance, repetitions, rest, and dose are delivery dimensions.',
        '["cadence","arm_action_emphasis","distance","repetitions","rest","dose"]'::JSONB
      ),
      (
        'a-skip',
        'a-skip-rhythm-punch',
        'A-Skip Rhythm Punch',
        'same_a_skip_with_rhythm_and_active_downstroke_cue',
        'The source card retains the ordinary traveling alternating step-hop A-skip and adds rhythm and punch wording without a different contact sequence. Cue emphasis, cadence, amplitude, distance, contacts, rest, and dose are delivery dimensions.',
        '["cue_emphasis","cadence","amplitude","distance","contacts","rest","dose"]'::JSONB
      ),
      (
        'a-skip',
        'a-skip-snap-down',
        'A-Skip Snap Down',
        'same_a_skip_with_active_downstroke_cue_not_bilateral_snap_down',
        'The source card describes a traveling A-skip with an active downward recovery cue and does not add a bilateral landing hold. The cue does not change the ordinary A-skip contact sequence; cue emphasis, cadence, distance, contacts, rest, and dose are delivery dimensions.',
        '["cue_emphasis","cadence","distance","contacts","rest","dose"]'::JSONB
      ),
      (
        'a-skip',
        'a-skip-for-approach-rhythm',
        'A-Skip for Approach Rhythm',
        'same_a_skip_with_jump_approach_context_annotation',
        'The source card declares no board, checkmark, steering segment, approach stride count, takeoff, or landing. It is the ordinary traveling A-skip delivered in a jump-approach context; context, cue, distance, contacts, rest, and dose are delivery dimensions.',
        '["sport_context","cue_emphasis","distance","contacts","rest","dose"]'::JSONB
      )
    ) AS pairs(
      survivor_slug,duplicate_slug,retained_alias,identity_match,rationale,
      variant_dimensions
    )
  LOOP
    SELECT id
    INTO survivor_id
    FROM coaching.exercise_definition_v1
    WHERE facility_id=1 AND slug=pair.survivor_slug AND status<>'archived';

    SELECT id,legacy_exercise_id,status
    INTO duplicate_id,duplicate_legacy_id,duplicate_status
    FROM coaching.exercise_definition_v1
    WHERE facility_id=1 AND slug=pair.duplicate_slug;

    IF survivor_id IS NULL OR duplicate_id IS NULL THEN
      RAISE EXCEPTION '% requires traceable definitions % and %',
        migration_key,pair.survivor_slug,pair.duplicate_slug;
    END IF;

    IF duplicate_status='archived' THEN
      IF NOT EXISTS(
        SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
        WHERE resolution.survivor_definition_id=survivor_id
          AND resolution.resolved_definition_id=duplicate_id
          AND resolution.decision='duplicate_consolidated'
          AND resolution.reviewed_by IS NULL
      ) OR NOT EXISTS(
        SELECT 1 FROM coaching.exercise_definition_source_v1 source
        WHERE source.definition_id=survivor_id
          AND source.legacy_exercise_id=duplicate_legacy_id
          AND source.source_kind='duplicate_consolidation'
      ) THEN
        RAISE EXCEPTION '% found archived % without complete survivor lineage',
          migration_key,pair.duplicate_slug;
      END IF;
      CONTINUE;
    END IF;

    IF duplicate_legacy_id IS NULL THEN
      RAISE EXCEPTION '% requires legacy identity for %',
        migration_key,pair.duplicate_slug;
    END IF;

    IF EXISTS(
      SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
          (resolution.survivor_definition_id=survivor_id
            AND resolution.resolved_definition_id=duplicate_id)
          OR (resolution.survivor_definition_id=duplicate_id
            AND resolution.resolved_definition_id=survivor_id)
        )
        AND (resolution.decision<>'duplicate_consolidated'
          OR resolution.resolution_source='human_review'
          OR resolution.reviewed_by IS NOT NULL)
    ) THEN
      RAISE EXCEPTION '% conflicts with a protected identity decision for % and %',
        migration_key,pair.survivor_slug,pair.duplicate_slug;
    END IF;

    SELECT
      (SELECT count(*) FROM coaching.exercise_definition_v1 definition
       WHERE definition.id IN(survivor_id,duplicate_id)
         AND (definition.status='published' OR definition.reviewed_by IS NOT NULL
           OR definition.approved_by IS NOT NULL
           OR definition.last_reviewed_at IS NOT NULL
           OR definition.approved_video_url IS NOT NULL))
      +(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
        WHERE evidence.definition_id IN(survivor_id,duplicate_id)
          AND evidence.review_status NOT IN('candidate','superseded'))
      +(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
        WHERE media.definition_id IN(survivor_id,duplicate_id)
          AND media.review_status NOT IN('candidate','superseded'))
      +(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
        WHERE alternate.definition_id IN(survivor_id,duplicate_id)
          AND alternate.review_status NOT IN('candidate','superseded'))
      +(SELECT count(*) FROM coaching.exercise_card_review_v1 review
        WHERE review.definition_id IN(survivor_id,duplicate_id))
      +(SELECT count(*) FROM coaching.exercise_card_revision_v1 revision
        WHERE revision.definition_id IN(survivor_id,duplicate_id))
      +(SELECT count(*) FROM coaching.exercise_media_review_v1 review
        WHERE review.definition_id IN(survivor_id,duplicate_id))
      +(SELECT count(*) FROM coaching.exercise_variant_v1 variant
        WHERE variant.definition_id IN(survivor_id,duplicate_id)
          AND variant.status='published')
      +(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
        JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
        WHERE variant.definition_id IN(survivor_id,duplicate_id)
          AND profile.status='published')
      +(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
        WHERE (relationship.from_variant_id IN(
            SELECT id FROM coaching.exercise_variant_v1
            WHERE definition_id IN(survivor_id,duplicate_id))
          OR relationship.to_variant_id IN(
            SELECT id FROM coaching.exercise_variant_v1
            WHERE definition_id IN(survivor_id,duplicate_id)))
          AND (relationship.review_status<>'review'
            OR relationship.reviewed_by IS NOT NULL
            OR relationship.reviewed_at IS NOT NULL))
      +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
        JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
        WHERE variant.definition_id IN(survivor_id,duplicate_id)
          AND (calibration.status<>'review' OR calibration.reviewed_by IS NOT NULL
            OR calibration.reviewed_at IS NOT NULL))
      +(SELECT count(*) FROM coaching.exercise_score_v1 score
        WHERE score.exercise_id IN(
            SELECT source.legacy_exercise_id
            FROM coaching.exercise_definition_source_v1 source
            WHERE source.definition_id IN(survivor_id,duplicate_id))
          AND (score.human_review_status<>'queued' OR score.reviewed_by IS NOT NULL
            OR score.reviewed_at IS NOT NULL))
    INTO protected_count;

    IF protected_count>0 THEN
      RAISE EXCEPTION '% refused to override % protected record(s) for % and %',
        migration_key,protected_count,pair.survivor_slug,pair.duplicate_slug;
    END IF;

    INSERT INTO coaching.exercise_identity_resolution_v1(
      facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
      evidence_json,resolution_source,reviewed_by,resolved_at)
    VALUES(
      1,survivor_id,duplicate_id,'duplicate_consolidated',pair.rationale,
      jsonb_build_object(
        'match',pair.identity_match,
        'survivorSlug',pair.survivor_slug,
        'resolvedSlug',pair.duplicate_slug,
        'variantDimensions',pair.variant_dimensions,
        'researchBatch','a-series-sprint-drills-v1',
        'researchVersion','2026-07-25.9',
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'decisionScope','identity_and_traceability_only_not_human_approval',
        'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE,
        'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now())
    ON CONFLICT(survivor_definition_id,resolved_definition_id)
    DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
      evidence_json=EXCLUDED.evidence_json,
      resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
      resolved_at=now()
    WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

    UPDATE coaching.exercise_definition_source_v1 source
    SET definition_id=survivor_id,source_kind='duplicate_consolidation',
      provenance_json=source.provenance_json||jsonb_build_object(
        'resolvedFromDefinitionId',duplicate_id,
        'resolution',pair.identity_match,
        'variantDimensions',pair.variant_dimensions,
        'researchArtifact',pair.duplicate_slug||'.v1.json',
        'researchVersion','2026-07-25.9',
        'migration',migration_key)
    WHERE source.definition_id=duplicate_id;

    UPDATE coaching.exercise_delivery_profile_v1 profile
    SET status='archived',updated_at=now()
    WHERE profile.variant_id IN(
      SELECT id FROM coaching.exercise_variant_v1
      WHERE definition_id=duplicate_id);

    UPDATE coaching.exercise_variant_v1 variant
    SET definition_id=survivor_id,
      variant_key=left('legacy-source-'||duplicate_legacy_id::TEXT||'-'||variant.variant_key,120),
      status='archived',
      requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
        ||jsonb_build_object(
          'sourceIdentityDuplicate',TRUE,'sourceDefinitionId',duplicate_id,
          'selectable',FALSE,'identityQuarantine',TRUE,
          'variantDimensions',pair.variant_dimensions,'migration',migration_key),
      updated_at=now()
    WHERE variant.definition_id=duplicate_id;

    UPDATE coaching.exercise_definition_v1 survivor
    SET aliases=ARRAY(
        SELECT min(alias)
        FROM unnest(coalesce(survivor.aliases,'{}')
          ||coalesce(duplicate.aliases,'{}')
          ||ARRAY[duplicate.canonical_name,duplicate.display_name,pair.retained_alias]) alias
        WHERE nullif(btrim(alias),'') IS NOT NULL
          AND lower(btrim(alias)) NOT IN(
            lower(survivor.canonical_name),lower(survivor.display_name))
        GROUP BY lower(btrim(alias))
        ORDER BY lower(btrim(alias))),
      provenance_json=survivor.provenance_json||jsonb_build_object(
        'identityResolution',pair.identity_match,
        'identityMigration',migration_key,
        'consolidatedDefinitionIds',coalesce(
          survivor.provenance_json->'consolidatedDefinitionIds','[]'::JSONB)
          ||to_jsonb(duplicate_id::TEXT),
        'consolidatedLegacyExerciseIds',coalesce(
          survivor.provenance_json->'consolidatedLegacyExerciseIds','[]'::JSONB)
          ||to_jsonb(duplicate_legacy_id),
        'variantDimensions',pair.variant_dimensions,
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'humanReviewRequired',TRUE,'publicationQuarantined',TRUE),
      updated_at=now()
    FROM coaching.exercise_definition_v1 duplicate
    WHERE survivor.id=survivor_id AND duplicate.id=duplicate_id;

    UPDATE coaching.exercise_definition_v1 duplicate
    SET status='archived',approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
      last_reviewed_at=NULL,
      provenance_json=duplicate.provenance_json||jsonb_build_object(
        'identityResolution','duplicate_consolidated',
        'canonicalSurvivorDefinitionId',survivor_id,
        'identityMatch',pair.identity_match,
        'researchArtifact',pair.duplicate_slug||'.v1.json',
        'researchVersion','2026-07-25.9',
        'identityMigration',migration_key,
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'humanReviewRequired',TRUE,'publicationQuarantined',TRUE),
      updated_at=now()
    WHERE duplicate.id=duplicate_id;

    IF NOT EXISTS(
      SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.survivor_definition_id=survivor_id
        AND resolution.resolved_definition_id=duplicate_id
        AND resolution.decision='duplicate_consolidated'
        AND resolution.reviewed_by IS NULL
    ) OR EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=duplicate_id AND status<>'archived'
    ) THEN
      RAISE EXCEPTION '% did not fully consolidate % into %',
        migration_key,pair.duplicate_slug,pair.survivor_slug;
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '411_coaching_a_series_sprint_drills_research_completion';
  research_batch CONSTANT TEXT := 'a-series-sprint-drills-v1';
  already_applied_count INTEGER;
  actual_count INTEGER;
  protected_count INTEGER;
BEGIN
  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1
    AND definition.slug IN(
      'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
      'a-skip-through-cone-gates','a-skip-through-ladder',
      'high-knee-a-march-ladder')
    AND definition.status<>'archived';
  IF actual_count<>7 THEN
    RAISE EXCEPTION '% requires exactly 7 active A-series canonical definitions; found %',
      migration_key,actual_count;
  END IF;

  SELECT count(*) INTO already_applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1
    AND definition.slug IN(
      'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
      'a-skip-through-cone-gates','a-skip-through-ladder',
      'high-knee-a-march-ladder')
    AND definition.status<>'archived'
    AND definition.provenance_json->>'researchCompletionMigration'=migration_key;
  IF already_applied_count NOT IN(0,7) THEN
    RAISE EXCEPTION '% found partial prior application on % definitions',
      migration_key,already_applied_count;
  END IF;
  IF already_applied_count=0 AND EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1
      AND definition.slug IN(
        'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
        'a-skip-through-cone-gates','a-skip-through-ladder',
        'high-knee-a-march-ladder')
      AND definition.status<>'archived' AND definition.card_version<>1
  ) THEN
    RAISE EXCEPTION '% expected card version 1 before first application',migration_key;
  END IF;
  IF already_applied_count = 7 AND EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1
      AND definition.slug IN(
        'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
        'a-skip-through-cone-gates','a-skip-through-ladder',
        'high-knee-a-march-ladder')
      AND definition.status<>'archived' AND definition.card_version <> 2
  ) THEN
    RAISE EXCEPTION '% found card-version drift after completion',migration_key;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_definition_source_v1 source
    ON source.definition_id=definition.id
  WHERE definition.facility_id=1
    AND definition.slug IN(
      'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
      'a-skip-through-cone-gates','a-skip-through-ladder',
      'high-knee-a-march-ladder')
    AND definition.status<>'archived'
    AND source.legacy_exercise_id IN(69,95,717,878,924,925,982,1117,1118,1590,1636,1637);
  IF actual_count<>12 OR EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_definition_source_v1 source
      ON source.definition_id=definition.id
    WHERE definition.facility_id=1
      AND definition.slug IN(
        'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
        'a-skip-through-cone-gates','a-skip-through-ladder',
        'high-knee-a-march-ladder')
      AND definition.status<>'archived'
      AND source.legacy_exercise_id NOT IN(69,95,717,878,924,925,982,1117,1118,1590,1636,1637)
  ) THEN
    RAISE EXCEPTION '% requires exactly all 12 audited legacy A-series mappings',migration_key;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  WHERE definition.facility_id=1
    AND definition.slug IN(
      'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
      'a-skip-through-cone-gates','a-skip-through-ladder',
      'high-knee-a-march-ladder')
    AND definition.status<>'archived' AND variant.status<>'archived';
  IF actual_count<>7 OR EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    WHERE definition.facility_id=1
      AND definition.slug IN(
        'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
        'a-skip-through-cone-gates','a-skip-through-ladder',
        'high-knee-a-march-ladder')
      AND definition.status<>'archived' AND variant.status<>'archived'
      AND variant.variant_key<>'baseline'
  ) THEN
    RAISE EXCEPTION '% requires one active baseline variant per canonical definition',migration_key;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.facility_id=1
        AND definition.slug IN(
          'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
          'a-skip-through-cone-gates','a-skip-through-ladder',
          'high-knee-a-march-ladder')
        AND definition.status<>'archived'
        AND (definition.status='published' OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
          OR definition.approved_video_url IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_section_evidence_v1 evidence
        ON evidence.definition_id=definition.id
      WHERE definition.facility_id=1
        AND definition.slug IN(
          'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
          'a-skip-through-cone-gates','a-skip-through-ladder',
          'high-knee-a-march-ladder')
        AND evidence.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_media_candidate_v1 media
        ON media.definition_id=definition.id
      WHERE definition.facility_id=1
        AND definition.slug IN(
          'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
          'a-skip-through-cone-gates','a-skip-through-ladder',
          'high-knee-a-march-ladder')
        AND media.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_alternate_assessment_v1 alternate
        ON alternate.definition_id=definition.id
      WHERE definition.facility_id=1
        AND definition.slug IN(
          'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
          'a-skip-through-cone-gates','a-skip-through-ladder',
          'high-knee-a-march-ladder')
        AND alternate.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_card_review_v1 review ON review.definition_id=definition.id
      WHERE definition.facility_id=1
        AND definition.slug IN(
          'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
          'a-skip-through-cone-gates','a-skip-through-ladder',
          'high-knee-a-march-ladder'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_card_revision_v1 revision ON revision.definition_id=definition.id
      WHERE definition.facility_id=1
        AND definition.slug IN(
          'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
          'a-skip-through-cone-gates','a-skip-through-ladder',
          'high-knee-a-march-ladder'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_media_review_v1 review ON review.definition_id=definition.id
      WHERE definition.facility_id=1
        AND definition.slug IN(
          'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
          'a-skip-through-cone-gates','a-skip-through-ladder',
          'high-knee-a-march-ladder'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
      JOIN coaching.exercise_relationship_v1 relationship
        ON relationship.from_variant_id=variant.id OR relationship.to_variant_id=variant.id
      WHERE definition.facility_id=1
        AND definition.slug IN(
          'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
          'a-skip-through-cone-gates','a-skip-through-ladder',
          'high-knee-a-march-ladder')
        AND (relationship.review_status<>'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
      JOIN coaching.exercise_score_calibration_v1 calibration
        ON calibration.variant_id=variant.id
      WHERE definition.facility_id=1
        AND definition.slug IN(
          'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
          'a-skip-through-cone-gates','a-skip-through-ladder',
          'high-knee-a-march-ladder')
        AND (calibration.status<>'review' OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id IN(69,95,717,878,924,925,982,1117,1118,1590,1636,1637)
        AND (score.human_review_status<>'queued' OR score.reviewed_by IS NOT NULL
          OR score.reviewed_at IS NOT NULL))
  INTO protected_count;
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refused to overwrite % reviewed or published A-series record(s)',
      migration_key,protected_count;
  END IF;

  CREATE TEMP TABLE family_packet_seed(
    definition_slug TEXT PRIMARY KEY,
    research_version TEXT NOT NULL,
    packet_json JSONB NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO family_packet_seed VALUES
  -- BEGIN GENERATED CANONICAL RESEARCH PACKETS
    ('a-march','2026-07-25.9',$packet${"assessmentSummary":{"identity":"Traveling alternating no-flight A-march using deliberate single-support exchanges, a controlled thigh target, prepared ankle, contact close beneath the body, tall posture, and coordinated opposite arm action.","currentCardFindings":["The current description names hip actions but never defines contact sequence, thigh landmark, lane length, cadence, or whether the athlete pauses in single support.","A time-only 25-second dose can reward fatigue and repeated balance errors; distance and clean steps are more reproducible.","The generic difficulty value misses balance, arm-leg timing, and supervision but overstates physical loading."],"proposedTaxonomy":{"movementPatterns":["traveling_alternating_no_flight_a_march","single_support_sprint_mechanics"],"jointActions":["hip_flexion_extension","knee_flexion_extension","ankle_dorsiflexion_and_plantarflexion","contralateral_shoulder_flexion_extension"],"planes":["sagittal","frontal"],"laterality":"alternating_left_right","intent":"controlled_posture_contact_and_arm_leg_coordination_without_flight"},"proposedAnatomy":{"primaryMuscles":["hip_flexors","gluteus_maximus","hamstrings","soleus","tibialis_anterior"],"secondaryMuscles":["quadriceps","gastrocnemius","intrinsic_foot","gluteus_medius","obliques","shoulder_girdle"],"joints":["foot","ankle","knee","hip","lumbopelvic_complex","shoulder"]},"proposedDifficulty":{"technicalComplexity":36,"absoluteLoadDemand":10,"coordinationDemand":43,"supervisionDemand":27,"failureConsequence":18,"impact":10,"workCapacityDemand":18,"baseOverallDifficulty":36},"proposedLoadProfile":{"loadingType":"bodyweight_traveling_alternating_no_flight_march","impactClass":"low","landingContactsPerRep":"one_controlled_step_per_side; record_steps_or_distance","primaryStress":["single_leg_balance","hip_flexor_control","plantar_flexor_support","arm_leg_coordination"],"fatigueSensitivity":"posture_balance_thigh_target_contact_reach_and_arm_timing"},"proposedConstraints":{"requiredEquipment":["clear_level_10_to_20_metre_lane"],"optionalEquipment":["cones","floor_marks","video"],"environment":["dry_non_slip_surface","safe_finish_zone"],"population":["pain_free_walking","brief_single_leg_balance","can_follow_alternating_pattern"]},"proposedDosage":{"sets":"1-3","distancePerPass":"8-20_metres_or_6-12_steps_per_side","restSeconds":"walk_back_or_20-60","intensity":"controlled_learning_to_crisp_march","progressWhen":"posture, balance, contact placement, and opposite arm-leg timing remain repeatable"},"proposedInstructions":{"coachCues":["Stand tall","Lift to the assigned landmark","Step close beneath you","Opposite arm and leg"],"athleteInstructions":["March forward without flight, own each support, and keep the next contact close beneath your body"],"commonFaults":["turning_into_high_knee_running","overstriding","forced_forefoot","pelvic_drop","same_side_arm_leg","rushing"]},"proposedSafety":{"readiness":["pain_free_walk","safe_lane","controlled_single_support"],"stopRules":["pain","limp","repeated_balance_loss","reaching","posture_collapse","pattern_confusion"]},"programmingDecision":"Retain as the stable A-march identity. Consolidate A-March Linear as the same identity and treat ordinary arm-swing or mobility emphasis as coaching and dosage annotations.","currentCardSnapshot":{"capturedAt":"2026-07-26T04:35:00.000Z","cardVersion":1,"status":"review","description":"A-March is a sprint access & mechanics exercise for speed, sprinting, and quick-release athletes. It emphasizes hip flexion, hip extension, ankle dorsiflexion while keeping the session intent aligned with the Vortex phase sequence.","familyKey":"Sprint Drill Series","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":10,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A published running-drill test battery defines A-skip with observable arm action, thigh motion, support-leg behavior, contact location, foot direction, posture, and swing-path criteria.","A-March must state whether the task is a no-flight march, an alternating step-hop skip, a pogo skip, a constrained ladder or gate variant, or a compound transition; coaching words such as punch, snap, rhythm, projection, and mobility do not establish a separate identity."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint drills are commonly used as controllable, low-speed tasks for posture, limb configuration, rhythm, and proprioceptive emphasis, but their mechanics must resemble the intended target when transfer is claimed.","A-March belongs to no-flight alternating sprint-mechanics marching, alternating step-hop skipping, an external-spacing variant, or a separately defined compound progression; it is not itself sprinting, maximal-speed work, or a jump-height test."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/28632055/","sourceTitle":"Muscle activity in sprinting: a review","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Sprint muscle activity is phase-specific and distributed across lower-limb and trunk musculature rather than isolated to a single high-knee muscle action.","The card should identify hip flexors, gluteus maximus, hamstrings, quadriceps, soleus, gastrocnemius, tibialis anterior, intrinsic foot, frontal-plane pelvic stabilizers, trunk, and shoulder-girdle roles in proportion to the actual march, skip, or constraint."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8008308/","sourceTitle":"Kinematic Stride Characteristics of Maximal Sprint Running of Elite Sprinters – Verification of the Swing-Pull Technique","sourcePublisher":"Journal of Human Kinetics","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["During maximal sprinting, active foot velocity before contact, contact near the projected center of mass, hip-extension velocity, and controlled support-leg flexion can influence braking and contact behavior.","A march or skip can constrain posture, recovery, contact placement, and arm-leg timing, but visual similarity cannot prove sprint force, joint stiffness, or transfer; cue only observable execution of the drill."]},{"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8553457/","sourceTitle":"Application of Leg, Vertical, and Joint Stiffness in Running Performance: A Literature Overview","sourcePublisher":"Journal of Healthcare Engineering","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Whole-limb stiffness changes with task, speed, maturity, fatigue, and measurement method and cannot be inferred as a fixed quality from a drill label.","Exercise difficulty must directly score technical complexity, physical and absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty; athlete experience remains programming context."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8938535/","sourceTitle":"Effects of Plyometric Training on Lower Body Muscle Architecture, Tendon Structure, Stiffness and Physical Performance: A Systematic Review and Meta-analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Repeated flight contacts can contribute meaningful muscle-tendon loading even when external load and amplitude are low.","A-March needs pass distance, total and per-leg contacts, flight or no-flight status, surface, footwear, spacing constraint, cadence or intent, technical-fatigue markers, recovery, and weekly impact accounting rather than an unqualified repetition or work interval."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Linear-speed preparation requires suitable space, safe start and finish zones, progressive intensity, adequate recovery, and coaching matched to the intended movement quality.","Require a level, dry, non-slip lane, safe spacing and finish, suitable footwear, secured flat ladder or visible gates only when prescribed, and readiness for the contact amplitude and coordination actually used."]},{"sectionKey":"dosage","sourceUrl":"https://worldathletics.org/personal-best/performance/jereem-richards-games-drills-develop-speed","sourceTitle":"Jereem Richards’ games and drills to help develop speed","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":77,"claims":["World Athletics gives two passes over 10 to 20 metres as an example for progressive running drills and directs athletes to learn the movement before increasing cadence.","Use short passes, metres, explicit contacts, cadence or execution intent, and recovery; no-flight marches may use walk-back recovery, while skips and compound transitions need impact-aware volume and enough rest to preserve rhythm."]},{"sectionKey":"instructions","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Published A-skip criteria include relaxed arms and shoulders, coordinated arm action without excessive midline crossing, a defined thigh path, forward-facing feet, contact near the body's vertical projection, and completion of support-leg extension.","Use a small cue set: stay tall or use the explicitly assigned projection, lift to the assigned landmark, keep the ankle prepared without forcing the heel, step or skip close beneath the body, coordinate opposite arm and leg, and preserve the defined march or step-hop rhythm."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37989833/","sourceTitle":"Ankle and Plantar Flexor Muscle-Tendon Unit Function in Sprinters: A Narrative Review","sourcePublisher":"Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Foot and plantar-flexor demands differ across locomotor tasks and sprint phases, so repeated contacts should not be represented as uniformly negligible load.","Stop for foot, shin, calf, Achilles, hamstring, knee, hip, or back pain; limping; loss of balance; repeated reaching; forced or painful foot strike; loud contacts; cadence or posture loss; ladder contact; displaced equipment; or an unsafe finish."]},{"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["The study found good overall inter-rater reliability for its A-skip scoring criteria but no statistically significant association between A-skip score and 5 m or 20 m sprint performance in its sample.","A-March should be programmed as a fresh coordination, position, rhythm, or warm-up constraint with an explicit athlete-specific purpose; do not promise faster sprinting, better acceleration, jump height, or approach transfer from the drill alone."]},{"sectionKey":"athlete_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Clear, criterion-referenced movement elements make drill execution more observable than vague labels or outcome promises.","Show side and rear views, flight or no-flight contacts, thigh landmark, foot path, arm action, pass distance, gate or ladder pattern, finish, and one regression; explain that higher knees and faster feet are not automatically better."]},{"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A-skip ratings were more reliable for upper-extremity criteria than lower-extremity criteria, supporting explicit observation criteria and trained raters rather than a global visual impression.","Provide side and rear observation, pass and contact counts, left-right comparison, exact equipment spacing, optional slow-motion video, cue-response notes, and a distinction between a coached drill constraint and measured sprint biomechanics."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match readiness, technical competence, supervision, equipment scale, and the individual's physical and psychosocial context.","Accessibility options include in-place rehearsal, slower cadence, shorter passes, lower thigh target, marching instead of skipping, floor marks instead of a raised ladder, fewer contacts, longer recovery, quieter instruction, and additional demonstration."]},{"sectionKey":"alternates","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint drills should be selected for a specific limiting factor and should not be assumed to transfer merely because they isolate one visible feature.","Lane length, cadence, arm cue, thigh target, and sport context are delivery annotations; flight versus no flight, step-hop versus running, external spacing, resistance, support, and a terminal sprint can require controlled variants or distinct definitions."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The direct candidates for A-March were discovered through visible YouTube search; current availability and embedding, exact contact sequence and constraint, complete viewing, captions, instructional quality, safety, and approval remain separate review gates, and no candidate is approved by this packet."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=am3v2I1LxaM","title":"A March Drill","channelName":"KenClarkSpeed","sourceQuery":"A march sprint drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=2FgmKuOvKFs","title":"How to Perform the A March and Skip Running Drills","channelName":"Jason Curtis","sourceQuery":"A march sprint drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=zeQ_vRyB35Q","title":"Sprint Drills: A-March, Variations, & Teaching Points","channelName":"Brendan Thompson -- Speed & Physical Therapy","sourceQuery":"A march sprint drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=bISzKMBflPM","title":"A-March, A-Skip and A-Run","channelName":"Parisi Speed School","sourceQuery":"A march sprint drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=Vu3eqv9lSZw","title":"Sprint Drills A Walk, A Skip, B Walk, B Skip","channelName":"ATHLETE.X","sourceQuery":"A march sprint drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."}],"alternateAssessments":[{"name":"A-March Linear","classification":"same_identity","rationale":"Linear travel is already intrinsic to the base A-march described by both cards.","distinguishingDimensions":{"travelPath":"straight"}},{"name":"A-March with Arm-Swing Emphasis","classification":"modifier_annotation","rationale":"Normal reciprocal arm action is an execution criterion; changing cue emphasis does not change the exercise.","distinguishingDimensions":{"cueEmphasis":"arm_action"}},{"name":"Wall A-March","classification":"new_variant","rationale":"External support and projected posture materially change support, body angle, and logistics.","distinguishingDimensions":{"support":"wall","posture":"projected"}},{"name":"Resisted A-March","classification":"new_variant","rationale":"A band, cable, or sled changes external loading and force direction.","distinguishingDimensions":{"externalResistance":"present"}},{"name":"A-Skip","classification":"new_definition","rationale":"The alternating step-hop rhythm adds flight and repeated landing contacts.","distinguishingDimensions":{"contactSequence":"alternating_step_hop"}}]}$packet$::JSONB),
    ('a-march-to-projection','2026-07-25.9',$packet${"assessmentSummary":{"identity":"Unresolved compound label that may mean an A-march into forward lean, a wall-supported projection drill, a march-to-acceleration transition, or long-jump approach preparation.","currentCardFindings":["Neither description nor dosage defines the moment, direction, or body position of 'projection.'","The card uses distance-jump transfer language but contains no approach, takeoff, board, acceleration, or measured projection segment.","Two repetitions over ten seconds cannot be interpreted without march steps, transition action, projected contacts, finish, or lane distance."],"proposedTaxonomy":{"movementPatterns":["unresolved_a_march_compound","potential_projection_transition"],"jointActions":["unresolved_until_sequence_review"],"planes":["sagittal"],"laterality":"alternating_or_unresolved_terminal_contact","intent":"quarantined_pending_exact_projection_definition"},"proposedAnatomy":{"primaryMuscles":["hip_flexors","gluteus_maximus","hamstrings","plantar_flexors"],"secondaryMuscles":["quadriceps","tibialis_anterior","intrinsic_foot","trunk_stabilizers","shoulder_girdle"],"joints":["foot","ankle","knee","hip","lumbopelvic_complex","shoulder"]},"proposedDifficulty":{"technicalComplexity":55,"absoluteLoadDemand":18,"coordinationDemand":60,"supervisionDemand":50,"failureConsequence":40,"impact":20,"workCapacityDemand":24,"baseOverallDifficulty":55},"proposedLoadProfile":{"loadingType":"unresolved_bodyweight_march_to_projection_compound","impactClass":"unknown_until_terminal_action_defined","landingContactsPerRep":"cannot_prescribe_until_sequence_and_contacts_are_defined","primaryStress":["single_leg_support","postural_transition","potential_horizontal_force_orientation"],"fatigueSensitivity":"undefined_transition_timing_posture_contact_and_finish"},"proposedConstraints":{"requiredEquipment":["quarantine_until_lane_support_and_finish_are_defined"],"optionalEquipment":["wall_or_cones_only_after_identity_review","video"],"environment":["level_non_slip_surface","clear_deceleration_if_acceleration_occurs"],"population":["do_not_prescribe_before_identity_adjudication"]},"proposedDosage":{"sets":"not_prescribable","distancePerPass":"define_march_transition_projection_and_finish_segments_first","restSeconds":"derive_from_resolved_speed_and_contact_demand","intensity":"unresolved","progressWhen":"not_applicable_before_identity_review"},"proposedInstructions":{"coachCues":["Do not coach from the current label alone"],"athleteInstructions":["Await a card that shows the exact sequence, body angle, contacts, and finish"],"commonFaults":["silent_identity_substitution","mixing_wall_and_free_motion","claiming_long_jump_transfer","undefined_finish"]},"proposedSafety":{"readiness":["identity_and_media_adjudication_required"],"stopRules":["do_not_prescribe_current_card"]},"programmingDecision":"Quarantine. A human reviewer must choose one exact sequence. A march-to-sprint, wall projection, and long-jump-specific projection task require separate definitions or controlled variants.","currentCardSnapshot":{"capturedAt":"2026-07-26T04:35:00.000Z","cardVersion":1,"status":"review","description":"A-March to Projection addresses distance-jumping performance by targeting connects march rhythm to the projected body position used in long-jump approach acceleration. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.","familyKey":"Sprint mechanics progression","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A published running-drill test battery defines A-skip with observable arm action, thigh motion, support-leg behavior, contact location, foot direction, posture, and swing-path criteria.","A-March to Projection must state whether the task is a no-flight march, an alternating step-hop skip, a pogo skip, a constrained ladder or gate variant, or a compound transition; coaching words such as punch, snap, rhythm, projection, and mobility do not establish a separate identity."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint drills are commonly used as controllable, low-speed tasks for posture, limb configuration, rhythm, and proprioceptive emphasis, but their mechanics must resemble the intended target when transfer is claimed.","A-March to Projection belongs to no-flight alternating sprint-mechanics marching, alternating step-hop skipping, an external-spacing variant, or a separately defined compound progression; it is not itself sprinting, maximal-speed work, or a jump-height test."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/28632055/","sourceTitle":"Muscle activity in sprinting: a review","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Sprint muscle activity is phase-specific and distributed across lower-limb and trunk musculature rather than isolated to a single high-knee muscle action.","The card should identify hip flexors, gluteus maximus, hamstrings, quadriceps, soleus, gastrocnemius, tibialis anterior, intrinsic foot, frontal-plane pelvic stabilizers, trunk, and shoulder-girdle roles in proportion to the actual march, skip, or constraint."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8008308/","sourceTitle":"Kinematic Stride Characteristics of Maximal Sprint Running of Elite Sprinters – Verification of the Swing-Pull Technique","sourcePublisher":"Journal of Human Kinetics","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["During maximal sprinting, active foot velocity before contact, contact near the projected center of mass, hip-extension velocity, and controlled support-leg flexion can influence braking and contact behavior.","A march or skip can constrain posture, recovery, contact placement, and arm-leg timing, but visual similarity cannot prove sprint force, joint stiffness, or transfer; cue only observable execution of the drill."]},{"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8553457/","sourceTitle":"Application of Leg, Vertical, and Joint Stiffness in Running Performance: A Literature Overview","sourcePublisher":"Journal of Healthcare Engineering","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Whole-limb stiffness changes with task, speed, maturity, fatigue, and measurement method and cannot be inferred as a fixed quality from a drill label.","Exercise difficulty must directly score technical complexity, physical and absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty; athlete experience remains programming context."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8938535/","sourceTitle":"Effects of Plyometric Training on Lower Body Muscle Architecture, Tendon Structure, Stiffness and Physical Performance: A Systematic Review and Meta-analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Repeated flight contacts can contribute meaningful muscle-tendon loading even when external load and amplitude are low.","A-March to Projection needs pass distance, total and per-leg contacts, flight or no-flight status, surface, footwear, spacing constraint, cadence or intent, technical-fatigue markers, recovery, and weekly impact accounting rather than an unqualified repetition or work interval."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Linear-speed preparation requires suitable space, safe start and finish zones, progressive intensity, adequate recovery, and coaching matched to the intended movement quality.","Require a level, dry, non-slip lane, safe spacing and finish, suitable footwear, secured flat ladder or visible gates only when prescribed, and readiness for the contact amplitude and coordination actually used."]},{"sectionKey":"dosage","sourceUrl":"https://worldathletics.org/personal-best/performance/jereem-richards-games-drills-develop-speed","sourceTitle":"Jereem Richards’ games and drills to help develop speed","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":77,"claims":["World Athletics gives two passes over 10 to 20 metres as an example for progressive running drills and directs athletes to learn the movement before increasing cadence.","Use short passes, metres, explicit contacts, cadence or execution intent, and recovery; no-flight marches may use walk-back recovery, while skips and compound transitions need impact-aware volume and enough rest to preserve rhythm."]},{"sectionKey":"instructions","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Published A-skip criteria include relaxed arms and shoulders, coordinated arm action without excessive midline crossing, a defined thigh path, forward-facing feet, contact near the body's vertical projection, and completion of support-leg extension.","Use a small cue set: stay tall or use the explicitly assigned projection, lift to the assigned landmark, keep the ankle prepared without forcing the heel, step or skip close beneath the body, coordinate opposite arm and leg, and preserve the defined march or step-hop rhythm."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37989833/","sourceTitle":"Ankle and Plantar Flexor Muscle-Tendon Unit Function in Sprinters: A Narrative Review","sourcePublisher":"Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Foot and plantar-flexor demands differ across locomotor tasks and sprint phases, so repeated contacts should not be represented as uniformly negligible load.","Stop for foot, shin, calf, Achilles, hamstring, knee, hip, or back pain; limping; loss of balance; repeated reaching; forced or painful foot strike; loud contacts; cadence or posture loss; ladder contact; displaced equipment; or an unsafe finish."]},{"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["The study found good overall inter-rater reliability for its A-skip scoring criteria but no statistically significant association between A-skip score and 5 m or 20 m sprint performance in its sample.","A-March to Projection should be programmed as a fresh coordination, position, rhythm, or warm-up constraint with an explicit athlete-specific purpose; do not promise faster sprinting, better acceleration, jump height, or approach transfer from the drill alone."]},{"sectionKey":"athlete_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Clear, criterion-referenced movement elements make drill execution more observable than vague labels or outcome promises.","Show side and rear views, flight or no-flight contacts, thigh landmark, foot path, arm action, pass distance, gate or ladder pattern, finish, and one regression; explain that higher knees and faster feet are not automatically better."]},{"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A-skip ratings were more reliable for upper-extremity criteria than lower-extremity criteria, supporting explicit observation criteria and trained raters rather than a global visual impression.","Provide side and rear observation, pass and contact counts, left-right comparison, exact equipment spacing, optional slow-motion video, cue-response notes, and a distinction between a coached drill constraint and measured sprint biomechanics."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match readiness, technical competence, supervision, equipment scale, and the individual's physical and psychosocial context.","Accessibility options include in-place rehearsal, slower cadence, shorter passes, lower thigh target, marching instead of skipping, floor marks instead of a raised ladder, fewer contacts, longer recovery, quieter instruction, and additional demonstration."]},{"sectionKey":"alternates","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint drills should be selected for a specific limiting factor and should not be assumed to transfer merely because they isolate one visible feature.","Lane length, cadence, arm cue, thigh target, and sport context are delivery annotations; flight versus no flight, step-hop versus running, external spacing, resistance, support, and a terminal sprint can require controlled variants or distinct definitions."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The direct candidates for A-March to Projection were discovered through visible YouTube search; current availability and embedding, exact contact sequence and constraint, complete viewing, captions, instructional quality, safety, and approval remain separate review gates, and no candidate is approved by this packet."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=xjxaIFVLqco","title":"Acceleration - 5 Step Projection","channelName":"LJMU Performance Sport","sourceQuery":"A march to projection sprint drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=m0E3sqM4lcg","title":"A-March to A-Skip","channelName":"Elite Performance Academy - St. Louis","sourceQuery":"A march to projection sprint drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=am3v2I1LxaM","title":"A March Drill","channelName":"KenClarkSpeed","sourceQuery":"A march to projection sprint drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=IvXNw4B3lqI","title":"The key to acceleration is PROJECTION!","channelName":"ALTIS World","sourceQuery":"A march to projection sprint drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=zeQ_vRyB35Q","title":"Sprint Drills: A-March, Variations, & Teaching Points","channelName":"Brendan Thompson -- Speed & Physical Therapy","sourceQuery":"A march to projection sprint drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."}],"alternateAssessments":[{"name":"A-March","classification":"new_definition","rationale":"The base no-flight march has no terminal projection sequence.","distinguishingDimensions":{"terminalAction":"none"}},{"name":"Wall A-March","classification":"new_variant","rationale":"Wall support creates a defined projected posture and support condition.","distinguishingDimensions":{"support":"wall"}},{"name":"A-March to Sprint","classification":"new_definition","rationale":"A terminal sprint adds high-speed exposure, transition distance, and deceleration.","distinguishingDimensions":{"terminalAction":"sprint"}},{"name":"Five-Step Projection Drill","classification":"new_definition","rationale":"A defined acceleration projection task has different contacts and output than a march.","distinguishingDimensions":{"movementPattern":"acceleration_projection"}},{"name":"A-March to Projection","classification":"reject","rationale":"Reject the current unresolved label until the exact support, body angle, contact sequence, and finish are adjudicated.","distinguishingDimensions":{"identity":"unresolved"}}]}$packet$::JSONB),
    ('a-skip','2026-07-25.9',$packet${"assessmentSummary":{"identity":"Traveling alternating A-skip using a repeatable step-hop rhythm, brief flight, assigned thigh recovery, prepared ankle, contact near beneath the body, tall posture, and coordinated opposite arm action.","currentCardFindings":["The card names an elastic A-march progression but never defines the step-hop contact sequence that distinguishes skipping from marching or running.","A 20-second work interval can increase impact and degrade rhythm; distance and contacts per side are needed.","The generic difficulty score understates coordination and repeated-contact demands while its description overstates direct speed benefit."],"proposedTaxonomy":{"movementPatterns":["traveling_alternating_a_skip","alternating_step_hop_locomotion"],"jointActions":["hip_flexion_extension","knee_flexion_extension","ankle_dorsiflexion_and_plantarflexion","contralateral_arm_swing"],"planes":["sagittal","frontal"],"laterality":"alternating_left_right_step_hop","intent":"repeatable_rhythm_posture_contact_and_arm_leg_coordination_with_brief_flight"},"proposedAnatomy":{"primaryMuscles":["hip_flexors","gluteus_maximus","hamstrings","soleus","gastrocnemius"],"secondaryMuscles":["quadriceps","tibialis_anterior","intrinsic_foot","gluteus_medius","obliques","shoulder_girdle"],"joints":["foot","ankle","knee","hip","lumbopelvic_complex","shoulder"]},"proposedDifficulty":{"technicalComplexity":52,"absoluteLoadDemand":16,"coordinationDemand":62,"supervisionDemand":36,"failureConsequence":28,"impact":25,"workCapacityDemand":26,"baseOverallDifficulty":52},"proposedLoadProfile":{"loadingType":"bodyweight_traveling_alternating_step_hop","impactClass":"low_to_moderate_by_amplitude_surface_and_contacts","landingContactsPerRep":"record_total_and_per_side_step_hop_contacts","primaryStress":["foot_and_plantar_flexor_cyclic_load","hip_recovery","single_leg_coordination","arm_leg_rhythm"],"fatigueSensitivity":"rhythm_contact_sound_reach_posture_amplitude_and_relaxation"},"proposedConstraints":{"requiredEquipment":["clear_level_10_to_20_metre_lane","safe_finish_zone"],"optionalEquipment":["cones","video","cadence_feedback"],"environment":["dry_non_slip_forgiving_surface","no_cross_traffic"],"population":["pain_free_low_hop","owns_a_march","can_alternate_step_hop_rhythm"]},"proposedDosage":{"sets":"2-4_passes","distancePerPass":"10-20_metres_or_6-12_contacts_per_side","restSeconds":"walk_back_or_30-90","intensity":"controlled_to_crisp_submaximal","progressWhen":"step-hop rhythm, contact placement, posture, and relaxation remain stable"},"proposedInstructions":{"coachCues":["Step-hop and alternate","Lift to the assigned landmark","Contact close beneath you","Stay tall and relaxed"],"athleteInstructions":["Skip forward with the same step-hop rhythm on both sides and stop before contacts get loud or stretched"],"commonFaults":["turning_into_high_knee_run","same_leg_repetition","overstriding","forced_forefoot","excessive_vertical_bounce","arm_tension"]},"proposedSafety":{"readiness":["pain_free_low_hop","owns_no_flight_a_march","safe_lane"],"stopRules":["pain","limp","rhythm_loss","loud_contacts","reaching","asymmetry","unsafe_finish"]},"programmingDecision":"Retain as the stable traveling A-skip identity. Use it for an explicit coordination or rhythm purpose without promising sprint improvement; treat punch, snap-down, and approach wording as cue or context annotations unless contact sequence changes.","currentCardSnapshot":{"capturedAt":"2026-07-26T04:35:00.000Z","cardVersion":1,"status":"review","description":"A-Skip is a sprint access & mechanics exercise for speed, sprinting, and quick-release athletes. It emphasizes hip flexion, hip extension, ankle dorsiflexion while keeping the session intent aligned with the Vortex phase sequence.","familyKey":"Sprint Drill Series","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":10,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A published running-drill test battery defines A-skip with observable arm action, thigh motion, support-leg behavior, contact location, foot direction, posture, and swing-path criteria.","A-Skip must state whether the task is a no-flight march, an alternating step-hop skip, a pogo skip, a constrained ladder or gate variant, or a compound transition; coaching words such as punch, snap, rhythm, projection, and mobility do not establish a separate identity."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint drills are commonly used as controllable, low-speed tasks for posture, limb configuration, rhythm, and proprioceptive emphasis, but their mechanics must resemble the intended target when transfer is claimed.","A-Skip belongs to no-flight alternating sprint-mechanics marching, alternating step-hop skipping, an external-spacing variant, or a separately defined compound progression; it is not itself sprinting, maximal-speed work, or a jump-height test."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/28632055/","sourceTitle":"Muscle activity in sprinting: a review","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Sprint muscle activity is phase-specific and distributed across lower-limb and trunk musculature rather than isolated to a single high-knee muscle action.","The card should identify hip flexors, gluteus maximus, hamstrings, quadriceps, soleus, gastrocnemius, tibialis anterior, intrinsic foot, frontal-plane pelvic stabilizers, trunk, and shoulder-girdle roles in proportion to the actual march, skip, or constraint."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8008308/","sourceTitle":"Kinematic Stride Characteristics of Maximal Sprint Running of Elite Sprinters – Verification of the Swing-Pull Technique","sourcePublisher":"Journal of Human Kinetics","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["During maximal sprinting, active foot velocity before contact, contact near the projected center of mass, hip-extension velocity, and controlled support-leg flexion can influence braking and contact behavior.","A march or skip can constrain posture, recovery, contact placement, and arm-leg timing, but visual similarity cannot prove sprint force, joint stiffness, or transfer; cue only observable execution of the drill."]},{"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8553457/","sourceTitle":"Application of Leg, Vertical, and Joint Stiffness in Running Performance: A Literature Overview","sourcePublisher":"Journal of Healthcare Engineering","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Whole-limb stiffness changes with task, speed, maturity, fatigue, and measurement method and cannot be inferred as a fixed quality from a drill label.","Exercise difficulty must directly score technical complexity, physical and absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty; athlete experience remains programming context."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8938535/","sourceTitle":"Effects of Plyometric Training on Lower Body Muscle Architecture, Tendon Structure, Stiffness and Physical Performance: A Systematic Review and Meta-analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Repeated flight contacts can contribute meaningful muscle-tendon loading even when external load and amplitude are low.","A-Skip needs pass distance, total and per-leg contacts, flight or no-flight status, surface, footwear, spacing constraint, cadence or intent, technical-fatigue markers, recovery, and weekly impact accounting rather than an unqualified repetition or work interval."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Linear-speed preparation requires suitable space, safe start and finish zones, progressive intensity, adequate recovery, and coaching matched to the intended movement quality.","Require a level, dry, non-slip lane, safe spacing and finish, suitable footwear, secured flat ladder or visible gates only when prescribed, and readiness for the contact amplitude and coordination actually used."]},{"sectionKey":"dosage","sourceUrl":"https://worldathletics.org/personal-best/performance/jereem-richards-games-drills-develop-speed","sourceTitle":"Jereem Richards’ games and drills to help develop speed","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":77,"claims":["World Athletics gives two passes over 10 to 20 metres as an example for progressive running drills and directs athletes to learn the movement before increasing cadence.","Use short passes, metres, explicit contacts, cadence or execution intent, and recovery; no-flight marches may use walk-back recovery, while skips and compound transitions need impact-aware volume and enough rest to preserve rhythm."]},{"sectionKey":"instructions","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Published A-skip criteria include relaxed arms and shoulders, coordinated arm action without excessive midline crossing, a defined thigh path, forward-facing feet, contact near the body's vertical projection, and completion of support-leg extension.","Use a small cue set: stay tall or use the explicitly assigned projection, lift to the assigned landmark, keep the ankle prepared without forcing the heel, step or skip close beneath the body, coordinate opposite arm and leg, and preserve the defined march or step-hop rhythm."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37989833/","sourceTitle":"Ankle and Plantar Flexor Muscle-Tendon Unit Function in Sprinters: A Narrative Review","sourcePublisher":"Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Foot and plantar-flexor demands differ across locomotor tasks and sprint phases, so repeated contacts should not be represented as uniformly negligible load.","Stop for foot, shin, calf, Achilles, hamstring, knee, hip, or back pain; limping; loss of balance; repeated reaching; forced or painful foot strike; loud contacts; cadence or posture loss; ladder contact; displaced equipment; or an unsafe finish."]},{"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["The study found good overall inter-rater reliability for its A-skip scoring criteria but no statistically significant association between A-skip score and 5 m or 20 m sprint performance in its sample.","A-Skip should be programmed as a fresh coordination, position, rhythm, or warm-up constraint with an explicit athlete-specific purpose; do not promise faster sprinting, better acceleration, jump height, or approach transfer from the drill alone."]},{"sectionKey":"athlete_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Clear, criterion-referenced movement elements make drill execution more observable than vague labels or outcome promises.","Show side and rear views, flight or no-flight contacts, thigh landmark, foot path, arm action, pass distance, gate or ladder pattern, finish, and one regression; explain that higher knees and faster feet are not automatically better."]},{"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A-skip ratings were more reliable for upper-extremity criteria than lower-extremity criteria, supporting explicit observation criteria and trained raters rather than a global visual impression.","Provide side and rear observation, pass and contact counts, left-right comparison, exact equipment spacing, optional slow-motion video, cue-response notes, and a distinction between a coached drill constraint and measured sprint biomechanics."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match readiness, technical competence, supervision, equipment scale, and the individual's physical and psychosocial context.","Accessibility options include in-place rehearsal, slower cadence, shorter passes, lower thigh target, marching instead of skipping, floor marks instead of a raised ladder, fewer contacts, longer recovery, quieter instruction, and additional demonstration."]},{"sectionKey":"alternates","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint drills should be selected for a specific limiting factor and should not be assumed to transfer merely because they isolate one visible feature.","Lane length, cadence, arm cue, thigh target, and sport context are delivery annotations; flight versus no flight, step-hop versus running, external spacing, resistance, support, and a terminal sprint can require controlled variants or distinct definitions."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The direct candidates for A-Skip were discovered through visible YouTube search; current availability and embedding, exact contact sequence and constraint, complete viewing, captions, instructional quality, safety, and approval remain separate review gates, and no candidate is approved by this packet."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=0fz4tO3IDzU","title":"How To A Skip","channelName":"Chari Hawkins","sourceQuery":"A skip sprint drill technique","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=A7r6yCpmSrA","title":"How to Do A-Skip - B-Skip with Proper Form","channelName":"Runify","sourceQuery":"A skip sprint drill technique","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=xiYTMBLqp8c","title":"How To Get FASTER with DRILLS","channelName":"Noah Lyles, Olympian","sourceQuery":"A skip sprint drill technique","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=qwcDGGB392g","title":"How to Improve Your Running Technique in 60 Seconds | A-Skip Tutorial","channelName":"Matthew Alty","sourceQuery":"A skip sprint drill technique","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=Vu3eqv9lSZw","title":"Sprint Drills A Walk, A Skip, B Walk, B Skip","channelName":"ATHLETE.X","sourceQuery":"A skip sprint drill technique","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."}],"alternateAssessments":[{"name":"A-Skip Rhythm Punch","classification":"same_identity","rationale":"Knee punch and rhythm are cues for the same step-hop A-skip described by the current card.","distinguishingDimensions":{"cueEmphasis":"recovery_and_downstroke"}},{"name":"A-Skip Snap Down","classification":"same_identity","rationale":"A crisp downstroke is an execution cue unless a separate landing-and-hold action is specified.","distinguishingDimensions":{"cueEmphasis":"downstroke"}},{"name":"In-Place A-Skip","classification":"new_variant","rationale":"Removing travel changes spacing and projection while preserving the alternating step-hop pattern.","distinguishingDimensions":{"displacement":"stationary"}},{"name":"B-Skip","classification":"new_definition","rationale":"A deliberate lower-leg extension and recovery sequence changes the primary swing task.","distinguishingDimensions":{"movementPattern":"b_skip"}},{"name":"A-Run","classification":"new_definition","rationale":"Running contacts replace the step-hop skipping gait and materially increase cadence.","distinguishingDimensions":{"contactSequence":"running"}}]}$packet$::JSONB),
    ('a-skip-pogo-rhythm','2026-07-25.9',$packet${"assessmentSummary":{"identity":"Unresolved hybrid label that may mean an ordinary A-skip with springy contacts, a traveling pogo skip, or an A-skip with an extra same-leg pogo contact.","currentCardFindings":["The card never defines whether 'pogo' changes the A-skip contact sequence, amplitude, knee strategy, or number of contacts.","It is mislabeled as jump-height output despite no jump-height measurement and no defined maximal jump.","One repetition per set does not identify a pass, contact count, side, or terminal action."],"proposedTaxonomy":{"movementPatterns":["unresolved_a_skip_pogo_hybrid"],"jointActions":["requires_contact_sequence_adjudication"],"planes":["sagittal","frontal"],"laterality":"unresolved_alternating_or_repeated_same_leg","intent":"quarantined_until_pogo_and_skip_contacts_are_defined"},"proposedAnatomy":{"primaryMuscles":["soleus","gastrocnemius","intrinsic_foot","hip_flexors"],"secondaryMuscles":["hamstrings","quadriceps","gluteus_maximus","tibialis_anterior","gluteus_medius","trunk_stabilizers"],"joints":["foot","ankle","knee","hip","lumbopelvic_complex"]},"proposedDifficulty":{"technicalComplexity":62,"absoluteLoadDemand":22,"coordinationDemand":70,"supervisionDemand":52,"failureConsequence":42,"impact":36,"workCapacityDemand":30,"baseOverallDifficulty":62},"proposedLoadProfile":{"loadingType":"unresolved_repeated_contact_skip_or_pogo","impactClass":"unknown_until_contact_pattern_and_amplitude_are_defined","landingContactsPerRep":"not_prescribable_until_each_step_hop_or_pogo_contact_is_counted","primaryStress":["plantar_flexor_cyclic_force","foot_loading","single_leg_coordination"],"fatigueSensitivity":"contact_sequence_noise_amplitude_knee_strategy_and_asymmetry"},"proposedConstraints":{"requiredEquipment":["quarantine_until_lane_and_contact_pattern_are_defined"],"optionalEquipment":["contact_counter","video"],"environment":["level_forgiving_non_slip_surface"],"population":["do_not_prescribe_before_identity_adjudication"]},"proposedDosage":{"sets":"not_prescribable","contactsPerSet":"define_exact_contacts_and_per_side_volume_first","restSeconds":"derive_after_impact_classification","intensity":"unresolved","progressWhen":"not_applicable_before_identity_review"},"proposedInstructions":{"coachCues":["Do not substitute an ordinary A-skip or pogo from the title alone"],"athleteInstructions":["Await a demonstration that shows every contact in the sequence"],"commonFaults":["silent_contact_substitution","uncounted_impacts","jump_height_claim","one_rep_ambiguity"]},"proposedSafety":{"readiness":["identity_and_media_adjudication_required"],"stopRules":["do_not_prescribe_current_card"]},"programmingDecision":"Quarantine. If pogo is merely a springy-contact cue, merge into A-Skip. If the drill adds a distinct pogo-skip contact sequence, create a separately named definition with contact accounting.","currentCardSnapshot":{"capturedAt":"2026-07-26T04:35:00.000Z","cardVersion":1,"status":"review","description":"The athlete performs A-Skip Pogo Rhythm as a quality-first jump-height drill, emphasizing links front-side lift, elastic ground contact, and arm-leg rhythm so approach jumps stay coordinated.","familyKey":"Front-side rhythm stiffness","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":10,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A published running-drill test battery defines A-skip with observable arm action, thigh motion, support-leg behavior, contact location, foot direction, posture, and swing-path criteria.","A-Skip Pogo Rhythm must state whether the task is a no-flight march, an alternating step-hop skip, a pogo skip, a constrained ladder or gate variant, or a compound transition; coaching words such as punch, snap, rhythm, projection, and mobility do not establish a separate identity."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint drills are commonly used as controllable, low-speed tasks for posture, limb configuration, rhythm, and proprioceptive emphasis, but their mechanics must resemble the intended target when transfer is claimed.","A-Skip Pogo Rhythm belongs to no-flight alternating sprint-mechanics marching, alternating step-hop skipping, an external-spacing variant, or a separately defined compound progression; it is not itself sprinting, maximal-speed work, or a jump-height test."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/28632055/","sourceTitle":"Muscle activity in sprinting: a review","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Sprint muscle activity is phase-specific and distributed across lower-limb and trunk musculature rather than isolated to a single high-knee muscle action.","The card should identify hip flexors, gluteus maximus, hamstrings, quadriceps, soleus, gastrocnemius, tibialis anterior, intrinsic foot, frontal-plane pelvic stabilizers, trunk, and shoulder-girdle roles in proportion to the actual march, skip, or constraint."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8008308/","sourceTitle":"Kinematic Stride Characteristics of Maximal Sprint Running of Elite Sprinters – Verification of the Swing-Pull Technique","sourcePublisher":"Journal of Human Kinetics","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["During maximal sprinting, active foot velocity before contact, contact near the projected center of mass, hip-extension velocity, and controlled support-leg flexion can influence braking and contact behavior.","A march or skip can constrain posture, recovery, contact placement, and arm-leg timing, but visual similarity cannot prove sprint force, joint stiffness, or transfer; cue only observable execution of the drill."]},{"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8553457/","sourceTitle":"Application of Leg, Vertical, and Joint Stiffness in Running Performance: A Literature Overview","sourcePublisher":"Journal of Healthcare Engineering","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Whole-limb stiffness changes with task, speed, maturity, fatigue, and measurement method and cannot be inferred as a fixed quality from a drill label.","Exercise difficulty must directly score technical complexity, physical and absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty; athlete experience remains programming context."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8938535/","sourceTitle":"Effects of Plyometric Training on Lower Body Muscle Architecture, Tendon Structure, Stiffness and Physical Performance: A Systematic Review and Meta-analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Repeated flight contacts can contribute meaningful muscle-tendon loading even when external load and amplitude are low.","A-Skip Pogo Rhythm needs pass distance, total and per-leg contacts, flight or no-flight status, surface, footwear, spacing constraint, cadence or intent, technical-fatigue markers, recovery, and weekly impact accounting rather than an unqualified repetition or work interval."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Linear-speed preparation requires suitable space, safe start and finish zones, progressive intensity, adequate recovery, and coaching matched to the intended movement quality.","Require a level, dry, non-slip lane, safe spacing and finish, suitable footwear, secured flat ladder or visible gates only when prescribed, and readiness for the contact amplitude and coordination actually used."]},{"sectionKey":"dosage","sourceUrl":"https://worldathletics.org/personal-best/performance/jereem-richards-games-drills-develop-speed","sourceTitle":"Jereem Richards’ games and drills to help develop speed","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":77,"claims":["World Athletics gives two passes over 10 to 20 metres as an example for progressive running drills and directs athletes to learn the movement before increasing cadence.","Use short passes, metres, explicit contacts, cadence or execution intent, and recovery; no-flight marches may use walk-back recovery, while skips and compound transitions need impact-aware volume and enough rest to preserve rhythm."]},{"sectionKey":"instructions","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Published A-skip criteria include relaxed arms and shoulders, coordinated arm action without excessive midline crossing, a defined thigh path, forward-facing feet, contact near the body's vertical projection, and completion of support-leg extension.","Use a small cue set: stay tall or use the explicitly assigned projection, lift to the assigned landmark, keep the ankle prepared without forcing the heel, step or skip close beneath the body, coordinate opposite arm and leg, and preserve the defined march or step-hop rhythm."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37989833/","sourceTitle":"Ankle and Plantar Flexor Muscle-Tendon Unit Function in Sprinters: A Narrative Review","sourcePublisher":"Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Foot and plantar-flexor demands differ across locomotor tasks and sprint phases, so repeated contacts should not be represented as uniformly negligible load.","Stop for foot, shin, calf, Achilles, hamstring, knee, hip, or back pain; limping; loss of balance; repeated reaching; forced or painful foot strike; loud contacts; cadence or posture loss; ladder contact; displaced equipment; or an unsafe finish."]},{"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["The study found good overall inter-rater reliability for its A-skip scoring criteria but no statistically significant association between A-skip score and 5 m or 20 m sprint performance in its sample.","A-Skip Pogo Rhythm should be programmed as a fresh coordination, position, rhythm, or warm-up constraint with an explicit athlete-specific purpose; do not promise faster sprinting, better acceleration, jump height, or approach transfer from the drill alone."]},{"sectionKey":"athlete_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Clear, criterion-referenced movement elements make drill execution more observable than vague labels or outcome promises.","Show side and rear views, flight or no-flight contacts, thigh landmark, foot path, arm action, pass distance, gate or ladder pattern, finish, and one regression; explain that higher knees and faster feet are not automatically better."]},{"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A-skip ratings were more reliable for upper-extremity criteria than lower-extremity criteria, supporting explicit observation criteria and trained raters rather than a global visual impression.","Provide side and rear observation, pass and contact counts, left-right comparison, exact equipment spacing, optional slow-motion video, cue-response notes, and a distinction between a coached drill constraint and measured sprint biomechanics."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match readiness, technical competence, supervision, equipment scale, and the individual's physical and psychosocial context.","Accessibility options include in-place rehearsal, slower cadence, shorter passes, lower thigh target, marching instead of skipping, floor marks instead of a raised ladder, fewer contacts, longer recovery, quieter instruction, and additional demonstration."]},{"sectionKey":"alternates","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint drills should be selected for a specific limiting factor and should not be assumed to transfer merely because they isolate one visible feature.","Lane length, cadence, arm cue, thigh target, and sport context are delivery annotations; flight versus no flight, step-hop versus running, external spacing, resistance, support, and a terminal sprint can require controlled variants or distinct definitions."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The direct candidates for A-Skip Pogo Rhythm were discovered through visible YouTube search; current availability and embedding, exact contact sequence and constraint, complete viewing, captions, instructional quality, safety, and approval remain separate review gates, and no candidate is approved by this packet."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=hhHQ8iRhSOo","title":"Pogo Skips","channelName":"Matt Widule","sourceQuery":"A skip pogo rhythm drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=52Lt3EMmY4E","title":"Dynamic Warm-up: Pogo Skip","channelName":"EVO PT & Performance","sourceQuery":"A skip pogo rhythm drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=iKDQ9h_vtwA","title":"Pogo Jumps + Pogo Skips","channelName":"Parabolic Performance & Rehab","sourceQuery":"A skip pogo rhythm drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=9nUK3HA1UQ4","title":"A Skip (Rhythm) - Exercise Demo","channelName":"Strength Coach Nause","sourceQuery":"A skip pogo rhythm drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=-O9H15yVc8s","title":"A Skip","channelName":"ken whittier","sourceQuery":"A skip pogo rhythm drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."}],"alternateAssessments":[{"name":"A-Skip","classification":"same_identity","rationale":"Merge if pogo is only a cue for elastic A-skip contact.","distinguishingDimensions":{"pogoMeaning":"cue_only"}},{"name":"Pogo Skip","classification":"new_definition","rationale":"A separately defined pogo-skip gait can have a different knee strategy and contact sequence.","distinguishingDimensions":{"contactSequence":"pogo_skip"}},{"name":"A-Skip with Extra Same-Leg Pogo","classification":"new_definition","rationale":"An added same-leg contact changes rhythm, laterality, and impact dose.","distinguishingDimensions":{"contactSequence":"step_hop_plus_extra_pogo"}},{"name":"Low Pogo","classification":"new_definition","rationale":"Stationary bilateral repeated hops are not an alternating traveling skip.","distinguishingDimensions":{"laterality":"bilateral","displacement":"stationary"}},{"name":"A-Skip Pogo Rhythm","classification":"reject","rationale":"Reject the current hybrid until the exact contact sequence is visible and named.","distinguishingDimensions":{"identity":"unresolved"}}]}$packet$::JSONB),
    ('a-skip-through-cone-gates','2026-07-25.9',$packet${"assessmentSummary":{"identity":"Potential A-skip external-spacing variant using paired cones as visual gates, but the current card does not define whether one step-hop cycle, one contact, or one stride occurs at each gate.","currentCardFindings":["The route language and cut/turn quality gates are copied from change-of-direction work even though this is described as a straight A-skip.","Six to eight gates 'one skip stride apart' is not reproducible without a contact-to-gate rule and individual spacing procedure.","Visible search produced only one cone-associated A-skip-switch result; the current exact gate pattern lacks media support and remains unverified."],"proposedTaxonomy":{"movementPatterns":["traveling_alternating_a_skip","externally_spaced_linear_step_hop"],"jointActions":["hip_flexion_extension","knee_flexion_extension","ankle_dorsiflexion_and_plantarflexion","contralateral_arm_swing"],"planes":["sagittal","frontal"],"laterality":"alternating_left_right_step_hop","intent":"a_skip_rhythm_constrained_by_individually_spaced_visual_gates"},"proposedAnatomy":{"primaryMuscles":["hip_flexors","gluteus_maximus","hamstrings","soleus","gastrocnemius"],"secondaryMuscles":["quadriceps","tibialis_anterior","intrinsic_foot","gluteus_medius","trunk_stabilizers","shoulder_girdle"],"joints":["foot","ankle","knee","hip","lumbopelvic_complex","shoulder"]},"proposedDifficulty":{"technicalComplexity":60,"absoluteLoadDemand":18,"coordinationDemand":69,"supervisionDemand":46,"failureConsequence":36,"impact":27,"workCapacityDemand":28,"baseOverallDifficulty":60},"proposedLoadProfile":{"loadingType":"bodyweight_a_skip_with_external_spacing_constraint","impactClass":"low_to_moderate","landingContactsPerRep":"record_contacts_per_side_and_gate_count","primaryStress":["cyclic_foot_and_ankle_load","visual_spatial_coordination","step_hop_rhythm"],"fatigueSensitivity":"gate_reaching_missed_pattern_contact_noise_and_posture"},"proposedConstraints":{"requiredEquipment":["6_to_8_low_profile_cone_gates","clear_level_lane","safe_finish"],"optionalEquipment":["tape_measure","video"],"environment":["dry_non_slip_surface","cones_outside_foot_path"],"population":["owns_unconstrained_a_skip","can_process_visual_spacing_without_reaching"]},"proposedDosage":{"sets":"2-4_passes","gatesPerPass":"4-8_individually_spaced_gates","restSeconds":"45-90","intensity":"controlled_constraint_not_race","progressWhen":"the exact contact-to-gate rule is met without reaching or touching cones"},"proposedInstructions":{"coachCues":["Define the contact rule before starting","Keep the A-skip rhythm","Adjust the gates to the athlete","Do not reach for a gate"],"athleteInstructions":["Use the assigned step-hop contact at each gate and preserve posture rather than chasing the marker"],"commonFaults":["undefined_gate_rule","fixed_spacing_for_every_athlete","reaching","turning_into_run","cone_contact"]},"proposedSafety":{"readiness":["owns_a_skip","safe_gate_setup","clear_finish"],"stopRules":["pain","repeated_gate_miss","reaching","cone_contact","rhythm_loss","equipment_shift"]},"programmingDecision":"Retain only as a controlled external-spacing variant after human review defines one exact gate/contact pattern. Quarantine the current card until that pattern and exact-match media are confirmed.","currentCardSnapshot":{"capturedAt":"2026-07-26T04:35:00.000Z","cardVersion":1,"status":"review","description":"A-Skip Through Cone Gates is a cone-based athletic drill focused on front-side sprint mechanics and posture through visual gates. Use paired cones as 6-8 gates, each about one skip stride apart. It belongs in the library because it is easy to set up, easy to coach, and scalable from youth development to advanced field/court athletes.","familyKey":"Cone Sprint Mechanics","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":20,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A published running-drill test battery defines A-skip with observable arm action, thigh motion, support-leg behavior, contact location, foot direction, posture, and swing-path criteria.","A-Skip Through Cone Gates must state whether the task is a no-flight march, an alternating step-hop skip, a pogo skip, a constrained ladder or gate variant, or a compound transition; coaching words such as punch, snap, rhythm, projection, and mobility do not establish a separate identity."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint drills are commonly used as controllable, low-speed tasks for posture, limb configuration, rhythm, and proprioceptive emphasis, but their mechanics must resemble the intended target when transfer is claimed.","A-Skip Through Cone Gates belongs to no-flight alternating sprint-mechanics marching, alternating step-hop skipping, an external-spacing variant, or a separately defined compound progression; it is not itself sprinting, maximal-speed work, or a jump-height test."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/28632055/","sourceTitle":"Muscle activity in sprinting: a review","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Sprint muscle activity is phase-specific and distributed across lower-limb and trunk musculature rather than isolated to a single high-knee muscle action.","The card should identify hip flexors, gluteus maximus, hamstrings, quadriceps, soleus, gastrocnemius, tibialis anterior, intrinsic foot, frontal-plane pelvic stabilizers, trunk, and shoulder-girdle roles in proportion to the actual march, skip, or constraint."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8008308/","sourceTitle":"Kinematic Stride Characteristics of Maximal Sprint Running of Elite Sprinters – Verification of the Swing-Pull Technique","sourcePublisher":"Journal of Human Kinetics","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["During maximal sprinting, active foot velocity before contact, contact near the projected center of mass, hip-extension velocity, and controlled support-leg flexion can influence braking and contact behavior.","A march or skip can constrain posture, recovery, contact placement, and arm-leg timing, but visual similarity cannot prove sprint force, joint stiffness, or transfer; cue only observable execution of the drill."]},{"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8553457/","sourceTitle":"Application of Leg, Vertical, and Joint Stiffness in Running Performance: A Literature Overview","sourcePublisher":"Journal of Healthcare Engineering","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Whole-limb stiffness changes with task, speed, maturity, fatigue, and measurement method and cannot be inferred as a fixed quality from a drill label.","Exercise difficulty must directly score technical complexity, physical and absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty; athlete experience remains programming context."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8938535/","sourceTitle":"Effects of Plyometric Training on Lower Body Muscle Architecture, Tendon Structure, Stiffness and Physical Performance: A Systematic Review and Meta-analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Repeated flight contacts can contribute meaningful muscle-tendon loading even when external load and amplitude are low.","A-Skip Through Cone Gates needs pass distance, total and per-leg contacts, flight or no-flight status, surface, footwear, spacing constraint, cadence or intent, technical-fatigue markers, recovery, and weekly impact accounting rather than an unqualified repetition or work interval."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Linear-speed preparation requires suitable space, safe start and finish zones, progressive intensity, adequate recovery, and coaching matched to the intended movement quality.","Require a level, dry, non-slip lane, safe spacing and finish, suitable footwear, secured flat ladder or visible gates only when prescribed, and readiness for the contact amplitude and coordination actually used."]},{"sectionKey":"dosage","sourceUrl":"https://worldathletics.org/personal-best/performance/jereem-richards-games-drills-develop-speed","sourceTitle":"Jereem Richards’ games and drills to help develop speed","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":77,"claims":["World Athletics gives two passes over 10 to 20 metres as an example for progressive running drills and directs athletes to learn the movement before increasing cadence.","Use short passes, metres, explicit contacts, cadence or execution intent, and recovery; no-flight marches may use walk-back recovery, while skips and compound transitions need impact-aware volume and enough rest to preserve rhythm."]},{"sectionKey":"instructions","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Published A-skip criteria include relaxed arms and shoulders, coordinated arm action without excessive midline crossing, a defined thigh path, forward-facing feet, contact near the body's vertical projection, and completion of support-leg extension.","Use a small cue set: stay tall or use the explicitly assigned projection, lift to the assigned landmark, keep the ankle prepared without forcing the heel, step or skip close beneath the body, coordinate opposite arm and leg, and preserve the defined march or step-hop rhythm."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37989833/","sourceTitle":"Ankle and Plantar Flexor Muscle-Tendon Unit Function in Sprinters: A Narrative Review","sourcePublisher":"Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Foot and plantar-flexor demands differ across locomotor tasks and sprint phases, so repeated contacts should not be represented as uniformly negligible load.","Stop for foot, shin, calf, Achilles, hamstring, knee, hip, or back pain; limping; loss of balance; repeated reaching; forced or painful foot strike; loud contacts; cadence or posture loss; ladder contact; displaced equipment; or an unsafe finish."]},{"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["The study found good overall inter-rater reliability for its A-skip scoring criteria but no statistically significant association between A-skip score and 5 m or 20 m sprint performance in its sample.","A-Skip Through Cone Gates should be programmed as a fresh coordination, position, rhythm, or warm-up constraint with an explicit athlete-specific purpose; do not promise faster sprinting, better acceleration, jump height, or approach transfer from the drill alone."]},{"sectionKey":"athlete_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Clear, criterion-referenced movement elements make drill execution more observable than vague labels or outcome promises.","Show side and rear views, flight or no-flight contacts, thigh landmark, foot path, arm action, pass distance, gate or ladder pattern, finish, and one regression; explain that higher knees and faster feet are not automatically better."]},{"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A-skip ratings were more reliable for upper-extremity criteria than lower-extremity criteria, supporting explicit observation criteria and trained raters rather than a global visual impression.","Provide side and rear observation, pass and contact counts, left-right comparison, exact equipment spacing, optional slow-motion video, cue-response notes, and a distinction between a coached drill constraint and measured sprint biomechanics."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match readiness, technical competence, supervision, equipment scale, and the individual's physical and psychosocial context.","Accessibility options include in-place rehearsal, slower cadence, shorter passes, lower thigh target, marching instead of skipping, floor marks instead of a raised ladder, fewer contacts, longer recovery, quieter instruction, and additional demonstration."]},{"sectionKey":"alternates","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint drills should be selected for a specific limiting factor and should not be assumed to transfer merely because they isolate one visible feature.","Lane length, cadence, arm cue, thigh target, and sport context are delivery annotations; flight versus no flight, step-hop versus running, external spacing, resistance, support, and a terminal sprint can require controlled variants or distinct definitions."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The direct candidates for A-Skip Through Cone Gates were discovered through visible YouTube search; current availability and embedding, exact contact sequence and constraint, complete viewing, captions, instructional quality, safety, and approval remain separate review gates, and no candidate is approved by this packet."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=hZiFM3ydfxc","title":"A-Skip Switch- 3 Cone","channelName":"Coach Migs","sourceQuery":"A skip cone gates drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=0fz4tO3IDzU","title":"How To A Skip","channelName":"Chari Hawkins","sourceQuery":"A skip cone gates drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=A7r6yCpmSrA","title":"How to Do A-Skip - B-Skip with Proper Form","channelName":"Runify","sourceQuery":"A skip cone gates drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=qwcDGGB392g","title":"How to Improve Your Running Technique in 60 Seconds | A-Skip Tutorial","channelName":"Matthew Alty","sourceQuery":"A skip cone gates drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=aSDyoraNOZc","title":"A skip, B skip, C skip for running drills","channelName":"The Running PTs","sourceQuery":"A skip cone gates drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."}],"alternateAssessments":[{"name":"A-Skip","classification":"new_variant","rationale":"The gate version adds a meaningful external spacing constraint to the base identity.","distinguishingDimensions":{"externalConstraint":"none_vs_gates"}},{"name":"A-Skip Switch at Three Cones","classification":"new_definition","rationale":"A discrete switch sequence at markers may differ from continuous step-hop A-skip and needs its own contact definition.","distinguishingDimensions":{"contactSequence":"discrete_switch"}},{"name":"A-Skip Through Ladder","classification":"new_variant","rationale":"A ladder provides different cell geometry and trip logistics than cone gates.","distinguishingDimensions":{"externalConstraint":"ladder"}},{"name":"Wicket Run","classification":"new_definition","rationale":"Running over progressively spaced wickets uses running contacts, not an A-skip gait.","distinguishingDimensions":{"movementPattern":"running"}},{"name":"Gate Spacing Adjustment","classification":"modifier_annotation","rationale":"Individual gate distance is dosage within the defined gate variant.","distinguishingDimensions":{"spacing":"individualized"}}]}$packet$::JSONB),
    ('a-skip-through-ladder','2026-07-25.9',$packet${"assessmentSummary":{"identity":"Traveling A-skip constrained by a flat ladder, provisionally one complete assigned step-hop contact pattern per cell; the current card does not define the cell pattern.","currentCardFindings":["The ladder is treated as generic precision equipment, but one-in, two-in, and hop patterns are materially different.","Two repetitions and 15 work seconds do not state passes, contacts, cells, or lead-side balance.","The card needs ladder anchoring, trip stop rules, finish distance, and a floor-mark regression."],"proposedTaxonomy":{"movementPatterns":["traveling_alternating_a_skip","ladder_constrained_step_hop"],"jointActions":["hip_flexion_extension","knee_flexion_extension","ankle_dorsiflexion_and_plantarflexion","contralateral_arm_swing"],"planes":["sagittal","frontal"],"laterality":"alternating_left_right_step_hop","intent":"precise_a_skip_contact_pattern_through_flat_ladder_cells"},"proposedAnatomy":{"primaryMuscles":["hip_flexors","gluteus_maximus","hamstrings","soleus","gastrocnemius"],"secondaryMuscles":["quadriceps","tibialis_anterior","intrinsic_foot","gluteus_medius","trunk_stabilizers","shoulder_girdle"],"joints":["foot","ankle","knee","hip","lumbopelvic_complex","shoulder"]},"proposedDifficulty":{"technicalComplexity":63,"absoluteLoadDemand":18,"coordinationDemand":72,"supervisionDemand":51,"failureConsequence":43,"impact":26,"workCapacityDemand":29,"baseOverallDifficulty":63},"proposedLoadProfile":{"loadingType":"bodyweight_a_skip_with_ladder_spacing_constraint","impactClass":"low_to_moderate","landingContactsPerRep":"record_ladder_cells_and_contacts_per_side","primaryStress":["cyclic_foot_and_ankle_load","visual_spatial_precision","step_hop_coordination"],"fatigueSensitivity":"cell_misses_ladder_contact_reaching_rhythm_and_posture"},"proposedConstraints":{"requiredEquipment":["secured_flat_ladder_or_taped_cells","clear_entry_and_finish"],"optionalEquipment":["video","cell_markers"],"environment":["dry_non_slip_surface","ladder_flat_without_raised_rungs"],"population":["owns_unconstrained_a_skip","can_stop_after_ladder","adequate_visual_processing"]},"proposedDosage":{"sets":"2-4_passes","cellsPerPass":"6-12_with_one_defined_pattern","restSeconds":"45-90","intensity":"precision_before_speed","progressWhen":"the athlete completes the assigned pattern without rung contact, reaching, or posture loss"},"proposedInstructions":{"coachCues":["State one pattern","Skip through, do not shuffle","Place contacts inside the assigned cells","Run out or stop only as prescribed"],"athleteInstructions":["Use the same A-skip rhythm through each assigned cell and step around a rung rather than on it"],"commonFaults":["undefined_cell_pattern","quick_feet_shuffle","rung_contact","reaching","watching_feet_excessively","unsafe_finish"]},"proposedSafety":{"readiness":["owns_a_skip","ladder_secured","clear_finish"],"stopRules":["pain","rung_contact","ladder_shift","repeated_cell_miss","rhythm_loss","unsafe_deceleration"]},"programmingDecision":"Retain as an external-constraint variant only after one exact cell/contact pattern is selected. Use taped floor cells as the default lower-trip-risk regression and do not treat faster completion as sprint speed.","currentCardSnapshot":{"capturedAt":"2026-07-26T04:35:00.000Z","cardVersion":1,"status":"review","description":"A-Skip Through Ladder is a ladder-focused exercise for skip rhythm, elastic foot strike, and coordinated arm-leg timing.","familyKey":"Sprint mechanics ladder","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":20,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A published running-drill test battery defines A-skip with observable arm action, thigh motion, support-leg behavior, contact location, foot direction, posture, and swing-path criteria.","A-Skip Through Ladder must state whether the task is a no-flight march, an alternating step-hop skip, a pogo skip, a constrained ladder or gate variant, or a compound transition; coaching words such as punch, snap, rhythm, projection, and mobility do not establish a separate identity."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint drills are commonly used as controllable, low-speed tasks for posture, limb configuration, rhythm, and proprioceptive emphasis, but their mechanics must resemble the intended target when transfer is claimed.","A-Skip Through Ladder belongs to no-flight alternating sprint-mechanics marching, alternating step-hop skipping, an external-spacing variant, or a separately defined compound progression; it is not itself sprinting, maximal-speed work, or a jump-height test."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/28632055/","sourceTitle":"Muscle activity in sprinting: a review","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Sprint muscle activity is phase-specific and distributed across lower-limb and trunk musculature rather than isolated to a single high-knee muscle action.","The card should identify hip flexors, gluteus maximus, hamstrings, quadriceps, soleus, gastrocnemius, tibialis anterior, intrinsic foot, frontal-plane pelvic stabilizers, trunk, and shoulder-girdle roles in proportion to the actual march, skip, or constraint."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8008308/","sourceTitle":"Kinematic Stride Characteristics of Maximal Sprint Running of Elite Sprinters – Verification of the Swing-Pull Technique","sourcePublisher":"Journal of Human Kinetics","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["During maximal sprinting, active foot velocity before contact, contact near the projected center of mass, hip-extension velocity, and controlled support-leg flexion can influence braking and contact behavior.","A march or skip can constrain posture, recovery, contact placement, and arm-leg timing, but visual similarity cannot prove sprint force, joint stiffness, or transfer; cue only observable execution of the drill."]},{"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8553457/","sourceTitle":"Application of Leg, Vertical, and Joint Stiffness in Running Performance: A Literature Overview","sourcePublisher":"Journal of Healthcare Engineering","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Whole-limb stiffness changes with task, speed, maturity, fatigue, and measurement method and cannot be inferred as a fixed quality from a drill label.","Exercise difficulty must directly score technical complexity, physical and absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty; athlete experience remains programming context."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8938535/","sourceTitle":"Effects of Plyometric Training on Lower Body Muscle Architecture, Tendon Structure, Stiffness and Physical Performance: A Systematic Review and Meta-analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Repeated flight contacts can contribute meaningful muscle-tendon loading even when external load and amplitude are low.","A-Skip Through Ladder needs pass distance, total and per-leg contacts, flight or no-flight status, surface, footwear, spacing constraint, cadence or intent, technical-fatigue markers, recovery, and weekly impact accounting rather than an unqualified repetition or work interval."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Linear-speed preparation requires suitable space, safe start and finish zones, progressive intensity, adequate recovery, and coaching matched to the intended movement quality.","Require a level, dry, non-slip lane, safe spacing and finish, suitable footwear, secured flat ladder or visible gates only when prescribed, and readiness for the contact amplitude and coordination actually used."]},{"sectionKey":"dosage","sourceUrl":"https://worldathletics.org/personal-best/performance/jereem-richards-games-drills-develop-speed","sourceTitle":"Jereem Richards’ games and drills to help develop speed","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":77,"claims":["World Athletics gives two passes over 10 to 20 metres as an example for progressive running drills and directs athletes to learn the movement before increasing cadence.","Use short passes, metres, explicit contacts, cadence or execution intent, and recovery; no-flight marches may use walk-back recovery, while skips and compound transitions need impact-aware volume and enough rest to preserve rhythm."]},{"sectionKey":"instructions","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Published A-skip criteria include relaxed arms and shoulders, coordinated arm action without excessive midline crossing, a defined thigh path, forward-facing feet, contact near the body's vertical projection, and completion of support-leg extension.","Use a small cue set: stay tall or use the explicitly assigned projection, lift to the assigned landmark, keep the ankle prepared without forcing the heel, step or skip close beneath the body, coordinate opposite arm and leg, and preserve the defined march or step-hop rhythm."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37989833/","sourceTitle":"Ankle and Plantar Flexor Muscle-Tendon Unit Function in Sprinters: A Narrative Review","sourcePublisher":"Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Foot and plantar-flexor demands differ across locomotor tasks and sprint phases, so repeated contacts should not be represented as uniformly negligible load.","Stop for foot, shin, calf, Achilles, hamstring, knee, hip, or back pain; limping; loss of balance; repeated reaching; forced or painful foot strike; loud contacts; cadence or posture loss; ladder contact; displaced equipment; or an unsafe finish."]},{"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["The study found good overall inter-rater reliability for its A-skip scoring criteria but no statistically significant association between A-skip score and 5 m or 20 m sprint performance in its sample.","A-Skip Through Ladder should be programmed as a fresh coordination, position, rhythm, or warm-up constraint with an explicit athlete-specific purpose; do not promise faster sprinting, better acceleration, jump height, or approach transfer from the drill alone."]},{"sectionKey":"athlete_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Clear, criterion-referenced movement elements make drill execution more observable than vague labels or outcome promises.","Show side and rear views, flight or no-flight contacts, thigh landmark, foot path, arm action, pass distance, gate or ladder pattern, finish, and one regression; explain that higher knees and faster feet are not automatically better."]},{"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A-skip ratings were more reliable for upper-extremity criteria than lower-extremity criteria, supporting explicit observation criteria and trained raters rather than a global visual impression.","Provide side and rear observation, pass and contact counts, left-right comparison, exact equipment spacing, optional slow-motion video, cue-response notes, and a distinction between a coached drill constraint and measured sprint biomechanics."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match readiness, technical competence, supervision, equipment scale, and the individual's physical and psychosocial context.","Accessibility options include in-place rehearsal, slower cadence, shorter passes, lower thigh target, marching instead of skipping, floor marks instead of a raised ladder, fewer contacts, longer recovery, quieter instruction, and additional demonstration."]},{"sectionKey":"alternates","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint drills should be selected for a specific limiting factor and should not be assumed to transfer merely because they isolate one visible feature.","Lane length, cadence, arm cue, thigh target, and sport context are delivery annotations; flight versus no flight, step-hop versus running, external spacing, resistance, support, and a terminal sprint can require controlled variants or distinct definitions."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The direct candidates for A-Skip Through Ladder were discovered through visible YouTube search; current availability and embedding, exact contact sequence and constraint, complete viewing, captions, instructional quality, safety, and approval remain separate review gates, and no candidate is approved by this packet."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=0fAH2f44vFI","title":"A-Skip on an Agility Ladder","channelName":"smartmovesfitnesscom","sourceQuery":"A skip agility ladder sprint mechanics","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=I02XNINO9go","title":"Agility Ladder Drill - A-Skip in Ladder","channelName":"BPC Performance Coaching","sourceQuery":"A skip ladder drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=oLiNq0M712k","title":"Agility Ladder Drill - Skip","channelName":"BPC Performance Coaching","sourceQuery":"A skip ladder drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=ON2HO3rlLcA","title":"Quick Skips Ladder Drill","channelName":"Jackie Ansley","sourceQuery":"A skip ladder drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=DU8QgQPjg78","title":"Ladder Drills - Skips","channelName":"Next level Speed & Agility","sourceQuery":"A skip ladder drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."}],"alternateAssessments":[{"name":"A-Skip","classification":"new_variant","rationale":"The ladder adds a cell-spacing and trip constraint.","distinguishingDimensions":{"externalConstraint":"ladder"}},{"name":"One-Cell A-Skip","classification":"modifier_annotation","rationale":"One defined step-hop cycle per cell is a dosage pattern within the ladder variant.","distinguishingDimensions":{"cellPattern":"one_cycle_per_cell"}},{"name":"Quick Skips Ladder","classification":"new_definition","rationale":"A fast bilateral or alternating quick-skip pattern may not preserve A-skip contacts and needs separate adjudication.","distinguishingDimensions":{"contactSequence":"quick_skip_unresolved"}},{"name":"Crossover Skip Ladder","classification":"new_definition","rationale":"Lateral crossover contacts change plane and limb path.","distinguishingDimensions":{"plane":"frontal_transverse"}},{"name":"Taped A-Skip Cells","classification":"modifier_annotation","rationale":"Flat tape marks preserve spacing while reducing rung-trip risk.","distinguishingDimensions":{"equipment":"taped_floor_marks"}}]}$packet$::JSONB),
    ('high-knee-a-march-ladder','2026-07-25.9',$packet${"assessmentSummary":{"identity":"Unresolved ladder task that may be a no-flight high-knee A-march, a one-foot-per-cell high-knee run, or a two-contact-per-cell ladder run.","currentCardFindings":["The title says march, but most visible search results labeled high-knee ladder show running contacts; the current card never states flight or cell contacts.","The difficulty score of 30 understates the visual-spatial, balance, supervision, and trip demands of a ladder constraint.","Two repetitions and 15 work seconds omit cells, contacts per side, lead-side order, ladder anchoring, and finish behavior."],"proposedTaxonomy":{"movementPatterns":["unresolved_high_knee_ladder_locomotion"],"jointActions":["hip_flexion_extension","knee_flexion_extension","ankle_dorsiflexion_and_plantarflexion"],"planes":["sagittal","frontal"],"laterality":"alternating_left_right","intent":"quarantined_until_flight_and_cell_pattern_are_defined"},"proposedAnatomy":{"primaryMuscles":["hip_flexors","gluteus_maximus","hamstrings","soleus","gastrocnemius"],"secondaryMuscles":["quadriceps","tibialis_anterior","intrinsic_foot","gluteus_medius","trunk_stabilizers","shoulder_girdle"],"joints":["foot","ankle","knee","hip","lumbopelvic_complex","shoulder"]},"proposedDifficulty":{"technicalComplexity":59,"absoluteLoadDemand":16,"coordinationDemand":67,"supervisionDemand":53,"failureConsequence":45,"impact":22,"workCapacityDemand":27,"baseOverallDifficulty":59},"proposedLoadProfile":{"loadingType":"unresolved_march_or_run_with_ladder_constraint","impactClass":"low_if_no_flight_to_moderate_if_running","landingContactsPerRep":"define_cells_contacts_per_cell_flight_and_contacts_per_side","primaryStress":["hip_recovery","visual_spatial_coordination","single_leg_support_or_running_contacts"],"fatigueSensitivity":"rung_contact_cell_miss_posture_reach_and_cadence"},"proposedConstraints":{"requiredEquipment":["secured_flat_ladder_or_taped_cells","clear_finish"],"optionalEquipment":["video","cell_markers"],"environment":["dry_non_slip_surface","ladder_flat"],"population":["do_not_prescribe_until_contact_pattern_is_selected"]},"proposedDosage":{"sets":"not_prescribable_until_identity_resolution","cellsPerPass":"define_exact_cell_and_contact_pattern","restSeconds":"derive_from_march_or_run_intensity","intensity":"unresolved","progressWhen":"not_applicable_before_identity_review"},"proposedInstructions":{"coachCues":["State march or run","State contacts per cell","Secure the ladder","Define the finish"],"athleteInstructions":["Do not begin until you know whether there is flight and exactly where each foot contacts"],"commonFaults":["march_run_substitution","undefined_cell_pattern","rung_contact","reaching","quick_feet_race"]},"proposedSafety":{"readiness":["identity_resolution","secured_ladder","clear_finish"],"stopRules":["do_not_prescribe_current_card","rung_contact","ladder_shift"]},"programmingDecision":"Quarantine. If no flight and one alternating controlled contact per cell are confirmed, retain as an A-march ladder variant. If running contacts are intended, rename and define a separate High-Knee Ladder Run.","currentCardSnapshot":{"capturedAt":"2026-07-26T04:35:00.000Z","cardVersion":1,"status":"review","description":"High-Knee A-March Ladder is a ladder-focused exercise for march timing, knee lift, ankle dorsiflexion, and tall sprint posture.","familyKey":"Sprint mechanics ladder","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":10,"coordinationDemand":30,"technicalComplexity":30,"baseOverallDifficulty":30},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A published running-drill test battery defines A-skip with observable arm action, thigh motion, support-leg behavior, contact location, foot direction, posture, and swing-path criteria.","High-Knee A-March Ladder must state whether the task is a no-flight march, an alternating step-hop skip, a pogo skip, a constrained ladder or gate variant, or a compound transition; coaching words such as punch, snap, rhythm, projection, and mobility do not establish a separate identity."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint drills are commonly used as controllable, low-speed tasks for posture, limb configuration, rhythm, and proprioceptive emphasis, but their mechanics must resemble the intended target when transfer is claimed.","High-Knee A-March Ladder belongs to no-flight alternating sprint-mechanics marching, alternating step-hop skipping, an external-spacing variant, or a separately defined compound progression; it is not itself sprinting, maximal-speed work, or a jump-height test."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/28632055/","sourceTitle":"Muscle activity in sprinting: a review","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Sprint muscle activity is phase-specific and distributed across lower-limb and trunk musculature rather than isolated to a single high-knee muscle action.","The card should identify hip flexors, gluteus maximus, hamstrings, quadriceps, soleus, gastrocnemius, tibialis anterior, intrinsic foot, frontal-plane pelvic stabilizers, trunk, and shoulder-girdle roles in proportion to the actual march, skip, or constraint."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8008308/","sourceTitle":"Kinematic Stride Characteristics of Maximal Sprint Running of Elite Sprinters – Verification of the Swing-Pull Technique","sourcePublisher":"Journal of Human Kinetics","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["During maximal sprinting, active foot velocity before contact, contact near the projected center of mass, hip-extension velocity, and controlled support-leg flexion can influence braking and contact behavior.","A march or skip can constrain posture, recovery, contact placement, and arm-leg timing, but visual similarity cannot prove sprint force, joint stiffness, or transfer; cue only observable execution of the drill."]},{"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8553457/","sourceTitle":"Application of Leg, Vertical, and Joint Stiffness in Running Performance: A Literature Overview","sourcePublisher":"Journal of Healthcare Engineering","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Whole-limb stiffness changes with task, speed, maturity, fatigue, and measurement method and cannot be inferred as a fixed quality from a drill label.","Exercise difficulty must directly score technical complexity, physical and absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty; athlete experience remains programming context."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8938535/","sourceTitle":"Effects of Plyometric Training on Lower Body Muscle Architecture, Tendon Structure, Stiffness and Physical Performance: A Systematic Review and Meta-analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Repeated flight contacts can contribute meaningful muscle-tendon loading even when external load and amplitude are low.","High-Knee A-March Ladder needs pass distance, total and per-leg contacts, flight or no-flight status, surface, footwear, spacing constraint, cadence or intent, technical-fatigue markers, recovery, and weekly impact accounting rather than an unqualified repetition or work interval."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Linear-speed preparation requires suitable space, safe start and finish zones, progressive intensity, adequate recovery, and coaching matched to the intended movement quality.","Require a level, dry, non-slip lane, safe spacing and finish, suitable footwear, secured flat ladder or visible gates only when prescribed, and readiness for the contact amplitude and coordination actually used."]},{"sectionKey":"dosage","sourceUrl":"https://worldathletics.org/personal-best/performance/jereem-richards-games-drills-develop-speed","sourceTitle":"Jereem Richards’ games and drills to help develop speed","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":77,"claims":["World Athletics gives two passes over 10 to 20 metres as an example for progressive running drills and directs athletes to learn the movement before increasing cadence.","Use short passes, metres, explicit contacts, cadence or execution intent, and recovery; no-flight marches may use walk-back recovery, while skips and compound transitions need impact-aware volume and enough rest to preserve rhythm."]},{"sectionKey":"instructions","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Published A-skip criteria include relaxed arms and shoulders, coordinated arm action without excessive midline crossing, a defined thigh path, forward-facing feet, contact near the body's vertical projection, and completion of support-leg extension.","Use a small cue set: stay tall or use the explicitly assigned projection, lift to the assigned landmark, keep the ankle prepared without forcing the heel, step or skip close beneath the body, coordinate opposite arm and leg, and preserve the defined march or step-hop rhythm."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37989833/","sourceTitle":"Ankle and Plantar Flexor Muscle-Tendon Unit Function in Sprinters: A Narrative Review","sourcePublisher":"Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Foot and plantar-flexor demands differ across locomotor tasks and sprint phases, so repeated contacts should not be represented as uniformly negligible load.","Stop for foot, shin, calf, Achilles, hamstring, knee, hip, or back pain; limping; loss of balance; repeated reaching; forced or painful foot strike; loud contacts; cadence or posture loss; ladder contact; displaced equipment; or an unsafe finish."]},{"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["The study found good overall inter-rater reliability for its A-skip scoring criteria but no statistically significant association between A-skip score and 5 m or 20 m sprint performance in its sample.","High-Knee A-March Ladder should be programmed as a fresh coordination, position, rhythm, or warm-up constraint with an explicit athlete-specific purpose; do not promise faster sprinting, better acceleration, jump height, or approach transfer from the drill alone."]},{"sectionKey":"athlete_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Clear, criterion-referenced movement elements make drill execution more observable than vague labels or outcome promises.","Show side and rear views, flight or no-flight contacts, thigh landmark, foot path, arm action, pass distance, gate or ladder pattern, finish, and one regression; explain that higher knees and faster feet are not automatically better."]},{"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A-skip ratings were more reliable for upper-extremity criteria than lower-extremity criteria, supporting explicit observation criteria and trained raters rather than a global visual impression.","Provide side and rear observation, pass and contact counts, left-right comparison, exact equipment spacing, optional slow-motion video, cue-response notes, and a distinction between a coached drill constraint and measured sprint biomechanics."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match readiness, technical competence, supervision, equipment scale, and the individual's physical and psychosocial context.","Accessibility options include in-place rehearsal, slower cadence, shorter passes, lower thigh target, marching instead of skipping, floor marks instead of a raised ladder, fewer contacts, longer recovery, quieter instruction, and additional demonstration."]},{"sectionKey":"alternates","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint drills should be selected for a specific limiting factor and should not be assumed to transfer merely because they isolate one visible feature.","Lane length, cadence, arm cue, thigh target, and sport context are delivery annotations; flight versus no flight, step-hop versus running, external spacing, resistance, support, and a terminal sprint can require controlled variants or distinct definitions."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The direct candidates for High-Knee A-March Ladder were discovered through visible YouTube search; current availability and embedding, exact contact sequence and constraint, complete viewing, captions, instructional quality, safety, and approval remain separate review gates, and no candidate is approved by this packet."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=v_TxtFHT2DU","title":"High Knee Drill (Ladder)","channelName":"CoachNate - Higher Level Performance","sourceQuery":"high knee A march ladder drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=M2Cwt3Z-_ok","title":"High Knees Drill on an Agility Ladder","channelName":"smartmovesfitnesscom","sourceQuery":"high knee A march ladder drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=0uNKUw3LnQY","title":"Agility Ladder Training- High Knees","channelName":"TrainWith LH","sourceQuery":"high knee A march ladder drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=knZBLBIBsak","title":"Ladder Drills - High Knees","channelName":"Torrance Training Lab","sourceQuery":"high knee A march ladder drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=K0gwRQQ_uMk","title":"Agility Ladder High Knees One Step Drill","channelName":"Live Lean TV Daily Exercises","sourceQuery":"high knee A march ladder drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."}],"alternateAssessments":[{"name":"A-March Through Ladder","classification":"new_variant","rationale":"A defined no-flight A-march pattern with ladder cells is a controlled variant.","distinguishingDimensions":{"flight":"none","externalConstraint":"ladder"}},{"name":"High-Knee Ladder Run One-In","classification":"new_definition","rationale":"Running flight and one contact per cell create a different locomotor pattern.","distinguishingDimensions":{"contactSequence":"running_one_in"}},{"name":"High-Knee Ladder Run Two-In","classification":"new_definition","rationale":"Two running contacts per cell change cadence and spatial demand.","distinguishingDimensions":{"contactSequence":"running_two_in"}},{"name":"High-Knee A-March without Ladder","classification":"same_identity","rationale":"If the high-knee target is within the base A-march range, height wording alone is dosage.","distinguishingDimensions":{"externalConstraint":"none"}},{"name":"High-Knee A-March Ladder","classification":"reject","rationale":"Reject the current card until flight and contacts per cell are resolved.","distinguishingDimensions":{"identity":"unresolved"}}]}$packet$::JSONB);
  -- END GENERATED CANONICAL RESEARCH PACKETS

  UPDATE coaching.exercise_definition_v1 definition
  SET description=packet.packet_json#>>'{assessmentSummary,identity}',
    family_key='a_series_sprint_drills',
    card_version=CASE WHEN already_applied_count=0
      THEN definition.card_version+1 ELSE definition.card_version END,
    status='review',
    content_confidence=CASE
      WHEN definition.slug IN('a-march','a-skip') THEN 78
      WHEN definition.slug IN('a-skip-through-cone-gates','a-skip-through-ladder') THEN 68
      ELSE 52 END,
    scoring_confidence=CASE
      WHEN definition.slug IN('a-march','a-skip') THEN 65
      WHEN definition.slug IN('a-skip-through-cone-gates','a-skip-through-ladder') THEN 58
      ELSE 50 END,
    media_confidence=20,
    movement_patterns=ARRAY(
      SELECT jsonb_array_elements_text(
        packet.packet_json#>'{assessmentSummary,proposedTaxonomy,movementPatterns}')),
    body_regions=ARRAY(
      SELECT jsonb_array_elements_text(
        packet.packet_json#>'{assessmentSummary,proposedAnatomy,joints}')),
    required_equipment=ARRAY(
      SELECT jsonb_array_elements_text(
        packet.packet_json#>'{assessmentSummary,proposedConstraints,requiredEquipment}')),
    optional_equipment=ARRAY(
      SELECT jsonb_array_elements_text(
        packet.packet_json#>'{assessmentSummary,proposedConstraints,optionalEquipment}')),
    anatomy_json=jsonb_build_object(
      'primaryMusclesAndTissues',
        packet.packet_json#>'{assessmentSummary,proposedAnatomy,primaryMuscles}',
      'secondaryMusclesAndTissues',
        packet.packet_json#>'{assessmentSummary,proposedAnatomy,secondaryMuscles}',
      'joints',packet.packet_json#>'{assessmentSummary,proposedAnatomy,joints}',
      'actions',packet.packet_json#>'{assessmentSummary,proposedTaxonomy,jointActions}',
      'planes',packet.packet_json#>'{assessmentSummary,proposedTaxonomy,planes}',
      'laterality',packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,laterality}',
      'intent',packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,intent}'),
    environment_json=jsonb_build_object(
      'requirements',
        packet.packet_json#>'{assessmentSummary,proposedConstraints,environment}',
      'surfacePolicy','dry_level_non_slip_surface_with_clear_entry_and_finish',
      'trafficPolicy','one_directional_lane_without_cross_traffic',
      'weatherPolicy','reduce_or_replace_when_traction_visibility_or_spacing_is_unreliable',
      'humanReviewRequired',TRUE),
    population_json=jsonb_build_object(
      'selectionStatus','candidate_requires_human_review',
      'readinessChecks',
        packet.packet_json#>'{assessmentSummary,proposedConstraints,population}',
      'structurallyPrescribable',definition.slug IN('a-march','a-skip'),
      'identitySequenceResolved',definition.slug IN('a-march','a-skip'),
      'constraints',jsonb_build_array(
        'scale_from_current_readiness_and_movement_competence',
        'pain_symptoms_surface_lane_and_fatigue_override_the_planned_dose',
        'do_not_infer_athlete_proficiency_from_exercise_difficulty'),
      'contraindications',jsonb_build_array(
        'sharp_or_increasing_pain','limp_or_repeated_balance_loss',
        'unsafe_surface_lane_finish_or_equipment',
        'inability_to_follow_the_declared_contact_sequence')),
    athlete_support_json=jsonb_build_object(
      'plainLanguageSummary',
        packet.packet_json#>'{assessmentSummary,proposedInstructions,athleteInstructions}',
      'setupChecklist',jsonb_build_array(
        'confirm_lane_equipment_contact_pattern_and_finish',
        'rehearse_the_pattern_below_training_speed',
        'confirm_the_stop_signal_and_safe_exit'),
      'cues',packet.packet_json#>'{assessmentSummary,proposedInstructions,coachCues}',
      'expectedSensations',packet.packet_json#>'{assessmentSummary,proposedLoadProfile,primaryStress}',
      'stopSignals',packet.packet_json#>'{assessmentSummary,proposedSafety,stopRules}',
      'readinessChecks',packet.packet_json#>'{assessmentSummary,proposedSafety,readiness}',
      'feedbackPrompt','Was the declared contact pattern clear and repeatable without pain, reaching, rushing, balance loss, or unsafe equipment contact?',
      'accessibilityOptions',jsonb_build_array(
        'shorter_lane_or_fewer_contacts','slower_cadence','larger_visual_targets',
        'taped_flat_floor_marks_instead_of_raised_equipment','preplanned_pattern',
        'longer_recovery','live_written_still_image_or_video_instruction')),
    coach_support_json=jsonb_build_object(
      'identityContract',packet.packet_json#>>'{assessmentSummary,identity}',
      'programmingDecision',
        packet.packet_json#>>'{assessmentSummary,programmingDecision}',
      'coachCues',packet.packet_json#>'{assessmentSummary,proposedInstructions,coachCues}',
      'commonFaults',packet.packet_json#>'{assessmentSummary,proposedInstructions,commonFaults}',
      'qualityGate',packet.packet_json#>>'{assessmentSummary,proposedDosage,progressWhen}',
      'stopRules',packet.packet_json#>'{assessmentSummary,proposedSafety,stopRules}',
      'observationPlan',jsonb_build_array(
        'front_or_rear_view_for_lane_and_frontal_control',
        'side_view_for_posture_contact_location_and_unintended_flight',
        'first_to_last_contact_comparison_for_fatigue_drift'),
      'cumulativeBudgetWarnings',jsonb_build_array(
        'count_every_landing_contact_and_each_side',
        'count_prior_sprinting_jumping_pogo_and_lower_leg_exposure',
        'do_not_turn_coordination_practice_into_conditioning'),
      'escalation',jsonb_build_object(
        'clinical','stop_and_refer_when_pain_neurologic_symptoms_or_limp_persist',
        'emergency','follow_facility_emergency_plan_for_acute_injury_or_collapse')),
    support_operations_json=jsonb_build_object(
      'stationType','one_directional_sprint_drill_lane',
      'requiredEquipment',
        packet.packet_json#>'{assessmentSummary,proposedConstraints,requiredEquipment}',
      'optionalEquipment',
        packet.packet_json#>'{assessmentSummary,proposedConstraints,optionalEquipment}',
      'environment',
        packet.packet_json#>'{assessmentSummary,proposedConstraints,environment}',
      'dosage',packet.packet_json#>'{assessmentSummary,proposedDosage}',
      'contactAccounting',
        packet.packet_json#>>'{assessmentSummary,proposedLoadProfile,landingContactsPerRep}',
      'structuralSelectionAllowed',definition.slug IN('a-march','a-skip'),
      'selectionBlockReason',CASE
        WHEN definition.slug IN('a-march','a-skip') THEN NULL
        ELSE packet.packet_json#>>'{assessmentSummary,programmingDecision}' END,
      'groupFlow',jsonb_build_object(
        'oneAthletePerLane',TRUE,'staggeredStarts',TRUE,
        'clearFinishBeforeNextStart',TRUE,
        'coachMustSeeEquipmentAndFinish',TRUE),
      'recording',jsonb_build_array(
        'selected_identity_or_context_profile','distance_or_declared_contacts_per_side',
        'contact_pattern','equipment_spacing','rest','quality_failures','symptoms'),
      'humanReviewRequired',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    provenance_json=definition.provenance_json||jsonb_build_object(
      'researchCompletionMigration',migration_key,
      'researchBatch',research_batch,
      'researchVersion',packet.research_version,
      'auditedSourceSlugs',jsonb_build_array(
        'a-march','a-march-linear','a-march-mobility-with-arm-sweep',
        'a-march-to-projection','a-skip','a-skip-pogo-rhythm',
        'a-skip-rhythm-punch','a-skip-snap-down',
        'a-skip-through-cone-gates','a-skip-through-ladder',
        'a-skip-for-approach-rhythm','high-knee-a-march-ladder'),
      'identityAuthorityMigrations',jsonb_build_array(
        '385_coaching_score_77_identity_boundaries',
        '394_coaching_score_73_variant_identity_consolidations',migration_key),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'evidenceState','candidate_requires_human_review',
      'mediaState','public_candidates_unverified_and_non_embeddable',
      'humanReviewRequired',TRUE,'publicationQuarantined',TRUE,
      'cardApprovalCreated',FALSE,'mediaApprovalCreated',FALSE,
      'graphApprovalCreated',FALSE,'calibrationApprovalCreated',FALSE),
    updated_at=now()
  FROM family_packet_seed packet
  WHERE definition.facility_id=1
    AND definition.slug=packet.definition_slug
    AND definition.status<>'archived';

  UPDATE coaching.exercise_variant_v1 variant
  SET difficulty_json=packet.packet_json#>'{assessmentSummary,proposedDifficulty}',
    requirements_json=jsonb_build_object(
      'requiredEquipment',
        packet.packet_json#>'{assessmentSummary,proposedConstraints,requiredEquipment}',
      'optionalEquipment',
        packet.packet_json#>'{assessmentSummary,proposedConstraints,optionalEquipment}',
      'environment',
        packet.packet_json#>'{assessmentSummary,proposedConstraints,environment}',
      'population',
        packet.packet_json#>'{assessmentSummary,proposedConstraints,population}',
      'readiness',packet.packet_json#>'{assessmentSummary,proposedSafety,readiness}',
      'structurallySelectable',definition.slug IN('a-march','a-skip'),
      'identitySequenceResolved',definition.slug IN('a-march','a-skip'),
      'selectionBlockReason',CASE
        WHEN definition.slug IN('a-march','a-skip') THEN NULL
        ELSE packet.packet_json#>>'{assessmentSummary,programmingDecision}' END,
      'humanReviewRequired',TRUE),
    load_profile_json=(packet.packet_json#>'{assessmentSummary,proposedLoadProfile}')
      ||jsonb_build_object(
        'loadSource','bodyweight_and_declared_external_constraints',
        'contactBudgetRequired',TRUE,'humanReviewRequired',TRUE),
    fatigue_profile_json=jsonb_build_object(
      'fatigueSensitivity',
        packet.packet_json#>>'{assessmentSummary,proposedLoadProfile,fatigueSensitivity}',
      'primaryStress',
        packet.packet_json#>'{assessmentSummary,proposedLoadProfile,primaryStress}',
      'impactClass',
        packet.packet_json#>>'{assessmentSummary,proposedLoadProfile,impactClass}',
      'monitor',packet.packet_json#>'{assessmentSummary,proposedInstructions,commonFaults}',
      'stopRules',packet.packet_json#>'{assessmentSummary,proposedSafety,stopRules}',
      'recoveryEvidenceState','no_universal_recovery_interval_established',
      'recoveryDecisionInputs',jsonb_build_array(
        'total_contacts','prior_sprinting_and_jumping','surface_and_footwear',
        'lower_leg_symptoms','coordination_drift','next_session_demand'),
      'humanReviewRequired',TRUE),
    programming_profile_json=jsonb_build_object(
      'intent',packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,intent}',
      'dosage',packet.packet_json#>'{assessmentSummary,proposedDosage}',
      'qualityGate',
        packet.packet_json#>>'{assessmentSummary,proposedDosage,progressWhen}',
      'overallDifficulty',
        (packet.packet_json#>>'{assessmentSummary,proposedDifficulty,baseOverallDifficulty}')::SMALLINT,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'structurallySelectable',definition.slug IN('a-march','a-skip'),
      'programmingDecision',
        packet.packet_json#>>'{assessmentSummary,programmingDecision}',
      'humanReviewRequired',TRUE),
    status='review',updated_at=now()
  FROM coaching.exercise_definition_v1 definition,family_packet_seed packet
  WHERE variant.definition_id=definition.id
    AND definition.facility_id=1 AND definition.slug=packet.definition_slug
    AND definition.status<>'archived' AND variant.status<>'archived'
    AND variant.variant_key='baseline';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET role=CASE
      WHEN definition.slug NOT IN('a-march','a-skip') THEN 'avoid'
      WHEN profile.phase_key='movement_intelligence' THEN 'primary'
      ELSE 'secondary' END,
    purpose=CASE
      WHEN definition.slug IN('a-march','a-skip')
        THEN packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,intent}'
      ELSE 'Quarantined pending exact identity, contact sequence, equipment, and finish adjudication.' END,
    phase_suitability=CASE
      WHEN definition.slug NOT IN('a-march','a-skip') THEN 1
      WHEN profile.phase_key='movement_intelligence' THEN 84 ELSE 70 END,
    methodology_alignment=CASE
      WHEN definition.slug NOT IN('a-march','a-skip') THEN 1 ELSE 82 END,
    objective_relevance_json=jsonb_build_object(
      'intent',packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,intent}',
      'movementPatterns',
        packet.packet_json#>'{assessmentSummary,proposedTaxonomy,movementPatterns}',
      'identitySequenceResolved',definition.slug IN('a-march','a-skip'),
      'humanReviewRequired',TRUE),
    dosage_json=packet.packet_json#>'{assessmentSummary,proposedDosage}',
    quality_gate=coalesce(
      packet.packet_json#>>'{assessmentSummary,proposedDosage,progressWhen}',
      packet.packet_json#>>'{assessmentSummary,programmingDecision}'),
    stop_rules=ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedSafety,stopRules}')),
    coach_instructions=array_to_string(ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedInstructions,coachCues}')),'; '),
    athlete_instructions=array_to_string(ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedInstructions,athleteInstructions}')),' '),
    expected_adaptation=packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,intent}',
    equipment_required=ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedConstraints,requiredEquipment}')),
    logistics_json=jsonb_build_object(
      'environment',packet.packet_json#>'{assessmentSummary,proposedConstraints,environment}',
      'contactAccounting',
        packet.packet_json#>>'{assessmentSummary,proposedLoadProfile,landingContactsPerRep}',
      'oneAthletePerLane',TRUE,'staggeredStarts',TRUE,
      'clearFinishBeforeNextStart',TRUE,
      'structurallySelectable',definition.slug IN('a-march','a-skip')),
    time_model_json=CASE
      WHEN definition.slug='a-march' THEN jsonb_build_object(
        'setupSeconds',60,'workSecondsPerPass',35,'transitionSeconds',15,
        'restSecondsPerPass',45,'estimateConfidence','candidate')
      WHEN definition.slug='a-skip' THEN jsonb_build_object(
        'setupSeconds',60,'workSecondsPerPass',30,'transitionSeconds',15,
        'restSecondsPerPass',60,'estimateConfidence','candidate')
      ELSE jsonb_build_object('prescribable',FALSE,
        'reason','identity_and_contact_sequence_unresolved') END,
    dose_scaling_json=jsonb_build_object(
      'dimensions',jsonb_build_array(
        'distance_or_contacts','cadence','amplitude','external_constraint','rest'),
      'progressOneDimensionAtATime',TRUE,
      'preserveQualityBeforeVolume',TRUE),
    measurement_json=jsonb_build_object(
      'primary','declared_distance_or_clean_contacts_per_side',
      'secondary',jsonb_build_array(
        'contact_pattern_accuracy','posture','contact_location','rhythm','symptoms'),
      'failedContactsExcluded',TRUE),
    support_prompts_json=jsonb_build_object(
      'before','Confirm the exact pattern, lane, finish, dose, and stop signal.',
      'during','Watch contact order, posture, contact location, equipment clearance, and fatigue drift.',
      'after','Record clean contacts or distance, failures, symptoms, and the selected context profile.'),
    status='review',updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  JOIN family_packet_seed packet ON packet.definition_slug=definition.slug
  WHERE profile.variant_id=variant.id AND definition.facility_id=1
    AND definition.status<>'archived' AND variant.status<>'archived';

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT variant.id,seed.profile_key,seed.phase_key,'conditional',seed.purpose,
    seed.suitability,seed.alignment,seed.objective_json,seed.dosage_json,
    seed.quality_gate,seed.stop_rules,seed.coach_instructions,
    seed.athlete_instructions,seed.expected_adaptation,seed.equipment_required,
    seed.logistics_json,'{}'::UUID[],'review',seed.time_model_json,
    seed.dose_scaling_json,seed.measurement_json,seed.support_prompts_json
  FROM (VALUES
    ('a-march','arm-sweep-mobility-context','prepare_and_access',
      'Low-cadence A-march delivery with reciprocal arm-action emphasis; it is not a separate exercise identity.',
      70::SMALLINT,78::SMALLINT,
      '{"context":"low_cadence_arm_action_emphasis","identityUnchanged":true,"humanReviewRequired":true}'::JSONB,
      '{"sets":"1-2","distancePerPass":"6-15_metres_or_5-10_steps_per_side","restSeconds":"20-60","intensity":"slow_to_smooth"}'::JSONB,
      'Arm action, breathing, balance, posture, and contact placement remain relaxed and repeatable without flight.',
      ARRAY['pain','limp','repeated_balance_loss','forced_shoulder_range','posture_collapse','pattern_confusion']::TEXT[],
      'Keep the A-march contact contract unchanged; use an easy cadence and observe whether the arm cue improves relaxation rather than adding a new movement sequence.',
      'March without flight, stay tall, and let opposite arm and leg move smoothly.',
      'Controlled no-flight A-march coordination with arm-action cue emphasis.',
      ARRAY['clear_level_lane']::TEXT[],
      '{"adequateArmClearance":true,"oneAthletePerLane":true,"clearFinish":true}'::JSONB,
      '{"setupSeconds":45,"workSecondsPerPass":30,"transitionSeconds":15,"restSecondsPerPass":40,"estimateConfidence":"candidate"}'::JSONB,
      '{"dimensions":["cadence","distance","arm_cue","rest"],"progressOneDimensionAtATime":true}'::JSONB,
      '{"primary":"clean_steps_per_side_or_distance","secondary":["arm_leg_timing","relaxation","balance"]}'::JSONB,
      '{"before":"Confirm a clear lane and comfortable shoulder motion.","during":"Watch balance, posture, breathing, and reciprocal arm action.","after":"Record clean steps, symptoms, and whether the cue helped."}'::JSONB),
    ('a-skip','rhythm-punch-cue','movement_intelligence',
      'Ordinary A-skip delivered with rhythm and active-downstroke cue emphasis; no extra contact is added.',
      78::SMALLINT,80::SMALLINT,
      '{"context":"rhythm_and_active_downstroke_cue","identityUnchanged":true,"humanReviewRequired":true}'::JSONB,
      '{"sets":"2-4_passes","distancePerPass":"10-20_metres_or_6-12_contacts_per_side","restSeconds":"30-90","intensity":"crisp_submaximal"}'::JSONB,
      'The cue improves step-hop rhythm and contact location without adding tension, amplitude, reach, or an extra contact.',
      ARRAY['pain','limp','rhythm_loss','reaching','posture_collapse','unintended_extra_contact']::TEXT[],
      'Keep ordinary A-skip contact accounting; cue rhythm and a compact downstroke without promising strength, power, or sprint transfer.',
      'Keep the step-hop rhythm and place each contact close beneath you.',
      'A-skip coordination with a declared cue emphasis.',
      ARRAY['clear_level_lane','safe_finish_zone']::TEXT[],
      '{"oneAthletePerLane":true,"staggeredStarts":true,"clearFinish":true}'::JSONB,
      '{"setupSeconds":45,"workSecondsPerPass":30,"transitionSeconds":15,"restSecondsPerPass":60,"estimateConfidence":"candidate"}'::JSONB,
      '{"dimensions":["contacts","distance","cadence","cue","rest"],"progressOneDimensionAtATime":true}'::JSONB,
      '{"primary":"clean_contacts_per_side_or_distance","secondary":["rhythm","contact_location","relaxation"]}'::JSONB,
      '{"before":"Confirm ordinary A-skip contact order.","during":"Stop if the cue creates reaching, tension, or an extra contact.","after":"Record clean contacts and cue response."}'::JSONB),
    ('a-skip','snap-down-cue','movement_intelligence',
      'Ordinary A-skip with active downward recovery cue emphasis, not a bilateral snap-down-to-stick exercise.',
      76::SMALLINT,78::SMALLINT,
      '{"context":"active_downstroke_cue","identityUnchanged":true,"excludedIdentity":"bilateral_snap_down_to_stick","humanReviewRequired":true}'::JSONB,
      '{"sets":"2-4_passes","distancePerPass":"10-20_metres_or_6-12_contacts_per_side","restSeconds":"30-90","intensity":"crisp_submaximal"}'::JSONB,
      'The downstroke cue reduces reaching without adding a bilateral landing, held stick, excessive force, or changed contact order.',
      ARRAY['pain','limp','rhythm_loss','reaching','posture_collapse','bilateral_snap_down_substitution']::TEXT[],
      'State that snap-down is a leg-recovery cue only; keep the ordinary A-skip sequence and keep Snap-Down to Stick as a separate identity.',
      'Keep the A-skip rhythm and bring the recovering foot down beneath you without forcing the contact.',
      'A-skip coordination with active-downstroke cue emphasis.',
      ARRAY['clear_level_lane','safe_finish_zone']::TEXT[],
      '{"oneAthletePerLane":true,"staggeredStarts":true,"clearFinish":true}'::JSONB,
      '{"setupSeconds":45,"workSecondsPerPass":30,"transitionSeconds":15,"restSecondsPerPass":60,"estimateConfidence":"candidate"}'::JSONB,
      '{"dimensions":["contacts","distance","cadence","cue","rest"],"progressOneDimensionAtATime":true}'::JSONB,
      '{"primary":"clean_contacts_per_side_or_distance","secondary":["contact_location","rhythm","relaxation"]}'::JSONB,
      '{"before":"Distinguish the cue from Snap-Down to Stick.","during":"Watch that contact order and travel remain ordinary A-skip.","after":"Record clean contacts and cue response."}'::JSONB),
    ('a-skip','approach-rhythm-context','movement_intelligence',
      'Ordinary A-skip placed in a jump-approach context without board, checkmark, steering, takeoff, or landing claims.',
      68::SMALLINT,72::SMALLINT,
      '{"context":"jump_approach_rhythm","identityUnchanged":true,"transferNotAssumed":true,"humanReviewRequired":true}'::JSONB,
      '{"sets":"2-4_passes","distancePerPass":"10-20_metres_or_6-12_contacts_per_side","restSeconds":"30-90","intensity":"controlled_to_crisp"}'::JSONB,
      'Ordinary A-skip execution remains repeatable; approach transfer is assessed separately and no takeoff is added.',
      ARRAY['pain','limp','rhythm_loss','reaching','posture_collapse','unplanned_takeoff']::TEXT[],
      'Use only as a context annotation. If approach strides, checkmarks, steering, takeoff, or landing are added, select or create an exact separate approach task.',
      'Perform the ordinary A-skip; this pass does not include a takeoff.',
      'A-skip coordination in an approach-related coaching context without a transfer claim.',
      ARRAY['clear_level_lane','safe_finish_zone']::TEXT[],
      '{"oneAthletePerLane":true,"staggeredStarts":true,"clearFinish":true,"takeoffExcluded":true}'::JSONB,
      '{"setupSeconds":45,"workSecondsPerPass":30,"transitionSeconds":15,"restSecondsPerPass":60,"estimateConfidence":"candidate"}'::JSONB,
      '{"dimensions":["contacts","distance","cadence","context","rest"],"progressOneDimensionAtATime":true}'::JSONB,
      '{"primary":"clean_contacts_per_side_or_distance","secondary":["rhythm","posture","separate_approach_outcome"]}'::JSONB,
      '{"before":"Confirm this is ordinary A-skip without takeoff.","during":"Stop if an approach or takeoff sequence is improvised.","after":"Record A-skip quality and assess approach transfer separately."}'::JSONB)
  ) AS seed(
    definition_slug,profile_key,phase_key,purpose,suitability,alignment,
    objective_json,dosage_json,quality_gate,stop_rules,coach_instructions,
    athlete_instructions,expected_adaptation,equipment_required,logistics_json,
    time_model_json,dose_scaling_json,measurement_json,support_prompts_json)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=seed.definition_slug
      AND definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id=definition.id AND variant.variant_key='baseline'
      AND variant.status<>'archived'
  ON CONFLICT(variant_id,profile_key)
  DO UPDATE SET phase_key=EXCLUDED.phase_key,role='conditional',
    purpose=EXCLUDED.purpose,phase_suitability=EXCLUDED.phase_suitability,
    methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,
    dosage_json=EXCLUDED.dosage_json,quality_gate=EXCLUDED.quality_gate,
    stop_rules=EXCLUDED.stop_rules,coach_instructions=EXCLUDED.coach_instructions,
    athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,
    equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,substitution_ids='{}'::UUID[],
    status='review',time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  UPDATE coaching.exercise_section_evidence_v1 evidence
  SET review_status='superseded',updated_at=now()
  FROM coaching.exercise_definition_v1 definition
  WHERE evidence.definition_id=definition.id AND definition.facility_id=1
    AND definition.slug IN(
      'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
      'a-skip-through-cone-gates','a-skip-through-ladder',
      'high-knee-a-march-ladder')
    AND evidence.reviewed_card_version<definition.card_version
    AND evidence.review_status='candidate';
  UPDATE coaching.exercise_media_candidate_v1 media
  SET review_status='superseded',updated_at=now()
  FROM coaching.exercise_definition_v1 definition
  WHERE media.definition_id=definition.id AND definition.facility_id=1
    AND definition.slug IN(
      'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
      'a-skip-through-cone-gates','a-skip-through-ladder',
      'high-knee-a-march-ladder')
    AND media.reviewed_card_version<definition.card_version
    AND media.review_status='candidate';
  UPDATE coaching.exercise_alternate_assessment_v1 alternate
  SET review_status='superseded',updated_at=now()
  FROM coaching.exercise_definition_v1 definition
  WHERE alternate.definition_id=definition.id AND definition.facility_id=1
    AND definition.slug IN(
      'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
      'a-skip-through-cone-gates','a-skip-through-ladder',
      'high-knee-a-march-ladder')
    AND alternate.reviewed_card_version<definition.card_version
    AND alternate.review_status='candidate';

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT definition.id,definition.card_version,evidence.item->>'sectionKey',
    evidence.item->>'sourceUrl',evidence.item->>'sourceTitle',
    evidence.item->>'sourcePublisher',evidence.item->>'sourceKind',
    evidence.item->'claims',(evidence.item->>'evidenceQuality')::SMALLINT,
    'candidate',NULL,NULL
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'evidence') evidence(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=packet.definition_slug
      AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,source_kind=EXCLUDED.source_kind,
    claims_json=EXCLUDED.claims_json,evidence_quality=EXCLUDED.evidence_quality,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,duration_seconds,language_code,captions_available,
    embedding_allowed,exact_variant_match,demonstration_quality_score,
    link_status,review_status,discovery_method,source_query,reviewer_user_id,
    reviewed_at,next_review_at,notes)
  SELECT definition.id,NULL,definition.card_version,media.item->>'url',
    'https://www.youtube-nocookie.com/embed/'
      ||substring(media.item->>'url' FROM 'v=([^&]+)'),
    substring(media.item->>'url' FROM 'v=([^&]+)'),media.item->>'title',
    media.item->>'channelName',NULL,'en',NULL,FALSE,NULL,NULL,
    'unverified','candidate','manual_research',media.item->>'sourceQuery',
    NULL,NULL,NULL,media.item->>'notes'
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'mediaCandidates') media(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=packet.definition_slug
      AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,video_id)
  DO UPDATE SET variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    duration_seconds=NULL,language_code='en',captions_available=NULL,
    embedding_allowed=FALSE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='unverified',
    review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=NULL,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,
    reviewed_at)
  SELECT definition.id,definition.card_version,alternate.item->>'name',
    alternate.item->>'classification',alternate.item->>'rationale',
    alternate.item->'distinguishingDimensions',NULL,'candidate',NULL,NULL
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(
    packet.packet_json->'alternateAssessments') alternate(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=packet.definition_slug
      AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name)
  DO UPDATE SET classification=EXCLUDED.classification,
    rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  CREATE TEMP TABLE family_identity_seed(
    survivor_slug TEXT NOT NULL,resolved_slug TEXT NOT NULL,
    decision TEXT NOT NULL,boundary_key TEXT NOT NULL,rationale TEXT NOT NULL,
    PRIMARY KEY(survivor_slug,resolved_slug)
  ) ON COMMIT DROP;
  INSERT INTO family_identity_seed VALUES
    ('a-march','a-skip','distinct_exercises',
      'no_flight_alternating_march_vs_step_hop_skip_with_flight',
      'A-March uses alternating controlled steps without a flight phase. A-Skip requires a repeatable step-hop contact sequence with brief flight and repeated landings. Contact order, flight, impact, cadence, quality gates, volume accounting, and fatigue differ.'),
    ('a-march','a-march-to-projection','needs_human_review',
      'base_no_flight_march_vs_unresolved_projection_sequence',
      'A-March is a defined no-flight alternating march. A-March to Projection does not declare whether projection means a wall-supported lean, a march-to-acceleration transition, or a jump-approach task. Ordered actions, support, finish, speed, distance, and safety lane must be resolved before consolidation or separation.'),
    ('a-skip','a-skip-pogo-rhythm','needs_human_review',
      'ordinary_step_hop_skip_vs_unresolved_added_pogo_contact',
      'A-Skip has an ordinary alternating step-hop sequence. A-Skip Pogo Rhythm does not declare whether pogo is only a springy-contact cue or an added same-leg contact. Exact contact order, repetition boundary, landing count, and impact budget must be resolved.'),
    ('a-skip','a-skip-through-cone-gates','needs_human_review',
      'base_a_skip_vs_unresolved_cone_gate_contact_rule',
      'Cone gates can be an external-spacing variant of A-Skip, but the source card does not state whether each gate represents one contact, one step-hop cycle, or one stride. Gate-to-contact mapping, spacing, error handling, finish, and trip-risk controls must be declared.'),
    ('a-skip','a-skip-through-ladder','needs_human_review',
      'base_a_skip_vs_unresolved_ladder_cell_contact_rule',
      'A flat ladder can constrain A-Skip spacing, but the source card does not state the exact contacts assigned to each cell. Cell pattern, lead rule, entry, finish, rung-contact failure, and trip-risk controls must be declared before it can be consolidated as a variant.'),
    ('a-march','high-knee-a-march-ladder','needs_human_review',
      'no_flight_a_march_vs_unresolved_march_or_running_ladder_contacts',
      'The ladder card may be a no-flight A-march variant or a high-knee running ladder drill. Flight, contacts per cell, lead rule, cadence, entry, finish, equipment-failure handling, and impact accounting must be declared before consolidation or separation.');

  IF EXISTS(
    SELECT 1 FROM family_identity_seed seed
    JOIN coaching.exercise_definition_v1 survivor
      ON survivor.facility_id=1 AND survivor.slug=seed.survivor_slug
        AND survivor.status<>'archived'
    JOIN coaching.exercise_definition_v1 resolved
      ON resolved.facility_id=1 AND resolved.slug=seed.resolved_slug
        AND resolved.status<>'archived'
    JOIN coaching.exercise_identity_resolution_v1 identity
      ON (identity.survivor_definition_id=survivor.id
          AND identity.resolved_definition_id=resolved.id)
        OR (identity.survivor_definition_id=resolved.id
          AND identity.resolved_definition_id=survivor.id)
    WHERE identity.decision<>seed.decision
      OR identity.survivor_definition_id<>survivor.id
      OR identity.resolved_definition_id<>resolved.id
      OR identity.resolution_source='human_review'
      OR identity.reviewed_by IS NOT NULL
  ) THEN
    RAISE EXCEPTION '% refused to overwrite a conflicting or human-reviewed A-series identity decision',migration_key;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,survivor.id,resolved.id,seed.decision,seed.rationale,
    jsonb_build_object(
      'boundaryKey',seed.boundary_key,'researchBatch',research_batch,
      'researchVersion','2026-07-25.9',
      'evidenceSource','authored_candidate_card_contracts_and_primary_research',
      'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'migration',migration_key),
    'deterministic_identity_equivalence',NULL,now()
  FROM family_identity_seed seed
  JOIN coaching.exercise_definition_v1 survivor
    ON survivor.facility_id=1 AND survivor.slug=seed.survivor_slug
      AND survivor.status<>'archived'
  JOIN coaching.exercise_definition_v1 resolved
    ON resolved.facility_id=1 AND resolved.slug=seed.resolved_slug
      AND resolved.status<>'archived'
  ON CONFLICT(survivor_definition_id,resolved_definition_id)
  DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  CREATE TEMP TABLE family_relationship_seed(
    from_slug TEXT NOT NULL,to_slug TEXT NOT NULL,relationship TEXT NOT NULL,
    similarity_score SMALLINT NOT NULL,dimensions TEXT[] NOT NULL,
    reason TEXT NOT NULL,conditions_json JSONB NOT NULL,
    PRIMARY KEY(from_slug,to_slug,relationship)
  ) ON COMMIT DROP;
  INSERT INTO family_relationship_seed VALUES
    ('a-march','a-skip','progression',72,
      ARRAY['contact_sequence','flight','impact','coordination']::TEXT[],
      'A-Skip adds a repeatable step-hop sequence, brief flight, landing contacts, and higher coordination and impact demand after the athlete owns the no-flight A-March contract.',
      jsonb_build_object('requires',jsonb_build_array(
        'repeatable_a_march','pain_free_low_hop','declared_contact_budget'),
        'authoredDirection',TRUE,'humanReviewRequired',TRUE)),
    ('a-march','a-march-to-projection','lateral_substitution',42,
      ARRAY['ordered_actions','support','speed','finish']::TEXT[],
      'This is not selectable until projection is defined; a future substitution may be valid only when the resolved task preserves the selected march or transition intent.',
      jsonb_build_object('blockedUntil','identity_and_ordered_sequence_resolution',
        'destinationStructurallySelectable',FALSE,'authoredDirection',TRUE,
        'humanReviewRequired',TRUE)),
    ('a-march','high-knee-a-march-ladder','lateral_substitution',48,
      ARRAY['contact_sequence','equipment','spacing','impact']::TEXT[],
      'This is not selectable until the ladder task is confirmed as a no-flight march with an exact cell rule; a running pattern would be a different identity.',
      jsonb_build_object('blockedUntil','flight_and_cell_contact_rule_resolution',
        'destinationStructurallySelectable',FALSE,'authoredDirection',TRUE,
        'humanReviewRequired',TRUE)),
    ('a-skip','a-skip-pogo-rhythm','progression',50,
      ARRAY['contact_sequence','impact','elastic_demand','coordination']::TEXT[],
      'This is not selectable until reviewers determine whether an additional pogo contact exists and define its contact and impact accounting.',
      jsonb_build_object('blockedUntil','pogo_contact_sequence_resolution',
        'destinationStructurallySelectable',FALSE,'authoredDirection',TRUE,
        'humanReviewRequired',TRUE)),
    ('a-skip','a-skip-through-cone-gates','lateral_substitution',62,
      ARRAY['equipment','external_spacing','contact_rule','trip_risk']::TEXT[],
      'Cone gates may constrain ordinary A-Skip spacing only after one exact gate-to-contact rule, safe setup, error rule, and finish are approved.',
      jsonb_build_object('blockedUntil','gate_contact_rule_and_equipment_review',
        'destinationStructurallySelectable',FALSE,'authoredDirection',TRUE,
        'humanReviewRequired',TRUE)),
    ('a-skip','a-skip-through-ladder','lateral_substitution',60,
      ARRAY['equipment','external_spacing','cell_rule','trip_risk']::TEXT[],
      'A flat ladder may constrain ordinary A-Skip spacing only after one exact cell pattern, entry, finish, rung-contact rule, and lower-trip-risk regression are approved.',
      jsonb_build_object('blockedUntil','cell_contact_rule_and_equipment_review',
        'destinationStructurallySelectable',FALSE,'authoredDirection',TRUE,
        'humanReviewRequired',TRUE));

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT from_variant.id,to_variant.id,seed.relationship,seed.similarity_score,
    seed.dimensions,seed.reason,seed.conditions_json,'review',NULL,NULL,NULL
  FROM family_relationship_seed seed
  JOIN coaching.exercise_definition_v1 from_definition
    ON from_definition.facility_id=1 AND from_definition.slug=seed.from_slug
      AND from_definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id=from_definition.id
      AND from_variant.variant_key='baseline' AND from_variant.status<>'archived'
  JOIN coaching.exercise_definition_v1 to_definition
    ON to_definition.facility_id=1 AND to_definition.slug=seed.to_slug
      AND to_definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id=to_definition.id
      AND to_variant.variant_key='baseline' AND to_variant.status<>'archived'
  ON CONFLICT(from_variant_id,to_variant_id,relationship)
  DO UPDATE SET similarity_score=EXCLUDED.similarity_score,
    dimensions=EXCLUDED.dimensions,reason=EXCLUDED.reason,
    conditions_json=EXCLUDED.conditions_json,review_status='review',created_by=NULL,
    reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.review_status='review';

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT relationship.to_variant_id,relationship.from_variant_id,
    CASE relationship.relationship WHEN 'progression' THEN 'regression'
      ELSE relationship.relationship END,
    relationship.similarity_score,relationship.dimensions,
    'Inverse review candidate of the authored '||relationship.relationship||': '
      ||relationship.reason,
    (coalesce(relationship.conditions_json,'{}'::JSONB)-'authoredDirection')
      ||jsonb_build_object('inverseOfRelationship',relationship.relationship,
        'humanReviewRequired',TRUE),
    'review',NULL,NULL,NULL
  FROM coaching.exercise_relationship_v1 relationship
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.id=relationship.from_variant_id
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=from_variant.definition_id
  WHERE definition.facility_id=1
    AND definition.slug IN(
      'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
      'a-skip-through-cone-gates','a-skip-through-ladder',
      'high-knee-a-march-ladder')
    AND relationship.relationship IN('progression','lateral_substitution')
    AND relationship.review_status='review'
    AND NOT(coalesce(relationship.conditions_json,'{}'::JSONB)?'inverseOfRelationship')
  ON CONFLICT(from_variant_id,to_variant_id,relationship)
  DO UPDATE SET similarity_score=EXCLUDED.similarity_score,
    dimensions=EXCLUDED.dimensions,reason=EXCLUDED.reason,
    conditions_json=EXCLUDED.conditions_json,review_status='review',created_by=NULL,
    reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.review_status='review';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,variant.id,dimension.dimension,
    CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END,
    CASE WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=30 THEN 20
      WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=50 THEN 40
      WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=70 THEN 60
      ELSE 80 END,
    CASE dimension.dimension
      WHEN 'technicalComplexity' THEN
        'Candidate exercise-complexity anchor reflects contact order, flight, alternating rhythm, posture, arm-leg coordination, external-spacing rules, equipment, finish, and supervision; independent comparison is pending.'
      ELSE
        'Candidate physical-difficulty anchor reflects bodyweight contacts, impact class, lane distance, cadence, elastic exposure, external constraints, prior sprint or jump work, and fatigue-sensitive contact quality; independent comparison is pending.' END,
    'review',1,NULL,NULL,
    'Candidate migration-411 anchor; independent human review required.',NULL
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  CROSS JOIN(VALUES('technicalComplexity'),('absoluteLoadDemand'))
    AS dimension(dimension)
  WHERE definition.facility_id=1
    AND definition.slug IN(
      'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
      'a-skip-through-cone-gates','a-skip-through-ladder',
      'high-knee-a-march-ladder')
    AND definition.status<>'archived' AND variant.status<>'archived'
    AND variant.difficulty_json?'technicalComplexity'
    AND variant.difficulty_json?'absoluteLoadDemand'
  ON CONFLICT(facility_id,variant_id,dimension,version)
  DO UPDATE SET proposed_score=EXCLUDED.proposed_score,
    anchor_tier=EXCLUDED.anchor_tier,rationale=EXCLUDED.rationale,
    status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_score_calibration_v1.status='review';

  CREATE TEMP TABLE family_score_seed(
    exercise_id BIGINT PRIMARY KEY,complexity SMALLINT NOT NULL,
    physical SMALLINT NOT NULL,coordination SMALLINT NOT NULL,
    impact SMALLINT NOT NULL,supervision SMALLINT NOT NULL,
    confidence SMALLINT NOT NULL,notes TEXT NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO family_score_seed VALUES
    (69,36,10,43,10,27,70,
      'Candidate A-March baseline score; human calibration review required.'),
    (924,36,10,43,10,27,70,
      'Archived A-March Linear duplicate source score retained for lineage.'),
    (878,35,9,42,9,25,68,
      'Archived arm-sweep A-March context source score retained for lineage.'),
    (1117,55,18,60,20,50,52,
      'Candidate unresolved A-March to Projection score; identity review required.'),
    (95,52,16,62,25,36,70,
      'Candidate A-Skip baseline score; human calibration review required.'),
    (982,62,22,70,36,52,52,
      'Candidate unresolved A-Skip Pogo Rhythm score; contact review required.'),
    (717,54,17,64,27,38,68,
      'Archived A-Skip rhythm-punch cue source score retained for lineage.'),
    (925,54,17,64,27,38,68,
      'Archived A-Skip snap-down cue source score retained for lineage.'),
    (1118,52,16,62,25,36,68,
      'Archived A-Skip approach-context source score retained for lineage.'),
    (1590,60,18,69,27,46,58,
      'Candidate cone-gate A-Skip score; exact gate/contact review required.'),
    (1637,63,18,72,26,51,58,
      'Candidate ladder A-Skip score; exact cell/contact review required.'),
    (1636,59,16,67,22,53,52,
      'Candidate high-knee A-March ladder score; march-versus-run review required.');

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity=seed.complexity,
    absolute_load_demand=seed.physical,
    coordination_demand=seed.coordination,impact=seed.impact,
    supervision_demand=seed.supervision,
    base_overall_difficulty=greatest(seed.complexity,seed.physical),
    legacy_scores=coalesce(score.legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'researchBatch',research_batch,
      'researchVersion','2026-07-25.9',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'candidateOnly',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=seed.confidence,human_review_status='queued',
    reviewed_by=NULL,reviewed_at=NULL,review_notes=seed.notes,updated_at=now()
  FROM family_score_seed seed
  WHERE score.exercise_id=seed.exercise_id
    AND score.human_review_status='queued'
    AND score.reviewed_by IS NULL AND score.reviewed_at IS NULL;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,definition.facility_id,definition.card_version,
    definition.schema_version,migration_key,'quarantined',jsonb_build_object(
      'stableIdentityAndAliases',TRUE,
      'allTwelveLegacyCardsAuditedAndTraceable',TRUE,
      'directCueAndContextCollisionsConsolidated',TRUE,
      'taxonomyAnatomyPlanesLateralityPresent',TRUE,
      'difficultyOnlyModelPresent',TRUE,
      'exerciseSkillClassificationAbsent',TRUE,
      'loadFatigueRecoveryPresent',TRUE,
      'equipmentEnvironmentPopulationPresent',TRUE,
      'deliveryDosageInstructionsAndStopRulesPresent',TRUE,
      'timeMeasurementAndDoseScalingPresent',TRUE,
      'athleteCoachAndOperationsSupportPresent',TRUE,
      'candidateEvidenceSectionsPresent',TRUE,
      'fiveMediaCandidatesPresent',TRUE,
      'alternateAssessmentsPresent',TRUE,
      'progressionRegressionAndSubstitutionProposalsPresent',TRUE,
      'complexityAndPhysicalCalibrationProposalsPresent',TRUE,
      'identitySequenceResolved',definition.slug IN('a-march','a-skip'),
      'structurallySelectableAfterApproval',definition.slug IN('a-march','a-skip'),
      'approvalsCreated',FALSE),
    CASE WHEN definition.slug IN('a-march','a-skip') THEN
      jsonb_build_array(
        jsonb_build_object('code','CARD-EVIDENCE-02','message','Candidate evidence and authored section claims require independent review.'),
        jsonb_build_object('code','CARD-MEDIA-01','message','Five media candidates require playback, continuing availability, embedding, exact-match, complete-content, safety, caption, accessibility, and reviewer approval.'),
        jsonb_build_object('code','CARD-GRAPH-03','message','Progression, regression, and substitution relationships remain review-only.'),
        jsonb_build_object('code','CARD-CALIBRATION-01','message','Complexity and physical-difficulty anchors remain review-only.'),
        jsonb_build_object('code','CARD-PUBLISH-01','message','Two-person card review, version approval, media approval, and pilot evidence are incomplete.'))
    ELSE
      jsonb_build_array(
        jsonb_build_object('code','CARD-IDENTITY-06','message',
          definition.coach_support_json->>'programmingDecision'),
        jsonb_build_object('code','CARD-SELECTION-02','message','The definition and baseline profile are structurally non-prescribable until the exact identity and ordered contact contract are approved.'),
        jsonb_build_object('code','CARD-EVIDENCE-02','message','Candidate evidence and authored section claims require independent review.'),
        jsonb_build_object('code','CARD-MEDIA-01','message','Five media candidates require playback, continuing availability, embedding, exact-match, complete-content, safety, caption, accessibility, and reviewer approval.'),
        jsonb_build_object('code','CARD-GRAPH-03','message','All relationships to this definition remain blocked review candidates.'),
        jsonb_build_object('code','CARD-CALIBRATION-01','message','Complexity and physical-difficulty anchors remain review-only.'),
        jsonb_build_object('code','CARD-PUBLISH-01','message','Two-person card review, identity resolution, version approval, media approval, and pilot evidence are incomplete.'))
    END,
    TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1
    AND definition.slug IN(
      'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
      'a-skip-through-cone-gates','a-skip-through-ladder',
      'high-knee-a-march-ladder')
    AND definition.status<>'archived'
  ON CONFLICT(definition_id)
  DO UPDATE SET facility_id=EXCLUDED.facility_id,
    card_version=EXCLUDED.card_version,schema_version=EXCLUDED.schema_version,
    audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_identity_resolution_v1 identity
  JOIN family_identity_seed seed ON TRUE
  JOIN coaching.exercise_definition_v1 survivor
    ON survivor.id=identity.survivor_definition_id
      AND survivor.slug=seed.survivor_slug
  JOIN coaching.exercise_definition_v1 resolved
    ON resolved.id=identity.resolved_definition_id
      AND resolved.slug=seed.resolved_slug
  WHERE identity.decision=seed.decision
    AND identity.resolution_source='deterministic_identity_equivalence'
    AND identity.reviewed_by IS NULL
    AND identity.evidence_json->>'migration'=migration_key;
  IF actual_count<>6 THEN
    RAISE EXCEPTION '% did not create all 6 A-series active identity boundaries; found %',
      migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_section_evidence_v1 evidence
    ON evidence.definition_id=definition.id
      AND evidence.reviewed_card_version=definition.card_version
  WHERE definition.facility_id=1
    AND definition.slug IN(
      'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
      'a-skip-through-cone-gates','a-skip-through-ladder',
      'high-knee-a-march-ladder')
    AND evidence.review_status='candidate';
  IF actual_count<>112 THEN
    RAISE EXCEPTION '% did not create all 112 candidate evidence rows; found %',
      migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_media_candidate_v1 media
    ON media.definition_id=definition.id
      AND media.reviewed_card_version=definition.card_version
  WHERE definition.facility_id=1
    AND definition.slug IN(
      'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
      'a-skip-through-cone-gates','a-skip-through-ladder',
      'high-knee-a-march-ladder')
    AND media.review_status='candidate' AND media.link_status='unverified'
    AND media.embedding_allowed=FALSE AND media.exact_variant_match IS NULL
    AND media.demonstration_quality_score IS NULL
    AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL;
  IF actual_count<>35 THEN
    RAISE EXCEPTION '% did not create all 35 unverified media candidates; found %',
      migration_key,actual_count;
  END IF;

  IF EXISTS(
    SELECT 1 FROM(
      SELECT definition.slug,count(*) count
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_media_candidate_v1 media
        ON media.definition_id=definition.id
          AND media.reviewed_card_version=definition.card_version
      WHERE definition.facility_id=1
        AND definition.slug IN(
          'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
          'a-skip-through-cone-gates','a-skip-through-ladder',
          'high-knee-a-march-ladder')
        AND media.review_status='candidate'
      GROUP BY definition.slug
    ) counts WHERE counts.count<>5
  ) THEN
    RAISE EXCEPTION '% requires exactly 5 current media candidates per definition',migration_key;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_alternate_assessment_v1 alternate
    ON alternate.definition_id=definition.id
      AND alternate.reviewed_card_version=definition.card_version
  WHERE definition.facility_id=1
    AND definition.slug IN(
      'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
      'a-skip-through-cone-gates','a-skip-through-ladder',
      'high-knee-a-march-ladder')
    AND alternate.review_status='candidate';
  IF actual_count<>35 THEN
    RAISE EXCEPTION '% did not create all 35 candidate alternate assessments; found %',
      migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_delivery_profile_v1 profile
  JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  WHERE definition.facility_id=1
    AND definition.slug IN(
      'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
      'a-skip-through-cone-gates','a-skip-through-ladder',
      'high-knee-a-march-ladder')
    AND definition.status<>'archived' AND variant.status<>'archived'
    AND profile.status<>'archived';
  IF actual_count<>12 THEN
    RAISE EXCEPTION '% requires 8 retained and 4 contextual delivery profiles; found %',
      migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_relationship_v1 relationship
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.id=relationship.from_variant_id
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.id=relationship.to_variant_id
  WHERE (from_variant.definition_id IN(
      SELECT id FROM coaching.exercise_definition_v1
      WHERE facility_id=1 AND slug IN(
        'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
        'a-skip-through-cone-gates','a-skip-through-ladder',
        'high-knee-a-march-ladder'))
    OR to_variant.definition_id IN(
      SELECT id FROM coaching.exercise_definition_v1
      WHERE facility_id=1 AND slug IN(
        'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
        'a-skip-through-cone-gates','a-skip-through-ladder',
        'high-knee-a-march-ladder')))
    AND relationship.review_status='review'
    AND relationship.reviewed_by IS NULL AND relationship.reviewed_at IS NULL;
  IF actual_count<>12 THEN
    RAISE EXCEPTION '% did not create 6 authored and 6 inverse graph proposals; found %',
      migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_score_calibration_v1 calibration
  JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  WHERE definition.facility_id=1
    AND definition.slug IN(
      'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
      'a-skip-through-cone-gates','a-skip-through-ladder',
      'high-knee-a-march-ladder')
    AND variant.status<>'archived' AND calibration.status='review'
    AND calibration.dimension IN('technicalComplexity','absoluteLoadDemand')
    AND calibration.reviewed_by IS NULL AND calibration.reviewed_at IS NULL;
  IF actual_count<>14 THEN
    RAISE EXCEPTION '% did not create all 14 review-only calibration rows; found %',
      migration_key,actual_count;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    WHERE definition.facility_id=1
      AND definition.slug IN(
        'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
        'a-skip-through-cone-gates','a-skip-through-ladder',
        'high-knee-a-march-ladder')
      AND variant.status<>'archived'
      AND ((variant.difficulty_json->>'baseOverallDifficulty')::SMALLINT
        <>greatest(
          (variant.difficulty_json->>'technicalComplexity')::SMALLINT,
          (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT)
        OR (variant.programming_profile_json->>'overallDifficulty')::SMALLINT
        <>greatest(
          (variant.difficulty_json->>'technicalComplexity')::SMALLINT,
          (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT))
  ) THEN
    RAISE EXCEPTION '% found overall difficulty not equal to max(complexity, physical difficulty)',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    JOIN coaching.exercise_delivery_profile_v1 profile ON profile.variant_id=variant.id
    WHERE definition.facility_id=1
      AND definition.slug NOT IN('a-march','a-skip')
      AND definition.slug IN(
        'a-march-to-projection','a-skip-pogo-rhythm',
        'a-skip-through-cone-gates','a-skip-through-ladder',
        'high-knee-a-march-ladder')
      AND (variant.requirements_json->>'structurallySelectable'<>'false'
        OR profile.role<>'avoid' OR profile.phase_suitability<>1)
  ) THEN
    RAISE EXCEPTION '% left an unresolved A-series definition structurally selectable',migration_key;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_card_test_packet_v1 packet
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=packet.definition_id
      AND definition.card_version=packet.card_version
  WHERE definition.facility_id=1
    AND definition.slug IN(
      'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
      'a-skip-through-cone-gates','a-skip-through-ladder',
      'high-knee-a-march-ladder')
    AND packet.audit_version=migration_key AND packet.status='quarantined'
    AND packet.human_review_required=TRUE;
  IF actual_count<>7 THEN
    RAISE EXCEPTION '% did not create all 7 quarantined card test packets; found %',
      migration_key,actual_count;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    LEFT JOIN coaching.exercise_delivery_profile_v1 profile
      ON profile.variant_id=variant.id
    WHERE definition.facility_id=1
      AND definition.slug IN(
        'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
        'a-skip-through-cone-gates','a-skip-through-ladder',
        'high-knee-a-march-ladder')
      AND coaching.exercise_json_has_level_classification(jsonb_build_array(
        definition.provenance_json,definition.environment_json,
        definition.population_json,definition.anatomy_json,
        definition.athlete_support_json,definition.coach_support_json,
        definition.support_operations_json,variant.difficulty_json,
        variant.requirements_json,variant.load_profile_json,
        variant.fatigue_profile_json,variant.programming_profile_json,
        profile.objective_relevance_json,profile.dosage_json,
        profile.logistics_json,profile.time_model_json,
        profile.dose_scaling_json,profile.measurement_json,
        profile.support_prompts_json))
  ) THEN
    RAISE EXCEPTION '% found forbidden exercise skill/proficiency classification',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    LEFT JOIN coaching.exercise_card_review_v1 card_review
      ON card_review.definition_id=definition.id
    LEFT JOIN coaching.exercise_media_review_v1 media_review
      ON media_review.definition_id=definition.id
    WHERE definition.facility_id=1
      AND definition.slug IN(
        'a-march','a-march-to-projection','a-skip','a-skip-pogo-rhythm',
        'a-skip-through-cone-gates','a-skip-through-ladder',
        'high-knee-a-march-ladder')
      AND (definition.status='published' OR definition.approved_video_url IS NOT NULL
        OR definition.reviewed_by IS NOT NULL OR definition.approved_by IS NOT NULL
        OR definition.last_reviewed_at IS NOT NULL
        OR card_review.id IS NOT NULL OR media_review.id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% created or retained a forbidden approval',migration_key;
  END IF;
END;
$$;
