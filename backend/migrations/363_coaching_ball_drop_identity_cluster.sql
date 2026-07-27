-- Resolve the Ball Drop reactive-sprint identity cluster.
--
-- Partner Tennis Ball Drop Sprint duplicates the stable
-- ball-drop-reaction-sprint survivor: both require a live partner ball drop,
-- short acceleration, capture before a declared bounce limit, controlled
-- deceleration, and a full reset. Ball type, release height, start distance,
-- bounce limit, start stance, and dose remain exact variant/profile fields.
--
-- The cone run-through/stick, hop-and-go, second direction cue, catch-to-cut,
-- and cue-selected gate tasks remain distinct definitions because they change
-- the stimulus sequence, required action, or terminal contract.
--
-- No exercise skill/proficiency level, human reviewer, approval, media
-- verification, graph approval, or calibration approval is introduced.
-- Exercise difficulty remains exercise complexity plus physical difficulty,
-- with overall equal to their maximum. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '363_coaching_ball_drop_identity_cluster';
  survivor_id UUID;
  duplicate_id UUID;
  survivor_version INTEGER;
  duplicate_legacy_id BIGINT;
  duplicate_status TEXT;
  facility BIGINT;
  protected_records INTEGER;
  boundary RECORD;
  related_id UUID;
BEGIN
  SELECT id, card_version, facility_id
  INTO survivor_id, survivor_version, facility
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'ball-drop-reaction-sprint'
    AND status <> 'archived';

  SELECT id, legacy_exercise_id, status
  INTO duplicate_id, duplicate_legacy_id, duplicate_status
  FROM coaching.exercise_definition_v1
  WHERE facility_id = facility
    AND slug = 'partner-tennis-ball-drop-sprint';

  IF survivor_id IS NULL THEN
    RAISE EXCEPTION
      '% requires active survivor ball-drop-reaction-sprint',
      migration_key;
  END IF;

  IF duplicate_id IS NULL THEN
    RAISE EXCEPTION
      '% requires traceable duplicate partner-tennis-ball-drop-sprint',
      migration_key;
  END IF;

  IF duplicate_status <> 'archived' THEN
    IF duplicate_legacy_id IS NULL THEN
      RAISE EXCEPTION
        '% requires duplicate legacy traceability',
        migration_key;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        (
          resolution.survivor_definition_id = survivor_id
          AND resolution.resolved_definition_id = duplicate_id
        )
        OR (
          resolution.survivor_definition_id = duplicate_id
          AND resolution.resolved_definition_id = survivor_id
        )
      )
        AND (
          resolution.decision <> 'duplicate_consolidated'
          OR resolution.resolution_source = 'human_review'
        )
    ) THEN
      RAISE EXCEPTION
        '% conflicts with protected identity decision for ball-drop-reaction-sprint and partner-tennis-ball-drop-sprint',
        migration_key;
    END IF;

    SELECT
      (
        SELECT COUNT(*)
        FROM coaching.exercise_definition_v1
        WHERE id IN (survivor_id, duplicate_id)
          AND (
            status = 'published'
            OR reviewed_by IS NOT NULL
            OR approved_by IS NOT NULL
            OR last_reviewed_at IS NOT NULL
            OR approved_video_url IS NOT NULL
          )
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_section_evidence_v1
        WHERE definition_id IN (survivor_id, duplicate_id)
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_media_candidate_v1
        WHERE definition_id IN (survivor_id, duplicate_id)
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_alternate_assessment_v1
        WHERE definition_id IN (survivor_id, duplicate_id)
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_card_review_v1
        WHERE definition_id IN (survivor_id, duplicate_id)
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_card_revision_v1
        WHERE definition_id IN (survivor_id, duplicate_id)
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_media_review_v1
        WHERE definition_id IN (survivor_id, duplicate_id)
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_variant_v1
        WHERE definition_id IN (survivor_id, duplicate_id)
          AND status = 'published'
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_relationship_v1 relationship
        WHERE (
          relationship.from_variant_id IN (
            SELECT id
            FROM coaching.exercise_variant_v1
            WHERE definition_id IN (survivor_id, duplicate_id)
          )
          OR relationship.to_variant_id IN (
            SELECT id
            FROM coaching.exercise_variant_v1
            WHERE definition_id IN (survivor_id, duplicate_id)
          )
        )
          AND (
            relationship.review_status <> 'review'
            OR relationship.reviewed_by IS NOT NULL
            OR relationship.reviewed_at IS NOT NULL
          )
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_score_calibration_v1 calibration
        WHERE calibration.variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id IN (survivor_id, duplicate_id)
        )
          AND (
            calibration.status <> 'review'
            OR calibration.reviewed_by IS NOT NULL
            OR calibration.reviewed_at IS NOT NULL
          )
      )
    INTO protected_records;

    IF protected_records > 0 THEN
      RAISE EXCEPTION
        '% refused to override % protected record(s)',
        migration_key,
        protected_records;
    END IF;

    INSERT INTO coaching.exercise_identity_resolution_v1 (
      facility_id,
      survivor_definition_id,
      resolved_definition_id,
      decision,
      rationale,
      evidence_json,
      resolution_source,
      reviewed_by,
      resolved_at
    )
    VALUES (
      facility,
      survivor_id,
      duplicate_id,
      'duplicate_consolidated',
      'Partner Tennis Ball Drop Sprint and Ball Drop Reaction Sprint both require the athlete to wait for a live partner ball release, accelerate toward the falling ball, secure it before a declared bounce limit, decelerate under control, and fully reset. Ball type, release height, start distance, bounce limit, stance, and dose are variant or delivery dimensions rather than separate exercise identities.',
      jsonb_build_object(
        'match', 'same_live_ball_drop_chase_capture_and_reset',
        'survivorSlug', 'ball-drop-reaction-sprint',
        'resolvedSlug', 'partner-tennis-ball-drop-sprint',
        'identityBoundary',
          'ball_type_release_height_distance_bounce_limit_stance_and_dose',
        'variantDimensions', jsonb_build_array(
          'ball_type',
          'release_height',
          'release_position',
          'start_stance',
          'start_distance',
          'bounce_limit',
          'capture_rule',
          'run_out',
          'dose'
        ),
        'researchSourceKeys', jsonb_build_array(
          'agility_perception_action_meta_analysis',
          'sprint_acceleration_hamstrings',
          'change_direction_training_scoping_review'
        ),
        'researchSources', jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/41710443/',
          'https://pubmed.ncbi.nlm.nih.gov/26733889/',
          'https://pubmed.ncbi.nlm.nih.gov/35922872/'
        ),
        'exerciseDifficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'migration', migration_key
      ),
      'deterministic_identity_equivalence',
      NULL,
      now()
    )
    ON CONFLICT (
      survivor_definition_id,
      resolved_definition_id
    )
    DO UPDATE SET
      decision = EXCLUDED.decision,
      rationale = EXCLUDED.rationale,
      evidence_json = EXCLUDED.evidence_json,
      resolution_source = EXCLUDED.resolution_source,
      reviewed_by = NULL,
      resolved_at = now()
    WHERE coaching.exercise_identity_resolution_v1.resolution_source
      <> 'human_review';

    UPDATE coaching.exercise_definition_source_v1 source
    SET definition_id = survivor_id,
        source_kind = 'duplicate_consolidation',
        provenance_json = source.provenance_json || jsonb_build_object(
          'resolvedFromDefinitionId', duplicate_id,
          'resolution', 'same_live_ball_drop_chase_capture_and_reset',
          'migration', migration_key
        )
    WHERE source.definition_id = duplicate_id;

    UPDATE coaching.exercise_variant_v1
    SET variant_key = 'legacy-source-' || duplicate_legacy_id::TEXT
          || '-baseline',
        display_name = 'Legacy Partner Tennis Ball Drop Sprint Source',
        definition_id = survivor_id,
        status = 'archived',
        requirements_json = coalesce(requirements_json, '{}'::JSONB)
          || jsonb_build_object(
            'selectable', FALSE,
            'identityQuarantine', TRUE,
            'sourceDefinitionId', duplicate_id,
            'identityBoundary',
              'ball_type_release_height_distance_bounce_limit_stance_and_dose',
            'quarantineReason',
              'Legacy source does not declare the exact release, distance, bounce-limit, capture, run-out, dose, quality-gate, and stop-rule contract required by the consolidated card.'
          ),
        updated_at = now()
    WHERE definition_id = duplicate_id;

    UPDATE coaching.exercise_delivery_profile_v1 profile
    SET status = 'archived',
        updated_at = now()
    FROM coaching.exercise_variant_v1 variant
    WHERE variant.id = profile.variant_id
      AND variant.definition_id = survivor_id
      AND variant.status = 'archived';

    DELETE FROM coaching.exercise_section_evidence_v1 duplicate_evidence
    USING coaching.exercise_section_evidence_v1 survivor_evidence
    WHERE duplicate_evidence.definition_id = duplicate_id
      AND survivor_evidence.definition_id = survivor_id
      AND survivor_evidence.reviewed_card_version =
        duplicate_evidence.reviewed_card_version
      AND survivor_evidence.section_key = duplicate_evidence.section_key
      AND survivor_evidence.source_url = duplicate_evidence.source_url;

    UPDATE coaching.exercise_section_evidence_v1
    SET definition_id = survivor_id,
        reviewed_card_version = survivor_version,
        updated_at = now()
    WHERE definition_id = duplicate_id;

    DELETE FROM coaching.exercise_media_candidate_v1 duplicate_media
    USING coaching.exercise_media_candidate_v1 survivor_media
    WHERE duplicate_media.definition_id = duplicate_id
      AND survivor_media.definition_id = survivor_id
      AND (
        survivor_media.video_id = duplicate_media.video_id
        OR survivor_media.url = duplicate_media.url
      );

    UPDATE coaching.exercise_media_candidate_v1
    SET definition_id = survivor_id,
        reviewed_card_version = survivor_version,
        notes = concat_ws(
          ' ',
          notes,
          'Preserved from a consolidated source; candidate metadata does not establish human viewing, exact matching, accessibility review, or approval.'
        ),
        updated_at = now()
    WHERE definition_id = duplicate_id;

    DELETE FROM coaching.exercise_alternate_assessment_v1 duplicate_alternate
    USING coaching.exercise_alternate_assessment_v1 survivor_alternate
    WHERE duplicate_alternate.definition_id = duplicate_id
      AND survivor_alternate.definition_id = survivor_id
      AND lower(survivor_alternate.alternate_name) =
        lower(duplicate_alternate.alternate_name);

    UPDATE coaching.exercise_alternate_assessment_v1
    SET definition_id = survivor_id,
        reviewed_card_version = survivor_version,
        updated_at = now()
    WHERE definition_id = duplicate_id;

    UPDATE coaching.exercise_definition_v1 survivor
    SET aliases = ARRAY(
          SELECT min(alias)
          FROM unnest(
            coalesce(survivor.aliases, '{}')
            || coalesce(duplicate.aliases, '{}')
            || ARRAY[
              duplicate.canonical_name,
              duplicate.display_name,
              'Partner Tennis Ball Drop Sprint',
              'Partner Tennis Ball Drop Sprints'
            ]::TEXT[]
          ) alias
          WHERE nullif(btrim(alias), '') IS NOT NULL
            AND lower(btrim(alias)) <> lower(survivor.canonical_name)
          GROUP BY lower(btrim(alias))
          ORDER BY lower(btrim(alias))
        ),
        status = 'review',
        approved_video_url = NULL,
        reviewed_by = NULL,
        approved_by = NULL,
        last_reviewed_at = NULL,
        provenance_json = survivor.provenance_json || jsonb_build_object(
          'identityMigration', migration_key,
          'identityResolution',
            'same_live_ball_drop_chase_capture_and_reset',
          'stableSlugPreserved', 'ball-drop-reaction-sprint',
          'consolidatedDefinitionIds',
            coalesce(
              survivor.provenance_json -> 'consolidatedDefinitionIds',
              '[]'::JSONB
            ) || to_jsonb(duplicate_id),
          'consolidatedLegacyExerciseIds',
            coalesce(
              survivor.provenance_json -> 'consolidatedLegacyExerciseIds',
              '[]'::JSONB
            ) || to_jsonb(duplicate_legacy_id),
          'researchVersion', '2026-07-27.51',
          'difficultyModel',
            'max_exercise_complexity_physical_difficulty',
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE,
          'mediaApprovalCreated', FALSE,
          'graphApprovalCreated', FALSE,
          'calibrationApprovalCreated', FALSE
        ),
        updated_at = now()
    FROM coaching.exercise_definition_v1 duplicate
    WHERE survivor.id = survivor_id
      AND duplicate.id = duplicate_id;

    UPDATE coaching.exercise_card_test_packet_v1
    SET status = 'quarantined',
        blocking_issues_json = blocking_issues_json || jsonb_build_array(
          jsonb_build_object(
            'code', 'identity_consolidation_reaudit_required',
            'message',
              'Re-run the canonical card audit after Ball Drop identity consolidation.'
          )
        ),
        human_review_required = TRUE,
        checked_at = now()
    WHERE definition_id = survivor_id;

    UPDATE coaching.exercise_definition_v1
    SET status = 'archived',
        legacy_exercise_id = NULL,
        approved_video_url = NULL,
        reviewed_by = NULL,
        approved_by = NULL,
        last_reviewed_at = NULL,
        provenance_json = provenance_json || jsonb_build_object(
          'archivedByIdentityMigration', migration_key,
          'survivorDefinitionId', survivor_id,
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE
        ),
        updated_at = now()
    WHERE id = duplicate_id;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.survivor_definition_id = survivor_id
      AND resolution.resolved_definition_id = duplicate_id
      AND resolution.decision = 'duplicate_consolidated'
  ) THEN
    RAISE EXCEPTION
      '% found archived duplicate without matching identity resolution',
      migration_key;
  END IF;

  FOR boundary IN
    SELECT *
    FROM (VALUES
      (
        'ball-drop-point-and-sprint-cone-reaction',
        'cone_target_run_through_or_stick_without_required_ball_capture',
        'Ball Drop/Point-and-Sprint Cone Reaction declares a cone route ending in a run-through or stable stick and allows a point or dropped ball as the cue. Ball Drop Reaction Sprint requires chasing and securing the falling ball before a declared bounce limit. The target object and terminal action are different exercise contracts.'
      ),
      (
        'reaction-ball-drop-to-hop-and-go',
        'required_hop_contact_before_acceleration',
        'Reaction Ball Drop to Hop-and-Go requires a visually cued hop contact followed by acceleration. Ball Drop Reaction Sprint begins with acceleration toward the falling ball and has no required hop. Adding the impact contact changes prerequisites, contact count, load, fatigue, coaching, and stop rules.'
      ),
      (
        'ball-drop-sprint-plus-direction-cue',
        'two_stimulus_sequence_and_late_direction_choice',
        'Ball Drop Sprint plus Direction Cue uses the ball drop to start the rep and then adds a late directional cue under time pressure. Ball Drop Reaction Sprint uses the single falling-ball event as the cue and capture target. The second stimulus, decision mapping, direction change, and finish create a distinct compound task.'
      ),
      (
        'reaction-ball-drop-catch-to-cut',
        'required_capture_followed_by_called_exit_cut',
        'Reaction Ball Drop Catch to Cut requires the athlete to secure the dropped ball and then execute a called exit cut. Ball Drop Reaction Sprint ends with the capture and controlled deceleration. The post-capture cue, cut, reacceleration, and lane requirements make the compound task distinct.'
      ),
      (
        'gate-reaction-drill',
        'cue_selected_gate_without_ball_chase_or_capture',
        'Gate Reaction Drill uses a visual or verbal signal to select and accelerate through one of multiple cone gates. Ball Drop Reaction Sprint requires visual tracking and capture of a falling ball before a bounce limit. Gate selection without object pursuit or capture is a separate perception-action contract.'
      )
    ) AS boundaries(
      related_slug,
      identity_boundary,
      rationale
    )
  LOOP
    related_id := NULL;

    SELECT id
    INTO related_id
    FROM coaching.exercise_definition_v1
    WHERE facility_id = facility
      AND slug = boundary.related_slug
      AND status <> 'archived';

    IF related_id IS NULL THEN
      RAISE EXCEPTION
        '% requires active related definition %',
        migration_key,
        boundary.related_slug;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        (
          resolution.survivor_definition_id = survivor_id
          AND resolution.resolved_definition_id = related_id
        )
        OR (
          resolution.survivor_definition_id = related_id
          AND resolution.resolved_definition_id = survivor_id
        )
      )
        AND (
          resolution.decision <> 'distinct_exercises'
          OR resolution.resolution_source = 'human_review'
        )
    ) THEN
      RAISE EXCEPTION
        '% conflicts with protected identity decision for ball-drop-reaction-sprint and %',
        migration_key,
        boundary.related_slug;
    END IF;

    INSERT INTO coaching.exercise_identity_resolution_v1 (
      facility_id,
      survivor_definition_id,
      resolved_definition_id,
      decision,
      rationale,
      evidence_json,
      resolution_source,
      reviewed_by,
      resolved_at
    )
    VALUES (
      facility,
      survivor_id,
      related_id,
      'distinct_exercises',
      boundary.rationale,
      jsonb_build_object(
        'match', 'identity_defining_action_or_stimulus_boundary',
        'leftSlug', 'ball-drop-reaction-sprint',
        'rightSlug', boundary.related_slug,
        'identityBoundary', boundary.identity_boundary,
        'researchSourceKeys', jsonb_build_array(
          'agility_perception_action_meta_analysis',
          'sprint_acceleration_hamstrings',
          'change_direction_training_scoping_review'
        ),
        'researchSources', jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/41710443/',
          'https://pubmed.ncbi.nlm.nih.gov/26733889/',
          'https://pubmed.ncbi.nlm.nih.gov/35922872/'
        ),
        'exerciseDifficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'decisionScope',
          'identity_only_not_card_media_graph_calibration_or_publication_approval',
        'migration', migration_key
      ),
      'deterministic_identity_equivalence',
      NULL,
      now()
    )
    ON CONFLICT (
      survivor_definition_id,
      resolved_definition_id
    )
    DO UPDATE SET
      decision = EXCLUDED.decision,
      rationale = EXCLUDED.rationale,
      evidence_json = EXCLUDED.evidence_json,
      resolution_source = EXCLUDED.resolution_source,
      reviewed_by = NULL,
      resolved_at = now()
    WHERE coaching.exercise_identity_resolution_v1.resolution_source
      <> 'human_review';
  END LOOP;

  -- The slash-labelled cone source also resembles the compound two-stimulus
  -- card. This pair is resolved explicitly so both similarity-queue entries
  -- have a deterministic boundary.
  SELECT id
  INTO related_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = facility
    AND slug = 'ball-drop-point-and-sprint-cone-reaction'
    AND status <> 'archived';

  SELECT id
  INTO duplicate_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = facility
    AND slug = 'ball-drop-sprint-plus-direction-cue'
    AND status <> 'archived';

  IF related_id IS NULL OR duplicate_id IS NULL THEN
    RAISE EXCEPTION
      '% requires both cone-reaction and direction-cue definitions',
      migration_key;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE (
      (
        resolution.survivor_definition_id = related_id
        AND resolution.resolved_definition_id = duplicate_id
      )
      OR (
        resolution.survivor_definition_id = duplicate_id
        AND resolution.resolved_definition_id = related_id
      )
    )
      AND (
        resolution.decision <> 'distinct_exercises'
        OR resolution.resolution_source = 'human_review'
      )
  ) THEN
    RAISE EXCEPTION
      '% conflicts with protected identity decision for cone reaction and direction-cue compound',
      migration_key;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1 (
    facility_id,
    survivor_definition_id,
    resolved_definition_id,
    decision,
    rationale,
    evidence_json,
    resolution_source,
    reviewed_by,
    resolved_at
  )
  VALUES (
    facility,
    related_id,
    duplicate_id,
    'distinct_exercises',
    'Ball Drop/Point-and-Sprint Cone Reaction uses one visual cue modality to select or start a cone route and ends in a declared run-through or stick. Ball Drop Sprint plus Direction Cue requires a dropped-ball start followed by a second late directional cue and ball-handling finish. One cue versus two sequential cues, capture requirements, and the terminal action make the cards distinct.',
    jsonb_build_object(
      'match', 'single_cue_cone_route_vs_two_stimulus_compound_task',
      'leftSlug', 'ball-drop-point-and-sprint-cone-reaction',
      'rightSlug', 'ball-drop-sprint-plus-direction-cue',
      'identityBoundary',
        'single_or_alternative_cue_vs_ball_drop_then_late_direction_cue',
      'researchSourceKeys', jsonb_build_array(
        'agility_perception_action_meta_analysis',
        'change_direction_training_scoping_review'
      ),
      'researchSources', jsonb_build_array(
        'https://pubmed.ncbi.nlm.nih.gov/41710443/',
        'https://pubmed.ncbi.nlm.nih.gov/35922872/'
      ),
      'exerciseDifficultyModel',
        'max_exercise_complexity_physical_difficulty',
      'humanReviewRequired', TRUE,
      'publicationQuarantined', TRUE,
      'decisionScope',
        'identity_only_not_card_media_graph_calibration_or_publication_approval',
      'migration', migration_key
    ),
    'deterministic_identity_equivalence',
    NULL,
    now()
  )
  ON CONFLICT (
    survivor_definition_id,
    resolved_definition_id
  )
  DO UPDATE SET
    decision = EXCLUDED.decision,
    rationale = EXCLUDED.rationale,
    evidence_json = EXCLUDED.evidence_json,
    resolution_source = EXCLUDED.resolution_source,
    reviewed_by = NULL,
    resolved_at = now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source
    <> 'human_review';
END;
$$;
