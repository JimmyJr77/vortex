-- Source 211 omits the support interface, anchor geometry, knee-angle target,
-- load, time-dose, and exit contract for a Spanish-squat hold.  Source 213
-- names only a short-lever Copenhagen position while leaving the supported
-- segment, bench geometry, elbow base, hip-height standard, dose, and exit
-- unspecified.  Neither incomplete baseline is selectable.
DO $isometric_sources_211_213_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[211, 213]
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
        display_name='Isometric Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object(
          'selectable',false,
          'identityQuarantine',true,
          'exerciseCardDoesNotClassifyParticipants',true,
          'unresolvedContract',CASE source_id_value
            WHEN 211 THEN 'support_interface_anchor_geometry_knee_angle_range_load_time_dose_quality_gate_stop_rule_and_exit_are_unspecified'
            WHEN 213 THEN 'short_lever_supported_segment_bench_geometry_elbow_base_hip_height_hold_dose_stop_rule_and_exit_are_unspecified'
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
$isometric_sources_211_213_quarantine$;
