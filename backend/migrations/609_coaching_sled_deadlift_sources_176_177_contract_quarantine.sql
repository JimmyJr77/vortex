-- Source 176 lacks a sled-load, attachment, surface, body-angle, step,
-- distance, return, and fatigue contract.  Source 177 combines trap-bar and
-- kettlebell deadlifts and leaves their distinct grips, start heights, range,
-- pickup/set-down, load, and dosage unresolved.
DO $sled_deadlift_quarantine$
DECLARE source_record RECORD;
BEGIN
  FOR source_record IN
    SELECT * FROM (VALUES
      ('heavy-sled-push-march', 'Heavy Sled Push / March Contract Quarantine — Source 176', 'sled_type_load_attachment_surface_body_angle_hand_position_step_pattern_distance_return_lane_dosage_load_and_fatigue_are_unspecified'),
      ('trap-bar-deadlift', 'Trap-Bar / Kettlebell Deadlift Identity Quarantine — Source 177', 'trap_bar_vs_kettlebell_implement_grip_stance_start_height_range_pickup_set_down_load_tempo_dosage_and_fatigue_are_conflated')
    ) AS source_data(slug_value, display_value, unresolved_value)
  LOOP
    UPDATE coaching.exercise_variant_v1 v
    SET status='archived',requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',source_record.unresolved_value),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    FROM coaching.exercise_definition_v1 d
    WHERE v.definition_id=d.id AND d.facility_id=1 AND d.slug=source_record.slug_value AND v.variant_key IN ('baseline','baseline-source-1145','baseline-source-1325');
    UPDATE coaching.exercise_definition_v1 d
    SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE d.facility_id=1 AND d.slug=source_record.slug_value;
  END LOOP;
END;
$sled_deadlift_quarantine$;
