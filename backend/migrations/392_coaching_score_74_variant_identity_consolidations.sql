-- Consolidate mechanically supported duplicate and controlled-variant
-- identities in the score-74 canonical queue.
--
-- Source mappings, aliases, candidate evidence/media, and archived legacy
-- variants remain traceable. This migration creates no human approval.
-- Exercise cards use exercise complexity and physical difficulty only;
-- skill/proficiency levels remain exclusive to coaching.skill.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '392_coaching_score_74_variant_identity_consolidations';
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
        'build-up-sprint-stride-out',
        '20-20-20-build-up-sprint',
        '20-20-20 Build-Up Sprint',
        NULL::TEXT,
        'same_progressive_straight_sprint_with_segmented_speed_cue_variant',
        'Both sources run a straight progressive acceleration exposure rather than a maximal start. The 20-20-20 label fixes three distance segments and their effort cues; segment distance, target effort, total distance, approach, exit, repetitions, rest, and dose are delivery dimensions within the build-up sprint identity.',
        '["segment_distance","target_effort","total_distance","approach","exit","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        '90-degree-speed-cut',
        '90-degree-cut-drill',
        '90-Degree Cut Drill',
        NULL::TEXT,
        'same_preplanned_ninety_degree_cut_with_speed_and_exit_variants',
        'Both sources approach a declared plant, redirect approximately ninety degrees, and leave on the new line. Approach speed, approach distance, plant foot, braking emphasis, exit speed, cone layout, repetitions, rest, and side dosage are controlled variants of the preplanned ninety-degree cut.',
        '["approach_speed","approach_distance","plant_foot","braking_emphasis","exit_speed","cone_layout","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB
      ),
      (
        '90-degree-speed-cut',
        '90-degree-cut-and-stick',
        '90-Degree Cut and Stick',
        NULL::TEXT,
        'same_preplanned_ninety_degree_cut_with_terminal_stick_variant',
        'Both sources approach a declared plant and redirect approximately ninety degrees. The stick delivery terminates in an owned balance position while the speed delivery reaccelerates; approach speed, plant foot, braking emphasis, terminal behavior, hold, repetitions, rest, and side dosage are controlled variants of the same cut identity.',
        '["approach_speed","plant_foot","braking_emphasis","terminal_behavior","hold_duration","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB
      ),
      (
        'ankling-pogo-hop',
        'wall-ankling-pogo',
        'Wall Ankling Pogo',
        'Ankling Pogo',
        'same_ankling_pogo_with_wall_support_and_body_angle_variant',
        'Both sources repeat short ankle-dominant contacts while maintaining a stiff elastic posture. Wall delivery changes external support, body angle, travel, balance demand, contact count, cadence, repetitions, rest, and dose within the ankling-pogo identity.',
        '["external_support","body_angle","travel","balance_demand","contact_count","cadence","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/"]'::JSONB
      ),
      (
        'step-up',
        'barbell-step-up',
        'Barbell Step-Up',
        NULL::TEXT,
        'same_step_up_with_barbell_load_position_variant',
        'Both sources place one whole foot on an elevated platform, ascend under control, and own the top and descent. Barbell delivery changes implement, load position, grip, pickup, spotting, load, platform height, repetitions, rest, and side dosage within the step-up identity.',
        '["implement","load_position","grip","pickup","spotting","load","platform_height","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'box-jump',
        'box-jump-step-down-reset',
        'Box Jump — Step-Down Reset',
        NULL::TEXT,
        'same_box_jump_with_explicit_step_down_reset_delivery',
        'The canonical Box Jump already requires a floor takeoff, stable box landing, stand, and controlled step-down reset. This source makes the step-down and reset explicit; box height, countermovement, landing hold, exit, repetitions, rest, and dose remain delivery dimensions.',
        '["box_height","countermovement","landing_hold","exit","reset","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        'box-jump',
        'reset-repetition-box-jump',
        'Reset-Repetition Box Jump',
        NULL::TEXT,
        'same_box_jump_with_non_rebound_reset_repetition_delivery',
        'Both sources perform one floor-to-box jump, own the landing, exit safely, and reset before the next repetition. The reset label changes cadence, pause, exit, box height, landing hold, repetitions, rest, and dose rather than the exercise identity.',
        '["cadence","pause","exit","box_height","landing_hold","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        'drop-landing-to-stick',
        'low-box-drop-to-eccentric-landing-stick',
        'Low-Box Drop to Eccentric Landing Stick',
        NULL::TEXT,
        'same_drop_landing_with_low_box_and_eccentric_emphasis_variant',
        'Both sources begin elevated, remove active takeoff, absorb the imposed floor landing, and hold an owned terminal position. Low-box height and eccentric emphasis change drop height, descent cue, landing depth, hold, repetitions, rest, and dose within the drop-landing identity.',
        '["drop_height","descent_cue","landing_depth","eccentric_emphasis","hold_duration","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'drop-landing-to-stick',
        'low-box-step-off-to-stick',
        'Low-Box Step-Off to Stick',
        NULL::TEXT,
        'same_drop_landing_with_step_off_entry_and_low_box_variant',
        'Both sources step or roll from a low elevated surface without a concentric jump, absorb the floor contact, and hold the landing. Lead foot, step-off cue, drop height, landing stance, hold, repetitions, rest, and dose are controlled variants of the drop-landing identity.',
        '["lead_foot","step_off_cue","drop_height","landing_stance","hold_duration","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'dumbbell-incline-press',
        'incline-barbell-bench-press',
        'Incline Barbell Bench Press',
        'Incline Press',
        'same_incline_bench_press_with_implement_and_load_symmetry_variant',
        'Both sources press external load from an inclined bench through the same declared shoulder and elbow pattern. Barbell versus dumbbell delivery changes implement, hand independence, load symmetry, grip width, setup, spotting, load, repetitions, rest, and dose within the incline-press identity.',
        '["implement","hand_independence","load_symmetry","grip_width","setup","spotting","load","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/36026487/"]'::JSONB
      ),
      (
        'front-squat',
        'medicine-ball-front-squat',
        'Medicine Ball Front Squat',
        NULL::TEXT,
        'same_anterior_loaded_squat_with_medicine_ball_hold_variant',
        'The canonical Front Squat already owns the bilateral squat with an anterior retained load. Medicine-ball delivery changes implement, grip, center-chest or front-rack position, load ceiling, pickup, stance, range, repetitions, rest, and dose within that identity.',
        '["implement","grip","load_position","load_ceiling","pickup","stance","range","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'split-squat',
        'front-foot-elevated-split-squat',
        'Front-Foot-Elevated Split Squat',
        NULL::TEXT,
        'same_stationary_split_squat_with_front_platform_and_range_variant',
        'Both sources maintain a stationary staggered stance, descend under control, and return without stepping. Elevating the whole lead foot changes platform support, platform height, joint range, lead-leg bias, balance, load, repetitions, rest, and side dosage within the split-squat identity.',
        '["front_platform","platform_height","range","lead_leg_bias","balance","load","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'high-dribble-run',
        'low-dribble-run',
        'Low Dribble Run',
        'Dribble Run',
        'same_dribble_run_with_center_of_mass_and_contact_height_variant',
        'Both sources use rapid sprint-specific dribble contacts while advancing under controlled rhythm. High versus low delivery changes center-of-mass height, contact position, projection, cadence, distance, speed, repetitions, rest, and dose within the dribble-run identity.',
        '["center_of_mass_height","contact_position","projection","cadence","distance","speed","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'mini-hurdle-sprint-rhythm',
        'mini-hurdle-wicket-rhythm-run',
        'Mini-Hurdle Sprint Rhythm',
        'Mini-Hurdle Wicket Rhythm Run',
        'same_wicket_rhythm_run_with_spacing_and_run_in_variants',
        'Both sources run through low mini-hurdles or wickets to organize sprint rhythm rather than jump over them. Hurdle height, spacing, run-in, cadence, target speed, exit, repetitions, rest, and dose are delivery dimensions within the wicket-rhythm run identity.',
        '["hurdle_height","spacing","run_in","cadence","target_speed","exit","repetitions","rest","dose"]'::JSONB,
        '["https://www.nsca.com/contentassets/bac87829413a4b45b3e9e78d0c9b113a/coach-5.4.1-running-mechanics.pdf"]'::JSONB
      ),
      (
        'parallel-bar-dip',
        'parallel-bar-dip-progression',
        'Parallel-Bar Dip Progression',
        NULL::TEXT,
        'same_parallel_bar_dip_with_assistance_range_and_load_progressions',
        'Both sources support the body on parallel bars, lower through owned shoulder and elbow range, and press to stable support. Progression delivery changes assistance, external load, range, tempo, repetitions, rest, and dose within the parallel-bar dip identity.',
        '["assistance","external_load","range","tempo","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'single-leg-balance-hold-tripod-foot',
        'perturbation-single-leg-balance',
        'Perturbation Single-Leg Balance',
        NULL::TEXT,
        'same_single_leg_balance_hold_with_external_perturbation_overlay',
        'Both sources maintain an upright one-leg support and recover without placing the free foot down. Perturbation delivery adds an external disturbance and changes partner or device input, perturbation direction, timing, predictability, hold, repetitions, rest, and side dosage within the single-leg balance identity.',
        '["external_perturbation","input_source","perturbation_direction","timing","predictability","hold_duration","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30366506/"]'::JSONB
      ),
      (
        'sandbag-front-loaded-squat-strength',
        'slam-ball-bear-hug-squat',
        'Slam-Ball Bear-Hug Squat',
        NULL::TEXT,
        'same_front_loaded_bear_hug_squat_with_implement_material_variant',
        'Both sources retain an implement against the anterior trunk, complete a bilateral squat, stand, and reset under control. Sandbag versus slam-ball delivery changes material, shape, grip, rebound, load ceiling, pickup, repetitions, rest, and dose within the front-loaded squat identity.',
        '["implement","material","shape","grip","rebound","load_ceiling","pickup","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'skipping-rhythm-drill',
        'skipping-rhythm-change',
        'Skipping Rhythm Change',
        NULL::TEXT,
        'same_skipping_pattern_with_cadence_transition_variant',
        'Both sources repeat the same alternating skip cycle while traveling with coordinated arm action. A rhythm-change delivery varies cadence or segment timing; cadence sequence, distance, speed, cue, repetitions, rest, and dose are controlled variants within the skipping identity.',
        '["cadence_sequence","segment_timing","distance","speed","cue","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'step-down-to-hover',
        'lateral-step-down',
        'Lateral Step-Down',
        'Step-Down',
        'same_single_leg_step_down_with_direction_and_target_contact_variant',
        'Both sources stand on a low elevated surface, lower the free foot under control without transferring meaningful weight, and return through the stance leg. Lateral versus forward or unspecified delivery changes free-leg direction, target contact, platform height, range, tempo, repetitions, rest, and side dosage within the step-down identity.',
        '["free_leg_direction","target_contact","platform_height","range","tempo","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'step-down-to-hover',
        'step-down-to-stick',
        'Step-Down to Stick',
        'Step-Down',
        'same_elevated_step_down_with_terminal_balance_label_variant',
        'Both sources begin on a low elevated surface, lower one leg toward the floor under control, and finish in an owned single-leg position before reset. Hover versus stick labels change target contact, terminal hold, platform height, range, tempo, repetitions, rest, and side dosage within the step-down identity.',
        '["target_contact","terminal_hold","platform_height","range","tempo","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'wall-drill-split-shin-hold',
        'wall-drive-iso-hold',
        'Wall Drill Split-Shin Hold',
        'Wall Drive ISO Hold',
        'same_wall_supported_sprint_isometric_with_position_cue_variant',
        'Both sources lean into wall support and hold a split sprint posture without repeated contacts. Split-shin and wall-drive labels change wall angle, joint-position cue, declared side, hold duration, repetitions, rest, and dose within the wall-supported sprint isometric identity.',
        '["wall_angle","joint_position_cue","side","hold_duration","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
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
              'Re-run the canonical card audit after score-74 identity consolidation.',
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
