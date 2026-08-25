-- Sources 131–134 name distinct sprint drills but omit their defining lane,
-- implement, segment, speed, exit, recovery, and fatigue contracts.  Keep
-- source lineage and unverified media, but prohibit selection until exact
-- candidate variants are authored and reviewed.
DO $sprint_rhythm_quarantine$
DECLARE source_record RECORD;
BEGIN
  FOR source_record IN
    SELECT * FROM (VALUES
      (131, 'ins-and-outs', 'Ins-and-Outs Contract Quarantine — Source 131', 'segment_count_segment_distance_intensity_targets_transition_cue_lane_exit_deceleration_measurement_rest_dosage_load_and_fatigue_are_unspecified'),
      (132, 'wicket-runs', 'Wicket Runs Contract Quarantine — Source 132', 'wicket_height_spacing_run_in_entry_speed_contact_pattern_exit_deceleration_measurement_rest_dosage_load_and_fatigue_are_unspecified'),
      (133, 'mini-hurdle-sprint-rhythm', 'Mini-Hurdle Sprint Rhythm Contract Quarantine — Source 133', 'hurdle_height_spacing_run_in_cadence_target_speed_exit_deceleration_measurement_rest_dosage_load_and_fatigue_are_unspecified'),
      (134, 'curved-sprint-arc-run', 'Curved Sprint / Arc Run Contract Quarantine — Source 134', 'curve_radius_direction_lane_width_entry_speed_exit_deceleration_measurement_rest_dosage_load_and_fatigue_are_unspecified')
    ) AS source_data(legacy_id, slug_value, display_value, unresolved_value)
  LOOP
    UPDATE coaching.exercise_variant_v1 v
    SET variant_key='identity-quarantine-source-' || source_record.legacy_id,
        display_name=source_record.display_value,
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',source_record.unresolved_value),
        difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,
        programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    FROM coaching.exercise_definition_v1 d
    WHERE v.definition_id=d.id AND d.facility_id=1 AND d.legacy_exercise_id=source_record.legacy_id AND d.slug=source_record.slug_value AND v.variant_key='baseline';

    UPDATE coaching.exercise_definition_v1 d
    SET status='archived',card_version=card_version+1,
        provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE d.facility_id=1 AND d.legacy_exercise_id=source_record.legacy_id AND d.slug=source_record.slug_value;
  END LOOP;
END;
$sprint_rhythm_quarantine$;
