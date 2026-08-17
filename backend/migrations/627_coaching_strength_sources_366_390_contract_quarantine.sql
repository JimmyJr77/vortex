-- These legacy strength baselines omit exact implement, rack/support, stance,
-- range, loading, safety, dose, and recovery contracts. Existing exact squat,
-- lunge, split-squat, and RDL families are retained.
DO $strength_sources_366_390_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[366,372,374,375,376,378,382,387,388,389,390]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_id_value,
        display_name='Strength Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',CASE
          WHEN source_id_value=366 THEN 'band_anchor_interface_stance_side_hip_path_range_resistance_dose_and_stop_rule_are_unspecified'
          WHEN source_id_value IN (372,375,390) THEN 'rack_or_pin_or_deficit_geometry_bar_position_stance_range_load_safety_dose_and_stop_rule_are_unspecified'
          WHEN source_id_value IN (374,376,378) THEN 'bar_or_implement_position_stance_range_tempo_load_safety_dose_and_stop_rule_are_unspecified'
          WHEN source_id_value=382 THEN 'bar_position_step_pattern_stride_length_range_load_safety_side_dose_and_stop_rule_are_unspecified'
          ELSE 'stance_grip_bar_position_range_load_tempo_safety_dose_and_stop_rule_are_unspecified'
        END),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1
    SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE id=definition_id_value;
  END LOOP;
END;
$strength_sources_366_390_quarantine$;
