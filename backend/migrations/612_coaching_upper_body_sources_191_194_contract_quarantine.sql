-- Sources 191-194 name multiple materially different upper-body exercises
-- (or retain a generic uncontracted baseline).  A card cannot safely select
-- among the apparatus, body-angle, support, range, grip, dose, or loading
-- contracts without a human-authored exact variant.
DO $upper_body_sources_191_194_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[191, 192, 193, 194]
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
        display_name='Upper-Body Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object(
          'selectable',false,
          'identityQuarantine',true,
          'exerciseCardDoesNotClassifyParticipants',true,
          'unresolvedContract',CASE source_id_value
            WHEN 191 THEN 'floor_pike_and_box_pike_have_distinct_foot_elevation_head_target_range_and_support_contracts'
            WHEN 192 THEN 'parallel_bar_dip_support_and_ring_support_hold_have_distinct_apparatus_stability_entry_exit_and_dose_contracts'
            WHEN 193 THEN 'ring_row_and_trx_row_have_distinct_handle_anchor_and_stability_contracts'
            WHEN 194 THEN 'inverted_row_baseline_omits_bar_or_ring_interface_height_body_angle_grip_range_tempo_load_and_dosage'
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
$upper_body_sources_191_194_quarantine$;
