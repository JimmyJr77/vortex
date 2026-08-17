-- These legacy labels do not identify a safe exact loaded-carry or chop card.
-- They combine implements, laterality, interface, lane, dose, and movement
-- path choices that materially change selection, loading, fatigue, and setup.
DO $loaded_carry_chop_sources_206_208_210_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[206, 207, 208, 210]
  LOOP
    SELECT source.definition_id INTO definition_id_value
    FROM coaching.exercise_definition_source_v1 source
    WHERE source.legacy_exercise_id=source_id_value
    LIMIT 1;
    IF definition_id_value IS NULL THEN
      RAISE EXCEPTION 'Source % canonical definition missing', source_id_value;
    END IF;

    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_id_value,
        display_name='Loaded Carry / Chop Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object(
          'selectable',false,
          'identityQuarantine',true,
          'exerciseCardDoesNotClassifyParticipants',true,
          'unresolvedContract',CASE source_id_value
            WHEN 206 THEN 'sandbag_carry_is_mapped_to_atlas_stone_d_ball_and_bear_hug_family_without_exact_bag_geometry_pickup_interface_lane_distance_or_time_load_set_down_and_dosage'
            WHEN 207 THEN 'barbell_axle_and_sandbag_zercher_interfaces_have_distinct_pickup_elbow_support_load_set_down_lane_distance_or_time_and_dosage_contracts'
            WHEN 208 THEN 'unilateral_or_bilateral_and_dumbbell_or_kettlebell_overhead_carry_interfaces_have_distinct_support_laterality_load_lane_distance_or_time_and_dosage_contracts'
            WHEN 210 THEN 'cable_or_band_anchor_orientation_chop_path_height_laterality_range_load_return_and_dosage_are_unspecified'
          END),
        difficulty_json='{}'::JSONB,
        load_profile_json='{}'::JSONB,
        fatigue_profile_json='{}'::JSONB,
        programming_profile_json=jsonb_build_object(
          'selectable',false,
          'humanReviewRequired',true,
          'publicationQuarantined',true)
    WHERE definition_id=definition_id_value AND variant_key='baseline';

    UPDATE coaching.exercise_definition_v1
    SET status='archived',
        card_version=card_version+1,
        provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
          'sourceDisposition','identity_quarantine',
          'humanReviewRequired',true,
          'approvalsCreated',false,
          'publicationQuarantined',true,
          'exerciseCardDoesNotClassifyParticipants',true,
          'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE id=definition_id_value;
  END LOOP;
END;
$loaded_carry_chop_sources_206_208_210_quarantine$;
