-- These source baselines are incomplete or mapped to an incompatible generic
-- family. They do not define the exact implement, grip/rack, support, stance,
-- range, load, safety, dose, or recovery contract for automatic selection.
DO $barbell_dumbbell_sources_391_417_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[391,392,393,394,395,400,401,406,407,408,409,410,411,412,413,417]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_id_value,
        display_name='Barbell / Dumbbell Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',CASE
          WHEN source_id_value BETWEEN 391 AND 394 THEN 'rack_or_block_height_bar_grip_stance_range_load_safety_dose_and_stop_rule_are_unspecified'
          WHEN source_id_value=395 THEN 'barbell_source_is_mapped_to_banded_good_morning_without_exact_implement_support_stance_range_load_and_dose_contract'
          WHEN source_id_value IN (400,401,406) THEN 'implement_bench_or_seat_geometry_grip_range_load_safety_dose_and_stop_rule_are_unspecified'
          WHEN source_id_value BETWEEN 407 AND 412 THEN 'bar_or_landmine_or_t_bar_interface_support_angle_grip_range_load_safety_dose_and_stop_rule_are_unspecified'
          WHEN source_id_value=413 THEN 'bar_interface_knee_or_toe_support_range_rollout_distance_dose_and_stop_rule_are_unspecified'
          ELSE 'implement_position_stance_range_load_tempo_dose_and_stop_rule_are_unspecified'
        END),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1
    SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE id=definition_id_value;
  END LOOP;
END;
$barbell_dumbbell_sources_391_417_quarantine$;
