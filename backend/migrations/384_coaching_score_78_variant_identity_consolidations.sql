-- Consolidate the mechanically supported duplicate/variant identities in the
-- score-78 canonical queue.
--
-- Stable survivors retain source traceability, aliases, candidate evidence,
-- candidate media, and archived legacy variants. Implement, stance, support,
-- direction, tempo, range, and dosage remain exact variant dimensions. This
-- migration creates no human approval.
--
-- Exercise cards use exercise complexity and physical difficulty only. Athlete
-- skill/proficiency levels remain exclusive to skill-library cards.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '384_coaching_score_78_variant_identity_consolidations';
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
        'alternate-leg-bound-for-distance',
        'alternating-bounds-for-rhythm',
        'Alternating Bounds for Rhythm',
        NULL::TEXT,
        'same_alternating_contralateral_bound_with_distance_and_rhythm_variants',
        'Both sources repeat contralateral bounds from one leg to the other with coordinated arm action and controlled projection. Distance emphasis versus rhythm emphasis changes projection target, cadence, contact time, approach, arm policy, measurement, rest, and dose within the alternating-bound identity.',
        '["intent","projection_target","cadence","contact_time","approach","arm_policy","measurement","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'dumbbell-kettlebell-floor-press',
        'barbell-floor-press',
        'Barbell Floor Press',
        'Floor Press',
        'same_supine_floor_press_with_barbell_implement_variant',
        'Both sources press external resistance from a supine floor-supported position and use floor contact to bound shoulder extension. A barbell instead of independent dumbbells or kettlebells changes implement, grip, arm coupling, path constraint, setup, spotting, load, tempo, rest, and dose within the floor-press identity.',
        '["implement","grip","arm_coupling","path_constraint","setup","spotting","range","load","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB
      ),
      (
        'front-squat',
        'double-dumbbell-front-squat',
        'Double Dumbbell Front Squat',
        NULL::TEXT,
        'same_front_loaded_squat_with_double_dumbbell_variant',
        'Both sources squat with external resistance held anterior to the trunk, maintain brace and foot pressure, descend through the available hip-knee range, and stand. Double dumbbells change implement, rack interface, grip, independent-arm demand, stance, range, load, tempo, rest, and dose within the front-squat identity.',
        '["implement","implement_quantity","rack_interface","grip","independent_arm_demand","stance","range","load","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/","https://pubmed.ncbi.nlm.nih.gov/33161870/"]'::JSONB
      ),
      (
        'front-squat',
        'single-kettlebell-front-rack-squat',
        'Single Kettlebell Front-Rack Squat',
        NULL::TEXT,
        'same_front_loaded_squat_with_unilateral_kettlebell_rack_variant',
        'Both sources squat with external resistance held anterior to the trunk, maintain brace and foot pressure, descend through the available hip-knee range, and stand. A single kettlebell front rack changes implement, rack side, asymmetrical trunk demand, grip, stance, range, load, tempo, rest, and dose within the front-squat identity.',
        '["implement","implement_quantity","rack_side","load_symmetry","grip","stance","range","load","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/","https://pubmed.ncbi.nlm.nih.gov/33161870/"]'::JSONB
      ),
      (
        'leg-swings-front-back',
        'dynamic-leg-swing-front-to-back',
        'Dynamic Leg Swing Front-to-Back',
        NULL::TEXT,
        'same_supported_sagittal_leg_swing',
        'Both sources use light external support while one leg swings forward and backward with the stance foot grounded and trunk controlled. Support, swing amplitude, cadence, range, side order, breathing, rest, and dose remain exact variants.',
        '["support","swing_amplitude","cadence","range","side_order","breathing","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'glute-bridge',
        'single-leg-glute-bridge',
        'Single-Leg Glute Bridge',
        NULL::TEXT,
        'same_supine_hip_extension_bridge_with_unilateral_support_variant',
        'Both sources begin supine with the upper trunk supported, extend the hips to a declared bridge position, control trunk and pelvis, and return. Single-leg support changes support-leg count, free-leg position, load symmetry, pelvic-control demand, range, external load, tempo, rest, and dose within the glute-bridge identity.',
        '["support_leg_count","free_leg_position","load_symmetry","pelvic_control","range","external_load","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/28900560/","https://pubmed.ncbi.nlm.nih.gov/27799708/"]'::JSONB
      ),
      (
        'glute-bridge',
        'single-leg-glute-bridge-hold',
        'Single-Leg Glute Bridge Hold',
        NULL::TEXT,
        'same_supine_hip_extension_bridge_with_unilateral_isometric_hold_variant',
        'Both sources begin supine with the upper trunk supported and extend the hips to a declared bridge position while controlling the ribcage and pelvis. A single-leg isometric hold changes support-leg count, free-leg position, contraction type, hold duration, load symmetry, pelvic-control demand, rest, and dose within the glute-bridge identity.',
        '["support_leg_count","free_leg_position","contraction_type","hold_duration","load_symmetry","pelvic_control","external_load","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/28900560/","https://pubmed.ncbi.nlm.nih.gov/27799708/"]'::JSONB
      ),
      (
        'glute-bridge',
        'glute-bridge-iso-hold',
        'Glute Bridge Iso Hold',
        NULL::TEXT,
        'same_supine_hip_extension_bridge_with_bilateral_isometric_hold_variant',
        'Both sources begin supine with both feet supported, extend the hips to a declared bridge position, and control the ribcage, pelvis, and lumbar spine. An isometric top hold changes contraction type, hold duration, joint angle, breathing target, fatigue cap, external load, rest, and dose within the glute-bridge identity.',
        '["contraction_type","hold_duration","joint_angle","breathing_target","fatigue_cap","external_load","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/28900560/","https://pubmed.ncbi.nlm.nih.gov/27799708/"]'::JSONB
      ),
      (
        'low-hurdle-hops',
        'hurdle-hop-series-low-hurdles',
        'Hurdle Hop Series — Low Hurdles',
        NULL::TEXT,
        'same_repeated_low_hurdle_hop_series',
        'Both sources use repeated hops over a sequence of low hurdles while preserving landing alignment and the declared elastic-contact rhythm. Hurdle count, height, spacing, takeoff stance, direction, cadence, arm policy, reset rule, impact cap, rest, and dose remain exact variants.',
        '["hurdle_count","hurdle_height","spacing","takeoff_stance","direction","cadence","arm_policy","reset_rule","impact_cap","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/","https://pubmed.ncbi.nlm.nih.gov/17620779/"]'::JSONB
      ),
      (
        'icky-shuffle',
        'lateral-icky-shuffle',
        'Lateral Icky Shuffle',
        NULL::TEXT,
        'same_icky_ladder_contact_pattern_with_lateral_travel_variant',
        'Both sources use the Icky inside-inside-outside ladder contact sequence and coordinated weight shift. Lateral travel changes facing, lead side, entry, cadence, spacing, visual demand, error state, rest, and dose while preserving the footwork identity.',
        '["travel_direction","facing","lead_side","entry","cadence","spacing","visual_demand","error_state","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/24290613/"]'::JSONB
      ),
      (
        'sprint-float-sprint',
        'ins-and-out-sprint-float-sprint',
        'Ins-and-Out Sprint Float-Sprint',
        NULL::TEXT,
        'same_sprint_float_sprint_velocity_alternation',
        'Both sources accelerate to a high-speed sprint, reduce effort through a declared float segment without braking, then reaccelerate. Segment count, distance, intensity targets, entry speed, transition cue, lane, measurement, rest, and dose remain exact variants.',
        '["segment_count","segment_distance","intensity_targets","entry_speed","transition_cue","lane","measurement","rest","dose"]'::JSONB,
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB
      ),
      (
        'jog-to-stick-linear-deceleration',
        'linear-deceleration-stop-eccentric-stick',
        'Linear Deceleration Stop Eccentric Stick',
        'Linear Deceleration to Stick',
        'same_linear_approach_deceleration_to_terminal_stick',
        'Both sources enter on a straight line, lower the center of mass, use progressive braking contacts, stop inside a declared zone, and hold the terminal position. Approach speed, entry distance, stop zone, braking-contact count, lead leg, hold duration, measurement, rest, and dose remain exact variants.',
        '["approach_speed","entry_distance","stop_zone","braking_contact_count","lead_leg","hold_duration","measurement","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/40679942/","https://pubmed.ncbi.nlm.nih.gov/40267408/","https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'jog-to-stick-linear-deceleration',
        'sprint-to-stick-deceleration',
        'Sprint-to-Stick Deceleration',
        'Linear Deceleration to Stick',
        'same_linear_approach_deceleration_to_terminal_stick_with_sprint_entry_variant',
        'Both sources enter on a straight line, lower the center of mass, use progressive braking contacts, stop inside a declared zone, and hold the terminal position. Jog versus sprint entry changes approach speed, acceleration distance, stop zone, braking-contact count, lead leg, impact demand, measurement, rest, and dose within the linear-deceleration-to-stick identity.',
        '["approach_speed","acceleration_distance","stop_zone","braking_contact_count","lead_leg","impact_demand","hold_duration","measurement","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/40679942/","https://pubmed.ncbi.nlm.nih.gov/40267408/","https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'push-up',
        'ring-push-up',
        'Ring Push-Up',
        NULL::TEXT,
        'same_push_up_with_suspended_ring_support_variant',
        'Both sources use a straight-body plank and lower and press the body relative to hand support through a controlled push-up range. Rings change support stability, hand path, grip rotation, support height, relative load, range, tempo, rest, and dose within the push-up identity.',
        '["support_surface","support_stability","hand_path","grip_rotation","support_height","relative_load","range","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/29541105/","https://pubmed.ncbi.nlm.nih.gov/29324579/","https://pubmed.ncbi.nlm.nih.gov/36360619/"]'::JSONB
      ),
      (
        'push-up',
        'push-up-negative',
        'Push-Up Negative',
        NULL::TEXT,
        'same_push_up_with_eccentric_emphasis_and_assisted_return_variant',
        'Both sources use a straight-body plank and lower the body relative to hand support through a controlled push-up range. An eccentric-only or slow-negative delivery changes contraction emphasis, eccentric duration, return assistance, range, relative load, fatigue cap, rest, and dose within the push-up identity.',
        '["contraction_emphasis","eccentric_duration","return_assistance","range","relative_load","fatigue_cap","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/29541105/","https://pubmed.ncbi.nlm.nih.gov/31910394/"]'::JSONB
      ),
      (
        'push-up-prone-start-sprint',
        'push-up-start-to-cone',
        'Push-Up Start to Cone',
        NULL::TEXT,
        'same_prone_push_up_start_to_short_acceleration_with_cone_target_variant',
        'Both sources begin prone or at the bottom of a push-up, rise on a cue, recover one foot beneath the body, and accelerate through a short lane. Cone placement, distance, cue, lead leg, push-up position, intent, timing, rest, and dose remain exact variants.',
        '["target","distance","distance_unit","start_cue","lead_leg","push_up_position","intent","measurement","rest","dose"]'::JSONB,
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB
      ),
      (
        'seated-soleus-raise',
        'seated-soleus-raise-eccentric',
        'Seated Soleus Raise Eccentric',
        NULL::TEXT,
        'same_seated_bent_knee_plantar_flexion_with_eccentric_emphasis_variant',
        'Both sources use a seated, bent-knee position and move through ankle plantar flexion with the forefoot supported and resistance applied near the knee. Eccentric emphasis changes lowering duration, return assistance, range, pause, load, fatigue cap, rest, and dose within the seated-soleus-raise identity.',
        '["contraction_emphasis","eccentric_duration","return_assistance","range","pause_duration","load","fatigue_cap","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/27632850/","https://pubmed.ncbi.nlm.nih.gov/38156065/","https://pubmed.ncbi.nlm.nih.gov/15450115/"]'::JSONB
      ),
      (
        'triple-broad-jump',
        'triple-broad-jump-d7',
        'Triple Broad Jump — Loaded Intent',
        NULL::TEXT,
        'same_three_consecutive_horizontal_jumps_with_loaded_intent_variant',
        'Both sources perform three consecutive forward broad jumps and preserve horizontal projection through the declared sequence. Loaded intent changes external resistance, implement, approach, arm policy, inter-jump contact, terminal landing, measurement, impact cap, rest, and dose within the triple-broad-jump identity.',
        '["external_load","implement","approach","arm_policy","inter_jump_contact","terminal_landing","measurement","impact_cap","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/","https://pubmed.ncbi.nlm.nih.gov/17544325/"]'::JSONB
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
              'Re-run the canonical card audit after score-78 identity consolidation.',
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
