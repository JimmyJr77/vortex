-- Close the seven name-similarity neighbors exposed when migration 441 made
-- Box Jump, Drop Jump, and Depth Jump mechanically explicit. These are
-- identity-only, review-quarantined decisions; no card, graph, calibration,
-- media, or publication approval is created.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '442_coaching_box_drop_depth_similarity_closure';
  boundary RECORD;
  left_id UUID;
  right_id UUID;
BEGIN
  FOR boundary IN
    SELECT * FROM (VALUES
      ('box-jump','lateral-box-jump',
        'stationary_bilateral_vertical_floor_to_box_vs_lateral_projection_to_box',
        'Box Jump starts in a stationary bilateral stance and projects primarily upward to a box. Lateral Box Jump uses the box as a side target and develops side-to-side force production. Projection direction, takeoff orientation, target relationship, space, edge clearance, landing alignment, and coaching differ.',
        '["projection_direction","start_orientation","target_relationship","space","landing_alignment"]'::JSONB),
      ('countermovement-jump','depth-jump',
        'floor_countermovement_takeoff_vs_platform_step_off_countermovement_rebound',
        'Countermovement Jump begins on the floor with an active dip-and-drive and has one flight and landing. Depth Jump begins on a platform, adds a step-off and first landing, then uses one continuous countermovement for a second flight and final landing. Entry energy, contact count, eccentric loading, equipment, fatigue, and stop rules differ.',
        '["entry","preceding_drop","flight_count","landing_contact_count","equipment","eccentric_loading"]'::JSONB),
      ('drop-jump','jump-rope-bounce',
        'single_platform_step_off_rebound_vs_repeated_rope_rotation_contacts',
        'Drop Jump uses one platform step-off, one prescribed short bilateral floor contact, one maximal vertical rebound, and a controlled final landing. Jump Rope Bounce uses repeated low contacts synchronized to continuous rope rotations. Equipment, contact sequence, cadence, amplitude, intent, volume unit, and failure modes differ.',
        '["equipment","entry","contact_sequence","rope_rotation","cadence","amplitude","volume_unit"]'::JSONB),
      ('box-jump','box-jump-over-reset',
        'land_and_stabilize_on_box_vs_traverse_over_box',
        'Box Jump lands with both whole feet on top of the box, stabilizes, stands, and steps down. Box Jump-Over Reset requires moving over the obstacle before landing and resetting. Terminal landing location, flight path, obstacle-clearance margin, exit, space, and collision risk differ.',
        '["terminal_landing_location","flight_path","obstacle_clearance","exit","space","collision_risk"]'::JSONB),
      ('box-jump','depth-jump',
        'floor_to_elevated_landing_vs_elevated_step_off_to_floor_rebound',
        'Box Jump begins on the floor and ends its flight on an elevated platform before a step-down exit. Depth Jump begins on a platform, lands on the floor, immediately rebounds vertically, and then lands again on the floor. Action order, platform relationship, contact count, impact, metric, exit, and stop rules differ.',
        '["action_order","start_surface","first_landing_surface","rebound_required","landing_contact_count","metric","exit"]'::JSONB),
      ('countermovement-jump-rebound','depth-jump',
        'floor_jump_to_rebound_sequence_vs_platform_step_off_to_maximal_rebound',
        'Countermovement Jump Rebound starts with an active floor countermovement jump and connects its landing to a quick second takeoff. Depth Jump starts with a passive platform step-off and uses the first floor contact as the countermovement for maximal rebound height. First action, entry height, flight count, landing count, eccentric energy, equipment, and primary metric differ.',
        '["first_action","entry_height","preceding_active_jump","flight_count","landing_contact_count","equipment","primary_metric"]'::JSONB),
      ('box-jump','single-leg-lateral-box-jump',
        'bilateral_vertical_takeoff_and_landing_vs_unilateral_lateral_projection',
        'Box Jump uses a stationary bilateral countermovement, bilateral takeoff, primarily vertical projection, and bilateral top landing. Single-Leg Lateral Box Jump uses a declared one-leg takeoff with frontal-plane projection and single-leg control on the box. Support, laterality, direction, side dosage, balance, impact distribution, and failure modes differ.',
        '["takeoff_laterality","landing_laterality","projection_direction","side_dose","balance","impact_distribution"]'::JSONB)
    ) AS boundaries(left_slug,right_slug,identity_boundary,rationale,dimensions)
  LOOP
    SELECT id INTO left_id FROM coaching.exercise_definition_v1
    WHERE facility_id=1 AND slug=boundary.left_slug AND status<>'archived';
    SELECT id INTO right_id FROM coaching.exercise_definition_v1
    WHERE facility_id=1 AND slug=boundary.right_slug AND status<>'archived';
    IF left_id IS NULL OR right_id IS NULL THEN
      RAISE EXCEPTION '% cannot resolve % and %',migration_key,
        boundary.left_slug,boundary.right_slug;
    END IF;
    IF EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE ((resolution.survivor_definition_id=left_id
          AND resolution.resolved_definition_id=right_id)
        OR (resolution.survivor_definition_id=right_id
          AND resolution.resolved_definition_id=left_id))
        AND resolution.decision<>'distinct_exercises') THEN
      RAISE EXCEPTION '% conflicts with an existing decision for % and %',
        migration_key,boundary.left_slug,boundary.right_slug;
    END IF;

    INSERT INTO coaching.exercise_identity_resolution_v1(
      facility_id,survivor_definition_id,resolved_definition_id,decision,
      rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
    VALUES(1,left_id,right_id,'distinct_exercises',boundary.rationale,
      jsonb_build_object(
        'migration',migration_key,'identityBoundary',boundary.identity_boundary,
        'variantDimensions',boundary.dimensions,
        'evidenceSource','current_authored_card_contracts_and_legacy_lineage',
        'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
        'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL,now())
    ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
      decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
      evidence_json=EXCLUDED.evidence_json,
      resolution_source=EXCLUDED.resolution_source,
      reviewed_by=NULL,resolved_at=now();
  END LOOP;

  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.evidence_json->>'migration'=migration_key
        AND resolution.decision='distinct_exercises'
        AND resolution.reviewed_by IS NULL
        AND resolution.evidence_json->>'approvalsCreated'='false')<>7 THEN
    RAISE EXCEPTION '% did not close all seven boundaries',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.evidence_json->>'migration'=migration_key
        AND coaching.exercise_json_has_level_classification(
          resolution.evidence_json)) THEN
    RAISE EXCEPTION '% created forbidden exercise level metadata',migration_key;
  END IF;
END;
$$;
