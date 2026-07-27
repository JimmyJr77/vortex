-- Consolidate mechanically supported duplicate and controlled-variant
-- identities in the score-77 canonical queue.
--
-- Source mappings, aliases, candidate evidence/media, and archived legacy
-- variants remain traceable. This migration creates no human approval.
-- Exercise cards use exercise complexity and physical difficulty only;
-- skill/proficiency levels remain exclusive to coaching.skill.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '386_coaching_score_77_variant_identity_consolidations';
  pair RECORD;
  survivor_id UUID;
  duplicate_id UUID;
  survivor_version INTEGER;
  duplicate_legacy_id BIGINT;
  duplicate_status TEXT;
  facility BIGINT;
  protected_records INTEGER;
BEGIN
  FOR pair IN
    SELECT *
    FROM (VALUES
      (
        'back-squat',
        'high-bar-back-squat',
        'High-Bar Back Squat',
        NULL::TEXT,
        'same_barbell_back_squat_with_high_bar_position_variant',
        'Both sources support a bar across the posterior shoulder complex, descend through a bilateral squat, maintain foot pressure and brace, and stand. High-bar placement changes bar position, torso angle, knee and hip contribution, stance, range, load, tempo, rest, and dose within the back-squat identity.',
        '["bar_position","torso_angle","knee_hip_contribution","stance","range","load","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'band-cable-row',
        'band-row',
        'Band Row',
        NULL::TEXT,
        'same_anchored_horizontal_row_with_band_only_variant',
        'Both sources sit or stand tall, pull resistance from an anterior anchor toward the ribs, retract the scapulae without lumbar extension, and return under control. Band-only delivery changes implement, resistance curve, anchor, grip, stance, range, load, tempo, rest, and dose within the band-or-cable-row identity.',
        '["implement","resistance_curve","anchor","grip","stance","range","load","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB
      ),
      (
        'box-jump',
        'pause-box-jump',
        'Pause Box Jump',
        NULL::TEXT,
        'same_floor_to_box_jump_with_pre_takeoff_pause_variant',
        'Both sources jump from the floor to a stable box, land with whole-foot control, stand, step down, and reset. A pause before takeoff changes start position, pause duration, countermovement allowance, elastic contribution, intent, box height, rest, and dose within the box-jump identity.',
        '["start_position","pause_duration","countermovement_allowance","elastic_contribution","intent","box_height","landing","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        'landmine-press',
        'landmine-ball-grip-press',
        'Landmine Ball-Grip Press',
        NULL::TEXT,
        'same_nonrotational_landmine_press_with_ball_grip_attachment_variant',
        'Both sources perform a nonrotational angled landmine press while maintaining a braced trunk and controlled shoulder, elbow, and scapular path. A ball-grip attachment changes interface, grip, wrist position, forearm demand, load handling, setup, range, rest, and dose within the landmine-press identity.',
        '["attachment","grip","wrist_position","forearm_demand","load_handling","setup","range","rest","dose"]'::JSONB,
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'one-arm-landmine-row',
        'landmine-ball-grip-row',
        'Landmine Ball-Grip Row',
        'Landmine Row',
        'same_landmine_row_with_ball_grip_attachment_and_hand_count_variants',
        'Both sources hold a hip hinge and row the free end of a landmine toward the trunk through scapular retraction, shoulder extension, and elbow flexion. Ball-grip attachment and declared hand count change interface, grip, wrist demand, stance, torso angle, load, range, tempo, rest, and dose within the landmine-row identity.',
        '["attachment","hand_count","grip","wrist_demand","stance","torso_angle","load","range","tempo","rest","dose"]'::JSONB,
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'one-arm-landmine-row',
        'landmine-meadows-row',
        'Landmine Meadows Row',
        NULL::TEXT,
        'same_single_arm_landmine_row_with_meadows_stance_and_sleeve_grip_variant',
        'Both sources hold a hip hinge and pull the free end of a landmine toward the trunk with one arm. The Meadows setup changes body orientation, stance, sleeve-end grip, elbow path, torso angle, load, range, tempo, rest, and dose within the one-arm landmine-row identity.',
        '["body_orientation","stance","grip_location","elbow_path","torso_angle","load","range","tempo","rest","dose"]'::JSONB,
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'one-arm-landmine-row',
        'landmine-gorilla-row',
        'Landmine Gorilla Row',
        'Landmine Row',
        'same_landmine_row_with_gorilla_stance_and_double_handle_variant',
        'Both sources hold a hip hinge and row the free end of a landmine toward the trunk through scapular retraction, shoulder extension, and elbow flexion. Gorilla stance and a double-handle attachment change stance width, hand count, attachment, grip, torso angle, load, range, tempo, rest, and dose within the landmine-row identity.',
        '["stance_width","hand_count","attachment","grip","torso_angle","load","range","tempo","rest","dose"]'::JSONB,
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'one-arm-landmine-row',
        'landmine-suitcase-row',
        'Landmine Suitcase Row',
        'Landmine Row',
        'same_landmine_row_with_suitcase_stance_and_anti_rotation_emphasis_variant',
        'Both sources hold a hip hinge and row the free end of a landmine toward the trunk with one hand through scapular retraction, shoulder extension, and elbow flexion. Suitcase positioning changes stance, bar side, anti-rotation emphasis, grip location, torso angle, load, range, tempo, rest, and dose within the landmine-row identity.',
        '["stance","bar_side","anti_rotation_emphasis","grip_location","torso_angle","load","range","tempo","rest","dose"]'::JSONB,
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'one-arm-landmine-row',
        'landmine-t-bar-row-with-v-handle',
        'Landmine T-Bar Row with V-Handle',
        'Landmine Row',
        'same_landmine_row_with_v_handle_and_bilateral_hand_count_variants',
        'Both sources hold a hip hinge and row the free end of a landmine toward the trunk through scapular retraction, shoulder extension, and elbow flexion. A neutral V-handle and bilateral hand position change attachment, hand count, grip width, stance, torso angle, load, range, tempo, rest, and dose within the landmine-row identity.',
        '["attachment","hand_count","handle_width","grip_width","stance","torso_angle","range","load","tempo","rest","dose"]'::JSONB,
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'one-arm-landmine-row',
        'landmine-neutral-handle-t-bar-row',
        'Landmine T-Bar Row',
        'Landmine Row',
        'same_landmine_row_with_neutral_handle_and_bilateral_hand_count_variants',
        'Both sources hold a hip hinge and row the free end of a landmine toward the trunk through scapular retraction, shoulder extension, and elbow flexion. A neutral V-handle and bilateral hand position change attachment, hand count, grip width, stance, torso angle, load, range, tempo, rest, and dose within the landmine-row identity.',
        '["attachment","hand_count","grip_width","stance","torso_angle","load","range","tempo","rest","dose"]'::JSONB,
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'squat-jump',
        'loaded-squat-jump',
        'Loaded Squat Jump',
        NULL::TEXT,
        'same_squat_jump_with_external_load_variant',
        'Both sources begin from a declared squat or static preload, project vertically through coordinated lower-body extension, land under control, and reset. External resistance changes implement, load position, relative load, velocity, arm policy, landing demand, fatigue cap, rest, and dose within the squat-jump identity.',
        '["implement","load_position","relative_load","velocity","arm_policy","landing","fatigue_cap","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        'ring-dip',
        'strict-ring-dip-strength',
        'Strict Ring Dip',
        NULL::TEXT,
        'same_ring_supported_dip_with_strict_tempo_and_intent_variant',
        'Both sources support the body on suspended rings, lower through shoulder and elbow flexion under control, press to support, stabilize the rings, and maintain trunk position. Strict wording changes tempo, assistance, range, external load, fatigue cap, rest, and dose within the ring-dip identity.',
        '["tempo","assistance","range","external_load","ring_turnout","fatigue_cap","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/36360619/"]'::JSONB
      ),
      (
        'rock-and-roll-to-stand',
        'squat-roll-to-stand',
        'Squat Roll to Stand',
        NULL::TEXT,
        'same_tucked_backward_rock_to_forward_foot_plant_and_stand',
        'Both sources begin seated or in a low squat, roll backward in a tuck to the upper back, rock forward, plant the feet beneath the body, and recover to a squat or stand. Start depth, terminal depth, arm assistance, momentum, surface, tempo, rest, and dose remain exact variants.',
        '["start_depth","terminal_depth","arm_assistance","momentum","surface","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'sandbag-front-loaded-squat-strength',
        'sandbag-shoulder-loaded-squat-strength',
        'Sandbag Shoulder-Loaded Squat',
        'Sandbag Squat',
        'same_sandbag_squat_with_front_or_unilateral_shoulder_load_position_variant',
        'Both sources hold a sandbag off the floor, descend through a bilateral squat, maintain foot pressure and trunk control, and stand. Front-loaded versus one-shoulder placement changes load position, symmetry, side dosage, trunk demand, grip, pickup, set-down, load, rest, and dose within the sandbag-squat identity.',
        '["load_position","load_symmetry","side","trunk_demand","grip","pickup","set_down","load","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'sandbag-front-loaded-squat-strength',
        'sandbag-bear-hug-squat-strength',
        'Sandbag Bear-Hug Squat',
        'Sandbag Squat',
        'same_sandbag_squat_with_bear_hug_load_position_variant',
        'Both sources hold a sandbag against the anterior trunk, descend through a bilateral squat, maintain foot pressure and trunk control, and stand. A bear-hug instead of forearm-supported front hold changes load position, arm wrap, compression, breathing constraint, pickup, set-down, load, rest, and dose within the sandbag-squat identity.',
        '["load_position","arm_wrap","compression","breathing_constraint","pickup","set_down","load","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'tuck-jump',
        'tuck-jump-to-stick',
        'Tuck Jump to Stick',
        NULL::TEXT,
        'same_vertical_tuck_jump_with_terminal_stick_variant',
        'Both sources project vertically, flex the hips and knees to create the airborne tuck, re-extend before contact, and land under control. A declared terminal stick changes hold duration, reset policy, repetition continuity, landing target, arm policy, impact cap, rest, and dose within the tuck-jump identity.',
        '["terminal_action","hold_duration","reset_policy","repetition_continuity","landing_target","arm_policy","impact_cap","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      )
    ) AS pairs(
      survivor_slug,
      duplicate_slug,
      retained_alias,
      survivor_display_name,
      identity_match,
      rationale,
      variant_dimensions,
      research_sources
    )
  LOOP
    survivor_id := NULL;
    duplicate_id := NULL;
    survivor_version := NULL;
    duplicate_legacy_id := NULL;
    duplicate_status := NULL;
    facility := NULL;

    SELECT id, card_version, facility_id
    INTO survivor_id, survivor_version, facility
    FROM coaching.exercise_definition_v1
    WHERE slug = pair.survivor_slug
      AND facility_id = 1
      AND status <> 'archived';

    SELECT id, legacy_exercise_id, status
    INTO duplicate_id, duplicate_legacy_id, duplicate_status
    FROM coaching.exercise_definition_v1
    WHERE slug = pair.duplicate_slug
      AND facility_id = facility;

    IF survivor_id IS NULL THEN
      RAISE EXCEPTION
        '% requires active survivor %',
        migration_key,
        pair.survivor_slug;
    END IF;

    IF duplicate_id IS NULL THEN
      RAISE EXCEPTION
        '% requires traceable duplicate %',
        migration_key,
        pair.duplicate_slug;
    END IF;

    IF duplicate_status = 'archived' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_identity_resolution_v1 resolution
        WHERE resolution.survivor_definition_id = survivor_id
          AND resolution.resolved_definition_id = duplicate_id
          AND resolution.decision = 'duplicate_consolidated'
      ) THEN
        RAISE EXCEPTION
          '% found archived duplicate % without identity resolution',
          migration_key,
          pair.duplicate_slug;
      END IF;
      CONTINUE;
    END IF;

    IF duplicate_legacy_id IS NULL THEN
      RAISE EXCEPTION
        '% requires legacy traceability for %',
        migration_key,
        pair.duplicate_slug;
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
        '% conflicts with protected identity decision for % and %',
        migration_key,
        pair.survivor_slug,
        pair.duplicate_slug;
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
        FROM coaching.exercise_delivery_profile_v1 profile
        JOIN coaching.exercise_variant_v1 variant
          ON variant.id = profile.variant_id
        WHERE variant.definition_id IN (survivor_id, duplicate_id)
          AND profile.status = 'published'
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
        JOIN coaching.exercise_variant_v1 variant
          ON variant.id = calibration.variant_id
        WHERE variant.definition_id IN (survivor_id, duplicate_id)
          AND (
            calibration.status <> 'review'
            OR calibration.reviewed_by IS NOT NULL
            OR calibration.reviewed_at IS NOT NULL
          )
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_score_v1 score
        WHERE score.exercise_id IN (
          SELECT source.legacy_exercise_id
          FROM coaching.exercise_definition_source_v1 source
          WHERE source.definition_id IN (survivor_id, duplicate_id)
        )
          AND (
            score.human_review_status <> 'queued'
            OR score.reviewed_by IS NOT NULL
            OR score.reviewed_at IS NOT NULL
          )
      )
    INTO protected_records;

    IF protected_records > 0 THEN
      RAISE EXCEPTION
        '% refused to override % protected record(s) for % and %',
        migration_key,
        protected_records,
        pair.survivor_slug,
        pair.duplicate_slug;
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
      pair.rationale,
      jsonb_build_object(
        'match', pair.identity_match,
        'survivorSlug', pair.survivor_slug,
        'resolvedSlug', pair.duplicate_slug,
        'legacySourceCardsAudited', TRUE,
        'researchSources', pair.research_sources,
        'variantDimensions', pair.variant_dimensions,
        'dimensionIsExactVariant', TRUE,
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'decisionScope',
          'identity_and_traceability_only_not_human_approval',
        'humanReviewRequired', TRUE,
        'reviewerAssigned', FALSE,
        'publicationQuarantined', TRUE,
        'migration', migration_key
      ),
      'deterministic_identity_equivalence',
      NULL,
      now()
    )
    ON CONFLICT (survivor_definition_id, resolved_definition_id)
    DO UPDATE SET
      decision = EXCLUDED.decision,
      rationale = EXCLUDED.rationale,
      evidence_json = EXCLUDED.evidence_json,
      resolution_source = EXCLUDED.resolution_source,
      reviewed_by = NULL,
      resolved_at = now()
    WHERE coaching.exercise_identity_resolution_v1.resolution_source
      <> 'human_review';

    UPDATE coaching.exercise_definition_source_v1
    SET definition_id = survivor_id,
        source_kind = 'duplicate_consolidation',
        provenance_json = provenance_json || jsonb_build_object(
          'resolvedFromDefinitionId', duplicate_id,
          'resolution', pair.identity_match,
          'variantDimensions', pair.variant_dimensions,
          'researchSources', pair.research_sources,
          'migration', migration_key
        )
    WHERE definition_id = duplicate_id;

    UPDATE coaching.exercise_delivery_profile_v1 profile
    SET status = 'archived',
        updated_at = now()
    WHERE profile.variant_id IN (
      SELECT id
      FROM coaching.exercise_variant_v1
      WHERE definition_id = duplicate_id
    );

    UPDATE coaching.exercise_variant_v1
    SET definition_id = survivor_id,
        variant_key = left(
          'legacy-source-'
          || duplicate_legacy_id::TEXT
          || '-'
          || variant_key,
          120
        ),
        status = 'archived',
        requirements_json = requirements_json || jsonb_build_object(
          'sourceIdentityDuplicate', TRUE,
          'sourceDefinitionId', duplicate_id,
          'variantDimensions', pair.variant_dimensions,
          'selectable', FALSE,
          'identityQuarantine', TRUE,
          'migration', migration_key
        ),
        updated_at = now()
    WHERE definition_id = duplicate_id;

    UPDATE coaching.exercise_section_evidence_v1 candidate
    SET definition_id = survivor_id,
        reviewed_card_version = survivor_version,
        updated_at = now()
    WHERE candidate.definition_id = duplicate_id
      AND candidate.review_status IN ('candidate', 'superseded')
      AND NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_section_evidence_v1 source_peer
        WHERE source_peer.definition_id = duplicate_id
          AND source_peer.review_status IN ('candidate', 'superseded')
          AND source_peer.section_key = candidate.section_key
          AND source_peer.source_url = candidate.source_url
          AND source_peer.id::TEXT < candidate.id::TEXT
      )
      AND NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_section_evidence_v1 existing
        WHERE existing.definition_id = survivor_id
          AND existing.reviewed_card_version = survivor_version
          AND existing.section_key = candidate.section_key
          AND existing.source_url = candidate.source_url
      );

    UPDATE coaching.exercise_alternate_assessment_v1 candidate
    SET definition_id = survivor_id,
        reviewed_card_version = survivor_version,
        updated_at = now()
    WHERE candidate.definition_id = duplicate_id
      AND candidate.review_status IN ('candidate', 'superseded')
      AND NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_alternate_assessment_v1 source_peer
        WHERE source_peer.definition_id = duplicate_id
          AND source_peer.review_status IN ('candidate', 'superseded')
          AND lower(source_peer.alternate_name) =
            lower(candidate.alternate_name)
          AND source_peer.id::TEXT < candidate.id::TEXT
      )
      AND NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_alternate_assessment_v1 existing
        WHERE existing.definition_id = survivor_id
          AND existing.reviewed_card_version = survivor_version
          AND lower(existing.alternate_name) = lower(candidate.alternate_name)
      );

    UPDATE coaching.exercise_media_candidate_v1 candidate
    SET definition_id = survivor_id,
        reviewed_card_version = survivor_version,
        updated_at = now()
    WHERE candidate.definition_id = duplicate_id
      AND candidate.review_status IN ('candidate', 'superseded')
      AND NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_media_candidate_v1 source_peer
        WHERE source_peer.definition_id = duplicate_id
          AND source_peer.review_status IN ('candidate', 'superseded')
          AND source_peer.id::TEXT < candidate.id::TEXT
          AND (
            source_peer.video_id = candidate.video_id
            OR source_peer.url = candidate.url
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_media_candidate_v1 existing
        WHERE existing.definition_id = survivor_id
          AND existing.reviewed_card_version = survivor_version
          AND (
            existing.video_id = candidate.video_id
            OR existing.url = candidate.url
          )
      );

    UPDATE coaching.exercise_definition_v1 survivor
    SET canonical_name = COALESCE(
          pair.survivor_display_name,
          survivor.canonical_name
        ),
        display_name = COALESCE(
          pair.survivor_display_name,
          survivor.display_name
        ),
        aliases = ARRAY(
          SELECT min(alias)
          FROM unnest(
            COALESCE(survivor.aliases, '{}')
            || COALESCE(duplicate.aliases, '{}')
            || ARRAY[
              survivor.canonical_name,
              survivor.display_name,
              duplicate.canonical_name,
              duplicate.display_name,
              pair.retained_alias
            ]
          ) alias
          WHERE nullif(btrim(alias), '') IS NOT NULL
            AND lower(alias) NOT IN (
              lower(
                COALESCE(
                  pair.survivor_display_name,
                  survivor.canonical_name
                )
              ),
              lower(
                COALESCE(
                  pair.survivor_display_name,
                  survivor.display_name
                )
              )
            )
          GROUP BY lower(alias)
          ORDER BY lower(alias)
        ),
        provenance_json = survivor.provenance_json || jsonb_build_object(
          'identityResolution', pair.identity_match,
          'identityMigration', migration_key,
          'consolidatedDefinitionIds',
            COALESCE(
              survivor.provenance_json->'consolidatedDefinitionIds',
              '[]'::JSONB
            ) || to_jsonb(duplicate_id::TEXT),
          'consolidatedLegacyExerciseIds',
            COALESCE(
              survivor.provenance_json->'consolidatedLegacyExerciseIds',
              '[]'::JSONB
            ) || to_jsonb(duplicate_legacy_id),
          'variantDimensions', pair.variant_dimensions,
          'researchSources', pair.research_sources,
          'difficultyModel',
            'max_exercise_complexity_physical_difficulty',
          'stableDisplayName',
            COALESCE(
              pair.survivor_display_name,
              survivor.display_name
            ),
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE
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
              'Re-run the canonical card audit after score-77 identity consolidation.',
            'resolvedSlug', pair.duplicate_slug
          )
        ),
        human_review_required = TRUE,
        checked_at = now()
    WHERE definition_id = survivor_id;

    UPDATE coaching.exercise_definition_v1
    SET status = 'archived',
        approved_video_url = NULL,
        reviewed_by = NULL,
        approved_by = NULL,
        last_reviewed_at = NULL,
        provenance_json = provenance_json || jsonb_build_object(
          'identityResolution', 'duplicate_consolidated',
          'canonicalSurvivorDefinitionId', survivor_id,
          'identityMatch', pair.identity_match,
          'variantDimensions', pair.variant_dimensions,
          'researchSources', pair.research_sources,
          'identityMigration', migration_key,
          'difficultyModel',
            'max_exercise_complexity_physical_difficulty',
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE
        ),
        updated_at = now()
    WHERE id = duplicate_id;

    IF NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.survivor_definition_id = survivor_id
        AND resolution.resolved_definition_id = duplicate_id
        AND resolution.decision = 'duplicate_consolidated'
    ) OR EXISTS (
      SELECT 1
      FROM coaching.exercise_definition_v1
      WHERE id = duplicate_id
        AND status <> 'archived'
    ) THEN
      RAISE EXCEPTION
        '% did not fully consolidate % into %',
        migration_key,
        pair.duplicate_slug,
        pair.survivor_slug;
    END IF;
  END LOOP;
END;
$$;
