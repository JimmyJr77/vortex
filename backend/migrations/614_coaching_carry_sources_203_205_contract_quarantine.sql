-- Source 203 leaves the bilateral carry implement, handle, lane, distance/time
-- unit, load, turn policy, and set-down undefined.  Source 205 also conflates
-- unilateral/bilateral and kettlebell/dumbbell front-rack contracts.  Do not
-- let either generic baseline become a selectable prescription.
DO $carry_sources_203_205_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[203, 205]
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
        display_name='Carry Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object(
          'selectable',false,
          'identityQuarantine',true,
          'exerciseCardDoesNotClassifyParticipants',true,
          'unresolvedContract',CASE source_id_value
            WHEN 203 THEN 'bilateral_carry_implement_handle_lane_distance_or_time_turn_load_set_down_and_dosage_are_unspecified'
            WHEN 205 THEN 'unilateral_or_bilateral_and_kettlebell_or_dumbbell_front_rack_implement_position_lane_distance_or_time_load_set_down_and_dosage_are_conflated'
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
$carry_sources_203_205_quarantine$;
