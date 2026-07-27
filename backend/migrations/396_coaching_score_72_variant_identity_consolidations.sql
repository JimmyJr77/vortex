-- Consolidate mechanically supported duplicate and controlled-variant
-- identities in the score-72 canonical queue.
--
-- Source mappings, aliases, candidate evidence/media, and archived legacy
-- variants remain traceable. This migration creates no human approval.
-- Exercise cards use exercise complexity and physical difficulty only;
-- skill/proficiency levels remain exclusive to coaching.skill.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '396_coaching_score_72_variant_identity_consolidations';
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
        'ankling-pogo-hop',
        'low-pogos',
        'Low Pogos / Ankling Bounce',
        'Ankling Pogo',
        'same_low_amplitude_ankle_dominant_pogo_with_posture_and_travel_variant',
        'Both sources repeat low-amplitude ankle-dominant contacts with a tall organized posture and relatively quiet knees. Ankling and low-pogo delivery changes travel, foot placement, cadence, amplitude, contact count, repetitions, rest, and dose within the ankling-pogo identity.',
        '["travel","foot_placement","cadence","amplitude","contact_count","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/"]'::JSONB
      ),
      (
        'pull-up-chin-up',
        'archer-pull-up',
        'Archer Pull-Up',
        NULL::TEXT,
        'same_vertical_pull_with_asymmetric_arm_loading_variant',
        'Both sources hang from an overhead support and pull the body upward through shoulder and elbow action without kipping. Archer delivery changes load symmetry, lateral shift, grip width, assistance, range, repetitions, rest, and side dosage within the pull-up identity.',
        '["load_symmetry","lateral_shift","grip_width","assistance","range","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'push-up',
        'archer-push-up',
        'Archer Push-Up',
        NULL::TEXT,
        'same_push_up_with_asymmetric_hand_loading_and_lateral_shift_variant',
        'Both sources maintain a braced body line while lowering between fixed hand support and pressing back to the start. Archer delivery changes load symmetry, lateral shift, hand width, leverage, range, repetitions, rest, and side dosage within the push-up identity.',
        '["load_symmetry","lateral_shift","hand_width","leverage","range","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'soleus-isometric-hold-bent-knee',
        'bent-knee-soleus-wall-sit-hold',
        'Bent-Knee Soleus Wall Sit Hold',
        'Bent-Knee Soleus Isometric Hold',
        'same_bent_knee_plantar_flexion_isometric_with_wall_support_variant',
        'Both sources hold plantar flexion while the knee remains bent and stop before ankle alignment or hold height changes. Wall-sit delivery changes body support, hip and knee position, external load, hold duration, rest, and dose within the bent-knee soleus isometric identity.',
        '["body_support","hip_position","knee_position","external_load","hold_duration","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'single-leg-squat-to-box',
        'beam-single-leg-quarter-squat',
        'Beam Single-Leg Quarter Squat',
        'Single-Leg Squat',
        'same_single_leg_squat_with_beam_support_and_quarter_range_variant',
        'Both sources balance on one leg, flex the stance hip and knee under control, and return without transferring weight to the free foot. Beam delivery changes support width, target, range, available support, tempo, repetitions, rest, and side dosage within the single-leg squat identity.',
        '["support_width","target","range","available_support","tempo","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30366506/"]'::JSONB
      ),
      (
        'step-up',
        'bodyweight-step-up',
        'Bodyweight Step-Up',
        NULL::TEXT,
        'same_step_up_with_bodyweight_load_variant',
        'Both sources place one whole foot on an elevated platform, ascend through the stance leg, own the top, and descend under control. Bodyweight delivery changes external load, arm position, platform height, range, repetitions, rest, and side dosage within the step-up identity.',
        '["external_load","arm_position","platform_height","range","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'box-jump',
        'one-step-box-jump',
        'One-Step Box Jump',
        NULL::TEXT,
        'same_floor_to_box_jump_with_one_step_approach_variant',
        'Both sources project from the floor to a stable box landing, stand, step down, and reset. One-step delivery changes approach, foot sequence, takeoff stance, box height, landing hold, repetitions, rest, and dose within the box-jump identity.',
        '["approach","foot_sequence","takeoff_stance","box_height","landing_hold","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        'eccentric-pull-up',
        'eccentric-pull-up-chin-up-negative',
        'Eccentric Pull-Up / Chin-Up Negative',
        NULL::TEXT,
        'same_assisted_top_start_vertical_pull_lowering_with_grip_variant',
        'Both sources begin above or near the bar using assistance, lower slowly to an owned hang, and reset without requiring a concentric pull. Pull-up versus chin-up delivery changes grip, assistance, start hold, lowering duration, range, repetitions, rest, and dose within the eccentric pull-up identity.',
        '["grip","assistance","start_hold","lowering_duration","range","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'eccentric-pull-up',
        'negative-chin-up',
        'Negative Chin-Up',
        NULL::TEXT,
        'same_eccentric_vertical_pull_with_supinated_grip_variant',
        'Both sources begin at the top of a vertical pull and lower under control to an owned hang before resetting. Negative chin-up delivery changes grip, elbow-flexor bias, assistance, lowering duration, range, repetitions, rest, and dose within the eccentric pull-up identity.',
        '["grip","elbow_flexor_bias","assistance","lowering_duration","range","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'eccentric-pull-up',
        'negative-pull-up',
        'Negative Pull-Up',
        NULL::TEXT,
        'same_eccentric_vertical_pull_with_pronated_grip_variant',
        'Both sources begin at the top of a vertical pull and lower under control to an owned hang before resetting. Negative pull-up delivery changes grip width, assistance, lowering duration, range, repetitions, rest, and dose within the eccentric pull-up identity.',
        '["grip_width","assistance","lowering_duration","range","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'glute-bridge',
        'hamstring-bridge-iso-long-lever-bridge-hold',
        'Hamstring Bridge ISO / Long-Lever Bridge Hold',
        'Bridge',
        'same_supine_hip_bridge_with_long_lever_and_isometric_variant',
        'Both sources lie supine, drive through the feet or heels, extend the hips to an owned trunk-thigh line, and avoid lumbar substitution. Long-lever isometric delivery changes foot distance, knee angle, muscle bias, contraction mode, hold duration, rest, and dose within the bridge identity.',
        '["foot_distance","knee_angle","muscle_bias","contraction_mode","hold_duration","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'standard-wall-ball-shot',
        'half-wall-ball-shot',
        'Half Wall Ball Shot',
        'Wall Ball Shot',
        'same_wall_ball_cycle_with_partial_squat_and_lower_target_variant',
        'Both sources squat with a retained ball, drive upward, release to a wall target, receive the ball, and reset or continue. Half delivery changes squat depth, target height, ball mass, cadence, repetitions, rest, and dose within the wall-ball shot identity.',
        '["squat_depth","target_height","ball_mass","cadence","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'standard-wall-ball-shot',
        'tempo-wall-ball-shot',
        'Tempo Wall Ball Shot',
        'Wall Ball Shot',
        'same_wall_ball_cycle_with_eccentric_tempo_variant',
        'Both sources squat with a retained ball, drive upward, release to a wall target, receive the ball, and continue only while posture and accuracy hold. Tempo delivery changes eccentric duration, pause, target height, cadence, repetitions, rest, and dose within the wall-ball shot identity.',
        '["eccentric_duration","pause","target_height","cadence","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'standard-wall-ball-shot',
        'high-target-wall-ball-shot',
        'High-Target Wall Ball Shot',
        'Wall Ball Shot',
        'same_wall_ball_cycle_with_target_height_variant',
        'Both sources squat with a retained ball, drive upward, release to a wall target, receive the ball, and reset or continue. High-target delivery changes target height, ball mass, accuracy constraint, repetitions, rest, and dose within the wall-ball shot identity.',
        '["target_height","ball_mass","accuracy_constraint","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'standard-wall-ball-shot',
        'light-fast-wall-ball-shot',
        'Light Fast Wall Ball Shot',
        'Wall Ball Shot',
        'same_wall_ball_cycle_with_light_load_and_velocity_emphasis_variant',
        'Both sources squat with a retained ball, drive upward, release to a wall target, receive the ball, and reset or continue. Light-fast delivery changes ball mass, velocity intent, target height, repetition count, rest, and dose within the wall-ball shot identity.',
        '["ball_mass","velocity_intent","target_height","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'push-up',
        'incline-push-up',
        'Incline Push-Up',
        NULL::TEXT,
        'same_push_up_with_elevated_hand_support_and_relative_load_variant',
        'Both sources maintain a braced body line while lowering between fixed hand support and pressing back to the start. Incline delivery changes hand height, body angle, relative load, range, leverage, repetitions, rest, and dose within the push-up identity.',
        '["hand_height","body_angle","relative_load","range","leverage","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'push-up',
        'decline-push-up',
        'Decline Push-Up',
        NULL::TEXT,
        'same_push_up_with_elevated_foot_support_and_relative_load_variant',
        'Both sources maintain a braced body line while lowering between fixed hand support and pressing back to the start. Decline delivery changes foot height, body angle, relative load, shoulder demand, range, repetitions, rest, and dose within the push-up identity.',
        '["foot_height","body_angle","relative_load","shoulder_demand","range","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'one-arm-dumbbell-row',
        'one-arm-landmine-row',
        'One-Arm Landmine Row',
        'One-Arm Row',
        'same_braced_one_arm_row_with_fixed_arc_implement_variant',
        'Both sources maintain a braced base, pull one loaded hand toward the trunk through elbow flexion and shoulder extension, and lower under control without deliberate trunk rotation. Landmine delivery changes implement, fixed arc, grip, support, stance, load, repetitions, rest, and side dosage within the one-arm row identity.',
        '["implement","fixed_arc","grip","support","stance","load","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB
      ),
      (
        'split-squat-isometric-hold',
        'partner-isometric-split-squat-hand-press',
        'Partner Isometric Split-Squat Hand Press',
        NULL::TEXT,
        'same_split_squat_isometric_with_partner_hand_pressure_variant',
        'Both sources hold a declared split-squat position without visible lower-body movement while maintaining foot, knee, pelvis, trunk, and breath control. Partner delivery changes external resistance, hand action, partner contract, intensity, hold duration, rest, and side dosage within the split-squat isometric identity.',
        '["external_resistance","hand_action","partner_contract","intensity","hold_duration","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'pull-up-chin-up',
        'strict-pull-up',
        'Strict Pull-Up',
        NULL::TEXT,
        'same_strict_vertical_pull_with_declared_grip_variant',
        'Both sources hang from a secure overhead support and pull the chin above the bar without kipping, swinging, or losing shoulder control. Strict pull-up delivery fixes the pronated grip; grip, width, assistance, range, repetitions, rest, and dose are controlled variants within the pull-up identity.',
        '["grip","grip_width","assistance","range","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'step-up',
        'sandbag-step-up-strength',
        'Sandbag Step-Up',
        NULL::TEXT,
        'same_step_up_with_sandbag_implement_and_load_position_variant',
        'Both sources place one whole foot on an elevated platform, ascend through the stance leg, own the top, and descend under control. Sandbag delivery changes implement, load position, grip, pickup, platform height, repetitions, rest, and side dosage within the step-up identity.',
        '["implement","load_position","grip","pickup","platform_height","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'split-stance-anti-rotation-row',
        'split-stance-band-row',
        'Split-Stance Band Row',
        NULL::TEXT,
        'same_split_stance_anchored_row_with_band_and_bracing_variant',
        'Both sources hold a split stance and row anchored resistance without twisting, shifting, or overextending. Band delivery changes implement, anchor height, grip, resistance curve, range, repetitions, rest, and side dosage within the split-stance anti-rotation row identity.',
        '["implement","anchor_height","grip","resistance_curve","range","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB
      ),
      (
        'low-hurdle-pogo-continuous',
        'low-hurdle-hop-continuous-with-turn',
        'Low Hurdle Hop Continuous with Turn',
        NULL::TEXT,
        'same_continuous_low_hurdle_pogo_with_turn_and_reorientation_variant',
        'Both sources repeat quick low-amplitude contacts over low hurdles while preserving posture and contact quality. Turn delivery changes route, reorientation angle, hurdle layout, lead side, contact count, repetitions, rest, and dose within the continuous low-hurdle pogo identity.',
        '["route","reorientation_angle","hurdle_layout","lead_side","contact_count","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/"]'::JSONB
      ),
      (
        'medial-lateral-ankle-hop-series',
        'medial-lateral-hop-stick',
        'Medial-Lateral Hop Stick',
        'Medial-Lateral Ankle Hops',
        'same_medial_lateral_ankle_hop_with_contact_count_and_terminal_stick_variant',
        'Both sources project a short distance medially and laterally while maintaining foot, knee, hip, and trunk control. Stick delivery changes contact count, terminal hold, amplitude, target, cadence, repetitions, rest, and side dosage within the medial-lateral ankle-hop identity.',
        '["contact_count","terminal_hold","amplitude","target","cadence","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'color-call-tennis-ball-catch-on-single-leg-balance',
        'single-leg-football-catch-with-late-color-call',
        'Single-Leg Football Catch with Late Color Call',
        'Single-Leg Color-Call Catch',
        'same_single_leg_late_color_call_catch_with_ball_implement_variant',
        'Both sources balance on one leg, wait for a late color cue during an incoming toss, identify the cue, secure the ball, recover, and reset without guessing early. Football versus tennis-ball delivery changes object size, object mass, catch hand count, toss distance, cue set, repetitions, rest, and side dosage within the single-leg color-call catch identity.',
        '["object_size","object_mass","catch_hand_count","toss_distance","cue_set","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30366506/"]'::JSONB
      ),
      (
        'random-gate-acceleration',
        'tag-and-go-acceleration',
        'Tag-and-Go Acceleration',
        'Reactive Acceleration Start',
        'same_reactive_acceleration_start_with_cue_modality_and_target_variant',
        'Both sources wait for a live external cue, select the correct first movement, accelerate with intent, decelerate safely, and reset without anticipating. Gate versus tag delivery changes cue modality, target count, first direction, partner distance, sprint distance, repetitions, rest, and dose within the reactive acceleration identity.',
        '["cue_modality","target_count","first_direction","partner_distance","sprint_distance","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB
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
              'Re-run the canonical card audit after score-72 identity consolidation.',
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
