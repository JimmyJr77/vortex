-- These generic dumbbell baselines omit the support, implement count, grip,
-- stance, range, loading, safety, dose, and recovery details that determine a
-- distinct exercise contract. Existing exact dumbbell descendants remain.
DO $dumbbell_sources_424_450_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[424,426,436,441,442,444,445,446,447,448,449,450]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_id_value,
        display_name='Dumbbell Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',CASE
          WHEN source_id_value IN (424,426) THEN 'implement_count_stance_support_range_load_tempo_pickup_set_down_dose_and_stop_rule_are_unspecified'
          WHEN source_id_value IN (436,441) THEN 'bench_or_floor_support_implement_count_grip_elbow_path_range_load_dose_and_stop_rule_are_unspecified'
          WHEN source_id_value BETWEEN 442 AND 447 THEN 'support_geometry_implement_count_grip_body_position_range_load_dose_and_stop_rule_are_unspecified'
          ELSE 'implement_count_grip_wrist_path_range_load_tempo_dose_and_stop_rule_are_unspecified'
        END),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1
    SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE id=definition_id_value;
  END LOOP;
END;
$dumbbell_sources_424_450_quarantine$;
