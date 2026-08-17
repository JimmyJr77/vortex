-- Source 196 conflates elastic and cable-resistance rows; source 198 conflates
-- pull-up and chin-up negatives plus three different assisted entries.  Neither
-- supplies the exact interface, anchor, grip, range, assistance, dosage, or
-- fatigue contract needed for automatic selection.
DO $pull_row_sources_196_198_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[196, 198]
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
        display_name='Pull / Row Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object(
          'selectable',false,
          'identityQuarantine',true,
          'exerciseCardDoesNotClassifyParticipants',true,
          'unresolvedContract',CASE source_id_value
            WHEN 196 THEN 'band_and_cable_rows_have_distinct_resistance_anchor_handle_body_position_and_load_progression_contracts'
            WHEN 198 THEN 'pull_up_and_chin_up_negative_with_box_step_or_band_entry_omit_exact_grip_assistance_entry_top_standard_eccentric_tempo_and_exit_contracts'
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
$pull_row_sources_196_198_quarantine$;
