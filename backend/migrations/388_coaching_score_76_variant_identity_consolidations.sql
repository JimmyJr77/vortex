-- Consolidate mechanically supported duplicate and controlled-variant
-- identities in the score-76 canonical queue.
--
-- Source mappings, aliases, candidate evidence/media, and archived legacy
-- variants remain traceable. This migration creates no human approval.
-- Exercise cards use exercise complexity and physical difficulty only;
-- skill/proficiency levels remain exclusive to coaching.skill.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '388_coaching_score_76_variant_identity_consolidations';
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
        'slam-ball-bear-hug-carry',
        'Slam-Ball Bear-Hug Carry',
        NULL::TEXT,
        'same_bear_hug_loaded_gait_with_round_implement_variant',
        'Both sources secure a round implement against the anterior trunk and walk under load while controlling posture, breathing, and the pickup and set-down. Stone, D-ball, and slam-ball delivery changes implement material, diameter, load, grip, pickup, route, distance, rest, and dose within the bear-hug carry identity.',
        '["implement","material","diameter","load","grip","pickup","set_down","route","distance","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38665162/"]'::JSONB
      ),
      (
        'banded-good-morning',
        'barbell-good-morning',
        'Barbell Good Morning',
        'Good Morning',
        'same_good_morning_hip_hinge_with_implement_and_load_position_variants',
        'Both sources establish a braced standing base, hinge through hip flexion with controlled knee position, keep the trunk organized, and return through hip extension. Band, barbell, and the already consolidated sandbag source change implement, resistance curve, load position, stance, range, tempo, load, rest, and dose within the good-morning identity.',
        '["implement","resistance_curve","load_position","stance","knee_position","range","tempo","load","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/24978835/"]'::JSONB
      ),
      (
        'distance-jump-standing-calf-raise',
        'calf-isometric-hold-straight-knee',
        'Calf Isometric Hold — Straight Knee',
        NULL::TEXT,
        'same_standing_straight_knee_calf_raise_with_top_isometric_variant',
        'Both sources stand with an extended knee, plantar flex to the top of the available range, maintain foot and ankle alignment, and return under control. A top isometric hold changes contraction mode, hold duration, support, implement, load, range, balance, rest, and dose within the standing calf-raise identity.',
        '["contraction_mode","hold_duration","support","implement","load","range","balance","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/27632850/"]'::JSONB
      ),
      (
        'distance-jump-standing-calf-raise',
        'calf-raise-iso-with-single-leg-hold',
        'Calf Raise Iso with Single-Leg Hold',
        NULL::TEXT,
        'same_standing_calf_raise_with_unilateral_top_hold_variant',
        'Both sources use standing plantar flexion and own the top position before a controlled return. The single-leg hold changes laterality, support, balance, hold duration, load, range, tempo, rest, and side dosage within the standing calf-raise identity.',
        '["laterality","support","balance","hold_duration","load","range","tempo","rest","side_dose","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/27632850/"]'::JSONB
      ),
      (
        'pull-up-chin-up',
        'chin-up',
        'Chin-Up',
        NULL::TEXT,
        'same_vertical_bodyweight_pull_with_supinated_grip_variant',
        'The completed Pull-Up/Chin-Up identity already declares pronated, neutral, and supinated grips while the athlete hangs, pulls the body toward the bar, controls the shoulder and elbow path, and returns to the declared hang. Chin-up wording selects the supinated grip, changing grip, hand width, elbow path, assistance, load, range, tempo, rest, and dose within that identity.',
        '["grip","hand_width","elbow_path","assistance","external_load","range","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB
      ),
      (
        'inverted-row',
        'feet-elevated-inverted-row',
        'Feet-Elevated Inverted Row',
        NULL::TEXT,
        'same_inverted_row_with_feet_elevation_and_body_angle_variant',
        'Both sources suspend the body beneath a fixed bar or handles, maintain a braced line, pull the torso toward support, and lower under control. Elevating the feet changes body angle, support height, relative load, range, grip, tempo, rest, and dose within the inverted-row identity.',
        '["foot_elevation","body_angle","support_height","relative_load","range","grip","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB
      ),
      (
        'cable-band-chop',
        'half-kneeling-cable-chop',
        'Half-Kneeling Cable Chop',
        NULL::TEXT,
        'same_anchored_chop_with_kneeling_base_variant',
        'The broader Cable/Band Chop source explicitly permits standing, kneeling, or half-kneeling while moving anchored resistance diagonally across the body with deliberate control. Half-kneeling changes base, stance symmetry, lead leg, hip position, anchor, resistance direction, range, load, rest, and side dosage within that identity.',
        '["base","stance_symmetry","lead_leg","hip_position","anchor","implement","resistance_direction","range","load","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'cable-band-chop',
        'tall-kneeling-cable-band-chop',
        'Kneeling Cable/Band Chop',
        NULL::TEXT,
        'same_diagonal_cable_band_chop_with_standing_and_kneeling_base_variants',
        'The broader Cable/Band Chop source explicitly permits standing, kneeling, or half-kneeling while moving cable or band resistance through the same controlled diagonal chop path. The completed kneeling sources change base, stance symmetry, lead leg, hip position, anchor, implement, range, load, rest, and side dosage within that identity.',
        '["base","stance_symmetry","lead_leg","hip_position","anchor","implement","range","load","rest","side_dose","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'hamstring-slider-curl',
        'slider-hamstring-eccentric-slow-lower',
        'Slider Hamstring Eccentric Slow Lower',
        NULL::TEXT,
        'same_supine_bridge_slider_curl_with_eccentric_only_tempo_variant',
        'Both sources maintain a supine bridge while the heels slide away under controlled knee extension. The slow-lower source emphasizes the eccentric portion and may use assistance for the return, changing contraction mode, return strategy, tempo, range, repetitions, rest, and dose within the completed hamstring-slider-curl identity.',
        '["contraction_mode","return_strategy","tempo","range","assistance","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/40827942/","https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'single-leg-balance-hold-tripod-foot',
        'head-turn-single-leg-balance',
        'Head-Turn Single-Leg Balance',
        NULL::TEXT,
        'same_single_leg_balance_hold_with_cervical_visual_overlay_variant',
        'Both sources establish a tripod foot, balance on one leg, preserve pelvis and trunk control, and terminate when the support strategy fails. Head turns change visual and vestibular input, gaze target, turn range, speed, support, hold duration, rest, and side dosage within the single-leg balance identity.',
        '["head_turn","visual_input","vestibular_input","gaze_target","turn_range","turn_speed","support","hold_duration","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'inverted-row',
        'inverted-row-negative',
        'Inverted Row Negative',
        NULL::TEXT,
        'same_inverted_row_with_eccentric_only_return_variant',
        'Both sources use the same suspended body position and horizontal pulling path. The negative source emphasizes controlled lowering and may use assistance to regain the top, changing contraction mode, return strategy, body angle, assistance, tempo, range, rest, and dose within the inverted-row identity.',
        '["contraction_mode","return_strategy","body_angle","assistance","tempo","range","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/","https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'lateral-bound',
        'lateral-bound-to-stick',
        'Lateral Bound to Stick',
        NULL::TEXT,
        'same_opposite_leg_lateral_bound_with_terminal_stick_variant',
        'Both sources project laterally from one leg to the other and receive the landing under control. A declared terminal stick changes hold duration, reset policy, repetition continuity, projection distance, arm policy, impact cap, rest, and dose within the lateral-bound identity.',
        '["terminal_action","hold_duration","reset_policy","repetition_continuity","projection_distance","arm_policy","impact_cap","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'lateral-bound',
        'skater-hop-to-stick',
        'Skater Hop to Stick',
        NULL::TEXT,
        'same_opposite_leg_lateral_bound_with_skater_label_and_terminal_stick',
        'Both sources push laterally from one leg, travel through flight to the opposite leg, control the landing, and reset. Skater wording and the declared stick change projection distance, arm action, trail-leg position, hold duration, reset policy, impact cap, rest, and dose within the lateral-bound identity.',
        '["projection_distance","arm_action","trail_leg_position","hold_duration","reset_policy","impact_cap","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'medicine-ball-over-shoulder-track-and-catch',
        'over-shoulder-tennis-ball-track-and-stick',
        'Over-Shoulder Tennis-Ball Track and Stick',
        'Over-Shoulder Track and Catch',
        'same_over_shoulder_partner_toss_tracking_and_catch_with_ball_variant',
        'Both sources have a partner loft an object over the athlete shoulder, require visual tracking while the athlete reorients or travels, and finish with a controlled catch and body position. Medicine ball versus tennis ball changes implement, diameter, mass, toss height, distance, catch strategy, route, rest, and dose within the over-shoulder tracking identity.',
        '["implement","diameter","mass","toss_height","distance","catch_strategy","route","terminal_hold","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'one-arm-landmine-push-press',
        'two-hand-landmine-push-press',
        'Two-Hand Landmine Push Press',
        'Landmine Push Press',
        'same_landmine_dip_drive_press_with_hand_count_variant',
        'Both sources use a controlled dip and forceful leg drive to accelerate the landmine through an angled press, then own the finish and return. One versus two hands changes hand count, stance, load symmetry, grip, trunk demand, load, range, rest, and side dosage within the landmine push-press identity.',
        '["hand_count","stance","load_symmetry","grip","trunk_demand","load","range","rest","side_dose","dose"]'::JSONB,
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'pause-bodyweight-squat',
        'tempo-bodyweight-squat',
        'Tempo Bodyweight Squat',
        'Bodyweight Squat',
        'same_unloaded_bilateral_squat_with_pause_and_tempo_variants',
        'Both sources descend and stand through an unloaded bilateral squat while preserving foot pressure, knee tracking, trunk position, and owned range. Pause and tempo prescriptions change phase duration, bottom hold, countermovement, range, repetition duration, rest, and dose within the bodyweight-squat identity.',
        '["eccentric_duration","bottom_hold","concentric_duration","countermovement","range","repetition_duration","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'pull-up-chin-up',
        'pull-up',
        'Pull-Up',
        NULL::TEXT,
        'same_vertical_bodyweight_pull_with_pronated_grip_variant',
        'The completed Pull-Up/Chin-Up identity already declares pronated, neutral, and supinated grips while the athlete hangs, pulls toward the bar, controls the shoulder and elbow path, and returns to the declared hang. Pull-up wording selects the pronated grip, changing grip, hand width, elbow path, assistance, load, range, tempo, rest, and dose within that identity.',
        '["grip","hand_width","elbow_path","assistance","external_load","range","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB
      ),
      (
        'rotational-box-jump',
        'staggered-stance-rotational-box-jump',
        'Staggered-Stance Rotational Box Jump',
        NULL::TEXT,
        'same_rotational_floor_to_box_jump_with_start_stance_variant',
        'Both sources rotate from the floor, project to a stable box, land under control, stand, step down, and reset. A staggered start changes stance, lead side, preload, rotation direction, arm policy, box height, rest, and side dosage within the rotational box-jump identity.',
        '["start_stance","lead_side","preload","rotation_direction","arm_policy","box_height","rest","side_dose","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        'single-leg-depth-drop-to-stick',
        'step-off-to-single-leg-stick',
        'Step-Off to Single-Leg Stick',
        NULL::TEXT,
        'same_elevated_step_off_to_unilateral_terminal_landing',
        'Both sources step from an elevated surface without jumping up, receive the imposed landing on one leg, stabilize the foot, knee, hip, pelvis, and trunk, and hold before resetting. Naming changes box height, step leg, landing side, hold duration, arm policy, rest, and side dosage within the single-leg depth-drop identity.',
        '["box_height","step_leg","landing_side","hold_duration","arm_policy","rest","side_dose","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/","https://pubmed.ncbi.nlm.nih.gov/27428530/"]'::JSONB
      ),
      (
        'distance-jump-standing-calf-raise',
        'single-leg-calf-raise',
        'Single-Leg Calf Raise',
        NULL::TEXT,
        'same_standing_calf_raise_with_unilateral_loading_variant',
        'Both sources stand, plantar flex through an owned range, control foot and ankle alignment, and lower under control. Single-leg delivery changes laterality, support, balance, implement, load, range, tempo, rest, and side dosage within the standing calf-raise identity.',
        '["laterality","support","balance","implement","load","range","tempo","rest","side_dose","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/27632850/"]'::JSONB
      ),
      (
        'suitcase-carry',
        'suitcase-carry-line-walk',
        'Suitcase Carry Line Walk',
        NULL::TEXT,
        'same_unilateral_suitcase_loaded_gait_with_narrow_route_variant',
        'Both sources hold one implement beside the body and walk while resisting lateral trunk motion and controlling the pickup and set-down. Following a line changes route width, foot placement, balance, distance, speed, implement, load, rest, and side dosage within the suitcase-carry identity.',
        '["route_width","foot_placement","balance","distance","speed","implement","load","rest","side_dose","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38665162/"]'::JSONB
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
              'Re-run the canonical card audit after score-76 identity consolidation.',
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
