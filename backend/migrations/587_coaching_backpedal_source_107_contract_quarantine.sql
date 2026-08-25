-- Source 107's active backpedal record is operationally empty and does not
-- define travel direction/distance, start/finish, cadence, turn policy, visual
-- awareness, stopping, count, load, or fatigue.  It cannot be a generic base.
DO $source_107_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=107 AND slug='backpedal-walkthrough';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 107 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-107', display_name='Backpedal Mechanics Contract Quarantine — Source 107', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','travel_direction_distance_start_finish_cadence_turn_policy_visual_awareness_stop_count_load_and_fatigue_are_unspecified'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('travel_direction_distance_start_finish','cadence_turn_and_visual_awareness','stop_and_count','load_fatigue')) WHERE id=definition_id_value;
END;
$source_107_quarantine$;
