-- Consolidate mechanically supported duplicate and controlled-variant
-- identities in the score-75 canonical queue.
--
-- Source mappings, aliases, candidate evidence/media, and archived legacy
-- variants remain traceable. This migration creates no human approval.
-- Exercise cards use exercise complexity and physical difficulty only;
-- skill/proficiency levels remain exclusive to coaching.skill.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '390_coaching_score_75_variant_identity_consolidations';
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
        'atlas-stone-d-ball-bear-hug-carry-strength',
        'bear-hug-sandbag-carry',
        'Bear-Hug Sandbag Carry',
        'Bear-Hug Carry',
        'same_bear_hug_loaded_gait_with_round_or_soft_implement_variant',
        'Both sources secure an implement against the anterior trunk, walk under load while controlling posture and breathing, and own the pickup and set-down. Stone, D-ball, and sandbag delivery changes implement material, shape, load, grip, pickup, route, distance, rest, and dose within the bear-hug carry identity.',
        '["implement","material","shape","load","grip","pickup","set_down","route","distance","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38665162/"]'::JSONB
      ),
      (
        'dead-bug-heel-tap',
        'dead-bug-heel-tap-control-progression',
        'Dead Bug Heel Tap / Dead Bug Progression',
        NULL::TEXT,
        'same_dead_bug_heel_tap_with_lever_range_and_control_progressions',
        'Both sources establish the same supine braced dead-bug position, lower one heel toward the floor without losing rib-pelvis control, and alternate or reset under control. Lever length, range, contralateral arm position, tempo, repetitions, rest, and dose are controlled variants.',
        '["lever_length","range","arm_position","laterality_sequence","tempo","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB
      ),
      (
        'deep-squat-pry',
        'deep-squat-pry-with-reach',
        'Deep Squat Pry with Reach',
        NULL::TEXT,
        'same_deep_squat_pry_with_arm_reach_and_thoracic_rotation_variant',
        'Both sources settle into an owned deep squat and use controlled pressure or weight shift to explore hip and ankle range without leaving the squat. Adding an arm reach changes arm position, thoracic rotation, gaze, reach direction, hold duration, repetitions, rest, and dose within the pry identity.',
        '["arm_position","thoracic_rotation","gaze","reach_direction","hold_duration","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'hollow-body-hold',
        'dumbbell-hollow-body-pullover-hold',
        'Dumbbell Hollow-Body Pullover Hold',
        NULL::TEXT,
        'same_hollow_body_isometric_with_implement_and_arm_position_variant',
        'Both sources hold a supine hollow body line by maintaining posterior pelvic control while the limbs lengthen within an owned range. A dumbbell pullover position changes implement, external load, grip, arm angle, lever length, hold duration, rest, and dose within the hollow-body hold identity.',
        '["implement","external_load","grip","arm_angle","lever_length","range","hold_duration","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB
      ),
      (
        'dumbbell-kettlebell-floor-press',
        'sandbag-floor-press-strength',
        'Sandbag Floor Press',
        'Floor Press',
        'same_supine_floor_limited_press_with_implement_variant',
        'Both sources lie supine, begin with the upper arms limited by the floor, press external load through elbow extension and shoulder horizontal adduction, and return under control. Sandbag, dumbbell, and kettlebell delivery changes implement, grip, load symmetry, stability, range, tempo, rest, and dose within the floor-press identity.',
        '["implement","grip","load_symmetry","stability","range","tempo","load","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB
      ),
      (
        'front-squat',
        'goblet-squat',
        'Goblet Squat',
        NULL::TEXT,
        'same_anterior_loaded_squat_with_center_chest_load_position_variant',
        'The completed Front Squat identity already supports barbell and front-racked dumbbell or kettlebell delivery while the athlete descends and stands with an anterior load. Goblet delivery changes implement count, grip, center-chest load position, elbow position, stance, range, load, rest, and dose within that identity.',
        '["implement","implement_count","grip","load_position","elbow_position","stance","range","load","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'landmine-ball-grip-rotational-press',
        'landmine-split-stance-rotational-press',
        'Landmine Split-Stance Rotational Press',
        NULL::TEXT,
        'same_rotational_landmine_press_with_stance_and_attachment_variants',
        'Both sources deliberately rotate through the hips and trunk, pivot as declared, and press the fixed landmine end through an angled path. Split stance and ball-grip delivery change stance, lead leg, attachment, grip, load symmetry, range, load, rest, and side dosage within the rotational landmine press identity.',
        '["stance","lead_leg","attachment","grip","load_symmetry","range","load","rest","side_dose"]'::JSONB,
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'landmine-press',
        'landmine-neutral-handle-press',
        'Landmine Neutral-Handle Press',
        NULL::TEXT,
        'same_landmine_press_with_neutral_handle_attachment_variant',
        'Both sources press a fixed landmine end through the same angled path and controlled return. A neutral handle changes attachment, grip, hand count, wrist position, load symmetry, stance, range, load, rest, and dose within the landmine-press identity.',
        '["attachment","grip","hand_count","wrist_position","load_symmetry","stance","range","load","rest","dose"]'::JSONB,
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'med-ball-squat-press-hiit-fitness',
        'wall-ball-squat-to-press-pattern',
        'Wall Ball Squat-to-Press Pattern',
        'Medicine Ball Squat to Press',
        'same_squat_to_overhead_ball_press_with_wall_target_and_release_variants',
        'Both sources descend through a squat and drive a medicine ball upward as the athlete stands. Wall-ball delivery changes target, release, catch, rebound, cadence, interval structure, load, rest, and dose within the medicine-ball squat-to-press identity.',
        '["target","release","catch","rebound","cadence","interval_structure","load","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'medicine-ball-clean-to-squat',
        'slam-ball-clean-to-front-squat',
        'Slam Ball Clean to Front Squat',
        NULL::TEXT,
        'same_floor_clean_to_front_loaded_squat_with_ball_implement_variant',
        'Both sources lift a ball from the floor, receive it at the anterior body, descend into a controlled front-loaded squat, stand, and reset. Medicine-ball versus slam-ball delivery changes material, rebound, diameter, grip, pickup, load, tempo, rest, and dose within the clean-to-squat identity.',
        '["implement","material","rebound","diameter","grip","pickup","load","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'push-up',
        'tempo-push-up',
        'Tempo Push-Up',
        NULL::TEXT,
        'same_push_up_with_phase_duration_variant',
        'Both sources maintain a braced body line while lowering between fixed hand support and pressing back to the start. Tempo delivery changes eccentric duration, pauses, concentric duration, range, leverage, repetition duration, rest, and dose within the push-up identity.',
        '["eccentric_duration","pause","concentric_duration","range","leverage","repetition_duration","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/29541105/","https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'push-up',
        'tempo-eccentric-push-up',
        'Tempo / Eccentric Push-Up',
        NULL::TEXT,
        'same_push_up_with_eccentric_emphasis_and_assisted_return_variant',
        'Both sources maintain a braced body line while lowering between fixed hand support. Eccentric emphasis changes contraction mode, lowering duration, return strategy, assistance, range, leverage, repetitions, rest, and dose within the push-up identity.',
        '["contraction_mode","eccentric_duration","return_strategy","assistance","range","leverage","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/29541105/","https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'scapular-push-up',
        'quadruped-scapular-push-up-hold',
        'Quadruped Scapular Push-Up Hold',
        NULL::TEXT,
        'same_straight_arm_scapular_push_up_with_quadruped_and_isometric_variants',
        'Both sources keep the elbows straight and control scapular protraction and retraction through hand support. Quadruped and hold delivery changes base, relative load, contraction mode, range, hold duration, tempo, repetitions, rest, and dose within the scapular push-up identity.',
        '["base","relative_load","contraction_mode","range","hold_duration","tempo","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB
      ),
      (
        'scapular-push-up',
        'scapular-push-up-plus-iso-hold',
        'Scapular Push-Up Plus Iso Hold',
        NULL::TEXT,
        'same_straight_arm_scapular_push_up_with_end_range_protraction_hold_variant',
        'Both sources keep the elbows straight and move or hold the scapulae under hand support. Push-up-plus isometric delivery emphasizes end-range protraction, changing contraction mode, hold duration, base, relative load, range, tempo, rest, and dose within the scapular push-up identity.',
        '["contraction_mode","hold_duration","base","relative_load","range","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB
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
              'Re-run the canonical card audit after score-75 identity consolidation.',
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
