-- These sources retain generic or conflated control cards without the exact
-- contact, target, support, platform, path, dose, and fatigue facts required
-- for a selectable prescription. Sources 227, 230, and their exact existing
-- variants are intentionally not changed here.
DO $balance_control_sources_226_234_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[226, 229, 231, 234]
  LOOP
    SELECT source.definition_id INTO definition_id_value
    FROM coaching.exercise_definition_source_v1 source
    WHERE source.legacy_exercise_id=source_id_value
    LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_id_value,
        display_name='Balance / Control Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',CASE source_id_value
          WHEN 226 THEN 'backpedal_start_cone_layout_travel_distance_braking_contact_stop_position_hold_standard_dose_and_cumulative_impact_budget_are_unspecified'
          WHEN 229 THEN 'reach_directions_marker_type_stance_foot_tap_or_marker_move_return_standard_dose_and_stop_rule_are_unspecified'
          WHEN 231 THEN 'support_interface_hinge_depth_pelvis_rotation_range_stance_foot_policy_dose_and_stop_rule_are_unspecified'
          WHEN 234 THEN 'box_height_touch_standard_assistance_arm_policy_depth_range_dose_and_stop_rule_are_unspecified'
        END),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1
    SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE id=definition_id_value;
  END LOOP;

  SELECT source.definition_id INTO definition_id_value
  FROM coaching.exercise_definition_source_v1 source
  WHERE source.legacy_exercise_id IN (232, 233)
  GROUP BY source.definition_id
  HAVING count(DISTINCT source.legacy_exercise_id)=2;
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Sources 232 and 233 shared canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1
  SET variant_key='identity-quarantine-sources-232-233',display_name='Step-Down Contract Quarantine — Sources 232 / 233',status='archived',
      requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','forward_and_lateral_step_downs_conflate_platform_height_orientation_free_foot_path_touch_or_hover_standard_dose_and_stop_rule'),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1
  SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
  WHERE id=definition_id_value;
END;
$balance_control_sources_226_234_quarantine$;
