-- Consolidate the mechanically supported duplicate/variant identities in the
-- score-80 canonical queue.
--
-- Stable survivors retain source traceability, aliases, candidate evidence,
-- candidate media, and archived legacy variants. Start stance, implement,
-- support, bar position, tempo, pause, direction, range, and dosage remain
-- exact variant dimensions. This migration creates no human approval.
--
-- Exercise cards use exercise complexity and physical difficulty only. Athlete
-- skill/proficiency levels remain exclusive to skill-library cards.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '380_coaching_score_80_variant_identity_consolidations';
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
        '10-yard-sprint',
        'two-point-start-to-5-10-yard-sprint',
        'Two-Point Start to 5–10 Yard Sprint',
        'same_short_linear_acceleration_with_two_point_start_variant',
        'Both sources accelerate maximally or near-maximally through a short 5-to-10-yard lane. The two-point source declares the starting stance and first-step contract that the generic sprint card leaves variable. Start stance, lead leg, distance, cue, intent, timing, rest, and dose remain exact variants.',
        '["start_stance","lead_leg","start_cue","distance","distance_unit","intent","measurement","rest","dose"]'::JSONB
      ),
      (
        'pistol-squat',
        'assisted-pistol-squat',
        'Assisted Pistol Squat',
        'same_deep_single_leg_squat_with_external_assistance_variant',
        'Both sources perform a controlled deep squat on one support leg and return through that leg. External hand, strap, rack, or counterweight assistance changes balance demand, usable range, support, load, tempo, and dose within the pistol-squat identity.',
        '["assistance_type","assistance_amount","support_side","range","counterweight","load","tempo","rest","dose"]'::JSONB
      ),
      (
        'back-squat',
        'low-bar-back-squat',
        'Low-Bar Back Squat',
        'same_barbell_back_squat_with_low_bar_position_variant',
        'Both sources use a barbell supported across the posterior shoulder girdle while the athlete squats and returns to standing. Low-bar placement changes torso and joint strategy, grip, stance, depth, load, and coaching constraints within the back-squat identity.',
        '["bar_position","grip_width","stance","depth","torso_strategy","load","tempo","rest","dose"]'::JSONB
      ),
      (
        'back-squat',
        'pause-back-squat',
        'Pause Back Squat',
        'same_barbell_back_squat_with_bottom_pause_variant',
        'Both sources use the same barbell back-squat setup and movement path. A declared pause removes the immediate reversal and changes pause position, duration, rebound policy, load, tempo, rest, and dose within the back-squat identity.',
        '["pause_position","pause_duration","rebound_policy","bar_position","stance","depth","load","tempo","rest","dose"]'::JSONB
      ),
      (
        'back-squat',
        'tempo-back-squat',
        'Tempo Back Squat',
        'same_barbell_back_squat_with_declared_movement_tempo_variant',
        'Both sources use the same barbell back-squat setup and joint actions. A prescribed eccentric, pause, or concentric cadence changes time under tension, contraction emphasis, load, range, rest, and dose within the back-squat identity.',
        '["eccentric_duration","bottom_pause","concentric_intent","bar_position","stance","range","load","rest","dose"]'::JSONB
      ),
      (
        'barbell-bench-press',
        'bench-pin-press',
        'Bench Pin Press',
        'same_barbell_bench_press_with_pin_height_and_dead_start_variant',
        'Both sources use a supine bench-supported barbell press through the horizontal pressing path. Starting the bar from safety pins creates a declared dead start and targeted range or sticking point while preserving the bench-press identity. Pin height, start direction, range, pause, rack, spotting, load, rest, and dose remain exact variants.',
        '["pin_height","dead_start","start_direction","range","pause_duration","rack_setup","spotting","load","rest","dose"]'::JSONB
      ),
      (
        'barbell-bench-press',
        'dumbbell-bench-press',
        'Dumbbell Bench Press',
        'same_supine_bench_horizontal_press_with_implement_variant',
        'Both sources use a supine bench-supported base, lower external resistance toward the chest through a controlled horizontal pressing path, and press to extension. A barbell versus independent dumbbells changes implement quantity, grip, independent-arm demand, path freedom, range, setup, spotting, load, and dose within the bench-press identity.',
        '["implement","implement_quantity","grip","independent_arm_demand","path_constraint","range","rack_setup","spotting","load","rest","dose"]'::JSONB
      ),
      (
        'barbell-bench-press',
        'paused-bench-press',
        'Paused Bench Press',
        'same_bench_press_with_chest_pause_variant',
        'Both sources use a supine bench-supported horizontal press, lower the external resistance toward the chest, and press to extension. A deliberate chest pause changes pause position and duration, rebound policy, implement, range, load, tempo, spotting, rest, and dose within the Bench Press identity.',
        '["pause_position","pause_duration","rebound_policy","implement","range","load","tempo","rack_setup","spotting","rest","dose"]'::JSONB
      ),
      (
        'drop-jump',
        'depth-drop-to-horizontal-rebound',
        'Depth Drop to Horizontal Rebound',
        'same_elevated_step_off_to_immediate_rebound_with_horizontal_direction_variant',
        'Both sources remove the first takeoff by stepping from an elevated surface, receive the ground contact, and immediately rebound. Horizontal rather than vertical projection changes rebound direction, distance, landing or run-out, box height, contact target, measurement, rest, and dose within the drop-jump identity.',
        '["rebound_direction","projection_distance","landing_or_runout","box_height","contact_target","measurement","rest","dose"]'::JSONB
      ),
      (
        'ring-row',
        'ring-row-trx-row',
        'Ring Row / TRX Row',
        'same_suspension_bodyweight_row_with_apparatus_variant',
        'Both sources hold independent suspension handles, maintain a straight body line, pull the chest toward the handles, and lower under control. Rings versus a TRX-style trainer changes apparatus, handle behavior, anchor height, body angle, foot position, range, tempo, and dose within the suspension-row identity.',
        '["apparatus","handle_behavior","anchor_height","body_angle","foot_position","range","tempo","rest","dose"]'::JSONB
      ),
      (
        'zercher-squat',
        'sandbag-zercher-squat-strength',
        'Sandbag Zercher Squat',
        'same_crook_of_elbow_squat_with_sandbag_implement_variant',
        'Both sources support the external load in the elbow creases, maintain trunk stiffness, squat through a controlled range, and stand. A sandbag instead of a barbell changes implement shape, pickup and set-down, load distribution, grip assistance, stance, range, load, and dose within the Zercher-squat identity.',
        '["implement","pickup_method","setdown_method","load_distribution","grip_assistance","stance","range","load","rest","dose"]'::JSONB
      ),
      (
        'single-leg-romanian-deadlift',
        'single-leg-rdl-negative',
        'Single-Leg RDL Negative',
        'same_single_leg_hip_hinge_with_eccentric_emphasis_variant',
        'Both sources balance on one leg, hinge through the support hip while the free leg reaches back, and return from a controlled range. A slow negative changes eccentric duration, concentric assistance, external load, reach, range, balance support, rest, and dose within the single-leg Romanian-deadlift identity.',
        '["contraction_emphasis","eccentric_duration","concentric_assistance","implement","load_position","reach","range","balance_support","rest","dose"]'::JSONB
      ),
      (
        'tibialis-raise-iso-hold',
        'tibialis-iso-toe-up-hold',
        'Tibialis ISO Toe-Up Hold',
        'same_isometric_ankle_dorsiflexion_hold',
        'Both sources keep the heel down, lift the forefoot toward the shin, and hold the dorsiflexed position without visible ankle motion. Wall support, body angle, unilateral or bilateral setup, hold duration, effort, load, rest, and dose remain exact variants.',
        '["support","body_angle","laterality","hold_position","hold_duration","effort","load","rest","dose"]'::JSONB
      ),
      (
        'worlds-greatest-stretch',
        'worlds-greatest-stretch-with-rotation',
        'World''s Greatest Stretch with Rotation',
        'same_lunge_mobility_sequence_with_thoracic_rotation',
        'Both sources use a long-lunge position, bring the hand or elbow toward the instep, rotate the chest and arm upward, and shift toward a hamstring reach. Step-through method, elbow depth, rotation range, hamstring shift, transition order, breathing, hold duration, and dose remain exact delivery variants.',
        '["step_through_method","elbow_depth","rotation_range","hamstring_shift","transition_order","breathing","hold_duration","dose"]'::JSONB
      )
    ) AS pairs(
      survivor_slug,
      duplicate_slug,
      retained_alias,
      identity_match,
      rationale,
      variant_dimensions
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
        FROM coaching.exercise_media_candidate_v1 existing
        WHERE existing.definition_id = survivor_id
          AND existing.reviewed_card_version = survivor_version
          AND (
            existing.video_id = candidate.video_id
            OR existing.url = candidate.url
          )
      );

    UPDATE coaching.exercise_definition_v1 survivor
    SET canonical_name = CASE
          WHEN pair.survivor_slug = 'barbell-bench-press'
            THEN 'Bench Press'
          ELSE survivor.canonical_name
        END,
        display_name = CASE
          WHEN pair.survivor_slug = 'barbell-bench-press'
            THEN 'Bench Press'
          ELSE survivor.display_name
        END,
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
                CASE
                  WHEN pair.survivor_slug = 'barbell-bench-press'
                    THEN 'Bench Press'
                  ELSE survivor.canonical_name
                END
              ),
              lower(
                CASE
                  WHEN pair.survivor_slug = 'barbell-bench-press'
                    THEN 'Bench Press'
                  ELSE survivor.display_name
                END
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
          'difficultyModel',
            'max_exercise_complexity_physical_difficulty',
          'stableDisplayName',
            CASE
              WHEN pair.survivor_slug = 'barbell-bench-press'
                THEN 'Bench Press'
              ELSE survivor.display_name
            END,
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
              'Re-run the canonical card audit after score-80 identity consolidation.',
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
